pub mod migrations;
pub mod seed;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;

pub struct Database {
    pub conn: Mutex<Connection>,
    pub backups_dir: PathBuf,
}

impl Database {
    pub fn open(app_data_dir: &Path) -> Result<Self, rusqlite::Error> {
        fs::create_dir_all(app_data_dir).map_err(|e| {
            rusqlite::Error::InvalidParameterName(e.to_string())
        })?;

        let backups_dir = app_data_dir.join("backups");
        fs::create_dir_all(&backups_dir).map_err(|e| {
            rusqlite::Error::InvalidParameterName(e.to_string())
        })?;

        let db_path = app_data_dir.join("business_management.db");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch(
            "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
        )?;
        Ok(Database {
            conn: Mutex::new(conn),
            backups_dir,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mem_conn() -> Connection {
        Connection::open_in_memory().expect("in-memory db")
    }

    #[test]
    fn migrations_and_seed_create_expected_data() {
        let conn = mem_conn();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

        migrations::run(&conn).expect("migrations run");
        seed::seed(&conn).expect("seed runs");

        // schema_migrations tracked
        let applied: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
            .unwrap();
        assert!(applied >= 1);

        // roles seeded
        let role_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM roles", [], |r| r.get(0))
            .unwrap();
        assert!(role_count >= 3);

        // default admin user seeded with a non-plaintext hash
        let (uname, hash): (String, String) = conn
            .query_row(
                "SELECT username, password_hash FROM users WHERE username = 'admin'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .expect("admin exists");
        assert_eq!(uname, "admin");
        assert_ne!(hash, "admin123");
        assert!(crate::security::verify_password("admin123", &hash).unwrap());

        // key tables created
        for table in [
            "users",
            "roles",
            "permissions",
            "role_permissions",
            "members",
            "payments",
            "expenses",
            "categories",
            "product_categories",
            "report_templates",
            "settings",
            "activity_logs",
            "suppliers",
            "phones",
            "accessories",
            "phone_imeis",
            "sales",
            "sale_items",
            "purchases",
            "purchase_items",
            "backups",
        ] {
            let exists: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
                    [table],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(exists, 1, "expected table {table} to exist");
        }

        // seed is idempotent
        seed::seed(&conn).expect("seed runs again");
        let admin_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM users WHERE username='admin'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(admin_count, 1);
    }

    #[test]
    fn soft_delete_hides_but_keeps_member() {
        let conn = mem_conn();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migrations::run(&conn).unwrap();
        seed::seed(&conn).unwrap();

        conn.execute(
            "INSERT INTO members (name, phone) VALUES ('Hidden', '0300')",
            [],
        )
        .unwrap();
        let id: i64 = conn.last_insert_rowid();

        let visible_before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM members WHERE is_deleted = 0 AND id = ?1",
                [id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(visible_before, 1);

        conn.execute(
            "UPDATE members SET is_deleted = 1 WHERE id = ?1",
            [id],
        )
        .unwrap();

        let visible_after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM members WHERE id = ?1 AND is_deleted = 0",
                [id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(visible_after, 0, "hidden from normal view");

        let still_there: i64 = conn
            .query_row("SELECT COUNT(*) FROM members WHERE id = ?1", [id], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(still_there, 1, "record retained for audit");
    }
}
