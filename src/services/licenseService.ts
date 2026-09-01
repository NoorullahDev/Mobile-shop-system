import { invoke } from "@tauri-apps/api/core";
import type { LicenseStatus } from "../types/license";

export async function getLicenseStatus(): Promise<LicenseStatus> {
  return invoke<LicenseStatus>("get_license_status");
}

export async function activateLicense(
  key: string,
  actor?: number | null,
): Promise<LicenseStatus> {
  return invoke<LicenseStatus>("activate_license", {
    input: { key },
    actor: actor ?? null,
  });
}

export async function deactivateLicense(actor?: number | null): Promise<LicenseStatus> {
  return invoke<LicenseStatus>("deactivate_license", { actor: actor ?? null });
}

export async function getHardwareId(): Promise<string> {
  return invoke<string>("get_hardware_id");
}