use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::notification::{
    AppNotification, CreateNotificationInput, NotificationCount, KINDS, PRIORITIES,
};
use crate::repositories::notification_repository;

const DEFAULT_LIMIT: i64 = 50;
const MAX_LIMIT: i64 = 200;

fn normalize_enum(value: &str, allowed: &[&str], fallback: &str) -> String {
    let v = value.trim().to_lowercase();
    if allowed.contains(&v.as_str()) {
        v
    } else {
        fallback.to_string()
    }
}

pub fn create(
    conn: &Connection,
    input: CreateNotificationInput,
) -> Result<AppNotification, AppError> {
    let title = input.title.trim();
    if title.is_empty() {
        return Err(AppError::validation("Notification title cannot be blank"));
    }
    if input.user_id <= 0 {
        return Err(AppError::validation("Notification requires a valid user"));
    }
    let normalized = CreateNotificationInput {
        user_id: input.user_id,
        title: title.to_string(),
        message: input
            .message
            .map(|m| m.trim().to_string())
            .filter(|m| !m.is_empty()),
        kind: normalize_enum(&input.kind, KINDS, "general"),
        priority: normalize_enum(&input.priority, PRIORITIES, "normal"),
    };
    let id = notification_repository::insert(conn, &normalized)?;
    notification_repository::get_for_user(conn, id, normalized.user_id)?
        .ok_or_else(|| AppError::Internal("Created notification could not be retrieved".into()))
}

pub fn list(
    conn: &Connection,
    user_id: i64,
    unread_only: Option<bool>,
    limit: Option<i64>,
) -> Result<Vec<AppNotification>, AppError> {
    let limit = limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    notification_repository::list(conn, user_id, unread_only.unwrap_or(false), limit)
}

pub fn unread_count(conn: &Connection, user_id: i64) -> Result<NotificationCount, AppError> {
    Ok(NotificationCount {
        unread: notification_repository::unread_count(conn, user_id)?,
    })
}

pub fn mark_read(conn: &Connection, user_id: i64, notification_id: i64) -> Result<(), AppError> {
    if !notification_repository::mark_read(conn, notification_id, user_id)? {
        return Err(AppError::validation("Notification not found"));
    }
    Ok(())
}

pub fn mark_all_read(conn: &Connection, user_id: i64) -> Result<i64, AppError> {
    notification_repository::mark_all_read(conn, user_id)
}

pub fn delete(conn: &Connection, user_id: i64, notification_id: i64) -> Result<(), AppError> {
    if !notification_repository::delete(conn, notification_id, user_id)? {
        return Err(AppError::validation("Notification not found"));
    }
    Ok(())
}

pub fn clear_read(conn: &Connection, user_id: i64) -> Result<i64, AppError> {
    notification_repository::delete_all_read(conn, user_id)
}

/// Best-effort system notification sent to the acting user after an action.
/// Never fails the primary (already committed) operation.
pub fn notify(
    conn: &Connection,
    user_id: Option<i64>,
    kind: &str,
    priority: &str,
    title: &str,
    message: &str,
) -> Result<(), AppError> {
    let Some(user_id) = user_id else {
        return Ok(());
    };
    if let Err(e) = create(
        conn,
        CreateNotificationInput {
            user_id,
            title: title.to_string(),
            message: Some(message.to_string()),
            kind: kind.to_string(),
            priority: priority.to_string(),
        },
    ) {
        log::warn!("failed to send notification to user {user_id}: {e}");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_utils::in_memory_conn;

    fn sample(user_id: i64) -> CreateNotificationInput {
        CreateNotificationInput {
            user_id,
            title: "Payment received".into(),
            message: Some("Rs 5,000 received".into()),
            kind: "finance".into(),
            priority: "high".into(),
        }
    }

    #[test]
    fn creates_and_round_trips() {
        let conn = in_memory_conn();
        let n = create(&conn, sample(1)).unwrap();
        assert_eq!(n.kind, "finance");
        assert_eq!(n.priority, "high");
        assert!(!n.is_read);
        assert_eq!(list(&conn, 1, None, None).unwrap().len(), 1);
        assert_eq!(unread_count(&conn, 1).unwrap().unread, 1);
    }

    #[test]
    fn normalizes_invalid_kind_and_priority() {
        let conn = in_memory_conn();
        let mut input = sample(1);
        input.kind = "bogus".into();
        input.priority = "urgent!!".into();
        let n = create(&conn, input).unwrap();
        assert_eq!(n.kind, "general");
        assert_eq!(n.priority, "normal");
    }

    #[test]
    fn blank_title_rejected() {
        let conn = in_memory_conn();
        let mut input = sample(1);
        input.title = "   ".into();
        assert!(create(&conn, input).is_err());
    }

    #[test]
    fn mark_read_and_count() {
        let conn = in_memory_conn();
        create(&conn, sample(1)).unwrap();
        create(&conn, sample(1)).unwrap();
        let all = list(&conn, 1, None, None).unwrap();
        mark_read(&conn, 1, all[0].id).unwrap();
        assert_eq!(unread_count(&conn, 1).unwrap().unread, 1);
        assert_eq!(list(&conn, 1, Some(true), None).unwrap().len(), 1);
        mark_all_read(&conn, 1).unwrap();
        assert_eq!(unread_count(&conn, 1).unwrap().unread, 0);
    }

    #[test]
    fn user_isolation_enforced() {
        let conn = in_memory_conn();
        let n = create(&conn, sample(1)).unwrap();
        assert!(list(&conn, 2, None, None).unwrap().is_empty());
        assert!(mark_read(&conn, 2, n.id).is_err());
        assert!(delete(&conn, 2, n.id).is_err());
    }

    #[test]
    fn delete_and_clear() {
        let conn = in_memory_conn();
        create(&conn, sample(1)).unwrap();
        let n2 = create(&conn, sample(1)).unwrap();
        mark_read(&conn, 1, n2.id).unwrap();
        assert_eq!(clear_read(&conn, 1).unwrap(), 1);
        assert_eq!(list(&conn, 1, None, None).unwrap().len(), 1);
        let remaining = list(&conn, 1, None, None).unwrap()[0].clone();
        delete(&conn, 1, remaining.id).unwrap();
        assert!(list(&conn, 1, None, None).unwrap().is_empty());
    }
}
