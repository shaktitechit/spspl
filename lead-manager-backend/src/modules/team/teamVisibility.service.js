/**
 * @fileoverview Visible user scoping for Lead Manager roles + reporting edges.
 * @module modules/team/teamVisibility.service
 */
const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { isAdmin, isManager, isCoordinator } = require('../../middlewares/leadManagerAuth.middleware');
const cacheService = require('../../services/cache.service');

function userId(user) {
  return user?._id || user?.id;
}

function asObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<string[]|null>} null = all users (admin); else explicit list including self + subordinates.
 */
async function getVisibleLeadUserIds(user) {
  if (isAdmin(user)) return null;

  const uid = String(userId(user) || '');
  if (!uid) return [];

  const cacheKey = `lm:team:visible:${uid}`;
  const cached = await cacheService.get(cacheKey);
  if (Array.isArray(cached)) {
    return cached;
  }

  const { LeadReportingEdge } = getModels();

  let result = [uid];
  if (isManager(user) || isCoordinator(user)) {
    const visited = new Set();
    let currentLevel = [asObjectId(uid)].filter(Boolean);
    let depth = 0;
    const maxDepth = isManager(user) ? 10 : 2;

    while (currentLevel.length > 0 && depth < maxDepth) {
      const edges = await LeadReportingEdge.find({
        manager: { $in: currentLevel },
        is_active: true,
      })
        .select('subordinate')
        .lean();

      const nextLevel = [];
      for (const e of edges) {
        const sid = String(e.subordinate);
        if (sid && !visited.has(sid)) {
          visited.add(sid);
          nextLevel.push(asObjectId(sid));
        }
      }
      currentLevel = nextLevel;
      depth++;
    }

    result = [...new Set([uid, ...Array.from(visited)])];
  }

  await cacheService.set(cacheKey, result, 3600);
  return result;
}

async function canAccessLeadUser(actor, targetUserRef) {
  if (!actor) return false;
  if (isAdmin(actor)) return true;
  const target = String(targetUserRef?._id || targetUserRef || '');
  if (!target) return false;
  const visible = await getVisibleLeadUserIds(actor);
  if (visible === null) return true;
  return visible.includes(target);
}

module.exports = {
  userId,
  asObjectId,
  isCoordinator,
  getVisibleLeadUserIds,
  canAccessLeadUser,
};
