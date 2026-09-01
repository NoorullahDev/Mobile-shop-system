import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import type { Product, Supplier } from "../types/inventory";
import type { CreatePurchaseInput, PurchaseItemInput } from "../types/purchase";
import { PURCHASE_PAYMENT_METHODS } from "../types/purchase";

interface PurchaseFormProps {
  onSubmit: (input: CreatePurchaseInput) => Promise<void>;
  onCancel: () => void;
  suppliers: Supplier[];
  products: Product[];
}

interface DraftLine {
  key: number;
  productId: string;
  quantity: string;
  unitCost: string;
  imeis: string;
}

const methodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
};

let nextKey = 1;
function newLine(): DraftLine {
  return { key: nextKey++, productId: "", quantity: "1", unitCost: "", imeis: "" };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function PurchaseForm({ onSubmit, onCancel, suppliers, products }: PurchaseFormProps) {
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [discountStr, setDiscountStr] = useState("0");
  const [paidStr, setPaidStr] = useState("");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineError, setLineError] = useState<Record<number, string>>({});

  const supplierOptions = [
    { value: "", label: "— None —" },
    ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
  ];
  const productOptions = [
    { value: "", label: "Select product..." },
    ...products.map((p) => ({
      value: `${p.item_type}:${p.item_id}`,
      label: p.display_name,
    })),
  ];
  const methodOptions = PURCHASE_PAYMENT_METHODS.map((m) => ({
    value: m,
    label: methodLabels[m] ?? m,
  }));

  const updateLine = (key: number, patch: Partial<DraftLine>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const subtotal = lines.reduce((sum, l) => {
    const qty = Number(l.quantity) || 0;
    const cost = Number(l.unitCost) || 0;
    return sum + qty * cost;
  }, 0);
  const discount = Number(discountStr) || 0;
  const total = round2(Math.max(0, subtotal - discount));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items: PurchaseItemInput[] = [];
    const errs: Record<number, string> = {};

    for (const l of lines) {
      if (!l.productId) {
        errs[l.key] = "Select a product";
        continue;
      }
      const [itemType, idPart] = l.productId.split(":");
      const itemId = Number(idPart);
      if (!itemType || !Number.isFinite(itemId)) {
        errs[l.key] = "Select a product";
        continue;
      }
      const qty = Number(l.quantity);
      if (!qty || qty < 1) {
        errs[l.key] = "Quantity must be at least 1";
        continue;
      }
      const cost = Number(l.unitCost);
      if (!isFinite(cost) || cost < 0) {
        errs[l.key] = "Cost cannot be negative";
        continue;
      }
      items.push({
        item_type: itemType as "phone" | "accessory",
        item_id: itemId,
        quantity: qty,
        unit_cost: cost > 0 ? round2(cost) : null,
        imeis: l.imeis
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      });
    }

    if (items.length === 0) {
      setError("Add at least one product line item");
      return;
    }
    setLineError(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        supplier_id: supplierId ? Number(supplierId) : null,
        discount: round2(discount),
        paid_amount: paidStr !== "" ? round2(Number(paidStr) || 0) : null,
        payment_method: method,
        notes: notes.trim() || null,
        items,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <Alert message={error} variant="error" />}

      <Select
        name="supplier_id"
        label="Supplier"
        options={supplierOptions}
        value={supplierId}
        onChange={(e) => setSupplierId(e.target.value)}
        disabled={saving}
      />

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[13px] font-medium" style={{ color: "#334155" }}>
            Line Items
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setLines((ls) => [...ls, newLine()])}
            disabled={saving}
          >
            Add Item
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {lines.map((l, idx) => (
            <div
              key={l.key}
              className="rounded-md p-3"
              style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
            >
              <div className="flex items-start gap-2">
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Select
                      name={`product_${l.key}`}
                      label="Product"
                      options={productOptions}
                      value={l.productId}
                      onChange={(e) => updateLine(l.key, { productId: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                  <Input
                    name={`qty_${l.key}`}
                    label="Quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={l.quantity}
                    onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                    disabled={saving}
                  />
                  <Input
                    name={`cost_${l.key}`}
                    label="Unit Cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.unitCost}
                    placeholder="0.00"
                    onChange={(e) => updateLine(l.key, { unitCost: e.target.value })}
                    disabled={saving}
                  />
                  <div className="col-span-2">
                    <Input
                      name={`imei_${l.key}`}
                      label="IMEIs (optional, one per line)"
                      placeholder="One IMEI per line or comma separated"
                      value={l.imeis}
                      onChange={(e) => updateLine(l.key, { imeis: e.target.value })}
                      disabled={saving}
                    />
                    {lineError[l.key] && (
                      <span className="text-[12px]" style={{ color: "#DC2626" }}>
                        {lineError[l.key]}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  className="mt-7 flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors hover:bg-red-50"
                  style={{ color: "#DC2626" }}
                  title={idx === 0 ? "Clear" : "Remove item"}
                  disabled={saving}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          name="discount"
          label="Discount"
          type="number"
          min="0"
          step="0.01"
          value={discountStr}
          onChange={(e) => setDiscountStr(e.target.value)}
          disabled={saving}
        />
        <Input
          name="paid_amount"
          label="Amount Paid"
          type="number"
          min="0"
          step="0.01"
          value={paidStr}
          placeholder="Leave blank = full payment"
          onChange={(e) => setPaidStr(e.target.value)}
          disabled={saving}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          name="payment_method"
          label="Payment Method"
          options={methodOptions}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          disabled={saving}
        />
        <Input
          name="notes"
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={saving}
        />
      </div>

      <div
        className="flex items-center justify-between rounded-lg px-4 py-3"
        style={{ background: "#EFF6FF", border: "1px solid #DBEAFE" }}
      >
        <span className="text-[13px] font-semibold" style={{ color: "#1E40AF" }}>
          Subtotal
        </span>
        <span className="amount font-bold text-[16px]" style={{ color: "#1E40AF" }}>
          Rs. {round2(subtotal).toLocaleString("en-PK")}
        </span>
      </div>
      <div
        className="flex items-center justify-between rounded-lg px-4 py-3"
        style={{ background: "#F0FDF4", border: "1px solid #DCFCE7" }}
      >
        <span className="text-[13px] font-semibold" style={{ color: "#15803D" }}>
          Grand Total (after discount)
        </span>
        <span className="amount font-bold text-[18px]" style={{ color: "#15803D" }}>
          Rs. {total.toLocaleString("en-PK")}
        </span>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Record Purchase
        </Button>
      </div>
    </form>
  );
}
