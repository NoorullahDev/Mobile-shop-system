import { formatDateTime, formatMoney } from "./format";
import { PAYMENT_METHOD_LABELS } from "../types/sale";
import type { ReceiptData } from "../types/receipt";

export function buildA4InvoiceInner(data: ReceiptData): string {
  const cur = data.business.currency;
  const money = (n: number) => formatMoney(n, cur);
  const splitPayments = data.splitPayments;

  const itemRows = data.items
    .map(
      (it, i) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1F2937">${i + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1F2937">
          ${esc(it.name)}
          ${it.variant ? `<br><span style="font-size:11px;color:#6B7280">Variant: ${esc(it.variant)}</span>` : ""}
          ${it.serial ? `<br><span style="font-size:11px;color:#6B7280">Serial: ${esc(it.serial)}</span>` : ""}
          ${it.imei ? `<br><span style="font-size:11px;color:#6B7280">IMEI: ${esc(it.imei)}</span>` : ""}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1F2937;text-align:center">${it.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1F2937;text-align:right">${money(it.price)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1F2937;text-align:right;font-weight:600">${money(it.total)}</td>
      </tr>`,
    )
    .join("");

  let paymentRows = "";
  if (splitPayments && splitPayments.length > 0) {
    paymentRows = splitPayments
      .map(
        (sp) => `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1F2937">${PAYMENT_METHOD_LABELS[sp.method] ?? sp.method}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1F2937;text-align:right;font-weight:500">${money(sp.amount)}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #E5E7EB;font-size:12px;color:#6B7280">${esc(sp.reference ?? "")}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #E5E7EB;font-size:12px;color:#6B7280">${sp.datetime ? esc(formatDateTime(sp.datetime)) : ""}</td>
        </tr>`,
      )
      .join("");
  } else {
    const label = PAYMENT_METHOD_LABELS[data.totals.paymentMethod] ?? data.totals.paymentMethod;
    paymentRows = `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1F2937">${esc(label)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1F2937;text-align:right;font-weight:500">${money(data.totals.paid)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #E5E7EB;font-size:12px;color:#6B7280"></td>
      <td style="padding:6px 12px;border-bottom:1px solid #E5E7EB;font-size:12px;color:#6B7280">${esc(formatDateTime(data.invoice.datetime))}</td>
    </tr>`;
  }

  return `
<div style="max-width:750px;margin:0 auto;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1F2937;background:#fff">

  <!-- Header -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <tr>
      <td style="vertical-align:top;width:58%">
        ${data.business.logo ? `<img src="${esc(data.business.logo)}" style="max-height:56px;max-width:180px;margin-bottom:6px" />` : ""}
        <div style="font-size:18px;font-weight:700;color:#111827;line-height:1.3">${esc(data.business.name)}</div>
        ${data.business.address ? `<div style="font-size:11px;color:#6B7280;margin-top:3px;line-height:1.4">${esc(data.business.address)}</div>` : ""}
        ${data.business.phone ? `<div style="font-size:11px;color:#6B7280;margin-top:1px">Phone: ${esc(data.business.phone)}</div>` : ""}
        ${data.business.email ? `<div style="font-size:11px;color:#6B7280;margin-top:1px">Email: ${esc(data.business.email)}</div>` : ""}
      </td>
      <td style="vertical-align:top;text-align:right;width:42%;padding-top:4px">
        <div style="font-size:26px;font-weight:700;color:#2563EB;letter-spacing:1px;margin-bottom:8px">INVOICE</div>
        <div style="font-size:12px;color:#6B7280;margin-top:4px"><strong style="color:#374151">Invoice #:</strong> ${esc(data.invoice.receiptNo)}</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px"><strong style="color:#374151">Date:</strong> ${esc(formatDateTime(data.invoice.datetime))}</div>
      </td>
    </tr>
  </table>

  ${data.customer?.name ? `
  <!-- Customer Info -->
  <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px;padding:12px 16px;margin-bottom:24px">
    <div style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Bill To</div>
    <div style="font-size:14px;font-weight:600;color:#111827">${esc(data.customer.name)}</div>
    ${data.customer.phone ? `<div style="font-size:12px;color:#6B7280;margin-top:2px">Phone: ${esc(data.customer.phone)}</div>` : ""}
  </div>` : ""}

  <!-- Items Table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead>
      <tr style="background:#F3F4F6">
        <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:2px solid #D1D5DB">#</th>
        <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:2px solid #D1D5DB">Description</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#374151;border-bottom:2px solid #D1D5DB">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#374151;border-bottom:2px solid #D1D5DB">Unit Price</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#374151;border-bottom:2px solid #D1D5DB">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
    <table style="width:320px;border-collapse:collapse">
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:#6B7280">Subtotal</td>
        <td style="padding:6px 12px;font-size:13px;color:#1F2937;text-align:right">${money(data.totals.subtotal)}</td>
      </tr>
      ${data.totals.discount > 0 ? `<tr>
        <td style="padding:6px 12px;font-size:13px;color:#6B7280">Discount</td>
        <td style="padding:6px 12px;font-size:13px;color:#DC2626;text-align:right">-${money(data.totals.discount)}</td>
      </tr>` : ""}
      <tr>
        <td style="padding:8px 12px;font-size:15px;font-weight:700;color:#111827;border-top:2px solid #D1D5DB">Total</td>
        <td style="padding:8px 12px;font-size:15px;font-weight:700;color:#111827;text-align:right;border-top:2px solid #D1D5DB">${money(data.totals.total)}</td>
      </tr>
    </table>
  </div>

  <!-- Payment Breakdown -->
  <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px;padding:12px 16px;margin-bottom:24px">
    <div style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Payment Details</div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th style="padding:4px 12px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB">Method</th>
          <th style="padding:4px 12px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB">Amount</th>
          <th style="padding:4px 12px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB">Reference</th>
          <th style="padding:4px 12px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB">Date &amp; Time</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRows}
      </tbody>
      <tfoot>
        <tr>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#111827;border-top:2px solid #D1D5DB">Total Paid</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#16A34A;text-align:right;border-top:2px solid #D1D5DB">${money(data.totals.paid)}</td>
          <td style="border-top:2px solid #D1D5DB" colspan="2"></td>
        </tr>
        <tr>
          <td style="padding:6px 12px;font-size:13px;font-weight:600;color:${data.totals.balance > 0 ? "#DC2626" : "#374151"}">Remaining Due</td>
          <td style="padding:6px 12px;font-size:13px;font-weight:600;color:${data.totals.balance > 0 ? "#DC2626" : "#16A34A"};text-align:right">${money(data.totals.balance)}</td>
          <td colspan="2"></td>
        </tr>
        <tr>
          <td style="padding:6px 12px;font-size:13px;font-weight:700;color:#374151">Status</td>
          <td style="padding:6px 12px;font-size:13px;font-weight:700;color:${data.totals.status === "paid" ? "#16A34A" : data.totals.status === "partial" ? "#B45309" : "#DC2626"};text-align:right;text-transform:uppercase">${data.totals.status}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Footer -->
  <div style="text-align:center;border-top:1px solid #E5E7EB;padding-top:16px;margin-top:24px">
    <div style="font-size:12px;color:#6B7280">Thank you for your business!</div>
    <div style="font-size:10px;color:#9CA3AF;margin-top:8px">Software developed by EagleNest Creations · 0346-4451505</div>
  </div>

</div>`;
}

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildA4InvoicePrintHtml(data: ReceiptData): string {
  const inner = buildA4InvoiceInner(data);
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Invoice - ${esc(data.invoice.receiptNo)}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; background: #fff; }
  body { padding: 12mm; }
</style>
</head><body>${inner}</body></html>`;
}
