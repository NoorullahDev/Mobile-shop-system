use rusqlite::{params, Connection, OptionalExtension};

use crate::errors::AppError;
use crate::models::inventory::{CreateSupplierInput, Supplier};

fn from_row(r: &rusqlite::Row) -> rusqlite::Result<Supplier> {
    Ok(Supplier {
        id: r.get("id")?,
        name: r.get("name")?,
        phone: r.get("phone")?,
        email: r.get("email")?,
        address: r.get("address")?,
        is_deleted: r.get::<_, i64>("is_deleted")? != 0,
        created_at: r.get("created_at")?,
    })
}

pub fn insert(conn: &Connection, input: &CreateSupplierInput) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO suppliers (name, phone, email, address) VALUES (?1, ?2, ?3, ?4)",
        params![input.name, input.phone, input.email, input.address],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<Supplier>, AppError> {
    let row = conn
        .query_row(
            "SELECT id, name, phone, email, address, is_deleted, created_at
             FROM suppliers WHERE id = ?1 AND is_deleted = 0",
            [id],
            from_row,
        )
        .optional()?;
    Ok(row)
}

pub fn list(conn: &Connection) -> Result<Vec<Supplier>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, phone, email, address, is_deleted, created_at
         FROM suppliers WHERE is_deleted = 0 ORDER BY name",
    )?;
    let rows = stmt.query_map([], from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(
    conn: &Connection,
    id: i64,
    input: &CreateSupplierInput,
) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE suppliers SET name = ?1, phone = ?2, email = ?3, address = ?4 WHERE id = ?5 AND is_deleted = 0",
        params![input.name, input.phone, input.email, input.address, id],
    )?;
    Ok(affected > 0)
}

pub fn soft_delete(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE suppliers SET is_deleted = 1 WHERE id = ?1 AND is_deleted = 0",
        [id],
    )?;
    Ok(affected > 0)
}
