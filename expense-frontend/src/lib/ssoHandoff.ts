import { AUTH_SERVICE_URL } from "@/lib/env";

/**
 * Exchange a one-time SSO handoff code (issued by auth-service) for a full
 * session. Called client-side as a fallback when the middleware could not
 * exchange the code (e.g. the user landed on the page via a direct link and
 * the middleware already consumed the `?handoff=` param but the cookie was
 * not yet flushed to the client).
 */
export async function exchangeHandoffCode(code: string): Promise<{
  token: string;
  refreshToken?: string;
  refreshExpiresIn?: number;
  refreshExpiresAt?: number;
  user: unknown;
} | null> {
  const raw = String(code || "").trim();
  if (!raw) return null;
  const authBase = (AUTH_SERVICE_URL || "").replace(/\/+$/, "");
  if (!authBase) return null;
  try {
    const res = await fetch(`${authBase}/api/auth/handoff/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: raw }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      token?: string;
      refreshToken?: string;
      refreshExpiresIn?: number;
      user?: unknown;
      data?: {
        token?: string;
        refreshToken?: string;
        refreshExpiresIn?: number;
        user?: unknown;
      };
    };
    const token = data.token || data.data?.token;
    const user = data.user || data.data?.user;
    if (!token) return null;
    const refreshExpiresIn = data.refreshExpiresIn || data.data?.refreshExpiresIn;
    return {
      token,
      refreshToken: data.refreshToken || data.data?.refreshToken,
      refreshExpiresIn,
      refreshExpiresAt: refreshExpiresIn
        ? Date.now() + refreshExpiresIn * 1000
        : undefined,
      user,
    };
  } catch {
    return null;
  }
}

