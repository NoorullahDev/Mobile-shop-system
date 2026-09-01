import { useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import { ACCESSORY_TYPES } from "../types/inventory";
import type { Accessory, CreateAccessoryInput, Supplier } from "../types/inventory";

interface AccessoryFormProps {
  onSubmit: (input: CreateAccessoryInput) => Promise<void>;
  onCancel: () => void;
  initial?: Accessory | null;
  suppliers: Supplier[];
}

export function AccessoryForm({ onSubmit, onCancel, initial, suppliers }: AccessoryFormProps) {
  const [form, setForm] = useState<CreateAccessoryInput>({
    accessory_type: initial?.accessory_type ?? "",
    brand: initial?.brand ?? "",
    product_name: initial?.product_name ?? "",
    compatible_models: initial?.compatible_models ?? "",
    color: initial?.color ?? "",
    cost_price: initial?.cost_price ?? 0,
    sale_price: initial?.sale_price ?? 0,
    quantity: initial?.quantity ?? 0,
    low_stock_threshold: initial?.low_stock_threshold ?? 0,
    supplier_id: initial?.supplier_id ?? null,
  });
  const [brandError, setBrandError] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof CreateAccessoryInput, value: string | number | null) =>
    setForm((f) => ({ ...f, [key]: value }));

  const supplierOptions = [
    { value: "", label: "— No supplier —" },
    ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
  ];
  const typeOptions = [
    { value: "", label: "— Select type —" },
    ...ACCESSORY_TYPES.map((t) => ({ value: t, label: t })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.accessory_type?.trim()) {
      setTypeError("Category is required");
      return;
    }
    if (!form.brand.trim()) {
      setBrandError("Brand is required");
      return;
    }
    setBrandError(null);
    setTypeError(null);
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        accessory_type: form.accessory_type.trim(),
        brand: form.brand.trim(),
        product_name: form.product_name ? form.product_name.trim() : "",
        compatible_models: form.compatible_models ? form.compatible_models.trim() : "",
        color: form.color ? form.color.trim() : "",
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
          name="accessory_type"
          label="Category"
          required
          placeholder="— Select type —"
          options={typeOptions}
          value={form.accessory_type ?? ""}
          onChange={(e) => set("accessory_type", e.target.value)}
          error={typeError ?? undefined}
          disabled={saving}
        />
        <Input
          name="brand"
          label="Brand"
          required
          value={form.brand}
          onChange={(e) => set("brand", e.target.value)}
          error={brandError ?? undefined}
          disabled={saving}
        />
        <Input
          name="product_name"
          label="Product Name"
          required
          value={form.product_name ?? ""}
          onChange={(e) => set("product_name", e.target.value)}
          disabled={saving}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Input
          name="color"
          label="Color"
          value={form.color ?? ""}
          onChange={(e) => set("color", e.target.value)}
          disabled={saving}
        />
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          name="low_stock_threshold"
          label="Low Stock Alert At"
          type="number"
          min="0"
          value={form.low_stock_threshold}
          onChange={(e) => set("low_stock_threshold", e.target.value)}
          disabled={saving}
        />
        <Input
          name="compatible_models"
          label="Compatible Models"
          hint="Optional"
          value={form.compatible_models ?? ""}
          onChange={(e) => set("compatible_models", e.target.value)}
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
          {initial ? "Save Changes" : "Add Accessory"}
        </Button>
      </div>
    </form>
  );
}
