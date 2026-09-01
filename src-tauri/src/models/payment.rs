use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Payment {
    pub id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub member_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub member_name: Option<String>,
    pub amount: f64,
    pub payment_method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_type: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub payment_date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<i64>,
    pub created_at: String,
    pub is_deleted: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreatePaymentInput {
    pub member_id: Option<i64>,
    pub amount: f64,
    pub payment_method: String,
    pub payment_type: Option<String>,
    pub status: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub payment_date: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MemberBalance {
    pub member_id: i64,
    pub member_name: String,
    pub phone: Option<String>,
    /// Amount owed at sale time (sum of unpaid credit portions) — Σ(sales.total - sales.paid).
    pub total_credit: f64,
    /// Sum of payments received (completed) against the member.
    pub total_paid: f64,
    /// Outstanding balance = total_credit - total_paid.
    pub balance: f64,
    pub payment_count: i64,
}
