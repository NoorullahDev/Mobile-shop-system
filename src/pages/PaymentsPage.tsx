import { useEffect, useRef, useState } from "react";
import {
  Search,
  Wallet,
  History,
  Users,
  CircleDollarSign,
  X,
  MessageCircle,
  Banknote,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { KpiCard } from "../components/KpiCard";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { usePaymentStore } from "../store/payments";
import { useMemberStore } from "../store/members";
import * as paymentService from "../services/paymentService";
import { useSessionStore } from "../store/session";
import { formatMoney, formatMoneyCompact, methodLabels } from "../lib/format";
import { openDuesReminder, isPhoneValid } from "../lib/whatsapp";
import { useSettingsStore } from "../store/settings";
import { PAYMENT_METHODS } from "../types/payment";
import type { Payment } from "../types/payment";
import type { CustomerDueInvoice } from "../types/payment";

export function PaymentsPage() {
  const { add } = usePaymentStore();
  const { members, load: loadMembers } = useMemberStore();
  const user = useSessionStore((s) => s.user);
  const businessName = useSettingsStore((s) => s.businessName);
  const whatsappTemplate = useSettingsStore((s) => s.whatsappTemplate);

  const [duesSearch, setDuesSearch] = useState("");
  const [dueInvoices, setDueInvoices] = useState<CustomerDueInvoice[]>([]);
  const [historyFor, setHistoryFor] = useState<number | null>(null);
  const [history, setHistory] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [memberTotal, setMemberTotal] = useState(0);
  const [payMemberId, setPayMemberId] = useState<number | null>(null);
  const [payMemberName, setPayMemberName] = useState("");
  const [payDueBalance, setPayDueBalance] = useState(0);
  const [payReceiptNo, setPayReceiptNo] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payReference, setPayReference] = useState("");
  const [payAccountDetails, setPayAccountDetails] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paySaleId, setPaySaleId] = useState<number | null>(null);
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const historyReq = useRef(0);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    let active = true;
    paymentService.listCustomerDueInvoices().then((rows) => {
      if (active) setDueInvoices(rows);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const searchDues = async (q: string) => {
    setDuesSearch(q);
    try {
      const rows = await paymentService.listCustomerDueInvoices(q || undefined);
      setDueInvoices(rows);
    } catch { /* ignore */ }
  };

  const openQuickPay = (invoice: CustomerDueInvoice) => {
    setPayMemberId(invoice.member_id);
    setPayMemberName(invoice.member_name);
    setPayReceiptNo(invoice.receipt_no);
    setPaySaleId(invoice.sale_id);
    setPayDueBalance(invoice.due_amount);
    setPayAmount(String(invoice.due_amount));
    setPayMethod("cash");
    setPayReference("");
    setPayAccountDetails("");
    setPayNote("");
    setPayError(null);
  };

  const submitQuickPay = async () => {
    if (payMemberId == null || paySaleId == null) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setPayError("Amount must be greater than zero");
      return;
    }
    if (amount > payDueBalance + 0.005) {
      setPayError(`Amount cannot exceed the remaining due of ${formatMoneyCompact(payDueBalance)}`);
      return;
    }
    const isOnlinePayment = payMethod !== "cash";
    if (isOnlinePayment && !payReference.trim()) {
      setPayError("Reference / Transaction ID is required for online payments");
      return;
    }
    if (payMethod === "bank_transfer" && !payAccountDetails.trim()) {
      setPayError("Bank / Account details are required for bank transfers");
      return;
    }
    setPaySaving(true);
    setPayError(null);
    try {
      await add(
        {
          member_id: payMemberId,
          amount,
          payment_method: payMethod,
          status: "completed",
          sale_id: paySaleId,
          reference: isOnlinePayment ? payReference.trim() : null,
          account_details: isOnlinePayment ? payAccountDetails.trim() || null : null,
          notes: isOnlinePayment ? payNote.trim() || null : null,
        },
        user?.id ?? null,
      );
      setPayMemberId(null);
      const rows = await paymentService.listCustomerDueInvoices(duesSearch || undefined);
      setDueInvoices(rows);
    } catch (err) {
      setPayError(String(err));
    } finally {
      setPaySaving(false);
    }
  };

  const totalOutstanding = dueInvoices.reduce((sum, invoice) => sum + invoice.due_amount, 0);
  const customersOwing = new Set(dueInvoices.map((invoice) => invoice.member_id)).size;
  const totalPaymentsReceived = dueInvoices.reduce((sum, invoice) => sum + invoice.payment_count, 0);

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

  const historyMember = members.find((m) => m.id === historyFor);

  return (
    <div>
      <PageHeader
        title="Customer Dues"
        description="Track and collect outstanding customer balances"
        breadcrumb={[{ label: "Customers" }, { label: "Customer Dues" }]}
      />

      {/* KPI Summary Cards */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Total Outstanding"
          value={formatMoney(totalOutstanding)}
          icon={CircleDollarSign}
          tone="amber"
          sub="across all customers"
        />
        <KpiCard
          title="Customers Owing"
          value={String(customersOwing)}
          icon={Users}
          tone="red"
          sub={`${customersOwing} active`}
        />
        <KpiCard
          title="Due Payments Received"
          value={String(totalPaymentsReceived)}
          icon={Wallet}
          tone="green"
          sub="collected so far"
        />
      </div>

      {/* Customer Dues */}
      <Card className="mb-4" noPadding>
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
              {dueInvoices.length} invoice{dueInvoices.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Search bar — above the dues list */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "#94A3B8" }}
            />
            <input
              className="h-9 w-full rounded border bg-white pl-9 pr-8 text-[13px] outline-none transition-all placeholder:text-[#94A3B8]"
              style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
              placeholder="Search customer, phone, or invoice..."
              value={duesSearch}
              onChange={(e) => searchDues(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3B6FD4";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,111,212,0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#CBD5E1";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {duesSearch && (
              <button
                type="button"
                onClick={() => searchDues("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "#94A3B8" }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {dueInvoices.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px]" style={{ color: "#64748B" }}>
            {duesSearch ? "No customers match your search." : "No outstanding customer dues. All balances are clear."}
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto p-3">
            <div className="flex flex-col gap-2">
              {dueInvoices.map((d) => (
                <div
                  key={d.sale_id}
                  className="flex items-center justify-between rounded-md p-2.5 transition-colors"
                  style={{ border: "1px solid #E2E8F0", background: "#F8FAFC" }}
                >
                  <button
                    type="button"
                    onClick={() => openHistory(d.member_id)}
                    className="min-w-0 flex-1 text-left transition-colors hover:bg-blue-50/50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                        {d.member_name}
                      </span>
                      <History className="h-3.5 w-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                    </div>
                    <div className="truncate text-[11px]" style={{ color: "#64748B" }}>
                      {d.phone ?? "—"} · {d.receipt_no} · {new Date(d.created_at).toLocaleDateString("en-PK")}
                    </div>
                  </button>
                  <div className="mx-4 hidden grid-cols-3 gap-5 text-right sm:grid">
                    <div>
                      <div className="text-[10px] uppercase" style={{ color: "#94A3B8" }}>Original Total</div>
                      <div className="amount text-[12px] font-semibold">{formatMoneyCompact(d.total_amount)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase" style={{ color: "#94A3B8" }}>Paid</div>
                      <div className="amount text-[12px] font-semibold" style={{ color: "#16A34A" }}>{formatMoneyCompact(d.paid_amount)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase" style={{ color: "#94A3B8" }}>Remaining Due</div>
                      <div className="amount text-[12px] font-semibold" style={{ color: "#B45309" }}>{formatMoneyCompact(d.due_amount)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.phone && d.due_amount > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!isPhoneValid(d.phone)) {
                            alert("Customer phone number is invalid or missing. Please update the phone number to send a WhatsApp reminder.");
                            return;
                          }
                            await openDuesReminder(d.phone, d.due_amount, businessName || undefined, whatsappTemplate || undefined, d.member_name || undefined);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-green-50"
                        style={{ color: "#25D366" }}
                        title="Send WhatsApp dues reminder"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openQuickPay(d)}
                      className="flex h-7 items-center gap-1.5 rounded px-2.5 text-[12px] font-medium text-white transition-colors hover:opacity-90"
                      style={{ background: "#16A34A" }}
                      title={`Pay ${formatMoneyCompact(d.due_amount)} on ${d.receipt_no}`}
                    >
                      <Banknote className="h-3.5 w-3.5" />
                      Pay
                    </button>
                    <div className="text-right">
                      <div className="amount font-bold text-[14px]" style={{ color: "#B45309" }}>
                        {formatMoneyCompact(d.due_amount)}
                      </div>
                      <div className="text-[10px]" style={{ color: "#94A3B8" }}>
                        due balance
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

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
                {formatMoneyCompact(memberTotal)}
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
                        {formatMoneyCompact(p.amount)}
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
                    <div className="flex items-center gap-2">
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Quick Pay Modal */}
      <Modal
        open={payMemberId !== null}
        title={`Pay — ${payMemberName}`}
        subtitle={`${payReceiptNo} · Due: ${formatMoneyCompact(payDueBalance)}`}
        onClose={() => setPayMemberId(null)}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          {payError && <Alert message={payError} />}

          <Input
            name="pay_amount"
            label="Amount"
            type="number"
            step="0.01"
            min="0"
            max={payDueBalance}
            required
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            disabled={paySaving}
          />

          <Select
            name="pay_method"
            label="Payment Method"
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: methodLabels[m] ?? m }))}
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value)}
            disabled={paySaving}
          />

          {payMethod !== "cash" && (
            <>
              <Input
                name="pay_reference"
                label="Reference / Transaction ID"
                required
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                disabled={paySaving}
              />
              <Input
                name="pay_account_details"
                label="Bank / Account Details"
                required={payMethod === "bank_transfer"}
                value={payAccountDetails}
                onChange={(e) => setPayAccountDetails(e.target.value)}
                disabled={paySaving}
              />
              <Input
                name="pay_note"
                label="Note"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                disabled={paySaving}
              />
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPayMemberId(null)} disabled={paySaving}>
              Cancel
            </Button>
            <Button onClick={submitQuickPay} loading={paySaving} icon={<Banknote className="h-3.5 w-3.5" />}>
              Record Payment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
