use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PurchaseItemInput {
    /// "phone" or "accessory"
    pub item_type: String,
    pub item_id: i64,
    pub quantity: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit_cost: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selling_price: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warranty: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    #[serde(default)]
    pub imeis: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreatePurchaseInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supplier_id: Option<i64>,
    pub discount: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paid_amount: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub purchase_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invoice_reference: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub items: Vec<PurchaseItemInput>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PurchaseItem {
    pub id: i64,
    pub purchase_id: i64,
    /// "phone" or "accessory"
    pub item_type: String,
    pub item_id: i64,
    pub quantity: i64,
    pub unit_cost: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selling_price: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warranty: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub product_name: Option<String>,
    pub line_total: f64,
    #[serde(default)]
    pub serials: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Purchase {
    pub id: i64,
    pub purchase_no: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supplier_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supplier_name: Option<String>,
    pub total_amount: f64,
    pub discount: f64,
    pub paid_amount: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub purchase_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invoice_reference: Option<String>,
    pub payment_method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<i64>,
    pub created_at: String,
    /// Grand total minus amount paid.
    pub balance_due: f64,
    /// "paid", "partial" or "unpaid".
    pub payment_status: String,
    pub items: Vec<PurchaseItem>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreateSupplierPaymentInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supplier_id: Option<i64>,
    pub amount: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_date: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SupplierPayment {
    pub id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supplier_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supplier_name: Option<String>,
    pub amount: f64,
    pub payment_method: String,
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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SupplierBalance {
    pub supplier_id: i64,
    pub supplier_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    /// Amount owed from purchases (Σ purchases total_amount).
    pub total_purchases: f64,
    /// Amount paid to the supplier (completed supplier_payments).
    pub total_paid: f64,
    /// Outstanding balance = total_purchases - total_paid.
    pub balance: f64,
    pub payment_count: i64,
}
