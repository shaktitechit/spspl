/**
 * @fileoverview Service layer for handling IndiaMART Webhook Push leads, deduplication and logging.
 * @module modules/webhooks/indiamart/indiamart.service
 */
const mongoose = require('mongoose');
const { getModels } = require('../../../data/mongoRegistry');
const { toPlain } = require('../../../utils/mongoJson');
const { generateLeadNo } = require('../../../utils/generateLeadNo');
const { logger } = require('../../../utils/logger');
const activityService = require('../../activity/activity.service');
const notificationService = require('../../notifications/notification.service');
const authService = require('../../../services/authService');
const {
  INDIAMART_WEBHOOK_SECRET,
  INDIAMART_DEFAULT_DEPARTMENT,
  INDIAMART_DEFAULT_ASSIGN_USER_ID,
} = require('../../../config/env');
const {
  extractIndiaMartData,
  mapIndiaMartToLead,
} = require('./indiamart.mapper');
const { DEFAULT_SOURCE_NAME, DEFAULT_SOURCE_CODE } = require('./indiamart.constants');

/**
 * Validates the provided webhook token against configured INDIAMART_WEBHOOK_SECRET.
 * If no secret is configured, allows the call with a security warning log.
 */
function validateSecretToken(incomingToken) {
  if (!INDIAMART_WEBHOOK_SECRET) {
    logger.warn('[IndiaMart Webhook] INDIAMART_WEBHOOK_SECRET is not set; permitting unauthenticated push.');
    return true;
  }
  if (!incomingToken) return false;
  return incomingToken.trim() === INDIAMART_WEBHOOK_SECRET.trim();
}

/**
 * Ensures the "IndiaMART" LeadSource exists in the database.
 */
async function getOrCreateIndiaMartSource() {
  const { LeadSource } = getModels();
  let source = await LeadSource.findOne({
    $or: [{ name: DEFAULT_SOURCE_NAME }, { code: DEFAULT_SOURCE_CODE }],
    deletedAt: null,
  });

  if (!source) {
    try {
      source = await LeadSource.create({
        name: DEFAULT_SOURCE_NAME,
        code: DEFAULT_SOURCE_CODE,
        description: 'Inbound real-time push inquiries from IndiaMART Lead Manager CRM Push API',
        is_active: true,
        is_system: true,
      });
      logger.info(`[IndiaMart Webhook] Created LeadSource "${DEFAULT_SOURCE_NAME}"`);
    } catch (err) {
      if (err.code === 11000) {
        source = await LeadSource.findOne({ name: DEFAULT_SOURCE_NAME });
      } else {
        logger.error('[IndiaMart Webhook] Failed to create LeadSource:', err);
      }
    }
  }

  return source;
}

/**
 * Retrieves default company ID.
 */
async function getDefaultCompanyId() {
  const { CompanyInfo } = getModels();
  if (CompanyInfo) {
    const doc = await CompanyInfo.findOne().lean();
    if (doc?._id) return doc._id;
  }
  const fallback = await authService.getCompanyInfo();
  return fallback?._id || null;
}

/**
 * Processes an incoming webhook payload from IndiaMART Push API.
 * Guarantees idempotency via UNIQUE_QUERY_ID deduplication.
 */
async function processWebhook({ payload, headers = {}, ipAddress = '', secretToken = '' }) {
  const { Lead, IndiaMartWebhookLog, User } = getModels();

  // 1. Verify Secret Token if configured
  if (!validateSecretToken(secretToken)) {
    const errorMsg = 'Unauthorized: invalid or missing webhook secret token';
    if (IndiaMartWebhookLog) {
      await IndiaMartWebhookLog.create({
        status: 'INVALID',
        http_status: 401,
        message: errorMsg,
        ip_address: ipAddress,
        request_headers: headers,
        raw_payload: payload,
        error: errorMsg,
      }).catch((e) => logger.warn('[IndiaMart Webhook] Log save failed:', e.message));
    }
    return {
      httpStatus: 401,
      response: {
        CODE: 401,
        STATUS: 'FAILED',
        MESSAGE: errorMsg,
      },
    };
  }

  // 2. Extract and Normalize Data
  const data = extractIndiaMartData(payload);
  if (!data) {
    const errorMsg = 'Invalid payload: could not extract IndiaMART lead data from request body';
    if (IndiaMartWebhookLog) {
      await IndiaMartWebhookLog.create({
        status: 'INVALID',
        http_status: 400,
        message: errorMsg,
        ip_address: ipAddress,
        request_headers: headers,
        raw_payload: payload,
        error: errorMsg,
      }).catch((e) => logger.warn('[IndiaMart Webhook] Log save failed:', e.message));
    }
    return {
      httpStatus: 400,
      response: {
        CODE: 400,
        STATUS: 'FAILED',
        MESSAGE: errorMsg,
      },
    };
  }

  const uniqueQueryId = String(data.UNIQUE_QUERY_ID || '').trim();
  const senderMobile = String(data.SENDER_MOBILE || data.SENDER_PHONE || '').trim();
  const senderEmail = String(data.SENDER_EMAIL || '').trim();
  const senderName = String(data.SENDER_NAME || 'IndiaMART Buyer').trim();
  const productName = String(data.QUERY_PRODUCT_NAME || data.SUBJECT || 'Product Requirement').trim();
  const queryType = String(data.QUERY_TYPE || 'W').trim();

  // 3. Validate Mandatory IndiaMART Parameters
  if (!uniqueQueryId || (!senderMobile && !senderEmail)) {
    const errorMsg = 'Missing mandatory IndiaMART parameters: UNIQUE_QUERY_ID and at least one contact channel (SENDER_MOBILE or SENDER_EMAIL) are required.';
    if (IndiaMartWebhookLog) {
      await IndiaMartWebhookLog.create({
        unique_query_id: uniqueQueryId,
        sender_name: senderName,
        sender_mobile: senderMobile,
        sender_email: senderEmail,
        query_type: queryType,
        query_product_name: productName,
        status: 'INVALID',
        http_status: 400,
        message: errorMsg,
        ip_address: ipAddress,
        request_headers: headers,
        raw_payload: payload,
        error: errorMsg,
      }).catch((e) => logger.warn('[IndiaMart Webhook] Log save failed:', e.message));
    }
    return {
      httpStatus: 400,
      response: {
        CODE: 400,
        STATUS: 'FAILED',
        MESSAGE: errorMsg,
      },
    };
  }

  // 4. Deduplication Check (Idempotency)
  const existingLead = await Lead.findOne({
    'indiamart_meta.unique_query_id': uniqueQueryId,
    deletedAt: null,
  }).lean();

  if (existingLead) {
    logger.info(`[IndiaMart Webhook] Duplicate inquiry detected for UNIQUE_QUERY_ID=${uniqueQueryId}. Lead #${existingLead.lead_no} already exists.`);

    if (IndiaMartWebhookLog) {
      await IndiaMartWebhookLog.create({
        unique_query_id: uniqueQueryId,
        sender_name: senderName,
        sender_mobile: senderMobile,
        sender_email: senderEmail,
        query_type: queryType,
        query_product_name: productName,
        status: 'DUPLICATE',
        http_status: 200,
        message: `Duplicate lead ignored; already present as Lead #${existingLead.lead_no}`,
        lead: existingLead._id,
        ip_address: ipAddress,
        request_headers: headers,
        raw_payload: payload,
      }).catch((e) => logger.warn('[IndiaMart Webhook] Log save failed:', e.message));
    }

    // Always return HTTP 200 to satisfy IndiaMART's delivery confirmation
    return {
      httpStatus: 200,
      response: {
        CODE: 200,
        STATUS: 'SUCCESS',
        MESSAGE: 'Duplicate lead ignored; already ingested',
        UNIQUE_QUERY_ID: uniqueQueryId,
        is_duplicate: true,
        lead_id: existingLead._id,
        lead_no: existingLead.lead_no,
      },
    };
  }

  // 5. Ingest New Lead
  const sourceDoc = await getOrCreateIndiaMartSource();
  const companyId = await getDefaultCompanyId();

  // Determine Default Assignee
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

  const mappedData = mapIndiaMartToLead({
    rawData: data,
    defaultDepartment: INDIAMART_DEFAULT_DEPARTMENT,
    sourceDoc,
  });

  let createdLead = null;
  let attempts = 0;
  while (!createdLead && attempts < 5) {
    attempts++;
    const lead_no = await generateLeadNo(new Date());
    try {
      createdLead = await Lead.create({
        ...mappedData,
        company_id: companyId,
        lead_no,
        assigned_to,
        assigned_users,
        assigned_at,
        status,
        last_activity_at: new Date(),
      });
    } catch (err) {
      if (err.code === 11000 && attempts < 5) {
        continue;
      }
      logger.error('[IndiaMart Webhook] Failed to save lead:', err);
      throw err;
    }
  }

  const plainLead = toPlain(createdLead.toObject());

  // 6. Log Activity
  await activityService.create({
    actor: assigned_to || undefined,
    entity_type: 'lead',
    entity_id: plainLead._id,
    action: 'created',
    message: `Lead #${plainLead.lead_no} (${plainLead.name}) ingested from IndiaMART Push API (Query ID: ${uniqueQueryId})`,
    new_value: plainLead,
    ip_address: ipAddress,
  });

  // 7. Save Webhook Ingestion Log
  if (IndiaMartWebhookLog) {
    await IndiaMartWebhookLog.create({
      unique_query_id: uniqueQueryId,
      sender_name: senderName,
      sender_mobile: senderMobile,
      sender_email: senderEmail,
      query_type: queryType,
      query_product_name: productName,
      status: 'PROCESSED',
      http_status: 200,
      message: `Lead created as #${plainLead.lead_no}`,
      lead: plainLead._id,
      ip_address: ipAddress,
      request_headers: headers,
      raw_payload: payload,
    }).catch((e) => logger.warn('[IndiaMart Webhook] Log save failed:', e.message));
  }

  // 8. Trigger Notifications (Async & Best Effort)
  if (assigned_to) {
    notificationService.createForUser(assigned_to, {
      title: 'New IndiaMART Lead Assigned',
      message: `Lead #${plainLead.lead_no} (${plainLead.name}) has been assigned to you from IndiaMART.`,
      type: 'info',
      module: 'lead_manager',
      entity_type: 'lead',
      entity_id: plainLead._id,
    }).catch((e) => logger.warn('[IndiaMart Webhook] Notification failed:', e.message));
  }

  return {
    httpStatus: 200,
    response: {
      CODE: 200,
      STATUS: 'SUCCESS',
      MESSAGE: 'Lead processed and saved successfully',
      UNIQUE_QUERY_ID: uniqueQueryId,
      is_duplicate: false,
      lead_id: plainLead._id,
      lead_no: plainLead.lead_no,
    },
  };
}

/**
 * Retrieves past webhook logs for administrative auditing.
 */
async function listWebhookLogs({ limit = 50, page = 1, status = null } = {}) {
  const { IndiaMartWebhookLog } = getModels();
  if (!IndiaMartWebhookLog) return { logs: [], total: 0 };

  const q = {};
  if (status) q.status = status;

  const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const skip = Math.max((parseInt(page, 10) || 1) - 1, 0) * take;

  const [logs, total] = await Promise.all([
    IndiaMartWebhookLog.find(q)
      .populate('lead', 'lead_no name company_name status department')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(take)
      .lean(),
    IndiaMartWebhookLog.countDocuments(q),
  ]);

  return { logs, total, page, limit: take };
}

module.exports = {
  validateSecretToken,
  getOrCreateIndiaMartSource,
  getDefaultCompanyId,
  processWebhook,
  listWebhookLogs,
};
