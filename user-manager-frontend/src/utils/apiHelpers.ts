export const API_BASE =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_ORIGIN ||
  "http://localhost:7003";

/** Notifications are proxied by auth-service (`/api/notifications`). */
export function publicNotificationServiceOrigin(): string {
  return API_BASE.replace(/\/+$/, "");
}

export function getAuthHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export function extractList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.users)) return o.users;
    if (Array.isArray(o.roles)) return o.roles;
    if (Array.isArray(o.departments)) return o.departments;
    if (Array.isArray(o.portals)) return o.portals;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.items)) return o.items;
  }
  return [];
}
