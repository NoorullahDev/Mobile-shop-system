import { create } from "zustand";
import type { CreateSupplierInput, Supplier } from "../types/inventory";
import * as supplierService from "../services/supplierService";

interface SuppliersState {
  suppliers: Supplier[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (input: CreateSupplierInput) => Promise<void>;
  update: (id: number, input: CreateSupplierInput) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useSupplierStore = create<SuppliersState>((set) => ({
  suppliers: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const suppliers = await supplierService.listSuppliers();
      set({ suppliers, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  add: async (input) => {
    set({ error: null });
    try {
      const created = await supplierService.createSupplier(input);
      set((s) => ({ suppliers: [...s.suppliers, created] }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  update: async (id, input) => {
    set({ error: null });
    try {
      const updated = await supplierService.updateSupplier(id, input);
      set((s) => ({
        suppliers: s.suppliers.map((x) => (x.id === id ? updated : x)),
      }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await supplierService.deleteSupplier(id);
      set((s) => ({ suppliers: s.suppliers.filter((x) => x.id !== id) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },
}));
