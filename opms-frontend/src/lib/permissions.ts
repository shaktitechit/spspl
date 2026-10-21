import { hasAnyOpmsRole, isOpmsAdmin } from "@/lib/opmsAuth";

const PARTIES_BULK_UPLOAD_ROLES = ["admin", "finance", "super_admin"] as const;

export function getUserPermissionCodes(user: unknown): string[] {
  if (!user || typeof user !== "object") return [];
  const codes = (user as { permissionCodes?: unknown }).permissionCodes;
  if (!Array.isArray(codes)) return [];
  return codes.filter((c): c is string => typeof c === "string");
}

export function userHasAnyPermission(user: unknown, required: string[]): boolean {
  const codes = getUserPermissionCodes(user);
  if (codes.includes("*")) return true;
  return required.some((code) => codes.includes(code));
}

/** Admin and finance OPMS roles may bulk-upload parties (plus super_admin). */
export function canBulkUploadParties(user: unknown): boolean {
  if (hasAnyOpmsRole(user, PARTIES_BULK_UPLOAD_ROLES)) return true;
  return userHasAnyPermission(user, ["parties:manage", "*"]);
}

/** Check if user has permission to manage all leads and lead masters. */
export function canManageLeads(user: unknown): boolean {
  if (isOpmsAdmin(user)) return true;
  return userHasAnyPermission(user, ["leads:manage", "*"]);
}
