import type { ProductReturn } from "./return";

export interface SaleItemInput {
  item_type: "phone" | "accessory";
  item_id: number;
  quantity: number;
  imei_id?: number | null;
  unit_price?: number | null;
}

export interface CreateSaleInput {
  member_id?: number | null;
  discount: number;
  paid_amount?: number | null;
  payment_method?: string | null;
  notes?: string | null;
  items: SaleItemInput[];
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
  /** "none" | "partial" | "full" */
  return_status?: string;
  returned_amount?: number;
  return_count?: number;
  /** Full return records (detail view only, empty in lists). */
  returns?: ProductReturn[];
}

export const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"] as const;
