import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Modal } from "../components/Modal";
import { Button, Spinner } from "../components/Button";
import { Alert } from "../components/Alert";
import { Input } from "../components/Input";
import { useAccessoryOptionStore } from "../store/accessoryOptions";
import { useSessionStore } from "../store/session";
import type { PhoneOption, CreatePhoneOptionInput } from "../types/inventory";

interface ManageAccessoryOptionsModalProps {
  open: boolean;
  onClose: () => void;
}

const OPTION_TYPES = [
  { id: "accessory_category", label: "Categories" },
  { id: "accessory_brand", label: "Brands" },
  { id: "color", label: "Colors" },
  { id: "connector_type", label: "Connector Types" },
  { id: "warranty", label: "Warranty" },
  { id: "condition", label: "Conditions" },
];

export function ManageAccessoryOptionsModal({ open, onClose }: ManageAccessoryOptionsModalProps) {
  const { loading, error, load: loadOptions, add, update, remove, getOptionsByType } =
    useAccessoryOptionStore();
  const user = useSessionStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<string>("accessory_category");
  const [editing, setEditing] = useState<PhoneOption | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PhoneOption | null>(null);

  const [value, setValue] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEditing(null);
      setValue("");
      setSortOrder("0");
      setFormError(null);
      loadOptions();
    }
  }, [open, loadOptions]);

  const activeOptions = getOptionsByType(activeTab);

  const handleEditClick = (opt: PhoneOption) => {
    setEditing(opt);
    setValue(opt.value);
    setSortOrder(String(opt.sort_order));
    setFormError(null);
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setValue("");
    setSortOrder("0");
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setFormError("Value is required");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const input: CreatePhoneOptionInput = {
        option_type: activeTab,
        value: value.trim(),
        sort_order: parseInt(sortOrder) || 0,
      };
      if (editing) {
        await update(editing.id, input, user?.id ?? null);
      } else {
        await add(input, user?.id ?? null);
      }
      handleCancelEdit();
    } catch (err) {
      setFormError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await remove(confirmDelete.id, user?.id ?? null);
      setConfirmDelete(null);
    } catch (err) {
      console.error(err);
      alert(String(err));
    }
  };

  return (
    <>
      <Modal
        open={open}
        title="Manage Accessory Dropdown Options"
        subtitle="Add, edit, or remove options for the accessory form dropdowns."
        onClose={() => {
          onClose();
          handleCancelEdit();
        }}
        size="lg"
      >
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3 flex flex-col gap-1 border-r border-[#E2E8F0] pr-4">
            {OPTION_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setActiveTab(type.id);
                  handleCancelEdit();
                }}
                className={`text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  activeTab === type.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          <div className="w-full md:w-2/3 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
              {OPTION_TYPES.find((t) => t.id === activeTab)?.label}
            </h3>

            {error && <Alert message={error} variant="error" />}

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-slate-500">
                <Spinner className="h-5 w-5" />
                <span className="text-[13px]">Loading options...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-2">
                  {activeOptions.length === 0 ? (
                    <div className="text-[13px] text-slate-500 italic py-2">
                      No options found. Add one below.
                    </div>
                  ) : (
                    activeOptions.map((opt) => (
                      <div
                        key={opt.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2 bg-slate-50 border border-slate-200"
                      >
                        <span className="text-[13px] font-medium text-slate-800">
                          {opt.value}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditClick(opt)}
                            className="flex h-6 w-6 items-center justify-center rounded text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(opt)}
                            className="flex h-6 w-6 items-center justify-center rounded text-red-600 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2 pt-4 border-t border-slate-200">
                  <h4 className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    {editing ? "Edit Option" : "Add New Option"}
                  </h4>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    {formError && <Alert message={formError} variant="error" />}
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Input
                          name="value"
                          label="Value"
                          placeholder="e.g. Anker"
                          required
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          disabled={saving}
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          name="sort_order"
                          label="Sort Order"
                          type="number"
                          value={sortOrder}
                          onChange={(e) => setSortOrder(e.target.value)}
                          disabled={saving}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-1">
                      {editing && (
                        <Button type="button" variant="secondary" size="sm" onClick={handleCancelEdit} disabled={saving}>
                          Cancel
                        </Button>
                      )}
                      <Button type="submit" size="sm" loading={saving}>
                        {editing ? "Save" : "Add"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        title="Delete Option"
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
          message={`Are you sure you want to delete "${confirmDelete?.value}"? This action cannot be undone.`}
        />
      </Modal>
    </>
  );
}
