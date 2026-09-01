export type BackupType = "full" | "database";
export type BackupStatus = "success" | "failed";

export interface Backup {
  id: number;
  file_name: string;
  backup_type: BackupType;
  file_path: string;
  size: number;
  status: BackupStatus;
  created_by: number | null;
  created_at: string;
}

export function parseBackupTime(input: string): Date {
  return new Date(input.replace(" ", "T") + "Z");
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}