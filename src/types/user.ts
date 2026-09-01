export interface UserDetail {
  id: number;
  username: string;
  full_name?: string | null;
  email?: string | null;
  role_id: number;
  role_name: string;
  status: string;
  created_at: string;
  is_deleted: boolean;
}

export interface CreateUserInput {
  username: string;
  password: string;
  full_name?: string | null;
  email?: string | null;
  role_id: number;
  status?: string | null;
}

export interface UpdateUserInput {
  full_name?: string | null;
  email?: string | null;
  role_id?: number | null;
  status?: string | null;
}

export interface ResetPasswordInput {
  new_password: string;
}

export interface RoleWithPermissions {
  id: number;
  name: string;
  description?: string | null;
  is_builtin: boolean;
  created_at: string;
  permissions: string[];
  user_count: number;
}

export interface CreateRoleInput {
  name: string;
  description?: string | null;
  permissions: string[];
}

export interface UpdateRoleInput {
  name: string;
  description?: string | null;
  permissions: string[];
}

export interface Permission {
  id: number;
  name: string;
  description?: string | null;
}

export const USER_STATUSES = ["active", "disabled"] as const;
