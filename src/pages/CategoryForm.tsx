import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert } from "../components/Alert";
import type { CreateCategoryInput } from "../types/expense";

interface CategoryFormProps {
  onSubmit: (input: CreateCategoryInput) => Promise<void>;
  onCancel: () => void;
  initial?: { id: number; name: string } | null;
  categoryType?: string | null;
}

export function CategoryForm({ onSubmit, onCancel, initial, categoryType = "expense" }: CategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const synced = useRef(false);

  // Keep the field fresh when switching between Add and Edit targets without
  // needing a remount (defends against stale/empty input state).
  useEffect(() => {
    if (!synced.current) {
      synced.current = true;
      return;
    }
    setName(initial?.name ?? "");
    setError(null);
  }, [initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        ...(categoryType ? { type: categoryType } : {}),
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
        label="Category Name *"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError(null);
        }}
        disabled={saving}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {initial ? "Save Category" : "Add Category"}
        </Button>
      </div>
    </form>
  );
}
