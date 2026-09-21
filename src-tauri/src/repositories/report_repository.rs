use rusqlite::{params, Connection};

use crate::errors::AppError;

/// Dashboard KPIs for the current period (all-time ledger).
pub fn dashboard_summary(
    conn: &Connection,
) -> Result<(f64, f64, f64, i64, i64, i64, i64, f64), AppError> {
    let revenue = conn.query_row(
        "SELECT COALESCE(SUM(total_amount - COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = sales.id AND payment_method = 'exchange_credit' AND is_voided = 0), 0)), 0) FROM sales",
        [],
        |r| r.get::<_, f64>(0),
    )?;
    let expenses = conn.query_row(
        "SELECT 
            (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE is_deleted = 0) +
            (SELECT COALESCE(SUM(refund_amount), 0) FROM returns)
        ",
        [],
        |r| r.get::<_, f64>(0),
    )?;
    let cogs = conn.query_row(
        "SELECT COALESCE(SUM(si.quantity * si.cost_price), 0)
         FROM sale_items si",
        [],
        |r| r.get::<_, f64>(0),
    )?;
    let members_total = conn.query_row(
        "SELECT COUNT(*) FROM members WHERE is_deleted = 0",
        [],
        |r| r.get::<_, i64>(0),
    )?;
    let members_active = conn.query_row(
        "SELECT COUNT(*) FROM members WHERE is_deleted = 0 AND status = 'active'",
        [],
        |r| r.get::<_, i64>(0),
    )?;
    let products_total = conn.query_row(
        "SELECT (SELECT COUNT(*) FROM phones WHERE is_deleted = 0)
              + (SELECT COUNT(*) FROM accessories WHERE is_deleted = 0)",
        [],
        |r| r.get::<_, i64>(0),
    )?;
    let low_stock = conn.query_row(
        "SELECT (SELECT COUNT(*) FROM phones WHERE is_deleted = 0 AND low_stock_threshold > 0 AND quantity <= low_stock_threshold)
              + (SELECT COUNT(*) FROM accessories WHERE is_deleted = 0 AND low_stock_threshold > 0 AND quantity <= low_stock_threshold)",
        [],
        |r| r.get::<_, i64>(0),
    )?;
    let pending_payments = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE is_deleted = 0 AND is_voided = 0 AND status = 'pending'",
        [],
        |r| r.get::<_, f64>(0),
    )?;
    Ok((
        revenue,
        cogs,
        expenses,
        members_total,
        members_active,
        products_total,
        low_stock,
        pending_payments,
    ))
}

/// Monthly revenue (by sale `created_at`) for the last `months` months.
pub fn monthly_revenue(conn: &Connection, months: i64) -> Result<Vec<(String, f64)>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT strftime('%Y-%m', created_at) AS m, SUM(total_amount - COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = sales.id AND payment_method = 'exchange_credit' AND is_voided = 0), 0)) AS total
         FROM sales
         WHERE created_at >= datetime('now', ?1)
         GROUP BY m ORDER BY m",
    )?;
    let cutoff = format!("-{months} months");
    let rows = stmt.query_map([cutoff], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?))
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Monthly expenses (by `expense_date`) for the last `months` months.
pub fn monthly_expenses(conn: &Connection, months: i64) -> Result<Vec<(String, f64)>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT m, SUM(total) AS total FROM (
            SELECT strftime('%Y-%m', expense_date) AS m, amount AS total
            FROM expenses
            WHERE is_deleted = 0 AND expense_date >= datetime('now', ?1)
            UNION ALL
            SELECT strftime('%Y-%m', created_at) AS m, refund_amount AS total
            FROM returns
            WHERE created_at >= datetime('now', ?1)
         ) GROUP BY m ORDER BY m",
    )?;
    let cutoff = format!("-{months} months");
    let rows = stmt.query_map([cutoff], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?))
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Recent activity log entries.
pub fn recent_activity(
    conn: &Connection,
    limit: i64,
) -> Result<Vec<crate::models::report::ActivityLog>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, module, action, record_id, timestamp
         FROM activity_logs ORDER BY timestamp DESC, id DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map([limit], |r| {
        Ok(crate::models::report::ActivityLog {
            id: r.get("id")?,
            user_id: r.get("user_id")?,
            module: r.get("module")?,
            action: r.get("action")?,
            record_id: r.get("record_id")?,
            timestamp: r.get("timestamp")?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Revenue + expense + sale count for an inclusive date range (YYYY-MM-DD).
/// Returns (revenue, expenses, sales_count, received, discount, current outstanding).
pub fn period_summary(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<(f64, f64, i64, f64, f64, f64), AppError> {
    let revenue = conn.query_row(
        "SELECT COALESCE(SUM(total_amount - COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = sales.id AND payment_method = 'exchange_credit' AND is_voided = 0), 0)), 0) FROM sales
         WHERE date(created_at, 'localtime') >= date(?1) AND date(created_at, 'localtime') < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    let expenses = conn.query_row(
        "SELECT 
            (SELECT COALESCE(SUM(amount), 0) FROM expenses
             WHERE is_deleted = 0 AND expense_date >= date(?1) AND expense_date < date(?2, '+1 day')) +
            (SELECT COALESCE(SUM(refund_amount), 0) FROM returns
             WHERE date(created_at, 'localtime') >= date(?1) AND date(created_at, 'localtime') < date(?2, '+1 day'))
        ",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    let sales_count = conn.query_row(
        "SELECT COUNT(*) FROM sales WHERE date(created_at, 'localtime') >= date(?1) AND date(created_at, 'localtime') < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, i64>(0),
    )?;
    let received = conn.query_row(
        "SELECT COALESCE(SUM(paid_amount - COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = sales.id AND payment_method = 'exchange_credit' AND is_voided = 0), 0)), 0) FROM sales
         WHERE date(created_at, 'localtime') >= date(?1) AND date(created_at, 'localtime') < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    let discount = conn.query_row(
        "SELECT COALESCE(SUM(discount), 0) FROM sales
         WHERE date(created_at, 'localtime') >= date(?1) AND date(created_at, 'localtime') < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    let outstanding = conn.query_row(
        "SELECT COALESCE(SUM(MAX(s.total_amount - s.paid_amount
                    - COALESCE((SELECT SUM(r.refund_amount) FROM returns r WHERE r.sale_id = s.id), 0), 0)), 0)
         FROM sales s
         WHERE date(s.created_at, 'localtime') >= date(?1) AND date(s.created_at, 'localtime') < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    Ok((
        revenue,
        expenses,
        sales_count,
        received,
        discount,
        outstanding,
    ))
}

/// Daily sales revenue grouped by date within an inclusive range (earliest..latest).
pub fn sales_series(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<Vec<(String, f64)>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT date(created_at, 'localtime') AS day, SUM(total_amount - COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = sales.id AND payment_method = 'exchange_credit' AND is_voided = 0), 0)) AS total
         FROM sales
         WHERE date(created_at, 'localtime') >= date(?1) AND date(created_at, 'localtime') < date(?2, '+1 day')
         GROUP BY day ORDER BY day",
    )?;
    let rows = stmt.query_map(params![from, to], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?))
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Top `limit` products by sales revenue within the inclusive date range.
pub fn top_sellers(
    conn: &Connection,
    from: &str,
    to: &str,
    limit: i64,
) -> Result<Vec<crate::models::report::TopSeller>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT item_type, item_id, product_name, SUM(quantity) AS quantity,
                SUM(net_line_revenue) AS revenue
         FROM (
             SELECT 'phone' AS item_type, si.phone_id AS item_id,
                    (p.brand || ' ' || p.model) AS product_name, si.quantity,
                    COALESCE(
                      (si.quantity * si.unit_price)
                      * (s.total_amount - COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = s.id AND payment_method = 'exchange_credit' AND is_voided = 0), 0))
                      / NULLIF((SELECT SUM(all_si.quantity * all_si.unit_price) FROM sale_items all_si WHERE all_si.sale_id = s.id), 0),
                      0
                    ) AS net_line_revenue
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             JOIN phones p ON p.id = si.phone_id
             WHERE date(s.created_at, 'localtime') >= date(?1) AND date(s.created_at, 'localtime') < date(?2, '+1 day')
                 AND si.phone_id IS NOT NULL
             UNION ALL
             SELECT 'accessory' AS item_type, si.accessory_id AS item_id,
                    (a.brand || ' ' || a.product_name) AS product_name, si.quantity,
                    COALESCE(
                      (si.quantity * si.unit_price)
                      * (s.total_amount - COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = s.id AND payment_method = 'exchange_credit' AND is_voided = 0), 0))
                      / NULLIF((SELECT SUM(all_si.quantity * all_si.unit_price) FROM sale_items all_si WHERE all_si.sale_id = s.id), 0),
                      0
                    ) AS net_line_revenue
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             JOIN accessories a ON a.id = si.accessory_id
             WHERE date(s.created_at, 'localtime') >= date(?1) AND date(s.created_at, 'localtime') < date(?2, '+1 day')
                 AND si.accessory_id IS NOT NULL
         ) t
         GROUP BY item_type, item_id, product_name
         ORDER BY revenue DESC
         LIMIT ?3",
    )?;
    let rows = stmt.query_map(params![from, to, limit], |r| {
        Ok(crate::models::report::TopSeller {
            item_type: r.get("item_type")?,
            item_id: r.get("item_id")?,
            product_name: r.get("product_name")?,
            quantity: r.get("quantity")?,
            revenue: r.get("revenue")?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Receipts grouped by payment method within the inclusive date range.
/// Includes both point-of-sale payments and later completed due collections.
pub fn payment_breakdown(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<Vec<crate::models::report::PaymentBreakdown>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT received.payment_method, SUM(received.amount) AS total, COUNT(*) AS count
         FROM (
             SELECT sp.payment_method, sp.amount, sp.created_at AS received_at
             FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id
             WHERE sp.is_voided = 0
             UNION ALL
             SELECT p.payment_method, p.amount, COALESCE(p.payment_date, p.created_at) AS received_at
             FROM payments p
             JOIN sales s ON s.id = p.sale_id
             WHERE p.is_deleted = 0 AND p.is_voided = 0 AND p.status = 'completed'
         ) received
         WHERE date(received.received_at, 'localtime') >= date(?1)
           AND date(received.received_at, 'localtime') < date(?2, '+1 day')
           AND received.payment_method != 'exchange_credit'
         GROUP BY received.payment_method ORDER BY total DESC",
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

pub fn online_payment_records(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<Vec<crate::models::report::OnlinePaymentRecord>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT online.id, online.sale_id, online.receipt_no, online.customer_name,
                online.payment_method, online.amount, online.reference,
                online.account_details, online.notes, online.created_at,
                online.is_voided, online.void_reason, online.voided_at
         FROM (
             SELECT sp.id * 2 AS id, sp.sale_id, s.receipt_no, m.name AS customer_name,
                    sp.payment_method, sp.amount, sp.reference,
                    sp.account_details, sp.notes,
                    sp.created_at,
                    sp.is_voided, sp.void_reason, sp.voided_at
             FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id
             LEFT JOIN members m ON m.id = s.member_id
             WHERE LOWER(sp.payment_method) != 'cash'
               AND LOWER(sp.payment_method) != 'exchange_credit'
             UNION ALL
             SELECT p.id * 2 + 1 AS id, p.sale_id, s.receipt_no, m.name AS customer_name,
                    p.payment_method, p.amount, p.reference,
                    p.account_details, p.notes,
                    COALESCE(p.payment_date, p.created_at) AS created_at,
                    p.is_voided, p.void_reason, p.voided_at
             FROM payments p
             JOIN sales s ON s.id = p.sale_id
             LEFT JOIN members m ON m.id = s.member_id
             WHERE p.sale_id IS NOT NULL AND p.sale_id != 0
               AND p.is_deleted = 0 AND p.status = 'completed'
               AND LOWER(p.payment_method) != 'cash'
               AND LOWER(p.payment_method) != 'exchange_credit'
             UNION ALL
             SELECT -(r.id) AS id, r.sale_id, s.receipt_no, m.name AS customer_name,
                    r.refund_method AS payment_method, -r.refund_amount AS amount, r.reference,
                    r.notes AS account_details, NULL AS notes, r.created_at,
                    0 AS is_voided, NULL AS void_reason, NULL AS voided_at
             FROM returns r
             JOIN sales s ON s.id = r.sale_id
             LEFT JOIN members m ON m.id = s.member_id
             WHERE LOWER(r.refund_method) != 'cash'
               AND LOWER(r.refund_method) != 'exchange_credit'
         ) online
         WHERE date(online.created_at, 'localtime') >= date(?1)
           AND date(online.created_at, 'localtime') < date(?2, '+1 day')
         ORDER BY online.created_at DESC, online.id DESC",
    )?;
    let rows = stmt.query_map(params![from, to], |r| {
        Ok(crate::models::report::OnlinePaymentRecord {
            id: r.get("id")?,
            sale_id: r.get("sale_id")?,
            receipt_no: r.get("receipt_no")?,
            customer_name: r.get("customer_name")?,
            payment_method: r.get("payment_method")?,
            amount: r.get("amount")?,
            reference: r.get("reference")?,
            account_details: r.get("account_details")?,
            notes: r.get("notes")?,
            created_at: r.get("created_at")?,
            is_voided: r.get::<_, i64>("is_voided")? != 0,
            void_reason: r.get("void_reason")?,
            voided_at: r.get("voided_at")?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Profit & Loss for an inclusive date range.
///
/// Returns (revenue, cogs, expenses, sales_count) where `cogs` is the cost of
/// goods sold (cost_price captured on sale_items at the time of sale x quantity sold) and
/// `expenses` is the sum of operating expenses in the range.
pub fn profit_loss_summary(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<(f64, f64, f64, i64), AppError> {
    let revenue = conn.query_row(
        "SELECT COALESCE(SUM(total_amount - COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = sales.id AND payment_method = 'exchange_credit' AND is_voided = 0), 0)), 0) FROM sales
         WHERE date(created_at, 'localtime') >= date(?1) AND date(created_at, 'localtime') < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    let cogs = conn.query_row(
        "SELECT COALESCE(SUM(t.qty * t.cost), 0) FROM (
             SELECT si.quantity AS qty, si.cost_price AS cost
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             WHERE date(s.created_at, 'localtime') >= date(?1) AND date(s.created_at, 'localtime') < date(?2, '+1 day')
                 AND si.phone_id IS NOT NULL
             UNION ALL
             SELECT si.quantity AS qty, si.cost_price AS cost
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             WHERE date(s.created_at, 'localtime') >= date(?1) AND date(s.created_at, 'localtime') < date(?2, '+1 day')
                 AND si.accessory_id IS NOT NULL
         ) t",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    let expenses = conn.query_row(
        "SELECT 
            (SELECT COALESCE(SUM(amount), 0) FROM expenses
             WHERE is_deleted = 0 AND expense_date >= date(?1) AND expense_date < date(?2, '+1 day')) +
            (SELECT COALESCE(SUM(refund_amount), 0) FROM returns
             WHERE date(created_at, 'localtime') >= date(?1) AND date(created_at, 'localtime') < date(?2, '+1 day'))
        ",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    let sales_count = conn.query_row(
        "SELECT COUNT(*) FROM sales WHERE date(created_at, 'localtime') >= date(?1) AND date(created_at, 'localtime') < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, i64>(0),
    )?;
    Ok((revenue, cogs, expenses, sales_count))
}

/// Monthly profit & loss for an inclusive date range, grouped by YYYY-MM.
/// Returns Vec of (month, revenue, cogs, expenses).
pub fn monthly_profit_loss(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<Vec<(String, f64, f64, f64)>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT m, SUM(revenue) AS revenue, SUM(cogs) AS cogs, SUM(expenses) AS expenses FROM (
            SELECT strftime('%Y-%m', created_at) AS m,
                   SUM(total_amount - COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = sales.id AND payment_method = 'exchange_credit' AND is_voided = 0), 0)) AS revenue,
                   0.0 AS cogs,
                   0.0 AS expenses
            FROM sales
            WHERE date(created_at, 'localtime') >= date(?1) AND date(created_at, 'localtime') < date(?2, '+1 day')
            GROUP BY m
            UNION ALL
            SELECT strftime('%Y-%m', s.created_at) AS m,
                   0.0 AS revenue,
                   SUM(t.qty * t.cost) AS cogs,
                   0.0 AS expenses
            FROM (
                SELECT si.sale_id AS sid, si.quantity AS qty, si.cost_price AS cost
                FROM sale_items si
                WHERE si.phone_id IS NOT NULL
                UNION ALL
                SELECT si.sale_id AS sid, si.quantity AS qty, si.cost_price AS cost
                FROM sale_items si
                WHERE si.accessory_id IS NOT NULL
            ) t JOIN sales s ON s.id = t.sid
            WHERE date(s.created_at, 'localtime') >= date(?1) AND date(s.created_at, 'localtime') < date(?2, '+1 day')
            GROUP BY m
            UNION ALL
            SELECT strftime('%Y-%m', expense_date) AS m,
                   0.0 AS revenue,
                   0.0 AS cogs,
                   SUM(amount) AS expenses
            FROM expenses
            WHERE is_deleted = 0 AND expense_date >= date(?1) AND expense_date < date(?2, '+1 day')
            GROUP BY m
            UNION ALL
            SELECT strftime('%Y-%m', created_at) AS m,
                   0.0 AS revenue,
                   0.0 AS cogs,
                   SUM(refund_amount) AS expenses
            FROM returns
            WHERE date(created_at, 'localtime') >= date(?1) AND date(created_at, 'localtime') < date(?2, '+1 day')
            GROUP BY m
        ) sub
        GROUP BY m
        ORDER BY m",
    )?;
    let rows = stmt.query_map(params![from, to], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, f64>(1)?,
            r.get::<_, f64>(2)?,
            r.get::<_, f64>(3)?,
        ))
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Today's sales revenue and transaction count. Uses the frontend-supplied
/// local date string and converts created_at (UTC) to local timezone for
/// accurate day boundary matching.
pub fn today_summary(conn: &Connection, today: &str) -> Result<(f64, i64), AppError> {
    let revenue = conn.query_row(
        "SELECT COALESCE(SUM(total_amount - COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = sales.id AND payment_method = 'exchange_credit' AND is_voided = 0), 0)), 0) FROM sales
         WHERE date(created_at, 'localtime') >= date(?1)
           AND date(created_at, 'localtime') < date(?1, '+1 day')",
        params![today],
        |r| r.get::<_, f64>(0),
    )?;
    let count = conn.query_row(
        "SELECT COUNT(*) FROM sales
         WHERE date(created_at, 'localtime') >= date(?1)
           AND date(created_at, 'localtime') < date(?1, '+1 day')",
        params![today],
        |r| r.get::<_, i64>(0),
    )?;
    Ok((revenue, count))
}
