import type { Currency } from "../lib/format";

export type ReceiptPaperWidth = "58mm" | "80mm";

export interface ReceiptVisibility {
  showLogo: boolean;
  showShopName: boolean;
  showTagline: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showTitle: boolean;
  showInvoice: boolean;
  showDatetime: boolean;
  showCustomer: boolean;
  showCustomerPhone: boolean;
  showVariant: boolean;
  showSerial: boolean;
  showImei: boolean;
  showPaymentDetails: boolean;
  showFooter: boolean;
  showSoftwareCredit: boolean;
}

export interface ReceiptSettings extends ReceiptVisibility {
  paperWidth: ReceiptPaperWidth;
  fontSize: number;
  printer: string;
  useSystemPrintDialog: boolean;
  footerText: string;
  tagline: string;
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  paperWidth: "80mm",
  fontSize: 11,
  printer: "",
  useSystemPrintDialog: false,
  footerText: "Thank you for your purchase!",
  tagline: "",
  showLogo: true,
  showShopName: true,
  showTagline: true,
  showAddress: true,
  showPhone: true,
  showEmail: true,
  showTitle: true,
  showInvoice: true,
  showDatetime: true,
  showCustomer: true,
  showCustomerPhone: true,
  showVariant: true,
  showSerial: true,
  showImei: true,
  showPaymentDetails: true,
  showFooter: true,
  showSoftwareCredit: true,
};

export interface ReceiptItemData {
  name: string;
  variant?: string | null;
  serial?: string | null;
  imei?: string | null;
  qty: number;
  price: number;
  total: number;
}

export interface ReceiptData {
  business: {
    name: string;
    logo: string | null;
    tagline: string;
    address: string;
    phone: string;
    email: string;
    currency: Currency;
  };
  invoice: {
    receiptNo: string;
    datetime: string;
  };
  customer: { name: string | null; phone: string | null } | null;
  items: ReceiptItemData[];
  totals: {
    subtotal: number;
    discount: number;
    total: number;
    paid: number;
    paymentMethod: string;
    balance: number;
  };
}

export const PAPER_WIDTHS: ReceiptPaperWidth[] = ["80mm", "58mm"];
export const FONT_SIZES: number[] = [9, 10, 11, 12, 13, 14];