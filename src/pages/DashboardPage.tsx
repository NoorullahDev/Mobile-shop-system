import { useEffect, useRef, useState } from "react";
import {
  TrendingUp,
  Package,
  Users,
  Banknote,
  AlertTriangle,
  Activity,
  Plus,
  ShoppingBag,
  Calendar,
  RefreshCw,
  CreditCard,
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
  formatDateTime,
  toLocalDate,
} from "../lib/format";

// Additional imports for real data
import { getTopSellers, getPeriodSummary, getSalesSeries, getPaymentBreakdown } from "../services/reportService";
import { listSales } from "../services/saleService";
import { listProducts } from "../services/inventoryService";
import { listSuppliers } from "../services/supplierService";
import { listReturns } from "../services/returnService";
import { listMembers } from "../services/memberService";
import type { TopSeller, PeriodSummary, SalePoint, PaymentBreakdown } from "../types/report";
import type { Sale } from "../types/sale";
import type { Product } from "../types/inventory";
import type { Supplier } from "../types/inventory";
import type { ReturnSummary } from "../types/return";
import type { Member } from "../types/member";

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
  const [supplierDues, setSupplierDues] = useState<Supplier[]>([]);
  const [recentReturns, setRecentReturns] = useState<ReturnSummary[]>([]);
  const [membersWithDues, setMembersWithDues] = useState<Member[]>([]);
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
        start.setDate(now.getDate() - now.getDay());
        from = toLocalDate(start);
      } else if (period === "month") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        from = toLocalDate(start);
      } else if (period === "year") {
        const start = new Date(now.getFullYear(), 0, 1);
        from = toLocalDate(start);
      }

      const [pSummary, top, seriesData, payBreakdown] = await Promise.all([
        getPeriodSummary(from, to),
        getTopSellers(from, to, 5),
        (period === "week" || period === "month") ? getSalesSeries(from, to) : Promise.resolve([]),
        getPaymentBreakdown(from, to),
      ]);

      if (req !== dashReq.current) return;
      setPeriodSummary(pSummary);
      setTopSellers(top);
      setDailySales(seriesData);
      setPaymentBreakdown(payBreakdown);

      const [salesData, productsData, suppliersData, returnsList, membersData] = await Promise.all([
        listSales(),
        listProducts(),
        listSuppliers(),
        listReturns(),
        listMembers(),
      ]);

      if (req !== dashReq.current) return;
      setRecentSales(salesData.slice(0, 5));
      setOutOfStock(productsData.filter((p) => p.quantity <= 0));
      setSupplierDues(suppliersData.filter((s) => ((s as any).balance_due || 0) > 0));
      setRecentReturns(returnsList.slice(0, 5));
      setMembersWithDues(membersData.filter((m) => ((m as any).balance_due || 0) > 0));
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
    <div>
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
              title={period === "today" ? "TODAY'S SALES" : period === "week" ? "THIS WEEK'S SALES" : period === "month" ? "THIS MONTH'S SALES" : "THIS YEAR'S SALES"}
              value={formatMoneyCompact(periodSummary?.revenue ?? summary?.today_revenue ?? 0)}
              sub={`${periodSummary?.sales_count ?? summary?.today_sales_count ?? 0} transactions`}
              icon={ShoppingBag}
              tone="primary"
              onClick={() => navigate("/sales")}
            />
            <KpiCard
              title="TOTAL REVENUE"
              value={formatMoneyCompact(summary?.revenue ?? 0)}
              sub="All time sales"
              icon={Banknote}
              tone="primary"
              onClick={() => navigate("/sales")}
            />
            <KpiCard
              title={period === "today" ? "TODAY'S PROFIT" : period === "week" ? "THIS WEEK'S PROFIT" : period === "month" ? "THIS MONTH'S PROFIT" : "THIS YEAR'S PROFIT"}
              value={formatMoneyCompact(periodSummary?.profit ?? summary?.profit ?? 0)}
              sub="After COGS & expenses"
              icon={TrendingUp}
              tone="green"
            />
            <KpiCard
              title="PRODUCTS"
              value={String(summary?.products_total ?? 0)}
              sub={`${summary?.low_stock_count ?? 0} low in stock`}
              icon={Package}
              tone="amber"
              trend={outOfStock.length > 0 ? { label: String(outOfStock.length), direction: "down", positive: false } : undefined}
              onClick={() => navigate("/inventory")}
            />
            <KpiCard
              title="CUSTOMERS"
              value={String(summary?.members_total ?? 0)}
              sub={`${membersWithDues.length} with dues`}
              icon={Users}
              tone="purple"
              onClick={() => navigate("/members")}
            />
            <KpiCard
              title="ONLINE PAYMENTS"
              value={formatMoneyCompact(
                paymentBreakdown
                  .filter((b) => b.payment_method !== "cash" && b.payment_method !== "credit")
                  .reduce((sum, b) => sum + b.total, 0)
              )}
              sub="Bank Transfer / Easypaisa / JazzCash / Card"
              icon={CreditCard}
              tone="green"
            />
          </div>

          {/* Main grid */}
          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Recharts trend */}
            <div className="lg:col-span-2">
              <Card title="Sales vs Expenses" subtitle={period === "year" || period === "today" ? "Last 12 months - monthly trend" : "Daily sales trend"}>
                {displayChartData.length === 0 || displayChartData.every((d) => d.Sales === 0 && d.Expenses === 0) ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No chart data yet"
                    description="Sales and expense data will appear here once recorded."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
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
            <div className="flex flex-col gap-4">
              <Card title="Quick Actions">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: "New Sale",
                      to: "/sales/new",
                      primary: true,
                    },
                    { label: "Add Product", to: "/inventory" },
                    { label: "Add Customer", to: "/members" },
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

              <Card
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
                            {formatMoney(summary?.pending_payments ?? 0)} outstanding from {membersWithDues.length} customers
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
                            {formatMoney(supplierDues.reduce((sum, s) => sum + ((s as any).balance_due || 0), 0))} due to {supplierDues.length} suppliers
                          </div>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => navigate("/inventory/suppliers")}>
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
            </div>
          </div>
          
          {/* Bottom Tables */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card
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

            <Card title="Today's Summary" noPadding>
              <div className="flex h-full flex-col justify-center px-6 py-4">
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[12px] text-[#64748B]">Sales</div>
                    <div className="mt-1 text-lg font-bold text-[#0F172A]">{formatMoney(summary?.today_revenue ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[#64748B]">Transactions</div>
                    <div className="mt-1 text-lg font-bold text-[#0F172A]">{summary?.today_sales_count ?? 0}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[12px] text-[#64748B]">New Customers</div>
                    <div className="mt-1 text-lg font-bold text-[#0F172A]">
                      {totalMembers.filter((m) => {
                        const d = new Date(m.created_at);
                        const now = new Date();
                        if (period === "today") {
                          return d.toDateString() === now.toDateString();
                        }
                        if (period === "week") {
                          const weekStart = new Date(now);
                          weekStart.setDate(now.getDate() - now.getDay());
                          weekStart.setHours(0, 0, 0, 0);
                          return d >= weekStart;
                        }
                        if (period === "month") {
                          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                        }
                        return d.getFullYear() === now.getFullYear();
                      }).length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[#64748B]">Items Sold</div>
                    <div className="mt-1 text-lg font-bold text-[#0F172A]">{topSellers.reduce((sum, item) => sum + item.quantity, 0)}</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
