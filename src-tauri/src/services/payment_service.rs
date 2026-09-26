use rusqlite::{params, Connection, OptionalExtension};

use crate::errors::AppError;
use crate::models::payment::{
    CreatePaymentInput, CustomerDueInvoice, MemberBalance, Payment, UnpaidSaleInfo,
};
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

    if let Some(sid) = sale_id {
        let due: f64 = conn.query_row(
            "SELECT MAX(s.total_amount - s.paid_amount - COALESCE((SELECT SUM(r.refund_amount) FROM returns r WHERE r.sale_id = s.id), 0), 0)
             FROM sales s WHERE s.id = ?1",
            [sid],
            |r| r.get(0),
        )?;
        if normalized.status.as_deref() == Some("completed") && amount > due + 0.005 {
            return Err(AppError::validation(format!(
                "Payment cannot exceed the invoice balance of Rs {due:.2}"
            )));
        }
    }

    let tx = conn.unchecked_transaction()?;
    let id = payment_repository::insert(&tx, &normalized, actor)?;

    // If linked to a sale, update the sale's paid_amount
    if let Some(sid) = sale_id {
        update_sale_paid_amount(&tx, sid)?;
    }
    tx.commit()?;

    services::record_activity(conn, actor, "payment", "create", Some(id))?;
    if let Err(error) = services::notification_service::notify(
        conn,
        actor,
        "finance",
        "normal",
        "Payment received",
        &format!("A payment of Rs {amount:.2} was recorded."),
    ) {
        log::warn!("payment was saved but its notification could not be created: {error}");
    }

    payment_repository::get_by_id(conn, id)?
        .ok_or_else(|| AppError::Internal("Created payment could not be retrieved".into()))
}

fn normalize_input(
    conn: &Connection,
    input: CreatePaymentInput,
) -> Result<CreatePaymentInput, AppError> {
    let amount = validate_amount(input.amount)?;

    if let Some(mid) = input.member_id {
        if member_repository::get_by_id(conn, mid)?.is_none() {
            return Err(AppError::validation("Member not found"));
        }
    }

    if let Some(sale_id) = input.sale_id {
        let sale_member = conn
            .query_row(
                "SELECT member_id FROM sales WHERE id = ?1",
                [sale_id],
                |r| r.get::<_, Option<i64>>(0),
            )
            .optional()?
            .ok_or_else(|| AppError::validation("Invoice not found"))?;
        if sale_member.is_none() || sale_member != input.member_id {
            return Err(AppError::validation(
                "Payment customer must match the selected invoice",
            ));
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
        account_details: input
            .account_details
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
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
    if let Some(sale_id) = normalized.sale_id {
        let current_due: f64 = conn.query_row(
            "SELECT MAX(s.total_amount - s.paid_amount - COALESCE((SELECT SUM(r.refund_amount) FROM returns r WHERE r.sale_id = s.id), 0), 0)
             FROM sales s WHERE s.id = ?1",
            [sale_id],
            |row| row.get(0),
        )?;
        let reusable = if existing.sale_id == Some(sale_id) && existing.status == "completed" {
            existing.amount
        } else {
            0.0
        };
        if normalized.status.as_deref() == Some("completed")
            && normalized.amount > current_due + reusable + 0.005
        {
            return Err(AppError::validation(format!(
                "Payment cannot exceed the invoice balance of Rs {:.2}",
                current_due + reusable
            )));
        }
    }
    let tx = conn.unchecked_transaction()?;
    if !payment_repository::update(&tx, id, &normalized)? {
        return Err(AppError::validation("Payment not found"));
    }
    // If the sale link changed, recalculate the old and new sale's paid_amount
    let old_sale = existing.sale_id;
    let new_sale = normalized.sale_id;
    if old_sale != new_sale {
        if let Some(sid) = old_sale {
            update_sale_paid_amount(&tx, sid)?;
        }
        if let Some(sid) = new_sale {
            update_sale_paid_amount(&tx, sid)?;
        }
    } else if let Some(sid) = new_sale {
        update_sale_paid_amount(&tx, sid)?;
    }
    tx.commit()?;
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

fn get_any(conn: &Connection, id: i64) -> Result<Payment, AppError> {
    payment_repository::get_by_id_any(conn, id)?
        .ok_or_else(|| AppError::validation("Payment not found"))
}

pub fn soft_delete(conn: &Connection, id: i64, actor: Option<i64>) -> Result<(), AppError> {
    let payment = get_any(conn, id)?;
    if payment.status != "completed" {
        let sale_id = payment.sale_id;
        let tx = conn.unchecked_transaction()?;
        let deleted = payment_repository::soft_delete(&tx, id)?;
        if !deleted {
            return Err(AppError::validation("Payment not found"));
        }
        if let Some(sid) = sale_id {
            update_sale_paid_amount(&tx, sid)?;
        }
        tx.commit()?;
        return services::record_activity(conn, actor, "payment", "delete", Some(id));
    }

    if let Some(sale_id) = payment.sale_id {
        // Only block if deleting this payment would make the sale's balance negative.
        let sale_due: f64 = conn.query_row(
            "SELECT MAX(s.total_amount - s.paid_amount - COALESCE((SELECT SUM(r.refund_amount) FROM returns r WHERE r.sale_id = s.id), 0), 0) FROM sales s WHERE s.id = ?1",
            [sale_id],
            |r| r.get(0),
        )?;
        if sale_due < 0.001 && payment.amount > sale_due + 0.005 {
            return Err(AppError::validation(
                "This payment fully covers an invoice and cannot be deleted until the invoice is settled another way",
            ));
        }
    } else if let Some(member_id) = payment.member_id {
        // For unlinked payments, only block if the customer has no dues at all
        // (meaning this payment is the sole thing keeping them solvent).
        let bal = member_balance(conn, member_id)?;
        if bal.balance > 0.001 {
            return Err(AppError::validation(
                "This payment can only be deleted after the customer due is fully cleared",
            ));
        }
    }

    let sale_id = payment.sale_id;
    let tx = conn.unchecked_transaction()?;
    let deleted = payment_repository::soft_delete(&tx, id)?;
    if !deleted {
        return Err(AppError::validation("Payment not found"));
    }
    if let Some(sid) = sale_id {
        update_sale_paid_amount(&tx, sid)?;
    }
    tx.commit()?;
    services::record_activity(conn, actor, "payment", "delete", Some(id))
}

pub fn void_payment(
    conn: &Connection,
    id: i64,
    reason: &str,
    actor: Option<i64>,
) -> Result<Payment, AppError> {
    let payment = get_any(conn, id)?;
    if payment.is_voided {
        return Err(AppError::validation("Payment is already voided"));
    }
    if payment.is_deleted {
        return Err(AppError::validation("Payment not found"));
    }
    let sale_id = payment.sale_id;
    let tx = conn.unchecked_transaction()?;
    let voided_by = actor.unwrap_or(0);
    if !payment_repository::void_payment(&tx, id, reason, voided_by)? {
        return Err(AppError::validation("Payment not found"));
    }
    if let Some(sid) = sale_id {
        update_sale_paid_amount(&tx, sid)?;
    }
    tx.commit()?;
    services::record_activity(conn, actor, "payment", "void", Some(id))?;
    get_any(conn, id)
}

pub fn edit_payment_details(
    conn: &Connection,
    id: i64,
    account_details: Option<&str>,
    reference: Option<&str>,
    actor: Option<i64>,
) -> Result<Payment, AppError> {
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
    if !payment_repository::edit_payment_details(
        &tx,
        id,
        trimmed_account.as_deref(),
        trimmed_ref.as_deref(),
    )? {
        return Err(AppError::validation("Payment not found"));
    }
    tx.commit()?;
    services::record_activity(conn, actor, "payment", "update", Some(id))?;
    get_any(conn, id)
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

pub fn list_customer_due_invoices(
    conn: &Connection,
    search: Option<String>,
) -> Result<Vec<CustomerDueInvoice>, AppError> {
    payment_repository::list_customer_due_invoices(conn, search.as_deref())
}

/// Recalculate a sale's paid_amount from all completed payments linked to it,
/// then update the sale row so Sales History reflects the true payment status.
pub fn update_sale_paid_amount(conn: &Connection, sale_id: i64) -> Result<(), AppError> {
    let total_from_payments: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM payments
             WHERE sale_id = ?1 AND is_deleted = 0 AND is_voided = 0 AND status = 'completed'",
        [sale_id],
        |r| r.get(0),
    )?;

    let total_from_split: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM sale_payments WHERE sale_id = ?1 AND is_voided = 0",
        [sale_id],
        |r| r.get(0),
    )?;

    // paid_amount = original split payments + linked due payments, capped at total_amount
    let total_amount: f64 = conn.query_row(
        "SELECT total_amount FROM sales WHERE id = ?1",
        [sale_id],
        |r| r.get(0),
    )?;

    let new_paid = utils::round2((total_from_split + total_from_payments).min(total_amount));

    conn.execute(
        "UPDATE sales SET paid_amount = ?1 WHERE id = ?2",
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
        .map(
            |(id, receipt_no, total_amount, paid_amount, due_amount, created_at)| UnpaidSaleInfo {
                id,
                receipt_no,
                total_amount,
                paid_amount,
                due_amount: utils::round2(due_amount),
                created_at,
            },
        )
        .collect())
}

pub fn list_payments_for_sale(conn: &Connection, sale_id: i64) -> Result<Vec<Payment>, AppError> {
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
            account_details: None,
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
    fn balance_counts_invoice_linked_payment_once() {
        let conn = in_memory_conn();
        let mid = member_id(&conn);
        // Credit sale: Rs 500 total, only 200 paid at sale time -> 300 owed on the sale.
        conn.execute(
            "INSERT INTO sales (receipt_no, member_id, total_amount, paid_amount, payment_method)
             VALUES ('BAL1', ?1, 500.0, 200.0, 'cash')",
            [mid],
        )
        .unwrap();
        let sale_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO sale_payments (sale_id, amount, payment_method) VALUES (?1, 200, 'cash')",
            [sale_id],
        )
        .unwrap();
        // Later, the customer pays off Rs 100.
        let mut p = sample(Some(mid));
        p.amount = 100.0;
        p.sale_id = Some(sale_id);
        create(&conn, p, None).unwrap();

        let bal = member_balance(&conn, mid).unwrap();
        assert_eq!(bal.total_credit, 200.0);
        assert_eq!(bal.total_paid, 0.0);
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

    #[test]
    fn returned_invoice_due_uses_refund_and_rejects_overpayment() {
        let conn = in_memory_conn();
        let mid = member_id(&conn);
        conn.execute(
            "INSERT INTO sales (receipt_no, member_id, total_amount, paid_amount, payment_method)
             VALUES ('RET-LINKED', ?1, 500, 100, 'cash')",
            [mid],
        )
        .unwrap();
        let sale_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO sale_payments (sale_id, amount, payment_method) VALUES (?1, 100, 'cash')",
            [sale_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO returns (return_no, sale_id, member_id, total_sale_price, deduction_amount, refund_amount, refund_method)
             VALUES ('RET-LINKED-1', ?1, ?2, 100, 10, 90, 'cash')",
            rusqlite::params![sale_id, mid],
        )
        .unwrap();

        let invoices = list_customer_due_invoices(&conn, None).unwrap();
        assert_eq!(invoices.len(), 1);
        assert_eq!(invoices[0].due_amount, 310.0);

        let mut too_much = sample(Some(mid));
        too_much.sale_id = Some(sale_id);
        too_much.amount = 310.01;
        assert!(matches!(
            create(&conn, too_much, None),
            Err(AppError::Validation(_))
        ));

        let mut exact = sample(Some(mid));
        exact.sale_id = Some(sale_id);
        exact.amount = 310.0;
        create(&conn, exact, None).unwrap();
        assert!(list_customer_due_invoices(&conn, None).unwrap().is_empty());
        assert!(list_customer_dues(&conn, None).unwrap().is_empty());
    }

    #[test]
    fn due_payments_update_sale_paid_amount() {
        let conn = in_memory_conn();
        let mid = member_id(&conn);

        // Sale: total 38000, initial cash payment 20000
        conn.execute(
            "INSERT INTO sales (receipt_no, member_id, total_amount, paid_amount, payment_method)
             VALUES ('INV-001', ?1, 38000.0, 20000.0, 'cash')",
            [mid],
        )
        .unwrap();
        let sale_id = conn.last_insert_rowid();

        // Initial split payment in sale_payments
        conn.execute(
            "INSERT INTO sale_payments (sale_id, amount, payment_method)
             VALUES (?1, 20000.0, 'cash')",
            [sale_id],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO accessories (brand, product_name, quantity)
             VALUES ('Test', 'Unchanged stock', 7)",
            [],
        )
        .unwrap();
        let stock_before: i64 = conn
            .query_row("SELECT SUM(quantity) FROM accessories", [], |r| r.get(0))
            .unwrap();

        // An unrelated historical customer payment must not hide this invoice.
        let mut unrelated = sample(Some(mid));
        unrelated.amount = 50000.0;
        create(&conn, unrelated, None).unwrap();

        let dues = list_customer_due_invoices(&conn, None).unwrap();
        assert_eq!(dues.len(), 1);
        assert_eq!(dues[0].sale_id, sale_id);
        assert!((dues[0].total_amount - 38000.0).abs() < 0.01);
        assert!((dues[0].paid_amount - 20000.0).abs() < 0.01);
        assert!((dues[0].due_amount - 18000.0).abs() < 0.01);
        let customer_dues = list_customer_dues(&conn, None).unwrap();
        assert_eq!(customer_dues.len(), 1);
        assert!((customer_dues[0].balance - 18000.0).abs() < 0.01);

        // Pay 10000 cash linked to sale
        let mut p1 = sample(Some(mid));
        p1.amount = 10000.0;
        p1.sale_id = Some(sale_id);
        create(&conn, p1, None).unwrap();

        // Verify the same invoice remains in dues with 8000 outstanding.
        let paid: f64 = conn
            .query_row(
                "SELECT paid_amount FROM sales WHERE id = ?1",
                [sale_id],
                |r| r.get(0),
            )
            .unwrap();
        assert!(
            (paid - 30000.0).abs() < 0.01,
            "after first payment paid_amount should be 30000, got {paid}"
        );
        let dues = list_customer_due_invoices(&conn, None).unwrap();
        assert_eq!(dues.len(), 1);
        assert!((dues[0].due_amount - 8000.0).abs() < 0.01);
        assert!((list_customer_dues(&conn, None).unwrap()[0].balance - 8000.0).abs() < 0.01);

        // Pay the final 8000 online, still linked to the same sale.
        let mut p2 = sample(Some(mid));
        p2.amount = 8000.0;
        p2.sale_id = Some(sale_id);
        p2.payment_method = "bank_transfer".into();
        p2.reference = Some("TX-8000".into());
        p2.account_details = Some("Meezan Bank / 1234".into());
        p2.notes = Some("Final due payment".into());
        create(&conn, p2, None).unwrap();

        // Verify sale.paid_amount updated to 38000 (fully paid)
        let paid: f64 = conn
            .query_row(
                "SELECT paid_amount FROM sales WHERE id = ?1",
                [sale_id],
                |r| r.get(0),
            )
            .unwrap();
        assert!(
            (paid - 38000.0).abs() < 0.01,
            "after second payment paid_amount should be 38000, got {paid}"
        );

        // Verify no unpaid sales remain
        let dues = list_customer_due_invoices(&conn, None).unwrap();
        assert!(
            dues.is_empty(),
            "fully paid invoice must leave Customer Dues"
        );
        assert!(list_customer_dues(&conn, None).unwrap().is_empty());

        // Initial and later payments remain distinct: the sale keeps its
        // original cash entry and payment history keeps both due collections.
        let sale = crate::services::sale_service::get(&conn, sale_id).unwrap();
        assert!((sale.paid_amount - 38000.0).abs() < 0.01);
        assert!((sale.total_amount - sale.paid_amount).abs() < 0.01);
        let payment_status = if sale.paid_amount >= sale.total_amount - 0.005 {
            "paid"
        } else if sale.paid_amount > 0.0 {
            "partial"
        } else {
            "unpaid"
        };
        assert_eq!(payment_status, "paid");
        assert_eq!(sale.sale_payments.len(), 1);
        assert_eq!(sale.sale_payments[0].payment_method, "cash");
        assert!((sale.sale_payments[0].amount - 20000.0).abs() < 0.01);

        let linked = list_payments_for_sale(&conn, sale_id).unwrap();
        assert_eq!(linked.len(), 2);
        assert_eq!(linked[0].payment_method, "cash");
        assert_eq!(linked[1].payment_method, "bank_transfer");
        assert!((linked[0].amount - 10000.0).abs() < 0.01);
        assert!((linked[1].amount - 8000.0).abs() < 0.01);
        assert_eq!(linked[1].reference.as_deref(), Some("TX-8000"));
        assert_eq!(
            linked[1].account_details.as_deref(),
            Some("Meezan Bank / 1234")
        );
        assert_eq!(linked[1].notes.as_deref(), Some("Final due payment"));

        // Online Payments exposes the same non-cash payment row. The cash due
        // collection is excluded, and no duplicate online record is created.
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let online =
            crate::services::report_service::online_payment_records(&conn, &today, &today).unwrap();
        assert_eq!(online.len(), 1);
        assert_eq!(online[0].sale_id, sale_id);
        assert!((online[0].amount - 8000.0).abs() < 0.01);
        assert_eq!(online[0].reference.as_deref(), Some("TX-8000"));
        assert_eq!(
            online[0].account_details.as_deref(),
            Some("Meezan Bank / 1234")
        );

        // Dashboard/report payment totals include both receipt sources once.
        let breakdown =
            crate::services::report_service::payment_breakdown(&conn, &today, &today).unwrap();
        let cash = breakdown
            .iter()
            .find(|row| row.payment_method == "cash")
            .unwrap();
        let bank = breakdown
            .iter()
            .find(|row| row.payment_method == "bank_transfer")
            .unwrap();
        assert!((cash.total - 30000.0).abs() < 0.01);
        assert_eq!(cash.count, 2);
        assert!((bank.total - 8000.0).abs() < 0.01);
        assert_eq!(bank.count, 1);

        let (sale_count, revenue): (i64, f64) = conn
            .query_row(
                "SELECT COUNT(*), COALESCE(SUM(total_amount), 0) FROM sales",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        let stock_after: i64 = conn
            .query_row("SELECT SUM(quantity) FROM accessories", [], |r| r.get(0))
            .unwrap();
        assert_eq!(sale_count, 1);
        assert!((revenue - 38000.0).abs() < 0.01);
        assert_eq!(stock_after, stock_before);
    }

    #[test]
    fn void_payment_excludes_from_balance_and_reports() {
        let conn = in_memory_conn();
        let mid = member_id(&conn);
        let mut input = sample(Some(mid));
        input.amount = 5000.0;
        input.payment_method = "bank_transfer".into();
        let p = create(&conn, input, None).unwrap();
        assert!(!p.is_voided);

        let bal = member_balance(&conn, mid).unwrap();
        assert!((bal.total_paid - 5000.0).abs() < 0.01);
        assert_eq!(bal.payment_count, 1);

        void_payment(&conn, p.id, "Duplicate entry", Some(1)).unwrap();

        let bal_after = member_balance(&conn, mid).unwrap();
        assert!((bal_after.total_paid).abs() < 0.01);
        assert_eq!(bal_after.payment_count, 0);

        let fetched = payment_repository::get_by_id_any(&conn, p.id)
            .unwrap()
            .unwrap();
        assert!(fetched.is_voided);
        assert_eq!(fetched.void_reason.as_deref(), Some("Duplicate entry"));
    }

    #[test]
    fn void_payment_excluded_from_sale_linked_report() {
        let conn = in_memory_conn();
        let mid = member_id(&conn);
        // Create a sale so payment_breakdown can JOIN on it.
        conn.execute(
            "INSERT INTO sales (receipt_no, member_id, total_amount, paid_amount, payment_method)
             VALUES ('VR01', ?1, 10000.0, 0.0, 'cash')",
            [mid],
        )
        .unwrap();
        let sale_id = conn.last_insert_rowid();

        let mut input = sample(Some(mid));
        input.amount = 5000.0;
        input.payment_method = "bank_transfer".into();
        input.sale_id = Some(sale_id);
        let p = create(&conn, input, None).unwrap();

        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let breakdown =
            crate::services::report_service::payment_breakdown(&conn, &today, &today).unwrap();
        let bank = breakdown
            .iter()
            .find(|b| b.payment_method == "bank_transfer");
        assert!(bank.is_some());
        assert!((bank.unwrap().total - 5000.0).abs() < 0.01);

        void_payment(&conn, p.id, "Test void", Some(1)).unwrap();

        let breakdown2 =
            crate::services::report_service::payment_breakdown(&conn, &today, &today).unwrap();
        let bank2 = breakdown2
            .iter()
            .find(|b| b.payment_method == "bank_transfer");
        assert!(bank2.is_none());
    }

    #[test]
    fn void_already_voided_is_rejected() {
        let conn = in_memory_conn();
        let p = create(&conn, sample(None), None).unwrap();
        void_payment(&conn, p.id, "reason", None).unwrap();
        let err = void_payment(&conn, p.id, "again", None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn void_exchange_credit_sale_payment_is_rejected() {
        let conn = in_memory_conn();
        conn.execute(
            "INSERT INTO sales (receipt_no, total_amount, paid_amount, payment_method)
             VALUES ('XC-VOID', 10000.0, 10000.0, 'cash')",
            [],
        )
        .unwrap();
        let sale_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO sale_payments (sale_id, amount, payment_method)
             VALUES (?1, 4000, 'exchange_credit')",
            [sale_id],
        )
        .unwrap();
        let sp_id = conn.last_insert_rowid();

        let err = crate::services::sale_payment_service::void_sale_payment(&conn, sp_id, "x", None)
            .unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));

        let is_voided: i64 = conn
            .query_row(
                "SELECT is_voided FROM sale_payments WHERE id = ?1",
                [sp_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(is_voided, 0);
        let paid: f64 = conn
            .query_row(
                "SELECT paid_amount FROM sales WHERE id = ?1",
                [sale_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(paid, 10000.0);
    }

    #[test]
    fn edit_payment_details_updates_fields() {
        let conn = in_memory_conn();
        let mut input = sample(None);
        input.account_details = Some("Old Bank".into());
        input.reference = Some("OLD-REF".into());
        let p = create(&conn, input, None).unwrap();

        let updated =
            edit_payment_details(&conn, p.id, Some("New Bank"), Some("NEW-REF"), None).unwrap();
        assert_eq!(updated.account_details.as_deref(), Some("New Bank"));
        assert_eq!(updated.reference.as_deref(), Some("NEW-REF"));
    }

    #[test]
    fn edit_voided_payment_is_rejected() {
        let conn = in_memory_conn();
        let p = create(&conn, sample(None), None).unwrap();
        void_payment(&conn, p.id, "reason", None).unwrap();
        let err = edit_payment_details(&conn, p.id, Some("x"), Some("y"), None).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }
}
