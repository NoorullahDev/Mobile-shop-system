use serde::{Deserialize, Serialize};

use super::product_return::ProductReturn;
use super::sale_payment::SalePayment;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SaleItemInput {
    /// Existing sale line id when correcting an invoice. Omit for new lines.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sale_item_id: Option<i64>,
    /// "phone" or "accessory"
    pub item_type: String,
    pub item_id: i64,
    pub quantity: i64,
    pub imei_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit_price: Option<f64>,
    /// Optional warranty label (e.g. "7 Days", "1 Year", or custom text).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warranty: Option<String>,
    /// Computed expiry ISO date (YYYY-MM-DD). Sent by frontend after calculating from sale date + duration.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warranty_expiry: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreateSaleInput {
    pub member_id: Option<i64>,
    pub discount: f64,
    pub paid_amount: Option<f64>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
    pub items: Vec<SaleItemInput>,
    /// Split payments: when provided, overrides paid_amount and payment_method.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub payments: Vec<super::sale_payment::SalePaymentInput>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SaleItem {
    pub id: i64,
    pub sale_id: i64,
    /// "phone" or "accessory"
    pub item_type: String,
    pub item_id: i64,
    pub imei_id: Option<i64>,
    pub quantity: i64,
    pub unit_price: f64,
    /// Cost price at the time of sale — used for historical profit/loss.
    pub cost_price: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub product_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub imei: Option<String>,
    /// Optional second IMEI snapshotted from the same sold handset.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub imei2: Option<String>,
    /// Phone variant (e.g. "256GB Midnight") — phones only.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
    /// Serial number when the product records one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub serial_no: Option<String>,
    /// Warranty label (e.g. "7 Days", "1 Year", custom text). None/empty = no warranty.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warranty: Option<String>,
    /// Warranty expiry ISO date (YYYY-MM-DD).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warranty_expiry: Option<String>,
    /// Colour of the sold unit, snapshot at sale time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// PTA status of the physical unit, snapshot at sale time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pta_status: Option<String>,
    /// Storage of the exact physical unit, snapshotted at sale time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub storage: Option<String>,
    /// Battery health of the exact physical unit, snapshotted at sale time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub battery_health_pct: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Sale {
    pub id: i64,
    pub receipt_no: String,
    pub member_id: Option<i64>,
    pub member_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub member_phone: Option<String>,
    pub total_amount: f64,
    pub discount: f64,
    pub paid_amount: f64,
    pub payment_method: String,
    pub notes: Option<String>,
    pub created_by: Option<i64>,
    pub created_at: String,
    pub items: Vec<SaleItem>,
    /// Total quantity of items sold (computed from sale_items, always populated).
    #[serde(default)]
    pub sold_qty: i64,
    /// Return status for this sale: "none" | "partial" | "full".
    pub return_status: String,
    /// Total amount refunded across all returns on this sale.
    #[serde(default)]
    pub returned_amount: f64,
    /// Number of returns recorded against this sale.
    #[serde(default)]
    pub return_count: i64,
    /// Full return records for this sale (only populated by the detail view).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub returns: Vec<ProductReturn>,
    /// Split payment entries for this sale (only populated by the detail view).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sale_payments: Vec<SalePayment>,
}
