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
import type { CreatePurchaseInput, PurchaseItemInput, Purchase } from "../types/purchase";
import { PURCHASE_PAYMENT_METHODS } from "../types/purchase";
import { methodLabels, roundMoney } from "../lib/format";

interface PurchaseFormProps {
  initial?: Purchase;
  onSubmit: (input: CreatePurchaseInput) => Promise<void>;
  onCancel: () => void;
  suppliers: Supplier[];
  phones: Phone[];
  accessories: Accessory[];
  addPhone: (input: CreatePhoneInput) => Promise<Phone>;
  addAccessory: (input: CreateAccessoryInput) => Promise<void>;
}

interface PhoneDraftLine {
  key: number;
  productId: string;
  quantity: string;
  unitCost: string;
  sellingPrice: string;
  legacyWarranty: string;
  legacyCondition: string;
  imeis: string[];
  imei2s: string[];
  imeiColors: string[];
  imeiPtaStatuses: string[];
  imeiStorages: string[];
  imeiBatteryHealths: string[];
  imeiUnitCosts: string[];
  imeiSalePrices: string[];
}

const CUSTOM_PTA_STATUS = "__custom__";
const PTA_STATUS_OPTIONS = [
  { value: "PTA Approved", label: "PTA Approved" },
  { value: "Non-PTA", label: "Non-PTA" },
  { value: "JV", label: "JV" },
  { value: "Dual SIM", label: "Dual SIM" },
  { value: CUSTOM_PTA_STATUS, label: "Other / Custom" },
];
const DEFAULT_PTA_STATUSES = new Set(
  PTA_STATUS_OPTIONS
    .filter((option) => option.value !== CUSTOM_PTA_STATUS)
    .map((option) => option.value),
);

interface AccessoryDraftLine {
  key: number;
  productId: string;
  quantity: string;
  unitCost: string;
  sellingPrice: string;
  warranty: string;
}

let nextKey = 1;

function newPhoneLine(quantity = 1): PhoneDraftLine {
  return {
    key: nextKey++,
    productId: "",
    quantity: String(quantity),
    unitCost: "",
    sellingPrice: "",
    legacyWarranty: "",
    legacyCondition: "",
    imeis: Array.from({ length: quantity }, () => ""),
    imei2s: Array.from({ length: quantity }, () => ""),
    imeiColors: Array.from({ length: quantity }, () => ""),
    imeiPtaStatuses: Array.from({ length: quantity }, () => "PTA Approved"),
    imeiStorages: Array.from({ length: quantity }, () => ""),
    imeiBatteryHealths: Array.from({ length: quantity }, () => ""),
    imeiUnitCosts: Array.from({ length: quantity }, () => ""),
    imeiSalePrices: Array.from({ length: quantity }, () => ""),
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

function phoneDisplay(p: Phone) {
  return `${p.brand ? `${p.brand} ` : ""}${p.model}${p.storage ? ` (${p.storage})` : ""}`;
}

function accessoryDisplay(a: Accessory) {
  return `${a.brand ? `${a.brand} ` : ""}${a.product_name}`.trim();
}

export function PurchaseForm({
  initial,
  onSubmit,
  onCancel,
  suppliers,
  phones,
  accessories,
  addPhone,
  addAccessory,
}: PurchaseFormProps) {
  const [supplierId, setSupplierId] = useState(initial?.supplier_id ? String(initial.supplier_id) : "");
  
  const initialPhones = useMemo(() => {
    if (!initial) return [];
    return initial.items
      .filter((i) => i.item_type === "phone")
      .map((i) => ({
        key: nextKey++,
        productId: String(i.item_id),
        quantity: String(i.quantity),
        unitCost: String(i.unit_cost || 0),
        sellingPrice: i.selling_price ? String(i.selling_price) : "",
        legacyWarranty: i.warranty || "",
        legacyCondition: i.condition || "",
        imeis: i.serials || [],
        imei2s: Array.from(
          { length: i.serials?.length ?? 0 },
          (_, k) => i.imei2s?.[k] ?? "",
        ),
        imeiColors: Array.from(
          { length: i.serials?.length ?? 0 },
          (_, k) => i.imei_colors?.[k] ?? "",
        ),
        imeiPtaStatuses: Array.from(
          { length: i.serials?.length ?? 0 },
          (_, k) => i.imei_pta_statuses?.[k]?.trim() || "PTA Approved",
        ),
        imeiStorages: Array.from(
          { length: i.serials?.length ?? 0 },
          (_, k) => i.imei_storages?.[k] ?? "",
        ),
        imeiBatteryHealths: Array.from(
          { length: i.serials?.length ?? 0 },
          (_, k) => {
            const value = i.imei_battery_healths?.[k];
            return value == null ? "" : String(value);
          },
        ),
        imeiUnitCosts:
          i.imei_costs?.map((c) => String(c)) ?? [],
        imeiSalePrices:
          (i.imei_sale_prices ?? []).map((sp) => (sp == null ? "" : String(sp))) ?? [],
      }));
  }, [initial]);

  const initialAccessories = useMemo(() => {
    if (!initial) return [];
    return initial.items
      .filter((i) => i.item_type === "accessory")
      .map((i) => ({
        key: nextKey++,
        productId: String(i.item_id),
        quantity: String(i.quantity),
        unitCost: String(i.unit_cost || 0),
        sellingPrice: i.selling_price ? String(i.selling_price) : "",
        warranty: i.warranty || "",
      }));
  }, [initial]);

  const [phoneLines, setPhoneLines] = useState<PhoneDraftLine[]>(initialPhones);
  const [accessoryLines, setAccessoryLines] = useState<AccessoryDraftLine[]>(initialAccessories);
  const [discountStr, setDiscountStr] = useState(initial ? String(initial.discount) : "0");
  const [paidStr, setPaidStr] = useState(initial ? String(initial.paid_amount) : "");
  const [method, setMethod] = useState(initial?.payment_method || "cash");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchase_date ? initial.purchase_date.substring(0, 10) : "");
  const [invoiceRef, setInvoiceRef] = useState(initial?.invoice_reference || "");
  const [notes, setNotes] = useState(initial?.notes || "");
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

  const updateAccessoryLine = (key: number, patch: Partial<AccessoryDraftLine>) => {
    setAccessoryLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  // The top-of-line prices are the *defaults* for fast entry. Every time they
  // change, units that are still blank or that only carry the previous default
  // adopt the new value; units with an intentional override keep their own.
  const setPhoneDefaultCost = (key: number, value: string) => {
    setPhoneLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const prev = l.unitCost;
        const imeiUnitCosts = l.imeiUnitCosts.map((v) =>
          value === "" ? v : v === "" || v === prev ? value : v,
        );
        return { ...l, unitCost: value, imeiUnitCosts };
      }),
    );
  };

  const setPhoneDefaultSellingPrice = (key: number, value: string) => {
    setPhoneLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const prev = l.sellingPrice;
        const imeiSalePrices = l.imeiSalePrices.map((v) =>
          value === "" ? v : v === "" || v === prev ? value : v,
        );
        return { ...l, sellingPrice: value, imeiSalePrices };
      }),
    );
  };

  const setPhoneQuantity = (key: number, quantity: number) => {
    setPhoneLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const n = Math.max(1, quantity);
        const imeis = Array.from({ length: n }, (_, i) => l.imeis[i] ?? "");
        const imei2s = Array.from({ length: n }, (_, i) => l.imei2s[i] ?? "");
        const imeiColors = Array.from({ length: n }, (_, i) => l.imeiColors[i] ?? "");
        const imeiPtaStatuses = Array.from({ length: n }, (_, i) => l.imeiPtaStatuses[i] ?? "PTA Approved");
        const imeiStorages = Array.from({ length: n }, (_, i) => l.imeiStorages[i] ?? "");
        const imeiBatteryHealths = Array.from({ length: n }, (_, i) => l.imeiBatteryHealths[i] ?? "");
        // New units created by raising the quantity inherit the line defaults.
        const imeiUnitCosts = Array.from({ length: n }, (_, i) => l.imeiUnitCosts[i] ?? l.unitCost);
        const imeiSalePrices = Array.from({ length: n }, (_, i) => l.imeiSalePrices[i] ?? l.sellingPrice);
        return {
          ...l,
          quantity: String(n),
          imeis,
          imei2s,
          imeiColors,
          imeiPtaStatuses,
          imeiStorages,
          imeiBatteryHealths,
          imeiUnitCosts,
          imeiSalePrices,
        };
      }),
    );
  };

  const setPhoneUnitCost = (key: number, index: number, value: string) => {
    setPhoneLines((ls) =>
      ls.map((l) =>
        l.key === key
          ? { ...l, imeiUnitCosts: l.imeiUnitCosts.map((v, i) => (i === index ? value : v)) }
          : l,
      ),
    );
  };

  const setPhoneUnitSalePrice = (key: number, index: number, value: string) => {
    setPhoneLines((ls) =>
      ls.map((l) =>
        l.key === key
          ? { ...l, imeiSalePrices: l.imeiSalePrices.map((v, i) => (i === index ? value : v)) }
          : l,
      ),
    );
  };

  const setPhoneImei2 = (key: number, index: number, value: string) => {
    setPhoneLines((ls) => ls.map((l) =>
      l.key === key ? { ...l, imei2s: l.imei2s.map((v, i) => (i === index ? value : v)) } : l,
    ));
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

  const setPhonePtaStatus = (key: number, index: number, value: string) => {
    setPhoneLines((ls) => ls.map((l) =>
      l.key === key ? { ...l, imeiPtaStatuses: l.imeiPtaStatuses.map((v, i) => (i === index ? value : v)) } : l,
    ));
  };

  const setPhoneColor = (key: number, index: number, value: string) => {
    setPhoneLines((ls) =>
      ls.map((l) =>
        l.key === key
          ? { ...l, imeiColors: l.imeiColors.map((v, i) => (i === index ? value : v)) }
          : l,
      ),
    );
  };

  const setPhoneStorage = (key: number, index: number, value: string) => {
    setPhoneLines((ls) =>
      ls.map((l) =>
        l.key === key
          ? { ...l, imeiStorages: l.imeiStorages.map((v, i) => (i === index ? value : v)) }
          : l,
      ),
    );
  };

  const setPhoneBatteryHealth = (key: number, index: number, value: string) => {
    setPhoneLines((ls) =>
      ls.map((l) =>
        l.key === key
          ? { ...l, imeiBatteryHealths: l.imeiBatteryHealths.map((v, i) => (i === index ? value : v)) }
          : l,
      ),
    );
  };

  const addPhoneById = (id: number) => {
    const line = newPhoneLine();
    line.productId = String(id);
    const phone = phones.find((p) => p.id === id);
    if (phone) {
      line.unitCost = String(phone.cost_price || "");
      line.sellingPrice = String(phone.sale_price || "");
      line.imeiUnitCosts = line.imeiUnitCosts.map(() => line.unitCost);
      line.imeiSalePrices = line.imeiSalePrices.map(() => line.sellingPrice);
    }
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
      const created = await addPhone(input);
      const line = newPhoneLine();
      line.productId = String(created.id);
      line.unitCost = created.cost_price ? String(created.cost_price) : "";
      line.sellingPrice = created.sale_price ? String(created.sale_price) : "";
      line.imeiUnitCosts = line.imeiUnitCosts.map(() => line.unitCost);
      line.imeiSalePrices = line.imeiSalePrices.map(() => line.sellingPrice);
      setPhoneLines((ls) => [...ls, line]);
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

  // A phone line's cost is the SUM of each physical unit's own cost (blank or
  // zero unit costs fall back to the line default). Accessories stay simple.
  const phoneLineEffectiveCosts = (l: PhoneDraftLine): number[] => {
    const qty = Math.max(0, Number(l.quantity) || 0);
    const def = Number(l.unitCost) || 0;
    return Array.from({ length: qty }, (_, i) => {
      const v = (l.imeiUnitCosts[i] ?? "").trim();
      if (v === "") return def;
      const n = Number(v);
      return isFinite(n) && n > 0 ? n : def;
    });
  };

  const phoneLineTotal = (l: PhoneDraftLine): number => {
    const hasUnits = l.imeis.some((s) => s.trim() !== "");
    return hasUnits
      ? phoneLineEffectiveCosts(l).reduce((a, b) => a + b, 0)
      : (Number(l.quantity) || 0) * (Number(l.unitCost) || 0);
  };

  // Fixed one-line label strip so every unit field sits on the same level and
  // all controls share identical height and vertical alignment.
  const unitFieldLabel = (text: string) => (
    <div
      className="flex h-[18px] items-center overflow-hidden whitespace-nowrap text-[13px] font-medium"
      style={{ color: "#334155" }}
    >
      {text}
    </div>
  );

  const subtotal = roundMoney(
    phoneLines.reduce((sum, l) => sum + phoneLineTotal(l), 0) +
      accessoryLines.reduce((sum, l) => {
        const qty = Number(l.quantity) || 0;
        const cost = Number(l.unitCost) || 0;
        return sum + qty * cost;
      }, 0),
  );
  const discount = Number(discountStr) || 0;
  const total = roundMoney(Math.max(0, subtotal - discount));
  const paid = Number(paidStr) || 0;
  const balanceDue = roundMoney(Math.max(0, total - paid));
  const paymentStatus =
    paid >= total - 0.005 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items: PurchaseItemInput[] = [];
    const errs: string[] = [];

    if (!purchaseDate) {
      errs.push("Purchase Date is required.");
    }

    if (phoneLines.length === 0 && accessoryLines.length === 0) {
      errs.push("Add at least one mobile phone or accessory before recording the purchase.");
    }

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
      const units = l.imeis
        .map((s, i) => ({
          imei: s.trim(),
          imei2: (l.imei2s[i] ?? "").trim(),
          color: (l.imeiColors[i] ?? "").trim(),
          ptaStatus: (l.imeiPtaStatuses[i] ?? "PTA Approved").trim(),
          storage: (l.imeiStorages[i] ?? "").trim(),
          batteryHealth: (l.imeiBatteryHealths[i] ?? "").trim(),
          unitCost: (l.imeiUnitCosts[i] ?? "").trim(),
          salePrice: (l.imeiSalePrices[i] ?? "").trim(),
        }))
        .filter((u) => u.imei.length > 0);
      const imeis = units.map((u) => u.imei);
      if (imeis.length !== qty) {
        const phone = phones.find((p) => p.id === Number(l.productId));
        errs.push(
          `Quantity ${qty} requires exactly ${qty} IMEI(s) for ${phone ? phoneDisplay(phone) : `product #${l.productId}`}.`,
        );
        continue;
      }
      if (new Set(imeis).size !== imeis.length) {
        errs.push("Duplicate IMEIs are not allowed for a phone.");
        continue;
      }
      const allIdentifiers = units.flatMap((u) => [u.imei, u.imei2].filter(Boolean));
      if (new Set(allIdentifiers.map((v) => v.toUpperCase())).size !== allIdentifiers.length) {
        errs.push("IMEI 1 and IMEI 2 values must be unique across all physical units.");
        continue;
      }
      if (units.some((u) => !u.ptaStatus || u.ptaStatus === CUSTOM_PTA_STATUS)) {
        errs.push("Enter a custom PTA status for every unit using Other / Custom.");
        continue;
      }
      if (units.some((u) => !/^\d{15}$/.test(u.imei))) {
        errs.push("IMEI 1 must be exactly 15 numeric digits for every physical phone unit.");
        continue;
      }
      if (units.some((u) => u.imei2.length > 0 && !/^\d{15}$/.test(u.imei2))) {
        errs.push("IMEI 2, when entered, must also be exactly 15 numeric digits.");
        continue;
      }
      if (units.some((u) => !u.storage)) {
        errs.push("Enter storage for every physical phone unit.");
        continue;
      }
      if (
        units.some((u) => {
          if (u.batteryHealth === "") return false;
          const value = Number(u.batteryHealth);
          return !Number.isInteger(value) || value < 0 || value > 100;
        })
      ) {
        errs.push("Battery health must be a whole number from 0 to 100 when entered.");
        continue;
      }
      if (
        units.some((u) => u.unitCost !== "" && (!isFinite(Number(u.unitCost)) || Number(u.unitCost) < 0))
      ) {
        errs.push("Every unit Unit Cost must be a non-negative number when entered.");
        continue;
      }
      if (
        units.some((u) => u.salePrice !== "" && (!isFinite(Number(u.salePrice)) || Number(u.salePrice) < 0))
      ) {
        errs.push("Every unit Selling Price must be a non-negative number when entered.");
        continue;
      }
      items.push({
        item_type: "phone",
        item_id: Number(l.productId),
        quantity: qty,
        unit_cost: cost > 0 ? roundMoney(cost) : null,
        selling_price: l.sellingPrice !== "" ? roundMoney(Number(l.sellingPrice) || 0) : null,
        // Hidden compatibility values: the phone purchase UI no longer owns
        // these fields, but editing an old purchase must not erase its history.
        warranty: l.legacyWarranty || null,
        condition: l.legacyCondition || null,
        imeis,
        imei2s: units.map((u) => u.imei2),
        imei_colors: units.map((u) => u.color),
        imei_pta_statuses: units.map((u) => u.ptaStatus),
        imei_storages: units.map((u) => u.storage),
        imei_battery_healths: units.map((u) =>
          u.batteryHealth === "" ? null : Number(u.batteryHealth),
        ),
        // Blank or zero enters fall back to the line default on the backend.
        imei_unit_costs: units.map((u) => {
          if (u.unitCost === "") return null;
          const n = Number(u.unitCost);
          return n > 0 ? roundMoney(n) : null;
        }),
        imei_sale_prices: units.map((u) => {
          if (u.salePrice === "") return null;
          const n = Number(u.salePrice);
          return isFinite(n) && n >= 0 ? roundMoney(n) : null;
        }),
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
        unit_cost: cost > 0 ? roundMoney(cost) : null,
        selling_price: l.sellingPrice !== "" ? roundMoney(Number(l.sellingPrice) || 0) : null,
        warranty: l.warranty.trim() || null,
        imeis: [],
      });
    }

    if (errs.length > 0) {
      setError(errs[0]);
      return;
    }
    if (items.length === 0) {
      setError("Add at least one mobile phone or accessory before recording the purchase.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        supplier_id: supplierId ? Number(supplierId) : null,
        discount: roundMoney(discount),
        paid_amount: paidStr !== "" ? roundMoney(Number(paidStr) || 0) : null,
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
                      label="Default Unit Cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.unitCost}
                      placeholder="0.00"
                      disabled={saving}
                      onChange={(e) => setPhoneDefaultCost(l.key, e.target.value)}
                    />
                    <Input
                      label="Default Selling Price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.sellingPrice}
                      placeholder="0.00"
                      disabled={saving}
                      onChange={(e) => setPhoneDefaultSellingPrice(l.key, e.target.value)}
                    />
                    <div className="flex flex-col justify-end pb-1">
                      <div className="text-[12px] font-medium text-slate-500">Line Total</div>
                      <div className="text-[15px] font-bold text-slate-800">
                        Rs. {roundMoney(phoneLineTotal(l)).toLocaleString("en-PK")}
                      </div>
                    </div>
                  </div>
                  <p className="mb-2 mt-2 text-[11px] text-slate-500">
                    Default prices auto-copy into every unit; each unit can override them. Line
                    total = sum of the per-unit Unit Costs.
                  </p>
                  <div className="mt-3">
                    <div className="mb-1 text-[12px] font-medium text-slate-500">
                      Physical Phone Units{" "}
                      <span className="text-red-600">
                        (IMEI 1 required, exactly 15 digits — {Number(l.quantity) || 0})
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {l.imeis.map((imei, i) => (
                        <div key={i} className="rounded-md border border-slate-200 bg-white p-2">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Unit {i + 1}
                          </div>
                          <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="flex min-w-0 flex-col gap-1">
                              {unitFieldLabel("IMEI 1")}
                              <Input
                                placeholder="Enter IMEI 1"
                                maxLength={15}
                                value={imei}
                                disabled={saving}
                                mono
                                onChange={(e) => setPhoneImei(l.key, i, e.target.value.slice(0, 15))}
                              />
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              {unitFieldLabel("IMEI 2 (Optional)")}
                              <Input
                                placeholder="Enter IMEI 2"
                                maxLength={15}
                                value={l.imei2s[i] ?? ""}
                                disabled={saving}
                                mono
                                onChange={(e) => setPhoneImei2(l.key, i, e.target.value.slice(0, 15))}
                              />
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              {unitFieldLabel("Color (Optional)")}
                              <Input
                                placeholder="Color"
                                value={l.imeiColors[i] ?? ""}
                                disabled={saving}
                                onChange={(e) => setPhoneColor(l.key, i, e.target.value)}
                              />
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              {unitFieldLabel("PTA Status")}
                              <Select
                                name={`pta-${l.key}-${i}`}
                                options={PTA_STATUS_OPTIONS}
                                value={
                                  DEFAULT_PTA_STATUSES.has(l.imeiPtaStatuses[i] ?? "PTA Approved")
                                    ? (l.imeiPtaStatuses[i] ?? "PTA Approved")
                                    : CUSTOM_PTA_STATUS
                                }
                                disabled={saving}
                                onChange={(e) => setPhonePtaStatus(l.key, i, e.target.value)}
                              />
                              {!DEFAULT_PTA_STATUSES.has(l.imeiPtaStatuses[i] ?? "PTA Approved") && (
                                <div className="flex flex-col gap-1">
                                  {unitFieldLabel("Custom Status")}
                                  <Input
                                    placeholder="e.g. Factory Unlocked"
                                    value={
                                      l.imeiPtaStatuses[i] === CUSTOM_PTA_STATUS
                                        ? ""
                                        : (l.imeiPtaStatuses[i] ?? "")
                                    }
                                    disabled={saving}
                                    onChange={(e) => setPhonePtaStatus(l.key, i, e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              {unitFieldLabel("Battery Health % (Optional)")}
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                placeholder="e.g. 100"
                                suffix="%"
                                value={l.imeiBatteryHealths[i] ?? ""}
                                disabled={saving}
                                onChange={(e) => setPhoneBatteryHealth(l.key, i, e.target.value)}
                              />
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              {unitFieldLabel("Storage")}
                              <Input
                                list={`phone-unit-storage-suggestions-${l.key}`}
                                placeholder="e.g. 256GB"
                                value={l.imeiStorages[i] ?? ""}
                                disabled={saving}
                                onChange={(e) => setPhoneStorage(l.key, i, e.target.value)}
                              />
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              {unitFieldLabel("Unit Cost")}
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={l.unitCost || "0.00"}
                                value={l.imeiUnitCosts[i] ?? ""}
                                disabled={saving}
                                onChange={(e) => setPhoneUnitCost(l.key, i, e.target.value)}
                              />
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              {unitFieldLabel("Selling Price")}
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={l.sellingPrice || "0.00"}
                                value={l.imeiSalePrices[i] ?? ""}
                                disabled={saving}
                                onChange={(e) => setPhoneUnitSalePrice(l.key, i, e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <datalist id={`phone-unit-storage-suggestions-${l.key}`}>
                      <option value="64GB" />
                      <option value="128GB" />
                      <option value="256GB" />
                      <option value="512GB" />
                      <option value="1TB" />
                    </datalist>
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
                        Rs. {roundMoney((Number(l.quantity) || 0) * (Number(l.unitCost) || 0)).toLocaleString("en-PK")}
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
            Rs. {roundMoney(subtotal).toLocaleString("en-PK")}
          </span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[13px] font-medium text-slate-500">Discount</span>
          <span className="text-[14px] font-semibold text-slate-800">
            - Rs. {roundMoney(discount).toLocaleString("en-PK")}
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
