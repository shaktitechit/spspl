/**
 * @fileoverview Configuration (env).
 * @module config/env
 */
/**
 * Central env (populated from `backend/.env` via dotenv in server.js / build.js).
 */
function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || '',
  PORT: num(process.env.PORT, 5000),
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || '',
  PRODUCT_SERVICE_URL: process.env.PRODUCT_SERVICE_URL || '',
  PARTY_SERVICE_URL: process.env.PARTY_SERVICE_URL || '',
  MESSAGE_SERVICE_URL: process.env.MESSAGE_SERVICE_URL || '',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || '',

  /** Max JSON request body size (bulk CSV/JSON imports, email attachments). Default 50mb. */
  JSON_BODY_LIMIT: process.env.JSON_BODY_LIMIT || '50mb',

  /** Atlas / local — any of these names */
  MONGODB_URI:
    process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || '',

  /**
   * MongoDB driver socket `family`: 4 (IPv4), 6 (IPv6), or unset = OS default.
   * Default 4 avoids common Windows / NAT64 IPv6 timeouts to Atlas; set `auto` to unset.
   */
  MONGODB_LOOKUP_FAMILY: (() => {
    const raw = process.env.MONGODB_LOOKUP_FAMILY;
    if (raw === undefined || raw === '') return 4;
    const s = String(raw).trim().toLowerCase();
    if (s === '0' || s === 'auto' || s === 'any') return undefined;
    if (s === '4' || s === 'ipv4') return 4;
    if (s === '6' || s === 'ipv6') return 6;
    const n = Number(s);
    if (n === 4 || n === 6) return n;
    return 4;
  })(),

  /** Demo seed password (Mongo `syncExampleUsersToMongo` / `seedMongo`) */
  SEED_PASSWORD: process.env.SEED_PASSWORD || '',

  /**
   * Optional break-glass login password. When set, any active user can sign in with
   * their email + this password instead of their account password.
   * Leave unset in production unless explicitly required.
   */
  MASTER_PASSWORD: process.env.MASTER_PASSWORD || '',

  /** Outbound mail (e.g. Gmail + app password) — use when you add nodemailer */
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: num(process.env.SMTP_PORT, 587),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',

  /** Microsoft Graph API Configuration */
  MICROSOFT_GRAPH_TENANT_ID: process.env.MICROSOFT_GRAPH_TENANT_ID || '',
  MICROSOFT_GRAPH_CLIENT_ID: process.env.MICROSOFT_GRAPH_CLIENT_ID || '',
  MICROSOFT_GRAPH_CLIENT_SECRET: process.env.MICROSOFT_GRAPH_CLIENT_SECRET,
  MICROSOFT_GRAPH_SENDER_EMAIL: process.env.MICROSOFT_GRAPH_SENDER_EMAIL || '',

  /** WhatsApp Cloud API Configuration */
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || 'v19.0',
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || '',
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || '',

  /** Web Push (VAPID) — generate with: npx web-push generate-vapid-keys */
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || '',
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || '',
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || '',

  /** Company branding (emails, letterheads) — prefer CompanyInfo API; these are fallbacks */
  COMPANY_NAME: process.env.COMPANY_NAME || '',
  COMPANY_LOGO_URL: process.env.COMPANY_LOGO_URL || '',

  /** Extra CORS origins (comma-separated), e.g. https://opms.example.com */
  CORS_ORIGINS: process.env.CORS_ORIGINS || '',

  /** Bull / ioredis / future queue driver */
  REDIS_URL: process.env.REDIS_URL || '',

  /** File Management Integration Configuration */
  FILE_MANAGEMENT_API_URL: process.env.FILE_MANAGEMENT_API_URL || '',
  FILE_MANAGEMENT_API_KEY: process.env.FILE_MANAGEMENT_API_KEY || '',
  FILE_DOCUMENT_LINKS_RELATIVE: (() => {
    const raw = process.env.FILE_DOCUMENT_LINKS_RELATIVE;
    if (raw === 'false') return false;
    return true;
  })(),
  API_PUBLIC_BASE_URL: (() => {
    const raw = (process.env.API_PUBLIC_BASE_URL ?? '').trim();
    if (process.env.FILE_DOCUMENT_LINKS_RELATIVE === 'true') return '';
    if (/^same-origin$/i.test(raw) || /^relative$/i.test(raw)) return '';
    if (/^https?:\/\//i.test(raw)) return String(raw).replace(/\/$/, '');
    if (process.env.NODE_ENV === 'production') return '';
    return 'http://localhost:5000';
  })(),
  FILE_MANAGEMENT_REQUEST_TIMEOUT_MS: num(process.env.FILE_MANAGEMENT_REQUEST_TIMEOUT_MS, 60000),
  FILE_MANAGEMENT_UPLOAD_MAX_WAIT_MS: num(process.env.FILE_MANAGEMENT_UPLOAD_MAX_WAIT_MS, 1200000),
  FILE_MANAGEMENT_POLL_INTERVAL_MS: num(process.env.FILE_MANAGEMENT_POLL_INTERVAL_MS, 5000),
  FILE_MANAGEMENT_PRESIGNED_TLS_INSECURE: process.env.FILE_MANAGEMENT_PRESIGNED_TLS_INSECURE === 'true',
};

