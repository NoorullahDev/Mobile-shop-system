import { create } from "zustand";
import type { CreateReturnInput, ProductReturn, ReturnSummary } from "../types/return";
import * as returnService from "../services/returnService";

interface ReturnsState {
  returns: ReturnSummary[];
  loading: boolean;
  error: string | null;
  load: (search?: string) => Promise<void>;
  add: (input: CreateReturnInput, actor?: number | null) => Promise<ProductReturn | null>;
  get: (id: number) => Promise<ProductReturn | null>;
}

export const useReturnStore = create<ReturnsState>((set) => ({
  returns: [],
  loading: false,
  error: null,

  load: async (search) => {
    set({ loading: true, error: null });
    try {
      const returns = await returnService.listReturns(search);
      set({ returns, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  add: async (input, actor) => {
    set({ error: null });
    try {
      const created = await returnService.createReturn(input, actor ?? null);
      const summary: ReturnSummary = { ...created, item_count: created.items.length };
      set((s) => ({ returns: [summary, ...s.returns] }));
      return created;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  get: async (id) => {
    try {
      return await returnService.getReturn(id);
    } catch (e) {
      set({ error: String(e) });
      return null;
    }
  },
}));