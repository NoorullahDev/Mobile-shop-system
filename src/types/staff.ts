export interface StaffMember {
  id: number;
  user_id?: number | null;
  username?: string | null;
  name: string;
  phone: string;
  position: string;
  joining_date: string;
  monthly_salary: number;
  status: "active" | "inactive" | string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface StaffInput {
  user_id?: number | null;
  name: string;
  phone: string;
  position: string;
  joining_date: string;
  monthly_salary: number;
  status?: string | null;
  notes?: string | null;
}

export interface SalaryRecord {
  id: number;
  staff_id: number;
  staff_name: string;
  salary_month: string;
  base_salary: number;
  bonus: number;
  deduction: number;
  net_salary: number;
  amount_paid: number;
  remaining_balance: number;
  payment_status: "Paid" | "Partial" | "Unpaid" | string;
  payment_date?: string | null;
  payment_time?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  expense_id?: number | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface SalaryInput {
  staff_id: number;
  salary_month: string;
  base_salary: number;
  bonus?: number | null;
  deduction?: number | null;
  amount_paid: number;
  payment_date?: string | null;
  payment_time?: string | null;
  payment_method?: string | null;
  notes?: string | null;
}
