export const AUTH_SERVICE_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || "http://localhost:7003";

export const LEAD_MANAGER_SERVICE_URL =
  process.env.NEXT_PUBLIC_LEAD_MANAGER_SERVICE_URL || "http://localhost:7009";

export const PRODUCT_SERVICE_URL =
  process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL || "http://localhost:7005";

export const PARTY_SERVICE_URL =
  process.env.NEXT_PUBLIC_PARTY_SERVICE_URL || "http://localhost:7006";

/**
 * Notifications are proxied by lead-manager-backend (`/api/notifications`).
 * Backends reach notification-service via `NOTIFICATION_SERVICE_URL` (server-only).
 */
export function publicNotificationServiceOrigin(): string {
  return LEAD_MANAGER_SERVICE_URL.replace(/\/+$/, "");
}

export function resolvePublicAssetUrl(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (/^data:image\//i.test(path)) return path;

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath.startsWith("/uploads") || cleanPath.startsWith("/api/uploads")) {
    return `${AUTH_SERVICE_URL}${cleanPath}`;
  }

  if (typeof window !== "undefined") {
    return new URL(cleanPath, window.location.origin).href;
  }
  return `${AUTH_SERVICE_URL}${cleanPath}`;
}

