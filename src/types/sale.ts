import type { ProductReturn } from "./return";

export interface SaleItemInput {
  sale_item_id?: number | null;
  item_type: "phone" | "accessory";
  item_id: number;
  quantity: number;
  imei_id?: number | null;
  unit_price?: number | null;
  warranty?: string | null;
  warranty_expiry?: string | null;
}

export interface SalePaymentInput {
  amount: number;
  payment_method: string;
  reference?: string | null;
  notes?: string | null;
}

export interface CreateSaleInput {
  member_id?: number | null;
  discount: number;
  paid_amount?: number | null;
  payment_method?: string | null;
  notes?: string | null;
  items: SaleItemInput[];
  /** Split payments: when provided, overrides paid_amount and payment_method. */
  payments?: SalePaymentInput[];
}

export interface SaleItem {
  id: number;
  sale_id: number;
  item_type: "phone" | "accessory";
  item_id: number;
  imei_id?: number | null;
  quantity: number;
  unit_price: number;
  product_name?: string | null;
  imei?: string | null;
  variant?: string | null;
  serial_no?: string | null;
  warranty?: string | null;
  warranty_expiry?: string | null;
}

export interface SalePayment {
  id: number;
  sale_id: number;
  amount: number;
  payment_method: string;
  reference?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface Sale {
  id: number;
  receipt_no: string;
  member_id?: number | null;
  member_name?: string | null;
  member_phone?: string | null;
  total_amount: number;
  discount: number;
  paid_amount: number;
  payment_method: string;
  notes?: string | null;
  created_by?: number | null;
  created_at: string;
  items: SaleItem[];
  /** Total quantity of items sold (populated in both list and detail). */
  sold_qty: number;
  /** "none" | "partial" | "full" */
  return_status?: string;
  returned_amount?: number;
  return_count?: number;
  /** Full return records (detail view only, empty in lists). */
  returns?: ProductReturn[];
  /** Split payment entries (detail view only, empty in lists). */
  sale_payments?: SalePayment[];
}

export const PAYMENT_METHODS = ["cash", "bank_transfer", "jazzcash", "easypaisa", "card", "cheque", "other"] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  jazzcash: "JazzCash",
  easypaisa: "EasyPaisa",
  card: "Card",
  cheque: "Cheque",
  other: "Other",
};
