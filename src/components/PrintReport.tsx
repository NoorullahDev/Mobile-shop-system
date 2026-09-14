import { memo, type ReactNode } from "react";
import { formatDate, formatMoney, methodLabels } from "../lib/format";
import { useSettingsStore } from "../store/settings";
import type { CategoryTotal, Expense } from "../types/expense";
import type { Supplier } from "../types/inventory";
import type { Member } from "../types/member";
import type { MemberBalance } from "../types/payment";
import type { Purchase, SupplierBalance } from "../types/purchase";
import type { PaymentBreakdown, PeriodSummary, ProfitLoss, ReportType, TopSeller } from "../types/report";
import type { ReturnSummary } from "../types/return";
import type { Sale } from "../types/sale";

interface ReportProduct {
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

interface PrintReportProps {
  reportType: ReportType;
  reportTitle: string;
  from: string;
  to: string;
  summary: PeriodSummary | null;
  profitLoss: ProfitLoss | null;
  salesSeries: { day: string; label: string; Revenue: number }[];
  breakdown: PaymentBreakdown[];
  topSellers: TopSeller[];
  sales: Sale[];
  returns: ReturnSummary[];
  products: ReportProduct[];
  purchases: Purchase[];
  members: Member[];
  customerBalances: MemberBalance[];
  customerDues: MemberBalance[];
  suppliers: Supplier[];
  supplierBalances: SupplierBalance[];
  supplierDues: SupplierBalance[];
  expenses: Expense[];
  byCategory: CategoryTotal[];
  allSummaryRows: string[][];
}

function Metrics({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <div className="report-print-metrics">{items.map((item) => <div className="report-print-metric" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="report-print-section"><h2>{title}</h2>{children}</section>;
}

function EmptyRow({ columns, children }: { columns: number; children: ReactNode }) {
  return <tr><td colSpan={columns} className="report-print-empty">{children}</td></tr>;
}

export const PrintReport = memo(function PrintReport({
  reportType,
  reportTitle,
  from,
  to,
  summary,
  profitLoss,
  salesSeries,
  breakdown,
  topSellers,
  sales,
  returns,
  products,
  purchases,
  members,
  customerBalances,
  customerDues,
  suppliers,
  supplierBalances,
  supplierDues,
  expenses,
  byCategory,
  allSummaryRows,
}: PrintReportProps) {
  const businessName = useSettingsStore((state) => state.businessName) || "Mobile Shop System";
  const logo = useSettingsStore((state) => state.logo);
  const phone = useSettingsStore((state) => state.phone);
  const email = useSettingsStore((state) => state.email);
  const address = useSettingsStore((state) => state.address);
  const generatedAt = new Date().toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
  const stockQuantity = products.reduce((sum, item) => sum + item.quantity, 0);
  const stockValue = products.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);
  const lowStock = products.filter((item) => item.lowStockThreshold > 0 && item.quantity <= item.lowStockThreshold).length;
  const purchaseTotal = purchases.reduce((sum, item) => sum + item.total_amount, 0);
  const purchasePaid = purchases.reduce((sum, item) => sum + item.paid_amount, 0);
  const purchaseDue = purchases.reduce((sum, item) => sum + item.balance_due, 0);
  const customerOutstanding = customerDues.reduce((sum, item) => sum + item.balance, 0);
  const supplierOutstanding = supplierDues.reduce((sum, item) => sum + item.balance, 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const refundTotal = returns.reduce((sum, item) => sum + item.refund_amount, 0);
  const deductionTotal = returns.reduce((sum, item) => sum + item.deduction_amount, 0);

  return (
    <article className="print-report report-print-document">
      <header className="report-print-header">
        <div className="report-print-brand">
          {logo && <img src={logo} alt="" />}
          <div>
            <strong>{businessName}</strong>
            {address && <span>{address}</span>}
            {(phone || email) && <span>{[phone, email].filter(Boolean).join(" • ")}</span>}
          </div>
        </div>
        <div className="report-print-meta">
          <h1>{reportTitle.toUpperCase()}</h1>
          <span>Period: {formatDate(from)} — {formatDate(to)}</span>
          <span>Generated: {generatedAt}</span>
        </div>
      </header>

      {reportType === "all" && <>
        <Section title="Complete Business Summary">
          <table><thead><tr><th>Section</th><th>Metric</th><th className="num">Value</th></tr></thead><tbody>{allSummaryRows.map((row, index) => <tr key={`${row[0]}:${row[1]}:${index}`}><td>{row[0]}</td><td>{row[1]}</td><td className="num">{row[2]}</td></tr>)}</tbody></table>
        </Section>
        <div className="report-print-totals"><div><span>NET SALES</span><strong>{formatMoney(summary?.revenue ?? 0)}</strong></div><div><span>NET PROFIT</span><strong>{formatMoney(profitLoss?.net_profit ?? 0)}</strong></div><div><span>STOCK VALUE</span><strong>{formatMoney(stockValue)}</strong></div></div>
      </>}

      {reportType === "sales-pos" && <>
        <Metrics items={[{ label: "Net Sales", value: formatMoney(summary?.revenue ?? 0) }, { label: "Total Paid", value: formatMoney(summary?.received ?? 0) }, { label: "Outstanding", value: formatMoney(summary?.outstanding ?? 0) }, { label: "Discounts", value: formatMoney(summary?.discount ?? 0) }, { label: "Transactions", value: summary?.sales_count ?? 0 }]} />
        <div className="report-print-columns"><Section title="Sales by Day"><table><thead><tr><th>Date</th><th className="num">Revenue</th></tr></thead><tbody>{salesSeries.length === 0 ? <EmptyRow columns={2}>No sales in this period.</EmptyRow> : salesSeries.map((item) => <tr key={item.day}><td>{formatDate(item.day)}</td><td className="num">{formatMoney(item.Revenue)}</td></tr>)}</tbody></table></Section><Section title="Payment Methods"><table><thead><tr><th>Method</th><th className="num">Count</th><th className="num">Total</th></tr></thead><tbody>{breakdown.length === 0 ? <EmptyRow columns={3}>No payment data.</EmptyRow> : breakdown.map((item) => <tr key={item.payment_method}><td>{methodLabels[item.payment_method] ?? item.payment_method}</td><td className="num">{item.count}</td><td className="num">{formatMoney(item.total)}</td></tr>)}</tbody></table></Section></div>
        <Section title="Top Selling Products"><table><thead><tr><th>#</th><th>Product</th><th>Type</th><th className="num">Quantity</th><th className="num">Revenue</th></tr></thead><tbody>{topSellers.length === 0 ? <EmptyRow columns={5}>No products sold in this period.</EmptyRow> : topSellers.map((item, index) => <tr key={`${item.item_type}:${item.item_id}`}><td>{index + 1}</td><td>{item.product_name}</td><td>{item.item_type}</td><td className="num">{item.quantity}</td><td className="num">{formatMoney(item.revenue)}</td></tr>)}</tbody></table></Section>
      </>}

      {reportType === "sales-history" && <>
        <Metrics items={[{ label: "Net Sales", value: formatMoney(summary?.revenue ?? 0) }, { label: "Total Paid", value: formatMoney(summary?.received ?? 0) }, { label: "Outstanding", value: formatMoney(summary?.outstanding ?? 0) }]} />
        <Section title="Sales History"><table><thead><tr><th>Date</th><th>Sale #</th><th>Customer</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Due</th><th>Payment</th><th>Return</th></tr></thead><tbody>{sales.length === 0 ? <EmptyRow columns={8}>No sales in this period.</EmptyRow> : sales.map((item) => <tr key={item.id}><td>{formatDate(item.created_at)}</td><td>{item.receipt_no}</td><td>{item.member_name ?? "Walk-in"}</td><td className="num">{formatMoney(item.total_amount)}</td><td className="num">{formatMoney(item.paid_amount)}</td><td className="num">{formatMoney(Math.max(0, item.total_amount - item.paid_amount))}</td><td>{methodLabels[item.payment_method] ?? item.payment_method}</td><td>{item.return_status ?? "none"}</td></tr>)}</tbody></table></Section>
        <div className="report-print-totals"><div><span>NET SALES</span><strong>{formatMoney(summary?.revenue ?? 0)}</strong></div><div><span>TOTAL PAID</span><strong>{formatMoney(summary?.received ?? 0)}</strong></div><div><span>OUTSTANDING</span><strong>{formatMoney(summary?.outstanding ?? 0)}</strong></div></div>
      </>}

      {reportType === "returns" && <>
        <Metrics items={[{ label: "Return Records", value: returns.length }, { label: "Returned Items", value: returns.reduce((sum, item) => sum + item.item_count, 0) }, { label: "Refunds", value: formatMoney(refundTotal) }, { label: "Deductions", value: formatMoney(deductionTotal) }]} />
        <Section title="Returns & Exchanges"><table><thead><tr><th>Date</th><th>Return #</th><th>Sale #</th><th>Customer</th><th className="num">Items</th><th className="num">Deduction</th><th className="num">Refund</th><th>Status</th></tr></thead><tbody>{returns.length === 0 ? <EmptyRow columns={8}>No returns in this period.</EmptyRow> : returns.map((item) => <tr key={item.id}><td>{formatDate(item.return_date ?? item.created_at)}</td><td>{item.return_no}</td><td>{item.receipt_no ?? `#${item.sale_id}`}</td><td>{item.customer_name ?? "Walk-in"}</td><td className="num">{item.item_count}</td><td className="num">{formatMoney(item.deduction_amount)}</td><td className="num">{formatMoney(item.refund_amount)}</td><td>{item.status}</td></tr>)}</tbody></table></Section>
      </>}

      {(reportType === "products" || reportType === "inventory") && <>
        <Metrics items={reportType === "inventory" ? [{ label: "Total Products", value: products.length }, { label: "Stock Quantity", value: stockQuantity }, { label: "Stock Value", value: formatMoney(stockValue) }, { label: "Low Stock", value: lowStock }] : [{ label: "Total Products", value: products.length }, { label: "Mobile Phones", value: products.filter((item) => item.type === "Mobile Phone").length }, { label: "Accessories", value: products.filter((item) => item.type === "Accessory").length }]} />
        <Section title={reportType === "inventory" ? "Inventory" : "Product Catalog"}><table><thead><tr><th>Type</th><th>Product</th><th>Category</th><th>Variant</th>{reportType === "inventory" && <th className="num">Cost</th>}<th className="num">Sale Price</th><th className="num">Stock</th><th>Status</th></tr></thead><tbody>{products.length === 0 ? <EmptyRow columns={reportType === "inventory" ? 8 : 7}>No products found.</EmptyRow> : products.map((item) => { const low = item.lowStockThreshold > 0 && item.quantity <= item.lowStockThreshold; return <tr key={item.key}><td>{item.type}</td><td>{item.name}</td><td>{item.category}</td><td>{item.variant}</td>{reportType === "inventory" && <td className="num">{formatMoney(item.costPrice)}</td>}<td className="num">{formatMoney(item.salePrice)}</td><td className="num">{item.quantity}</td><td>{item.quantity === 0 ? "Out of Stock" : low ? "Low Stock" : "In Stock"}</td></tr>; })}</tbody></table></Section>
        {reportType === "inventory" && <div className="report-print-totals"><div><span>TOTAL PRODUCTS</span><strong>{products.length}</strong></div><div><span>STOCK QUANTITY</span><strong>{stockQuantity}</strong></div><div><span>STOCK VALUE</span><strong>{formatMoney(stockValue)}</strong></div></div>}
      </>}

      {reportType === "purchases" && <>
        <Metrics items={[{ label: "Total Purchases", value: formatMoney(purchaseTotal) }, { label: "Total Paid", value: formatMoney(purchasePaid) }, { label: "Outstanding", value: formatMoney(purchaseDue) }, { label: "Transactions", value: purchases.length }]} />
        <Section title="Purchase History"><table><thead><tr><th>Date</th><th>Purchase #</th><th>Supplier</th><th>Invoice Ref</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Due</th><th>Status</th></tr></thead><tbody>{purchases.length === 0 ? <EmptyRow columns={8}>No purchases in this period.</EmptyRow> : purchases.map((item) => <tr key={item.id}><td>{formatDate(item.purchase_date ?? item.created_at)}</td><td>{item.purchase_no}</td><td>{item.supplier_name ?? "—"}</td><td>{item.invoice_reference ?? "—"}</td><td className="num">{formatMoney(item.total_amount)}</td><td className="num">{formatMoney(item.paid_amount)}</td><td className="num">{formatMoney(item.balance_due)}</td><td>{item.payment_status}</td></tr>)}</tbody></table></Section>
      </>}

      {reportType === "customers" && <>
        <Metrics items={[{ label: "Total Customers", value: members.length }, { label: "Active Customers", value: members.filter((item) => item.status === "active").length }, { label: "Outstanding Dues", value: formatMoney(customerOutstanding) }]} />
        <Section title="Customers"><table><thead><tr><th>Customer</th><th>Phone</th><th>CNIC</th><th>Status</th><th className="num">Credit</th><th className="num">Paid</th><th className="num">Balance</th></tr></thead><tbody>{members.length === 0 ? <EmptyRow columns={7}>No customers found.</EmptyRow> : members.map((item) => { const balance = customerBalances.find((row) => row.member_id === item.id); return <tr key={item.id}><td>{item.name}</td><td>{item.phone ?? "—"}</td><td>{item.cnic ?? "—"}</td><td>{item.status}</td><td className="num">{formatMoney(balance?.total_credit ?? 0)}</td><td className="num">{formatMoney(balance?.total_paid ?? 0)}</td><td className="num">{formatMoney(balance?.balance ?? 0)}</td></tr>; })}</tbody></table></Section>
      </>}

      {reportType === "customer-dues" && <>
        <Metrics items={[{ label: "Total Outstanding", value: formatMoney(customerOutstanding) }, { label: "Customers Owing", value: customerDues.length }, { label: "Payment Records", value: customerDues.reduce((sum, item) => sum + item.payment_count, 0) }]} />
        <Section title="Customer Dues"><table><thead><tr><th>Customer</th><th>Phone</th><th className="num">Total Credit</th><th className="num">Total Paid</th><th className="num">Outstanding</th><th className="num">Payments</th></tr></thead><tbody>{customerDues.length === 0 ? <EmptyRow columns={6}>No outstanding customer dues.</EmptyRow> : customerDues.map((item) => <tr key={item.member_id}><td>{item.member_name}</td><td>{item.phone ?? "—"}</td><td className="num">{formatMoney(item.total_credit)}</td><td className="num">{formatMoney(item.total_paid)}</td><td className="num">{formatMoney(item.balance)}</td><td className="num">{item.payment_count}</td></tr>)}</tbody></table></Section>
        <div className="report-print-totals"><div><span>TOTAL OUTSTANDING</span><strong>{formatMoney(customerOutstanding)}</strong></div></div>
      </>}

      {reportType === "suppliers" && <>
        <Metrics items={[{ label: "Total Suppliers", value: suppliers.length }, { label: "Outstanding Payables", value: formatMoney(supplierOutstanding) }]} />
        <Section title="Suppliers"><table><thead><tr><th>Supplier</th><th>Phone</th><th>Email</th><th className="num">Purchases</th><th className="num">Paid</th><th className="num">Balance</th></tr></thead><tbody>{suppliers.length === 0 ? <EmptyRow columns={6}>No suppliers found.</EmptyRow> : suppliers.map((item) => { const balance = supplierBalances.find((row) => row.supplier_id === item.id); return <tr key={item.id}><td>{item.name}</td><td>{item.phone ?? "—"}</td><td>{item.email ?? "—"}</td><td className="num">{formatMoney(balance?.total_purchases ?? 0)}</td><td className="num">{formatMoney(balance?.total_paid ?? 0)}</td><td className="num">{formatMoney(balance?.balance ?? 0)}</td></tr>; })}</tbody></table></Section>
      </>}

      {reportType === "supplier-dues" && <>
        <Metrics items={[{ label: "Total Payable", value: formatMoney(supplierOutstanding) }, { label: "Suppliers Owed", value: supplierDues.length }, { label: "Payment Records", value: supplierDues.reduce((sum, item) => sum + item.payment_count, 0) }]} />
        <Section title="Supplier Dues"><table><thead><tr><th>Supplier</th><th>Phone</th><th className="num">Total Purchases</th><th className="num">Total Paid</th><th className="num">Payable</th><th className="num">Payments</th></tr></thead><tbody>{supplierDues.length === 0 ? <EmptyRow columns={6}>No outstanding supplier dues.</EmptyRow> : supplierDues.map((item) => <tr key={item.supplier_id}><td>{item.supplier_name}</td><td>{item.phone ?? "—"}</td><td className="num">{formatMoney(item.total_purchases)}</td><td className="num">{formatMoney(item.total_paid)}</td><td className="num">{formatMoney(item.balance)}</td><td className="num">{item.payment_count}</td></tr>)}</tbody></table></Section>
        <div className="report-print-totals"><div><span>TOTAL PAYABLE</span><strong>{formatMoney(supplierOutstanding)}</strong></div></div>
      </>}

      {reportType === "expenses" && <div className="report-print-expenses">
        <Metrics items={[{ label: "Total Expenses", value: formatMoney(expenseTotal) }, { label: "Transactions", value: expenses.length }, { label: "Categories", value: byCategory.length }]} />
        <div className="report-print-expense-tables">
          <div className="report-print-expense-category">
            <Section title="Expenses by Category">
              <table className="report-print-expense-category-table">
                <colgroup><col style={{ width: "58%" }} /><col style={{ width: "14%" }} /><col style={{ width: "28%" }} /></colgroup>
                <thead><tr><th>Category</th><th className="num">Count</th><th className="num">Total</th></tr></thead>
                <tbody>{byCategory.length === 0 ? <EmptyRow columns={3}>No expense data.</EmptyRow> : byCategory.map((item) => <tr key={item.category_id}><td>{item.category_name}</td><td className="num">{item.count}</td><td className="num">{formatMoney(item.total)}</td></tr>)}</tbody>
              </table>
            </Section>
          </div>
          <Section title="Expense Transactions">
            <table className="report-print-expense-transactions-table">
              <colgroup><col style={{ width: "16%" }} /><col style={{ width: "22%" }} /><col style={{ width: "46%" }} /><col style={{ width: "16%" }} /></colgroup>
              <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="num">Amount</th></tr></thead>
              <tbody>{expenses.length === 0 ? <EmptyRow columns={4}>No expenses in this period.</EmptyRow> : expenses.map((item) => <tr key={item.id}><td>{formatDate(item.expense_date)}</td><td>{item.category_name ?? "—"}</td><td className="report-print-expense-description">{item.description ?? "—"}</td><td className="num">{formatMoney(item.amount)}</td></tr>)}</tbody>
            </table>
          </Section>
        </div>
      </div>}

      {reportType === "profit-loss" && <>
        <Metrics items={[{ label: "Revenue", value: formatMoney(profitLoss?.total_revenue ?? 0) }, { label: "COGS", value: formatMoney(profitLoss?.total_cogs ?? 0) }, { label: "Expenses", value: formatMoney(profitLoss?.total_expenses ?? 0) }, { label: "Gross Profit", value: formatMoney(profitLoss?.gross_profit ?? 0) }, { label: "Net Profit", value: formatMoney(profitLoss?.net_profit ?? 0) }]} />
        <Section title="Profit & Loss Statement"><table><tbody><tr><td>Revenue</td><td className="num">{formatMoney(profitLoss?.total_revenue ?? 0)}</td></tr><tr><td>Less: Cost of Goods Sold</td><td className="num">{formatMoney(profitLoss?.total_cogs ?? 0)}</td></tr><tr><td><strong>Gross Profit</strong></td><td className="num"><strong>{formatMoney(profitLoss?.gross_profit ?? 0)}</strong></td></tr><tr><td>Less: Operating Expenses</td><td className="num">{formatMoney(profitLoss?.total_expenses ?? 0)}</td></tr><tr><td><strong>Net Profit</strong></td><td className="num"><strong>{formatMoney(profitLoss?.net_profit ?? 0)}</strong></td></tr></tbody></table></Section>
        <Section title="Monthly Profit Analysis"><table><thead><tr><th>Month</th><th className="num">Revenue</th><th className="num">COGS</th><th className="num">Expenses</th><th className="num">Gross Profit</th><th className="num">Net Profit</th></tr></thead><tbody>{!profitLoss?.monthly.length ? <EmptyRow columns={6}>No profit and loss data in this period.</EmptyRow> : profitLoss.monthly.map((item) => <tr key={item.month}><td>{item.month}</td><td className="num">{formatMoney(item.revenue)}</td><td className="num">{formatMoney(item.cogs)}</td><td className="num">{formatMoney(item.expenses)}</td><td className="num">{formatMoney(item.gross_profit)}</td><td className="num">{formatMoney(item.net_profit)}</td></tr>)}</tbody></table></Section>
        <div className="report-print-totals"><div><span>GROSS PROFIT</span><strong>{formatMoney(profitLoss?.gross_profit ?? 0)}</strong></div><div><span>NET PROFIT</span><strong>{formatMoney(profitLoss?.net_profit ?? 0)}</strong></div></div>
      </>}

    </article>
  );
});
