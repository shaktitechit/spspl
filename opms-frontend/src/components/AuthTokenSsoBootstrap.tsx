"use client";

import { useEffect, useRef } from "react";

import { hasOpmsAccess } from "@/lib/opmsAuth";
import { persistSessionMarksFromAuth } from "@/lib/sessionCookie";
import { publicAuthOrigin } from "@/lib/env";
import {
  AUTH_STORAGE_KEY,
  setCredentials,
  type AuthUser,
} from "@/store/slices/authSlice";
import { useAppDispatch } from "@/store";

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
      portals: Array.isArray(decoded.portals) ? decoded.portals : [],
    };
  } catch {
    return null;
  }
}

async function exchangeHandoff(code: string): Promise<string | null> {
  try {
    const res = await fetch(`${publicAuthOrigin()}/api/auth/handoff/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      token?: string;
      data?: { token?: string };
    };
    return data.token || data.data?.token || null;
  } catch {
    return null;
  }
}

function applySession(token: string, dispatch: ReturnType<typeof useAppDispatch>) {
  const user = parseJwtUser(token);
  if (!user || !hasOpmsAccess(user)) return false;
  dispatch(setCredentials({ token, user }));
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  persistSessionMarksFromAuth({ token, user });
  return true;
}

/**
 * Consumes SSO handoff (`?handoff=` one-time code) or legacy `?token=` JWT.
 */
export function AuthTokenSsoBootstrap() {
  const dispatch = useAppDispatch();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || typeof window === "undefined") return;
    ran.current = true;

    const url = new URL(window.location.href);
    const handoff = url.searchParams.get("handoff")?.trim();
    const tokenParam = url.searchParams.get("token")?.trim();

    void (async () => {
      let token = tokenParam || "";
      if (handoff) {
        token = (await exchangeHandoff(handoff)) || "";
      }
      if (!token) return;
      if (!applySession(token, dispatch)) return;

      url.searchParams.delete("token");
      url.searchParams.delete("handoff");
      const clean = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, document.title, clean || "/");
    })();
  }, [dispatch]);

  return null;
}
