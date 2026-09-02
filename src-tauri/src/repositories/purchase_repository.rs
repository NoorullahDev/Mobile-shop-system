use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::errors::AppError;
use crate::models::purchase::{Purchase, PurchaseItem, SupplierBalance, SupplierPayment};

pub fn insert_purchase(
    conn: &Connection,
    purchase_no: &str,
    supplier_id: Option<i64>,
    total_amount: f64,
    discount: f64,
    paid_amount: f64,
    payment_method: &str,
    notes: Option<&str>,
    created_by: Option<i64>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO purchases (purchase_no, supplier_id, total_amount, discount, paid_amount, payment_method, notes, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            purchase_no,
            supplier_id,
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

pub fn insert_purchase_item(
    conn: &Connection,
    purchase_id: i64,
    item_type: &str,
    item_id: i64,
    quantity: i64,
    unit_cost: f64,
) -> Result<(), AppError> {
    let (col, val) = if item_type == "phone" {
        ("phone_id", rusqlite::types::Value::from(item_id))
    } else {
        ("accessory_id", rusqlite::types::Value::from(item_id))
    };
    conn.execute(
        &format!(
            "INSERT INTO purchase_items (purchase_id, {col}, quantity, unit_cost)
             VALUES (?1, ?2, ?3, ?4)"
        ),
        rusqlite::params![purchase_id, val, quantity, unit_cost],
    )?;
    Ok(())
}

pub fn next_purchase_no(conn: &Connection) -> Result<String, AppError> {
    let max: i64 = conn.query_row("SELECT COALESCE(MAX(id), 0) FROM purchases", [], |r| r.get(0))?;
    Ok(format!("PO-{:06}", max + 1))
}

pub fn item_quantity(conn: &Connection, item_type: &str, id: i64) -> Result<Option<i64>, AppError> {
    let table = if item_type == "phone" { "phones" } else { "accessories" };
    let q: Option<i64> = conn
        .query_row(
            &format!("SELECT quantity FROM {table} WHERE id = ?1 AND is_deleted = 0", ),
            [id],
            |r| r.get(0),
        )
        .optional()?;
    Ok(q)
}

pub fn item_cost(conn: &Connection, item_type: &str, id: i64) -> Result<Option<f64>, AppError> {
    let table = if item_type == "phone" { "phones" } else { "accessories" };
    let c: Option<f64> = conn
        .query_row(
            &format!("SELECT cost_price FROM {table} WHERE id = ?1 AND is_deleted = 0", ),
            [id],
            |r| r.get(0),
        )
        .optional()?;
    Ok(c)
}

pub fn increment_stock(conn: &Connection, item_type: &str, item_id: i64, qty: i64) -> Result<(), AppError> {
    let table = if item_type == "phone" { "phones" } else { "accessories" };
    conn.execute(
        &format!(
            "UPDATE {table} SET quantity = quantity + ?1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?2 AND is_deleted = 0"
        ),
        params![qty, item_id],
    )?;
    Ok(())
}

/// Returns the subset of the given IMEIs that are already registered (used by
/// any phone), so callers can validate all IMEIs in a single query.
pub fn imeis_in_use(conn: &Connection, imeis: &[String]) -> Result<std::collections::HashSet<String>, AppError> {
    let mut out = std::collections::HashSet::new();
    if imeis.is_empty() {
        return Ok(out);
    }
    let placeholders = vec!["?"; imeis.len()].join(",");
    let sql = format!("SELECT imei FROM phone_imeis WHERE imei IN ({placeholders})");
    let mut stmt = conn.prepare(&sql)?;
    let params = rusqlite::params_from_iter(imeis.iter().map(|s| s.as_str()));
    let rows = stmt.query_map(params, |r| r.get::<_, String>(0))?;
    for r in rows {
        out.insert(r?);
    }
    Ok(out)
}

/// Inserts several IMEIs for one phone in a single statement.
pub fn insert_imeis(conn: &Connection, phone_id: i64, imeis: &[String]) -> Result<(), AppError> {
    if imeis.is_empty() {
        return Ok(());
    }
    let placeholders = vec!["(?1, ?)"; imeis.len()].join(",");
    let sql = format!("INSERT INTO phone_imeis (phone_id, imei) VALUES {placeholders}");
    let mut params: Vec<rusqlite::types::Value> = vec![rusqlite::types::Value::from(phone_id)];
    for imei in imeis {
        params.push(rusqlite::types::Value::from(imei.clone()));
    }
    conn.execute(&sql, rusqlite::params_from_iter(params.iter()))?;
    Ok(())
}

fn purchase_from_row(r: &Row) -> rusqlite::Result<Purchase> {
    Ok(Purchase {
        id: r.get("id")?,
        purchase_no: r.get("purchase_no")?,
        supplier_id: r.get("supplier_id")?,
        supplier_name: r.get("supplier_name")?,
        total_amount: r.get("total_amount")?,
        discount: r.get("discount")?,
        paid_amount: r.get("paid_amount")?,
        payment_method: r.get("payment_method")?,
        notes: r.get("notes")?,
        created_by: r.get("created_by")?,
        created_at: r.get("created_at")?,
        items: Vec::new(),
    })
}

const PURCHASE_COLS: &str = "p.id, p.purchase_no, p.supplier_id, s.name AS supplier_name, \
     p.total_amount, p.discount, p.paid_amount, p.payment_method, p.notes, p.created_by, p.created_at";

const PURCHASE_JOIN: &str = "FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id";

fn list_items(conn: &Connection, purchase_id: i64) -> Result<Vec<PurchaseItem>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT pi.id, pi.purchase_id,
                CASE WHEN pi.phone_id IS NOT NULL THEN 'phone' ELSE 'accessory' END AS item_type,
                COALESCE(pi.phone_id, pi.accessory_id) AS item_id,
                pi.quantity, pi.unit_cost,
                COALESCE(p.brand || ' ' || p.model, a.brand || ' ' || a.product_name) AS product_name
         FROM purchase_items pi
         LEFT JOIN phones p ON p.id = pi.phone_id
         LEFT JOIN accessories a ON a.id = pi.accessory_id
         WHERE pi.purchase_id = ?1 ORDER BY pi.id",
    )?;
    let rows = stmt.query_map([purchase_id], |r| {
        let unit_cost: f64 = r.get("unit_cost")?;
        let quantity: i64 = r.get("quantity")?;
        Ok(PurchaseItem {
            id: r.get("id")?,
            purchase_id: r.get("purchase_id")?,
            item_type: r.get("item_type")?,
            item_id: r.get("item_id")?,
            quantity,
            unit_cost,
            product_name: r.get("product_name")?,
            line_total: (unit_cost * quantity as f64 * 100.0).round() / 100.0,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn get_purchase_with_items(conn: &Connection, id: i64) -> Result<Option<Purchase>, AppError> {
    let sql = format!(
        "SELECT {PURCHASE_COLS} {PURCHASE_JOIN} WHERE p.id = ?1 ORDER BY p.created_at DESC LIMIT 1"
    );
    let mut purchase: Option<Purchase> = conn.query_row(&sql, [id], purchase_from_row).optional()?;
    if let Some(p) = purchase.as_mut() {
        p.items = list_items(conn, id)?;
    }
    Ok(purchase)
}

fn item_from_r(r: &rusqlite::Row) -> rusqlite::Result<PurchaseItem> {
    let unit_cost: f64 = r.get("unit_cost")?;
    let quantity: i64 = r.get("quantity")?;
    Ok(PurchaseItem {
        id: r.get("id")?,
        purchase_id: r.get("purchase_id")?,
        item_type: r.get("item_type")?,
        item_id: r.get("item_id")?,
        quantity,
        unit_cost,
        product_name: r.get("product_name")?,
        line_total: (unit_cost * quantity as f64 * 100.0).round() / 100.0,
    })
}

/// Loads all items for the given purchases in a single query, grouped by
/// `purchase_id`, avoiding the N+1 pattern of `list_items` per purchase.
fn list_items_for_purchases<T: IntoIterator<Item = i64>>(
    conn: &Connection,
    purchase_ids: T,
) -> Result<std::collections::HashMap<i64, Vec<PurchaseItem>>, AppError> {
    let ids: Vec<i64> = purchase_ids.into_iter().collect();
    let mut map: std::collections::HashMap<i64, Vec<PurchaseItem>> = std::collections::HashMap::new();
    if ids.is_empty() {
        return Ok(map);
    }
    let placeholders = vec!["?"; ids.len()].join(",");
    let sql = format!(
        "SELECT pi.id, pi.purchase_id,
                CASE WHEN pi.phone_id IS NOT NULL THEN 'phone' ELSE 'accessory' END AS item_type,
                COALESCE(pi.phone_id, pi.accessory_id) AS item_id,
                pi.quantity, pi.unit_cost,
                COALESCE(p.brand || ' ' || p.model, a.brand || ' ' || a.product_name) AS product_name
         FROM purchase_items pi
         LEFT JOIN phones p ON p.id = pi.phone_id
         LEFT JOIN accessories a ON a.id = pi.accessory_id
         WHERE pi.purchase_id IN ({placeholders}) ORDER BY pi.id"
    );
    let mut stmt = conn.prepare(&sql)?;
    let params = rusqlite::params_from_iter(ids.iter());
    let rows = stmt.query_map(params, item_from_r)?;
    for r in rows {
        let item = r?;
        map.entry(item.purchase_id).or_default().push(item);
    }
    Ok(map)
}

pub fn list_purchases(conn: &Connection, search: Option<&str>) -> Result<Vec<Purchase>, AppError> {
    let mut sql = format!("SELECT {PURCHASE_COLS} {PURCHASE_JOIN}");
    let mut q: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(s) = search {
        let s = s.trim();
        if !s.is_empty() {
            let s = format!("%{s}%");
            sql.push_str(" WHERE p.purchase_no LIKE ? OR COALESCE(s.name,'') LIKE ?");
            let val = rusqlite::types::Value::from(s);
            q.push(val.clone());
            q.push(val);
        }
    }
    sql.push_str(" ORDER BY p.created_at DESC, p.id DESC LIMIT 500");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), purchase_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    let ids: Vec<i64> = out.iter().map(|p| p.id).collect();
    let items = list_items_for_purchases(conn, ids)?;
    for p in out.iter_mut() {
        p.items = items.get(&p.id).cloned().unwrap_or_default();
    }
    Ok(out)
}

fn round2(n: f64) -> f64 {
    (n * 100.0).round() / 100.0
}

// ----- Supplier balance / dues -----

pub fn supplier_balance(conn: &Connection, supplier_id: i64) -> Result<SupplierBalance, AppError> {
    let row: (Option<String>, Option<String>, Option<f64>, Option<f64>, Option<i64>) = conn
        .query_row(
            "SELECT s.name, s.phone,
                (SELECT COALESCE(SUM(total_amount),0) FROM purchases WHERE supplier_id = ?1),
                ((SELECT COALESCE(SUM(paid_amount),0) FROM purchases WHERE supplier_id = ?1)
                 + (SELECT COALESCE(SUM(amount),0) FROM supplier_payments WHERE supplier_id = ?1 AND is_deleted = 0 AND status = 'completed')),
                (SELECT COUNT(*) FROM supplier_payments WHERE supplier_id = ?1 AND is_deleted = 0 AND status = 'completed')
             FROM suppliers s WHERE s.id = ?1 AND s.is_deleted = 0",
            [supplier_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .optional()?
        .ok_or_else(|| AppError::validation("Supplier not found"))?;

    let (name, phone, purchases, paid, count) = row;
    let total_purchases = purchases.unwrap_or(0.0);
    let total_paid = paid.unwrap_or(0.0);
    Ok(SupplierBalance {
        supplier_id,
        supplier_name: name.unwrap_or_default(),
        phone,
        total_purchases,
        total_paid,
        balance: round2(total_purchases - total_paid),
        payment_count: count.unwrap_or(0),
    })
}

fn balance_from_row(r: &Row) -> rusqlite::Result<SupplierBalance> {
    let total_purchases: f64 = r.get("total_purchases")?;
    let total_paid: f64 = r.get("total_paid")?;
    Ok(SupplierBalance {
        supplier_id: r.get("supplier_id")?,
        supplier_name: r.get("supplier_name")?,
        phone: r.get("phone")?,
        total_purchases,
        total_paid,
        balance: round2(total_purchases - total_paid),
        payment_count: r.get("payment_count")?,
    })
}

pub fn list_supplier_balances(
    conn: &Connection,
    search: Option<&str>,
) -> Result<Vec<SupplierBalance>, AppError> {
    let has_search = search.map(|s| !s.trim().is_empty()).unwrap_or(false);
    let mut sql = String::from(
        "SELECT s.id AS supplier_id, s.name AS supplier_name, s.phone AS phone,
                COALESCE((SELECT SUM(pg.total_amount) FROM purchases pg WHERE pg.supplier_id = s.id), 0) AS total_purchases,
                (COALESCE((SELECT SUM(pg.paid_amount) FROM purchases pg WHERE pg.supplier_id = s.id), 0)
                 + COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id AND sp.is_deleted = 0 AND sp.status = 'completed'), 0)) AS total_paid,
                (SELECT COUNT(*) FROM supplier_payments sp WHERE sp.supplier_id = s.id AND sp.is_deleted = 0 AND sp.status = 'completed') AS payment_count
         FROM suppliers s
         WHERE s.is_deleted = 0",
    );
    let mut q: Vec<rusqlite::types::Value> = Vec::new();
    if has_search {
        let s = format!("%{}%", search.unwrap_or("").trim());
        sql.push_str(" AND (s.name LIKE ? OR COALESCE(s.phone,'') LIKE ?)");
        let val = rusqlite::types::Value::from(s);
        q.push(val.clone());
        q.push(val);
    }
    sql.push_str(" ORDER BY s.name");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), balance_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn list_supplier_dues(
    conn: &Connection,
    search: Option<&str>,
) -> Result<Vec<SupplierBalance>, AppError> {
    let all = list_supplier_balances(conn, search)?;
    Ok(all.into_iter().filter(|b| b.balance > 0.001).collect())
}

// ----- Supplier payments -----

fn sp_from_row(r: &Row) -> rusqlite::Result<SupplierPayment> {
    Ok(SupplierPayment {
        id: r.get("id")?,
        supplier_id: r.get("supplier_id")?,
        supplier_name: r.get("supplier_name")?,
        amount: r.get("amount")?,
        payment_method: r.get("payment_method")?,
        status: r.get("status")?,
        reference: r.get("reference")?,
        notes: r.get("notes")?,
        payment_date: r.get("payment_date")?,
        created_by: r.get("created_by")?,
        created_at: r.get("created_at")?,
        is_deleted: r.get::<_, i64>("is_deleted")? != 0,
    })
}

const SP_COLS: &str = "sp.id, sp.supplier_id, s.name AS supplier_name, sp.amount, sp.payment_method, \
     sp.status, sp.reference, sp.notes, sp.payment_date, sp.created_by, sp.created_at, sp.is_deleted";

const SP_JOIN: &str =
    "FROM supplier_payments sp LEFT JOIN suppliers s ON s.id = sp.supplier_id WHERE sp.is_deleted = 0";

pub fn insert_supplier_payment(
    conn: &Connection,
    input: &crate::models::purchase::CreateSupplierPaymentInput,
    created_by: Option<i64>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO supplier_payments (supplier_id, amount, payment_method, status, reference, notes, payment_date, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE(?7, CURRENT_TIMESTAMP), ?8)",
        params![
            input.supplier_id,
            input.amount,
            input.payment_method,
            input.status,
            input.reference,
            input.notes,
            input.payment_date,
            created_by,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_supplier_payment(conn: &Connection, id: i64) -> Result<Option<SupplierPayment>, AppError> {
    let sql = format!("SELECT {SP_COLS} {SP_JOIN} AND sp.id = ?1 LIMIT 1");
    let row = conn.query_row(&sql, [id], sp_from_row).optional()?;
    Ok(row)
}

pub fn list_supplier_payments(
    conn: &Connection,
    search: Option<&str>,
) -> Result<Vec<SupplierPayment>, AppError> {
    let mut sql = format!("SELECT {SP_COLS} {SP_JOIN}");
    let mut q: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(s) = search {
        let s = s.trim();
        if !s.is_empty() {
            let s = format!("%{s}%");
            sql.push_str(" AND (s.name LIKE ? OR sp.payment_method LIKE ? OR COALESCE(sp.reference,'') LIKE ?)");
            let val = rusqlite::types::Value::from(s);
            q.push(val.clone());
            q.push(val.clone());
            q.push(val);
        }
    }
    sql.push_str(" ORDER BY sp.payment_date DESC, sp.id DESC LIMIT 500");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), sp_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn list_supplier_payments_by_supplier(
    conn: &Connection,
    supplier_id: i64,
) -> Result<Vec<SupplierPayment>, AppError> {
    let sql = format!("SELECT {SP_COLS} {SP_JOIN} AND sp.supplier_id = ?1 ORDER BY sp.payment_date DESC, sp.id DESC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([supplier_id], sp_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn soft_delete_supplier_payment(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE supplier_payments SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND is_deleted = 0",
        [id],
    )?;
    Ok(affected > 0)
}
