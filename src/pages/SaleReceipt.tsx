import { useRef, useState } from "react";
import { Printer } from "lucide-react";
import { printHtml } from "tauri-plugin-printer-v2";
import { Button } from "../components/Button";
import { useSettingsStore } from "../store/settings";
import type { ReceiptPaperSize } from "../store/settings";
import type { Sale } from "../types/sale";

const methodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
};

const PAPER_WIDTH_MM: Record<ReceiptPaperSize, number> = { "58mm": 58, "80mm": 80 };

/**
 * On-screen preview size is deliberately larger than the physical paper so the
 * shop owner can read the whole invoice before printing. Printing still uses
 * the real 58mm/80mm thermal dimensions.
 */
const PREVIEW_WIDTH_PX: Record<ReceiptPaperSize, number> = { "58mm": 400, "80mm": 440 };

function fmt(n: number) {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shopInitial(name: string) {
  const clean = name.trim();
  if (!clean) return "M";
  return clean[0].toUpperCase();
}

interface SaleReceiptProps {
  sale: Sale;
  onClose: () => void;
}

export function SaleReceipt({ sale, onClose }: SaleReceiptProps) {
  const shopName = useSettingsStore((s) => s.businessName);
  const shopLogo = useSettingsStore((s) => s.logo);
  const phone = useSettingsStore((s) => s.phone);
  const email = useSettingsStore((s) => s.email);
  const address = useSettingsStore((s) => s.address);
  const paperSize = useSettingsStore((s) => s.receiptPaperSize);

  const printRef = useRef<HTMLDivElement>(null);
  const paperWidth = PAPER_WIDTH_MM[paperSize] ?? 80;
  const [printError, setPrintError] = useState<string | null>(null);

  const buildPrintHtml = (node: HTMLElement, heightMm?: number) => {
    // Standalone document at the true physical width (58mm/80mm). The exact,
    // measured content height is baked into @page UP FRONT (not patched after
    // the fact), so both the native WebView2 print and the system-dialog
    // fallback produce a receipt-sized page — never A4, never blank space below.
    const clone = node.cloneNode(true) as HTMLElement;
    const pageHeight = heightMm ?? 297; // when measuring, height is not known yet
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Receipt</title>
<style id="thermal-print-css">
  @page { size: ${paperWidth}mm ${pageHeight}mm; margin: 0 !important; }
  html, body {
    width: ${paperWidth}mm;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff;
  }
  @media print {
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>${clone.outerHTML}</body></html>`;
  };

  // Measures the receipt's exact rendered height at the true thermal width so
  // the printed page / saved PDF is sized to the content (never A4, no blank
  // paper). Measured in a throwaway offscreen iframe — the on-page hidden copy
  // can NOT be measured directly because its hidden wrapper collapses width to 0.
  const measureContentHeight = (html: string): Promise<number> => {
    return new Promise((resolve) => {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.position = "fixed";
      iframe.style.top = "0";
      iframe.style.left = "-9999px";
      iframe.style.width = `${paperWidth}mm`;
      iframe.style.height = "2000px";
      iframe.style.border = "0";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";
      document.body.appendChild(iframe);

      const cleanup = () => {
        try {
          if (doc) doc.body.innerHTML = "";
        } catch {
          /* ignore */
        }
        try {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        } catch {
          /* ignore */
        }
      };

      const doc = iframe.contentDocument;
      if (!doc) {
        cleanup();
        resolve(180);
        return;
      }
      doc.open();
      doc.write(html);
      doc.close();

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        let heightMm = 180;
        try {
          const pxPerMm = 96 / 25.4;
          heightMm = Math.max(
            30,
            Math.round(doc.documentElement.scrollHeight / pxPerMm) + 5,
          );
        } catch {
          /* use fallback height */
        }
        cleanup();
        resolve(heightMm);
      };

      if (doc.readyState === "complete") {
        window.setTimeout(finish, 60);
      } else {
        iframe.onload = () => window.setTimeout(finish, 60);
      }
      // Safety net so handlePrint can never hang waiting for layout.
      window.setTimeout(finish, 500);
    });
  };

  // Fallback print path: the SAME exact-sized thermal document through the
  // WebView2 system print dialog. The measured height is already baked into
  // @page, so even this path is sized to the receipt content.
  const printViaWindow = (html: string, heightMm?: number) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.top = "0";
    iframe.style.left = "-9999px";
    iframe.style.width = `${paperWidth}mm`;
    iframe.style.height = "600px";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => {
      window.setTimeout(() => {
        try {
          doc.body.innerHTML = "";
        } catch {
          /* ignore */
        }
        try {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        } catch {
          /* ignore */
        }
      }, 500);
    };

    let printed = false;
    const fire = () => {
      if (printed) return;
      printed = true;
      try {
        // Guarantee exact thermal @page sizing on the dialog path too.
        const finalHeight = heightMm ?? 200;
        const css = doc.getElementById("thermal-print-css");
        if (css) {
          css.textContent = `
            @page { size: ${paperWidth}mm ${finalHeight}mm; margin: 0 !important; }
            html, body {
              width: ${paperWidth}mm;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff;
            }
            @media print {
              * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `;
        }
        const win = iframe.contentWindow;
        if (win) {
          win.focus();
          window.setTimeout(() => win.print(), 100);
        }
      } catch {
        /* ignore */
      }
      cleanup();
    };

    iframe.onload = () => {
      try {
        fire();
      } catch {
        /* ignore */
      }
    };
    try {
      if (doc.readyState === "complete") fire();
    } catch {
      /* ignore */
    }
  };

  const handlePrint = async () => {
    const node = printRef.current;
    if (!node) return;

    // 1. Measure the receipt at the true thermal width.
    const measureHtml = buildPrintHtml(node);
    const paperHeight = await measureContentHeight(measureHtml);

    // 2. Rebuild the print document with the exact height already in @page.
    const html = buildPrintHtml(node, paperHeight);

    // 3. Primary path: native WebView2 print (ICoreWebView2_16::Print) with the
    //    real thermal paper dimensions in the print settings — the Tauri
    //    equivalent of Electron's webContents.print({ pageSize }).
    //    No A4, no browser header/footer, content-height fit.
    setPrintError(null);
    try {
      await printHtml({
        html,
        pageWidth: paperWidth,
        pageHeight: paperHeight,
        orientation: "Portrait",
        margin: { top: 0, bottom: 0, left: 0, right: 0, unit: "mm" },
        quality: 100,
        grayscale: true,
        copies: 1,
        removeAfterPrint: true,
      });
    } catch (err) {
      // 4. Surface WHY the native path failed instead of silently printing A4,
      //    then use the exact-sized system-dialog fallback.
      const msg =
        err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
      setPrintError(
        `Native thermal print failed (${msg || "unknown error"}). Presented the system print dialog with the correct 58/80mm page size instead.`,
      );
      printViaWindow(html, paperHeight);
    }
  };

  const contacts = [phone, email].filter(Boolean).join(" · ");

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button onClick={handlePrint} icon={<Printer className="h-4 w-4" />}>
          Print Receipt
        </Button>
      </div>

      {printError && (
        <div
          className="mb-3 rounded-md border px-3 py-2 text-[12px]"
          style={{ borderColor: "#F59E0B", color: "#92400E", background: "#FFFBEB" }}
        >
          {printError}
        </div>
      )}

      {/* Screensable preview — larger than the physical paper so it is easy to read */}
      <div className="flex justify-center">
        <ReceiptBody
          sale={sale}
          shopName={shopName}
          shopLogo={shopLogo}
          contacts={contacts}
          address={address}
          width={`${PREVIEW_WIDTH_PX[paperSize] ?? 420}px`}
          baseFont={13}
          pad="14px 20px"
          logoSize={56}
        />
      </div>

      {/* Hidden print source — styled with the true physical thermal paper size */}
      <div aria-hidden style={{ position: "absolute", left: -9999, top: 0, width: `${paperWidth}mm`, height: 0, overflow: "hidden", visibility: "hidden" }}>
        <ReceiptBody
          boxRef={printRef}
          sale={sale}
          shopName={shopName}
          shopLogo={shopLogo}
          contacts={contacts}
          address={address}
          width={`${paperWidth}mm`}
          baseFont={12}
          pad={paperSize === "58mm" ? "2px 6px" : "3px 10px"}
          logoSize={52}
        />
      </div>
    </div>
  );
}

interface ReceiptBodyProps {
  boxRef?: React.Ref<HTMLDivElement>;
  sale: Sale;
  shopName: string;
  shopLogo: string | null;
  contacts: string;
  address: string;
  width: string;
  baseFont: number;
  pad: string;
  logoSize: number;
}

function ReceiptBody({
  boxRef,
  sale,
  shopName,
  shopLogo,
  contacts,
  address,
  width,
  baseFont,
  pad,
  logoSize,
}: ReceiptBodyProps) {
  const sm = baseFont - 1.5; // secondary text
  const xs = baseFont - 2; // smallest text
  const totalFont = baseFont + 3;
  const subtotal = sale.total_amount + sale.discount;
  const balanceDue = Math.max(0, sale.total_amount - sale.paid_amount);

  const dashed: React.CSSProperties = { borderTop: "1px dashed #D1D5DB" };
  const row: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    marginTop: 3,
  };
  const label: React.CSSProperties = { color: "#6B7280", fontSize: sm, lineHeight: 1.45 };
  const value: React.CSSProperties = {
    color: "#111827",
    fontSize: sm,
    fontWeight: 600,
    textAlign: "right",
    overflowWrap: "break-word",
    wordBreak: "break-word",
    maxWidth: "62%",
  };

  return (
    <div
      ref={boxRef}
      style={{
        fontFamily: "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
        width,
        maxWidth: "100%",
        boxSizing: "border-box",
        background: "#ffffff",
        color: "#111827",
        fontSize: baseFont,
        lineHeight: 1.5,
        padding: pad,
        overflowWrap: "break-word",
        wordBreak: "break-word",
      }}
    >
      {/* ─── Shop header ─── */}
      <div style={{ textAlign: "center" }}>
        {shopLogo ? (
          <img
            src={shopLogo}
            alt={shopName || "Shop logo"}
            style={{
              width: logoSize,
              height: logoSize,
              objectFit: "cover",
              borderRadius: 999,
              margin: "0 auto 7px",
              background: "#ffffff",
            }}
          />
        ) : (
          <div
            style={{
              width: logoSize - 8,
              height: logoSize - 8,
              margin: "0 auto 7px",
              borderRadius: 999,
              background: "#111827",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: totalFont,
              fontWeight: 700,
            }}
          >
            {shopInitial(shopName)}
          </div>
        )}
        <div
          style={{
            fontSize: baseFont + 3,
            fontWeight: 700,
            color: "#000000",
            lineHeight: 1.3,
          }}
        >
          {shopName || "Mobile Shop"}
        </div>
        {contacts && <div style={{ fontSize: sm, color: "#374151", marginTop: 2 }}>{contacts}</div>}
        {address && <div style={{ fontSize: sm, color: "#374151" }}>{address}</div>}
      </div>

      <div style={{ ...dashed, margin: "10px 0 8px" }} />

      {/* ─── Document title ─── */}
      <div
        style={{
          textAlign: "center",
          fontSize: baseFont,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          margin: "0 auto 2px",
          color: "#000000",
        }}
      >
        Sales Receipt
      </div>

      <div style={{ ...dashed, margin: "8px 0" }} />

      {/* ─── Invoice meta ─── */}
      <div>
        <div style={row}>
          <span style={label}>Invoice No</span>
          <span style={value}>{sale.receipt_no}</span>
        </div>
        <div style={row}>
          <span style={label}>Date &amp; Time</span>
          <span style={value}>{formatDateTime(sale.created_at)}</span>
        </div>
        <div style={row}>
          <span style={label}>Customer</span>
          <span style={value}>{sale.member_name ?? "Walk-in Customer"}</span>
        </div>
      </div>

      {/* ─── Items section ─── */}
      <div style={{ ...dashed, marginTop: 10 }} />
      <div
        style={{
          textAlign: "center",
          fontSize: sm,
          fontWeight: 600,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "#374151",
          margin: "4px 0",
        }}
      >
        Items
      </div>
      <div style={{ ...dashed, marginBottom: 4 }} />

      {/* ─── Sold items ─── */}
      <div>
        {sale.items.map((item) => (
          <div key={item.id} style={{ marginTop: 8, paddingBottom: 2 }}>
            <div
              style={{
                fontSize: baseFont,
                fontWeight: 700,
                color: "#111827",
                overflowWrap: "break-word",
                wordBreak: "break-word",
              }}
            >
              {item.product_name || "Unknown Item"}
            </div>
            {item.imei && (
              <div style={{ fontSize: xs, color: "#6B7280", marginTop: 2 }}>
                IMEI: {item.imei}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 1 }}>
              <span style={{ fontSize: sm, color: "#6B7280", whiteSpace: "nowrap" }}>
                {item.quantity} × {fmt(item.unit_price)}
              </span>
              <span style={{ fontSize: sm, fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>
                {fmt(item.unit_price * item.quantity)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Totals ─── */}
      <div style={{ ...dashed, margin: "10px 0" }} />
      <div>
        <div style={row}>
          <span style={label}>Subtotal</span>
          <span style={value}>{fmt(subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div style={row}>
            <span style={label}>Discount</span>
            <span style={{ ...value, color: "#7F1D1D" }}>- {fmt(sale.discount)}</span>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            marginTop: 6,
            borderTop: "1px solid #111827",
            paddingTop: 5,
          }}
        >
          <span style={{ fontSize: totalFont, fontWeight: 700, color: "#000000" }}>TOTAL</span>
          <span style={{ fontSize: totalFont, fontWeight: 700, color: "#000000" }}>{fmt(sale.total_amount)}</span>
        </div>
        <div style={row}>
          <span style={label}>Amount Paid</span>
          <span style={value}>{fmt(sale.paid_amount)}</span>
        </div>
        {balanceDue > 0 && (
          <div style={row}>
            <span style={label}>Balance Due</span>
            <span style={{ ...value, fontWeight: 700 }}>{fmt(balanceDue)}</span>
          </div>
        )}
        <div style={row}>
          <span style={label}>Payment Method</span>
          <span style={value}>{methodLabels[sale.payment_method] ?? sale.payment_method}</span>
        </div>
      </div>

      <div style={{ ...dashed, margin: "10px 0 8px" }} />

      {/* ─── Footer ─── */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: baseFont, fontWeight: 500, color: "#111827" }}>
          Thank you for your business!
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 12, fontSize: xs, color: "#6B7280", lineHeight: 1.5 }}>
        <div>Software developed by</div>
        <div style={{ fontWeight: 600, color: "#374151" }}>EagleNest Creations</div>
        <div>0346-4451505</div>
      </div>
    </div>
  );
}