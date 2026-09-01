import { create } from "zustand";
import type { Category, CreateCategoryInput } from "../types/expense";
import * as expenseService from "../services/expenseService";

interface CategoriesState {
  categories: Category[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (input: CreateCategoryInput, actor?: number | null) => Promise<Category | null>;
  update: (id: number, input: CreateCategoryInput, actor?: number | null) => Promise<Category | null>;
  remove: (id: number, actor?: number | null) => Promise<void>;
}

export const useCategoryStore = create<CategoriesState>((set) => ({
  categories: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const categories = await expenseService.listCategories();
      set({ categories, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  add: async (input, actor) => {
    set({ error: null });
    try {
      const created = await expenseService.createCategory(input, actor ?? null);
      set((s) => ({ categories: [...s.categories, created] }));
      return created;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  update: async (id, input, actor) => {
    set({ error: null });
    try {
      const updated = await expenseService.updateCategory(id, input, actor ?? null);
      set((s) => ({
        categories: s.categories.map((c) => (c.id === id ? updated : c)),
      }));
      return updated;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  remove: async (id, actor) => {
    set({ error: null });
    try {
      await expenseService.deleteCategory(id, actor ?? null);
      set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },
}));
