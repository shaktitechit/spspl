require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 7009,
  MONGODB_URI:
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DATABASE_URL ||
    '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || '',
  OPMS_BACKEND_URL: process.env.OPMS_BACKEND_URL || 'http://opms-backend:7001',
  MESSAGE_SERVICE_URL: process.env.MESSAGE_SERVICE_URL || '',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  JSON_BODY_LIMIT: process.env.JSON_BODY_LIMIT || '15mb',
  FILE_MANAGEMENT_API_URL: process.env.FILE_MANAGEMENT_API_URL || '',
  FILE_MANAGEMENT_API_KEY:
    process.env.FILE_MANAGEMENT_API_KEY ||
    '',
  FOLLOWUP_REMINDER_ENABLED: process.env.FOLLOWUP_REMINDER_ENABLED ?? 'true',
  FOLLOWUP_REMINDER_CRON: process.env.FOLLOWUP_REMINDER_CRON || '0 7 * * *',
  FOLLOWUP_REMINDER_TZ: process.env.FOLLOWUP_REMINDER_TZ || 'Asia/Kolkata',
};
