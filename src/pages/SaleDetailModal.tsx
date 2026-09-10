import { useEffect, useState } from "react";
import { ReceiptText, RotateCcw } from "lucide-react";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Button";
import { Alert } from "../components/Alert";
import { StatusBadge } from "../components/StatusBadge";
import * as saleService from "../services/saleService";
import type { Sale } from "../types/sale";
import type { ReturnItem } from "../types/return";

function fmt(n: number) {
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

function returnStatusLabel(s?: string) {
  if (s === "full") return "Fully Returned";
  if (s === "partial") return "Partially Returned";
  return "No Return";
}

interface SaleDetailModalProps {
  open: boolean;
  saleId: number | null;
  onClose: () => void;
}

export function SaleDetailModal({ open, saleId, onClose }: SaleDetailModalProps) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || saleId == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    saleService
      .getSale(saleId)
      .then((full) => {
        if (!cancelled) setSale(full);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, saleId]);

  const returnedQtyFor = (saleItemId: number) => {
    let qty = 0;
    for (const r of sale?.returns ?? []) {
      for (const it of r.items) {
        if (it.sale_item_id === saleItemId) qty += it.quantity;
      }
    }
    return qty;
  };

  return (
    <Modal
      open={open}
      title="Sale Details"
      subtitle={sale ? `${sale.receipt_no} · ${sale.member_name ?? "Walk-in"}${sale.member_phone ? ` · ${sale.member_phone}` : ""}` : ""}
      onClose={onClose}
      size="lg"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10" style={{ color: "#64748B" }}>
          <Spinner className="h-5 w-5" /> Loading sale…
        </div>
      ) : error ? (
        <Alert message={error} variant="error" />
      ) : sale ? (
        <div className="flex flex-col gap-4">
          {/* Header strip */}
          <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
            <div>
              <div style={{ color: "#94A3B8" }}>Invoice</div>
              <div className="font-mono font-medium" style={{ color: "#0F172A" }}>
                {sale.receipt_no}
              </div>
            </div>
            <div>
              <div style={{ color: "#94A3B8" }}>Date &amp; Time</div>
              <div style={{ color: "#0F172A" }}>{formatDate(sale.created_at)}</div>
            </div>
            <div>
              <div style={{ color: "#94A3B8" }}>Payment</div>
              <StatusBadge status={sale.payment_method} />
            </div>
            <div>
              <div style={{ color: "#94A3B8" }}>Total</div>
              <div className="font-semibold" style={{ color: "#0F172A" }}>
                {fmt(sale.total_amount)}
                {sale.discount > 0 && (
                  <span className="ml-1 text-[11px] font-normal" style={{ color: "#16A34A" }}>
                    −{fmt(sale.discount)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Return summary */}
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded p-3"
            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" style={{ color: "#64748B" }} />
              <StatusBadge status={sale.return_status ?? "none"} label={returnStatusLabel(sale.return_status)} />
              {(sale.return_status === "partial" || sale.return_status === "full") && (
                <>
                  <span className="text-[13px]" style={{ color: "#334155" }}>
                    Refunded:
                  </span>
                  <span className="text-[13px] font-semibold" style={{ color: "#16A34A" }}>
                    {fmt(sale.returned_amount ?? 0)}
                  </span>
                  {(sale.return_count ?? 0) > 1 && (
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "#E2E8F0", color: "#475569" }}>
                      {sale.return_count} returns
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Sold items with per-item return state */}
          <div>
            <div className="mb-1 text-[13px] font-medium" style={{ color: "#334155" }}>
              Sold items
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-center">Returned</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((it) => {
                  const returnedQty = returnedQtyFor(it.id);
                  return (
                    <tr key={it.id}>
                      <td>
                        <div style={{ color: "#0F172A", fontSize: "13px" }}>{it.product_name ?? "—"}</div>
                        {it.imei && (
                          <div className="font-mono text-[11px]" style={{ color: "#64748B" }}>
                            IMEI: {it.imei}
                          </div>
                        )}
                        {it.variant && (
                          <div className="text-[11px]" style={{ color: "#64748B" }}>{it.variant}</div>
                        )}
                      </td>
                      <td className="text-center" style={{ fontSize: "13px" }}>{it.quantity}</td>
                      <td className="text-right text-[13px]">{fmt(it.unit_price)}</td>
                      <td className="text-center">
                        {returnedQty > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={returnedQty >= it.quantity
                              ? { background: "#DCFCE7", color: "#15803D" }
                              : { background: "#FEF3C7", color: "#B45309" }}
                          >
                            {returnedQty} of {it.quantity}
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: "#94A3B8" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Return records */}
          {sale.returns && sale.returns.length > 0 ? (
            <div>
              <div className="mb-1 text-[13px] font-medium" style={{ color: "#334155" }}>
                Returns
              </div>
              <div className="flex flex-col gap-2">
                {sale.returns.map((r) => (
                  <div
                    key={r.id}
                    className="rounded border p-3"
                    style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono font-semibold text-[13px]" style={{ color: "#1B2A4A" }}>
                        {r.return_no}
                      </span>
                      <StatusBadge status={r.condition} />
                      <span style={{ color: "#64748B", fontSize: "12px" }}>
                        {formatDate(r.return_date ?? r.created_at)}
                      </span>
                      <span className="text-[12px] capitalize" style={{ color: "#64748B" }}>
                        {r.refund_method.replace("_", " ")}
                      </span>
                      <span className="ml-auto flex items-center gap-3 text-[12px]">
                        <span style={{ color: "#334155" }}>
                          Items: <strong>{fmt(r.total_sale_price)}</strong>
                        </span>
                        <span style={{ color: "#DC2626" }}>
                          Deduction: <strong>{fmt(r.deduction_amount)}</strong>
                        </span>
                        <span style={{ color: "#16A34A" }}>
                          Refund: <strong>{fmt(r.refund_amount)}</strong>
                        </span>
                      </span>
                    </div>

                    <div className="mt-2 overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Returned item</th>
                            <th className="text-center">Qty</th>
                            <th className="text-right">Line Total</th>
                            <th className="text-right">Deduction</th>
                            <th className="text-right">Refund</th>
                            <th className="text-center">State</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.items.map((it) => (
                            <tr key={it.id}>
                              <td>
                                <div style={{ color: "#0F172A", fontSize: "13px" }}>
                                  {it.product_name ?? "—"}
                                </div>
                                <ReturnItemMeta it={it} />
                              </td>
                              <td className="text-center" style={{ fontSize: "13px" }}>{it.quantity}</td>
                              <td className="text-right text-[13px]">{fmt(it.line_total)}</td>
                              <td className="text-right text-[13px]" style={{ color: "#DC2626" }}>
                                {fmt(it.deduction_amount)}
                              </td>
                              <td className="text-right text-[13px] font-semibold" style={{ color: "#16A34A" }}>
                                {fmt(it.refund_amount)}
                              </td>
                              <td className="text-center">
                                <StatusBadge status={it.restocked ? "processed" : "nonsellable"} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 rounded p-3 text-[13px]"
              style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#64748B" }}
            >
              <ReceiptText className="h-4 w-4" style={{ color: "#94A3B8" }} />
              No return has been recorded against this sale.
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

function ReturnItemMeta({ it }: { it: ReturnItem }) {
  return (
    <div className="text-[11px]" style={{ color: "#64748B" }}>
      {it.imei && <span className="font-mono">IMEI: {it.imei}</span>}
      {it.serial_no && <span className="font-mono"> SN: {it.serial_no}</span>}
      <span className="capitalize"> · {it.condition}</span>
      {it.reason && (
        <div style={{ color: "#94A3B8" }}>Reason: {it.reason}</div>
      )}
    </div>
  );
}