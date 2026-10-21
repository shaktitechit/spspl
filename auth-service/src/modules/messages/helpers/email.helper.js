/**
 * @fileoverview Email helper for auth-service delegating to message-service.
 * Mirrors lead-manager-backend pattern: service JWT + POST /api/emails.
 */
const jwt = require('jsonwebtoken');
const { MESSAGE_SERVICE_URL, JWT_SECRET } = require('../../../config/env');

function getServiceToken() {
  return jwt.sign(
    {
      sub: 'auth-service',
      name: 'Auth Service',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function sendTemplateEmail(recipient, templateName, templateData = {}, attachments = [], cc = [], from = null) {
  if (!MESSAGE_SERVICE_URL) {
    throw new Error('MESSAGE_SERVICE_URL is not configured');
  }
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  const token = getServiceToken();
  const url = `${MESSAGE_SERVICE_URL.replace(/\/$/, '')}/api/emails`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient,
      templateName,
      templateParams: templateData,
      subject: templateData.subject,
      attachments,
      cc,
      from,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`message-service responded ${response.status}: ${text || response.statusText}`);
  }

  const data = await response.json().catch(() => ({}));
  console.info(`[Email Helper] Queued template email (${templateName}) to ${recipient}`);
  return data;
}

module.exports = {
  sendTemplateEmail,
};
