import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Search,
  Truck,
  CircleDollarSign,
  History,
  X,
  Trash2,
  Wallet,
  Pencil,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { useSupplierStore } from "../store/suppliers";
import { useSessionStore } from "../store/session";
import * as purchaseService from "../services/purchaseService";
import { formatMoney, formatDate, methodLabels } from "../lib/format";
import type { SupplierBalance, SupplierPayment } from "../types/purchase";
import { SUPPLIER_PAYMENT_STATUSES, PURCHASE_PAYMENT_METHODS } from "../types/purchase";
import type { Supplier } from "../types/inventory";

export function SupplierDuesPage() {
  const { suppliers, load: loadSuppliers } = useSupplierStore();
  const user = useSessionStore((s) => s.user);
  const isAdmin = user?.role.toLowerCase() === "admin";

  const [dues, setDues] = useState<SupplierBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [allPayments, setAllPayments] = useState<SupplierPayment[]>([]);

  const [search, setSearch] = useState("");
  const [payFor, setPayFor] = useState<Supplier | null>(null);
  const [historyFor, setHistoryFor] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyBalance, setHistoryBalance] = useState<SupplierBalance | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [editPayment, setEditPayment] = useState<SupplierPayment | null>(null);
  const historyReq = useRef(0);

  const loadDues = async () => {
    setLoading(true);
    try {
      setDues(await purchaseService.listSupplierBalances(""));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDues();
    loadSuppliers();
    purchaseService
      .listSupplierPayments()
      .then(setAllPayments)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async () => {
    setLoading(true);
    try {
      setDues(await purchaseService.listSupplierBalances(search.trim() || undefined));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const owing = dues.filter((d) => d.balance > 0.001);
  const totalOutstanding = owing.reduce((s, d) => s + d.balance, 0);

  const openHistory = async (supplierId: number) => {
    const req = ++historyReq.current;
    setHistoryFor(supplierId);
    setHistoryLoading(true);
    setHistoryBalance(null);
    try {
      const [list, bal] = await Promise.all([
        purchaseService.listSupplierPaymentsBySupplier(supplierId),
        purchaseService.getSupplierBalance(supplierId),
      ]);
      if (req !== historyReq.current) return;
      setPayments(list);
      setHistoryBalance(bal);
    } finally {
      if (req === historyReq.current) setHistoryLoading(false);
    }
  };

  const handleSubmitPayment = async (
    supplierId: number,
    amount: number,
    method: string,
    status: string,
    reference: string,
    notes: string,
    paymentDate: string,
  ) => {
    await purchaseService.createSupplierPayment(
      {
        supplier_id: supplierId,
        amount,
        payment_method: method,
        status,
        reference: reference || null,
        notes: notes || null,
        payment_date: paymentDate || null,
      },
      user?.id ?? null,
    );
    await loadDues();
    if (historyFor === supplierId) {
      const [list, bal] = await Promise.all([
        purchaseService.listSupplierPaymentsBySupplier(supplierId),
        purchaseService.getSupplierBalance(supplierId),
      ]);
      setPayments(list);
      setHistoryBalance(bal);
    }
  };

  const handleDelete = async () => {
    if (confirmDelete === null) return;
    await purchaseService.deleteSupplierPayment(confirmDelete, user?.id ?? null);
    setConfirmDelete(null);
    await loadDues();
    const supplierId = historyFor;
    if (supplierId != null) {
      const [list, bal] = await Promise.all([
        purchaseService.listSupplierPaymentsBySupplier(supplierId),
        purchaseService.getSupplierBalance(supplierId),
      ]);
      setPayments(list);
      setHistoryBalance(bal);
    }
  };

  const historySupplier = suppliers.find((s) => s.id === historyFor);

  return (
    <div>
      <PageHeader
        title="Supplier Dues"
        description="Track outstanding balances owed to suppliers and record payments"
        breadcrumb={[{ label: "Suppliers" }, { label: "Dues" }]}
        meta={`${owing.length} supplier${owing.length !== 1 ? "s" : ""} owing`}
      />

      {error && (
        <div className="mb-4">
          <Alert message={error} variant="error" />
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Payable"
          value={formatMoney(totalOutstanding)}
          icon={CircleDollarSign}
          tone="amber"
          sub="outstanding to suppliers"
        />
        <KpiCard
          title="Suppliers Owing"
          value={String(owing.length)}
          icon={Truck}
          tone="red"
        />
        <KpiCard
          title="Payments Made"
          value={String(allPayments.length)}
          icon={Wallet}
          tone="green"
          sub="all recorded"
        />
        <KpiCard
          title="Recorded Transactions"
          value={String(payments.length)}
          icon={History}
          tone="navy"
          sub="this supplier"
        />
      </div>

      <Card noPadding>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #E2E8F0" }}>
          <div className="relative flex-1 max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "#94A3B8" }}
            />
            <input
              className="h-9 w-full rounded border bg-white pl-9 pr-8 text-[13px] outline-none transition-all placeholder:text-[#94A3B8]"
              style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
              placeholder="Search supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
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
                onClick={() => {
                  setSearch("");
                  loadDues();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "#94A3B8" }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={runSearch}>
            Search
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16" style={{ color: "#64748B" }}>
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading supplier dues...</span>
          </div>
        ) : dues.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CircleDollarSign}
              title="No supplier accounts"
              description={
                search
                  ? "No suppliers match your search."
                  : "No supplier purchases or payment accounts are available."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Supplier</th>
                  <th className="text-right">Purchases</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance</th>
                  <th>Payments</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dues.map((d, idx) => {
                  const supplier = suppliers.find((s) => s.id === d.supplier_id);
                  return (
                    <tr key={d.supplier_id}>
                      <td style={{ color: "#94A3B8", fontSize: "12px" }}>{idx + 1}</td>
                      <td>
                        <span className="font-semibold" style={{ fontSize: "13px", color: "#0F172A" }}>
                          {d.supplier_name}
                        </span>
                        {d.phone && (
                          <div className="text-[11px]" style={{ color: "#64748B" }}>
                            {d.phone}
                          </div>
                        )}
                      </td>
                      <td className="text-right">
                        <span className="amount font-semibold text-[13px]" style={{ color: "#0F172A" }}>
                          {formatMoney(d.total_purchases)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="amount font-semibold text-[13px]" style={{ color: "#16A34A" }}>
                          {formatMoney(d.total_paid)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span
                          className="amount font-bold text-[13px]"
                          style={{ color: d.balance > 0 ? "#B45309" : "#15803D" }}
                        >
                          {formatMoney(d.balance)}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: "#64748B", fontSize: "12px" }}>{d.payment_count}</span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {supplier && (
                            <button
                              type="button"
                              onClick={() => setPayFor(supplier)}
                              className="flex h-7 items-center gap-1 rounded px-2 text-[12px] font-medium transition-colors hover:bg-blue-50"
                              style={{ color: "#3B6FD4" }}
                            >
                              <Plus className="h-3.5 w-3.5" /> Pay
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openHistory(d.supplier_id)}
                            className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-blue-50"
                            style={{ color: "#3B6FD4" }}
                            title="Payment history"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Record Payment Modal */}
      <Modal
        open={payFor !== null}
        title={`Record Payment — ${payFor?.name ?? ""}`}
        onClose={() => setPayFor(null)}
        size="md"
      >
        {payFor && (
          <PaymentForm
            onSubmit={async (amount, method, status, reference, notes, paymentDate) => {
              await handleSubmitPayment(payFor.id, amount, method, status, reference, notes, paymentDate);
              setPayFor(null);
            }}
            onCancel={() => setPayFor(null)}
            balance={
              dues.find((d) => d.supplier_id === payFor.id)?.balance ??
              (historyFor === payFor.id ? historyBalance?.balance : 0)
            }
          />
        )}
      </Modal>

      <Modal open={editPayment !== null} title="Edit Supplier Payment" subtitle="Correct this supplier due/payment transaction" onClose={() => setEditPayment(null)} size="md">
        {editPayment && (
          <PaymentForm
            key={editPayment.id}
            initialPayment={editPayment}
            onSubmit={async (amount, method, status, reference, notes, paymentDate) => {
              await purchaseService.updateSupplierPayment(editPayment.id, {
                supplier_id: editPayment.supplier_id,
                amount,
                payment_method: method,
                status,
                reference: reference || null,
                notes: notes || null,
                payment_date: paymentDate || null,
              }, user?.id ?? null);
              const supplierId = editPayment.supplier_id;
              setEditPayment(null);
              await loadDues();
              if (supplierId != null) await openHistory(supplierId);
            }}
            onCancel={() => setEditPayment(null)}
          />
        )}
      </Modal>

      {/* History Modal */}
      <Modal
        open={historyFor !== null}
        title={historySupplier ? `${historySupplier.name} — Payment History` : "Payment History"}
        onClose={() => setHistoryFor(null)}
        size="md"
      >
        {historyLoading ? (
          <div className="flex items-center justify-center gap-2 py-8" style={{ color: "#64748B" }}>
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading history...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {historyBalance && (
              <div
                className="flex items-center justify-between rounded-lg px-4 py-3"
                style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}
              >
                <span className="text-[13px] font-semibold" style={{ color: "#B45309" }}>
                  Outstanding Balance
                </span>
                <span className="amount font-bold text-[18px]" style={{ color: "#B45309" }}>
                  {formatMoney(historyBalance.balance)}
                </span>
              </div>
            )}

            {payments.length === 0 ? (
              <p className="text-center text-[13px]" style={{ color: "#64748B" }}>
                No payments recorded for this supplier.
              </p>
            ) : (
              <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto pr-1">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md p-3"
                    style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
                  >
                    <div>
                      <div className="amount font-semibold text-[14px]" style={{ color: "#0F172A" }}>
                        {formatMoney(p.amount)}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: "#64748B" }}>
                        <span>{methodLabels[p.payment_method] ?? p.payment_method}</span>
                        <span style={{ color: "#CBD5E1" }}>|</span>
                        <span>{formatDate(p.payment_date)}</span>
                        {p.reference && (
                          <>
                            <span style={{ color: "#CBD5E1" }}>|</span>
                            <span>{p.reference}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={p.status} />
                      <button type="button" onClick={() => { setHistoryFor(null); setEditPayment(p); }} className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-blue-50" style={{ color: "#3B6FD4" }} title="Edit payment"><Pencil className="h-3.5 w-3.5" /></button>
                      {isAdmin && historyBalance && historyBalance.balance <= 0.001 && (
                        <button type="button" onClick={() => setConfirmDelete(p.id)} className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-red-50" style={{ color: "#DC2626" }} title="Delete cleared payment"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={confirmDelete !== null}
        title="Delete Payment"
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
          message="Delete this cleared supplier payment record? The supplier balance will be recalculated and any reopened due will appear again. This cannot be undone."
        />
      </Modal>
    </div>
  );
}

function PaymentForm({
  onSubmit,
  onCancel,
  balance,
  initialPayment,
}: {
  onSubmit: (amount: number, method: string, status: string, reference: string, notes: string, paymentDate: string) => Promise<void>;
  onCancel: () => void;
  balance?: number | null;
  initialPayment?: SupplierPayment | null;
}) {
  const [amountStr, setAmountStr] = useState(initialPayment ? String(initialPayment.amount) : "");
  const [method, setMethod] = useState(initialPayment?.payment_method ?? "cash");
  const [status, setStatus] = useState(initialPayment?.status ?? "completed");
  const [reference, setReference] = useState(initialPayment?.reference ?? "");
  const [notes, setNotes] = useState(initialPayment?.notes ?? "");
  const [paymentDate, setPaymentDate] = useState(initialPayment?.payment_date?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const methodOptions = PURCHASE_PAYMENT_METHODS.map((m) => ({
    value: m,
    label: methodLabels[m] ?? m,
  }));
  const statusOptions = SUPPLIER_PAYMENT_STATUSES.map((s) => ({ value: s, label: s }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(amountStr);
    if (!amount || amount <= 0) {
      setAmountError("Amount must be greater than zero");
      return;
    }
    setAmountError(null);
    setSaving(true);
    setError(null);
    try {
      await onSubmit(amount, method, status, reference.trim(), notes.trim(), paymentDate);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <Alert message={error} variant="error" />}
      {balance != null && balance > 0 && (
        <div
          className="rounded-lg px-4 py-2.5 text-[13px] font-medium"
          style={{ background: "#FEF3C7", border: "1px solid #FDE68A", color: "#B45309" }}
        >
          Outstanding balance: {formatMoney(balance)}
        </div>
      )}
      <Input
        name="amount"
        label="Amount"
        type="number"
        step="0.01"
        min="0"
        required
        value={amountStr}
        onChange={(e) => setAmountStr(e.target.value)}
        error={amountError ?? undefined}
        disabled={saving}
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          name="method"
          label="Payment Method"
          options={methodOptions}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          disabled={saving}
        />
        <Select
          name="status"
          label="Status"
          options={statusOptions}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={saving}
        />
      </div>
      <Input
        name="reference"
        label="Reference"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        disabled={saving}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input name="payment_date" label="Payment Date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} disabled={saving} />
        <Input name="notes" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {initialPayment ? "Save Changes" : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}
