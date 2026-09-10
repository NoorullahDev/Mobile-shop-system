use rusqlite::{Connection, OptionalExtension};

use crate::errors::AppError;
use crate::models::setting::Setting;

pub fn get_all(conn: &Connection) -> Result<Vec<Setting>, AppError> {
    let mut stmt = conn.prepare("SELECT id, key, value FROM settings ORDER BY key")?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Setting {
                id: r.get(0)?,
                key: r.get(1)?,
                value: r.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn get(conn: &Connection, key: &str) -> Result<Option<String>, AppError> {
    let value = conn
        .query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| {
            r.get::<_, Option<String>>(0)
        })
        .optional()?;
    Ok(value.flatten())
}

pub fn set(conn: &Connection, key: &str, value: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )?;
    Ok(())
}
