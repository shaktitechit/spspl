/**
 * @fileoverview Notification helper for lead-manager-backend (delegates to notification-service).
 * @module modules/notifications/notification.service
 */
const notificationHelper = require('../../utils/notificationHelper');

async function createForUser(userId, payload) {
  return notificationHelper.createForUser(userId, payload);
}

module.exports = {
  createForUser,
};
