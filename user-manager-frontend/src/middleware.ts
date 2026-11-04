import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  applyAuthSessionCookies,
  clearAuthCookies,
  effectiveAccessToken,
  fetchAuthRefreshFromCookies,
  isRefreshCookieExpired,
} from "@session-auth/middlewareAuth";

type IssuedSession = {
  token: string;
  refreshToken?: string;
  refreshExpiresIn?: number;
};

function authServiceBase(): string {
  return (
    process.env.AUTH_SERVICE_URL ||
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
    "http://localhost:7003"
  ).replace(/\/+$/, "");
}

async function exchangeHandoff(code: string): Promise<IssuedSession | null> {
  try {
    const res = await fetch(`${authServiceBase()}/api/auth/handoff/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
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

async function refreshSession(request: NextRequest): Promise<IssuedSession | null> {
  return fetchAuthRefreshFromCookies(authServiceBase(), request.headers.get("cookie"));
}

function parseJwtUser(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const jsonPayload =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function hasUserManagerPortalAccess(user: any): boolean {
  if (!user) return false;
  if (user.is_active === false || user.active === false) return false;

  const portals = Array.isArray(user.portals)
    ? user.portals
    : Array.isArray(user.portal_access)
    ? user.portal_access
    : [];

  const p = portals.find((x: any) => {
    if (!x) return false;
    const code = String(
      x.portal_code ||
      x.code ||
      (typeof x.portal === "object" ? x.portal?.code || x.portal?.portal_code : x.portal) ||
      ""
    ).toLowerCase().trim().replace(/-/g, "_");
    return code === "user_manager";
  });

  return Boolean(p);
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (isRefreshCookieExpired(request)) {
    const response = NextResponse.redirect(new URL("/", request.url));
    clearAuthCookies(response);
    return response;
  }

  let cookieToken = effectiveAccessToken(request);
  const urlToken = searchParams.get("token")?.trim() || "";
  const handoffCode = searchParams.get("handoff")?.trim() || "";

  let exchanged: IssuedSession | null = null;
  if (handoffCode) {
    exchanged = await exchangeHandoff(handoffCode);
  }
  const exchangedToken = exchanged?.token || null;

  let refreshedSession: IssuedSession | null = null;
  if (!cookieToken && !exchangedToken && !urlToken && !isRefreshCookieExpired(request)) {
    refreshedSession = await refreshSession(request);
    if (refreshedSession) {
      cookieToken = refreshedSession.token;
    } else {
      const isProtectedRoute = pathname.startsWith("/dashboard");
      const response = isProtectedRoute
        ? NextResponse.redirect(new URL("/", request.url))
        : NextResponse.next();
      clearAuthCookies(response);
      return response;
    }
  }

  const effectiveToken = cookieToken || exchangedToken || urlToken;

  const isAuthRoute = pathname === "/" || pathname === "/login";
  const isProtectedRoute = pathname.startsWith("/dashboard");

  if (exchangedToken) {
    const user = parseJwtUser(exchangedToken);
    if (!hasUserManagerPortalAccess(user)) {
      return NextResponse.redirect(new URL("/?error=access_denied", request.url));
    }
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("handoff");
    cleanUrl.searchParams.delete("token");
    const response = isAuthRoute
      ? NextResponse.redirect(new URL("/dashboard", request.url))
      : NextResponse.redirect(cleanUrl);
    applyAuthSessionCookies(response, exchanged || exchangedToken!);
    return response;
  }

  if (refreshedSession) {
    const user = parseJwtUser(refreshedSession.token);
    const hasAccess = hasUserManagerPortalAccess(user);
    if (isProtectedRoute && !hasAccess) {
      return NextResponse.redirect(new URL("/?error=access_denied", request.url));
    }
    if (isAuthRoute && hasAccess) {
      const response = NextResponse.redirect(new URL("/dashboard", request.url));
      applyAuthSessionCookies(response, refreshedSession);
      return response;
    }
    const response = NextResponse.next();
    applyAuthSessionCookies(response, refreshedSession);
    return response;
  }

  if (isProtectedRoute) {
    if (!effectiveToken) {
      if (handoffCode) return NextResponse.next();
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }
    const user = parseJwtUser(effectiveToken);
    if (!hasUserManagerPortalAccess(user)) {
      return NextResponse.redirect(new URL("/?error=access_denied", request.url));
    }
    if (urlToken) {
      const response = NextResponse.next();
      applyAuthSessionCookies(response, urlToken);
      return response;
    }
    return NextResponse.next();
  }

  if (isAuthRoute && effectiveToken) {
    const user = parseJwtUser(effectiveToken);
    if (hasUserManagerPortalAccess(user)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.search = "";
      const response = NextResponse.redirect(redirectUrl);
      if ((urlToken || exchangedToken) && !cookieToken) {
        applyAuthSessionCookies(response, exchanged || urlToken || exchangedToken!);
      }
      return response;
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
