import { formatDateTime, formatMoney } from "./format";
import type { ReceiptData, ReceiptSettings } from "../types/receipt";
import { PAPER_RULES, PAYMENT_METHOD_LABELS } from "./receiptLayout";

const MM_TO_PX = 96 / 25.4;

export function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

export function wrapPrintHtml(inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="margin:0;padding:0;background:#fff;">${inner}</body></html>`;
}

export function buildReceiptInner(data: ReceiptData, settings: ReceiptSettings): string {
  const fs = settings.fontSize;
  const sub = Math.max(8, fs - 2);
  const meta = Math.max(9, fs - 1);
  const shop = fs + 2;
  const grand = fs + 1;
  const rules = PAPER_RULES[settings.paperWidth];
  const cur = data.business.currency;
  const money = (n: number) => formatMoney(n, cur);

  const parts: string[] = [];

  if (settings.showLogo && data.business.logo) {
    parts.push(`<img class="rp-logo" alt="" src="${esc(data.business.logo)}" />`);
  }
  if (settings.showShopName && data.business.name) {
    parts.push(`<div class="rp-center rp-shop">${esc(data.business.name)}</div>`);
  }
  if (settings.showTagline && data.business.tagline) {
    parts.push(`<div class="rp-center rp-tag">${esc(data.business.tagline)}</div>`);
  }
  const contact: string[] = [];
  if (settings.showAddress && data.business.address) contact.push(esc(data.business.address));
  if (settings.showPhone && data.business.phone) contact.push(esc(data.business.phone));
  if (settings.showEmail && data.business.email) contact.push(esc(data.business.email));
  if (contact.length) {
    parts.push(`<div class="rp-center rp-contact">${contact.join(" · ")}</div>`);
  }
  parts.push(`<div class="rp-dash"></div>`);

  if (settings.showTitle) {
    parts.push(`<div class="rp-center rp-title">Receipt</div>`);
  }
  if (settings.showInvoice) {
    parts.push(
      `<div class="rp-center rp-meta"><span class="rp-inv">Invoice #: ${esc(data.invoice.receiptNo)}</span></div>`,
    );
  }
  if (settings.showDatetime) {
    parts.push(`<div class="rp-center rp-meta">${esc(formatDateTime(data.invoice.datetime))}</div>`);
  }

  if (settings.showCustomer && data.customer?.name) {
    parts.push(
      `<div class="rp-meta" style="margin-top:1mm"><span class="rp-label">Customer:</span> ${esc(data.customer.name)}</div>`,
    );
    if (settings.showCustomerPhone && data.customer.phone) {
      parts.push(
        `<div class="rp-meta"><span class="rp-label">Phone:</span> ${esc(data.customer.phone)}</div>`,
      );
    }
  }

  parts.push(`<div class="rp-dash"></div>`);

  const rows: string[] = [];
  for (const it of data.items) {
    const detail: string[] = [];
    if (settings.showVariant && it.variant) detail.push(`Variant: ${esc(it.variant)}`);
    if (settings.showSerial && it.serial) detail.push(`Serial: ${esc(it.serial)}`);
    if (settings.showImei && it.imei) detail.push(`IMEI: ${esc(it.imei)}`);
    rows.push(
      `<tr>` +
        `<td><div class="rp-item">${esc(it.name)}</div>` +
        `${detail.length ? `<div class="rp-sub">${detail.join(" · ")}</div>` : ""}</td>` +
        `<td class="rp-qty">${it.qty}</td>` +
        `<td class="rp-amt">${money(it.total)}</td>` +
        `</tr>`,
    );
  }
  parts.push(
    `<table><colgroup><col class="rp-col-desc" /><col class="rp-col-qty" /><col class="rp-col-amt" /></colgroup>` +
      `<thead><tr><th>Description</th><th class="rp-qty">Qty</th><th class="rp-amt">Amount</th></tr></thead>` +
      `<tbody>${rows.join("")}</tbody></table>`,
  );

  parts.push(`<div class="rp-dash"></div>`);

  if (settings.showPaymentDetails) {
    const tot: string[] = [];
    tot.push(
      `<div class="rp-row"><span>Subtotal</span><span>${money(data.totals.subtotal)}</span></div>`,
    );
    if (data.totals.discount > 0) {
      tot.push(
        `<div class="rp-row rp-disc"><span>Discount</span><span>-${money(data.totals.discount)}</span></div>`,
      );
    }
    tot.push(`<div class="rp-row rp-grand"><span>Total</span><span>${money(data.totals.total)}</span></div>`);
    tot.push(`<div class="rp-row"><span>Paid</span><span>${money(data.totals.paid)}</span></div>`);
    if (data.totals.balance > 0) {
      tot.push(
        `<div class="rp-row rp-dues"><span>Balance Due</span><span>${money(data.totals.balance)}</span></div>`,
      );
    }
    if (data.totals.paymentMethod) {
      const label = PAYMENT_METHOD_LABELS[data.totals.paymentMethod] ?? data.totals.paymentMethod;
      tot.push(`<div class="rp-row rp-meta"><span>Payment</span><span>${esc(label)}</span></div>`);
    }
    parts.push(tot.join(""));
  }

  if (settings.showFooter && settings.footerText && settings.footerText.trim()) {
    parts.push(`<div class="rp-footer">${esc(settings.footerText.trim())}</div>`);
  }
  if (settings.showSoftwareCredit) {
    parts.push(
      `<div class="rp-credit">Software developed by EagleNest Creations · 0346-4451505</div>`,
    );
  }

  const css = `
.receipt .rp-center{text-align:center}
.receipt .rp-logo{display:block;margin:0 auto 2mm;max-width:100%;max-height:30mm;height:auto}
.receipt .rp-shop{font-weight:700;text-transform:uppercase;letter-spacing:.3px;font-size:${shop}px}
.receipt .rp-tag{font-style:italic;color:#333;font-size:${meta}px;margin-top:.5mm}
.receipt .rp-contact{font-size:${meta}px;margin-top:.5mm;color:#222}
.receipt .rp-dash{border-top:1px dashed #222;margin:1.6mm 0}
.receipt .rp-title{font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.6mm}
.receipt .rp-meta{font-size:${meta}px}
.receipt .rp-inv{font-weight:600}
.receipt .rp-label{font-weight:600}
.receipt table{width:100%;table-layout:fixed;border-collapse:collapse}
.receipt .rp-col-desc{width:auto}
.receipt .rp-col-qty{width:${rules.qtyMm}mm}
.receipt .rp-col-amt{width:${rules.amountMm}mm}
.receipt thead th{font-size:${meta}px;text-align:left;border-bottom:1px solid #000;padding-bottom:.6mm}
.receipt thead th.rp-qty{text-align:center;white-space:nowrap}
.receipt thead th.rp-amt{text-align:right;white-space:nowrap}
.receipt .rp-qty{text-align:center;white-space:nowrap}
.receipt .rp-amt{text-align:right;overflow-wrap:anywhere;word-break:break-word}
.receipt tbody td{vertical-align:top;padding:.6mm 0 0}
.receipt .rp-item{overflow-wrap:anywhere;word-break:break-word}
.receipt .rp-sub{font-size:${sub}px;color:#333;overflow-wrap:anywhere;word-break:break-word}
.receipt .rp-row{display:flex;justify-content:space-between;font-size:${fs}px}
.receipt .rp-row>span:first-child{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.receipt .rp-row>span:last-child{flex:0 0 auto;white-space:nowrap;padding-left:2mm;text-align:right}
.receipt .rp-grand{font-weight:700;font-size:${grand}px;margin-top:.6mm}
.receipt .rp-disc{color:#333}
.receipt .rp-dues{font-weight:600}
.receipt .rp-footer{text-align:center;font-size:${meta}px;margin-top:1.5mm}
.receipt .rp-credit{margin-top:1.5mm;text-align:center;font-size:8px;color:#444}
`;

  return (
    `<div class="receipt" style="width:${rules.contentMm}mm;margin:0 auto;` +
    `font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:${fs}px;line-height:1.4;color:#000;">` +
    `<style>${css}</style>` +
    parts.join("") +
    `</div>`
  );
}

export function buildPrintHtml(data: ReceiptData, settings: ReceiptSettings): string {
  return wrapPrintHtml(buildReceiptInner(data, settings));
}

export function measureReceiptHeight(inner: string, contentMm: number): number {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = `${Math.round(contentMm * MM_TO_PX)}px`;
  iframe.style.height = "1px";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return contentMm * 4;
    doc.open();
    doc.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head>` +
        `<body style="margin:0;padding:0">${inner}</body></html>`,
    );
    doc.close();
    const px = doc.querySelector(".receipt")?.scrollHeight ?? doc.body.scrollHeight ?? 0;
    return (px * 25.4) / 96;
  } finally {
    iframe.remove();
  }
}