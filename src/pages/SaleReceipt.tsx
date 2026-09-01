import { Printer, Building2 } from "lucide-react";
import { Button } from "../components/Button";
import type { Sale } from "../types/sale";

const methodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
};

function formatPKR(n: number) {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

interface SaleReceiptProps {
  sale: Sale;
  onClose: () => void;
}

export function SaleReceipt({ sale, onClose }: SaleReceiptProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button onClick={handlePrint} icon={<Printer className="h-4 w-4" />}>
          Print Receipt
        </Button>
      </div>

      <div
        className="mx-auto max-w-sm rounded bg-white p-6"
        style={{ border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      >
        {/* Receipt Header */}
        <div className="mb-5 flex flex-col items-center text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full mb-3"
            style={{ background: "#2E4B8F", color: "#FFFFFF" }}
          >
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="text-[18px] font-bold tracking-tight" style={{ color: "#0F172A" }}>
            Mobile Shop System
          </h2>
          <p className="text-[12px] mt-1" style={{ color: "#64748B" }}>Sales Invoice / Receipt</p>
        </div>

        {/* Invoice Meta */}
        <div
          className="mb-5 flex flex-col gap-1.5 pb-4 text-[13px]"
          style={{ borderBottom: "1px dashed #CBD5E1" }}
        >
          <div className="flex justify-between">
            <span style={{ color: "#64748B" }}>Invoice No</span>
            <span className="font-mono font-semibold" style={{ color: "#0F172A" }}>{sale.receipt_no}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "#64748B" }}>Date & Time</span>
            <span style={{ color: "#0F172A" }}>
              {new Date(sale.created_at).toLocaleString("en-PK", {
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit"
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "#64748B" }}>Customer</span>
            <span className="font-medium" style={{ color: "#0F172A" }}>
              {sale.member_name ?? "Walk-in Customer"}
            </span>
          </div>
        </div>

        {/* Items List */}
        <div className="mb-5 flex flex-col gap-3">
          {sale.items.map((item) => (
            <div key={item.id} className="text-[13px]">
              <div className="flex justify-between items-start gap-4">
                <span className="font-semibold" style={{ color: "#0F172A" }}>
                  {item.product_name ?? "Unknown Item"}
                </span>
                <span className="amount font-bold whitespace-nowrap" style={{ color: "#0F172A" }}>
                  {formatPKR(item.unit_price * item.quantity)}
                </span>
              </div>
              <div className="mt-0.5 text-[12px]" style={{ color: "#64748B" }}>
                {item.quantity} × {formatPKR(item.unit_price)}
              </div>
              {item.imei && (
                <div className="mt-0.5 font-mono text-[11px]" style={{ color: "#94A3B8" }}>
                  IMEI: {item.imei}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Totals */}
        <div
          className="flex flex-col gap-1.5 pt-4 text-[13px]"
          style={{ borderTop: "1px dashed #CBD5E1" }}
        >
          <div className="flex justify-between">
            <span style={{ color: "#64748B" }}>Subtotal</span>
            <span style={{ color: "#475569" }}>
              {formatPKR(sale.total_amount + sale.discount)}
            </span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between">
              <span style={{ color: "#64748B" }}>Discount</span>
              <span style={{ color: "#DC2626" }}>- {formatPKR(sale.discount)}</span>
            </div>
          )}
          
          <div className="my-1 flex justify-between items-center rounded bg-slate-50 px-2 py-1.5">
            <span className="text-[15px] font-bold uppercase tracking-wider" style={{ color: "#0F172A" }}>Total Due</span>
            <span className="amount-large text-[18px] font-bold" style={{ color: "#0F172A" }}>
              {formatPKR(sale.total_amount)}
            </span>
          </div>

          <div className="flex justify-between mt-1">
            <span style={{ color: "#64748B" }}>Amount Paid</span>
            <span className="font-medium" style={{ color: "#16A34A" }}>{formatPKR(sale.paid_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "#64748B" }}>Payment Method</span>
            <span style={{ color: "#0F172A" }}>
              {methodLabels[sale.payment_method] ?? sale.payment_method}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col items-center gap-1 text-center">
          <p className="text-[12px] font-medium" style={{ color: "#475569" }}>Thank you for your business!</p>
          <p className="text-[10px]" style={{ color: "#94A3B8" }}>Items are non-refundable after 3 days.</p>
        </div>
      </div>
    </div>
  );
}
