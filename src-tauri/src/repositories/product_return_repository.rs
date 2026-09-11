use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::errors::AppError;
use crate::models::product_return::{ProductReturn, ReturnItem, ReturnSummary};

fn summary_from_row(r: &Row) -> rusqlite::Result<ReturnSummary> {
    Ok(ReturnSummary {
        id: r.get("id")?,
        return_no: r.get("return_no")?,
        sale_id: r.get("sale_id")?,
        receipt_no: r.get("receipt_no")?,
        member_id: r.get("member_id")?,
        customer_name: r.get("customer_name")?,
        customer_phone: r.get("customer_phone")?,
        total_sale_price: r.get("total_sale_price")?,
        deduction_amount: r.get("deduction_amount")?,
        refund_amount: r.get("refund_amount")?,
        return_charge_percent: r.get("return_charge_percent")?,
        refund_method: r.get("refund_method")?,
        return_date: r.get("return_date")?,
        condition: r.get("condition")?,
        status: r.get("status")?,
        reason: r.get("reason")?,
        notes: r.get("notes")?,
        created_by: r.get("created_by")?,
        created_by_name: r.get("created_by_name")?,
        created_at: r.get("created_at")?,
        item_count: r.get("item_count")?,
    })
}

const RETURN_COLS: &str = "r.id, r.return_no, r.sale_id, r.receipt_no, r.member_id, \
     r.customer_name, r.customer_phone, r.total_sale_price, r.deduction_amount, r.refund_amount, \
     r.return_charge_percent, r.refund_method, r.return_date, r.condition, r.status, r.reason, \
     r.notes, r.created_by, u.full_name AS created_by_name, r.created_at, \
     (SELECT COUNT(*) FROM return_items ri WHERE ri.return_id = r.id) AS item_count";

const RETURN_JOIN: &str =
    "FROM returns r LEFT JOIN users u ON u.id = r.created_by";

pub fn next_return_no(conn: &Connection) -> Result<String, AppError> {
    let max: i64 = conn.query_row("SELECT COALESCE(MAX(id), 0) FROM returns", [], |r| r.get(0))?;
    Ok(format!("RET-{:06}", max + 1))
}

#[allow(clippy::too_many_arguments)]
pub fn insert_return(
    conn: &Connection,
    return_no: &str,
    sale_id: i64,
    member_id: Option<i64>,
    customer_name: Option<&str>,
    customer_phone: Option<&str>,
    receipt_no: Option<&str>,
    total_sale_price: f64,
    deduction_amount: f64,
    refund_amount: f64,
    return_charge_percent: f64,
    refund_method: &str,
    return_date: Option<&str>,
    reason: Option<&str>,
    condition: &str,
    notes: Option<&str>,
    created_by: Option<i64>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO returns (return_no, sale_id, member_id, customer_name, customer_phone, \
             receipt_no, total_sale_price, deduction_amount, refund_amount, return_charge_percent, \
             refund_method, return_date, reason, condition, notes, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            return_no,
            sale_id,
            member_id,
            customer_name,
            customer_phone,
            receipt_no,
            total_sale_price,
            deduction_amount,
            refund_amount,
            return_charge_percent,
            refund_method,
            return_date,
            reason,
            condition,
            notes,
            created_by
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

#[allow(clippy::too_many_arguments)]
pub fn insert_return_item(
    conn: &Connection,
    return_id: i64,
    sale_item_id: i64,
    item_type: &str,
    item_id: i64,
    imei_id: Option<i64>,
    product_name: Option<&str>,
    imei: Option<&str>,
    serial_no: Option<&str>,
    quantity: i64,
    unit_price: f64,
    line_total: f64,
    deduction_amount: f64,
    refund_amount: f64,
    reason: Option<&str>,
    condition: &str,
    restocked: bool,
) -> Result<(), AppError> {
    let (col, val) = if item_type == "phone" {
        ("phone_id", rusqlite::types::Value::from(item_id))
    } else {
        ("accessory_id", rusqlite::types::Value::from(item_id))
    };
    conn.execute(
        &format!(
            "INSERT INTO return_items (return_id, sale_item_id, item_type, {col}, imei_id, \
                 product_name, imei, serial_no, quantity, unit_price, line_total, deduction_amount, \
                 refund_amount, reason, condition, restocked)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)"
        ),
        params![
            return_id,
            sale_item_id,
            item_type,
            val,
            imei_id,
            product_name,
            imei,
            serial_no,
            quantity,
            unit_price,
            line_total,
            deduction_amount,
            refund_amount,
            reason,
            condition,
            restocked
        ],
    )?;
    Ok(())
}

/// Total quantity already returned for each sale item (only rows found in the
/// given id set are returned).
pub fn returned_qty_by_sale_items(
    conn: &Connection,
    sale_item_ids: &[i64],
) -> Result<HashMap<i64, i64>, AppError> {
    let mut out = HashMap::new();
    if sale_item_ids.is_empty() {
        return Ok(out);
    }
    let placeholders = vec!["?"; sale_item_ids.len()].join(",");
    let sql = format!(
        "SELECT sale_item_id, SUM(quantity) FROM return_items \
         WHERE sale_item_id IN ({placeholders}) GROUP BY sale_item_id"
    );
    let mut stmt = conn.prepare(&sql)?;
    let params = rusqlite::params_from_iter(sale_item_ids.iter().cloned());
    let rows = stmt.query_map(params, |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?)))?;
    for r in rows {
        let (id, qty) = r?;
        out.insert(id, qty);
    }
    Ok(out)
}

/// Returns the current status of an IMEI (e.g. "sold", "in_stock") if it exists.
pub fn imei_status(conn: &Connection, imei_id: i64) -> Result<Option<String>, AppError> {
    let s: Option<String> = conn
        .query_row("SELECT status FROM phone_imeis WHERE id = ?1", [imei_id], |r| {
            r.get(0)
        })
        .optional()?;
    Ok(s)
}

/// Restore a sold IMEI back to sellable inventory. Fails (returns false) when
/// the IMEI is not currently marked sold, which prevents double returns.
pub fn restore_imei(conn: &Connection, imei_id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE phone_imeis SET status = 'in_stock', sold_at = NULL \
         WHERE id = ?1 AND status = 'sold'",
        [imei_id],
    )?;
    Ok(affected > 0)
}

/// Mark a returned IMEI as defective so it cannot be sold again.
pub fn mark_imei_defective(conn: &Connection, imei_id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE phone_imeis SET status = 'defective', sold_at = NULL \
         WHERE id = ?1 AND status = 'sold'",
        [imei_id],
    )?;
    Ok(affected > 0)
}

/// Add returned quantity back to sellable stock.
pub fn increment_stock(
    conn: &Connection,
    item_type: &str,
    item_id: i64,
    qty: i64,
) -> Result<(), AppError> {
    super::inventory_repository::increment_stock(conn, item_type, item_id, qty)
}

fn item_from_row(r: &Row) -> rusqlite::Result<ReturnItem> {
    Ok(ReturnItem {
        id: r.get("id")?,
        return_id: r.get("return_id")?,
        sale_item_id: r.get("sale_item_id")?,
        item_type: r.get("item_type")?,
        item_id: r.get("item_id")?,
        imei_id: r.get("imei_id")?,
        product_name: r.get("product_name")?,
        imei: r.get("imei")?,
        serial_no: r.get("serial_no")?,
        quantity: r.get("quantity")?,
        unit_price: r.get("unit_price")?,
        line_total: r.get("line_total")?,
        deduction_amount: r.get("deduction_amount")?,
        refund_amount: r.get("refund_amount")?,
        reason: r.get("reason")?,
        condition: r.get("condition")?,
        restocked: r.get("restocked")?,
        created_at: r.get("created_at")?,
    })
}

fn list_items(conn: &Connection, return_id: i64) -> Result<Vec<ReturnItem>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT ri.id, ri.return_id, ri.sale_item_id, ri.item_type, \
                COALESCE(ri.phone_id, ri.accessory_id) AS item_id, ri.imei_id, \
                ri.product_name, ri.imei, ri.serial_no, ri.quantity, ri.unit_price, \
                ri.line_total, ri.deduction_amount, ri.refund_amount, ri.reason, \
                ri.condition, ri.restocked, ri.created_at
         FROM return_items ri WHERE ri.return_id = ?1 ORDER BY ri.id",
    )?;
    let rows = stmt.query_map([return_id], item_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

fn to_product_return(s: &ReturnSummary, items: Vec<ReturnItem>) -> ProductReturn {
    ProductReturn {
        id: s.id,
        return_no: s.return_no.clone(),
        sale_id: s.sale_id,
        receipt_no: s.receipt_no.clone(),
        member_id: s.member_id,
        customer_name: s.customer_name.clone(),
        customer_phone: s.customer_phone.clone(),
        total_sale_price: s.total_sale_price,
        deduction_amount: s.deduction_amount,
        refund_amount: s.refund_amount,
        return_charge_percent: s.return_charge_percent,
        refund_method: s.refund_method.clone(),
        return_date: s.return_date.clone(),
        condition: s.condition.clone(),
        status: s.status.clone(),
        reason: s.reason.clone(),
        notes: s.notes.clone(),
        created_by: s.created_by,
        created_by_name: s.created_by_name.clone(),
        created_at: s.created_at.clone(),
        items,
    }
}

pub fn get_return_with_items(conn: &Connection, id: i64) -> Result<Option<ProductReturn>, AppError> {
    let sql = format!(
        "SELECT {RETURN_COLS} {RETURN_JOIN} WHERE r.id = ?1 ORDER BY r.created_at DESC LIMIT 1"
    );
    let mut summary: Option<ReturnSummary> =
        conn.query_row(&sql, [id], summary_from_row).optional()?;
    if let Some(s) = summary.as_mut() {
        let items = list_items(conn, id)?;
        return Ok(Some(to_product_return(s, items)));
    }
    Ok(None)
}

/// All return records for a given sale (header + items), oldest first. Used by
/// the sale detail view to show which exact items were returned.
pub fn returns_for_sale(conn: &Connection, sale_id: i64) -> Result<Vec<ProductReturn>, AppError> {
    let sql = format!(
        "SELECT {RETURN_COLS} {RETURN_JOIN} WHERE r.sale_id = ?1 \
         ORDER BY r.return_date ASC, r.id ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([sale_id], summary_from_row)?;
    let mut summaries = Vec::new();
    for r in rows {
        summaries.push(r?);
    }
    let mut out = Vec::new();
    for s in &summaries {
        let items = list_items(conn, s.id)?;
        out.push(to_product_return(s, items));
    }
    Ok(out)
}

pub fn list_returns(conn: &Connection, search: Option<&str>) -> Result<Vec<ReturnSummary>, AppError> {
    let mut sql = format!("SELECT {RETURN_COLS} {RETURN_JOIN}");
    let mut q: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(s) = search {
        let s = s.trim();
        if !s.is_empty() {
            let s = format!("%{s}%");
            sql.push_str(
                " WHERE r.return_no LIKE ? OR r.receipt_no LIKE ? \
                 OR COALESCE(r.customer_name, '') LIKE ? OR COALESCE(r.customer_phone, '') LIKE ? \
                 OR EXISTS (SELECT 1 FROM return_items ri WHERE ri.return_id = r.id \
                            AND (ri.product_name LIKE ? OR ri.imei LIKE ? OR ri.serial_no LIKE ?))",
            );
            let val = rusqlite::types::Value::from(s);
            q.extend(vec![val.clone(), val.clone(), val.clone(), val.clone(), val.clone(), val.clone(), val]);
        }
    }
    sql.push_str(" ORDER BY r.created_at DESC, r.id DESC LIMIT 500");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), summary_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}