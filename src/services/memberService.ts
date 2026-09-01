import { invoke } from "@tauri-apps/api/core";
import type { CreateMemberInput, Member } from "../types/member";

export async function ping(): Promise<string> {
  return invoke<string>("ping");
}

export async function createMember(input: CreateMemberInput): Promise<Member> {
  return invoke<Member>("create_member", { input });
}

export async function listMembers(search?: string): Promise<Member[]> {
  return invoke<Member[]>("list_members", { search: search ?? null });
}

export async function getMember(id: number): Promise<Member> {
  return invoke<Member>("get_member", { id });
}

export async function deleteMember(id: number, actor?: number | null): Promise<void> {
  return invoke<void>("delete_member", { id, actor: actor ?? null });
}

export async function updateMember(id: number, input: CreateMemberInput): Promise<Member> {
  return invoke<Member>("update_member", { id, input });
}
