import { useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import { methodLabels } from "../lib/format";
import type { Member } from "../types/member";
import type { CreatePaymentInput, Payment } from "../types/payment";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "../types/payment";

interface PaymentFormProps {
  onSubmit: (input: CreatePaymentInput) => Promise<void>;
  onCancel: () => void;
  members: Member[];
  initialMemberId?: number | null;
  initialPayment?: Payment | null;
}

export function PaymentForm({ onSubmit, onCancel, members, initialMemberId, initialPayment }: PaymentFormProps) {
  const [form, setForm] = useState<CreatePaymentInput>({
    member_id: initialPayment?.member_id ?? initialMemberId ?? null,
    amount: initialPayment?.amount ?? 0,
    payment_method: initialPayment?.payment_method ?? "cash",
    payment_type: initialPayment?.payment_type ?? "",
    status: initialPayment?.status ?? "completed",
    reference: initialPayment?.reference ?? "",
    notes: initialPayment?.notes ?? "",
    payment_date: initialPayment?.payment_date?.slice(0, 10) ?? "",
  });
  const [amountStr, setAmountStr] = useState(initialPayment ? String(initialPayment.amount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const memberOptions = [
    { value: "", label: "— None —" },
    ...members.map((m) => ({ value: String(m.id), label: m.name })),
  ];

  const methodOptions = PAYMENT_METHODS.map((m) => ({ value: m, label: methodLabels[m] ?? m }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(amountStr);
    if (!amount || amount <= 0) {
      setAmountError("Amount must be greater than zero");
      return;
    }
    setAmountError(null);
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        member_id: form.member_id ? Number(form.member_id) : null,
        amount,
        payment_method: form.payment_method,
        payment_type: form.payment_type ? form.payment_type.trim() : "",
        status: form.status ?? "completed",
        reference: form.reference ? form.reference.trim() : "",
        notes: form.notes ? form.notes.trim() : "",
        payment_date: form.payment_date || null,
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
      <Select
        name="member_id"
        label="Member"
        options={memberOptions}
        value={form.member_id ? String(form.member_id) : ""}
        onChange={(e) =>
          setForm((f) => ({ ...f, member_id: e.target.value ? Number(e.target.value) : null }))
        }
        disabled={saving}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          name="amount"
          label="Amount"
          type="number"
          step="0.01"
          min="0"
          required
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          error={amountError ?? undefined}
          disabled={saving}
        />
        <Select
          name="payment_method"
          label="Payment Method"
          options={methodOptions}
          value={form.payment_method}
          onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
          disabled={saving}
        />
      </div>
      <Select
        name="status"
        label="Status"
        options={PAYMENT_STATUSES.map((status) => ({ value: status, label: status }))}
        value={form.status ?? "completed"}
        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
        disabled={saving}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          name="payment_type"
          label="Payment Type"
          placeholder="e.g. membership, advance"
          value={form.payment_type ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, payment_type: e.target.value }))}
          disabled={saving}
        />
        <Input
          name="payment_date"
          label="Payment Date"
          type="date"
          value={form.payment_date ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
          disabled={saving}
        />
      </div>
      <Input
        name="reference"
        label="Reference"
        value={form.reference ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
        disabled={saving}
      />
      <Input
        name="notes"
        label="Notes"
        value={form.notes ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        disabled={saving}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {initialPayment ? "Save Changes" : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}
