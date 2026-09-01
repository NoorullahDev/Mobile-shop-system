use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BackupType {
    Full,
    Database,
}

impl BackupType {
    pub fn as_str(&self) -> &'static str {
        match self {
            BackupType::Full => "full",
            BackupType::Database => "database",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "full" => BackupType::Full,
            _ => BackupType::Database,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BackupStatus {
    Success,
    Failed,
}

impl BackupStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            BackupStatus::Success => "success",
            BackupStatus::Failed => "failed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "failed" => BackupStatus::Failed,
            _ => BackupStatus::Success,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Backup {
    pub id: i64,
    pub file_name: String,
    pub backup_type: BackupType,
    pub file_path: String,
    pub size: i64,
    pub status: BackupStatus,
    pub created_by: Option<i64>,
    pub created_at: String,
}