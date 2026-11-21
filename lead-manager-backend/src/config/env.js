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
  LEAD_MANAGER_URL: process.env.LEAD_MANAGER_URL || process.env.NEXT_PUBLIC_LEAD_MANAGER_URL || 'http://localhost:7010/dashboard',
  INDIAMART_WEBHOOK_SECRET: process.env.INDIAMART_WEBHOOK_SECRET || '',
  INDIAMART_DEFAULT_DEPARTMENT: process.env.INDIAMART_DEFAULT_DEPARTMENT || 'UPS/Batteries',
  INDIAMART_DEFAULT_ASSIGN_USER_ID: process.env.INDIAMART_DEFAULT_ASSIGN_USER_ID || '',
  INDIAMART_CRM_KEY: process.env.INDIAMART_CRM_KEY || 'gIhfk7cDWoxdqBeFv+sb7kevHW7O1Axy',
  INDIAMART_PULL_ENABLED: process.env.INDIAMART_PULL_ENABLED ?? 'true',
  INDIAMART_PULL_CRON: process.env.INDIAMART_PULL_CRON || '0 * * * *',
  REDIS_URL:
    process.env.REDIS_URL ||
    (process.env.REDIS_PASSWORD
      ? `redis://:${process.env.REDIS_PASSWORD}@127.0.0.1:${process.env.REDIS_PORT || 7014}`
      : 'redis://:replace-with-redis-password@127.0.0.1:7014'),
  REDIS_CACHE_ENABLED: process.env.REDIS_CACHE_ENABLED !== 'false',
  REDIS_DEFAULT_TTL_SEC: Number(process.env.REDIS_DEFAULT_TTL_SEC) || 7200,
};
