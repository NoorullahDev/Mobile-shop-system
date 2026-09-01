use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("A database error occurred: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Invalid input: {0}")]
    Validation(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("Authentication failed: {0}")]
    Authentication(String),
    #[error("File error: {0}")]
    File(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

impl AppError {
    pub fn validation(msg: impl Into<String>) -> Self {
        AppError::Validation(msg.into())
    }

    pub fn file(msg: impl Into<String>) -> Self {
        AppError::File(msg.into())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let msg = self.to_string();
        serializer.serialize_str(&msg)
    }
}
