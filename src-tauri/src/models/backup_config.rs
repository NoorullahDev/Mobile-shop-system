use serde::{Deserialize, Serialize};

/// Automatic backup configuration, persisted in the `settings` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    pub auto_backup_enabled: bool,
    pub auto_backup_interval_minutes: i64,
    pub backup_folder: String,
    /// Frequency preset key, one of: "every_time", "10", "30", "60", "180", "custom".
    pub backup_frequency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateBackupConfigInput {
    pub auto_backup_enabled: bool,
    pub auto_backup_interval_minutes: i64,
    pub backup_folder: Option<String>,
    pub backup_frequency: Option<String>,
}

/// Runtime status of the automatic backup system, surfaced to the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupStatusInfo {
    pub config: BackupConfig,
    pub last_backup_at: Option<String>,
    pub total_backups: i64,
    pub last_backup_file: Option<String>,
}
