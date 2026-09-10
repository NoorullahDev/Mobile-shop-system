use rusqlite::{params, Connection, OptionalExtension};

use crate::errors::AppError;
use crate::models::accessory::{Accessory, CreateAccessoryInput};

fn from_row(r: &rusqlite::Row) -> rusqlite::Result<Accessory> {
    Ok(Accessory {
        id: r.get("id")?,
        accessory_type: r.get("accessory_type")?,
        brand: r.get("brand")?,
        product_name: r.get("product_name")?,
        compatible_models: r.get("compatible_models")?,
        color: r.get("color")?,
        condition: r.get("condition")?,
        connector_type: r.get("connector_type")?,
        warranty: r.get("warranty")?,
        features: r.get("features")?,
        description: r.get("description")?,
        sku: r.get("sku")?,
        serial_number: r.get("serial_number")?,
        image_paths: serde_json::from_str(&r.get::<_, String>("image_paths")?).unwrap_or_default(),
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

const COLS: &str = "a.id, a.accessory_type, a.brand, a.product_name, a.compatible_models, a.color, \
     a.condition, a.connector_type, a.warranty, a.features, a.description, a.sku, a.serial_number, a.image_paths, \
     a.cost_price, a.sale_price, a.quantity, a.supplier_id, s.name AS supplier_name, \
     a.low_stock_threshold, a.is_deleted, a.created_at, a.updated_at";

pub fn insert(conn: &Connection, input: &CreateAccessoryInput) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO accessories (accessory_type, brand, product_name, compatible_models, color, \
         condition, connector_type, warranty, features, description, sku, serial_number, image_paths, \
         cost_price, sale_price, quantity, supplier_id, low_stock_threshold) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
        params![
            input.accessory_type, input.brand, input.product_name, input.compatible_models,
            input.color, input.condition, input.connector_type, input.warranty,
            input.features, input.description, input.sku, input.serial_number, serde_json::to_string(&input.image_paths).unwrap_or_else(|_| "[]".into()),
            input.cost_price, input.sale_price, input.quantity, input.supplier_id,
            input.low_stock_threshold
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<Accessory>, AppError> {
    let sql = format!(
        "SELECT {COLS} FROM accessories a LEFT JOIN suppliers s ON s.id = a.supplier_id \
         WHERE a.id = ?1 AND a.is_deleted = 0"
    );
    let row = conn.query_row(&sql, [id], from_row).optional()?;
    Ok(row)
}

pub fn list(conn: &Connection, search: Option<&str>) -> Result<Vec<Accessory>, AppError> {
    let base = format!(
        "SELECT {COLS} FROM accessories a LEFT JOIN suppliers s ON s.id = a.supplier_id \
         WHERE a.is_deleted = 0"
    );
    let mut clauses: Vec<String> = Vec::new();
    let mut values: Vec<String> = Vec::new();
    if let Some(s) = search {
        let s = s.trim();
        if !s.is_empty() {
            let p = format!("%{s}%");
            clauses.push(format!(
                "(a.brand LIKE ?{0} OR a.product_name LIKE ?{0} OR a.accessory_type LIKE ?{0} OR a.compatible_models LIKE ?{0} OR a.sku LIKE ?{0} OR a.serial_number LIKE ?{0})",
                values.len() + 1,
            ));
            values.push(p);
        }
    }
    let sql = if clauses.is_empty() {
        format!("{base} ORDER BY a.brand, a.product_name LIMIT 1000")
    } else {
        format!(
            "{base} AND {} ORDER BY a.brand, a.product_name LIMIT 1000",
            clauses.join(" AND ")
        )
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        rusqlite::params_from_iter(values.iter().map(|v| v.as_str())),
        from_row,
    )?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(conn: &Connection, id: i64, input: &CreateAccessoryInput) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE accessories SET accessory_type=?1, brand=?2, product_name=?3, compatible_models=?4, color=?5, \
         condition=?6, connector_type=?7, warranty=?8, features=?9, description=?10, sku=?11, serial_number=?12, image_paths=?13, \
         cost_price=?14, sale_price=?15, supplier_id=?16, low_stock_threshold=?17, updated_at=CURRENT_TIMESTAMP \
         WHERE id=?18 AND is_deleted=0",
        params![
            input.accessory_type, input.brand, input.product_name, input.compatible_models,
            input.color, input.condition, input.connector_type, input.warranty,
            input.features, input.description, input.sku, input.serial_number, serde_json::to_string(&input.image_paths).unwrap_or_else(|_| "[]".into()),
            input.cost_price, input.sale_price, input.supplier_id,
            input.low_stock_threshold, id
        ],
    )?;
    Ok(affected > 0)
}

pub fn serial_taken(
    conn: &Connection,
    serial: &str,
    exclude_id: Option<i64>,
) -> Result<bool, AppError> {
    let sql = if exclude_id.is_some() {
        "SELECT 1 FROM accessories WHERE serial_number=?1 AND id!=?2 AND is_deleted=0"
    } else {
        "SELECT 1 FROM accessories WHERE serial_number=?1 AND is_deleted=0"
    };
    let found = if let Some(id) = exclude_id {
        conn.query_row(sql, params![serial, id], |_| Ok(true))
            .optional()?
    } else {
        conn.query_row(sql, [serial], |_| Ok(true)).optional()?
    };
    Ok(found.is_some())
}

pub fn soft_delete(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE accessories SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND is_deleted = 0",
        [id],
    )?;
    Ok(affected > 0)
}

pub fn add_quantity(conn: &Connection, id: i64, amount: i64) -> Result<(), AppError> {
    conn.execute(
        "UPDATE accessories SET quantity = quantity + ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2 AND is_deleted = 0",
        params![amount, id],
    )?;
    Ok(())
}
