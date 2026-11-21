/**
 * @fileoverview Central Redis Cache Service for lead-manager-backend.
 * Implements Two-Tier Lookaside caching, chunked differential DB fetching (mgetWithDbFallback),
 * and automatic cache invalidation helpers with fail-open resilience.
 * @module services/cache.service
 */
const { redisClient, isRedisReady } = require('../config/redis');
const { REDIS_DEFAULT_TTL_SEC } = require('../config/env');
const { logger } = require('../utils/logger');

/**
 * Prefix constant for all Lead Manager cache keys.
 */
const PREFIX = 'lm';

/**
 * Check if caching is currently available.
 * @returns {boolean}
 */
function isReady() {
  return isRedisReady();
}

/**
 * Retrieve and parse JSON from Redis. Returns null on miss or error.
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function get(key) {
  if (!isReady()) return null;
  try {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`[Cache GET] Failed for key ${key}: ${err.message}`);
    return null;
  }
}

/**
 * Serialize and store value in Redis with TTL.
 * @param {string} key
 * @param {any} value
 * @param {number} [ttlSec]
 * @returns {Promise<boolean>}
 */
async function set(key, value, ttlSec = REDIS_DEFAULT_TTL_SEC) {
  if (!isReady() || value === undefined) return false;
  try {
    const serialized = JSON.stringify(value);
    if (ttlSec && ttlSec > 0) {
      await redisClient.set(key, serialized, 'EX', ttlSec);
    } else {
      await redisClient.set(key, serialized);
    }
    return true;
  } catch (err) {
    logger.warn(`[Cache SET] Failed for key ${key}: ${err.message}`);
    return false;
  }
}

/**
 * Delete one or more specific keys from Redis.
 * @param {...string|string[]} keys
 * @returns {Promise<number>}
 */
async function del(...keys) {
  if (!isReady()) return 0;
  const flatKeys = keys.flat().filter(Boolean);
  if (flatKeys.length === 0) return 0;

  try {
    return await redisClient.del(flatKeys);
  } catch (err) {
    logger.warn(`[Cache DEL] Failed for keys: ${err.message}`);
    return 0;
  }
}

/**
 * Delete keys matching a pattern without blocking Redis (using SCAN).
 * @param {string} pattern
 * @returns {Promise<number>}
 */
async function delByPattern(pattern) {
  if (!isReady()) return 0;
  try {
    const stream = redisClient.scanStream({
      match: pattern,
      count: 100,
    });

    let totalDeleted = 0;
    for await (const resultKeys of stream) {
      if (resultKeys.length > 0) {
        await redisClient.del(resultKeys);
        totalDeleted += resultKeys.length;
      }
    }
    return totalDeleted;
  } catch (err) {
    logger.warn(`[Cache DEL_PATTERN] Failed for pattern ${pattern}: ${err.message}`);
    return 0;
  }
}

/**
 * Cache-aside single item wrapper: return cached or fetch from DB and cache.
 * @param {string} key
 * @param {Function} fetchFromDbFn - async () => data
 * @param {number} [ttlSec]
 * @returns {Promise<any>}
 */
async function getOrSet(key, fetchFromDbFn, ttlSec = REDIS_DEFAULT_TTL_SEC) {
  const cached = await get(key);
  if (cached !== null) return cached;

  const fresh = await fetchFromDbFn();
  if (fresh !== undefined && fresh !== null) {
    await set(key, fresh, ttlSec);
  }
  return fresh;
}

/**
 * Two-Tier Lookaside with Chunked Entity Caching:
 * 1. Checks Redis via MGET for all IDs.
 * 2. Identifies cache misses.
 * 3. Queries DB *strictly* for missing IDs via `fetchMissingFromDbFn(missingIds)`.
 * 4. Backfills Redis with newly fetched items using a pipeline.
 * 5. Returns all entities merged in the exact sort order of input `ids`.
 *
 * @param {Array<string|import('mongoose').Types.ObjectId>} ids - Array of document IDs in original sort order
 * @param {string} keyPrefix - Redis key prefix (e.g. 'lm:lead:view:' or 'lm:quot:list:')
 * @param {Function} fetchMissingFromDbFn - async (missingIds: string[]) => Array<doc>
 * @param {number} [ttlSec] - Expiration in seconds
 * @returns {Promise<Array<any>>}
 */
async function mgetWithDbFallback(ids, keyPrefix, fetchMissingFromDbFn, ttlSec = REDIS_DEFAULT_TTL_SEC) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const stringIds = ids.map((id) => (id?._id ? String(id._id) : String(id))).filter(Boolean);
  if (stringIds.length === 0) return [];

  // If Redis is down, fail open: query DB directly for all IDs
  if (!isReady()) {
    return await fetchMissingFromDbFn(stringIds);
  }

  const keys = stringIds.map((id) => `${keyPrefix}${id}`);
  let cachedJsonList = null;

  try {
    cachedJsonList = await redisClient.mget(keys);
  } catch (err) {
    logger.warn(`[Cache MGET] Error reading keys with prefix ${keyPrefix}: ${err.message}`);
  }

  const resultMap = new Map();
  const missingIds = [];

  if (Array.isArray(cachedJsonList)) {
    for (let i = 0; i < stringIds.length; i++) {
      const id = stringIds[i];
      const cached = cachedJsonList[i];
      if (cached) {
        try {
          resultMap.set(id, JSON.parse(cached));
        } catch {
          missingIds.push(id);
        }
      } else {
        missingIds.push(id);
      }
    }
  } else {
    missingIds.push(...stringIds);
  }

  // Differential fetch: Query DB ONLY for missing records
  if (missingIds.length > 0) {
    try {
      const freshDocs = await fetchMissingFromDbFn(missingIds);
      if (Array.isArray(freshDocs) && freshDocs.length > 0) {
        const pipeline = redisClient.pipeline();
        for (const doc of freshDocs) {
          if (!doc) continue;
          const docId = String(doc._id || doc.id);
          if (!docId) continue;
          resultMap.set(docId, doc);
          pipeline.setex(`${keyPrefix}${docId}`, ttlSec, JSON.stringify(doc));
        }
        pipeline.exec().catch((err) => {
          logger.warn(`[Cache BACKFILL] Pipeline failed for ${keyPrefix}: ${err.message}`);
        });
      }
    } catch (dbErr) {
      logger.error(`[Cache DB Fallback] Error fetching missing IDs for ${keyPrefix}:`, dbErr);
      throw dbErr;
    }
  }

  // Preserve the exact original ordering of input IDs
  return stringIds.map((id) => resultMap.get(id)).filter(Boolean);
}

/* =========================================================================
 * DOMAIN-SPECIFIC INVALIDATION HELPERS
 * ========================================================================= */

/**
 * Invalidate a lead entity and its related caches.
 * @param {string|import('mongoose').Types.ObjectId} leadId
 */
async function invalidateLead(leadId) {
  if (!leadId) return;
  const id = String(leadId);
  await del(
    `${PREFIX}:lead:view:${id}`,
    `${PREFIX}:lead:raw:${id}`,
    `${PREFIX}:lead:followups:${id}`,
    `${PREFIX}:quot:by_lead:${id}`
  );
  // Invalidate lead analytics reports
  await delByPattern(`${PREFIX}:reports:lead:*`);
}

/**
 * Invalidate multiple leads in bulk.
 * @param {Array<string|import('mongoose').Types.ObjectId>} leadIds
 */
async function invalidateLeads(leadIds) {
  if (!Array.isArray(leadIds) || leadIds.length === 0) return;
  const keys = [];
  for (const lid of leadIds) {
    const id = String(lid);
    keys.push(
      `${PREFIX}:lead:view:${id}`,
      `${PREFIX}:lead:raw:${id}`,
      `${PREFIX}:lead:followups:${id}`,
      `${PREFIX}:quot:by_lead:${id}`
    );
  }
  await del(keys);
  await delByPattern(`${PREFIX}:reports:lead:*`);
}

/**
 * Invalidate a quotation entity and its parent lead cache if linked.
 * @param {string|import('mongoose').Types.ObjectId} quotationId
 * @param {string|import('mongoose').Types.ObjectId} [leadId]
 */
async function invalidateQuotation(quotationId, leadId = null) {
  if (!quotationId) return;
  const qId = String(quotationId);
  const keys = [
    `${PREFIX}:quot:list:${qId}`,
    `${PREFIX}:quot:detail:${qId}`,
  ];

  if (leadId) {
    const lId = String(leadId);
    keys.push(
      `${PREFIX}:quot:by_lead:${lId}`,
      `${PREFIX}:lead:view:${lId}`
    );
  }

  await del(keys);
  // Invalidate quotation reports
  await delByPattern(`${PREFIX}:reports:quot:*`);
}

/**
 * Invalidate multiple quotations in bulk.
 * @param {Array<string|import('mongoose').Types.ObjectId>} quotationIds
 */
async function invalidateQuotations(quotationIds) {
  if (!Array.isArray(quotationIds) || quotationIds.length === 0) return;
  const keys = [];
  for (const qId of quotationIds) {
    const id = String(qId);
    keys.push(`${PREFIX}:quot:list:${id}`, `${PREFIX}:quot:detail:${id}`);
  }
  await del(keys);
  await delByPattern(`${PREFIX}:reports:quot:*`);
}

/**
 * Invalidate master data cache by domain.
 * @param {'sources'|'departments'|'lost_reasons'|'all'} domain
 */
async function invalidateMasterData(domain = 'all') {
  if (domain === 'all') {
    await del(
      `${PREFIX}:masters:sources`,
      `${PREFIX}:masters:departments`,
      `${PREFIX}:masters:lost_reasons`
    );
  } else {
    await del(`${PREFIX}:masters:${domain}`);
  }
}

/**
 * Invalidate team visibility cache for a specific user or all users.
 * @param {string} [userId]
 */
async function invalidateTeamVisibility(userId = null) {
  if (userId) {
    await del(`${PREFIX}:team:visible:${userId}`);
  } else {
    await delByPattern(`${PREFIX}:team:visible:*`);
  }
}

/**
 * Invalidate report summaries.
 * @param {'lead'|'quot'|'all'} [type]
 */
async function invalidateReports(type = 'all') {
  if (type === 'all') {
    await delByPattern(`${PREFIX}:reports:*`);
  } else {
    await delByPattern(`${PREFIX}:reports:${type}:*`);
  }
}

module.exports = {
  PREFIX,
  isReady,
  get,
  set,
  del,
  delByPattern,
  getOrSet,
  mgetWithDbFallback,
  invalidateLead,
  invalidateLeads,
  invalidateQuotation,
  invalidateQuotations,
  invalidateMasterData,
  invalidateTeamVisibility,
  invalidateReports,
};
