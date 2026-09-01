use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Setting {
    pub id: i64,
    pub key: String,
    pub value: Option<String>,
}
