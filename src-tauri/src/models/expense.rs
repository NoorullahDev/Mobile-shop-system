use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub category_type: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreateCategoryInput {
    pub name: String,
    #[serde(rename = "type")]
    pub category_type: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Expense {
    pub id: i64,
    pub category_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_name: Option<String>,
    pub amount: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub receipt_path: Option<String>,
    pub expense_date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<i64>,
    pub created_at: String,
    pub is_deleted: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CreateExpenseInput {
    pub category_id: i64,
    pub amount: f64,
    pub description: Option<String>,
    pub receipt_path: Option<String>,
    pub expense_date: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CategoryTotal {
    pub category_id: i64,
    pub category_name: String,
    pub total: f64,
    pub count: i64,
}
