use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::setting::Setting;
use crate::repositories::settings_repository;
use crate::services;

pub fn get_all(conn: &Connection) -> Result<Vec<Setting>, AppError> {
    settings_repository::get_all(conn)
}

pub fn update_setting(
    conn: &Connection,
    user_id: Option<i64>,
    key: &str,
    value: &str,
) -> Result<(), AppError> {
    let key = key.trim();
    let value = value.trim();
    if key.is_empty() {
        return Err(AppError::validation("Setting key cannot be blank"));
    }
    if value.is_empty() {
        return Err(AppError::validation("Setting value cannot be blank"));
    }
    let old = settings_repository::get(conn, key)?;
    settings_repository::set(conn, key, value)?;
    let action = if old.is_some() { "update" } else { "create" };
    services::record_activity(conn, user_id, "settings", action, None)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_utils::in_memory_conn;

    #[test]
    fn get_all_returns_empty_when_none() {
        let conn = in_memory_conn();
        assert!(get_all(&conn).unwrap().is_empty());
    }

    #[test]
    fn update_creates_and_overwrites() {
        let conn = in_memory_conn();
        update_setting(&conn, Some(1), "currency", "USD").unwrap();
        let all = get_all(&conn).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].value.as_deref(), Some("USD"));

        update_setting(&conn, Some(1), "currency", "PKR").unwrap();
        let all = get_all(&conn).unwrap();
        assert_eq!(all.len(), 1, "key overwritten, not duplicated");
        assert_eq!(all[0].value.as_deref(), Some("PKR"));
    }

    #[test]
    fn blank_key_or_value_rejected() {
        let conn = in_memory_conn();
        assert!(update_setting(&conn, Some(1), "", "USD").is_err());
        assert!(update_setting(&conn, Some(1), "currency", "  ").is_err());
        assert!(get_all(&conn).unwrap().is_empty());
    }
}
