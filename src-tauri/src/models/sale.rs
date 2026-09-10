use serde::{Deserialize, Serialize};

use super::product_return::ProductReturn;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SaleItemInput {
    /// "phone" or "accessory"
    pub item_type: String,
    pub item_id: i64,
    pub quantity: i64,
    pub imei_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit_price: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreateSaleInput {
    pub member_id: Option<i64>,
    pub discount: f64,
    pub paid_amount: Option<f64>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
    pub items: Vec<SaleItemInput>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub product_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub imei: Option<String>,
    /// Phone variant (e.g. "256GB Midnight") — phones only.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
    /// Serial number when the product records one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub serial_no: Option<String>,
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
}
