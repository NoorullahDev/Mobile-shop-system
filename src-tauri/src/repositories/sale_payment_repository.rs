use rusqlite::{params, Connection, OptionalExtension};

use crate::errors::AppError;
use crate::models::sale_payment::{SalePayment, SalePaymentInput};

const COLS: &str = "id, sale_id, amount, payment_method, reference, notes, created_at, is_voided, void_reason, voided_by, voided_at, account_details";

fn sale_payment_from_row(r: &rusqlite::Row) -> rusqlite::Result<SalePayment> {
    Ok(SalePayment {
        id: r.get("id")?,
        sale_id: r.get("sale_id")?,
        amount: r.get("amount")?,
        payment_method: r.get("payment_method")?,
        reference: r.get("reference")?,
        notes: r.get("notes")?,
        created_at: r.get("created_at")?,
        is_voided: r.get::<_, i64>("is_voided")? != 0,
        void_reason: r.get("void_reason")?,
        voided_by: r.get("voided_by")?,
        voided_at: r.get("voided_at")?,
        account_details: r.get("account_details")?,
    })
}

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

pub fn delete_active_payments_for_sale(conn: &Connection, sale_id: i64) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM sale_payments WHERE sale_id = ?1 AND is_voided = 0",
        [sale_id],
    )?;
    Ok(())
}

pub fn payments_for_sale(conn: &Connection, sale_id: i64) -> Result<Vec<SalePayment>, AppError> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM sale_payments WHERE sale_id = ?1 ORDER BY id"
    ))?;
    let rows = stmt.query_map([sale_id], sale_payment_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn get_by_id_any(conn: &Connection, id: i64) -> Result<Option<SalePayment>, AppError> {
    let row = conn
        .query_row(
            &format!("SELECT {COLS} FROM sale_payments WHERE id = ?1"),
            [id],
            sale_payment_from_row,
        )
        .optional()?;
    Ok(row)
}

pub fn void_sale_payment(
    conn: &Connection,
    id: i64,
    reason: &str,
    voided_by: i64,
) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE sale_payments SET is_voided = 1, void_reason = ?2, voided_by = ?3, voided_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND is_voided = 0",
        params![id, reason, voided_by],
    )?;
    Ok(affected > 0)
}

pub fn edit_sale_payment_details(
    conn: &Connection,
    id: i64,
    account_details: Option<&str>,
    reference: Option<&str>,
) -> Result<bool, AppError> {
    let affected = conn.execute(
        "UPDATE sale_payments SET account_details = ?2, reference = ?3
         WHERE id = ?1 AND is_voided = 0",
        params![id, account_details, reference],
    )?;
    Ok(affected > 0)
}
