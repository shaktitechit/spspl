export const AUTH_SERVICE_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || "";

export const WORK_PLANNER_SERVICE_URL =
  process.env.NEXT_PUBLIC_WORK_PLANNER_SERVICE_URL || "";

export const PRODUCT_SERVICE_URL =
  process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL || "";

export const PARTY_SERVICE_URL =
  process.env.NEXT_PUBLIC_PARTY_SERVICE_URL || "http://localhost:7006";

export const LEAD_MANAGER_SERVICE_URL =
  process.env.NEXT_PUBLIC_LEAD_MANAGER_SERVICE_URL || "";

/**
 * Notifications are proxied by work-planner-backend (`/api/notifications`).
 * Backends reach notification-service via `NOTIFICATION_SERVICE_URL` (server-only).
 */
export function publicNotificationServiceOrigin(): string {
  return WORK_PLANNER_SERVICE_URL.replace(/\/+$/, "");
}

export function resolvePublicAssetUrl(path: string, token?: string | null): string {
  if (!path) return "";
  const value = path.trim();
  if (/^data:image\//i.test(value)) return value;

  const wpBase = WORK_PLANNER_SERVICE_URL.replace(/\/+$/, "");

  // If path is a 24-character hex Mongo ObjectId for an attachment
  if (/^[0-9a-fA-F]{24}$/.test(value)) {
    const base = `${wpBase}/api/work-planner/attachments/${value}/view`;
    return token && !base.includes("token=") ? `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : base;
  }

  if (/^https?:\/\//i.test(value)) {
    // If it's a MinIO or internal URL containing an attachment/file identifier, proxy it
    const match = value.match(/(?:attachments|files)\/([a-zA-Z0-9._-]+)/i);
    if (match && (value.includes("spspl.com") || value.includes(":9000") || value.includes(":7005") || value.includes("minio") || value.includes("file-manager"))) {
      const cleanId = match[1];
      const isProject = value.includes("/projects/") || value.includes("project");
      const base = isProject
        ? `${wpBase}/api/projects/attachments/${cleanId}/view`
        : `${wpBase}/api/work-planner/attachments/${cleanId}/view`;
      return token && !base.includes("token=") ? `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : base;
    }
    if (token && (value.includes("/api/work-planner/") || value.includes("/api/projects/") || value.includes("/api/files/")) && !value.includes("token=")) {
      return `${value}${value.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
    }
    return value;
  }

  const cleanPath = value.startsWith("/") ? value : `/${value}`;
  if (
    cleanPath.startsWith("/api/work-planner") ||
    cleanPath.startsWith("/api/projects") ||
    cleanPath.startsWith("/api/files")
  ) {
    const full = `${wpBase}${cleanPath}`;
    return token && !full.includes("token=") ? `${full}${full.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : full;
  }

  if (cleanPath.startsWith("/uploads") || cleanPath.startsWith("/api/uploads")) {
    return `${AUTH_SERVICE_URL.replace(/\/+$/, "")}${cleanPath}`;
  }

  if (typeof window !== "undefined") {
    return new URL(cleanPath, window.location.origin).href;
  }
  return `${AUTH_SERVICE_URL.replace(/\/+$/, "")}${cleanPath}`;
}

/**
 * Append JWT for browser navigations that cannot send Authorization headers
 * (e.g. attachment view links opened in a new tab). Prefer Bearer for XHR.
 */
export function withAccessToken(url: string, token?: string | null): string {
  if (!url || url === "#" || !token) return url || "";
  if (url.includes("token=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

/**
 * Append JWT only for `/api/files/...`, `/api/projects/...`, `/api/work-planner/...` proxy URLs.
 * Presigned MinIO/file-manager URLs already carry signed query params — do not mutate them if they already contain signatures.
 */
export function withFileAccessToken(url: string, token?: string | null): string {
  if (!url || url === "#" || !token) return url || "";
  if (!/\/(?:api\/files|api\/projects|api\/work-planner)\//i.test(url)) return url;
  return withAccessToken(url, token);
}


