/**
 * @fileoverview CORS options: allowlist from CORS_ORIGINS; fail closed in production.
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

function configuredOrigins() {
  return String(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((o) => o !== '*');
}

function allowedOrigins() {
  const fromEnv = configuredOrigins();
  if (isProd) return fromEnv;
  return [...new Set([...localDevOrigins, ...fromEnv])];
}

module.exports = {
  origin(origin, callback) {
    // Non-browser / same-origin tools (curl, server-to-server) send no Origin
    if (!origin) return callback(null, true);

    const allowed = allowedOrigins();
    if (isProd && allowed.length === 0) {
      return callback(new Error('CORS_ORIGINS is not configured for production'));
    }
    if (!isProd && allowed.length === 0) {
      return callback(null, true);
    }
    if (allowed.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
};
