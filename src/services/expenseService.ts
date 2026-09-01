import { invoke } from "@tauri-apps/api/core";
import type {
  Category,
  CategoryTotal,
  CreateCategoryInput,
  CreateExpenseInput,
  Expense,
} from "../types/expense";

export async function createCategory(
  input: CreateCategoryInput,
  actor?: number | null,
): Promise<Category> {
  return invoke<Category>("create_category", { input, actor: actor ?? null });
}

export async function listCategories(): Promise<Category[]> {
  return invoke<Category[]>("list_categories");
}

export async function updateCategory(
  id: number,
  input: CreateCategoryInput,
  actor?: number | null,
): Promise<Category> {
  return invoke<Category>("update_category", { id, input, actor: actor ?? null });
}

export async function deleteCategory(
  id: number,
  actor?: number | null,
): Promise<void> {
  return invoke<void>("delete_category", { id, actor: actor ?? null });
}

export async function createExpense(
  input: CreateExpenseInput,
  actor?: number | null,
): Promise<Expense> {
  return invoke<Expense>("create_expense", { input, actor: actor ?? null });
}

export async function listExpenses(
  categoryId?: number | null,
  from?: string | null,
  to?: string | null,
): Promise<Expense[]> {
  return invoke<Expense[]>("list_expenses", {
    categoryId: categoryId ?? null,
    from: from ?? null,
    to: to ?? null,
  });
}

export async function getExpense(id: number): Promise<Expense> {
  return invoke<Expense>("get_expense", { id });
}

export async function deleteExpense(
  id: number,
  actor?: number | null,
): Promise<void> {
  return invoke<void>("delete_expense", { id, actor: actor ?? null });
}

export async function expenseCategoryTotals(
  from: string,
  to: string,
): Promise<CategoryTotal[]> {
  return invoke<CategoryTotal[]>("expense_category_totals", { from, to });
}

export async function totalExpensesInRange(
  from: string,
  to: string,
): Promise<number> {
  return invoke<number>("total_expenses_in_range", { from, to });
}
