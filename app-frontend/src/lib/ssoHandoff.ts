import { AUTH_SERVICE_URL } from "@/lib/env";

/**
 * Create a one-time SSO handoff code and build a peer URL with `?handoff=`
 * (avoids putting the JWT in the query string). Falls back to deprecated `?token=`
 * only if the handoff API is unreachable.
 */
export async function buildSsoLaunchUrl(
  baseUrl: string,
  token: string,
): Promise<string> {
  if (!baseUrl) return baseUrl;
  if (!token) return baseUrl;

  const authBase = AUTH_SERVICE_URL.replace(/\/+$/, "");
  try {
    const res = await fetch(`${authBase}/api/auth/handoff`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`handoff ${res.status}`);
    const data = (await res.json()) as {
      code?: string;
      data?: { code?: string };
    };
    const code = data.code || data.data?.code;
    if (!code) throw new Error("missing handoff code");
    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}handoff=${encodeURIComponent(code)}`;
  } catch {
    // Temporary fallback for older auth-service builds
    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  }
}

export async function exchangeHandoffCode(
  code: string,
): Promise<{
  token: string;
  refreshToken?: string;
  refreshExpiresIn?: number;
  refreshExpiresAt?: number;
  user: unknown;
} | null> {
  const raw = String(code || "").trim();
  if (!raw) return null;
  const authBase = AUTH_SERVICE_URL.replace(/\/+$/, "");
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
      data?: { token?: string; refreshToken?: string; refreshExpiresIn?: number; user?: unknown };
    };
    const token = data.token || data.data?.token;
    const user = data.user || data.data?.user;
    if (!token) return null;
    const refreshExpiresIn = data.refreshExpiresIn || data.data?.refreshExpiresIn;
    return {
      token,
      refreshToken: data.refreshToken || data.data?.refreshToken,
      refreshExpiresIn,
      refreshExpiresAt: refreshExpiresIn ? Date.now() + refreshExpiresIn * 1000 : undefined,
      user,
    };
  } catch {
    return null;
  }
}
