pub mod accessory_service;
pub mod auth_service;
pub mod backup_service;
pub mod expense_service;
pub mod license_service;
pub mod member_service;
pub mod notification_service;
pub mod payment_service;
pub mod phone_service;
pub mod purchase_service;
pub mod report_service;
pub mod sale_service;
pub mod settings_service;
pub mod supplier_service;
pub mod user_admin_service;

#[cfg(test)]
pub mod test_utils;

use rusqlite::Connection;

/// Records an activity log entry in the database.
/// Best-effort: the audit trail must never fail the primary operation (which
/// has already committed). Insert failures are logged and swallowed.
pub fn record_activity(
    conn: &Connection,
    user_id: Option<i64>,
    module: &str,
    action: &str,
    record_id: Option<i64>,
) -> Result<(), crate::errors::AppError> {
    if let Err(e) = conn.execute(
        "INSERT INTO activity_logs (user_id, module, action, record_id) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![user_id, module, action, record_id],
    ) {
        log::warn!("failed to record activity log ({module}/{action}): {e}");
    }
    crate::utils::logging::log_activity(module, action, user_id, record_id);
    Ok(())
}
