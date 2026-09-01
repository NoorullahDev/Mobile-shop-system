export interface Payment {
  id: number;
  member_id?: number | null;
  member_name?: string | null;
  amount: number;
  payment_method: string;
  payment_type?: string | null;
  status: string;
  reference?: string | null;
  notes?: string | null;
  payment_date: string;
  created_by?: number | null;
  created_at: string;
  is_deleted: boolean;
}

export interface CreatePaymentInput {
  member_id?: number | null;
  amount: number;
  payment_method: string;
  payment_type?: string | null;
  status?: string | null;
  reference?: string | null;
  notes?: string | null;
  payment_date?: string | null;
}

export interface MemberBalance {
  member_id: number;
  member_name: string;
  phone?: string | null;
  total_credit: number;
  total_paid: number;
  balance: number;
  payment_count: number;
}

export const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "other"] as const;
export const PAYMENT_STATUSES = ["completed", "pending", "cancelled", "refunded"] as const;
