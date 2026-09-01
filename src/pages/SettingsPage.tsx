import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { History, Save, DatabaseBackup, ArrowRight } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert } from "../components/Alert";
import { Spinner } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import * as settingsService from "../services/settingsService";
import { setCurrency as setActiveCurrency } from "../lib/format";
import { useSessionStore } from "../store/session";
import type { ActivityLog } from "../types/settings";

export function SettingsPage() {
  const user = useSessionStore((s) => s.user);
  const actor = user?.id ?? null;

  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const settings = await settingsService.getAllSettings();
        const map = new Map(settings.map((s) => [s.key, s.value ?? ""]));
        setBusinessName(map.get("business_name") ?? "");
        const savedCurrency = (map.get("currency") ?? "PKR") as "PKR" | "USD";
        setCurrency(savedCurrency);
        setActiveCurrency(savedCurrency);
        setAddress(map.get("address") ?? "");
        setPhone(map.get("phone") ?? "");
        setEmail(map.get("email") ?? "");
        setError(null);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      setLogs(await settingsService.listActivityLogs(50));
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const entries: Array<[string, string]> = [];
      if (businessName.trim()) entries.push(["business_name", businessName]);
      if (currency.trim()) entries.push(["currency", currency]);
      if (address.trim()) entries.push(["address", address]);
      if (phone.trim()) entries.push(["phone", phone]);
      if (email.trim()) entries.push(["email", email]);
      for (const [k, v] of entries) {
        await settingsService.updateSetting(k, v, actor);
      }
      if (currency.trim()) setActiveCurrency(currency as "PKR" | "USD");
      setMessage("Settings saved successfully.");
      await loadLogs();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure business profile, backup, and system preferences"
        breadcrumb={[{ label: "System" }, { label: "Settings" }]}
      />

      {error && <div className="mb-4"><Alert message={error} variant="error" /></div>}
      {message && <div className="mb-4"><Alert message={message} variant="success" /></div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20" style={{ color: "#64748B" }}>
          <Spinner className="h-5 w-5" />
          <span className="text-[13px]">Loading settings...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-5">

          {/* ─── Business Profile ─── */}
          <Card
            title="Business Profile"
            actions={
              <Button
                size="sm"
                onClick={handleSave}
                loading={saving}
                icon={<Save className="h-3.5 w-3.5" />}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Business Name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Al-Haseeb Mobile Store"
              />
              <Input
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="PKR"
                hint="Used on all invoices and reports"
              />
              <Input
                label="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
              />
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="shop@example.com"
              />
              <div className="sm:col-span-2">
                <Input
                  label="Shop Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, Province"
                />
              </div>
            </div>
          </Card>

          {/* ─── Backup & Restore ─── */}
          <Card title="Backup & Restore">
            <div className="mb-4">
              <Alert
                variant="info"
                title="Your data is safe"
                message="Create, verify, restore and delete database backups from the Backup Manager."
              />
            </div>
            <Link
              to="/backups"
              className="flex items-center justify-between rounded-lg p-4 transition-colors hover:bg-[#F4F6FA]"
              style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: "#DBEAFE", color: "#2563EB" }}
                >
                  <DatabaseBackup className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                    Open Backup Manager
                  </div>
                  <div className="text-[12px]" style={{ color: "#64748B" }}>
                    Create a backup now, or restore a previous one
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4" style={{ color: "#64748B" }} />
            </Link>
          </Card>

          {/* ─── Activity Logs ─── */}
          <Card title="Activity Logs" subtitle="Last 50 system actions" noPadding>
            {logsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12" style={{ color: "#64748B" }}>
                <Spinner className="h-5 w-5" />
                <span className="text-[13px]">Loading activity...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={History} title="No activity yet" description="System actions you perform will appear here." />
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Action</th>
                    <th>Record ID</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
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
                      <td style={{ color: "#64748B", fontSize: "12px" }}>
                        {new Date(l.timestamp.replace(" ", "T") + "Z").toLocaleString("en-PK", {
                          day: "numeric", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* ─── System Info ─── */}
          <Card title="System Information">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "App Version", value: "1.0.0" },
                { label: "Database", value: "SQLite (Encrypted)" },
                { label: "Mode", value: "Offline Desktop" },
                { label: "Encryption", value: "AES-256 (SQLCipher)" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg p-3"
                  style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
                >
                  <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "#94A3B8" }}>
                    {label}
                  </div>
                  <div className="mt-1 text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}