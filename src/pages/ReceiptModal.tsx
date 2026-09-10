import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { ReceiptView } from "../components/receipt/ReceiptView";
import { buildReceiptData } from "../lib/receiptLayout";
import { printReceipt, printReceiptViaDialog } from "../services/printingService";
import * as saleService from "../services/saleService";
import { useReceiptSettingsStore } from "../store/receiptSettings";
import { useSettingsStore } from "../store/settings";
import type { Sale } from "../types/sale";

interface ReceiptModalProps {
  open: boolean;
  sale: Sale | null;
  onClose: () => void;
}

export function ReceiptModal({ open, sale, onClose }: ReceiptModalProps) {
  const rs = useReceiptSettingsStore();
  const business = useSettingsStore();
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullSale, setFullSale] = useState<Sale | null>(null);

  useEffect(() => {
    if (open && sale) {
      if (!useReceiptSettingsStore.getState().loaded) {
        useReceiptSettingsStore.getState().load().catch(() => {});
      }
      setMessage(null);
      setError(null);
      setFullSale(null);
      saleService.getSale(sale.id).then(setFullSale).catch(() => setFullSale(sale));
    }
  }, [open, sale]);

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

  const handlePrint = async () => {
    if (rs.useSystemPrintDialog) {
      try {
        printReceiptViaDialog(data, rs);
        setMessage("Receipt opened in print window.");
      } catch (e) {
        setError(String(e));
      }
      return;
    }
    setPrinting(true);
    setError(null);
    setMessage(null);
    try {
      await printReceipt(data, rs);
      setMessage(`Receipt sent to ${rs.printer || "the system default printer"}.`);
    } catch (e) {
      setError(String(e));
    } finally {
      setPrinting(false);
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
        <>
          <Button variant="ghost" onClick={onClose} disabled={printing}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handlePrint}
            loading={printing}
            icon={<Printer className="h-3.5 w-3.5" />}
          >
            {printing ? "Printing..." : "Print Receipt"}
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-3">
          <Alert
            variant="error"
            title="Print failed"
            message={error}
          />
        </div>
      )}
      {message && (
        <div className="mb-3">
          <Alert variant="success" title="Printed" message={message} />
        </div>
      )}
      <div className="py-3" style={{ background: "#F7F8FA", borderRadius: 8 }}>
        <ReceiptView data={data} settings={rs} scale={0.66} />
      </div>
    </Modal>
  );
}