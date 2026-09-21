pub mod migrations;
pub mod seed;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;

pub struct Database {
    pub conn: Mutex<Connection>,
    #[allow(dead_code)]
    pub backups_dir: PathBuf,
}

impl Database {
    pub fn open(app_data_dir: &Path) -> Result<Self, rusqlite::Error> {
        fs::create_dir_all(app_data_dir)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;

        let backups_dir = app_data_dir.join("backups");
        fs::create_dir_all(&backups_dir)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;

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

        let (permission_count, admin_permission_count): (i64, i64) = conn
            .query_row(
                "SELECT
                    (SELECT COUNT(*) FROM permissions),
                    (SELECT COUNT(*) FROM role_permissions rp
                     JOIN roles r ON r.id = rp.role_id
                     WHERE lower(r.name) = 'admin')",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(admin_permission_count, permission_count);
        let legacy_inventory_permissions: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM permissions WHERE name LIKE 'inventory:%'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(legacy_inventory_permissions, 0);

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
            "returns",
            "return_items",
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
            .query_row(
                "SELECT COUNT(*) FROM users WHERE username='admin'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(admin_count, 1);
    }

    #[test]
    fn fresh_migration_creates_no_business_data() {
        let conn = mem_conn();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

        migrations::run(&conn).expect("migrations run");
        seed::seed(&conn).expect("seed runs");

        // A clean install must never auto-create business records — no dummy
        // accessories, phones or sales. Only system/reference data (roles,
        // admin user, settings) is allowed.
        for (table, label) in [
            ("accessories", "accessory"),
            ("phones", "phone"),
            ("sales", "sale"),
            ("purchases", "purchase"),
            ("suppliers", "supplier"),
            ("members", "member"),
        ] {
            let count: i64 = conn
                .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
                .unwrap();
            assert_eq!(count, 0, "fresh install must not contain a seeded {label}");
        }
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

        conn.execute("UPDATE members SET is_deleted = 1 WHERE id = ?1", [id])
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

    #[test]
    fn migration_recalculates_existing_linked_due_payments() {
        let conn = mem_conn();
        migrations::run(&conn).unwrap();
        conn.execute("INSERT INTO members (name) VALUES ('Existing Due')", [])
            .unwrap();
        let member_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO sales (receipt_no, member_id, total_amount, paid_amount, payment_method)
             VALUES ('OLD-DUE', ?1, 38000, 20000, 'bank_transfer')",
            [member_id],
        )
        .unwrap();
        let sale_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO sale_payments (sale_id, amount, payment_method) VALUES (?1, 20000, 'bank_transfer')",
            [sale_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO payments (member_id, amount, payment_method, status, sale_id)
             VALUES (?1, 10000, 'cash', 'completed', ?2)",
            rusqlite::params![member_id, sale_id],
        )
        .unwrap();

        // Simulate a database that already had the linked payment but had not
        // yet applied the paid-amount repair migration.
        conn.execute(
            "DELETE FROM schema_migrations WHERE version = '0025_recalculate_sale_paid_amounts'",
            [],
        )
        .unwrap();
        migrations::run(&conn).unwrap();

        let paid: f64 = conn
            .query_row(
                "SELECT paid_amount FROM sales WHERE id = ?1",
                [sale_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(paid, 30000.0);
    }
}
