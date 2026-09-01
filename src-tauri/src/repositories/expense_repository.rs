use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::errors::AppError;
use crate::models::expense::{CategoryTotal, CreateExpenseInput, Expense};

fn from_row(r: &Row) -> rusqlite::Result<Expense> {
    Ok(Expense {
        id: r.get("id")?,
        category_id: r.get("category_id")?,
        category_name: r.get("category_name")?,
        amount: r.get("amount")?,
        description: r.get("description")?,
        receipt_path: r.get("receipt_path")?,
        expense_date: r.get("expense_date")?,
        created_by: r.get("created_by")?,
        created_at: r.get("created_at")?,
        is_deleted: r.get("is_deleted")?,
    })
}

const SELECT: &str = "SELECT e.id, e.category_id, c.name AS category_name, e.amount,
    e.description, e.receipt_path, e.expense_date, e.created_by, e.created_at, e.is_deleted
    FROM expenses e LEFT JOIN categories c ON c.id = e.category_id";

pub fn insert(conn: &Connection, input: &CreateExpenseInput, user_id: Option<i64>) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO expenses (category_id, amount, description, receipt_path, expense_date, created_by)
         VALUES (?1, ?2, ?3, ?4, COALESCE(?5, CURRENT_TIMESTAMP), ?6)",
        params![
            input.category_id,
            input.amount,
            input.description,
            input.receipt_path,
            input.expense_date.as_deref(),
            user_id,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_by_id(conn: &Connection, id: i64, include_deleted: bool) -> Result<Option<Expense>, AppError> {
    let sql = if include_deleted {
        format!("{SELECT} WHERE e.id = ?1")
    } else {
        format!("{SELECT} WHERE e.id = ?1 AND e.is_deleted = 0")
    };
    let row = conn.query_row(&sql, [id], from_row).optional()?;
    Ok(row)
}

pub fn list(
    conn: &Connection,
    category_id: Option<i64>,
    from: Option<&str>,
    to: Option<&str>,
) -> Result<Vec<Expense>, AppError> {
    let mut sql = format!(
        "{SELECT} WHERE e.is_deleted = 0"
    );
    let mut q: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(id) = category_id {
        sql.push_str(" AND e.category_id = ?");
        q.push(rusqlite::types::Value::from(id));
    }
    if let Some(f) = from {
        if !f.trim().is_empty() {
            sql.push_str(" AND e.expense_date >= ?");
            q.push(rusqlite::types::Value::from(f.trim().to_string()));
        }
    }
    if let Some(t) = to {
        if !t.trim().is_empty() {
            sql.push_str(" AND e.expense_date <= ?");
            q.push(rusqlite::types::Value::from(t.trim().to_string()));
        }
    }
    sql.push_str(" ORDER BY e.expense_date DESC, e.id DESC LIMIT 1000");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Total spent for a date range (ISO yyyy-mm-dd), inclusive, non-deleted only.
pub fn total_in_range(conn: &Connection, from: &str, to: &str) -> Result<f64, AppError> {
    let total = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses
         WHERE is_deleted = 0 AND date(expense_date) >= date(?1) AND date(expense_date) <= date(?2)",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    Ok(total)
}

pub fn category_totals(conn: &Connection, from: &str, to: &str) -> Result<Vec<CategoryTotal>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT e.category_id, c.name AS category_name,
                SUM(e.amount) AS total, COUNT(*) AS count
         FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
         WHERE e.is_deleted = 0 AND date(e.expense_date) >= date(?1) AND date(e.expense_date) <= date(?2)
         GROUP BY e.category_id ORDER BY total DESC",
    )?;
    let rows = stmt.query_map(params![from, to], |r| {
        Ok(CategoryTotal {
            category_id: r.get("category_id")?,
            category_name: r.get("category_name")?,
            total: r.get("total")?,
            count: r.get("count")?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn soft_delete(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE expenses SET is_deleted = 1 WHERE id = ?1 AND is_deleted = 0",
        [id],
    )?;
    Ok(affected > 0)
}
