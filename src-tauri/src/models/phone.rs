use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Phone {
    pub id: i64,
    pub brand: String,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ram: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub processor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chipset: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub battery_capacity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub imei: Option<String>,
    pub cost_price: f64,
    pub sale_price: f64,
    pub quantity: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supplier_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supplier_name: Option<String>,
    pub low_stock_threshold: i64,
    pub is_deleted: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreatePhoneInput {
    pub brand: String,
    pub model: String,
    pub color: Option<String>,
    pub storage: Option<String>,
    pub ram: Option<String>,
    pub processor: Option<String>,
    pub chipset: Option<String>,
    pub network_type: Option<String>,
    pub battery_capacity: Option<String>,
    pub imei: Option<String>,
    pub cost_price: f64,
    pub sale_price: f64,
    pub quantity: i64,
    pub supplier_id: Option<i64>,
    pub low_stock_threshold: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PhoneImei {
    pub id: i64,
    pub phone_id: i64,
    pub imei: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sold_at: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct AddPhoneImeiInput {
    pub phone_id: i64,
    pub imei: String,
}
