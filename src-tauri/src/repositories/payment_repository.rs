use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::errors::AppError;
use crate::models::payment::{CreatePaymentInput, CustomerDueInvoice, MemberBalance, Payment};

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
        account_details: r.get("account_details")?,
        notes: r.get("notes")?,
        payment_date: r.get("payment_date")?,
        created_by: r.get("created_by")?,
        created_at: r.get("created_at")?,
        is_deleted: r.get::<_, i64>("is_deleted")? != 0,
        sale_id: r.get("sale_id")?,
        is_voided: r.get::<_, i64>("is_voided")? != 0,
        void_reason: r.get("void_reason")?,
        voided_by: r.get("voided_by")?,
        voided_at: r.get("voided_at")?,
    })
}

const COLS: &str = "p.id, p.member_id, m.name AS member_name, p.amount, p.payment_method, \
     p.payment_type, p.status, p.reference, p.account_details, p.notes, p.payment_date, p.created_by, p.created_at, \
     p.is_deleted, p.sale_id, p.is_voided, p.void_reason, p.voided_by, p.voided_at";

const JOIN: &str =
    "FROM payments p LEFT JOIN members m ON m.id = p.member_id WHERE p.is_deleted = 0 AND p.is_voided = 0";

pub fn insert(
    conn: &Connection,
    input: &CreatePaymentInput,
    created_by: Option<i64>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO payments (member_id, amount, payment_method, payment_type, status, reference, account_details, notes, payment_date, created_by, sale_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, COALESCE(?9, CURRENT_TIMESTAMP), ?10, ?11)",
        params![
            input.member_id,
            input.amount,
            input.payment_method,
            input.payment_type,
            input.status.as_deref().unwrap_or("completed"),
            input.reference,
            input.account_details,
            input.notes,
            input.payment_date,
            created_by,
            input.sale_id,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update(conn: &Connection, id: i64, input: &CreatePaymentInput) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE payments SET member_id = ?2, amount = ?3, payment_method = ?4, payment_type = ?5, status = ?6, reference = ?7, account_details = ?8, notes = ?9, payment_date = COALESCE(?10, payment_date), sale_id = ?11, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND is_deleted = 0",
        params![id, input.member_id, input.amount, input.payment_method, input.payment_type, input.status, input.reference, input.account_details, input.notes, input.payment_date, input.sale_id],
    )?;
    Ok(affected > 0)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<Payment>, AppError> {
    let sql = format!(
        "SELECT {COLS} {JOIN} AND p.id = ?1 ORDER BY p.payment_date DESC, p.id DESC LIMIT 1"
    );
    let row = conn.query_row(&sql, [id], payment_from_row).optional()?;
    Ok(row)
}

/// Returns a payment regardless of its void status (used by void/edit/delete).
pub fn get_by_id_any(conn: &Connection, id: i64) -> Result<Option<Payment>, AppError> {
    let sql = format!(
        "SELECT {COLS} FROM payments p LEFT JOIN members m ON m.id = p.member_id WHERE p.is_deleted = 0 AND p.id = ?1 ORDER BY p.payment_date DESC, p.id DESC LIMIT 1"
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

pub fn void_payment(
    conn: &Connection,
    id: i64,
    reason: &str,
    voided_by: i64,
) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE payments SET is_voided = 1, void_reason = ?2, voided_by = ?3, voided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND is_deleted = 0 AND is_voided = 0",
        params![id, reason, voided_by],
    )?;
    Ok(affected > 0)
}

pub fn edit_payment_details(
    conn: &Connection,
    id: i64,
    account_details: Option<&str>,
    reference: Option<&str>,
) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE payments SET account_details = ?2, reference = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND is_deleted = 0 AND is_voided = 0",
        params![id, account_details, reference],
    )?;
    Ok(affected > 0)
}

pub fn member_balance(conn: &Connection, member_id: i64) -> Result<MemberBalance, AppError> {
    let row: (Option<String>, Option<String>, Option<f64>, Option<f64>, Option<i64>) = conn
        .query_row(
            "SELECT m.name, m.phone,
                (SELECT COALESCE(SUM(MAX((s.total_amount - s.paid_amount) - COALESCE((SELECT SUM(r.refund_amount) FROM returns r WHERE r.sale_id = s.id), 0), 0)),0) FROM sales s WHERE s.member_id = ?1),
                (SELECT COALESCE(SUM(amount),0) FROM payments WHERE member_id = ?1 AND is_deleted = 0 AND is_voided = 0 AND status = 'completed' AND (sale_id IS NULL OR sale_id = 0)),
                (SELECT COUNT(*) FROM payments WHERE member_id = ?1 AND is_deleted = 0 AND is_voided = 0 AND status = 'completed')
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
        balance: utils::round2(total_credit - total_paid),
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
                COALESCE((SELECT SUM(MAX((s.total_amount - s.paid_amount) - COALESCE((SELECT SUM(r.refund_amount) FROM returns r WHERE r.sale_id = s.id), 0), 0)) FROM sales s WHERE s.member_id = m.id), 0) AS total_credit,
                COALESCE(SUM(CASE WHEN p.status = 'completed' AND (p.sale_id IS NULL OR p.sale_id = 0) THEN p.amount ELSE 0 END), 0) AS total_paid,
                COUNT(CASE WHEN p.status = 'completed' THEN p.id END) AS payment_count
         FROM members m
         LEFT JOIN payments p ON p.member_id = m.id AND p.is_deleted = 0 AND p.is_voided = 0
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
    let mut sql = String::from(
        "SELECT m.id AS member_id, m.name AS member_name, m.phone,
                SUM(s.total_amount - COALESCE((SELECT SUM(r.refund_amount) FROM returns r WHERE r.sale_id = s.id), 0)) AS total_credit,
                SUM(s.paid_amount) AS total_paid,
                COALESCE(SUM((SELECT COUNT(*) FROM payments p
                              WHERE p.sale_id = s.id
                                AND p.is_deleted = 0
                                AND p.is_voided = 0
                                AND p.status = 'completed')), 0) AS payment_count
         FROM sales s
         JOIN members m ON m.id = s.member_id AND m.is_deleted = 0
         WHERE (s.total_amount - s.paid_amount - COALESCE((SELECT SUM(r.refund_amount) FROM returns r WHERE r.sale_id = s.id), 0)) > 0.001",
    );
    let mut q: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(search) = search.map(str::trim).filter(|value| !value.is_empty()) {
        sql.push_str(" AND (s.receipt_no LIKE ? OR m.name LIKE ? OR COALESCE(m.phone, '') LIKE ?)");
        let value = rusqlite::types::Value::from(format!("%{search}%"));
        q.push(value.clone());
        q.push(value.clone());
        q.push(value);
    }
    sql.push_str(" GROUP BY m.id ORDER BY m.name");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), balance_from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Invoice-level dues sourced directly from each sale's current paid amount.
/// Unlinked customer payments never offset an unrelated invoice.
pub fn list_customer_due_invoices(
    conn: &Connection,
    search: Option<&str>,
) -> Result<Vec<CustomerDueInvoice>, AppError> {
    let mut sql = String::from(
        "SELECT s.id AS sale_id, s.receipt_no, s.member_id,
                m.name AS member_name, m.phone,
                s.total_amount, s.paid_amount,
                ROUND(MAX(s.total_amount - s.paid_amount - COALESCE((SELECT SUM(r.refund_amount) FROM returns r WHERE r.sale_id = s.id), 0), 0), 2) AS due_amount,
                (SELECT COUNT(*) FROM payments p
                 WHERE p.sale_id = s.id AND p.is_deleted = 0 AND p.is_voided = 0 AND p.status = 'completed') AS payment_count,
                s.created_at
         FROM sales s
         JOIN members m ON m.id = s.member_id AND m.is_deleted = 0
         WHERE (s.total_amount - s.paid_amount - COALESCE((SELECT SUM(r.refund_amount) FROM returns r WHERE r.sale_id = s.id), 0)) > 0.001",
    );
    let mut q: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(search) = search.map(str::trim).filter(|value| !value.is_empty()) {
        sql.push_str(" AND (s.receipt_no LIKE ? OR m.name LIKE ? OR COALESCE(m.phone, '') LIKE ?)");
        let value = rusqlite::types::Value::from(format!("%{search}%"));
        q.push(value.clone());
        q.push(value.clone());
        q.push(value);
    }
    sql.push_str(" ORDER BY s.created_at ASC, s.id ASC");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(q), |r| {
        Ok(CustomerDueInvoice {
            sale_id: r.get("sale_id")?,
            receipt_no: r.get("receipt_no")?,
            member_id: r.get("member_id")?,
            member_name: r.get("member_name")?,
            phone: r.get("phone")?,
            total_amount: r.get("total_amount")?,
            paid_amount: r.get("paid_amount")?,
            due_amount: r.get("due_amount")?,
            payment_count: r.get("payment_count")?,
            created_at: r.get("created_at")?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
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
        balance: utils::round2(total_credit - total_paid),
        payment_count: r.get("payment_count")?,
    })
}

use crate::utils;

/// Returns sales for a member that still have an outstanding balance.
pub fn unpaid_sales_for_member(
    conn: &Connection,
    member_id: i64,
) -> Result<Vec<(i64, String, f64, f64, f64, String)>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.receipt_no, s.total_amount, s.paid_amount,
                MAX(s.total_amount - s.paid_amount - COALESCE((SELECT SUM(r.refund_amount) FROM returns r WHERE r.sale_id = s.id), 0), 0),
                s.created_at
         FROM sales s
         WHERE s.member_id = ?1
           AND (s.total_amount - s.paid_amount - COALESCE((SELECT SUM(r.refund_amount) FROM returns r WHERE r.sale_id = s.id), 0)) > 0.001
         ORDER BY s.created_at ASC",
    )?;
    let rows = stmt.query_map([member_id], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, f64>(2)?,
            r.get::<_, f64>(3)?,
            r.get::<_, f64>(4)?,
            r.get::<_, String>(5)?,
        ))
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Returns completed payments linked to a specific sale.
pub fn list_by_sale(conn: &Connection, sale_id: i64) -> Result<Vec<Payment>, AppError> {
    let sql = format!(
        "SELECT {COLS} {JOIN} AND p.sale_id = ?1 AND p.status = 'completed' ORDER BY p.payment_date ASC, p.id ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([sale_id], payment_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}
