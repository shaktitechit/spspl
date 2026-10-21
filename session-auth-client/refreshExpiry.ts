import { CLOCK_SKEW_MS } from "./constants";

export function isRefreshExpired(refreshExpiresAt: number | null | undefined): boolean {
  if (refreshExpiresAt == null || !Number.isFinite(refreshExpiresAt)) return false;
  return Date.now() >= refreshExpiresAt - CLOCK_SKEW_MS;
}

export function refreshExpiresAtFromIn(refreshExpiresInSeconds: number): number {
  return Date.now() + refreshExpiresInSeconds * 1000;
}

export function refreshCookieMaxAgeSeconds(refreshExpiresAt: number | null | undefined): number {
  if (refreshExpiresAt != null && Number.isFinite(refreshExpiresAt)) {
    return Math.max(60, Math.floor((refreshExpiresAt - Date.now()) / 1000));
  }
  return 30 * 24 * 60 * 60;
}
