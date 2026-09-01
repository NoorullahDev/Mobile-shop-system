export interface PurchaseItemInput {
  item_type: "phone" | "accessory";
  item_id: number;
  quantity: number;
  unit_cost?: number | null;
  imeis: string[];
}

export interface CreatePurchaseInput {
  supplier_id?: number | null;
  discount: number;
  paid_amount?: number | null;
  payment_method?: string | null;
  notes?: string | null;
  items: PurchaseItemInput[];
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  item_type: "phone" | "accessory";
  item_id: number;
  quantity: number;
  unit_cost: number;
  product_name?: string | null;
  line_total: number;
}

export interface Purchase {
  id: number;
  purchase_no: string;
  supplier_id?: number | null;
  supplier_name?: string | null;
  total_amount: number;
  discount: number;
  paid_amount: number;
  payment_method: string;
  notes?: string | null;
  created_by?: number | null;
  created_at: string;
  items: PurchaseItem[];
}

export interface CreateSupplierPaymentInput {
  supplier_id?: number | null;
  amount: number;
  payment_method?: string | null;
  status?: string | null;
  reference?: string | null;
  notes?: string | null;
  payment_date?: string | null;
}

export interface SupplierPayment {
  id: number;
  supplier_id?: number | null;
  supplier_name?: string | null;
  amount: number;
  payment_method: string;
  status: string;
  reference?: string | null;
  notes?: string | null;
  payment_date: string;
  created_by?: number | null;
  created_at: string;
  is_deleted: boolean;
}

export interface SupplierBalance {
  supplier_id: number;
  supplier_name: string;
  phone?: string | null;
  total_purchases: number;
  total_paid: number;
  balance: number;
  payment_count: number;
}

export const PURCHASE_PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"] as const;
export const SUPPLIER_PAYMENT_STATUSES = ["completed", "pending", "cancelled", "refunded"] as const;
