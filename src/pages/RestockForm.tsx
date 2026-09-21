import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert } from "../components/Alert";

interface RestockFormProps {
  item: { id: number; title: string; quantity: number };
  onSubmit: (quantity: number, imeis: string[], imei_colors: string[]) => Promise<void>;
  onCancel: () => void;
  hasImeiTracking?: boolean;
}

export function RestockForm({ item, onSubmit, onCancel, hasImeiTracking = true }: RestockFormProps) {
  const [quantity, setQuantity] = useState(0);
  const [imeisText, setImeisText] = useState("");
  const [colorsText, setColorsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // IMEIs and colours are kept positionally aligned so a blank IMEI line does
  // not shift which colour belongs to which unit.
  const parsedPairs = useMemo(() => {
    const imeiLines = imeisText.split(/\r?\n|,/).map((s) => s.trim());
    const colorLines = colorsText.split(/\r?\n|,/).map((s) => s.trim());
    const pairs: { imei: string; color: string }[] = [];
    imeiLines.forEach((imei, i) => {
      if (imei.length === 0) return;
      pairs.push({ imei, color: colorLines[i] ?? "" });
    });
    return pairs;
  }, [imeisText, colorsText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity) || 0;
    if (qty <= 0 && parsedPairs.length === 0) {
      setError("Enter a quantity greater than zero or add IMEI numbers.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(
        qty,
        parsedPairs.map((p) => p.imei),
        parsedPairs.map((p) => p.color),
      );
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
        <div className="flex flex-col gap-3">
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
            {parsedPairs.length > 0 && (
              <span className="text-xs text-[var(--color-neutral-muted)]">
                {parsedPairs.length} IMEI{parsedPairs.length > 1 ? "s" : ""} will be registered.
              </span>
            )}
          </div>
          {parsedPairs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="colors" className="text-sm font-medium text-[var(--color-neutral-text)]">
                Colour (optional — one per line, matching IMEI order)
              </label>
              <textarea
                id="colors"
                value={colorsText}
                onChange={(e) => setColorsText(e.target.value)}
                disabled={saving}
                rows={Math.min(5, parsedPairs.length)}
                placeholder={"e.g.\nGreen\nBlue\nNatural Titanium"}
                className="rounded-md border border-[var(--color-neutral-border)] px-3 py-2 text-sm text-[var(--color-neutral-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
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
