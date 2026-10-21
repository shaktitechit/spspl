/**
 * Session cookie TTL aligned with default JWT access token (8h).
 * Middleware / authStorage should use this instead of 7-day defaults.
 */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;
export const SESSION_COOKIE_MAX_AGE_DAYS = SESSION_COOKIE_MAX_AGE_SECONDS / 86400;
