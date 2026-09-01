import { useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert } from "../components/Alert";

interface RestockFormProps {
  item: { id: number; title: string; quantity: number };
  onSubmit: (quantity: number, imeis: string[]) => Promise<void>;
  onCancel: () => void;
  hasImeiTracking?: boolean;
}

export function RestockForm({ item, onSubmit, onCancel, hasImeiTracking = true }: RestockFormProps) {
  const [quantity, setQuantity] = useState(0);
  const [imeisText, setImeisText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedImeis = imeisText
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity) || 0;
    if (qty <= 0 && parsedImeis.length === 0) {
      setError("Enter a quantity greater than zero or add IMEI numbers.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(qty, parsedImeis);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-[var(--color-neutral-muted)]">
        Restock <span className="font-medium text-[var(--color-neutral-text)]">{item.title}</span>.
        Current quantity: <span className="font-medium">{item.quantity}</span>
      </p>
      {error && <Alert message={error} />}
      <Input
        name="quantity"
        label="Quantity to Add"
        type="number"
        min="0"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        disabled={saving}
      />
      {hasImeiTracking && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="imeis" className="text-sm font-medium text-[var(--color-neutral-text)]">
            IMEI Numbers (one per line)
          </label>
          <textarea
            id="imeis"
            value={imeisText}
            onChange={(e) => setImeisText(e.target.value)}
            disabled={saving}
            rows={5}
            placeholder={"Enter each IMEI on its own line"}
            className="rounded-md border border-[var(--color-neutral-border)] px-3 py-2 text-sm text-[var(--color-neutral-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          {parsedImeis.length > 0 && (
            <span className="text-xs text-[var(--color-neutral-muted)]">
              {parsedImeis.length} IMEI{parsedImeis.length > 1 ? "s" : ""} will be registered.
            </span>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Restock
        </Button>
      </div>
    </form>
  );
}
