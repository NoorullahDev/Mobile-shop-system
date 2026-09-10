use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::errors::AppError;
use crate::models::payment::{CreatePaymentInput, MemberBalance, Payment};

fn payment_from_row(r: &Row) -> rusqlite::Result<Payment> {
    Ok(Payment {
        id: r.get("id")?,
        member_id: r.get("member_id")?,
        member_name: r.get("member_name")?,
        amount: r.get("amount")?,
        payment_method: r.get("payment_method")?,
        payment_type: r.get("payment_type")?,
        status: r.get("status")?,
        reference: r.get("reference")?,
        notes: r.get("notes")?,
        payment_date: r.get("payment_date")?,
        created_by: r.get("created_by")?,
        created_at: r.get("created_at")?,
        is_deleted: r.get::<_, i64>("is_deleted")? != 0,
    })
}

const COLS: &str = "p.id, p.member_id, m.name AS member_name, p.amount, p.payment_method, \
     p.payment_type, p.status, p.reference, p.notes, p.payment_date, p.created_by, p.created_at, \
     p.is_deleted";

const JOIN: &str =
    "FROM payments p LEFT JOIN members m ON m.id = p.member_id WHERE p.is_deleted = 0";

pub fn insert(
    conn: &Connection,
    input: &CreatePaymentInput,
    created_by: Option<i64>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO payments (member_id, amount, payment_method, payment_type, status, reference, notes, payment_date, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, COALESCE(?8, CURRENT_TIMESTAMP), ?9)",
        params![
            input.member_id,
            input.amount,
            input.payment_method,
            input.payment_type,
            input.status.as_deref().unwrap_or("completed"),
            input.reference,
            input.notes,
            input.payment_date,
            created_by,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<Payment>, AppError> {
    let sql = format!(
        "SELECT {COLS} {JOIN} AND p.id = ?1 ORDER BY p.payment_date DESC, p.id DESC LIMIT 1"
    );
    let row = conn.query_row(&sql, [id], payment_from_row).optional()?;
    Ok(row)
}

fn build_list(
    conn: &Connection,
    member_id: Option<i64>,
    search: Option<&str>,
) -> Result<Vec<Payment>, AppError> {
    let mut sql = format!("SELECT {COLS} {JOIN}");
    let mut q: Vec<rusqlite::types::Value> = Vec::new();

    if let Some(mid) = member_id {
        sql.push_str(" AND p.member_id = ?");
        q.push(rusqlite::types::Value::from(mid));
    }
    if let Some(s) = search {
        let s = s.trim();
        if !s.is_empty() {
            let s = format!("%{s}%");
            sql.push_str(
                " AND (m.name LIKE ? OR p.payment_method LIKE ? OR COALESCE(p.reference,'') LIKE ?)",
            );
            let val = rusqlite::types::Value::from(s);
            q.push(val.clone());
            q.push(val.clone());
            q.push(val);
        }
    }
    sql.push_str(" ORDER BY p.payment_date DESC, p.id DESC LIMIT 1000");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), payment_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn list(conn: &Connection, search: Option<&str>) -> Result<Vec<Payment>, AppError> {
    build_list(conn, None, search)
}

pub fn list_by_member(conn: &Connection, member_id: i64) -> Result<Vec<Payment>, AppError> {
    build_list(conn, Some(member_id), None)
}

pub fn soft_delete(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE payments SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND is_deleted = 0",
        [id],
    )?;
    Ok(affected > 0)
}

pub fn member_balance(conn: &Connection, member_id: i64) -> Result<MemberBalance, AppError> {
    let row: (Option<String>, Option<String>, Option<f64>, Option<f64>, Option<i64>) = conn
        .query_row(
            "SELECT m.name, m.phone,
                (SELECT COALESCE(SUM(total_amount - paid_amount),0) FROM sales WHERE member_id = ?1),
                (SELECT COALESCE(SUM(amount),0) FROM payments WHERE member_id = ?1 AND is_deleted = 0 AND status = 'completed'),
                (SELECT COUNT(*) FROM payments WHERE member_id = ?1 AND is_deleted = 0 AND status = 'completed')
             FROM members m WHERE m.id = ?1 AND m.is_deleted = 0",
            [member_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .optional()?
        .ok_or_else(|| AppError::validation("Member not found"))?;

    let (name, phone, credit, paid, count) = row;
    let total_credit = credit.unwrap_or(0.0);
    let total_paid = paid.unwrap_or(0.0);
    Ok(MemberBalance {
        member_id,
        member_name: name.unwrap_or_default(),
        phone,
        total_credit,
        total_paid,
        balance: round2(total_credit - total_paid),
        payment_count: count.unwrap_or(0),
    })
}

pub fn list_balances(
    conn: &Connection,
    search: Option<&str>,
) -> Result<Vec<MemberBalance>, AppError> {
    let has_search = search.map(|s| !s.trim().is_empty()).unwrap_or(false);
    let mut sql = String::from(
        "SELECT m.id AS member_id, m.name AS member_name, m.phone AS phone,
                COALESCE((SELECT SUM(s.total_amount - s.paid_amount) FROM sales s WHERE s.member_id = m.id), 0) AS total_credit,
                COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) AS total_paid,
                COUNT(CASE WHEN p.status = 'completed' THEN p.id END) AS payment_count
         FROM members m
         LEFT JOIN payments p ON p.member_id = m.id AND p.is_deleted = 0
         WHERE m.is_deleted = 0",
    );
    let mut q: Vec<rusqlite::types::Value> = Vec::new();
    if has_search {
        let s = format!("%{}%", search.unwrap_or("").trim());
        sql.push_str(" AND (m.name LIKE ? OR COALESCE(m.phone,'') LIKE ?)");
        let val = rusqlite::types::Value::from(s);
        q.push(val.clone());
        q.push(val);
    }
    sql.push_str(" GROUP BY m.id ORDER BY m.name");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), balance_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn list_customer_dues(
    conn: &Connection,
    search: Option<&str>,
) -> Result<Vec<MemberBalance>, AppError> {
    let all = list_balances(conn, search)?;
    Ok(all.into_iter().filter(|b| b.balance > 0.001).collect())
}

fn balance_from_row(r: &Row) -> rusqlite::Result<MemberBalance> {
    let total_credit: f64 = r.get("total_credit")?;
    let total_paid: f64 = r.get("total_paid")?;
    Ok(MemberBalance {
        member_id: r.get("member_id")?,
        member_name: r.get("member_name")?,
        phone: r.get("phone")?,
        total_credit,
        total_paid,
        balance: round2(total_credit - total_paid),
        payment_count: r.get("payment_count")?,
    })
}

fn round2(n: f64) -> f64 {
    (n * 100.0).round() / 100.0
}
