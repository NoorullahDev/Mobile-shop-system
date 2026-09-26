import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import type { PhoneImei, Product } from "../types/inventory";
import type { Member } from "../types/member";
import type { CreateSaleInput, Sale, SaleItemInput, SalePaymentInput } from "../types/sale";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "../types/sale";
import * as inventoryService from "../services/inventoryService";
import { roundMoney, formatMoneyCompact } from "../lib/format";
import { PhysicalUnitPicker } from "../components/PhysicalUnitPicker";
import { useSessionStore } from "../store/session";
import { can } from "../lib/permissions";

interface Line {
  key: number;
  sale_item_id?: number | null;
  item_type: "phone" | "accessory";
  item_id: number;
  quantity: number;
  imei_id: number | null;
  unit_price: number;
}

interface PaymentLine {
  key: number;
  amount: string;
  payment_method: string;
  reference: string;
  notes: string;
}

let paymentKey = 0;

interface SaleFormProps {
  onSubmit: (input: CreateSaleInput) => Promise<void>;
  onCancel: () => void;
  products: Product[];
  members: Member[];
  initialSale?: Sale | null;
}

let lineKey = 0;

export function SaleForm({ onSubmit, onCancel, products, members, initialSale }: SaleFormProps) {
  const canApplyDiscount = can(useSessionStore((s) => s.user?.permissions), "sales:apply_discount");
  const inStock = useMemo(
    () => products.filter((p) => p.quantity > 0 || initialSale?.items.some((item) => item.item_type === p.item_type && item.item_id === p.item_id)),
    [products, initialSale],
  );
  const [lines, setLines] = useState<Line[]>(() => initialSale?.items.map((item) => ({
    key: ++lineKey,
    sale_item_id: item.id,
    item_type: item.item_type,
    item_id: item.item_id,
    quantity: item.quantity,
    imei_id: item.imei_id ?? null,
    unit_price: item.unit_price,
  })) ?? []);
  const [imeiByItem, setImeiByItem] = useState<Record<number, PhoneImei[]>>({});
  const [imeiLoadingByItem, setImeiLoadingByItem] = useState<Record<number, boolean>>({});
  const [discount, setDiscount] = useState(String(initialSale?.discount ?? 0));
  const initialInvoicePayments = (initialSale?.sale_payments ?? []).filter((sp) => !sp.is_voided);
  const [paidAmount, setPaidAmount] = useState(initialSale ? String(roundMoney(initialSale.paid_amount)) : "");
  const [paymentMethod, setPaymentMethod] = useState(initialSale?.payment_method ?? "cash");
  const [memberId, setMemberId] = useState(initialSale?.member_id ? String(initialSale.member_id) : "");
  const [notes, setNotes] = useState(initialSale?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useSplitPayments, setUseSplitPayments] = useState(initialInvoicePayments.length > 0);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>(() => {
    if (initialInvoicePayments.length > 0) {
      return initialInvoicePayments.map((sp) => ({
        key: ++paymentKey,
        amount: String(sp.amount),
        payment_method: sp.payment_method,
        reference: sp.reference ?? "",
        notes: sp.notes ?? "",
      }));
    }
    return [];
  });

  const addEmptyLine = (item?: Product) => {
    const first = item ?? inStock[0];
    if (!first) return;
    setLines((prev) => [
      ...prev,
      {
        key: ++lineKey,
        item_type: first.item_type,
        item_id: first.item_id,
        quantity: 1,
        imei_id: null,
        unit_price: first.sale_price,
      },
    ]);
    if (first.item_type === "phone") loadImeis(first.item_id);
  };

  const loadImeis = async (itemId: number) => {
    setImeiLoadingByItem((prev) => ({ ...prev, [itemId]: true }));
    try {
      const all = await inventoryService.listPhoneImeis(itemId);
      const selectedIds = new Set(lines.filter((line) => line.item_id === itemId).map((line) => line.imei_id));
      const inStockImeis = all.filter((i) => i.status === "in_stock" || selectedIds.has(i.id));
      setImeiByItem((prev) => ({ ...prev, [itemId]: inStockImeis }));
    } catch {
      setImeiByItem((prev) => ({ ...prev, [itemId]: [] }));
    } finally {
      setImeiLoadingByItem((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  useEffect(() => {
    if (inStock.length > 0 && lines.length === 0) {
      addEmptyLine(inStock[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inStock.length]);

  useEffect(() => {
    for (const line of lines) {
      if (line.item_type === "phone") loadImeis(line.item_id);
    }
    // Initial edit values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateLine = (key: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const changeLineItem = (key: number, value: string) => {
    const [itemType, idPart] = value.split(":");
    const itemId = Number(idPart);
    if (!itemType || !Number.isFinite(itemId)) return;
    const product = inStock.find((p) => p.item_type === itemType && p.item_id === itemId);
    updateLine(key, {
      item_type: itemType as "phone" | "accessory",
      item_id: itemId,
      quantity: 1,
      imei_id: null,
      unit_price: product ? product.sale_price : 0,
    });
    if (itemType === "phone") loadImeis(itemId);
  };

  const removeLine = (key: number) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const lineTotal = (l: Line) => roundMoney(l.unit_price * l.quantity);
  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const discountNum = Math.max(0, roundMoney(Number(discount) || 0));
  const total = Math.max(0, roundMoney(subtotal - discountNum));

  const productOptions = inStock.map((p) => ({
    value: `${p.item_type}:${p.item_id}`,
    label: `${p.display_name} — ${p.quantity} in stock`,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      setError("Add at least one item to the sale.");
      return;
    }
    // A tracked phone is sold as an exact unit: each line must select its IMEI
    // at quantity 1.
    for (const l of lines) {
      if (l.item_type === "phone" && (imeiByItem[l.item_id]?.length ?? 0) > 0) {
        if (l.imei_id === null) {
          setError(`Select the exact unit (IMEI) being sold for ${l.item_id}.`);
          return;
        }
        if (l.quantity !== 1) {
          setError("Each exact unit is sold separately — keep quantity at 1 and add the phone again for a second unit.");
          return;
        }
      }
    }
    const items: SaleItemInput[] = lines.map((l) => ({
      sale_item_id: l.sale_item_id ?? null,
      item_type: l.item_type,
      item_id: l.item_id,
      quantity: l.quantity,
      imei_id: l.imei_id ?? null,
      unit_price: l.unit_price > 0 ? l.unit_price : null,
    }));

    // Build split payments array if enabled
    const payments: SalePaymentInput[] | undefined = useSplitPayments
      ? paymentLines
          .filter((pl) => Number(pl.amount) > 0)
          .map((pl) => ({
            amount: Number(pl.amount),
            payment_method: pl.payment_method,
            reference: pl.reference.trim() || undefined,
            notes: pl.notes.trim() || undefined,
          }))
      : undefined;

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        member_id: memberId ? Number(memberId) : null,
        discount: discountNum,
        paid_amount: useSplitPayments ? null : (paidAmount === "" ? null : Number(paidAmount)),
        payment_method: useSplitPayments ? null : paymentMethod,
        notes: notes ? notes.trim() : "",
        items,
        payments,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (inStock.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="error" message="No products available in stock. Add or restock phones and accessories before making a sale." />
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <Alert variant="error" message={error} />}

      <div className="flex flex-col gap-3">
        {lines.map((l, index) => {
          const imeis = l.item_type === "phone"
            ? (imeiByItem[l.item_id] ?? []).filter(
                (unit) =>
                  unit.id === l.imei_id ||
                  !lines.some(
                    (other) => other.key !== l.key && other.imei_id === unit.id,
                  ),
              )
            : [];
          return (
            <div
              key={l.key}
              className="rounded-lg p-3"
              style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "#64748B" }}>
                  Item {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeLine(l.key)}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-red-50"
                  style={{ color: "#DC2626" }}
                  title="Remove item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-12 items-end gap-3">
                <div className="col-span-5">
                  <Select
                    name={`item-${l.key}`}
                    label="Product"
                    options={productOptions}
                    value={`${l.item_type}:${l.item_id}`}
                    onChange={(e) => changeLineItem(l.key, e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    name={`qty-${l.key}`}
                    label="Qty"
                    type="number"
                    min="1"
                    max={inStock.find((p) => p.item_type === l.item_type && p.item_id === l.item_id)?.quantity ?? undefined}
                    value={l.quantity}
                    onChange={(e) => {
                      const tracked =
                        l.item_type === "phone" &&
                        (imeiByItem[l.item_id]?.length ?? 0) > 0;
                      const maxQty = tracked
                        ? 1
                        : (inStock.find((p) => p.item_type === l.item_type && p.item_id === l.item_id)?.quantity ?? Infinity);
                      updateLine(l.key, { quantity: Math.max(1, Math.min(Number(e.target.value) || 1, maxQty)) });
                    }}
                    disabled={saving}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    name={`price-${l.key}`}
                    label="Unit Price (PKR)"
                    type="number"
                    min="0"
                    value={l.unit_price}
                    onChange={(e) => updateLine(l.key, { unit_price: Number(e.target.value) || 0 })}
                    disabled={saving}
                  />
                </div>
                <div className="col-span-2 text-right">
                  <div className="mb-1 text-[11px] font-medium" style={{ color: "#64748B" }}>Total</div>
                  <div className="amount font-semibold text-[14px]" style={{ color: "#0F172A" }}>
                    {formatMoneyCompact(lineTotal(l))}
                  </div>
                </div>
                {l.item_type === "phone" && (
                  <div className="col-span-12 mt-1">
                    <PhysicalUnitPicker
                      name={`imei-${l.key}`}
                      units={imeis}
                      selectedId={l.imei_id}
                      unitPrice={l.unit_price}
                      loading={imeiLoadingByItem[l.item_id] === true}
                      allowSelectedSoldUnit={Boolean(initialSale)}
                      onChange={(imeiId) => {
                        const unit = imeis.find((candidate) => candidate.id === imeiId);
                        updateLine(l.key, {
                          imei_id: imeiId,
                          unit_price: unit?.sale_price ?? l.unit_price,
                        });
                      }}
                      disabled={saving}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <Button type="button" variant="secondary" size="sm" onClick={() => addEmptyLine()} icon={<Plus className="h-3.5 w-3.5" />}>
          Add Another Item
        </Button>
      </div>

      <div
        className="my-2"
        style={{ borderTop: "1px dashed #CBD5E1" }}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          name="member_id"
          label="Customer"
          options={[
            { value: "", label: "Walk-in Customer" },
            ...members.map((m) => ({ value: String(m.id), label: m.name })),
          ]}
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          disabled={saving}
        />
        <Select
          name="payment_method"
          label="Payment Method"
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] ?? m }))}
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          disabled={saving || useSplitPayments}
        />
        <Input
          name="discount"
          label="Discount (PKR)"
          type="number"
          min="0"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          disabled={saving || !canApplyDiscount}
          hint={!canApplyDiscount ? "Your role cannot apply or change discounts" : undefined}
        />
        {!useSplitPayments && (
          <Input
            name="paid_amount"
            label="Amount Received (Leave blank for full)"
            type="number"
            min="0"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            disabled={saving}
          />
        )}
      </div>

      {/* Split Payments Toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setUseSplitPayments(!useSplitPayments)}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors"
          style={{
            background: useSplitPayments ? "#3B6FD4" : "#F1F5F9",
            color: useSplitPayments ? "#FFF" : "#475569",
          }}
        >
          {useSplitPayments ? "Split Payments ON" : "Use Split Payments"}
        </button>
        {useSplitPayments && (
          <span className="text-[11px]" style={{ color: "#64748B" }}>
            Add multiple payment entries (Cash, Bank Transfer, JazzCash, EasyPaisa, etc.)
          </span>
        )}
      </div>

      {/* Split Payment Lines */}
      {useSplitPayments && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium" style={{ color: "#334155" }}>Payment Entries</span>
            <span className="text-[12px]" style={{ color: "#64748B" }}>
              Total: {formatMoneyCompact(paymentLines.reduce((s, l) => s + (Number(l.amount) || 0), 0))}
              {paymentLines.reduce((s, l) => s + (Number(l.amount) || 0), 0) < total && (
                <span className="ml-2" style={{ color: "#B45309" }}>
                  · Due: {formatMoneyCompact(total - paymentLines.reduce((s, l) => s + (Number(l.amount) || 0), 0))}
                </span>
              )}
            </span>
          </div>
          {paymentLines.map((pl) => (
            <div key={pl.key} className="grid grid-cols-12 items-end gap-2 rounded-md p-2" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <div className="col-span-3">
                <Select
                  name={`pm-${pl.key}`}
                  label="Method"
                  options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] ?? m }))}
                  value={pl.payment_method}
                  onChange={(e) => setPaymentLines((prev) => prev.map((l) => l.key === pl.key ? { ...l, payment_method: e.target.value } : l))}
                  disabled={saving}
                />
              </div>
              <div className="col-span-3">
                <Input
                  name={`pa-${pl.key}`}
                  label="Amount"
                  type="number"
                  min="0"
                  value={pl.amount}
                  onChange={(e) => setPaymentLines((prev) => prev.map((l) => l.key === pl.key ? { ...l, amount: e.target.value } : l))}
                  disabled={saving}
                />
              </div>
              <div className="col-span-2">
                <Input
                  name={`pr-${pl.key}`}
                  label="Reference"
                  placeholder="Optional"
                  value={pl.reference}
                  onChange={(e) => setPaymentLines((prev) => prev.map((l) => l.key === pl.key ? { ...l, reference: e.target.value } : l))}
                  disabled={saving}
                />
              </div>
              <div className="col-span-3">
                <Input
                  name={`pn-${pl.key}`}
                  label="Notes"
                  placeholder="Optional"
                  value={pl.notes}
                  onChange={(e) => setPaymentLines((prev) => prev.map((l) => l.key === pl.key ? { ...l, notes: e.target.value } : l))}
                  disabled={saving}
                />
              </div>
              <div className="col-span-1">
                <button
                  type="button"
                  onClick={() => setPaymentLines((prev) => prev.filter((l) => l.key !== pl.key))}
                  className="flex h-8 w-8 items-center justify-center rounded hover:bg-red-50"
                  style={{ color: "#DC2626" }}
                  title="Remove payment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPaymentLines((prev) => [...prev, { key: ++paymentKey, amount: "", payment_method: "cash", reference: "", notes: "" }])}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            Add Payment Entry
          </Button>
        </div>
      )}
      <Input
        name="notes"
        label="Sale Notes (Optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={saving}
        placeholder="e.g., Extended warranty agreed..."
      />

      {/* Summary Box */}
      <div
        className="flex items-center justify-between rounded-lg px-4 py-3 mt-2"
        style={{ background: "#F0FDF4", border: "1px solid #DCFCE7" }}
      >
        <div className="text-[13px]" style={{ color: "#166534" }}>
          Subtotal: <span className="font-semibold">{formatMoneyCompact(subtotal)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "#166534" }}>Total Due</span>
          <span className="amount-large font-bold text-[20px]" style={{ color: "#15803D" }}>
            {formatMoneyCompact(total)}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {initialSale ? "Save Changes" : "Complete Sale"}
        </Button>
      </div>
    </form>
  );
}
