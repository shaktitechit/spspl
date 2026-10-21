/**
 * `/api/auth` — session + user profile.
 * Persisted to `localStorage` by middleware in `store.ts` (`AUTH_STORAGE_KEY`).
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { DomainSliceState } from "./common";
import { emptyDomainState } from "./common";

export const AUTH_STORAGE_KEY = "medica.auth";

/** Shape from JWT payload / `/api/auth/me` — extend when you add Typed models. */
export type AuthUser = Record<string, unknown>;

export interface AuthState extends DomainSliceState {
  token: string | null;
  user: AuthUser | null;
}

export const authInitialState: AuthState = {
  ...emptyDomainState(),
  token: null,
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
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Read auth from cookies (client-only; safe empty on SSR). */
export function readAuthFromStorage(): Partial<Pick<AuthState, "token" | "user">> {
  if (typeof document === "undefined") return {};
  const token = getCookie("access_token");
  if (!token) return {};
  const user = parseJwtUser(token);
  return { token, user };
}

export function writeAuthToStorage(state?: AuthState | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Hydrate slice from cookies (call from `makeStore` preloadedState on client only). */
export function hydrateAuthState(): AuthState {
  const { token = null, user = null } = readAuthFromStorage();
  return {
    ...authInitialState,
    token,
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
      action: PayloadAction<{ token?: string | null; user?: AuthUser | null }>,
    ) {
      if ("token" in action.payload) state.token = action.payload.token ?? null;
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
