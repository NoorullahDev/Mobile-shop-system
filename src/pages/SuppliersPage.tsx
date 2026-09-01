import { useEffect, useState } from "react";
import { Plus, Search, Building2, Pencil, Trash2, X, CircleDollarSign, Wallet, ShoppingCart } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Button";
import { SupplierForm } from "./SupplierForm";
import { useSupplierStore } from "../store/suppliers";
import * as purchaseService from "../services/purchaseService";
import { formatMoney } from "../lib/format";
import type { CreateSupplierInput, Supplier } from "../types/inventory";
import type { SupplierBalance } from "../types/purchase";

export function SuppliersPage() {
  const { suppliers, loading, error, load, add, update, remove } = useSupplierStore();
  const [balances, setBalances] = useState<SupplierBalance[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => {
    load();
    purchaseService
      .listSupplierBalances()
      .then(setBalances)
      .catch(() => {});
  }, [load]);

  const filtered = suppliers.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.phone ?? "").toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q)
    );
  });

  const balanceFor = (id: number) => balances.find((b) => b.supplier_id === id);

  const totalPurchases = balances.reduce((s, b) => s + b.total_purchases, 0);
  const totalPaid = balances.reduce((s, b) => s + b.total_paid, 0);
  const totalDues = balances.reduce((s, b) => s + b.balance, 0);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setModalOpen(true); };

  const handleSubmit = async (input: CreateSupplierInput) => {
    if (editing) await update(editing.id, input);
    else await add(input);
    setModalOpen(false);
  };

  const handleDelete = async () => {
    if (confirmDelete === null) return;
    await remove(confirmDelete);
    setConfirmDelete(null);
  };

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Manage your mobile phone suppliers and contacts"
        breadcrumb={[{ label: "Suppliers" }]}
        meta={`${suppliers.length} total`}
        actions={
          <Button onClick={openCreate} icon={<Plus className="h-3.5 w-3.5" />}>
            Add Supplier
          </Button>
        }
      />

      {error && (
        <div className="mb-4"><Alert message={error} variant="error" /></div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Suppliers"
          value={String(suppliers.length)}
          icon={Building2}
          tone="primary"
        />
        <KpiCard
          title="Total Purchases"
          value={formatMoney(totalPurchases)}
          icon={ShoppingCart}
          tone="navy"
        />
        <KpiCard
          title="Amount Paid"
          value={formatMoney(totalPaid)}
          icon={Wallet}
          tone="green"
        />
        <KpiCard
          title="Outstanding Dues"
          value={formatMoney(totalDues)}
          icon={CircleDollarSign}
          tone="amber"
        />
      </div>

      <Card noPadding>
        {/* Filter bar */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #E2E8F0" }}>
          <div className="relative flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "#94A3B8" }} />
            <input
              className="h-9 w-full rounded border bg-white pl-9 pr-8 text-[13px] outline-none transition-all placeholder:text-[#94A3B8]"
              style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#3B6FD4"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,111,212,0.12)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.boxShadow = "none"; }}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <span className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "#F1F5F9", color: "#475569" }}>
            {filtered.length} suppliers
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16" style={{ color: "#64748B" }}>
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading suppliers...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Building2}
              title="No suppliers found"
              description={search ? "Try a different search term." : "Add your first supplier to get started."}
              action={!search ? <Button onClick={openCreate} icon={<Plus className="h-3.5 w-3.5" />}>Add Supplier</Button> : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Supplier Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th className="text-right">Dues</th>
                  <th>Added</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <tr key={s.id}>
                    <td style={{ color: "#94A3B8", fontSize: "12px" }}>{idx + 1}</td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "#2E4B8F" }}>
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold" style={{ fontSize: "13px", color: "#0F172A" }}>{s.name}</span>
                      </div>
                    </td>
                    <td><span className="font-mono text-[13px]" style={{ color: "#475569" }}>{s.phone ?? "—"}</span></td>
                    <td style={{ color: "#64748B", fontSize: "13px" }}>{s.email ?? "—"}</td>
                    <td style={{ color: "#64748B", fontSize: "12px", maxWidth: "180px" }}>
                      <span className="truncate block">{s.address ?? "—"}</span>
                    </td>
                    <td className="text-right">
                      <span
                        className="amount font-bold text-[13px]"
                        style={{ color: (balanceFor(s.id)?.balance ?? 0) > 0 ? "#B45309" : "#94A3B8" }}
                      >
                        {formatMoney(balanceFor(s.id)?.balance ?? 0)}
                      </span>
                    </td>
                    <td style={{ color: "#64748B", fontSize: "12px" }}>
                      {new Date(s.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => openEdit(s)} className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-blue-50" style={{ color: "#3B6FD4" }} title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(s.id)} className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-red-50" style={{ color: "#DC2626" }} title="Delete">
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

      <Modal open={modalOpen} title={editing ? "Edit Supplier" : "Add Supplier"} subtitle={editing ? `Editing: ${editing.name}` : "Enter supplier details"} onClose={() => setModalOpen(false)} size="md">
        <SupplierForm onSubmit={handleSubmit} onCancel={() => setModalOpen(false)} initial={editing} />
      </Modal>

      <Modal open={confirmDelete !== null} title="Delete Supplier" onClose={() => setConfirmDelete(null)} size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <Alert variant="warning" message="Deleting this supplier will remove their record. Inventory items linked to this supplier will remain but lose the supplier reference." />
      </Modal>
    </div>
  );
}
