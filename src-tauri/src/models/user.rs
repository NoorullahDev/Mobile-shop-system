use serde::{Deserialize, Serialize};

/// The authenticated session payload sent to the frontend.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SessionUser {
    pub id: i64,
    pub username: String,
    pub role: String,
    pub permissions: Vec<String>,
    pub login_time: String,
    /// True when the account is still using the default/initial password.
    pub default_password: bool,
}

/// A user suitable for management UI. Never exposes the password hash.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserDetail {
    pub id: i64,
    pub username: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    pub role_id: i64,
    pub role_name: String,
    pub status: String,
    pub created_at: String,
    pub is_deleted: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreateUserInput {
    pub username: String,
    pub password: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    pub role_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct UpdateUserInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ResetPasswordInput {
    pub new_password: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Role {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub is_builtin: bool,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Permission {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RoleWithPermissions {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub is_builtin: bool,
    pub created_at: String,
    pub permissions: Vec<String>,
    pub user_count: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreateRoleInput {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct UpdateRoleInput {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
}
