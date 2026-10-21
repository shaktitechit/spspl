/**
 * @fileoverview Posts notifications to notification-service (shared in-app / SSE / push).
 * @module utils/notificationHelper
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { NOTIFICATION_SERVICE_URL, JWT_SECRET } = require('../config/env');
const { logger } = require('./logger');

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

async function createForUser(userId, payload) {
  try {
    const url = `${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/internal/create`;
    const response = await axios.post(
      url,
      { userId, payload },
      {
        timeout: 10000,
        headers: {
          Authorization: `Bearer ${getServiceToken()}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data?.data ?? null;
  } catch (err) {
    logger.error(`[notificationHelper.createForUser] ${err?.message || err}`);
    return null;
  }
}

module.exports = {
  createForUser,
};
