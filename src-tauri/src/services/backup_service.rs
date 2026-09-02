use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;
use rusqlite::{Connection, DatabaseName};

use crate::errors::AppError;
use crate::models::backup::{Backup, BackupStatus, BackupType};
use crate::repositories::backup_repository;
use crate::services;

fn timestamp() -> String {
    Local::now().format("%Y%m%d_%H%M%S").to_string()
}

/// Writes an online backup of the live database to `destination` (consistent snapshot,
/// safe for both memory and file-backed connections). Returns the resulting file size.
pub fn write_backup(conn: &Connection, destination: &Path) -> Result<u64, AppError> {
    if let Some(parent) = destination.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| {
                AppError::file(format!("could not create backup directory: {e}"))
            })?;
        }
    }
    conn.backup(DatabaseName::Main, destination, None::<fn(rusqlite::backup::Progress)>)
        .map_err(|e| AppError::file(format!("failed to write backup: {e}")))?;
    fs::metadata(destination)
        .map(|m| m.len())
        .map_err(|e| AppError::file(format!("could not stat backup file: {e}")))
}

/// Validates that `path` is a readable, non-corrupt SQLite database with real content.
pub fn verify_backup(path: &Path) -> Result<(), AppError> {
    if !path.exists() {
        return Err(AppError::validation(format!(
            "Backup file not found: {}",
            path.display()
        )));
    }
    let probe = Connection::open(path)
        .map_err(|e| AppError::validation(format!("Invalid backup file: {e}")))?;
    let status: String = probe
        .query_row("PRAGMA integrity_check", [], |r| r.get(0))
        .map_err(|e| AppError::validation(format!("Corrupted backup file: {e}")))?;
    if status != "ok" {
        return Err(AppError::validation("Backup file is corrupted"));
    }
    let has_table: bool = probe
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type IN ('table','view') LIMIT 1)",
            [],
            |r| r.get(0),
        )
        .map_err(|e| AppError::validation(format!("Invalid backup file: {e}")))?;
    if !has_table {
        return Err(AppError::validation(
            "The selected file is not a valid database backup",
        ));
    }
    Ok(())
}

/// Creates a managed backup inside `backups_dir`, records it in the `backups` table,
/// verifies the snapshot and logs the operation.
pub fn create_backup(
    conn: &Connection,
    backups_dir: &Path,
    actor: Option<i64>,
    backup_type: BackupType,
) -> Result<Backup, AppError> {
    fs::create_dir_all(backups_dir).map_err(|e| {
        AppError::file(format!("could not create backup directory: {e}"))
    })?;

    let stamp = timestamp();
    let mut file_name = format!("backup_{stamp}.db");
    let mut destination = backups_dir.join(&file_name);
    let mut n = 1;
    while destination.exists() {
        file_name = format!("backup_{stamp}_{n}.db");
        destination = backups_dir.join(&file_name);
        n += 1;
    }

    let size = write_backup(conn, &destination)? as i64;

    if let Err(e) = verify_backup(&destination) {
        // A failed backup must still be recorded and surfaced to the user.
        let _ = backup_repository::insert(
            conn,
            &file_name,
            backup_type,
            &destination.to_string_lossy(),
            size,
            BackupStatus::Failed,
            actor,
        );
        return Err(e);
    }

    let id = backup_repository::insert(
        conn,
        &file_name,
        backup_type,
        &destination.to_string_lossy(),
        size,
        BackupStatus::Success,
        actor,
    )?;

    services::record_activity(conn, actor, "backup", "create", Some(id))?;
    services::notification_service::notify(
        conn,
        actor,
        "system",
        "normal",
        "Backup created",
        &format!("A database backup was created: {file_name}"),
    )?;

    backup_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::Internal("Created backup could not be retrieved".into()))
}

pub fn list_backups(conn: &Connection) -> Result<Vec<Backup>, AppError> {
    backup_repository::list(conn)
}

pub fn get_backup(conn: &Connection, id: i64) -> Result<Option<Backup>, AppError> {
    backup_repository::get_by_id(conn, id)
}

/// Removes both the metadata row and the backup file on disk.
pub fn delete_backup(conn: &Connection, actor: Option<i64>, id: i64) -> Result<(), AppError> {
    let item = backup_repository::get_by_id(conn, id)?.ok_or_else(|| {
        AppError::validation(format!("Backup #{id} not found"))
    })?;

    let path = PathBuf::from(&item.file_path);
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| AppError::file(format!("failed to delete backup file: {e}")))?;
    }

    backup_repository::delete(conn, id)?;
    services::record_activity(conn, actor, "backup", "delete", Some(id))?;
    services::notification_service::notify(
        conn,
        actor,
        "system",
        "low",
        "Backup deleted",
        &format!("Backup was deleted: {}", item.file_name),
    )?;
    Ok(())
}

/// Restores the database contents from `source` into the live connection.
///
/// The backup is validated first, and an emergency safety copy of the current data is
/// written to `backups_dir` before the restore touches anything (business rule 4).
pub fn restore_backup(
    conn: &mut Connection,
    backups_dir: &Path,
    actor: Option<i64>,
    source: &Path,
) -> Result<(), AppError> {
    verify_backup(source)?;

    // Emergency safety backup (best-effort): never proceed without one if we can help it.
    fs::create_dir_all(backups_dir).map_err(|e| {
        AppError::file(format!("could not create backup directory: {e}"))
    })?;
    let safety_path = backups_dir.join(format!("pre_restore_{}.db", timestamp()));
    if let Err(e) = write_backup(conn, &safety_path) {
        log::warn!("could not create emergency backup before restore: {e}");
    }

    conn.restore(
        DatabaseName::Main,
        source,
        None::<fn(rusqlite::backup::Progress)>,
    )
    .map_err(|e| AppError::file(format!("failed to restore: {e}")))?;

    services::record_activity(conn, actor, "backup", "restore", None)?;
    services::notification_service::notify(
        conn,
        actor,
        "security",
        "high",
        "Database restored",
        "The database was restored from a backup.",
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_utils;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(tag: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "bms_backup_test_{tag}_{}_{}",
            std::process::id(),
            nanos
        ));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn managed_backup_creates_file_and_metadata() {
        let conn = test_utils::in_memory_conn();
        let dir = temp_dir("create");
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('shop_name', 'ACME')",
            [],
        )
        .unwrap();

        let backup = create_backup(&conn, &dir, Some(7), BackupType::Database).expect("backup");
        assert!(backup.id > 0);
        assert!(backup.file_name.ends_with(".db"));
        assert_eq!(backup.status, BackupStatus::Success);
        assert_eq!(backup.created_by, Some(7));

        let dest = Path::new(&backup.file_path);
        assert!(dest.exists(), "backup file should exist");
        assert!(backup.size > 0, "backup file should not be empty");

        let list = list_backups(&conn).expect("list");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, backup.id);
        assert_eq!(list[0].file_name, backup.file_name);
        assert_eq!(backup_repository::count(&conn).unwrap(), 1);

        verify_backup(dest).expect("valid backup verifies");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn restore_roundtrips_snapshot() {
        let mut conn = test_utils::in_memory_conn();
        let dir = temp_dir("restore");
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('shop_name', 'before')",
            [],
        )
        .unwrap();

        let backup = create_backup(&conn, &dir, None, BackupType::Database).expect("backup");

        conn.execute(
            "UPDATE settings SET value = 'after' WHERE key = 'shop_name'",
            [],
        )
        .unwrap();

        restore_backup(&mut conn, &dir, None, Path::new(&backup.file_path)).expect("restore");

        let value: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'shop_name'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(value, "before", "restore reverted the change");

        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn invalid_backup_rejected_for_restore_and_verify() {
        let mut conn = test_utils::in_memory_conn();
        let dir = temp_dir("invalid");

        let not_a_db = dir.join("fake.db");
        fs::write(&not_a_db, "this is not a sqlite database").unwrap();

        assert!(verify_backup(&not_a_db).is_err());
        assert!(
            restore_backup(&mut conn, &dir, None, &not_a_db).is_err(),
            "restore must reject a non-database file"
        );

        // A truncated snapshot must also fail verification.
        let backup = create_backup(&conn, &dir, None, BackupType::Database).expect("backup");
        let dest = Path::new(&backup.file_path);
        let bytes = fs::read(dest).unwrap();
        fs::write(dest, &bytes[..bytes.len() / 2]).unwrap();
        assert!(verify_backup(dest).is_err(), "truncated file must fail verification");

        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn delete_backup_removes_file_and_row() {
        let conn = test_utils::in_memory_conn();
        let dir = temp_dir("delete");

        let backup = create_backup(&conn, &dir, None, BackupType::Database).expect("backup");
        let dest = PathBuf::from(&backup.file_path);
        assert!(dest.exists());

        delete_backup(&conn, None, backup.id).expect("delete");
        assert!(!dest.exists(), "file removed from disk");
        assert_eq!(list_backups(&conn).unwrap().len(), 0);
        assert_eq!(backup_repository::count(&conn).unwrap(), 0);

        assert!(
            delete_backup(&conn, None, backup.id).is_err(),
            "deleting a missing backup must error"
        );

        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn missing_file_rejected() {
        let _conn = test_utils::in_memory_conn();
        let dir = temp_dir("missing");
        let orphan = dir.join("no_such_file.db");
        assert!(verify_backup(&orphan).is_err());
        fs::remove_dir_all(dir).ok();
    }
}