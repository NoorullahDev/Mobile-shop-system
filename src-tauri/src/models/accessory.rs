use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Accessory {
    pub id: i64,
    pub accessory_type: String,
    pub brand: String,
    pub product_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub compatible_models: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connector_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warranty: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub features: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sku: Option<String>,
    pub serial_number: Option<String>,
    pub image_paths: Vec<String>,
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
pub struct CreateAccessoryInput {
    pub accessory_type: String,
    pub brand: String,
    pub product_name: String,
    pub compatible_models: Option<String>,
    pub color: Option<String>,
    pub condition: Option<String>,
    pub connector_type: Option<String>,
    pub warranty: Option<String>,
    pub features: Option<String>,
    pub description: Option<String>,
    pub sku: Option<String>,
    pub serial_number: Option<String>,
    #[serde(default)]
    pub image_paths: Vec<String>,
    pub cost_price: f64,
    pub sale_price: f64,
    pub quantity: i64,
    pub supplier_id: Option<i64>,
    pub low_stock_threshold: i64,
}
