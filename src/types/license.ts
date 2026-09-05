export interface LicenseStatus {
  activated: boolean;
  customer: string | null;
  granted_days: number;
  activated_at: string | null;
  activated_until: string | null;
  remaining_days: number;
  signature_valid: boolean;
  activated_on: string | null;
  /** Hardware ID of this machine (always present). */
  hardware_id: string;
  /** True when the license was once active but has now expired. */
  expired: boolean;
  invalid: boolean;
  clock_rollback_detected: boolean;
}

export interface ActivateLicenseInput {
  key: string;
}
