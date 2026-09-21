import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Wallet,
  Calendar,
  CreditCard,
  Receipt,
  Filter,
  TrendingUp,
  MoreVertical,
  Eye,
  Pencil,
  Ban,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Button";
import { Modal } from "../components/Modal";
import { formatDateTime, formatMoney, methodLabels } from "../lib/format";
import { getOnlinePaymentRecords } from "../services/reportService";
import {
  voidPayment,
  editPaymentDetails,
  voidSalePayment,
  editSalePaymentDetails,
} from "../services/paymentService";
import { useSessionStore } from "../store/session";
import { can } from "../lib/permissions";
import type { OnlinePaymentRecord } from "../types/report";

const PAYMENT_METHODS = ["all", "bank_transfer", "easypaisa", "jazzcash", "card", "other"];

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** True when the record originates from the `sale_payments` table (id * 2 = even). */
function isSalePaymentRecord(id: number): boolean {
  return id > 0 && id % 2 === 0;
}

/** Any positive ID is an actionable payment record (sale_payment or payment). */
function hasActions(id: number): boolean {
  return id > 0;
}

/** Decode the real table ID from the encoded online payment record ID. */
function decodeRecordId(id: number): { table: "sale_payment" | "payment"; realId: number } {
  if (isSalePaymentRecord(id)) return { table: "sale_payment", realId: id / 2 };
  return { table: "payment", realId: (id - 1) / 2 };
}

export function OnlinePaymentsPage() {
  const today = toInputDate(new Date());
  const [records, setRecords] = useState<OnlinePaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [activePreset, setActivePreset] = useState("This Month");
  const [methodFilter, setMethodFilter] = useState("all");
  const [search, setSearch] = useState("");
  const reqRef = useRef(0);

  const user = useSessionStore((s) => s.user);
  const canDelete = can(user?.permissions, "payments:delete");

  // --- Modal / action state ---
  const [viewRecord, setViewRecord] = useState<OnlinePaymentRecord | null>(null);
  const [editRecord, setEditRecord] = useState<OnlinePaymentRecord | null>(null);
  const [voidRecord, setVoidRecord] = useState<OnlinePaymentRecord | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const fetchRecords = useCallback(async (f: string, t: string) => {
    const req = ++reqRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getOnlinePaymentRecords(f, t);
      if (req !== reqRef.current) return;
      setRecords(data);
    } catch (e) {
      if (req !== reqRef.current) return;
      setError(String(e));
    } finally {
      if (req === reqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords(from, to);
  }, [fetchRecords, from, to]);

  const applyPreset = (label: string, f: string, t: string) => {
    setFrom(f);
    setTo(t);
    setActivePreset(label);
    fetchRecords(f, t);
  };

  const handleApply = () => {
    if (!from || !to || from > to) {
      setError("Please select valid From and To dates.");
      return;
    }
    setActivePreset("");
    fetchRecords(from, to);
  };

  const presets: { label: string; range: () => [string, string] }[] = [
    { label: "Today", range: () => [today, today] },
    {
      label: "This Week",
      range: () => {
        const d = new Date();
        const s = new Date(d);
        s.setDate(d.getDate() - d.getDay());
        return [toInputDate(s), today];
      },
    },
    {
      label: "This Month",
      range: () => {
        const d = new Date();
        return [toInputDate(new Date(d.getFullYear(), d.getMonth(), 1)), today];
      },
    },
    {
      label: "This Year",
      range: () => {
        const d = new Date();
        return [toInputDate(new Date(d.getFullYear(), 0, 1)), today];
      },
    },
  ];

  const filtered = records.filter((r) => {
    if (methodFilter !== "all" && r.payment_method !== methodFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        r.receipt_no.toLowerCase().includes(q) ||
        (r.customer_name ?? "").toLowerCase().includes(q) ||
        (r.reference ?? "").toLowerCase().includes(q) ||
        (r.account_details ?? "").toLowerCase().includes(q) ||
        (r.notes ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Exclude voided from KPI totals
  const totalReceived = records
    .filter((r) => !r.is_voided)
    .reduce((s, r) => s + r.amount, 0);
  const totalTransactions = records.filter((r) => !r.is_voided).length;
  const periodLabel =
    activePreset === "Today"
      ? "Today"
      : activePreset === "This Week"
        ? "This Week"
        : activePreset === "This Month"
          ? "This Month"
          : activePreset === "This Year"
            ? "This Year"
            : "Selected Period";

  // Close dropdown on outside click
  useEffect(() => {
    if (openMenuId === null) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openMenuId]);

  return (
    <div>
      <PageHeader
        title="Online Payments"
        description="Track all non-cash digital payments received"
        breadcrumb={[{ label: "Finance" }, { label: "Online Payments" }]}
        meta={`${totalTransactions} transactions`}
      />

      {error && (
        <div className="mb-4">
          <div
            className="rounded-md border px-4 py-3 text-[13px]"
            style={{ borderColor: "#FECDD3", background: "#FEF2F2", color: "#B91C1C" }}
          >
            {error}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={`${periodLabel} Received`}
          value={formatMoney(totalReceived)}
          icon={Calendar}
          tone="green"
          sub={`${totalTransactions} transactions`}
        />
        <KpiCard
          title={`${periodLabel} Transactions`}
          value={String(totalTransactions)}
          icon={Receipt}
          tone="navy"
          sub={`${periodLabel.toLowerCase()} count`}
        />
        <KpiCard
          title="Total Online Received"
          value={formatMoney(totalReceived)}
          icon={Wallet}
          tone="amber"
          sub={`${totalTransactions} transactions`}
        />
        <KpiCard
          title="Online Transactions"
          value={String(totalTransactions)}
          icon={TrendingUp}
          tone="primary"
          sub="in selected period"
        />
      </div>

      {/* Filters */}
      <Card className="mb-4" noPadding>
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid #E2E8F0" }}
        >
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  const [f, t] = p.range();
                  applyPreset(p.label, f, t);
                }}
                className="rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors"
                style={{
                  background: activePreset === p.label ? "#EFF4FF" : "#F1F5F9",
                  color: activePreset === p.label ? "#1D4ED8" : "#475569",
                  border:
                    activePreset === p.label
                      ? "1px solid #BFDBFE"
                      : "1px solid transparent",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ borderLeft: "1px solid #E2E8F0", height: 24 }} />

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border px-2.5 py-1 text-[12px]"
              style={{ borderColor: "#CBD5E1" }}
            />
            <span className="text-[12px]" style={{ color: "#94A3B8" }}>
              to
            </span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border px-2.5 py-1 text-[12px]"
              style={{ borderColor: "#CBD5E1" }}
            />
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-white"
              style={{ background: "#2563EB" }}
            >
              <Filter className="h-3 w-3" /> Apply
            </button>
          </div>

          <div style={{ borderLeft: "1px solid #E2E8F0", height: 24 }} />

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded-md border px-2.5 py-1 text-[12px] font-medium"
            style={{ borderColor: "#CBD5E1", color: "#334155", background: "#FFFFFF" }}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m === "all" ? "All Methods" : methodLabels[m] ?? m}
              </option>
            ))}
          </select>

          <div className="relative ml-auto min-w-[200px] max-w-xs flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "#94A3B8" }}
            />
            <input
              type="text"
              placeholder="Search invoice, customer, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border py-1 pl-8 pr-2.5 text-[12px]"
              style={{ borderColor: "#CBD5E1" }}
            />
          </div>
        </div>

        {loading ? (
          <div
            className="flex items-center justify-center gap-2 py-16"
            style={{ color: "#64748B" }}
          >
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading online payments...</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No online payments found"
            description="No non-cash transactions match your filters for this period."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date / Time</th>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Method</th>
                  <th className="text-right">Amount</th>
                  <th>Bank / Account</th>
                  <th>Reference / TX ID</th>
                  <th className="w-[48px] text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const editable = hasActions(r.id);
                  return (
                    <tr
                      key={r.id}
                      style={r.is_voided ? { opacity: 0.5 } : undefined}
                    >
                      <td>{formatDateTime(r.created_at)}</td>
                      <td className="font-semibold">{r.receipt_no}</td>
                      <td>{r.customer_name ?? "Walk-in"}</td>
                      <td>
                        {r.is_voided ? (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{
                              background: "#FEE2E2",
                              color: "#991B1B",
                              border: "1px solid #FECACA",
                            }}
                          >
                            VOIDED
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{
                              background: "#F0FDF4",
                              color: "#166534",
                              border: "1px solid #BBF7D0",
                            }}
                          >
                            {methodLabels[r.payment_method] ?? r.payment_method}
                          </span>
                        )}
                      </td>
                      <td
                        className="text-right amount font-semibold"
                        style={{ color: r.is_voided ? "#94A3B8" : "#16A34A" }}
                      >
                        {formatMoney(r.amount)}
                      </td>
                      <td>{r.account_details ?? "\u2014"}</td>
                      <td>{r.reference ?? "\u2014"}</td>
                      <td className="w-[48px] text-center align-middle">
                        {editable && (
                          <div className="relative inline-block">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === r.id ? null : r.id);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-slate-100"
                              style={{ color: "#64748B" }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openMenuId === r.id && (
                              <div
                                className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border bg-white shadow-lg"
                                style={{ borderColor: "#E2E8F0" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-[13px] transition-colors hover:bg-slate-50"
                                  style={{ color: "#334155" }}
                                  onClick={() => {
                                    setViewRecord(r);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5" /> View
                                </button>
                                {!r.is_voided && (
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-[13px] transition-colors hover:bg-slate-50"
                                    style={{ color: "#334155" }}
                                    onClick={() => {
                                      setEditRecord(r);
                                      setOpenMenuId(null);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" /> Edit Details
                                  </button>
                                )}
                                {canDelete && !r.is_voided && (
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-[13px] transition-colors hover:bg-red-50"
                                    style={{ color: "#DC2626" }}
                                    onClick={() => {
                                      setVoidRecord(r);
                                      setOpenMenuId(null);
                                    }}
                                  >
                                    <Ban className="h-3.5 w-3.5" /> Void Payment
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #E2E8F0", fontWeight: 700 }}>
                  <td colSpan={4}>
                    Total ({filtered.filter((r) => !r.is_voided).length} active
                    transactions)
                  </td>
                  <td
                    className="text-right amount"
                    style={{ color: "#16A34A" }}
                  >
                    {formatMoney(
                      filtered
                        .filter((r) => !r.is_voided)
                        .reduce((s, r) => s + r.amount, 0),
                    )}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* ── View Modal ── */}
      <Modal
        open={!!viewRecord}
        title="Payment Details"
        onClose={() => setViewRecord(null)}
        size="sm"
      >
        {viewRecord && (
          <div className="space-y-3 text-[13px]">
            <Row label="Invoice" value={viewRecord.receipt_no} />
            <Row label="Customer" value={viewRecord.customer_name ?? "Walk-in"} />
            <Row
              label="Amount"
              value={formatMoney(viewRecord.amount)}
              strong
            />
            <Row
              label="Method"
              value={methodLabels[viewRecord.payment_method] ?? viewRecord.payment_method}
            />
            <Row
              label="Bank / Account"
              value={viewRecord.account_details ?? "\u2014"}
            />
            <Row
              label="Reference / TX ID"
              value={viewRecord.reference ?? "\u2014"}
            />
            <Row label="Date" value={formatDateTime(viewRecord.created_at)} />
            {viewRecord.is_voided && (
              <>
                <div
                  className="my-2 rounded-md border px-3 py-2 text-[12px]"
                  style={{
                    borderColor: "#FECACA",
                    background: "#FEF2F2",
                    color: "#991B1B",
                  }}
                >
                  This payment has been voided.
                </div>
                <Row label="Void Reason" value={viewRecord.void_reason ?? "\u2014"} />
                <Row
                  label="Voided At"
                  value={
                    viewRecord.voided_at
                      ? formatDateTime(viewRecord.voided_at)
                      : "\u2014"
                  }
                />
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Edit Details Modal ── */}
      <EditDetailsModal
        record={editRecord}
        onClose={() => setEditRecord(null)}
        onSaved={() => {
          setEditRecord(null);
          fetchRecords(from, to);
        }}
      />

      {/* ── Void Payment Modal ── */}
      <VoidPaymentModal
        record={voidRecord}
        onClose={() => setVoidRecord(null)}
        onVoided={() => {
          setVoidRecord(null);
          fetchRecords(from, to);
        }}
      />
    </div>
  );
}

// ── Small helpers ──

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span style={{ color: "#64748B" }}>{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

// ── Edit Details Modal ──

function EditDetailsModal({
  record,
  onClose,
  onSaved,
}: {
  record: OnlinePaymentRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [account, setAccount] = useState(record?.account_details ?? "");
  const [ref, setRef] = useState(record?.reference ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setAccount(record.account_details ?? "");
      setRef(record.reference ?? "");
      setErr(null);
    }
  }, [record]);

  const handleSave = async () => {
    if (!record) return;
    setSaving(true);
    setErr(null);
    try {
      const { table, realId } = decodeRecordId(record.id);
      if (table === "sale_payment") {
        await editSalePaymentDetails(
          realId,
          account.trim() || null,
          ref.trim() || null,
        );
      } else {
        await editPaymentDetails(
          realId,
          account.trim() || null,
          ref.trim() || null,
        );
      }
      onSaved();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!record}
      title="Edit Payment Details"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-slate-50"
            style={{ borderColor: "#CBD5E1", color: "#475569" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: "#2563EB" }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </>
      }
    >
      {err && (
        <div
          className="mb-3 rounded-md border px-3 py-2 text-[12px]"
          style={{ borderColor: "#FECDD3", background: "#FEF2F2", color: "#B91C1C" }}
        >
          {err}
        </div>
      )}
      <div className="space-y-3">
        <div>
          <label
            className="mb-1 block text-[12px] font-medium"
            style={{ color: "#475569" }}
          >
            Bank / Account
          </label>
          <input
            type="text"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="e.g. HBL 1234-5678-9012"
            className="w-full rounded-md border px-3 py-1.5 text-[13px]"
            style={{ borderColor: "#CBD5E1" }}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-[12px] font-medium"
            style={{ color: "#475569" }}
          >
            Reference / Transaction ID
          </label>
          <input
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="e.g. TXN-20260920-001"
            className="w-full rounded-md border px-3 py-1.5 text-[13px]"
            style={{ borderColor: "#CBD5E1" }}
          />
        </div>
      </div>
    </Modal>
  );
}

// ── Void Payment Modal ──

function VoidPaymentModal({
  record,
  onClose,
  onVoided,
}: {
  record: OnlinePaymentRecord | null;
  onClose: () => void;
  onVoided: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setReason("");
      setErr(null);
    }
  }, [record]);

  const handleVoid = async () => {
    if (!record) return;
    if (!reason.trim()) {
      setErr("Please provide a reason for voiding this payment.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const { table, realId } = decodeRecordId(record.id);
      if (table === "sale_payment") {
        await voidSalePayment(realId, reason.trim());
      } else {
        await voidPayment(realId, reason.trim());
      }
      onVoided();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!record}
      title="Void Payment"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-slate-50"
            style={{ borderColor: "#CBD5E1", color: "#475569" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleVoid}
            disabled={saving}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: "#DC2626" }}
          >
            {saving ? "Voiding..." : "Void Payment"}
          </button>
        </>
      }
    >
      {record && (
        <div className="space-y-3">
          <div
            className="rounded-md border px-3 py-2 text-[12px]"
            style={{
              borderColor: "#FECDD3",
              background: "#FEF2F2",
              color: "#991B1B",
            }}
          >
            <strong>Warning:</strong> This will void the payment of{" "}
            <strong>{formatMoney(record.amount)}</strong> on invoice{" "}
            <strong>{record.receipt_no}</strong>. The payment will stop counting
            as received. This action cannot be undone.
          </div>

          {err && (
            <div
              className="rounded-md border px-3 py-2 text-[12px]"
              style={{
                borderColor: "#FECDD3",
                background: "#FEF2F2",
                color: "#B91C1C",
              }}
            >
              {err}
            </div>
          )}

          <div>
            <label
              className="mb-1 block text-[12px] font-medium"
              style={{ color: "#475569" }}
            >
              Reason for voiding <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate payment entry, incorrect amount..."
              rows={3}
              className="w-full rounded-md border px-3 py-1.5 text-[13px]"
              style={{ borderColor: "#CBD5E1" }}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
