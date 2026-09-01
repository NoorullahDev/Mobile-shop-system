use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::user::{
    CreateRoleInput, CreateUserInput, Permission, RoleWithPermissions, UpdateRoleInput,
    UpdateUserInput, UserDetail,
};
use crate::repositories::user_admin_repository as repo;
use crate::security::hash_password;
use crate::services;

fn normalize_status(s: Option<String>) -> String {
    let s = s.unwrap_or_default().trim().to_lowercase();
    if matches!(s.as_str(), "active" | "disabled") {
        s
    } else {
        "active".into()
    }
}

fn clean_opt(s: Option<String>) -> Option<String> {
    s.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

// ----- Users -----

pub fn create_user(conn: &Connection, input: CreateUserInput, actor: Option<i64>) -> Result<UserDetail, AppError> {
    let username = input.username.trim().to_lowercase();
    if username.is_empty() {
        return Err(AppError::validation("Username is required"));
    }
    if input.password.len() < 6 {
        return Err(AppError::validation("Password must be at least 6 characters"));
    }
    if !repo::role_exists(conn, input.role_id)? {
        return Err(AppError::validation("Role not found"));
    }
    if repo::username_exists(conn, &username)? {
        return Err(AppError::validation("A user with this username already exists"));
    }

    let hash = hash_password(&input.password)?;
    let status = normalize_status(input.status);
    let full_name = clean_opt(input.full_name);
    let email = clean_opt(input.email);

    let id = repo::insert_user(
        conn,
        &username,
        &hash,
        full_name.as_deref(),
        email.as_deref(),
        input.role_id,
        &status,
    )?;
    services::record_activity(conn, actor, "user", "create", Some(id))?;

    repo::get_user(conn, id)?
        .ok_or_else(|| AppError::Internal("Created user could not be retrieved".into()))
}

pub fn list_users(conn: &Connection, search: Option<String>) -> Result<Vec<UserDetail>, AppError> {
    repo::list_users(conn, search.as_deref())
}

pub fn get_user(conn: &Connection, id: i64) -> Result<UserDetail, AppError> {
    repo::get_user(conn, id)?.ok_or_else(|| AppError::validation("User not found"))
}

pub fn update_user(
    conn: &Connection,
    id: i64,
    input: UpdateUserInput,
    actor: Option<i64>,
) -> Result<UserDetail, AppError> {
    let current = repo::get_user(conn, id)?.ok_or_else(|| AppError::validation("User not found"))?;

    let role_id = input.role_id.unwrap_or(current.role_id);
    if !repo::role_exists(conn, role_id)? {
        return Err(AppError::validation("Role not found"));
    }

    let full_name = clean_opt(input.full_name).or(current.full_name);
    let email = clean_opt(input.email).or(current.email);
    let status = input.status.unwrap_or_else(|| current.status.clone());

    if status == "disabled" && repo::is_admin_user(conn, id)? {
        let active_admins = repo::active_admin_count(conn)?;
        if active_admins <= 1 {
            return Err(AppError::validation(
                "Cannot disable the last active administrator account",
            ));
        }
    }

    let ok = repo::update_user_fields(conn, id, full_name.as_deref(), email.as_deref(), role_id, &status)?;
    if !ok {
        return Err(AppError::validation("User not found"));
    }
    services::record_activity(conn, actor, "user", "update", Some(id))?;
    repo::get_user(conn, id)?
        .ok_or_else(|| AppError::Internal("Updated user could not be retrieved".into()))
}

pub fn set_user_status(conn: &Connection, id: i64, status: &str, actor: Option<i64>) -> Result<UserDetail, AppError> {
    let status = normalize_status(Some(status.into()));
    if status == "disabled" && repo::is_admin_user(conn, id)? {
        let active_admins = repo::active_admin_count(conn)?;
        if active_admins <= 1 {
            return Err(AppError::validation(
                "Cannot disable the last active administrator account",
            ));
        }
    }
    let ok = repo::set_user_status(conn, id, &status)?;
    if !ok {
        return Err(AppError::validation("User not found"));
    }
    services::record_activity(conn, actor, "user", "status", Some(id))?;
    repo::get_user(conn, id)?
        .ok_or_else(|| AppError::Internal("Updated user could not be retrieved".into()))
}

pub fn reset_password(conn: &Connection, id: i64, new_password: &str, actor: Option<i64>) -> Result<(), AppError> {
    if new_password.len() < 6 {
        return Err(AppError::validation("Password must be at least 6 characters"));
    }
    let hash = hash_password(new_password)?;
    let ok = repo::set_password_hash(conn, id, &hash)?;
    if !ok {
        return Err(AppError::validation("User not found"));
    }
    services::record_activity(conn, actor, "user", "reset_password", Some(id))
}

pub fn delete_user(conn: &Connection, id: i64, actor: Option<i64>) -> Result<(), AppError> {
    if repo::is_admin_user(conn, id)? {
        let active_admins = repo::active_admin_count(conn)?;
        if active_admins <= 1 {
            return Err(AppError::validation(
                "Cannot delete the last active administrator account",
            ));
        }
    }
    let ok = repo::soft_delete_user(conn, id)?;
    if !ok {
        return Err(AppError::validation("User not found"));
    }
    services::record_activity(conn, actor, "user", "delete", Some(id))
}

// ----- Roles -----

pub fn list_roles(conn: &Connection, search: Option<String>) -> Result<Vec<RoleWithPermissions>, AppError> {
    repo::list_roles_with_permissions(conn, search.as_deref())
}

pub fn get_role(conn: &Connection, id: i64) -> Result<RoleWithPermissions, AppError> {
    let role = repo::get_role(conn, id)?.ok_or_else(|| AppError::validation("Role not found"))?;
    let permissions = repo::role_permissions(conn, id)?;
    let user_count: i64 = {
        let n: i64 = conn.query_row(
            "SELECT COUNT(*) FROM users WHERE role_id = ?1 AND is_deleted = 0",
            [id],
            |r| r.get(0),
        )?;
        n
    };
    Ok(RoleWithPermissions {
        id: role.id,
        name: role.name,
        description: role.description,
        is_builtin: role.is_builtin,
        created_at: role.created_at,
        permissions,
        user_count,
    })
}

pub fn create_role(conn: &Connection, input: CreateRoleInput, actor: Option<i64>) -> Result<RoleWithPermissions, AppError> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::validation("Role name is required"));
    }
    if repo::role_name_exists(conn, &name)? {
        return Err(AppError::validation("A role with this name already exists"));
    }
    let description = clean_opt(input.description);
    let id = repo::insert_role(conn, &name, description.as_deref())?;
    repo::set_role_permissions(conn, id, &input.permissions)?;
    services::record_activity(conn, actor, "role", "create", Some(id))?;
    get_role(conn, id)
}

pub fn update_role(
    conn: &Connection,
    id: i64,
    input: UpdateRoleInput,
    actor: Option<i64>,
) -> Result<RoleWithPermissions, AppError> {
    let _current = repo::get_role(conn, id)?.ok_or_else(|| AppError::validation("Role not found"))?;
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::validation("Role name is required"));
    }
    if repo::role_name_exists_excluding(conn, &name, id)? {
        return Err(AppError::validation("A role with this name already exists"));
    }
    let description = clean_opt(input.description);

    // Builtin roles cannot be renamed/deleted but their permissions may be edited by an admin.
    let ok = repo::update_role(conn, id, &name, description.as_deref())?;
    if !ok {
        return Err(AppError::validation("Role not found"));
    }
    repo::set_role_permissions(conn, id, &input.permissions)?;
    services::record_activity(conn, actor, "role", "update", Some(id))?;
    get_role(conn, id)
}

pub fn delete_role(conn: &Connection, id: i64, actor: Option<i64>) -> Result<(), AppError> {
    let role = repo::get_role(conn, id)?.ok_or_else(|| AppError::validation("Role not found"))?;
    if role.is_builtin {
        return Err(AppError::validation("Built-in roles cannot be deleted"));
    }
    let user_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE role_id = ?1 AND is_deleted = 0",
        [id],
        |r| r.get(0),
    )?;
    if user_count > 0 {
        return Err(AppError::validation(
            "Cannot delete a role that is assigned to users",
        ));
    }
    repo::delete_role(conn, id)?;
    services::record_activity(conn, actor, "role", "delete", Some(id))
}

pub fn list_permissions(conn: &Connection) -> Result<Vec<Permission>, AppError> {
    repo::list_permissions(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_utils::in_memory_conn;

    fn seed_roles(conn: &Connection) {
        conn.execute_batch(
            "INSERT INTO roles (name, is_builtin) VALUES ('Admin', 1), ('Staff', 0);
             INSERT INTO permissions (name) VALUES ('members:view'), ('members:create'), ('sales:create'), ('users:manage');
             INSERT INTO role_permissions (role_id, permission_id) SELECT 1, id FROM permissions WHERE name='users:manage';
             INSERT INTO users (username, password_hash, role_id, status) VALUES ('admin','x',1,'active');",
        )
        .unwrap();
    }

    #[test]
    fn creates_user_with_hashed_password() {
        let conn = in_memory_conn();
        seed_roles(&conn);
        let u = create_user(
            &conn,
            CreateUserInput {
                username: "cashier".into(),
                password: "secret123".into(),
                full_name: Some("Ali".into()),
                email: Some("a@b.com".into()),
                role_id: 2,
                status: None,
            },
            None,
        )
        .unwrap();
        assert!(u.id > 0);
        assert_eq!(u.role_name, "Staff");
        assert_eq!(u.status, "active");
        // password must not be returned & must be hashed in DB
        let stored: String = conn
            .query_row("SELECT password_hash FROM users WHERE id = ?1", [u.id], |r| r.get(0))
            .unwrap();
        assert_ne!(stored, "secret123");
    }

    #[test]
    fn create_rejects_duplicate_username() {
        let conn = in_memory_conn();
        seed_roles(&conn);
        let err = create_user(
            &conn,
            CreateUserInput {
                username: "admin".into(),
                password: "secret123".into(),
                full_name: None,
                email: None,
                role_id: 1,
                status: None,
            },
            None,
        )
        .unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn create_rejects_short_password() {
        let conn = in_memory_conn();
        seed_roles(&conn);
        let err = create_user(
            &conn,
            CreateUserInput {
                username: "x".into(),
                password: "abc".into(),
                full_name: None,
                email: None,
                role_id: 1,
                status: None,
            },
            None,
        )
        .unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn cannot_delete_last_admin() {
        let conn = in_memory_conn();
        seed_roles(&conn);
        let err = delete_user(&conn, 1, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn soft_deletes_user_and_lists_active_only() {
        let conn = in_memory_conn();
        seed_roles(&conn);
        let u = create_user(
            &conn,
            CreateUserInput {
                username: "temp".into(),
                password: "secret123".into(),
                full_name: None,
                email: None,
                role_id: 2,
                status: None,
            },
            None,
        )
        .unwrap();
        delete_user(&conn, u.id, None).unwrap();
        assert!(get_user(&conn, u.id).is_err());
        let all = list_users(&conn, None).unwrap();
        assert!(all.iter().all(|x| !x.is_deleted));
        assert!(all.iter().all(|x| x.username != "temp"));
    }

    #[test]
    fn resets_password() {
        let conn = in_memory_conn();
        seed_roles(&conn);
        reset_password(&conn, 1, "newpass123", None).unwrap();
        let h = repo::get_password_hash(&conn, 1).unwrap().unwrap();
        assert!(crate::security::verify_password("newpass123", &h).unwrap());
    }

    #[test]
    fn role_crud_and_permissions() {
        let conn = in_memory_conn();
        seed_roles(&conn);

        let role = create_role(
            &conn,
            CreateRoleInput {
                name: "Manager".into(),
                description: Some("ops".into()),
                permissions: vec!["sales:create".into(), "members:view".into()],
            },
            None,
        )
        .unwrap();
        assert!(role.id > 0);
        assert_eq!(role.permissions.len(), 2);

        let updated = update_role(
            &conn,
            role.id,
            UpdateRoleInput {
                name: "Manager".into(),
                description: Some("ops updated".into()),
                permissions: vec!["members:view".into()],
            },
            None,
        )
        .unwrap();
        assert_eq!(updated.permissions, vec!["members:view"]);

        delete_role(&conn, role.id, None).unwrap();
        assert!(get_role(&conn, role.id).is_err());
    }

    #[test]
    fn cannot_delete_builtin_role() {
        let conn = in_memory_conn();
        seed_roles(&conn);
        let err = delete_role(&conn, 1, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }
}
