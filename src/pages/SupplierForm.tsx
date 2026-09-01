import { useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert } from "../components/Alert";
import type { CreateSupplierInput, Supplier } from "../types/inventory";

interface SupplierFormProps {
  onSubmit: (input: CreateSupplierInput) => Promise<void>;
  onCancel: () => void;
  initial?: Supplier | null;
}

export function SupplierForm({ onSubmit, onCancel, initial }: SupplierFormProps) {
  const [form, setForm] = useState<CreateSupplierInput>({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof CreateSupplierInput, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError("Name is required");
      return;
    }
    setNameError(null);
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: form.name.trim(),
        phone: form.phone ? form.phone.trim() : "",
        email: form.email ? form.email.trim() : "",
        address: form.address ? form.address.trim() : "",
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
      <Input
        name="name"
        label="Supplier Name"
        required
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
        error={nameError ?? undefined}
        disabled={saving}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          name="phone"
          label="Phone"
          value={form.phone ?? ""}
          onChange={(e) => set("phone", e.target.value)}
          disabled={saving}
        />
        <Input
          name="email"
          label="Email"
          type="email"
          value={form.email ?? ""}
          onChange={(e) => set("email", e.target.value)}
          disabled={saving}
        />
      </div>
      <Input
        name="address"
        label="Address"
        value={form.address ?? ""}
        onChange={(e) => set("address", e.target.value)}
        disabled={saving}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {initial ? "Save Changes" : "Add Supplier"}
        </Button>
      </div>
    </form>
  );
}
