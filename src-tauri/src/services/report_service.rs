use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::report::{
    ActivityLog, DashboardSummary, MonthlyPoint, MonthlyProfitPoint, PaymentBreakdown,
    PeriodSummary, ProfitLoss, SalePoint, TopSeller,
};
use crate::repositories::report_repository;

fn month_key(d: &chrono::NaiveDate) -> String {
    d.format("%Y-%m").to_string()
}

/// Builds a contiguous last-N-months series, filling missing months with zero.
/// Month keys are UTC to match `monthly_revenue`/`monthly_expenses` grouping.
fn series(months: i64, rows: Vec<(String, f64)>) -> Vec<MonthlyPoint> {
    let now = chrono::Utc::now().date_naive();
    let first = chrono::NaiveDate::parse_from_str(
        &now.format("%Y-%m-01").to_string(),
        "%Y-%m-%d",
    )
    .unwrap_or(now);
    let mut labels: Vec<String> = Vec::new();
    let mut d = first;
    for _ in 0..months {
        labels.push(month_key(&d));
        d = match d.checked_sub_months(chrono::Months::new(1)) {
            Some(prev) => prev,
            None => break,
        };
    }
    labels.reverse();

    let mut by_key: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    for (k, v) in rows {
        *by_key.entry(k).or_insert(0.0) += v;
    }

    labels
        .into_iter()
        .map(|l| MonthlyPoint {
            month: l.clone(),
            total: by_key.get(&l).copied().unwrap_or(0.0),
        })
        .collect()
}

pub fn dashboard(conn: &Connection, _months: i64) -> Result<DashboardSummary, AppError> {
    let (
        revenue,
        expenses,
        members_total,
        members_active,
        products_total,
        low_stock,
        pending_payments,
    ) = report_repository::dashboard_summary(conn)?;
    let (today_revenue, today_sales_count) = report_repository::today_summary(conn)?;

    Ok(DashboardSummary {
        revenue,
        expenses,
        profit: revenue - expenses,
        today_revenue,
        today_sales_count,
        members_total,
        members_active,
        products_total,
        low_stock_count: low_stock,
        pending_payments,
    })
}

pub fn revenue_series(conn: &Connection, months: i64) -> Result<Vec<MonthlyPoint>, AppError> {
    let rows = report_repository::monthly_revenue(conn, months)?;
    Ok(series(months, rows))
}

pub fn expense_series(conn: &Connection, months: i64) -> Result<Vec<MonthlyPoint>, AppError> {
    let rows = report_repository::monthly_expenses(conn, months)?;
    Ok(series(months, rows))
}

pub fn recent_activity(conn: &Connection, limit: i64) -> Result<Vec<ActivityLog>, AppError> {
    report_repository::recent_activity(conn, limit)
}

pub fn period_summary(conn: &Connection, from: &str, to: &str) -> Result<PeriodSummary, AppError> {
    let (revenue, expenses, sales_count, received, discount) =
        report_repository::period_summary(conn, from, to)?;
    Ok(PeriodSummary {
        from: from.to_string(),
        to: to.to_string(),
        revenue,
        expenses,
        profit: revenue - expenses,
        sales_count,
        received,
        discount,
        outstanding: (revenue - received).max(0.0),
    })
}

/// Daily sales series (day -> revenue) for an inclusive date range.
pub fn sales_series(conn: &Connection, from: &str, to: &str) -> Result<Vec<SalePoint>, AppError> {
    let rows = report_repository::sales_series(conn, from, to)?;
    Ok(rows
        .into_iter()
        .map(|(day, total)| SalePoint { day, total })
        .collect())
}

pub fn top_sellers(conn: &Connection, from: &str, to: &str, limit: i64) -> Result<Vec<TopSeller>, AppError> {
    report_repository::top_sellers(conn, from, to, limit)
}

pub fn payment_breakdown(
    conn: &Connection,
    from: &str,
    to: &str,
) -> Result<Vec<PaymentBreakdown>, AppError> {
    report_repository::payment_breakdown(conn, from, to)
}

/// Profit & Loss statement for an inclusive range plus a monthly breakdown.
pub fn profit_loss(conn: &Connection, from: &str, to: &str) -> Result<ProfitLoss, AppError> {
    let (revenue, cogs, expenses, sales_count) =
        report_repository::profit_loss_summary(conn, from, to)?;
    let monthly_rows = report_repository::monthly_profit_loss(conn, from, to)?;

    let monthly = monthly_rows
        .into_iter()
        .map(|(month, m_rev, m_cogs, m_exp)| {
            let gross = m_rev - m_cogs;
            MonthlyProfitPoint {
                month,
                revenue: m_rev,
                cogs: m_cogs,
                expenses: m_exp,
                gross_profit: gross,
                net_profit: gross - m_exp,
            }
        })
        .collect();

    Ok(ProfitLoss {
        from: from.to_string(),
        to: to.to_string(),
        total_revenue: revenue,
        total_cogs: cogs,
        total_expenses: expenses,
        gross_profit: revenue - cogs,
        net_profit: revenue - cogs - expenses,
        sales_count,
        monthly,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_utils::in_memory_conn;

    fn local_today() -> String {
        chrono::Local::now().date_naive().format("%Y-%m-%d").to_string()
    }

    fn seed_sale(conn: &Connection, total: f64, member_id: Option<i64>) -> i64 {
        seed_sale_on(conn, total, member_id, None)
    }

    fn seed_sale_on(conn: &Connection, total: f64, member_id: Option<i64>, on: Option<&str>) -> i64 {
        conn.execute(
            "INSERT INTO sales (receipt_no, member_id, total_amount, paid_amount, payment_method, created_at)
             VALUES (?1, ?2, ?3, ?3, 'cash', COALESCE(?4, CURRENT_TIMESTAMP))",
            rusqlite::params![format!("R{}", rand_id()), member_id, total, on],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    fn seed_expense(conn: &Connection, amount: f64, category_id: i64) {
        seed_expense_on(conn, amount, category_id, None)
    }

    fn seed_expense_on(conn: &Connection, amount: f64, category_id: i64, on: Option<&str>) {
        conn.execute(
            "INSERT INTO expenses (category_id, amount, expense_date, description)
             VALUES (?1, ?2, COALESCE(?3, date('now')), 'test')",
            rusqlite::params![category_id, amount, on],
        )
        .unwrap();
    }

    static mut RN: i64 = 0;
    fn rand_id() -> i64 {
        unsafe {
            RN += 1;
            RN
        }
    }

    #[test]
    fn dashboard_counts_and_totals() {
        let conn = in_memory_conn();
        conn.execute(
            "INSERT INTO categories (name, type) VALUES ('Rent','expense')",
            [],
        )
        .unwrap();
        let cat = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO phones (brand, model, quantity, low_stock_threshold) VALUES ('Apple','iPhone 15',2,3)",
            [],
        )
        .unwrap();
        seed_sale(&conn, 1000.0, None);
        seed_sale(&conn, 500.0, None);
        seed_expense(&conn, 300.0, cat);

        let s = dashboard(&conn, 12).unwrap();
        assert_eq!(s.revenue, 1500.0);
        assert_eq!(s.expenses, 300.0);
        assert_eq!(s.profit, 1200.0);
        assert_eq!(s.products_total, 1);
        assert_eq!(s.low_stock_count, 1);
        assert_eq!(s.today_revenue, 1500.0);
        assert_eq!(s.today_sales_count, 2);
    }

    #[test]
    fn period_summary_range() {
        let conn = in_memory_conn();
        conn.execute(
            "INSERT INTO categories (name, type) VALUES ('Rent','expense')",
            [],
        )
        .unwrap();
        let cat = conn.last_insert_rowid();
        let today = local_today();
        seed_sale_on(&conn, 1000.0, None, Some(&today));
        seed_expense_on(&conn, 250.0, cat, Some(&today));

        let from = chrono::Local::now()
            .date_naive()
            .format("%Y-%m-01")
            .to_string();
        let to = today;
        let p = period_summary(&conn, &from, &to).unwrap();
        assert_eq!(p.revenue, 1000.0);
        assert_eq!(p.expenses, 250.0);
        assert_eq!(p.profit, 750.0);
        assert_eq!(p.sales_count, 1);
    }

    #[test]
    fn monthly_series_filled() {
        let conn = in_memory_conn();
        let s = revenue_series(&conn, 6).unwrap();
        assert_eq!(s.len(), 6);
        assert!(s.iter().all(|p| p.total == 0.0));
    }

    #[test]
    fn activity_returns_entries() {
        let conn = in_memory_conn();
        conn.execute(
            "INSERT INTO activity_logs (user_id, module, action) VALUES (1,'members','create')",
            [],
        )
        .unwrap();
        let a = recent_activity(&conn, 5).unwrap();
        assert_eq!(a.len(), 1);
        assert_eq!(a[0].module, "members");
    }

    #[test]
    fn analytics_reports_for_range() {
        let conn = in_memory_conn();
        conn.execute(
            "INSERT INTO phones (brand, model, quantity, cost_price, sale_price) VALUES ('Samsung','Galaxy',10,500,650)",
            [],
        )
        .unwrap();
        let today = local_today();
        conn.execute(
            "INSERT INTO sales (receipt_no, total_amount, discount, paid_amount, payment_method, created_at) VALUES
               ('R1', 650, 0, 650, 'cash', ?1)",
            rusqlite::params![today],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO sales (receipt_no, total_amount, discount, paid_amount, payment_method, created_at) VALUES
               ('R2', 1300, 50, 300, 'credit', ?1)",
            rusqlite::params![today],
        )
        .unwrap();
        conn.execute_batch(
            "INSERT INTO sale_items (sale_id, phone_id, quantity, unit_price) VALUES
               (1, 1, 1, 650),
               (2, 1, 2, 650);",
        )
        .unwrap();

        let from = chrono::Local::now().date_naive().format("%Y-%m-01").to_string();
        let to = today;

        let p = period_summary(&conn, &from, &to).unwrap();
        assert_eq!(p.revenue, 1950.0);
        assert_eq!(p.sales_count, 2);
        assert_eq!(p.received, 950.0);
        assert_eq!(p.discount, 50.0);
        assert_eq!(p.outstanding, 1000.0);

        let series = sales_series(&conn, &from, &to).unwrap();
        assert_eq!(series.len(), 1);
        assert_eq!(series[0].total, 1950.0);

        let top = top_sellers(&conn, &from, &to, 5).unwrap();
        assert_eq!(top.len(), 1);
        assert_eq!(top[0].product_name, "Samsung Galaxy");
        assert_eq!(top[0].quantity, 3);
        assert_eq!(top[0].revenue, 1950.0);

        let breakdown = payment_breakdown(&conn, &from, &to).unwrap();
        assert_eq!(breakdown.len(), 2);
        let cash = breakdown.iter().find(|b| b.payment_method == "cash").unwrap();
        assert_eq!(cash.total, 650.0);
    }

    #[test]
    fn profit_loss_computes_gross_and_net() {
        let conn = in_memory_conn();
        conn.execute(
            "INSERT INTO categories (name, type) VALUES ('Rent','expense')",
            [],
        )
        .unwrap();
        let cat = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO phones (brand, model, quantity, cost_price, sale_price) VALUES ('Samsung','Galaxy',10,500,650)",
            [],
        )
        .unwrap();
        let today = local_today();
        conn.execute(
            "INSERT INTO sales (receipt_no, total_amount, paid_amount, payment_method, created_at) VALUES
               ('P1', 1300, 1300, 'cash', ?1)",
            rusqlite::params![today],
        )
        .unwrap();
        conn.execute_batch(
            "INSERT INTO sale_items (sale_id, phone_id, quantity, unit_price) VALUES
               (1, 1, 2, 650);",
        )
        .unwrap();
        conn.execute(
            "INSERT INTO expenses (category_id, amount, expense_date, description) VALUES (?1, ?2, ?3, 'rent')",
            rusqlite::params![cat, 200, today],
        )
        .unwrap();

        let from = chrono::Local::now().date_naive().format("%Y-%m-01").to_string();
        let to = today;

        let pl = profit_loss(&conn, &from, &to).unwrap();
        assert_eq!(pl.total_revenue, 1300.0);
        assert_eq!(pl.total_cogs, 1000.0); // 2 x cost_price 500
        assert_eq!(pl.total_expenses, 200.0);
        assert_eq!(pl.gross_profit, 300.0);
        assert_eq!(pl.net_profit, 100.0);
        assert_eq!(pl.sales_count, 1);
        assert!(!pl.monthly.is_empty());
        let first = &pl.monthly[pl.monthly.len() - 1];
        assert_eq!(first.revenue, 1300.0);
        assert_eq!(first.cogs, 1000.0);
    }
}
