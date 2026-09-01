import { useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import { NETWORK_TYPES } from "../types/inventory";
import type { CreatePhoneInput, Phone, Supplier } from "../types/inventory";

interface PhoneFormProps {
  onSubmit: (input: CreatePhoneInput) => Promise<void>;
  onCancel: () => void;
  initial?: Phone | null;
  suppliers: Supplier[];
}

const BRAND_PRESETS = ["Samsung", "Apple", "Xiaomi", "Oppo", "Vivo", "Realme", "Infinix", "Techno", "Nokia", "Other"];

const storageOptions = [
  { value: "", label: "— Select storage —" },
  ...["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"].map((s) => ({ value: s, label: s })),
];

const ramOptions = [
  { value: "", label: "— Select RAM —" },
  ...["3GB", "4GB", "6GB", "8GB", "12GB", "16GB"].map((r) => ({ value: r, label: r })),
];

export function PhoneForm({ onSubmit, onCancel, initial, suppliers }: PhoneFormProps) {
  const [form, setForm] = useState<CreatePhoneInput>({
    brand: initial?.brand ?? "",
    model: initial?.model ?? "",
    ram: initial?.ram ?? "",
    storage: initial?.storage ?? "",
    color: initial?.color ?? "",
    processor: initial?.processor ?? "",
    chipset: initial?.chipset ?? "",
    network_type: initial?.network_type ?? "",
    battery_capacity: initial?.battery_capacity ?? "",
    imei: initial?.imei ?? "",
    cost_price: initial?.cost_price ?? 0,
    sale_price: initial?.sale_price ?? 0,
    quantity: initial?.quantity ?? 0,
    low_stock_threshold: initial?.low_stock_threshold ?? 0,
    supplier_id: initial?.supplier_id ?? null,
  });
  const [brandError, setBrandError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [imeiError, setImeiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof CreatePhoneInput, value: string | number | null) =>
    setForm((f) => ({ ...f, [key]: value }));

  const supplierOptions = [
    { value: "", label: "— No supplier —" },
    ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
  ];
  const brandOptions = [
    { value: "", label: "— Select brand —" },
    ...BRAND_PRESETS.map((b) => ({ value: b, label: b })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand.trim()) {
      setBrandError("Brand is required");
      return;
    }
    if (!form.model.trim()) {
      setModelError("Model is required");
      return;
    }
    const imei = (form.imei ?? "").trim();
    if (imei && imei.length < 8) {
      setImeiError("IMEI must be at least 8 characters");
      return;
    }
    setBrandError(null);
    setModelError(null);
    setImeiError(null);
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        brand: form.brand.trim(),
        model: form.model.trim(),
        ram: form.ram ? form.ram.trim() : "",
        storage: form.storage ? form.storage.trim() : "",
        color: form.color ? form.color.trim() : "",
        processor: form.processor ? form.processor.trim() : "",
        chipset: form.chipset ? form.chipset.trim() : "",
        network_type: form.network_type ? form.network_type.trim() : "",
        battery_capacity: form.battery_capacity ? form.battery_capacity.trim() : "",
        imei: imei || "",
        cost_price: Number(form.cost_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        quantity: Number(form.quantity) || 0,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <Alert message={error} />}

      <div className="grid grid-cols-3 gap-4">
        <Select
          name="brand"
          label="Brand"
          required
          placeholder="— Select brand —"
          options={brandOptions}
          value={form.brand}
          onChange={(e) => set("brand", e.target.value)}
          error={brandError ?? undefined}
          disabled={saving}
        />
        <Input
          name="model"
          label="Model Name"
          required
          value={form.model}
          onChange={(e) => set("model", e.target.value)}
          error={modelError ?? undefined}
          disabled={saving}
        />
        <Select
          name="ram"
          label="RAM"
          options={ramOptions}
          value={form.ram ?? ""}
          onChange={(e) => set("ram", e.target.value)}
          disabled={saving}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Select
          name="storage"
          label="Storage"
          options={storageOptions}
          value={form.storage ?? ""}
          onChange={(e) => set("storage", e.target.value)}
          disabled={saving}
        />
        <Input
          name="color"
          label="Color"
          value={form.color ?? ""}
          onChange={(e) => set("color", e.target.value)}
          disabled={saving}
        />
        <Input
          name="chipset"
          label="Processor / Chipset"
          placeholder="e.g. Snapdragon 8 Gen 3"
          value={form.chipset ?? ""}
          onChange={(e) => set("chipset", e.target.value)}
          disabled={saving}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Select
          name="network_type"
          label="Network Type"
          placeholder="— Select network —"
          options={NETWORK_TYPES.map((n) => ({ value: n, label: n }))}
          value={form.network_type ?? ""}
          onChange={(e) => set("network_type", e.target.value)}
          disabled={saving}
        />
        <Input
          name="battery_capacity"
          label="Battery Capacity"
          placeholder="e.g. 5000mAh"
          value={form.battery_capacity ?? ""}
          onChange={(e) => set("battery_capacity", e.target.value)}
          disabled={saving}
        />
        <Input
          name="imei"
          label="IMEI Number"
          hint={form.imei ? "Unique per phone" : "Optional, but recommended"}
          value={form.imei ?? ""}
          onChange={(e) => set("imei", e.target.value)}
          error={imeiError ?? undefined}
          disabled={saving}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Input
          name="cost_price"
          label="Purchase Price"
          type="number"
          step="0.01"
          min="0"
          value={form.cost_price}
          onChange={(e) => set("cost_price", e.target.value)}
          disabled={saving}
        />
        <Input
          name="sale_price"
          label="Sale Price"
          type="number"
          step="0.01"
          min="0"
          value={form.sale_price}
          onChange={(e) => set("sale_price", e.target.value)}
          disabled={saving}
        />
        <Input
          name="quantity"
          label="Quantity / Stock"
          type="number"
          min="0"
          value={form.quantity}
          onChange={(e) => set("quantity", e.target.value)}
          disabled={saving}
        />
        <Input
          name="low_stock_threshold"
          label="Low Stock Alert At"
          type="number"
          min="0"
          value={form.low_stock_threshold}
          onChange={(e) => set("low_stock_threshold", e.target.value)}
          disabled={saving}
        />
      </div>

      <Select
        name="supplier_id"
        label="Supplier"
        options={supplierOptions}
        value={form.supplier_id ? String(form.supplier_id) : ""}
        onChange={(e) => set("supplier_id", e.target.value)}
        disabled={saving}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {initial ? "Save Changes" : "Add Mobile Phone"}
        </Button>
      </div>
    </form>
  );
}
