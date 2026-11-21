/**
 * @fileoverview Redis connection instance for caching in lead-manager-backend.
 * @module config/redis
 */
const Redis = require('ioredis');
const { REDIS_URL, REDIS_CACHE_ENABLED } = require('./env');
const { logger } = require('../utils/logger');

let client = null;
let isConnected = false;

if (REDIS_CACHE_ENABLED) {
  try {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false, // Fail fast to MongoDB when Redis is unavailable
      connectTimeout: 5000,
      retryStrategy(times) {
        if (times > 10) {
          logger.warn('[Redis] Max reconnection attempts reached. Continuing in fallback mode.');
          return 30000;
        }
        return Math.min(times * 500, 5000);
      },
    });

    client.on('connect', () => {
      isConnected = true;
      logger.info('[Redis] Connected to Redis cache successfully');
    });

    client.on('ready', () => {
      isConnected = true;
    });

    client.on('error', (err) => {
      isConnected = false;
      logger.warn(`[Redis] Connection warning: ${err.message}. Cache operations will fail-open to DB.`);
    });

    client.on('close', () => {
      isConnected = false;
    });
  } catch (err) {
    logger.error('[Redis] Failed to initialize Redis client:', err);
    client = null;
    isConnected = false;
  }
} else {
  logger.info('[Redis] Caching disabled via REDIS_CACHE_ENABLED=false');
}

/**
 * Returns true if Redis is ready to accept commands.
 * @returns {boolean}
 */
function isRedisReady() {
  return isConnected && client !== null && client.status === 'ready';
}

module.exports = {
  redisClient: client,
  isRedisReady,
};
