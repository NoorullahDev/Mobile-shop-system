use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SalePaymentInput {
    pub amount: f64,
    pub payment_method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SalePayment {
    pub id: i64,
    pub sale_id: i64,
    pub amount: f64,
    pub payment_method: String,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub is_voided: bool,
    pub void_reason: Option<String>,
    pub voided_by: Option<i64>,
    pub voided_at: Option<String>,
    pub account_details: Option<String>,
}
