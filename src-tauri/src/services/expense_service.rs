use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::expense::{Category, CategoryTotal, CreateCategoryInput, CreateExpenseInput, Expense};
use crate::repositories::{category_repository, expense_repository};
use crate::services::record_activity;

pub fn normalize_date(date: &str) -> Result<String, AppError> {
    if date.is_empty() {
        return Err(AppError::validation("Expense date is required"));
    }
    match chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d") {
        Ok(d) => Ok(d.to_string()),
        Err(_) => Err(AppError::validation(
            "Expense date must be in YYYY-MM-DD format",
        )),
    }
}

fn validate_amount(amount: f64) -> Result<(), AppError> {
    if !amount.is_finite() {
        return Err(AppError::validation("Expense amount is invalid"));
    }
    if amount <= 0.0 {
        return Err(AppError::validation("Expense amount must be greater than zero"));
    }
    Ok(())
}

fn validate_category_name(name: &str) -> Result<(), AppError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::validation("Category name is required"));
    }
    Ok(())
}

pub fn create_category(
    conn: &Connection,
    input: &CreateCategoryInput,
    user_id: Option<i64>,
) -> Result<i64, AppError> {
    validate_category_name(&input.name)?;
    let id = category_repository::insert(conn, input)?;
    record_activity(conn, user_id, "expenses", "category_create", Some(id))?;
    Ok(id)
}

pub fn list_categories(conn: &Connection) -> Result<Vec<Category>, AppError> {
    category_repository::list(conn)
}

pub fn update_category(
    conn: &Connection,
    id: i64,
    input: &CreateCategoryInput,
    user_id: Option<i64>,
) -> Result<Category, AppError> {
    validate_category_name(&input.name)?;
    if category_repository::get_by_id(conn, id)?.is_none() {
        return Err(AppError::validation("Category not found"));
    }
    category_repository::update(conn, id, input)?;
    record_activity(conn, user_id, "expenses", "category_update", Some(id))?;
    category_repository::get_by_id(conn, id)?.ok_or_else(|| AppError::validation("Category not found"))
}

pub fn delete_category(conn: &Connection, id: i64, user_id: Option<i64>) -> Result<(), AppError> {
    if category_repository::get_by_id(conn, id)?.is_none() {
        return Err(AppError::validation("Category not found"));
    }
    if category_repository::category_in_use(conn, id)? {
        return Err(AppError::validation(
            "Cannot delete this category because expenses reference it",
        ));
    }
    category_repository::delete(conn, id)?;
    record_activity(conn, user_id, "expenses", "category_delete", Some(id))?;
    Ok(())
}

pub fn create_expense(
    conn: &Connection,
    input: &CreateExpenseInput,
    user_id: Option<i64>,
) -> Result<i64, AppError> {
    validate_amount(input.amount)?;
    if category_repository::get_by_id(conn, input.category_id)?.is_none() {
        return Err(AppError::validation("Selected category does not exist"));
    }
    let date = match &input.expense_date {
        Some(d) => normalize_date(d)?,
        None => chrono::Local::now().format("%Y-%m-%d").to_string(),
    };
    let normalized = CreateExpenseInput {
        expense_date: Some(date),
        amount: input.amount,
        description: input.description.clone(),
        category_id: input.category_id,
        receipt_path: input.receipt_path.clone(),
    };
    let id = expense_repository::insert(conn, &normalized, user_id)?;
    record_activity(conn, user_id, "expenses", "create", Some(id))?;
    Ok(id)
}

pub fn list_expenses(
    conn: &Connection,
    category_id: Option<i64>,
    from: Option<String>,
    to: Option<String>,
) -> Result<Vec<Expense>, AppError> {
    expense_repository::list(conn, category_id, from.as_deref(), to.as_deref())
}

pub fn get_expense(conn: &Connection, id: i64) -> Result<Expense, AppError> {
    expense_repository::get_by_id(conn, id, false)?
        .ok_or_else(|| AppError::validation("Expense not found"))
}

pub fn delete_expense(conn: &Connection, id: i64, user_id: Option<i64>) -> Result<(), AppError> {
    if expense_repository::get_by_id(conn, id, false)?.is_none() {
        return Err(AppError::validation("Expense not found"));
    }
    expense_repository::soft_delete(conn, id)?;
    record_activity(conn, user_id, "expenses", "delete", Some(id))?;
    Ok(())
}

pub fn category_expense_totals(conn: &Connection, from: &str, to: &str) -> Result<Vec<CategoryTotal>, AppError> {
    expense_repository::category_totals(conn, from, to)
}

pub fn total_in_range(conn: &Connection, from: &str, to: &str) -> Result<f64, AppError> {
    expense_repository::total_in_range(conn, from, to)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_utils::in_memory_conn;

    fn cat_input(name: &str) -> CreateCategoryInput {
        CreateCategoryInput {
            name: name.to_string(),
            category_type: Some("expense".to_string()),
        }
    }

    fn expense_input(category_id: i64, amount: f64) -> CreateExpenseInput {
        CreateExpenseInput {
            category_id,
            amount,
            description: Some("Monthly rent".to_string()),
            receipt_path: None,
            expense_date: Some("2026-01-15".to_string()),
        }
    }

    #[test]
    fn create_and_list_expense() {
        let conn = in_memory_conn();
        let cat = create_category(&conn, &cat_input("Rent"), None).unwrap();
        let id = create_expense(&conn, &expense_input(cat, 500.0), Some(1)).unwrap();
        let exp = get_expense(&conn, id).unwrap();
        assert_eq!(exp.amount, 500.0);
        assert_eq!(exp.description.as_deref(), Some("Monthly rent"));
        assert_eq!(list_expenses(&conn, None, None, None).unwrap().len(), 1);
    }

    #[test]
    fn reject_negative_and_zero_amount() {
        let conn = in_memory_conn();
        let cat = create_category(&conn, &cat_input("Rent"), None).unwrap();
        assert!(create_expense(&conn, &expense_input(cat, 0.0), None).is_err());
        assert!(create_expense(&conn, &expense_input(cat, -5.0), None).is_err());
    }

    #[test]
    fn reject_missing_category() {
        let conn = in_memory_conn();
        assert!(create_expense(&conn, &expense_input(999, 100.0), None).is_err());
    }

    #[test]
    fn reject_invalid_date() {
        let conn = in_memory_conn();
        let cat = create_category(&conn, &cat_input("Rent"), None).unwrap();
        let mut input = expense_input(cat, 100.0);
        input.expense_date = Some("not-a-date".to_string());
        assert!(create_expense(&conn, &input, None).is_err());
    }

    #[test]
    fn reject_duplicate_category_name() {
        let conn = in_memory_conn();
        create_category(&conn, &cat_input("Utilities"), None).unwrap();
        assert!(create_category(&conn, &cat_input("Utilities"), None).is_err());
    }

    #[test]
    fn reject_blank_category_name() {
        let conn = in_memory_conn();
        assert!(create_category(&conn, &cat_input("   "), None).is_err());
    }

    #[test]
    fn delete_category_locked_by_expense() {
        let conn = in_memory_conn();
        let cat = create_category(&conn, &cat_input("Rent"), None).unwrap();
        create_expense(&conn, &expense_input(cat, 100.0), None).unwrap();
        assert!(delete_category(&conn, cat, None).is_err());
    }

    #[test]
    fn delete_expense_soft_deletes() {
        let conn = in_memory_conn();
        let cat = create_category(&conn, &cat_input("Rent"), None).unwrap();
        let id = create_expense(&conn, &expense_input(cat, 100.0), None).unwrap();
        delete_expense(&conn, id, None).unwrap();
        assert!(get_expense(&conn, id).is_err());
        assert_eq!(list_expenses(&conn, None, None, None).unwrap().len(), 0);
    }

    #[test]
    fn category_totals_aggregate() {
        let conn = in_memory_conn();
        let cat = create_category(&conn, &cat_input("Rent"), None).unwrap();
        create_expense(&conn, &expense_input(cat, 300.0), None).unwrap();
        create_expense(&conn, &expense_input(cat, 200.0), None).unwrap();
        let totals = category_expense_totals(&conn, "2026-01-01", "2026-01-31").unwrap();
        assert_eq!(totals.len(), 1);
        assert_eq!(totals[0].total, 500.0);
    }
}
