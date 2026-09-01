import { invoke } from "@tauri-apps/api/core";
import type { ActivityLog, Setting } from "../types/settings";

export async function getAllSettings(): Promise<Setting[]> {
  return invoke<Setting[]>("get_all_settings");
}

export async function updateSetting(
  key: string,
  value: string,
  actor?: number | null,
): Promise<void> {
  return invoke<void>("update_setting", { key, value, actor: actor ?? null });
}

export async function listActivityLogs(limit?: number | null): Promise<ActivityLog[]> {
  return invoke<ActivityLog[]>("list_activity_logs", { limit: limit ?? null });
}
