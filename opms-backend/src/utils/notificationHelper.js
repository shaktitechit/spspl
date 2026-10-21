const axios = require('axios');
const jwt = require('jsonwebtoken');
const { NOTIFICATION_SERVICE_URL, JWT_SECRET } = require('../config/env');

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

function authHeaders() {
  return {
    Authorization: `Bearer ${getServiceToken()}`,
    'Content-Type': 'application/json',
  };
}

async function createForUser(userId, payload) {
  try {
    const url = `${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/internal/create`;
    const response = await axios.post(url, { userId, payload }, { headers: authHeaders() });
    return response.data?.data;
  } catch (err) {
    console.error('[notificationHelper.createForUser] Error:', err?.message || err);
    return null;
  }
}

async function notifyOrderTransition({ order, fromStatus, nextStatus, actorId }) {
  try {
    const url = `${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/internal/order-transition`;
    await axios.post(url, { order, fromStatus, nextStatus, actorId }, { headers: authHeaders() });
  } catch (err) {
    console.error('[notificationHelper.notifyOrderTransition] Error:', err?.message || err);
  }
}

module.exports = {
  createForUser,
  notifyOrderTransition,
};
