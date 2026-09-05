import { invoke } from "@tauri-apps/api/core";
import type {
  Backup,
  BackupConfig,
  BackupStatusInfo,
  UpdateBackupConfigInput,
  BackupModule,
  BackupInspection,
} from "../types/backup";

export async function createBackup(actor?: number | null): Promise<Backup> {
  return invoke<Backup>("create_backup", { actor: actor ?? null });
}

export async function listBackupModules(): Promise<BackupModule[]> { return invoke("list_backup_modules"); }
export async function pickBackupFolder(): Promise<string | null> { return invoke("pick_backup_folder"); }
export async function createSelectiveBackup(modules: string[], folder?: string | null, actor?: number | null): Promise<Backup> {
  return invoke("create_selective_backup", { modules, folder: folder ?? null, actor: actor ?? null });
}
export async function inspectBackup(id?: number | null, file_path?: string | null): Promise<BackupInspection> {
  return invoke("inspect_backup", { id: id ?? null, file_path: file_path ?? null });
}
export async function openBackupFolder(path: string): Promise<void> { return invoke("open_backup_folder", { path }); }

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

export async function pickBackupFile(): Promise<string | null> {
  return invoke<string | null>("pick_backup_file");
}

export async function restoreBackupFromPath(
  file_path: string,
  actor?: number | null,
): Promise<void> {
  return invoke<void>("restore_backup_from_path", {
    file_path,
    actor: actor ?? null,
  });
}

export async function getBackupConfig(): Promise<BackupConfig> {
  return invoke<BackupConfig>("get_backup_config");
}

export async function updateBackupConfig(
  input: UpdateBackupConfigInput,
  actor?: number | null,
): Promise<BackupConfig> {
  return invoke<BackupConfig>("update_backup_config", {
    input,
    actor: actor ?? null,
  });
}

export async function getBackupStatus(): Promise<BackupStatusInfo> {
  return invoke<BackupStatusInfo>("get_backup_status");
}
