use rusqlite::{params, Connection};

use crate::errors::AppError;
use crate::models::payment::{CreatePaymentInput, MemberBalance, Payment, UnpaidSaleInfo};
use crate::repositories::{member_repository, payment_repository};
use crate::services;
use crate::utils;

fn normalize_method(m: &str) -> String {
    let m = m.trim().to_lowercase();
    if m.is_empty() {
        "cash".into()
    } else {
        m
    }
}

fn validate_status(s: Option<&str>) -> String {
    match s {
        Some(v) => {
            let v = v.trim().to_lowercase();
            if matches!(
                v.as_str(),
                "completed" | "pending" | "cancelled" | "refunded"
            ) {
                v
            } else {
                "completed".into()
            }
        }
        None => "completed".into(),
    }
}

fn validate_amount(amount: f64) -> Result<f64, AppError> {
    if !amount.is_finite() || amount <= 0.0 {
        return Err(AppError::validation(
            "Payment amount must be greater than zero",
        ));
    }
    Ok(f64::round(amount * 100.0) / 100.0)
}

pub fn create(
    conn: &Connection,
    input: CreatePaymentInput,
    actor: Option<i64>,
) -> Result<Payment, AppError> {
    let normalized = normalize_input(conn, input)?;
    let amount = normalized.amount;
    let sale_id = normalized.sale_id;

    let id = payment_repository::insert(conn, &normalized, actor)?;

    // If linked to a sale, update the sale's paid_amount
    if let Some(sid) = sale_id {
        update_sale_paid_amount(conn, sid)?;
    }

    services::record_activity(conn, actor, "payment", "create", Some(id))?;
    services::notification_service::notify(
        conn,
        actor,
        "finance",
        "normal",
        "Payment received",
        &format!("A payment of Rs {amount:.2} was recorded."),
    )?;

    payment_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::Internal("Created payment could not be retrieved".into()))
}

fn normalize_input(conn: &Connection, input: CreatePaymentInput) -> Result<CreatePaymentInput, AppError> {
    let amount = validate_amount(input.amount)?;

    if let Some(mid) = input.member_id {
        if member_repository::get_by_id(conn, mid)?.is_none() {
            return Err(AppError::validation("Member not found"));
        }
    }

    Ok(CreatePaymentInput {
        member_id: input.member_id,
        amount,
        payment_method: normalize_method(&input.payment_method),
        payment_type: input
            .payment_type
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty()),
        status: Some(validate_status(input.status.as_deref())),
        reference: input
            .reference
            .map(|r| r.trim().to_string())
            .filter(|r| !r.is_empty()),
        notes: input
            .notes
            .map(|n| n.trim().to_string())
            .filter(|n| !n.is_empty()),
        payment_date: input.payment_date,
        sale_id: input.sale_id,
    })
}

pub fn update(
    conn: &Connection,
    id: i64,
    input: CreatePaymentInput,
    actor: Option<i64>,
) -> Result<Payment, AppError> {
    let existing = get(conn, id)?;
    let normalized = normalize_input(conn, input)?;
    if !payment_repository::update(conn, id, &normalized)? {
        return Err(AppError::validation("Payment not found"));
    }
    // If the sale link changed, recalculate the old and new sale's paid_amount
    let old_sale = existing.sale_id;
    let new_sale = normalized.sale_id;
    if old_sale != new_sale {
        if let Some(sid) = old_sale {
            let _ = update_sale_paid_amount(conn, sid);
        }
        if let Some(sid) = new_sale {
            let _ = update_sale_paid_amount(conn, sid);
        }
    } else if let Some(sid) = new_sale {
        let _ = update_sale_paid_amount(conn, sid);
    }
    services::record_activity(conn, actor, "payment", "update", Some(id))?;
    get(conn, id)
}

pub fn list(conn: &Connection, search: Option<String>) -> Result<Vec<Payment>, AppError> {
    payment_repository::list(conn, search.as_deref())
}

pub fn list_by_member(conn: &Connection, member_id: i64) -> Result<Vec<Payment>, AppError> {
    payment_repository::list_by_member(conn, member_id)
}

pub fn get(conn: &Connection, id: i64) -> Result<Payment, AppError> {
    payment_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::validation("Payment not found"))
}

pub fn soft_delete(conn: &Connection, id: i64, actor: Option<i64>) -> Result<(), AppError> {
    let payment = get(conn, id)?;
    if let Some(member_id) = payment.member_id {
        if member_balance(conn, member_id)?.balance > 0.001 {
            return Err(AppError::validation(
                "This payment can only be deleted after the customer due is fully cleared",
            ));
        }
    }
    let sale_id = payment.sale_id;
    let deleted = payment_repository::soft_delete(conn, id)?;
    if !deleted {
        return Err(AppError::validation("Payment not found"));
    }
    if let Some(sid) = sale_id {
        let _ = update_sale_paid_amount(conn, sid);
    }
    services::record_activity(conn, actor, "payment", "delete", Some(id))
}

pub fn member_balance(conn: &Connection, member_id: i64) -> Result<MemberBalance, AppError> {
    payment_repository::member_balance(conn, member_id)
}

pub fn list_balances(
    conn: &Connection,
    search: Option<String>,
) -> Result<Vec<MemberBalance>, AppError> {
    payment_repository::list_balances(conn, search.as_deref())
}

pub fn list_customer_dues(
    conn: &Connection,
    search: Option<String>,
) -> Result<Vec<MemberBalance>, AppError> {
    payment_repository::list_customer_dues(conn, search.as_deref())
}

/// Recalculate a sale's paid_amount from all completed payments linked to it,
/// then update the sale row so Sales History reflects the true payment status.
fn update_sale_paid_amount(conn: &Connection, sale_id: i64) -> Result<(), AppError> {
    let total_from_payments: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM payments
             WHERE sale_id = ?1 AND is_deleted = 0 AND status = 'completed'",
            [sale_id],
            |r| r.get(0),
        )?;

    let total_from_split: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM sale_payments WHERE sale_id = ?1",
            [sale_id],
            |r| r.get(0),
        )?;

    // paid_amount = original split payments + linked due payments, capped at total_amount
    let total_amount: f64 = conn
        .query_row(
            "SELECT total_amount FROM sales WHERE id = ?1",
            [sale_id],
            |r| r.get(0),
        )?;

    let new_paid = utils::round2((total_from_split + total_from_payments).min(total_amount));

    conn.execute(
        "UPDATE sales SET paid_amount = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![new_paid, sale_id],
    )?;
    Ok(())
}

pub fn unpaid_sales_for_member(
    conn: &Connection,
    member_id: i64,
) -> Result<Vec<UnpaidSaleInfo>, AppError> {
    let rows = payment_repository::unpaid_sales_for_member(conn, member_id)?;
    Ok(rows
        .into_iter()
        .map(|(id, receipt_no, total_amount, paid_amount, created_at)| UnpaidSaleInfo {
            id,
            receipt_no,
            total_amount,
            paid_amount,
            due_amount: utils::round2(total_amount - paid_amount),
            created_at,
        })
        .collect())
}

pub fn list_payments_for_sale(
    conn: &Connection,
    sale_id: i64,
) -> Result<Vec<Payment>, AppError> {
    payment_repository::list_by_sale(conn, sale_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::member::CreateMemberInput;
    use crate::services::test_utils::in_memory_conn;

    fn member_id(conn: &Connection) -> i64 {
        member_repository::insert(
            conn,
            &CreateMemberInput {
                name: "Ali".into(),
                phone: Some("03000000000".into()),
                cnic: None,
                address: None,
                notes: None,
            },
        )
        .unwrap()
    }

    fn sample(member_id: Option<i64>) -> CreatePaymentInput {
        CreatePaymentInput {
            member_id,
            amount: 500.0,
            payment_method: "cash".into(),
            payment_type: Some("membership".into()),
            status: None,
            reference: Some("REF-1".into()),
            notes: None,
            payment_date: None,
            sale_id: None,
        }
    }

    #[test]
    fn creates_valid_payment() {
        let conn = in_memory_conn();
        let p = create(&conn, sample(None), None).unwrap();
        assert!(p.id > 0);
        assert_eq!(p.amount, 500.0);
        assert_eq!(p.status, "completed");
    }

    #[test]
    fn rejects_zero_and_negative_amount() {
        let conn = in_memory_conn();
        let mut input = sample(None);
        input.amount = 0.0;
        let err = create(&conn, input, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn rejects_invalid_member() {
        let conn = in_memory_conn();
        let mut input = sample(None);
        input.member_id = Some(999);
        let err = create(&conn, input, None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn lists_by_member_and_balance() {
        let conn = in_memory_conn();
        let mid = member_id(&conn);
        for amount in [100.0, 200.0, 50.0] {
            let mut input = sample(Some(mid));
            input.amount = amount;
            create(&conn, input, None).unwrap();
        }
        let history = list_by_member(&conn, mid).unwrap();
        assert_eq!(history.len(), 3);

        let bal = member_balance(&conn, mid).unwrap();
        assert_eq!(bal.total_paid, 350.0);
        assert_eq!(bal.payment_count, 3);
    }

    #[test]
    fn cancelled_payments_excluded_from_balance() {
        let conn = in_memory_conn();
        let mid = member_id(&conn);
        let mut cancelled = sample(Some(mid));
        cancelled.amount = 50.0;
        cancelled.status = Some("cancelled".into());
        create(&conn, cancelled, None).unwrap();
        let mut valid = sample(Some(mid));
        valid.amount = 100.0;
        create(&conn, valid, None).unwrap();

        let bal = member_balance(&conn, mid).unwrap();
        assert_eq!(bal.total_paid, 100.0);
        assert_eq!(bal.payment_count, 1);
    }

    #[test]
    fn soft_delete_removes_payment() {
        let conn = in_memory_conn();
        let p = create(&conn, sample(None), None).unwrap();
        soft_delete(&conn, p.id, None).unwrap();
        assert!(get(&conn, p.id).is_err());
    }

    #[test]
    fn balance_counts_sales_credit_minus_payments() {
        let conn = in_memory_conn();
        let mid = member_id(&conn);
        // Credit sale: Rs 500 total, only 200 paid at sale time -> 300 owed on the sale.
        conn.execute(
            "INSERT INTO sales (receipt_no, member_id, total_amount, paid_amount, payment_method)
             VALUES ('BAL1', ?1, 500.0, 200.0, 'cash')",
            [mid],
        )
        .unwrap();
        // Later, the customer pays off Rs 100.
        let mut p = sample(Some(mid));
        p.amount = 100.0;
        create(&conn, p, None).unwrap();

        let bal = member_balance(&conn, mid).unwrap();
        assert_eq!(bal.total_credit, 300.0);
        assert_eq!(bal.total_paid, 100.0);
        assert_eq!(bal.balance, 200.0);

        let dues = list_customer_dues(&conn, None).unwrap();
        assert_eq!(dues.len(), 1);
        assert!((dues[0].balance - 200.0).abs() < 0.001);

        let all = list_balances(&conn, None).unwrap();
        assert!(all
            .iter()
            .any(|b| b.member_id == mid && (b.balance - 200.0).abs() < 0.001));
    }

    #[test]
    fn update_payment_recalculates_customer_balance() {
        let conn = in_memory_conn();
        let mid = member_id(&conn);
        conn.execute(
            "INSERT INTO sales (receipt_no, member_id, total_amount, paid_amount, payment_method) VALUES ('UP1', ?1, 500, 100, 'cash')",
            [mid],
        )
        .unwrap();
        let mut input = sample(Some(mid));
        input.amount = 100.0;
        let payment = create(&conn, input, None).unwrap();
        let mut corrected = sample(Some(mid));
        corrected.amount = 250.0;
        corrected.payment_method = "card".into();

        let updated = update(&conn, payment.id, corrected, None).unwrap();
        assert_eq!(updated.amount, 250.0);
        assert_eq!(updated.payment_method, "card");
        assert_eq!(member_balance(&conn, mid).unwrap().balance, 150.0);
        assert!(soft_delete(&conn, payment.id, None).is_err());
    }

    #[test]
    fn returns_reduce_customer_credit_and_cleared_payment_can_be_deleted() {
        let conn = in_memory_conn();
        let mid = member_id(&conn);
        conn.execute(
            "INSERT INTO sales (receipt_no, member_id, total_amount, paid_amount, payment_method) VALUES ('RET-DUE', ?1, 500, 100, 'cash')",
            [mid],
        )
        .unwrap();
        let sale_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO returns (return_no, sale_id, member_id, total_sale_price, deduction_amount, refund_amount, refund_method) VALUES ('RD1', ?1, ?2, 100, 10, 90, 'cash')",
            rusqlite::params![sale_id, mid],
        )
        .unwrap();
        assert_eq!(member_balance(&conn, mid).unwrap().balance, 310.0);

        let mut input = sample(Some(mid));
        input.amount = 310.0;
        let payment = create(&conn, input, None).unwrap();
        assert_eq!(member_balance(&conn, mid).unwrap().balance, 0.0);
        soft_delete(&conn, payment.id, None).unwrap();
        assert_eq!(member_balance(&conn, mid).unwrap().balance, 310.0);
    }
}
