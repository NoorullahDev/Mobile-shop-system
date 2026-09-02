import { useEffect, useState } from "react";
import { Plus, Search, Users, Pencil, Trash2, X, Wallet } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { MemberForm } from "./MemberForm";
import { useMemberStore } from "../store/members";
import * as paymentService from "../services/paymentService";
import { formatMoneyCompact } from "../lib/format";
import type { CreateMemberInput, Member } from "../types/member";
import type { MemberBalance } from "../types/payment";

export function MembersPage() {
  const { members, loading, error, load, add, update, remove } =
    useMemberStore();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [balances, setBalances] = useState<Record<number, MemberBalance>>({});

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    paymentService
      .listMemberBalances()
      .then((rows) => {
        if (!active) return;
        const map: Record<number, MemberBalance> = {};
        for (const b of rows) map[b.member_id] = b;
        setBalances(map);
      })
      .catch(() => {
        /* balances are supplementary */
      });
    return () => {
      active = false;
    };
  }, [members]);

  const totalDues = Object.values(balances).reduce((s, b) => s + Math.max(0, b.balance), 0);
  const customersOwing = Object.values(balances).filter((b) => b.balance > 0.001).length;

  const doSearch = () => load(search);

  const handleCreate = async (input: CreateMemberInput) => {
    await add(input);
    setCreateOpen(false);
  };

  const handleEdit = async (input: CreateMemberInput) => {
    if (!editing) return;
    await update(editing.id, input);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (confirmDelete === null) return;
    await remove(confirmDelete);
    setConfirmDelete(null);
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Manage customer records, dues, and payment history"
        breadcrumb={[{ label: "Customers" }]}
        meta={`${members.length} total`}
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            Add Customer
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert message={error} variant="error" />
        </div>
      )}

      {/* KPI cards */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-3">
        <KpiCard
          title="Total Customers"
          value={members.length.toLocaleString("en-PK")}
          icon={Users}
          tone="primary"
          sub="registered customers"
        />
        <KpiCard
          title="Total Outstanding"
          value={formatMoneyCompact(totalDues)}
          icon={Wallet}
          tone={totalDues > 0 ? "amber" : "green"}
          sub="credit dues based on sales minus payments"
        />
        <KpiCard
          title="Customers Owing"
          value={String(customersOwing)}
          icon={Wallet}
          tone={customersOwing > 0 ? "red" : "green"}
          sub={customersOwing > 0 ? "with unpaid balance" : "all clear"}
        />
      </div>

      <Card noPadding>
        {/* Filter bar */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid #E2E8F0" }}
        >
          <div className="relative flex-1 max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "#94A3B8" }}
            />
            <input
              className="h-9 w-full rounded border bg-white pl-9 pr-8 text-[13px] outline-none transition-all placeholder:text-[#94A3B8]"
              style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3B6FD4";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,111,212,0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#CBD5E1";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); load(""); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "#94A3B8" }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={doSearch}>
            Search
          </Button>
          <span
            className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: "#F1F5F9", color: "#475569" }}
          >
            {members.length} customers
          </span>
        </div>

        {/* Table / States */}
        {loading ? (
          <div
            className="flex items-center justify-center gap-2 py-16"
            style={{ color: "#64748B" }}
          >
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading customers...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="No customers found"
              description={
                search
                  ? "No customers match your search. Try a different term."
                  : "Add your first customer to get started."
              }
              action={
                !search ? (
                  <Button
                    onClick={() => setCreateOpen(true)}
                    icon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Add First Customer
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
                  <th>Customer</th>
                  <th>Contact Number</th>
                  <th>CNIC</th>
                  <th>Status</th>
                  <th className="text-right">Balance (Dues)</th>
                  <th>Customer Since</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, idx) => (
                  <tr key={m.id}>
                    <td style={{ color: "#94A3B8", fontSize: "12px" }}>
                      {idx + 1}
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ background: "#3B6FD4" }}
                        >
                          {(m.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <span
                          className="font-semibold"
                          style={{ fontSize: "13px", color: "#0F172A" }}
                        >
                          {m.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="font-mono text-[13px]"
                        style={{ color: "#475569" }}
                      >
                        {m.phone ?? "—"}
                      </span>
                    </td>
                    <td style={{ color: "#64748B", fontSize: "13px" }}>
                      {m.cnic ?? "—"}
                    </td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="text-right">
                      {(() => {
                        const due = balances[m.id]?.balance ?? 0;
                        const settled = due <= 0.001;
                        return (
                          <span
                            className="amount text-[13px] font-semibold"
                            style={{
                              color: settled ? "#16A34A" : "#B45309",
                            }}
                          >
                            {settled ? "Rs 0" : formatMoneyCompact(due)}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ color: "#64748B", fontSize: "12px" }}>
                      {new Date(m.created_at).toLocaleDateString("en-PK", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(m)}
                          className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-blue-50"
                          style={{ color: "#3B6FD4" }}
                          title="Edit customer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(m.id)}
                          className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-red-50"
                          style={{ color: "#DC2626" }}
                          title="Delete customer"
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

      {/* Add Modal */}
      <Modal
        open={createOpen}
        title="Add Customer"
        subtitle="Create a new customer record"
        onClose={() => setCreateOpen(false)}
        size="md"
      >
        <MemberForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editing !== null}
        title="Edit Customer"
        subtitle={editing ? `Editing: ${editing.name}` : undefined}
        onClose={() => setEditing(null)}
        size="md"
      >
        <MemberForm
          onSubmit={handleEdit}
          onCancel={() => setEditing(null)}
          initial={editing}
        />
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={confirmDelete !== null}
        title="Delete Customer"
        onClose={() => setConfirmDelete(null)}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete Customer
            </Button>
          </>
        }
      >
        <Alert
          variant="warning"
          message="Deleting this customer will remove their record. Their sales history may still reference this customer. This action cannot be undone."
        />
      </Modal>
    </div>
  );
}
