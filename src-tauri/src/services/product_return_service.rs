use std::collections::HashMap;

use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::product_return::{CreateReturnInput, ProductReturn, ReturnSummary};
use crate::repositories::{product_return_repository, sale_repository};
use crate::services;

fn round2(v: f64) -> f64 {
    f64::round(v * 100.0) / 100.0
}

/// Return conditions that keep the item sellable, so its stock (and phone
/// IMEI) is automatically restored to inventory.
const SELLABLE_CONDITIONS: &[&str] = &[
    "sellable",
    "like new",
    "like_new",
    "working",
    "good",
    "used",
    "open box",
    "open_box",
];

fn is_sellable_condition(cond: &str) -> bool {
    SELLABLE_CONDITIONS.iter().any(|s| *s == cond)
}

fn normalize_condition(cond: &str) -> Result<String, AppError> {
    let c = cond.trim().to_lowercase();
    if c.is_empty() {
        return Err(AppError::validation("Return condition is required"));
    }
    Ok(c)
}

/// One validated returned line, ready to be persisted inside the transaction.
struct Line {
    sale_item_id: i64,
    item_type: String,
    item_id: i64,
    imei_id: Option<i64>,
    quantity: i64,
    unit_price: f64,
    line_total: f64,
    product_name: Option<String>,
    imei: Option<String>,
    serial_no: Option<String>,
    reason: Option<String>,
    condition: String,
    restock: bool,
    deduction: f64,
    refund: f64,
}

pub fn create(
    conn: &Connection,
    input: CreateReturnInput,
    actor: Option<i64>,
) -> Result<ProductReturn, AppError> {
    if input.items.is_empty() {
        return Err(AppError::validation(
            "A return must contain at least one item",
        ));
    }
    if input.return_charge_percent < 0.0 {
        return Err(AppError::validation(
            "Return charge percent cannot be negative",
        ));
    }
    if let Some(fixed) = input.fixed_deduction {
        if fixed < 0.0 {
            return Err(AppError::validation("Fixed deduction cannot be negative"));
        }
    }

    let sale = sale_repository::get_sale_with_items(conn, input.sale_id)?
        .ok_or_else(|| AppError::validation("Sale not found"))?;

    let sale_ids: Vec<i64> = sale.items.iter().map(|i| i.id).collect();
    let mut returned = product_return_repository::returned_qty_by_sale_items(conn, &sale_ids)?;

    let mut lines: Vec<Line> = Vec::new();
    let mut total_value = 0.0;

    // Tracks sale lines already present in THIS form (not anything already
    // returned in earlier forms).
    let mut seen_this_form: HashMap<i64, ()> = HashMap::new();

    for item in &input.items {
        let Some(si) = sale.items.iter().find(|s| s.id == item.sale_item_id) else {
            return Err(AppError::validation(format!(
                "Sale item {} is not part of this sale",
                item.sale_item_id
            )));
        };

        // Each line of the sale can only appear once in a single return form.
        if seen_this_form.contains_key(&si.id) {
            return Err(AppError::validation(format!(
                "Item '{}' is listed more than once in this return",
                si.product_name.as_deref().unwrap_or("product")
            )));
        }
        seen_this_form.insert(si.id, ());

        if item.quantity < 1 {
            return Err(AppError::validation("Return quantity must be at least 1"));
        }
        let prev_returned = returned.get(&si.id).copied().unwrap_or(0);
        let remaining = si.quantity - prev_returned;
        if item.quantity > remaining {
            return Err(AppError::validation(format!(
                "Cannot return more than {} of '{}'",
                remaining,
                si.product_name.as_deref().unwrap_or("this item")
            )));
        }

        *returned.entry(si.id).or_insert(0) += item.quantity;

        // IMEI/serial is never mandatory: it is only used to identify the
        // exact device when one was recorded on the sale. If the caller picks
        // an IMEI it must match the device sold on that line (identity check),
        // otherwise we fall back to the quantity-based return flow.
        let mut imei_id = None;
        if si.item_type == "phone" {
            if let Some(iid) = item.imei_id {
                if si.imei_id != Some(iid) {
                    return Err(AppError::validation(
                        "The selected IMEI does not belong to this phone sale",
                    ));
                }
                imei_id = Some(iid);
            } else if let Some(sold_imei) = si.imei_id {
                // No IMEI supplied (e.g. customer only has the bill): take it
                // from the sale line so the exact device is still tracked.
                imei_id = Some(sold_imei);
            }
        }

        let condition = normalize_condition(&item.condition)?;
        let restock = is_sellable_condition(&condition);
        let unit_price = round2(si.unit_price);
        let line_total = round2(unit_price * item.quantity as f64);
        total_value += line_total;
        lines.push(Line {
            sale_item_id: si.id,
            item_type: si.item_type.clone(),
            item_id: si.item_id,
            imei_id,
            quantity: item.quantity,
            unit_price,
            line_total,
            product_name: si.product_name.clone(),
            imei: si.imei.clone(),
            serial_no: si.serial_no.clone(),
            reason: item
                .reason
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string),
            condition,
            restock,
            deduction: 0.0,
            refund: 0.0,
        });
    }

    if total_value <= 0.0 {
        return Err(AppError::validation("Returned value must be greater than zero"));
    }

    // ----- Deduction rule: a fixed amount overrides the percentage -----
    let fixed_deduction = input.fixed_deduction.unwrap_or(0.0);
    let target_deduction = if fixed_deduction > 0.0 {
        round2(fixed_deduction)
    } else {
        round2(total_value * input.return_charge_percent / 100.0)
    };
    if target_deduction > total_value {
        return Err(AppError::validation("Deduction cannot exceed the returned value"));
    }

    // Allocate the deduction proportionally across the lines so the header
    // totals always equal the sum of the line deductions (remainder pushes any
    // rounding difference into the last line).
    let mut allocated = 0.0;
    let n = lines.len();
    for (i, line) in lines.iter_mut().enumerate() {
        line.deduction = if i == n - 1 {
            round2(target_deduction - allocated)
        } else {
            let d = round2((line.line_total / total_value) * target_deduction);
            allocated += d;
            d
        };
        let mut refund = round2(line.line_total - line.deduction);
        if refund < 0.0 {
            refund = 0.0;
        }
        line.refund = refund;
    }

    let deduction_amount = round2(lines.iter().map(|l| l.deduction).sum());
    let refund_amount = round2(lines.iter().map(|l| l.refund).sum());

    let condition_label = if lines.iter().all(|l| l.restock) {
        "sellable".to_string()
    } else if lines.iter().all(|l| !l.restock) {
        "nonsellable".to_string()
    } else {
        "mixed".to_string()
    };

    let refund_method = input
        .refund_method
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or("cash")
        .to_lowercase();

    let return_date = input
        .return_date
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d %H:%M").to_string());

    let notes = input
        .notes
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());

    // ----- Persist everything in a single transaction -----
    let tx = conn.unchecked_transaction()?;
    let return_no = product_return_repository::next_return_no(&tx)?;

    let reason = lines.iter().find_map(|l| l.reason.clone());

    let return_id = product_return_repository::insert_return(
        &tx,
        &return_no,
        input.sale_id,
        sale.member_id,
        sale.member_name.as_deref(),
        sale.member_phone.as_deref(),
        Some(&sale.receipt_no),
        round2(total_value),
        deduction_amount,
        refund_amount,
        input.return_charge_percent,
        &refund_method,
        Some(&return_date),
        reason.as_deref(),
        &condition_label,
        notes,
        actor,
    )?;

    for line in &lines {
        product_return_repository::insert_return_item(
            &tx,
            return_id,
            line.sale_item_id,
            &line.item_type,
            line.item_id,
            line.imei_id,
            line.product_name.as_deref(),
            line.imei.as_deref(),
            line.serial_no.as_deref(),
            line.quantity,
            line.unit_price,
            line.line_total,
            line.deduction,
            line.refund,
            line.reason.as_deref(),
            &line.condition,
            line.restock,
        )?;

        // ----- Inventory restoration -----
        // Phones and accessories share the same quantity-based flow. An
        // IMEI, when recorded, additionally tracks the exact device but is
        // booked only once per returned unit and is best-effort — it never
        // blocks or fails a return the owner chose to process.
        if line.restock {
            product_return_repository::increment_stock(
                &tx,
                &line.item_type,
                line.item_id,
                line.quantity,
            )?;
        }
        if line.item_type == "phone" && line.quantity == 1 {
            if let Some(imei_id) = line.imei_id {
                if product_return_repository::imei_status(&tx, imei_id)? == Some("sold".to_string())
                {
                    if line.restock {
                        product_return_repository::restore_imei(&tx, imei_id)?;
                    } else {
                        product_return_repository::mark_imei_defective(&tx, imei_id)?;
                    }
                }
            }
        }
    }
    tx.commit()?;

    services::record_activity(conn, actor, "return", "create", Some(return_id))?;

    product_return_repository::get_return_with_items(conn, return_id)?
        .ok_or_else(|| AppError::Internal("Created return could not be retrieved".into()))
}

pub fn list(conn: &Connection, search: Option<String>) -> Result<Vec<ReturnSummary>, AppError> {
    product_return_repository::list_returns(conn, search.as_deref())
}

pub fn get(conn: &Connection, id: i64) -> Result<ProductReturn, AppError> {
    product_return_repository::get_return_with_items(conn, id)?
        .ok_or_else(|| AppError::validation("Return not found"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::accessory::CreateAccessoryInput;
    use crate::models::phone::{AddPhoneImeiInput, CreatePhoneInput};
    use crate::models::product_return::ReturnItemInput;
    use crate::models::sale::{CreateSaleInput, SaleItemInput};
    use crate::services::{
        accessory_service, phone_service, sale_service, test_utils::{in_memory_conn, seed_product_categories},
    };

    fn phone(conn: &Connection, qty: i64, price: f64) -> i64 {
        phone_service::create(
            conn,
            CreatePhoneInput {
                brand: "Samsung".into(),
                model: "S24".into(),
                color: None,
                storage: None,
                cost_price: 500.0,
                sale_price: price,
                quantity: qty,
                supplier_id: None,
                low_stock_threshold: 0,
                ..Default::default()
            },
        )
        .unwrap()
        .id
    }

    /// Creates a phone with an IMEI, sells it with that IMEI, returns
    /// (phone_id, imei_id).
    fn sell_imei_phone(conn: &Connection) -> (i64, i64) {
        let pid = phone(conn, 3, 100.0);
        let iid = add_imei_to(conn, pid, "111111111111111");
        sale_service::create(
            conn,
            CreateSaleInput {
                member_id: None,
                discount: 0.0,
                paid_amount: None,
                payment_method: Some("cash".into()),
                notes: None,
                items: vec![SaleItemInput {
                    item_type: "phone".into(),
                    item_id: pid,
                    quantity: 1,
                    imei_id: Some(iid),
                    unit_price: None,
                }],
            },
            None,
        )
        .unwrap();
        (pid, iid)
    }

    fn add_imei_to(conn: &Connection, phone_id: i64, imei: &str) -> i64 {
        phone_service::add_imei(
            conn,
            AddPhoneImeiInput {
                phone_id,
                imei: imei.into(),
            },
        )
        .unwrap()
        .id
    }

    fn return_input(sale_id: i64, sale_item_id: i64, qty: i64, condition: &str) -> CreateReturnInput {
        CreateReturnInput {
            sale_id,
            return_charge_percent: 0.0,
            fixed_deduction: None,
            refund_method: Some("cash".into()),
            return_date: None,
            notes: None,
            items: vec![ReturnItemInput {
                sale_item_id,
                quantity: qty,
                imei_id: None,
                reason: Some("change of mind".into()),
                condition: condition.into(),
            }],
        }
    }

    fn sale_item_id(conn: &Connection, sale_id: i64) -> i64 {
        let sale = sale_repository::get_sale_with_items(conn, sale_id).unwrap().unwrap();
        sale.items[0].id
    }

    fn imei_status_of(conn: &Connection, imei_id: i64) -> String {
        product_return_repository::imei_status(conn, imei_id)
            .unwrap()
            .unwrap()
    }

    fn accessory(conn: &Connection) -> i64 {
        seed_product_categories(conn);
        accessory_service::create(
            conn,
            CreateAccessoryInput {
                accessory_type: "Charger".into(),
                brand: "Spigen".into(),
                product_name: "Fast Charger".into(),
                compatible_models: None,
                color: None,
                condition: None,
                connector_type: None,
                warranty: None,
                features: None,
                description: None,
                sku: None,
                serial_number: None,
                image_paths: vec![],
                cost_price: 10.0,
                sale_price: 30.0,
                quantity: 5,
                supplier_id: None,
                low_stock_threshold: 0,
            },
        )
        .unwrap()
        .id
    }

    fn accessory_sale(conn: &Connection, aid: i64) -> crate::models::sale::Sale {
        let ok = sale_service::create(
            conn,
            CreateSaleInput {
                member_id: None,
                discount: 0.0,
                paid_amount: None,
                payment_method: Some("cash".into()),
                notes: None,
                items: vec![SaleItemInput {
                    item_type: "accessory".into(),
                    item_id: aid,
                    quantity: 5,
                    imei_id: None,
                    unit_price: None,
                }],
            },
            None,
        )
        .unwrap();
        ok
    }

    #[test]
    fn returns_phone_and_restores_stock_and_imei() {
        let conn = in_memory_conn();
        let (pid, iid) = sell_imei_phone(&conn);
        let sale_id = sale_service::list(&conn, None).unwrap()[0].id;
        let sid = sale_item_id(&conn, sale_id);
        let mut input = return_input(sale_id, sid, 1, "sellable");
        input.items[0].imei_id = Some(iid);
        let ret = create(&conn, input, None).unwrap();

        assert!(ret.return_no.starts_with("RET-"));
        assert_eq!(ret.condition, "sellable");
        assert_eq!(ret.refund_amount, 100.0);
        assert_eq!(ret.items.len(), 1);
        assert!(ret.items[0].restocked);
        // started 3, +1 for IMEI = 4, -1 sold = 3, +1 restocked = 4
        assert_eq!(phone_service::get(&conn, pid).unwrap().quantity, 4);
        assert_eq!(imei_status_of(&conn, iid), "in_stock");
    }

    #[test]
    fn damaged_phone_is_not_restocked_and_imei_marked_defective() {
        let conn = in_memory_conn();
        let (pid, iid) = sell_imei_phone(&conn);
        let sale_id = sale_service::list(&conn, None).unwrap()[0].id;
        let sid = sale_item_id(&conn, sale_id);
        let mut input = return_input(sale_id, sid, 1, "damaged");
        input.items[0].imei_id = Some(iid);
        let ret = create(&conn, input, None).unwrap();

        assert_eq!(ret.condition, "nonsellable");
        assert!(!ret.items[0].restocked);
        // started 3, +1 for IMEI = 4, -1 sold = 3, damaged (no restock) = 3
        assert_eq!(phone_service::get(&conn, pid).unwrap().quantity, 3);
        assert_eq!(imei_status_of(&conn, iid), "defective");
    }

    #[test]
    fn returns_phone_sold_without_imei_by_quantity() {
        let conn = in_memory_conn();
        // A phone can be sold without an IMEI (no warranty / no serialization).
        // The owner may still process the return based on quantity alone.
        let pid = phone(&conn, 3, 100.0);
        let sale_id = sale_phone(&conn, pid, 2, 100.0);
        let sid = sale_item_id(&conn, sale_id);

        let ret = create(&conn, return_input(sale_id, sid, 2, "sellable"), None).unwrap();
        assert_eq!(ret.condition, "sellable");
        assert!(ret.items[0].restocked);
        assert_eq!(ret.items[0].quantity, 2);
        assert_eq!(ret.items[0].imei, None);
        // started 3, -2 sold = 1, +2 restocked = 3
        assert_eq!(phone_service::get(&conn, pid).unwrap().quantity, 3);
    }

    #[test]
    fn phone_return_cannot_exceed_sold_quantity() {
        let conn = in_memory_conn();
        let pid = phone(&conn, 3, 100.0);
        let sale_id = sale_phone(&conn, pid, 2, 100.0);
        let sid = sale_item_id(&conn, sale_id);
        let err = create(&conn, return_input(sale_id, sid, 3, "sellable"), None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    fn sale_phone(conn: &Connection, phone_id: i64, qty: i64, price: f64) -> i64 {
        sale_service::create(
            conn,
            CreateSaleInput {
                member_id: None,
                discount: 0.0,
                paid_amount: None,
                payment_method: Some("cash".into()),
                notes: None,
                items: vec![SaleItemInput {
                    item_type: "phone".into(),
                    item_id: phone_id,
                    quantity: qty,
                    imei_id: None,
                    unit_price: Some(price),
                }],
            },
            None,
        )
        .unwrap()
        .id
    }

    #[test]
    fn rejects_imei_that_does_not_belong_to_the_sale() {
        let conn = in_memory_conn();
        let pid = phone(&conn, 5, 100.0);
        let iid = add_imei_to(&conn, pid, "222222222222222");
        let sale_id = sale_phone(&conn, pid, 1, 100.0);
        let sid = sale_item_id(&conn, sale_id);

        let mut input = return_input(sale_id, sid, 1, "sellable");
        input.items[0].imei_id = Some(iid);
        let err = create(&conn, input, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn cannot_return_a_device_already_returned() {
        let conn = in_memory_conn();
        let (_, iid) = sell_imei_phone(&conn);
        let sale_id = sale_service::list(&conn, None).unwrap()[0].id;
        let sid = sale_item_id(&conn, sale_id);

        let mut input = return_input(sale_id, sid, 1, "sellable");
        input.items[0].imei_id = Some(iid);
        create(&conn, input.clone(), None).unwrap();

        let err = create(&conn, input, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn phone_sold_with_imei_auto_identifies_the_device() {
        let conn = in_memory_conn();
        let (_, iid) = sell_imei_phone(&conn);
        let sale_id = sale_service::list(&conn, None).unwrap()[0].id;
        let sid = sale_item_id(&conn, sale_id);

        // The UI does not need to send an IMEI: when the sale line recorded
        // one, the exact device is taken automatically for a single-unit.
        let ret = create(&conn, return_input(sale_id, sid, 1, "sellable"), None).unwrap();
        assert_eq!(ret.items[0].imei_id, Some(iid));
        assert!(ret.items[0].restocked);
        assert_eq!(imei_status_of(&conn, iid), "in_stock");
    }

    #[test]
    fn applies_percentage_charge() {
        let conn = in_memory_conn();
        let aid = accessory(&conn);
        let sale = accessory_sale(&conn, aid);
        let sid = sale.items[0].id;

        let mut input = return_input(sale.id, sid, 2, "sellable");
        input.return_charge_percent = 10.0;
        let ret = create(&conn, input, None).unwrap();
        assert_eq!(ret.total_sale_price, 60.0);
        assert_eq!(ret.deduction_amount, 6.0);
        assert_eq!(ret.refund_amount, 54.0);
        assert_eq!(ret.items[0].deduction_amount, 6.0);
        assert_eq!(ret.items[0].refund_amount, 54.0);
        assert_eq!(accessory_service::get(&conn, aid).unwrap().quantity, 2);
    }

    #[test]
    fn applies_zero_percent_charge() {
        let conn = in_memory_conn();
        let aid = accessory(&conn);
        let sale = accessory_sale(&conn, aid);
        let sid = sale.items[0].id;
        let ret = create(&conn, return_input(sale.id, sid, 1, "sellable"), None).unwrap();
        assert_eq!(ret.deduction_amount, 0.0);
        assert_eq!(ret.refund_amount, 30.0);
    }

    #[test]
    fn applies_custom_percentage() {
        let conn = in_memory_conn();
        let aid = accessory(&conn);
        let sale = accessory_sale(&conn, aid);
        let sid = sale.items[0].id;
        let mut input = return_input(sale.id, sid, 1, "sellable");
        input.return_charge_percent = 15.0;
        let ret = create(&conn, input, None).unwrap();
        assert_eq!(ret.deduction_amount, 4.5);
        assert_eq!(ret.refund_amount, 25.5);
    }

    #[test]
    fn fixed_deduction_overrides_percentage() {
        let conn = in_memory_conn();
        let aid = accessory(&conn);
        let sale = accessory_sale(&conn, aid);
        let sid = sale.items[0].id;
        let mut input = return_input(sale.id, sid, 1, "sellable");
        input.return_charge_percent = 10.0;
        input.fixed_deduction = Some(7.0);
        let ret = create(&conn, input, None).unwrap();
        assert_eq!(ret.deduction_amount, 7.0);
        assert_eq!(ret.refund_amount, 23.0);
    }

    #[test]
    fn rejects_deduction_above_returned_value() {
        let conn = in_memory_conn();
        let aid = accessory(&conn);
        let sale = accessory_sale(&conn, aid);
        let sid = sale.items[0].id;
        let mut input = return_input(sale.id, sid, 1, "sellable");
        input.return_charge_percent = 150.0;
        let err = create(&conn, input, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn returns_accessory_and_restores_stock() {
        let conn = in_memory_conn();
        let aid = accessory(&conn);
        let sale = accessory_sale(&conn, aid);
        let sid = sale.items[0].id;

        let mut input = return_input(sale.id, sid, 2, "sellable");
        input.return_charge_percent = 10.0;
        let ret = create(&conn, input, None).unwrap();
        assert_eq!(ret.total_sale_price, 60.0);
        assert_eq!(ret.deduction_amount, 6.0);
        assert_eq!(ret.refund_amount, 54.0);
        assert_eq!(ret.items[0].quantity, 2);
        assert_eq!(accessory_service::get(&conn, aid).unwrap().quantity, 2);
    }

    #[test]
    fn partial_return_then_excess_return_is_rejected() {
        let conn = in_memory_conn();
        let aid = accessory(&conn);
        let sale = accessory_sale(&conn, aid);
        let sid = sale.items[0].id;

        let first = return_input(sale.id, sid, 2, "sellable");
        create(&conn, first, None).unwrap();

        let mut second = return_input(sale.id, sid, 4, "sellable");
        second.return_charge_percent = 10.0;
        let err = create(&conn, second, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn lists_and_gets_return() {
        let conn = in_memory_conn();
        let aid = accessory(&conn);
        let sale = accessory_sale(&conn, aid);
        let sid = sale.items[0].id;
        let ret = create(&conn, return_input(sale.id, sid, 1, "sellable"), None).unwrap();

        assert_eq!(list(&conn, None).unwrap().len(), 1);
        assert_eq!(list(&conn, Some(ret.return_no.clone())).unwrap().len(), 1);
        let got = get(&conn, ret.id).unwrap();
        assert_eq!(got.return_no, ret.return_no);
        assert_eq!(got.items.len(), 1);
    }

    #[test]
    fn sale_records_return_status() {
        let conn = in_memory_conn();
        let aid = accessory(&conn);
        let sale = accessory_sale(&conn, aid);
        let sid = sale.items[0].id;

        let fresh = sale_service::get(&conn, sale.id).unwrap();
        assert_eq!(fresh.return_status, "none");
        assert_eq!(fresh.returned_amount, 0.0);
        assert_eq!(fresh.return_count, 0);
        assert!(fresh.returns.is_empty());

        // Partial: only 2 of the 5 sold items are returned.
        create(&conn, return_input(sale.id, sid, 2, "sellable"), None).unwrap();
        let partial = sale_service::get(&conn, sale.id).unwrap();
        assert_eq!(partial.return_status, "partial");
        assert_eq!(partial.return_count, 1);
        assert!(partial.returned_amount > 0.0);
        assert_eq!(partial.returns.len(), 1);
        assert_eq!(partial.returns[0].items.len(), 1);

        // Full: the remaining 3 are returned, making two returns in total.
        let mut rest = return_input(sale.id, sid, 3, "sellable");
        rest.return_charge_percent = 10.0;
        create(&conn, rest, None).unwrap();
        let full = sale_service::get(&conn, sale.id).unwrap();
        assert_eq!(full.return_status, "full");
        assert_eq!(full.return_count, 2);
        assert_eq!(full.returns.len(), 2);
        assert!(full.returned_amount > 0.0);

        // The list query carries the same aggregates (no item snapshots).
        let listed = sale_service::list(&conn, None).unwrap();
        let row = listed.iter().find(|x| x.id == sale.id).unwrap();
        assert_eq!(row.return_status, "full");
        assert_eq!(row.return_count, 2);
        assert!(row.returned_amount > 0.0);
        assert!(row.returns.is_empty());
    }
}