/**
 * @fileoverview Configuration (logger) for message-service.
 * @module config/logger
 */
const logger = {
  info: (...args) => console.log('[INFO] [message-service]', ...args),
  warn: (...args) => console.warn('[WARN] [message-service]', ...args),
  error: (...args) => console.error('[ERROR] [message-service]', ...args),
};

module.exports = { logger };
