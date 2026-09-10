import { useMemo, useState } from "react";
import { Undo2, Search } from "lucide-react";
import { Modal } from "../components/Modal";
import { Button, Spinner } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import * as saleService from "../services/saleService";
import { useReturnStore } from "../store/returns";
import { useSessionStore } from "../store/session";
import { RETURN_CHARGE_OPTIONS, RETURN_CONDITIONS } from "../types/return";
import { REFUND_METHODS } from "../types/return";
import type { CreateReturnInput, ProductReturn } from "../types/return";
import type { Sale, SaleItem } from "../types/sale";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmt(n: number) {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

function nowLocalValue() {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface DraftLine {
  saleItem: SaleItem;
  quantity: number;
  imeiId: number | null;
  reason: string;
  condition: string;
}

interface NewReturnModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (r: ProductReturn) => void;
}

export function NewReturnModal({ open, onClose, onCreated }: NewReturnModalProps) {
  const { add } = useReturnStore();
  const user = useSessionStore((s) => s.user);

  // Sale lookup
  const [salesSearch, setSalesSearch] = useState("");
  const [salesResult, setSalesResult] = useState<Sale[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [loadingSale, setLoadingSale] = useState(false);

  // Draft lines
  const [lines, setLines] = useState<DraftLine[]>([]);

  // Charge + refund details
  const [chargeOption, setChargeOption] = useState<string>("0");
  const [customPercent, setCustomPercent] = useState("");
  const [fixedMode, setFixedMode] = useState(false);
  const [fixedAmount, setFixedAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<string>("cash");
  const [returnDate, setReturnDate] = useState(nowLocalValue);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSalesSearch("");
    setSalesResult(null);
    setSelectedSale(null);
    setLines([]);
    setChargeOption("0");
    setCustomPercent("");
    setFixedMode(false);
    setFixedAmount("");
    setRefundMethod("cash");
    setReturnDate(nowLocalValue());
    setNotes("");
    setError(null);
  };

  const doSearch = async () => {
    if (!salesSearch.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setSalesResult(await saleService.listSales(salesSearch.trim()));
    } catch (e) {
      setError(String(e));
    } finally {
      setSearching(false);
    }
  };

  const pickSale = async (sale: Sale) => {
    setLoadingSale(true);
    setError(null);
    try {
      const full = await saleService.getSale(sale.id);
      setSelectedSale(full);
      setLines([]);
      setSalesResult(null);
      setSalesSearch("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingSale(false);
    }
  };

  const toggleItem = (saleItem: SaleItem, on: boolean) => {
    setLines((prev) => {
      if (on) {
        if (prev.some((l) => l.saleItem.id === saleItem.id)) return prev;
        return [
          ...prev,
          {
            saleItem,
            quantity: 1,
            imeiId: saleItem.imei_id ?? null,
            reason: "",
            condition: "sellable",
          },
        ];
      }
      return prev.filter((l) => l.saleItem.id !== saleItem.id);
    });
  };

  const updateLine = (id: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.saleItem.id === id ? { ...l, ...patch } : l)));
  };

  const value = useMemo(
    () => lines.reduce((sum, l) => sum + round2(l.saleItem.unit_price * l.quantity), 0),
    [lines],
  );

  const pct = useMemo(() => {
    if (fixedMode) return 0;
    return chargeOption === "custom" ? Math.max(0, Number(customPercent) || 0) : Number(chargeOption);
  }, [chargeOption, customPercent, fixedMode]);

  const fixed = fixedMode ? Math.max(0, Number(fixedAmount) || 0) : 0;

  const deduction = useMemo(() => {
    if (fixed > 0) return round2(Math.min(fixed, value));
    return round2((value * pct) / 100);
  }, [value, pct, fixed]);

  const refund = round2(value - deduction);
  const deductionInvalid = fixedMode && fixed > 0 && fixed > value;

  const canSubmit = lines.length > 0 && value > 0 && !deductionInvalid && !submitting;

  const handleSubmit = async () => {
    if (!selectedSale || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    const input: CreateReturnInput = {
      sale_id: selectedSale.id,
      return_charge_percent: pct,
      fixed_deduction: fixed > 0 ? fixed : null,
      refund_method: refundMethod,
      return_date: returnDate ? returnDate.replace("T", " ") : null,
      notes: notes.trim() || null,
      items: lines.map((l) => ({
        sale_item_id: l.saleItem.id,
        quantity: l.quantity,
        imei_id: l.imeiId,
        reason: l.reason.trim() || null,
        condition: l.condition,
      })),
    };
    try {
      const created = await add(input, user?.id ?? null);
      if (created) onCreated?.(created);
      reset();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      <span className="text-[12px]" style={{ color: "#94A3B8" }}>
        {lines.length > 0
          ? `${lines.length} item${lines.length !== 1 ? "s" : ""} · refund ${fmt(refund)}`
          : "Select items from the sale to enable the return."}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
          icon={<Undo2 className="h-3.5 w-3.5" />}
        >
          Process Return
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      title="New Return"
      subtitle="Search a sale, select the returned items, and set the restocking charge"
      onClose={onClose}
      size="xl"
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        {error && <Alert message={error} variant="error" />}

        {/* Step 1 — find the sale */}
        {!selectedSale ? (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: "#94A3B8" }}
                />
                <input
                  className="h-9 w-full rounded border bg-white pl-9 pr-3 text-[13px] outline-none transition-all placeholder:text-[#94A3B8]"
                  style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
                  placeholder="Search sale by invoice no, customer name or phone…"
                  value={salesSearch}
                  onChange={(e) => setSalesSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                />
              </div>
              <Button variant="secondary" size="sm" onClick={doSearch} loading={searching}>
                Search
              </Button>
            </div>

            {salesResult !== null &&
              (salesResult.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Search}
                    title="No matching sales"
                    description="Try a different invoice number or customer name."
                  />
                </div>
              ) : (
                <div className="overflow-hidden rounded border" style={{ borderColor: "#E2E8F0" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice No</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th className="text-right">Total</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesResult.map((s) => (
                        <tr
                          key={s.id}
                          className="cursor-pointer"
                          onClick={() => pickSale(s)}
                          title={s.receipt_no}
                        >
                          <td>
                            <span className="font-mono font-semibold" style={{ color: "#1B2A4A", fontSize: "13px" }}>
                              {s.receipt_no}
                            </span>
                          </td>
                          <td style={{ fontSize: "13px" }}>
                            {s.member_name ?? (
                              <span style={{ color: "#94A3B8", fontStyle: "italic" }}>Walk-in</span>
                            )}
                            {s.member_phone && (
                              <div className="text-[11px]" style={{ color: "#64748B" }}>
                                {s.member_phone}
                              </div>
                            )}
                          </td>
                          <td style={{ color: "#64748B", fontSize: "13px" }}>
                            {s.items.length} item{s.items.length !== 1 ? "s" : ""}
                          </td>
                          <td className="text-right" style={{ fontSize: "13px", fontWeight: 600 }}>
                            {fmt(s.total_amount)}
                          </td>
                          <td style={{ color: "#64748B", fontSize: "12px" }}>
                            {new Date(s.created_at).toLocaleDateString("en-PK", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        ) : (
          /* Step 2 — selected sale items */
          <div>
            <div
              className="mb-3 flex items-start justify-between gap-3 rounded p-3"
              style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
            >
              <div>
                <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                  {selectedSale.receipt_no}
                  <span style={{ color: "#94A3B8", fontWeight: 400 }}>
                    {selectedSale.member_name ? `— ${selectedSale.member_name}` : "— Walk-in"}
                  </span>
                  {selectedSale.member_phone && (
                    <span className="font-mono text-[12px]" style={{ color: "#64748B", fontWeight: 400 }}>
                      {selectedSale.member_phone}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12px]" style={{ color: "#64748B" }}>
                  {new Date(selectedSale.created_at).toLocaleString("en-PK", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<Undo2 className="h-3.5 w-3.5" />}
                onClick={() => {
                  setSelectedSale(null);
                  setLines([]);
                }}
              >
                Pick another sale
              </Button>
            </div>

            {loadingSale ? (
              <div className="flex items-center justify-center gap-2 py-8" style={{ color: "#64748B" }}>
                <Spinner className="h-5 w-5" /> Loading sale…
              </div>
            ) : (
              <>
                <div className="mb-1 text-[13px] font-medium" style={{ color: "#334155" }}>
                  Returned items
                </div>
                <div className="flex flex-col gap-2">
                  {selectedSale.items.map((si) => {
                    const included = lines.some((l) => l.saleItem.id === si.id);
                    const draft = lines.find((l) => l.saleItem.id === si.id);
                    return (
                      <div
                        key={si.id}
                        className="rounded border p-3"
                        style={{
                          borderColor: included ? "#93C5FD" : "#E2E8F0",
                          background: included ? "#F5F9FF" : "#FFF",
                        }}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={(e) => toggleItem(si, e.target.checked)}
                            className="mt-0.5 h-4 w-4"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 text-[13px] font-medium" style={{ color: "#0F172A" }}>
                              {si.product_name ?? ""}
                              {si.variant && (
                                <span className="text-[12px] font-normal" style={{ color: "#64748B" }}>
                                  {si.variant}
                                </span>
                              )}
                              {si.serial_no && (
                                <span className="font-mono text-[11px]" style={{ color: "#64748B" }}>
                                  SN: {si.serial_no}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px]" style={{ color: "#64748B" }}>
                              {si.imei && <span className="font-mono">IMEI: {si.imei}</span>}
                              <span>
                                Sold: <strong>{si.quantity}</strong> × {fmt(si.unit_price)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {included && draft && (
                          <div className="mt-2 grid grid-cols-2 gap-2 pl-6 md:grid-cols-4">
                            <Input
                              label="Quantity"
                              name={`qty-${si.id}`}
                              type="number"
                              min={1}
                              max={si.quantity}
                              value={String(draft.quantity)}
                              onChange={(e) => {
                                const q = Math.min(si.quantity, Math.max(1, Number(e.target.value) || 1));
                                updateLine(si.id, { quantity: q });
                              }}
                            />
                            <Select
                              label="Condition"
                              name={`cond-${si.id}`}
                              options={RETURN_CONDITIONS.map((c) => ({ value: c.value, label: c.label }))}
                              value={draft.condition}
                              onChange={(e) => updateLine(si.id, { condition: e.target.value })}
                            />
                            <div className="col-span-2">
                              <Input
                                label="Reason (optional)"
                                name={`reason-${si.id}`}
                                placeholder="e.g. wrong size, change of mind…"
                                value={draft.reason}
                                onChange={(e) => updateLine(si.id, { reason: e.target.value })}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Step 3 — charges + refund */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-[13px] font-medium" style={{ color: "#334155" }}>
                  Restocking charge
                </div>
                <div className="flex items-center gap-2">
                  {["percent", "fixed"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFixedMode(m === "fixed")}
                      className="h-8 rounded px-3 text-[12px] font-medium transition-colors"
                      style={
                        (m === "percent" ? !fixedMode : fixedMode)
                          ? { background: "#3B6FD4", color: "#FFF" }
                          : { background: "#F1F5F9", color: "#475569" }
                      }
                    >
                      {m === "percent" ? "Percentage" : "Fixed amount"}
                    </button>
                  ))}
                </div>
                {!fixedMode ? (
                  <div className="mt-2 flex items-start gap-2">
                    <div className="w-48">
                      <Select
                        label="Charge rate"
                        name="charge-option"
                        options={RETURN_CHARGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                        value={chargeOption}
                        onChange={(e) => setChargeOption(e.target.value)}
                      />
                    </div>
                    {chargeOption === "custom" && (
                      <div className="w-24">
                        <Input
                          label="Percent"
                          name="custom-percent"
                          type="number"
                          min={0}
                          max={100}
                          suffix="%"
                          value={customPercent}
                          onChange={(e) => setCustomPercent(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 w-48">
                    <Input
                      label="Deduction (Rs.)"
                      name="fixed-amount"
                      type="number"
                      min={0}
                      prefix="Rs."
                      value={fixedAmount}
                      onChange={(e) => setFixedAmount(e.target.value)}
                      error={deductionInvalid ? "Exceeds returned value" : undefined}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select
                  label="Refund method"
                  name="refund-method"
                  options={REFUND_METHODS.map((m) => ({
                    value: m,
                    label: m.replace("_", " "),
                  }))}
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                />
                <Input
                  label="Return date & time"
                  name="return-date"
                  type="datetime-local"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Notes (optional)"
                    name="notes"
                    placeholder="Additional details about this return"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            {lines.length > 0 && (
              <div
                className="mt-5 rounded p-4"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
              >
                <div className="flex items-center justify-between py-1 text-[13px]" style={{ color: "#334155" }}>
                  <span>Returned value ({lines.length} item{lines.length !== 1 ? "s" : ""})</span>
                  <span className="font-semibold" style={{ color: "#0F172A" }}>
                    {fmt(value)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 text-[13px]" style={{ color: "#DC2626" }}>
                  <span>
                    Deduction — {fixedMode ? `Rs. ${Number(fixedAmount || 0).toLocaleString("en-PK")}` : `${pct}%`}
                  </span>
                  <span className="font-semibold">{fmt(deduction)}</span>
                </div>
                <div
                  className="mt-1 flex items-center justify-between rounded bg-white px-3 py-2"
                  style={{ border: "1px solid #E2E8F0" }}
                >
                  <span className="text-[13px] font-medium" style={{ color: "#334155" }}>
                    Refund due to customer
                  </span>
                  <span className="text-[16px] font-bold" style={{ color: "#16A34A" }}>
                    {fmt(refund)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}