use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::payment::{CreatePaymentInput, MemberBalance, Payment};
use crate::repositories::{member_repository, payment_repository};
use crate::services;

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
    let amount = validate_amount(input.amount)?;

    if let Some(mid) = input.member_id {
        if member_repository::get_by_id(conn, mid)?.is_none() {
            return Err(AppError::validation("Member not found"));
        }
    }

    let normalized = CreatePaymentInput {
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
    };

    let id = payment_repository::insert(conn, &normalized, actor)?;
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
    let deleted = payment_repository::soft_delete(conn, id)?;
    if !deleted {
        return Err(AppError::validation("Payment not found"));
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
}
