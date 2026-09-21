mod commands;
mod database;
mod errors;
mod models;
mod repositories;
mod security;
mod services;
mod utils;

pub use security::get_hardware_id;
pub use services::license_service::{generate_key, parse_key};

use database::Database;
use security::SessionState;
use tauri::Manager;
use tauri::WindowEvent;
use utils::logging;

/// Creates a single-file `.db` backup of the database into the configured backup folder
/// (falls back to Desktop/Software Backup when none is selected) and records it
/// in the backup history. Returns Ok(()) on success, Err(message) on failure.
fn create_exit_backup(db: &Database) -> Result<(), String> {
    use std::fs;

    let conn = db
        .conn
        .lock()
        .map_err(|_| "Database lock unavailable".to_string())?;

    // 1. Resolve the selected backup folder (read from settings every time, so a
    //    folder chosen in Backup Manager is always honoured on close).
    let backup_dir = services::backup_service::backup_dir(&conn)
        .map_err(|e| format!("Could not resolve backup folder: {e}"))?;
    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Could not create backup directory: {e}"))?;

    // 2. Generate timestamped filename (same convention as the automatic backup).
    let stamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let file_name = format!("Auto_Backup_{stamp}.db");
    let file_path = backup_dir.join(&file_name);

    // 3. Write the single-file backup (snapshot + embedded manifest + images).
    let size = services::backup_service::write_single_file_backup(
        &conn,
        &file_path,
        crate::models::backup::BackupType::Database,
        &services::backup_service::all_module_ids(),
    )
    .map_err(|e| format!("Backup file creation failed: {e}"))?;

    // 4. Record in the backup history so it appears in Backup Manager.
    if let Err(e) = services::backup_service::record_exit_backup(&conn, &file_name, &file_path, size as i64) {
        log::warn!("Exit backup could not be recorded in history: {e}");
    }

    log::info!("Exit backup created: {}", file_path.display());
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logging::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_printer_v2::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let db = Database::open(&app_data_dir)?;
            {
                let conn = db.conn.lock().map_err(|_| {
                    std::io::Error::new(
                        std::io::ErrorKind::Other,
                        "database lock is unavailable",
                    )
                })?;
                database::migrations::run(&conn)?;
                database::seed::seed(&conn)
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
            }
            app.manage(db);
            app.manage(SessionState::default());
            services::backup_service::spawn_auto_backup(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Only intercept close for the main window.
                // Hidden windows created by the printer plugin also fire
                // CloseRequested when the plugin calls webview.close().
                // Acting on those kills the entire application.
                if window.label() != "main" {
                    return;
                }
                api.prevent_close();

                let app_handle = window.app_handle().clone();

                // Run backup synchronously on a background thread, then exit
                std::thread::spawn(move || {
                    if let Some(db) = app_handle.try_state::<Database>() {
                        match create_exit_backup(db.inner()) {
                            Ok(()) => log::info!("Exit backup completed successfully"),
                            Err(e) => log::error!("Exit backup failed: {e}"),
                        }
                    }
                    // Always exit, even if backup fails
                    app_handle.exit(0);
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::login,
            commands::logout,
            commands::get_current_user,
            commands::create_user,
            commands::list_users,
            commands::get_user,
            commands::update_user,
            commands::set_user_status,
            commands::reset_user_password,
            commands::delete_user,
            commands::list_roles,
            commands::get_role,
            commands::create_role,
            commands::update_role,
            commands::delete_role,
            commands::list_permissions,
            commands::change_password,
            commands::create_staff_member,
            commands::list_staff_members,
            commands::update_staff_member,
            commands::delete_staff_member,
            commands::create_salary_record,
            commands::list_salary_records,
            commands::update_salary_record,
            commands::delete_salary_record,
            commands::create_member,
            commands::list_members,
            commands::get_member,
            commands::update_member,
            commands::delete_member,
            commands::create_payment,
            commands::update_payment,
            commands::list_payments,
            commands::list_member_payments,
            commands::get_payment,
            commands::delete_payment,
            commands::void_payment,
            commands::edit_payment_details,
            commands::void_sale_payment,
            commands::edit_sale_payment_details,
            commands::get_member_balance,
            commands::list_member_balances,
            commands::list_customer_dues,
            commands::list_customer_due_invoices,
            commands::unpaid_sales_for_member,
            commands::list_payments_for_sale,
            commands::create_supplier,
            commands::list_suppliers,
            commands::update_supplier,
            commands::delete_supplier,
            commands::create_phone,
            commands::list_phones,
            commands::save_product_image,
            commands::read_product_image,
            commands::get_phone,
            commands::update_phone,
            commands::delete_phone,
            commands::restock_phone,
            commands::add_phone_imei,
            commands::list_phone_imeis,
            commands::create_accessory,
            commands::list_accessories,
            commands::get_accessory,
            commands::update_accessory,
            commands::delete_accessory,
            commands::restock_accessory,
            commands::create_sale,
            commands::update_sale,
            commands::delete_sale,
            commands::list_sales,
            commands::list_sales_for_period,
            commands::get_sale,
            commands::create_return,
            commands::update_return,
            commands::delete_return,
            commands::list_returns,
            commands::list_returns_for_period,
            commands::get_return,
            commands::create_category,
            commands::list_categories,
            commands::update_category,
            commands::delete_category,
            commands::create_product_category,
            commands::list_product_categories,
            commands::update_product_category,
            commands::delete_product_category,
            commands::create_expense,
            commands::list_expenses,
            commands::get_expense,
            commands::delete_expense,
            commands::expense_category_totals,
            commands::total_expenses_in_range,
            commands::get_dashboard_summary,
            commands::get_revenue_series,
            commands::get_expense_series,
            commands::get_recent_activity,
            commands::get_period_summary,
            commands::get_sales_series,
            commands::get_top_sellers,
            commands::get_payment_breakdown,
            commands::get_online_payment_records,
            commands::get_profit_loss,
            commands::get_all_settings,
            commands::update_setting,
            commands::get_license_status,
            commands::activate_license,
            commands::deactivate_license,
            commands::get_hardware_id,
            commands::create_notification,
            commands::list_notifications,
            commands::get_notification_count,
            commands::mark_notification_read,
            commands::mark_all_notifications_read,
            commands::delete_notification,
            commands::clear_read_notifications,
            commands::list_activity_logs,
            commands::create_backup,
            commands::create_selective_backup,
            commands::list_backup_modules,
            commands::pick_backup_folder,
            commands::inspect_backup,
            commands::open_backup_folder,
            commands::list_backups,
            commands::get_backup,
            commands::verify_backup,
            commands::delete_backup,
            commands::restore_backup,
            commands::pick_backup_file,
            commands::restore_backup_from_path,
            commands::get_backup_config,
            commands::update_backup_config,
            commands::get_backup_status,
            commands::create_purchase,
            commands::list_purchases,
            commands::list_purchases_for_period,
            commands::get_purchase,
            commands::update_purchase,
            commands::delete_purchase,
            commands::create_supplier_payment,
            commands::update_supplier_payment,
            commands::list_supplier_payments,
            commands::list_supplier_payments_by_supplier,
            commands::delete_supplier_payment,
            commands::get_supplier_balance,
            commands::list_supplier_balances,
            commands::list_supplier_dues,
            commands::list_phone_options,
            commands::create_phone_option,
            commands::update_phone_option,
            commands::delete_phone_option,
            commands::set_phone_option_active,
            commands::list_accessory_options,
            commands::create_accessory_option,
            commands::update_accessory_option,
            commands::delete_accessory_option,
            commands::set_accessory_option_active,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
