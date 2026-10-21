/**
 * @fileoverview Background workers coordinator for message-service.
 * @module workers/index
 */
const messageWorker = require('./message.worker');
const autoEmailWorker = require('./autoEmail.worker');
const { logger } = require('../config/logger');

let activeWorkers = {};

function startAll() {
  logger.info('Starting message-service background workers...');
  try {
    activeWorkers.message = messageWorker.start();
    activeWorkers.autoEmail = autoEmailWorker.start();
    logger.info('message-service background workers started.');
  } catch (err) {
    logger.error(`Failed to start workers: ${err.message}`);
  }
}

function stopAll() {
  logger.info('Stopping message-service background workers...');

  if (activeWorkers.message) {
    activeWorkers.message.close().catch((err) => {
      logger.error(`Error closing message worker: ${err.message}`);
    });
  }

  if (activeWorkers.autoEmail) {
    activeWorkers.autoEmail.close().catch((err) => {
      logger.error(`Error closing autoEmail worker: ${err.message}`);
    });
  }

  logger.info('message-service background workers stopped.');
}

module.exports = {
  startAll,
  stopAll,
  activeWorkers,
};
