use chrono::{NaiveDate, NaiveTime};
use rusqlite::{params, Connection};

use crate::errors::AppError;
use crate::models::staff::{SalaryInput, SalaryRecord, StaffInput, StaffMember};
use crate::repositories::{expense_repository, staff_repository};
use crate::services::record_activity;

fn clean(s: &str) -> String {
    s.trim().to_string()
}

fn clean_opt(s: &Option<String>) -> Option<String> {
    s.as_ref()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn validate_money(value: f64, label: &str, allow_zero: bool) -> Result<f64, AppError> {
    if !value.is_finite() {
        return Err(AppError::validation(format!("{label} is invalid")));
    }
    if allow_zero {
        if value < 0.0 {
            return Err(AppError::validation(format!("{label} cannot be negative")));
        }
    } else if value <= 0.0 {
        return Err(AppError::validation(format!(
            "{label} must be greater than zero"
        )));
    }
    Ok((value * 100.0).round() / 100.0)
}

fn validate_date(value: &str, label: &str) -> Result<String, AppError> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map(|d| d.to_string())
        .map_err(|_| AppError::validation(format!("{label} must be in YYYY-MM-DD format")))
}

fn validate_month(value: &str) -> Result<String, AppError> {
    let v = value.trim();
    NaiveDate::parse_from_str(&format!("{v}-01"), "%Y-%m-%d")
        .map(|_| v.to_string())
        .map_err(|_| AppError::validation("Salary month must be in YYYY-MM format"))
}

fn validate_time(value: &Option<String>) -> Result<Option<String>, AppError> {
    match clean_opt(value) {
        Some(v) => NaiveTime::parse_from_str(&v, "%H:%M")
            .map(|t| Some(t.format("%H:%M").to_string()))
            .map_err(|_| AppError::validation("Payment time must be in HH:MM format")),
        None => Ok(None),
    }
}

fn normalize_staff(conn: &Connection, mut input: StaffInput) -> Result<StaffInput, AppError> {
    input.name = clean(&input.name);
    input.phone = clean(&input.phone);
    input.position = clean(&input.position);
    input.joining_date = validate_date(&input.joining_date, "Joining date")?;
    input.monthly_salary = validate_money(input.monthly_salary, "Monthly salary", false)?;
    input.notes = clean_opt(&input.notes);
    input.status = Some(
        match input.status.as_deref().map(str::trim).unwrap_or("active") {
            "active" => "active".to_string(),
            "inactive" => "inactive".to_string(),
            _ => {
                return Err(AppError::validation(
                    "Staff status must be Active or Inactive",
                ))
            }
        },
    );

    if input.name.is_empty() {
        return Err(AppError::validation("Staff name is required"));
    }
    if input.phone.is_empty() {
        return Err(AppError::validation("Phone number is required"));
    }
    if input.position.is_empty() {
        return Err(AppError::validation("Position / role is required"));
    }
    if let Some(user_id) = input.user_id {
        if !staff_repository::user_exists(conn, user_id)? {
            return Err(AppError::validation("Linked user account was not found"));
        }
    }
    Ok(input)
}

fn normalize_salary(
    conn: &Connection,
    mut input: SalaryInput,
) -> Result<(SalaryInput, f64, f64, String), AppError> {
    if staff_repository::get_staff(conn, input.staff_id)?.is_none() {
        return Err(AppError::validation("Staff member not found"));
    }
    input.salary_month = validate_month(&input.salary_month)?;
    input.base_salary = validate_money(input.base_salary, "Base salary", false)?;
    input.bonus = Some(validate_money(input.bonus.unwrap_or(0.0), "Bonus", true)?);
    input.deduction = Some(validate_money(
        input.deduction.unwrap_or(0.0),
        "Deduction",
        true,
    )?);
    input.amount_paid = validate_money(input.amount_paid, "Amount paid", true)?;
    input.payment_date = match clean_opt(&input.payment_date) {
        Some(d) => Some(validate_date(&d, "Payment date")?),
        None => None,
    };
    input.payment_time = validate_time(&input.payment_time)?;
    input.payment_method = clean_opt(&input.payment_method);
    input.notes = clean_opt(&input.notes);

    let net = validate_money(
        input.base_salary + input.bonus.unwrap_or(0.0) - input.deduction.unwrap_or(0.0),
        "Net salary",
        false,
    )?;
    if input.amount_paid > net {
        return Err(AppError::validation(
            "Amount paid cannot be greater than net salary",
        ));
    }
    if input.amount_paid > 0.0 && input.payment_date.is_none() {
        input.payment_date = Some(chrono::Local::now().format("%Y-%m-%d").to_string());
    }
    if input.amount_paid > 0.0 && input.payment_method.is_none() {
        return Err(AppError::validation(
            "Payment method is required when amount paid is entered",
        ));
    }
    let remaining = ((net - input.amount_paid) * 100.0).round() / 100.0;
    let status = if input.amount_paid <= 0.0 {
        "Unpaid"
    } else if remaining > 0.0 {
        "Partial"
    } else {
        "Paid"
    }
    .to_string();
    Ok((input, net, remaining, status))
}

fn salary_expense_description(conn: &Connection, salary: &SalaryInput) -> Result<String, AppError> {
    let staff = staff_repository::get_staff(conn, salary.staff_id)?
        .ok_or_else(|| AppError::validation("Staff member not found"))?;
    Ok(format!(
        "Salary payment - {} - {}",
        staff.name, salary.salary_month
    ))
}

fn sync_salary_expense(
    conn: &Connection,
    salary: &SalaryInput,
    existing_expense_id: Option<i64>,
    user_id: Option<i64>,
) -> Result<Option<i64>, AppError> {
    if salary.amount_paid <= 0.0 {
        if let Some(id) = existing_expense_id {
            expense_repository::soft_delete(conn, id)?;
        }
        return Ok(None);
    }

    let category_id = staff_repository::salary_expense_category_id(conn)?;
    let date = salary
        .payment_date
        .clone()
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
    let description = salary_expense_description(conn, salary)?;

    if let Some(id) = existing_expense_id {
        let updated = expense_repository::update_linked_salary_expense(
            conn,
            id,
            category_id,
            salary.amount_paid,
            &description,
            &date,
            user_id,
        )?;
        if updated {
            return Ok(Some(id));
        }
    }

    conn.execute(
        "INSERT INTO expenses (category_id, amount, description, expense_date, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![category_id, salary.amount_paid, description, date, user_id],
    )?;
    Ok(Some(conn.last_insert_rowid()))
}

pub fn create_staff(
    conn: &Connection,
    input: StaffInput,
    user_id: Option<i64>,
) -> Result<StaffMember, AppError> {
    let input = normalize_staff(conn, input)?;
    let id = staff_repository::insert_staff(conn, &input)?;
    record_activity(conn, user_id, "staff", "create", Some(id))?;
    staff_repository::get_staff(conn, id)?
        .ok_or_else(|| AppError::Internal("Created staff member could not be retrieved".into()))
}

pub fn list_staff(
    conn: &Connection,
    search: Option<String>,
    status: Option<String>,
) -> Result<Vec<StaffMember>, AppError> {
    staff_repository::list_staff(conn, search.as_deref(), status.as_deref())
}

pub fn update_staff(
    conn: &Connection,
    id: i64,
    input: StaffInput,
    user_id: Option<i64>,
) -> Result<StaffMember, AppError> {
    let input = normalize_staff(conn, input)?;
    if !staff_repository::update_staff(conn, id, &input)? {
        return Err(AppError::validation("Staff member not found"));
    }
    record_activity(conn, user_id, "staff", "update", Some(id))?;
    staff_repository::get_staff(conn, id)?
        .ok_or_else(|| AppError::Internal("Updated staff member could not be retrieved".into()))
}

pub fn delete_staff(conn: &Connection, id: i64, user_id: Option<i64>) -> Result<(), AppError> {
    if !staff_repository::soft_delete_staff(conn, id)? {
        return Err(AppError::validation("Staff member not found"));
    }
    record_activity(conn, user_id, "staff", "delete", Some(id))
}

pub fn create_salary(
    conn: &Connection,
    input: SalaryInput,
    user_id: Option<i64>,
) -> Result<SalaryRecord, AppError> {
    let (input, net, remaining, status) = normalize_salary(conn, input)?;
    if staff_repository::salary_month_exists(conn, input.staff_id, &input.salary_month, None)? {
        return Err(AppError::validation(
            "A salary record already exists for this staff member and month",
        ));
    }
    let expense_id = sync_salary_expense(conn, &input, None, user_id)?;
    let id = staff_repository::insert_salary(conn, &input, net, remaining, &status, expense_id)?;
    record_activity(conn, user_id, "salary", "create", Some(id))?;
    staff_repository::get_salary(conn, id)?
        .ok_or_else(|| AppError::Internal("Created salary record could not be retrieved".into()))
}

pub fn list_salaries(
    conn: &Connection,
    search: Option<String>,
    month: Option<String>,
    status: Option<String>,
    staff_id: Option<i64>,
) -> Result<Vec<SalaryRecord>, AppError> {
    staff_repository::list_salaries(
        conn,
        search.as_deref(),
        month.as_deref(),
        status.as_deref(),
        staff_id,
    )
}

pub fn update_salary(
    conn: &Connection,
    id: i64,
    input: SalaryInput,
    user_id: Option<i64>,
) -> Result<SalaryRecord, AppError> {
    let current = staff_repository::get_salary(conn, id)?
        .ok_or_else(|| AppError::validation("Salary record not found"))?;
    let (input, net, remaining, status) = normalize_salary(conn, input)?;
    if staff_repository::salary_month_exists(conn, input.staff_id, &input.salary_month, Some(id))? {
        return Err(AppError::validation(
            "A salary record already exists for this staff member and month",
        ));
    }
    let expense_id = sync_salary_expense(conn, &input, current.expense_id, user_id)?;
    if !staff_repository::update_salary(conn, id, &input, net, remaining, &status, expense_id)? {
        return Err(AppError::validation("Salary record not found"));
    }
    record_activity(conn, user_id, "salary", "update", Some(id))?;
    staff_repository::get_salary(conn, id)?
        .ok_or_else(|| AppError::Internal("Updated salary record could not be retrieved".into()))
}

pub fn delete_salary(conn: &Connection, id: i64, user_id: Option<i64>) -> Result<(), AppError> {
    let current = staff_repository::get_salary(conn, id)?
        .ok_or_else(|| AppError::validation("Salary record not found"))?;
    if let Some(expense_id) = current.expense_id {
        expense_repository::soft_delete(conn, expense_id)?;
    }
    if !staff_repository::soft_delete_salary(conn, id)? {
        return Err(AppError::validation("Salary record not found"));
    }
    record_activity(conn, user_id, "salary", "delete", Some(id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_utils::in_memory_conn;

    fn seed(conn: &Connection) {
        conn.execute(
            "INSERT INTO users (username, password_hash, role_id) VALUES ('admin', 'x', 1)",
            [],
        )
        .unwrap();
    }

    fn staff_input() -> StaffInput {
        StaffInput {
            user_id: None,
            name: "Ali Khan".into(),
            phone: "03001234567".into(),
            position: "Sales".into(),
            joining_date: "2026-09-01".into(),
            monthly_salary: 30000.0,
            status: Some("active".into()),
            notes: None,
        }
    }

    #[test]
    fn salary_payment_creates_and_updates_single_expense() {
        let conn = in_memory_conn();
        seed(&conn);
        let staff = create_staff(&conn, staff_input(), Some(1)).unwrap();
        let salary = create_salary(
            &conn,
            SalaryInput {
                staff_id: staff.id,
                salary_month: "2026-09".into(),
                base_salary: 30000.0,
                bonus: Some(2000.0),
                deduction: Some(1000.0),
                amount_paid: 15000.0,
                payment_date: Some("2026-09-30".into()),
                payment_time: Some("18:45".into()),
                payment_method: Some("Cash".into()),
                notes: None,
            },
            Some(1),
        )
        .unwrap();
        assert_eq!(salary.net_salary, 31000.0);
        assert_eq!(salary.remaining_balance, 16000.0);
        assert_eq!(salary.payment_status, "Partial");
        let expense_id = salary.expense_id.unwrap();

        let updated = update_salary(
            &conn,
            salary.id,
            SalaryInput {
                amount_paid: 31000.0,
                ..SalaryInput {
                    staff_id: staff.id,
                    salary_month: "2026-09".into(),
                    base_salary: 30000.0,
                    bonus: Some(2000.0),
                    deduction: Some(1000.0),
                    payment_date: Some("2026-09-30".into()),
                    payment_time: Some("18:45".into()),
                    payment_method: Some("Cash".into()),
                    notes: None,
                    amount_paid: 15000.0,
                }
            },
            Some(1),
        )
        .unwrap();
        assert_eq!(updated.payment_status, "Paid");
        assert_eq!(updated.expense_id, Some(expense_id));

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM expenses WHERE is_deleted = 0",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let total: f64 = conn
            .query_row(
                "SELECT SUM(amount) FROM expenses WHERE is_deleted = 0",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
        assert_eq!(total, 31000.0);
    }
}
