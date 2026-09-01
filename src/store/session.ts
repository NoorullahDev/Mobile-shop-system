import { create } from "zustand";
import type { SessionUser } from "../types/session";
import * as authService from "../services/authService";

interface SessionState {
  user: SessionUser | null;
  checking: boolean;
  error: string | null;
  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearDefaultPassword: (userId: number) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  checking: true,
  error: null,

  init: async () => {
    set({ checking: true });
    try {
      const user = await authService.getCurrentUser();
      set({ user, checking: false, error: null });
    } catch (e) {
      set({ checking: false, error: String(e) });
    }
  },

  login: async (username, password) => {
    set({ error: null, checking: true });
    try {
      const user = await authService.login(username, password);
      set({ user, checking: false, error: null });
    } catch (e) {
      set({ checking: false, error: String(e) });
      throw e;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } finally {
      set({ user: null, error: null });
    }
  },

  clearDefaultPassword: (userId: number) =>
    set((s) => ({
      user: s.user && s.user.id === userId ? { ...s.user, default_password: false } : s.user,
    })),
}));
