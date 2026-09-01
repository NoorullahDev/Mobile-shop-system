use rusqlite::{Connection, OptionalExtension};

use crate::errors::AppError;
use crate::repositories::settings_repository;

const KEY_LICENSE_KEY: &str = "license_key";
const KEY_LICENSE_CUSTOMER: &str = "license_customer";
const KEY_LICENSE_GRANTED_DAYS: &str = "license_granted_days";
const KEY_LICENSE_ACTIVATED_AT: &str = "license_activated_at";

/// License persistence lives in the `settings` table — no extra migration needed.
pub struct StoredLicense {
    pub key: String,
    pub customer: String,
    pub granted_days: i64,
    pub activated_at: String,
}

pub fn get(conn: &Connection) -> Result<Option<StoredLicense>, AppError> {
    let key = match settings_repository::get(conn, KEY_LICENSE_KEY)? {
        Some(k) => k,
        None => return Ok(None),
    };
    let customer = settings_repository::get(conn, KEY_LICENSE_CUSTOMER)?
        .unwrap_or_default();
    let granted_days = settings_repository::get(conn, KEY_LICENSE_GRANTED_DAYS)?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);
    let activated_at = settings_repository::get(conn, KEY_LICENSE_ACTIVATED_AT)?
        .unwrap_or_default();
    Ok(Some(StoredLicense {
        key,
        customer,
        granted_days,
        activated_at,
    }))
}

pub fn save(
    conn: &Connection,
    key: &str,
    customer: &str,
    granted_days: i64,
    activated_at: &str,
) -> Result<(), AppError> {
    settings_repository::set(conn, KEY_LICENSE_KEY, key)?;
    settings_repository::set(conn, KEY_LICENSE_CUSTOMER, customer)?;
    settings_repository::set(conn, KEY_LICENSE_GRANTED_DAYS, &granted_days.to_string())?;
    settings_repository::set(conn, KEY_LICENSE_ACTIVATED_AT, activated_at)?;
    Ok(())
}

pub fn clear(conn: &Connection) -> Result<(), AppError> {
    conn.execute("DELETE FROM settings WHERE key IN (?1, ?2, ?3, ?4)", [
        KEY_LICENSE_KEY,
        KEY_LICENSE_CUSTOMER,
        KEY_LICENSE_GRANTED_DAYS,
        KEY_LICENSE_ACTIVATED_AT,
    ])?;
    Ok(())
}

/// Whether a license has ever been activated.
pub fn exists(conn: &Connection) -> Result<bool, AppError> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM settings WHERE key = ?1",
            [KEY_LICENSE_KEY],
            |r| r.get(0),
        )
        .optional()?
        .unwrap_or(0);
    Ok(count > 0)
}