use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StaffMember {
    pub id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    pub name: String,
    pub phone: String,
    pub position: String,
    pub joining_date: String,
    pub monthly_salary: f64,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub is_deleted: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct StaffInput {
    pub user_id: Option<i64>,
    pub name: String,
    pub phone: String,
    pub position: String,
    pub joining_date: String,
    pub monthly_salary: f64,
    pub status: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SalaryRecord {
    pub id: i64,
    pub staff_id: i64,
    pub staff_name: String,
    pub salary_month: String,
    pub base_salary: f64,
    pub bonus: f64,
    pub deduction: f64,
    pub net_salary: f64,
    pub amount_paid: f64,
    pub remaining_balance: f64,
    pub payment_status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expense_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
    pub is_deleted: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct SalaryInput {
    pub staff_id: i64,
    pub salary_month: String,
    pub base_salary: f64,
    pub bonus: Option<f64>,
    pub deduction: Option<f64>,
    pub amount_paid: f64,
    pub payment_date: Option<String>,
    pub payment_time: Option<String>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
}
