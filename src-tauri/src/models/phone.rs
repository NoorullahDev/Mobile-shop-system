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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub imei2: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sku: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition_rating: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body_condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub screen_condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub battery_health: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub camera_condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub face_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub charger: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub box_condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warranty: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition_notes: Option<String>,
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
    pub imei2: Option<String>,
    pub category: Option<String>,
    pub condition: Option<String>,
    pub variant: Option<String>,
    pub sku: Option<String>,
    pub condition_rating: Option<String>,
    pub body_condition: Option<String>,
    pub screen_condition: Option<String>,
    pub battery_health: Option<String>,
    pub camera_condition: Option<String>,
    pub face_id: Option<String>,
    pub speaker: Option<String>,
    pub charger: Option<String>,
    pub box_condition: Option<String>,
    pub warranty: Option<String>,
    pub condition_notes: Option<String>,
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

// ---- Phone Options (dynamic dropdown values) ----

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PhoneOption {
    pub id: i64,
    pub option_type: String,
    pub value: String,
    pub sort_order: i64,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreatePhoneOptionInput {
    pub option_type: String,
    pub value: String,
    pub sort_order: Option<i64>,
    pub is_active: Option<bool>,
}
