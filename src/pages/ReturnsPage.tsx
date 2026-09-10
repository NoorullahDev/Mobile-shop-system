import { useEffect, useState } from "react";
import { Plus, Search, X, RotateCcw, Eye, Receipt as ReceiptIcon } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button, Spinner } from "../components/Button";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import { useReturnStore } from "../store/returns";
import { NewReturnModal } from "./NewReturnModal";
import type { ProductReturn, ReturnSummary } from "../types/return";

function formatPKR(n: number) {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

function formatDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReturnsPage() {
  const { returns, loading, error, load, get } = useReturnStore();
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<ProductReturn | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const doSearch = () => load(search);

  const openDetail = async (r: ReturnSummary) => {
    setDetailLoading(true);
    const full = await get(r.id);
    setDetail(full);
    setDetailLoading(false);
  };

  return (
    <div>
      <PageHeader
        title="Returns"
        description="Process product returns, refunds and restocking charges"
        breadcrumb={[{ label: "Sales" }, { label: "Returns" }]}
        meta={`${returns.length} return${returns.length !== 1 ? "s" : ""}`}
        actions={
          <Button
            onClick={() => setNewOpen(true)}
            icon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            New Return
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
              placeholder="Search return no, invoice, customer name/phone, product, IMEI…"
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
          <Button variant="secondary" size="sm" onClick={doSearch}>
            Search
          </Button>
          <span
            className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: "#F1F5F9", color: "#475569" }}
          >
            {returns.length} returns
          </span>
        </div>

        {/* Table / States */}
        {loading ? (
          <div
            className="flex items-center justify-center gap-2 py-16"
            style={{ color: "#64748B" }}
          >
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading returns…</span>
          </div>
        ) : returns.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ReceiptIcon}
              title="No returns recorded"
              description={
                search
                  ? "No returns match your search."
                  : "Process your first product return to see it here."
              }
              action={
                !search ? (
                  <Button
                    onClick={() => setNewOpen(true)}
                    icon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Process a Return
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
                  <th>Return No</th>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th className="text-right">Items Value</th>
                  <th className="text-right">Deduction</th>
                  <th className="text-right">Refund</th>
                  <th>Condition</th>
                  <th>Returned</th>
                  <th className="text-center">Detail</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="font-mono font-semibold" style={{ color: "#1B2A4A", fontSize: "13px" }}>
                        {r.return_no}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ color: "#64748B", fontSize: "12px" }}>
                        {r.receipt_no ?? "—"}
                      </span>
                    </td>
                    <td style={{ color: "#0F172A", fontSize: "13px" }}>
                      {r.customer_name ?? "Walk-in"}
                      {r.customer_phone && (
                        <div className="font-mono text-[11px]" style={{ color: "#64748B" }}>
                          {r.customer_phone}
                        </div>
                      )}
                    </td>
                    <td className="text-right text-[13px]" style={{ color: "#0F172A" }}>
                      {formatPKR(r.total_sale_price)}
                    </td>
                    <td className="text-right text-[13px]" style={{ color: "#DC2626" }}>
                      {formatPKR(r.deduction_amount)}
                    </td>
                    <td className="text-right">
                      <span className="font-semibold text-[13px]" style={{ color: "#16A34A" }}>
                        {formatPKR(r.refund_amount)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={r.condition} />
                    </td>
                    <td style={{ color: "#64748B", fontSize: "12px" }}>
                      {formatDate(r.return_date ?? r.created_at)}
                    </td>
                    <td className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye className="h-3.5 w-3.5" />}
                        onClick={() => openDetail(r)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewReturnModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => load()}
      />

      {/* Return detail */}
      <Modal
        open={detail != null}
        title={detail ? `Return ${detail.return_no}` : "Return"}
        subtitle={
          detail
            ? `${detail.receipt_no ?? ""} · ${detail.customer_name ?? "Walk-in"}${detail.customer_phone ? ` · ${detail.customer_phone}` : ""}`
            : ""
        }
        onClose={() => setDetail(null)}
        size="lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center gap-2 py-10" style={{ color: "#64748B" }}>
            <Spinner className="h-5 w-5" /> Loading…
          </div>
        ) : detail ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
              <div>
                <div style={{ color: "#94A3B8" }}>Invoice</div>
                <div className="font-mono font-medium" style={{ color: "#0F172A" }}>
                  {detail.receipt_no ?? "—"}
                </div>
              </div>
              <div>
                <div style={{ color: "#94A3B8" }}>Refund method</div>
                <div className="font-medium capitalize" style={{ color: "#0F172A" }}>
                  {detail.refund_method.replace("_", " ")}
                </div>
              </div>
              <div>
                <div style={{ color: "#94A3B8" }}>Returned</div>
                <div style={{ color: "#0F172A" }}>{formatDate(detail.return_date)}</div>
              </div>
              <div>
                <div style={{ color: "#94A3B8" }}>Status</div>
                <StatusBadge status={detail.status} />
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Line Total</th>
                  <th className="text-right">Deduction</th>
                  <th className="text-right">Refund</th>
                  <th className="text-center">Restocked</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <div style={{ color: "#0F172A", fontSize: "13px" }}>{it.product_name ?? "—"}</div>
                      <div className="text-[11px]" style={{ color: "#64748B" }}>
                        {it.imei && <span className="font-mono">IMEI: {it.imei}</span>}
                        {it.serial_no && <span className="font-mono"> SN: {it.serial_no}</span>}
                        <span> · {it.condition}</span>
                      </div>
                      {it.reason && (
                        <div className="text-[11px]" style={{ color: "#94A3B8" }}>
                          Reason: {it.reason}
                        </div>
                      )}
                    </td>
                    <td className="text-center" style={{ fontSize: "13px" }}>
                      {it.quantity}
                    </td>
                    <td className="text-right text-[13px]">{formatPKR(it.unit_price)}</td>
                    <td className="text-right text-[13px]">{formatPKR(it.line_total)}</td>
                    <td className="text-right text-[13px]" style={{ color: "#DC2626" }}>
                      {formatPKR(it.deduction_amount)}
                    </td>
                    <td className="text-right text-[13px] font-semibold" style={{ color: "#16A34A" }}>
                      {formatPKR(it.refund_amount)}
                    </td>
                    <td className="text-center">
                      {it.restocked ? <StatusBadge status="processed" /> : <StatusBadge status="nonsellable" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              className="rounded bg-white p-3"
              style={{ border: "1px solid #E2E8F0", background: "#F8FAFC" }}
            >
              <div className="flex justify-between py-0.5 text-[13px]">
                <span style={{ color: "#334155" }}>Items value</span>
                <span style={{ color: "#0F172A", fontWeight: 600 }}>{formatPKR(detail.total_sale_price)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-[13px]">
                <span style={{ color: "#334155" }}>
                  Deduction
                  {detail.return_charge_percent > 0 && ` (${detail.return_charge_percent}%)`}
                </span>
                <span style={{ color: "#DC2626", fontWeight: 600 }}>{formatPKR(detail.deduction_amount)}</span>
              </div>
              <div
                className="mt-1 flex justify-between rounded px-3 py-1.5"
                style={{ border: "1px solid #BBF7D0", background: "#F0FDF4" }}
              >
                <span className="text-[13px] font-medium" style={{ color: "#166534" }}>
                  Refunded
                </span>
                <span className="text-[15px] font-bold" style={{ color: "#16A34A" }}>
                  {formatPKR(detail.refund_amount)}
                </span>
              </div>
            </div>

            {detail.notes && (
              <div className="text-[13px]" style={{ color: "#64748B" }}>
                <span style={{ fontWeight: 500, color: "#334155" }}>Notes: </span>
                {detail.notes}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}