export interface DashboardSummary {
  revenue: number;
  expenses: number;
  profit: number;
  today_revenue: number;
  today_sales_count: number;
  members_total: number;
  members_active: number;
  products_total: number;
  low_stock_count: number;
  pending_payments: number;
}

export interface MonthlyPoint {
  month: string;
  total: number;
}

export interface ActivityLog {
  id: number;
  user_id?: number | null;
  module: string;
  action: string;
  record_id?: number | null;
  timestamp: string;
}

export interface PeriodSummary {
  from: string;
  to: string;
  revenue: number;
  expenses: number;
  profit: number;
  sales_count: number;
  received: number;
  discount: number;
  outstanding: number;
}

export interface SalePoint {
  day: string;
  total: number;
}

export interface TopSeller {
  item_type: "phone" | "accessory";
  item_id: number;
  product_name: string;
  quantity: number;
  revenue: number;
}

export interface PaymentBreakdown {
  payment_method: string;
  total: number;
  count: number;
}

export interface OnlinePaymentRecord {
  id: number;
  sale_id: number;
  receipt_no: string;
  customer_name: string | null;
  payment_method: string;
  amount: number;
  reference: string | null;
  account_details: string | null;
  notes: string | null;
  created_at: string;
}

export interface MonthlyProfitPoint {
  month: string;
  revenue: number;
  cogs: number;
  expenses: number;
  gross_profit: number;
  net_profit: number;
}

export interface ProfitLoss {
  from: string;
  to: string;
  total_revenue: number;
  total_cogs: number;
  total_expenses: number;
  gross_profit: number;
  net_profit: number;
  sales_count: number;
  monthly: MonthlyProfitPoint[];
}

export type ReportType =
  | "all"
  | "sales-pos"
  | "sales-history"
  | "returns"
  | "products"
  | "inventory"
  | "purchases"
  | "customers"
  | "customer-dues"
  | "suppliers"
  | "supplier-dues"
  | "expenses"
  | "profit-loss"
  | "online-payments";
