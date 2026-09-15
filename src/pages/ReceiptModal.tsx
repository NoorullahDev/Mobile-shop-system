import { useEffect, useState } from "react";
import { Printer, FileText } from "lucide-react";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { ReceiptView } from "../components/receipt/ReceiptView";
import { A4InvoiceView } from "../components/receipt/A4InvoiceView";
import { buildReceiptData } from "../lib/receiptLayout";
import { printReceiptViaDialog, printA4InvoiceViaDialog } from "../services/printingService";
import * as saleService from "../services/saleService";
import { useReceiptSettingsStore } from "../store/receiptSettings";
import { useSettingsStore } from "../store/settings";
import type { Sale } from "../types/sale";

type PrintType = "thermal_58" | "thermal_80" | "a4";

interface ReceiptModalProps {
  open: boolean;
  sale: Sale | null;
  onClose: () => void;
  initialPrintType?: PrintType;
}

const PRINT_TYPES: Array<{ value: PrintType; label: string }> = [
  { value: "thermal_58", label: "Thermal 58mm" },
  { value: "thermal_80", label: "Thermal 80mm" },
  { value: "a4", label: "A4 Invoice" },
];

export function ReceiptModal({ open, sale, onClose, initialPrintType }: ReceiptModalProps) {
  const rs = useReceiptSettingsStore();
  const business = useSettingsStore();
  const [error, setError] = useState<string | null>(null);
  const [fullSale, setFullSale] = useState<Sale | null>(null);
  const [printType, setPrintType] = useState<PrintType>(initialPrintType ?? "a4");

  useEffect(() => {
    if (open && sale) {
      if (!useReceiptSettingsStore.getState().loaded) {
        useReceiptSettingsStore.getState().load().catch(() => {});
      }
      setError(null);
      setFullSale(null);
      saleService.getSale(sale.id).then(setFullSale).catch(() => setFullSale(sale));
    }
  }, [open, sale]);

  useEffect(() => {
    if (initialPrintType) setPrintType(initialPrintType);
  }, [initialPrintType]);

  if (!sale) return null;

  const current = fullSale ?? sale;

  const data = buildReceiptData(
    current,
    {
      name: business.businessName,
      logo: business.logo,
      phone: business.phone,
      email: business.email,
      address: business.address,
      currency: business.currency,
    },
    rs,
  );

  const handlePrint = () => {
    setError(null);
    try {
      if (printType === "a4") {
        printA4InvoiceViaDialog(data);
      } else {
        // For thermal, temporarily override paper width
        const thermalSettings = {
          ...rs,
          paperWidth: printType === "thermal_58" ? ("58mm" as const) : ("80mm" as const),
        };
        printReceiptViaDialog(data, thermalSettings);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Modal
      open={open}
      title="Receipt Preview"
      subtitle={`${sale.receipt_no} · ${current.items.length} item${current.items.length !== 1 ? "s" : ""}`}
      onClose={onClose}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handlePrint}
            icon={<Printer className="h-3.5 w-3.5" />}
          >
            Print Invoice
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-3">
          <Alert variant="error" title="Print failed" message={error} />
        </div>
      )}

      {/* Print type selector */}
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4" style={{ color: "#64748B" }} />
        <span className="text-[12px] font-medium" style={{ color: "#64748B" }}>Print format:</span>
        <div className="flex gap-1">
          {PRINT_TYPES.map((pt) => (
            <button
              key={pt.value}
              type="button"
              onClick={() => setPrintType(pt.value)}
              className="rounded px-2.5 py-1 text-[11px] font-medium transition-colors"
              style={{
                background: printType === pt.value ? "#3B6FD4" : "#F1F5F9",
                color: printType === pt.value ? "#FFF" : "#475569",
              }}
            >
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="py-3" style={{ background: "#F7F8FA", borderRadius: 8 }}>
        {printType === "a4" ? (
          <A4InvoiceView data={data} />
        ) : (
          <ReceiptView data={data} settings={rs} scale={0.85} />
        )}
      </div>
    </Modal>
  );
}
