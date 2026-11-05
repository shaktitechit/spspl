/**
 * @fileoverview CORS options: allowlist from CORS_ORIGINS; fail closed in production.
 * @module config/cors
 */
const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

// Matches localhost, loopback, and private LAN IP addresses (RFC 1918 & link-local)
const LOCAL_OR_LAN_ORIGIN_REGEX =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})(:\d+)?$/i;

const localDevOrigins = [
  'http://localhost:3000',
  'http://localhost:7002',
  'http://localhost:7004',
  'http://localhost:7008',
  'http://localhost:7010',
  'http://localhost:7013',
  'http://localhost:7015',
  'http://localhost:7016',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:7002',
  'http://127.0.0.1:7004',
  'http://127.0.0.1:7008',
  'http://127.0.0.1:7010',
  'http://127.0.0.1:7013',
  'http://127.0.0.1:7015',
  'http://127.0.0.1:7016',
];

function configuredOrigins() {
  const raw = String(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '').trim();
  if (raw === '*') return ['*'];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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

    // Always allow localhost / 127.0.0.1 / private LAN IP origins on any port for micro-frontends and local/LAN testing
    if (LOCAL_OR_LAN_ORIGIN_REGEX.test(origin)) {
      return callback(null, true);
    }

    const allowed = allowedOrigins();
    if (allowed.includes('*')) {
      return callback(null, true);
    }

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
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
};
