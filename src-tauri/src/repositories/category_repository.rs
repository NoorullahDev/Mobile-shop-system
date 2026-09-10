use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::errors::AppError;
use crate::models::expense::{Category, CreateCategoryInput};

fn from_row(r: &Row) -> rusqlite::Result<Category> {
    Ok(Category {
        id: r.get("id")?,
        name: r.get("name")?,
        category_type: r.get("category_type")?,
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

pub fn insert(conn: &Connection, input: &CreateCategoryInput) -> Result<i64, AppError> {
    match conn.execute(
        "INSERT INTO categories (name, type) VALUES (?1, ?2)",
        params![
            input.name,
            input.category_type.as_deref().unwrap_or("expense")
        ],
    ) {
        Ok(_) => Ok(conn.last_insert_rowid()),
        Err(e) => Err(map_unique(AppError::from(e), &input.name)),
    }
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<Category>, AppError> {
    let row = conn
        .query_row(
            "SELECT id, name, type AS category_type FROM categories WHERE id = ?1",
            [id],
            from_row,
        )
        .optional()?;
    Ok(row)
}

pub fn list(conn: &Connection) -> Result<Vec<Category>, AppError> {
    let mut stmt =
        conn.prepare("SELECT id, name, type AS category_type FROM categories ORDER BY name")?;
    let rows = stmt.query_map([], from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(conn: &Connection, id: i64, input: &CreateCategoryInput) -> Result<bool, AppError> {
    match conn.execute(
        "UPDATE categories SET name = ?1, type = ?2 WHERE id = ?3",
        params![
            input.name,
            input.category_type.as_deref().unwrap_or("expense"),
            id
        ],
    ) {
        Ok(affected) => Ok(affected > 0),
        Err(e) => Err(map_unique(AppError::from(e), &input.name)),
    }
}

pub fn delete(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute("DELETE FROM categories WHERE id = ?1", [id])?;
    Ok(affected > 0)
}

/// True if any non-deleted expense references this category.
pub fn category_in_use(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let exists: Option<bool> = conn
        .query_row(
            "SELECT 1 FROM expenses WHERE category_id = ?1 AND is_deleted = 0 LIMIT 1",
            [id],
            |_| Ok(true),
        )
        .optional()?;
    Ok(exists.is_some())
}
