import { useCallback, useEffect, useMemo, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { EmptyState } from "../components/EmptyState";
import * as settingsService from "../services/settingsService";
import type { ActivityLog } from "../types/settings";

const LIMIT_OPTIONS = [
  { value: "25", label: "Last 25" },
  { value: "50", label: "Last 50" },
  { value: "100", label: "Last 100" },
  { value: "200", label: "Last 200" },
];

export function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState("50");
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLogs(await settingsService.listActivityLogs(Number(limit)));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  const modules = useMemo(() => {
    const set = new Set<string>(logs.map((l) => l.module));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (module !== "all" && l.module !== module) return false;
      if (!q) return true;
      return (
        l.module.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        (l.record_id != null && String(l.record_id).includes(q))
      );
    });
  }, [logs, query, module]);

  return (
    <div>
      <PageHeader
        title="Activity Logs"
        description="Audit trail of actions performed across the system"
        breadcrumb={[{ label: "System" }, { label: "Activity Logs" }]}
        actions={
          <Button size="sm" variant="secondary" onClick={load} icon={<RefreshCw className="h-3.5 w-3.5" />}>
            Refresh
          </Button>
        }
      />

      <Card
        title="Recent Activity"
        subtitle={`Showing ${filtered.length} of ${logs.length} actions`}
        actions={
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-48"
            />
            <Select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              options={[{ value: "all", label: "All modules" }, ...modules.map((m) => ({ value: m, label: m }))]}
              className="w-40"
            />
            <Select
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              options={LIMIT_OPTIONS}
              className="w-32"
            />
          </div>
        }
        noPadding
      >
        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: "#64748B" }}>
            Loading activity...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={History}
              title="No activity yet"
              description="System actions performed by users will appear here."
            />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Action</th>
                <th>Record ID</th>
                <th>User ID</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span
                      className="rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ background: "#F1F5F9", color: "#475569" }}
                    >
                      {l.module}
                    </span>
                  </td>
                  <td style={{ color: "#0F172A", fontSize: "13px" }}>{l.action}</td>
                  <td style={{ color: "#94A3B8", fontSize: "12px", fontFamily: "monospace" }}>
                    {l.record_id != null ? `#${l.record_id}` : "—"}
                  </td>
                  <td style={{ color: "#94A3B8", fontSize: "12px", fontFamily: "monospace" }}>
                    {l.user_id != null ? `#${l.user_id}` : "system"}
                  </td>
                  <td style={{ color: "#64748B", fontSize: "12px" }}>
                    {new Date(l.timestamp.replace(" ", "T") + "Z").toLocaleString("en-PK", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
