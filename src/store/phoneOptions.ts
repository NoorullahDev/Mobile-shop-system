import { create } from "zustand";
import type { CreatePhoneOptionInput, PhoneOption } from "../types/inventory";
import * as phoneOptionService from "../services/phoneOptionService";

interface PhoneOptionsState {
  options: PhoneOption[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (input: CreatePhoneOptionInput, actor?: number | null) => Promise<PhoneOption | null>;
  update: (id: number, input: CreatePhoneOptionInput, actor?: number | null) => Promise<PhoneOption | null>;
  remove: (id: number, actor?: number | null) => Promise<void>;
  
  // Selectors for convenience
  getOptionsByType: (type: string) => PhoneOption[];
}

export const usePhoneOptionStore = create<PhoneOptionsState>((set, get) => ({
  options: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const options = await phoneOptionService.listPhoneOptions();
      set({ options, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  add: async (input, actor) => {
    set({ error: null });
    try {
      const created = await phoneOptionService.createPhoneOption(input, actor ?? null);
      set((s) => ({ options: [...s.options, created] }));
      return created;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  update: async (id, input, actor) => {
    set({ error: null });
    try {
      const updated = await phoneOptionService.updatePhoneOption(id, input, actor ?? null);
      set((s) => ({
        options: s.options.map((o) => (o.id === id ? updated : o)),
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
      await phoneOptionService.deletePhoneOption(id, actor ?? null);
      set((s) => ({ options: s.options.filter((o) => o.id !== id) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  getOptionsByType: (type: string) => {
    const { options } = get();
    return options
      .filter((o) => o.option_type === type)
      .sort((a, b) => a.sort_order - b.sort_order || a.value.localeCompare(b.value));
  }
}));
