/**
 * `/api/auth` — session + user profile.
 * Persisted to `localStorage` by middleware in `store.ts` (`AUTH_STORAGE_KEY`).
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { DomainSliceState } from "./common";
import { emptyDomainState } from "./common";
import type { UserPortalAccess } from "@/lib/opmsAuth";
import { REFRESH_EXPIRES_COOKIE } from "@session-auth/constants";
import { isJwtExpired } from "@session-auth/jwt";
import { isRefreshExpired } from "@session-auth/refreshExpiry";
import { isSessionTerminated, markSessionTerminated } from "@session-auth/sessionTerminator";
import { clearSessionMarks } from "@/lib/sessionCookie";

export const AUTH_STORAGE_KEY = "medica.auth";

/** Shape from JWT payload / `/api/auth/me` — portals drive OPMS access. */
export type AuthUser = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  department?: string;
  roles?: unknown[];
  role_codes?: string[];
  portals?: UserPortalAccess[];
  [key: string]: unknown;
};

export interface AuthState extends DomainSliceState {
  token: string | null;
  refreshToken: string | null;
  refreshExpiresAt: number | null;
  user: AuthUser | null;
}

export const authInitialState: AuthState = {
  ...emptyDomainState(),
  token: null,
  refreshToken: null,
  refreshExpiresAt: null,
  user: null,
};

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function parseJwtUser(token: string): AuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const decoded = JSON.parse(json) as Record<string, unknown>;
    return {
      _id: String(decoded.sub || decoded._id || decoded.id || "user"),
      name: String(decoded.name || decoded.email || "User"),
      email: String(decoded.email || ""),
      department: String(decoded.department || ""),
      roles: Array.isArray(decoded.roles) ? decoded.roles : [],
      role_codes: Array.isArray(decoded.role_codes)
        ? decoded.role_codes.map(String)
        : [],
      portals: Array.isArray(decoded.portals)
        ? (decoded.portals as UserPortalAccess[])
        : [],
      ...decoded,
    };
  } catch {
    return null;
  }
}

/** Read auth session from cookies (client-only; safe empty on SSR). */
export function readAuthFromStorage(): Partial<
  Pick<AuthState, "token" | "refreshToken" | "refreshExpiresAt" | "user">
> {
  if (typeof document === "undefined") return {};
  if (isSessionTerminated()) return {};

  const refreshExpiresRaw = getCookie(REFRESH_EXPIRES_COOKIE);
  const refreshExpiresAtParsed = refreshExpiresRaw ? Number(refreshExpiresRaw) : null;
  const refreshExpiresAt =
    refreshExpiresAtParsed != null && Number.isFinite(refreshExpiresAtParsed)
      ? refreshExpiresAtParsed
      : null;

  if (isRefreshExpired(refreshExpiresAt)) {
    clearSessionMarks();
    markSessionTerminated();
    return {};
  }

  let token = getCookie("access_token");
  const refreshToken = getCookie("refresh_token");
  if (token && isJwtExpired(token)) token = null;
  if (!token) return { refreshToken: refreshToken || null, refreshExpiresAt };
  const user = parseJwtUser(token);
  return {
    token,
    refreshToken: refreshToken || null,
    refreshExpiresAt,
    user,
  };
}

export function writeAuthToStorage(state?: AuthState | null): void {
  if (typeof window === "undefined") return;
  try {
    // Purge legacy localStorage auth key if present
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Hydrate slice from cookies (call from `makeStore` preloadedState on client only). */
export function hydrateAuthState(): AuthState {
  const { token = null, refreshToken = null, refreshExpiresAt = null, user = null } =
    readAuthFromStorage();
  return {
    ...authInitialState,
    token,
    refreshToken,
    refreshExpiresAt,
    user,
    status: token || user ? "succeeded" : "idle",
  };
}

export const authSlice = createSlice({
  name: "auth",
  initialState: authInitialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{
        token?: string | null;
        refreshToken?: string | null;
        refreshExpiresAt?: number | null;
        user?: AuthUser | null;
      }>,
    ) {
      if ("token" in action.payload) state.token = action.payload.token ?? null;
      if ("refreshToken" in action.payload) state.refreshToken = action.payload.refreshToken ?? null;
      if ("refreshExpiresAt" in action.payload) {
        state.refreshExpiresAt = action.payload.refreshExpiresAt ?? null;
      }
      if ("user" in action.payload) state.user = action.payload.user ?? null;
      state.error = null;
    },
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
    },
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
    },
    setAuthError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.status = action.payload ? "failed" : "idle";
    },
    logout() {
      return { ...authInitialState };
    },
    reset(state) {
      Object.assign(state, authInitialState);
    },
  },
});

export const {
  setCredentials,
  setUser,
  setToken,
  setAuthError,
  logout,
  reset: resetAuth,
} = authSlice.actions;

export default authSlice.reducer;
