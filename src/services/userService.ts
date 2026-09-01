import { invoke } from "@tauri-apps/api/core";
import type {
  CreateRoleInput,
  CreateUserInput,
  Permission,
  ResetPasswordInput,
  RoleWithPermissions,
  UpdateRoleInput,
  UpdateUserInput,
  UserDetail,
} from "../types/user";

export async function createUser(input: CreateUserInput, actor?: number | null): Promise<UserDetail> {
  return invoke<UserDetail>("create_user", { input, actor: actor ?? null });
}

export async function listUsers(search?: string): Promise<UserDetail[]> {
  return invoke<UserDetail[]>("list_users", { search: search ?? null });
}

export async function getUser(id: number): Promise<UserDetail> {
  return invoke<UserDetail>("get_user", { id });
}

export async function updateUser(
  id: number,
  input: UpdateUserInput,
  actor?: number | null,
): Promise<UserDetail> {
  return invoke<UserDetail>("update_user", { id, input, actor: actor ?? null });
}

export async function setUserStatus(
  id: number,
  status: string,
  actor?: number | null,
): Promise<UserDetail> {
  return invoke<UserDetail>("set_user_status", { id, status, actor: actor ?? null });
}

export async function resetUserPassword(
  id: number,
  newPassword: string,
  actor?: number | null,
): Promise<void> {
  return invoke<void>("reset_user_password", {
    id,
    input: { new_password: newPassword } as ResetPasswordInput,
    actor: actor ?? null,
  });
}

export async function deleteUser(id: number, actor?: number | null): Promise<void> {
  return invoke<void>("delete_user", { id, actor: actor ?? null });
}

export async function listRoles(search?: string): Promise<RoleWithPermissions[]> {
  return invoke<RoleWithPermissions[]>("list_roles", { search: search ?? null });
}

export async function getRole(id: number): Promise<RoleWithPermissions> {
  return invoke<RoleWithPermissions>("get_role", { id });
}

export async function createRole(input: CreateRoleInput, actor?: number | null): Promise<RoleWithPermissions> {
  return invoke<RoleWithPermissions>("create_role", { input, actor: actor ?? null });
}

export async function updateRole(
  id: number,
  input: UpdateRoleInput,
  actor?: number | null,
): Promise<RoleWithPermissions> {
  return invoke<RoleWithPermissions>("update_role", { id, input, actor: actor ?? null });
}

export async function deleteRole(id: number, actor?: number | null): Promise<void> {
  return invoke<void>("delete_role", { id, actor: actor ?? null });
}

export async function listPermissions(): Promise<Permission[]> {
  return invoke<Permission[]>("list_permissions");
}
