use rusqlite::{Connection, OptionalExtension};

use crate::errors::AppError;
use crate::models::notification::{AppNotification, CreateNotificationInput};

pub fn insert(conn: &Connection, input: &CreateNotificationInput) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO notifications (user_id, title, message, type, priority)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            input.user_id,
            input.title,
            input.message.as_deref(),
            input.kind,
            input.priority
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn from_row(r: &rusqlite::Row) -> Result<AppNotification, rusqlite::Error> {
    Ok(AppNotification {
        id: r.get(0)?,
        user_id: r.get(1)?,
        title: r.get(2)?,
        message: r.get(3)?,
        kind: r.get(4)?,
        priority: r.get(5)?,
        is_read: r.get::<_, i64>(6)? != 0,
        read_at: r.get(7)?,
        created_at: r.get(8)?,
    })
}

pub fn list(
    conn: &Connection,
    user_id: i64,
    unread_only: bool,
    limit: i64,
) -> Result<Vec<AppNotification>, AppError> {
    let sql = if unread_only {
        "SELECT id, user_id, title, message, type, priority, is_read, read_at, created_at
         FROM notifications
         WHERE user_id = ?1 AND is_read = 0
         ORDER BY created_at DESC, id DESC
         LIMIT ?2"
    } else {
        "SELECT id, user_id, title, message, type, priority, is_read, read_at, created_at
         FROM notifications
         WHERE user_id = ?1
         ORDER BY created_at DESC, id DESC
         LIMIT ?2"
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt
        .query_map(rusqlite::params![user_id, limit], |r| from_row(r))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn get_for_user(conn: &Connection, notification_id: i64, user_id: i64) -> Result<Option<AppNotification>, AppError> {
    conn.query_row(
        "SELECT id, user_id, title, message, type, priority, is_read, read_at, created_at
         FROM notifications
         WHERE id = ?1 AND user_id = ?2",
        rusqlite::params![notification_id, user_id],
        |r| from_row(r),
    )
    .optional()
    .map_err(AppError::from)
}

pub fn unread_count(conn: &Connection, user_id: i64) -> Result<i64, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notifications WHERE user_id = ?1 AND is_read = 0",
        [user_id],
        |r| r.get(0),
    )?;
    Ok(n)
}

pub fn mark_read(conn: &Connection, notification_id: i64, user_id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND user_id = ?2",
        rusqlite::params![notification_id, user_id],
    )?;
    Ok(affected > 0)
}

pub fn mark_all_read(conn: &Connection, user_id: i64) -> Result<i64, AppError> {
    let affected = conn.execute(
        "UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP
         WHERE user_id = ?1 AND is_read = 0",
        [user_id],
    )?;
    Ok(affected as i64)
}

pub fn delete(conn: &Connection, notification_id: i64, user_id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "DELETE FROM notifications WHERE id = ?1 AND user_id = ?2",
        rusqlite::params![notification_id, user_id],
    )?;
    Ok(affected > 0)
}

pub fn delete_all_read(conn: &Connection, user_id: i64) -> Result<i64, AppError> {
    let affected = conn.execute(
        "DELETE FROM notifications WHERE user_id = ?1 AND is_read = 1",
        [user_id],
    )?;
    Ok(affected as i64)
}

/// Deletes a user's notifications (used for cleanup/archive older than an offset).
pub fn delete_older_than(conn: &Connection, user_id: i64, days: i64) -> Result<i64, AppError> {
    let affected = conn.execute(
        "DELETE FROM notifications
         WHERE user_id = ?1 AND created_at < datetime('now', ?2)",
        rusqlite::params![user_id, format!("-{days} days")],
    )?;
    Ok(affected as i64)
}