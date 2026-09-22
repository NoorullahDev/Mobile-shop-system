use std::collections::HashSet;

use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::sale::{CreateSaleInput, Sale};
use crate::repositories::{
    member_repository, product_return_repository, sale_payment_repository, sale_repository,
};
use crate::services;
use crate::utils;

struct Line {
    sale_item_id: Option<i64>,
    item_type: String,
    item_id: i64,
    quantity: i64,
    imei_id: Option<i64>,
    unit_price: f64,
    cost_price: f64,
    warranty: Option<String>,
    warranty_expiry: Option<String>,
    color: Option<String>,
    imei_snapshot: Option<String>,
    imei2_snapshot: Option<String>,
    pta_status: Option<String>,
    storage: Option<String>,
    battery_health_pct: Option<i64>,
    product_name_snapshot: Option<String>,
    variant_snapshot: Option<String>,
}

struct PreparedSale {
    lines: Vec<Line>,
    total_amount: f64,
    paid_amount: f64,
    payment_method: String,
    payments: Vec<crate::models::sale_payment::SalePaymentInput>,
}

fn current_item_price(
    conn: &Connection,
    item_type: &str,
    item_id: i64,
    imei_id: Option<i64>,
) -> Result<f64, AppError> {
    if item_type == "phone" {
        if let Some(imei_id) = imei_id {
            if let Some(price) = sale_repository::imei_unit_pricing(conn, imei_id)?.1 {
                return Ok(price);
            }
        }
    }
    sale_repository::item_price(conn, item_type, item_id)?
        .ok_or_else(|| AppError::validation("Sale item not found"))
}

/// Detects a hidden price reduction as well as the explicit invoice discount.
/// Command authorization uses this so a caller cannot bypass
/// `sales:apply_discount` by lowering an item's unit price directly.
pub fn has_price_reduction(
    conn: &Connection,
    input: &CreateSaleInput,
    existing: Option<&Sale>,
) -> Result<bool, AppError> {
    for item in &input.items {
        let baseline = match (existing, item.sale_item_id) {
            (Some(sale), Some(line_id)) => sale
                .items
                .iter()
                .find(|line| line.id == line_id)
                .map(|line| line.unit_price)
                .ok_or_else(|| {
                    AppError::validation("A sale item does not belong to this invoice")
                })?,
            _ => current_item_price(conn, &item.item_type, item.item_id, item.imei_id)?,
        };
        let proposed = item.unit_price.unwrap_or(baseline);
        if proposed + 0.005 < baseline {
            return Ok(true);
        }
    }
    Ok(false)
}

fn prepare(
    conn: &Connection,
    input: &CreateSaleInput,
    imei_exempt_lines: &HashSet<i64>,
) -> Result<PreparedSale, AppError> {
    if input.items.is_empty() {
        return Err(AppError::validation(
            "A sale must contain at least one item",
        ));
    }
    if input.discount < 0.0 {
        return Err(AppError::validation("Discount cannot be negative"));
    }

    if let Some(mid) = input.member_id {
        if member_repository::get_by_id(conn, mid)?.is_none() {
            return Err(AppError::validation("Member not found"));
        }
    }

    let mut lines: Vec<Line> = Vec::new();
    let mut subtotal = 0.0;
    let mut seen_ids = HashSet::new();

    for item in &input.items {
        if let Some(line_id) = item.sale_item_id {
            if !seen_ids.insert(line_id) {
                return Err(AppError::validation(
                    "A sale item cannot be listed more than once",
                ));
            }
        }
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
        let Some(stock) = sale_repository::item_quantity(conn, &item_type, item.item_id)? else {
            return Err(AppError::validation(if item_type == "phone" {
                "Phone not found"
            } else {
                "Accessory not found"
            }));
        };
        if item.quantity > stock {
            return Err(AppError::validation("Not enough stock for this item"));
        }

        let unit_pricing = if item_type == "phone" {
            match item.imei_id {
                Some(imei_id) => Some(sale_repository::imei_unit_pricing(conn, imei_id)?),
                None => None,
            }
        } else {
            None
        };
        let unit_price = match item.unit_price {
            Some(p) if p > 0.0 => p,
            _ => {
                let p = unit_pricing
                    .and_then(|(_, sale_price)| sale_price)
                    .or(sale_repository::item_price(conn, &item_type, item.item_id)?)
                    .ok_or_else(|| {
                        AppError::validation(if item_type == "phone" {
                            "Phone not found"
                        } else {
                            "Accessory not found"
                        })
                    })?;
                if p > 0.0 {
                    p
                } else {
                    return Err(AppError::validation(
                        "Cannot sell an item with a zero price; set a sale price first",
                    ));
                }
            }
        };

        let cost_price = unit_pricing
            .and_then(|(cost_price, _)| cost_price)
            .or(sale_repository::item_cost(conn, &item_type, item.item_id)?)
            .unwrap_or(0.0);

        let exempt = item
            .sale_item_id
            .map(|id| imei_exempt_lines.contains(&id))
            .unwrap_or(false);

        if item_type == "phone" {
            if let Some(imei_id) = item.imei_id {
                if !exempt && !sale_repository::imei_available(conn, imei_id, item.item_id)? {
                    return Err(AppError::validation("IMEI is not available for this item"));
                }
            }
        }

        // A phone that tracks physical units by IMEI must be sold as an exact
        // unit: one unit per line, and a unit must always be identified. This
        // is what keeps the unit (and its colour stock) correct after a sale.
        if item_type == "phone" && !exempt {
            if item.imei_id.is_some() && item.quantity != 1 {
                return Err(AppError::validation(
                    "Each IMEI unit is one physical phone — set quantity to 1 and add the phone again for the second unit.",
                ));
            }
            if item.imei_id.is_none() {
                let tracked = sale_repository::in_stock_imei_count(conn, item.item_id)?;
                if tracked > 0 {
                    return Err(AppError::validation(
                        "This phone has registered IMEI units. Select the exact unit being sold from the IMEI list.",
                    ));
                }
            }
        }

        let line_imei = if item_type == "phone" {
            item.imei_id
        } else {
            None
        };

        let line_total = utils::round2(unit_price * item.quantity as f64);
        subtotal += line_total;
        let warranty = item
            .warranty
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);
        let warranty_expiry = item
            .warranty_expiry
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);
        // Colour snapshot: the unit's colour when an IMEI was selected,
        // otherwise the product's nominal colour. Stored on the sale line so
        // old invoices are stable even if product/unit details change later.
        let color = if item_type == "phone" {
            match line_imei {
                Some(imei_id) => sale_repository::imei_color(conn, imei_id)?,
                None => sale_repository::product_color(conn, &item_type, item.item_id)?,
            }
        } else {
            None
        };
        // IMEI snapshot: the exact unit's IMEI string at the time of sale, so
        // invoices always show what was actually sold even if the unit is later
        // edited, returned or reassigned.
        let imei_snapshot = if item_type == "phone" {
            match line_imei {
                Some(imei_id) => sale_repository::imei_value(conn, imei_id)?,
                None => None,
            }
        } else {
            None
        };
        let imei2_snapshot = if item_type == "phone" {
            match line_imei {
                Some(imei_id) => sale_repository::imei2_value(conn, imei_id)?,
                None => None,
            }
        } else {
            None
        };
        let pta_status = if item_type == "phone" {
            match line_imei {
                Some(imei_id) => sale_repository::imei_pta_status(conn, imei_id)?,
                None => None,
            }
        } else {
            None
        };
        let (storage, battery_health_pct) = if item_type == "phone" {
            match line_imei {
                Some(imei_id) => sale_repository::imei_unit_details(conn, imei_id)?,
                None => (None, None),
            }
        } else {
            (None, None)
        };
        let (product_name_snapshot, variant_snapshot) =
            sale_repository::item_sale_identity(conn, &item_type, item.item_id)?;
        lines.push(Line {
            sale_item_id: item.sale_item_id,
            item_type,
            item_id: item.item_id,
            quantity: item.quantity,
            imei_id: line_imei,
            unit_price: utils::round2(unit_price),
            cost_price: utils::round2(cost_price),
            warranty,
            warranty_expiry,
            color,
            imei_snapshot,
            imei2_snapshot,
            pta_status,
            storage,
            battery_health_pct,
            product_name_snapshot,
            variant_snapshot,
        });
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

    let payment_method = input
        .payment_method
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or("cash")
        .to_lowercase();

    // Handle split payments
    let payments = if !input.payments.is_empty() {
        // Validate: all payments must have positive amounts and valid methods
        let mut total_paid = 0.0;
        let mut validated = Vec::new();
        for p in &input.payments {
            if !p.amount.is_finite() || p.amount <= 0.0 {
                return Err(AppError::validation(
                    "Each payment amount must be greater than zero",
                ));
            }
            let method = p.payment_method.trim().to_lowercase();
            if method.is_empty() {
                return Err(AppError::validation("Payment method cannot be empty"));
            }
            total_paid += p.amount;
            validated.push(crate::models::sale_payment::SalePaymentInput {
                amount: utils::round2(p.amount),
                payment_method: method,
                reference: p.reference.clone(),
                notes: p.notes.clone(),
            });
        }
        let computed_paid = utils::round2(total_paid);
        Ok::<_, AppError>((validated, computed_paid))
    } else {
        Ok((vec![], paid_amount))
    }?;

    let (validated_payments, computed_paid) = payments;
    let final_paid_amount = if !validated_payments.is_empty() {
        computed_paid
    } else {
        paid_amount
    };
    if final_paid_amount > total_amount + 0.005 {
        return Err(AppError::validation(
            "Paid amount cannot be greater than the invoice total",
        ));
    }

    Ok(PreparedSale {
        lines,
        total_amount,
        paid_amount: final_paid_amount,
        payment_method,
        payments: validated_payments,
    })
}

pub fn create(
    conn: &Connection,
    input: CreateSaleInput,
    actor: Option<i64>,
) -> Result<Sale, AppError> {
    let discount = input.discount;
    let tx = conn.unchecked_transaction()?;
    let sale_id = create_tx(&tx, input, actor)?;

    tx.commit()?;

    services::record_activity(conn, actor, "sale", "create", Some(sale_id))?;
    if discount > 0.0 {
        services::record_activity(conn, actor, "sale", "discount_applied", Some(sale_id))?;
    }

    sale_repository::get_sale_with_items(conn, sale_id)?
        .ok_or_else(|| AppError::Internal("Created sale could not be retrieved".into()))
}

pub fn create_tx(
    tx: &rusqlite::Transaction,
    input: CreateSaleInput,
    actor: Option<i64>,
) -> Result<i64, AppError> {
    // we need to pass a conn for prepare, but Transaction Derefs to Connection.
    let prepared = prepare(tx, &input, &HashSet::new())?;

    let receipt_no = sale_repository::next_receipt_no(tx)?;
    let notes = input
        .notes
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());

    let sale_id = sale_repository::insert_sale(
        tx,
        &receipt_no,
        input.member_id,
        prepared.total_amount,
        utils::round2(input.discount),
        prepared.paid_amount,
        &prepared.payment_method,
        notes,
        actor,
    )?;

    if !prepared.payments.is_empty() {
        sale_payment_repository::insert_payments(tx, sale_id, &prepared.payments)?;
    } else if prepared.paid_amount > 0.0 {
        sale_payment_repository::insert_sale_payment(
            tx,
            sale_id,
            prepared.paid_amount,
            &prepared.payment_method,
            None,
            None,
        )?;
    }

    for line in &prepared.lines {
        sale_repository::insert_sale_item(
            tx,
            sale_id,
            &line.item_type,
            line.item_id,
            line.imei_id,
            line.quantity,
            line.unit_price,
            line.cost_price,
            line.warranty.as_deref(),
            line.warranty_expiry.as_deref(),
            line.color.as_deref(),
            line.imei_snapshot.as_deref(),
            line.imei2_snapshot.as_deref(),
            line.pta_status.as_deref(),
            line.storage.as_deref(),
            line.battery_health_pct,
            line.product_name_snapshot.as_deref(),
            line.variant_snapshot.as_deref(),
        )?;

        if !sale_repository::decrement_stock(tx, &line.item_type, line.item_id, line.quantity)? {
            return Err(AppError::validation("Not enough stock for this item"));
        }
        if line.item_type == "phone" {
            if let Some(imei_id) = line.imei_id {
                if !sale_repository::mark_imei_sold(tx, imei_id, line.item_id)? {
                    return Err(AppError::validation("IMEI is not available for this item"));
                }
            }
        }
    }

    Ok(sale_id)
}

pub fn update(
    conn: &Connection,
    id: i64,
    input: CreateSaleInput,
    actor: Option<i64>,
) -> Result<Sale, AppError> {
    let old = get(conn, id)?;
    let discount_changed = (old.discount - input.discount).abs() > 0.005;
    let old_ids: HashSet<i64> = old.items.iter().map(|item| item.id).collect();
    let returned = product_return_repository::returned_qty_by_sale_items(
        conn,
        &old_ids.iter().copied().collect::<Vec<_>>(),
    )?;

    for item in &input.items {
        if let Some(line_id) = item.sale_item_id {
            if !old_ids.contains(&line_id) {
                return Err(AppError::validation(
                    "A sale item does not belong to this invoice",
                ));
            }
            let old_line = old.items.iter().find(|line| line.id == line_id).unwrap();
            let returned_qty = returned.get(&line_id).copied().unwrap_or(0);
            if returned_qty > 0
                && (item.item_type != old_line.item_type
                    || item.item_id != old_line.item_id
                    || item.imei_id != old_line.imei_id)
            {
                return Err(AppError::validation(
                    "A product that already has a return can have its quantity or price corrected, but its product/IMEI cannot be replaced",
                ));
            }
            if item.quantity < returned_qty {
                return Err(AppError::validation(format!(
                    "Quantity cannot be lower than the {} unit(s) already returned",
                    returned_qty
                )));
            }
        }
    }
    for old_line in &old.items {
        if returned.get(&old_line.id).copied().unwrap_or(0) > 0
            && !input
                .items
                .iter()
                .any(|item| item.sale_item_id == Some(old_line.id))
        {
            return Err(AppError::validation(
                "A sale line with an existing return cannot be removed",
            ));
        }
    }

    let tx = conn.unchecked_transaction()?;
    let mut imei_exempt = HashSet::new();
    for old_line in &old.items {
        sale_repository::increment_stock(
            &tx,
            &old_line.item_type,
            old_line.item_id,
            old_line.quantity,
        )?;
        let has_return = returned.get(&old_line.id).copied().unwrap_or(0) > 0;
        if has_return {
            imei_exempt.insert(old_line.id);
        } else if old_line.item_type == "phone" {
            if let Some(imei_id) = old_line.imei_id {
                sale_repository::release_imei(&tx, imei_id, old_line.item_id)?;
            }
        }
    }

    let mut prepared = prepare(&tx, &input, &imei_exempt)?;
    // Editing payment, notes, discount, warranty, or price must not refresh an
    // unchanged physical unit from mutable inventory data. Keep the original
    // sale-time identity snapshot unless the line is explicitly changed to a
    // different product/unit.
    for line in &mut prepared.lines {
        let Some(line_id) = line.sale_item_id else {
            continue;
        };
        let Some(old_line) = old.items.iter().find(|item| item.id == line_id) else {
            continue;
        };
        if line.item_type == old_line.item_type
            && line.item_id == old_line.item_id
            && line.imei_id == old_line.imei_id
        {
            line.cost_price = old_line.cost_price;
            line.color = old_line.color.clone();
            line.imei_snapshot = old_line.imei.clone();
            line.imei2_snapshot = old_line.imei2.clone();
            line.pta_status = old_line.pta_status.clone();
            line.storage = old_line.storage.clone();
            line.battery_health_pct = old_line.battery_health_pct;
            line.product_name_snapshot = old_line.product_name.clone();
            line.variant_snapshot = old_line.variant.clone();
        }
    }
    let linked_due_payments: f64 = tx.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM payments
         WHERE sale_id = ?1 AND is_deleted = 0 AND is_voided = 0 AND status = 'completed'",
        [id],
        |row| row.get(0),
    )?;
    if old.member_id != input.member_id && linked_due_payments > 0.0 {
        return Err(AppError::validation(
            "The customer cannot be changed after a due payment has been recorded",
        ));
    }
    let combined_paid = utils::round2(prepared.paid_amount + linked_due_payments);
    if combined_paid > prepared.total_amount + 0.005 {
        return Err(AppError::validation(
            "The corrected invoice total cannot be lower than its recorded payments",
        ));
    }
    let notes = input
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    sale_repository::update_sale(
        &tx,
        id,
        input.member_id,
        prepared.total_amount,
        utils::round2(input.discount),
        combined_paid,
        &prepared.payment_method,
        notes,
    )?;

    let new_ids: HashSet<i64> = prepared
        .lines
        .iter()
        .filter_map(|line| line.sale_item_id)
        .collect();
    for old_line in &old.items {
        if !new_ids.contains(&old_line.id) {
            sale_repository::delete_sale_item(&tx, old_line.id)?;
        }
    }
    for line in &prepared.lines {
        if let Some(line_id) = line.sale_item_id {
            sale_repository::update_sale_item(
                &tx,
                line_id,
                &line.item_type,
                line.item_id,
                line.imei_id,
                line.quantity,
                line.unit_price,
                line.cost_price,
                line.warranty.as_deref(),
                line.warranty_expiry.as_deref(),
                line.color.as_deref(),
                line.imei_snapshot.as_deref(),
                line.imei2_snapshot.as_deref(),
                line.pta_status.as_deref(),
                line.storage.as_deref(),
                line.battery_health_pct,
                line.product_name_snapshot.as_deref(),
                line.variant_snapshot.as_deref(),
            )?;
        } else {
            sale_repository::insert_sale_item(
                &tx,
                id,
                &line.item_type,
                line.item_id,
                line.imei_id,
                line.quantity,
                line.unit_price,
                line.cost_price,
                line.warranty.as_deref(),
                line.warranty_expiry.as_deref(),
                line.color.as_deref(),
                line.imei_snapshot.as_deref(),
                line.imei2_snapshot.as_deref(),
                line.pta_status.as_deref(),
                line.storage.as_deref(),
                line.battery_health_pct,
                line.product_name_snapshot.as_deref(),
                line.variant_snapshot.as_deref(),
            )?;
        }
        if !sale_repository::decrement_stock(&tx, &line.item_type, line.item_id, line.quantity)? {
            return Err(AppError::validation("Not enough stock for this correction"));
        }
        let is_returned_line = line
            .sale_item_id
            .map(|line_id| imei_exempt.contains(&line_id))
            .unwrap_or(false);
        if line.item_type == "phone" && !is_returned_line {
            if let Some(imei_id) = line.imei_id {
                if !sale_repository::mark_imei_sold(&tx, imei_id, line.item_id)? {
                    return Err(AppError::validation(
                        "IMEI is not available for this correction",
                    ));
                }
            }
        }
    }
    product_return_repository::sync_sale_snapshot(&tx, id, input.member_id)?;
    product_return_repository::recalculate_for_sale(&tx, id)?;

    // Update split payments: keep voided rows (audit trail), replace the rest
    sale_payment_repository::delete_active_payments_for_sale(&tx, id)?;
    if !prepared.payments.is_empty() {
        sale_payment_repository::insert_payments(&tx, id, &prepared.payments)?;
    } else if prepared.paid_amount > 0.0 {
        sale_payment_repository::insert_sale_payment(
            &tx,
            id,
            prepared.paid_amount,
            &prepared.payment_method,
            None,
            None,
        )?;
    }

    tx.commit()?;
    services::record_activity(conn, actor, "sale", "update", Some(id))?;
    if discount_changed {
        services::record_activity(conn, actor, "sale", "discount_changed", Some(id))?;
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: i64, actor: Option<i64>) -> Result<(), AppError> {
    get(conn, id)?;
    let tx = conn.unchecked_transaction()?;
    delete_tx(&tx, id)?;
    tx.commit()?;
    services::record_activity(conn, actor, "sale", "delete", Some(id))
}

pub fn delete_tx(tx: &rusqlite::Transaction, id: i64) -> Result<(), AppError> {
    let sale = get(tx, id)?;
    let sale_item_ids: Vec<i64> = sale.items.iter().map(|item| item.id).collect();
    let restocked = product_return_repository::restocked_qty_by_sale_items(tx, &sale_item_ids)?;
    product_return_repository::delete_for_sale(tx, id)?;
    sale_payment_repository::delete_payments_for_sale(tx, id)?;
    for item in &sale.items {
        let net_restore = item.quantity - restocked.get(&item.id).copied().unwrap_or(0);
        if net_restore > 0 {
            sale_repository::increment_stock(tx, &item.item_type, item.item_id, net_restore)?;
        }
        if item.item_type == "phone" {
            if let Some(imei_id) = item.imei_id {
                if !sale_repository::imei_used_by_other_sale(tx, imei_id, id)? {
                    sale_repository::release_imei(tx, imei_id, item.item_id)?;
                }
            }
        }
    }
    sale_repository::delete_sale(tx, id)?;
    Ok(())
}

pub fn list(conn: &Connection, search: Option<String>) -> Result<Vec<Sale>, AppError> {
    sale_repository::list_sales(conn, search.as_deref())
}

pub fn list_for_period(conn: &Connection, from: &str, to: &str) -> Result<Vec<Sale>, AppError> {
    sale_repository::list_sales_for_period(conn, from, to)
}

pub fn get(conn: &Connection, id: i64) -> Result<Sale, AppError> {
    let mut sale = sale_repository::get_sale_with_items(conn, id)?
        .ok_or_else(|| AppError::validation("Sale not found"))?;
    sale.returns = product_return_repository::returns_for_sale(conn, id)?;
    sale.sale_payments = sale_payment_repository::payments_for_sale(conn, id)?;
    Ok(sale)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::phone::CreatePhoneInput;
    use crate::models::sale::SaleItemInput;
    use crate::services::{phone_service, test_utils::in_memory_conn};

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

    fn sale_input(item_id: i64, qty: i64) -> CreateSaleInput {
        CreateSaleInput {
            member_id: None,
            discount: 0.0,
            paid_amount: None,
            payment_method: Some("cash".into()),
            notes: None,
            payments: vec![],
            items: vec![SaleItemInput {
                sale_item_id: None,
                item_type: "phone".into(),
                item_id,
                quantity: qty,
                imei_id: None,
                unit_price: None,
                warranty: None,
                warranty_expiry: None,
            }],
        }
    }

    #[test]
    fn creates_sale_and_reduces_stock() {
        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);
        let sale = create(&conn, sale_input(id, 2), None).unwrap();
        assert!(sale.receipt_no.starts_with("INV-"));
        assert_eq!(sale.total_amount, 200.0);
        assert_eq!(sale.paid_amount, 200.0);
        assert_eq!(sale.items.len(), 1);
        let after = phone_service::get(&conn, id).unwrap();
        assert_eq!(after.quantity, 3);
    }

    #[test]
    fn rejects_insufficient_stock() {
        let conn = in_memory_conn();
        let id = phone(&conn, 1, 100.0);
        let err = create(&conn, sale_input(id, 2), None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
        assert_eq!(phone_service::get(&conn, id).unwrap().quantity, 1);
    }

    #[test]
    fn rejects_empty_items() {
        let conn = in_memory_conn();
        let err = create(&conn, CreateSaleInput::default(), None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn detects_direct_unit_price_discount_for_permission_enforcement() {
        let conn = in_memory_conn();
        let id = phone(&conn, 1, 100.0);
        let mut input = sale_input(id, 1);
        input.items[0].unit_price = Some(90.0);
        assert!(has_price_reduction(&conn, &input, None).unwrap());

        input.items[0].unit_price = Some(100.0);
        assert!(!has_price_reduction(&conn, &input, None).unwrap());
    }

    #[test]
    fn applies_discount_and_paid_amount() {
        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);
        let mut input = sale_input(id, 2);
        input.discount = 25.0;
        input.paid_amount = Some(50.0);
        let sale = create(&conn, input, None).unwrap();
        assert_eq!(sale.total_amount, 175.0);
        assert_eq!(sale.paid_amount, 50.0);
    }

    #[test]
    fn rejects_discount_exceeding_subtotal() {
        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);
        let mut input = sale_input(id, 1);
        input.discount = 500.0;
        let err = create(&conn, input, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn rejects_single_and_split_overpayments_without_writing_sale() {
        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);
        let mut single = sale_input(id, 1);
        single.paid_amount = Some(100.01);
        assert!(matches!(
            create(&conn, single, None),
            Err(AppError::Validation(_))
        ));

        let mut split = sale_input(id, 1);
        split.paid_amount = None;
        split.payments = vec![
            crate::models::sale_payment::SalePaymentInput {
                amount: 60.0,
                payment_method: "cash".into(),
                reference: None,
                notes: None,
            },
            crate::models::sale_payment::SalePaymentInput {
                amount: 50.0,
                payment_method: "card".into(),
                reference: None,
                notes: None,
            },
        ];
        assert!(matches!(
            create(&conn, split, None),
            Err(AppError::Validation(_))
        ));
        assert!(list(&conn, None).unwrap().is_empty());
        assert_eq!(phone_service::get(&conn, id).unwrap().quantity, 5);
    }

    #[test]
    fn editing_invoice_preserves_linked_due_payments() {
        use crate::models::payment::CreatePaymentInput;

        let conn = in_memory_conn();
        conn.execute("INSERT INTO members (name) VALUES ('Due Customer')", [])
            .unwrap();
        let member_id = conn.last_insert_rowid();
        let id = phone(&conn, 5, 100.0);
        let mut original = sale_input(id, 1);
        original.member_id = Some(member_id);
        original.paid_amount = Some(40.0);
        let sale = create(&conn, original, None).unwrap();

        crate::services::payment_service::create(
            &conn,
            CreatePaymentInput {
                member_id: Some(member_id),
                sale_id: Some(sale.id),
                amount: 20.0,
                payment_method: "cash".into(),
                ..Default::default()
            },
            None,
        )
        .unwrap();

        let mut correction = sale_input(id, 1);
        correction.items[0].sale_item_id = Some(sale.items[0].id);
        correction.member_id = Some(member_id);
        correction.paid_amount = Some(40.0);
        let corrected = update(&conn, sale.id, correction, None).unwrap();
        assert_eq!(corrected.paid_amount, 60.0);
        assert_eq!(corrected.sale_payments.len(), 1);
        assert_eq!(corrected.sale_payments[0].amount, 40.0);
    }

    #[test]
    fn editing_sale_preserves_voided_split_payment_and_paid_amount() {
        use crate::models::sale_payment::SalePaymentInput;

        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);

        let mut original = sale_input(id, 1);
        original.paid_amount = None;
        original.payments = vec![
            SalePaymentInput {
                amount: 40.0,
                payment_method: "cash".into(),
                reference: None,
                notes: None,
            },
            SalePaymentInput {
                amount: 60.0,
                payment_method: "card".into(),
                reference: None,
                notes: None,
            },
        ];
        let sale = create(&conn, original, None).unwrap();
        let created = get(&conn, sale.id).unwrap();
        assert_eq!(created.sale_payments.len(), 2);
        assert_eq!(created.paid_amount, 100.0);

        let card_sp = created
            .sale_payments
            .iter()
            .find(|sp| sp.payment_method == "card")
            .unwrap()
            .clone();
        crate::services::sale_payment_service::void_sale_payment(
            &conn,
            card_sp.id,
            "customer paid twice",
            None,
        )
        .unwrap();
        assert!((get(&conn, sale.id).unwrap().paid_amount - 40.0).abs() < 0.01);

        let mut correction = sale_input(id, 1);
        correction.items[0].sale_item_id = Some(sale.items[0].id);
        correction.paid_amount = None;
        correction.payments = vec![SalePaymentInput {
            amount: 40.0,
            payment_method: "cash".into(),
            reference: None,
            notes: None,
        }];
        let corrected = update(&conn, sale.id, correction, None).unwrap();

        // The voided audit row must survive an edit (not re-inserted as active).
        assert_eq!(corrected.sale_payments.len(), 2);
        let voided = corrected
            .sale_payments
            .iter()
            .find(|sp| sp.id == card_sp.id)
            .unwrap();
        assert!(voided.is_voided);
        assert_eq!(voided.amount, 60.0);
        assert_eq!(voided.void_reason.as_deref(), Some("customer paid twice"));

        let active: Vec<_> = corrected
            .sale_payments
            .iter()
            .filter(|sp| !sp.is_voided)
            .collect();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].amount, 40.0);
        assert!((corrected.paid_amount - 40.0).abs() < 0.01);
    }

    #[test]
    fn marks_imei_sold_on_imei_sale() {
        use crate::models::phone::AddPhoneImeiInput;
        let conn = in_memory_conn();
        let id = phone(&conn, 1, 100.0);
        let imei = phone_service::add_imei(
            &conn,
            AddPhoneImeiInput {
                phone_id: id,
                imei: "111111111111111".into(),
                imei2: None,
                color: None,
                pta_status: None,
                storage: None,
                battery_health_pct: None,
            },
        )
        .unwrap();

        let mut input = sale_input(id, 1);
        input.items[0].imei_id = Some(imei.id);
        create(&conn, input, None).unwrap();

        let imeis = phone_service::list_imei(&conn, id).unwrap();
        assert_eq!(imeis[0].status, "sold");
    }

    #[test]
    fn selling_a_tracked_unit_marks_only_it_sold_and_keeps_invoice_snapshot() {
        use crate::models::phone::AddPhoneImeiInput;

        let conn = in_memory_conn();
        // Client scenario: one product, three physical units (Purple/Green/White).
        let id = phone(&conn, 0, 100.0);
        let mut units = Vec::new();
        for (imei, colour) in [
            ("762387998439", "Purple"),
            ("762387998440", "Green"),
            ("762387998441", "White"),
        ] {
            units.push((
                phone_service::add_imei(
                    &conn,
                    AddPhoneImeiInput {
                        phone_id: id,
                        imei: imei.into(),
                        imei2: None,
                        color: Some(colour.into()),
                        pta_status: None,
                        storage: None,
                        battery_health_pct: None,
                    },
                )
                .unwrap(),
                colour.to_string(),
            ));
        }
        assert_eq!(phone_service::get(&conn, id).unwrap().quantity, 3);

        // Sell exactly the Purple unit.
        let duplicate_purple_id = units[0].0.id;
        let duplicate_purple_imei = units[0].0.imei.clone();
        let mut input = sale_input(id, 1);
        input.items[0].imei_id = Some(duplicate_purple_id);
        let sale = create(&conn, input, None).unwrap();

        // Stock decreased exactly once: 3 → 2.
        assert_eq!(phone_service::get(&conn, id).unwrap().quantity, 2);

        // Only Purple is sold; Green and White remain in stock.
        let imeis = phone_service::list_imei(&conn, id).unwrap();
        assert_eq!(imeis.len(), 3);
        let by_imei: std::collections::HashMap<String, String> = imeis
            .iter()
            .map(|i| (i.imei.clone(), i.status.clone()))
            .collect();
        assert_eq!(
            by_imei.get("762387998439").map(String::as_str),
            Some("sold")
        );
        assert_eq!(
            by_imei.get("762387998440").map(String::as_str),
            Some("in_stock")
        );
        assert_eq!(
            by_imei.get("762387998441").map(String::as_str),
            Some("in_stock")
        );

        // The sale line carries the sale-time IMEI + colour snapshot.
        let got = get(&conn, sale.id).unwrap();
        assert_eq!(got.items[0].imei.as_deref(), Some("762387998439"));
        assert_eq!(got.items[0].color.as_deref(), Some("Purple"));
        let snapshot: String = conn
            .query_row(
                "SELECT imei_snapshot FROM sale_items WHERE id = ?1",
                [got.items[0].id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(snapshot, duplicate_purple_imei);
    }

    #[test]
    fn tracked_phone_must_be_sold_as_an_exact_unit() {
        use crate::models::phone::AddPhoneImeiInput;

        let conn = in_memory_conn();
        let id = phone(&conn, 0, 100.0);
        let purple = phone_service::add_imei(
            &conn,
            AddPhoneImeiInput {
                phone_id: id,
                imei: "700000000000001".into(),
                imei2: None,
                color: Some("Purple".into()),
                pta_status: None,
                storage: None,
                battery_health_pct: None,
            },
        )
        .unwrap();

        // Selling by count while exact units are tracked is rejected.
        let without_imei = sale_input(id, 1);
        let err = create(&conn, without_imei, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));

        // One IMEI is one physical unit: quantity must be 1.
        let mut qty_two = sale_input(id, 2);
        qty_two.items[0].imei_id = Some(purple.id);
        let err = create(&conn, qty_two, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));

        // No sale was written.
        assert!(list(&conn, None).unwrap().is_empty());
        assert_eq!(phone_service::get(&conn, id).unwrap().quantity, 1);
    }

    #[test]
    fn selling_a_unit_tracks_colour_by_imei_identity() {
        use crate::models::phone::AddPhoneImeiInput;
        use std::collections::HashMap;

        let conn = in_memory_conn();
        // 10 physical units: 3 Green + 3 Blue + 4 Natural Titanium. The
        // colour belongs to each IMEI unit, not to a duplicated product.
        let id = phone(&conn, 0, 100.0);
        let mut unit_ids: Vec<i64> = Vec::new();
        let mut colours: Vec<String> = Vec::new();
        for (ci, (colour, count)) in [("Green", 3usize), ("Blue", 3), ("Natural Titanium", 4)]
            .iter()
            .enumerate()
        {
            for k in 0..*count {
                unit_ids.push(
                    phone_service::add_imei(
                        &conn,
                        AddPhoneImeiInput {
                            phone_id: id,
                            imei: format!("1000000{:04}{ci}{k}", k),
                            imei2: None,
                            color: Some(colour.to_string()),
                            pta_status: None,
                            storage: None,
                            battery_health_pct: None,
                        },
                    )
                    .unwrap()
                    .id,
                );
                colours.push(colour.to_string());
            }
        }
        assert_eq!(unit_ids.len(), 10);
        assert_eq!(colours.iter().filter(|c| *c == "Green").count(), 3);

        let breakdown = |conn: &Connection| -> HashMap<String, i64> {
            phone_service::get(conn, id)
                .map(|p| {
                    p.stock_by_color
                        .iter()
                        .map(|c| {
                            (
                                c.color.clone().unwrap_or_else(|| "(no colour)".into()),
                                c.count,
                            )
                        })
                        .collect()
                })
                .unwrap()
        };
        let before = breakdown(&conn);
        assert_eq!(before.get("Green"), Some(&3));
        assert_eq!(before.get("Blue"), Some(&3));
        assert_eq!(before.get("Natural Titanium"), Some(&4));

        // Sell exactly one Green unit.
        let mut input = sale_input(id, 1);
        input.items[0].imei_id = Some(unit_ids[0]);
        let sale = create(&conn, input, None).unwrap();
        assert_eq!(sale.items[0].color.as_deref(), Some("Green"));

        // Only the Green count drops; Blue and Natural Titanium are untouched.
        let after = breakdown(&conn);
        assert_eq!(after.get("Green"), Some(&2));
        assert_eq!(after.get("Blue"), Some(&3));
        assert_eq!(after.get("Natural Titanium"), Some(&4));

        // The sold unit is still the same physical unit (identity preserved).
        let units = phone_service::list_imei(&conn, id).unwrap();
        let sold: Vec<_> = units.iter().filter(|i| i.status == "sold").collect();
        assert_eq!(sold.len(), 1);
        assert_eq!(sold[0].id, unit_ids[0]);
        assert_eq!(sold[0].color.as_deref(), Some("Green"));
    }

    #[test]
    fn cannot_sell_an_in_stock_imei_twice() {
        use crate::models::phone::AddPhoneImeiInput;
        let conn = in_memory_conn();
        let id = phone(&conn, 3, 100.0);
        let imei = phone_service::add_imei(
            &conn,
            AddPhoneImeiInput {
                phone_id: id,
                imei: "999999999999999".into(),
                imei2: None,
                color: None,
                pta_status: None,
                storage: None,
                battery_health_pct: None,
            },
        )
        .unwrap();

        let mut first = sale_input(id, 1);
        first.items[0].imei_id = Some(imei.id);
        create(&conn, first, None).unwrap();

        let mut second = sale_input(id, 1);
        second.items[0].imei_id = Some(imei.id);
        let err = create(&conn, second, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn sells_accessory_and_reduces_stock() {
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
        let sale = create(
            &conn,
            CreateSaleInput {
                member_id: None,
                discount: 0.0,
                paid_amount: None,
                payment_method: Some("cash".into()),
                notes: None,
                payments: vec![],
                items: vec![SaleItemInput {
                    sale_item_id: None,
                    item_type: "accessory".into(),
                    item_id: aid,
                    quantity: 2,
                    imei_id: None,
                    unit_price: None,
                    warranty: None,
                    warranty_expiry: None,
                }],
            },
            None,
        )
        .unwrap();
        assert_eq!(sale.total_amount, 60.0);
        assert_eq!(sale.items[0].item_type, "accessory");
        assert_eq!(accessory_service::get(&conn, aid).unwrap().quantity, 3);
    }

    #[test]
    fn rejects_unknown_item_type() {
        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);
        let mut input = sale_input(id, 1);
        input.items[0].item_type = "gadget".into();
        let err = create(&conn, input, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn lists_and_gets_sale() {
        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);
        let sale = create(&conn, sale_input(id, 1), None).unwrap();
        assert_eq!(list(&conn, None).unwrap().len(), 1);
        let got = get(&conn, sale.id).unwrap();
        assert_eq!(got.receipt_no, sale.receipt_no);
        assert_eq!(got.items[0].item_type, "phone");
        assert_eq!(got.items[0].item_id, id);
    }

    #[test]
    fn updates_sale_and_reapplies_stock_totals_and_returns() {
        use crate::models::product_return::{CreateReturnInput, ReturnItemInput};
        use crate::services::product_return_service;

        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);
        let sale = create(&conn, sale_input(id, 2), None).unwrap();
        product_return_service::create(
            &conn,
            CreateReturnInput {
                sale_id: sale.id,
                return_type: "return".into(),
                return_charge_percent: 10.0,
                fixed_deduction: None,
                refund_method: Some("cash".into()),
                return_date: None,
                reference: None,
                notes: None,
                items: vec![ReturnItemInput {
                    sale_item_id: sale.items[0].id,
                    quantity: 1,
                    imei_id: None,
                    reason: None,
                    condition: "sellable".into(),
                }],
                exchange_item: None,
            },
            None,
        )
        .unwrap();

        let corrected = update(
            &conn,
            sale.id,
            CreateSaleInput {
                member_id: None,
                discount: 25.0,
                paid_amount: Some(100.0),
                payment_method: Some("card".into()),
                notes: Some("corrected".into()),
                payments: vec![],
                items: vec![SaleItemInput {
                    sale_item_id: Some(sale.items[0].id),
                    item_type: "phone".into(),
                    item_id: id,
                    quantity: 3,
                    imei_id: None,
                    unit_price: Some(150.0),
                    warranty: None,
                    warranty_expiry: None,
                }],
            },
            None,
        )
        .unwrap();

        assert_eq!(corrected.total_amount, 425.0);
        assert_eq!(corrected.paid_amount, 100.0);
        assert_eq!(corrected.return_status, "partial");
        assert_eq!(corrected.returns[0].total_sale_price, 150.0);
        assert_eq!(corrected.returns[0].refund_amount, 135.0);
        assert_eq!(phone_service::get(&conn, id).unwrap().quantity, 3);
    }

    #[test]
    fn editing_sale_does_not_reprice_historical_cogs() {
        let conn = in_memory_conn();
        let id = phone(&conn, 2, 100.0);
        let sale = create(&conn, sale_input(id, 1), None).unwrap();
        assert_eq!(sale.items[0].cost_price, 500.0);

        conn.execute("UPDATE phones SET cost_price = 900 WHERE id = ?1", [id])
            .unwrap();
        let mut correction = sale_input(id, 1);
        correction.items[0].sale_item_id = Some(sale.items[0].id);
        correction.items[0].unit_price = Some(sale.items[0].unit_price);
        correction.notes = Some("payment note corrected".into());
        let corrected = update(&conn, sale.id, correction, None).unwrap();

        assert_eq!(corrected.items[0].cost_price, 500.0);
    }

    #[test]
    fn deleting_sale_with_return_restores_net_stock_and_removes_history() {
        use crate::models::product_return::{CreateReturnInput, ReturnItemInput};
        use crate::services::product_return_service;

        let conn = in_memory_conn();
        let id = phone(&conn, 5, 100.0);
        let sale = create(&conn, sale_input(id, 3), None).unwrap();
        product_return_service::create(
            &conn,
            CreateReturnInput {
                sale_id: sale.id,
                return_type: "return".into(),
                return_charge_percent: 0.0,
                fixed_deduction: None,
                refund_method: Some("cash".into()),
                return_date: None,
                reference: None,
                notes: None,
                items: vec![ReturnItemInput {
                    sale_item_id: sale.items[0].id,
                    quantity: 1,
                    imei_id: None,
                    reason: None,
                    condition: "sellable".into(),
                }],
                exchange_item: None,
            },
            None,
        )
        .unwrap();
        delete(&conn, sale.id, None).unwrap();

        assert_eq!(phone_service::get(&conn, id).unwrap().quantity, 5);
        assert!(get(&conn, sale.id).is_err());
        assert!(product_return_service::list(&conn, None)
            .unwrap()
            .is_empty());
    }
}
