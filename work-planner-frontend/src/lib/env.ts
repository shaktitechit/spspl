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
 * Public backend origin for work planner service (`api-work-planner` / `api-opms`).
 * In browser environments, dynamically determines the correct origin to avoid
 * hardcoded localhost connections when deployed or accessed over custom domains.
 */
export function publicWorkPlannerApiOrigin(): string {
  const envUrl = (process.env.NEXT_PUBLIC_WORK_PLANNER_SERVICE_URL || "").trim();

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0";

    if (!isLocalhost) {
      if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
        return envUrl.replace(/\/+$/, "");
      }
      if (hostname.includes("spspl.com")) {
        return `${protocol}//api-work-planner.spspl.com`;
      }
      if (window.location.port === "" || window.location.port === "80" || window.location.port === "443") {
        return `${protocol}//api-${hostname}`;
      }
      return `${protocol}//${hostname}:7007`;
    }

    if (envUrl) {
      return envUrl.replace(/\/+$/, "");
    }
    return `http://${hostname}:7007`;
  }

  if (envUrl) return envUrl.replace(/\/+$/, "");
  return "http://localhost:7007";
}

/**
 * Public auth service origin.
 */
export function publicAuthServiceOrigin(): string {
  const authEnv = (process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || "").trim();
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0";

    if (!isLocalhost) {
      if (authEnv && !authEnv.includes("localhost") && !authEnv.includes("127.0.0.1")) {
        return authEnv.replace(/\/+$/, "");
      }
      if (hostname.includes("spspl.com")) {
        return `${protocol}//auth.spspl.com`;
      }
      return `${protocol}//${hostname}:7003`;
    }
  }
  if (authEnv) return authEnv.replace(/\/+$/, "");
  return "http://localhost:7003";
}

/**
 * Notifications are proxied by work-planner-backend (`/api/notifications`).
 * Backends reach notification-service via `NOTIFICATION_SERVICE_URL` (server-only).
 */
export function publicNotificationServiceOrigin(): string {
  return publicWorkPlannerApiOrigin();
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
  if (!/\/(?:api\/files|api\/projects|api\/work-planner|api\/attachments)\//i.test(url)) return url;
  return withAccessToken(url, token);
}

/**
 * Resolves any attachment or file reference (URL, relative path, ObjectId, or object)
 * to an absolute public asset URL pointing to the active work planner API backend.
 * Automatically extracts the unique file UUID / ObjectId, rewrites legacy localhost URLs,
 * and prevents generic keyword matching (like "tenant") from serving duplicate files.
 */
export function resolvePublicAssetUrl(path: any, token?: string | null): string {
  if (!path) return "";
  let value: string = "";

  if (typeof path === "string") {
    value = path.trim();
  } else if (typeof path === "object" && path !== null) {
    // If the object carries an exact Attachment ObjectId, use it directly!
    const directId = path._id || path.attachment_id || path.file_id;
    if (typeof directId === "string" && /^[0-9a-fA-F]{24}$/.test(directId.trim())) {
      const baseOrigin = publicWorkPlannerApiOrigin().replace(/\/+$/, "");
      const base = `${baseOrigin}/api/work-planner/attachments/${directId.trim()}/view`;
      return withAccessToken(base, token);
    }
    if (typeof path.url === "string" && path.url.trim()) {
      value = path.url.trim();
    } else {
      value = String(path.filename || directId || "").trim();
    }
  } else {
    value = String(path).trim();
  }

  if (!value || value === "#" || value.toLowerCase() === "[object object]") return "";

  // Data URLs or Blob URLs are already local and self-contained
  if (/^data:image\//i.test(value) || /^blob:/i.test(value)) return value;

  const baseOrigin = publicWorkPlannerApiOrigin().replace(/\/+$/, "");

  // If path is a 24-character hex Mongo ObjectId for an attachment
  if (/^[0-9a-fA-F]{24}$/.test(value)) {
    const base = `${baseOrigin}/api/work-planner/attachments/${value}/view`;
    return withAccessToken(base, token);
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value);
      const host = u.hostname.toLowerCase();
      const isLocalHost =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "0.0.0.0";
      const isInternalHost =
        isLocalHost ||
        host === "expense-backend" ||
        host === "work-planner-backend" ||
        host === "minio" ||
        host.includes("minio") ||
        u.port === "7015" ||
        u.port === "7007" ||
        u.port === "7005" ||
        u.port === "9000";

      const inBrowser = typeof window !== "undefined";
      const browserIsRemote = inBrowser && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";

      // 1. Existing API endpoints (/api/work-planner/attachments/..., /api/attachments/..., /api/files/...)
      if (
        u.pathname.startsWith("/api/work-planner") ||
        u.pathname.startsWith("/api/projects") ||
        u.pathname.startsWith("/api/files") ||
        u.pathname.startsWith("/api/attachments") ||
        u.pathname.startsWith("/api/expenses")
      ) {
        const rebased = (isInternalHost || (browserIsRemote && isLocalHost))
          ? `${baseOrigin}${u.pathname}${u.search}${u.hash}`
          : value;
        return withAccessToken(rebased, token);
      }

      // 2. Storage / MinIO URLs -> extract the UNIQUE UUID or Mongo ObjectId from the path
      const isStorageUrl =
        isInternalHost ||
        value.includes("company-files") ||
        u.pathname.includes("/company-files/") ||
        /X-Amz-/i.test(value);

      if (isStorageUrl) {
        // A. Look for UUID v4 in pathname (e.g. 81189065-1b40-4f2b-a09d-8c3b1429b83d)
        const uuidMatch = u.pathname.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        if (uuidMatch) {
          const isProject = u.pathname.includes("/projects/") || u.pathname.includes("project");
          const base = isProject
            ? `${baseOrigin}/api/projects/attachments/${uuidMatch[1]}/view`
            : `${baseOrigin}/api/work-planner/attachments/${uuidMatch[1]}/view`;
          return withAccessToken(base, token);
        }

        // B. Look for 24-char hex resource ID after /resource/[^/]+/
        const resMatch = u.pathname.match(/\/resource\/[^/]+\/([a-f0-9]{24})/i);
        if (resMatch) {
          const isProject = u.pathname.includes("/projects/") || u.pathname.includes("project");
          const base = isProject
            ? `${baseOrigin}/api/projects/attachments/${resMatch[1]}/view`
            : `${baseOrigin}/api/work-planner/attachments/${resMatch[1]}/view`;
          return withAccessToken(base, token);
        }

        // C. Look for last path segment filename (avoiding generic directory names)
        const filenameMatch = u.pathname.split("/").filter(Boolean).pop();
        if (
          filenameMatch &&
          !["tenant", "view", "preview", "download", "original", "company-files", "resource"].includes(filenameMatch.toLowerCase())
        ) {
          const isProject = u.pathname.includes("/projects/") || u.pathname.includes("project");
          const base = isProject
            ? `${baseOrigin}/api/projects/attachments/${filenameMatch}/view`
            : `${baseOrigin}/api/work-planner/attachments/${filenameMatch}/view`;
          return withAccessToken(base, token);
        }
      }

      if (isInternalHost || (browserIsRemote && isLocalHost)) {
        const rebased = `${baseOrigin}${u.pathname}${u.search}${u.hash}`;
        return withAccessToken(rebased, token);
      }

      return withAccessToken(value, token);
    } catch {
      // Fall through to relative path resolution
    }
  }

  const cleanPath = value.startsWith("/") ? value : `/${value}`;
  if (
    cleanPath.startsWith("/api/work-planner") ||
    cleanPath.startsWith("/api/projects") ||
    cleanPath.startsWith("/api/files") ||
    cleanPath.startsWith("/api/attachments") ||
    cleanPath.startsWith("/api/expenses")
  ) {
    const full = `${baseOrigin}${cleanPath}`;
    return withAccessToken(full, token);
  }

  if (cleanPath.startsWith("/uploads") || cleanPath.startsWith("/api/uploads")) {
    const authBase = publicAuthServiceOrigin().replace(/\/+$/, "");
    const full = `${authBase}${cleanPath}`;
    return withAccessToken(full, token);
  }

  if (typeof window !== "undefined") {
    return new URL(cleanPath, window.location.origin).href;
  }
  return `${baseOrigin}${cleanPath}`;
}
