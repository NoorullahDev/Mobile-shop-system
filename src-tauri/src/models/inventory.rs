use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Supplier {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    pub is_deleted: bool,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreateSupplierInput {
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
}
