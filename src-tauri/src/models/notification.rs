use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppNotification {
    pub id: i64,
    pub user_id: i64,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    pub kind: String,
    pub priority: String,
    pub is_read: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub read_at: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreateNotificationInput {
    pub user_id: i64,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default = "default_kind")]
    pub kind: String,
    #[serde(default = "default_priority")]
    pub priority: String,
}

fn default_kind() -> String {
    "general".into()
}

fn default_priority() -> String {
    "normal".into()
}

/// Unread count for a given user.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NotificationCount {
    pub unread: i64,
}

pub const PRIORITIES: &[&str] = &["low", "normal", "high", "critical"];
pub const KINDS: &[&str] = &["general", "member", "finance", "system", "security"];