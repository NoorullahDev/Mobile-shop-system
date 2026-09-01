import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, Trash2, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dropdown } from "./Dropdown";
import { Spinner } from "./Button";
import * as notificationService from "../services/notificationService";
import { parseTimestamp } from "../types/notification";
import type { AppNotification } from "../types/notification";

const PRIORITY_COLORS: Record<string, string> = {
  low: "#64748B",
  normal: "#3B6FD4",
  high: "#D97706",
  critical: "#DC2626",
};

const KIND_LABEL: Record<string, string> = {
  general: "General",
  member: "Customers",
  finance: "Finance",
  system: "System",
  security: "Security",
};

function timeAgo(d: Date): string {
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const polling = useRef<number | null>(null);

  const load = useCallback(async (open: boolean) => {
    setLoading(true);
    try {
      const [count, list] = await Promise.all([
        notificationService.getNotificationCount(),
        notificationService.listNotifications(false, 8),
      ]);
      setUnread(count);
      if (open) setItems(list);
    } catch {
      /* silently ignore polling errors */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    polling.current = window.setInterval(() => load(false), 30000);
    return () => {
      if (polling.current !== null) window.clearInterval(polling.current);
    };
  }, [load]);

  const handleOpen = () => load(true);

  const handleMarkRead = async (id: number) => {
    setBusyId(id);
    try {
      await notificationService.markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAll = async () => {
    try {
      await notificationService.markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id: number) => {
    setBusyId(id);
    try {
      await notificationService.deleteNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dropdown
      align="right"
      width="w-96"
      onOpen={handleOpen}
      children={
        <div>
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: "1px solid #E2E8F0" }}
          >
            <span className="text-[13px] font-semibold" style={{ color: "#0F172A" }}>
              Notifications
              {unread > 0 && (
                <span
                  className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: "#DC2626" }}
                >
                  {unread} new
                </span>
              )}
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors hover:bg-slate-100"
                style={{ color: "#3B6FD4" }}
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8" style={{ color: "#64748B" }}>
              <Spinner className="h-4 w-4" />
              <span className="text-[12px]">Loading...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-8" style={{ color: "#94A3B8" }}>
              <Inbox className="h-6 w-6" />
              <span className="text-[12px]">No notifications yet</span>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 border-b px-3 py-2.5 transition-colors hover:bg-slate-50"
                  style={{ borderColor: "#F1F5F9", background: n.is_read ? "transparent" : "#EFF6FF" }}
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: n.is_read ? "#CBD5E1" : PRIORITY_COLORS[n.priority] ?? "#3B6FD4" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[10px]" style={{ color: "#94A3B8" }}>
                        {timeAgo(parseTimestamp(n.created_at))}
                      </span>
                    </div>
                    {n.message && (
                      <p className="mt-0.5 truncate text-[12px]" style={{ color: "#64748B" }}>
                        {n.message}
                      </p>
                    )}
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wide" style={{ color: "#94A3B8" }}>
                      <span>{KIND_LABEL[n.kind] ?? n.kind}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!n.is_read && (
                      <button
                        type="button"
                        disabled={busyId === n.id}
                        onClick={() => handleMarkRead(n.id)}
                        className="rounded p-1 transition-colors hover:bg-slate-100"
                        style={{ color: "#3B6FD4" }}
                        aria-label="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === n.id}
                      onClick={() => handleDelete(n.id)}
                      className="rounded p-1 transition-colors hover:bg-red-50"
                      style={{ color: "#94A3B8" }}
                      aria-label="Delete notification"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            className="px-3 py-2"
            style={{ borderTop: "1px solid #E2E8F0" }}
          >
            <button
              type="button"
              onClick={() => navigate("/notifications")}
              className="w-full rounded py-1.5 text-[12px] font-semibold transition-colors hover:bg-slate-100"
              style={{ color: "#3B6FD4" }}
            >
              View all notifications
            </button>
          </div>
        </div>
      }
      trigger={
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
          style={{ color: "#64748B" }}
          aria-label="Notifications"
        >
          <Bell style={{ width: 18, height: 18 }} />
          {unread > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
              style={{ background: "#DC2626", border: "2px solid #fff" }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      }
    />
  );
}