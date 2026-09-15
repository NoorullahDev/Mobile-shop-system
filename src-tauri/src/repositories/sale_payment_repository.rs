use rusqlite::{params, Connection};

use crate::errors::AppError;
use crate::models::sale_payment::{SalePayment, SalePaymentInput};

pub fn insert_sale_payment(
    conn: &Connection,
    sale_id: i64,
    amount: f64,
    payment_method: &str,
    reference: Option<&str>,
    notes: Option<&str>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO sale_payments (sale_id, amount, payment_method, reference, notes)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![sale_id, amount, payment_method, reference, notes],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn insert_payments(
    conn: &Connection,
    sale_id: i64,
    payments: &[SalePaymentInput],
) -> Result<(), AppError> {
    for p in payments {
        insert_sale_payment(
            conn,
            sale_id,
            p.amount,
            &p.payment_method,
            p.reference.as_deref(),
            p.notes.as_deref(),
        )?;
    }
    Ok(())
}

pub fn delete_payments_for_sale(conn: &Connection, sale_id: i64) -> Result<(), AppError> {
    conn.execute("DELETE FROM sale_payments WHERE sale_id = ?1", [sale_id])?;
    Ok(())
}

pub fn payments_for_sale(conn: &Connection, sale_id: i64) -> Result<Vec<SalePayment>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, sale_id, amount, payment_method, reference, notes, created_at
         FROM sale_payments WHERE sale_id = ?1 ORDER BY id",
    )?;
    let rows = stmt.query_map([sale_id], |r| {
        Ok(SalePayment {
            id: r.get("id")?,
            sale_id: r.get("sale_id")?,
            amount: r.get("amount")?,
            payment_method: r.get("payment_method")?,
            reference: r.get("reference")?,
            notes: r.get("notes")?,
            created_at: r.get("created_at")?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Payment breakdown by method within the inclusive date range.
/// Uses sale_payments for accurate per-method totals.
pub fn payment_breakdown_by_method(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<Vec<crate::models::report::PaymentBreakdown>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT sp.payment_method, SUM(sp.amount) AS total, COUNT(*) AS count
         FROM sale_payments sp
         JOIN sales s ON s.id = sp.sale_id
         WHERE s.created_at >= date(?1) AND s.created_at < date(?2, '+1 day')
         GROUP BY sp.payment_method ORDER BY total DESC",
    )?;
    let rows = stmt.query_map(params![from, to], |r| {
        Ok(crate::models::report::PaymentBreakdown {
            payment_method: r.get("payment_method")?,
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
