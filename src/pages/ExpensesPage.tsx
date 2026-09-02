import { useEffect, useState } from "react";
import { Plus, Receipt, Tags, Trash2, Pencil, TrendingDown } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Button";
import { ExpenseForm } from "./ExpenseForm";
import { CategoryForm } from "./CategoryForm";
import { useExpenseStore } from "../store/expenses";
import { useCategoryStore } from "../store/categories";
import { useSessionStore } from "../store/session";
import type { Expense } from "../types/expense";

function formatMoney(n: number) {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

export function ExpensesPage() {
  const { expenses, loading, error, load, add, remove } = useExpenseStore();
  const {
    categories,
    loading: catLoading,
    load: loadCategories,
    add: addCategory,
    update: updateCategory,
    remove: removeCategory,
  } = useCategoryStore();
  const user = useSessionStore((s) => s.user);

  const [filter, setFilter] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: number; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [confirmCatDelete, setConfirmCatDelete] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { load(filter ? Number(filter) : null); }, [load, filter]);

  const categoryName = (id: number) => categories.find((c) => c.id === id)?.name ?? "—";
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const handleExpenseSubmit = async (input: Parameters<typeof add>[0]) => {
    await add(input, user?.id ?? null);
    setRecordOpen(false);
    load(filter ? Number(filter) : null);
  };

  const handleDeleteExpense = async () => {
    if (!confirmDelete) return;
    await remove(confirmDelete.id, user?.id ?? null);
    setConfirmDelete(null);
    load(filter ? Number(filter) : null);
  };

  const handleCategorySubmit = async (input: { name: string; type?: string | null }) => {
    if (editingCategory) await updateCategory(editingCategory.id, input, user?.id ?? null);
    else await addCategory(input, user?.id ?? null);
    setEditingCategory(null);
    setCatOpen(false);
    loadCategories();
  };

  const handleDeleteCategory = async () => {
    if (!confirmCatDelete) return;
    await removeCategory(confirmCatDelete.id, user?.id ?? null);
    setConfirmCatDelete(null);
    loadCategories();
  };

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track and manage all business expenses"
        breadcrumb={[{ label: "Finance" }, { label: "Expenses" }]}
        meta={expenses.length > 0 ? formatMoney(total) : undefined}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCatOpen(true)}
              icon={<Tags className="h-3.5 w-3.5" />}
            >
              Categories
            </Button>
            <Button
              size="sm"
              onClick={() => setRecordOpen(true)}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              Record Expense
            </Button>
          </div>
        }
      />

      {error && <div className="mb-4"><Alert message={error} variant="error" /></div>}

      <Card noPadding>
        {/* Filter bar */}
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid #E2E8F0" }}
        >
          <div className="w-52">
            <Select
              name="category_filter"
              options={[
                { value: "", label: "All Categories" },
                ...categories.map((c) => ({ value: String(c.id), label: c.name })),
              ]}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {expenses.length > 0 && (
            <div
              className="ml-auto flex items-center gap-2 rounded-lg px-3 py-1.5"
              style={{ background: "#FFF5F5", border: "1px solid #FEE2E2" }}
            >
              <TrendingDown className="h-3.5 w-3.5" style={{ color: "#DC2626" }} />
              <span className="text-[12px]" style={{ color: "#B91C1C" }}>Total:</span>
              <span className="amount text-[13px] font-bold" style={{ color: "#B91C1C" }}>
                {formatMoney(total)}
              </span>
            </div>
          )}
        </div>

        {loading || catLoading ? (
          <div className="flex items-center justify-center gap-2 py-16" style={{ color: "#64748B" }}>
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading expenses...</span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Receipt}
              title="No expenses recorded"
              description={filter ? "No expenses in this category." : "Record your first expense to start tracking spending."}
              action={
                !filter ? (
                  <Button onClick={() => setRecordOpen(true)} icon={<Plus className="h-3.5 w-3.5" />}>
                    Record First Expense
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Category</th>
                  <th className="text-right">Amount</th>
                  <th>Description</th>
                  <th>Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e, idx) => (
                  <tr key={e.id}>
                    <td style={{ color: "#94A3B8", fontSize: "12px" }}>{idx + 1}</td>
                    <td>
                      <span
                        className="rounded px-2 py-0.5 text-[11px] font-semibold"
                        style={{ background: "#FEE2E2", color: "#B91C1C" }}
                      >
                        {categoryName(e.category_id)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="amount font-semibold text-[13px]" style={{ color: "#DC2626" }}>
                        {formatMoney(e.amount)}
                      </span>
                    </td>
                    <td style={{ color: "#475569", fontSize: "13px" }}>{e.description ?? "—"}</td>
                    <td style={{ color: "#64748B", fontSize: "12px" }}>
                      {new Date(e.expense_date).toLocaleDateString("en-PK", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(e)}
                          className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-red-50"
                          style={{ color: "#DC2626" }}
                          title="Delete expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Record Expense Modal */}
      <Modal open={recordOpen} title="Record Expense" subtitle="Add a new business expense" onClose={() => setRecordOpen(false)} size="md">
        <ExpenseForm onSubmit={handleExpenseSubmit} onCancel={() => setRecordOpen(false)} categories={categories} />
      </Modal>

      {/* Categories Modal */}
      <Modal
        open={catOpen}
        title="Expense Categories"
        subtitle="Manage your expense categories"
        onClose={() => { setCatOpen(false); setEditingCategory(null); }}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          {catLoading ? (
            <div className="flex items-center justify-center py-6 gap-2" style={{ color: "#64748B" }}>
              <Spinner className="h-5 w-5" />
              <span className="text-[13px]">Loading categories...</span>
            </div>
          ) : (
            <>
              {categories.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {categories.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
                    >
                      <span className="text-[13px] font-medium" style={{ color: "#0F172A" }}>{c.name}</span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setEditingCategory({ id: c.id, name: c.name })}
                          className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-blue-50" style={{ color: "#3B6FD4" }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setConfirmCatDelete({ id: c.id, name: c.name })}
                          className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-red-50" style={{ color: "#DC2626" }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "16px" }}>
                <div className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#64748B" }}>
                  {editingCategory ? "Edit Category" : "Add New Category"}
                </div>
                <CategoryForm
                  key={editingCategory?.id ?? "new"}
                  onSubmit={handleCategorySubmit}
                  onCancel={() => { editingCategory ? setEditingCategory(null) : setCatOpen(false); }}
                  initial={editingCategory}
                />
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Expense Confirmation */}
      <Modal open={confirmDelete !== null} title="Delete Expense" onClose={() => setConfirmDelete(null)} size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDeleteExpense}>Delete</Button>
          </>
        }
      >
        <Alert
          variant="warning"
          message={`Delete expense of ${confirmDelete ? formatMoney(confirmDelete.amount) : ""}? This action cannot be undone.`}
        />
      </Modal>

      {/* Delete Category Confirmation */}
      <Modal open={confirmCatDelete !== null} title="Delete Category" onClose={() => setConfirmCatDelete(null)} size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmCatDelete(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDeleteCategory}>Delete</Button>
          </>
        }
      >
        <Alert
          variant="warning"
          message={`Delete category "${confirmCatDelete?.name}"? Expenses in this category may lose their category. This action cannot be undone.`}
        />
      </Modal>
    </div>
  );
}
