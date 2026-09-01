import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import type { Category, CreateExpenseInput } from "../types/expense";

interface ExpenseFormProps {
  onSubmit: (input: CreateExpenseInput) => Promise<void>;
  onCancel: () => void;
  categories: Category[];
}

export function ExpenseForm({ onSubmit, onCancel, categories }: ExpenseFormProps) {
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name })),
    [categories],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      setError("Please select a category.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Please enter an amount greater than zero.");
      return;
    }
    if (!expenseDate) {
      setError("Please choose an expense date.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        category_id: Number(categoryId),
        amount: Number(amount),
        expense_date: expenseDate,
        description: description ? description.trim() : null,
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
        name="category_id"
        label="Category *"
        options={categoryOptions}
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        disabled={saving}
      />
      <Input
        name="amount"
        label="Amount *"
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={saving}
      />
      <Input
        name="expense_date"
        label="Expense Date *"
        type="date"
        value={expenseDate}
        onChange={(e) => setExpenseDate(e.target.value)}
        disabled={saving}
      />
      <Input
        name="description"
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={saving}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save Expense
        </Button>
      </div>
    </form>
  );
}
