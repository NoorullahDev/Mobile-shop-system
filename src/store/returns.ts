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
  update: (id: number, input: CreateReturnInput, actor?: number | null) => Promise<ProductReturn>;
  remove: (id: number, actor?: number | null) => Promise<void>;
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

  update: async (id, input, actor) => {
    const updated = await returnService.updateReturn(id, input, actor);
    const summary: ReturnSummary = { ...updated, item_count: updated.items.length };
    set((state) => ({ returns: state.returns.map((item) => item.id === id ? summary : item) }));
    return updated;
  },

  remove: async (id, actor) => {
    await returnService.deleteReturn(id, actor);
    set((state) => ({ returns: state.returns.filter((item) => item.id !== id) }));
  },
}));
