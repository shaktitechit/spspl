/**
 * @fileoverview CORS options: allowlist from CORS_ORIGINS; deny unknown origins.
 * Never throws (a thrown Error becomes Express 500 on preflight).
 * @module config/cors
 */
const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

const localDevOrigins = [
  'http://localhost:3000',
  'http://localhost:7002',
  'http://localhost:7004',
  'http://localhost:7008',
  'http://localhost:7010',
  'http://localhost:7013',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:7002',
  'http://127.0.0.1:7004',
  'http://127.0.0.1:7008',
  'http://127.0.0.1:7010',
  'http://127.0.0.1:7013',
];

const PUBLIC_URL_KEYS = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_OPMS_URL',
  'NEXT_PUBLIC_USER_MANAGER_URL',
  'NEXT_PUBLIC_WORK_PLANNER_URL',
  'NEXT_PUBLIC_LEAD_MANAGER_URL',
  'APP_LOGIN_URL',
  'LEAD_MANAGER_PUBLIC_URL',
];

function originFromUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function configuredOrigins() {
  return String(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((o) => o !== '*');
}

function originsFromPublicUrls() {
  const out = [];
  for (const key of PUBLIC_URL_KEYS) {
    const origin = originFromUrl(process.env[key]);
    if (origin) out.push(origin);
  }
  return out;
}

function allowedOrigins() {
  const fromEnv = configuredOrigins();
  const fromPublic = originsFromPublicUrls();
  const merged = [...new Set([...fromEnv, ...fromPublic])];

  // Compose often runs NODE_ENV=production while browsers use localhost:* ports
  const allowLocalhost =
    !isProd ||
    process.env.CORS_ALLOW_LOCALHOST === '1' ||
    process.env.CORS_ALLOW_LOCALHOST === 'true' ||
    merged.length === 0 ||
    merged.some((o) => /localhost|127\.0\.0\.1/i.test(o));

  if (allowLocalhost) {
    return [...new Set([...localDevOrigins, ...merged])];
  }
  return merged;
}

let warnedEmpty = false;

module.exports = {
  origin(origin, callback) {
    // Non-browser / same-origin tools (curl, server-to-server) send no Origin
    if (!origin) return callback(null, true);

    const allowed = allowedOrigins();
    if (allowed.length === 0) {
      if (!warnedEmpty) {
        warnedEmpty = true;
        console.warn(
          '[cors] No CORS_ORIGINS / NEXT_PUBLIC_* origins configured; denying browser Origin headers'
        );
      }
      return callback(null, false);
    }
    if (allowed.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
};
