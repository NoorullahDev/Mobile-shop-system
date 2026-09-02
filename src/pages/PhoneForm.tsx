import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import { ManagePhoneOptionsModal } from "./ManagePhoneOptionsModal";
import { usePhoneOptionStore } from "../store/phoneOptions";
import type { CreatePhoneInput, Phone, ProductCategory, Supplier, PhoneOption } from "../types/inventory";

interface PhoneFormProps {
  onSubmit: (input: CreatePhoneInput) => Promise<void>;
  onCancel: () => void;
  initial?: Phone | null;
  suppliers: Supplier[];
  categories: ProductCategory[];
}

function mapOptions(options: PhoneOption[], placeholder: string) {
  return [
    { value: "", label: placeholder },
    ...options.map((o) => ({ value: o.value, label: o.value })),
  ];
}

function Section({
  index,
  title,
  description,
  children,
}: {
  index: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <div className="mb-4 flex flex-col gap-0.5">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#0F172A]">
          <span className="mr-2 text-blue-600">{index}</span>
          {title}
        </h3>
        {description && <p className="text-[12px] text-slate-500">{description}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

export function PhoneForm({ onSubmit, onCancel, initial, suppliers }: PhoneFormProps) {
  const { load: loadOptions, getOptionsByType } = usePhoneOptionStore();
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const brands = getOptionsByType("brand");
  const rams = getOptionsByType("ram");
  const storages = getOptionsByType("storage");
  const colors = getOptionsByType("color");
  const networkTypes = getOptionsByType("network_type");
  const conditions = getOptionsByType("condition");
  const conditionRatings = getOptionsByType("condition_rating");
  const bodyConditions = getOptionsByType("body_condition");
  const screenConditions = getOptionsByType("screen_condition");
  const batteryHealths = getOptionsByType("battery_health");
  const cameraConditions = getOptionsByType("camera_condition");
  const faceIds = getOptionsByType("face_id");
  const speakers = getOptionsByType("speaker");
  const chargers = getOptionsByType("charger");
  const boxes = getOptionsByType("box_condition");

  const [form, setForm] = useState<CreatePhoneInput>({
    brand: initial?.brand ?? "",
    model: initial?.model ?? "",
    condition: initial?.condition ?? "",
    variant: initial?.variant ?? "",
    color: initial?.color ?? "",
    ram: initial?.ram ?? "",
    storage: initial?.storage ?? "",
    processor: initial?.processor ?? "",
    chipset: initial?.chipset ?? "",
    network_type: initial?.network_type ?? "",
    battery_capacity: initial?.battery_capacity ?? "",
    imei: initial?.imei ?? "",
    imei2: initial?.imei2 ?? "",
    quantity: initial?.quantity ?? 0,
    low_stock_threshold: initial?.low_stock_threshold ?? 0,
    sku: initial?.sku ?? "",
    cost_price: initial?.cost_price ?? 0,
    sale_price: initial?.sale_price ?? 0,
    supplier_id: initial?.supplier_id ?? null,
    condition_rating: initial?.condition_rating ?? "",
    body_condition: initial?.body_condition ?? "",
    screen_condition: initial?.screen_condition ?? "",
    battery_health: initial?.battery_health ?? "",
    camera_condition: initial?.camera_condition ?? "",
    face_id: initial?.face_id ?? "",
    speaker: initial?.speaker ?? "",
    charger: initial?.charger ?? "",
    box_condition: initial?.box_condition ?? "",
    condition_notes: initial?.condition_notes ?? "",
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

  const showConditionDetails = !!form.condition && form.condition.trim() !== "New";

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
    const imei2 = (form.imei2 ?? "").trim();
    if (imei && imei.length < 8) {
      setImeiError("IMEI 1 must be at least 8 characters");
      return;
    }
    if (imei2 && imei2.length < 8) {
      setImeiError("IMEI 2 must be at least 8 characters");
      return;
    }
    if (imei && imei2 && imei === imei2) {
      setImeiError("IMEI 1 and IMEI 2 cannot be the same");
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
        condition: form.condition ? form.condition.trim() : "",
        variant: form.variant ? form.variant.trim() : "",
        color: form.color ? form.color.trim() : "",
        ram: form.ram ? form.ram.trim() : "",
        storage: form.storage ? form.storage.trim() : "",
        processor: form.processor ? form.processor.trim() : "",
        chipset: form.chipset ? form.chipset.trim() : "",
        network_type: form.network_type ? form.network_type.trim() : "",
        battery_capacity: form.battery_capacity ? form.battery_capacity.trim() : "",
        imei: imei || "",
        imei2: imei2 || "",
        quantity: Number(form.quantity) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        sku: form.sku ? form.sku.trim() : "",
        cost_price: Number(form.cost_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        condition_rating: form.condition_rating ? form.condition_rating.trim() : "",
        body_condition: form.body_condition ? form.body_condition.trim() : "",
        screen_condition: form.screen_condition ? form.screen_condition.trim() : "",
        battery_health: form.battery_health ? form.battery_health.trim() : "",
        camera_condition: form.camera_condition ? form.camera_condition.trim() : "",
        face_id: form.face_id ? form.face_id.trim() : "",
        speaker: form.speaker ? form.speaker.trim() : "",
        charger: form.charger ? form.charger.trim() : "",
        box_condition: form.box_condition ? form.box_condition.trim() : "",
        condition_notes: form.condition_notes ? form.condition_notes.trim() : "",
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <Alert message={error} />}

        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setOptionsModalOpen(true)}
            icon={<Settings className="h-3.5 w-3.5" />}
          >
            Manage Dropdown Options
          </Button>
        </div>

        <Section index="1" title="Basic Information">
          <Select
            name="brand"
            label="Brand"
            required
            placeholder="— Select brand —"
            options={mapOptions(brands, "— Select brand —")}
            value={form.brand}
            onChange={(e) => {
              set("brand", e.target.value);
              setBrandError(null);
            }}
            error={brandError ?? undefined}
            disabled={saving}
          />
          <Input
            name="model"
            label="Model Name"
            placeholder="e.g. Galaxy S24"
            required
            value={form.model}
            onChange={(e) => {
              set("model", e.target.value);
              setModelError(null);
            }}
            error={modelError ?? undefined}
            disabled={saving}
          />
          <Input
            name="variant"
            label="Variant"
            placeholder="e.g. Ultra, Pro Max"
            value={form.variant ?? ""}
            onChange={(e) => set("variant", e.target.value)}
            disabled={saving}
          />
          <Select
            name="color"
            label="Color"
            placeholder="— Select color —"
            options={mapOptions(colors, "— Select color —")}
            value={form.color ?? ""}
            onChange={(e) => set("color", e.target.value)}
            disabled={saving}
          />
          <Select
            name="condition"
            label="Condition"
            placeholder="— Select condition —"
            options={mapOptions(conditions, "— Select condition —")}
            value={form.condition ?? ""}
            onChange={(e) => set("condition", e.target.value)}
            disabled={saving}
          />
        </Section>

        <Section index="2" title="Specifications">
          <Select
            name="ram"
            label="RAM"
            placeholder="— Select RAM —"
            options={mapOptions(rams, "— Select RAM —")}
            value={form.ram ?? ""}
            onChange={(e) => set("ram", e.target.value)}
            disabled={saving}
          />
          <Select
            name="storage"
            label="Storage"
            placeholder="— Select storage —"
            options={mapOptions(storages, "— Select storage —")}
            value={form.storage ?? ""}
            onChange={(e) => set("storage", e.target.value)}
            disabled={saving}
          />
          <Input
            name="processor"
            label="Processor"
            placeholder="e.g. Octa-core"
            value={form.processor ?? ""}
            onChange={(e) => set("processor", e.target.value)}
            disabled={saving}
          />
          <Input
            name="chipset"
            label="Chipset"
            placeholder="e.g. Snapdragon 8 Gen 3"
            value={form.chipset ?? ""}
            onChange={(e) => set("chipset", e.target.value)}
            disabled={saving}
          />
          <Select
            name="network_type"
            label="Network Type"
            placeholder="— Select network —"
            options={mapOptions(networkTypes, "— Select network —")}
            value={form.network_type ?? ""}
            onChange={(e) => set("network_type", e.target.value)}
            disabled={saving}
          />
          <Input
            name="battery_capacity"
            label="Battery Capacity"
            placeholder="e.g. 5000 mAh"
            value={form.battery_capacity ?? ""}
            onChange={(e) => set("battery_capacity", e.target.value)}
            disabled={saving}
          />
        </Section>

        <Section
          index="3"
          title="Device Condition"
          description={
            showConditionDetails
              ? "Inspection details for this used / refurbished / open-box unit."
              : 'Not required for new devices — switch Condition above to "Used", "Refurbished" or "Open Box" to inspect the unit.'
          }
        >
          {showConditionDetails ? (
            <>
              <Select
                name="condition_rating"
                label="Overall Condition Rating"
                placeholder="— Select rating —"
                options={mapOptions(conditionRatings, "— Select rating —")}
                value={form.condition_rating ?? ""}
                onChange={(e) => set("condition_rating", e.target.value)}
                disabled={saving}
              />
              <Select
                name="body_condition"
                label="Body Condition"
                placeholder="— Select —"
                options={mapOptions(bodyConditions, "— Select —")}
                value={form.body_condition ?? ""}
                onChange={(e) => set("body_condition", e.target.value)}
                disabled={saving}
              />
              <Select
                name="screen_condition"
                label="Screen Condition"
                placeholder="— Select —"
                options={mapOptions(screenConditions, "— Select —")}
                value={form.screen_condition ?? ""}
                onChange={(e) => set("screen_condition", e.target.value)}
                disabled={saving}
              />
              <Select
                name="battery_health"
                label="Battery Health"
                placeholder="— Select % —"
                options={mapOptions(batteryHealths, "— Select % —")}
                value={form.battery_health ?? ""}
                onChange={(e) => set("battery_health", e.target.value)}
                disabled={saving}
              />
              <Select
                name="camera_condition"
                label="Camera Condition"
                placeholder="— Select —"
                options={mapOptions(cameraConditions, "— Select —")}
                value={form.camera_condition ?? ""}
                onChange={(e) => set("camera_condition", e.target.value)}
                disabled={saving}
              />
              <Select
                name="face_id"
                label="Face ID / Fingerprint"
                placeholder="— Select —"
                options={mapOptions(faceIds, "— Select —")}
                value={form.face_id ?? ""}
                onChange={(e) => set("face_id", e.target.value)}
                disabled={saving}
              />
              <Select
                name="speaker"
                label="Speaker"
                placeholder="— Select —"
                options={mapOptions(speakers, "— Select —")}
                value={form.speaker ?? ""}
                onChange={(e) => set("speaker", e.target.value)}
                disabled={saving}
              />
              <Select
                name="charger"
                label="Charger"
                placeholder="— Select —"
                options={mapOptions(chargers, "— Select —")}
                value={form.charger ?? ""}
                onChange={(e) => set("charger", e.target.value)}
                disabled={saving}
              />
              <Select
                name="box_condition"
                label="Box"
                placeholder="— Select —"
                options={mapOptions(boxes, "— Select —")}
                value={form.box_condition ?? ""}
                onChange={(e) => set("box_condition", e.target.value)}
                disabled={saving}
              />
              <div className="flex flex-col gap-1 md:col-span-2">
                <label
                  htmlFor="condition_notes"
                  style={{ fontSize: "13px", fontWeight: 500, color: "#334155" }}
                >
                  Condition Notes
                </label>
                <textarea
                  id="condition_notes"
                  name="condition_notes"
                  rows={3}
                  placeholder="e.g. Charger cable slightly worn, small mark on the frame."
                  value={form.condition_notes ?? ""}
                  onChange={(e) => set("condition_notes", e.target.value)}
                  disabled={saving}
                  className="w-full rounded border bg-white px-3 py-2 text-[14px] outline-none transition-all placeholder:text-[#94A3B8]"
                  style={{ borderColor: "#CBD5E1", color: "#0F172A", resize: "vertical" }}
                />
              </div>
            </>
          ) : (
            <p className="text-[13px] text-slate-500 italic md:col-span-2">
              No inspection needed — this device is catalogued as new.
            </p>
          )}
        </Section>

        <Section index="4" title="Inventory & IMEI">
          <Input
            name="sku"
            label="SKU / Product Code"
            placeholder="Optional"
            value={form.sku ?? ""}
            onChange={(e) => set("sku", e.target.value)}
            disabled={saving}
          />
          <Input
            name="imei"
            label="IMEI 1"
            placeholder="15-digit IMEI"
            hint="Optional — used for warranty & tracking"
            value={form.imei ?? ""}
            onChange={(e) => {
              set("imei", e.target.value);
              setImeiError(null);
            }}
            disabled={saving}
            error={imeiError ?? undefined}
          />
          <Input
            name="imei2"
            label="IMEI 2 (Dual SIM)"
            placeholder="15-digit IMEI"
            hint="Optional"
            value={form.imei2 ?? ""}
            onChange={(e) => {
              set("imei2", e.target.value);
              setImeiError(null);
            }}
            disabled={saving}
          />
          <Input
            name="quantity"
            label="Quantity / Stock"
            type="number"
            min="0"
            required
            value={form.quantity}
            onChange={(e) => set("quantity", parseInt(e.target.value) || 0)}
            disabled={saving || initial != null}
            hint={initial ? "Use the Restock button to add more units" : undefined}
          />
          <Input
            name="low_stock_threshold"
            label="Low Stock Alert At"
            type="number"
            min="0"
            required
            value={form.low_stock_threshold}
            onChange={(e) => set("low_stock_threshold", parseInt(e.target.value) || 0)}
            disabled={saving}
          />
        </Section>

        <Section index="5" title="Pricing">
          <Input
            name="cost_price"
            label="Purchase Price"
            type="number"
            min="0"
            required
            prefix="$"
            value={form.cost_price}
            onChange={(e) => set("cost_price", parseFloat(e.target.value) || 0)}
            disabled={saving}
          />
          <Input
            name="sale_price"
            label="Sale Price"
            type="number"
            min="0"
            required
            prefix="$"
            value={form.sale_price}
            onChange={(e) => set("sale_price", parseFloat(e.target.value) || 0)}
            disabled={saving}
          />
          <Select
            name="supplier_id"
            label="Supplier"
            placeholder="— No supplier —"
            options={supplierOptions}
            value={form.supplier_id ? String(form.supplier_id) : ""}
            onChange={(e) => set("supplier_id", e.target.value ? Number(e.target.value) : null)}
            disabled={saving}
          />
        </Section>

        <div className="mt-4 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {initial ? "Save Changes" : "Add Mobile Phone"}
          </Button>
        </div>
      </form>

      <ManagePhoneOptionsModal open={optionsModalOpen} onClose={() => setOptionsModalOpen(false)} />
    </>
  );
}