use rusqlite::{Connection, OptionalExtension};

use crate::errors::AppError;
use crate::models::backup::{Backup, BackupStatus, BackupType};

pub fn insert(
    conn: &Connection,
    file_name: &str,
    backup_type: BackupType,
    file_path: &str,
    size: i64,
    status: BackupStatus,
    created_by: Option<i64>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO backups (file_name, backup_type, file_path, size, status, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            file_name,
            backup_type.as_str(),
            file_path,
            size,
            status.as_str(),
            created_by
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn from_row(r: &rusqlite::Row) -> Result<Backup, rusqlite::Error> {
    Ok(Backup {
        id: r.get(0)?,
        file_name: r.get(1)?,
        backup_type: BackupType::from_str(&r.get::<_, String>(2)?),
        file_path: r.get(3)?,
        size: r.get(4)?,
        status: BackupStatus::from_str(&r.get::<_, String>(5)?),
        created_by: r.get(6)?,
        created_at: r.get(7)?,
    })
}

pub fn list(conn: &Connection) -> Result<Vec<Backup>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, file_name, backup_type, file_path, size, status, created_by, created_at
         FROM backups
         ORDER BY created_at DESC, id DESC",
    )?;
    let rows = stmt
        .query_map([], |r| from_row(r))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<Backup>, AppError> {
    conn.query_row(
        "SELECT id, file_name, backup_type, file_path, size, status, created_by, created_at
         FROM backups
         WHERE id = ?1",
        [id],
        |r| from_row(r),
    )
    .optional()
    .map_err(AppError::from)
}

pub fn delete(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute("DELETE FROM backups WHERE id = ?1", [id])?;
    Ok(affected > 0)
}

/// Returns the most recently created backup, if any.
pub fn latest(conn: &Connection) -> Result<Option<Backup>, AppError> {
    conn.query_row(
        "SELECT id, file_name, backup_type, file_path, size, status, created_by, created_at
         FROM backups
         ORDER BY created_at DESC, id DESC
         LIMIT 1",
        [],
        |r| from_row(r),
    )
    .optional()
    .map_err(AppError::from)
}

// Used by tests; part of the public repository API.
#[cfg_attr(not(test), allow(dead_code))]
pub fn count(conn: &Connection) -> Result<i64, AppError> {
    let n: i64 = conn.query_row("SELECT COUNT(*) FROM backups", [], |r| r.get(0))?;
    Ok(n)
}