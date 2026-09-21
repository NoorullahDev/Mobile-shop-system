use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use chrono::Local;
use rusqlite::{Connection, DatabaseName, OptionalExtension};
use tauri::Manager;

use crate::database::migrations;
use crate::errors::AppError;
use crate::models::backup::{Backup, BackupInspection, BackupModule, BackupStatus, BackupType};
use crate::models::backup_config::{BackupConfig, BackupStatusInfo, UpdateBackupConfigInput};
use crate::repositories::{backup_repository, settings_repository};
use crate::services;

/// `settings` keys that hold license state. A restore must never replace the
/// machine's current activation, so these are captured before the restore and
/// written back afterwards (hardware ID is machine-derived, never imported).
const LICENSE_KEYS: &[&str] = &[
    "license_key",
    "license_customer",
    "license_granted_days",
    "license_activated_at",
    "license_last_valid_time",
    "license_last_valid_seal",
];

const SNAPSHOT_NAME: &str = "business_management.db";
const MANIFEST_NAME: &str = "backup_info.json";

/// Tables embedded *inside* a single-file `.db` (a plain SQLite database):
/// `__bms_backup_meta` holds the JSON manifest, `__bms_backup_files` holds the
/// app-managed product images as BLOBs so the backup stays one self-contained file.
const META_TABLE: &str = "__bms_backup_meta";
const FILES_TABLE: &str = "__bms_backup_files";
const MANIFEST_META_KEY: &str = "manifest";

const MODULES: &[(&str, &str, &[&str])] = &[
    (
        "mobile_phones",
        "Mobile Phones",
        &["phones", "phone_imeis", "phone_options"],
    ),
    (
        "accessories",
        "Accessories",
        &["accessories", "product_categories"],
    ),
    ("sales", "Sales", &["sales", "sale_items"]),
    ("customers", "Customers", &["members"]),
    ("customer_dues", "Customer Dues", &["payments"]),
    ("suppliers", "Suppliers", &["suppliers"]),
    ("supplier_dues", "Supplier Dues", &["supplier_payments"]),
    ("purchases", "Purchases", &["purchases", "purchase_items"]),
    ("expenses", "Expenses", &["categories", "expenses"]),
    ("settings", "Settings", &["settings"]),
    // The current architecture stores the shop logo in settings and attachment
    // references on customer/expense rows. Restore handles this module column-wise.
    (
        "images_attachments",
        "Images / Attachments",
        &["members", "expenses", "settings"],
    ),
    (
        "users_roles",
        "Users & Roles",
        &["roles", "permissions", "role_permissions", "users"],
    ),
    ("reports", "Reports", &["report_templates"]),
    (
        "activity_notifications",
        "Activity Logs & Notifications",
        &["activity_logs", "notifications"],
    ),
];

pub fn available_modules() -> Vec<BackupModule> {
    MODULES
        .iter()
        .map(|(id, label, _)| BackupModule {
            id: (*id).into(),
            label: (*label).into(),
        })
        .collect()
}

/// All module ids, used for full/database backups (exit + automatic).
pub fn all_module_ids() -> Vec<String> {
    MODULES.iter().map(|m| m.0.to_string()).collect()
}

/// Content-sniffing detection between the legacy `.zip` archives and the current
/// single-file `.db` databases, so a file is handled the same way everywhere
/// regardless of its extension.
fn is_zip_backup(path: &Path) -> bool {
    if path
        .extension()
        .map(|e| e.eq_ignore_ascii_case("zip"))
        .unwrap_or(false)
    {
        return true;
    }
    let mut header = [0u8; 4];
    match fs::File::open(path).and_then(|mut f| f.read_exact(&mut header)) {
        Ok(()) => header.starts_with(b"PK\x03\x04") || header.starts_with(b"PK\x05\x06"),
        Err(_) => false,
    }
}

fn tables_for_modules(modules: &[String]) -> Result<Vec<&'static str>, AppError> {
    let mut tables = Vec::new();
    for id in modules {
        let Some((_, _, module_tables)) = MODULES.iter().find(|m| m.0 == id) else {
            return Err(AppError::validation(format!("Unknown backup module: {id}")));
        };
        for table in *module_tables {
            if !tables.contains(table) {
                tables.push(*table);
            }
        }
    }
    Ok(tables)
}

const KEY_AUTO_ENABLED: &str = "auto_backup_enabled";
const KEY_INTERVAL: &str = "auto_backup_interval_minutes";
const KEY_FOLDER: &str = "backup_folder";
const KEY_FREQUENCY: &str = "backup_frequency";

const DEFAULT_INTERVAL_MINUTES: i64 = 30;

/// Frequency preset keys exposed to the UI.
pub const FREQ_EVERY_TIME: &str = "every_time";
pub const FREQ_CUSTOM: &str = "custom";

/// Minimum + maximum allowed custom interval in minutes.
const MIN_INTERVAL: i64 = 1;
const MAX_INTERVAL: i64 = 24 * 60;

fn timestamp() -> String {
    Local::now().format("%Y%m%d_%H%M%S").to_string()
}

/// Returns a unique token for temp files/archives so concurrent backup calls
/// (auto + manual, or parallel tests) never collide on the same path.
fn unique_token() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    format!(
        "{}_{}_{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed),
        timestamp()
    )
}

/// Human-friendly timestamp for the desktop backup file name, e.g. 2026-09-03_10-10.
fn display_timestamp() -> String {
    Local::now().format("%Y-%m-%d_%H-%M-%S").to_string()
}

const BACKUP_FOLDER: &str = "Software Backup";

/// Resolves the backup directory on the user's Desktop: `Desktop/Software Backup`.
/// Works in both development and the packaged EXE (USERPROFILE is always set).
pub fn desktop_folder() -> Result<PathBuf, AppError> {
    let profile = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| {
            AppError::file("could not determine the user home directory for backups".to_string())
        })?;
    let desktop = std::path::PathBuf::from(&profile).join("Desktop");
    let folder = desktop.join(BACKUP_FOLDER);
    fs::create_dir_all(&folder)
        .map_err(|e| AppError::file(format!("could not create backup folder: {e}")))?;
    Ok(folder)
}

/// Writes an online backup of the live database to `destination` (consistent snapshot,
/// safe for both memory and file-backed connections). Returns the resulting file size.
pub fn write_backup(conn: &Connection, destination: &Path) -> Result<u64, AppError> {
    if let Some(parent) = destination.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| AppError::file(format!("could not create backup directory: {e}")))?;
        }
    }
    conn.backup(
        DatabaseName::Main,
        destination,
        None::<fn(rusqlite::backup::Progress)>,
    )
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

/// Validates a stored backup entry. If it is a legacy archive (.zip) the embedded
/// SQLite snapshot is extracted first; otherwise the file is checked directly.
pub fn verify_backup_entry(path: &Path) -> Result<(), AppError> {
    if is_zip_backup(path) {
        let temp = extract_snapshot(path)?;
        let r = verify_backup(&temp);
        let _ = std::fs::remove_file(&temp);
        r
    } else {
        verify_backup(path)
    }
}

/// Lightweight validation of a user-selected backup archive without restoring it:
/// confirms the file exists, is a readable archive/database, and contains the
/// expected snapshot. Used by the "Restore Backup" file-picker pre-check.
pub fn validate_archive(path: &Path) -> Result<(), AppError> {
    if !path.exists() {
        return Err(AppError::validation(format!(
            "Backup file not found: {}",
            path.display()
        )));
    }
    let is_zip = is_zip_backup(path);

    if is_zip {
        let file = std::fs::File::open(path)
            .map_err(|e| AppError::validation(format!("Could not open backup file: {e}")))?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|_| AppError::validation("The selected file is not a valid backup archive"))?;
        let mut snap = archive.by_name(SNAPSHOT_NAME).map_err(|_| {
            AppError::validation("The selected backup does not contain a database snapshot")
        })?;
        let mut tmp_dir = std::env::temp_dir();
        tmp_dir.push(format!("bms_validate_{}.db", unique_token()));
        let mut out = std::fs::File::create(&tmp_dir)
            .map_err(|e| AppError::validation(format!("Could not prepare validation: {e}")))?;
        let _ = std::io::copy(&mut snap, &mut out);
        let res = verify_backup(&tmp_dir);
        let _ = std::fs::remove_file(&tmp_dir);
        res
    } else {
        verify_backup(path)
    }
}

/// Extracts the SQLite snapshot from a backup archive into a fresh temp file and
/// returns its path. The caller is responsible for removing the temp file.
fn extract_snapshot(archive_path: &Path) -> Result<PathBuf, AppError> {
    let file = fs::File::open(archive_path)
        .map_err(|e| AppError::file(format!("could not open backup archive: {e}")))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| AppError::validation(format!("Invalid backup archive: {e}")))?;

    let mut snap = archive
        .by_name(SNAPSHOT_NAME)
        .map_err(|_| AppError::validation("Backup archive does not contain a database snapshot"))?;

    let temp_dir = std::env::temp_dir();
    let temp = temp_dir.join(format!("bms_restore_{}.db", unique_token()));
    let mut out = fs::File::create(&temp)
        .map_err(|e| AppError::file(format!("could not create temp snapshot: {e}")))?;
    std::io::copy(&mut snap, &mut out)
        .map_err(|e| AppError::file(format!("could not extract snapshot: {e}")))?;
    Ok(temp)
}

/// Constructs the JSON manifest describing a backup (app/version/type/modules).
fn build_manifest(
    backup_type: BackupType,
    modules: &[String],
) -> serde_json::Value {
    serde_json::json!({
        "app": "Mobile Shop Management System",
        "app_version": env!("CARGO_PKG_VERSION"),
        "database_version": env!("CARGO_PKG_VERSION"),
        "backup_created_at": Local::now().to_rfc3339(),
        "backup_type": backup_type.as_str(),
        "included_modules": modules,
        "database": SNAPSHOT_NAME,
    })
}

/// Builds a `BackupInspection` from a manifest JSON object.
fn inspection_from_manifest(value: &serde_json::Value) -> Result<BackupInspection, AppError> {
    let kind = BackupType::from_str(
        value
            .get("backup_type")
            .and_then(|v| v.as_str())
            .unwrap_or("full"),
    );
    let ids: Vec<String> = value
        .get("included_modules")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    let modules = ids
        .iter()
        .filter_map(|id| {
            MODULES.iter().find(|m| m.0 == id).map(|m| BackupModule {
                id: id.clone(),
                label: m.1.into(),
            })
        })
        .collect();
    Ok(BackupInspection {
        backup_type: kind,
        created_at: value
            .get("backup_created_at")
            .and_then(|v| v.as_str())
            .map(String::from),
        modules,
        app_version: value
            .get("app_version")
            .and_then(|v| v.as_str())
            .map(String::from),
    })
}

/// Computes the product-image paths that belong to a selective backup (used to
/// prune `product_images/*` blobs so selective backups stay faithful to selection).
fn selected_product_image_paths(
    snapshot: &Connection,
    modules: &[String],
) -> Result<Option<HashSet<String>>, AppError> {
    if modules.iter().any(|m| m == "images_attachments") {
        return Ok(None);
    }
    let mut paths = HashSet::new();
    for (module, table) in [("mobile_phones", "phones"), ("accessories", "accessories")] {
        if !modules.iter().any(|m| m == module) {
            continue;
        }
        let mut stmt = snapshot.prepare(&format!(
            "SELECT image_paths FROM {table} WHERE image_paths IS NOT NULL AND image_paths != ''"
        ))?;
        for value in stmt.query_map([], |row| row.get::<_, String>(0))? {
            let value = value?;
            let parsed: Vec<String> = serde_json::from_str(&value).map_err(|_| {
                AppError::validation(format!("Invalid product image data in {table}"))
            })?;
            paths.extend(parsed.into_iter().map(|p| p.replace('\\', "/")));
        }
    }
    Ok((!paths.is_empty()).then_some(paths))
}

/// Packs the live SQLite snapshot, an embedded JSON manifest and the app-managed
/// product images into ONE self-contained `.db` file (a plain SQLite database
/// at `destination`). Returns the number of bytes written.
///
/// The journal flavour is a single file with no secondary artefacts, so a customer
/// never needs to open or extract anything by hand — the app reads it directly.
pub fn write_single_file_backup(
    conn: &Connection,
    destination: &Path,
    backup_type: BackupType,
    modules: &[String],
) -> Result<u64, AppError> {
    let parent = destination.parent().filter(|p| !p.as_os_str().is_empty());
    if let Some(parent) = parent {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::file(format!("could not create backup directory: {e}")))?;
    }

    // Work on a unique temp file next to the destination so the final rename stays
    // on the same volume (temp dirs may sit on a different drive).
    let staging_dir = parent
        .map(Path::to_path_buf)
        .unwrap_or_else(|| std::env::temp_dir());
    let staging = staging_dir.join(format!(".bms_backup_{}.tmp", unique_token()));

    let result = (|| -> Result<u64, AppError> {
        write_backup(conn, &staging)?;

        if backup_type == BackupType::Selective {
            let keep = tables_for_modules(modules)?;
            let filtered = Connection::open(&staging)?;
            filtered.execute_batch("PRAGMA foreign_keys=OFF;")?;
            for (_, _, tables) in MODULES {
                for table in *tables {
                    if !keep.contains(table) {
                        filtered.execute(&format!("DELETE FROM \"{table}\""), [])?;
                    }
                }
            }
        }

        let selected_product_images = if backup_type != BackupType::Selective {
            None
        } else {
            let snapshot = Connection::open(&staging)?;
            selected_product_image_paths(&snapshot, modules)?
        };

        // Embed the manifest + product images inside the snapshot itself so the
        // backup stays a single, self-described database file.
        let db_path: Option<String> = conn
            .query_row(
                "SELECT file FROM pragma_database_list WHERE name='main'",
                [],
                |r| r.get(0),
            )
            .ok();
        let manifest = build_manifest(backup_type, modules);
        let include_product_assets = backup_type != BackupType::Selective
            || modules.iter().any(|m| {
                matches!(
                    m.as_str(),
                    "mobile_phones" | "accessories" | "images_attachments"
                )
            });
        {
            let mut embedded = Connection::open(&staging)?;
            let tx = embedded.transaction()?;
            tx.execute_batch(&format!(
                "CREATE TABLE {META_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL); \
                 CREATE TABLE {FILES_TABLE} (path TEXT PRIMARY KEY, data BLOB NOT NULL);"
            ))?;
            tx.execute(
                &format!("INSERT INTO {META_TABLE}(key,value) VALUES (?1, ?2)"),
                rusqlite::params![MANIFEST_META_KEY, manifest.to_string()],
            )?;
            if include_product_assets {
                if let Some(root) = db_path.and_then(|p| PathBuf::from(p).parent().map(Path::to_path_buf))
                {
                    let images = root.join("product_images");
                    if images.is_dir() {
                        for entry in fs::read_dir(&images).map_err(|e| {
                            AppError::file(format!("could not read product images: {e}"))
                        })? {
                            let entry = entry.map_err(|e| {
                                AppError::file(format!("could not read product image: {e}"))
                            })?;
                            if !entry.path().is_file() {
                                continue;
                            }
                            let name =
                                format!("product_images/{}", entry.file_name().to_string_lossy());
                            if selected_product_images
                                .as_ref()
                                .is_some_and(|paths| !paths.contains(&name))
                            {
                                continue;
                            }
                            let data =
                                fs::read(entry.path()).map_err(|e| {
                                    AppError::file(format!("could not read product image: {e}"))
                                })?;
                            tx.execute(
                                &format!("INSERT INTO {FILES_TABLE}(path,data) VALUES (?1, ?2)"),
                                rusqlite::params![name, data],
                            )?;
                        }
                    }
                }
            }
            tx.commit()?;
        }

        fs::rename(&staging, destination)
            .map_err(|e| AppError::file(format!("failed to finalize backup file: {e}")))?;
        fs::metadata(destination)
            .map(|m| m.len())
            .map_err(|e| AppError::file(format!("could not stat backup file: {e}")))
    })();

    if result.is_err() {
        let _ = fs::remove_file(&staging);
    }
    result
}

/// Creates a managed backup in `backups_dir`, records it in the `backups` table,
/// verifies the snapshot and logs the operation.
///
/// `backup_type` controls the on-disk file name prefix:
///   - `BackupType::Full`   -> `Manual_Backup_<timestamp>.db`
///   - `BackupType::Database`-> `Auto_Backup_<timestamp>.db`
pub fn create_backup(
    conn: &Connection,
    backups_dir: &Path,
    actor: Option<i64>,
    backup_type: BackupType,
) -> Result<Backup, AppError> {
    fs::create_dir_all(backups_dir)
        .map_err(|e| AppError::file(format!("could not create backup directory: {e}")))?;

    let prefix = match backup_type {
        BackupType::Full => "Manual_Backup",
        BackupType::Database => "Auto_Backup",
        BackupType::Selective => "Selective_Backup",
    };
    let stamp = display_timestamp();
    let mut file_name = format!("{prefix}_{stamp}.db");
    let mut destination = backups_dir.join(&file_name);
    let mut n = 1;
    while destination.exists() {
        file_name = format!("{prefix}_{stamp}_{n}.db");
        destination = backups_dir.join(&file_name);
        n += 1;
    }

    let all_modules = all_module_ids();
    let size = write_single_file_backup(conn, &destination, backup_type, &all_modules)? as i64;

    if let Err(e) = verify_backup_entry(&destination) {
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
        &format!("A backup was created: {file_name}"),
    )?;

    backup_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::Internal("Created backup could not be retrieved".into()))
}

pub fn create_selective_backup(
    conn: &Connection,
    backups_dir: &Path,
    actor: Option<i64>,
    modules: Vec<String>,
) -> Result<Backup, AppError> {
    if modules.is_empty() {
        return Err(AppError::validation("Select at least one module"));
    }
    tables_for_modules(&modules)?;
    fs::create_dir_all(backups_dir)
        .map_err(|e| AppError::file(format!("could not create backup directory: {e}")))?;
    let stamp = display_timestamp();
    let mut file_name = format!("Selective_Backup_{stamp}.db");
    let mut destination = backups_dir.join(&file_name);
    let mut n = 1;
    while destination.exists() {
        file_name = format!("Selective_Backup_{stamp}_{n}.db");
        destination = backups_dir.join(&file_name);
        n += 1;
    }
    let size = write_single_file_backup(conn, &destination, BackupType::Selective, &modules)? as i64;
    verify_backup_entry(&destination)?;
    let id = backup_repository::insert(
        conn,
        &file_name,
        BackupType::Selective,
        &destination.to_string_lossy(),
        size,
        BackupStatus::Success,
        actor,
    )?;
    services::record_activity(conn, actor, "backup", "create_selective", Some(id))?;
    backup_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::Internal("Created backup could not be retrieved".into()))
}

pub fn inspect_backup(path: &Path) -> Result<BackupInspection, AppError> {
    validate_archive(path)?;
    if is_zip_backup(path) {
        let file = fs::File::open(path)
            .map_err(|e| AppError::file(format!("could not open backup archive: {e}")))?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| AppError::validation(format!("Invalid backup archive: {e}")))?;
        if let Ok(mut entry) = archive.by_name(MANIFEST_NAME) {
            let mut text = String::new();
            entry
                .read_to_string(&mut text)
                .map_err(|e| AppError::validation(format!("Invalid backup metadata: {e}")))?;
            let value: serde_json::Value = serde_json::from_str(&text)
                .map_err(|e| AppError::validation(format!("Invalid backup metadata: {e}")))?;
            return Ok(inspection_from_manifest(&value)?);
        }
        return Ok(BackupInspection {
            backup_type: BackupType::Full,
            created_at: None,
            modules: vec![],
            app_version: None,
        });
    }
    // Current single-file format (or an older raw snapshot): the manifest, if any,
    // is embedded inside the SQLite file itself.
    let conn = Connection::open(path)
        .map_err(|e| AppError::validation(format!("Invalid backup file: {e}")))?;
    let manifest: Option<String> = conn
        .query_row(
            &format!("SELECT value FROM {META_TABLE} WHERE key=?1"),
            [MANIFEST_META_KEY],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| AppError::validation(format!("Invalid backup metadata: {e}")))?;
    let Some(text) = manifest else {
        return Ok(BackupInspection {
            backup_type: BackupType::Full,
            created_at: None,
            modules: vec![],
            app_version: None,
        });
    };
    let value: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| AppError::validation(format!("Invalid backup metadata: {e}")))?;
    Ok(inspection_from_manifest(&value)?)
}

pub fn list_backups(conn: &Connection) -> Result<Vec<Backup>, AppError> {
    backup_repository::list(conn)
}

pub fn get_backup(conn: &Connection, id: i64) -> Result<Option<Backup>, AppError> {
    backup_repository::get_by_id(conn, id)
}

/// Removes both the metadata row and the backup file on disk.
pub fn delete_backup(conn: &Connection, actor: Option<i64>, id: i64) -> Result<(), AppError> {
    let item = backup_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::validation(format!("Backup #{id} not found")))?;

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

/// Copies the current license settings out of the live connection so they can be
/// restored afterwards. Returns an empty list when no license is active.
fn capture_license_settings(conn: &Connection) -> Result<Vec<(String, String)>, AppError> {
    let mut captured = Vec::new();
    for key in LICENSE_KEYS {
        if let Some(value) = settings_repository::get(conn, key)? {
            captured.push((key.to_string(), value));
        }
    }
    Ok(captured)
}

/// Removes any license settings brought in by the restored backup and re-applies
/// the machine's current activation state. A backup can therefore never inject,
/// replace or clear the license that was active on this installation.
fn reapply_license_settings(
    conn: &Connection,
    captured: &[(String, String)],
) -> Result<(), AppError> {
    conn.execute("DELETE FROM settings WHERE key LIKE 'license_%';", [])?;
    for (key, value) in captured {
        settings_repository::set(conn, key, value)?;
    }
    Ok(())
}

/// Stages a backup snapshot into a temp file and upgrades it to the *current*
/// schema by running any pending migrations. The live database is not touched
/// until the snapshot has been fully migrated and verified, so a migration
/// failure (or any other problem) aborts the restore and keeps the current data
/// intact — never a partial restore.
///
/// Returns the path to the migrated staging file; the caller is responsible for
/// removing it.
fn stage_for_restore(snapshot: &Path) -> Result<PathBuf, AppError> {
    let staged = std::env::temp_dir().join(format!("bms_restore_staged_{}.db", unique_token()));
    if let Err(e) = fs::copy(snapshot, &staged) {
        let _ = fs::remove_file(&staged);
        return Err(AppError::file(format!("could not stage backup snapshot: {e}")));
    }

    let result = (|| -> Result<(), AppError> {
        let staging = Connection::open(&staged).map_err(|e| {
            AppError::file(format!("could not open staged backup snapshot: {e}"))
        })?;
        migrations::run(&staging)?;
        drop(staging);
        verify_backup(&staged)
    })();

    if let Err(e) = result {
        let _ = fs::remove_file(&staged);
        return Err(e);
    }
    Ok(staged)
}

/// Restores the database contents from a stored backup into the live connection.
///
/// The backup (a legacy `.zip` archive or a single-file `.db`/`.db` snapshot) is
/// validated first, and an emergency safety copy of the current data is written to
/// `backups_dir` before the restore touches anything.
pub fn restore_backup(
    conn: &mut Connection,
    backups_dir: &Path,
    actor: Option<i64>,
    source: &Path,
) -> Result<(), AppError> {
    let is_zip = is_zip_backup(source);
    let inspection = inspect_backup(source)?;
    let snapshot = if is_zip {
        extract_snapshot(source)?
    } else {
        source.to_path_buf()
    };

    verify_backup(&snapshot)?;

    // Capture the machine's current license before the restore can replace the
    // settings table; it is re-applied after the swap completes.
    let license = capture_license_settings(conn)?;

    // Emergency safety backup (best-effort): never proceed without one if we can help it.
    fs::create_dir_all(backups_dir)
        .map_err(|e| AppError::file(format!("could not create backup directory: {e}")))?;
    let safety_path = backups_dir.join(format!("pre_restore_{}.db", timestamp()));
    if let Err(e) = write_backup(conn, &safety_path) {
        log::warn!("could not create emergency backup before restore: {e}");
    }

    if inspection.backup_type == BackupType::Selective {
        let ids: Vec<String> = inspection.modules.iter().map(|m| m.id.clone()).collect();
        let attachment_only = ids.iter().any(|id| id == "images_attachments");
        let regular_ids: Vec<String> = ids
            .iter()
            .filter(|id| id.as_str() != "images_attachments")
            .cloned()
            .collect();
        let tables = tables_for_modules(&regular_ids)?;
        conn.execute_batch("PRAGMA foreign_keys=OFF;")?;
        conn.execute(
            "ATTACH DATABASE ?1 AS selective_backup",
            [snapshot.to_string_lossy().as_ref()],
        )?;
        let result = (|| -> Result<(), AppError> {
            let tx = conn.transaction()?;
            for table in tables.iter().rev() {
                tx.execute(&format!("DELETE FROM \"{table}\""), [])?;
            }
            for table in &tables {
                let mut stmt = tx.prepare(&format!("PRAGMA main.table_info(\"{table}\")"))?;
                let live: Vec<String> = stmt
                    .query_map([], |r| r.get(1))?
                    .collect::<Result<_, _>>()?;
                let mut stmt =
                    tx.prepare(&format!("PRAGMA selective_backup.table_info(\"{table}\")"))?;
                let source_cols: Vec<String> = stmt
                    .query_map([], |r| r.get(1))?
                    .collect::<Result<_, _>>()?;
                let cols: Vec<String> = live
                    .into_iter()
                    .filter(|c| source_cols.contains(c))
                    .collect();
                if cols.is_empty() {
                    return Err(AppError::validation(format!(
                        "Backup module table is incompatible: {table}"
                    )));
                }
                let quoted = cols
                    .iter()
                    .map(|c| format!("\"{c}\""))
                    .collect::<Vec<_>>()
                    .join(",");
                tx.execute(&format!("INSERT INTO main.\"{table}\" ({quoted}) SELECT {quoted} FROM selective_backup.\"{table}\""), [])?;
            }
            if attachment_only {
                if !tables.contains(&"members") {
                    tx.execute_batch("UPDATE members SET image_path=(SELECT image_path FROM selective_backup.members b WHERE b.id=members.id) WHERE id IN (SELECT id FROM selective_backup.members);")?;
                }
                if !tables.contains(&"expenses") {
                    tx.execute_batch("UPDATE expenses SET receipt_path=(SELECT receipt_path FROM selective_backup.expenses b WHERE b.id=expenses.id) WHERE id IN (SELECT id FROM selective_backup.expenses);")?;
                }
                if !tables.contains(&"settings") {
                    tx.execute_batch("INSERT INTO settings(key,value) SELECT key,value FROM selective_backup.settings WHERE key='shop_logo' ON CONFLICT(key) DO UPDATE SET value=excluded.value;")?;
                }
            }
            tx.commit()?;
            Ok(())
        })();
        let _ = conn.execute_batch("DETACH DATABASE selective_backup; PRAGMA foreign_keys=ON;");
        result?;
    } else {
        // Full/database restore: migrate the snapshot to the current schema in a
        // staging file *first*, so the live database is never exposed to an older
        // schema and a failed migration can never damage the current data.
        let staged = stage_for_restore(&snapshot)?;
        let result = conn
            .restore(
                DatabaseName::Main,
                &staged,
                None::<fn(rusqlite::backup::Progress)>,
            )
            .map_err(|e| AppError::file(format!("failed to restore: {e}")));
        let _ = fs::remove_file(&staged);
        result?;
    }

    // A single-file `.db` carries its manifest/product images in the embedded
    // `__bms_backup_*` tables. Strip them now so they never linger in the live DB.
    let _ = conn.execute_batch(&format!(
        "DROP TABLE IF EXISTS {META_TABLE}; DROP TABLE IF EXISTS {FILES_TABLE};"
    ));

    // Re-apply the current license state so the restore cannot change (or import)
    // the activation of this machine.
    reapply_license_settings(conn, &license)?;

    let restore_product_assets = inspection.backup_type != BackupType::Selective
        || inspection.modules.iter().any(|m| {
            matches!(
                m.id.as_str(),
                "mobile_phones" | "accessories" | "images_attachments"
            )
        });
    if restore_product_assets {
        let db_file: Option<String> = conn
            .query_row(
                "SELECT file FROM pragma_database_list WHERE name='main'",
                [],
                |r| r.get(0),
            )
            .ok();
        if let Some(root) = db_file.and_then(|p| PathBuf::from(p).parent().map(Path::to_path_buf)) {
            if is_zip {
                // Legacy `.zip` backups store product images as archive entries.
                let file = fs::File::open(source)
                    .map_err(|e| AppError::file(format!("could not open backup archive: {e}")))?;
                let mut archive = zip::ZipArchive::new(file)
                    .map_err(|e| AppError::validation(format!("Invalid backup archive: {e}")))?;
                for i in 0..archive.len() {
                    let mut entry = archive
                        .by_index(i)
                        .map_err(|e| AppError::validation(format!("Invalid image entry: {e}")))?;
                    let name = entry.name().replace('\\', "/");
                    if name.starts_with("product_images/")
                        && !name.contains("..")
                        && !name.ends_with('/')
                    {
                        let target = root.join(&name);
                        if let Some(parent) = target.parent() {
                            fs::create_dir_all(parent).map_err(|e| {
                                AppError::file(format!("could not restore image folder: {e}"))
                            })?;
                        }
                        let mut out = fs::File::create(target).map_err(|e| {
                            AppError::file(format!("could not restore product image: {e}"))
                        })?;
                        std::io::copy(&mut entry, &mut out).map_err(|e| {
                            AppError::file(format!("could not restore product image: {e}"))
                        })?;
                    }
                }
            } else {
                // Current single-file `.db`: product images are BLOBs inside the
                // snapshot's `__bms_backup_files` table.
                let embedded = Connection::open_with_flags(
                    source,
                    rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
                )
                .map_err(|e| AppError::validation(format!("Invalid backup file: {e}")))?;
                let mut stmt = embedded
                    .prepare(&format!(
                        "SELECT path, data FROM {FILES_TABLE} WHERE path LIKE 'product_images/%'"
                    ))
                    .map_err(|_| {
                        AppError::validation("Backup does not contain product images")
                    })?;
                let rows = stmt
                    .query_map([], |row| {
                        Ok((row.get::<_, String>(0)?, row.get::<_, Vec<u8>>(1)?))
                    })
                    .map_err(|e| AppError::validation(format!("Invalid image data: {e}")))?;
                for row in rows {
                    let (name, data) = row
                        .map_err(|e| AppError::validation(format!("Invalid image data: {e}")))?;
                    if name.starts_with("product_images/")
                        && !name.contains("..")
                        && !name.ends_with('/')
                    {
                        let target = root.join(&name);
                        if let Some(parent) = target.parent() {
                            fs::create_dir_all(parent).map_err(|e| {
                                AppError::file(format!("could not restore image folder: {e}"))
                            })?;
                        }
                        fs::write(&target, data).map_err(|e| {
                            AppError::file(format!("could not restore product image: {e}"))
                        })?;
                    }
                }
            }
        }
    }

    // Clean up the extracted snapshot temp file if we created one.
    if snapshot != source {
        let _ = fs::remove_file(&snapshot);
    }

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

const fn default_interval() -> i64 {
    DEFAULT_INTERVAL_MINUTES
}

/// Loads the automatic-backup configuration. Missing keys fall back to defaults
/// (enabled, 30 minutes, Desktop/Software Backup).
pub fn get_config(conn: &Connection) -> Result<BackupConfig, AppError> {
    let enabled = settings_repository::get(conn, KEY_AUTO_ENABLED)?
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(true);
    let interval = settings_repository::get(conn, KEY_INTERVAL)?
        .and_then(|v| v.parse::<i64>().ok())
        .filter(|v| *v >= 1)
        .unwrap_or(default_interval());
    let folder = match settings_repository::get(conn, KEY_FOLDER)? {
        Some(f) if !f.trim().is_empty() => PathBuf::from(f),
        _ => desktop_folder().unwrap_or_else(|_| std::env::temp_dir().join("Software Backup")),
    };
    let frequency = settings_repository::get(conn, KEY_FREQUENCY)?
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| {
            if matches!(interval, 10 | 30 | 60 | 180) {
                interval.to_string()
            } else {
                FREQ_CUSTOM.to_string()
            }
        });

    Ok(BackupConfig {
        auto_backup_enabled: enabled,
        auto_backup_interval_minutes: interval,
        backup_folder: folder.to_string_lossy().to_string(),
        backup_frequency: frequency,
    })
}

/// Saves the automatic-backup configuration.
pub fn update_config(
    conn: &Connection,
    actor: Option<i64>,
    input: UpdateBackupConfigInput,
) -> Result<BackupConfig, AppError> {
    let interval = input
        .auto_backup_interval_minutes
        .clamp(MIN_INTERVAL, MAX_INTERVAL);
    settings_repository::set(
        conn,
        KEY_AUTO_ENABLED,
        if input.auto_backup_enabled { "1" } else { "0" },
    )?;
    settings_repository::set(conn, KEY_INTERVAL, &interval.to_string())?;

    if let Some(freq) = input.backup_frequency {
        if !freq.trim().is_empty()
            && [FREQ_EVERY_TIME, FREQ_CUSTOM, "10", "30", "60", "180"].contains(&freq.as_str())
        {
            settings_repository::set(conn, KEY_FREQUENCY, &freq)?;
        }
    }

    let folder = input
        .backup_folder
        .filter(|v| !v.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            desktop_folder().unwrap_or_else(|_| std::env::temp_dir().join("Software Backup"))
        });
    fs::create_dir_all(&folder)
        .map_err(|e| AppError::file(format!("could not create backup folder: {e}")))?;
    settings_repository::set(conn, KEY_FOLDER, &folder.to_string_lossy())?;

    services::record_activity(conn, actor, "backup", "update_config", None)?;
    get_config(conn)
}

/// Resolves the effective backup directory for creating backups: the configured
/// folder, defaulting to Desktop/Software Backup when not set.
pub fn backup_dir(conn: &Connection) -> Result<PathBuf, AppError> {
    get_config(conn).map(|c| PathBuf::from(&c.backup_folder))
}

/// Records a backup file (already written and verified by its caller) into the
/// backups history table so it appears in the Backup Manager list. Used by the
/// on-close backup, which writes the `.db` file separately.
pub fn record_exit_backup(
    conn: &Connection,
    file_name: &str,
    file_path: &Path,
    size: i64,
) -> Result<(), AppError> {
    backup_repository::insert(
        conn,
        file_name,
        BackupType::Database,
        &file_path.to_string_lossy(),
        size,
        BackupStatus::Success,
        None,
    )?;
    Ok(())
}

/// Aggregate status info for the Backup UI.
pub fn status_info(conn: &Connection) -> Result<BackupStatusInfo, AppError> {
    let config = get_config(conn)?;
    let total = backup_repository::count(conn)?;
    let latest = backup_repository::latest(conn)?;
    Ok(BackupStatusInfo {
        config,
        last_backup_at: latest.as_ref().map(|b| b.created_at.clone()),
        total_backups: total,
        last_backup_file: latest.map(|b| b.file_name),
    })
}

/// Spawns the automatic backup background loop. Runs forever, re-reads the stored
/// configuration every ~30s (so interval/enable changes apply without restart) and
/// creates an `Auto_Backup_*.db` on the configured folder. A single failed tick is
/// logged and the loop continues so an unexpected error can never stop future backups.
///
/// Frequency handling:
///   - `every_time` performs an immediate backup at startup and then idles (no periodic
///     repeat); "every time" is event-driven (app launch + the existing exit backup).
///   - any numeric interval (preset or custom) backs up on that schedule.
pub fn spawn_auto_backup(handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut first_run = true;
        loop {
            let Some(db) = handle.try_state::<crate::database::Database>() else {
                std::thread::sleep(std::time::Duration::from_secs(30));
                continue;
            };
            let Ok(conn) = db.conn.lock() else {
                std::thread::sleep(std::time::Duration::from_secs(30));
                continue;
            };
            let cfg = match get_config(&conn) {
                Ok(cfg) => cfg,
                Err(e) => {
                    log::error!("auto-backup: could not read config: {e}");
                    drop(conn);
                    drop(db);
                    std::thread::sleep(std::time::Duration::from_secs(30));
                    continue;
                }
            };
            if !cfg.auto_backup_enabled {
                drop(conn);
                drop(db);
                first_run = false;
                std::thread::sleep(std::time::Duration::from_secs(30));
                continue;
            }

            let every_time = cfg.backup_frequency == FREQ_EVERY_TIME;
            let do_now = first_run || !every_time;
            drop(conn);
            drop(db);

            if do_now {
                let result = (|| {
                    let db = handle
                        .try_state::<crate::database::Database>()
                        .ok_or_else(|| AppError::Internal("database state unavailable".into()))?;
                    let conn = db
                        .conn
                        .lock()
                        .map_err(|_| AppError::Internal("database is locked".into()))?;
                    let dir = backup_dir(&conn).or_else(|_| desktop_folder())?;
                    let backup = create_backup(&conn, &dir, None, BackupType::Database)?;
                    Ok::<Backup, AppError>(backup)
                })();
                match result {
                    Ok(b) => log::info!("Auto backup created: {}", b.file_name),
                    Err(e) => log::error!("Auto backup failed: {e}"),
                }
            }

            first_run = false;

            // Sleep the configured interval, or idle briefly in "every_time" mode.
            let sleep = if every_time {
                30
            } else {
                cfg.auto_backup_interval_minutes.max(1) as u64 * 60
            };
            std::thread::sleep(std::time::Duration::from_secs(sleep));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{migrations, seed};
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
        assert!(backup.file_name.starts_with("Auto_Backup_"));
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

        verify_backup_entry(dest).expect("valid backup verifies");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn manual_backup_uses_manual_prefix() {
        let conn = test_utils::in_memory_conn();
        let dir = temp_dir("manual_prefix");
        let backup = create_backup(&conn, &dir, None, BackupType::Full).expect("backup");
        assert!(backup.file_name.starts_with("Manual_Backup_"));
        assert!(backup.file_name.ends_with(".db"));
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn restore_roundtrips_snapshot() {
        let dir = temp_dir("restore");
        let db_path = dir.join("live.db");
        let mut conn = Connection::open(&db_path).unwrap();
        migrations::run(&conn).unwrap();
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

        drop(conn);
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

        // A corrupted archive must fail verification.
        let backup = create_backup(&conn, &dir, None, BackupType::Database).expect("backup");
        let dest = Path::new(&backup.file_path);

        // Overwrite the file start so the SQLite header is corrupt.
        let bytes = fs::read(dest).unwrap();
        let mut corrupted = bytes.clone();
        if !corrupted.is_empty() {
            let n = corrupted.len().min(10);
            for b in corrupted[..n].iter_mut() {
                *b = 0x00;
            }
        }
        fs::write(dest, &corrupted).unwrap();
        assert!(
            verify_backup_entry(dest).is_err(),
            "corrupted archive must fail verification"
        );
        assert!(
            validate_archive(dest).is_err(),
            "corrupted archive must fail validation"
        );

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

    #[test]
    fn restore_older_backup_applies_required_migrations() {
        let dir = temp_dir("cross_version");
        let v1_path = dir.join("v1.db");
        let v2_path = dir.join("v2.db");

        // Build the older-version (V1) database exactly as a client had it before
        // migration 0035 (sale_items.cost_price) shipped: older schema + real data.
        let backup;
        {
            let v1 = Connection::open(&v1_path).unwrap();
            migrations::run_upto(&v1, 34).unwrap();
            seed::seed(&v1).unwrap();
            v1.execute(
                "INSERT INTO phones (brand, model, quantity, cost_price, sale_price)
                 VALUES ('Nokia', '1100', 5, 400.0, 650.0)",
                [],
            )
            .unwrap();
            v1.execute(
                "INSERT INTO sales (receipt_no, total_amount, paid_amount)
                 VALUES ('R-001', 650.0, 650.0)",
                [],
            )
            .unwrap();
            v1.execute(
                "INSERT INTO sale_items (sale_id, phone_id, quantity, unit_price)
                 VALUES (1, 1, 1, 650.0)",
                [],
            )
            .unwrap();
            v1.execute(
                "INSERT INTO sale_payments (sale_id, amount, payment_method)
                 VALUES (1, 650.0, 'cash')",
                [],
            )
            .unwrap();
            v1.execute(
                "INSERT INTO members (name, phone) VALUES ('Old Customer', '03001234567')",
                [],
            )
            .unwrap();
            v1.execute(
                "INSERT INTO settings (key, value) VALUES ('shop_name', 'Old Shop')",
                [],
            )
            .unwrap();
            v1.execute(
                "INSERT INTO settings (key, value) VALUES ('license_key', 'OLD-KEY')",
                [],
            )
            .unwrap();

            // Sanity check: the old database has no cost_price column yet.
            let cols: Vec<String> = v1
                .prepare("PRAGMA table_info('sale_items')")
                .unwrap()
                .query_map([], |r| r.get(1))
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap();
            assert!(!cols.contains(&"cost_price".to_string()));

            backup = create_backup(&v1, &dir, None, BackupType::Database).expect("backup");
        }

        // Current (V2) database: full migration set, seeded, holding this machine's
        // license plus a V2-only value that a restore must overwrite.
        {
            let v2 = Connection::open(&v2_path).unwrap();
            migrations::run(&v2).unwrap();
            seed::seed(&v2).unwrap();
            v2.execute(
                "INSERT INTO settings (key, value) VALUES ('v2_marker', 'present')",
                [],
            )
            .unwrap();
            v2.execute(
                "INSERT INTO settings (key, value) VALUES ('license_key', 'NEW-KEY')",
                [],
            )
            .unwrap();
            v2.execute(
                "INSERT INTO settings (key, value) VALUES ('license_customer', 'Current Customer')",
                [],
            )
            .unwrap();

            let mut v2 = v2;
            restore_backup(&mut v2, &dir, None, Path::new(&backup.file_path)).expect("restore");

            // The V2-only marker was replaced by the (older) backup's settings.
            let marker: Option<String> = v2
                .query_row(
                    "SELECT value FROM settings WHERE key='v2_marker'",
                    [],
                    |r| r.get(0),
                )
                .optional()
                .unwrap();
            assert!(marker.is_none(), "restore must replace V2 data");

            // Old business data came back intact.
            let shop_name: String = v2
                .query_row(
                    "SELECT value FROM settings WHERE key='shop_name'",
                    [],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(shop_name, "Old Shop");
            let phones: i64 = v2
                .query_row("SELECT COUNT(*) FROM phones", [], |r| r.get(0))
                .unwrap();
            assert_eq!(phones, 1);
            let member: String = v2
                .query_row(
                    "SELECT name FROM members WHERE id=1",
                    [],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(member, "Old Customer");

            // Required migration 0035 was applied: cost_price exists and backfilled.
            let cols: Vec<String> = v2
                .prepare("PRAGMA table_info('sale_items')")
                .unwrap()
                .query_map([], |r| r.get(1))
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap();
            assert!(cols.contains(&"cost_price".to_string()));
            let cost: f64 = v2
                .query_row(
                    "SELECT cost_price FROM sale_items WHERE id=1",
                    [],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(cost, 400.0);
            let versions: i64 = v2
                .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
                .unwrap();
            assert_eq!(versions, 39);

            // License preserved: the backup cannot replace this machine's activation.
            let license_key: String = v2
                .query_row(
                    "SELECT value FROM settings WHERE key='license_key'",
                    [],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(license_key, "NEW-KEY");
            let license_customer: String = v2
                .query_row(
                    "SELECT value FROM settings WHERE key='license_customer'",
                    [],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(license_customer, "Current Customer");
        }

        // Simulate the required application restart: reopen the restored file and
        // run migrations + seed again (like startup). Everything survives.
        {
            let conn = Connection::open(&v2_path).unwrap();
            migrations::run(&conn).unwrap();
            seed::seed(&conn).unwrap();
            let shop_name: String = conn
                .query_row(
                    "SELECT value FROM settings WHERE key='shop_name'",
                    [],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(shop_name, "Old Shop");
            let receipts: Vec<String> = conn
                .prepare("SELECT receipt_no FROM sales")
                .unwrap()
                .query_map([], |r| r.get(0))
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap();
            assert_eq!(receipts, vec!["R-001".to_string()]);
            let license_key: String = conn
                .query_row(
                    "SELECT value FROM settings WHERE key='license_key'",
                    [],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(license_key, "NEW-KEY");
        }

        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn failed_restore_migration_keeps_current_database() {
        let dir = temp_dir("cross_version_failure");
        let stale_path = dir.join("stale.db");
        let live_path = dir.join("live.db");

        // A snapshot whose schema is just ahead of its bookkeeping: the cost_price
        // column already exists but its migration row is missing, so staging re-runs
        // 0035 and the ALTER TABLE (duplicate column) fails. The failure must abort
        // before the live database is touched.
        let backup;
        {
            let stale = Connection::open(&stale_path).unwrap();
            migrations::run(&stale).unwrap();
            stale.execute(
                "DELETE FROM schema_migrations WHERE version='0035_sale_item_cost_price'",
                [],
            )
            .unwrap();
            backup = create_backup(&stale, &dir, None, BackupType::Database).expect("backup");
        }

        let mut live = Connection::open(&live_path).unwrap();
        migrations::run(&live).unwrap();
        live.execute(
            "INSERT INTO settings (key, value) VALUES ('survivor', 'intact')",
            [],
        )
        .unwrap();

        let result = restore_backup(&mut live, &dir, None, Path::new(&backup.file_path));
        assert!(result.is_err(), "restore must fail when the migration fails");

        // The current working database is fully intact.
        let value: String = live
            .query_row(
                "SELECT value FROM settings WHERE key='survivor'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(value, "intact");

        drop(live);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn single_file_backup_embeds_manifest_and_images() {
        let dir = temp_dir("single_file");
        let db_path = dir.join("live.db");
        let mut conn = Connection::open(&db_path).unwrap();
        migrations::run(&conn).unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('shop_name', 'ACME')",
            [],
        )
        .unwrap();

        // A real product image sitting next to the database.
        let images = dir.join("product_images");
        fs::create_dir_all(&images).unwrap();
        let img_bytes = vec![0x89u8, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 1, 2, 3, 4, 5];
        fs::write(images.join("iphone.png"), &img_bytes).unwrap();

        let backup = create_backup(&conn, &dir, None, BackupType::Full).expect("backup");
        let dest = PathBuf::from(&backup.file_path);

        // The backup is a genuine single SQLite file (not an archive), carrying the
        // manifest and the product image inside itself.
        assert!(!is_zip_backup(&dest));
        let probe = Connection::open(&dest).unwrap();
        let meta: i64 = probe
            .query_row(&format!("SELECT COUNT(*) FROM {META_TABLE}"), [], |r| r.get(0))
            .unwrap();
        assert_eq!(meta, 1);
        let files: i64 = probe
            .query_row(&format!("SELECT COUNT(*) FROM {FILES_TABLE}"), [], |r| r.get(0))
            .unwrap();
        assert_eq!(files, 1);
        let blob: Vec<u8> = probe
            .query_row(
                &format!("SELECT data FROM {FILES_TABLE} WHERE path='product_images/iphone.png'"),
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(blob, img_bytes);
        drop(probe);

        // Inspection reads the embedded manifest.
        let inspection = inspect_backup(&dest).expect("inspect");
        assert_eq!(inspection.backup_type, BackupType::Full);
        assert!(inspection.created_at.is_some());

        // Delete the image + corrupt the setting, restore, and both come back with
        // the embedded helper tables removed from the live DB.
        fs::remove_file(images.join("iphone.png")).unwrap();
        conn.execute(
            "UPDATE settings SET value='broken' WHERE key='shop_name'",
            [],
        )
        .unwrap();
        restore_backup(&mut conn, &dir, None, &dest).expect("restore");
        assert!(images.join("iphone.png").exists());
        assert_eq!(fs::read(images.join("iphone.png")).unwrap(), img_bytes);
        let shop: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key='shop_name'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(shop, "ACME");
        let leftovers: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE name IN ('__bms_backup_meta', '__bms_backup_files')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(leftovers, 0);

        drop(conn);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn legacy_zip_backup_still_restores() {
        let dir = temp_dir("legacy_zip");
        let live_path = dir.join("live.db");
        let mut conn = Connection::open(&live_path).unwrap();
        migrations::run(&conn).unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('shop_name', 'current')",
            [],
        )
        .unwrap();

        // Build a legacy .zip backup exactly as older clients did: a DB snapshot
        // entry (no manifest, no embedded tables).
        let snapshot_path = dir.join("snapshot.db");
        let backup_zip = dir.join("Auto_Backup_2020-01-01_00-00-00.zip");
        {
            let v1 = Connection::open(&snapshot_path).unwrap();
            migrations::run(&v1).unwrap();
            v1.execute(
                "INSERT INTO settings (key, value) VALUES ('shop_name', 'Legacy Shop')",
                [],
            )
            .unwrap();
            drop(v1);

            let file = fs::File::create(&backup_zip).unwrap();
            let mut writer = zip::ZipWriter::new(file);
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated);
            writer.start_file(SNAPSHOT_NAME, options).unwrap();
            let mut snap = fs::File::open(&snapshot_path).unwrap();
            std::io::copy(&mut snap, &mut writer).unwrap();
            writer.finish().unwrap();
        }

        assert!(is_zip_backup(&backup_zip));
        restore_backup(&mut conn, &dir, None, &backup_zip).expect("legacy zip restores");

        let value: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key='shop_name'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(value, "Legacy Shop");

        drop(conn);
        fs::remove_dir_all(dir).unwrap();
    }
}
