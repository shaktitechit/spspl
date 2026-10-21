/**
 * @fileoverview Cron schedules for lead-manager-backend.
 * Manages Morning Agenda Digests (07:30 AM), Intraday Pre-Due Alerts (every 15 mins), and Overdue Escalations (12:30 & 17:30).
 * @module jobs/scheduler
 */
const cron = require('node-cron');
const {
  FOLLOWUP_REMINDER_ENABLED,
  FOLLOWUP_REMINDER_CRON,
  FOLLOWUP_REMINDER_TZ,
} = require('../config/env');
const { runAllFollowUpReminders } = require('./followUpDailyReminder');
const { runPreDueFollowUpCheck } = require('./followUpPreDueJob');
const { runOverdueEscalationCheck } = require('./followUpEscalationJob');
const { logger } = require('../utils/logger');

let started = false;

function startSchedulers() {
  if (started) return;
  started = true;

  const enabled = String(FOLLOWUP_REMINDER_ENABLED).toLowerCase() !== 'false';
  if (!enabled) {
    logger.info('[scheduler] follow-up auto notification schedulers disabled (FOLLOWUP_REMINDER_ENABLED=false)');
    return;
  }

  const morningCron = FOLLOWUP_REMINDER_CRON || '30 7 * * *'; // 07:30 AM IST
  const timeZone = FOLLOWUP_REMINDER_TZ || 'Asia/Kolkata';

  // 1. Daily Morning & Overdue Agenda Digest (07:30 AM)
  if (cron.validate(morningCron)) {
    cron.schedule(
      morningCron,
      () => {
        runAllFollowUpReminders({ timeZone }).catch((err) => {
          logger.error(`[scheduler] daily morning follow-up reminders failed: ${err.message}`);
        });
      },
      { timezone: timeZone }
    );
    logger.info(`[scheduler] daily morning follow-up agenda scheduled at cron="${morningCron}" tz="${timeZone}"`);
  }

  // 2. Intraday Pre-Due Live Alerts (Every 15 minutes)
  const preDueCron = '*/15 * * * *';
  cron.schedule(
    preDueCron,
    () => {
      runPreDueFollowUpCheck({ timeZone }).catch((err) => {
        logger.error(`[scheduler] pre-due follow-up check failed: ${err.message}`);
      });
    },
    { timezone: timeZone }
  );
  logger.info(`[scheduler] pre-due real-time alerts scheduled at cron="${preDueCron}" tz="${timeZone}"`);

  // 3. Midday & Evening Overdue Escalation Engine (12:30 PM & 05:30 PM)
  const escalationCron = '30 12,17 * * *';
  cron.schedule(
    escalationCron,
    () => {
      runOverdueEscalationCheck({ timeZone }).catch((err) => {
        logger.error(`[scheduler] overdue escalation check failed: ${err.message}`);
      });
    },
    { timezone: timeZone }
  );
  logger.info(`[scheduler] overdue escalation checks scheduled at cron="${escalationCron}" tz="${timeZone}"`);

  // 4. Quotation Auto-Expiry Engine (Every hour at minute 0)
  const { autoExpireQuotations, checkAndSendPreExpiryAlerts } = require('../modules/quotations/quotation.service');
  const quoteExpiryCron = '0 * * * *';
  cron.schedule(
    quoteExpiryCron,
    () => {
      autoExpireQuotations().catch((err) => {
        logger.error(`[scheduler] quotation auto-expiry job failed: ${err.message}`);
      });
    },
    { timezone: timeZone }
  );
  logger.info(`[scheduler] quotation auto-expiry engine scheduled at cron="${quoteExpiryCron}" tz="${timeZone}"`);

  // 5. Quotation Pre-Expiry Alerts (09:00 AM & 03:00 PM IST)
  const quoteAlertCron = '0 9,15 * * *';
  cron.schedule(
    quoteAlertCron,
    () => {
      checkAndSendPreExpiryAlerts().catch((err) => {
        logger.error(`[scheduler] quotation pre-expiry alert job failed: ${err.message}`);
      });
    },
    { timezone: timeZone }
  );
  logger.info(`[scheduler] quotation pre-expiry alerts scheduled at cron="${quoteAlertCron}" tz="${timeZone}"`);
}

module.exports = {
  startSchedulers,
};
