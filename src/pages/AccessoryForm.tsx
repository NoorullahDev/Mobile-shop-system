import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import { ProductImageInput } from "../components/ProductImageInput";
import { useAccessoryOptionStore } from "../store/accessoryOptions";
import type {
  Accessory,
  CreateAccessoryInput,
  ProductCategory,
  Supplier,
} from "../types/inventory";

interface AccessoryFormProps {
  onSubmit: (input: CreateAccessoryInput) => Promise<void>;
  onCancel: () => void;
  initial?: Accessory | null;
  suppliers: Supplier[];
  categories: ProductCategory[];
}

function toOptions(items: { value: string }[]): { value: string; label: string }[] {
  return items.map((i) => ({ value: i.value, label: i.value }));
}

export function AccessoryForm({ onSubmit, onCancel, initial, suppliers }: AccessoryFormProps) {
  const { load: loadOptions, getOptionsByType } = useAccessoryOptionStore();

  const [form, setForm] = useState<CreateAccessoryInput>({
    accessory_type: initial?.accessory_type ?? "",
    brand: initial?.brand ?? "",
    product_name: initial?.product_name ?? "",
    compatible_models: initial?.compatible_models ?? "",
    color: initial?.color ?? "",
    condition: initial?.condition ?? "",
    connector_type: initial?.connector_type ?? "",
    warranty: initial?.warranty ?? "",
    features: initial?.features ?? "",
    description: initial?.description ?? "",
    sku: initial?.sku ?? "",
    serial_number: initial?.serial_number ?? "",
    image_paths: initial?.image_paths ?? [],
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

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const accessoryCategories = getOptionsByType("accessory_category");
  const accessoryBrands = getOptionsByType("accessory_brand");
  const colors = getOptionsByType("color");
  const connectorTypes = getOptionsByType("connector_type");
  const warranties = getOptionsByType("warranty");
  const conditions = getOptionsByType("condition");

  const set = (key: keyof CreateAccessoryInput, value: string | number | null) =>
    setForm((f) => ({ ...f, [key]: value }));

  const supplierOptions = [
    { value: "", label: "— No supplier —" },
    ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
  ];

  const typeOptions = [
    { value: "", label: "— Select category —" },
    ...toOptions(accessoryCategories),
  ];
  const brandOptions = [
    { value: "", label: "— Select brand —" },
    ...toOptions(accessoryBrands),
  ];
  const colorOptions = [
    { value: "", label: "— No color —" },
    ...toOptions(colors),
  ];
  const connectorOptions = [
    { value: "", label: "— None —" },
    ...toOptions(connectorTypes),
  ];
  const warrantyOptions = [
    { value: "", label: "— No warranty —" },
    ...toOptions(warranties),
  ];
  const conditionOptions = [
    { value: "", label: "— Select condition —" },
    ...toOptions(conditions),
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
        condition: form.condition ? form.condition.trim() : "",
        connector_type: form.connector_type ? form.connector_type.trim() : "",
        warranty: form.warranty ? form.warranty.trim() : "",
        features: form.features ? form.features.trim() : "",
        description: form.description ? form.description.trim() : "",
        sku: form.sku ? form.sku.trim() : "",
        serial_number: form.serial_number?.trim() || "",
        image_paths: form.image_paths ?? [],
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && <Alert message={error} />}

      {/* Section: Basic Information */}
      <section className="flex flex-col gap-1">
        <h3 className="text-[15px] font-semibold" style={{ color: "#0F172A" }}>
          Basic Information
        </h3>
        <p className="text-[12px]" style={{ color: "#94A3B8" }}>
          Identify the accessory category, brand, and product.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            name="accessory_type"
            label="Category"
            required
            placeholder="— Select category —"
            options={typeOptions}
            value={form.accessory_type ?? ""}
            onChange={(e) => set("accessory_type", e.target.value)}
            error={typeError ?? undefined}
            disabled={saving}
          />
          <Select
            name="brand"
            label="Brand"
            required
            placeholder="— Select brand —"
            options={brandOptions}
            value={form.brand ?? ""}
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
          <Input
            name="compatible_models"
            label="Model / Compatibility"
            hint="e.g. Samsung Galaxy S24, iPhone 15"
            value={form.compatible_models ?? ""}
            onChange={(e) => set("compatible_models", e.target.value)}
            disabled={saving}
          />
        </div>
      </section>

      {/* Section: Specifications */}
      <section className="flex flex-col gap-1">
        <h3 className="text-[15px] font-semibold" style={{ color: "#0F172A" }}>
          Specifications
        </h3>
        <p className="text-[12px]" style={{ color: "#94A3B8" }}>
          Colour, condition, connector, and warranty details.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            name="color"
            label="Color"
            options={colorOptions}
            value={form.color ?? ""}
            onChange={(e) => set("color", e.target.value)}
            disabled={saving}
          />
          <Select
            name="condition"
            label="Condition"
            options={conditionOptions}
            value={form.condition ?? ""}
            onChange={(e) => set("condition", e.target.value)}
            disabled={saving}
          />
          <Select
            name="connector_type"
            label="Connector Type"
            options={connectorOptions}
            value={form.connector_type ?? ""}
            onChange={(e) => set("connector_type", e.target.value)}
            disabled={saving}
          />
          <Select
            name="warranty"
            label="Warranty"
            options={warrantyOptions}
            value={form.warranty ?? ""}
            onChange={(e) => set("warranty", e.target.value)}
            disabled={saving}
          />
          <Input
            name="features"
            label="Features"
            hint="Comma-separated, e.g. Fast Charging, Braided Cable"
            value={form.features ?? ""}
            onChange={(e) => set("features", e.target.value)}
            disabled={saving}
          />
          <Input
            name="sku"
            label="SKU"
            hint="Optional internal code"
            value={form.sku ?? ""}
            onChange={(e) => set("sku", e.target.value)}
            disabled={saving}
          />
          <Input name="serial_number" label="Serial Number" hint="Optional for individually serialized accessories" value={form.serial_number ?? ""} onChange={(e)=>set("serial_number",e.target.value)} disabled={saving}/>
        </div>
        <div className="mt-4">
          <Input
            name="description"
            label="Description"
            hint="Optional"
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            disabled={saving}
          />
        </div>
      </section>

      <ProductImageInput value={form.image_paths ?? []} onChange={(paths)=>setForm(f=>({...f,image_paths:paths}))} disabled={saving}/>

      {/* Section: Inventory & Stock */}
      <section className="flex flex-col gap-1">
        <h3 className="text-[15px] font-semibold" style={{ color: "#0F172A" }}>
          Inventory &amp; Stock
        </h3>
        <p className="text-[12px]" style={{ color: "#94A3B8" }}>
          Track quantity and low-stock alerts.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
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
      </section>

      {/* Section: Pricing & Supplier */}
      <section className="flex flex-col gap-1">
        <h3 className="text-[15px] font-semibold" style={{ color: "#0F172A" }}>
          Pricing &amp; Supplier
        </h3>
        <p className="text-[12px]" style={{ color: "#94A3B8" }}>
          Cost and sale prices, plus the supplier.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            name="cost_price"
            label="Purchase Price"
            prefix="Rs"
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
            prefix="Rs"
            type="number"
            step="0.01"
            min="0"
            value={form.sale_price}
            onChange={(e) => set("sale_price", e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="mt-4">
          <Select
            name="supplier_id"
            label="Supplier"
            options={supplierOptions}
            value={form.supplier_id ? String(form.supplier_id) : ""}
            onChange={(e) => set("supplier_id", e.target.value)}
            disabled={saving}
          />
        </div>
      </section>

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
