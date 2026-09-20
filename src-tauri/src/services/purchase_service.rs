use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::purchase::{
    CreatePurchaseInput, CreateSupplierPaymentInput, Purchase, SupplierBalance, SupplierPayment,
};
use crate::repositories::{purchase_repository, supplier_repository};
use crate::services;
use crate::utils;

fn normalize_payment_method(m: &str) -> String {
    let m = m.trim().to_lowercase();
    if m.is_empty() {
        "cash".into()
    } else {
        m
    }
}

fn validate_sp_status(s: Option<&str>) -> String {
    match s {
        Some(v) => {
            let v = v.trim().to_lowercase();
            if matches!(
                v.as_str(),
                "completed" | "pending" | "cancelled" | "refunded"
            ) {
                v
            } else {
                "completed".into()
            }
        }
        None => "completed".into(),
    }
}

pub struct Line {
    pub item_type: String,
    pub item_id: i64,
    pub quantity: i64,
    pub unit_cost: f64,
    pub selling_price: Option<f64>,
    pub warranty: Option<String>,
    pub condition: Option<String>,
    pub imeis: Vec<String>,
}

pub fn prepare_purchase_lines(
    conn: &Connection,
    input: &CreatePurchaseInput,
) -> Result<(Vec<Line>, Vec<String>, f64), AppError> {
    if input.items.is_empty() {
        return Err(AppError::validation(
            "A purchase must contain at least one item",
        ));
    }
    if input.discount < 0.0 {
        return Err(AppError::validation("Discount cannot be negative"));
    }

    if let Some(sid) = input.supplier_id {
        if supplier_repository::get_by_id(conn, sid)?.is_none() {
            return Err(AppError::validation("Supplier not found"));
        }
    }

    let mut lines: Vec<Line> = Vec::new();
    let mut subtotal = 0.0;
    let mut all_imeis: Vec<String> = Vec::new();

    for item in &input.items {
        let item_type = match item.item_type.as_str() {
            "phone" | "accessory" => item.item_type.clone(),
            _ => {
                return Err(AppError::validation(
                    "Item type must be 'phone' or 'accessory'",
                ))
            }
        };
        if item.quantity < 1 {
            return Err(AppError::validation("Item quantity must be at least 1"));
        }
        if purchase_repository::item_quantity(conn, &item_type, item.item_id)?.is_none() {
            return Err(AppError::validation(if item_type == "phone" {
                "Phone not found"
            } else {
                "Accessory not found"
            }));
        }

        let unit_cost = match item.unit_cost {
            Some(c) if c > 0.0 => c,
            _ => purchase_repository::item_cost(conn, &item_type, item.item_id)?.unwrap_or(0.0),
        };
        if unit_cost < 0.0 {
            return Err(AppError::validation("Unit cost cannot be negative"));
        }
        if let Some(sp) = item.selling_price {
            if sp < 0.0 {
                return Err(AppError::validation("Selling price cannot be negative"));
            }
        }

        let mut seen: Vec<String> = Vec::new();
        if item_type == "phone" {
            for imei in item
                .imeis
                .iter()
                .map(|s| s.trim().to_uppercase())
                .filter(|s| !s.is_empty())
            {
                if imei.len() < 8 {
                    return Err(AppError::validation("IMEI must be at least 8 characters"));
                }
                if seen.contains(&imei) {
                    return Err(AppError::validation(format!("IMEI {imei} is duplicated")));
                }
                seen.push(imei.clone());
                all_imeis.push(imei);
            }
            if seen.len() != item.quantity as usize {
                return Err(AppError::validation(format!(
                    "Quantity {} requires exactly {} IMEI(s) for this phone, but {} were provided",
                    item.quantity,
                    item.quantity,
                    seen.len()
                )));
            }
        }

        subtotal += utils::round2(unit_cost * item.quantity as f64);
        let trim = |s: &Option<String>| -> Option<String> {
            s.as_deref()
                .map(|x| x.trim().to_string())
                .filter(|x| !x.is_empty())
        };
        lines.push(Line {
            item_type,
            item_id: item.item_id,
            quantity: item.quantity,
            unit_cost: utils::round2(unit_cost),
            selling_price: item.selling_price.map(utils::round2),
            warranty: trim(&item.warranty),
            condition: trim(&item.condition),
            imeis: seen,
        });
    }

    Ok((lines, all_imeis, subtotal))
}

pub fn create_purchase(
    conn: &Connection,
    input: CreatePurchaseInput,
    actor: Option<i64>,
) -> Result<Purchase, AppError> {
    let (lines, all_imeis, subtotal) = prepare_purchase_lines(conn, &input)?;


    // One query for the whole batch (duplicates across line items are handled
    // by the per-line `seen` check plus a global HashSet scan below).
    if !all_imeis.is_empty() {
        let mut seen_global: std::collections::HashSet<String> = std::collections::HashSet::new();
        for imei in &all_imeis {
            if !seen_global.insert(imei.clone()) {
                return Err(AppError::validation(format!("IMEI {imei} is duplicated")));
            }
        }
        let mut used = purchase_repository::imeis_in_use(conn, &all_imeis)?;
        used.retain(|u| seen_global.contains(u));
        if let Some(first) = used.into_iter().next() {
            return Err(AppError::validation(format!(
                "IMEI {first} is already in use"
            )));
        }
    }

    let total_amount = utils::round2(subtotal - input.discount);
    if total_amount < 0.0 {
        return Err(AppError::validation("Discount cannot exceed subtotal"));
    }
    let paid_amount = match input.paid_amount {
        Some(p) => {
            if !p.is_finite() || p < 0.0 {
                return Err(AppError::validation("Paid amount is invalid"));
            }
            utils::round2(p)
        }
        None => total_amount,
    };
    if paid_amount > total_amount + 0.005 {
        return Err(AppError::validation(
            "Paid amount cannot be greater than the purchase total",
        ));
    }
    let payment_method = input
        .payment_method
        .as_deref()
        .map(normalize_payment_method)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "cash".into());

    let purchase_no = purchase_repository::next_purchase_no(conn)?;
    let notes = input
        .notes
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let purchase_date = input
        .purchase_date
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let invoice_reference = input
        .invoice_reference
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());

    // Apply atomically: record purchase, boost stock, register IMEIs, update
    // last purchase cost + supplier balance (ledger). A failure at any step
    // rolls everything back so no partial stock or financial updates remain.
    let tx = conn.unchecked_transaction()?;
    let purchase_id = purchase_repository::insert_purchase(
        &tx,
        &purchase_no,
        input.supplier_id,
        total_amount,
        utils::round2(input.discount),
        paid_amount,
        &payment_method,
        purchase_date,
        invoice_reference,
        notes,
        actor,
    )?;

    for line in &lines {
        purchase_repository::insert_purchase_item(
            &tx,
            purchase_id,
            &line.item_type,
            line.item_id,
            line.quantity,
            line.unit_cost,
            line.selling_price,
            line.warranty.as_deref(),
            line.condition.as_deref(),
            &line.imeis,
        )?;
        purchase_repository::increment_stock(&tx, &line.item_type, line.item_id, line.quantity)?;
        purchase_repository::update_last_purchase_cost(
            &tx,
            &line.item_type,
            line.item_id,
            line.unit_cost,
        )?;
        purchase_repository::sync_product_prices(
            &tx,
            &line.item_type,
            line.item_id,
            line.unit_cost,
            line.selling_price,
        )?;
        if line.item_type == "phone" {
            purchase_repository::insert_imeis(&tx, line.item_id, &line.imeis)?;
        }
    }
    tx.commit()?;

    services::record_activity(conn, actor, "purchase", "create", Some(purchase_id))?;

    purchase_repository::get_purchase_with_items(conn, purchase_id)?
        .ok_or_else(|| AppError::Internal("Created purchase could not be retrieved".into()))
}

pub fn list(conn: &Connection, search: Option<String>) -> Result<Vec<Purchase>, AppError> {
    purchase_repository::list_purchases(conn, search.as_deref())
}

pub fn list_for_period(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<Vec<Purchase>, AppError> {
    purchase_repository::list_purchases_for_period(conn, from, to)
}

pub fn get(conn: &Connection, id: i64) -> Result<Purchase, AppError> {
    purchase_repository::get_purchase_with_items(conn, id)?
        .ok_or_else(|| AppError::validation("Purchase not found"))
}

pub fn delete_purchase(
    conn: &Connection,
    id: i64,
    actor: Option<i64>,
    reason: Option<String>,
) -> Result<(), AppError> {
    let existing = get(conn, id)?;
    let tx = conn.unchecked_transaction()?;

    // Revert inventory effects for existing items
    for item in &existing.items {
        purchase_repository::decrement_stock(&tx, &item.item_type, item.item_id, item.quantity)?;
        if item.item_type == "phone" {
            purchase_repository::delete_purchase_imeis(&tx, item.item_id, &item.serials)?;
        }
        purchase_repository::revert_last_purchase_cost(&tx, &item.item_type, item.item_id)?;
    }

    purchase_repository::delete_purchase(&tx, id)?;
    tx.commit()?;

    services::record_activity(
        conn,
        actor,
        "purchase",
        "delete",
        Some(id),
    )?;

    if let Some(r) = reason {
        services::record_activity(
            conn,
            actor,
            "purchase",
            "delete_reason",
            Some(id),
        )?;
        conn.execute("UPDATE activity_logs SET new_value = ?1 WHERE id = (SELECT MAX(id) FROM activity_logs WHERE action = 'delete' AND module = 'purchase')", [r])?;
    }

    Ok(())
}

pub fn update_purchase(
    conn: &Connection,
    id: i64,
    input: CreatePurchaseInput,
    actor: Option<i64>,
) -> Result<Purchase, AppError> {
    let existing = get(conn, id)?;
    
    let (lines, all_imeis, subtotal) = prepare_purchase_lines(conn, &input)?;
    
    // Check global IMEIs
    if !all_imeis.is_empty() {
        let mut seen_global: std::collections::HashSet<String> = std::collections::HashSet::new();
        for imei in &all_imeis {
            if !seen_global.insert(imei.clone()) {
                return Err(AppError::validation(format!("IMEI {imei} is duplicated")));
            }
        }
        // Exclude the IMEIs from the current purchase when checking if they're in use
        let mut existing_imeis = std::collections::HashSet::new();
        for item in &existing.items {
            if item.item_type == "phone" {
                for imei in &item.serials {
                    existing_imeis.insert(imei.clone());
                }
            }
        }
        
        let mut used = purchase_repository::imeis_in_use(conn, &all_imeis)?;
        used.retain(|u| seen_global.contains(u) && !existing_imeis.contains(u));
        if let Some(first) = used.into_iter().next() {
            return Err(AppError::validation(format!(
                "IMEI {first} is already in use"
            )));
        }
    }
    
    let total_amount = utils::round2(subtotal - input.discount);
    if total_amount < 0.0 {
        return Err(AppError::validation("Discount cannot exceed subtotal"));
    }
    let paid_amount = match input.paid_amount {
        Some(p) => {
            if !p.is_finite() || p < 0.0 {
                return Err(AppError::validation("Paid amount is invalid"));
            }
            utils::round2(p)
        }
        None => total_amount,
    };
    if paid_amount > total_amount + 0.005 {
        return Err(AppError::validation(
            "Paid amount cannot be greater than the purchase total",
        ));
    }
    let payment_method = input
        .payment_method
        .as_deref()
        .map(normalize_payment_method)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "cash".into());

    let notes = input
        .notes
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let purchase_date = input
        .purchase_date
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let invoice_reference = input
        .invoice_reference
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());

    let tx = conn.unchecked_transaction()?;

    // 1. Revert old items
    for item in &existing.items {
        purchase_repository::decrement_stock(&tx, &item.item_type, item.item_id, item.quantity)?;
        if item.item_type == "phone" {
            purchase_repository::delete_purchase_imeis(&tx, item.item_id, &item.serials)?;
        }
    }
    purchase_repository::delete_purchase_items(&tx, id)?;

    // 2. Update record
    purchase_repository::update_purchase_record(
        &tx,
        id,
        input.supplier_id,
        total_amount,
        utils::round2(input.discount),
        paid_amount,
        &payment_method,
        purchase_date,
        invoice_reference,
        notes,
    )?;

    // 3. Insert new items and apply effects
    for line in &lines {
        purchase_repository::insert_purchase_item(
            &tx,
            id,
            &line.item_type,
            line.item_id,
            line.quantity,
            line.unit_cost,
            line.selling_price,
            line.warranty.as_deref(),
            line.condition.as_deref(),
            &line.imeis,
        )?;
        purchase_repository::increment_stock(&tx, &line.item_type, line.item_id, line.quantity)?;
        purchase_repository::update_last_purchase_cost(
            &tx,
            &line.item_type,
            line.item_id,
            line.unit_cost,
        )?;
        purchase_repository::sync_product_prices(
            &tx,
            &line.item_type,
            line.item_id,
            line.unit_cost,
            line.selling_price,
        )?;
        if line.item_type == "phone" {
            purchase_repository::insert_imeis(&tx, line.item_id, &line.imeis)?;
        }
    }
    
    tx.commit()?;

    services::record_activity(conn, actor, "purchase", "update", Some(id))?;

    get(conn, id)
}

// ----- Supplier payments -----

pub fn create_supplier_payment(
    conn: &Connection,
    input: CreateSupplierPaymentInput,
    actor: Option<i64>,
) -> Result<SupplierPayment, AppError> {
    let normalized = normalize_supplier_payment(conn, input)?;
    validate_supplier_payment_balance(conn, &normalized, None)?;
    let id = purchase_repository::insert_supplier_payment(conn, &normalized, actor)?;
    services::record_activity(conn, actor, "supplier_payment", "create", Some(id))?;
    purchase_repository::get_supplier_payment(conn, id)?
        .ok_or_else(|| AppError::Internal("Created payment could not be retrieved".into()))
}

fn validate_supplier_payment_balance(
    conn: &Connection,
    input: &CreateSupplierPaymentInput,
    existing: Option<&SupplierPayment>,
) -> Result<(), AppError> {
    let Some(supplier_id) = input.supplier_id else {
        return Ok(());
    };
    if input.status.as_deref() != Some("completed") {
        return Ok(());
    }
    let mut available = supplier_balance(conn, supplier_id)?.balance.max(0.0);
    if let Some(payment) = existing {
        if payment.supplier_id == Some(supplier_id) && payment.status == "completed" {
            available = utils::round2(available + payment.amount);
        }
    }
    if input.amount > available + 0.005 {
        return Err(AppError::validation(format!(
            "Payment cannot exceed the supplier balance of Rs {available:.2}"
        )));
    }
    Ok(())
}

fn normalize_supplier_payment(
    conn: &Connection,
    input: CreateSupplierPaymentInput,
) -> Result<CreateSupplierPaymentInput, AppError> {
    if !input.amount.is_finite() || input.amount <= 0.0 {
        return Err(AppError::validation(
            "Payment amount must be greater than zero",
        ));
    }
    let amount = utils::round2(input.amount);
    if let Some(sid) = input.supplier_id {
        if supplier_repository::get_by_id(conn, sid)?.is_none() {
            return Err(AppError::validation("Supplier not found"));
        }
    }

    Ok(CreateSupplierPaymentInput {
        supplier_id: input.supplier_id,
        amount,
        payment_method: Some(normalize_payment_method(
            input.payment_method.as_deref().unwrap_or("cash"),
        )),
        status: Some(validate_sp_status(input.status.as_deref())),
        reference: input
            .reference
            .map(|r| r.trim().to_string())
            .filter(|r| !r.is_empty()),
        notes: input
            .notes
            .map(|n| n.trim().to_string())
            .filter(|n| !n.is_empty()),
        payment_date: input.payment_date,
    })
}

pub fn update_supplier_payment(
    conn: &Connection,
    id: i64,
    input: CreateSupplierPaymentInput,
    actor: Option<i64>,
) -> Result<SupplierPayment, AppError> {
    let existing = purchase_repository::get_supplier_payment(conn, id)?
        .ok_or_else(|| AppError::validation("Payment not found"))?;
    let normalized = normalize_supplier_payment(conn, input)?;
    validate_supplier_payment_balance(conn, &normalized, Some(&existing))?;
    if !purchase_repository::update_supplier_payment(conn, id, &normalized)? {
        return Err(AppError::validation("Payment not found"));
    }
    services::record_activity(conn, actor, "supplier_payment", "update", Some(id))?;
    purchase_repository::get_supplier_payment(conn, id)?
        .ok_or_else(|| AppError::validation("Payment not found"))
}

pub fn list_supplier_payments(
    conn: &Connection,
    search: Option<String>,
) -> Result<Vec<SupplierPayment>, AppError> {
    purchase_repository::list_supplier_payments(conn, search.as_deref())
}

pub fn list_supplier_payments_by_supplier(
    conn: &Connection,
    supplier_id: i64,
) -> Result<Vec<SupplierPayment>, AppError> {
    purchase_repository::list_supplier_payments_by_supplier(conn, supplier_id)
}

pub fn delete_supplier_payment(
    conn: &Connection,
    id: i64,
    actor: Option<i64>,
) -> Result<(), AppError> {
    let payment = purchase_repository::get_supplier_payment(conn, id)?
        .ok_or_else(|| AppError::validation("Payment not found"))?;
    if payment.status == "completed" {
        if let Some(supplier_id) = payment.supplier_id {
            let bal = supplier_balance(conn, supplier_id)?;
            if bal.balance > 0.001 {
                return Err(AppError::validation(
                    "This payment can only be deleted after the supplier due is fully cleared",
                ));
            }
        }
    }
    let deleted = purchase_repository::soft_delete_supplier_payment(conn, id)?;
    if !deleted {
        return Err(AppError::validation("Payment not found"));
    }
    services::record_activity(conn, actor, "supplier_payment", "delete", Some(id))
}

// ----- Supplier balances / dues -----

pub fn supplier_balance(conn: &Connection, supplier_id: i64) -> Result<SupplierBalance, AppError> {
    purchase_repository::supplier_balance(conn, supplier_id)
}

pub fn list_supplier_balances(
    conn: &Connection,
    search: Option<String>,
) -> Result<Vec<SupplierBalance>, AppError> {
    purchase_repository::list_supplier_balances(conn, search.as_deref())
}

pub fn list_supplier_dues(
    conn: &Connection,
    search: Option<String>,
) -> Result<Vec<SupplierBalance>, AppError> {
    purchase_repository::list_supplier_dues(conn, search.as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::inventory::CreateSupplierInput;
    use crate::models::phone::CreatePhoneInput;
    use crate::models::purchase::PurchaseItemInput;
    use crate::services::{phone_service, supplier_service, test_utils::in_memory_conn};
    use rusqlite::params;

    fn supplier(conn: &Connection) -> i64 {
        supplier_service::create(
            conn,
            CreateSupplierInput {
                name: "TechDistro".into(),
                phone: Some("03000000000".into()),
                email: None,
                address: None,
            },
        )
        .unwrap()
        .id
    }

    fn phone_item(conn: &Connection, supplier_id: Option<i64>) -> i64 {
        phone_service::create(
            conn,
            CreatePhoneInput {
                brand: "Samsung".into(),
                model: "Galaxy S24".into(),
                color: Some("Black".into()),
                storage: Some("256GB".into()),
                cost_price: 600.0,
                sale_price: 750.0,
                quantity: 5,
                supplier_id,
                low_stock_threshold: 2,
                ..Default::default()
            },
        )
        .unwrap()
        .id
    }

    fn purchase_input(item_id: i64, supplier_id: Option<i64>) -> CreatePurchaseInput {
        CreatePurchaseInput {
            supplier_id,
            discount: 0.0,
            paid_amount: Some(200.0),
            payment_method: Some("cash".into()),
            purchase_date: Some("2026-01-15".into()),
            invoice_reference: Some("INV-001".into()),
            notes: None,
            items: vec![PurchaseItemInput {
                item_type: "phone".into(),
                item_id,
                quantity: 2,
                unit_cost: Some(100.0),
                selling_price: Some(150.0),
                warranty: Some("12 months".into()),
                condition: Some("new".into()),
                imeis: vec!["111111111111111".into(), "222222222222222".into()],
            }],
        }
    }

    #[test]
    fn creates_purchase_and_increments_stock() {
        let conn = in_memory_conn();
        let sid = supplier(&conn);
        let iid = phone_item(&conn, Some(sid));

        let before = phone_service::get(&conn, iid).unwrap().quantity;
        let p = create_purchase(&conn, purchase_input(iid, Some(sid)), None).unwrap();
        assert!(p.id > 0);
        assert_eq!(p.total_amount, 200.0);
        assert_eq!(p.paid_amount, 200.0);
        assert_eq!(p.items.len(), 1);
        assert_eq!(p.items[0].quantity, 2);

        let after = phone_service::get(&conn, iid).unwrap().quantity;
        assert_eq!(after, before + 2);
        assert_eq!(phone_service::list_imei(&conn, iid).unwrap().len(), 2);

        // New stock-in fields and derived values round-trip.
        assert_eq!(p.purchase_date.as_deref(), Some("2026-01-15"));
        assert_eq!(p.invoice_reference.as_deref(), Some("INV-001"));
        assert_eq!(p.paid_amount, 200.0);
        assert_eq!(p.balance_due, 0.0);
        assert_eq!(p.payment_status, "paid");
        assert_eq!(p.items[0].selling_price, Some(150.0));
        assert_eq!(p.items[0].warranty.as_deref(), Some("12 months"));
        assert_eq!(p.items[0].condition.as_deref(), Some("new"));

        // Last purchase cost is recorded on the phone row.
        let lpc: Option<f64> = conn
            .query_row(
                "SELECT last_purchase_cost FROM phones WHERE id = ?1",
                params![iid],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(lpc, Some(100.0));

        // Cost and sale prices are synced from the purchase line to the product row.
        let phone = phone_service::get(&conn, iid).unwrap();
        assert_eq!(phone.cost_price, 100.0);
        assert_eq!(phone.sale_price, 150.0);
    }

    #[test]
    fn purchase_without_supplier_syncs_prices() {
        let conn = in_memory_conn();
        let iid = phone_item(&conn, None);

        let mut input = purchase_input(iid, None);
        input.supplier_id = None;
        input.items[0].quantity = 3;
        input.items[0].unit_cost = Some(200_000.0);
        input.items[0].selling_price = Some(500_000.0);
        input.items[0].imeis = vec!["333333333333333".into(), "444444444444444".into(), "555555555555555".into()];
        input.paid_amount = Some(600_000.0);
        let p = create_purchase(&conn, input, None).unwrap();
        assert!(p.id > 0);

        let phone = phone_service::get(&conn, iid).unwrap();
        assert_eq!(phone.quantity, 8); // 5 initial + 3 purchased
        assert_eq!(phone.cost_price, 200_000.0);
        assert_eq!(phone.sale_price, 500_000.0);
        assert_eq!(phone_service::list_imei(&conn, iid).unwrap().len(), 3);
    }

    #[test]
    fn rejects_purchase_overpayment_before_stock_changes() {
        let conn = in_memory_conn();
        let iid = phone_item(&conn, None);
        let before = phone_service::get(&conn, iid).unwrap().quantity;
        let mut input = purchase_input(iid, None);
        input.paid_amount = Some(200.01);
        assert!(matches!(
            create_purchase(&conn, input, None),
            Err(AppError::Validation(_))
        ));
        assert_eq!(phone_service::get(&conn, iid).unwrap().quantity, before);
        assert!(list(&conn, None).unwrap().is_empty());
    }

    #[test]
    fn imports_one_hundred_phone_imeis_atomically() {
        let conn = in_memory_conn();
        let iid = phone_item(&conn, None);
        let mut input = purchase_input(iid, None);
        input.items[0].quantity = 100;
        input.items[0].imeis = (0..100)
            .map(|index| format!("TESTIMEI{index:08}"))
            .collect();
        input.paid_amount = Some(10_000.0);
        let purchase = create_purchase(&conn, input, None).unwrap();
        assert_eq!(purchase.items[0].quantity, 100);
        assert_eq!(phone_service::list_imei(&conn, iid).unwrap().len(), 100);
        assert_eq!(phone_service::get(&conn, iid).unwrap().quantity, 105);
    }

    #[test]
    fn partial_and_unpaid_payment_status_derivation() {
        use crate::models::purchase::PurchaseItemInput;
        let conn = in_memory_conn();
        let sid = supplier(&conn);
        let iid = phone_item(&conn, Some(sid));

        let input = CreatePurchaseInput {
            supplier_id: Some(sid),
            discount: 0.0,
            paid_amount: Some(50.0),
            payment_method: Some("cash".into()),
            purchase_date: None,
            invoice_reference: None,
            notes: None,
            items: vec![PurchaseItemInput {
                item_type: "phone".into(),
                item_id: iid,
                quantity: 1,
                unit_cost: Some(100.0),
                selling_price: None,
                warranty: None,
                condition: None,
                imeis: vec!["111111111111111".into()],
            }],
        };
        let p = create_purchase(&conn, input, None).unwrap();
        assert_eq!(p.balance_due, 50.0);
        assert_eq!(p.payment_status, "partial");

        let mut input2 = purchase_input(iid, Some(sid));
        input2.paid_amount = Some(0.0);
        input2.items[0].imeis = vec!["999999999999991".into(), "999999999999992".into()];
        let p2 = create_purchase(&conn, input2, None).unwrap();
        assert_eq!(p2.balance_due, 200.0);
        assert_eq!(p2.payment_status, "unpaid");
    }

    #[test]
    fn rejects_duplicate_imei_atomically() {
        let conn = in_memory_conn();
        let sid = supplier(&conn);
        let iid = phone_item(&conn, Some(sid));
        let mut input = purchase_input(iid, Some(sid));
        input.items[0].imeis = vec!["111111111111111".into(), "111111111111111".into()];

        let err = create_purchase(&conn, input, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
        // transaction rolled back: stock unchanged, no purchase recorded
        assert_eq!(phone_service::get(&conn, iid).unwrap().quantity, 5);
        assert!(list(&conn, None).unwrap().is_empty());
        assert!(phone_service::list_imei(&conn, iid).unwrap().is_empty());
    }

    #[test]
    fn rejects_missing_imeis_for_phone_atomically() {
        let conn = in_memory_conn();
        let sid = supplier(&conn);
        let iid = phone_item(&conn, Some(sid));
        let mut input = purchase_input(iid, Some(sid));
        // Quantity is 2 but only one IMEI provided => must be rejected.
        input.items[0].imeis = vec!["111111111111111".into()];

        let err = create_purchase(&conn, input, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
        // transaction rolled back: stock unchanged, no purchase recorded
        assert_eq!(phone_service::get(&conn, iid).unwrap().quantity, 5);
        assert!(list(&conn, None).unwrap().is_empty());
        assert!(phone_service::list_imei(&conn, iid).unwrap().is_empty());
    }

    #[test]
    fn accessory_purchase_ignores_imeis() {
        use crate::models::accessory::CreateAccessoryInput;
        use crate::services::accessory_service;
        use crate::services::test_utils::seed_product_categories;
        let conn = in_memory_conn();
        seed_product_categories(&conn);
        let aid = accessory_service::create(
            &conn,
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
        .id;

        let mut input = purchase_input(aid, None);
        input.items[0].item_type = "accessory".into();
        input.items[0].imeis = vec!["1111".into()]; // ignored for accessories
        let p = create_purchase(&conn, input, None).unwrap();
        assert_eq!(accessory_service::get(&conn, aid).unwrap().quantity, 7);
        assert_eq!(p.items[0].item_type, "accessory");
    }

    #[test]
    fn supplier_balance_counts_purchases_minus_payments() {
        let conn = in_memory_conn();
        let sid = supplier(&conn);
        let iid = phone_item(&conn, Some(sid));
        // Purchase with no upfront payment => 200 owed.
        let mut input = purchase_input(iid, Some(sid));
        input.paid_amount = Some(0.0);
        create_purchase(&conn, input, None).unwrap();

        let bal = supplier_balance(&conn, sid).unwrap();
        assert_eq!(bal.total_purchases, 200.0);
        assert_eq!(bal.total_paid, 0.0);
        assert_eq!(bal.balance, 200.0);

        create_supplier_payment(
            &conn,
            CreateSupplierPaymentInput {
                supplier_id: Some(sid),
                amount: 150.0,
                payment_method: Some("cash".into()),
                status: None,
                reference: None,
                notes: None,
                payment_date: None,
            },
            None,
        )
        .unwrap();

        let bal = supplier_balance(&conn, sid).unwrap();
        assert_eq!(bal.total_paid, 150.0);
        assert_eq!(bal.balance, 50.0);
        assert_eq!(bal.payment_count, 1);

        let dues = list_supplier_dues(&conn, None).unwrap();
        assert_eq!(dues.len(), 1);
        assert!((dues[0].balance - 50.0).abs() < 0.001);
    }

    #[test]
    fn rejects_supplier_payment_above_outstanding_balance() {
        let conn = in_memory_conn();
        let sid = supplier(&conn);
        let iid = phone_item(&conn, Some(sid));
        let mut input = purchase_input(iid, Some(sid));
        input.paid_amount = Some(0.0);
        create_purchase(&conn, input, None).unwrap();

        let result = create_supplier_payment(
            &conn,
            CreateSupplierPaymentInput {
                supplier_id: Some(sid),
                amount: 200.01,
                payment_method: Some("cash".into()),
                status: None,
                reference: None,
                notes: None,
                payment_date: None,
            },
            None,
        );
        assert!(matches!(result, Err(AppError::Validation(_))));
        assert_eq!(supplier_balance(&conn, sid).unwrap().balance, 200.0);
    }

    #[test]
    fn supplier_balance_counts_upfront_payment_on_purchase() {
        let conn = in_memory_conn();
        let sid = supplier(&conn);
        let iid = phone_item(&conn, Some(sid));
        // Fully paid at purchase time => nothing owed.
        create_purchase(&conn, purchase_input(iid, Some(sid)), None).unwrap();

        let bal = supplier_balance(&conn, sid).unwrap();
        assert_eq!(bal.total_purchases, 200.0);
        assert_eq!(bal.total_paid, 200.0);
        assert_eq!(bal.balance, 0.0);

        // A fully-paid purchase should not appear in supplier dues.
        let dues = list_supplier_dues(&conn, None).unwrap();
        assert_eq!(dues.len(), 0);
    }

    #[test]
    fn supplier_payment_update_and_cleared_delete_recalculate_balance() {
        let conn = in_memory_conn();
        let sid = supplier(&conn);
        let iid = phone_item(&conn, Some(sid));
        let mut purchase = purchase_input(iid, Some(sid));
        purchase.paid_amount = Some(0.0);
        create_purchase(&conn, purchase, None).unwrap();

        let payment = create_supplier_payment(
            &conn,
            CreateSupplierPaymentInput {
                supplier_id: Some(sid),
                amount: 100.0,
                payment_method: Some("cash".into()),
                status: Some("completed".into()),
                reference: None,
                notes: None,
                payment_date: None,
            },
            None,
        )
        .unwrap();
        assert!(delete_supplier_payment(&conn, payment.id, None).is_err());
        let corrected = update_supplier_payment(
            &conn,
            payment.id,
            CreateSupplierPaymentInput {
                supplier_id: Some(sid),
                amount: 200.0,
                payment_method: Some("bank_transfer".into()),
                status: Some("completed".into()),
                reference: Some("BANK-1".into()),
                notes: None,
                payment_date: None,
            },
            None,
        )
        .unwrap();
        assert_eq!(corrected.amount, 200.0);
        assert_eq!(supplier_balance(&conn, sid).unwrap().balance, 0.0);

        delete_supplier_payment(&conn, payment.id, None).unwrap();
        assert_eq!(supplier_balance(&conn, sid).unwrap().balance, 200.0);
    }
}
