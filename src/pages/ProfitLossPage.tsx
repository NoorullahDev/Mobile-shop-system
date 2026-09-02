import { useEffect, useRef, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  Receipt,
  Filter,
  UserCircle2,
  Download,
  Printer,
  FileText,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import * as reportService from "../services/reportService";
import { formatMoney, formatMoneyCompact, formatDate } from "../lib/format";
import type { ProfitLoss } from "../types/report";

type Preset = { label: string; from: () => string; to: () => string };

const presets: Preset[] = [
  {
    label: "This Month",
    from: () => new Date().toISOString().slice(0, 8) + "01",
    to: () => new Date().toISOString().slice(0, 10),
  },
  {
    label: "This Quarter",
    from: () => {
      const d = new Date();
      const q = Math.floor(d.getMonth() / 3);
      d.setMonth(q * 3, 1);
      return d.toISOString().slice(0, 10);
    },
    to: () => new Date().toISOString().slice(0, 10),
  },
  {
    label: "This Year",
    from: () => new Date().toISOString().slice(0, 4) + "-01-01",
    to: () => new Date().toISOString().slice(0, 10),
  },
  {
    label: "Last 12 Months",
    from: () => {
      const d = new Date();
      d.setMonth(d.getMonth() - 11);
      d.setDate(1);
      return d.toISOString().slice(0, 10);
    },
    to: () => new Date().toISOString().slice(0, 10),
  },
];

const MONTH_COLORS = ["#16A34A", "#DC2626", "#64748B", "#3B6FD4", "#D97706"];

function monthLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const d = new Date(month + "-01T00:00:00");
  return d.toLocaleDateString("en-PK", { month: "short", year: "2-digit" });
}

export function ProfitLossPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [activePreset, setActivePreset] = useState<string>("");

  const [pl, setPl] = useState<ProfitLoss | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runReq = useRef(0);

  const run = async (f: string, t: string) => {
    const req = ++runReq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await reportService.getProfitLoss(f, t);
      if (req !== runReq.current) return;
      setPl(data);
    } catch (e) {
      if (req === runReq.current) setError(String(e));
    } finally {
      if (req === runReq.current) setLoading(false);
    }
  };

  useEffect(() => {
    run(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = () => {
    if (!from || !to) {
      setError("Please select both From and To dates.");
      return;
    }
    setActivePreset("");
    run(from, to);
  };

  const applyPreset = (p: Preset) => {
    const f = p.from();
    const t = p.to();
    setFrom(f);
    setTo(t);
    setActivePreset(p.label);
    run(f, t);
  };

  const margins = (revenue: number, cogs: number, expenses: number) => ({
    gross: revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0,
    net: revenue > 0 ? ((revenue - cogs - expenses) / revenue) * 100 : 0,
  });

  const chartData = (pl?.monthly ?? []).map((m) => ({
    month: monthLabel(m.month),
    Revenue: m.revenue,
    "Gross Profit": m.gross_profit,
    "Net Profit": m.net_profit,
    Expenses: m.expenses,
  }));
  const chartHasData = chartData.some((d) => d.Revenue > 0 || d.Expenses > 0);

  const handlePrint = () => {
    document.body.classList.add("printing");
    window.print();
    document.body.classList.remove("printing");
  };

  const csvCell = (v: string | number) => {
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const handleExportCsv = () => {
    const rows: (string | number)[][] = [
      ["Mobile Shop Manager Pro - Profit & Loss Statement"],
      [`Period: ${formatDate(from)} - ${formatDate(to)}`],
      [],
      ["Total Revenue", pl?.total_revenue ?? 0],
      ["Cost of Goods Sold (COGS)", pl?.total_cogs ?? 0],
      ["Gross Profit", pl?.gross_profit ?? 0],
      ["Operating Expenses", pl?.total_expenses ?? 0],
      ["Net Profit", pl?.net_profit ?? 0],
      ["Sales Count", pl?.sales_count ?? 0],
      [],
      ["Monthly Profit Analysis"],
      ["Month", "Revenue", "COGS", "Expenses", "Gross Profit", "Net Profit"],
      ...(pl?.monthly ?? []).map((m) => [
        m.month,
        m.revenue,
        m.cogs,
        m.expenses,
        m.gross_profit,
        m.net_profit,
      ]),
    ];
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit_loss_${from}_to_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const m = margins(pl?.total_revenue ?? 0, pl?.total_cogs ?? 0, pl?.total_expenses ?? 0);

  return (
    <div>
      <PageHeader
        title="Profit & Loss"
        description="Revenue, cost of goods sold, operating expenses and profit analysis"
        breadcrumb={[{ label: "Finance & Reports" }, { label: "Profit & Loss" }]}
        meta={pl ? `${pl.sales_count} sale${pl.sales_count !== 1 ? "s" : ""}` : undefined}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              icon={<Download className="h-3.5 w-3.5" />}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              icon={<FileText className="h-3.5 w-3.5" />}
            >
              Export PDF
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              icon={<Printer className="h-3.5 w-3.5" />}
            >
              Print
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert message={error} variant="error" />
        </div>
      )}

      {/* Date Filter */}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Input label="From Date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="w-44">
            <Input label="To Date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button size="sm" onClick={handleApply} loading={loading} icon={<Filter className="h-3.5 w-3.5" />}>
            Run Statement
          </Button>
          <div className="flex flex-wrap items-center gap-1.5 pl-1">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="rounded-full px-3 py-1 text-[12px] font-medium transition-colors"
                style={
                  activePreset === p.label
                    ? { background: "#3B6FD4", color: "#fff" }
                    : { background: "#F4F6FA", color: "#475569", border: "1px solid #E2E8F0" }
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading && !pl ? (
        <div className="mt-4">
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton rounded-xl" style={{ height: "110px" }} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="skeleton col-span-2 rounded-lg" style={{ height: "320px" }} />
            <div className="skeleton rounded-lg" style={{ height: "320px" }} />
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              title="Total Revenue"
              value={formatMoney(pl?.total_revenue ?? 0)}
              icon={TrendingUp}
              tone="green"
              sub="gross sales"
            />
            <KpiCard
              title="Cost of Goods Sold"
              value={formatMoney(pl?.total_cogs ?? 0)}
              icon={Receipt}
              tone="navy"
              sub="purchased stock at cost"
            />
            <KpiCard
              title="Total Expenses"
              value={formatMoney(pl?.total_expenses ?? 0)}
              icon={TrendingDown}
              tone="red"
              sub="operating expenses"
            />
            <KpiCard
              title="Gross Profit"
              value={formatMoney(pl?.gross_profit ?? 0)}
              icon={UserCircle2}
              tone="primary"
              sub={`${m.gross.toFixed(1)}% margin`}
            />
            <KpiCard
              title="Net Profit"
              value={formatMoney(pl?.net_profit ?? 0)}
              icon={PiggyBank}
              tone={(pl?.net_profit ?? 0) >= 0 ? "green" : "red"}
              sub={`${m.net.toFixed(1)}% margin`}
              trend={{
                label: "revenue − cogs − expenses",
                direction: (pl?.net_profit ?? 0) >= 0 ? "up" : "down",
                positive: (pl?.net_profit ?? 0) >= 0,
              }}
            />
            <KpiCard
              title="Sales Count"
              value={String(pl?.sales_count ?? 0)}
              icon={Wallet}
              tone="navy"
              sub="transactions"
            />
          </div>

          {/* P&L statement */}
          <Card title="Profit & Loss Statement" subtitle={`${formatDate(from)} - ${formatDate(to)}`}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between border-b px-2 pb-2" style={{ borderColor: "#E2E8F0" }}>
                <span className="text-[13px]" style={{ color: "#0F172A" }}>
                  Total Revenue
                </span>
                <span className="amount font-semibold text-[14px]" style={{ color: "#16A34A" }}>
                  {formatMoney(pl?.total_revenue ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between px-2">
                <span className="text-[13px] pl-4" style={{ color: "#64748B" }}>
                  Less: Cost of Goods Sold (COGS)
                </span>
                <span className="amount text-[13px]" style={{ color: "#475569" }}>
                  − {formatMoney(pl?.total_cogs ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg px-2 py-1.5" style={{ background: "#F0FDF4" }}>
                <span className="text-[13px] font-semibold pl-4" style={{ color: "#166534" }}>
                  Gross Profit
                </span>
                <span className="amount font-bold text-[15px]" style={{ color: "#15803D" }}>
                  {formatMoney(pl?.gross_profit ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between px-2">
                <span className="text-[13px] pl-4" style={{ color: "#64748B" }}>
                  Less: Operating Expenses
                </span>
                <span className="amount text-[13px]" style={{ color: "#475569" }}>
                  − {formatMoney(pl?.total_expenses ?? 0)}
                </span>
              </div>
              <div
                className="flex items-center justify-between rounded-lg px-2 py-1.5"
                style={{
                  background: (pl?.net_profit ?? 0) >= 0 ? "#F0FDF4" : "#FEF2F2",
                  border: "1px solid #E2E8F0",
                }}
              >
                <span className="text-[14px] font-bold" style={{ color: "#0F172A" }}>
                  Net Profit
                </span>
                <span
                  className="amount text-[18px] font-bold"
                  style={{ color: (pl?.net_profit ?? 0) >= 0 ? "#15803D" : "#B91C1C" }}
                >
                  {formatMoney(pl?.net_profit ?? 0)}
                </span>
              </div>
            </div>
          </Card>

          {/* Monthly profit analysis */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: "#3B6FD4" }} />
              <h2 className="text-[15px] font-bold" style={{ color: "#0F172A" }}>Monthly Profit Analysis</h2>
            </div>

            <Card title="Revenue vs Expenses vs Profit" subtitle="Monthly comparison in selected period">
              {!chartHasData ? (
                <EmptyState
                  icon={TrendingUp}
                  title="No activity in this period"
                  description="Monthly profit data will appear here once there are sales or expenses."
                />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "#64748B" }}
                      axisLine={{ stroke: "#E2E8F0" }}
                      tickLine={false}
                      minTickGap={14}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748B" }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                      tickFormatter={(v: number) => formatMoneyCompact(v)}
                    />
                    <Tooltip
                      formatter={(value) => formatMoney(Number(value) || 0)}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Revenue" fill="#3B6FD4" radius={[3, 3, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="Expenses" fill="#DC2626" radius={[3, 3, 0, 0]} maxBarSize={20} />
                    <Line type="monotone" dataKey="Net Profit" stroke="#16A34A" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Card>

            <div className="mt-4">
              <Card title="Monthly Breakdown" subtitle="Detailed monthly figures" noPadding>
                {pl?.monthly.length === 0 ? (
                  <div className="p-6">
                    <EmptyState icon={TrendingDown} title="No data" description="No monthly data in this period." />
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th className="text-right">Revenue</th>
                        <th className="text-right">COGS</th>
                        <th className="text-right">Expenses</th>
                        <th className="text-right">Gross Profit</th>
                        <th className="text-right">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pl?.monthly ?? []).map((point) => (
                        <tr key={point.month}>
                          <td>
                            <span className="font-semibold" style={{ fontSize: "13px", color: "#0F172A" }}>
                              {monthLabel(point.month)}
                            </span>
                            <span style={{ color: "#94A3B8", fontSize: "11px", marginLeft: 6 }}>{point.month}</span>
                          </td>
                          <td className="text-right">
                            <span className="amount text-[13px]" style={{ color: "#16A34A" }}>
                              {formatMoney(point.revenue)}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className="amount text-[12px]" style={{ color: "#64748B" }}>
                              {formatMoney(point.cogs)}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className="amount text-[13px]" style={{ color: "#DC2626" }}>
                              {formatMoney(point.expenses)}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className="amount text-[13px]" style={{ color: "#3B6FD4" }}>
                              {formatMoney(point.gross_profit)}
                            </span>
                          </td>
                          <td className="text-right">
                            <span
                              className="amount font-semibold text-[13px]"
                              style={{ color: point.net_profit >= 0 ? "#15803D" : "#B91C1C" }}
                            >
                              {formatMoney(point.net_profit)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>

            {/* Monthly margin visualization */}
            {pl && pl.monthly.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
                {[...pl.monthly]
                  .slice(-5)
                  .reverse()
                  .map((point, idx) => {
                    const pm = margins(point.revenue, point.cogs, point.expenses);
                    const color = MONTH_COLORS[idx % MONTH_COLORS.length];
                    return (
                      <Card key={point.month}>
                        <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>
                          {monthLabel(point.month)}
                        </div>
                        <div className="mt-1 text-[18px] font-bold" style={{ color }}>
                          {formatMoneyCompact(point.net_profit)}
                        </div>
                        <div className="text-[11px]" style={{ color: "#94A3B8" }}>
                          Net profit · {pm.net.toFixed(1)}% margin
                        </div>
                        <div className="mt-2 h-1.5 rounded-full" style={{ background: "#F1F5F9" }}>
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.max(0, Math.min(100, (point.net_profit / Math.max(pl.total_revenue, 1)) * 100))}%`,
                              background: point.net_profit >= 0 ? "#16A34A" : "#DC2626",
                            }}
                          />
                        </div>
                      </Card>
                    );
                  })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}