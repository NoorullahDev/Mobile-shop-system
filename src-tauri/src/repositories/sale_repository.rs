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
        sold_qty,
        return_status,
        returned_amount: r.get("returned_amount")?,
        return_count: r.get("return_count")?,
        returns: Vec::new(),
        sale_payments: Vec::new(),
    })
}

const SALE_COLS: &str = "s.id, s.receipt_no, s.member_id, m.name AS member_name, m.phone AS member_phone, \
     s.total_amount, s.discount, s.paid_amount, s.payment_method, s.notes, s.created_by, s.created_at";

const SALE_JOIN: &str = "FROM sales s LEFT JOIN members m ON m.id = s.member_id";

const SALE_AGG_COLS: &str = "COALESCE(rt.returned_amount, 0) AS returned_amount, \
     COALESCE(rt.return_count, 0) AS return_count, \
     COALESCE(rt.returned_qty, 0) AS returned_qty, \
     COALESCE(siq.sold_qty, 0) AS sold_qty";

const SALE_AGG_JOIN: &str = "LEFT JOIN (SELECT rh.sale_id, rh.returned_amount, rh.return_count, \
     COALESCE(ri.returned_qty, 0) AS returned_qty \
     FROM (SELECT sale_id, SUM(refund_amount) AS returned_amount, COUNT(*) AS return_count \
           FROM returns GROUP BY sale_id) rh \
     LEFT JOIN (SELECT r.sale_id, SUM(i.quantity) AS returned_qty \
                FROM returns r JOIN return_items i ON i.return_id = r.id GROUP BY r.sale_id) ri \
       ON ri.sale_id = rh.sale_id) rt ON rt.sale_id = s.id \
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

#[allow(clippy::too_many_arguments)]
pub fn insert_sale_item(
    conn: &Connection,
    sale_id: i64,
    item_type: &str,
    item_id: i64,
    imei_id: Option<i64>,
    quantity: i64,
    unit_price: f64,
    cost_price: f64,
    warranty: Option<&str>,
    warranty_expiry: Option<&str>,
    color: Option<&str>,
    imei_snapshot: Option<&str>,
    imei2_snapshot: Option<&str>,
    pta_status: Option<&str>,
    storage: Option<&str>,
    battery_health_pct: Option<i64>,
    product_name_snapshot: Option<&str>,
    variant_snapshot: Option<&str>,
) -> Result<(), AppError> {
    let (col, val) = if item_type == "phone" {
        ("phone_id", rusqlite::types::Value::from(item_id))
    } else {
        ("accessory_id", rusqlite::types::Value::from(item_id))
    };
    conn.execute(
        &format!(
            "INSERT INTO sale_items (sale_id, {col}, imei_id, quantity, unit_price, cost_price, warranty, warranty_expiry, color, imei_snapshot, imei2_snapshot, pta_status, storage, battery_health_pct, product_name_snapshot, variant_snapshot)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)"
        ),
        rusqlite::params![
            sale_id,
            val,
            imei_id,
            quantity,
            unit_price,
            cost_price,
            warranty,
            warranty_expiry,
            color,
            imei_snapshot,
            imei2_snapshot,
            pta_status,
            storage,
            battery_health_pct,
            product_name_snapshot,
            variant_snapshot
        ],
    )?;
    Ok(())
}

/// Number of exact physical units currently available for sale (in stock) for a phone.
pub fn in_stock_imei_count(conn: &Connection, phone_id: i64) -> Result<i64, AppError> {
    let count = conn.query_row(
        "SELECT COUNT(*) FROM phone_imeis WHERE phone_id = ?1 AND status = 'in_stock'",
        [phone_id],
        |r| r.get::<_, i64>(0),
    )?;
    Ok(count)
}

/// The exact IMEI string of a unit, used to snapshot it onto the sale line.
pub fn imei_value(conn: &Connection, imei_id: i64) -> Result<Option<String>, AppError> {
    let val: Option<Option<String>> = conn
        .query_row(
            "SELECT imei FROM phone_imeis WHERE id = ?1",
            [imei_id],
            |r| r.get::<_, Option<String>>(0),
        )
        .optional()?;
    Ok(val.flatten())
}

pub fn imei2_value(conn: &Connection, imei_id: i64) -> Result<Option<String>, AppError> {
    let val: Option<Option<String>> = conn
        .query_row(
            "SELECT imei2 FROM phone_imeis WHERE id = ?1",
            [imei_id],
            |r| r.get::<_, Option<String>>(0),
        )
        .optional()?;
    Ok(val.flatten())
}

pub fn imei_pta_status(conn: &Connection, imei_id: i64) -> Result<Option<String>, AppError> {
    let val: Option<Option<String>> = conn
        .query_row(
            "SELECT pta_status FROM phone_imeis WHERE id = ?1",
            [imei_id],
            |r| r.get::<_, Option<String>>(0),
        )
        .optional()?;
    Ok(val.flatten())
}

pub fn imei_unit_details(
    conn: &Connection,
    imei_id: i64,
) -> Result<(Option<String>, Option<i64>), AppError> {
    let value = conn
        .query_row(
            "SELECT storage, battery_health_pct FROM phone_imeis WHERE id = ?1",
            [imei_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    Ok(value.unwrap_or((None, None)))
}

/// Returns Some(current_quantity) if the phone/accessory item exists and is not deleted.
pub fn item_quantity(conn: &Connection, item_type: &str, id: i64) -> Result<Option<i64>, AppError> {
    super::inventory_repository::item_quantity(conn, item_type, id)
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

/// Returns Some(cost_price) if the phone/accessory item exists.
pub fn item_cost(conn: &Connection, item_type: &str, id: i64) -> Result<Option<f64>, AppError> {
    let table = if item_type == "phone" {
        "phones"
    } else {
        "accessories"
    };
    let c: Option<f64> = conn
        .query_row(
            &format!("SELECT cost_price FROM {table} WHERE id = ?1 AND is_deleted = 0"),
            [id],
            |r| r.get(0),
        )
        .optional()?;
    Ok(c)
}

pub fn item_sale_identity(
    conn: &Connection,
    item_type: &str,
    id: i64,
) -> Result<(Option<String>, Option<String>), AppError> {
    if item_type == "phone" {
        let value = conn
            .query_row(
                "SELECT TRIM(COALESCE(NULLIF(brand, '') || ' ', '') || model || COALESCE(' ' || NULLIF(storage, ''), '')), variant FROM phones WHERE id = ?1 AND is_deleted = 0",
                [id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        Ok(value.unwrap_or((None, None)))
    } else {
        let value = conn
            .query_row(
                "SELECT TRIM(COALESCE(NULLIF(brand, '') || ' ', '') || product_name) FROM accessories WHERE id = ?1 AND is_deleted = 0",
                [id],
                |r| r.get(0),
            )
            .optional()?;
        Ok((value, None))
    }
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

pub fn release_imei(conn: &Connection, imei_id: i64, phone_id: i64) -> Result<(), AppError> {
    conn.execute(
        "UPDATE phone_imeis SET status = 'in_stock', sold_at = NULL WHERE id = ?1 AND phone_id = ?2",
        params![imei_id, phone_id],
    )?;
    Ok(())
}

pub fn imei_used_by_other_sale(
    conn: &Connection,
    imei_id: i64,
    sale_id: i64,
) -> Result<bool, AppError> {
    let used: i64 = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sale_items WHERE imei_id = ?1 AND sale_id <> ?2)",
        params![imei_id, sale_id],
        |r| r.get(0),
    )?;
    Ok(used != 0)
}

pub fn increment_stock(
    conn: &Connection,
    item_type: &str,
    item_id: i64,
    qty: i64,
) -> Result<(), AppError> {
    super::inventory_repository::increment_stock(conn, item_type, item_id, qty)
}

#[allow(clippy::too_many_arguments)]
pub fn update_sale(
    conn: &Connection,
    id: i64,
    member_id: Option<i64>,
    total_amount: f64,
    discount: f64,
    paid_amount: f64,
    payment_method: &str,
    notes: Option<&str>,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE sales SET member_id = ?2, total_amount = ?3, discount = ?4, paid_amount = ?5, payment_method = ?6, notes = ?7 WHERE id = ?1",
        params![id, member_id, total_amount, discount, paid_amount, payment_method, notes],
    )?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn update_sale_item(
    conn: &Connection,
    id: i64,
    item_type: &str,
    item_id: i64,
    imei_id: Option<i64>,
    quantity: i64,
    unit_price: f64,
    cost_price: f64,
    warranty: Option<&str>,
    warranty_expiry: Option<&str>,
    color: Option<&str>,
    imei_snapshot: Option<&str>,
    imei2_snapshot: Option<&str>,
    pta_status: Option<&str>,
    storage: Option<&str>,
    battery_health_pct: Option<i64>,
    product_name_snapshot: Option<&str>,
    variant_snapshot: Option<&str>,
) -> Result<(), AppError> {
    let (phone_id, accessory_id) = if item_type == "phone" {
        (Some(item_id), None)
    } else {
        (None, Some(item_id))
    };
    conn.execute(
        "UPDATE sale_items SET phone_id = ?2, accessory_id = ?3, imei_id = ?4, quantity = ?5, unit_price = ?6, cost_price = ?7, warranty = ?8, warranty_expiry = ?9, color = ?10, imei_snapshot = ?11, imei2_snapshot = ?12, pta_status = ?13, storage = ?14, battery_health_pct = ?15, product_name_snapshot = ?16, variant_snapshot = ?17 WHERE id = ?1",
        params![id, phone_id, accessory_id, imei_id, quantity, unit_price, cost_price, warranty, warranty_expiry, color, imei_snapshot, imei2_snapshot, pta_status, storage, battery_health_pct, product_name_snapshot, variant_snapshot],
    )?;
    Ok(())
}

pub fn delete_sale_item(conn: &Connection, id: i64) -> Result<(), AppError> {
    conn.execute("DELETE FROM sale_items WHERE id = ?1", [id])?;
    Ok(())
}

pub fn delete_sale(conn: &Connection, id: i64) -> Result<(), AppError> {
    conn.execute("DELETE FROM sale_items WHERE sale_id = ?1", [id])?;
    let affected = conn.execute("DELETE FROM sales WHERE id = ?1", [id])?;
    if affected == 0 {
        return Err(AppError::validation("Sale not found"));
    }
    Ok(())
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

/// Current colour of a physical unit (IMEI), if one was recorded.
pub fn imei_color(conn: &Connection, imei_id: i64) -> Result<Option<String>, AppError> {
    let color: Option<Option<String>> = conn
        .query_row(
            "SELECT color FROM phone_imeis WHERE id = ?1",
            [imei_id],
            |r| r.get::<_, Option<String>>(0),
        )
        .optional()?;
    Ok(color.flatten())
}

/// Nominal product colour (phone catalog field). Used as a fallback snapshot
/// when a phone was sold without selecting an IMEI unit.
pub fn product_color(
    conn: &Connection,
    item_type: &str,
    id: i64,
) -> Result<Option<String>, AppError> {
    let table = if item_type == "phone" {
        "phones"
    } else {
        "accessories"
    };
    let color: Option<Option<String>> = conn
        .query_row(
            &format!("SELECT color FROM {table} WHERE id = ?1 AND is_deleted = 0"),
            [id],
            |r| r.get::<_, Option<String>>(0),
        )
        .optional()?;
    Ok(color.flatten())
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
                si.imei_id, si.quantity, si.unit_price, si.cost_price, si.color, si.pta_status,
                CASE WHEN si.product_name_snapshot IS NOT NULL THEN si.storage ELSE im.storage END AS storage,
                CASE WHEN si.product_name_snapshot IS NOT NULL THEN si.battery_health_pct ELSE im.battery_health_pct END AS battery_health_pct,
                COALESCE(si.product_name_snapshot, p.brand || ' ' || p.model, a.brand || ' ' || a.product_name) AS product_name,
                CASE WHEN si.product_name_snapshot IS NOT NULL THEN si.imei_snapshot ELSE im.imei END AS imei,
                CASE WHEN si.product_name_snapshot IS NOT NULL THEN si.imei2_snapshot ELSE im.imei2 END AS imei2,
                CASE WHEN si.product_name_snapshot IS NOT NULL THEN si.variant_snapshot ELSE p.variant END AS variant,
                COALESCE(p.serial_number, a.serial_number) AS serial_no,
                si.warranty, si.warranty_expiry
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
            cost_price: r.get("cost_price")?,
            product_name: r.get("product_name")?,
            imei: r.get("imei")?,
            imei2: r.get("imei2")?,
            variant: r.get("variant")?,
            serial_no: r.get("serial_no")?,
            warranty: r.get("warranty")?,
            warranty_expiry: r.get("warranty_expiry")?,
            color: r.get("color")?,
            pta_status: r.get("pta_status")?,
            storage: r.get("storage")?,
            battery_health_pct: r.get("battery_health_pct")?,
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

/// Complete sales history for reports. Unlike the interactive history list,
/// this is range-bounded instead of being truncated to the latest 500 rows.
pub fn list_sales_for_period(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<Vec<Sale>, AppError> {
    let sql = format!(
        "SELECT {SALE_COLS}, {SALE_AGG_COLS} {SALE_JOIN} {SALE_AGG_JOIN}
         WHERE date(s.created_at, 'localtime') >= date(?1)
           AND date(s.created_at, 'localtime') < date(?2, '+1 day')
         ORDER BY s.created_at DESC, s.id DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![from, to], sale_from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}
