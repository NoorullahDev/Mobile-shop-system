import { roundMoney } from "./format";
import type { Sale } from "../types/sale";
import type { ReceiptData, ReceiptItemData, ReceiptSettings } from "../types/receipt";

export const PAPER_RULES = {
  "58mm": { paperMm: 58, contentMm: 48, logoMm: 40, qtyMm: 9, amountMm: 20 },
  "80mm": { paperMm: 80, contentMm: 72, logoMm: 56, qtyMm: 10, amountMm: 24 },
} as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
};

export interface ReceiptBusiness {
  name: string;
  logo: string | null;
  phone: string;
  email: string;
  address: string;
  currency: "PKR" | "USD";
}

export function buildReceiptData(
  sale: Sale,
  business: ReceiptBusiness,
  settings: ReceiptSettings,
): ReceiptData {
  const items: ReceiptItemData[] = sale.items.map((it) => ({
    name: it.product_name ?? "Item",
    variant: it.variant ?? null,
    serial: it.serial_no ?? null,
    imei: it.imei ?? null,
    qty: it.quantity,
    price: roundMoney(it.unit_price),
    total: roundMoney(it.unit_price * it.quantity),
  }));

  const subtotal = roundMoney(items.reduce((s, i) => s + i.total, 0));
  const discount = roundMoney(sale.discount || 0);
  const total = roundMoney(sale.total_amount);
  const paid = roundMoney(sale.paid_amount || 0);
  const balance = roundMoney(Math.max(0, total - paid));

  return {
    business: {
      name: business.name || "Your Shop Name",
      logo: business.logo,
      tagline: settings.tagline,
      address: business.address,
      phone: business.phone,
      email: business.email,
      currency: business.currency,
    },
    invoice: {
      receiptNo: sale.receipt_no,
      datetime: sale.created_at,
    },
    customer:
      sale.member_name != null
        ? { name: sale.member_name, phone: sale.member_phone ?? null }
        : null,
    items,
    totals: {
      subtotal,
      discount,
      total,
      paid,
      paymentMethod: sale.payment_method ?? "",
      balance,
    },
  };
}