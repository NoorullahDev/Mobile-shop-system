import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Receipt as ReceiptIcon,
  Eye,
  ShoppingCart,
  X,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { SaleForm } from "./SaleForm";
import { SaleReceipt } from "./SaleReceipt";
import { useSaleStore } from "../store/sales";
import { useInventoryStore } from "../store/inventory";
import { useMemberStore } from "../store/members";
import { useSessionStore } from "../store/session";
import type { Sale } from "../types/sale";

function formatPKR(n: number) {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

export function SalesPage() {
  const { sales, loading, error, load, add } = useSaleStore();
  const { products, load: loadInventory } = useInventoryStore();
  const { members, load: loadMembers } = useMemberStore();
  const user = useSessionStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [saleOpen, setSaleOpen] = useState(false);
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [justCreated, setJustCreated] = useState<Sale | null>(null);

  useEffect(() => {
    load();
    loadInventory();
    loadMembers();
  }, [load, loadInventory, loadMembers]);

  const doSearch = () => load(search);

  const handleCreate = async (input: Parameters<typeof add>[0]) => {
    const created = await add(input, user?.id ?? null);
    await loadInventory();
    setSaleOpen(false);
    if (created) setJustCreated(created);
  };

  return (
    <div>
      <PageHeader
        title="Sales History"
        description="View all sales transactions and receipts"
        breadcrumb={[{ label: "Sales" }, { label: "History" }]}
        meta={`${sales.length} sales`}
        actions={
          <Button
            onClick={() => setSaleOpen(true)}
            icon={<ShoppingCart className="h-3.5 w-3.5" />}
          >
            New Sale
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert message={error} variant="error" />
        </div>
      )}

      <Card noPadding>
        {/* Filter bar */}
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
              placeholder="Search by receipt no or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
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
                onClick={() => { setSearch(""); load(""); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "#94A3B8" }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={doSearch}>
            Search
          </Button>
          <span
            className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: "#F1F5F9", color: "#475569" }}
          >
            {sales.length} transactions
          </span>
        </div>

        {/* Table / States */}
        {loading ? (
          <div
            className="flex items-center justify-center gap-2 py-16"
            style={{ color: "#64748B" }}
          >
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading sales...</span>
          </div>
        ) : sales.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ReceiptIcon}
              title="No sales recorded"
              description={
                search
                  ? "No sales match your search."
                  : "Record your first sale to generate an invoice."
              }
              action={
                !search ? (
                  <Button
                    onClick={() => setSaleOpen(true)}
                    icon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Record First Sale
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
                  <th>Invoice No</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th className="text-right">Total</th>
                  <th>Payment</th>
                  <th>Date & Time</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => setViewSale(s)}
                  >
                    {/* Invoice No */}
                    <td>
                      <span
                        className="font-mono font-semibold"
                        style={{ color: "#1B2A4A", fontSize: "13px" }}
                      >
                        {s.receipt_no}
                      </span>
                    </td>

                    {/* Customer */}
                    <td>
                      <span style={{ color: "#0F172A", fontSize: "13px" }}>
                        {s.member_name ?? (
                          <span style={{ color: "#94A3B8", fontStyle: "italic" }}>
                            Walk-in
                          </span>
                        )}
                      </span>
                    </td>

                    {/* Items count */}
                    <td style={{ color: "#64748B", fontSize: "13px" }}>
                      {s.items.length} item{s.items.length !== 1 ? "s" : ""}
                    </td>

                    {/* Total */}
                    <td className="text-right">
                      <span
                        className="amount font-semibold text-[13px]"
                        style={{ color: "#0F172A" }}
                      >
                        {formatPKR(s.total_amount)}
                      </span>
                    </td>

                    {/* Payment method */}
                    <td>
                      <StatusBadge status={s.payment_method} />
                    </td>

                    {/* Date */}
                    <td style={{ color: "#64748B", fontSize: "12px" }}>
                      {new Date(s.created_at).toLocaleString("en-PK", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* Actions */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setViewSale(s)}
                          className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-blue-50"
                          style={{ color: "#3B6FD4" }}
                          title="View receipt"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* New Sale Modal */}
      <Modal
        open={saleOpen}
        title="New Sale"
        subtitle="Add items, select customer, and choose payment method"
        onClose={() => setSaleOpen(false)}
        size="xl"
      >
        <SaleForm
          onSubmit={handleCreate}
          onCancel={() => setSaleOpen(false)}
          products={products}
          members={members}
        />
      </Modal>

      {/* Receipt Modal */}
      <Modal
        open={viewSale !== null || justCreated !== null}
        title={justCreated ? "Sale Completed!" : "Sale Receipt"}
        subtitle={justCreated ? "Invoice generated successfully" : undefined}
        onClose={() => {
          setViewSale(null);
          setJustCreated(null);
        }}
        size="lg"
      >
        {(viewSale ?? justCreated) && (
          <SaleReceipt
            sale={(viewSale ?? justCreated)!}
            onClose={() => {
              setViewSale(null);
              setJustCreated(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
