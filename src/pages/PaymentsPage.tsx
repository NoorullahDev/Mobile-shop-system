import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Search,
  Wallet,
  Trash2,
  History,
  Users,
  CircleDollarSign,
  X,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { PaymentForm } from "./PaymentForm";
import { usePaymentStore } from "../store/payments";
import { useMemberStore } from "../store/members";
import * as paymentService from "../services/paymentService";
import { useSessionStore } from "../store/session";
import type { Payment } from "../types/payment";
import type { MemberBalance } from "../types/payment";

function formatMoney(n: number) {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

const methodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
};

export function PaymentsPage() {
  const { payments, loading, error, load, add, remove } = usePaymentStore();
  const { members, load: loadMembers } = useMemberStore();
  const user = useSessionStore((s) => s.user);
  
  const [search, setSearch] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<number | null>(null);
  const [history, setHistory] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [memberTotal, setMemberTotal] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [dues, setDues] = useState<MemberBalance[]>([]);
  const historyReq = useRef(0);

  useEffect(() => {
    load();
    loadMembers();
  }, [load, loadMembers]);

  useEffect(() => {
    let active = true;
    paymentService
      .listCustomerDues()
      .then((rows) => {
        if (active) setDues(rows);
      })
      .catch(() => {
        /* dues are supplementary */
      });
    return () => {
      active = false;
    };
  }, [payments]);

  const totalOutstanding = dues.reduce((s, d) => s + d.balance, 0);

  const searchPayments = () => load(search);

  const openHistory = async (memberId: number) => {
    const req = ++historyReq.current;
    setHistoryFor(memberId);
    setHistoryLoading(true);
    setHistory([]);
    try {
      const [list, bal] = await Promise.all([
        paymentService.listMemberPayments(memberId),
        paymentService.getMemberBalance(memberId),
      ]);
      if (req !== historyReq.current) return;
      setHistory(list);
      setMemberTotal(bal.total_paid);
    } finally {
      if (req === historyReq.current) setHistoryLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirmDelete === null) return;
    await remove(confirmDelete);
    setConfirmDelete(null);
  };

  const historyMember = members.find((m) => m.id === historyFor);

  return (
    <div>
      <PageHeader
        title="Customer Dues & Payments"
        description="Record and track customer payments and balances"
        breadcrumb={[{ label: "Customers" }, { label: "Payments" }]}
        meta={`${payments.length} transactions`}
        actions={
          <Button onClick={() => setRecordOpen(true)} icon={<Plus className="h-3.5 w-3.5" />}>
            Record Payment
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert message={error} variant="error" />
        </div>
      )}

      {/* Customer Dues */}
      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" noPadding>
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid #E2E8F0" }}
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: "#3B6FD4" }} />
              <span className="text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                Customer Dues
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: "#FEF3C7", color: "#B45309" }}
              >
                {dues.length} owing
              </span>
            </div>
            <Button size="sm" onClick={() => setRecordOpen(true)} icon={<Plus className="h-3.5 w-3.5" />}>
              Record Payment
            </Button>
          </div>
          {dues.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px]" style={{ color: "#64748B" }}>
              No outstanding customer dues. All balances are clear.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto p-3">
              <div className="flex flex-col gap-2">
                {dues.map((d) => (
                  <button
                    key={d.member_id}
                    type="button"
                    onClick={() => openHistory(d.member_id)}
                    className="flex items-center justify-between rounded-md p-2.5 text-left transition-colors hover:bg-blue-50/50"
                    style={{ border: "1px solid #E2E8F0", background: "#F8FAFC" }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                          {d.member_name}
                        </span>
                        <History className="h-3.5 w-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                      </div>
                      <div className="truncate text-[11px]" style={{ color: "#64748B" }}>
                        {d.phone ?? "—"} · {d.payment_count} payment{d.payment_count !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="amount font-bold text-[14px]" style={{ color: "#B45309" }}>
                        {formatMoney(d.balance)}
                      </div>
                      <div className="text-[10px]" style={{ color: "#94A3B8" }}>
                        due balance
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex h-full flex-col justify-center gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: "#FEF3C7", color: "#B45309" }}
              >
                <CircleDollarSign className="h-5 w-5" />
              </span>
              <div>
                <div className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>
                  Total Outstanding
                </div>
                <div className="amount text-[22px] font-bold" style={{ color: "#B45309" }}>
                  {formatMoney(totalOutstanding)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3" style={{ borderTop: "1px solid #E2E8F0", paddingTop: 12 }}>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: "#DBEAFE", color: "#2563EB" }}
              >
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <div className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>
                  Transactions
                </div>
                <div className="text-[16px] font-bold" style={{ color: "#0F172A" }}>
                  {payments.length} recorded
                </div>
              </div>
            </div>
          </div>
        </Card>
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
              placeholder="Search by member, method or reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchPayments()}
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
          <Button variant="secondary" size="sm" onClick={searchPayments}>
            Search
          </Button>
        </div>

        {/* Table / States */}
        {loading ? (
          <div
            className="flex items-center justify-center gap-2 py-16"
            style={{ color: "#64748B" }}
          >
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading payments...</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Wallet}
              title="No payments recorded"
              description={
                search
                  ? "No payments match your search."
                  : "Record your first customer payment."
              }
              action={
                !search ? (
                  <Button
                    onClick={() => setRecordOpen(true)}
                    icon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Record Payment
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
                  <th className="text-right">Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, idx) => (
                  <tr key={p.id}>
                    <td style={{ color: "#94A3B8", fontSize: "12px" }}>
                      {idx + 1}
                    </td>
                    <td>
                      <span className="font-semibold" style={{ fontSize: "13px", color: "#0F172A" }}>
                        {p.member_name ?? (
                          <span style={{ color: "#94A3B8", fontStyle: "italic" }}>
                            Walk-in
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="amount font-semibold text-[13px]" style={{ color: "#16A34A" }}>
                        {formatMoney(p.amount)}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "#475569", fontSize: "13px" }}>
                        {methodLabels[p.payment_method] ?? p.payment_method}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td style={{ color: "#64748B", fontSize: "12px" }}>
                      {new Date(p.payment_date).toLocaleDateString("en-PK", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {p.member_id != null && (
                          <button
                            type="button"
                            onClick={() => openHistory(p.member_id!)}
                            className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-blue-50"
                            style={{ color: "#3B6FD4" }}
                            title="View history"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(p.id)}
                          className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-red-50"
                          style={{ color: "#DC2626" }}
                          title="Delete payment"
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

      {/* Record Modal */}
      <Modal
        open={recordOpen}
        title="Record Payment"
        subtitle="Log a customer payment"
        onClose={() => setRecordOpen(false)}
        size="md"
      >
        <PaymentForm
          onSubmit={async (input) => {
            await add(input, user?.id ?? null);
            setRecordOpen(false);
          }}
          onCancel={() => setRecordOpen(false)}
          members={members}
        />
      </Modal>

      {/* History Modal */}
      <Modal
        open={historyFor !== null}
        title={historyMember ? `${historyMember.name} — Payment History` : "Payment History"}
        onClose={() => setHistoryFor(null)}
        size="md"
      >
        {historyLoading ? (
          <div className="flex items-center justify-center py-8 gap-2" style={{ color: "#64748B" }}>
            <Spinner className="h-5 w-5" />
            <span className="text-[13px]">Loading history...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div
              className="flex items-center justify-between rounded-lg px-4 py-3"
              style={{ background: "#F0FDF4", border: "1px solid #DCFCE7" }}
            >
              <span className="text-[13px] font-semibold" style={{ color: "#16A34A" }}>Total Paid</span>
              <span className="amount font-bold text-[18px]" style={{ color: "#15803D" }}>
                {formatMoney(memberTotal)}
              </span>
            </div>
            
            {history.length === 0 ? (
              <p className="text-[13px] text-center" style={{ color: "#64748B" }}>
                No payments recorded for this customer.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                {history.map((p) => (
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
                        <span>
                          {new Date(p.payment_date).toLocaleDateString("en-PK", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
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
          message="Are you sure you want to delete this payment? This action cannot be undone."
        />
      </Modal>
    </div>
  );
}
