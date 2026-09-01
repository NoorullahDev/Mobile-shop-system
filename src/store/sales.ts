import { create } from "zustand";
import type { CreateSaleInput, Sale } from "../types/sale";
import * as saleService from "../services/saleService";

interface SalesState {
  sales: Sale[];
  loading: boolean;
  error: string | null;
  load: (search?: string) => Promise<void>;
  add: (input: CreateSaleInput, actor?: number | null) => Promise<Sale | null>;
}

export const useSaleStore = create<SalesState>((set) => ({
  sales: [],
  loading: false,
  error: null,

  load: async (search) => {
    set({ loading: true, error: null });
    try {
      const sales = await saleService.listSales(search);
      set({ sales, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  add: async (input, actor) => {
    set({ error: null });
    try {
      const created = await saleService.createSale(input, actor ?? null);
      set((s) => ({ sales: [created, ...s.sales] }));
      return created;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },
}));
