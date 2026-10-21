/**
 * @fileoverview Email helper for lead-manager-backend delegating to message-service.
 * @module modules/messages/helpers/email.helper
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { MESSAGE_SERVICE_URL, JWT_SECRET } = require('../../../config/env');
const { logger } = require('../../../utils/logger');

function getServiceToken() {
  return jwt.sign(
    {
      sub: 'lead-manager-service',
      name: 'Lead Manager Service',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function sendEmail(recipient, subject, textBody, htmlBody, attachments = [], cc = [], from = null) {
  try {
    const token = getServiceToken();
    const url = `${MESSAGE_SERVICE_URL.replace(/\/$/, '')}/api/emails`;
    const response = await axios.post(
      url,
      {
        recipient,
        subject,
        body: htmlBody || textBody,
        attachments,
        cc,
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
    logger.info(`[Email Helper] Successfully queued email to ${recipient} via message-service`);
    return response.data;
  } catch (err) {
    logger.error(`[Email Helper] Failed to send email to ${recipient} via message-service: ${err.message}`);
    throw err;
  }
}

async function sendTemplateEmail(recipient, templateName, templateData = {}, attachments = [], cc = [], from = null) {
  try {
    const token = getServiceToken();
    const url = `${MESSAGE_SERVICE_URL.replace(/\/$/, '')}/api/emails`;
    const response = await axios.post(
      url,
      {
        recipient,
        templateName,
        templateParams: templateData,
        subject: templateData.subject,
        attachments,
        cc,
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
    logger.info(`[Email Helper] Successfully queued template email (${templateName}) to ${recipient} via message-service`);
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
