/**
 * Portal path allowlists driven by OPMS portal access_roles (not user.department).
 */

import type { PortalKey } from "./portalNav";
import { PORTALS } from "./portalNav";
import {
  getOpmsAccessRoles,
  hasOpmsAccess,
  normalizeRole,
  OPMS_ROLE_PRIORITY,
  primaryOpmsRole,
} from "@/lib/opmsAuth";

export { normalizeRole };

export type PortalRouteMeta = {
  path: string;
  label: string;
  /** OPMS access_roles allowed for this workspace subtree. */
  roles: readonly string[];
  /** Lucide registry key (`NavIcon.jsx` NAV_ICON_MAP). */
  icon: string;
};

/** Ordered top-level workspaces (sidebar shortcuts). Role-scoped under portal_code opms. */
export const PORTAL_ROUTES = [
  {
    path: "/admin",
    label: "Admin",
    roles: ["admin"],
    icon: "ShieldCheck",
  },
  {
    path: "/sales",
    label: "Sales",
    roles: ["sales"],
    icon: "TrendingUp",
  },
  {
    path: "/finance",
    label: "Finance",
    roles: ["finance"],
    icon: "Landmark",
  },
  {
    path: "/dispatch",
    label: "Dispatch",
    roles: ["dispatch"],
    icon: "Boxes",
  },
  {
    path: "/account",
    label: "Account",
    roles: ["account"],
    icon: "Wallet",
  },
  {
    path: "/super_admin",
    label: "Super Admin",
    roles: ["super_admin"],
    icon: "Shield",
  },
] as const satisfies readonly PortalRouteMeta[];

/** @deprecated Prefer {@link PORTAL_ROUTES}; kept for gradual migration. */
export const DASHBOARD_ROUTES = PORTAL_ROUTES;

export const PORTAL_NAV_TOP = PORTAL_ROUTES.map((r) => ({
  href: r.path,
  label: r.label,
  roles: [...r.roles],
  /** @deprecated Use `roles`. */
  depts: [...r.roles],
  icon: r.icon,
}));

/** @deprecated Use {@link PORTAL_NAV_TOP}. */
export const DASHBOARD_NAV = PORTAL_NAV_TOP;

export const PORTAL_PATH_TO_ROLES: Record<string, readonly string[]> =
  Object.fromEntries(PORTAL_ROUTES.map((r) => [r.path, r.roles]));

/** @deprecated Use {@link PORTAL_PATH_TO_ROLES}. */
export const PORTAL_PATH_TO_DEPTS = PORTAL_PATH_TO_ROLES;
export const DASHBOARD_PATH_TO_DEPTS = PORTAL_PATH_TO_ROLES;

export type DashboardNavItem = {
  href: string;
  label: string;
  roles: readonly string[];
  /** @deprecated Use `roles`. */
  depts?: readonly string[];
  icon: string;
};

const HOME_LOOKUP: Record<string, string> = {
  admin: "/admin",
  administrator: "/admin",
  sales: "/sales",
  finance: "/finance",
  dispatch: "/dispatch",
  super_admin: "/super_admin",
  superadmin: "/super_admin",
  account: "/account",
  accounts: "/account",
};

/** Base path prefixes an access_role may navigate. */
const ROLE_TO_ALLOWED_PREFIXES: Record<string, readonly string[]> =
  PORTAL_ROUTES.reduce<Record<string, string[]>>((acc, r) => {
    for (const role of r.roles) {
      acc[role] ??= [];
      acc[role].push(r.path);
    }
    return acc;
  }, {});

/** @deprecated Use {@link normalizeRole}. */
export function normalizeDepartment(raw: unknown): string {
  return normalizeRole(raw);
}

export function portalFirstSegment(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] ?? null;
}

export function roleAllowsDashboardSegment(
  role: string,
  segment: string,
): boolean {
  const seg = normalizeRole(segment);
  const r = normalizeRole(role);
  if (!seg || !r) return false;
  const pathname = `/${seg}`;
  if (!(PORTALS as readonly string[]).includes(seg)) return false;
  const allowed = PORTAL_PATH_TO_ROLES[pathname];
  if (!allowed?.length) return false;
  return (allowed as readonly string[]).includes(r);
}

/** @deprecated Use role helpers / primaryOpmsRole. */
export function departmentAllowsDashboardSegment(
  department: string,
  segment: string,
): boolean {
  return roleAllowsDashboardSegment(department, segment);
}

/** Primary OPMS role for display / home when a single string is needed. */
export function userPrimaryOpmsRole(user: unknown): string {
  return primaryOpmsRole(user) ?? "";
}

/** @deprecated Use {@link userPrimaryOpmsRole} / getOpmsAccessRoles. */
export function userDashboardDepartment(user: unknown): string {
  return userPrimaryOpmsRole(user);
}

export function allowedDashboardNavForUser(user: unknown): DashboardNavItem[] {
  if (!hasOpmsAccess(user)) return [];
  const roles = new Set(getOpmsAccessRoles(user));
  return PORTAL_NAV_TOP.filter((n) =>
    (n.roles as readonly string[]).some((role) => roles.has(role)),
  );
}

export function portalSegmentLabel(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (!parts[0]) return null;
  const base = `/${parts[0]}`;
  const meta = PORTAL_ROUTES.find((r) => r.path === base);
  return meta?.label ?? null;
}

/** @deprecated Use {@link portalSegmentLabel}. */
export function dashboardSegmentLabel(pathname: string): string | null {
  return portalSegmentLabel(pathname);
}

export function resolveHomeFromRoles(
  roles: readonly string[],
): string | null {
  const normalized = roles.map(normalizeRole).filter(Boolean);
  if (!normalized.length) return null;
  for (const preferred of OPMS_ROLE_PRIORITY) {
    if (normalized.includes(preferred)) {
      return HOME_LOOKUP[preferred] ?? `/${preferred}`;
    }
  }
  for (const r of normalized) {
    if (HOME_LOOKUP[r]) return HOME_LOOKUP[r];
  }
  for (const r of normalized) {
    const route = PORTAL_ROUTES.find((pr) => (pr.roles as readonly string[]).includes(r));
    if (route) return route.path;
  }
  if (normalized.some((r) => r.includes("admin"))) return "/admin";
  return PORTAL_ROUTES[0]?.path ?? "/admin";
}

export function resolveHomeFromUser(user: unknown): string | null {
  return resolveHomeFromRoles(getOpmsAccessRoles(user));
}

/** @deprecated Use {@link resolveHomeFromRoles}. */
export function resolveHomeDashboardPath(roleOrDept: string): string | null {
  const d = normalizeRole(roleOrDept);
  if (!d) return null;
  return HOME_LOOKUP[d] ?? null;
}

function pathsMatchAllowedPrefixes(
  pathname: string,
  prefixes: readonly string[],
): boolean {
  for (const p of prefixes) {
    if (pathname === p) return true;
    if (pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

export function portalPrefixesForRoles(
  roles: readonly string[],
): readonly string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of roles) {
    const r = normalizeRole(raw);
    if (!r) continue;
    for (const prefix of ROLE_TO_ALLOWED_PREFIXES[r] ?? []) {
      if (!seen.has(prefix)) {
        seen.add(prefix);
        out.push(prefix);
      }
    }
  }
  return out;
}

/**
 * Whether any of the signed-in OPMS roles may open `pathname`.
 */
export function rolesAllowPortalPath(params: {
  pathname: string;
  roles: readonly string[];
}): boolean {
  const normalized = params.roles.map(normalizeRole).filter(Boolean);
  if (normalized.includes("super_admin")) return true;
  const prefixes = portalPrefixesForRoles(params.roles);
  if (!prefixes.length) return false;
  return pathsMatchAllowedPrefixes(params.pathname, prefixes);
}

export function userAllowsPortalPath(params: {
  pathname: string;
  user: unknown;
}): boolean {
  return rolesAllowPortalPath({
    pathname: params.pathname,
    roles: getOpmsAccessRoles(params.user),
  });
}

/**
 * @deprecated Use {@link rolesAllowPortalPath} / {@link userAllowsPortalPath}.
 */
export function departmentAllowsPortalPath(params: {
  pathname: string;
  department: string;
}): boolean {
  return rolesAllowPortalPath({
    pathname: params.pathname,
    roles: [params.department],
  });
}

/**
 * Rewrite legacy `/dashboard/sales/foo` paths to `/sales/foo`.
 */
export function normalizeDeepLinkPath(raw: string): string {
  const pathOnly = raw.split("?")[0]?.trim() ?? "";
  if (!pathOnly.startsWith("/")) return "";
  const m = pathOnly.match(/^\/dashboard\/([^/]+)(\/.*)?$/);
  if (!m?.[1]) return pathOnly;
  return `/${m[1]}${m[2] ?? ""}`;
}

/**
 * @deprecated Use {@link rolesAllowPortalPath}.
 */
export function departmentAllowsDashboardPath(params: {
  pathname: string;
  department: string;
}): boolean {
  const { pathname } = params;
  if (pathname.startsWith("/dashboard/")) {
    const seg = pathname.split("/").filter(Boolean)[1];
    if (seg) return roleAllowsDashboardSegment(params.department, seg);
  }
  return departmentAllowsPortalPath(params);
}

export function isProtectedPortalPath(pathname: string): boolean {
  return PORTAL_ROUTES.some(
    (r) => pathname === r.path || pathname.startsWith(`${r.path}/`),
  );
}

/** @deprecated Use {@link portalPrefixesForRoles}. */
export function portalPrefixesForDepartment(
  department: string,
): readonly string[] {
  return portalPrefixesForRoles([department]);
}

export function knownPortalFromPath(pathname: string): PortalKey | null {
  const first = portalFirstSegment(pathname);
  if (!first) return null;
  return (PORTALS as readonly string[]).includes(first)
    ? (first as PortalKey)
    : null;
}
