import { create } from "zustand";
import type { CreateUserInput, UserDetail } from "../types/user";
import * as userService from "../services/userService";

interface UsersState {
  users: UserDetail[];
  loading: boolean;
  error: string | null;
  load: (search?: string) => Promise<void>;
  add: (input: CreateUserInput, actor?: number | null) => Promise<void>;
  update: (id: number, patch: { status?: string; full_name?: string | null; email?: string | null; role_id?: number | null }, actor?: number | null) => Promise<void>;
  remove: (id: number, actor?: number | null) => Promise<void>;
}

export const useUserStore = create<UsersState>((set) => ({
  users: [],
  loading: false,
  error: null,

  load: async (search) => {
    set({ loading: true, error: null });
    try {
      const users = await userService.listUsers(search);
      set({ users, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  add: async (input, actor) => {
    set({ error: null });
    try {
      const created = await userService.createUser(input, actor ?? null);
      set((s) => ({ users: [created, ...s.users.filter((u) => u.username !== created.username)] }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  update: async (id, patch, actor) => {
    set({ error: null });
    try {
      const updated = await userService.updateUser(id, patch, actor ?? null);
      set((s) => ({ users: s.users.map((u) => (u.id === id ? updated : u)) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  remove: async (id, actor) => {
    set({ error: null });
    try {
      await userService.deleteUser(id, actor ?? null);
      set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },
}));
