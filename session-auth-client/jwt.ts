import { CLOCK_SKEW_MS } from "./constants";

export function jwtExpSeconds(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    const exp = Number(JSON.parse(payload).exp);
    return Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, skewMs: number = CLOCK_SKEW_MS): boolean {
  const exp = jwtExpSeconds(token);
  if (exp === null) return true;
  return Date.now() >= exp * 1000 - skewMs;
}

/** Cookie Max-Age for access token; 0 when JWT is already expired. */
export function jwtMaxAgeSeconds(token: string): number {
  const exp = jwtExpSeconds(token);
  if (exp === null) return 0;
  const left = Math.floor(exp - Date.now() / 1000);
  return left > 0 ? left : 0;
}
