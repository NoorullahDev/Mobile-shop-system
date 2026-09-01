import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  ShoppingCart,
  CircleDollarSign,
  CreditCard,
  ArrowLeftRight,
  X,
  FileText,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Button";
import { PurchaseForm } from "./PurchaseForm";
import { usePurchaseStore } from "../store/purchases";
import { useInventoryStore } from "../store/inventory";
import { useSupplierStore } from "../store/suppliers";
import { useSessionStore } from "../store/session";
import * as purchaseService from "../services/purchaseService";
import { formatMoney, formatDate } from "../lib/format";
import type { Purchase } from "../types/purchase";

const methodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
};

export function PurchasesPage() {
  const { purchases, loading, error, load, add } = usePurchaseStore();
  const { products, load: loadInventory } = useInventoryStore();
  const { suppliers, load: loadSuppliers } = useSupplierStore();
  const user = useSessionStore((s) => s.user);

  const [search, setSearch] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    load();
    loadInventory();
    loadSuppliers();
  }, [load, loadInventory, loadSuppliers]);

  const searchPurchases = () => load(search);

  const openDetail = async (p: Purchase) => {
    setDetailLoading(true);
    setDetail(p);
    try {
      const full = await purchaseService.getPurchase(p.id);
      if (full) setDetail(full);
    } catch {
      /* keep the already-loaded row */
    } finally {
      setDetailLoading(false);
    }
  };

  const totalCost = purchases.reduce((s, p) => s + p.total_amount, 0);
  const totalPaid = purchases.reduce((s, p) => s + p.paid_amount, 0);
  const outstanding = Math.max(0, totalCost - totalPaid);

  return (
    <div>
      <PageHeader
        title="Purchases"
        description="Record purchase orders and track supplier costs"
        breadcrumb={[{ label: "Suppliers" }, { label: "Purchases" }]}
        meta={`${purchases.length} purchase${purchases.length !== 1 ? "s" : ""}`}
        actions={
          <Button onClick={() => setRecordOpen(true)} icon={<Plus className="h-3.5 w-3.5" />}>
            Record Purchase
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert message={error} variant="error" />
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Purchases"
          value={formatMoney(totalCost)}
          icon={ShoppingCart}
          tone="primary"
        />
        <KpiCard
          title="Costs Paid"
          value={formatMoney(totalPaid)}
          icon={CreditCard}
          tone="green"
        />
        <KpiCard
          title="Outstanding to Suppliers"
          value={formatMoney(outstanding)}
          icon={CircleDollarSign}
          tone="amber"
        />
        <KpiCard
          title="Transactions"
          value={String(purchases.length)}
          icon={ArrowLeftRight}
          tone="navy"
          sub="purchase orders"
        />
      </div>

      <Card noPadding>
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid #E2E8F0" }}
        >
          <div className="relative flex-1 max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "#94A3B8" }}
            />
            <input
              className="h-9 w-full rounded border bg-white pl-9 pr-8 text-[13px] outline-none transition-all placeholder:text-[#94A3B8]"
              style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
              placeholder="Search by purchase no or supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchPurchases()}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3B6FD4";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,111,212,0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#CBD5E1";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  load("");
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "#94A3B8" }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={searchPurchases}>
            Search
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16" style={{ color: "#64748B" }}>
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading purchases...</span>
          </div>
        ) : purchases.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ShoppingCart}
              title="No purchases recorded"
              description={
                search ? "No purchases match your search." : "Record your first purchase order."
              }
              action={
                !search ? (
                  <Button onClick={() => setRecordOpen(true)} icon={<Plus className="h-3.5 w-3.5" />}>
                    Record Purchase
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Purchase No</th>
                  <th>Supplier</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Due</th>
                  <th>Method</th>
                  <th>Date</th>
                  <th className="text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p, idx) => {
                  const due = Math.max(0, p.total_amount - p.paid_amount);
                  return (
                    <tr key={p.id}>
                      <td style={{ color: "#94A3B8", fontSize: "12px" }}>{idx + 1}</td>
                      <td>
                        <span className="font-mono font-semibold" style={{ fontSize: "12px", color: "#0F172A" }}>
                          {p.purchase_no}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold" style={{ fontSize: "13px", color: "#0F172A" }}>
                          {p.supplier_name ?? (
                            <span style={{ color: "#94A3B8", fontStyle: "italic" }}>—</span>
                          )}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="amount font-semibold text-[13px]" style={{ color: "#0F172A" }}>
                          {formatMoney(p.total_amount)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="amount font-semibold text-[13px]" style={{ color: "#16A34A" }}>
                          {formatMoney(p.paid_amount)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span
                          className="amount font-semibold text-[13px]"
                          style={{ color: due > 0 ? "#B45309" : "#94A3B8" }}
                        >
                          {formatMoney(due)}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: "#475569", fontSize: "13px" }}>
                          {methodLabels[p.payment_method] ?? p.payment_method}
                        </span>
                      </td>
                      <td style={{ color: "#64748B", fontSize: "12px" }}>{formatDate(p.created_at)}</td>
                      <td>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => openDetail(p)}
                            className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-blue-50"
                            style={{ color: "#3B6FD4" }}
                            title="View details"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={recordOpen}
        title="Record Purchase"
        subtitle="Log a purchase order from a supplier"
        onClose={() => setRecordOpen(false)}
        size="lg"
      >
        <PurchaseForm
          onSubmit={async (input) => {
            await add(input, user?.id ?? null);
            await loadInventory();
            setRecordOpen(false);
          }}
          onCancel={() => setRecordOpen(false)}
          suppliers={suppliers}
          products={products}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={detail !== null}
        title={detail ? `${detail.purchase_no} — Details` : "Purchase Details"}
        onClose={() => setDetail(null)}
        size="lg"
      >
        {detail && (
          <div className="flex flex-col gap-4">
            {detailLoading ? (
              <div className="flex items-center justify-center gap-2 py-8" style={{ color: "#64748B" }}>
                <Spinner className="h-5 w-5" />
                <span className="text-[13px]">Loading...</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="rounded-lg p-3"
                    style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
                  >
                    <div className="text-[11px] uppercase tracking-wide" style={{ color: "#94A3B8" }}>
                      Supplier
                    </div>
                    <div className="mt-1 text-[14px] font-semibold" style={{ color: "#0F172A" }}>
                      {detail.supplier_name ?? "—"}
                    </div>
                  </div>
                  <div
                    className="rounded-lg p-3"
                    style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
                  >
                    <div className="text-[11px] uppercase tracking-wide" style={{ color: "#94A3B8" }}>
                      Date
                    </div>
                    <div className="mt-1 text-[14px] font-semibold" style={{ color: "#0F172A" }}>
                      {formatDate(detail.created_at)}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Unit Cost</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((it) => (
                        <tr key={it.id}>
                          <td>
                            <span className="font-semibold" style={{ fontSize: "13px", color: "#0F172A" }}>
                              {it.product_name ?? `Item #${it.item_id}`}
                            </span>
                          </td>
                          <td className="text-right" style={{ fontSize: "13px", color: "#475569" }}>
                            {it.quantity}
                          </td>
                          <td className="text-right" style={{ fontSize: "13px", color: "#475569" }}>
                            {formatMoney(it.unit_cost)}
                          </td>
                          <td className="text-right" style={{ fontSize: "13px", color: "#0F172A" }}>
                            {formatMoney(it.line_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div
                    className="rounded-lg p-3"
                    style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
                  >
                    <div className="text-[11px] uppercase tracking-wide" style={{ color: "#94A3B8" }}>
                      Total
                    </div>
                    <div className="mt-1 amount text-[15px] font-bold" style={{ color: "#0F172A" }}>
                      {formatMoney(detail.total_amount)}
                    </div>
                  </div>
                  <div
                    className="rounded-lg p-3"
                    style={{ background: "#F0FDF4", border: "1px solid #DCFCE7" }}
                  >
                    <div className="text-[11px] uppercase tracking-wide" style={{ color: "#94A3B8" }}>
                      Paid
                    </div>
                    <div className="mt-1 amount text-[15px] font-bold" style={{ color: "#15803D" }}>
                      {formatMoney(detail.paid_amount)}
                    </div>
                  </div>
                  <div
                    className="rounded-lg p-3"
                    style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}
                  >
                    <div className="text-[11px] uppercase tracking-wide" style={{ color: "#94A3B8" }}>
                      Due
                    </div>
                    <div className="mt-1 amount text-[15px] font-bold" style={{ color: "#B45309" }}>
                      {formatMoney(Math.max(0, detail.total_amount - detail.paid_amount))}
                    </div>
                  </div>
                </div>

                <div className="text-[12px]" style={{ color: "#64748B" }}>
                  Method: {methodLabels[detail.payment_method] ?? detail.payment_method}
                  {detail.notes ? ` · ${detail.notes}` : ""}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
