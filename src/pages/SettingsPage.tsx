import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { History, Save, DatabaseBackup, ArrowRight, Store, ImagePlus, Trash2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert } from "../components/Alert";
import { Select } from "../components/Select";
import { Spinner } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import * as settingsService from "../services/settingsService";
import { setCurrency as setActiveCurrency } from "../lib/format";
import { useSessionStore } from "../store/session";
import { useSettingsStore } from "../store/settings";
import type { ActivityLog } from "../types/settings";

function resizeLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file (PNG, JPG)"))
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode the selected image"));
      img.onload = () => {
        const MAX = 256;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process the selected image"));
          return;
        }
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function SettingsPage() {
  const user = useSessionStore((s) => s.user);
  const actor = user?.id ?? null;

  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [receiptPaperSize, setReceiptPaperSize] = useState<"58mm" | "80mm">("80mm");

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
        setLogo(map.get("shop_logo") || null);
        setReceiptPaperSize(map.get("receipt_paper_size") === "58mm" ? "58mm" : "80mm");
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

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError(null);
    try {
      setLogo(await resizeLogo(file));
    } catch (err) {
      setLogoError(String(err));
    }
  };

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
      entries.push(["shop_logo", logo ?? ""]);
      entries.push(["receipt_paper_size", receiptPaperSize]);
      for (const [k, v] of entries) {
        await settingsService.updateSetting(k, v, actor);
      }
      if (currency.trim()) setActiveCurrency(currency as "PKR" | "USD");
      useSettingsStore.getState().applyChanges({
        businessName: businessName.trim(),
        currency: (currency.trim() || "PKR") as "PKR" | "USD",
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        logo,
        receiptPaperSize,
      });
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
            <div className="mb-4 flex items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
              >
                {logo ? (
                  <img src={logo} alt="Shop logo" className="h-full w-full object-cover" />
                ) : (
                  <Store className="h-7 w-7" style={{ color: "#94A3B8" }} />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => logoInputRef.current?.click()}
                    icon={<ImagePlus className="h-3.5 w-3.5" />}
                  >
                    {logo ? "Change Logo" : "Upload Logo"}
                  </Button>
                  {logo && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => { setLogo(null); setLogoError(null); }}
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                {logoError && <span className="text-[11px]" style={{ color: "#DC2626" }}>{logoError}</span>}
                <span className="text-[11px]" style={{ color: "#94A3B8" }}>
                  PNG or JPG. Used in the sidebar, invoices and printed receipts.
                </span>
              </div>
            </div>

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

          {/* ─── Receipt Printing ─── */}
          <Card
            title="Receipt Printing"
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
              <Select
                label="Receipt Paper Size"
                options={[
                  { value: "58mm", label: "58mm — small thermal roll" },
                  { value: "80mm", label: "80mm — standard thermal roll" },
                ]}
                value={receiptPaperSize}
                onChange={(e) => setReceiptPaperSize(e.target.value as "58mm" | "80mm")}
              />
              <div className="flex flex-col justify-end pb-1">
                <span className="text-[12px]" style={{ color: "#64748B" }}>
                  Used for sales receipts printed from the POS and sales screens. The selected
                  size is remembered for future prints.
                </span>
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