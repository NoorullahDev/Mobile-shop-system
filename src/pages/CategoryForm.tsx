import { useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Alert } from "../components/Alert";
import type { CreateCategoryInput } from "../types/expense";

interface CategoryFormProps {
  onSubmit: (input: CreateCategoryInput) => Promise<void>;
  onCancel: () => void;
  initial?: { id: number; name: string } | null;
}

export function CategoryForm({ onSubmit, onCancel, initial }: CategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), type: "expense" });
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
        onChange={(e) => setName(e.target.value)}
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
