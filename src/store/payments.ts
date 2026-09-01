import { create } from "zustand";
import type { CreatePaymentInput, Payment } from "../types/payment";
import * as paymentService from "../services/paymentService";

interface PaymentsState {
  payments: Payment[];
  loading: boolean;
  error: string | null;
  load: (search?: string) => Promise<void>;
  add: (input: CreatePaymentInput, actor?: number | null) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const usePaymentStore = create<PaymentsState>((set) => ({
  payments: [],
  loading: false,
  error: null,

  load: async (search) => {
    set({ loading: true, error: null });
    try {
      const payments = await paymentService.listPayments(search);
      set({ payments, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  add: async (input, actor) => {
    set({ error: null });
    try {
      const created = await paymentService.createPayment(input, actor ?? null);
      set((s) => ({ payments: [created, ...s.payments] }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await paymentService.deletePayment(id);
      set((s) => ({ payments: s.payments.filter((p) => p.id !== id) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },
}));
