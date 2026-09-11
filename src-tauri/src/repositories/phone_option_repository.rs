use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::errors::AppError;
use crate::models::phone::{CreatePhoneOptionInput, PhoneOption};

fn from_row(r: &Row) -> rusqlite::Result<PhoneOption> {
    Ok(PhoneOption {
        id: r.get("id")?,
        option_type: r.get("option_type")?,
        value: r.get("value")?,
        sort_order: r.get("sort_order")?,
        is_active: r.get::<_, i64>("is_active")? != 0,
        created_at: r.get("created_at")?,
    })
}

const SELECT_COLS: &str = "id, option_type, value, sort_order, is_active, created_at";

pub fn insert(conn: &Connection, input: &CreatePhoneOptionInput) -> Result<i64, AppError> {
    let sort = input.sort_order.unwrap_or(0);
    let active = if input.is_active.unwrap_or(true) {
        1
    } else {
        0
    };
    match conn.execute(
        "INSERT INTO phone_options (option_type, value, sort_order, is_active) VALUES (?1, ?2, ?3, ?4)",
        params![input.option_type.trim(), input.value.trim(), sort, active],
    ) {
        Ok(_) => Ok(conn.last_insert_rowid()),
        Err(e) => Err(AppError::from(e).map_unique(&format!("option '{}'", input.value))),
    }
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<PhoneOption>, AppError> {
    let row = conn
        .query_row(
            &format!("SELECT {SELECT_COLS} FROM phone_options WHERE id = ?1"),
            [id],
            from_row,
        )
        .optional()?;
    Ok(row)
}

pub fn list_by_type(conn: &Connection, option_type: &str) -> Result<Vec<PhoneOption>, AppError> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {SELECT_COLS} FROM phone_options WHERE option_type = ?1 ORDER BY sort_order, value"
    ))?;
    let rows = stmt.query_map([option_type], from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn list_all(conn: &Connection) -> Result<Vec<PhoneOption>, AppError> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {SELECT_COLS} FROM phone_options ORDER BY option_type, sort_order, value"
    ))?;
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
    input: &CreatePhoneOptionInput,
) -> Result<bool, AppError> {
    let sort = input.sort_order.unwrap_or(0);
    match conn.execute(
        "UPDATE phone_options SET option_type = ?1, value = ?2, sort_order = ?3 WHERE id = ?4",
        params![input.option_type.trim(), input.value.trim(), sort, id],
    ) {
        Ok(affected) => Ok(affected > 0),
        Err(e) => Err(AppError::from(e).map_unique(&format!("option '{}'", input.value))),
    }
}

pub fn set_active(conn: &Connection, id: i64, is_active: bool) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE phone_options SET is_active = ?1 WHERE id = ?2",
        params![if is_active { 1 } else { 0 }, id],
    )?;
    Ok(affected > 0)
}

pub fn delete(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute("DELETE FROM phone_options WHERE id = ?1", [id])?;
    Ok(affected > 0)
}
