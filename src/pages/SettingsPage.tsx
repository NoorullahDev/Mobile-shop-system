import { useEffect, useRef, useState } from "react";
import {
  Save,
  Store,
  ImagePlus,
  Trash2,
  Printer,
  DatabaseBackup,
  UserCog,
  ClipboardList,
  Bell,
  Shield,
  Cpu,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert } from "../components/Alert";
import { Spinner } from "../components/Button";
import { ReceiptSettingsPage } from "./ReceiptSettingsPage";
import { BackupManagerPage } from "./BackupManagerPage";
import { UsersPage } from "./UsersPage";
import { ActivityLogsPage } from "./ActivityLogsPage";
import { NotificationsPage } from "./NotificationsPage";
import { LicensePage } from "./LicensePage";
import * as settingsService from "../services/settingsService";
import { setCurrency as setActiveCurrency } from "../lib/format";
import { useSessionStore } from "../store/session";
import { useSettingsStore } from "../store/settings";
import type { LucideIcon } from "lucide-react";

type SettingsTab =
  | "business"
  | "receipt"
  | "backup"
  | "users"
  | "activity"
  | "notifications"
  | "license"
  | "system";

interface NavSection {
  id: SettingsTab;
  label: string;
  icon: LucideIcon;
}

const NAV: NavSection[] = [
  { id: "business", label: "Business", icon: Store },
  { id: "receipt", label: "Receipt", icon: Printer },
  { id: "backup", label: "Backup & Restore", icon: DatabaseBackup },
  { id: "users", label: "Users & Roles", icon: UserCog },
  { id: "activity", label: "Activity Logs", icon: ClipboardList },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "license", label: "License", icon: Shield },
  { id: "system", label: "System", icon: Cpu },
];

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

  const [activeTab, setActiveTab] = useState<SettingsTab>("business");

  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError(null);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      });
      setMessage("Settings saved successfully.");
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
        description="Business information, receipt and system settings."
        breadcrumb={[{ label: "System" }, { label: "Settings" }]}
      />

      {error && <div className="mb-4"><Alert message={error} variant="error" /></div>}
      {message && <div className="mb-4"><Alert message={message} variant="success" /></div>}

      <div className="flex items-start gap-5">
        {/* ─── Left settings navigation ─── */}
        <aside
          className="w-60 shrink-0 rounded-lg bg-white p-2"
          style={{ border: "1px solid #E2E8F0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
        >
          <nav className="flex flex-col gap-0.5">
            {NAV.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors"
                  style={
                    active
                      ? { background: "#EFF4FF", color: "#1D4ED8" }
                      : { background: "transparent", color: "#334155" }
                  }
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "#F1F5F9";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Icon
                    className="h-4 w-4 shrink-0"
                    style={{ color: active ? "#2563EB" : "#64748B" }}
                  />
                  <span className="flex-1 truncate">{label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ─── Right content pane ─── */}
        <main className="min-w-0 flex-1">
          {activeTab === "business" &&
            (loading ? (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-white py-20" style={{ border: "1px solid #E2E8F0", color: "#64748B" }}>
                <Spinner className="h-5 w-5" />
                <span className="text-[13px]">Loading settings...</span>
              </div>
            ) : (
              <Card title="Business Profile">
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
                      Logo · Business Name · Phone · Email · Address · Currency
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

                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    loading={saving}
                    icon={<Save className="h-3.5 w-3.5" />}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </Card>
            ))}

          {activeTab === "receipt" && <ReceiptSettingsPage />}
          {activeTab === "backup" && <BackupManagerPage />}
          {activeTab === "users" && <UsersPage />}
          {activeTab === "activity" && <ActivityLogsPage />}
          {activeTab === "notifications" && <NotificationsPage />}
          {activeTab === "license" && <LicensePage />}

          {activeTab === "system" && (
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
          )}
        </main>
      </div>
    </div>
  );
}