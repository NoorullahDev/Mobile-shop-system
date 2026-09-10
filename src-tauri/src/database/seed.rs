use rusqlite::{Connection, OptionalExtension};

use crate::security::hash_password;

pub fn seed(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    let mut missing_roles: Vec<String> = vec![];
    for role in ["Admin", "Staff", "Accountant"] {
        let exists: Option<bool> = conn
            .query_row("SELECT 1 FROM roles WHERE name = ?1", [role], |_| Ok(true))
            .optional()?;
        if exists.is_none() {
            missing_roles.push(role.to_string());
        }
    }

    for role in missing_roles {
        conn.execute(
            "INSERT INTO roles (name, description) VALUES (?1, ?2)",
            (&role, None::<String>),
        )?;
        log::info!("Seeded role: {}", role);
    }

    const DEFAULT_PERMISSIONS: &[&str] = &[
        "dashboard:view",
        "members:view",
        "members:create",
        "members:update",
        "members:delete",
        "inventory:view",
        "inventory:create",
        "inventory:update",
        "inventory:delete",
        "sales:view",
        "sales:create",
        "suppliers:view",
        "suppliers:create",
        "suppliers:update",
        "suppliers:delete",
        "payments:view",
        "payments:create",
        "expenses:view",
        "expenses:create",
        "reports:view",
        "settings:view",
        "settings:update",
        "users:manage",
    ];

    for perm in DEFAULT_PERMISSIONS {
        conn.execute(
            "INSERT OR IGNORE INTO permissions (name) VALUES (?1)",
            [perm],
        )?;
    }

    // Grant every permission to the Admin role.
    conn.execute(
        "INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'Admin'",
        [],
    )?;

    let admin_exists: Option<bool> = conn
        .query_row("SELECT 1 FROM users WHERE username = 'admin'", [], |_| {
            Ok(true)
        })
        .optional()?;

    if admin_exists.is_none() {
        let password_hash = hash_password("admin123")?;
        conn.execute(
            "INSERT INTO users (username, password_hash, role_id, status)
             SELECT 'admin', ?1, id, 'active' FROM roles WHERE name = 'Admin'",
            [password_hash],
        )?;
        log::info!("Seeded default admin user");
    }

    let biz_name: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'business_name'",
            [],
            |r| r.get(0),
        )
        .optional()?;
    if biz_name.is_none() {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('business_name', 'Mobile Shop System')",
            [],
        )?;
    }

    Ok(())
}
