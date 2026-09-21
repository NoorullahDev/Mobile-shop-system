use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::sale_payment::SalePayment;
use crate::repositories::sale_payment_repository;
use crate::services::{self, payment_service};

fn get_any(conn: &Connection, id: i64) -> Result<SalePayment, AppError> {
    sale_payment_repository::get_by_id_any(conn, id)?
        .ok_or_else(|| AppError::validation("Payment not found"))
}

pub fn void_sale_payment(
    conn: &Connection,
    id: i64,
    reason: &str,
    actor: Option<i64>,
) -> Result<SalePayment, AppError> {
    let sp = get_any(conn, id)?;
    if sp.is_voided {
        return Err(AppError::validation("Payment is already voided"));
    }
    if sp.payment_method.eq_ignore_ascii_case("exchange_credit") {
        return Err(AppError::validation(
            "Exchange credit is internal-only and cannot be voided",
        ));
    }
    let sale_id = sp.sale_id;
    let tx = conn.unchecked_transaction()?;
    let voided_by = actor.unwrap_or(0);
    if !sale_payment_repository::void_sale_payment(&tx, id, reason, voided_by)? {
        return Err(AppError::validation("Payment not found"));
    }
    payment_service::update_sale_paid_amount(&tx, sale_id)?;
    tx.commit()?;
    services::record_activity(conn, actor, "sale_payment", "void", Some(id))?;
    get_any(conn, id)
}

pub fn edit_sale_payment_details(
    conn: &Connection,
    id: i64,
    account_details: Option<&str>,
    reference: Option<&str>,
    actor: Option<i64>,
) -> Result<SalePayment, AppError> {
    let existing = get_any(conn, id)?;
    if existing.is_voided {
        return Err(AppError::validation("Cannot edit a voided payment"));
    }
    let trimmed_account = account_details
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let trimmed_ref = reference
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let tx = conn.unchecked_transaction()?;
    if !sale_payment_repository::edit_sale_payment_details(
        &tx,
        id,
        trimmed_account.as_deref(),
        trimmed_ref.as_deref(),
    )? {
        return Err(AppError::validation("Payment not found"));
    }
    tx.commit()?;
    services::record_activity(conn, actor, "sale_payment", "update", Some(id))?;
    get_any(conn, id)
}
