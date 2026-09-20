import { useEffect, useRef, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Boxes,
  Building2,
  CreditCard,
  Download,
  FileText,
  Filter,
  Package,
  Printer,
  Receipt,
  RotateCcw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { PrintReport } from "../components/PrintReport";
import { Select } from "../components/Select";
import * as expenseService from "../services/expenseService";
import * as inventoryService from "../services/inventoryService";
import * as memberService from "../services/memberService";
import * as paymentService from "../services/paymentService";
import * as purchaseService from "../services/purchaseService";
import * as reportService from "../services/reportService";
import * as returnService from "../services/returnService";
import * as saleService from "../services/saleService";
import * as supplierService from "../services/supplierService";
import { printReportViaDialog } from "../services/printingService";
import { formatDate, formatDateTime, formatMoney, formatMoneyCompact, methodLabels } from "../lib/format";
import type { CategoryTotal, Expense } from "../types/expense";
import type { Accessory, Phone, Supplier } from "../types/inventory";
import type { Member } from "../types/member";
import type { MemberBalance } from "../types/payment";
import type { Purchase, SupplierBalance } from "../types/purchase";
import type { OnlinePaymentRecord, PaymentBreakdown, PeriodSummary, ProfitLoss, ReportType, TopSeller } from "../types/report";
import type { ReturnSummary } from "../types/return";
import type { Sale } from "../types/sale";

const reportOptions: { value: ReportType; label: string }[] = [
  { value: "all", label: "All Reports" },
  { value: "sales-pos", label: "Sales / POS" },
  { value: "sales-history", label: "Sales History" },
  { value: "returns", label: "Returns & Exchanges" },
  { value: "products", label: "Products" },
  { value: "inventory", label: "Inventory" },
  { value: "purchases", label: "Purchases" },
  { value: "customers", label: "Customers" },
  { value: "customer-dues", label: "Customer Dues" },
  { value: "suppliers", label: "Suppliers" },
  { value: "supplier-dues", label: "Supplier Dues" },
  { value: "expenses", label: "Expenses" },
  { value: "profit-loss", label: "Profit & Loss" },
  { value: "online-payments", label: "Online Payments" },
];

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  return result;
}

type Preset = { label: string; range: () => [string, string] };

const presets: Preset[] = [
  { label: "Today", range: () => { const today = toInputDate(new Date()); return [today, today]; } },
  { label: "Yesterday", range: () => { const date = new Date(); date.setDate(date.getDate() - 1); const day = toInputDate(date); return [day, day]; } },
  { label: "This Week", range: () => [toInputDate(startOfWeek(new Date())), toInputDate(new Date())] },
  { label: "Last Week", range: () => { const end = startOfWeek(new Date()); end.setDate(end.getDate() - 1); const start = new Date(end); start.setDate(start.getDate() - 6); return [toInputDate(start), toInputDate(end)]; } },
  { label: "This Month", range: () => { const now = new Date(); return [toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), toInputDate(now)]; } },
  { label: "Last Month", range: () => { const now = new Date(); return [toInputDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), toInputDate(new Date(now.getFullYear(), now.getMonth(), 0))]; } },
  { label: "This Year", range: () => { const now = new Date(); return [toInputDate(new Date(now.getFullYear(), 0, 1)), toInputDate(now)]; } },
  { label: "Last Year", range: () => { const year = new Date().getFullYear() - 1; return [`${year}-01-01`, `${year}-12-31`]; } },
  { label: "All Time", range: () => ["1970-01-01", toInputDate(new Date())] },
];

function shortDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

function EmptyRows({ columns, message }: { columns: number; message: string }) {
  return <tr><td colSpan={columns} className="py-10 text-center text-[12px] text-slate-500">{message}</td></tr>;
}

interface ProductRow {
  key: string;
  type: "Mobile Phone" | "Accessory";
  name: string;
  category: string;
  variant: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  lowStockThreshold: number;
}

export function ReportsPage() {
  const today = toInputDate(new Date());
  const [reportType, setReportType] = useState<ReportType>("all");
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [activePreset, setActivePreset] = useState("This Month");
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitLoss | null>(null);
  const [salesSeries, setSalesSeries] = useState<{ day: string; label: string; Revenue: number }[]>([]);
  const [breakdown, setBreakdown] = useState<PaymentBreakdown[]>([]);
  const [onlinePayments, setOnlinePayments] = useState<OnlinePaymentRecord[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [returns, setReturns] = useState<ReturnSummary[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [customerBalances, setCustomerBalances] = useState<MemberBalance[]>([]);
  const [customerDues, setCustomerDues] = useState<MemberBalance[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierBalances, setSupplierBalances] = useState<SupplierBalance[]>([]);
  const [supplierDues, setSupplierDues] = useState<SupplierBalance[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reportLabel = reportOptions.find((item) => item.value === reportType)?.label ?? "Reports";

  const runReport = async (rangeFrom: string, rangeTo: string) => {
    const request = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const [
        nextSummary,
        nextProfitLoss,
        nextSeries,
        nextBreakdown,
        nextTopSellers,
        nextSales,
        nextReturns,
        nextPhones,
        nextAccessories,
        nextPurchases,
        nextMembers,
        nextCustomerBalances,
        nextCustomerDues,
        nextSuppliers,
        nextSupplierBalances,
        nextSupplierDues,
        nextExpenses,
        nextCategories,
        nextOnlinePayments,
      ] = await Promise.all([
        reportService.getPeriodSummary(rangeFrom, rangeTo),
        reportService.getProfitLoss(rangeFrom, rangeTo),
        reportService.getSalesSeries(rangeFrom, rangeTo),
        reportService.getPaymentBreakdown(rangeFrom, rangeTo),
        reportService.getTopSellers(rangeFrom, rangeTo, 10),
        saleService.listSalesForPeriod(rangeFrom, rangeTo),
        returnService.listReturnsForPeriod(rangeFrom, rangeTo),
        inventoryService.listPhones(),
        inventoryService.listAccessories(),
        purchaseService.listPurchasesForPeriod(rangeFrom, rangeTo),
        memberService.listMembers(),
        paymentService.listMemberBalances(),
        paymentService.listCustomerDues(),
        supplierService.listSuppliers(),
        purchaseService.listSupplierBalances(),
        purchaseService.listSupplierDues(),
        expenseService.listExpenses(null, rangeFrom, rangeTo),
        expenseService.expenseCategoryTotals(rangeFrom, rangeTo),
        reportService.getOnlinePaymentRecords(rangeFrom, rangeTo),
      ]);
      if (request !== requestId.current) return;
      setSummary(nextSummary);
      setProfitLoss(nextProfitLoss);
      setSalesSeries(nextSeries.map((point) => ({ day: point.day, label: shortDay(point.day), Revenue: point.total })));
      setBreakdown(nextBreakdown);
      setTopSellers(nextTopSellers);
      setSales(nextSales);
      setReturns(nextReturns);
      setPhones(nextPhones);
      setAccessories(nextAccessories);
      setPurchases(nextPurchases);
      setMembers(nextMembers);
      setCustomerBalances(nextCustomerBalances);
      setCustomerDues(nextCustomerDues);
      setSuppliers(nextSuppliers);
      setSupplierBalances(nextSupplierBalances);
      setSupplierDues(nextSupplierDues);
      setExpenses(nextExpenses);
      setByCategory(nextCategories);
      setOnlinePayments(nextOnlinePayments);
    } catch (reason) {
      if (request === requestId.current) setError(String(reason));
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    runReport(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = () => {
    if (!from || !to) {
      setError("Please select both From and To dates.");
      return;
    }
    if (from > to) {
      setError("From Date cannot be after To Date.");
      return;
    }
    setActivePreset("");
    runReport(from, to);
  };

  const applyPreset = (preset: Preset) => {
    const [rangeFrom, rangeTo] = preset.range();
    setFrom(rangeFrom);
    setTo(rangeTo);
    setActivePreset(preset.label);
    runReport(rangeFrom, rangeTo);
  };

  const handlePrint = () => {
    try {
      printReportViaDialog("report-print-area");
    } catch (e) {
      console.error("Print failed:", e);
    }
  };

  const products: ProductRow[] = [
    ...phones.map((item) => ({
      key: `phone:${item.id}`,
      type: "Mobile Phone" as const,
      name: `${item.brand} ${item.model}`,
      category: item.category ?? "Mobile Phone",
      variant: [item.storage, item.ram, item.color].filter(Boolean).join(" · ") || "—",
      costPrice: item.cost_price,
      salePrice: item.sale_price,
      quantity: item.quantity,
      lowStockThreshold: item.low_stock_threshold,
    })),
    ...accessories.map((item) => ({
      key: `accessory:${item.id}`,
      type: "Accessory" as const,
      name: `${item.brand} ${item.product_name}`.trim(),
      category: item.accessory_type,
      variant: [item.color, item.connector_type].filter(Boolean).join(" · ") || "—",
      costPrice: item.cost_price,
      salePrice: item.sale_price,
      quantity: item.quantity,
      lowStockThreshold: item.low_stock_threshold,
    })),
  ];
  const lowStockProducts = products.filter((item) => item.lowStockThreshold > 0 && item.quantity <= item.lowStockThreshold);
  const stockQuantity = products.reduce((sum, item) => sum + item.quantity, 0);
  const stockValue = products.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);
  const purchaseTotal = purchases.reduce((sum, item) => sum + item.total_amount, 0);
  const purchasePaid = purchases.reduce((sum, item) => sum + item.paid_amount, 0);
  const purchaseOutstanding = purchases.reduce((sum, item) => sum + item.balance_due, 0);
  const returnRefunds = returns.reduce((sum, item) => sum + item.refund_amount, 0);
  const returnDeductions = returns.reduce((sum, item) => sum + item.deduction_amount, 0);
  const returnedItems = returns.reduce((sum, item) => sum + item.item_count, 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const customerOutstanding = customerDues.reduce((sum, item) => sum + item.balance, 0);
  const supplierOutstanding = supplierDues.reduce((sum, item) => sum + item.balance, 0);
  const chartHasData = salesSeries.some((item) => item.Revenue > 0);
  const profitChartData = (profitLoss?.monthly ?? []).map((point) => ({
    month: point.month,
    Revenue: point.revenue,
    Expenses: point.expenses,
    "Net Profit": point.net_profit,
  }));

  const allSummaryRows = [
    ["SALES", "Transactions", String(summary?.sales_count ?? 0)],
    ["SALES", "Net Sales", formatMoney(summary?.revenue ?? 0)],
    ["SALES", "Total Paid", formatMoney(summary?.received ?? 0)],
    ["SALES", "Outstanding", formatMoney(summary?.outstanding ?? 0)],
    ["PURCHASES", "Transactions", String(purchases.length)],
    ["PURCHASES", "Total Purchases", formatMoney(purchaseTotal)],
    ["PURCHASES", "Paid", formatMoney(purchasePaid)],
    ["PURCHASES", "Outstanding", formatMoney(purchaseOutstanding)],
    ["RETURNS", "Return Records", String(returns.length)],
    ["RETURNS", "Returned Items", String(returnedItems)],
    ["RETURNS", "Refunds", formatMoney(returnRefunds)],
    ["EXPENSES", "Records", String(expenses.length)],
    ["EXPENSES", "Total Expenses", formatMoney(expenseTotal)],
    ["PROFIT & LOSS", "Revenue", formatMoney(profitLoss?.total_revenue ?? 0)],
    ["PROFIT & LOSS", "COGS", formatMoney(profitLoss?.total_cogs ?? 0)],
    ["PROFIT & LOSS", "Gross Profit", formatMoney(profitLoss?.gross_profit ?? 0)],
    ["PROFIT & LOSS", "Net Profit", formatMoney(profitLoss?.net_profit ?? 0)],
    ["PRODUCTS", "Total Products", String(products.length)],
    ["INVENTORY", "Stock Quantity", String(stockQuantity)],
    ["INVENTORY", "Stock Value", formatMoney(stockValue)],
    ["INVENTORY", "Low Stock Products", String(lowStockProducts.length)],
    ["CUSTOMERS", "Total Customers", String(members.length)],
    ["CUSTOMERS", "Outstanding Dues", formatMoney(customerOutstanding)],
    ["SUPPLIERS", "Total Suppliers", String(suppliers.length)],
    ["SUPPLIERS", "Outstanding Payables", formatMoney(supplierOutstanding)],
  ];

  const csvCell = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const handleExportCsv = () => {
    const rows: (string | number)[][] = [
      [reportLabel],
      [`Period: ${formatDate(from)} - ${formatDate(to)}`],
      [],
    ];
    const addSection = (title: string, headers: string[], data: (string | number)[][]) => rows.push([title], headers, ...data, []);
    if (reportType === "all") addSection("All Reports", ["Section", "Metric", "Value"], allSummaryRows);
    if (reportType === "sales-pos") {
      addSection("Sales Summary", ["Metric", "Value"], [["Net Sales", summary?.revenue ?? 0], ["Total Paid", summary?.received ?? 0], ["Outstanding", summary?.outstanding ?? 0], ["Discounts", summary?.discount ?? 0], ["Transactions", summary?.sales_count ?? 0]]);
      addSection("Sales by Day", ["Date", "Revenue"], salesSeries.map((item) => [item.day, item.Revenue]));
      addSection("Payment Methods", ["Method", "Count", "Total"], breakdown.map((item) => [methodLabels[item.payment_method] ?? item.payment_method, item.count, item.total]));
      addSection("Top Products", ["Product", "Type", "Quantity", "Revenue"], topSellers.map((item) => [item.product_name, item.item_type, item.quantity, item.revenue]));
    }
    if (reportType === "sales-history") addSection("Sales History", ["Date", "Sale #", "Customer", "Total", "Paid", "Due", "Payment", "Return Status"], sales.map((item) => [item.created_at, item.receipt_no, item.member_name ?? "Walk-in", item.total_amount, item.paid_amount, Math.max(0, item.total_amount - item.paid_amount - (item.returned_amount ?? 0)), methodLabels[item.payment_method] ?? item.payment_method, item.return_status ?? "none"]));
    if (reportType === "returns") addSection("Returns & Exchanges", ["Date", "Return #", "Sale #", "Customer", "Items", "Deduction", "Refund", "Status"], returns.map((item) => [item.return_date ?? item.created_at, item.return_no, item.receipt_no ?? item.sale_id, item.customer_name ?? "Walk-in", item.item_count, item.deduction_amount, item.refund_amount, item.status]));
    if (reportType === "products" || reportType === "inventory") addSection(reportLabel, ["Type", "Product", "Category", "Variant", "Cost", "Sale", "Stock", "Status"], products.map((item) => [item.type, item.name, item.category, item.variant, item.costPrice, item.salePrice, item.quantity, item.quantity === 0 ? "Out of Stock" : item.lowStockThreshold > 0 && item.quantity <= item.lowStockThreshold ? "Low Stock" : "In Stock"]));
    if (reportType === "purchases") addSection("Purchases", ["Date", "Purchase #", "Supplier", "Invoice Ref", "Total", "Paid", "Due", "Status"], purchases.map((item) => [item.purchase_date ?? item.created_at, item.purchase_no, item.supplier_name ?? "—", item.invoice_reference ?? "—", item.total_amount, item.paid_amount, item.balance_due, item.payment_status]));
    if (reportType === "customers") addSection("Customers", ["Customer", "Phone", "CNIC", "Status", "Total Credit", "Total Paid", "Balance"], members.map((item) => { const balance = customerBalances.find((row) => row.member_id === item.id); return [item.name, item.phone ?? "—", item.cnic ?? "—", item.status, balance?.total_credit ?? 0, balance?.total_paid ?? 0, balance?.balance ?? 0]; }));
    if (reportType === "customer-dues") addSection("Customer Dues", ["Customer", "Phone", "Total Credit", "Total Paid", "Outstanding", "Payments"], customerDues.map((item) => [item.member_name, item.phone ?? "—", item.total_credit, item.total_paid, item.balance, item.payment_count]));
    if (reportType === "suppliers") addSection("Suppliers", ["Supplier", "Phone", "Email", "Total Purchases", "Total Paid", "Balance"], suppliers.map((item) => { const balance = supplierBalances.find((row) => row.supplier_id === item.id); return [item.name, item.phone ?? "—", item.email ?? "—", balance?.total_purchases ?? 0, balance?.total_paid ?? 0, balance?.balance ?? 0]; }));
    if (reportType === "supplier-dues") addSection("Supplier Dues", ["Supplier", "Phone", "Total Purchases", "Total Paid", "Payable", "Payments"], supplierDues.map((item) => [item.supplier_name, item.phone ?? "—", item.total_purchases, item.total_paid, item.balance, item.payment_count]));
    if (reportType === "expenses") addSection("Expenses", ["Date", "Category", "Description", "Amount"], expenses.map((item) => [item.expense_date, item.category_name ?? "—", item.description ?? "—", item.amount]));
    if (reportType === "profit-loss") {
      addSection("Profit & Loss Statement", ["Metric", "Value"], [["Revenue", profitLoss?.total_revenue ?? 0], ["COGS", profitLoss?.total_cogs ?? 0], ["Gross Profit", profitLoss?.gross_profit ?? 0], ["Expenses", profitLoss?.total_expenses ?? 0], ["Net Profit", profitLoss?.net_profit ?? 0]]);
      addSection("Monthly Analysis", ["Month", "Revenue", "COGS", "Expenses", "Gross Profit", "Net Profit"], (profitLoss?.monthly ?? []).map((item) => [item.month, item.revenue, item.cogs, item.expenses, item.gross_profit, item.net_profit]));
    }
    if (reportType === "online-payments") {
      const totalOnline = onlinePayments.reduce((s, r) => s + r.amount, 0);
      const byMethod: Record<string, number> = {};
      for (const r of onlinePayments) byMethod[r.payment_method] = (byMethod[r.payment_method] ?? 0) + r.amount;
      addSection("Totals by Method", ["Method", "Total"], Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([m, t]) => [methodLabels[m] ?? m, t]));
      addSection("Online Payment Transactions", ["Date / Time", "Invoice", "Customer", "Method", "Amount", "Bank / Account", "Reference", "Note"], onlinePayments.map((r) => [r.created_at, r.receipt_no, r.customer_name ?? "Walk-in", methodLabels[r.payment_method] ?? r.payment_method, r.amount, r.account_details ?? "", r.reference ?? "", r.notes ?? ""]));
      addSection("Summary", ["Metric", "Value"], [["Total Online Received", totalOnline], ["Transactions", onlinePayments.length]]);
    }
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportType}_${from}_to_${to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const reportActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={handleExportCsv} icon={<Download className="h-3.5 w-3.5" />}>Export CSV</Button>
      <Button variant="secondary" size="sm" onClick={handlePrint} icon={<FileText className="h-3.5 w-3.5" />}>Export PDF</Button>
      <Button size="sm" onClick={handlePrint} icon={<Printer className="h-3.5 w-3.5" />}>Print Report</Button>
    </div>
  );

  const reportTable = (rows: ProductRow[], inventoryMode: boolean) => (
    <Card title={inventoryMode ? "Inventory" : "Product Catalog"} subtitle={inventoryMode ? "Current stock levels and valuation" : "Mobile phones and accessories"} noPadding>
      <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Type</th><th>Product</th><th>Category</th><th>Variant</th>{inventoryMode && <th className="text-right">Cost</th>}<th className="text-right">Sale Price</th><th className="text-center">Stock</th><th>Status</th></tr></thead><tbody>
        {rows.length === 0 ? <EmptyRows columns={inventoryMode ? 8 : 7} message="No products found." /> : rows.map((item) => { const low = item.lowStockThreshold > 0 && item.quantity <= item.lowStockThreshold; return <tr key={item.key}><td>{item.type}</td><td className="font-semibold text-slate-900">{item.name}</td><td>{item.category}</td><td>{item.variant}</td>{inventoryMode && <td className="text-right amount">{formatMoney(item.costPrice)}</td>}<td className="text-right amount">{formatMoney(item.salePrice)}</td><td className="text-center">{item.quantity}</td><td><span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: item.quantity === 0 ? "#FEE2E2" : low ? "#FEF3C7" : "#DCFCE7", color: item.quantity === 0 ? "#B91C1C" : low ? "#B45309" : "#15803D" }}>{item.quantity === 0 ? "Out of Stock" : low ? "Low Stock" : "In Stock"}</span></td></tr>; })}
      </tbody></table></div>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Reports" description="Sales, returns, purchases, expenses, profit and inventory summaries" breadcrumb={[{ label: "Finance & Reports" }, { label: "Reports" }]} />

      {error && <div className="mb-4"><Alert message={error} variant="error" /></div>}

      <div className="mb-4 w-64">
        <Select label="Report Type" value={reportType} options={reportOptions} onChange={(event) => setReportType(event.target.value as ReportType)} />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40"><Input label="From Date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
          <span className="mb-2 text-slate-400">→</span>
          <div className="w-40"><Input label="To Date" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {presets.map((preset) => <button key={preset.label} type="button" onClick={() => applyPreset(preset)} className="rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors" style={activePreset === preset.label ? { borderColor: "#2563EB", background: "#EFF6FF", color: "#1D4ED8" } : { borderColor: "#D7DEE8", background: "#FFFFFF", color: "#475569" }}>{preset.label}</button>)}
          </div>
          <Button onClick={handleApply} loading={loading} icon={<Filter className="h-3.5 w-3.5" />}>Apply</Button>
        </div>
      </Card>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div><h2 className="text-[15px] font-bold text-slate-900">{reportLabel}</h2><p className="text-[11px] text-slate-500">{formatDate(from)} — {formatDate(to)}</p></div>
        {reportActions}
      </div>

      {loading && !summary ? (
        <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-28 rounded-xl" />)}</div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {reportType === "all" && <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <KpiCard title="Net Sales" value={formatMoney(summary?.revenue ?? 0)} icon={TrendingUp} tone="green" sub={`${summary?.sales_count ?? 0} transactions`} />
              <KpiCard title="Net Profit" value={formatMoney(profitLoss?.net_profit ?? 0)} icon={BarChart3} tone={(profitLoss?.net_profit ?? 0) >= 0 ? "green" : "red"} />
              <KpiCard title="Stock Value" value={formatMoney(stockValue)} icon={Package} tone="primary" sub={`${stockQuantity} units`} />
              <KpiCard title="Receivable / Payable" value={`${formatMoneyCompact(customerOutstanding)} / ${formatMoneyCompact(supplierOutstanding)}`} icon={Wallet} tone="amber" />
            </div>
            <Card title="Complete Business Summary" subtitle="Important metrics across all modules" noPadding><table className="data-table"><thead><tr><th>Section</th><th>Metric</th><th className="text-right">Value</th></tr></thead><tbody>{allSummaryRows.map((row, index) => <tr key={`${row[0]}:${row[1]}:${index}`}><td className="text-[11px] font-semibold text-slate-600">{row[0]}</td><td>{row[1]}</td><td className="text-right amount font-semibold">{row[2]}</td></tr>)}</tbody></table></Card>
          </>}

          {reportType === "sales-pos" && <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5"><KpiCard title="Net Sales" value={formatMoney(summary?.revenue ?? 0)} icon={TrendingUp} tone="green" /><KpiCard title="Total Paid" value={formatMoney(summary?.received ?? 0)} icon={Wallet} tone="primary" /><KpiCard title="Outstanding" value={formatMoney(summary?.outstanding ?? 0)} icon={CreditCard} tone="amber" /><KpiCard title="Discounts" value={formatMoney(summary?.discount ?? 0)} icon={Receipt} tone="navy" /><KpiCard title="Transactions" value={String(summary?.sales_count ?? 0)} icon={ShoppingCart} tone="purple" /></div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><Card title="Sales Revenue Trend" subtitle="Daily revenue" className="lg:col-span-2">{!chartHasData ? <EmptyState icon={TrendingUp} title="No sales in this period" description="Sales activity will appear here." /> : <ResponsiveContainer width="100%" height={270}><ComposedChart data={salesSeries}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatMoneyCompact(value)} width={62} /><Tooltip formatter={(value) => formatMoney(Number(value) || 0)} /><Legend /><Area type="monotone" dataKey="Revenue" stroke="#2563EB" fill="#DBEAFE" /><Bar dataKey="Revenue" fill="#93C5FD" maxBarSize={18} /></ComposedChart></ResponsiveContainer>}</Card><Card title="Payment Methods" noPadding><table className="data-table"><thead><tr><th>Method</th><th className="text-center">Count</th><th className="text-right">Total</th></tr></thead><tbody>{breakdown.length === 0 ? <EmptyRows columns={3} message="No payment data." /> : breakdown.map((item) => <tr key={item.payment_method}><td>{methodLabels[item.payment_method] ?? item.payment_method}</td><td className="text-center">{item.count}</td><td className="text-right amount">{formatMoney(item.total)}</td></tr>)}</tbody></table></Card></div>
            <Card title="Top Selling Products" noPadding><table className="data-table"><thead><tr><th>#</th><th>Product</th><th>Type</th><th className="text-right">Quantity</th><th className="text-right">Revenue</th></tr></thead><tbody>{topSellers.length === 0 ? <EmptyRows columns={5} message="No products sold in this period." /> : topSellers.map((item, index) => <tr key={`${item.item_type}:${item.item_id}`}><td>{index + 1}</td><td className="font-semibold">{item.product_name}</td><td className="capitalize">{item.item_type}</td><td className="text-right">{item.quantity}</td><td className="text-right amount">{formatMoney(item.revenue)}</td></tr>)}</tbody></table></Card>
          </>}

          {reportType === "sales-history" && <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><KpiCard title="Net Sales" value={formatMoney(summary?.revenue ?? 0)} icon={TrendingUp} tone="green" sub={`${sales.length} transactions`} /><KpiCard title="Total Paid" value={formatMoney(summary?.received ?? 0)} icon={Wallet} tone="primary" sub="Collected" /><KpiCard title="Outstanding" value={formatMoney(summary?.outstanding ?? 0)} icon={CreditCard} tone="amber" sub="Unpaid" /></div>
            <Card title="Sales History" noPadding><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Date</th><th>Sale #</th><th>Customer</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Due</th><th>Payment</th><th>Return Status</th></tr></thead><tbody>{sales.length === 0 ? <EmptyRows columns={8} message="No sales in this period." /> : sales.map((item) => <tr key={item.id}><td>{formatDate(item.created_at)}</td><td className="font-mono font-semibold">{item.receipt_no}</td><td>{item.member_name ?? "Walk-in"}</td><td className="text-right amount">{formatMoney(item.total_amount)}</td><td className="text-right amount">{formatMoney(item.paid_amount)}</td><td className="text-right amount">{formatMoney(Math.max(0, item.total_amount - item.paid_amount - (item.returned_amount ?? 0)))}</td><td>{methodLabels[item.payment_method] ?? item.payment_method}</td><td className="capitalize">{item.return_status ?? "none"}</td></tr>)}</tbody></table></div></Card>
          </>}

          {reportType === "returns" && <><div className="grid grid-cols-2 gap-4 xl:grid-cols-4"><KpiCard title="Return Records" value={String(returns.length)} icon={RotateCcw} tone="red" /><KpiCard title="Returned Items" value={String(returnedItems)} icon={Package} tone="amber" /><KpiCard title="Refunds" value={formatMoney(returnRefunds)} icon={Wallet} tone="red" /><KpiCard title="Deductions" value={formatMoney(returnDeductions)} icon={Receipt} tone="navy" /></div><Card title="Returns & Exchanges" noPadding><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Date</th><th>Return #</th><th>Sale #</th><th>Customer</th><th className="text-center">Items</th><th className="text-right">Deduction</th><th className="text-right">Refund</th><th>Status</th></tr></thead><tbody>{returns.length === 0 ? <EmptyRows columns={8} message="No returns in this period." /> : returns.map((item) => <tr key={item.id}><td>{formatDate(item.return_date ?? item.created_at)}</td><td className="font-semibold">{item.return_no}</td><td>{item.receipt_no ?? `#${item.sale_id}`}</td><td>{item.customer_name ?? "Walk-in"}</td><td className="text-center">{item.item_count}</td><td className="text-right amount">{formatMoney(item.deduction_amount)}</td><td className="text-right amount">{formatMoney(item.refund_amount)}</td><td className="capitalize">{item.status}</td></tr>)}</tbody></table></div></Card></>}

          {reportType === "products" && <><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><KpiCard title="Total Products" value={String(products.length)} icon={Boxes} tone="primary" /><KpiCard title="Mobile Phones" value={String(phones.length)} icon={Package} tone="navy" /><KpiCard title="Accessories" value={String(accessories.length)} icon={Package} tone="purple" /></div>{reportTable(products, false)}</>}

          {reportType === "inventory" && <><div className="grid grid-cols-2 gap-4 xl:grid-cols-4"><KpiCard title="Total Products" value={String(products.length)} icon={Boxes} tone="primary" /><KpiCard title="Stock Quantity" value={String(stockQuantity)} icon={Package} tone="green" /><KpiCard title="Stock Value" value={formatMoney(stockValue)} icon={Wallet} tone="navy" /><KpiCard title="Low Stock" value={String(lowStockProducts.length)} icon={TrendingDown} tone={lowStockProducts.length ? "amber" : "green"} /></div>{reportTable(products, true)}</>}

          {reportType === "purchases" && <><div className="grid grid-cols-2 gap-4 xl:grid-cols-4"><KpiCard title="Total Purchases" value={formatMoney(purchaseTotal)} icon={Truck} tone="primary" /><KpiCard title="Total Paid" value={formatMoney(purchasePaid)} icon={Wallet} tone="green" /><KpiCard title="Outstanding" value={formatMoney(purchaseOutstanding)} icon={CreditCard} tone="amber" /><KpiCard title="Transactions" value={String(purchases.length)} icon={Receipt} tone="navy" /></div><Card title="Purchase History" noPadding><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Date</th><th>Purchase #</th><th>Supplier</th><th>Invoice Ref</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Due</th><th>Status</th></tr></thead><tbody>{purchases.length === 0 ? <EmptyRows columns={8} message="No purchases in this period." /> : purchases.map((item) => <tr key={item.id}><td>{formatDate(item.purchase_date ?? item.created_at)}</td><td className="font-semibold">{item.purchase_no}</td><td>{item.supplier_name ?? "—"}</td><td>{item.invoice_reference ?? "—"}</td><td className="text-right amount">{formatMoney(item.total_amount)}</td><td className="text-right amount">{formatMoney(item.paid_amount)}</td><td className="text-right amount">{formatMoney(item.balance_due)}</td><td className="capitalize">{item.payment_status}</td></tr>)}</tbody></table></div></Card></>}

          {reportType === "customers" && <><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><KpiCard title="Total Customers" value={String(members.length)} icon={Users} tone="primary" /><KpiCard title="Active Customers" value={String(members.filter((item) => item.status === "active").length)} icon={Users} tone="green" /><KpiCard title="Outstanding Dues" value={formatMoney(customerOutstanding)} icon={CreditCard} tone="amber" /></div><Card title="Customers" noPadding><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Customer</th><th>Phone</th><th>CNIC</th><th>Status</th><th className="text-right">Credit</th><th className="text-right">Paid</th><th className="text-right">Balance</th></tr></thead><tbody>{members.length === 0 ? <EmptyRows columns={7} message="No customers found." /> : members.map((item) => { const balance = customerBalances.find((row) => row.member_id === item.id); return <tr key={item.id}><td className="font-semibold">{item.name}</td><td>{item.phone ?? "—"}</td><td>{item.cnic ?? "—"}</td><td className="capitalize">{item.status}</td><td className="text-right amount">{formatMoney(balance?.total_credit ?? 0)}</td><td className="text-right amount">{formatMoney(balance?.total_paid ?? 0)}</td><td className="text-right amount">{formatMoney(balance?.balance ?? 0)}</td></tr>; })}</tbody></table></div></Card></>}

          {reportType === "customer-dues" && <><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><KpiCard title="Total Outstanding" value={formatMoney(customerOutstanding)} icon={Wallet} tone="red" /><KpiCard title="Customers Owing" value={String(customerDues.length)} icon={Users} tone="amber" /><KpiCard title="Total Payments" value={String(customerDues.reduce((sum, item) => sum + item.payment_count, 0))} icon={CreditCard} tone="green" /></div><Card title="Customer Dues" noPadding><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Customer</th><th>Phone</th><th className="text-right">Total Credit</th><th className="text-right">Total Paid</th><th className="text-right">Outstanding</th><th className="text-center">Payments</th></tr></thead><tbody>{customerDues.length === 0 ? <EmptyRows columns={6} message="No outstanding customer dues." /> : customerDues.map((item) => <tr key={item.member_id}><td className="font-semibold">{item.member_name}</td><td>{item.phone ?? "—"}</td><td className="text-right amount">{formatMoney(item.total_credit)}</td><td className="text-right amount">{formatMoney(item.total_paid)}</td><td className="text-right amount font-semibold text-amber-700">{formatMoney(item.balance)}</td><td className="text-center">{item.payment_count}</td></tr>)}</tbody></table></div></Card></>}

          {reportType === "suppliers" && <><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><KpiCard title="Total Suppliers" value={String(suppliers.length)} icon={Building2} tone="primary" /><KpiCard title="Outstanding Payables" value={formatMoney(supplierOutstanding)} icon={Wallet} tone="amber" /></div><Card title="Suppliers" noPadding><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Supplier</th><th>Phone</th><th>Email</th><th className="text-right">Purchases</th><th className="text-right">Paid</th><th className="text-right">Balance</th></tr></thead><tbody>{suppliers.length === 0 ? <EmptyRows columns={6} message="No suppliers found." /> : suppliers.map((item) => { const balance = supplierBalances.find((row) => row.supplier_id === item.id); return <tr key={item.id}><td className="font-semibold">{item.name}</td><td>{item.phone ?? "—"}</td><td>{item.email ?? "—"}</td><td className="text-right amount">{formatMoney(balance?.total_purchases ?? 0)}</td><td className="text-right amount">{formatMoney(balance?.total_paid ?? 0)}</td><td className="text-right amount">{formatMoney(balance?.balance ?? 0)}</td></tr>; })}</tbody></table></div></Card></>}

          {reportType === "supplier-dues" && <><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><KpiCard title="Total Payable" value={formatMoney(supplierOutstanding)} icon={Wallet} tone="red" /><KpiCard title="Suppliers Owed" value={String(supplierDues.length)} icon={Building2} tone="amber" /><KpiCard title="Total Payments" value={String(supplierDues.reduce((sum, item) => sum + item.payment_count, 0))} icon={CreditCard} tone="green" /></div><Card title="Supplier Dues" noPadding><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Supplier</th><th>Phone</th><th className="text-right">Total Purchases</th><th className="text-right">Total Paid</th><th className="text-right">Payable</th><th className="text-center">Payments</th></tr></thead><tbody>{supplierDues.length === 0 ? <EmptyRows columns={6} message="No outstanding supplier dues." /> : supplierDues.map((item) => <tr key={item.supplier_id}><td className="font-semibold">{item.supplier_name}</td><td>{item.phone ?? "—"}</td><td className="text-right amount">{formatMoney(item.total_purchases)}</td><td className="text-right amount">{formatMoney(item.total_paid)}</td><td className="text-right amount font-semibold text-amber-700">{formatMoney(item.balance)}</td><td className="text-center">{item.payment_count}</td></tr>)}</tbody></table></div></Card></>}

          {reportType === "expenses" && <><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><KpiCard title="Total Expenses" value={formatMoney(expenseTotal)} icon={TrendingDown} tone="red" /><KpiCard title="Transactions" value={String(expenses.length)} icon={Receipt} tone="navy" /><KpiCard title="Categories" value={String(byCategory.length)} icon={Boxes} tone="primary" /></div><div className="grid grid-cols-1 gap-4 xl:grid-cols-3"><Card title="By Category" noPadding><table className="data-table"><thead><tr><th>Category</th><th className="text-center">Count</th><th className="text-right">Total</th></tr></thead><tbody>{byCategory.length === 0 ? <EmptyRows columns={3} message="No expense data." /> : byCategory.map((item) => <tr key={item.category_id}><td>{item.category_name}</td><td className="text-center">{item.count}</td><td className="text-right amount">{formatMoney(item.total)}</td></tr>)}</tbody></table></Card><Card title="Expense Transactions" className="xl:col-span-2" noPadding><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="text-right">Amount</th></tr></thead><tbody>{expenses.length === 0 ? <EmptyRows columns={4} message="No expenses in this period." /> : expenses.map((item) => <tr key={item.id}><td>{formatDate(item.expense_date)}</td><td>{item.category_name ?? "—"}</td><td>{item.description ?? "—"}</td><td className="text-right amount">{formatMoney(item.amount)}</td></tr>)}</tbody></table></div></Card></div></>}

          {reportType === "profit-loss" && <><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5"><KpiCard title="Revenue" value={formatMoney(profitLoss?.total_revenue ?? 0)} icon={TrendingUp} tone="green" /><KpiCard title="COGS" value={formatMoney(profitLoss?.total_cogs ?? 0)} icon={Package} tone="navy" /><KpiCard title="Expenses" value={formatMoney(profitLoss?.total_expenses ?? 0)} icon={TrendingDown} tone="red" /><KpiCard title="Gross Profit" value={formatMoney(profitLoss?.gross_profit ?? 0)} icon={BarChart3} tone="primary" /><KpiCard title="Net Profit" value={formatMoney(profitLoss?.net_profit ?? 0)} icon={Wallet} tone={(profitLoss?.net_profit ?? 0) >= 0 ? "green" : "red"} /></div><div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><Card title="Profit & Loss Statement"><div className="space-y-2">{[["Revenue", profitLoss?.total_revenue ?? 0], ["Less: COGS", -(profitLoss?.total_cogs ?? 0)], ["Gross Profit", profitLoss?.gross_profit ?? 0], ["Less: Expenses", -(profitLoss?.total_expenses ?? 0)], ["Net Profit", profitLoss?.net_profit ?? 0]].map(([label, value], index) => <div key={String(label)} className={`flex items-center justify-between px-2 py-2 ${index === 2 || index === 4 ? "rounded-md bg-slate-50 font-bold" : "border-b border-slate-100"}`}><span className="text-[13px]">{label}</span><span className="amount text-[14px]">{formatMoney(Number(value))}</span></div>)}</div></Card><Card title="Revenue vs Expenses vs Profit" className="lg:col-span-2">{profitChartData.length === 0 ? <EmptyState icon={TrendingUp} title="No activity in this period" description="Profit data will appear here." /> : <ResponsiveContainer width="100%" height={290}><ComposedChart data={profitChartData}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatMoneyCompact(value)} width={62} /><Tooltip formatter={(value) => formatMoney(Number(value) || 0)} /><Legend /><Bar dataKey="Revenue" fill="#3B6FD4" maxBarSize={20} /><Bar dataKey="Expenses" fill="#DC2626" maxBarSize={20} /><Line type="monotone" dataKey="Net Profit" stroke="#16A34A" strokeWidth={2} /></ComposedChart></ResponsiveContainer>}</Card></div><Card title="Monthly Profit Analysis" noPadding><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Month</th><th className="text-right">Revenue</th><th className="text-right">COGS</th><th className="text-right">Expenses</th><th className="text-right">Gross Profit</th><th className="text-right">Net Profit</th></tr></thead><tbody>{!profitLoss?.monthly.length ? <EmptyRows columns={6} message="No profit and loss data in this period." /> : profitLoss.monthly.map((item) => <tr key={item.month}><td className="font-semibold">{item.month}</td><td className="text-right amount">{formatMoney(item.revenue)}</td><td className="text-right amount">{formatMoney(item.cogs)}</td><td className="text-right amount">{formatMoney(item.expenses)}</td><td className="text-right amount">{formatMoney(item.gross_profit)}</td><td className="text-right amount">{formatMoney(item.net_profit)}</td></tr>)}</tbody></table></div></Card></>}
        </div>
      )}

      {reportType === "online-payments" && (() => {
        const totalOnline = onlinePayments.reduce((s, r) => s + r.amount, 0);
        const byMethod: Record<string, number> = {};
        for (const r of onlinePayments) {
          byMethod[r.payment_method] = (byMethod[r.payment_method] ?? 0) + r.amount;
        }
        const methodEntries = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);
        return <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard title="Total Online Received" value={formatMoney(totalOnline)} icon={Wallet} tone="green" sub={`${onlinePayments.length} transactions`} />
            <KpiCard title="Payment Methods" value={String(methodEntries.length)} icon={CreditCard} tone="primary" sub="active in period" />
            <KpiCard title="Transactions" value={String(onlinePayments.length)} icon={Receipt} tone="navy" sub="non-cash payments" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Totals by Method" noPadding>
              <table className="data-table">
                <thead><tr><th>Method</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {methodEntries.length === 0 ? <EmptyRows columns={2} message="No online payments." /> : methodEntries.map(([method, total]) => (
                    <tr key={method}>
                      <td className="font-semibold">{methodLabels[method] ?? method}</td>
                      <td className="text-right amount">{formatMoney(total)}</td>
                    </tr>
                  ))}
                  {methodEntries.length > 0 && (
                    <tr style={{ borderTop: "2px solid #E2E8F0" }}>
                      <td className="font-bold">Total Online Received</td>
                      <td className="text-right amount font-bold" style={{ color: "#16A34A" }}>{formatMoney(totalOnline)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
            <Card title="Transaction Details" className="lg:col-span-2" noPadding>
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
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onlinePayments.length === 0 ? <EmptyRows columns={7} message="No online payment records in this period." /> : onlinePayments.map((r) => (
                      <tr key={r.id}>
                        <td>{formatDateTime(r.created_at)}</td>
                        <td className="font-semibold">{r.receipt_no}</td>
                        <td>{r.customer_name ?? "Walk-in"}</td>
                        <td>{methodLabels[r.payment_method] ?? r.payment_method}</td>
                        <td className="text-right amount">{formatMoney(r.amount)}</td>
                        <td>{r.account_details ?? "—"}</td>
                        <td>{r.reference ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>;
      })()}

      <PrintReport
        reportType={reportType}
        reportTitle={reportLabel}
        from={from}
        to={to}
        summary={summary}
        profitLoss={profitLoss}
        salesSeries={salesSeries}
        breakdown={breakdown}
        topSellers={topSellers}
        sales={sales}
        returns={returns}
        products={products}
        purchases={purchases}
        members={members}
        customerBalances={customerBalances}
        customerDues={customerDues}
        suppliers={suppliers}
        supplierBalances={supplierBalances}
        supplierDues={supplierDues}
        expenses={expenses}
        byCategory={byCategory}
        allSummaryRows={allSummaryRows}
        onlinePayments={onlinePayments}
      />
    </div>
  );
}
