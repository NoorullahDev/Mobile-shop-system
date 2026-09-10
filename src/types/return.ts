import { PAYMENT_METHODS } from "./sale";

export type ReturnCondition =
  | "sellable"
  | "good"
  | "used"
  | "damaged"
  | "defective"
  | "nonsellable";

export interface ReturnItemInput {
  sale_item_id: number;
  quantity: number;
  imei_id?: number | null;
  reason?: string | null;
  condition: string;
}

export interface CreateReturnInput {
  sale_id: number;
  return_charge_percent: number;
  fixed_deduction?: number | null;
  refund_method?: string | null;
  return_date?: string | null;
  notes?: string | null;
  items: ReturnItemInput[];
}

export interface ReturnItem {
  id: number;
  return_id: number;
  sale_item_id: number;
  item_type: "phone" | "accessory";
  item_id: number;
  imei_id?: number | null;
  product_name?: string | null;
  imei?: string | null;
  serial_no?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  deduction_amount: number;
  refund_amount: number;
  reason?: string | null;
  condition: string;
  restocked: boolean;
  created_at: string;
}

export interface ReturnSummary {
  id: number;
  return_no: string;
  sale_id: number;
  receipt_no?: string | null;
  member_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  total_sale_price: number;
  deduction_amount: number;
  refund_amount: number;
  return_charge_percent: number;
  refund_method: string;
  return_date?: string | null;
  condition: string;
  status: string;
  reason?: string | null;
  notes?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
  item_count: number;
}

export interface ProductReturn extends Omit<ReturnSummary, "item_count"> {
  items: ReturnItem[];
}

export const RETURN_CONDITIONS: { value: string; label: string; restock: boolean }[] = [
  { value: "sellable", label: "Sellable / Working", restock: true },
  { value: "good", label: "Good", restock: true },
  { value: "used", label: "Used", restock: true },
  { value: "damaged", label: "Damaged", restock: false },
  { value: "defective", label: "Defective", restock: false },
  { value: "nonsellable", label: "Non-sellable", restock: false },
];

export const RETURN_CHARGE_OPTIONS = [
  { value: "0", label: "No Restocking Charge (0%)" },
  { value: "10", label: "10% Restocking Charge" },
  { value: "20", label: "20% Restocking Charge" },
  { value: "30", label: "30% Restocking Charge" },
  { value: "custom", label: "Custom Percentage…" },
] as const;

export const REFUND_METHODS = PAYMENT_METHODS;