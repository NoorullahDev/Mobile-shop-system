import { create } from "zustand";
import type { CreateMemberInput, Member } from "../types/member";
import * as memberService from "../services/memberService";

interface MembersState {
  members: Member[];
  loading: boolean;
  error: string | null;
  load: (search?: string) => Promise<void>;
  add: (input: CreateMemberInput) => Promise<void>;
  update: (id: number, input: CreateMemberInput) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useMemberStore = create<MembersState>((set) => ({
  members: [],
  loading: false,
  error: null,

  load: async (search) => {
    set({ loading: true, error: null });
    try {
      const members = await memberService.listMembers(search);
      set({ members, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  add: async (input) => {
    set({ error: null });
    try {
      const created = await memberService.createMember(input);
      set((s) => ({ members: [created, ...s.members] }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  update: async (id, input) => {
    set({ error: null });
    try {
      const updated = await memberService.updateMember(id, input);
      set((s) => ({ members: s.members.map((m) => (m.id === id ? updated : m)) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await memberService.deleteMember(id);
      set((s) => ({ members: s.members.filter((m) => m.id !== id) }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },
}));
