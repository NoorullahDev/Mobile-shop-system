import { useEffect, useRef, useState } from "react";
import {
  Search,
  Wallet,
  Calendar,
  CreditCard,
  Receipt,
  Filter,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Button";
import { formatDate, formatMoney, methodLabels, toLocalDate } from "../lib/format";
import { getOnlinePaymentRecords } from "../services/reportService";
import type { OnlinePaymentRecord } from "../types/report";

const PAYMENT_METHODS = ["all", "bank_transfer", "easypaisa", "jazzcash", "card", "other"];

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  const fetchRecords = async (f: string, t: string) => {
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
  };

  useEffect(() => {
    fetchRecords(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    { label: "This Week", range: () => { const d = new Date(); const s = new Date(d); s.setDate(d.getDate() - d.getDay()); return [toInputDate(s), today]; } },
    { label: "This Month", range: () => { const d = new Date(); return [toInputDate(new Date(d.getFullYear(), d.getMonth(), 1)), today]; } },
    { label: "This Year", range: () => { const d = new Date(); return [toInputDate(new Date(d.getFullYear(), 0, 1)), today]; } },
  ];

  // Filtered records
  const filtered = records.filter((r) => {
    if (methodFilter !== "all" && r.payment_method !== methodFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        r.receipt_no.toLowerCase().includes(q) ||
        (r.customer_name ?? "").toLowerCase().includes(q) ||
        (r.reference ?? "").toLowerCase().includes(q) ||
        (r.notes ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Summary calculations
  const now = new Date();
  const todayStr = toLocalDate(now);
  const monthStart = toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const todayTotal = records.filter((r) => r.created_at.slice(0, 10) === todayStr).reduce((s, r) => s + r.amount, 0);
  const monthTotal = records.filter((r) => r.created_at.slice(0, 10) >= monthStart && r.created_at.slice(0, 10) <= todayStr).reduce((s, r) => s + r.amount, 0);
  const totalReceived = records.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <PageHeader
        title="Online Payments"
        description="Track all non-cash digital payments received"
        breadcrumb={[{ label: "Finance" }, { label: "Online Payments" }]}
        meta={`${records.length} transactions`}
      />

      {error && (
        <div className="mb-4">
          <div className="rounded-md border px-4 py-3 text-[13px]" style={{ borderColor: "#FECDD3", background: "#FEF2F2", color: "#B91C1C" }}>
            {error}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Today's Online Received" value={formatMoney(todayTotal)} icon={Calendar} tone="green" sub={todayStr} />
        <KpiCard title="This Month" value={formatMoney(monthTotal)} icon={TrendingUp} tone="primary" sub={monthStart} />
        <KpiCard title="Total Online Received" value={formatMoney(totalReceived)} icon={Wallet} tone="amber" sub={`${records.length} transactions`} />
        <KpiCard title="Online Transactions" value={String(records.length)} icon={Receipt} tone="navy" sub="in selected period" />
      </div>

      {/* Filters */}
      <Card className="mb-4" noPadding>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #E2E8F0" }}>
          {/* Period presets */}
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
                  border: activePreset === p.label ? "1px solid #BFDBFE" : "1px solid transparent",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ borderLeft: "1px solid #E2E8F0", height: 24 }} />

          {/* Date inputs */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border px-2.5 py-1 text-[12px]"
              style={{ borderColor: "#CBD5E1" }}
            />
            <span className="text-[12px]" style={{ color: "#94A3B8" }}>to</span>
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

          {/* Method filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded-md border px-2.5 py-1 text-[12px] font-medium"
            style={{ borderColor: "#CBD5E1", color: "#334155", background: "#FFFFFF" }}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m === "all" ? "All Methods" : (methodLabels[m] ?? m)}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative ml-auto min-w-[200px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "#94A3B8" }} />
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

        {/* Transaction Table */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16" style={{ color: "#64748B" }}>
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
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.created_at)}</td>
                    <td className="font-semibold">{r.receipt_no}</td>
                    <td>{r.customer_name ?? "Walk-in"}</td>
                    <td>
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
                    </td>
                    <td className="text-right amount font-semibold" style={{ color: "#16A34A" }}>
                      {formatMoney(r.amount)}
                    </td>
                    <td>{r.notes ?? "—"}</td>
                    <td>{r.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #E2E8F0", fontWeight: 700 }}>
                  <td colSpan={4}>Total ({filtered.length} transactions)</td>
                  <td className="text-right amount" style={{ color: "#16A34A" }}>
                    {formatMoney(filtered.reduce((s, r) => s + r.amount, 0))}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
