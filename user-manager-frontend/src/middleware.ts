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
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
    process.env.AUTH_SERVICE_URL ||
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
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("handoff");
    cleanUrl.searchParams.delete("token");
    const response = isAuthRoute
      ? NextResponse.redirect(
          (() => {
            const u = request.nextUrl.clone();
            u.pathname = "/dashboard";
            u.search = "";
            return u;
          })(),
        )
      : NextResponse.redirect(cleanUrl);
    applyAuthSessionCookies(response, exchanged || exchangedToken!);
    return response;
  }

  if (refreshedSession) {
    const response = isAuthRoute
      ? NextResponse.redirect(
          (() => {
            const u = request.nextUrl.clone();
            u.pathname = "/dashboard";
            u.search = "";
            return u;
          })(),
        )
      : NextResponse.next();
    applyAuthSessionCookies(response, refreshedSession);
    return response;
  }

  if (isProtectedRoute && urlToken) {
    const response = NextResponse.next();
    applyAuthSessionCookies(response, urlToken);
    return response;
  }

  if (isProtectedRoute && !effectiveToken) {
    if (handoffCode) return NextResponse.next();
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthRoute && effectiveToken) {
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

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
