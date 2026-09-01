import { useCallback, useEffect, useMemo, useState } from "react";
import { BellOff, CheckCheck, RefreshCw, Trash2, Inbox } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Select } from "../components/Select";
import { EmptyState } from "../components/EmptyState";
import { Alert } from "../components/Alert";
import * as notificationService from "../services/notificationService";
import { parseTimestamp } from "../types/notification";
import type { AppNotification, NotificationKind, NotificationPriority } from "../types/notification";
import { formatDateTime } from "../lib/format";

const KIND_FILTERS = [
  { value: "all", label: "All types" },
  { value: "general", label: "General" },
  { value: "member", label: "Customers" },
  { value: "finance", label: "Finance" },
  { value: "system", label: "System" },
  { value: "security", label: "Security" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All status" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  low: "#64748B",
  normal: "#3B6FD4",
  high: "#D97706",
  critical: "#DC2626",
};

const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
};

const KIND_LABELS: Record<NotificationKind, string> = {
  general: "General",
  member: "Customers",
  finance: "Finance",
  system: "System",
  security: "Security",
};

const LIMIT_OPTIONS = [
  { value: "25", label: "Last 25" },
  { value: "50", label: "Last 50" },
  { value: "100", label: "Last 100" },
];

export function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState("50");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [markAllBusy, setMarkAllBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await notificationService.listNotifications(false, Number(limit)));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (kind !== "all" && n.kind !== kind) return false;
      if (status === "unread" && n.is_read) return false;
      if (status === "read" && !n.is_read) return false;
      return true;
    });
  }, [items, kind, status]);

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  const handleMarkRead = async (id: number) => {
    setBusyId(id);
    try {
      await notificationService.markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAll = async () => {
    setMarkAllBusy(true);
    try {
      await notificationService.markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at ?? new Date().toISOString() })));
    } catch (e) {
      setError(String(e));
    } finally {
      setMarkAllBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    setBusyId(id);
    try {
      await notificationService.deleteNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleClearRead = async () => {
    setBusyId(-1);
    try {
      await notificationService.clearReadNotifications();
      setItems((prev) => prev.filter((n) => !n.is_read));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="View and manage your in-app notifications"
        breadcrumb={[{ label: "System" }, { label: "Notifications" }]}
        meta={unreadCount > 0 ? `${unreadCount} unread` : "All read"}
        actions={
          <Button size="sm" variant="secondary" onClick={load} icon={<RefreshCw className="h-3.5 w-3.5" />}>
            Refresh
          </Button>
        }
      />

      {error && <div className="mb-4"><Alert message={error} variant="error" /></div>}

      <Card
        title="Notification Center"
        subtitle={`${filtered.length} shown${unreadCount > 0 ? ` · ${unreadCount} unread` : ""}`}
        noPadding
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              options={KIND_FILTERS}
              className="w-36"
            />
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={STATUS_FILTERS}
              className="w-32"
            />
            <Select
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              options={LIMIT_OPTIONS}
              className="w-28"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleMarkAll}
              loading={markAllBusy}
              disabled={unreadCount === 0}
              icon={<CheckCheck className="h-3.5 w-3.5" />}
            >
              Mark all read
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleClearRead}
              disabled={unreadCount === items.length}
              icon={<Trash2 className="h-3.5 w-3.5" />}
            >
              Clear read
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: "#64748B" }}>
            Loading notifications...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Inbox}
              title="No notifications"
              description="Notifications from the system will appear here."
            />
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
            {filtered.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-3 px-4 py-3"
                style={{ background: n.is_read ? "transparent" : "#EFF6FF" }}
              >
                <span
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: n.is_read ? "#CBD5E1" : PRIORITY_COLORS[n.priority] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-semibold" style={{ color: "#0F172A" }}>
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[12px]" style={{ color: "#94A3B8" }}>
                      {formatDateTime(parseTimestamp(n.created_at))}
                    </span>
                  </div>
                  {n.message && (
                    <p className="mt-0.5 text-[13px]" style={{ color: "#475569" }}>
                      {n.message}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ background: "#F1F5F9", color: "#475569" }}
                    >
                      {KIND_LABELS[n.kind] ?? n.kind}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ background: "#FEF3C7", color: "#92400E" }}
                    >
                      {PRIORITY_LABELS[n.priority] ?? n.priority}
                    </span>
                    {n.is_read && (
                      <span className="text-[11px]" style={{ color: "#94A3B8" }}>
                        Read {n.read_at ? `· ${formatDateTime(parseTimestamp(n.read_at))}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!n.is_read && (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => handleMarkRead(n.id)}
                      disabled={busyId === n.id}
                      icon={<CheckCheck className="h-3.5 w-3.5" />}
                    >
                      Read
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => handleDelete(n.id)}
                    disabled={busyId === n.id}
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-center gap-2 text-[12px]" style={{ color: "#94A3B8" }}>
        <BellOff className="h-3.5 w-3.5" />
        You only see your own notifications. Critical alerts are always shown in the header.
      </div>
    </div>
  );
}