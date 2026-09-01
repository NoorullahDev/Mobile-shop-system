use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::errors::AppError;
use crate::models::user::{
    Permission, Role, RoleWithPermissions, UserDetail,
};

fn user_detail_from_row(r: &Row) -> rusqlite::Result<UserDetail> {
    Ok(UserDetail {
        id: r.get("id")?,
        username: r.get("username")?,
        full_name: r.get("full_name")?,
        email: r.get("email")?,
        role_id: r.get("role_id")?,
        role_name: r.get("role_name")?,
        status: r.get("status")?,
        created_at: r.get("created_at")?,
        is_deleted: r.get::<_, i64>("is_deleted")? != 0,
    })
}

// ----- Users -----

pub fn list_users(conn: &Connection, search: Option<&str>) -> Result<Vec<UserDetail>, AppError> {
    let has_search = search.map(|s| !s.trim().is_empty()).unwrap_or(false);
    let mut sql = String::from(
        "SELECT u.id, u.username, u.full_name, u.email, u.role_id, r.name AS role_name,
                u.status, u.created_at, u.is_deleted
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.is_deleted = 0",
    );
    let mut q: Vec<rusqlite::types::Value> = Vec::new();
    if has_search {
        let s = format!("%{}%", search.unwrap_or("").trim());
        sql.push_str(" AND (u.username LIKE ? OR COALESCE(u.full_name,'') LIKE ? OR COALESCE(u.email,'') LIKE ?)");
        let val = rusqlite::types::Value::from(s);
        q.push(val.clone());
        q.push(val.clone());
        q.push(val);
    }
    sql.push_str(" ORDER BY u.id");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), user_detail_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn get_user(conn: &Connection, id: i64) -> Result<Option<UserDetail>, AppError> {
    let row = conn
        .query_row(
            "SELECT u.id, u.username, u.full_name, u.email, u.role_id, r.name AS role_name,
                    u.status, u.created_at, u.is_deleted
             FROM users u JOIN roles r ON r.id = u.role_id
             WHERE u.id = ?1 AND u.is_deleted = 0",
            [id],
            user_detail_from_row,
        )
        .optional()?;
    Ok(row)
}

pub fn username_exists(conn: &Connection, username: &str) -> Result<bool, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE username = ?1 AND is_deleted = 0",
        [username],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

pub fn role_exists(conn: &Connection, role_id: i64) -> Result<bool, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM roles WHERE id = ?1",
        [role_id],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

pub fn insert_user(
    conn: &Connection,
    username: &str,
    password_hash: &str,
    full_name: Option<&str>,
    email: Option<&str>,
    role_id: i64,
    status: &str,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO users (username, password_hash, full_name, email, role_id, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![username, password_hash, full_name, email, role_id, status],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_user_fields(
    conn: &Connection,
    id: i64,
    full_name: Option<&str>,
    email: Option<&str>,
    role_id: i64,
    status: &str,
) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE users SET full_name = ?1, email = ?2, role_id = ?3, status = ?4,
                updated_at = CURRENT_TIMESTAMP
         WHERE id = ?5 AND is_deleted = 0",
        params![full_name, email, role_id, status, id],
    )?;
    Ok(affected > 0)
}

pub fn set_user_status(conn: &Connection, id: i64, status: &str) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE users SET status = ?1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?2 AND is_deleted = 0",
        params![status, id],
    )?;
    Ok(affected > 0)
}

pub fn set_password_hash(conn: &Connection, id: i64, hash: &str) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE users SET password_hash = ?1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?2 AND is_deleted = 0",
        params![hash, id],
    )?;
    Ok(affected > 0)
}

#[cfg(test)]
pub fn get_password_hash(conn: &Connection, id: i64) -> Result<Option<String>, AppError> {
    let h: Option<String> = conn
        .query_row(
            "SELECT password_hash FROM users WHERE id = ?1 AND is_deleted = 0",
            [id],
            |r| r.get(0),
        )
        .optional()?;
    Ok(h)
}

pub fn soft_delete_user(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE users SET is_deleted = 1, status = 'disabled', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND is_deleted = 0",
        [id],
    )?;
    Ok(affected > 0)
}

pub fn is_admin_user(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?1 AND u.is_deleted = 0 AND r.name = 'Admin'",
        [id],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

pub fn active_admin_count(conn: &Connection) -> Result<i64, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.is_deleted = 0 AND u.status = 'active' AND r.name = 'Admin'",
        [],
        |r| r.get(0),
    )?;
    Ok(n)
}

// ----- Roles -----

fn role_meta_from_row(r: &Row) -> rusqlite::Result<(Role, i64)> {
    let role = Role {
        id: r.get("id")?,
        name: r.get("name")?,
        description: r.get("description")?,
        is_builtin: r.get::<_, i64>("is_builtin")? != 0,
        created_at: r.get("created_at")?,
    };
    let user_count: i64 = r.get("user_count")?;
    Ok((role, user_count))
}

pub fn role_permissions(conn: &Connection, role_id: i64) -> Result<Vec<String>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT p.name FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = ?1 ORDER BY p.name",
    )?;
    let rows = stmt.query_map([role_id], |r| r.get::<_, String>(0))?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn list_roles_with_permissions(
    conn: &Connection,
    search: Option<&str>,
) -> Result<Vec<RoleWithPermissions>, AppError> {
    let has_search = search.map(|s| !s.trim().is_empty()).unwrap_or(false);
    let mut sql = String::from(
        "SELECT r.id, r.name, r.description, r.is_builtin, r.created_at,
                (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id AND u.is_deleted = 0) AS user_count
         FROM roles r",
    );
    let mut q: Vec<rusqlite::types::Value> = Vec::new();
    if has_search {
        let s = format!("%{}%", search.unwrap_or("").trim());
        sql.push_str(" WHERE r.name LIKE ?");
        let val = rusqlite::types::Value::from(s);
        q.push(val);
    }
    sql.push_str(" ORDER BY r.id");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), role_meta_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        let (role, user_count) = r?;
        let permissions = role_permissions(conn, role.id)?;
        out.push(RoleWithPermissions {
            id: role.id,
            name: role.name,
            description: role.description,
            is_builtin: role.is_builtin,
            created_at: role.created_at,
            permissions,
            user_count,
        });
    }
    Ok(out)
}

pub fn get_role(conn: &Connection, id: i64) -> Result<Option<Role>, AppError> {
    let role: Option<Role> = conn
        .query_row(
            "SELECT id, name, description, is_builtin, created_at FROM roles WHERE id = ?1",
            [id],
            |r| {
                Ok(Role {
                    id: r.get("id")?,
                    name: r.get("name")?,
                    description: r.get("description")?,
                    is_builtin: r.get::<_, i64>("is_builtin")? != 0,
                    created_at: r.get("created_at")?,
                })
            },
        )
        .optional()?;
    Ok(role)
}

pub fn role_name_exists(conn: &Connection, name: &str) -> Result<bool, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM roles WHERE name = ?1",
        [name],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

pub fn role_name_exists_excluding(
    conn: &Connection,
    name: &str,
    exclude_id: i64,
) -> Result<bool, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM roles WHERE name = ?1 AND id != ?2",
        params![name, exclude_id],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

pub fn insert_role(conn: &Connection, name: &str, description: Option<&str>) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO roles (name, description, is_builtin) VALUES (?1, ?2, 0)",
        params![name, description],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_role(
    conn: &Connection,
    id: i64,
    name: &str,
    description: Option<&str>,
) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE roles SET name = ?1, description = ?2 WHERE id = ?3",
        params![name, description, id],
    )?;
    Ok(affected > 0)
}

pub fn delete_role(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute("DELETE FROM roles WHERE id = ?1", [id])?;
    Ok(affected > 0)
}

pub fn set_role_permissions(conn: &Connection, role_id: i64, perms: &[String]) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM role_permissions WHERE role_id = ?1",
        [role_id],
    )?;
    for name in perms {
        conn.execute(
            "INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
             SELECT ?1, id FROM permissions WHERE name = ?2",
            params![role_id, name],
        )?;
    }
    Ok(())
}

// ----- Permissions -----

pub fn list_permissions(conn: &Connection) -> Result<Vec<Permission>, AppError> {
    let mut stmt = conn.prepare("SELECT id, name, description FROM permissions ORDER BY name")?;
    let rows = stmt.query_map([], |r| {
        Ok(Permission {
            id: r.get("id")?,
            name: r.get("name")?,
            description: r.get("description")?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}
