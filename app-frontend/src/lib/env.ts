export const AUTH_SERVICE_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || "http://localhost:7003";

/**
 * Notifications are proxied by auth-service (`/api/notifications`).
 * Backends reach notification-service via `NOTIFICATION_SERVICE_URL` (server-only).
 */
export function publicNotificationServiceOrigin(): string {
  return AUTH_SERVICE_URL.replace(/\/+$/, "");
}

export const OPMS_FRONTEND_URL = (
  process.env.NEXT_PUBLIC_OPMS_URL || "http://localhost:7002"
).replace(/\/+$/, "");

export const USER_MANAGER_FRONTEND_URL = (
  process.env.NEXT_PUBLIC_USER_MANAGER_URL || "http://localhost:7004/dashboard"
).replace(/\/+$/, "");

export const WORK_PLANNER_FRONTEND_URL = (
  process.env.NEXT_PUBLIC_WORK_PLANNER_URL || "http://localhost:7008/dashboard"
).replace(/\/+$/, "");

export const LEAD_MANAGER_FRONTEND_URL = (
  process.env.NEXT_PUBLIC_LEAD_MANAGER_URL || "http://localhost:7010/dashboard"
).replace(/\/+$/, "");

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
