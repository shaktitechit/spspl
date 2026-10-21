require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 7003,
  NODE_ENV: process.env.NODE_ENV || '',
  MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '8h',
  MASTER_PASSWORD: process.env.MASTER_PASSWORD || '',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:7012',
  MESSAGE_SERVICE_URL: process.env.MESSAGE_SERVICE_URL || 'http://message-service:7011',
  /** Public login URL included in welcome emails (app-frontend). */
  APP_LOGIN_URL:
    process.env.APP_LOGIN_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:7013',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '',
  CORS_ORIGINS: process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '',
  JSON_BODY_LIMIT: process.env.JSON_BODY_LIMIT || '15mb',
};
