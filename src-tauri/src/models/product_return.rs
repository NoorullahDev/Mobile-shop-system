use serde::{Deserialize, Serialize};

/// One returned line. `sale_item_id` references the original sale item so the
/// backend can re-validate quantities and IMEIs against the recorded sale.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReturnItemInput {
    pub sale_item_id: i64,
    pub quantity: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub imei_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    /// Return condition of the item: sellable / good / used / damaged /
    /// defective / nonsellable (drives automatic stock restoration).
    pub condition: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreateReturnInput {
    pub sale_id: i64,
    /// Restock charge as a percentage of the returned value
    /// (0, 10, 20, 30 or any custom value).
    pub return_charge_percent: f64,
    /// When > 0 this overrides the percentage: a flat deduction is taken from
    /// the returned value.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fixed_deduction: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refund_method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub return_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub items: Vec<ReturnItemInput>,
}

/// A returned line joined with its product snapshot (used in return detail).
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReturnItem {
    pub id: i64,
    pub return_id: i64,
    pub sale_item_id: i64,
    pub item_type: String,
    pub item_id: i64,
    pub imei_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub product_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub imei: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub serial_no: Option<String>,
    pub quantity: i64,
    pub unit_price: f64,
    pub line_total: f64,
    pub deduction_amount: f64,
    pub refund_amount: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    pub condition: String,
    pub restocked: bool,
    pub created_at: String,
}

/// A return header without items (used for return history lists).
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReturnSummary {
    pub id: i64,
    pub return_no: String,
    pub sale_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub receipt_no: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub member_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_phone: Option<String>,
    pub total_sale_price: f64,
    pub deduction_amount: f64,
    pub refund_amount: f64,
    pub return_charge_percent: f64,
    pub refund_method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub return_date: Option<String>,
    pub condition: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by_name: Option<String>,
    pub created_at: String,
    pub item_count: i64,
}

/// Full return record: header + items.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProductReturn {
    pub id: i64,
    pub return_no: String,
    pub sale_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub receipt_no: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub member_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_phone: Option<String>,
    pub total_sale_price: f64,
    pub deduction_amount: f64,
    pub refund_amount: f64,
    pub return_charge_percent: f64,
    pub refund_method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub return_date: Option<String>,
    pub condition: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by_name: Option<String>,
    pub created_at: String,
    pub items: Vec<ReturnItem>,
}