import type { AuthUser, UserSession } from "@/types/leadManager";
import { createRefreshAccessToken } from "@session-auth/createRefreshAccessToken";
import { AUTH_API } from "@session-auth/authApiPaths";
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_EXPIRES_COOKIE } from "@session-auth/constants";
import { performLogout } from "@session-auth/performLogout";
import { purgeLegacyAuthStorage } from "@session-auth/purgeLegacyStorage";
import { isJwtExpired, jwtMaxAgeSeconds } from "@session-auth/jwt";
import { isRefreshExpired } from "@session-auth/refreshExpiry";
import {
  broadcastAuthLogout,
  isSessionTerminated,
  markSessionTerminated,
  resetSessionTerminated,
  subscribeAuthLogout,
} from "@session-auth/sessionTerminator";
import {
  getRoleCodes,
  hasDepartmentRoleAccess,
  readJwtClaims,
} from "@/constants/dashboardAccess";

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
  const claims = readJwtClaims(token);
  if (!claims) return null;
  const portals = Array.isArray(claims.portals)
    ? (claims.portals as AuthUser["portals"])
    : [];
  return {
    _id: String(claims.sub || "user"),
    name: claims.name || claims.email || "User",
    email: claims.email || "",
    department: claims.department || "",
    roles: Array.isArray(claims.roles) ? claims.roles.map(String) : [],
    role_codes: getRoleCodes(claims),
    portals,
  };
}

/** @deprecated Prefer {@link hasDepartmentRoleAccess}. */
export function hasLeadManagerPortalAccess(
  user: AuthUser | null | undefined,
): boolean {
  return hasDepartmentRoleAccess(user);
}

export function hasAppAccess(user: AuthUser | null | undefined): boolean {
  return hasDepartmentRoleAccess(user);
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

    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    if (urlToken) {
      const userFromJwt = parseJwtUser(urlToken);
      if (userFromJwt && hasAppAccess(userFromJwt)) {
        const session: UserSession = { token: urlToken, user: userFromJwt };
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
      if (userFromJwt && hasAppAccess(userFromJwt)) {
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
