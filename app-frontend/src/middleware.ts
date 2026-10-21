import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  departmentAllowsPathFromClaims,
  getDepartment,
  getRoleCodes,
  readJwtClaims,
  resolveHomeFromUser,
} from "@/constants/dashboardAccess";
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

function redirectUrl(request: NextRequest, targetPath: string): URL {
  const url = request.nextUrl.clone();
  const [pathOnly, ...searchParts] = targetPath.split("?");
  url.pathname = pathOnly || "/";
  url.search = searchParts.length ? `?${searchParts.join("?")}` : "";
  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (isRefreshCookieExpired(request)) {
    const response = NextResponse.redirect(redirectUrl(request, "/"));
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
        ? NextResponse.redirect(redirectUrl(request, "/"))
        : NextResponse.next();
      clearAuthCookies(response);
      return response;
    }
  }

  const effectiveToken = cookieToken || exchangedToken || urlToken;

  const claims = effectiveToken ? readJwtClaims(effectiveToken) : null;
  const department = getDepartment(claims) || "";
  const roleCodes = getRoleCodes(claims);

  const isAuthRoute = pathname === "/" || pathname === "/login";
  const isProtectedRoute = pathname.startsWith("/dashboard");

  if (exchangedToken) {
    const home =
      resolveHomeFromUser({
        department,
        role_codes: roleCodes,
        roles: roleCodes.length ? ["x"] : claims?.roles || [],
      }) || (department ? `/dashboard/${department}` : "/dashboard");
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("handoff");
    clean.searchParams.delete("token");
    const target = isAuthRoute ? home : `${clean.pathname}${clean.search}`;
    const response = NextResponse.redirect(redirectUrl(request, target));
    applyAuthSessionCookies(response, exchanged || exchangedToken!);
    return response;
  }

  if (refreshedSession) {
    const home =
      resolveHomeFromUser({
        department,
        role_codes: roleCodes,
        roles: roleCodes.length ? ["x"] : claims?.roles || [],
      }) || (department ? `/dashboard/${department}` : "/dashboard");
    const response = isAuthRoute
      ? NextResponse.redirect(redirectUrl(request, home))
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
    const target = request.nextUrl.clone();
    target.pathname = "/";
    target.searchParams.set("redirect", pathname);
    return NextResponse.redirect(target);
  }

  if (
    isProtectedRoute &&
    effectiveToken &&
    department &&
    pathname !== "/dashboard" &&
    !departmentAllowsPathFromClaims({ department, roleCodes, pathname })
  ) {
    const home =
      resolveHomeFromUser({
        department,
        role_codes: roleCodes,
        roles: roleCodes.length ? ["x"] : [],
      }) || `/dashboard/${department}`;
    return NextResponse.redirect(redirectUrl(request, home));
  }

  if (isAuthRoute && effectiveToken) {
    const home =
      resolveHomeFromUser({
        department,
        role_codes: roleCodes,
        roles: roleCodes.length ? ["x"] : claims?.roles || [],
      }) || (department ? `/dashboard/${department}` : "/dashboard");
    const response = NextResponse.redirect(redirectUrl(request, home));
    if (urlToken && !cookieToken) {
      applyAuthSessionCookies(response, urlToken);
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
