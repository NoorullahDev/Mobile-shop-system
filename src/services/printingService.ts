import { invoke } from "@tauri-apps/api/core";
import type { ReceiptData, ReceiptSettings } from "../types/receipt";
import { buildReceiptInner, measureReceiptHeight, wrapPrintHtml } from "../lib/receiptHtml";
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

  // Measure exact content height so the @page size is tight (no blank space)
  const contentHeightMm = measureReceiptHeight(inner, rules.contentMm);
  const pageHeightMm = clampHeightMm(contentHeightMm + 2);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Receipt - Print</title>
<style>
  @page {
    size: ${rules.paperMm}mm ${pageHeightMm}mm;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${rules.paperMm}mm; height: ${pageHeightMm}mm; overflow: hidden; background: #fff; }
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