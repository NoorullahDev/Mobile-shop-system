use rusqlite::{params, Connection};

use crate::errors::AppError;

/// Dashboard KPIs for the current period (all-time ledger).
pub fn dashboard_summary(
    conn: &Connection,
) -> Result<(f64, f64, i64, i64, i64, i64, f64), AppError> {
    let revenue = conn.query_row(
        "SELECT COALESCE(SUM(total_amount), 0) FROM sales",
        [],
        |r| r.get::<_, f64>(0),
    )?;
    let expenses = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE is_deleted = 0",
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
        "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE is_deleted = 0 AND status = 'pending'",
        [],
        |r| r.get::<_, f64>(0),
    )?;
    Ok((
        revenue,
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
        "SELECT strftime('%Y-%m', created_at) AS m, SUM(total_amount) AS total
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
        "SELECT strftime('%Y-%m', expense_date) AS m, SUM(amount) AS total
         FROM expenses
         WHERE is_deleted = 0 AND expense_date >= datetime('now', ?1)
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
/// Returns (revenue, expenses, sales_count, received, discount). Outstanding = revenue - received.
pub fn period_summary(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<(f64, f64, i64, f64, f64), AppError> {
    let revenue = conn.query_row(
        "SELECT COALESCE(SUM(total_amount), 0) FROM sales
         WHERE created_at >= date(?1) AND created_at < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    let expenses = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses
         WHERE is_deleted = 0 AND expense_date >= date(?1) AND expense_date < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    let sales_count = conn.query_row(
        "SELECT COUNT(*) FROM sales WHERE created_at >= date(?1) AND created_at < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, i64>(0),
    )?;
    let received = conn.query_row(
        "SELECT COALESCE(SUM(paid_amount), 0) FROM sales
         WHERE created_at >= date(?1) AND created_at < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    let discount = conn.query_row(
        "SELECT COALESCE(SUM(discount), 0) FROM sales
         WHERE created_at >= date(?1) AND created_at < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    Ok((revenue, expenses, sales_count, received, discount))
}

/// Daily sales revenue grouped by date within an inclusive range (earliest..latest).
pub fn sales_series(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<Vec<(String, f64)>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT date(created_at) AS day, SUM(total_amount) AS total
         FROM sales
         WHERE created_at >= date(?1) AND created_at < date(?2, '+1 day')
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
                SUM(quantity * unit_price) AS revenue
         FROM (
             SELECT 'phone' AS item_type, si.phone_id AS item_id,
                    (p.brand || ' ' || p.model) AS product_name, si.quantity, si.unit_price
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             JOIN phones p ON p.id = si.phone_id
             WHERE s.created_at >= date(?1) AND s.created_at < date(?2, '+1 day')
                 AND si.phone_id IS NOT NULL
             UNION ALL
             SELECT 'accessory' AS item_type, si.accessory_id AS item_id,
                    (a.brand || ' ' || a.product_name) AS product_name, si.quantity, si.unit_price
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             JOIN accessories a ON a.id = si.accessory_id
             WHERE s.created_at >= date(?1) AND s.created_at < date(?2, '+1 day')
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

/// Sales grouped by payment method within the inclusive date range.
pub fn payment_breakdown(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<Vec<crate::models::report::PaymentBreakdown>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT payment_method, SUM(total_amount) AS total, COUNT(*) AS count
         FROM sales
         WHERE created_at >= date(?1) AND created_at < date(?2, '+1 day')
         GROUP BY payment_method ORDER BY total DESC",
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

/// Profit & Loss for an inclusive date range.
///
/// Returns (revenue, cogs, expenses, sales_count) where `cogs` is the cost of
/// goods sold (current cost_price of the phone/accessory x quantity sold) and
/// `expenses` is the sum of operating expenses in the range.
pub fn profit_loss_summary(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<(f64, f64, f64, i64), AppError> {
    let revenue = conn.query_row(
        "SELECT COALESCE(SUM(total_amount), 0) FROM sales
         WHERE created_at >= date(?1) AND created_at < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    let cogs = conn.query_row(
        "SELECT COALESCE(SUM(t.qty * t.cost), 0) FROM (
             SELECT si.quantity AS qty, p.cost_price AS cost
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             JOIN phones p ON p.id = si.phone_id
             WHERE s.created_at >= date(?1) AND s.created_at < date(?2, '+1 day')
                 AND si.phone_id IS NOT NULL
             UNION ALL
             SELECT si.quantity AS qty, a.cost_price AS cost
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             JOIN accessories a ON a.id = si.accessory_id
             WHERE s.created_at >= date(?1) AND s.created_at < date(?2, '+1 day')
                 AND si.accessory_id IS NOT NULL
         ) t",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    let expenses = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses
         WHERE is_deleted = 0 AND expense_date >= date(?1) AND expense_date < date(?2, '+1 day')",
        params![from, to],
        |r| r.get::<_, f64>(0),
    )?;
    let sales_count = conn.query_row(
        "SELECT COUNT(*) FROM sales WHERE created_at >= date(?1) AND created_at < date(?2, '+1 day')",
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
                   SUM(total_amount) AS revenue,
                   0.0 AS cogs,
                   0.0 AS expenses
            FROM sales
            WHERE created_at >= date(?1) AND created_at < date(?2, '+1 day')
            GROUP BY m
            UNION ALL
            SELECT strftime('%Y-%m', s.created_at) AS m,
                   0.0 AS revenue,
                   SUM(t.qty * t.cost) AS cogs,
                   0.0 AS expenses
            FROM (
                SELECT si.sale_id AS sid, si.quantity AS qty, p.cost_price AS cost
                FROM sale_items si JOIN phones p ON p.id = si.phone_id
                WHERE si.phone_id IS NOT NULL
                UNION ALL
                SELECT si.sale_id AS sid, si.quantity AS qty, a.cost_price AS cost
                FROM sale_items si JOIN accessories a ON a.id = si.accessory_id
                WHERE si.accessory_id IS NOT NULL
            ) t JOIN sales s ON s.id = t.sid
            WHERE s.created_at >= date(?1) AND s.created_at < date(?2, '+1 day')
            GROUP BY m
            UNION ALL
            SELECT strftime('%Y-%m', expense_date) AS m,
                   0.0 AS revenue,
                   0.0 AS cogs,
                   SUM(amount) AS expenses
            FROM expenses
            WHERE is_deleted = 0 AND expense_date >= date(?1) AND expense_date < date(?2, '+1 day')
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

/// Today's sales revenue and transaction count. Uses UTC to match the UTC
/// bucket used by every range report and the UTC date strings sent by the UI.
pub fn today_summary(conn: &Connection) -> Result<(f64, i64), AppError> {
    let revenue = conn.query_row(
        "SELECT COALESCE(SUM(total_amount), 0) FROM sales
         WHERE created_at >= date('now') AND created_at < date('now', '+1 day')",
        [],
        |r| r.get::<_, f64>(0),
    )?;
    let count = conn.query_row(
        "SELECT COUNT(*) FROM sales
         WHERE created_at >= date('now') AND created_at < date('now', '+1 day')",
        [],
        |r| r.get::<_, i64>(0),
    )?;
    Ok((revenue, count))
}
