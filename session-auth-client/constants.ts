export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
export const REFRESH_EXPIRES_COOKIE = "refresh_expires_at";
export const AUTH_BROADCAST_CHANNEL = "shakti.auth.session";

/** Allow small clock drift before treating tokens as expired. */
export const CLOCK_SKEW_MS = 30_000;

export const DEFAULT_LEGACY_AUTH_COOKIES = [
  "shakti_session",
  "medica_session",
  "shakti_department",
  "shakti_roles",
  "medica_opms_roles",
  "medica_department_hint",
] as const;
