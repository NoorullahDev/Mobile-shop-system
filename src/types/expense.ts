export interface Category {
  id: number;
  name: string;
  category_type: string;
}

export interface CreateCategoryInput {
  name: string;
  type?: string | null;
}

export interface Expense {
  id: number;
  category_id: number;
  category_name?: string | null;
  amount: number;
  description?: string | null;
  receipt_path?: string | null;
  expense_date: string;
  created_by?: number | null;
  created_at: string;
}

export interface CreateExpenseInput {
  category_id: number;
  amount: number;
  description?: string | null;
  receipt_path?: string | null;
  expense_date?: string | null;
}

export interface CategoryTotal {
  category_id: number;
  category_name: string;
  total: number;
  count: number;
}
