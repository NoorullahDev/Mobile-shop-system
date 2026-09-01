use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct DashboardSummary {
    pub revenue: f64,
    pub expenses: f64,
    pub profit: f64,
    pub today_revenue: f64,
    pub today_sales_count: i64,
    pub members_total: i64,
    pub members_active: i64,
    pub products_total: i64,
    pub low_stock_count: i64,
    pub pending_payments: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MonthlyPoint {
    pub month: String,
    pub total: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ActivityLog {
    pub id: i64,
    pub user_id: Option<i64>,
    pub module: String,
    pub action: String,
    pub record_id: Option<i64>,
    pub timestamp: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct PeriodSummary {
    pub from: String,
    pub to: String,
    pub revenue: f64,
    pub expenses: f64,
    pub profit: f64,
    pub sales_count: i64,
    /// Sum of amounts received at point of sale (cash/partial paid).
    pub received: f64,
    /// Sum of all discounts applied to sales in the period.
    pub discount: f64,
    /// Revenue left outstanding on credit/partial sales after upfront payment.
    pub outstanding: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SalePoint {
    pub day: String,
    pub total: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TopSeller {
    /// "phone" or "accessory"
    pub item_type: String,
    pub item_id: i64,
    pub product_name: String,
    pub quantity: i64,
    pub revenue: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PaymentBreakdown {
    pub payment_method: String,
    pub total: f64,
    pub count: i64,
}

/// A single monthly profit & loss point.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MonthlyProfitPoint {
    pub month: String,
    pub revenue: f64,
    pub cogs: f64,
    pub expenses: f64,
    pub gross_profit: f64,
    pub net_profit: f64,
}

/// Profit & Loss statement for a period.
///
/// - `total_revenue`: gross sales (sum of sale total_amount)
/// - `total_cogs`: cost of goods sold (sum of item cost_price x quantity sold)
/// - `total_expenses`: operating expenses from the expenses table
/// - `gross_profit`: total_revenue - total_cogs
/// - `net_profit`: gross_profit - total_expenses
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct ProfitLoss {
    pub from: String,
    pub to: String,
    pub total_revenue: f64,
    pub total_cogs: f64,
    pub total_expenses: f64,
    pub gross_profit: f64,
    pub net_profit: f64,
    pub sales_count: i64,
    pub monthly: Vec<MonthlyProfitPoint>,
}
