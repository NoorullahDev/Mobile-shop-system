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
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import * as backupService from "../services/backupService";
import { useSessionStore } from "../store/session";
import {
  parseBackupTime,
  formatBytes,
} from "../types/backup";
import type { Backup } from "../types/backup";

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBackups(await backupService.listBackups());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const created = await backupService.createBackup(actor);
      setMessage(`Backup created: ${created.file_name}`);
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

  const totalSize = backups.reduce((s, b) => s + b.size, 0);
  const lastBackup = backups[0] ?? null;

  return (
    <div>
      <PageHeader
        title="Backup Manager"
        description="Protect your data with database backups and safe restore"
        breadcrumb={[{ label: "System" }, { label: "Backups" }]}
        meta={lastBackup ? `Last backup: ${lastBackup.file_name}` : undefined}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={load} icon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              loading={creating}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              {creating ? "Creating..." : "Create Backup"}
            </Button>
          </div>
        }
      />

      {error && <div className="mb-4"><Alert message={error} variant="error" /></div>}
      {message && <div className="mb-4"><Alert message={message} variant="success" /></div>}

      <div className="mb-4">
        <Alert
          variant="info"
          title="Restore safety"
          message="Restoring replaces all current data. An automatic safety backup of your current data is made before every restore."
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Total Backups"
          value={String(backups.length)}
          icon={Archive}
          tone="primary"
          sub="stored on this device"
        />
        <KpiCard
          title="Storage Used"
          value={formatBytes(totalSize)}
          icon={HardDrive}
          tone="navy"
          sub="total backup size"
        />
        <KpiCard
          title="Last Backup"
          value={lastBackup ? parseBackupTime(lastBackup.created_at).toLocaleString("en-PK", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          }) : "—"}
          icon={DatabaseBackup}
          tone={lastBackup?.status === "success" ? "green" : "amber"}
          sub={lastBackup ? lastBackup.file_name : "no backups yet"}
        />
      </div>

      {/* List */}
      <div className="mt-4">
        <Card title="Saved Backups" subtitle={`${backups.length} stored`} noPadding>
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
                      <StatusBadge status={b.backup_type === "full" ? "full" : "database"} />
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

      {/* Restore confirmation */}
      <Modal
        open={restoreTarget !== null}
        title="Confirm Restore"
        subtitle="This action is irreversible"
        onClose={() => setRestoreTarget(null)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRestoreTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleRestore} loading={restoring}>
              {restoring ? "Restoring..." : "Yes, Restore"}
            </Button>
          </>
        }
      >
        <Alert
          variant="error"
          title="All current data will be replaced"
          message={`Your database will be overwritten with the backup "${restoreTarget?.file_name}". This cannot be undone. A safety backup of your current data is saved first.`}
        />
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