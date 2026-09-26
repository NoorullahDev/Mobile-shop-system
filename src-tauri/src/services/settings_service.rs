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
    fn branding_settings_persist_across_full_restart() {
        let dir = std::env::temp_dir().join(format!("bms-settings-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("test.db");
        let _ = std::fs::remove_file(&path);

        {
            let conn = rusqlite::Connection::open(&path).unwrap();
            crate::database::migrations::run(&conn).unwrap();
            update_setting(&conn, Some(1), "business_name", "EagleNest Mobiles").unwrap();
            update_setting(&conn, Some(1), "shop_logo", "data:image/png;base64,AAAA").unwrap();
        }

        // Simulate a full app restart: a fresh connection to the same file,
        // with migrations and the default-seed re-run as on startup.
        let conn = rusqlite::Connection::open(&path).unwrap();
        crate::database::migrations::run(&conn).unwrap();
        crate::database::seed::seed(&conn).unwrap();

        let settings = get_all(&conn).unwrap();
        let map: std::collections::HashMap<String, String> = settings
            .into_iter()
            .map(|s| (s.key, s.value.unwrap_or_default()))
            .collect();
        assert_eq!(map.get("business_name").map(String::as_str), Some("EagleNest Mobiles"));
        assert_eq!(
            map.get("shop_logo").map(String::as_str),
            Some("data:image/png;base64,AAAA")
        );
        std::fs::remove_dir_all(&dir).ok();
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
    fn blank_key_rejected_empty_value_allowed() {
        let conn = in_memory_conn();
        assert!(update_setting(&conn, Some(1), "", "USD").is_err());
        update_setting(&conn, Some(1), "phone", "").unwrap();
        let all = get_all(&conn).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].key, "phone");
        assert_eq!(all[0].value.as_deref(), Some(""));
    }
}
