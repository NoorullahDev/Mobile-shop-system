use std::sync::Mutex;

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use hmac::{Hmac, Mac};
use rand_core::OsRng;
use sha2::Sha256;

use crate::errors::AppError;
use crate::models::user::SessionUser;

/// Secret embedded in the binary used to sign activation keys.
/// Replace with your own value for production builds.
const LICENSE_SECRET: &[u8] = b"mobile-shop-pro-license-v1";

/// Salt used when deriving the public Hardware ID from the raw machine identifier.
const HW_ID_SALT: &[u8] = b"mobile-shop-pro-hwid-v1";

type HmacSha256 = Hmac<Sha256>;

/// Holds the authenticated session for the single desktop application.
#[derive(Default)]
pub struct SessionState(pub Mutex<Option<SessionUser>>);

pub fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("Failed to hash password: {e}")))?
        .to_string();
    Ok(hash)
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    let parsed = PasswordHash::new(hash)
        .map_err(|e| AppError::Internal(format!("Invalid stored hash: {e}")))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

/// HMAC-SHA256 signature over `data`. Used to sign activation keys.
pub fn sign(data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(LICENSE_SECRET)
        .expect("HMAC accepts any key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

/// Constant-time comparison of a signature against the recomputed HMAC.
pub fn verify_signature(data: &[u8], signature: &[u8]) -> bool {
    let expected = sign(data);
    if expected.len() != signature.len() {
        return false;
    }
    let mut diff = 0u8;
    for (a, b) in expected.iter().zip(signature.iter()) {
        diff |= a ^ b;
    }
    diff == 0
}

// ---- Hardware ID ----

/// Reads the Windows MachineGuid from the registry.
/// Falls back to the computer name environment variable if unavailable.
#[cfg(target_os = "windows")]
fn read_machine_raw() -> String {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Cryptography") {
        if let Ok(guid) = key.get_value::<String, _>("MachineGuid") {
            if !guid.trim().is_empty() {
                return guid.trim().to_uppercase();
            }
        }
    }
    // Fallback: computer name (still unique per machine)
    std::env::var("COMPUTERNAME").unwrap_or_else(|_| "UNKNOWN-PC".to_string())
}

/// Non-Windows fallback (hostname based).
#[cfg(not(target_os = "windows"))]
fn read_machine_raw() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "UNKNOWN-PC".to_string())
}

/// Returns a stable, unique Hardware ID for this machine, formatted as
/// `XXXX-XXXX-XXXX-XXXX` (16 uppercase hex chars in groups of 4).
///
/// The raw machine identifier is HMAC-hashed with a fixed app salt so the
/// display value is non-reversible.
pub fn get_hardware_id() -> String {
    let raw = read_machine_raw();
    let mut mac = HmacSha256::new_from_slice(HW_ID_SALT)
        .expect("HMAC accepts any key length");
    mac.update(raw.as_bytes());
    let hash = mac.finalize().into_bytes();
    // Take first 8 bytes → 16 hex chars → group as XXXX-XXXX-XXXX-XXXX
    let hex_str: String = hash[..8]
        .iter()
        .map(|b| format!("{b:02X}"))
        .collect();
    format!(
        "{}-{}-{}-{}",
        &hex_str[0..4],
        &hex_str[4..8],
        &hex_str[8..12],
        &hex_str[12..16]
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_and_verifies_password() {
        let hash = hash_password("Secret123!").expect("hash");
        assert!(verify_password("Secret123!", &hash).expect("verify"));
        assert!(!verify_password("wrong", &hash).expect("verify wrong"));
    }

    #[test]
    fn hardware_id_is_stable_and_formatted() {
        let id1 = get_hardware_id();
        let id2 = get_hardware_id();
        assert_eq!(id1, id2, "Hardware ID must be deterministic");
        // Format: XXXX-XXXX-XXXX-XXXX  (4 groups of 4 hex chars)
        let parts: Vec<&str> = id1.split('-').collect();
        assert_eq!(parts.len(), 4);
        for part in &parts {
            assert_eq!(part.len(), 4);
            assert!(part.chars().all(|c| c.is_ascii_hexdigit()));
        }
    }
}
