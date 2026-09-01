export function hasPermission(permissions: string[] | undefined | null, required: string): boolean {
  if (!permissions) return false;
  if (permissions.includes("*")) return true;
  return permissions.includes(required);
}

export function can(permissions: string[] | undefined | null, required: string): boolean {
  return hasPermission(permissions, required);
}
