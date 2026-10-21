/**
 * @fileoverview Configuration (env) for message-service.
 * @module config/env
 */
const path = require('path');
const fs = require('fs');

function loadEnvFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (_e) {}
}

try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '../../../.env.docker') });
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../.env.docker') });
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  dotenv.config();
} catch (_err) {
  loadEnvFile(path.resolve(__dirname, '../../../.env.docker'));
  loadEnvFile(path.resolve(__dirname, '../../../.env'));
  loadEnvFile(path.resolve(__dirname, '../../.env.docker'));
  loadEnvFile(path.resolve(__dirname, '../../.env'));
  loadEnvFile(path.resolve(__dirname, '../.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env'));
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || '',
  PORT: num(process.env.PORT, 7011),
  JWT_SECRET: process.env.JWT_SECRET || '',
  JSON_BODY_LIMIT: process.env.JSON_BODY_LIMIT || '50mb',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || '',

  MONGODB_URI:
    process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || '',

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

  REDIS_URL: process.env.REDIS_URL || '',

  /** Outbound mail (SMTP / Nodemailer) */
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: num(process.env.SMTP_PORT, 587),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',

  /** Microsoft Graph API Configuration */
  MICROSOFT_GRAPH_TENANT_ID: process.env.MICROSOFT_GRAPH_TENANT_ID || '',
  MICROSOFT_GRAPH_CLIENT_ID: process.env.MICROSOFT_GRAPH_CLIENT_ID || '',
  MICROSOFT_GRAPH_CLIENT_SECRET: process.env.MICROSOFT_GRAPH_CLIENT_SECRET || '',
  MICROSOFT_GRAPH_SENDER_EMAIL: process.env.MICROSOFT_GRAPH_SENDER_EMAIL || '',

  /** Google Gmail API Configuration */
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',
  GOOGLE_GMAIL_SCOPES:
    process.env.GOOGLE_GMAIL_SCOPES ||
    'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email',

  /** Credential Encryption */
  EMAIL_ENCRYPTION_KEY: process.env.EMAIL_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || '',

  /** WhatsApp Cloud API Configuration */
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || 'v19.0',
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || '',
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || '',
};
