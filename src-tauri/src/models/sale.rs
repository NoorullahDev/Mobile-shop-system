use serde::{Deserialize, Serialize};

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
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Sale {
    pub id: i64,
    pub receipt_no: String,
    pub member_id: Option<i64>,
    pub member_name: Option<String>,
    pub total_amount: f64,
    pub discount: f64,
    pub paid_amount: f64,
    pub payment_method: String,
    pub notes: Option<String>,
    pub created_by: Option<i64>,
    pub created_at: String,
    pub items: Vec<SaleItem>,
}
