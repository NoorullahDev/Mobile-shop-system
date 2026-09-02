import { useCallback, useEffect, useState } from "react";
import {
  DatabaseBackup,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Archive,
  HardDrive,
  CalendarClock,
  Save,
  FolderOpen,
  ToggleLeft,
  ToggleRight,
  RefreshCcw,
  FolderInput,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import { Select } from "../components/Select";
import { Input } from "../components/Input";
import * as backupService from "../services/backupService";
import { useSessionStore } from "../store/session";
import {
  parseBackupTime,
  formatBytes,
} from "../types/backup";
import type { Backup, BackupStatusInfo } from "../types/backup";

export function BackupManagerPage() {
  const actor = useSessionStore((s) => s.user?.id ?? null);

  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Backup | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [status, setStatus] = useState<BackupStatusInfo | null>(null);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [autoInterval, setAutoInterval] = useState<number>(30);
  const [backupFrequency, setBackupFrequency] = useState<string>("30");
  const [customInterval, setCustomInterval] = useState<number>(45);
  const [savingConfig, setSavingConfig] = useState(false);

  // File-picker restore path (chosen from Desktop/Software Backup)
  const [fileRestoreTarget, setFileRestoreTarget] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, info] = await Promise.all([
        backupService.listBackups(),
        backupService.getBackupStatus(),
      ]);
      setBackups(list);
      setStatus(info);
      setAutoEnabled(info.config.auto_backup_enabled);
      setAutoInterval(info.config.auto_backup_interval_minutes);
      setBackupFrequency(info.config.backup_frequency ?? "30");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setError(null);
    setMessage(null);
    try {
      const interval =
        backupFrequency === "custom"
          ? customInterval
          : backupFrequency === "every_time"
          ? autoInterval
          : Number(backupFrequency);
      const cfg = await backupService.updateBackupConfig(
        {
          auto_backup_enabled: autoEnabled,
          auto_backup_interval_minutes: interval,
          backup_frequency: backupFrequency,
        },
        actor,
      );
      setStatus((prev) => (prev ? { ...prev, config: cfg } : prev));
      setAutoInterval(cfg.auto_backup_interval_minutes);
      setMessage("Automatic backup settings saved.");
    } catch (e) {
      setError(String(e));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const created = await backupService.createBackup(actor);
      setMessage(`Manual backup created: ${created.file_name}`);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleVerify = async (b: Backup) => {
    setBusyId(b.id);
    setError(null);
    setMessage(null);
    try {
      await backupService.verifyBackup(b.id);
      setMessage(`Backup verified: ${b.file_name}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    setError(null);
    setMessage(null);
    try {
      await backupService.restoreBackup(restoreTarget.id, actor);
      setMessage("Backup restored successfully.");
      setRestoreTarget(null);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setRestoring(false);
    }
  };

  const handlePickRestore = async () => {
    setPicking(true);
    setError(null);
    setMessage(null);
    try {
      const path = await backupService.pickBackupFile();
      if (path) {
        // Confirm before actually restoring (safety step).
        setFileRestoreTarget(path);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setPicking(false);
    }
  };

  const handleFileRestore = async () => {
    if (!fileRestoreTarget) return;
    setRestoring(true);
    setError(null);
    setMessage(null);
    try {
      await backupService.restoreBackupFromPath(fileRestoreTarget, actor);
      setMessage("Backup restored successfully.");
      setFileRestoreTarget(null);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      await backupService.deleteBackup(deleteTarget.id, actor);
      setMessage("Backup deleted.");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Backup Manager"
        description="Protect your data with automatic and manual backups, plus safe restore"
        breadcrumb={[{ label: "System" }, { label: "Backups" }]}
        meta={status?.last_backup_at ? `Last backup: ${parseBackupTime(status.last_backup_at).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : undefined}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={load} icon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handlePickRestore}
              loading={picking}
              icon={<FolderInput className="h-3.5 w-3.5" />}
            >
              Restore Backup
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              loading={creating}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              {creating ? "Creating..." : "Create Backup Now"}
            </Button>
          </div>
        }
      />

      {error && <div className="mb-4"><Alert message={error} variant="error" /></div>}
      {message && <div className="mb-4"><Alert message={message} variant="success" /></div>}

      <div className="mb-4">
        <Alert
          variant="info"
          title="How backups work"
          message="Backups are saved as .zip archives to your Desktop (Software Backup folder). They include your database, settings, configuration and embedded data. Automatic backups run on your chosen schedule; a backup is also taken automatically whenever you close the app."
        />
      </div>

      {/* Automatic backup settings */}
      <div className="mb-4">
        <Card title="Automatic Backup" subtitle="Schedule recurring backups while the app is running" noPadding>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded border p-4" style={{ borderColor: "#E2E8F0" }}>
              <div>
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" style={{ color: "#3B6FD4" }} />
                  <span className="font-semibold" style={{ fontSize: "13px", color: "#0F172A" }}>
                    Enable automatic backups
                  </span>
                </div>
                <p className="mt-1" style={{ fontSize: "12px", color: "#64748B" }}>
                  {autoEnabled
                    ? "Backups will run automatically on the selected schedule."
                    : "Automatic backups are turned off. You can still create backups manually."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoEnabled((v) => !v)}
                aria-label="Toggle automatic backups"
                style={{ border: "none", background: "none", cursor: "pointer", color: autoEnabled ? "#16A34A" : "#94A3B8" }}
              >
                {autoEnabled ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7" />}
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <Select
                label="Backup frequency"
                value={backupFrequency}
                onChange={(e) => setBackupFrequency(e.target.value)}
                options={[
                  { value: "every_time", label: "Every time" },
                  { value: "10", label: "Every 10 minutes" },
                  { value: "30", label: "Every 30 minutes" },
                  { value: "60", label: "Every 1 hour" },
                  { value: "180", label: "Every 3 hours" },
                  { value: "custom", label: "Custom interval" },
                ]}
                hint="How often automatic backups run."
              />
              {backupFrequency === "custom" && (
                <div>
                  <Input
                    label="Custom interval (minutes)"
                    type="number"
                    min={1}
                    value={customInterval}
                    onChange={(e) => setCustomInterval(Number(e.target.value))}
                    hint={`Backup every ${customInterval} minute${customInterval === 1 ? "" : "s"}.`}
                  />
                </div>
              )}
              {backupFrequency === "every_time" && (
                <p style={{ fontSize: "12px", color: "#64748B" }}>
                  A backup is created automatically each time the app opens, and it is also
                  created automatically whenever the app is closed.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t p-4" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" style={{ color: "#64748B" }} />
              <span style={{ fontSize: "12px", color: "#64748B" }}>
                Backup folder:{" "}
                <span style={{ fontFamily: "monospace", color: "#0F172A" }}>{status?.config.backup_folder ?? "Desktop\\Software Backup"}</span>
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleSaveConfig}
              loading={savingConfig}
              icon={savingConfig ? <RefreshCcw className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            >
              Save Settings
            </Button>
          </div>
        </Card>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Total Backups"
          value={String(status?.total_backups ?? backups.length)}
          icon={Archive}
          tone="primary"
          sub="stored on this device"
        />
        <KpiCard
          title="Storage Used"
          value={formatBytes(backups.reduce((s, b) => s + b.size, 0))}
          icon={HardDrive}
          tone="navy"
          sub="total backup size"
        />
        <KpiCard
          title="Last Backup"
          value={status?.last_backup_at ? parseBackupTime(status.last_backup_at).toLocaleString("en-PK", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          }) : "—"}
          icon={DatabaseBackup}
          tone={backups[0]?.status === "success" ? "green" : "amber"}
          sub={status?.last_backup_file ?? "no backups yet"}
        />
      </div>

      {/* List */}
      <div className="mt-4">
        <Card title="Saved Backups" subtitle={`${backups.length} stored in ${status?.config.backup_folder ?? "backup folder"}`} noPadding>
          {loading ? (
            <div className="py-16 text-center text-[13px]" style={{ color: "#64748B" }}>
              Loading backups...
            </div>
          ) : backups.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={UploadCloud}
                title="No backups yet"
                description="Create your first backup to protect your data."
                action={
                  <Button size="sm" onClick={handleCreate} loading={creating} icon={<Plus className="h-3.5 w-3.5" />}>
                    Create Backup
                  </Button>
                }
              />
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Backup</th>
                  <th>Type</th>
                  <th>Created</th>
                  <th className="text-right">Size</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className="font-semibold" style={{ fontSize: "13px", color: "#0F172A", fontFamily: "monospace" }}>
                        {b.file_name}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={b.file_name.startsWith("Manual_Backup") ? "Manual" : "Automatic"} />
                    </td>
                    <td style={{ color: "#64748B", fontSize: "12px" }}>
                      {parseBackupTime(b.created_at).toLocaleString("en-PK", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="text-right" style={{ color: "#475569", fontSize: "13px" }}>
                      {formatBytes(b.size)}
                    </td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => handleVerify(b)}
                          disabled={busyId === b.id}
                          icon={<ShieldCheck className="h-3.5 w-3.5" />}
                        >
                          Verify
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setRestoreTarget(b)}
                          disabled={busyId === b.id}
                          icon={<UploadCloud className="h-3.5 w-3.5" />}
                        >
                          Restore
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setDeleteTarget(b)}
                          disabled={busyId === b.id}
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Restore confirmation (DB-row or file-picker restore) */}
      <Modal
        open={restoreTarget !== null || fileRestoreTarget !== null}
        title="Confirm Restore"
        subtitle="This action is irreversible"
        onClose={() => {
          setRestoreTarget(null);
          setFileRestoreTarget(null);
        }}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRestoreTarget(null);
                setFileRestoreTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={restoreTarget ? handleRestore : handleFileRestore}
              loading={restoring}
            >
              {restoring ? "Restoring..." : "Restore"}
            </Button>
          </>
        }
      >
        <Alert
          variant="error"
          title="Current data will be replaced"
          message={
            restoreTarget
              ? `"${restoreTarget.file_name}" will overwrite all current data (database, files, settings and configuration). This cannot be undone. Do you want to continue?`
              : "The selected backup will overwrite all current data (database, files, settings and configuration). This cannot be undone. Do you want to continue?"
          }
        />
        {fileRestoreTarget && (
          <p className="mt-3" style={{ fontSize: "12px", color: "#475569", fontFamily: "monospace", wordBreak: "break-all" }}>
            {fileRestoreTarget}
          </p>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={deleteTarget !== null}
        title="Delete Backup"
        subtitle="This cannot be undone"
        onClose={() => setDeleteTarget(null)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
              {deleting ? "Deleting..." : "Delete Backup"}
            </Button>
          </>
        }
      >
        <Alert
          variant="error"
          title="Delete this backup?"
          message={`"${deleteTarget?.file_name}" will be deleted from your device. This cannot be undone.`}
        />
      </Modal>
    </div>
  );
}