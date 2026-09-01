import { invoke } from "@tauri-apps/api/core";
import type { SessionUser } from "../types/session";

export async function login(username: string, password: string): Promise<SessionUser> {
  return invoke<SessionUser>("login", { username, password });
}

export async function logout(): Promise<void> {
  return invoke<void>("logout");
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return invoke<SessionUser | null>("get_current_user");
}
