use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::user::SessionUser;
use crate::repositories::user_repository;
use crate::security;
use crate::services;

pub fn login(conn: &Connection, username: &str, password: &str) -> Result<SessionUser, AppError> {
    let username = username.trim();
    if username.is_empty() || password.is_empty() {
        return Err(AppError::Authentication(
            "Invalid username or password".into(),
        ));
    }

    let Some(user) = user_repository::find_by_username(conn, username)? else {
        services::record_activity(conn, None, "auth", "login_failed", None)?;
        return Err(AppError::Authentication(
            "Invalid username or password".into(),
        ));
    };

    if !security::verify_password(password, &user.password_hash)? {
        services::record_activity(conn, Some(user.id), "auth", "login_failed", None)?;
        return Err(AppError::Authentication(
            "Invalid username or password".into(),
        ));
    }

    if user.status != "active" {
        services::record_activity(conn, Some(user.id), "auth", "login_blocked", None)?;
        return Err(AppError::Authentication(
            "Your account has been disabled".into(),
        ));
    }

    let role = user_repository::get_role_name(conn, user.role_id)?
        .unwrap_or_else(|| "Unknown".into());
    let permissions = user_repository::get_permissions(conn, user.role_id)?;
    let login_time = chrono::Local::now().to_rfc3339();
    let default_password = security::verify_password("admin123", &user.password_hash)?;

    let session_user = SessionUser {
        id: user.id,
        username: user.username,
        role,
        permissions,
        login_time,
        default_password,
    };

    services::record_activity(conn, Some(user.id), "auth", "login", None)?;
    Ok(session_user)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::security::hash_password;
    use rusqlite::Connection;

    fn conn_with_user(status: &str, has_permissions: bool) -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
            CREATE TABLE permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
            CREATE TABLE role_permissions (
                role_id INTEGER NOT NULL, permission_id INTEGER NOT NULL,
                PRIMARY KEY (role_id, permission_id)
            );
            CREATE TABLE activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
                module TEXT NOT NULL, action TEXT NOT NULL, record_id INTEGER,
                old_value TEXT, new_value TEXT,
                timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );",
        )
        .unwrap();
        let hash = hash_password("Secret123!").unwrap();
        conn.execute(
            "INSERT INTO roles (id, name) VALUES (1, 'Admin')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO users (username, password_hash, role_id, status) VALUES ('admin', ?1, 1, ?2)",
            rusqlite::params![hash, status],
        )
        .unwrap();
        if has_permissions {
            conn.execute("INSERT INTO permissions (name) VALUES ('members:create')", [])
                .unwrap();
            conn.execute(
                "INSERT INTO role_permissions (role_id, permission_id) VALUES (1, 1)",
                [],
            )
            .unwrap();
        }
        conn
    }

    #[test]
    fn valid_login_returns_session_user() {
        let conn = conn_with_user("active", true);
        let session = login(&conn, "admin", "Secret123!").expect("login");
        assert_eq!(session.username, "admin");
        assert_eq!(session.role, "Admin");
        assert_eq!(session.permissions, vec!["members:create".to_string()]);
    }

    #[test]
    fn invalid_password_rejected() {
        let conn = conn_with_user("active", false);
        let err = login(&conn, "admin", "wrong").unwrap_err();
        assert!(matches!(err, AppError::Authentication(_)));
    }

    #[test]
    fn disabled_user_rejected() {
        let conn = conn_with_user("inactive", false);
        let err = login(&conn, "admin", "Secret123!").unwrap_err();
        assert!(matches!(err, AppError::Authentication(_)));
    }
}
