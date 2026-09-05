use rusqlite::Connection;

use crate::errors::AppError;
use crate::models::license::{ActivateLicenseInput, LicensePayload, LicenseStatus};
use crate::repositories::license_repository;
use crate::security;
use crate::services;
use ed25519_dalek::{Signer, SigningKey};

/// Keys look like: MSP-<payload-hex>.<signature-hex>
const KEY_PREFIX: &str = "MSP2-";

/// Generates a signed activation key bound to the given hardware_id.
/// `hardware_id` must be the value returned by `security::get_hardware_id()` on
/// the target machine. Intended for the vendor key-generation tooling and tests.
pub fn generate_key(customer: &str, days: i64, hardware_id: &str) -> Result<String, AppError> {
    let secret = std::env::var("MOBILE_SHOP_LICENSE_PRIVATE_KEY")
        .ok().or_else(|| std::fs::read_to_string("license-private.key").ok())
        .ok_or_else(|| AppError::validation("Vendor private key not found. Set MOBILE_SHOP_LICENSE_PRIVATE_KEY or place license-private.key beside the generator"))?;
    generate_key_with_secret(customer, days, hardware_id, secret.trim())
}

fn generate_key_with_secret(customer: &str, days: i64, hardware_id: &str, secret_hex: &str) -> Result<String, AppError> {
    if customer.trim().is_empty() {
        return Err(AppError::validation("Customer name cannot be blank"));
    }
    if days <= 0 || days > 3650 {
        return Err(AppError::validation("Granted days must be between 1 and 3650"));
    }
    if hardware_id.trim().is_empty() {
        return Err(AppError::validation("Hardware ID cannot be blank"));
    }
    let issued = chrono::Utc::now();
    let payload = LicensePayload {
        customer: customer.trim().to_string(),
        days,
        issued_at: issued.to_rfc3339(),
        expires_at: (issued + chrono::Duration::days(days)).to_rfc3339(),
        hardware_id: hardware_id.trim().to_string(),
    };
    let body = serde_json::to_string(&payload)
        .map_err(|e| AppError::Internal(format!("Failed to encode license payload: {e}")))?;
    let body_hex = hex::encode(body.as_bytes());
    let secret = hex::decode(secret_hex).map_err(|_| AppError::validation("Vendor private key must be 64 hexadecimal characters"))?;
    let secret: [u8;32] = secret.try_into().map_err(|_| AppError::validation("Vendor private key must be 32 bytes"))?;
    let sig_hex = hex::encode(SigningKey::from_bytes(&secret).sign(body.as_bytes()).to_bytes());
    Ok(format!("{KEY_PREFIX}{body_hex}.{sig_hex}"))
}

/// Parses and verifies a raw key, returning its payload when valid.
pub fn parse_key(key: &str) -> Result<LicensePayload, AppError> {
    let trimmed = key.trim();
    let without_prefix = trimmed
        .strip_prefix(KEY_PREFIX)
        .ok_or_else(|| AppError::validation("Invalid activation key format"))?;
    let (body_hex, sig_hex) = without_prefix
        .split_once('.')
        .ok_or_else(|| AppError::validation("Invalid activation key format"))?;
    if body_hex.len() % 2 != 0 || sig_hex.len() != 128 {
        return Err(AppError::validation("Invalid activation key format"));
    }
    let body_bytes = hex::decode(body_hex)
        .map_err(|_| AppError::validation("Invalid activation key payload"))?;
    let sig_bytes = hex::decode(sig_hex)
        .map_err(|_| AppError::validation("Invalid activation key signature"))?;
    if !security::verify_signature(&body_bytes, &sig_bytes) {
        return Err(AppError::validation("Activation key signature is invalid"));
    }
    let payload: LicensePayload = serde_json::from_slice(&body_bytes)
        .map_err(|_| AppError::validation("Activation key payload is malformed"))?;
    if payload.days <= 0 || payload.days > 3650 {
        return Err(AppError::validation("Activation key grants an invalid duration"));
    }
    if payload.customer.trim().is_empty() {
        return Err(AppError::validation("Activation key has no customer"));
    }
    if payload.hardware_id.trim().is_empty() {
        return Err(AppError::validation(
            "Activation key is missing hardware ID binding — please generate a new key",
        ));
    }
    let issued = chrono::DateTime::parse_from_rfc3339(&payload.issued_at).map_err(|_| AppError::validation("Activation key has an invalid issue date"))?;
    let expiry = chrono::DateTime::parse_from_rfc3339(&payload.expires_at).map_err(|_| AppError::validation("Activation key has an invalid expiry date"))?;
    if expiry <= issued { return Err(AppError::validation("Activation key has an invalid expiry date")); }
    Ok(payload)
}

/// Activates the app from a signed, hardware-bound key.
/// The key's embedded Hardware ID must match this machine's Hardware ID.
pub fn activate(
    conn: &Connection,
    user_id: Option<i64>,
    input: ActivateLicenseInput,
) -> Result<LicenseStatus, AppError> {
    let payload = parse_key(&input.key)?;

    // ── Hardware ID check ────────────────────────────────────────────────────
    let machine_hw_id = security::get_hardware_id();
    if payload.hardware_id.trim().to_uppercase() != machine_hw_id.to_uppercase() {
        return Err(AppError::validation(
            "This license key was generated for a different machine. \
             Please provide the Hardware ID shown on this page to your vendor.",
        ));
    }
    if chrono::DateTime::parse_from_rfc3339(&payload.expires_at).map(|d| d.with_timezone(&chrono::Utc) <= chrono::Utc::now()).unwrap_or(true) {
        return Err(AppError::validation("This license has expired"));
    }

    let activated_at = chrono::Utc::now().to_rfc3339();
    license_repository::save(
        conn,
        input.key.trim(),
        &payload.customer,
        payload.days,
        &activated_at,
    )?;
    license_repository::save_last_valid_time(conn, &activated_at, &security::seal_local_license_state(&activated_at, &machine_hw_id))?;
    services::record_activity(conn, user_id, "license", "activate", None)?;
    status(conn)
}

/// Removes the stored license (used for testing/reactivation flows).
pub fn deactivate(conn: &Connection, user_id: Option<i64>) -> Result<LicenseStatus, AppError> {
    if license_repository::exists(conn)? {
        license_repository::clear(conn)?;
        services::record_activity(conn, user_id, "license", "deactivate", None)?;
    }
    status(conn)
}

/// Builds the current license status. Remaining days are anchored to the stored
/// activation timestamp so moving the clock back cannot extend the license.
pub fn status(conn: &Connection) -> Result<LicenseStatus, AppError> {
    let hardware_id = security::get_hardware_id();

    let Some(stored) = license_repository::get(conn)? else {
        return Ok(LicenseStatus {
            activated: false,
            customer: None,
            granted_days: 0,
            activated_at: None,
            activated_until: None,
            remaining_days: 0,
            signature_valid: true,
            activated_on: None,
            hardware_id,
            expired: false,
            invalid: false,
            clock_rollback_detected: false,
        });
    };

    let parsed = parse_key(&stored.key).ok();
    let signature_valid = parsed.as_ref().map(|p| p.hardware_id.eq_ignore_ascii_case(&hardware_id)).unwrap_or(false);

    let activated_at = chrono::DateTime::parse_from_rfc3339(&stored.activated_at)
        .map(|d| d.with_timezone(&chrono::Utc))
        .ok();

    let activated_until = parsed.as_ref().and_then(|p| chrono::DateTime::parse_from_rfc3339(&p.expires_at).ok()).map(|d|d.with_timezone(&chrono::Utc));

    let now = chrono::Utc::now();
    let mut clock_rollback_detected = false;
    if let Some((last, seal)) = license_repository::get_last_valid_time(conn)? {
        let seal_ok = seal == security::seal_local_license_state(&last, &hardware_id);
        let last_time = chrono::DateTime::parse_from_rfc3339(&last).ok().map(|d| d.with_timezone(&chrono::Utc));
        clock_rollback_detected = !seal_ok || last_time.map(|t| now < t - chrono::Duration::minutes(5)).unwrap_or(true);
    }
    if !clock_rollback_detected {
        let current = now.to_rfc3339();
        license_repository::save_last_valid_time(conn, &current, &security::seal_local_license_state(&current, &hardware_id))?;
    }
    let remaining_days = activated_until.map(|e| {
        let seconds = (e - now).num_seconds();
        if seconds <= 0 { 0 } else { (seconds + 86_399) / 86_400 }
    }).unwrap_or(0);

    let customer = parsed.as_ref().map(|p| p.customer.clone()).unwrap_or(stored.customer);
    let granted_days = parsed.as_ref().map(|p| p.days).unwrap_or(stored.granted_days);
    let is_activated = !customer.trim().is_empty() && granted_days > 0;
    let expired = is_activated && activated_until.map(|e| e <= now).unwrap_or(true);

    Ok(LicenseStatus {
        activated: is_activated && !expired && signature_valid && !clock_rollback_detected,
        customer: Some(customer),
        granted_days,
        activated_at: activated_at.map(|d| d.to_rfc3339()),
        activated_until: activated_until.map(|d| d.to_rfc3339()),
        remaining_days,
        signature_valid,
        activated_on: activated_at.map(|d| d.format("%Y-%m-%d").to_string()),
        hardware_id,
        expired,
        invalid: !signature_valid || clock_rollback_detected,
        clock_rollback_detected,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_utils::in_memory_conn;

    fn local_hw_id() -> String {
        security::get_hardware_id()
    }
    const TEST_SECRET: &str = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
    fn test_key(customer: &str, days: i64, hardware_id: &str) -> Result<String, AppError> {
        generate_key_with_secret(customer, days, hardware_id, TEST_SECRET)
    }

    #[test]
    fn generated_key_round_trips() {
        let hw = local_hw_id();
        let key = test_key("Al-Haseeb Mobile", 365, &hw).unwrap();
        assert!(key.starts_with(KEY_PREFIX));
        let payload = parse_key(&key).unwrap();
        assert_eq!(payload.customer, "Al-Haseeb Mobile");
        assert_eq!(payload.days, 365);
        assert_eq!(payload.hardware_id, hw);
    }

    #[test]
    fn tampered_key_rejected() {
        let hw = local_hw_id();
        let key = test_key("Shop A", 30, &hw).unwrap();
        let mut chars: Vec<char> = key.chars().collect();
        let mid = chars.len() / 2;
        chars[mid] = if chars[mid] == 'a' { 'b' } else { 'a' };
        assert!(parse_key(&chars.into_iter().collect::<String>()).is_err());
    }

    #[test]
    fn garbage_key_rejected() {
        assert!(parse_key("MSP-not.a.key").is_err());
        assert!(parse_key("").is_err());
        assert!(parse_key("MSP-zz..zz").is_err());
    }

    #[test]
    fn activate_sets_status_and_deactivate_clears() {
        let conn = in_memory_conn();
        let hw = local_hw_id();
        let key = test_key("Shop B", 90, &hw).unwrap();
        let s = activate(&conn, Some(1), ActivateLicenseInput { key }).unwrap();
        assert!(s.activated);
        assert_eq!(s.customer.as_deref(), Some("Shop B"));
        assert_eq!(s.granted_days, 90);
        assert!(s.remaining_days > 0);
        assert!(s.activated_at.is_some());
        assert!(s.activated_until.is_some());
        assert!(!s.expired);

        let d = deactivate(&conn, Some(1)).unwrap();
        assert!(!d.activated);
        assert_eq!(d.remaining_days, 0);
    }

    #[test]
    fn invalid_key_activation_fails() {
        let conn = in_memory_conn();
        assert!(
            activate(&conn, Some(1), ActivateLicenseInput { key: "MSP-bad.key".into() })
                .is_err()
        );
    }

    #[test]
    fn wrong_hardware_id_rejected() {
        let conn = in_memory_conn();
        let key = test_key("Shop C", 30, "DEAD-BEEF-CAFE-BABE").unwrap();
        let err = activate(&conn, Some(1), ActivateLicenseInput { key }).unwrap_err();
        assert!(err.to_string().contains("different machine"));
    }

    #[test]
    fn generator_validates_inputs() {
        assert!(generate_key_with_secret("", 30, "XXXX-XXXX-XXXX-XXXX", TEST_SECRET).is_err());
        assert!(generate_key_with_secret("Shop", 0, "XXXX-XXXX-XXXX-XXXX", TEST_SECRET).is_err());
        assert!(generate_key_with_secret("Shop", 5000, "XXXX-XXXX-XXXX-XXXX", TEST_SECRET).is_err());
        assert!(generate_key_with_secret("Shop", 30, "", TEST_SECRET).is_err());
    }
}
