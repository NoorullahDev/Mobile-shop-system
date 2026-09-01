import { create } from "zustand";
import type { CreatePurchaseInput, Purchase } from "../types/purchase";
import * as purchaseService from "../services/purchaseService";

interface PurchasesState {
  purchases: Purchase[];
  loading: boolean;
  error: string | null;
  load: (search?: string) => Promise<void>;
  add: (input: CreatePurchaseInput, actor?: number | null) => Promise<void>;
}

export const usePurchaseStore = create<PurchasesState>((set) => ({
  purchases: [],
  loading: false,
  error: null,

  load: async (search) => {
    set({ loading: true, error: null });
    try {
      const purchases = await purchaseService.listPurchases(search);
      set({ purchases, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  add: async (input, actor) => {
    set({ error: null });
    try {
      const created = await purchaseService.createPurchase(input, actor ?? null);
      set((s) => ({ purchases: [created, ...s.purchases] }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },
}));
