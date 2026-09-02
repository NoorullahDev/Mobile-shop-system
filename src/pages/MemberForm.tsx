import { useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert } from "../components/Alert";
import type { CreateMemberInput, Member } from "../types/member";

interface MemberFormProps {
  onSubmit: (input: CreateMemberInput) => Promise<void>;
  onCancel: () => void;
  initial?: Member | null;
}

export function MemberForm({ onSubmit, onCancel, initial }: MemberFormProps) {
  const [form, setForm] = useState<CreateMemberInput>({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    cnic: initial?.cnic ?? "",
    address: initial?.address ?? "",
    notes: initial?.notes ?? "",
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof CreateMemberInput, value: string) =>
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
        ...form,
        name: form.name.trim(),
        phone: form.phone ? form.phone.trim() : "",
        cnic: form.cnic ? form.cnic.trim() : "",
        address: form.address ? form.address.trim() : "",
        notes: form.notes ? form.notes.trim() : "",
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
      <div className="grid grid-cols-2 gap-4">
        <Input
          name="name"
          label="Full Name"
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          error={nameError ?? undefined}
          disabled={saving}
        />
        <Input
          name="phone"
          label="Contact Number"
          value={form.phone ?? ""}
          onChange={(e) => set("phone", e.target.value)}
          disabled={saving}
        />
        <Input
          name="cnic"
          label="CNIC"
          value={form.cnic ?? ""}
          onChange={(e) => set("cnic", e.target.value)}
          disabled={saving}
        />
        <Input
          name="address"
          label="Address"
          value={form.address ?? ""}
          onChange={(e) => set("address", e.target.value)}
          disabled={saving}
        />
      </div>
      <Input
        name="notes"
        label="Notes"
        value={form.notes ?? ""}
        onChange={(e) => set("notes", e.target.value)}
        disabled={saving}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save
        </Button>
      </div>
    </form>
  );
}
