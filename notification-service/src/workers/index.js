const notificationWorker = require('./notification.worker');
const { logger } = require('../config/logger');

let activeWorkers = {
  notification: null,
};

function startAll() {
  logger.info('[workers] Starting notification-service workers...');
  try {
    activeWorkers.notification = notificationWorker.start();
    logger.info('[workers] Notification worker active.');
  } catch (err) {
    logger.error(`[workers] Failed to start notification worker: ${err.message}`);
  }
}

function stopAll() {
  logger.info('[workers] Stopping notification-service workers...');
  if (activeWorkers.notification) {
    activeWorkers.notification.close().catch((err) => {
      logger.error(`[workers] Error closing notification worker: ${err.message}`);
    });
  }
}

module.exports = { startAll, stopAll };
