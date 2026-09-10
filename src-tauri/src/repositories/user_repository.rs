use rusqlite::{Connection, OptionalExtension};

use crate::errors::AppError;

/// Internal credential-bearing user record. Never serialized to the frontend.
pub struct StoredUser {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub role_id: i64,
    pub status: String,
}

pub fn find_by_username(conn: &Connection, username: &str) -> Result<Option<StoredUser>, AppError> {
    let row = conn
        .query_row(
            "SELECT id, username, password_hash, role_id, status
             FROM users WHERE username = ?1",
            [username],
            |r| {
                Ok(StoredUser {
                    id: r.get(0)?,
                    username: r.get(1)?,
                    password_hash: r.get(2)?,
                    role_id: r.get(3)?,
                    status: r.get(4)?,
                })
            },
        )
        .optional()?;
    Ok(row)
}

pub fn get_password_hash(conn: &Connection, id: i64) -> Result<Option<String>, AppError> {
    let hash: Option<String> = conn
        .query_row(
            "SELECT password_hash FROM users WHERE id = ?1 AND is_deleted = 0",
            [id],
            |r| r.get(0),
        )
        .optional()?;
    Ok(hash)
}

pub fn get_role_name(conn: &Connection, role_id: i64) -> Result<Option<String>, AppError> {
    let name = conn
        .query_row("SELECT name FROM roles WHERE id = ?1", [role_id], |r| {
            r.get(0)
        })
        .optional()?;
    Ok(name)
}

pub fn get_permissions(conn: &Connection, role_id: i64) -> Result<Vec<String>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT p.name
         FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = ?1
         ORDER BY p.name",
    )?;
    let rows = stmt.query_map([role_id], |r| r.get::<_, String>(0))?;
    let mut perms = Vec::new();
    for row in rows {
        perms.push(row?);
    }
    Ok(perms)
}
