import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Calendar,
  Clock,
  Cpu,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { Spinner } from "../components/Button";
import * as licenseService from "../services/licenseService";
import { useSessionStore } from "../store/session";
import type { LicenseStatus } from "../types/license";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function maskKey(key: string): string {
  if (!key || key.length < 20) return key;
  // Show first 16 chars then ellipsis then last 8
  return key.slice(0, 16) + "..." + key.slice(-8);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "#64748B" }}>
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function ReadonlyField({ value, monospace = false }: { value: string; monospace?: boolean }) {
  return (
    <div
      className="flex h-10 w-full items-center rounded-md px-3 text-[13px]"
      style={{
        background: "#F8FAFC",
        border: "1px solid #E2E8F0",
        color: "#0F172A",
        fontFamily: monospace ? "'Courier New', Courier, monospace" : undefined,
        userSelect: "text",
      }}
    >
      {value}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
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

function StatusBadge({ status }: { status: LicenseStatus }) {
  if (!status.activated && !status.expired) {
    return (
      <div
        className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-[13px] font-medium"
        style={{
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          color: "#64748B",
        }}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: "#94A3B8" }}
        />
        Not Activated
      </div>
    );
  }

  if (status.expired) {
    return (
      <div
        className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-[13px]"
        style={{
          background: "#FFF5F5",
          border: "1px solid #FECACA",
          color: "#991B1B",
        }}
      >
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold"
          style={{ background: "#DC2626", color: "#fff" }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "#fff" }}
          />
          Expired
        </span>
        <span style={{ color: "#B91C1C" }}>License has expired — renew to continue</span>
      </div>
    );
  }

  const days = status.remaining_days;
  return (
    <div
      className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-[13px]"
      style={{
        background: "#F0FDF4",
        border: "1px solid #BBF7D0",
        color: "#14532D",
      }}
    >
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold"
        style={{ background: "#16A34A", color: "#fff" }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: "#fff" }}
        />
        Active
      </span>
      <span style={{ color: "#15803D" }}>
        ({days} {days === 1 ? "day" : "days"} remaining)
      </span>
    </div>
  );
}

// ─── RenewModal ────────────────────────────────────────────────────────────────

function RenewModal({
  onClose,
  onSuccess,
  actor,
}: {
  onClose: () => void;
  onSuccess: (s: LicenseStatus) => void;
  actor: number | null;
}) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!key.trim()) {
      setError("Please enter a license key.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const s = await licenseService.activateLicense(key.trim(), actor);
      onSuccess(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6"
        style={{ border: "1px solid #E2E8F0", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
      >
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ background: "linear-gradient(135deg,#6366F1,#4F46E5)" }}
          >
            <KeyRound className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: "#0F172A" }}>
              Activate / Renew License
            </h3>
            <p className="text-[12px]" style={{ color: "#64748B" }}>
              Paste the license key provided by your vendor
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <Alert variant="error" message={error} />
          </div>
        )}

        <div className="mb-4 flex flex-col gap-1.5">
          <label className="text-[12px] font-medium" style={{ color: "#374151" }}>
            License Key
          </label>
          <textarea
            id="license-key-input"
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
          <p className="text-[11px]" style={{ color: "#94A3B8" }}>
            Format: MSP-&lt;payload&gt;.&lt;signature&gt;
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            loading={busy}
            icon={<KeyRound className="h-3.5 w-3.5" />}
            style={{ background: "linear-gradient(135deg,#6366F1,#4F46E5)" }}
          >
            {busy ? "Activating…" : "Activate"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function LicensePage() {
  const user = useSessionStore((s) => s.user);
  const actor = user?.id ?? null;

  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showRenew, setShowRenew] = useState(false);
  const [deactivateBusy, setDeactivateBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await licenseService.getLicenseStatus());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRenewSuccess = (s: LicenseStatus) => {
    setStatus(s);
    setShowRenew(false);
    setMessage(`License activated successfully for ${s.customer ?? "your shop"}.`);
  };

  const handleDeactivate = async () => {
    if (!window.confirm("Remove the current license? You will need a new key to reactivate.")) return;
    setDeactivateBusy(true);
    setError(null);
    setMessage(null);
    try {
      const s = await licenseService.deactivateLicense(actor);
      setStatus(s);
      setMessage("License deactivated. The app is now unlicensed.");
    } catch (e) {
      setError(String(e));
    } finally {
      setDeactivateBusy(false);
    }
  };

  const hwId = status?.hardware_id ?? "";
  const licenseKey = status?.activated || status?.expired
    ? /* we don't store the raw key in status, show masked placeholder */ "••••••••••••••••...••••••••"
    : "";
  const lastRenewed = formatDate(status?.activated_at);
  const expiryDate = formatDate(status?.activated_until);

  return (
    <div>
      <PageHeader
        title="License"
        description="Configure parameters and options for this module."
        breadcrumb={[{ label: "System" }, { label: "License" }]}
        meta="Offline"
      />

      {error && <div className="mb-4"><Alert message={error} variant="error" /></div>}
      {message && <div className="mb-4"><Alert message={message} variant="success" /></div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24" style={{ color: "#64748B" }}>
          <Spinner className="h-5 w-5" />
          <span className="text-[13px]">Loading license status…</span>
        </div>
      ) : (
        <div className="flex flex-col gap-5">

          {/* ── License Information card (matches reference image) ── */}
          <div
            className="rounded-xl bg-white p-6"
            style={{ border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          >
            {/* Card header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: "#EEF2FF" }}
                >
                  <ShieldCheck className="h-5 w-5" style={{ color: "#4F46E5" }} />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold" style={{ color: "#0F172A" }}>
                    License Information
                  </h2>
                  <p className="text-[12px]" style={{ color: "#64748B" }}>
                    Your software license details
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setShowRenew(true)}
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                style={{ background: "linear-gradient(135deg,#6366F1,#4F46E5)" }}
              >
                Renew License
              </Button>
            </div>

            {/* Top row: Hardware ID + License Key */}
            <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Hardware ID */}
              <InfoRow
                label="Hardware ID"
                icon={<Cpu className="h-3.5 w-3.5" />}
              >
                <div className="flex items-center gap-2">
                  <ReadonlyField value={hwId || "Loading…"} monospace />
                  {hwId && <CopyButton text={hwId} />}
                </div>
                <p className="text-[11px]" style={{ color: "#94A3B8" }}>
                  Hardware ID is permanently tied to this machine.
                </p>
              </InfoRow>

              {/* License Key */}
              <InfoRow
                label="License Key"
                icon={<KeyRound className="h-3.5 w-3.5" />}
              >
                <ReadonlyField
                  value={
                    status?.activated || status?.expired
                      ? maskKey(/* stored key isn't returned, show masked */ "Active license installed")
                      : "No license installed"
                  }
                  monospace
                />
              </InfoRow>
            </div>

            {/* Bottom row: Last Renewed + Current Status */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Last Renewed */}
              <InfoRow
                label="Last Renewed"
                icon={<Calendar className="h-3.5 w-3.5" />}
              >
                <ReadonlyField value={status?.activated || status?.expired ? lastRenewed : "—"} />
              </InfoRow>

              {/* Current Status */}
              <InfoRow
                label="Current Status"
                icon={<Clock className="h-3.5 w-3.5" />}
              >
                {status && <StatusBadge status={status} />}
              </InfoRow>
            </div>

            {/* Progress bar — only when active */}
            {status?.activated && (
              <div className="mt-5">
                <div
                  className="mb-1 flex items-center justify-between text-[12px]"
                  style={{ color: "#64748B" }}
                >
                  <span>Remaining validity</span>
                  <span className="font-semibold" style={{ color: "#0F172A" }}>
                    {status.remaining_days} of {status.granted_days} days
                  </span>
                </div>
                {(() => {
                  const ratio = status.granted_days > 0
                    ? Math.max(0, Math.min(1, status.remaining_days / status.granted_days))
                    : 0;
                  const barColor =
                    ratio > 0.25 ? "#16A34A" : ratio > 0.1 ? "#D97706" : "#DC2626";
                  return (
                    <div
                      className="h-2 w-full overflow-hidden rounded-full"
                      style={{ background: "#E2E8F0" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${ratio * 100}%`, background: barColor }}
                      />
                    </div>
                  );
                })()}
                {status.remaining_days <= 10 && (
                  <div className="mt-3">
                    <Alert
                      variant="warning"
                      title="License expiring soon"
                      message={`This license expires in ${status.remaining_days} day${status.remaining_days === 1 ? "" : "s"}. Contact your vendor to renew.`}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Expiry date row */}
            {(status?.activated || status?.expired) && status?.activated_until && (
              <div
                className="mt-5 flex flex-wrap gap-4 rounded-lg px-4 py-3 text-[12px]"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
              >
                <div>
                  <span style={{ color: "#94A3B8" }}>Customer: </span>
                  <span className="font-medium" style={{ color: "#0F172A" }}>
                    {status.customer ?? "—"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#94A3B8" }}>Granted Days: </span>
                  <span className="font-medium" style={{ color: "#0F172A" }}>
                    {status.granted_days}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#94A3B8" }}>Expires: </span>
                  <span className="font-medium" style={{ color: "#0F172A" }}>
                    {expiryDate}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── How to activate info card ── */}
          <div
            className="rounded-xl bg-white p-5"
            style={{ border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          >
            <Alert
              variant="info"
              title="How activation works"
              message="Copy your Hardware ID and send it to your vendor. They will generate a License Key bound exclusively to this machine. Paste that key using the 'Renew License' button. Days remaining decrease automatically every day. The system clock cannot be used to extend the license."
            />
          </div>

          {/* ── Advanced: Deactivate ── */}
          {(status?.activated || status?.expired) && (
            <div
              className="rounded-xl bg-white p-5"
              style={{ border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold" style={{ color: "#0F172A" }}>
                    Advanced
                  </h3>
                  <p className="mt-0.5 text-[12px]" style={{ color: "#64748B" }}>
                    Deactivating removes the stored key. You will need a valid key to reactivate.
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDeactivate}
                  loading={deactivateBusy}
                  icon={<ShieldOff className="h-3.5 w-3.5" />}
                >
                  Deactivate License
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Renew / Activate modal */}
      {showRenew && (
        <RenewModal
          actor={actor}
          onClose={() => setShowRenew(false)}
          onSuccess={handleRenewSuccess}
        />
      )}
    </div>
  );
}