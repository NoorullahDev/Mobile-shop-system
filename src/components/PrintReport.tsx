import { memo } from "react";
import { formatMoney, formatDate } from "../lib/format";
import { useSettingsStore } from "../store/settings";
import type { PeriodSummary, PaymentBreakdown, TopSeller } from "../types/report";
import type { CategoryTotal, Expense } from "../types/expense";

interface PrintReportProps {
  from: string;
  to: string;
  summary: PeriodSummary | null;
  byCategory: CategoryTotal[];
  expenses: Expense[];
  salesSeries: { day: string; label: string; Revenue: number }[];
  breakdown: PaymentBreakdown[];
  topSellers: TopSeller[];
  customerDues: number;
  supplierDues: number;
}

const methodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  credit: "Credit",
  other: "Other",
};

export const PrintReport = memo(function PrintReport({
  from,
  to,
  summary,
  byCategory,
  expenses,
  salesSeries,
  breakdown,
  topSellers,
  customerDues,
  supplierDues,
}: PrintReportProps) {
  const shopName = useSettingsStore((s) => s.businessName);
  const shopLogo = useSettingsStore((s) => s.logo);
  const phone = useSettingsStore((s) => s.phone);
  const email = useSettingsStore((s) => s.email);
  const address = useSettingsStore((s) => s.address);
  const contacts = [phone, email].filter(Boolean).join(" · ");

  return (
    <div className="print-report">
      <div
        className="shop-header"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "10px",
          paddingBottom: "8px",
          borderBottom: "2px solid #cbd5e1",
        }}
      >
        {shopLogo && (
          <img
            src={shopLogo}
            alt=""
            style={{ height: "40px", width: "40px", objectFit: "contain", flexShrink: 0 }}
          />
        )}
        <div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
            {shopName || "Mobile Shop System"}
          </div>
          {(contacts || address) && (
            <div style={{ fontSize: "10px", color: "#475569" }}>
              {contacts && <span>{contacts}</span>}
              {contacts && address ? " · " : ""}
              {address}
            </div>
          )}
        </div>
      </div>

      <h1>Sales &amp; Financial Report</h1>
      <div className="print-sub">
        Period: {formatDate(from)} — {formatDate(to)}
      </div>

      <div className="kpis">
        <div className="kpi">
          <div>Gross Revenue</div>
          <strong>{formatMoney(summary?.revenue ?? 0)}</strong>
        </div>
        <div className="kpi">
          <div>Cash Received</div>
          <strong>{formatMoney(summary?.received ?? 0)}</strong>
        </div>
        <div className="kpi">
          <div>Outstanding</div>
          <strong>{formatMoney(summary?.outstanding ?? 0)}</strong>
        </div>
        <div className="kpi">
          <div>Expenses</div>
          <strong>{formatMoney(summary?.expenses ?? 0)}</strong>
        </div>
        <div className="kpi">
          <div>Net Profit</div>
          <strong>{formatMoney(summary?.profit ?? 0)}</strong>
        </div>
        <div className="kpi">
          <div>Discounts</div>
          <strong>{formatMoney(summary?.discount ?? 0)}</strong>
        </div>
      </div>

      <h2>Sales by Day</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th className="num">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {salesSeries.length === 0 ? (
            <tr>
              <td colSpan={2}>No sales in this period.</td>
            </tr>
          ) : (
            salesSeries.map((d) => (
              <tr key={d.day}>
                <td>{formatDate(d.day)}</td>
                <td className="num">{formatMoney(d.Revenue)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h2>Payment Method Mix</h2>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th className="num">Count</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.length === 0 ? (
            <tr>
              <td colSpan={3}>No sales in this period.</td>
            </tr>
          ) : (
            breakdown.map((b) => (
              <tr key={b.payment_method}>
                <td>{methodLabels[b.payment_method] ?? b.payment_method}</td>
                <td className="num">{b.count}</td>
                <td className="num">{formatMoney(b.total)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h2>Top Selling Products</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th className="num">Qty</th>
            <th className="num">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {topSellers.length === 0 ? (
            <tr>
              <td colSpan={4}>No sales in this period.</td>
            </tr>
          ) : (
            topSellers.map((t, i) => (
              <tr key={t.item_id}>
                <td>{i + 1}</td>
                <td>{t.product_name}</td>
                <td className="num">{t.quantity}</td>
                <td className="num">{formatMoney(t.revenue)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h2>Receivables &amp; Payables</h2>
      <table>
        <tbody>
          <tr>
            <td>Customer Receivables</td>
            <td className="num">{formatMoney(customerDues)}</td>
          </tr>
          <tr>
            <td>Supplier Payables</td>
            <td className="num">{formatMoney(supplierDues)}</td>
          </tr>
        </tbody>
      </table>

      <h2>Expenses by Category</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {byCategory.length === 0 ? (
            <tr>
              <td colSpan={2}>No expenses in this period.</td>
            </tr>
          ) : (
            byCategory.map((c) => (
              <tr key={c.category_id}>
                <td>{c.category_name}</td>
                <td className="num">{formatMoney(c.total)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h2>Expense Transactions</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 ? (
            <tr>
              <td colSpan={4}>No expense transactions in this period.</td>
            </tr>
          ) : (
            expenses.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(e.expense_date)}</td>
                <td>{e.category_name ?? "—"}</td>
                <td>{e.description ?? "—"}</td>
                <td className="num">{formatMoney(e.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});
