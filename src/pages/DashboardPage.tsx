import { useEffect, useRef, useState } from "react";
import {
  TrendingUp,
  Package,
  Users,
  Banknote,
  AlertTriangle,
  Activity,
  ShoppingBag,
  Calendar,
  RefreshCw,
  CreditCard,
  PackagePlus,
  ReceiptText,
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
import { KpiCard } from "../components/KpiCard";
import { Button } from "../components/Button";
import { useReportStore } from "../store/reports";
import { useSessionStore } from "../store/session";
import { useSettingsStore } from "../store/settings";
import { useNavigate } from "react-router-dom";
import {
  formatMoney,
  formatMoneyCompact,
  formatDashboardReportKpiMoney,
  formatDateTime,
  toLocalDate,
} from "../lib/format";

// Additional imports for real data
import { getTopSellers, getPeriodSummary, getSalesSeries, getPaymentBreakdown } from "../services/reportService";
import { listSales } from "../services/saleService";
import { listProducts } from "../services/inventoryService";
import { listReturns } from "../services/returnService";
import { listMembers } from "../services/memberService";
import { listCustomerDues } from "../services/paymentService";
import { listSupplierDues } from "../services/purchaseService";
import type { TopSeller, PeriodSummary, SalePoint, PaymentBreakdown } from "../types/report";
import type { Sale } from "../types/sale";
import type { Product } from "../types/inventory";
import type { ReturnSummary } from "../types/return";
import type { Member } from "../types/member";
import type { MemberBalance } from "../types/payment";
import type { SupplierBalance } from "../types/purchase";

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
    loading,
    error,
    load,
  } = useReportStore();
  const user = useSessionStore((s) => s.user);
  const ownerName = useSettingsStore((s) => s.ownerName);
  const navigate = useNavigate();

  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [outOfStock, setOutOfStock] = useState<Product[]>([]);
  const [supplierDues, setSupplierDues] = useState<SupplierBalance[]>([]);
  const [recentReturns, setRecentReturns] = useState<ReturnSummary[]>([]);
  const [membersWithDues, setMembersWithDues] = useState<MemberBalance[]>([]);
  const [totalMembers, setTotalMembers] = useState<Member[]>([]);

  const [period, setPeriod] = useState("today");
  const [periodSummary, setPeriodSummary] = useState<PeriodSummary | null>(null);
  const [dailySales, setDailySales] = useState<SalePoint[]>([]);
  const [extraError, setExtraError] = useState<string | null>(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown[]>([]);
  const dashReq = useRef(0);

  const fetchDashboardData = async () => {
    const req = ++dashReq.current;
    load();
    setExtraError(null);
    try {
      const now = new Date();
      const to = toLocalDate(now);
      let from = to;

      if (period === "week") {
        const start = new Date(now);
        const dayFromMonday = (now.getDay() + 6) % 7;
        start.setDate(now.getDate() - dayFromMonday);
        from = toLocalDate(start);
      } else if (period === "month") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        from = toLocalDate(start);
      } else if (period === "year") {
        const start = new Date(now.getFullYear(), 0, 1);
        from = toLocalDate(start);
      }

      const [periodData, top, seriesData, payBreakdown] = await Promise.all([
        getPeriodSummary(from, to),
        getTopSellers(from, to, 5),
        (period === "week" || period === "month") ? getSalesSeries(from, to) : Promise.resolve([]),
        getPaymentBreakdown(from, to),
      ]);

      if (req !== dashReq.current) return;
      setPeriodSummary(periodData);
      setTopSellers(top);
      setDailySales(seriesData);
      setPaymentBreakdown(payBreakdown);

      const [salesData, productsData, supplierDueData, returnsList, membersData, customerDueData] = await Promise.all([
        listSales(),
        listProducts(),
        listSupplierDues(),
        listReturns(),
        listMembers(),
        listCustomerDues(),
      ]);

      if (req !== dashReq.current) return;
      setRecentSales(salesData.slice(0, 5));
      setOutOfStock(productsData.filter((p) => p.quantity <= 0));
      setSupplierDues(supplierDueData);
      setRecentReturns(returnsList.slice(0, 5));
      setMembersWithDues(customerDueData);
      setTotalMembers(membersData);
    } catch (err) {
      if (req !== dashReq.current) return;
      console.error("Failed to load extra dashboard data", err);
      setExtraError("Failed to load dashboard details. Showing limited data.");
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [period, load]);

  const fallbackName = user?.username ? user.username.charAt(0).toUpperCase() + user.username.slice(1) : "Noor";
  const displayWelcomeName = ownerName || fallbackName;
  const periodLabel = period === "today" ? "Today" : period === "week" ? "This Week" : period === "month" ? "This Month" : "This Year";

  let displayChartData: any[] = [];
  if (period === "year" || period === "today") {
    displayChartData = revenueSeries.map((p) => {
      const exp = expenseSeries.find((e) => e.month === p.month);
      return {
        name: monthLabel(p.month),
        Sales: p.total,
        Expenses: exp?.total ?? 0,
      };
    });
  } else {
    displayChartData = dailySales.map((d) => {
      const dateParts = d.day.split("-");
      const name = `${parseInt(dateParts[2], 10)} ${monthLabel(d.day.substring(0, 7)).substring(0, 3)}`;
      return {
        name,
        Sales: d.total,
        Expenses: 0,
      };
    });
  }

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        description={
          <div>
            <div className="text-[13px]" style={{ color: "#0F172A" }}>Welcome back, {displayWelcomeName} 👋</div>
            <div className="mt-0.5 text-[13px]" style={{ color: "#64748B" }}>Here's what's happening in your mobile shop today.</div>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                className="h-8 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] pl-8 pr-3 text-[13px] font-medium text-[#0F172A] outline-none transition-all hover:bg-[#F8FAFC] appearance-none cursor-pointer"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                style={{ paddingRight: '1rem' }}
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#0F172A]" />
            </div>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert message={error} variant="error" />
        </div>
      )}

      {extraError && (
        <div className="mb-4">
          <Alert message={extraError} variant="warning" />
        </div>
      )}

      {loading && !summary ? (
        <div>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton rounded-xl" style={{ height: "80px" }} />
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
          <div className="dashboard-kpis mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              title={`Sales ${periodLabel}`}
              value={formatDashboardReportKpiMoney(periodSummary?.revenue ?? 0)}
              valueTitle={formatMoney(periodSummary?.revenue ?? 0)}
              sub={`${periodSummary?.sales_count ?? 0} transactions`}
              icon={ShoppingBag}
              tone="primary"
              compact
              onClick={() => navigate("/sales")}
            />
            <KpiCard
              title={`Received ${periodLabel}`}
              value={formatDashboardReportKpiMoney(periodSummary?.received ?? 0)}
              valueTitle={formatMoney(periodSummary?.received ?? 0)}
              sub="Payments received in period"
              icon={Banknote}
              tone="green"
              compact
            />
            <KpiCard
              title={`Transactions ${periodLabel}`}
              value={String(periodSummary?.sales_count ?? 0)}
              sub="Sales transactions"
              icon={Calendar}
              tone="purple"
              compact
              onClick={() => navigate("/sales")}
            />
            <KpiCard
              title={`Online Payments ${periodLabel}`}
              value={formatDashboardReportKpiMoney(periodSummary?.online_received ?? 0)}
              valueTitle={formatMoney(periodSummary?.online_received ?? 0)}
              sub={`${paymentBreakdown.filter((b) => b.payment_method !== "cash").reduce((sum, b) => sum + b.count, 0)} online transactions`}
              icon={CreditCard}
              tone="cyan"
              compact
              onClick={() => navigate("/online-payments")}
            />
            <KpiCard
              title="Customer Dues"
              value={formatDashboardReportKpiMoney(membersWithDues.reduce((sum, member) => sum + member.balance, 0))}
              valueTitle={formatMoney(membersWithDues.reduce((sum, member) => sum + member.balance, 0))}
              sub={`${membersWithDues.length} customers pending`}
              icon={Users}
              tone="amber"
              compact
              onClick={() => navigate("/payments")}
            />
            <KpiCard
              title="Low / Out of Stock"
              value={String(Math.max(summary?.low_stock_count ?? 0, outOfStock.length))}
              sub={`${outOfStock.length} products out of stock`}
              icon={AlertTriangle}
              tone="red"
              compact
              onClick={() => navigate("/inventory")}
            />
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
            {/* Recharts trend */}
            <div className="lg:col-span-2">
              <Card className="dashboard-panel" title="Sales vs Expenses" subtitle={period === "year" || period === "today" ? "Last 12 months · monthly trend" : "Daily sales trend"}>
                {displayChartData.length === 0 || displayChartData.every((d) => d.Sales === 0 && d.Expenses === 0) ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No chart data yet"
                    description="Sales and expense data will appear here once recorded."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={205}>
                    <ComposedChart data={displayChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis
                        dataKey="name"
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
                      <Bar dataKey="Sales" fill="#3B6FD4" radius={[3, 3, 0, 0]} maxBarSize={22} />
                      {(period === "year" || period === "today") && <Bar dataKey="Expenses" fill="#FDA4AF" radius={[3, 3, 0, 0]} maxBarSize={22} />}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-3 lg:row-span-2">
              <Card className="dashboard-panel" title="Quick Actions">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: "New Sale",
                      to: "/sales/new",
                      primary: true,
                      icon: ShoppingBag,
                    },
                    { label: "Receive Payment", to: "/payments", icon: Banknote },
                    { label: "Add Customer", to: "/members", icon: Users },
                    { label: "Add Product", to: "/inventory", icon: Package },
                    { label: "Record Purchase", to: "/purchases", icon: PackagePlus },
                    { label: "Add Expense", to: "/expenses", icon: ReceiptText },
                  ].map(({ label, to, primary, icon: ActionIcon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => navigate(to)}
                      className="flex items-center justify-start gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
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
                      <ActionIcon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </Card>

              <Card
                className="dashboard-panel"
                title="Business Alerts"
                actions={
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                }
                noPadding
              >
                <div className="flex flex-col">
                  {summary && summary.low_stock_count > 0 && (
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF2F2] text-[#DC2626]">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#0F172A]">Low Stock Products</div>
                          <div className="text-[12px] text-[#64748B]">{summary.low_stock_count} products are low in stock</div>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => navigate("/inventory")}>
                        <span className="text-[#DC2626]">View</span>
                      </Button>
                    </div>
                  )}

                  {outOfStock.length > 0 && (
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF3C7] text-[#D97706]">
                          <Package className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#0F172A]">Out of Stock</div>
                          <div className="text-[12px] text-[#64748B]">{outOfStock.length} products are out of stock</div>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => navigate("/inventory")}>
                        <span className="text-[#DC2626]">View</span>
                      </Button>
                    </div>
                  )}

                  {membersWithDues.length > 0 && (
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#2563EB]">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#0F172A]">Customer Dues</div>
                          <div className="text-[12px] text-[#64748B]">
                            {formatMoney(membersWithDues.reduce((sum, member) => sum + member.balance, 0))} outstanding from {membersWithDues.length} customers
                          </div>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => navigate("/payments")}>
                        <span className="text-[#DC2626]">View</span>
                      </Button>
                    </div>
                  )}

                  {supplierDues.length > 0 && (
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EDE9FE] text-[#7C3AED]">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#0F172A]">Supplier Payments Due</div>
                          <div className="text-[12px] text-[#64748B]">
                            {formatMoney(supplierDues.reduce((sum, supplier) => sum + supplier.balance, 0))} due to {supplierDues.length} suppliers
                          </div>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => navigate("/supplier-dues")}>
                        <span className="text-[#DC2626]">View</span>
                      </Button>
                    </div>
                  )}

                  {recentReturns.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#DCFCE7] text-[#16A34A]">
                          <RefreshCw className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#0F172A]">Recent Returns</div>
                          <div className="text-[12px] text-[#64748B]">{recentReturns.length} return/exchange requests</div>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => navigate("/returns")}>
                        <span className="text-[#DC2626]">View</span>
                      </Button>
                    </div>
                  )}
                  
                  {(!summary || (summary.low_stock_count === 0 && outOfStock.length === 0 && membersWithDues.length === 0 && supplierDues.length === 0 && recentReturns.length === 0)) && (
                    <div className="p-4 text-center text-[13px] text-[#64748B]">No pending business alerts.</div>
                  )}
                </div>
              </Card>

              <Card className="dashboard-panel" title={`${periodLabel} Summary`} noPadding>
                <div className="grid grid-cols-2 gap-2 p-3">
                    <div className="dashboard-summary-tile">
                      <span className="dashboard-summary-icon bg-[#EAF2FF] text-[#1769FF]"><ShoppingBag className="h-4 w-4" /></span>
                      <div><div className="text-[10px] text-[#64748B]">Sales</div>
                      <div className="text-[13px] font-bold text-[#0F172A]">{formatMoney(periodSummary?.revenue ?? 0)}</div></div>
                    </div>
                    <div className="dashboard-summary-tile">
                      <span className="dashboard-summary-icon bg-[#F1EAFE] text-[#7C3AED]"><RefreshCw className="h-4 w-4" /></span>
                      <div><div className="text-[10px] text-[#64748B]">Transactions</div>
                      <div className="text-[13px] font-bold text-[#0F172A]">{periodSummary?.sales_count ?? 0}</div></div>
                    </div>
                    <div className="dashboard-summary-tile">
                      <span className="dashboard-summary-icon bg-[#E8F9F7] text-[#0891B2]"><Users className="h-4 w-4" /></span>
                      <div><div className="text-[10px] text-[#64748B]">New Customers</div>
                      <div className="text-[13px] font-bold text-[#0F172A]">
                        {totalMembers.filter((m) => {
                          const d = new Date(m.created_at);
                          const now = new Date();
                          if (period === "today") {
                            return d.toDateString() === now.toDateString();
                          }
                          if (period === "week") {
                            const weekStart = new Date(now);
                            weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
                            weekStart.setHours(0, 0, 0, 0);
                            return d >= weekStart;
                          }
                          if (period === "month") {
                            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                          }
                          return d.getFullYear() === now.getFullYear();
                        }).length}
                      </div></div>
                    </div>
                    <div className="dashboard-summary-tile">
                      <span className="dashboard-summary-icon bg-[#FFF4E5] text-[#F79009]"><Package className="h-4 w-4" /></span>
                      <div><div className="text-[10px] text-[#64748B]">Items Sold</div>
                      <div className="text-[13px] font-bold text-[#0F172A]">{periodSummary?.items_sold ?? 0}</div></div>
                    </div>
                </div>
              </Card>
            </div>

          {/* Bottom Tables */}
          <div className="grid grid-cols-1 gap-3 lg:col-span-2 lg:grid-cols-2">
            <Card
              className="dashboard-panel"
              title="Top Selling Products"
              actions={
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              }
              noPadding
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                      <th className="px-4 py-2.5 font-semibold text-[#64748B]">#</th>
                      <th className="px-4 py-2.5 font-semibold text-[#64748B]">Product Name</th>
                      <th className="px-4 py-2.5 font-semibold text-[#64748B]">Category</th>
                      <th className="px-4 py-2.5 font-semibold text-[#64748B]">Quantity</th>
                      <th className="px-4 py-2.5 font-semibold text-[#64748B]">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSellers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-[#64748B]">No top sellers yet.</td>
                      </tr>
                    ) : (
                      topSellers.map((item, i) => (
                        <tr key={i} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                          <td className="px-4 py-2.5 text-[#0F172A]">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-[#0F172A]">{item.product_name}</td>
                          <td className="px-4 py-2.5 capitalize text-[#64748B]">
                            {item.item_type === "phone" ? "Mobile Phones" : "Accessories"}
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-[#0F172A]">{item.quantity}</td>
                          <td className="px-4 py-2.5 text-[#0F172A]">{formatMoney(item.revenue)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card
              className="dashboard-panel"
              title="Recent Sales"
              actions={
                <Button variant="ghost" size="sm" onClick={() => navigate("/sales")}>
                  View All
                </Button>
              }
              noPadding
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                      <th className="px-4 py-2.5 font-semibold text-[#64748B]">#</th>
                      <th className="px-4 py-2.5 font-semibold text-[#64748B]">Invoice No</th>
                      <th className="px-4 py-2.5 font-semibold text-[#64748B]">Customer</th>
                      <th className="px-4 py-2.5 font-semibold text-[#64748B]">Amount</th>
                      <th className="px-4 py-2.5 font-semibold text-[#64748B]">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-[#64748B]">No recent sales.</td>
                      </tr>
                    ) : (
                      recentSales.map((sale, i) => (
                        <tr key={sale.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                          <td className="px-4 py-2.5 text-[#0F172A]">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-[#0F172A]">INV-{sale.id.toString().padStart(4, "0")}</td>
                          <td className="px-4 py-2.5 text-[#64748B]">
                            {sale.member_name || "Walk-in"}
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-[#0F172A]">{formatMoney(sale.total_amount)}</td>
                          <td className="px-4 py-2.5 text-[#64748B]">
                            {formatDateTime(sale.created_at).split(",")[1]?.trim() ?? ""}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

          </div>
          </div>
        </>
      )}
    </div>
  );
}
