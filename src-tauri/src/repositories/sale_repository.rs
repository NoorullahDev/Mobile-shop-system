use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::errors::AppError;
use crate::models::sale::{Sale, SaleItem};

fn sale_from_row(r: &Row) -> rusqlite::Result<Sale> {
    let returned_qty: i64 = r.get("returned_qty")?;
    let sold_qty: i64 = r.get("sold_qty")?;
    let return_status = if returned_qty <= 0 {
        "none".to_string()
    } else if sold_qty > 0 && returned_qty >= sold_qty {
        "full".to_string()
    } else {
        "partial".to_string()
    };
    Ok(Sale {
        id: r.get("id")?,
        receipt_no: r.get("receipt_no")?,
        member_id: r.get("member_id")?,
        member_name: r.get("member_name")?,
        member_phone: r.get("member_phone")?,
        total_amount: r.get("total_amount")?,
        discount: r.get("discount")?,
        paid_amount: r.get("paid_amount")?,
        payment_method: r.get("payment_method")?,
        notes: r.get("notes")?,
        created_by: r.get("created_by")?,
        created_at: r.get("created_at")?,
        items: Vec::new(),
        return_status,
        returned_amount: r.get("returned_amount")?,
        return_count: r.get("return_count")?,
        returns: Vec::new(),
    })
}

const SALE_COLS: &str = "s.id, s.receipt_no, s.member_id, m.name AS member_name, m.phone AS member_phone, \
     s.total_amount, s.discount, s.paid_amount, s.payment_method, s.notes, s.created_by, s.created_at";

const SALE_JOIN: &str = "FROM sales s LEFT JOIN members m ON m.id = s.member_id";

const SALE_AGG_COLS: &str = "COALESCE(rt.returned_amount, 0) AS returned_amount, \
     COALESCE(rt.return_count, 0) AS return_count, \
     COALESCE(rt.returned_qty, 0) AS returned_qty, \
     COALESCE(siq.sold_qty, 0) AS sold_qty";

const SALE_AGG_JOIN: &str = "LEFT JOIN (SELECT rt2.sale_id, SUM(rt2.refund_amount) AS returned_amount, \
     COUNT(rt2.id) AS return_count, SUM(ri.quantity) AS returned_qty \
     FROM returns rt2 LEFT JOIN return_items ri ON ri.return_id = rt2.id \
     GROUP BY rt2.sale_id) rt ON rt.sale_id = s.id \
     LEFT JOIN (SELECT sale_id, SUM(quantity) AS sold_qty FROM sale_items GROUP BY sale_id) siq \
     ON siq.sale_id = s.id";

pub fn insert_sale(
    conn: &Connection,
    receipt_no: &str,
    member_id: Option<i64>,
    total_amount: f64,
    discount: f64,
    paid_amount: f64,
    payment_method: &str,
    notes: Option<&str>,
    created_by: Option<i64>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO sales (receipt_no, member_id, total_amount, discount, paid_amount, payment_method, notes, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            receipt_no,
            member_id,
            total_amount,
            discount,
            paid_amount,
            payment_method,
            notes,
            created_by
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn insert_sale_item(
    conn: &Connection,
    sale_id: i64,
    item_type: &str,
    item_id: i64,
    imei_id: Option<i64>,
    quantity: i64,
    unit_price: f64,
) -> Result<(), AppError> {
    let (col, val) = if item_type == "phone" {
        ("phone_id", rusqlite::types::Value::from(item_id))
    } else {
        ("accessory_id", rusqlite::types::Value::from(item_id))
    };
    conn.execute(
        &format!(
            "INSERT INTO sale_items (sale_id, {col}, imei_id, quantity, unit_price)
             VALUES (?1, ?2, ?3, ?4, ?5)"
        ),
        rusqlite::params![sale_id, val, imei_id, quantity, unit_price],
    )?;
    Ok(())
}

/// Returns Some(current_quantity) if the phone/accessory item exists and is not deleted.
pub fn item_quantity(conn: &Connection, item_type: &str, id: i64) -> Result<Option<i64>, AppError> {
    let table = if item_type == "phone" {
        "phones"
    } else {
        "accessories"
    };
    let q: Option<i64> = conn
        .query_row(
            &format!("SELECT quantity FROM {table} WHERE id = ?1 AND is_deleted = 0"),
            [id],
            |r| r.get(0),
        )
        .optional()?;
    Ok(q)
}

/// Returns Some(sale_price) if the phone/accessory item exists.
pub fn item_price(conn: &Connection, item_type: &str, id: i64) -> Result<Option<f64>, AppError> {
    let table = if item_type == "phone" {
        "phones"
    } else {
        "accessories"
    };
    let p: Option<f64> = conn
        .query_row(
            &format!("SELECT sale_price FROM {table} WHERE id = ?1 AND is_deleted = 0"),
            [id],
            |r| r.get(0),
        )
        .optional()?;
    Ok(p)
}

pub fn decrement_stock(
    conn: &Connection,
    item_type: &str,
    item_id: i64,
    qty: i64,
) -> Result<bool, AppError> {
    let table = if item_type == "phone" {
        "phones"
    } else {
        "accessories"
    };
    let affected = conn.execute(
        &format!(
            "UPDATE {table} SET quantity = quantity - ?1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?2 AND is_deleted = 0 AND quantity >= ?1"
        ),
        params![qty, item_id],
    )?;
    Ok(affected > 0)
}

pub fn mark_imei_sold(conn: &Connection, imei_id: i64, phone_id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE phone_imeis SET status = 'sold', sold_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND phone_id = ?2 AND status = 'in_stock'",
        params![imei_id, phone_id],
    )?;
    Ok(affected > 0)
}

/// Verify an IMEI belongs to the given phone and is still in stock.
pub fn imei_available(conn: &Connection, imei_id: i64, phone_id: i64) -> Result<bool, AppError> {
    let ok: Option<bool> = conn
        .query_row(
            "SELECT 1 FROM phone_imeis WHERE id = ?1 AND phone_id = ?2 AND status = 'in_stock'",
            params![imei_id, phone_id],
            |_| Ok(true),
        )
        .optional()?;
    Ok(ok.is_some())
}

pub fn next_receipt_no(conn: &Connection) -> Result<String, AppError> {
    let max: i64 = conn.query_row("SELECT COALESCE(MAX(id), 0) FROM sales", [], |r| r.get(0))?;
    Ok(format!("INV-{:06}", max + 1))
}

pub fn get_sale_with_items(conn: &Connection, id: i64) -> Result<Option<Sale>, AppError> {
    let sql = format!(
        "SELECT {SALE_COLS}, {SALE_AGG_COLS} {SALE_JOIN} {SALE_AGG_JOIN} \
         WHERE s.id = ?1 ORDER BY s.created_at DESC LIMIT 1"
    );
    let mut sale: Option<Sale> = conn.query_row(&sql, [id], sale_from_row).optional()?;
    if let Some(s) = sale.as_mut() {
        let items = list_items(conn, id)?;
        s.items = items;
    }
    Ok(sale)
}

fn list_items(conn: &Connection, sale_id: i64) -> Result<Vec<SaleItem>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT si.id, si.sale_id,
                CASE WHEN si.phone_id IS NOT NULL THEN 'phone' ELSE 'accessory' END AS item_type,
                COALESCE(si.phone_id, si.accessory_id) AS item_id,
                si.imei_id, si.quantity, si.unit_price,
                COALESCE(p.brand || ' ' || p.model, a.brand || ' ' || a.product_name) AS product_name,
                im.imei AS imei,
                CASE WHEN si.phone_id IS NOT NULL THEN p.variant END AS variant,
                COALESCE(p.serial_number, a.serial_number) AS serial_no
         FROM sale_items si
         LEFT JOIN phones p ON p.id = si.phone_id
         LEFT JOIN accessories a ON a.id = si.accessory_id
         LEFT JOIN phone_imeis im ON im.id = si.imei_id
         WHERE si.sale_id = ?1 ORDER BY si.id",
    )?;
    let rows = stmt.query_map([sale_id], |r| {
        Ok(SaleItem {
            id: r.get("id")?,
            sale_id: r.get("sale_id")?,
            item_type: r.get("item_type")?,
            item_id: r.get("item_id")?,
            imei_id: r.get("imei_id")?,
            quantity: r.get("quantity")?,
            unit_price: r.get("unit_price")?,
            product_name: r.get("product_name")?,
            imei: r.get("imei")?,
            variant: r.get("variant")?,
            serial_no: r.get("serial_no")?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn list_sales(conn: &Connection, search: Option<&str>) -> Result<Vec<Sale>, AppError> {
    let mut sql = format!("SELECT {SALE_COLS}, {SALE_AGG_COLS} {SALE_JOIN} {SALE_AGG_JOIN}");
    let mut q: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(s) = search {
        let s = s.trim();
        if !s.is_empty() {
            let s = format!("%{s}%");
            sql.push_str(" WHERE s.receipt_no LIKE ? OR COALESCE(m.name,'') LIKE ?");
            let val = rusqlite::types::Value::from(s);
            q.push(val.clone());
            q.push(val);
        }
    }
    sql.push_str(" ORDER BY s.created_at DESC, s.id DESC LIMIT 500");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), sale_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}
