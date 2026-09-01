import { invoke } from "@tauri-apps/api/core";
import type { Backup } from "../types/backup";

export async function createBackup(actor?: number | null): Promise<Backup> {
  return invoke<Backup>("create_backup", { actor: actor ?? null });
}

export async function listBackups(): Promise<Backup[]> {
  return invoke<Backup[]>("list_backups");
}

export async function getBackup(id: number): Promise<Backup | null> {
  return invoke<Backup | null>("get_backup", { id });
}

export async function verifyBackup(id: number): Promise<void> {
  return invoke<void>("verify_backup", { id });
}

export async function deleteBackup(id: number, actor?: number | null): Promise<void> {
  return invoke<void>("delete_backup", { id, actor: actor ?? null });
}

export async function restoreBackup(id: number, actor?: number | null): Promise<void> {
  return invoke<void>("restore_backup", { id, actor: actor ?? null });
}