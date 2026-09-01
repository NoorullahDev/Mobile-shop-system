use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::errors::AppError;
use crate::models::product_category::{CreateProductCategoryInput, ProductCategory};

fn from_row(r: &Row) -> rusqlite::Result<ProductCategory> {
    Ok(ProductCategory {
        id: r.get("id")?,
        name: r.get("name")?,
        created_at: r.get("created_at")?,
    })
}

fn map_unique(e: AppError, name: &str) -> AppError {
    if matches!(&e, AppError::Database(rusqlite::Error::SqliteFailure(f, _)) if f.code == rusqlite::ErrorCode::ConstraintViolation)
    {
        AppError::validation(format!("A category named '{name}' already exists"))
    } else {
        e
    }
}

pub fn insert(conn: &Connection, input: &CreateProductCategoryInput) -> Result<i64, AppError> {
    match conn.execute(
        "INSERT INTO product_categories (name) VALUES (?1)",
        [input.name.trim()],
    ) {
        Ok(_) => Ok(conn.last_insert_rowid()),
        Err(e) => Err(map_unique(AppError::from(e), &input.name)),
    }
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<ProductCategory>, AppError> {
    let row = conn
        .query_row(
            "SELECT id, name, created_at FROM product_categories WHERE id = ?1",
            [id],
            from_row,
        )
        .optional()?;
    Ok(row)
}

pub fn get_by_name(conn: &Connection, name: &str) -> Result<Option<ProductCategory>, AppError> {
    let row = conn
        .query_row(
            "SELECT id, name, created_at FROM product_categories WHERE name = ?1",
            [name],
            from_row,
        )
        .optional()?;
    Ok(row)
}

pub fn list(conn: &Connection) -> Result<Vec<ProductCategory>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, created_at FROM product_categories ORDER BY name",
    )?;
    let rows = stmt.query_map([], from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(conn: &Connection, id: i64, input: &CreateProductCategoryInput) -> Result<bool, AppError> {
    match conn.execute(
        "UPDATE product_categories SET name = ?1 WHERE id = ?2",
        params![input.name.trim(), id],
    ) {
        Ok(affected) => Ok(affected > 0),
        Err(e) => Err(map_unique(AppError::from(e), &input.name)),
    }
}

pub fn delete(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute("DELETE FROM product_categories WHERE id = ?1", [id])?;
    Ok(affected > 0)
}

/// True if any non-deleted accessory or phone references this category name.
pub fn in_use(conn: &Connection, name: &str) -> Result<bool, AppError> {
    let accessory: Option<bool> = conn
        .query_row(
            "SELECT 1 FROM accessories WHERE accessory_type = ?1 AND is_deleted = 0 LIMIT 1",
            [name],
            |_| Ok(true),
        )
        .optional()?;
    if accessory.is_some() {
        return Ok(true);
    }
    let phone: Option<bool> = conn
        .query_row(
            "SELECT 1 FROM phones WHERE category = ?1 AND is_deleted = 0 LIMIT 1",
            [name],
            |_| Ok(true),
        )
        .optional()?;
    Ok(phone.is_some())
}