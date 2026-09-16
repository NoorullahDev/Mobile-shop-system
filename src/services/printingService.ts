import { invoke } from "@tauri-apps/api/core";
import type { ReceiptData, ReceiptSettings } from "../types/receipt";
import { buildReceiptInner, measureReceiptHeight, wrapPrintHtml } from "../lib/receiptHtml";
import { buildA4InvoicePrintHtml } from "../lib/a4InvoiceHtml";
import { PAPER_RULES } from "../lib/receiptLayout";

export interface PrinterInfo {
  name: string;
  driverName: string;
  portName: string;
  printerStatus: string[];
}

interface PrintMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
  unit: string;
}

/**
 * Matches the plugin's PrintHtmlOptions exactly.
 * `printerId` must be `undefined` (not `null`) when unset — otherwise
 * the Rust serde layer receives `null` and may fail to resolve
 * the system default printer.
 */
interface PrintHtmlRequest {
  html: string;
  printerId?: string;
  pageWidth?: number;
  pageHeight?: number;
  orientation?: string;
  margin?: PrintMargin;
  copies?: number;
  grayscale?: boolean;
}

export async function getPrinters(): Promise<PrinterInfo[]> {
  return invoke<PrinterInfo[]>("plugin:printer-v2|get_printers");
}

async function printHtml(request: PrintHtmlRequest): Promise<string> {
  return invoke<string>("plugin:printer-v2|print_html", { options: request });
}

function clampHeightMm(mm: number): number {
  return Math.min(1200, Math.max(10, Math.round(mm * 10) / 10));
}

export async function printReceipt(
  data: ReceiptData,
  settings: ReceiptSettings,
  printerOverride?: string,
): Promise<string> {
  const inner = buildReceiptInner(data, settings);
  const rules = PAPER_RULES[settings.paperWidth];
  const contentHeightMm = measureReceiptHeight(inner, rules.contentMm);
  const pageHeightMm = clampHeightMm(contentHeightMm + 2);

  // Resolve printer: use override, then settings, then undefined = system default
  const printer = printerOverride || settings.printer || undefined;

  return printHtml({
    html: wrapPrintHtml(inner),
    printerId: printer,
    pageWidth: rules.paperMm,
    pageHeight: pageHeightMm,
    orientation: "portrait",
    margin: { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" },
    copies: 1,
    grayscale: false,
  });
}

/**
 * Opens the receipt in the system print dialog so the user can choose
 * a printer, adjust copies, layout, etc. before printing.
 *
 * Uses an iframe + window.print() approach because window.open() is
 * blocked inside Tauri's webview.
 */
export function printReceiptViaDialog(
  data: ReceiptData,
  settings: ReceiptSettings,
): void {
  const inner = buildReceiptInner(data, settings);
  const rules = PAPER_RULES[settings.paperWidth];

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Receipt - Print</title>
<style>
  @page {
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${rules.paperMm}mm; background: #fff; }
</style>
</head><body>${inner}</body></html>`;

  // Remove any previously created print iframe
  const existing = document.getElementById("__receipt_print_frame");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__receipt_print_frame";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  // Set width to paper width so layout renders correctly before print
  iframe.style.width = `${Math.round(rules.paperMm * (96 / 25.4))}px`;
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    }
  };

  if (iframe.contentWindow) {
    iframe.contentWindow.onafterprint = () => {
      iframe.remove();
    };
  }

  // Small delay to ensure content is rendered in the iframe
  setTimeout(triggerPrint, 300);
}

/**
 * Opens the A4 Invoice in the system print dialog (Chromium Print Preview).
 * Uses the same iframe + window.print() approach as thermal receipts.
 */
export function printA4InvoiceViaDialog(data: ReceiptData): void {
  const html = buildA4InvoicePrintHtml(data);

  // Remove any previously created print iframe
  const existing = document.getElementById("__a4_invoice_print_frame");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__a4_invoice_print_frame";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  // A4 at 96 DPI: 210mm ≈ 794px, 297mm ≈ 1123px
  iframe.style.width = "794px";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    }
  };

  if (iframe.contentWindow) {
    iframe.contentWindow.onafterprint = () => {
      iframe.remove();
    };
  }

  // Small delay to ensure content is rendered in the iframe
  setTimeout(triggerPrint, 300);
}

/**
 * Prints a DOM element using the printer-v2 plugin.
 * Sends HTML directly to the printer via WebView2 PrintAsync —
 * no browser print dialog, no Chromium headers/footers.
 */
export async function printElementViaPlugin(elementId: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) {
    throw new Error("Report element not found");
  }

  // Capture all stylesheet text from the document
  const styleTexts: string[] = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        styleTexts.push(rule.cssText);
      }
    } catch {
      // Cross-origin stylesheets — skip
    }
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<title>Report - Print</title>
<style>
${styleTexts.join("\n")}
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; }
html, body { width: 210mm; background: #fff; margin: 0; padding: 0; }
body { font-family: Inter, "Segoe UI", Arial, sans-serif; }
body.printing,
body.printing #root,
body.printing .app-shell,
body.printing .app-main,
body.printing .app-content {
  width: auto !important;
  height: auto !important;
  min-height: 0 !important;
  overflow: visible !important;
  background: #fff !important;
}
body.printing .app-shell > aside,
body.printing .app-main > header,
body.printing .app-main > div,
body.printing .app-content > div > :not(.print-report) {
  display: none !important;
}
body.printing .app-content {
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
}
</style>
</head>
<body class="printing">
${el.outerHTML}
</body></html>`;

  await printHtml({
    html,
    printerId: undefined,
    pageWidth: 210,
    pageHeight: 297,
    orientation: "portrait",
    margin: { top: 10, right: 10, bottom: 10, left: 10, unit: "mm" },
    copies: 1,
    grayscale: false,
  });
}