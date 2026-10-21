/**
 * @fileoverview Email helper for backend service delegating to message-service via HTTP.
 * @module utils/emailHelper
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { MESSAGE_SERVICE_URL, JWT_SECRET } = require('../config/env');

const EMAIL_TEMPLATES = {
  DEFAULT: 'default',
  WELCOME: 'welcome',
  ORDER_UPDATE: 'order_update',
  ORDER_RECEIVED: 'order_received',
  ORDER_RECEIVED_SALES: 'order_received_sales',
  ORDER_DELIVERED: 'order_delivered',
  ORDER_CANCELLED: 'order_cancelled',
  ORDER_ON_HOLD: 'order_on_hold',
  ORDER_REJECTED: 'order_rejected',
  DUE_SHEET_PENDING: 'due_sheet_pending',
  ADMIN_APPROVAL_PENDING: 'admin_approval_pending',
  FINANCE_APPROVAL_PENDING: 'finance_approval_pending',
  ACCOUNT_APPROVAL_PENDING: 'account_approval_pending',
  DISPATCH_PENDING: 'dispatch_pending',
  TRANSPORT_PENDING: 'transport_pending',
  PASSWORD_RESET: 'password_reset',
  LEAD_QUOTATION: 'lead_quotation',
  COMPANY_LETTERHEAD: 'company_letterhead',
};

function getServiceToken() {
  return jwt.sign(
    {
      sub: 'backend-service',
      name: 'Backend Service',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Triggers an automated email via message-service HTTP endpoint.
 * Accepts a single email string or an array of email strings.
 * @param {object} params
 * @param {string|string[]} params.recipient
 * @param {string} params.templateName
 * @param {object} [params.templateParams]
 */
async function shootAutoEmail({ recipient, templateName, templateParams = {} }) {
  if (!recipient || (Array.isArray(recipient) && recipient.length === 0)) {
    return null;
  }

  const rawList = Array.isArray(recipient) ? recipient : String(recipient).split(',');
  const recipients = Array.from(
    new Set(
      rawList
        .map((r) => (typeof r === 'string' ? r.trim() : ''))
        .filter((r) => Boolean(r && r.includes('@')))
    )
  );

  if (recipients.length === 0) return null;

  const token = getServiceToken();
  const url = `${MESSAGE_SERVICE_URL.replace(/\/$/, '')}/api/auto-emails/trigger`;

  const results = await Promise.allSettled(
    recipients.map(async (toEmail) => {
      try {
        const response = await axios.post(
          url,
          {
            recipient: toEmail,
            templateName,
            templateParams: {
              ...templateParams,
              recipient: toEmail,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );
        return response.data;
      } catch (err) {
        console.error(
          `[emailHelper] Failed to trigger auto-email (${templateName}) to ${toEmail} via message-service: ${err.message}`
        );
        return null;
      }
    })
  );

  return results.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean);
}

module.exports = {
  EMAIL_TEMPLATES,
  shootAutoEmail,
};
