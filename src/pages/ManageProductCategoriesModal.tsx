import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Modal } from "../components/Modal";
import { Button, Spinner } from "../components/Button";
import { Alert } from "../components/Alert";
import { CategoryForm } from "./CategoryForm";
import { useProductCategoryStore } from "../store/productCategories";
import { useSessionStore } from "../store/session";
import type { CreateCategoryInput } from "../types/expense";

interface ManageProductCategoriesModalProps {
  open: boolean;
  onClose: () => void;
}

export function ManageProductCategoriesModal({ open, onClose }: ManageProductCategoriesModalProps) {
  const { categories, loading, error, load: loadCategories, add, update, remove } =
    useProductCategoryStore();
  const user = useSessionStore((s) => s.user);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    if (open) {
      setEditing(null);
      loadCategories();
    }
  }, [open, loadCategories]);

  const handleSubmit = async (input: CreateCategoryInput) => {
    if (editing) await update(editing.id, { name: input.name }, user?.id ?? null);
    else await add({ name: input.name }, user?.id ?? null);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await remove(confirmDelete.id, user?.id ?? null);
    setConfirmDelete(null);
  };

  return (
    <>
      <Modal
        open={open}
        title="Product Categories"
        subtitle="Manage the categories used by mobile phones and accessories"
        onClose={() => {
          onClose();
          setEditing(null);
        }}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          {error && <Alert message={error} variant="error" />}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6" style={{ color: "#64748B" }}>
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
                      <span className="text-[13px] font-medium" style={{ color: "#0F172A" }}>
                        {c.name}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing({ id: c.id, name: c.name })}
                          className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-blue-50"
                          style={{ color: "#3B6FD4" }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                          className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-red-50"
                          style={{ color: "#DC2626" }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "16px" }}>
                <div
                  className="text-[12px] font-semibold uppercase tracking-wide mb-2"
                  style={{ color: "#64748B" }}
                >
                  {editing ? "Edit Category" : "Add New Category"}
                </div>
                <CategoryForm
                  key={editing?.id ?? "new"}
                  onSubmit={handleSubmit}
                  onCancel={() => {
                    editing ? setEditing(null) : onClose();
                  }}
                  initial={editing}
                  categoryType={null}
                />
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        title="Delete Category"
        onClose={() => setConfirmDelete(null)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <Alert
          variant="warning"
          message={`Delete category "${confirmDelete?.name}"? It cannot be deleted while accessories or mobile phones use it. This action cannot be undone.`}
        />
      </Modal>
    </>
  );
}