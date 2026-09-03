import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, Plus, Search, Smartphone, Headphones } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import { Modal } from "../components/Modal";
import { PhoneForm } from "./PhoneForm";
import { AccessoryForm } from "./AccessoryForm";
import type {
  Phone,
  Accessory,
  Supplier,
  CreatePhoneInput,
  CreateAccessoryInput,
} from "../types/inventory";
import type { CreatePurchaseInput, PurchaseItemInput } from "../types/purchase";
import { PURCHASE_PAYMENT_METHODS } from "../types/purchase";

interface PurchaseFormProps {
  onSubmit: (input: CreatePurchaseInput) => Promise<void>;
  onCancel: () => void;
  suppliers: Supplier[];
  phones: Phone[];
  accessories: Accessory[];
  addPhone: (input: CreatePhoneInput) => Promise<void>;
  addAccessory: (input: CreateAccessoryInput) => Promise<void>;
}

interface PhoneDraftLine {
  key: number;
  productId: string;
  quantity: string;
  unitCost: string;
  sellingPrice: string;
  warranty: string;
  condition: string;
  imeis: string[];
}

interface AccessoryDraftLine {
  key: number;
  productId: string;
  quantity: string;
  unitCost: string;
  sellingPrice: string;
  warranty: string;
}

const methodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
};

let nextKey = 1;

function newPhoneLine(quantity = 1): PhoneDraftLine {
  return {
    key: nextKey++,
    productId: "",
    quantity: String(quantity),
    unitCost: "",
    sellingPrice: "",
    warranty: "",
    condition: "",
    imeis: Array.from({ length: quantity }, () => ""),
  };
}

function newAccessoryLine(): AccessoryDraftLine {
  return {
    key: nextKey++,
    productId: "",
    quantity: "1",
    unitCost: "",
    sellingPrice: "",
    warranty: "",
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function phoneDisplay(p: Phone) {
  return `${p.brand} ${p.model}${p.storage ? ` (${p.storage})` : ""}`;
}

function accessoryDisplay(a: Accessory) {
  return `${a.brand ? `${a.brand} ` : ""}${a.product_name}`.trim();
}

export function PurchaseForm({
  onSubmit,
  onCancel,
  suppliers,
  phones,
  accessories,
  addPhone,
  addAccessory,
}: PurchaseFormProps) {
  const [supplierId, setSupplierId] = useState("");
  const [phoneLines, setPhoneLines] = useState<PhoneDraftLine[]>([]);
  const [accessoryLines, setAccessoryLines] = useState<AccessoryDraftLine[]>([]);
  const [discountStr, setDiscountStr] = useState("0");
  const [paidStr, setPaidStr] = useState("");
  const [method, setMethod] = useState("cash");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Searchable product pickers
  const [phoneSearch, setPhoneSearch] = useState("");
  const [phoneDropOpen, setPhoneDropOpen] = useState(false);
  const [accessorySearch, setAccessorySearch] = useState("");
  const [accessoryDropOpen, setAccessoryDropOpen] = useState(false);

  // Inline "Add New" forms
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [showAddAccessory, setShowAddAccessory] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const supplierOptions = [
    { value: "", label: "— None —" },
    ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
  ];
  const methodOptions = PURCHASE_PAYMENT_METHODS.map((m) => ({
    value: m,
    label: methodLabels[m] ?? m,
  }));

  const filteredPhones = useMemo(() => {
    const q = phoneSearch.trim().toLowerCase();
    return phones
      .filter((p) => {
        if (!q) return true;
        return `${p.brand} ${p.model} ${p.storage ?? ""} ${p.color ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 50);
  }, [phones, phoneSearch]);

  const filteredAccessories = useMemo(() => {
    const q = accessorySearch.trim().toLowerCase();
    return accessories
      .filter((a) => {
        if (!q) return true;
        return `${a.brand} ${a.product_name} ${a.accessory_type} ${a.color ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 50);
  }, [accessories, accessorySearch]);

  const updatePhoneLine = (key: number, patch: Partial<PhoneDraftLine>) => {
    setPhoneLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const updateAccessoryLine = (key: number, patch: Partial<AccessoryDraftLine>) => {
    setAccessoryLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const setPhoneQuantity = (key: number, quantity: number) => {
    setPhoneLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const n = Math.max(1, quantity);
        const imeis = Array.from({ length: n }, (_, i) => l.imeis[i] ?? "");
        return { ...l, quantity: String(n), imeis };
      }),
    );
  };

  const setPhoneImei = (key: number, index: number, value: string) => {
    setPhoneLines((ls) =>
      ls.map((l) =>
        l.key === key
          ? { ...l, imeis: l.imeis.map((v, i) => (i === index ? value : v)) }
          : l,
      ),
    );
  };

  const addPhoneById = (id: number) => {
    const line = newPhoneLine();
    line.productId = String(id);
    setPhoneLines((ls) => [...ls, line]);
    setPhoneSearch("");
    setPhoneDropOpen(false);
  };

  const addAccessoryById = (id: number) => {
    const line = newAccessoryLine();
    line.productId = String(id);
    setAccessoryLines((ls) => [...ls, line]);
    setAccessorySearch("");
    setAccessoryDropOpen(false);
  };

  const handleAddPhone = async (input: CreatePhoneInput) => {
    setAddError(null);
    try {
      await addPhone(input);
      setShowAddPhone(false);
    } catch (e) {
      setAddError(String(e));
    }
  };

  const handleAddAccessory = async (input: CreateAccessoryInput) => {
    setAddError(null);
    try {
      await addAccessory(input);
      setShowAddAccessory(false);
    } catch (e) {
      setAddError(String(e));
    }
  };

  const subtotal = [...phoneLines, ...accessoryLines].reduce((sum, l) => {
    const qty = Number(l.quantity) || 0;
    const cost = Number(l.unitCost) || 0;
    return sum + qty * cost;
  }, 0);
  const discount = Number(discountStr) || 0;
  const total = round2(Math.max(0, subtotal - discount));
  const paid = Number(paidStr) || 0;
  const balanceDue = round2(Math.max(0, total - paid));
  const paymentStatus =
    paid >= total - 0.005 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items: PurchaseItemInput[] = [];
    const errs: string[] = [];

    for (const l of phoneLines) {
      if (!l.productId) {
        errs.push("Select a phone for every mobile phone line.");
        continue;
      }
      const qty = Number(l.quantity);
      if (!qty || qty < 1) {
        errs.push("Phone quantity must be at least 1.");
        continue;
      }
      const cost = Number(l.unitCost);
      if (!isFinite(cost) || cost < 0) {
        errs.push("Phone cost cannot be negative.");
        continue;
      }
      const imeis = l.imeis.map((s) => s.trim()).filter((s) => s.length > 0);
      if (imeis.length !== qty) {
        errs.push(
          `Quantity ${qty} requires exactly ${qty} IMEI(s) for ${phoneDisplay(
            phones.find((p) => p.id === Number(l.productId))!,
          )}.`,
        );
        continue;
      }
      if (new Set(imeis).size !== imeis.length) {
        errs.push("Duplicate IMEIs are not allowed for a phone.");
        continue;
      }
      items.push({
        item_type: "phone",
        item_id: Number(l.productId),
        quantity: qty,
        unit_cost: cost > 0 ? round2(cost) : null,
        selling_price: l.sellingPrice !== "" ? round2(Number(l.sellingPrice) || 0) : null,
        warranty: l.warranty.trim() || null,
        condition: l.condition.trim() || null,
        imeis,
      });
    }

    for (const l of accessoryLines) {
      if (!l.productId) {
        errs.push("Select an accessory for every accessory line.");
        continue;
      }
      const qty = Number(l.quantity);
      if (!qty || qty < 1) {
        errs.push("Accessory quantity must be at least 1.");
        continue;
      }
      const cost = Number(l.unitCost);
      if (!isFinite(cost) || cost < 0) {
        errs.push("Accessory cost cannot be negative.");
        continue;
      }
      items.push({
        item_type: "accessory",
        item_id: Number(l.productId),
        quantity: qty,
        unit_cost: cost > 0 ? round2(cost) : null,
        selling_price: l.sellingPrice !== "" ? round2(Number(l.sellingPrice) || 0) : null,
        warranty: l.warranty.trim() || null,
        imeis: [],
      });
    }

    if (items.length === 0) {
      setError("Add at least one mobile phone or accessory before recording the purchase.");
      return;
    }
    if (errs.length > 0) {
      setError(errs[0]);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        supplier_id: supplierId ? Number(supplierId) : null,
        discount: round2(discount),
        paid_amount: paidStr !== "" ? round2(Number(paidStr) || 0) : null,
        payment_method: method,
        purchase_date: purchaseDate || null,
        invoice_reference: invoiceRef.trim() || null,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && <Alert message={error} variant="error" />}

      <Select
        name="supplier_id"
        label="Supplier"
        options={supplierOptions}
        value={supplierId}
        onChange={(e) => setSupplierId(e.target.value)}
        disabled={saving}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          name="purchase_date"
          label="Purchase Date"
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          disabled={saving}
        />
        <Input
          name="invoice_reference"
          label="Supplier Invoice / Reference #"
          value={invoiceRef}
          placeholder="e.g. INV-2026-0123"
          onChange={(e) => setInvoiceRef(e.target.value)}
          disabled={saving}
        />
      </div>

      {/* ===================== MOBILE PHONES ===================== */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-[#0F172A]">
            <Smartphone className="h-4 w-4 text-blue-600" />
            Mobile Phones
          </h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowAddPhone(true);
              setAddError(null);
            }}
            icon={<Plus className="h-3.5 w-3.5" />}
            disabled={saving}
          >
            Add New Phone
          </Button>
        </div>

        {/* Searchable phone picker */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "#94A3B8" }}
          />
          <input
            className="h-9 w-full rounded border bg-white pl-9 pr-8 text-[13px] outline-none transition-all"
            style={{ borderColor: phoneDropOpen ? "#3B6FD4" : "#CBD5E1", color: "#0F172A" }}
            placeholder="Search phones to add..."
            value={phoneSearch}
            disabled={saving}
            onFocus={() => setPhoneDropOpen(true)}
            onChange={(e) => {
              setPhoneSearch(e.target.value);
              setPhoneDropOpen(true);
            }}
            onBlur={() => setTimeout(() => setPhoneDropOpen(false), 150)}
          />
          {phoneDropOpen && filteredPhones.length > 0 && (
            <div
              className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg"
              style={{ borderColor: "#E2E8F0" }}
            >
              {filteredPhones.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addPhoneById(p.id);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="text-[13px] text-slate-800">
                    {phoneDisplay(p)}{" "}
                    <span style={{ color: "#94A3B8" }}>({p.quantity} in stock)</span>
                  </span>
                  <Plus className="h-3.5 w-3.5 text-blue-600" />
                </button>
              ))}
            </div>
          )}
        </div>

        {phoneLines.length === 0 ? (
          <p className="mt-3 text-[12px] text-slate-400">
            No phones added yet. Search above, or use "Add New Phone".
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {phoneLines.map((l) => {
              const phone = phones.find((p) => p.id === Number(l.productId));
              return (
                <div
                  key={l.key}
                  className="rounded-lg border border-[#E2E8F0] bg-slate-50/50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div
                      className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800"
                      title={phone ? phoneDisplay(phone) : "Please pick a phone"}
                    >
                      {phone ? phoneDisplay(phone) : "No phone selected"}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhoneLines((ls) => ls.filter((x) => x.key !== l.key))}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      disabled={saving}
                      aria-label="Remove phone"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Input
                      label="Qty"
                      type="number"
                      min="1"
                      step="1"
                      value={l.quantity}
                      disabled={saving}
                      onChange={(e) => setPhoneQuantity(l.key, Number(e.target.value))}
                    />
                    <Input
                      label="Unit Cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.unitCost}
                      placeholder="0.00"
                      disabled={saving}
                      onChange={(e) => updatePhoneLine(l.key, { unitCost: e.target.value })}
                    />
                    <Input
                      label="Selling Price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.sellingPrice}
                      placeholder="0.00"
                      disabled={saving}
                      onChange={(e) => updatePhoneLine(l.key, { sellingPrice: e.target.value })}
                    />
                    <div className="flex flex-col justify-end pb-1">
                      <div className="text-[12px] font-medium text-slate-500">Line Total</div>
                      <div className="text-[15px] font-bold text-slate-800">
                        Rs. {round2((Number(l.quantity) || 0) * (Number(l.unitCost) || 0)).toLocaleString("en-PK")}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input
                      label="Warranty"
                      value={l.warranty}
                      placeholder="e.g. 12 months"
                      disabled={saving}
                      onChange={(e) => updatePhoneLine(l.key, { warranty: e.target.value })}
                    />
                    <Input
                      label="Condition"
                      value={l.condition}
                      placeholder="e.g. New / Used"
                      disabled={saving}
                      onChange={(e) => updatePhoneLine(l.key, { condition: e.target.value })}
                    />
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 text-[12px] font-medium text-slate-500">
                      IMEIs{" "}
                      <span className="text-red-600">
                        (required — exactly {Number(l.quantity) || 0})
                      </span>
                    </div>
                    <div
                      className={`grid gap-2 ${
                        l.imeis.length > 1
                          ? "grid-cols-2"
                          : "grid-cols-1"
                      }`}
                    >
                      {l.imeis.map((imei, i) => (
                        <Input
                          key={i}
                          placeholder={`IMEI ${i + 1}`}
                          value={imei}
                          disabled={saving}
                          mono
                          onChange={(e) => setPhoneImei(l.key, i, e.target.value)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================== ACCESSORIES ===================== */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-[#0F172A]">
            <Headphones className="h-4 w-4 text-amber-600" />
            Accessories
          </h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowAddAccessory(true);
              setAddError(null);
            }}
            icon={<Plus className="h-3.5 w-3.5" />}
            disabled={saving}
          >
            Add New Accessory
          </Button>
        </div>

        {/* Searchable accessory picker */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "#94A3B8" }}
          />
          <input
            className="h-9 w-full rounded border bg-white pl-9 pr-8 text-[13px] outline-none transition-all"
            style={{ borderColor: accessoryDropOpen ? "#D97706" : "#CBD5E1", color: "#0F172A" }}
            placeholder="Search accessories to add..."
            value={accessorySearch}
            disabled={saving}
            onFocus={() => setAccessoryDropOpen(true)}
            onChange={(e) => {
              setAccessorySearch(e.target.value);
              setAccessoryDropOpen(true);
            }}
            onBlur={() => setTimeout(() => setAccessoryDropOpen(false), 150)}
          />
          {accessoryDropOpen && filteredAccessories.length > 0 && (
            <div
              className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg"
              style={{ borderColor: "#E2E8F0" }}
            >
              {filteredAccessories.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addAccessoryById(a.id);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="text-[13px] text-slate-800">
                    {accessoryDisplay(a)}{" "}
                    <span style={{ color: "#94A3B8" }}>({a.quantity} in stock)</span>
                  </span>
                  <Plus className="h-3.5 w-3.5 text-amber-600" />
                </button>
              ))}
            </div>
          )}
        </div>

        {accessoryLines.length === 0 ? (
          <p className="mt-3 text-[12px] text-slate-400">
            No accessories added yet. Search above, or use "Add New Accessory".
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {accessoryLines.map((l) => {
              const accessory = accessories.find((a) => a.id === Number(l.productId));
              return (
                <div
                  key={l.key}
                  className="rounded-lg border border-[#E2E8F0] bg-slate-50/50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div
                      className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800"
                      title={accessory ? accessoryDisplay(accessory) : "Please pick an accessory"}
                    >
                      {accessory ? accessoryDisplay(accessory) : "No accessory selected"}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAccessoryLines((ls) => ls.filter((x) => x.key !== l.key))}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      disabled={saving}
                      aria-label="Remove accessory"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Input
                      label="Qty"
                      type="number"
                      min="1"
                      step="1"
                      value={l.quantity}
                      disabled={saving}
                      onChange={(e) => updateAccessoryLine(l.key, { quantity: e.target.value })}
                    />
                    <Input
                      label="Unit Cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.unitCost}
                      placeholder="0.00"
                      disabled={saving}
                      onChange={(e) => updateAccessoryLine(l.key, { unitCost: e.target.value })}
                    />
                    <Input
                      label="Selling Price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.sellingPrice}
                      placeholder="0.00"
                      disabled={saving}
                      onChange={(e) => updateAccessoryLine(l.key, { sellingPrice: e.target.value })}
                    />
                    <div className="flex flex-col justify-end pb-1">
                      <div className="text-[12px] font-medium text-slate-500">Line Total</div>
                      <div className="text-[15px] font-bold text-slate-800">
                        Rs. {round2((Number(l.quantity) || 0) * (Number(l.unitCost) || 0)).toLocaleString("en-PK")}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Input
                      label="Warranty"
                      value={l.warranty}
                      placeholder="e.g. 12 months"
                      disabled={saving}
                      onChange={(e) => updateAccessoryLine(l.key, { warranty: e.target.value })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <div className="border-t border-[#E2E8F0] pt-4">
        <div className="flex items-center justify-between py-1">
          <span className="text-[13px] font-medium text-slate-500">Subtotal</span>
          <span className="text-[14px] font-semibold text-slate-800">
            Rs. {round2(subtotal).toLocaleString("en-PK")}
          </span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[13px] font-medium text-slate-500">Discount</span>
          <span className="text-[14px] font-semibold text-slate-800">
            - Rs. {round2(discount).toLocaleString("en-PK")}
          </span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[13px] font-semibold text-slate-800">Grand Total</span>
          <span className="text-[18px] font-bold text-emerald-600">
            Rs. {total.toLocaleString("en-PK")}
          </span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[13px] font-medium text-slate-500">Amount Paid</span>
          <span className="text-[14px] font-semibold text-slate-800">
            Rs. {paid.toLocaleString("en-PK")}
          </span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[13px] font-medium text-slate-500">Balance Due</span>
          <span className="text-[14px] font-bold text-orange-600">
            Rs. {balanceDue.toLocaleString("en-PK")}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-3">
          <span className="text-[13px] font-semibold text-slate-800">Payment Status</span>
          <span
            className={`rounded-full px-3 py-1 text-[12px] font-bold ${
              paymentStatus === "Paid"
                ? "bg-emerald-100 text-emerald-700"
                : paymentStatus === "Partial"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {paymentStatus}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Record Purchase
        </Button>
      </div>

      {/* ============ Inline "Add New Phone" modal (reuses existing form) ============ */}
      {createPortal(
        <Modal
          open={showAddPhone}
          title="Add Mobile Phone"
          subtitle="Add a new phone, then it becomes immediately selectable here"
          onClose={() => setShowAddPhone(false)}
          size="lg"
        >
          {addError && <div className="mb-3"><Alert message={addError} variant="error" /></div>}
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <PhoneForm
              onSubmit={handleAddPhone}
              onCancel={() => setShowAddPhone(false)}
              suppliers={suppliers}
              categories={[]}
            />
          </div>
        </Modal>,
        document.body,
      )}

      {/* ============ Inline "Add New Accessory" modal (reuses existing form) ============ */}
      {createPortal(
        <Modal
          open={showAddAccessory}
          title="Add Accessory"
          subtitle="Add a new accessory, then it becomes immediately selectable here"
          onClose={() => setShowAddAccessory(false)}
          size="lg"
        >
          {addError && <div className="mb-3"><Alert message={addError} variant="error" /></div>}
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <AccessoryForm
              onSubmit={handleAddAccessory}
              onCancel={() => setShowAddAccessory(false)}
              suppliers={suppliers}
              categories={[]}
            />
          </div>
        </Modal>,
        document.body,
      )}
    </form>
  );
}
