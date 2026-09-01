use serde::{Deserialize, Serialize};

/// Snapshot of the license state exposed to the frontend.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LicenseStatus {
    /// Whether a valid license key has been activated.
    pub activated: bool,
    /// Customer / shop name the license was issued to.
    pub customer: Option<String>,
    /// Total days granted by the license key.
    pub granted_days: i64,
    /// UTC timestamp of activation (stored as ISO 8601).
    pub activated_at: Option<String>,
    /// UTC timestamp when the license expires.
    pub activated_until: Option<String>,
    /// Whole days left before the offline license expires.
    pub remaining_days: i64,
    /// Whether the stored key's signature is valid.
    pub signature_valid: bool,
    /// Day the license was activated (yyyy-mm-dd helper).
    pub activated_on: Option<String>,
    /// Hardware ID of this machine (always present).
    pub hardware_id: String,
    /// Whether the license has expired (remaining_days == 0 and was activated).
    pub expired: bool,
}

/// Input for activating a license key.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ActivateLicenseInput {
    pub key: String,
}

/// Serialized payload embedded inside a generated activation key.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LicensePayload {
    pub customer: String,
    pub days: i64,
    pub issued_at: String,
    /// Hardware ID of the machine this key was generated for.
    pub hardware_id: String,
}