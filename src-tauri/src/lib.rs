mod commands;
mod database;
mod errors;
mod models;
mod repositories;
mod security;
mod services;
mod utils;

use database::Database;
use security::SessionState;
use tauri::Manager;
use utils::logging;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
