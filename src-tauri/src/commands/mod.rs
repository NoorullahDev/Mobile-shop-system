use tauri::Emitter;
use tauri::State;

use crate::database::Database;
use crate::errors::AppError;
use crate::models::backup::BackupStatus;
use crate::models::inventory::{CreateSupplierInput, Supplier};
use crate::models::accessory::{Accessory, CreateAccessoryInput};
use crate::models::phone::{AddPhoneImeiInput, CreatePhoneInput, Phone, PhoneImei};
use crate::models::license::{ActivateLicenseInput, LicenseStatus};
use crate::models::member::{CreateMemberInput, Member};
use crate::models::notification::{AppNotification, CreateNotificationInput, NotificationCount};
use crate::models::expense::{Category, CategoryTotal, CreateCategoryInput, CreateExpenseInput, Expense};
use crate::models::payment::{CreatePaymentInput, MemberBalance, Payment};
use crate::models::product_category::{CreateProductCategoryInput, ProductCategory};
use crate::models::purchase::{
    CreatePurchaseInput, CreateSupplierPaymentInput, Purchase, SupplierBalance, SupplierPayment,
};
use crate::models::report::{
    ActivityLog, DashboardSummary, MonthlyPoint, PaymentBreakdown, PeriodSummary, ProfitLoss,
    SalePoint, TopSeller,
};
use crate::models::sale::{CreateSaleInput, Sale};
use crate::models::user::{
    CreateRoleInput, CreateUserInput, Permission, ResetPasswordInput, RoleWithPermissions,
    SessionUser, UpdateRoleInput, UpdateUserInput, UserDetail,
};
use crate::security::SessionState;
use crate::repositories::{backup_repository, user_repository};
use crate::services::{
    accessory_service, auth_service, backup_service, expense_service, license_service,
    member_service, notification_service, payment_service, phone_service,
    product_category_service, purchase_service, report_service, sale_service,
    settings_service, supplier_service, user_admin_service,
};

/// Helper: acquire the database connection or fail gracefully.
fn conn(db: &Database) -> Result<std::sync::MutexGuard<'_, rusqlite::Connection>, AppError> {
    db.conn
        .lock()
        .map_err(|_| AppError::Internal("Database lock poisoned".into()))
}

/// Helper: the id of the currently signed-in user, or fail with authentication error.
fn current_user_id(session: &SessionState) -> Result<i64, AppError> {
    let guard = session
        .0
        .lock()
        .map_err(|_| AppError::Internal("Session lock poisoned".into()))?;
    guard
        .as_ref()
        .map(|u| u.id)
        .ok_or_else(|| AppError::Authentication("Not signed in".into()))
}

#[tauri::command]
pub fn ping() -> String {
    "pong".to_string()
}

#[tauri::command]
pub fn login(
    db: State<Database>,
    session: State<SessionState>,
    username: String,
    password: String,
) -> Result<SessionUser, AppError> {
    let guard = conn(&db)?;
    let user = auth_service::login(&guard, &username, &password)?;
    *session
        .0
        .lock()
        .map_err(|_| AppError::Internal("Session lock poisoned".into()))? = Some(user.clone());
    Ok(user)
}

#[tauri::command]
pub fn logout(session: State<SessionState>) {
    if let Ok(mut s) = session.0.lock() {
        *s = None;
    }
}

#[tauri::command]
pub fn get_current_user(
    db: State<Database>,
    session: State<SessionState>,
) -> Result<Option<SessionUser>, AppError> {
    let snapshot = session
        .0
        .lock()
        .map_err(|_| AppError::Internal("Session lock poisoned".into()))?
        .clone();

    let Some(mut user) = snapshot else {
        return Ok(None);
    };

    // The `default_password` flag must reflect the live database rather than
    // the login-time snapshot, so the default-password warning disappears as
    // soon as the signed-in user's password is actually changed.
    let guard = conn(&db)?;
    let password_hash = user_repository::get_password_hash(&guard, user.id)?;
    user.default_password = password_hash
        .map(|hash| crate::security::verify_password("admin123", &hash).unwrap_or(false))
        .unwrap_or(false);

    Ok(Some(user))
}

// ---- User & Role Management ----

#[tauri::command]
pub fn create_user(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    input: CreateUserInput,
) -> Result<UserDetail, AppError> {
    let guard = conn(&db)?;
    user_admin_service::create_user(&guard, input, actor)
}

#[tauri::command]
pub fn list_users(
    db: State<Database>,
    _session: State<SessionState>,
    search: Option<String>,
) -> Result<Vec<UserDetail>, AppError> {
    let guard = conn(&db)?;
    user_admin_service::list_users(&guard, search)
}

#[tauri::command]
pub fn get_user(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
) -> Result<UserDetail, AppError> {
    let guard = conn(&db)?;
    user_admin_service::get_user(&guard, id)
}

#[tauri::command]
pub fn update_user(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    id: i64,
    input: UpdateUserInput,
) -> Result<UserDetail, AppError> {
    let guard = conn(&db)?;
    user_admin_service::update_user(&guard, id, input, actor)
}

#[tauri::command]
pub fn set_user_status(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    id: i64,
    status: String,
) -> Result<UserDetail, AppError> {
    let guard = conn(&db)?;
    user_admin_service::set_user_status(&guard, id, &status, actor)
}

#[tauri::command]
pub fn reset_user_password(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    id: i64,
    input: ResetPasswordInput,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    user_admin_service::reset_password(&guard, id, &input.new_password, actor)
}

#[tauri::command]
pub fn delete_user(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    id: i64,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    user_admin_service::delete_user(&guard, id, actor)
}

#[tauri::command]
pub fn list_roles(
    db: State<Database>,
    _session: State<SessionState>,
    search: Option<String>,
) -> Result<Vec<RoleWithPermissions>, AppError> {
    let guard = conn(&db)?;
    user_admin_service::list_roles(&guard, search)
}

#[tauri::command]
pub fn get_role(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
) -> Result<RoleWithPermissions, AppError> {
    let guard = conn(&db)?;
    user_admin_service::get_role(&guard, id)
}

#[tauri::command]
pub fn create_role(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    input: CreateRoleInput,
) -> Result<RoleWithPermissions, AppError> {
    let guard = conn(&db)?;
    user_admin_service::create_role(&guard, input, actor)
}

#[tauri::command]
pub fn update_role(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    id: i64,
    input: UpdateRoleInput,
) -> Result<RoleWithPermissions, AppError> {
    let guard = conn(&db)?;
    user_admin_service::update_role(&guard, id, input, actor)
}

#[tauri::command]
pub fn delete_role(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    id: i64,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    user_admin_service::delete_role(&guard, id, actor)
}

#[tauri::command]
pub fn list_permissions(
    db: State<Database>,
    _session: State<SessionState>,
) -> Result<Vec<Permission>, AppError> {
    let guard = conn(&db)?;
    user_admin_service::list_permissions(&guard)
}


#[tauri::command]
pub fn create_member(
    db: State<Database>,
    _session: State<SessionState>,
    input: CreateMemberInput,
) -> Result<Member, AppError> {
    let guard = conn(&db)?;
    member_service::create(&guard, input)
}

#[tauri::command]
pub fn list_members(
    db: State<Database>,
    _session: State<SessionState>,
    search: Option<String>,
) -> Result<Vec<Member>, AppError> {
    let guard = conn(&db)?;
    member_service::list(&guard, search)
}

#[tauri::command]
pub fn get_member(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
) -> Result<Member, AppError> {
    let guard = conn(&db)?;
    member_service::get(&guard, id)
}

#[tauri::command]
pub fn delete_member(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    member_service::soft_delete(&guard, id, actor)
}

#[tauri::command]
pub fn update_member(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    input: CreateMemberInput,
) -> Result<Member, AppError> {
    let guard = conn(&db)?;
    member_service::update(&guard, id, input)
}

// ---- Payments ----

#[tauri::command]
pub fn create_payment(
    db: State<Database>,
    _session: State<SessionState>,
    input: CreatePaymentInput,
    actor: Option<i64>,
) -> Result<Payment, AppError> {
    let guard = conn(&db)?;
    payment_service::create(&guard, input, actor)
}

#[tauri::command]
pub fn list_payments(
    db: State<Database>,
    _session: State<SessionState>,
    search: Option<String>,
) -> Result<Vec<Payment>, AppError> {
    let guard = conn(&db)?;
    payment_service::list(&guard, search)
}

#[tauri::command]
pub fn list_member_payments(
    db: State<Database>,
    _session: State<SessionState>,
    member_id: i64,
) -> Result<Vec<Payment>, AppError> {
    let guard = conn(&db)?;
    payment_service::list_by_member(&guard, member_id)
}

#[tauri::command]
pub fn get_payment(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
) -> Result<Payment, AppError> {
    let guard = conn(&db)?;
    payment_service::get(&guard, id)
}

#[tauri::command]
pub fn delete_payment(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    payment_service::soft_delete(&guard, id, actor)
}

#[tauri::command]
pub fn get_member_balance(
    db: State<Database>,
    _session: State<SessionState>,
    member_id: i64,
) -> Result<MemberBalance, AppError> {
    let guard = conn(&db)?;
    payment_service::member_balance(&guard, member_id)
}

#[tauri::command]
pub fn list_member_balances(
    db: State<Database>,
    _session: State<SessionState>,
    search: Option<String>,
) -> Result<Vec<MemberBalance>, AppError> {
    let guard = conn(&db)?;
    payment_service::list_balances(&guard, search)
}

#[tauri::command]
pub fn list_customer_dues(
    db: State<Database>,
    _session: State<SessionState>,
    search: Option<String>,
) -> Result<Vec<MemberBalance>, AppError> {
    let guard = conn(&db)?;
    payment_service::list_customer_dues(&guard, search)
}

// ---- Suppliers ----

#[tauri::command]
pub fn create_supplier(
    db: State<Database>,
    _session: State<SessionState>,
    input: CreateSupplierInput,
) -> Result<Supplier, AppError> {
    let guard = conn(&db)?;
    supplier_service::create(&guard, input)
}

#[tauri::command]
pub fn list_suppliers(
    db: State<Database>,
    _session: State<SessionState>,
) -> Result<Vec<Supplier>, AppError> {
    let guard = conn(&db)?;
    supplier_service::list(&guard)
}

#[tauri::command]
pub fn update_supplier(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    input: CreateSupplierInput,
) -> Result<Supplier, AppError> {
    let guard = conn(&db)?;
    supplier_service::update(&guard, id, input)
}

#[tauri::command]
pub fn delete_supplier(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    supplier_service::soft_delete(&guard, id, actor)
}

// ---- Phone Inventory ----

#[tauri::command]
pub fn save_product_image(app: tauri::AppHandle, _session: State<SessionState>, bytes: Vec<u8>, extension: String) -> Result<String, AppError> {
    use tauri::Manager;
    if bytes.is_empty() || bytes.len() > 10 * 1024 * 1024 { return Err(AppError::validation("Product image must be between 1 byte and 10 MB")); }
    let ext = match extension.to_ascii_lowercase().as_str() { "jpg"|"jpeg" => "jpg", "png" => "png", "webp" => "webp", _ => return Err(AppError::validation("Only JPG, PNG and WebP images are supported")) };
    let relative = format!("product_images/{}_{}.{}", chrono::Utc::now().timestamp_millis(), std::process::id(), ext);
    let path = app.path().app_data_dir().map_err(|e| AppError::file(format!("Could not resolve application data folder: {e}")))?.join(&relative);
    if let Some(parent)=path.parent(){std::fs::create_dir_all(parent).map_err(|e|AppError::file(format!("Could not create image folder: {e}")))?;}
    std::fs::write(&path, bytes).map_err(|e|AppError::file(format!("Could not save product image: {e}")))?;
    Ok(relative.replace('\\', "/"))
}

#[tauri::command]
pub fn read_product_image(app: tauri::AppHandle, _session: State<SessionState>, relative_path: String) -> Result<String, AppError> {
    use base64::Engine;
    use tauri::Manager;
    if relative_path.contains("..") || !relative_path.replace('\\', "/").starts_with("product_images/") { return Err(AppError::validation("Invalid product image path")); }
    let path=app.path().app_data_dir().map_err(|e|AppError::file(format!("Could not resolve application data folder: {e}")))?.join(&relative_path);
    let bytes=std::fs::read(&path).map_err(|e|AppError::file(format!("Could not read product image: {e}")))?;
    let mime=if relative_path.ends_with(".png"){"image/png"}else if relative_path.ends_with(".webp"){"image/webp"}else{"image/jpeg"};
    Ok(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

#[tauri::command]
pub fn create_phone(
    db: State<Database>,
    _session: State<SessionState>,
    input: CreatePhoneInput,
) -> Result<Phone, AppError> {
    let guard = conn(&db)?;
    phone_service::create(&guard, input)
}

#[tauri::command]
pub fn list_phones(
    db: State<Database>,
    _session: State<SessionState>,
    search: Option<String>,
) -> Result<Vec<Phone>, AppError> {
    let guard = conn(&db)?;
    phone_service::list(&guard, search)
}

#[tauri::command]
pub fn get_phone(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
) -> Result<Phone, AppError> {
    let guard = conn(&db)?;
    phone_service::get(&guard, id)
}

#[tauri::command]
pub fn update_phone(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    input: CreatePhoneInput,
) -> Result<Phone, AppError> {
    let guard = conn(&db)?;
    phone_service::update(&guard, id, input)
}

#[tauri::command]
pub fn delete_phone(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    phone_service::soft_delete(&guard, id, actor)
}

#[tauri::command]
pub fn restock_phone(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    quantity: i64,
    imeis: Vec<String>,
    actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    phone_service::restock(&guard, id, quantity, imeis, actor)
}

#[tauri::command]
pub fn add_phone_imei(
    db: State<Database>,
    _session: State<SessionState>,
    input: AddPhoneImeiInput,
) -> Result<PhoneImei, AppError> {
    let guard = conn(&db)?;
    phone_service::add_imei(&guard, input)
}

#[tauri::command]
pub fn list_phone_imeis(
    db: State<Database>,
    _session: State<SessionState>,
    phone_id: i64,
) -> Result<Vec<PhoneImei>, AppError> {
    let guard = conn(&db)?;
    phone_service::list_imei(&guard, phone_id)
}

// ---- Accessory Inventory ----

#[tauri::command]
pub fn create_accessory(
    db: State<Database>,
    _session: State<SessionState>,
    input: CreateAccessoryInput,
) -> Result<Accessory, AppError> {
    let guard = conn(&db)?;
    accessory_service::create(&guard, input)
}

#[tauri::command]
pub fn list_accessories(
    db: State<Database>,
    _session: State<SessionState>,
    search: Option<String>,
) -> Result<Vec<Accessory>, AppError> {
    let guard = conn(&db)?;
    accessory_service::list(&guard, search)
}

#[tauri::command]
pub fn get_accessory(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
) -> Result<Accessory, AppError> {
    let guard = conn(&db)?;
    accessory_service::get(&guard, id)
}

#[tauri::command]
pub fn update_accessory(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    input: CreateAccessoryInput,
) -> Result<Accessory, AppError> {
    let guard = conn(&db)?;
    accessory_service::update(&guard, id, input)
}

#[tauri::command]
pub fn delete_accessory(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    accessory_service::soft_delete(&guard, id, actor)
}

#[tauri::command]
pub fn restock_accessory(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    quantity: i64,
    actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    accessory_service::restock(&guard, id, quantity, actor)
}

// ---- Sales ----

#[tauri::command]
pub fn create_sale(
    db: State<Database>,
    _session: State<SessionState>,
    input: CreateSaleInput,
    actor: Option<i64>,
) -> Result<Sale, AppError> {
    let guard = conn(&db)?;
    sale_service::create(&guard, input, actor)
}

#[tauri::command]
pub fn list_sales(
    db: State<Database>,
    _session: State<SessionState>,
    search: Option<String>,
) -> Result<Vec<Sale>, AppError> {
    let guard = conn(&db)?;
    sale_service::list(&guard, search)
}

#[tauri::command]
pub fn get_sale(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
) -> Result<Sale, AppError> {
    let guard = conn(&db)?;
    sale_service::get(&guard, id)
}

// ---- Categories & Expenses ----

#[tauri::command]
pub fn create_category(
    db: State<Database>,
    _session: State<SessionState>,
    input: CreateCategoryInput,
    actor: Option<i64>,
) -> Result<Category, AppError> {
    let guard = conn(&db)?;
    let id = expense_service::create_category(&guard, &input, actor)?;
    expense_service::list_categories(&guard)?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| AppError::validation("Category not found"))
}

#[tauri::command]
pub fn list_categories(
    db: State<Database>,
    _session: State<SessionState>,
) -> Result<Vec<Category>, AppError> {
    let guard = conn(&db)?;
    expense_service::list_categories(&guard)
}

#[tauri::command]
pub fn update_category(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    input: CreateCategoryInput,
    actor: Option<i64>,
) -> Result<Category, AppError> {
    let guard = conn(&db)?;
    expense_service::update_category(&guard, id, &input, actor)
}

#[tauri::command]
pub fn delete_category(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    expense_service::delete_category(&guard, id, actor)
}

// ---- Product Categories (phones & accessories) ----

#[tauri::command]
pub fn create_product_category(
    db: State<Database>,
    _session: State<SessionState>,
    input: CreateProductCategoryInput,
    actor: Option<i64>,
) -> Result<ProductCategory, AppError> {
    let guard = conn(&db)?;
    let id = product_category_service::create_category(&guard, &input, actor)?;
    product_category_service::list_categories(&guard)?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| AppError::validation("Category not found"))
}

#[tauri::command]
pub fn list_product_categories(
    db: State<Database>,
    _session: State<SessionState>,
) -> Result<Vec<ProductCategory>, AppError> {
    let guard = conn(&db)?;
    product_category_service::list_categories(&guard)
}

#[tauri::command]
pub fn update_product_category(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    input: CreateProductCategoryInput,
    actor: Option<i64>,
) -> Result<ProductCategory, AppError> {
    let guard = conn(&db)?;
    product_category_service::update_category(&guard, id, &input, actor)
}

#[tauri::command]
pub fn delete_product_category(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    product_category_service::delete_category(&guard, id, actor)
}

#[tauri::command]
pub fn create_expense(
    db: State<Database>,
    _session: State<SessionState>,
    input: CreateExpenseInput,
    actor: Option<i64>,
) -> Result<Expense, AppError> {
    let guard = conn(&db)?;
    let id = expense_service::create_expense(&guard, &input, actor)?;
    expense_service::get_expense(&guard, id)
}

#[tauri::command]
pub fn list_expenses(
    db: State<Database>,
    _session: State<SessionState>,
    category_id: Option<i64>,
    from: Option<String>,
    to: Option<String>,
) -> Result<Vec<Expense>, AppError> {
    let guard = conn(&db)?;
    expense_service::list_expenses(&guard, category_id, from, to)
}

#[tauri::command]
pub fn get_expense(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
) -> Result<Expense, AppError> {
    let guard = conn(&db)?;
    expense_service::get_expense(&guard, id)
}

#[tauri::command]
pub fn delete_expense(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    expense_service::delete_expense(&guard, id, actor)
}

#[tauri::command]
pub fn expense_category_totals(
    db: State<Database>,
    _session: State<SessionState>,
    from: String,
    to: String,
) -> Result<Vec<CategoryTotal>, AppError> {
    let guard = conn(&db)?;
    expense_service::category_expense_totals(&guard, &from, &to)
}

#[tauri::command]
pub fn total_expenses_in_range(
    db: State<Database>,
    _session: State<SessionState>,
    from: String,
    to: String,
) -> Result<f64, AppError> {
    let guard = conn(&db)?;
    expense_service::total_in_range(&guard, &from, &to)
}

// ---- Dashboard & Reports ----

#[tauri::command]
pub fn get_dashboard_summary(
    db: State<Database>,
    _session: State<SessionState>,
    months: Option<i64>,
) -> Result<DashboardSummary, AppError> {
    let guard = conn(&db)?;
    report_service::dashboard(&guard, months.unwrap_or(12))
}

#[tauri::command]
pub fn get_revenue_series(
    db: State<Database>,
    _session: State<SessionState>,
    months: Option<i64>,
) -> Result<Vec<MonthlyPoint>, AppError> {
    let guard = conn(&db)?;
    report_service::revenue_series(&guard, months.unwrap_or(12))
}

#[tauri::command]
pub fn get_expense_series(
    db: State<Database>,
    _session: State<SessionState>,
    months: Option<i64>,
) -> Result<Vec<MonthlyPoint>, AppError> {
    let guard = conn(&db)?;
    report_service::expense_series(&guard, months.unwrap_or(12))
}

#[tauri::command]
pub fn get_recent_activity(
    db: State<Database>,
    _session: State<SessionState>,
    limit: Option<i64>,
) -> Result<Vec<ActivityLog>, AppError> {
    let guard = conn(&db)?;
    report_service::recent_activity(&guard, limit.unwrap_or(10))
}

#[tauri::command]
pub fn get_period_summary(
    db: State<Database>,
    _session: State<SessionState>,
    from: String,
    to: String,
) -> Result<PeriodSummary, AppError> {
    let guard = conn(&db)?;
    report_service::period_summary(&guard, &from, &to)
}

#[tauri::command]
pub fn get_sales_series(
    db: State<Database>,
    _session: State<SessionState>,
    from: String,
    to: String,
) -> Result<Vec<SalePoint>, AppError> {
    let guard = conn(&db)?;
    report_service::sales_series(&guard, &from, &to)
}

#[tauri::command]
pub fn get_top_sellers(
    db: State<Database>,
    _session: State<SessionState>,
    from: String,
    to: String,
    limit: Option<i64>,
) -> Result<Vec<TopSeller>, AppError> {
    let guard = conn(&db)?;
    report_service::top_sellers(&guard, &from, &to, limit.unwrap_or(5))
}

#[tauri::command]
pub fn get_payment_breakdown(
    db: State<Database>,
    _session: State<SessionState>,
    from: String,
    to: String,
) -> Result<Vec<PaymentBreakdown>, AppError> {
    let guard = conn(&db)?;
    report_service::payment_breakdown(&guard, &from, &to)
}

#[tauri::command]
pub fn get_profit_loss(
    db: State<Database>,
    _session: State<SessionState>,
    from: String,
    to: String,
) -> Result<ProfitLoss, AppError> {
    let guard = conn(&db)?;
    report_service::profit_loss(&guard, &from, &to)
}

// ---- Settings & Activity Logs ----

#[tauri::command]
pub fn get_all_settings(
    db: State<Database>,
    _session: State<SessionState>,
) -> Result<Vec<crate::models::setting::Setting>, AppError> {
    let guard = conn(&db)?;
    settings_service::get_all(&guard)
}

#[tauri::command]
pub fn update_setting(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    key: String,
    value: String,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    settings_service::update_setting(&guard, actor, &key, &value)
}

// ---- License & Activation ----

#[tauri::command]
pub fn get_license_status(
    db: State<Database>,
    _session: State<SessionState>,
) -> Result<LicenseStatus, AppError> {
    let guard = conn(&db)?;
    license_service::status(&guard)
}

#[tauri::command]
pub fn activate_license(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    input: ActivateLicenseInput,
) -> Result<LicenseStatus, AppError> {
    let guard = conn(&db)?;
    license_service::activate(&guard, actor, input)
}

#[tauri::command]
pub fn deactivate_license(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
) -> Result<LicenseStatus, AppError> {
    let guard = conn(&db)?;
    license_service::deactivate(&guard, actor)
}

#[tauri::command]
pub fn get_hardware_id() -> String {
    crate::security::get_hardware_id()
}


// ---- Notifications ----

/// Create a notification for a user (e.g. system/automated messages).
#[tauri::command]
pub fn create_notification(
    db: State<Database>,
    _session: State<SessionState>,
    input: CreateNotificationInput,
) -> Result<AppNotification, AppError> {
    let guard = conn(&db)?;
    notification_service::create(&guard, input)
}

/// List the current session user's notifications (newest first).
#[tauri::command]
pub fn list_notifications(
    db: State<Database>,
    session: State<SessionState>,
    unread_only: Option<bool>,
    limit: Option<i64>,
) -> Result<Vec<AppNotification>, AppError> {
    let guard = conn(&db)?;
    let user_id = current_user_id(&session)?;
    notification_service::list(&guard, user_id, unread_only, limit)
}

#[tauri::command]
pub fn get_notification_count(
    db: State<Database>,
    session: State<SessionState>,
) -> Result<NotificationCount, AppError> {
    let guard = conn(&db)?;
    let user_id = current_user_id(&session)?;
    notification_service::unread_count(&guard, user_id)
}

/// Mark a single notification as read (ownership enforced).
#[tauri::command]
pub fn mark_notification_read(
    db: State<Database>,
    session: State<SessionState>,
    id: i64,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    let user_id = current_user_id(&session)?;
    notification_service::mark_read(&guard, user_id, id)
}

/// Mark all of the current user's notifications as read.
#[tauri::command]
pub fn mark_all_notifications_read(
    db: State<Database>,
    session: State<SessionState>,
) -> Result<i64, AppError> {
    let guard = conn(&db)?;
    let user_id = current_user_id(&session)?;
    notification_service::mark_all_read(&guard, user_id)
}

/// Delete a single notification (ownership enforced).
#[tauri::command]
pub fn delete_notification(
    db: State<Database>,
    session: State<SessionState>,
    id: i64,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    let user_id = current_user_id(&session)?;
    notification_service::delete(&guard, user_id, id)
}

/// Clear all read notifications for the current user.
#[tauri::command]
pub fn clear_read_notifications(
    db: State<Database>,
    session: State<SessionState>,
) -> Result<i64, AppError> {
    let guard = conn(&db)?;
    let user_id = current_user_id(&session)?;
    notification_service::clear_read(&guard, user_id)
}

#[tauri::command]
pub fn list_activity_logs(
    db: State<Database>,
    _session: State<SessionState>,
    limit: Option<i64>,
) -> Result<Vec<ActivityLog>, AppError> {
    let guard = conn(&db)?;
    report_service::recent_activity(&guard, limit.unwrap_or(100))
}

// ---- Backup & Restore ----

#[tauri::command]
pub fn create_backup(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
) -> Result<crate::models::backup::Backup, AppError> {
    let guard = conn(&db)?;
    let dir = backup_service::backup_dir(&guard)?;
    backup_service::create_backup(
        &guard,
        &dir,
        actor,
        crate::models::backup::BackupType::Full,
    )
}

#[tauri::command]
pub fn list_backup_modules(_session: State<SessionState>) -> Vec<crate::models::backup::BackupModule> {
    backup_service::available_modules()
}

#[tauri::command]
pub fn pick_backup_folder(app: tauri::AppHandle, db: State<Database>, _session: State<SessionState>) -> Result<Option<String>, AppError> {
    use tauri_plugin_dialog::DialogExt;
    let guard = conn(&db)?;
    let folder = backup_service::backup_dir(&guard)?;
    let picked = app.dialog().file().set_title("Choose Backup Location").set_directory(&folder).blocking_pick_folder();
    match picked { Some(fp) => Ok(Some(fp.into_path().map_err(|e| AppError::validation(format!("Invalid path: {e}")))?.to_string_lossy().to_string())), None => Ok(None) }
}

#[tauri::command]
pub fn create_selective_backup(db: State<Database>, _session: State<SessionState>, actor: Option<i64>, modules: Vec<String>, folder: Option<String>) -> Result<crate::models::backup::Backup, AppError> {
    let guard = conn(&db)?;
    let dir = folder.filter(|f| !f.trim().is_empty()).map(std::path::PathBuf::from).unwrap_or(backup_service::backup_dir(&guard)?);
    backup_service::create_selective_backup(&guard, &dir, actor, modules)
}

#[tauri::command]
pub fn inspect_backup(id: Option<i64>, file_path: Option<String>, db: State<Database>, _session: State<SessionState>) -> Result<crate::models::backup::BackupInspection, AppError> {
    let guard = conn(&db)?;
    let path = if let Some(id) = id { backup_service::get_backup(&guard, id)?.ok_or_else(|| AppError::validation(format!("Backup #{id} not found")))?.file_path } else { file_path.ok_or_else(|| AppError::validation("Backup path is required"))? };
    backup_service::inspect_backup(std::path::Path::new(&path))
}

#[tauri::command]
pub fn open_backup_folder(path: String, _session: State<SessionState>) -> Result<(), AppError> {
    let target = std::path::PathBuf::from(path);
    let folder = if target.is_dir() { target } else { target.parent().ok_or_else(|| AppError::validation("Invalid backup path"))?.to_path_buf() };
    std::process::Command::new("explorer.exe").arg(&folder).spawn().map_err(|e| AppError::file(format!("Could not open backup folder: {e}")))?;
    Ok(())
}

#[tauri::command]
pub fn list_backups(
    db: State<Database>,
    _session: State<SessionState>,
) -> Result<Vec<crate::models::backup::Backup>, AppError> {
    let guard = conn(&db)?;
    backup_service::list_backups(&guard)
}

#[tauri::command]
pub fn get_backup(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
) -> Result<Option<crate::models::backup::Backup>, AppError> {
    let guard = conn(&db)?;
    backup_service::get_backup(&guard, id)
}

#[tauri::command]
pub fn delete_backup(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    id: i64,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    backup_service::delete_backup(&guard, actor, id)
}

#[tauri::command]
pub fn verify_backup(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    let item = backup_service::get_backup(&guard, id)?.ok_or_else(|| {
        AppError::validation(format!("Backup #{id} not found"))
    })?;
    backup_service::verify_backup_entry(std::path::Path::new(&item.file_path))
}

#[tauri::command]
pub fn restore_backup(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    id: i64,
) -> Result<(), AppError> {
    let mut guard = conn(&db)?;
    let item = backup_service::get_backup(&guard, id)?.ok_or_else(|| {
        AppError::validation(format!("Backup #{id} not found"))
    })?;
    let dir = backup_service::backup_dir(&guard)?;
    backup_service::restore_backup(
        &mut guard,
        &dir,
        actor,
        std::path::Path::new(&item.file_path),
    )
}

#[tauri::command]
pub fn pick_backup_file(app: tauri::AppHandle) -> Result<Option<String>, AppError> {
    use tauri_plugin_dialog::DialogExt;

    let folder = backup_service::desktop_folder()
        .unwrap_or_else(|_| std::env::temp_dir());
    let picked = app
        .dialog()
        .file()
        .add_filter("Backup files", &["zip"])
        .set_title("Select a Backup to Restore")
        .set_directory(&folder)
        .blocking_pick_file();

    match picked {
        Some(fp) => {
            let p = fp
                .into_path()
                .map_err(|e| AppError::validation(format!("Invalid path: {e}")))?;
            Ok(Some(p.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn restore_backup_from_path(
    db: State<Database>,
    _session: State<SessionState>,
    app: tauri::AppHandle,
    actor: Option<i64>,
    file_path: String,
) -> Result<(), AppError> {
    use std::path::PathBuf;

    let source = PathBuf::from(&file_path);
    let mut guard = conn(&db)?;
    let dir = backup_service::backup_dir(&guard)?;
    let file_name = source
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "restored_backup.zip".into());

    // 1) Pre-flight validation before opening the confirmation flow would happen.
    backup_service::validate_archive(&source)?;

    // 2) Restore into the live database.
    backup_service::restore_backup(&mut guard, &dir, actor, &source)?;

    // 3) Record the restoration in the backups table so it appears in history.
    let size = std::fs::metadata(&source)
        .map(|m| m.len() as i64)
        .unwrap_or(0);
    let bt = if file_name.starts_with("Selective_Backup") {
        crate::models::backup::BackupType::Selective
    } else if file_name.starts_with("Manual_Backup") {
        crate::models::backup::BackupType::Full
    } else {
        crate::models::backup::BackupType::Database
    };
    let _ = backup_repository::insert(
        &guard,
        &file_name,
        bt,
        &source.to_string_lossy(),
        size,
        BackupStatus::Success,
        actor,
    );

    let _ = app.emit("database-restored", "");
    Ok(())
}

#[tauri::command]
pub fn get_backup_config(
    db: State<Database>,
    _session: State<SessionState>,
) -> Result<crate::models::backup_config::BackupConfig, AppError> {
    let guard = conn(&db)?;
    backup_service::get_config(&guard)
}

#[tauri::command]
pub fn update_backup_config(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    input: crate::models::backup_config::UpdateBackupConfigInput,
) -> Result<crate::models::backup_config::BackupConfig, AppError> {
    let guard = conn(&db)?;
    backup_service::update_config(&guard, actor, input)
}

#[tauri::command]
pub fn get_backup_status(
    db: State<Database>,
    _session: State<SessionState>,
) -> Result<crate::models::backup_config::BackupStatusInfo, AppError> {
    let guard = conn(&db)?;
    backup_service::status_info(&guard)
}

// ---- Purchases ----

/// Create a purchase: validate items, atomically increment stock, register IMEIs.
#[tauri::command]
pub fn create_purchase(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    input: CreatePurchaseInput,
) -> Result<Purchase, AppError> {
    let guard = conn(&db)?;
    purchase_service::create_purchase(&guard, input, actor)
}

#[tauri::command]
pub fn list_purchases(
    db: State<Database>,
    _session: State<SessionState>,
    search: Option<String>,
) -> Result<Vec<Purchase>, AppError> {
    let guard = conn(&db)?;
    purchase_service::list(&guard, search)
}

#[tauri::command]
pub fn get_purchase(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
) -> Result<Purchase, AppError> {
    let guard = conn(&db)?;
    purchase_service::get(&guard, id)
}

// ---- Supplier payments & dues ----

/// Record a payment made to a supplier.
#[tauri::command]
pub fn create_supplier_payment(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    input: CreateSupplierPaymentInput,
) -> Result<SupplierPayment, AppError> {
    let guard = conn(&db)?;
    purchase_service::create_supplier_payment(&guard, input, actor)
}

#[tauri::command]
pub fn list_supplier_payments(
    db: State<Database>,
    _session: State<SessionState>,
    search: Option<String>,
) -> Result<Vec<SupplierPayment>, AppError> {
    let guard = conn(&db)?;
    purchase_service::list_supplier_payments(&guard, search)
}

#[tauri::command]
pub fn list_supplier_payments_by_supplier(
    db: State<Database>,
    _session: State<SessionState>,
    supplier_id: i64,
) -> Result<Vec<SupplierPayment>, AppError> {
    let guard = conn(&db)?;
    purchase_service::list_supplier_payments_by_supplier(&guard, supplier_id)
}

#[tauri::command]
pub fn delete_supplier_payment(
    db: State<Database>,
    _session: State<SessionState>,
    actor: Option<i64>,
    id: i64,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    purchase_service::delete_supplier_payment(&guard, id, actor)
}

#[tauri::command]
pub fn get_supplier_balance(
    db: State<Database>,
    _session: State<SessionState>,
    supplier_id: i64,
) -> Result<SupplierBalance, AppError> {
    let guard = conn(&db)?;
    purchase_service::supplier_balance(&guard, supplier_id)
}

#[tauri::command]
pub fn list_supplier_balances(
    db: State<Database>,
    _session: State<SessionState>,
    search: Option<String>,
) -> Result<Vec<SupplierBalance>, AppError> {
    let guard = conn(&db)?;
    purchase_service::list_supplier_balances(&guard, search)
}

#[tauri::command]
pub fn list_supplier_dues(
    db: State<Database>,
    _session: State<SessionState>,
    search: Option<String>,
) -> Result<Vec<SupplierBalance>, AppError> {
    let guard = conn(&db)?;
    purchase_service::list_supplier_dues(&guard, search)
}

// ---- Phone Options ----

#[tauri::command]
pub fn list_phone_options(
    db: State<Database>,
    _session: State<SessionState>,
    option_type: Option<String>,
) -> Result<Vec<crate::models::phone::PhoneOption>, AppError> {
    let guard = conn(&db)?;
    if let Some(t) = option_type {
        crate::services::phone_option_service::list_by_type(&guard, &t)
    } else {
        crate::services::phone_option_service::list_all(&guard)
    }
}

#[tauri::command]
pub fn create_phone_option(
    db: State<Database>,
    _session: State<SessionState>,
    input: crate::models::phone::CreatePhoneOptionInput,
    _actor: Option<i64>,
) -> Result<crate::models::phone::PhoneOption, AppError> {
    let guard = conn(&db)?;
    crate::services::phone_option_service::create(&guard, input)
}

#[tauri::command]
pub fn update_phone_option(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    input: crate::models::phone::CreatePhoneOptionInput,
    _actor: Option<i64>,
) -> Result<crate::models::phone::PhoneOption, AppError> {
    let guard = conn(&db)?;
    crate::services::phone_option_service::update(&guard, id, input)
}

#[tauri::command]
pub fn delete_phone_option(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    _actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    crate::services::phone_option_service::delete(&guard, id)
}

#[tauri::command]
pub fn set_phone_option_active(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    is_active: bool,
    _actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    crate::services::phone_option_service::set_active(&guard, id, is_active)
}

// ---- Accessory Options (reuse the phone_options table) ----

#[tauri::command]
pub fn list_accessory_options(
    db: State<Database>,
    _session: State<SessionState>,
    option_type: Option<String>,
) -> Result<Vec<crate::models::phone::PhoneOption>, AppError> {
    let guard = conn(&db)?;
    if let Some(t) = option_type {
        crate::services::phone_option_service::list_by_type(&guard, &t)
    } else {
        crate::services::phone_option_service::list_all(&guard)
    }
}

#[tauri::command]
pub fn create_accessory_option(
    db: State<Database>,
    _session: State<SessionState>,
    input: crate::models::phone::CreatePhoneOptionInput,
    _actor: Option<i64>,
) -> Result<crate::models::phone::PhoneOption, AppError> {
    let guard = conn(&db)?;
    crate::services::phone_option_service::create(&guard, input)
}

#[tauri::command]
pub fn update_accessory_option(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    input: crate::models::phone::CreatePhoneOptionInput,
    _actor: Option<i64>,
) -> Result<crate::models::phone::PhoneOption, AppError> {
    let guard = conn(&db)?;
    crate::services::phone_option_service::update(&guard, id, input)
}

#[tauri::command]
pub fn delete_accessory_option(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    _actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    crate::services::phone_option_service::delete(&guard, id)
}

#[tauri::command]
pub fn set_accessory_option_active(
    db: State<Database>,
    _session: State<SessionState>,
    id: i64,
    is_active: bool,
    _actor: Option<i64>,
) -> Result<(), AppError> {
    let guard = conn(&db)?;
    crate::services::phone_option_service::set_active(&guard, id, is_active)
}
