import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import type { PhoneImei, Product } from "../types/inventory";
import type { Member } from "../types/member";
import type { CreateSaleInput, SaleItemInput } from "../types/sale";
import { PAYMENT_METHODS } from "../types/sale";
import * as inventoryService from "../services/inventoryService";
import { roundMoney } from "../lib/format";

function formatPKR(n: number) {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

interface Line {
  key: number;
  item_type: "phone" | "accessory";
  item_id: number;
  quantity: number;
  imei_id: number | null;
  unit_price: number;
}

interface SaleFormProps {
  onSubmit: (input: CreateSaleInput) => Promise<void>;
  onCancel: () => void;
  products: Product[];
  members: Member[];
}

const methodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
};

let lineKey = 0;

export function SaleForm({ onSubmit, onCancel, products, members }: SaleFormProps) {
  const inStock = useMemo(
    () => products.filter((p) => p.quantity > 0),
    [products],
  );
  const [lines, setLines] = useState<Line[]>([]);
  const [imeiByItem, setImeiByItem] = useState<Record<number, PhoneImei[]>>({});
  const [discount, setDiscount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [memberId, setMemberId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try {
      const all = await inventoryService.listPhoneImeis(itemId);
      const inStockImeis = all.filter((i) => i.status === "in_stock");
      setImeiByItem((prev) => ({ ...prev, [itemId]: inStockImeis }));
    } catch {
      setImeiByItem((prev) => ({ ...prev, [itemId]: [] }));
    }
  };

  useEffect(() => {
    if (inStock.length > 0 && lines.length === 0) {
      addEmptyLine(inStock[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inStock.length]);

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

  const emeiOptionsFor = (itemId: number) => [
    { value: "", label: "— No IMEI (count as units) —" },
    ...(imeiByItem[itemId] ?? []).map((i) => ({ value: String(i.id), label: i.imei })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      setError("Add at least one item to the sale.");
      return;
    }
    const items: SaleItemInput[] = lines.map((l) => ({
      item_type: l.item_type,
      item_id: l.item_id,
      quantity: l.quantity,
      imei_id: l.imei_id ?? null,
      unit_price: l.unit_price > 0 ? l.unit_price : null,
    }));
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        member_id: memberId ? Number(memberId) : null,
        discount: discountNum,
        paid_amount: paidAmount === "" ? null : Number(paidAmount),
        payment_method: paymentMethod,
        notes: notes ? notes.trim() : "",
        items,
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
          const imeis = l.item_type === "phone" ? imeiByItem[l.item_id] ?? [] : [];
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
                    value={l.quantity}
                    onChange={(e) => updateLine(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
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
                    {formatPKR(lineTotal(l))}
                  </div>
                </div>
                {imeis.length > 0 && (
                  <div className="col-span-12 mt-1">
                    <Select
                      name={`imei-${l.key}`}
                      label="IMEI Number (Optional)"
                      options={emeiOptionsFor(l.item_id)}
                      value={l.imei_id ? String(l.imei_id) : ""}
                      onChange={(e) => updateLine(l.key, { imei_id: e.target.value ? Number(e.target.value) : null })}
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
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: methodLabels[m] ?? m }))}
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          disabled={saving}
        />
        <Input
          name="discount"
          label="Discount (PKR)"
          type="number"
          min="0"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          disabled={saving}
        />
        <Input
          name="paid_amount"
          label="Amount Received (Leave blank for full)"
          type="number"
          min="0"
          value={paidAmount}
          onChange={(e) => setPaidAmount(e.target.value)}
          disabled={saving}
        />
      </div>
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
          Subtotal: <span className="font-semibold">{formatPKR(subtotal)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "#166534" }}>Total Due</span>
          <span className="amount-large font-bold text-[20px]" style={{ color: "#15803D" }}>
            {formatPKR(total)}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Complete Sale
        </Button>
      </div>
    </form>
  );
}