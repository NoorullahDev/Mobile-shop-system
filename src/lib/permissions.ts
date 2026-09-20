export function hasPermission(permissions: string[] | undefined | null, required: string): boolean {
  if (!permissions) return false;
  if (permissions.includes("*")) return true;
  return permissions.includes(required);
}

export function can(permissions: string[] | undefined | null, required: string): boolean {
  return hasPermission(permissions, required);
}

/** Map each route to the permission required to access it. */
export const routePermissions: Record<string, string> = {
  "/": "dashboard:view",
  "/sales/new": "sales:create",
  "/sales": "sales:view",
  "/returns": "returns:view",
  "/inventory": "inventory:view",
  "/accessories": "inventory:view",
  "/purchases": "purchases:view",
  "/members": "members:view",
  "/payments": "payments:view",
  "/online-payments": "payments:view",
  "/suppliers": "suppliers:view",
  "/supplier-dues": "purchases:view",
  "/expenses": "expenses:view",
  "/reports": "reports:view",
  "/settings": "settings:view",
  "/settings/receipt": "settings:view",
  "/users": "users:manage",
  "/activity": "reports:view",
  "/notifications": "dashboard:view",
  "/backups": "backup:view",
  "/license": "dashboard:view",
};

/** Map sidebar nav items to their required permission. */
export const navPermissions: Record<string, string> = {
  "/": "dashboard:view",
  "/sales/new": "sales:create",
  "/sales": "sales:view",
  "/returns": "returns:view",
  "/inventory": "inventory:view",
  "/accessories": "inventory:view",
  "/purchases": "purchases:view",
  "/members": "members:view",
  "/payments": "payments:view",
  "/online-payments": "payments:view",
  "/suppliers": "suppliers:view",
  "/supplier-dues": "purchases:view",
  "/expenses": "expenses:view",
  "/reports": "reports:view",
  "/settings": "settings:view",
};
