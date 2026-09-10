import { useState } from "react";
import {
  Cpu,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Check,
  Copy,
  RefreshCw,
} from "lucide-react";
import * as licenseService from "../services/licenseService";
import { Button } from "../components/Button";
import { useSettingsStore } from "../store/settings";
import type { LicenseStatus } from "../types/license";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy Hardware ID"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors"
      style={{
        background: "#F8FAFC",
        border: "1px solid #E2E8F0",
        color: copied ? "#16A34A" : "#64748B",
        cursor: "pointer",
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function LicenseGate({
  status,
  onActivated,
}: {
  status: LicenseStatus;
  onActivated: (s: LicenseStatus) => void;
}) {
  const isExpired = status.expired;
  const hwId = status.hardware_id;
  const logo = useSettingsStore((s) => s.logo);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    if (!key.trim()) {
      setError("Please enter the license key provided by your vendor.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const s = await licenseService.activateLicense(key.trim(), null);
      onActivated(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: "#F4F6FA" }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-8"
        style={{ border: "1px solid #E2E8F0", boxShadow: "0 10px 40px rgba(0,0,0,0.08)" }}
      >
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          {isExpired ? (
            <div
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "#FEE2E2", color: "#DC2626" }}
            >
              <ShieldAlert className="h-7 w-7" />
            </div>
          ) : (
            <img
              src={logo || "/logo.png"}
              alt="Shop logo"
              className="mb-3 h-16 w-16 object-contain"
            />
          )}
          <h1 className="text-[20px] font-bold" style={{ color: "#0F172A" }}>
            {isExpired ? "License Expired" : "Activate Mobile Shop Pro"}
          </h1>
          <p className="mt-1 max-w-xs text-[13px]" style={{ color: "#64748B" }}>
            {isExpired
              ? "Your license has expired. Enter a new license key from your vendor to renew and continue using the software."
              : "This copy of Mobile Shop Pro is not activated. Activate it to unlock the full software."}
          </p>
        </div>

        {/* Hardware ID */}
        <div className="mb-6">
          <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "#475569" }}>
            <Cpu className="h-3.5 w-3.5" /> Hardware ID
          </label>
          <div className="flex items-center gap-2">
            <div
              className="flex h-10 w-full items-center overflow-hidden rounded-md px-3 text-[13px]"
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                color: "#0F172A",
                fontFamily: "'Courier New', Courier, monospace",
                userSelect: "text",
              }}
            >
              {hwId}
            </div>
            <CopyButton text={hwId} />
          </div>
          <p className="mt-1.5 text-[11px]" style={{ color: "#94A3B8" }}>
            Send this Hardware ID to your vendor. They will generate a unique license key for this computer.
          </p>
        </div>

        {error && (
          <div
            className="mb-4 rounded-md px-3 py-2.5 text-[13px]"
            style={{ background: "#FFF5F5", border: "1px solid #FECACA", color: "#B91C1C" }}
          >
            {error}
          </div>
        )}

        {/* License Key input */}
        <div className="mb-6">
          <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "#475569" }}>
            <KeyRound className="h-3.5 w-3.5" /> License Key
          </label>
          <textarea
            rows={3}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="MSP-..."
            className="w-full resize-none rounded-md px-3 py-2 text-[13px] outline-none transition-shadow"
            style={{
              border: "1px solid #CBD5E1",
              fontFamily: "'Courier New', Courier, monospace",
              color: "#0F172A",
              background: "#FAFAFA",
            }}
            onFocus={(e) => (e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)")}
            onBlur={(e) => (e.target.style.boxShadow = "none")}
          />
        </div>

        <Button
          size="lg"
          className="w-full justify-center"
          onClick={handleActivate}
          loading={busy}
          icon={!busy && isExpired ? <RefreshCw className="h-4 w-4" /> : !busy ? <ShieldCheck className="h-4 w-4" /> : undefined}
          style={{ background: "linear-gradient(135deg,#6366F1,#4F46E5)" }}
        >
          {busy ? "Activating…" : isExpired ? "Renew License" : "Activate License"}
        </Button>

        {isExpired && (
          <p className="mt-4 text-center text-[12px]" style={{ color: "#94A3B8" }}>
            Previous license expired on {formatDate(status.activated_until)}.
          </p>
        )}
      </div>
    </div>
  );
}
