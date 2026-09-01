import { useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  Pencil,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Alert } from "../components/Alert";
import { Badge } from "../components/Badge";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toaster";
import { useSessionStore } from "../store/session";
import { useUserStore } from "../store/users";
import * as userService from "../services/userService";
import { can } from "../lib/permissions";
import type {
  Permission,
  RoleWithPermissions,
  UserDetail,
} from "../types/user";

type Tab = "users" | "roles";

export function UsersPage() {
  const session = useSessionStore((s) => s.user);
  const actor = session?.id ?? null;
  const permissions = session?.permissions ?? [];
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("users");

  const [search, setSearch] = useState("");

  // users
  const users = useUserStore((s) => s.users);
  const loadUsers = useUserStore((s) => s.load);
  const [userModal, setUserModal] = useState<"create" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<UserDetail | null>(null);
  const [resetTarget, setResetTarget] = useState<UserDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserDetail | null>(null);

  // roles
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissionsList, setPermissionsList] = useState<Permission[]>([]);
  const [roleModal, setRoleModal] = useState<"create" | "edit" | null>(null);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<RoleWithPermissions | null>(null);

  const [loading, setLoading] = useState(true);

  const loadRoles = async () => {
    const [r, p] = await Promise.all([userService.listRoles(), userService.listPermissions()]);
    setRoles(r);
    setPermissionsList(p);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadUsers(), loadRoles()]);
      } catch (e) {
        toast(String(e), { variant: "error", title: "Failed to load" });
      } finally {
        setLoading(false);
      }
    })();
  }, [loadUsers, toast]);

  const activeUsers = useMemo(() => users.filter((u) => !u.is_deleted), [users]);
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeUsers;
    return activeUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.full_name?.toLowerCase().includes(q) ?? false) ||
        (u.email?.toLowerCase().includes(q) ?? false),
    );
  }, [activeUsers, search]);

  const isSelf = (u: UserDetail) => u.id === session?.id;

  const userFormProps = {
    userModal,
    setUserModal,
    editingUser,
    setEditingUser,
    roles,
    actor,
    toast,
    loadUsers,
  };

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Manage system users, roles, and access permissions"
        breadcrumb={[{ label: "System" }, { label: "Users & Roles" }]}
        meta="Phase 8"
      />

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="h-3.5 w-3.5" />}>
          Users
        </TabButton>
        <TabButton active={tab === "roles"} onClick={() => setTab("roles")} icon={<Shield className="h-3.5 w-3.5" />}>
          Roles
        </TabButton>
      </div>

      {tab === "users" ? (
        <Card
          title={`Users (${activeUsers.length})`}
          actions={
            <div className="flex items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-60"
              />
              {can(permissions, "users:manage") && (
                <Button
                  size="sm"
                  icon={<UserPlus className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setEditingUser(null);
                    setUserModal("create");
                  }}
                >
                  Add User
                </Button>
              )}
            </div>
          }
          noPadding
        >
          {loading ? (
            <div className="py-16 text-center text-[13px]" style={{ color: "#64748B" }}>
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Users} title="No users found" description="Add a user to get started." />
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold"
                          style={{ background: "#DBEAFE", color: "#1D4ED8" }}
                        >
                          {u.full_name?.charAt(0)?.toUpperCase() ?? u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "#0F172A" }}>
                            {u.username}
                            {isSelf(u) && <Badge variant="primary">You</Badge>}
                          </div>
                          {u.full_name && (
                            <div className="text-[12px]" style={{ color: "#64748B" }}>
                              {u.full_name}
                            </div>
                          )}
                          {u.email && (
                            <div className="text-[11px]" style={{ color: "#94A3B8" }}>
                              {u.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge variant="purple">{u.role_name}</Badge>
                    </td>
                    <td>
                      <StatusBadge status={u.status} />
                    </td>
                    <td style={{ color: "#64748B", fontSize: "12px" }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("en-PK") : "—"}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {can(permissions, "users:manage") && (
                          <>
                            <IconBtn title="Edit" onClick={() => { setEditingUser(u); setUserModal("edit"); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </IconBtn>
                            <IconBtn title="Reset password" onClick={() => setResetTarget(u)}>
                              <KeyRound className="h-3.5 w-3.5" />
                            </IconBtn>
                            {!isSelf(u) && (
                              <IconBtn title="Delete" danger onClick={() => setDeleteTarget(u)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </IconBtn>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card
          title={`Roles (${roles.length})`}
          subtitle="Control what each role can access"
          actions={
            can(permissions, "users:manage") ? (
              <Button
                size="sm"
                icon={<Shield className="h-3.5 w-3.5" />}
                onClick={() => {
                  setEditingRole(null);
                  setRoleModal("create");
                }}
              >
                New Role
              </Button>
            ) : undefined
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((r) => (
              <div
                key={r.id}
                className="flex flex-col rounded-lg p-4"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="purple">{r.name}</Badge>
                    {r.is_builtin && <Badge variant="warning">Built-in</Badge>}
                  </div>
                  {can(permissions, "users:manage") && (
                    <div className="flex items-center gap-1">
                      <IconBtn title="Edit" onClick={() => { setEditingRole(r); setRoleModal("edit"); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </IconBtn>
                      {!r.is_builtin && (
                        <IconBtn title="Delete" danger onClick={() => setDeleteRoleTarget(r)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconBtn>
                      )}
                    </div>
                  )}
                </div>
                {r.description && (
                  <p className="mt-2 text-[12px]" style={{ color: "#64748B" }}>
                    {r.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-3 text-[12px]" style={{ color: "#64748B" }}>
                  <span>{r.permissions.length} permissions</span>
                  <span>{r.user_count} user{r.user_count === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.permissions.slice(0, 6).map((p) => (
                    <span
                      key={p}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ background: "#EFF6FF", color: "#1D4ED8" }}
                    >
                      {p}
                    </span>
                  ))}
                  {r.permissions.length > 6 && (
                    <span className="text-[10px]" style={{ color: "#94A3B8" }}>
                      +{r.permissions.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <UserFormModal {...userFormProps} />
      <ResetPasswordModal target={resetTarget} onClose={() => setResetTarget(null)} actor={actor} toast={toast} />
      <DeleteUserModal target={deleteTarget} onClose={() => setDeleteTarget(null)} actor={actor} toast={toast} />
      <RoleFormModal
        roleModal={roleModal}
        setRoleModal={setRoleModal}
        editingRole={editingRole}
        permissionsList={permissionsList}
        actor={actor}
        toast={toast}
        onSaved={loadRoles}
      />
      <DeleteRoleModal target={deleteRoleTarget} onClose={() => setDeleteRoleTarget(null)} actor={actor} toast={toast} onDeleted={loadRoles} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors"
      style={{
        background: active ? "#EFF6FF" : "transparent",
        color: active ? "#1D4ED8" : "#64748B",
        border: active ? "1px solid #DBEAFE" : "1px solid transparent",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function IconBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-slate-100"
      style={{ color: danger ? "#DC2626" : "#64748B" }}
    >
      {children}
    </button>
  );
}

function UserFormModal({
  userModal,
  setUserModal,
  editingUser,
  roles,
  actor,
  toast,
  loadUsers,
}: {
  userModal: "create" | "edit" | null;
  setUserModal: (v: "create" | "edit" | null) => void;
  editingUser: UserDetail | null;
  roles: RoleWithPermissions[];
  actor: number | null;
  toast: (m: string, o?: { variant?: "success" | "error"; title?: string }) => void;
  loadUsers: () => Promise<void>;
}) {
  const isEdit = userModal === "edit";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [status, setStatus] = useState<string>("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userModal) return;
    setError(null);
    if (editingUser) {
      setUsername(editingUser.username);
      setPassword("");
      setFullName(editingUser.full_name ?? "");
      setEmail(editingUser.email ?? "");
      setRoleId(String(editingUser.role_id));
      setStatus(editingUser.status);
    } else {
      setUsername("");
      setPassword("");
      setFullName("");
      setEmail("");
      setRoleId(roles[0] ? String(roles[0].id) : "");
      setStatus("active");
    }
  }, [userModal, editingUser, roles]);

  const reset = () => setUserModal(null);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      if (isEdit && editingUser) {
        await userService.updateUser(
          editingUser.id,
          {
            full_name: fullName || null,
            email: email || null,
            role_id: roleId ? Number(roleId) : null,
            status,
          },
          actor,
        );
        toast("User updated", { title: "Success" });
      } else {
        if (!username.trim()) { setError("Username is required"); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
        if (!roleId) { setError("Please select a role"); return; }
        await userService.createUser(
          {
            username: username.trim(),
            password,
            full_name: fullName || null,
            email: email || null,
            role_id: Number(roleId),
            status,
          },
          actor,
        );
        toast("User created", { title: "Success" });
      }
      reset();
      await loadUsers();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!userModal}
      title={isEdit ? `Edit User — ${editingUser?.username ?? ""}` : "Add User"}
      subtitle={isEdit ? "Update profile, role, or status" : "Create a new system user"}
      onClose={reset}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={reset}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} loading={saving} icon={<UserPlus className="h-3.5 w-3.5" />}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create User"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert message={error} variant="error" />}
        {isEdit && (
          <Input label="Username" value={username} disabled hint="Usernames cannot be changed" />
        )}
        {!isEdit && (
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. cashier1"
            required
          />
        )}
        {!isEdit && (
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
            hint="Password is hashed and never stored in plain text"
          />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ali Ahmed"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Role"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            options={roles.map((r) => ({ value: String(r.id), label: r.name }))}
            placeholder="Select role..."
            required
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: "active", label: "Active" },
              { value: "disabled", label: "Disabled" },
            ]}
          />
        </div>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({
  target,
  onClose,
  actor,
  toast,
}: {
  target: UserDetail | null;
  onClose: () => void;
  actor: number | null;
  toast: (m: string, o?: { variant?: "success" | "error"; title?: string }) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPassword("");
    setConfirm("");
    setError(null);
  }, [target]);

  const handleSave = async () => {
    setError(null);
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (!target) return;
    setSaving(true);
    try {
      await userService.resetUserPassword(target.id, password, actor);
      toast(`Password reset for ${target.username}`, { title: "Success" });
      useSessionStore.getState().clearDefaultPassword(target.id);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!target}
      title={`Reset Password — ${target?.username ?? ""}`}
      subtitle="Set a new password for this user"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} loading={saving} icon={<KeyRound className="h-3.5 w-3.5" />}>
            {saving ? "Resetting..." : "Reset Password"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert message={error} variant="error" />}
        <Input
          label="New Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          required
        />
        <Input
          label="Confirm Password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter password"
          required
        />
      </div>
    </Modal>
  );
}

function DeleteUserModal({
  target,
  onClose,
  actor,
  toast,
}: {
  target: UserDetail | null;
  onClose: () => void;
  actor: number | null;
  toast: (m: string, o?: { variant?: "success" | "error"; title?: string }) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await userService.deleteUser(target.id, actor);
      toast(`User ${target.username} deleted`, { title: "Deleted" });
      onClose();
      useUserStore.getState().load();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!target}
      title="Delete User"
      subtitle="This action cannot be undone"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={saving}>
            {saving ? "Deleting..." : "Delete User"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <Alert message={error} variant="error" />}
        <Alert
          variant="warning"
          title="Confirm deletion"
          message={`Are you sure you want to delete "${target?.username}"? They will no longer be able to log in.`}
        />
      </div>
    </Modal>
  );
}

function RoleFormModal({
  roleModal,
  setRoleModal,
  editingRole,
  permissionsList,
  actor,
  toast,
  onSaved,
}: {
  roleModal: "create" | "edit" | null;
  setRoleModal: (v: "create" | "edit" | null) => void;
  editingRole: RoleWithPermissions | null;
  permissionsList: Permission[];
  actor: number | null;
  toast: (m: string, o?: { variant?: "success" | "error"; title?: string }) => void;
  onSaved: () => void;
}) {
  const isEdit = roleModal === "edit";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!roleModal) return;
    setError(null);
    if (editingRole) {
      setName(editingRole.name);
      setDescription(editingRole.description ?? "");
      setSelected(new Set(editingRole.permissions));
    } else {
      setName("");
      setDescription("");
      setSelected(new Set());
    }
  }, [roleModal, editingRole]);

  const toggle = (p: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const reset = () => setRoleModal(null);

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) { setError("Role name is required"); return; }
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        description: description || null,
        permissions: Array.from(selected),
      };
      if (isEdit && editingRole) {
        await userService.updateRole(editingRole.id, input, actor);
        toast("Role updated", { title: "Success" });
      } else {
        await userService.createRole(input, actor);
        toast("Role created", { title: "Success" });
      }
      reset();
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const p of permissionsList) {
      const module = p.name.split(":")[0] ?? "other";
      if (!groups.has(module)) groups.set(module, []);
      groups.get(module)!.push(p);
    }
    return Array.from(groups.entries());
  }, [permissionsList]);

  return (
    <Modal
      open={!!roleModal}
      title={isEdit ? `Edit Role — ${editingRole?.name ?? ""}` : "Create Role"}
      subtitle="Assign permissions to control access"
      onClose={reset}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={reset}>Cancel</Button>
          <Button size="sm" onClick={handleSave} loading={saving} icon={<Shield className="h-3.5 w-3.5" />}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Role"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert message={error} variant="error" />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Role Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Inventory Manager"
            required
            disabled={isEdit && editingRole?.is_builtin}
            hint={isEdit && editingRole?.is_builtin ? "Built-in role names cannot be changed" : undefined}
          />
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label style={{ fontSize: "13px", fontWeight: 500, color: "#334155" }}>
              Permissions ({selected.size} selected)
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" size="xs" onClick={() => { const all = new Set(permissionsList.map((p) => p.name)); setSelected(all); }}>
                Select all
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </div>
          <div
            className="max-h-72 overflow-y-auto rounded p-3"
            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
          >
            {grouped.length === 0 ? (
              <div className="py-8 text-center text-[13px]" style={{ color: "#94A3B8" }}>
                No permissions available
              </div>
            ) : (
              grouped.map(([module, perms]) => (
                <div key={module} className="mb-3 last:mb-0">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>
                    {module}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {perms.map((p) => {
                      const checked = selected.has(p.name);
                      return (
                        <label
                          key={p.name}
                          className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-[12px] transition-colors"
                          style={{
                            background: checked ? "#DBEAFE" : "#FFFFFF",
                            border: `1px solid ${checked ? "#3B6FD4" : "#CBD5E1"}`,
                            color: checked ? "#1D4ED8" : "#334155",
                          }}
                        >
                          <input
                            type="checkbox"
                            className="accent-[#3B6FD4]"
                            checked={checked}
                            onChange={() => toggle(p.name)}
                          />
                          {p.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function DeleteRoleModal({
  target,
  onClose,
  actor,
  toast,
  onDeleted,
}: {
  target: RoleWithPermissions | null;
  onClose: () => void;
  actor: number | null;
  toast: (m: string, o?: { variant?: "success" | "error"; title?: string }) => void;
  onDeleted: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await userService.deleteRole(target.id, actor);
      toast(`Role "${target.name}" deleted`, { title: "Deleted" });
      onClose();
      onDeleted();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!target}
      title="Delete Role"
      subtitle="This action cannot be undone"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={saving}>
            {saving ? "Deleting..." : "Delete Role"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <Alert message={error} variant="error" />}
        <Alert
          variant="warning"
          title="Confirm deletion"
          message={`Are you sure you want to delete the role "${target?.name}"? You cannot delete built-in roles or roles assigned to users.`}
        />
      </div>
    </Modal>
  );
}
