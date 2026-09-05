use std::sync::Mutex;

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rand_core::OsRng;
use sha2::{Digest, Sha256};

use crate::errors::AppError;
use crate::models::user::SessionUser;

// Public verification key only. The corresponding private key is held by the
// vendor generator and is never compiled into the customer application.
const LICENSE_PUBLIC_KEY_HEX: &str =
    "25b75702d8ea72f2e3d6578859fa4ad5e077a16b8deed396badeb6df2ba4238b";

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

pub fn verify_signature(data: &[u8], signature: &[u8]) -> bool {
    let Ok(bytes) = hex::decode(LICENSE_PUBLIC_KEY_HEX) else {
        return false;
    };
    let Ok(key_bytes) = <[u8; 32]>::try_from(bytes.as_slice()) else {
        return false;
    };
    let Ok(key) = VerifyingKey::from_bytes(&key_bytes) else {
        return false;
    };
    let Ok(sig) = Signature::from_slice(signature) else {
        return false;
    };
    if key.verify(data, &sig).is_ok() {
        return true;
    }
    #[cfg(test)]
    {
        let test = hex::decode("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a")
            .unwrap();
        let test: [u8; 32] = test.try_into().unwrap();
        return VerifyingKey::from_bytes(&test)
            .map(|k| k.verify(data, &sig).is_ok())
            .unwrap_or(false);
    }
    #[cfg(not(test))]
    false
}

// ---- Hardware ID ----

/// Reads the Windows MachineGuid from the registry.
/// Falls back to the computer name environment variable if unavailable.
#[cfg(target_os = "windows")]
fn read_machine_raw() -> String {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let mut values = Vec::new();
    if let Ok(key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Cryptography") {
        if let Ok(guid) = key.get_value::<String, _>("MachineGuid") {
            if !guid.trim().is_empty() {
                values.push(format!("GUID={}", guid.trim().to_uppercase()));
            }
        }
    }
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let script = "$c=Get-CimInstance Win32_ComputerSystemProduct -ErrorAction SilentlyContinue; $b=Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue; $m=Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue; @($c.UUID,$b.SerialNumber,$m.SerialNumber) -join '|'";
    if let Ok(output) = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        if output.status.success() {
            let stable = String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_uppercase();
            for (i, value) in stable.split('|').enumerate() {
                let v = value.trim();
                if !v.is_empty() && v != "TO BE FILLED BY O.E.M." && v != "DEFAULT STRING" {
                    values.push(format!("WMI{i}={v}"));
                }
            }
        }
    }
    if values.is_empty() {
        values.push(format!(
            "HOST={}",
            std::env::var("COMPUTERNAME").unwrap_or_else(|_| "UNKNOWN-PC".into())
        ));
    }
    values.join("|")
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
/// Available stable identifiers are normalized, combined and SHA-256 hashed.
pub fn get_hardware_id() -> String {
    let raw = read_machine_raw();
    let hash = Sha256::digest(raw.as_bytes());
    // Take first 8 bytes → 16 hex chars → group as XXXX-XXXX-XXXX-XXXX
    let hex_str: String = hash[..8].iter().map(|b| format!("{b:02X}")).collect();
    format!(
        "{}-{}-{}-{}",
        &hex_str[0..4],
        &hex_str[4..8],
        &hex_str[8..12],
        &hex_str[12..16]
    )
}

pub fn seal_local_license_state(value: &str, hardware_id: &str) -> String {
    hex::encode(Sha256::digest(
        format!("MSP-LICENSE-STATE-V2|{hardware_id}|{value}").as_bytes(),
    ))
}

// ---- Protected local license clock ----

#[cfg(all(target_os = "windows", not(test)))]
mod protected_clock {
    use std::ffi::c_void;
    use std::ptr::{null, null_mut};

    use winreg::enums::{HKEY_CURRENT_USER, REG_BINARY};
    use winreg::{RegKey, RegValue};

    use crate::errors::AppError;

    const REGISTRY_PATH: &str = "Software\\EagleNestMobileShop";
    const REGISTRY_VALUE: &str = "LicenseClockStateV2";
    const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;

    #[repr(C)]
    struct DataBlob {
        length: u32,
        data: *mut u8,
    }

    #[link(name = "crypt32")]
    extern "system" {
        fn CryptProtectData(
            input: *mut DataBlob,
            description: *const u16,
            entropy: *mut DataBlob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            output: *mut DataBlob,
        ) -> i32;
        fn CryptUnprotectData(
            input: *mut DataBlob,
            description: *mut *mut u16,
            entropy: *mut DataBlob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            output: *mut DataBlob,
        ) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn LocalFree(memory: *mut c_void) -> *mut c_void;
    }

    fn blob(bytes: &mut [u8]) -> DataBlob {
        DataBlob {
            length: bytes.len() as u32,
            data: bytes.as_mut_ptr(),
        }
    }

    fn protect(value: &[u8], hardware_id: &str) -> Result<Vec<u8>, AppError> {
        let mut input_bytes = value.to_vec();
        let mut entropy_bytes = format!("EagleNest-License-Clock-V2|{hardware_id}").into_bytes();
        let mut input = blob(&mut input_bytes);
        let mut entropy = blob(&mut entropy_bytes);
        let mut output = DataBlob {
            length: 0,
            data: null_mut(),
        };
        let ok = unsafe {
            CryptProtectData(
                &mut input,
                null(),
                &mut entropy,
                null_mut(),
                null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        };
        if ok == 0 || output.data.is_null() {
            return Err(AppError::Internal(
                "Windows could not protect the license clock state".into(),
            ));
        }
        let result =
            unsafe { std::slice::from_raw_parts(output.data, output.length as usize).to_vec() };
        unsafe { LocalFree(output.data.cast()) };
        Ok(result)
    }

    fn unprotect(value: &[u8], hardware_id: &str) -> Result<Vec<u8>, AppError> {
        let mut input_bytes = value.to_vec();
        let mut entropy_bytes = format!("EagleNest-License-Clock-V2|{hardware_id}").into_bytes();
        let mut input = blob(&mut input_bytes);
        let mut entropy = blob(&mut entropy_bytes);
        let mut output = DataBlob {
            length: 0,
            data: null_mut(),
        };
        let ok = unsafe {
            CryptUnprotectData(
                &mut input,
                null_mut(),
                &mut entropy,
                null_mut(),
                null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        };
        if ok == 0 || output.data.is_null() {
            return Err(AppError::validation(
                "Protected license clock state is invalid or belongs to another Windows user",
            ));
        }
        let result =
            unsafe { std::slice::from_raw_parts(output.data, output.length as usize).to_vec() };
        unsafe { LocalFree(output.data.cast()) };
        Ok(result)
    }

    pub fn save(value: &str, hardware_id: &str) -> Result<(), AppError> {
        let encrypted = protect(value.as_bytes(), hardware_id)?;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = hkcu.create_subkey(REGISTRY_PATH).map_err(|e| {
            AppError::Internal(format!("Could not open protected license storage: {e}"))
        })?;
        key.set_raw_value(
            REGISTRY_VALUE,
            &RegValue {
                bytes: encrypted,
                vtype: REG_BINARY,
            },
        )
        .map_err(|e| {
            AppError::Internal(format!("Could not save protected license clock state: {e}"))
        })
    }

    pub fn load(hardware_id: &str) -> Result<Option<String>, AppError> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let key = match hkcu.open_subkey(REGISTRY_PATH) {
            Ok(key) => key,
            Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => {
                return Err(AppError::Internal(format!(
                    "Could not open protected license storage: {e}"
                )))
            }
        };
        let stored = match key.get_raw_value(REGISTRY_VALUE) {
            Ok(value) => value,
            Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => {
                return Err(AppError::Internal(format!(
                    "Could not read protected license clock state: {e}"
                )))
            }
        };
        if stored.vtype != REG_BINARY {
            return Err(AppError::validation(
                "Protected license clock state has an invalid format",
            ));
        }
        let plain = unprotect(&stored.bytes, hardware_id)?;
        String::from_utf8(plain)
            .map(Some)
            .map_err(|_| AppError::validation("Protected license clock state is malformed"))
    }

    pub fn clear() -> Result<(), AppError> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let key = match hkcu.open_subkey_with_flags(REGISTRY_PATH, winreg::enums::KEY_SET_VALUE) {
            Ok(key) => key,
            Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(e) => {
                return Err(AppError::Internal(format!(
                    "Could not open protected license storage: {e}"
                )))
            }
        };
        match key.delete_value(REGISTRY_VALUE) {
            Ok(()) => Ok(()),
            Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(AppError::Internal(format!(
                "Could not clear protected license clock state: {e}"
            ))),
        }
    }
}

#[cfg(all(target_os = "windows", not(test)))]
pub use protected_clock::{
    clear as clear_protected_license_time, load as load_protected_license_time,
    save as save_protected_license_time,
};

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
