/**
 * @fileoverview Email helper for work-planner-backend delegating to message-service
 * with user email notification preference checks and CC filtering.
 * @module modules/messages/helpers/email.helper
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { MESSAGE_SERVICE_URL, JWT_SECRET } = require('../../../config/env');
const { logger } = require('../../../utils/logger');
const {
  isEmailAllowedForUser,
  filterAllowedCcEmails,
} = require('../../../services/emailPreference.service');

function getServiceToken() {
  return jwt.sign(
    {
      sub: 'work-planner-service',
      name: 'Work Planner Service',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Dispatches an email after checking recipient preferences and filtering CC lists.
 */
async function sendEmail(
  recipient,
  subject,
  textBody,
  htmlBody,
  attachments = [],
  cc = [],
  from = null,
  emailType = null
) {
  try {
    let targetRecipient = recipient;
    let targetCc = Array.isArray(cc) ? [...cc] : [];

    // Enforce email preferences if emailType is specified
    if (emailType) {
      const allowed = await isEmailAllowedForUser(targetRecipient, emailType);
      const allowedCc = await filterAllowedCcEmails(targetCc, emailType);

      if (!allowed) {
        if (allowedCc.length > 0) {
          logger.info(`[Email Helper] Primary recipient ${targetRecipient} opted out of ${emailType}; promoting 1st CC recipient ${allowedCc[0]}`);
          targetRecipient = allowedCc[0];
          targetCc = allowedCc.slice(1);
        } else {
          logger.info(`[Email Helper] Skipped sending email to ${targetRecipient} (opted out of ${emailType} and no allowed CC)`);
          return { skipped: true, reason: 'opted_out' };
        }
      } else {
        targetCc = allowedCc;
      }
    }

    const token = getServiceToken();
    const baseUrl = MESSAGE_SERVICE_URL || process.env.MESSAGE_SERVICE_URL || '';
    if (!baseUrl) {
      throw new Error('MESSAGE_SERVICE_URL environment variable is not set');
    }
    const url = `${baseUrl.replace(/\/$/, '')}/api/emails`;
    const response = await axios.post(
      url,
      {
        recipient: targetRecipient,
        subject,
        body: htmlBody || textBody,
        attachments,
        cc: targetCc,
        from,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    logger.info(`[Email Helper] Successfully queued email to ${targetRecipient} (type: ${emailType || 'standard'}) via message-service`);
    return response.data;
  } catch (err) {
    logger.error(`[Email Helper] Failed to send email to ${recipient} via message-service: ${err.message}`);
    throw err;
  }
}

/**
 * Dispatches a template-rendered email after checking preferences.
 */
async function sendTemplateEmail(
  recipient,
  templateName,
  templateData = {},
  attachments = [],
  cc = [],
  from = null,
  emailType = null
) {
  try {
    let targetRecipient = recipient;
    let targetCc = Array.isArray(cc) ? [...cc] : [];

    // Enforce email preferences if emailType is specified
    if (emailType) {
      const allowed = await isEmailAllowedForUser(targetRecipient, emailType);
      const allowedCc = await filterAllowedCcEmails(targetCc, emailType);

      if (!allowed) {
        if (allowedCc.length > 0) {
          logger.info(`[Email Helper] Primary recipient ${targetRecipient} opted out of ${emailType}; promoting 1st CC recipient ${allowedCc[0]}`);
          targetRecipient = allowedCc[0];
          targetCc = allowedCc.slice(1);
        } else {
          logger.info(`[Email Helper] Skipped sending template email (${templateName}) to ${targetRecipient} (opted out of ${emailType})`);
          return { skipped: true, reason: 'opted_out' };
        }
      } else {
        targetCc = allowedCc;
      }
    }

    const token = getServiceToken();
    const baseUrl = MESSAGE_SERVICE_URL || process.env.MESSAGE_SERVICE_URL || '';
    if (!baseUrl) {
      throw new Error('MESSAGE_SERVICE_URL environment variable is not set');
    }
    const url = `${baseUrl.replace(/\/$/, '')}/api/emails`;
    const response = await axios.post(
      url,
      {
        recipient: targetRecipient,
        templateName,
        templateParams: templateData,
        subject: templateData.subject,
        attachments,
        cc: targetCc,
        from,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    logger.info(`[Email Helper] Successfully queued template email (${templateName}) to ${targetRecipient} (type: ${emailType || 'standard'}) via message-service`);
    return response.data;
  } catch (err) {
    logger.error(`[Email Helper] Failed to send template email (${templateName}) via message-service: ${err.message}`);
    throw err;
  }
}

module.exports = {
  sendEmail,
  sendTemplateEmail,
};
