mod commands;
mod database;
mod errors;
mod models;
mod repositories;
mod security;
mod services;
mod utils;

pub use security::get_hardware_id;
pub use services::license_service::generate_key;

use database::Database;
use security::SessionState;
use tauri::Manager;
use tauri::WindowEvent;
use utils::logging;

/// Creates a zip backup of the database file to Desktop/Software Backups/.
/// Returns Ok(()) on success, Err(message) on failure.
fn create_exit_backup(db: &Database) -> Result<(), String> {
    use std::fs;
    use std::io::Write;

    // 1. Determine Desktop path from USERPROFILE env var (works in dev + production)
    let user_profile = std::env::var("USERPROFILE")
        .map_err(|_| "Could not determine USERPROFILE".to_string())?;
    let desktop = std::path::PathBuf::from(&user_profile).join("Desktop");
    let backup_dir = desktop.join("Software Backups");
    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Could not create backup directory: {e}"))?;

    // 2. Generate timestamped filename
    let stamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let zip_name = format!("Backup_{stamp}.zip");
    let zip_path = backup_dir.join(&zip_name);

    // 3. Take a consistent snapshot of the live database to a temp file
    let temp_db = backup_dir.join(format!(".tmp_backup_{stamp}.db"));
    {
        let conn = db.conn.lock().expect("db lock for exit backup");
        services::backup_service::write_backup(&conn, &temp_db)
            .map_err(|e| format!("DB snapshot failed: {e}"))?;
    }

    // 4. Compress the snapshot into a zip file
    let zip_file = fs::File::create(&zip_path)
        .map_err(|e| format!("Could not create zip file: {e}"))?;
    let mut zip_writer = zip::ZipWriter::new(zip_file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Add the database file
    zip_writer
        .start_file("business_management.db", options)
        .map_err(|e| format!("Zip start_file error: {e}"))?;
    let db_bytes = fs::read(&temp_db)
        .map_err(|e| format!("Could not read temp db: {e}"))?;
    zip_writer
        .write_all(&db_bytes)
        .map_err(|e| format!("Zip write error: {e}"))?;

    zip_writer
        .finish()
        .map_err(|e| format!("Zip finish error: {e}"))?;

    // 5. Clean up the temp snapshot
    let _ = fs::remove_file(&temp_db);

    log::info!("Exit backup created: {}", zip_path.display());
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logging::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let db = Database::open(&app_data_dir)?;
            {
                let conn = db.conn.lock().expect("db lock");
                database::migrations::run(&conn)?;
                database::seed::seed(&conn)
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
            }
            app.manage(db);
            app.manage(SessionState::default());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
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
            commands::create_member,
            commands::list_members,
            commands::get_member,
            commands::update_member,
            commands::delete_member,
            commands::create_payment,
            commands::list_payments,
            commands::list_member_payments,
            commands::get_payment,
            commands::delete_payment,
            commands::get_member_balance,
            commands::list_member_balances,
            commands::list_customer_dues,
            commands::create_supplier,
            commands::list_suppliers,
            commands::update_supplier,
            commands::delete_supplier,
            commands::create_phone,
            commands::list_phones,
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
            commands::list_sales,
            commands::get_sale,
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
            commands::list_backups,
            commands::get_backup,
            commands::verify_backup,
            commands::delete_backup,
            commands::restore_backup,
            commands::create_purchase,
            commands::list_purchases,
            commands::get_purchase,
            commands::create_supplier_payment,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

