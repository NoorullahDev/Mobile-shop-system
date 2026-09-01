import { create } from "zustand";
import type { CreateExpenseInput, Expense } from "../types/expense";
import * as expenseService from "../services/expenseService";

interface ExpensesState {
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  load: (categoryId?: number | null) => Promise<void>;
  add: (input: CreateExpenseInput, actor?: number | null) => Promise<Expense | null>;
  remove: (id: number, actor?: number | null) => Promise<void>;
}

export const useExpenseStore = create<ExpensesState>((set) => ({
  expenses: [],
  loading: false,
  error: null,

  load: async (categoryId) => {
    set({ loading: true, error: null });
    try {
      const expenses = await expenseService.listExpenses(categoryId ?? null);
      set({ expenses, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  add: async (input, actor) => {
    set({ error: null });
    try {
      const created = await expenseService.createExpense(input, actor ?? null);
      set((s) => ({ expenses: [created, ...s.expenses] }));
      return created;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  remove: async (id, actor) => {
    set({ error: null });
    try {
      await expenseService.deleteExpense(id, actor ?? null);
      set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },
}));
