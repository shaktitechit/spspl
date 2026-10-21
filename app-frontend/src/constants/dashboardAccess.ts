/**
 * JWT-driven dashboard routing.
 * Department + roles come only from the auth token / login user payload.
 * No hardcoded department or role catalogs.
 */

export type AuthLike = {
  department?: string | null;
  role_codes?: string[] | null;
  role_names?: string[] | null;
  roles?: string[] | null;
};

export type DepartmentNavItem = {
  code: string;
  label: string;
  path: string;
};

export function normalizeCode(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).trim().toLowerCase();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

/** Display label from any JWT code (department or role). */
export function formatLabel(code: string): string {
  const c = normalizeCode(code);
  if (!c) return "";
  return c
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** @deprecated Prefer {@link formatLabel}. */
export function formatRoleLabel(roleCode: string): string {
  return formatLabel(roleCode) || "User";
}

export function getDepartment(user: AuthLike | null | undefined): string {
  return normalizeCode(user?.department);
}

/** @deprecated Prefer {@link getDepartment}. */
export function getParentDepartment(user: AuthLike | null | undefined): string {
  return getDepartment(user);
}

export function getRoleCodes(user: AuthLike | null | undefined): string[] {
  if (!user) return [];
  const codes = Array.isArray(user.role_codes) ? user.role_codes : [];
  return [...new Set(codes.map(normalizeCode).filter(Boolean))];
}

export function getPrimaryRoleCode(user: AuthLike | null | undefined): string {
  return getRoleCodes(user)[0] || "";
}

export function dashboardPathFor(department: string, role?: string): string {
  const dept = normalizeCode(department);
  if (!dept) return "/dashboard";
  const roleCode = normalizeCode(role);
  if (roleCode) return `/dashboard/${encodeURIComponent(dept)}/${encodeURIComponent(roleCode)}`;
  return `/dashboard/${encodeURIComponent(dept)}`;
}

/**
 * Access requires department + at least one role from the JWT
 * (`role_codes`, or legacy `roles` ids).
 */
export function hasDepartmentRoleAccess(
  user: AuthLike | null | undefined,
): boolean {
  if (!user) return false;
  if (!getDepartment(user)) return false;
  if (getRoleCodes(user).length > 0) return true;
  return Array.isArray(user.roles) && user.roles.length > 0;
}

/** Home path from JWT department (+ primary role when present). */
export function resolveHomeFromUser(
  user: AuthLike | null | undefined,
): string | null {
  if (!hasDepartmentRoleAccess(user)) return null;
  const dept = getDepartment(user);
  const role = getPrimaryRoleCode(user);
  return dashboardPathFor(dept, role || undefined);
}

/** Shared dashboard routes that are not department-scoped (must not be treated as [department]). */
const SHARED_DASHBOARD_SEGMENTS = new Set([
  "profile",
  "leads",
  "quotations",
]);

export function isSharedDashboardPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "dashboard" || !parts[1]) return false;
  return SHARED_DASHBOARD_SEGMENTS.has(
    normalizeCode(decodeURIComponent(parts[1])),
  );
}

export function userAllowsDepartmentPath(params: {
  user: AuthLike | null | undefined;
  pathname: string;
}): boolean {
  const { user, pathname } = params;
  if (!hasDepartmentRoleAccess(user)) return false;

  const dept = getDepartment(user);
  const roles = getRoleCodes(user);

  if (pathname === "/dashboard" || pathname === "/dashboard/") return true;
  // Profile (and other shared tools) are allowed for any authenticated department user.
  if (isSharedDashboardPath(pathname)) return true;

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "dashboard" || !parts[1]) return false;

  const pathDept = normalizeCode(decodeURIComponent(parts[1]));
  if (pathDept !== dept) return false;

  // /dashboard/:dept — ok
  if (!parts[2]) return true;

  // /dashboard/:dept/:role — role must be one of JWT role_codes
  const pathRole = normalizeCode(decodeURIComponent(parts[2]));
  if (!pathRole) return true;
  if (!roles.length) return true;
  return roles.includes(pathRole);
}

export function departmentAllowsPathFromClaims(params: {
  department: string;
  roleCodes?: readonly string[];
  pathname: string;
}): boolean {
  return userAllowsDepartmentPath({
    user: {
      department: params.department,
      role_codes: [...(params.roleCodes ?? [])],
      roles: params.roleCodes?.length ? ["x"] : [],
    },
    pathname: params.pathname,
  });
}

/** @deprecated Prefer {@link departmentAllowsPathFromClaims}. */
export function departmentAllowsPathFromCookie(params: {
  department: string;
  pathname: string;
}): boolean {
  return departmentAllowsPathFromClaims({
    department: params.department,
    pathname: params.pathname,
  });
}

/** Sidebar nav built only from JWT department + role_codes. */
export function allowedDepartmentNavForUser(
  user: AuthLike | null | undefined,
): DepartmentNavItem[] {
  if (!hasDepartmentRoleAccess(user)) return [];
  const dept = getDepartment(user);
  const roles = getRoleCodes(user);

  if (!roles.length) {
    return [
      {
        code: dept,
        label: formatLabel(dept) || dept,
        path: dashboardPathFor(dept),
      },
    ];
  }

  return roles.map((role) => ({
    code: `${dept}:${role}`,
    label: formatLabel(role) || role,
    path: dashboardPathFor(dept, role),
  }));
}

/** Decode JWT payload claims (no signature verify — routing only). */
export function readJwtClaims(token: string): AuthLike & {
  sub?: string;
  name?: string;
  email?: string;
  portals?: unknown;
} | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? decodeURIComponent(
            atob(base64)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join(""),
          )
        : Buffer.from(base64, "base64").toString("utf8");
    const decoded = JSON.parse(json);
    return {
      sub: decoded.sub || decoded._id || decoded.id,
      name: decoded.name,
      email: decoded.email,
      department: decoded.department || "",
      roles: decoded.roles || [],
      role_codes: decoded.role_codes || [],
      role_names: decoded.role_names || [],
      portals: decoded.portals || [],
    };
  } catch {
    return null;
  }
}
