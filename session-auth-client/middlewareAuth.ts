import {
  DEFAULT_LEGACY_AUTH_COOKIES,
  REFRESH_COOKIE,
  REFRESH_EXPIRES_COOKIE,
  ACCESS_COOKIE,
  CLOCK_SKEW_MS,
} from "./constants";
import { isJwtExpired, jwtMaxAgeSeconds } from "./jwt";
import { isRefreshExpired, refreshExpiresAtFromIn } from "./refreshExpiry";

export { isJwtExpired, jwtMaxAgeSeconds };

type CookieStore = {
  get: (name: string) => { value?: string } | undefined;
};

type MutableCookies = {
  set: (name: string, value: string, options: Record<string, unknown>) => void;
};

export type MiddlewareRequest = { cookies: CookieStore };
export type MiddlewareResponse = { cookies: MutableCookies };

export function readRefreshExpiresAtMs(request: MiddlewareRequest): number | null {
  const raw = request.cookies.get(REFRESH_EXPIRES_COOKIE)?.value;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isRefreshCookieExpired(request: MiddlewareRequest): boolean {
  return isRefreshExpired(readRefreshExpiresAtMs(request));
}

export function clearAuthCookies(
  response: MiddlewareResponse,
  extraLegacy: readonly string[] = DEFAULT_LEGACY_AUTH_COOKIES,
): void {
  const names = new Set<string>([
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    REFRESH_EXPIRES_COOKIE,
    ...DEFAULT_LEGACY_AUTH_COOKIES,
    ...extraLegacy,
  ]);
  for (const name of names) {
    response.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax" });
  }
}

type IssuedLike = {
  token: string;
  refreshToken?: string;
  refreshExpiresIn?: number;
};

export function applyAuthSessionCookies(
  response: MiddlewareResponse,
  session: string | IssuedLike,
  legacyCookies: readonly string[] = DEFAULT_LEGACY_AUTH_COOKIES,
): void {
  const token = typeof session === "string" ? session : session.token;
  const refreshToken = typeof session === "string" ? undefined : session.refreshToken;
  const refreshExpiresIn = typeof session === "string" ? undefined : session.refreshExpiresIn;

  const accessMax = jwtMaxAgeSeconds(token);
  if (accessMax > 0) {
    response.cookies.set(ACCESS_COOKIE, token, {
      path: "/",
      maxAge: accessMax,
      sameSite: "lax",
    });
  } else {
    response.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax" });
  }

  if (refreshToken) {
    const refreshExpiresAt =
      refreshExpiresIn && refreshExpiresIn > 0
        ? refreshExpiresAtFromIn(refreshExpiresIn)
        : Date.now() + 30 * 24 * 60 * 60 * 1000;
    const refreshMax = Math.max(
      60,
      Math.floor((refreshExpiresAt - Date.now()) / 1000),
    );
    response.cookies.set(REFRESH_COOKIE, refreshToken, {
      path: "/",
      maxAge: refreshMax,
      sameSite: "lax",
    });
    response.cookies.set(REFRESH_EXPIRES_COOKIE, String(refreshExpiresAt), {
      path: "/",
      maxAge: refreshMax,
      sameSite: "lax",
    });
  }

  for (const name of legacyCookies) {
    response.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax" });
  }
}

export async function fetchAuthRefreshFromCookies(
  authServiceBaseUrl: string,
  cookieHeader: string | null | undefined,
): Promise<IssuedLike | null> {
  try {
    const base = authServiceBaseUrl.replace(/\/+$/, "");
    const res = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: "{}",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      token?: string;
      refreshToken?: string;
      refreshExpiresIn?: number;
      data?: { token?: string; refreshToken?: string; refreshExpiresIn?: number };
    };
    const token = data.token || data.data?.token;
    if (!token) return null;
    return {
      token,
      refreshToken: data.refreshToken || data.data?.refreshToken,
      refreshExpiresIn: data.refreshExpiresIn || data.data?.refreshExpiresIn,
    };
  } catch {
    return null;
  }
}

/** Strip expired access JWT so middleware can fall back to refresh or login. */
export function effectiveAccessToken(request: MiddlewareRequest): string | undefined {
  const token = request.cookies.get(ACCESS_COOKIE)?.value?.trim();
  if (!token) return undefined;
  if (isJwtExpired(token, CLOCK_SKEW_MS)) return undefined;
  return token;
}
