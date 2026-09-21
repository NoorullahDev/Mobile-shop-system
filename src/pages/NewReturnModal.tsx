import { useEffect, useMemo, useState } from "react";
import { Undo2, Search } from "lucide-react";
import { Modal } from "../components/Modal";
import { Button, Spinner } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import * as saleService from "../services/saleService";
import * as inventoryService from "../services/inventoryService";
import { formatMoneyCompact, roundMoney } from "../lib/format";
import { useReturnStore } from "../store/returns";
import { useSessionStore } from "../store/session";
import { RETURN_CHARGE_OPTIONS, RETURN_CONDITIONS } from "../types/return";
import { REFUND_METHODS, RETURN_TYPES } from "../types/return";
import { isWarrantyActive } from "../lib/warranty";
import type { CreateReturnInput, ProductReturn } from "../types/return";
import type { Sale, SaleItem } from "../types/sale";
import type { Product, PhoneImei } from "../types/inventory";

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
  initialReturn?: ProductReturn | null;
  onSaved?: (r: ProductReturn) => void;
}

export function NewReturnModal({ open, onClose, onCreated, initialReturn, onSaved }: NewReturnModalProps) {
  const { add, update } = useReturnStore();
  const user = useSessionStore((s) => s.user);

  // Sale lookup
  const [salesSearch, setSalesSearch] = useState("");
  const [salesResult, setSalesResult] = useState<Sale[] | null>(null);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [loadingSale, setLoadingSale] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  // Draft lines
  const [lines, setLines] = useState<DraftLine[]>([]);

  // Charge + refund details
  const expectedDeduction = initialReturn ? roundMoney(initialReturn.total_sale_price * initialReturn.return_charge_percent / 100) : 0;
  const initialFixed = initialReturn ? Math.abs(expectedDeduction - initialReturn.deduction_amount) > 0.01 : false;
  const initialPercent = initialReturn?.return_charge_percent ?? 0;
  const [chargeOption, setChargeOption] = useState<string>(initialPercent === 0 || [10, 20, 30].includes(initialPercent) ? String(initialPercent) : "custom");
  const [customPercent, setCustomPercent] = useState(initialPercent && ![10, 20, 30].includes(initialPercent) ? String(initialPercent) : "");
  const [fixedMode, setFixedMode] = useState(initialFixed);
  const [fixedAmount, setFixedAmount] = useState(initialFixed ? String(initialReturn?.deduction_amount ?? 0) : "");
  const [refundMethod, setRefundMethod] = useState<string>(initialReturn?.refund_method ?? "cash");
  const [returnDate, setReturnDate] = useState(() => initialReturn?.return_date?.replace(" ", "T") ?? nowLocalValue());
  const [notes, setNotes] = useState(initialReturn?.notes ?? "");
  const [reference, setReference] = useState("");
  const [returnType, setReturnType] = useState<string>(initialReturn?.return_type ?? "return");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exchange selection
  const [exchangeProducts, setExchangeProducts] = useState<Product[]>([]);
  const [exchangeSearch, setExchangeSearch] = useState("");
  const [exchangeItem, setExchangeItem] = useState<Product | null>(null);
  const [exchangeImeiId, setExchangeImeiId] = useState<number | null>(null);
  const [exchangeImeis, setExchangeImeis] = useState<PhoneImei[]>([]);

  useEffect(() => {
    if (!open || !initialReturn) return;
    setLoadingSale(true);
    saleService.getSale(initialReturn.sale_id)
      .then((sale) => {
        setSelectedSale(sale);
        setLines(initialReturn.items.map((item) => {
          const saleItem = sale.items.find((line) => line.id === item.sale_item_id);
          return saleItem ? {
            saleItem,
            quantity: item.quantity,
            imeiId: item.imei_id ?? null,
            reason: item.reason ?? "",
            condition: item.condition,
          } : null;
        }).filter((line): line is { saleItem: SaleItem; quantity: number; imeiId: number | null; reason: string; condition: string } => line !== null));
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingSale(false));
  }, [open, initialReturn]);

  // Load all sales for autocomplete when modal opens (not in edit mode)
  useEffect(() => {
    if (!open || initialReturn) return;
    saleService.listSales()
      .then(setAllSales)
      .catch(() => setAllSales([]));
    inventoryService.listProducts()
      .then(setExchangeProducts)
      .catch(() => setExchangeProducts([]));
  }, [open, initialReturn]);

  // Client-side filtered suggestions
  const suggestions = useMemo(() => {
    if (!salesSearch.trim()) return [];
    const q = salesSearch.trim().toLowerCase();
    return allSales.filter((s) =>
      s.receipt_no.toLowerCase().includes(q) ||
      (s.member_name ?? "").toLowerCase().includes(q) ||
      (s.member_phone ?? "").toLowerCase().includes(q)
    );
  }, [allSales, salesSearch]);

  const reset = () => {
    setSalesSearch("");
    setSalesResult(null);
    setSuggestionsOpen(false);
    setSelectedSale(null);
    setLines([]);
    setChargeOption("0");
    setCustomPercent("");
    setFixedMode(false);
    setFixedAmount("");
    setRefundMethod("cash");
    setReturnDate(nowLocalValue());
    setNotes("");
    setReturnType("return");
    setError(null);
    setExchangeItem(null);
    setExchangeImeiId(null);
    setExchangeSearch("");
    setReference("");
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

  const loadExchangeImeis = async (phoneId: number) => {
    try {
      const all = await inventoryService.listPhoneImeis(phoneId);
      setExchangeImeis(all.filter((i) => i.status === "in_stock"));
    } catch {
      setExchangeImeis([]);
    }
  };

  const handleSelectExchangeItem = (prod: Product) => {
    setExchangeItem(prod);
    setExchangeImeiId(null);
    setExchangeSearch("");
    if (prod.item_type === "phone") {
      loadExchangeImeis(prod.item_id);
    }
  };

  const updateLine = (saleItemId: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.saleItem.id === saleItemId ? { ...l, ...patch } : l)));
  };

  const value = useMemo(
    () => lines.reduce((sum, l) => sum + roundMoney(l.saleItem.unit_price * l.quantity), 0),
    [lines],
  );

  const pct = useMemo(() => {
    if (fixedMode) return 0;
    return chargeOption === "custom" ? Math.max(0, Number(customPercent) || 0) : Number(chargeOption);
  }, [chargeOption, customPercent, fixedMode]);

  const fixed = fixedMode ? Math.max(0, Number(fixedAmount) || 0) : 0;

  const deduction = useMemo(() => {
    if (fixed > 0) return roundMoney(Math.min(fixed, value));
    return roundMoney((value * pct) / 100);
  }, [value, pct, fixed]);

  const refund = roundMoney(value - deduction);
  const deductionInvalid = fixedMode && fixed > 0 && fixed > value;

  const canSubmit = lines.length > 0 && value > 0 && !deductionInvalid && !submitting;

  const handleSubmit = async () => {
    if (!selectedSale || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    const input: CreateReturnInput = {
      sale_id: selectedSale.id,
      return_type: returnType,
      return_charge_percent: pct,
      fixed_deduction: fixed > 0 ? fixed : null,
      refund_method: refundMethod,
      return_date: returnDate ? returnDate.replace("T", " ") : null,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
      items: lines.map((l) => ({
        sale_item_id: l.saleItem.id,
        quantity: l.quantity,
        imei_id: l.imeiId,
        reason: l.reason.trim() || null,
        condition: l.condition,
      })),
    };

    if (returnType === "exchange") {
      if (!exchangeItem) {
        setError("Please select a replacement product for the exchange.");
        setSubmitting(false);
        return;
      }
      if (exchangeItem.item_type === "phone" && !exchangeImeiId) {
        setError("Please select an IMEI for the replacement phone.");
        setSubmitting(false);
        return;
      }
      input.exchange_item = {
        member_id: selectedSale.member_id,
        discount: 0,
        paid_amount: 0,
        payment_method: "cash",
        payments: [],
        items: [{
          sale_item_id: null,
          item_type: exchangeItem.item_type,
          item_id: exchangeItem.item_id,
          imei_id: exchangeImeiId,
          quantity: 1,
          unit_price: exchangeItem.sale_price,
          warranty: null,
          warranty_expiry: null
        }]
      };
    }
    try {
      const created = initialReturn
        ? await update(initialReturn.id, input, user?.id ?? null)
        : await add(input, user?.id ?? null);
      if (created) {
        onCreated?.(created);
        onSaved?.(created);
      }
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
          ? `${lines.length} item${lines.length !== 1 ? "s" : ""} · refund ${formatMoneyCompact(refund)}`
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
          {initialReturn ? "Save Changes" : "Process Return"}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      title={initialReturn ? `Edit ${initialReturn.return_no}` : "New Return"}
      subtitle={initialReturn ? "Correct returned items, condition, deduction, or refund" : "Search a sale, select the returned items, and set the restocking charge"}
      onClose={onClose}
      size="xl"
      footer={footer}
    >
      <div className="flex flex-col gap-4 min-h-[500px]">
        {error && <Alert message={error} variant="error" />}

        {/* Step 1 — find the sale */}
        {!initialReturn && (
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
                  onChange={(e) => {
                    setSalesSearch(e.target.value);
                    setSuggestionsOpen(true);
                    setSalesResult(null);
                    if (selectedSale) setSelectedSale(null);
                  }}
                  onFocus={() => salesSearch.trim() && setSuggestionsOpen(true)}
                  onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSuggestionsOpen(false);
                      doSearch();
                    }
                  }}
                />
                {suggestionsOpen && suggestions.length > 0 && (
                  <div
                    className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg"
                    style={{ borderColor: "#E2E8F0" }}
                  >
                    {suggestions.slice(0, 10).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSuggestionsOpen(false);
                          pickSale(s);
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-[12px]" style={{ color: "#1B2A4A" }}>
                              {s.receipt_no}
                            </span>
                            <span className="text-[12px] text-[#64748B]">
                              {formatMoneyCompact(s.total_amount)}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            {s.member_name ?? "Walk-in"}
                            {s.member_phone && ` · ${s.member_phone}`}
                          </div>
                        </div>
                        <span className="text-[11px] text-[#94A3B8]">
                          {new Date(s.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                        </span>
                      </button>
                    ))}
                    {suggestions.length > 10 && (
                      <div className="px-3 py-1.5 text-center text-[11px] text-[#94A3B8]">
                        +{suggestions.length - 10} more results
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setSuggestionsOpen(false); doSearch(); }} loading={searching}>
                Search
              </Button>
            </div>

            {!selectedSale && salesResult !== null &&
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
                            {formatMoneyCompact(s.total_amount)}
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
        )}

        {/* Step 2 — selected sale items */}
        {selectedSale && (
          <div className="flex flex-col gap-4">
            {/* Sale Details */}
            <div
              className="flex items-start justify-between gap-3 rounded-md p-3"
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
                  <span className="ml-2 text-[12px] font-semibold" style={{ color: "#1B2A4A" }}>
                    {formatMoneyCompact(selectedSale.total_amount)}
                  </span>
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
              {!initialReturn && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Undo2 className="h-3.5 w-3.5" />}
                  onClick={() => { setSelectedSale(null); setLines([]); setSalesSearch(""); setSalesResult(null); }}
                >
                  Clear Selection
                </Button>
              )}
            </div>

            {loadingSale ? (
              <div className="flex items-center justify-center gap-2 py-8" style={{ color: "#64748B" }}>
                <Spinner className="h-5 w-5" /> Loading sale…
              </div>
            ) : (
              <>
                {/* Sold Items */}
                <div>
                  <div className="mb-2 text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                    Sold Items
                  </div>
                  <div className="flex flex-col gap-2">
                    {selectedSale.items.map((si) => {
                      const included = lines.some((l) => l.saleItem.id === si.id);
                      const draft = lines.find((l) => l.saleItem.id === si.id);
                      return (
                        <div
                          key={si.id}
                          className="rounded-md border p-3"
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
                                  Sold: <strong>{si.quantity}</strong> × {formatMoneyCompact(si.unit_price)}
                                </span>
                                {si.warranty && (
                                  <span
                                    style={{
                                      color: si.warranty_expiry
                                        ? isWarrantyActive(si.warranty_expiry) ? "#15803D" : "#B91C1C"
                                        : "#1D4ED8",
                                      fontWeight: 500,
                                    }}
                                  >
                                    Warranty: {si.warranty}
                                    {si.warranty_expiry && (
                                      <span className="font-normal">
                                        {isWarrantyActive(si.warranty_expiry) ? ` (till ${si.warranty_expiry})` : " (expired)"}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {included && draft && (
                            <div className="mt-2.5 grid grid-cols-1 gap-2 border-t pt-2.5 pl-6 sm:grid-cols-3" style={{ borderColor: "#E2E8F0" }}>
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
                              <Input
                                label="Reason (optional)"
                                name={`reason-${si.id}`}
                                placeholder="e.g. change of mind…"
                                value={draft.reason}
                                onChange={(e) => updateLine(si.id, { reason: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Return Type */}
                <div>
                  <div className="mb-2 text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                    Return Type
                  </div>
                  <div className="flex items-center gap-1.5">
                    {RETURN_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setReturnType(t.value)}
                        className="h-8 rounded-md px-4 text-[12px] font-medium transition-colors"
                        style={
                          returnType === t.value
                            ? { background: "#3B6FD4", color: "#FFF" }
                            : { background: "#F1F5F9", color: "#475569" }
                        }
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exchange Selection */}
                {returnType === "exchange" && (
                  <div className="rounded-md p-4" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                    <div className="mb-2 text-[13px] font-semibold" style={{ color: "#166534" }}>
                      Replacement Product
                    </div>
                    
                    {!exchangeItem ? (
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                          <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          className="h-9 w-full rounded-md border border-gray-300 pl-9 pr-3 text-[13px] outline-none focus:border-[#3B6FD4]"
                          placeholder="Search for a replacement product..."
                          value={exchangeSearch}
                          onChange={(e) => setExchangeSearch(e.target.value)}
                        />
                        {exchangeSearch.trim().length > 0 && (
                          <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                            {exchangeProducts
                              .filter((p) => p.display_name.toLowerCase().includes(exchangeSearch.toLowerCase()))
                              .slice(0, 10)
                              .map((p) => (
                                <button
                                  key={`${p.item_type}-${p.item_id}`}
                                  type="button"
                                  className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-gray-50"
                                  onClick={() => handleSelectExchangeItem(p)}
                                >
                                  <div>
                                    <div className="text-[13px] font-medium text-gray-900">{p.display_name}</div>
                                    <div className="text-[11px] text-gray-500">
                                      {p.item_type === "phone" ? "Phone" : "Accessory"} · In stock: {p.quantity}
                                    </div>
                                  </div>
                                  <div className="text-[13px] font-semibold text-gray-900">
                                    {formatMoneyCompact(p.sale_price)}
                                  </div>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded border bg-white p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-[13px] font-semibold text-gray-900">{exchangeItem.display_name}</div>
                            <div className="text-[12px] text-gray-600">Price: {formatMoneyCompact(exchangeItem.sale_price)}</div>
                          </div>
                          <button 
                            type="button" 
                            className="text-[12px] text-blue-600 hover:underline"
                            onClick={() => setExchangeItem(null)}
                          >
                            Change
                          </button>
                        </div>
                        {exchangeItem.item_type === "phone" && (
                          <div className="mt-3">
                            <Select
                              label="Select Phone Unit (IMEI)"
                              name="exchange-imei"
                              options={exchangeImeis.map(i => ({
                                value: String(i.id),
                                label: [
                                  i.imei,
                                  i.color,
                                  i.storage,
                                  i.pta_status,
                                  i.battery_health_pct != null ? `${i.battery_health_pct}% battery` : null,
                                ].filter(Boolean).join(" · "),
                              }))}
                              value={exchangeImeiId ? String(exchangeImeiId) : ""}
                              onChange={(e) => setExchangeImeiId(Number(e.target.value))}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Restocking Charge */}
                <div>
                  <div className="mb-2 text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                    Restocking Charge
                  </div>
                  <div className="flex items-center gap-2">
                    {["percent", "fixed"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setFixedMode(m === "fixed")}
                        className="h-8 rounded-md px-3 text-[12px] font-medium transition-colors"
                        style={
                          (m === "percent" ? !fixedMode : fixedMode)
                            ? { background: "#3B6FD4", color: "#FFF" }
                            : { background: "#F1F5F9", color: "#475569" }
                        }
                      >
                        {m === "percent" ? "Percentage" : "Fixed Amount"}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2.5">
                    {!fixedMode ? (
                      <div className="flex items-start gap-2">
                        <div className="w-56">
                          <Select
                            label="Charge rate"
                            name="charge-option"
                            options={RETURN_CHARGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                            value={chargeOption}
                            onChange={(e) => setChargeOption(e.target.value)}
                          />
                        </div>
                        {chargeOption === "custom" && (
                          <div className="w-28">
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
                      <div className="w-56">
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
                </div>

                {/* Refund Summary */}
                <div
                  className="rounded-md p-4"
                  style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
                >
                  <div className="flex items-center justify-between py-1 text-[13px]" style={{ color: "#334155" }}>
                    <span>Returned value ({lines.length} item{lines.length !== 1 ? "s" : ""})</span>
                    <span className="font-semibold" style={{ color: "#0F172A" }}>
                      {formatMoneyCompact(value)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 text-[13px]" style={{ color: "#DC2626" }}>
                    <span>
                      Deduction — {fixedMode ? `Rs. ${Number(fixedAmount || 0).toLocaleString("en-PK")}` : `${pct}%`}
                    </span>
                    <span className="font-semibold">{formatMoneyCompact(deduction)}</span>
                  </div>
                  <div
                    className="mt-2 flex items-center justify-between rounded-md bg-white px-3 py-2.5"
                    style={{ border: "1px solid #E2E8F0" }}
                  >
                    <span className="text-[13px] font-medium" style={{ color: "#334155" }}>
                      Refund due to customer
                    </span>
                    <span className="text-[16px] font-bold" style={{ color: "#16A34A" }}>
                      {formatMoneyCompact(refund)}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div>
                  <div className="mb-2 text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                    Details
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
                    {refundMethod !== "cash" && refundMethod !== "exchange_credit" && (
                      <Input
                        label="Reference / Transaction ID"
                        name="reference"
                        placeholder="e.g., TR123456"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    )}
                    <div className={refundMethod !== "cash" && refundMethod !== "exchange_credit" ? "" : "sm:col-span-2"}>
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
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
