use rusqlite::{params, Connection, OptionalExtension};

use crate::errors::AppError;
use crate::models::phone::{AddPhoneImeiInput, CreatePhoneInput, Phone, PhoneImei};

fn phone_from_row(r: &rusqlite::Row) -> rusqlite::Result<Phone> {
    Ok(Phone {
        id: r.get("id")?,
        brand: r.get("brand")?,
        model: r.get("model")?,
        color: r.get("color")?,
        storage: r.get("storage")?,
        ram: r.get("ram")?,
        processor: r.get("processor")?,
        chipset: r.get("chipset")?,
        network_type: r.get("network_type")?,
        battery_capacity: r.get("battery_capacity")?,
        imei: r.get("imei")?,
        category: r.get("category")?,
        cost_price: r.get("cost_price")?,
        sale_price: r.get("sale_price")?,
        quantity: r.get("quantity")?,
        supplier_id: r.get("supplier_id")?,
        supplier_name: r.get::<_, Option<String>>("supplier_name")?,
        low_stock_threshold: r.get("low_stock_threshold")?,
        is_deleted: r.get::<_, i64>("is_deleted")? != 0,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
    })
}

fn imei_from_row(r: &rusqlite::Row) -> rusqlite::Result<PhoneImei> {
    Ok(PhoneImei {
        id: r.get("id")?,
        phone_id: r.get("phone_id")?,
        imei: r.get("imei")?,
        status: r.get("status")?,
        sold_at: r.get("sold_at")?,
        created_at: r.get("created_at")?,
    })
}

const COLS: &str = "p.id, p.brand, p.model, p.color, p.storage, p.ram, p.processor, \
     p.chipset, p.network_type, p.battery_capacity, p.imei, p.category, p.cost_price, p.sale_price, \
     p.quantity, p.supplier_id, s.name AS supplier_name, p.low_stock_threshold, p.is_deleted, \
     p.created_at, p.updated_at";

pub fn insert(conn: &Connection, input: &CreatePhoneInput) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO phones (brand, model, color, storage, ram, processor, chipset, network_type, battery_capacity, imei, category, cost_price, sale_price, quantity, supplier_id, low_stock_threshold)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            input.brand, input.model, input.color, input.storage, input.ram, input.processor,
            input.chipset, input.network_type, input.battery_capacity, input.imei, input.category,
            input.cost_price, input.sale_price, input.quantity, input.supplier_id,
            input.low_stock_threshold
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<Phone>, AppError> {
    let sql = format!(
        "SELECT {COLS} FROM phones p LEFT JOIN suppliers s ON s.id = p.supplier_id \
         WHERE p.id = ?1 AND p.is_deleted = 0"
    );
    let row = conn.query_row(&sql, [id], phone_from_row).optional()?;
    Ok(row)
}

pub fn list(
    conn: &Connection,
    search: Option<&str>,
) -> Result<Vec<Phone>, AppError> {
    let base = format!(
        "SELECT {COLS} FROM phones p LEFT JOIN suppliers s ON s.id = p.supplier_id \
         WHERE p.is_deleted = 0"
    );
    let mut clauses: Vec<String> = Vec::new();
    let mut values: Vec<String> = Vec::new();
    if let Some(s) = search {
        let s = s.trim();
        if !s.is_empty() {
            let p = format!("%{s}%");
            clauses.push(format!(
                "(p.brand LIKE ?{} OR p.model LIKE ?{} OR p.color LIKE ?{} OR p.storage LIKE ?{} OR p.imei LIKE ?{})",
                values.len() + 1,
                values.len() + 1,
                values.len() + 1,
                values.len() + 1,
                values.len() + 1
            ));
            values.push(p);
        }
    }
    let sql = if clauses.is_empty() {
        format!("{base} ORDER BY p.brand, p.model LIMIT 1000")
    } else {
        format!("{base} AND {} ORDER BY p.brand, p.model LIMIT 1000", clauses.join(" AND "))
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        rusqlite::params_from_iter(values.iter().map(|v| v.as_str())),
        phone_from_row,
    )?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(
    conn: &Connection,
    id: i64,
    input: &CreatePhoneInput,
) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE phones SET brand=?1, model=?2, color=?3, storage=?4, ram=?5, processor=?6, chipset=?7, network_type=?8, battery_capacity=?9, imei=?10, category=?11,
         cost_price=?12, sale_price=?13, supplier_id=?14, low_stock_threshold=?15, updated_at=CURRENT_TIMESTAMP
         WHERE id=?16 AND is_deleted=0",
        params![
            input.brand, input.model, input.color, input.storage, input.ram, input.processor,
            input.chipset, input.network_type, input.battery_capacity, input.imei, input.category,
            input.cost_price, input.sale_price, input.supplier_id, input.low_stock_threshold, id
        ],
    )?;
    Ok(affected > 0)
}

pub fn imei_taken(conn: &Connection, imei: &str, exclude_id: Option<i64>) -> Result<bool, AppError> {
    let exists: Option<bool> = match exclude_id {
        Some(id) => conn
            .query_row(
                "SELECT 1 FROM phones WHERE imei = ?1 AND id != ?2 AND is_deleted = 0",
                params![imei, id],
                |_| Ok(true),
            )
            .optional()?,
        None => conn
            .query_row(
                "SELECT 1 FROM phones WHERE imei = ?1 AND is_deleted = 0",
                [imei],
                |_| Ok(true),
            )
            .optional()?,
    };
    Ok(exists.is_some())
}

pub fn soft_delete(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE phones SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND is_deleted = 0",
        [id],
    )?;
    Ok(affected > 0)
}

pub fn add_quantity(conn: &Connection, id: i64, amount: i64) -> Result<(), AppError> {
    conn.execute(
        "UPDATE phones SET quantity = quantity + ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2 AND is_deleted = 0",
        params![amount, id],
    )?;
    Ok(())
}

// ---- Phone IMEI ----

pub fn imei_exists(conn: &Connection, imei: &str) -> Result<bool, AppError> {
    let exists: Option<bool> = conn
        .query_row("SELECT 1 FROM phone_imeis WHERE imei = ?1", [imei], |_| {
            Ok(true)
        })
        .optional()?;
    Ok(exists.is_some())
}

pub fn insert_imei(conn: &Connection, input: &AddPhoneImeiInput) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO phone_imeis (phone_id, imei) VALUES (?1, ?2)",
        params![input.phone_id, input.imei],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn list_imei(conn: &Connection, phone_id: i64) -> Result<Vec<PhoneImei>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, phone_id, imei, status, sold_at, created_at
         FROM phone_imeis WHERE phone_id = ?1 ORDER BY id",
    )?;
    let rows = stmt.query_map([phone_id], imei_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}
