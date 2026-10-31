/**
 * Public backend origin (`NEXT_PUBLIC_API_ORIGIN`).
 * Defaults to localhost for local dev against the Express API.
 */
export function publicApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_ORIGIN?.trim();
  if (!raw) return "http://localhost:7001";
  return raw.replace(/\/+$/, "");
}

/**
 * Public auth service origin (`NEXT_PUBLIC_AUTH_ORIGIN`).
 * Defaults to auth-service on http://localhost:7003 or falls back to main API origin.
 */
export function publicAuthOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_AUTH_ORIGIN?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "http://localhost:7003";
}

/**
 * Public product service origin (`NEXT_PUBLIC_PRODUCT_SERVICE_URL`).
 * Defaults to product-service on http://localhost:7005.
 */
export function publicProductServiceOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "http://localhost:7005";
}

/**
 * Public party service origin (`NEXT_PUBLIC_PARTY_SERVICE_URL`).
 * Defaults to party-service on http://localhost:7006.
 */
export function publicPartyServiceOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_PARTY_SERVICE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "http://localhost:7006";
}

/**
 * Notifications are proxied by opms-backend (`/api/notifications`).
 * Backends reach notification-service via `NOTIFICATION_SERVICE_URL` (server-only).
 */
export function publicNotificationServiceOrigin(): string {
  return publicApiOrigin();
}

/**
 * Messages, emails, and communication queues are proxied by opms-backend (`/api/messages`, `/api/emails`, etc.).
 * Backends reach message-service via `MESSAGE_SERVICE_URL` (internal docker service only).
 */
export function publicMessageServiceOrigin(): string {
  return publicApiOrigin();
}

/**
 * Web Push VAPID public key (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`).
 * Must match backend `VAPID_PUBLIC_KEY`. Falls back to API fetch when empty.
 */
export function publicVapidKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || "";
}

/** Company name for PDF letterheads and branded exports (`NEXT_PUBLIC_COMPANY_NAME`). Prefer CompanyInfo API when available. */
export function companyLetterheadName(): string {
  return process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() || "";
}

/** Logo path or URL for PDF letterheads (`NEXT_PUBLIC_COMPANY_LOGO_URL`). Prefer CompanyInfo API when available. */
export function companyLetterheadLogoUrl(): string {
  return process.env.NEXT_PUBLIC_COMPANY_LOGO_URL?.trim() || "";
}

/** Resolves a public logo path to an absolute URL for canvas/PDF capture. */
export function resolvePublicAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window !== "undefined") {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return new URL(normalized, window.location.origin).href;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Resolves a file/attachment URL to an absolute URL using the correct public API origin.
 * Proxies direct MinIO/S3 object storage URLs via `/api/files/:id/view` so fresh presigned
 * URLs are obtained on demand instead of failing on expired S3 links.
 */
export function resolveFileUrl(url: string, fallbackId?: string): string {
  if (!url) {
    if (fallbackId) return `${publicApiOrigin()}/api/files/${fallbackId}/view`;
    return "";
  }
  try {
    if (/^https?:\/\//i.test(url)) {
      const u = new URL(url);

      const isMinioOrStorage =
        u.hostname === "localhost" ||
        u.hostname === "127.0.0.1" ||
        u.hostname === "minio" ||
        u.hostname.includes("minio") ||
        u.hostname.startsWith("172.") ||
        u.hostname.startsWith("192.168.") ||
        /X-Amz-/i.test(url) ||
        u.pathname.includes("/company-files/");

      if (u.pathname.includes("/api/files/") || u.pathname.startsWith("/api/")) {
        return `${publicApiOrigin()}${u.pathname}${u.search}${u.hash}`;
      }

      if (isMinioOrStorage) {
        if (fallbackId) {
          return `${publicApiOrigin()}/api/files/${fallbackId}/view`;
        }
        // Extract 24-character hex Mongo ID or UUID or last path component
        const mongoMatch = u.pathname.match(/([0-9a-fA-F]{24})/);
        if (mongoMatch) {
          return `${publicApiOrigin()}/api/files/${mongoMatch[1]}/view`;
        }
        const uuidMatch = u.pathname.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (uuidMatch) {
          return `${publicApiOrigin()}/api/files/${uuidMatch[1]}/view`;
        }
        const filenameMatch = u.pathname.split("/").filter(Boolean).pop();
        if (filenameMatch) {
          return `${publicApiOrigin()}/api/files/${filenameMatch}/view`;
        }
      }

      return url;
    }
  } catch {
    // fallback if URL parsing fails
  }
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return `${publicApiOrigin()}${normalized}`;
}

/**
 * Fetches a file blob with auth handling. For `/api/files/` routes, passes `token` via query string
 * so 302 redirects to MinIO/S3 presigned URLs won't include an Authorization header (which S3 rejects).
 * Direct presigned URLs (containing X-Amz-Signature) are fetched without Authorization headers.
 */
export async function fetchFileBlob(url: string, token?: string | null, fallbackId?: string): Promise<Response> {
  let fetchUrl = resolveFileUrl(url, fallbackId);
  const headers: Record<string, string> = {};

  const isPresignedUrl = /X-Amz-|X-Amz-Signature|X-Amz-Credential/i.test(fetchUrl);

  if (token && !isPresignedUrl) {
    if (fetchUrl.includes("/api/files/")) {
      const sep = fetchUrl.includes("?") ? "&" : "?";
      fetchUrl = `${fetchUrl}${sep}token=${encodeURIComponent(token)}`;
    } else if (fetchUrl.startsWith(publicApiOrigin()) || fetchUrl.startsWith("/")) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return fetch(fetchUrl, { headers });
}

