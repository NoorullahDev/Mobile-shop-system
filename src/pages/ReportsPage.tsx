import { useEffect, useRef, useState } from "react";
import {
  TrendingUp,
  ShoppingCart,
  Filter,
  Wallet,
  Receipt,
  CreditCard,
  Printer,
  Download,
  Package,
  Users,
  Building2,
  Smartphone,
  Headphones,
  Boxes,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { PrintReport } from "../components/PrintReport";
import * as reportService from "../services/reportService";
import * as expenseService from "../services/expenseService";
import * as paymentService from "../services/paymentService";
import * as purchaseService from "../services/purchaseService";
import * as inventoryService from "../services/inventoryService";
import { formatMoney, formatMoneyCompact, formatDate } from "../lib/format";
import type { PeriodSummary, PaymentBreakdown, TopSeller } from "../types/report";
import type { CategoryTotal, Expense } from "../types/expense";
import type { MemberBalance } from "../types/payment";
import type { SupplierBalance } from "../types/purchase";
import type { Phone } from "../types/inventory";
import type { Accessory } from "../types/inventory";

const methodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  credit: "Credit",
  other: "Other",
};

const BREAKDOWN_COLORS = ["#3B6FD4", "#16A34A", "#7C3AED", "#D97706", "#64748B"];

function formatDay(day: string) {
  const d = new Date(day + "T00:00:00");
  if (isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

type Preset = { label: string; from: () => string; to: () => string };

const presets: Preset[] = [
  {
    label: "Today",
    from: () => new Date().toISOString().slice(0, 10),
    to: () => new Date().toISOString().slice(0, 10),
  },
  {
    label: "This Week",
    from: () => {
      const d = new Date();
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      return d.toISOString().slice(0, 10);
    },
    to: () => new Date().toISOString().slice(0, 10),
  },
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
];

export function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [activePreset, setActivePreset] = useState<string>("");

  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salesSeries, setSalesSeries] = useState<{ day: string; label: string; Revenue: number }[]>([]);
  const [breakdown, setBreakdown] = useState<PaymentBreakdown[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [customerDues, setCustomerDues] = useState<MemberBalance[]>([]);
  const [supplierDues, setSupplierDues] = useState<SupplierBalance[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runReq = useRef(0);

  const run = async (f: string, t: string) => {
    const req = ++runReq.current;
    setLoading(true);
    setError(null);
    try {
      const [s, cats, series, bd, top, exp, cDues, sDues, phoneList, accList] = await Promise.all([
        reportService.getPeriodSummary(f, t),
        expenseService.expenseCategoryTotals(f, t),
        reportService.getSalesSeries(f, t),
        reportService.getPaymentBreakdown(f, t),
        reportService.getTopSellers(f, t, 10),
        expenseService.listExpenses(null, f, t),
        paymentService.listCustomerDues(),
        purchaseService.listSupplierDues(),
        inventoryService.listPhones(),
        inventoryService.listAccessories(),
      ]);
      if (req !== runReq.current) return;
      setSummary(s);
      setByCategory(cats);
      setSalesSeries(series.map((p) => ({ day: p.day, label: formatDay(p.day), Revenue: p.total })));
      setBreakdown(bd);
      setTopSellers(top);
      setExpenses(exp);
      setCustomerDues(cDues);
      setSupplierDues(sDues);
      setPhones(phoneList);
      setAccessories(accList);
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

  const chartHasData = salesSeries.some((d) => d.Revenue > 0);
  const breakdownTotal = breakdown.reduce((s, b) => s + b.total, 0);

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
      ["Mobile Shop Manager Pro - Reports"],
      [`Period: ${formatDate(from)} - ${formatDate(to)}`],
      [],
      ["Sales Summary"],
      ["Metric", "Value"],
      ["Gross Revenue", summary?.revenue ?? 0],
      ["Cash Received", summary?.received ?? 0],
      ["Outstanding (Credit)", summary?.outstanding ?? 0],
      ["Discounts Given", summary?.discount ?? 0],
      ["Sales Count", summary?.sales_count ?? 0],
      [],
      ["Sales Revenue by Day"],
      ["Date", "Revenue"],
      ...salesSeries.map((d) => [d.day, d.Revenue]),
      [],
      ["Payment Method Mix"],
      ["Method", "Count", "Total"],
      ...breakdown.map((b) => [methodLabels[b.payment_method] ?? b.payment_method, b.count, b.total]),
      [],
      ["Top Selling Products"],
      ["#", "Product", "Qty Sold", "Revenue"],
      ...topSellers.map((t, i) => [i + 1, t.product_name, t.quantity, t.revenue]),
      [],
      ["Inventory Summary"],
      ["Metric", "Value"],
      ["Mobile Phones (SKUs)", phones.length],
      ["Accessories (SKUs)", accessories.length],
      ["Phone Units", phones.reduce((s, p) => s + p.quantity, 0)],
      ["Accessory Units", accessories.reduce((s, a) => s + a.quantity, 0)],
      [],
      ["Outstanding Customer Balances"],
      ["Customer", "Balance"],
      ...customerDues
        .filter((d) => d.balance > 0)
        .map((d) => [d.member_name, d.balance]),
      [],
      ["Outstanding Supplier Balances"],
      ["Supplier", "Balance"],
      ...supplierDues
        .filter((d) => d.balance > 0)
        .map((d) => [d.supplier_name, d.balance]),
    ];
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports_${from}_to_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalUnits = phones.reduce((s, p) => s + p.quantity, 0) + accessories.reduce((s, a) => s + a.quantity, 0);
  const lowStockItems = [...phones, ...accessories].filter(
    (i) => i.low_stock_threshold > 0 && i.quantity <= i.low_stock_threshold,
  ).length;
  const outOfStockItems = [...phones, ...accessories].filter((i) => i.quantity === 0).length;
  const phoneValue = phones.reduce((s, p) => s + p.quantity * p.cost_price, 0);
  const accValue = accessories.reduce((s, a) => s + a.quantity * a.cost_price, 0);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Sales, product, inventory, customer and supplier reports"
        breadcrumb={[{ label: "Finance & Reports" }, { label: "Reports" }]}
        meta={summary ? `${summary.sales_count} sale${summary.sales_count !== 1 ? "s" : ""}` : undefined}
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
            Generate Report
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

      {loading && !summary ? (
        <div className="mt-4">
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton rounded-xl" style={{ height: "110px" }} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="skeleton col-span-2 rounded-lg" style={{ height: "300px" }} />
            <div className="skeleton rounded-lg" style={{ height: "300px" }} />
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {/* ============ SALES REPORTS ============ */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: "#3B6FD4" }} />
              <h2 className="text-[15px] font-bold" style={{ color: "#0F172A" }}>Sales Reports</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
              <KpiCard
                title="Gross Revenue"
                value={formatMoney(summary?.revenue ?? 0)}
                icon={TrendingUp}
                tone="green"
                sub={`${summary?.sales_count ?? 0} sales`}
              />
              <KpiCard
                title="Cash Received"
                value={formatMoney(summary?.received ?? 0)}
                icon={Wallet}
                tone="primary"
                sub="at point of sale"
              />
              <KpiCard
                title="Outstanding (Credit)"
                value={formatMoney(summary?.outstanding ?? 0)}
                icon={Receipt}
                tone="amber"
                sub="open receivables"
              />
              <KpiCard
                title="Discounts Given"
                value={formatMoney(summary?.discount ?? 0)}
                icon={ShoppingCart}
                tone="navy"
              />
              <KpiCard
                title="Sales Count"
                value={String(summary?.sales_count ?? 0)}
                icon={Receipt}
                tone="navy"
                sub="transactions"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card title="Sales Revenue Trend" subtitle="Daily revenue in selected period">
                  {!chartHasData ? (
                    <EmptyState
                      icon={TrendingUp}
                      title="No sales in this period"
                      description="Sales data will appear here once you make sales within the selected range."
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <ComposedChart data={salesSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B6FD4" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#3B6FD4" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis
                          dataKey="label"
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
                          formatter={(value, name) =>
                            formatMoney(Number(value) || 0) + (name ? ` (${String(name)})` : "")
                          }
                          contentStyle={{
                            fontSize: 12,
                            borderRadius: 8,
                            border: "1px solid #E2E8F0",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area type="monotone" dataKey="Revenue" stroke="#3B6FD4" strokeWidth={2} fill="url(#revGrad)" />
                        <Bar dataKey="Revenue" fill="#93C5FD" radius={[3, 3, 0, 0]} maxBarSize={18} opacity={0.55} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </div>

              <Card title="Payment Method Mix" subtitle="How sales were paid">
                {breakdown.length === 0 ? (
                  <EmptyState icon={CreditCard} title="No data" description="No sales in this period." />
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={breakdown}
                            dataKey="total"
                            nameKey="payment_method"
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={64}
                            paddingAngle={2}
                          >
                            {breakdown.map((b, i) => (
                              <Cell key={b.payment_method} fill={BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => formatMoney(Number(value) || 0)}
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {breakdown.map((b, i) => {
                        const pct = breakdownTotal > 0 ? (b.total / breakdownTotal) * 100 : 0;
                        return (
                          <div key={b.payment_method} className="flex items-center justify-between text-[12px]">
                            <span className="flex items-center gap-2" style={{ color: "#334155" }}>
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ background: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] }}
                              />
                              {methodLabels[b.payment_method] ?? b.payment_method}
                              <span style={{ color: "#94A3B8" }}>({b.count})</span>
                            </span>
                            <span className="amount font-semibold" style={{ color: "#0F172A" }}>
                              {formatMoney(b.total)}
                              <span style={{ color: "#94A3B8", marginLeft: 6 }}>{pct.toFixed(0)}%</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </section>

          {/* ============ PRODUCT REPORTS ============ */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Boxes className="h-4 w-4" style={{ color: "#3B6FD4" }} />
              <h2 className="text-[15px] font-bold" style={{ color: "#0F172A" }}>Product Reports</h2>
            </div>
            <Card title="Top Selling Products" subtitle="By sales revenue in selected period" noPadding>
              {topSellers.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={ShoppingCart} title="No sales yet" description="Top sellers will appear here." />
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th className="text-right">Qty Sold</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSellers.map((t, i) => {
                      const share = summary && summary.revenue > 0 ? (t.revenue / summary.revenue) * 100 : 0;
                      return (
                        <tr key={`${t.item_type}-${t.item_id}`}>
                          <td style={{ color: "#94A3B8", fontSize: "12px" }}>{i + 1}</td>
                          <td>
                            <span className="font-semibold" style={{ fontSize: "13px", color: "#0F172A" }}>
                              {t.product_name}
                            </span>
                            <span
                              className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                              style={{
                                background: t.item_type === "phone" ? "#DBEAFE" : "#E0F2FE",
                                color: t.item_type === "phone" ? "#1D4ED8" : "#0369A1",
                              }}
                            >
                              {t.item_type}
                            </span>
                          </td>
                          <td className="text-right" style={{ fontSize: "13px", color: "#475569" }}>
                            {t.quantity}
                          </td>
                          <td className="text-right">
                            <span className="amount font-semibold text-[13px]" style={{ color: "#0F172A" }}>
                              {formatMoney(t.revenue)}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className="amount text-[13px]" style={{ color: "#3B6FD4" }}>
                              {share.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          </section>

          {/* ============ INVENTORY REPORTS ============ */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" style={{ color: "#3B6FD4" }} />
              <h2 className="text-[15px] font-bold" style={{ color: "#0F172A" }}>Inventory Reports</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <KpiCard
                title="Phone SKUs"
                value={String(phones.length)}
                icon={Smartphone}
                tone="primary"
                sub={`${phones.reduce((s, p) => s + p.quantity, 0)} units in stock`}
              />
              <KpiCard
                title="Accessory SKUs"
                value={String(accessories.length)}
                icon={Headphones}
                tone="green"
                sub={`${accessories.reduce((s, a) => s + a.quantity, 0)} units in stock`}
              />
              <KpiCard
                title="Stock Value (at cost)"
                value={formatMoneyCompact(phoneValue + accValue)}
                icon={Package}
                tone="navy"
                sub={`${totalUnits} total units`}
              />
              <KpiCard
                title="Stock Alerts"
                value={String(lowStockItems)}
                icon={Package}
                tone={lowStockItems > 0 ? "amber" : "green"}
                sub={`${outOfStockItems} out of stock`}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title="Mobile Phone Stock" subtitle="Current inventory levels" noPadding>
                {phones.length === 0 ? (
                  <div className="p-6">
                    <EmptyState icon={Smartphone} title="No phones" description="Add phones to track stock." />
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th className="text-right">Cost</th>
                        <th className="text-right">Sale</th>
                        <th className="text-center">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phones.slice(0, 8).map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span className="font-semibold" style={{ fontSize: "13px", color: "#0F172A" }}>
                              {p.brand} {p.model}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className="amount text-[12px]" style={{ color: "#64748B" }}>
                              {formatMoneyCompact(p.cost_price)}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className="amount text-[12px]" style={{ color: "#0F172A" }}>
                              {formatMoneyCompact(p.sale_price)}
                            </span>
                          </td>
                          <td className="text-center">{p.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
              <Card title="Accessory Stock" subtitle="Current inventory levels" noPadding>
                {accessories.length === 0 ? (
                  <div className="p-6">
                    <EmptyState icon={Headphones} title="No accessories" description="Add accessories to track stock." />
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-right">Cost</th>
                        <th className="text-right">Sale</th>
                        <th className="text-center">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessories.slice(0, 8).map((a) => (
                        <tr key={a.id}>
                          <td>
                            <span className="font-semibold" style={{ fontSize: "13px", color: "#0F172A" }}>
                              {a.brand} {a.product_name}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className="amount text-[12px]" style={{ color: "#64748B" }}>
                              {formatMoneyCompact(a.cost_price)}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className="amount text-[12px]" style={{ color: "#0F172A" }}>
                              {formatMoneyCompact(a.sale_price)}
                            </span>
                          </td>
                          <td className="text-center">{a.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          </section>

          {/* ============ CUSTOMER REPORTS ============ */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: "#3B6FD4" }} />
              <h2 className="text-[15px] font-bold" style={{ color: "#0F172A" }}>Customer Reports</h2>
            </div>
            <Card title="Customer Balances" subtitle="Outstanding credit balances by customer" noPadding>
              {customerDues.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={Users} title="No customers" description="Customer balances will appear here." />
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th className="text-right">Total Credit</th>
                      <th className="text-right">Total Paid</th>
                      <th className="text-right">Balance</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerDues.map((d) => (
                      <tr key={d.member_id}>
                        <td>
                          <span className="font-semibold" style={{ fontSize: "13px", color: "#0F172A" }}>
                            {d.member_name}
                          </span>
                        </td>
                        <td style={{ color: "#64748B", fontSize: "12px" }}>{d.phone ?? "—"}</td>
                        <td className="text-right">
                          <span className="amount text-[12px]" style={{ color: "#475569" }}>
                            {formatMoney(d.total_credit)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="amount text-[12px]" style={{ color: "#16A34A" }}>
                            {formatMoney(d.total_paid)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span
                            className="amount font-semibold text-[13px]"
                            style={{ color: d.balance > 0 ? "#B45309" : "#16A34A" }}
                          >
                            {formatMoney(d.balance)}
                          </span>
                        </td>
                        <td className="text-center">
                          <StatusBadge status={d.balance > 0 ? "owed" : "settled"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </section>

          {/* ============ SUPPLIER REPORTS ============ */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4" style={{ color: "#3B6FD4" }} />
              <h2 className="text-[15px] font-bold" style={{ color: "#0F172A" }}>Supplier Reports</h2>
            </div>
            <Card title="Supplier Balances" subtitle="Outstanding payables by supplier" noPadding>
              {supplierDues.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={Building2} title="No suppliers" description="Supplier balances will appear here." />
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Phone</th>
                      <th className="text-right">Total Purchases</th>
                      <th className="text-right">Total Paid</th>
                      <th className="text-right">Balance</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierDues.map((d) => (
                      <tr key={d.supplier_id}>
                        <td>
                          <span className="font-semibold" style={{ fontSize: "13px", color: "#0F172A" }}>
                            {d.supplier_name}
                          </span>
                        </td>
                        <td style={{ color: "#64748B", fontSize: "12px" }}>{d.phone ?? "—"}</td>
                        <td className="text-right">
                          <span className="amount text-[12px]" style={{ color: "#475569" }}>
                            {formatMoney(d.total_purchases)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="amount text-[12px]" style={{ color: "#16A34A" }}>
                            {formatMoney(d.total_paid)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span
                            className="amount font-semibold text-[13px]"
                            style={{ color: d.balance > 0 ? "#DC2626" : "#16A34A" }}
                          >
                            {formatMoney(d.balance)}
                          </span>
                        </td>
                        <td className="text-center">
                          <StatusBadge status={d.balance > 0 ? "owed" : "settled"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </section>
        </div>
      )}
      <PrintReport
        from={from}
        to={to}
        summary={summary}
        byCategory={byCategory}
        expenses={expenses}
        salesSeries={salesSeries}
        breakdown={breakdown}
        topSellers={topSellers}
        customerDues={customerDues.reduce((sum, d) => sum + d.balance, 0)}
        supplierDues={supplierDues.reduce((sum, d) => sum + d.balance, 0)}
      />
    </div>
  );
}