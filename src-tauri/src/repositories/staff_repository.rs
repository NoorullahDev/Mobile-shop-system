use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::errors::AppError;
use crate::models::staff::{SalaryInput, SalaryRecord, StaffInput, StaffMember};

fn staff_from_row(r: &Row) -> rusqlite::Result<StaffMember> {
    Ok(StaffMember {
        id: r.get("id")?,
        user_id: r.get("user_id")?,
        username: r.get("username")?,
        name: r.get("name")?,
        phone: r.get("phone")?,
        position: r.get("position")?,
        joining_date: r.get("joining_date")?,
        monthly_salary: r.get("monthly_salary")?,
        status: r.get("status")?,
        notes: r.get("notes")?,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
        is_deleted: r.get::<_, i64>("is_deleted")? != 0,
    })
}

fn salary_from_row(r: &Row) -> rusqlite::Result<SalaryRecord> {
    Ok(SalaryRecord {
        id: r.get("id")?,
        staff_id: r.get("staff_id")?,
        staff_name: r.get("staff_name")?,
        salary_month: r.get("salary_month")?,
        base_salary: r.get("base_salary")?,
        bonus: r.get("bonus")?,
        deduction: r.get("deduction")?,
        net_salary: r.get("net_salary")?,
        amount_paid: r.get("amount_paid")?,
        remaining_balance: r.get("remaining_balance")?,
        payment_status: r.get("payment_status")?,
        payment_date: r.get("payment_date")?,
        payment_time: r.get("payment_time")?,
        payment_method: r.get("payment_method")?,
        notes: r.get("notes")?,
        expense_id: r.get("expense_id")?,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
        is_deleted: r.get::<_, i64>("is_deleted")? != 0,
    })
}

const STAFF_SELECT: &str = "SELECT s.id, s.user_id, u.username, s.name, s.phone, s.position,
    s.joining_date, s.monthly_salary, s.status, s.notes, s.created_at, s.updated_at, s.is_deleted
    FROM staff_members s LEFT JOIN users u ON u.id = s.user_id";

const SALARY_SELECT: &str = "SELECT sr.id, sr.staff_id, s.name AS staff_name, sr.salary_month,
    sr.base_salary, sr.bonus, sr.deduction, sr.net_salary, sr.amount_paid,
    sr.remaining_balance, sr.payment_status, sr.payment_date, sr.payment_time,
    sr.payment_method, sr.notes, sr.expense_id, sr.created_at, sr.updated_at, sr.is_deleted
    FROM salary_records sr JOIN staff_members s ON s.id = sr.staff_id";

pub fn user_exists(conn: &Connection, user_id: i64) -> Result<bool, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE id = ?1 AND is_deleted = 0",
        [user_id],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

pub fn get_staff(conn: &Connection, id: i64) -> Result<Option<StaffMember>, AppError> {
    Ok(conn
        .query_row(
            &format!("{STAFF_SELECT} WHERE s.id = ?1 AND s.is_deleted = 0"),
            [id],
            staff_from_row,
        )
        .optional()?)
}

pub fn list_staff(
    conn: &Connection,
    search: Option<&str>,
    status: Option<&str>,
) -> Result<Vec<StaffMember>, AppError> {
    let mut sql = format!("{STAFF_SELECT} WHERE s.is_deleted = 0");
    let mut q: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(s) = search.map(str::trim).filter(|s| !s.is_empty()) {
        let value = rusqlite::types::Value::from(format!("%{s}%"));
        sql.push_str(" AND (s.name LIKE ? OR s.phone LIKE ? OR s.position LIKE ? OR COALESCE(u.username, '') LIKE ?)");
        q.extend([value.clone(), value.clone(), value.clone(), value]);
    }
    if let Some(st) = status.map(str::trim).filter(|s| !s.is_empty()) {
        sql.push_str(" AND s.status = ?");
        q.push(rusqlite::types::Value::from(st.to_string()));
    }
    sql.push_str(" ORDER BY s.status, s.name");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), staff_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn insert_staff(conn: &Connection, input: &StaffInput) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO staff_members (user_id, name, phone, position, joining_date, monthly_salary, status, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            input.user_id,
            input.name,
            input.phone,
            input.position,
            input.joining_date,
            input.monthly_salary,
            input.status.as_deref().unwrap_or("active"),
            input.notes
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_staff(conn: &Connection, id: i64, input: &StaffInput) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE staff_members SET user_id = ?1, name = ?2, phone = ?3, position = ?4,
         joining_date = ?5, monthly_salary = ?6, status = ?7, notes = ?8, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?9 AND is_deleted = 0",
        params![
            input.user_id,
            input.name,
            input.phone,
            input.position,
            input.joining_date,
            input.monthly_salary,
            input.status.as_deref().unwrap_or("active"),
            input.notes,
            id
        ],
    )?;
    Ok(affected > 0)
}

pub fn soft_delete_staff(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE staff_members SET is_deleted = 1, status = 'inactive', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND is_deleted = 0",
        [id],
    )?;
    Ok(affected > 0)
}

pub fn get_salary(conn: &Connection, id: i64) -> Result<Option<SalaryRecord>, AppError> {
    Ok(conn
        .query_row(
            &format!("{SALARY_SELECT} WHERE sr.id = ?1 AND sr.is_deleted = 0"),
            [id],
            salary_from_row,
        )
        .optional()?)
}

pub fn salary_month_exists(
    conn: &Connection,
    staff_id: i64,
    salary_month: &str,
    exclude_id: Option<i64>,
) -> Result<bool, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM salary_records
         WHERE staff_id = ?1 AND salary_month = ?2 AND is_deleted = 0 AND (?3 IS NULL OR id != ?3)",
        params![staff_id, salary_month, exclude_id],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

pub fn list_salaries(
    conn: &Connection,
    search: Option<&str>,
    month: Option<&str>,
    status: Option<&str>,
    staff_id: Option<i64>,
) -> Result<Vec<SalaryRecord>, AppError> {
    let mut sql = format!("{SALARY_SELECT} WHERE sr.is_deleted = 0");
    let mut q: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(id) = staff_id {
        sql.push_str(" AND sr.staff_id = ?");
        q.push(rusqlite::types::Value::from(id));
    }
    if let Some(s) = search.map(str::trim).filter(|s| !s.is_empty()) {
        let value = rusqlite::types::Value::from(format!("%{s}%"));
        sql.push_str(" AND (s.name LIKE ? OR s.phone LIKE ? OR s.position LIKE ?)");
        q.extend([value.clone(), value.clone(), value]);
    }
    if let Some(m) = month.map(str::trim).filter(|s| !s.is_empty()) {
        sql.push_str(" AND sr.salary_month = ?");
        q.push(rusqlite::types::Value::from(m.to_string()));
    }
    if let Some(st) = status.map(str::trim).filter(|s| !s.is_empty()) {
        sql.push_str(" AND sr.payment_status = ?");
        q.push(rusqlite::types::Value::from(st.to_string()));
    }
    sql.push_str(" ORDER BY sr.salary_month DESC, s.name");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), salary_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

#[allow(clippy::too_many_arguments)]
pub fn insert_salary(
    conn: &Connection,
    input: &SalaryInput,
    net_salary: f64,
    remaining_balance: f64,
    payment_status: &str,
    expense_id: Option<i64>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO salary_records (staff_id, salary_month, base_salary, bonus, deduction,
         net_salary, amount_paid, remaining_balance, payment_status, payment_date, payment_time,
         payment_method, notes, expense_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            input.staff_id,
            input.salary_month,
            input.base_salary,
            input.bonus.unwrap_or(0.0),
            input.deduction.unwrap_or(0.0),
            net_salary,
            input.amount_paid,
            remaining_balance,
            payment_status,
            input.payment_date,
            input.payment_time,
            input.payment_method,
            input.notes,
            expense_id,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_salary(
    conn: &Connection,
    id: i64,
    input: &SalaryInput,
    net_salary: f64,
    remaining_balance: f64,
    payment_status: &str,
    expense_id: Option<i64>,
) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE salary_records SET staff_id = ?1, salary_month = ?2, base_salary = ?3,
         bonus = ?4, deduction = ?5, net_salary = ?6, amount_paid = ?7, remaining_balance = ?8,
         payment_status = ?9, payment_date = ?10, payment_time = ?11, payment_method = ?12,
         notes = ?13, expense_id = ?14, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?15 AND is_deleted = 0",
        params![
            input.staff_id,
            input.salary_month,
            input.base_salary,
            input.bonus.unwrap_or(0.0),
            input.deduction.unwrap_or(0.0),
            net_salary,
            input.amount_paid,
            remaining_balance,
            payment_status,
            input.payment_date,
            input.payment_time,
            input.payment_method,
            input.notes,
            expense_id,
            id
        ],
    )?;
    Ok(affected > 0)
}

pub fn soft_delete_salary(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE salary_records SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND is_deleted = 0",
        [id],
    )?;
    Ok(affected > 0)
}

pub fn salary_expense_category_id(conn: &Connection) -> Result<i64, AppError> {
    conn.execute(
        "INSERT OR IGNORE INTO categories (name, type) VALUES ('Salary', 'expense')",
        [],
    )?;
    Ok(
        conn.query_row("SELECT id FROM categories WHERE name = 'Salary'", [], |r| {
            r.get(0)
        })?,
    )
}
