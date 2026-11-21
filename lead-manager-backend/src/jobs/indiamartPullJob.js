/**
 * @fileoverview Scheduled job for pulling IndiaMART leads hourly.
 * Credentials and configuration are managed strictly via environment variables (.env).
 * @module jobs/indiamartPullJob
 */
const cron = require('node-cron');
const {
  INDIAMART_PULL_ENABLED,
  INDIAMART_PULL_CRON,
  INDIAMART_CRM_KEY,
} = require('../config/env');
const { runLeadPull } = require('../modules/integrations/indiamart/indiamartPull.service');
const { logger } = require('../utils/logger');

function runIndiaMartPullScheduler({ timeZone = 'Asia/Kolkata' } = {}) {
  const isEnabled = String(INDIAMART_PULL_ENABLED).toLowerCase() !== 'false';
  if (!isEnabled) {
    logger.info('[scheduler] IndiaMART pull scheduler is disabled (INDIAMART_PULL_ENABLED=false)');
    return;
  }

  if (!INDIAMART_CRM_KEY) {
    logger.warn('[scheduler] IndiaMART pull scheduler skipped: INDIAMART_CRM_KEY is not configured in env.');
    return;
  }

  const cronExpr = INDIAMART_PULL_CRON || '0 * * * *'; // hourly at minute 0
  if (!cron.validate(cronExpr)) {
    logger.error(`[scheduler] Invalid cron expression for IndiaMART pull: "${cronExpr}"`);
    return;
  }

  cron.schedule(
    cronExpr,
    async () => {
      logger.info(`[scheduler] Triggering scheduled IndiaMART lead pull at ${new Date().toISOString()}...`);
      try {
        const result = await runLeadPull({ triggerType: 'CRON' });
        logger.info(
          `[scheduler] IndiaMART pull job completed: ${result.new_leads_count || 0} new leads, ${result.duplicate_count || 0} duplicates (status: ${result.status}).`
        );
      } catch (err) {
        logger.error(`[scheduler] IndiaMART scheduled lead pull error: ${err.message}`);
      }
    },
    { timezone: timeZone }
  );

  logger.info(`[scheduler] IndiaMART hourly lead pull scheduled at cron="${cronExpr}" tz="${timeZone}"`);
}

module.exports = {
  runIndiaMartPullScheduler,
};
