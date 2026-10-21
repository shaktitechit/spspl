/**
 * OPMS portal access helpers — mirror backend opmsAuth.middleware
 * (portal_code: opms + access_roles, not user.department).
 */

export const OPMS_PORTAL_CODE = "opms";

export const OPMS_ACCESS_ROLES = [
  "super_admin",
  "admin",
  "sales",
  "finance",
  "account",
  "dispatch",
] as const;

export type OpmsAccessRole = (typeof OPMS_ACCESS_ROLES)[number];

/** Priority for home / primary role when a user has multiple access_roles. */
export const OPMS_ROLE_PRIORITY: readonly OpmsAccessRole[] = [
  "super_admin",
  "admin",
  "finance",
  "account",
  "dispatch",
  "sales",
] as const;

export type UserPortalAccess = {
  portal_id?: string;
  portal_code?: string;
  portal?: string;
  portal_name?: string;
  access_roles?: string[];
};

export type OpmsAuthUser = {
  portals?: UserPortalAccess[];
  portal_access?: UserPortalAccess[];
  department?: unknown;
  [key: string]: unknown;
};

export function normalizeRole(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).trim().toLowerCase();
  if (!s || s === "null" || s === "undefined") return "";
  if (s === "superadmin" || s === "super-admin" || s === "super admin") return "super_admin";
  if (s === "administrator" || s === "admin_user") return "admin";
  if (s === "accounts" || s === "accounting") return "account";
  if (s === "salesman" || s === "sales_user") return "sales";
  if (s === "dispatches" || s === "dispatch_team") return "dispatch";
  return s;
}

export function getOpmsPortalAccess(
  user: unknown,
): UserPortalAccess | null {
  if (!user || typeof user !== "object") return null;
  const u = user as OpmsAuthUser;
  const portals = Array.isArray(u.portals)
    ? u.portals
    : Array.isArray(u.portal_access)
      ? u.portal_access
      : [];
  return (
    portals.find(
      (p) =>
        p &&
        (p.portal_code === OPMS_PORTAL_CODE ||
          p.portal === OPMS_PORTAL_CODE ||
          (p as { code?: string }).code === OPMS_PORTAL_CODE ||
          (typeof p.portal_name === "string" && p.portal_name.toLowerCase().includes("opms"))),
    ) || null
  );
}

export function getOpmsAccessRoles(user: unknown): string[] {
  if (!user || typeof user !== "object") return [];
  const u = user as OpmsAuthUser & {
    access_role?: string;
    access_roles?: string[];
    role?: string;
    roles?: unknown[];
    role_codes?: string[];
    role_names?: string[];
    department?: string | { code?: string; name?: string };
    department_code?: string;
    department_name?: string;
  };

  const portalAccess = getOpmsPortalAccess(user);
  const collected: string[] = [];

  const add = (r: unknown) => {
    const n = normalizeRole(r);
    if (n && !collected.includes(n)) {
      collected.push(n);
    }
  };

  if (portalAccess) {
    if (Array.isArray(portalAccess.access_roles)) {
      for (const r of portalAccess.access_roles) add(r);
    }
    const pa = portalAccess as { access_role?: unknown; role?: unknown };
    if (pa.access_role) add(pa.access_role);
    if (pa.role) add(pa.role);
  }

  if (u.access_role) add(u.access_role);
  if (Array.isArray(u.access_roles)) {
    for (const r of u.access_roles) add(r);
  }
  if (u.role) add(u.role);
  if (Array.isArray(u.roles)) {
    for (const r of u.roles) {
      if (typeof r === "string") add(r);
      else if (r && typeof r === "object") {
        const ro = r as { code?: unknown; name?: unknown; role?: unknown };
        if (ro.code) add(ro.code);
        else if (ro.name) add(ro.name);
        else if (ro.role) add(ro.role);
      }
    }
  }
  if (Array.isArray(u.role_codes)) {
    for (const r of u.role_codes) add(r);
  }
  if (Array.isArray(u.role_names)) {
    for (const r of u.role_names) add(r);
  }
  const dept = (u as { department?: unknown }).department;
  if (typeof dept === "string") {
    add(dept);
  } else if (dept && typeof dept === "object") {
    const d = dept as { code?: unknown; name?: unknown };
    if (d.code) add(d.code);
    else if (d.name) add(d.name);
  }
  if (u.department_code) add(u.department_code);
  if (u.department_name) add(u.department_name);

  // Return filtered by OPMS_ACCESS_ROLES and ordered by OPMS_ROLE_PRIORITY
  const opmsMatched = collected.filter((r) =>
    (OPMS_ACCESS_ROLES as readonly string[]).includes(r as OpmsAccessRole),
  );
  if (opmsMatched.length > 0) {
    return opmsMatched.sort((a, b) => {
      const idxA = OPMS_ROLE_PRIORITY.indexOf(a as OpmsAccessRole);
      const idxB = OPMS_ROLE_PRIORITY.indexOf(b as OpmsAccessRole);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }

  return collected;
}

export function getOpmsAccessRole(user: unknown): string | null {
  const roles = getOpmsAccessRoles(user);
  return roles[0] ?? null;
}

export function hasOpmsAccess(user: unknown): boolean {
  return getOpmsAccessRoles(user).length > 0;
}

export function hasOpmsRole(user: unknown, ...roles: string[]): boolean {
  const allowed = roles.flat().map(normalizeRole).filter(Boolean);
  if (!allowed.length) return false;
  const userRole = getOpmsAccessRole(user);
  return userRole ? allowed.includes(userRole) : false;
}

export function hasAnyOpmsRole(
  user: unknown,
  roleList: string | readonly string[],
): boolean {
  const list = Array.isArray(roleList) ? roleList : [roleList];
  return hasOpmsRole(user, ...list);
}

export function primaryOpmsRole(user: unknown): string | null {
  return getOpmsAccessRole(user);
}

export function isOpmsAdmin(user: unknown): boolean {
  return hasAnyOpmsRole(user, ["admin", "super_admin"]);
}

/** Parse comma-separated roles cookie value. */
export function parseOpmsRolesCookie(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const decoded = decodeURIComponent(raw).trim().toLowerCase();
    if (!decoded) return [];
    return decoded
      .split(",")
      .map((r) => normalizeRole(r))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function formatOpmsRolesCookie(roles: readonly string[]): string {
  return roles.map(normalizeRole).filter(Boolean).join(",");
}
