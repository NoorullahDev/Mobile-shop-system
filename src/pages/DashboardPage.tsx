import { useEffect } from "react";
import {
  TrendingUp,
  CircleDollarSign,
  Package,
  Users,
  Banknote,
  AlertTriangle,
  ArrowUpRight,
  Activity,
  Plus,
  Clock,
  ShoppingBag,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/Badge";
import { KpiCard } from "../components/KpiCard";
import { Button } from "../components/Button";
import { useReportStore } from "../store/reports";
import { useNavigate } from "react-router-dom";
import {
  formatMoney,
  formatMoneyCompact,
  formatDateTime,
} from "../lib/format";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(m: string) {
  const mo = m.split("-")[1];
  return MONTHS[parseInt(mo, 10) - 1] ?? mo;
}

export function DashboardPage() {
  const {
    summary,
    revenueSeries,
    expenseSeries,
    activity,
    loading,
    error,
    load,
  } = useReportStore();
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, [load]);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PK", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const chartData = revenueSeries.map((p) => {
    const exp = expenseSeries.find((e) => e.month === p.month);
    return {
      month: monthLabel(p.month),
      Revenue: p.total,
      Expenses: exp?.total ?? 0,
    };
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={dateStr}
        actions={
          <Button variant="secondary" size="sm" onClick={() => load()}>
            <Activity className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert message={error} variant="error" />
        </div>
      )}

      {summary?.low_stock_count ? (
        <div className="mb-4">
          <Alert
            message={`${summary.low_stock_count} product(s) are at or below the minimum stock threshold. Consider restocking soon.`}
            variant="warning"
            title="Low Stock Alert"
          />
        </div>
      ) : null}

      {loading && !summary ? (
        <div>
          <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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
        <>
          {/* KPI Cards */}
          <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard
              title="Today's Sales"
              value={formatMoneyCompact(summary?.today_revenue ?? 0)}
              sub={`${summary?.today_sales_count ?? 0} transactions`}
              icon={ShoppingBag}
              tone="primary"
              onClick={() => navigate("/sales")}
            />
            <KpiCard
              title="Total Revenue"
              value={formatMoney(summary?.revenue ?? 0)}
              sub="All-time sales"
              icon={Banknote}
              tone="navy"
              onClick={() => navigate("/sales")}
            />
            <KpiCard
              title="Total Profit"
              value={formatMoney(summary?.profit ?? 0)}
              sub="Revenue − expenses"
              icon={TrendingUp}
              tone="green"
            />
            <KpiCard
              title="Products"
              value={String(summary?.products_total ?? 0)}
              sub={`${summary?.low_stock_count ?? 0} low in stock`}
              icon={Package}
              tone="amber"
              onClick={() => navigate("/inventory")}
            />
            <KpiCard
              title="Customers"
              value={String(summary?.members_total ?? 0)}
              sub={`${summary?.members_active ?? 0} active`}
              icon={Users}
              tone="purple"
              onClick={() => navigate("/members")}
            />
            <KpiCard
              title="Customer Dues"
              value={formatMoney(summary?.pending_payments ?? 0)}
              sub="Outstanding balance"
              icon={CircleDollarSign}
              tone="red"
              onClick={() => navigate("/payments")}
            />
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Recharts trend */}
            <div className="lg:col-span-2">
              <Card title="Revenue vs Expenses" subtitle="Last 12 months — monthly trend">
                {chartData.length === 0 || chartData.every((d) => d.Revenue === 0 && d.Expenses === 0) ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No chart data yet"
                    description="Sales and expense data will appear here once recorded."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "#64748B" }}
                        axisLine={{ stroke: "#E2E8F0" }}
                        tickLine={false}
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
                      <Bar dataKey="Revenue" fill="#3B6FD4" radius={[3, 3, 0, 0]} maxBarSize={22} />
                      <Bar dataKey="Expenses" fill="#FDA4AF" radius={[3, 3, 0, 0]} maxBarSize={22} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-4">
              <Card title="Quick Actions">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: "New Sale",
                      to: "/sales/new",
                      primary: true,
                    },
                    { label: "Add Customer", to: "/members" },
                    { label: "Add Stock", to: "/inventory" },
                    { label: "Add Expense", to: "/expenses" },
                  ].map(({ label, to, primary }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => navigate(to)}
                      className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
                      style={
                        primary
                          ? { background: "#3B6FD4", color: "#FFFFFF" }
                          : {
                              background: "#F4F6FA",
                              color: "#0F172A",
                              border: "1px solid #E2E8F0",
                            }
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </Card>

              <Card title="Recent Activity" noPadding>
                {activity.length === 0 ? (
                  <div className="p-4">
                    <EmptyState icon={Clock} title="No activity yet" description="System actions will appear here." />
                  </div>
                ) : (
                  <ul>
                    {activity.slice(0, 8).map((a, i) => (
                      <li
                        key={a.id}
                        className="flex items-start gap-3 px-4 py-2.5"
                        style={{ borderBottom: i < Math.min(activity.length, 8) - 1 ? "1px solid #F1F5F9" : "none" }}
                      >
                        <div
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold uppercase text-white"
                          style={{ background: "#3B6FD4" }}
                        >
                          {a.module?.charAt(0) ?? "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Badge>{a.action}</Badge>
                          <div
                            className="mt-0.5 truncate text-[12px] capitalize"
                            style={{ color: "#334155" }}
                          >
                            {a.module}
                          </div>
                        </div>
                        <div className="shrink-0 text-[11px]" style={{ color: "#94A3B8" }}>
                          {formatDateTime(a.timestamp).split(",")[1]?.trim() ?? ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          {/* Stock alert card */}
          {summary && summary.low_stock_count > 0 && (
            <div className="mt-4">
              <Card
                title="Stock Alerts"
                actions={
                  <Button variant="ghost" size="sm" onClick={() => navigate("/inventory")}>
                    View All <ArrowUpRight className="h-3 w-3" />
                  </Button>
                }
              >
                <div
                  className="flex items-center gap-3 rounded-lg px-4 py-3"
                  style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
                >
                  <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "#D97706" }} />
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: "#92400E" }}>
                      {summary.low_stock_count} product{summary.low_stock_count !== 1 ? "s" : ""} below minimum threshold
                    </div>
                    <div className="text-[12px]" style={{ color: "#B45309" }}>
                      Visit Mobile Phones or Accessories to review and restock.
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
