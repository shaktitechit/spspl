/**
 * @fileoverview Service for IndiaMART LMS CRM Integration v2 (Pull API - Option c).
 * Periodically pulls new leads received after the last API hit without date parameters.
 * @module modules/integrations/indiamart/indiamartPull.service
 */
const axios = require('axios');
const mongoose = require('mongoose');
const { getModels } = require('../../../data/mongoRegistry');
const { toPlain } = require('../../../utils/mongoJson');
const { generateLeadNo } = require('../../../utils/generateLeadNo');
const { logger } = require('../../../utils/logger');
const activityService = require('../../activity/activity.service');
const notificationService = require('../../notifications/notification.service');
const {
  getOrCreateIndiaMartSource,
  getDefaultCompanyId,
} = require('../../webhooks/indiamart/indiamart.service');
const {
  mapIndiaMartToLead,
} = require('../../webhooks/indiamart/indiamart.mapper');
const {
  INDIAMART_CRM_KEY,
  INDIAMART_DEFAULT_DEPARTMENT,
  INDIAMART_DEFAULT_ASSIGN_USER_ID,
  INDIAMART_PULL_CRON,
} = require('../../../config/env');

const INDIAMART_PULL_BASE_URL = 'https://mapi.indiamart.com/wservce/crm/crmListing/v2/';

// Concurrency mutex flag
let isPullRunning = false;
let lastPullStartedAt = null;

/**
 * Executes a GET request to IndiaMART Pull API (Option c: leads after last hit within 24h).
 */
async function fetchLeadsFromIndiaMart(crmKeyOverride = null) {
  const key = crmKeyOverride || INDIAMART_CRM_KEY;
  if (!key) {
    throw new Error('INDIAMART_CRM_KEY is not configured in environment or settings');
  }

  // Option c URL: glusr_crm_key without start_time/end_time
  const response = await axios.get(INDIAMART_PULL_BASE_URL, {
    params: {
      glusr_crm_key: key,
    },
    timeout: 25000,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'OPMS-LeadManager/2.0',
    },
  });

  return response.data;
}

/**
 * Ingests an array of IndiaMART lead records with deduplication.
 */
async function ingestRecords(records = [], { runType = 'CRON', actorId = null } = {}) {
  const { Lead, User } = getModels();
  const sourceDoc = await getOrCreateIndiaMartSource();
  const companyId = await getDefaultCompanyId();

  let assigned_to = null;
  let assigned_users = [];
  let status = 'new';
  let assigned_at = undefined;

  if (INDIAMART_DEFAULT_ASSIGN_USER_ID) {
    const targetUser = await User.findOne({
      _id: INDIAMART_DEFAULT_ASSIGN_USER_ID,
      is_active: true,
    }).lean();
    if (targetUser) {
      assigned_to = targetUser._id;
      assigned_users = [targetUser._id];
      status = 'assigned';
      assigned_at = new Date();
    }
  }

  let newLeadsCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;
  const createdLeadIds = [];

  for (const record of records) {
    try {
      const uniqueQueryId = String(record.UNIQUE_QUERY_ID || '').trim();
      const mobile = String(record.SENDER_MOBILE || record.SENDER_PHONE || '').trim();
      const email = String(record.SENDER_EMAIL || '').trim();

      // Skip invalid items lacking unique query ID or any contact info
      if (!uniqueQueryId || (!mobile && !email)) {
        logger.warn('[IndiaMart Pull] Skipping record missing UNIQUE_QUERY_ID or contact channel:', record);
        errorCount++;
        continue;
      }

      // Deduplication check
      const existing = await Lead.findOne({
        'indiamart_meta.unique_query_id': uniqueQueryId,
        deletedAt: null,
      }).lean();

      if (existing) {
        duplicateCount++;
        continue;
      }

      // Map record to Lead document format
      const mapped = mapIndiaMartToLead({
        rawData: record,
        defaultDepartment: INDIAMART_DEFAULT_DEPARTMENT,
        sourceDoc,
      });

      // Generate sequence number and insert
      let createdDoc = null;
      let attempts = 0;
      while (!createdDoc && attempts < 5) {
        attempts++;
        const lead_no = await generateLeadNo(new Date());
        try {
          createdDoc = await Lead.create({
            ...mapped,
            company_id: companyId,
            lead_no,
            assigned_to,
            assigned_users,
            assigned_at,
            status,
            last_activity_at: new Date(),
          });
        } catch (colErr) {
          if (colErr.code === 11000 && attempts < 5) continue;
          throw colErr;
        }
      }

      const plain = toPlain(createdDoc.toObject());
      createdLeadIds.push(plain._id);
      newLeadsCount++;

      // Log Activity
      await activityService.create({
        actor: actorId || assigned_to || undefined,
        entity_type: 'lead',
        entity_id: plain._id,
        action: 'created',
        message: `Lead #${plain.lead_no} (${plain.name}) pulled from IndiaMART CRM API (Query ID: ${uniqueQueryId})`,
        new_value: plain,
      });
    } catch (err) {
      logger.error('[IndiaMart Pull] Error saving individual lead record:', err);
      errorCount++;
    }
  }

  // Trigger Notifications if new leads were ingested
  if (newLeadsCount > 0 && assigned_to) {
    notificationService.createForUser(assigned_to, {
      title: `${newLeadsCount} New IndiaMART Lead${newLeadsCount > 1 ? 's' : ''} Pulled`,
      message: `${newLeadsCount} new lead${newLeadsCount > 1 ? 's have' : ' has'} been fetched from IndiaMART and assigned to your queue.`,
      type: 'info',
      module: 'lead_manager',
      entity_type: 'lead',
    }).catch((e) => logger.warn('[IndiaMart Pull] Notification dispatch failed:', e.message));
  }

  return {
    newLeadsCount,
    duplicateCount,
    errorCount,
    createdLeadIds,
  };
}

/**
 * Runs the end-to-end pull process with concurrency locking and audit logging.
 */
async function runLeadPull({ triggerType = 'CRON', actorId = null, crmKeyOverride = null } = {}) {
  if (isPullRunning) {
    logger.warn('[IndiaMart Pull] Pull operation already in progress. Skipping concurrent run.');
    return {
      status: 'BUSY',
      message: 'A pull operation is already currently in progress. Please retry in a moment.',
      startedAt: lastPullStartedAt,
    };
  }

  isPullRunning = true;
  lastPullStartedAt = new Date();
  const startTime = Date.now();
  const { IndiaMartSyncLog } = getModels();

  let syncStatus = 'SUCCESS';
  let httpCode = 200;
  let apiMessage = '';
  let totalRecords = 0;
  let newLeadsCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;
  let createdLeadIds = [];
  let errorDetails = null;

  try {
    logger.info(`[IndiaMart Pull] Starting lead pull (Trigger: ${triggerType})...`);

    const data = await fetchLeadsFromIndiaMart(crmKeyOverride);
    httpCode = Number(data.CODE || 200);
    apiMessage = String(data.MESSAGE || data.STATUS || '');
    totalRecords = Number(data.TOTAL_RECORDS || (Array.isArray(data.RESPONSE) ? data.RESPONSE.length : 0));

    // Handle IndiaMART Response Codes
    if (httpCode === 204 || totalRecords === 0) {
      syncStatus = 'NO_RECORDS';
      logger.info(`[IndiaMart Pull] No new leads available since last pull (${apiMessage || 'CODE 204'}).`);
    } else if (httpCode === 429) {
      syncStatus = 'RATE_LIMITED';
      errorDetails = apiMessage || 'Hit frequency limit exceeded (IndiaMART requires >= 5 min intervals)';
      logger.warn(`[IndiaMart Pull] Rate limited: ${errorDetails}`);
    } else if (httpCode === 401) {
      syncStatus = 'ERROR';
      errorDetails = apiMessage || 'Invalid or expired IndiaMART Pull API Key (glusr_crm_key)';
      logger.error(`[IndiaMart Pull] Authentication failed: ${errorDetails}`);
    } else if (httpCode === 200 && Array.isArray(data.RESPONSE)) {
      const ingestionResult = await ingestRecords(data.RESPONSE, { runType: triggerType, actorId });
      newLeadsCount = ingestionResult.newLeadsCount;
      duplicateCount = ingestionResult.duplicateCount;
      errorCount = ingestionResult.errorCount;
      createdLeadIds = ingestionResult.createdLeadIds;

      logger.info(`[IndiaMart Pull] Finished: ${newLeadsCount} new leads created, ${duplicateCount} duplicates skipped.`);
    } else {
      syncStatus = 'ERROR';
      errorDetails = `Unexpected IndiaMART response CODE: ${httpCode}. Message: ${apiMessage}`;
      logger.error(`[IndiaMart Pull] ${errorDetails}`);
    }
  } catch (err) {
    syncStatus = 'ERROR';
    httpCode = err.response?.status || 500;
    errorDetails = err.response?.data?.MESSAGE || err.message || 'Unknown network error';
    logger.error('[IndiaMart Pull] Execution failed with exception:', err.message);
  } finally {
    const durationMs = Date.now() - startTime;
    isPullRunning = false;

    // Save Sync Log in Database
    if (IndiaMartSyncLog) {
      await IndiaMartSyncLog.create({
        run_type: triggerType,
        status: syncStatus,
        http_code: httpCode,
        api_message: apiMessage,
        total_records: totalRecords,
        new_leads_count: newLeadsCount,
        duplicate_count: duplicateCount,
        error_count: errorCount,
        lead_ids: createdLeadIds,
        error_details: errorDetails,
        duration_ms: durationMs,
        triggered_by: actorId || undefined,
      }).catch((e) => logger.warn('[IndiaMart Pull] Failed to save sync log:', e.message));
    }

    return {
      success: syncStatus === 'SUCCESS' || syncStatus === 'NO_RECORDS',
      status: syncStatus,
      http_code: httpCode,
      message: apiMessage || (syncStatus === 'SUCCESS' ? 'Leads pulled and processed successfully' : errorDetails),
      total_records: totalRecords,
      new_leads_count: newLeadsCount,
      duplicate_count: duplicateCount,
      error_count: errorCount,
      created_leads: createdLeadIds,
      duration_ms: durationMs,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Returns the current status of the Pull API integration.
 */
async function getIntegrationStatus() {
  const { IndiaMartSyncLog } = getModels();

  let lastRun = null;
  if (IndiaMartSyncLog) {
    lastRun = await IndiaMartSyncLog.findOne().sort({ createdAt: -1 }).lean();
  }

  const configured = Boolean(INDIAMART_CRM_KEY);
  const maskedKey = configured
    ? `${INDIAMART_CRM_KEY.slice(0, 4)}...${INDIAMART_CRM_KEY.slice(-4)}`
    : 'Not Configured';

  return {
    configured,
    masked_key: maskedKey,
    is_running: isPullRunning,
    schedule: INDIAMART_PULL_CRON || '0 * * * *',
    frequency: 'Hourly (minute 0 of every hour)',
    mode: 'Option c (Leads received after last API hit without date parameters)',
    last_run: lastRun
      ? {
          run_type: lastRun.run_type,
          status: lastRun.status,
          total_records: lastRun.total_records,
          new_leads_count: lastRun.new_leads_count,
          duplicate_count: lastRun.duplicate_count,
          duration_ms: lastRun.duration_ms,
          timestamp: lastRun.createdAt,
          error_details: lastRun.error_details,
        }
      : null,
  };
}

/**
 * Lists past synchronization logs.
 */
async function listSyncLogs({ page = 1, limit = 20, status = null } = {}) {
  const { IndiaMartSyncLog } = getModels();
  if (!IndiaMartSyncLog) return { logs: [], total: 0 };

  const q = {};
  if (status) q.status = status;

  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = Math.max((parseInt(page, 10) || 1) - 1, 0) * take;

  const [logs, total] = await Promise.all([
    IndiaMartSyncLog.find(q)
      .populate('triggered_by', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(take)
      .lean(),
    IndiaMartSyncLog.countDocuments(q),
  ]);

  return { logs, total, page: parseInt(page, 10) || 1, limit: take };
}

module.exports = {
  fetchLeadsFromIndiaMart,
  ingestRecords,
  runLeadPull,
  getIntegrationStatus,
  listSyncLogs,
};
