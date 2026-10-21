import type { AuthUser, UserPortalAccess, UserSession } from "@/types/workPlanner";
import { createRefreshAccessToken } from "@session-auth/createRefreshAccessToken";
import { AUTH_API } from "@session-auth/authApiPaths";
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_EXPIRES_COOKIE } from "@session-auth/constants";
import { isJwtExpired, jwtMaxAgeSeconds } from "@session-auth/jwt";
import { isRefreshExpired } from "@session-auth/refreshExpiry";
import { performLogout } from "@session-auth/performLogout";
import { purgeLegacyAuthStorage } from "@session-auth/purgeLegacyStorage";
import {
  broadcastAuthLogout,
  isSessionTerminated,
  markSessionTerminated,
  resetSessionTerminated,
  subscribeAuthLogout,
} from "@session-auth/sessionTerminator";

const LEGACY_COOKIES = [
  "shakti_session",
  "medica_session",
  "shakti_department",
  "shakti_roles",
  "medica_opms_roles",
  "medica_department_hint",
];
const ALL_COOKIES = [ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_EXPIRES_COOKIE, ...LEGACY_COOKIES];

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookieMaxAge(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const maxAge = Math.max(1, Math.floor(maxAgeSeconds));
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax`;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  document.cookie = `${name}=; max-age=0; path=/`;
}

function parseJwtUser(token: string): AuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const decoded = JSON.parse(jsonPayload);
    return {
      _id: decoded._id || decoded.sub || decoded.id || "user",
      name: decoded.name || decoded.email || "User",
      email: decoded.email || "",
      department: decoded.department || "sales",
      parent_department:
        decoded.parent_department ||
        decoded.parentDepartment ||
        (typeof decoded.department === "object" ? decoded.department?.parent_department : undefined),
      roles: decoded.roles || [],
      role_codes: decoded.role_codes || [],
      portals: decoded.portals || [],
    } as any;
  } catch {
    return null;
  }
}

export function isPowerAuditUser(user: any): boolean {
  if (!user) return false;
  const uAny = user as any;
  const parentDept = String(
    uAny.parent_department ||
      uAny.parentDepartment ||
      (typeof uAny.department === "object"
        ? uAny.department?.parent_department || uAny.department?.code || uAny.department?.name
        : "") ||
      uAny.department ||
      ""
  )
    .toLowerCase()
    .trim();

  return (
    parentDept === "power_audit" ||
    parentDept === "power-audit" ||
    parentDept === "power audit" ||
    parentDept.includes("power_audit") ||
    parentDept.includes("power audit")
  );
}

export const WORK_PLANNER_ROLES = ["executive", "coordinator", "manager", "admin"] as const;
export type WorkPlannerRole = (typeof WORK_PLANNER_ROLES)[number];

export function hasWorkPlannerPortalAccess(user: AuthUser | any | null | undefined): boolean {
  if (!user) return false;
  const uAny = user as any;
  if (uAny.is_active === false || uAny.active === false) return false;

  if (uAny.wp_role) {
    const r = String(uAny.wp_role).toLowerCase().trim();
    if (WORK_PLANNER_ROLES.includes(r as WorkPlannerRole)) {
      return true;
    }
  }

  const portals = Array.isArray(user.portals)
    ? user.portals
    : Array.isArray(uAny.portal_access)
    ? uAny.portal_access
    : [];

  const wpPortal = portals.find((p: any) => {
    if (!p) return false;
    const code =
      p.portal_code ||
      p.code ||
      (typeof p.portal === "object" ? p.portal?.code || p.portal?.portal_code : p.portal);
    return String(code || "").toLowerCase().trim() === "work_planner";
  });

  if (!wpPortal) return false;

  const roles: string[] = Array.isArray(wpPortal.access_roles)
    ? wpPortal.access_roles
    : wpPortal.access_role
    ? [wpPortal.access_role]
    : Array.isArray((wpPortal as any).roles)
    ? (wpPortal as any).roles
    : [];

  const validRoles = roles
    .map((r) => String(r || "").toLowerCase().trim())
    .filter((r) => WORK_PLANNER_ROLES.includes(r as WorkPlannerRole));

  return validRoles.length > 0;
}

export function getWpAccessRoles(user: AuthUser | any | null | undefined): string[] {
  if (!user) return [];
  const uAny = user as any;
  if (uAny.is_active === false || uAny.active === false) return [];

  const portals = Array.isArray(user.portals)
    ? user.portals
    : Array.isArray(uAny.portal_access)
    ? uAny.portal_access
    : [];

  const wpPortal = portals.find((p: any) => {
    if (!p) return false;
    const code =
      p.portal_code ||
      p.code ||
      (typeof p.portal === "object" ? p.portal?.code || p.portal?.portal_code : p.portal);
    return String(code || "").toLowerCase().trim() === "work_planner";
  });

  if (!wpPortal) {
    if (uAny.wp_role) {
      const r = String(uAny.wp_role).toLowerCase().trim();
      return WORK_PLANNER_ROLES.includes(r as WorkPlannerRole) ? [r] : [];
    }
    return [];
  }

  const roles: string[] = Array.isArray(wpPortal.access_roles)
    ? wpPortal.access_roles
    : wpPortal.access_role
    ? [wpPortal.access_role]
    : Array.isArray((wpPortal as any).roles)
    ? (wpPortal as any).roles
    : [];

  return roles
    .map((r) => String(r || "").toLowerCase().trim())
    .filter((r) => WORK_PLANNER_ROLES.includes(r as WorkPlannerRole));
}

/** Portal admin role on work_planner portal only. */
export function isWpAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return getWpAccessRoles(user).includes("admin");
}

/** Portal manager role on work_planner portal only. */
export function isWpManager(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isWpAdmin(user)) return false;
  return getWpAccessRoles(user).includes("manager");
}

/** Portal coordinator role on work_planner portal only. */
export function isWpCoordinator(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isWpAdmin(user) || isWpManager(user)) return false;
  return getWpAccessRoles(user).includes("coordinator");
}

/** Admin, manager, or coordinator — elevated portal actions. */
export function isWpElevated(user: AuthUser | null | undefined): boolean {
  return isWpAdmin(user) || isWpManager(user) || isWpCoordinator(user);
}

/** @deprecated Prefer isWpElevated / isWpAdmin / isWpManager / isWpCoordinator */
export function isManager(user: AuthUser | null | undefined): boolean {
  return isWpElevated(user);
}

export function isExecutive(user: AuthUser | null | undefined): boolean {
  if (!user || isWpElevated(user)) return false;
  return getWpAccessRoles(user).includes("executive");
}

export function roleLabel(user: AuthUser | null | undefined): string {
  if (isWpAdmin(user)) return "Admin";
  if (isWpManager(user)) return "Manager";
  if (isWpCoordinator(user)) return "Coordinator";
  if (isExecutive(user)) return "Executive";
  return "User";
}

export function getRefreshExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = getCookie(REFRESH_EXPIRES_COOKIE);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function applySessionAfterAuth(): void {
  purgeLegacyAuthStorage();
  resetSessionTerminated();
}

export function invalidateLocalSession(redirectTo = "/"): void {
  void logoutAndRedirect(redirectTo);
}

export function logoutAndRedirect(redirectTo = "/"): Promise<void> {
  return performLogout({
    redirectTo,
    clearLocal: () => clearSessionFromStorage(),
  });
}

export { isSessionTerminated };

/** Refresh token is HttpOnly; not readable from JS. */
export function getRefreshToken(): string | null {
  return null;
}

export function readSessionFromStorage(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    if (isSessionTerminated()) return null;
    if (isRefreshExpired(getRefreshExpiresAt())) {
      clearSessionFromStorage();
      markSessionTerminated();
      return null;
    }

    // 0. Check URL query token parameter (SSO handoff)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    if (urlToken) {
      const userFromJwt = parseJwtUser(urlToken);
      if (userFromJwt && hasWorkPlannerPortalAccess(userFromJwt)) {
        const session: UserSession = {
          token: urlToken,
          user: userFromJwt,
        };
        saveSessionToStorage(session);
        window.history.replaceState({}, document.title, window.location.pathname);
        return session;
      }
    }

    purgeLegacyAuthStorage();

    let accessToken = getCookie(ACCESS_COOKIE);
    if (accessToken && isJwtExpired(accessToken)) accessToken = null;
    const refreshExpiresAt = getRefreshExpiresAt() ?? undefined;

    if (accessToken) {
      const userFromJwt = parseJwtUser(accessToken);
      if (userFromJwt && hasWorkPlannerPortalAccess(userFromJwt)) {
        return {
          token: accessToken,
          refreshExpiresAt,
          user: userFromJwt,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function saveSessionToStorage(session: UserSession | null): void {
  if (typeof window === "undefined") return;
  purgeLegacyAuthStorage();
  if (!session) {
    for (const cookieName of ALL_COOKIES) {
      deleteCookie(cookieName);
    }
    return;
  }
  resetSessionTerminated();
  if (session.token) {
    const accessMax = jwtMaxAgeSeconds(session.token);
    if (accessMax > 0) {
      setCookieMaxAge(ACCESS_COOKIE, session.token, accessMax);
    }
  }
  for (const name of LEGACY_COOKIES) deleteCookie(name);
}

export async function syncSessionCookie(
  token: string,
  user: AuthUser,
  refreshToken?: string,
  refreshExpiresAt?: number,
): Promise<void> {
  saveSessionToStorage({ token, refreshToken, refreshExpiresAt, user });
}

export function clearSessionFromStorage(): void {
  saveSessionToStorage(null);
}

/** Revoke this device's refresh-token family. Other devices stay signed in. */
export async function revokeRefreshToken(_refreshToken?: string | null): Promise<void> {
  try {
    await fetch(AUTH_API.logout, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    /* local session is still cleared by the caller */
  }
}

export const refreshAccessToken = createRefreshAccessToken({
  authRefreshUrl: AUTH_API.refresh,
  cookieCredentials: true,
  getRefreshExpiresAt: () => getRefreshExpiresAt(),
  readFallbackUser: () => readSessionFromStorage()?.user ?? null,
  saveRefreshedSession: () => {
    if (isSessionTerminated()) return;
    purgeLegacyAuthStorage();
    resetSessionTerminated();
  },
  invalidateSession: () => invalidateLocalSession("/"),
});

if (typeof window !== "undefined") {
  subscribeAuthLogout(() => {
    if (isSessionTerminated()) return;
    markSessionTerminated();
    clearSessionFromStorage();
    if (window.location.pathname !== "/") window.location.assign("/");
  });
}
