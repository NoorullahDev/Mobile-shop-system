import { create } from "zustand";
import type { CreateProductCategoryInput, ProductCategory } from "../types/inventory";
import * as productCategoryService from "../services/productCategoryService";

interface ProductCategoriesState {
  categories: ProductCategory[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (input: CreateProductCategoryInput, actor?: number | null) => Promise<ProductCategory | null>;
  update: (id: number, input: CreateProductCategoryInput, actor?: number | null) => Promise<ProductCategory | null>;
  remove: (id: number, actor?: number | null) => Promise<void>;
}

export const useProductCategoryStore = create<ProductCategoriesState>((set) => ({
  categories: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const categories = await productCategoryService.listProductCategories();
      set({ categories, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  add: async (input, actor) => {
    set({ error: null });
    try {
      const created = await productCategoryService.createProductCategory(input, actor ?? null);
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
      const updated = await productCategoryService.updateProductCategory(id, input, actor ?? null);
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
      await productCategoryService.deleteProductCategory(id, actor ?? null);
      set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },
}));