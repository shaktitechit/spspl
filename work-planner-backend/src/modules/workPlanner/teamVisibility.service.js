/**
 * @fileoverview Visible sales_user scope for Work Planner roles + reporting edges.
 * @module modules/workPlanner/teamVisibility.service
 */
const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { isWpAdmin, isWpManager, isWpCoordinator } = require('./workPlanner.constants');

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

function salesUserKey(ref) {
  if (!ref) return '';
  return String(ref._id || ref);
}

/**
 * @returns {Promise<string[]|null>} null = all users (admin); else explicit id list including self for managers/coordinators.
 */
async function getVisibleSalesUserIds(user) {
  if (isWpAdmin(user)) return null;

  const uid = String(userId(user) || '');
  if (!uid) return [];

  const { WorkPlannerReportingEdge, UserWorkPlannerSettings } = getModels();

  if (isWpManager(user) || isWpCoordinator(user)) {
    const visited = new Set();
    let currentLevel = [asObjectId(uid)].filter(Boolean);
    let depth = 0;
    const maxDepth = isWpManager(user) ? 10 : 2;

    while (currentLevel.length > 0 && depth < maxDepth) {
      const edges = await WorkPlannerReportingEdge.find({
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

    // Subordinates assigned in UserWorkPlannerSettings
    let settingsIds = [];
    if (UserWorkPlannerSettings) {
      const userOid = asObjectId(uid);
      const settings = await UserWorkPlannerSettings.find({
        $or: [
          { assigned_manager: userOid },
          { 'plan_type_settings.assigned_manager': userOid },
        ],
      })
        .select('user')
        .lean();
      settingsIds = settings.map((s) => String(s.user)).filter(Boolean);
    }

    return [...new Set([uid, ...Array.from(visited), ...settingsIds])];
  }

  return [uid];
}

async function canAccessSalesUser(actor, salesUserRef) {
  if (!actor) return false;
  if (isWpAdmin(actor)) return true;
  const target = salesUserKey(salesUserRef);
  if (!target) return false;
  const visible = await getVisibleSalesUserIds(actor);
  if (visible === null) return true;
  return visible.includes(target);
}

/**
 * Mutates `filter` with sales_user scope for list/stats/expenses queries.
 * Supports query.scope = 'mine' | 'team' for elevated users (admin/manager).
 */
async function applySalesUserFilter(filter, user, query = {}) {
  const visible = await getVisibleSalesUserIds(user);
  const selfId = String(userId(user) || '');
  const selfOid = asObjectId(selfId);
  const scope = String(query.scope || query.ownership || '').toLowerCase();

  const userParam =
    query.sales_user ||
    query.sales_user_id ||
    query.salesUser ||
    query.user ||
    query.userId ||
    query.user_id;

  if (userParam && userParam !== 'all') {
    const requested = String(userParam);
    if (visible === null) {
      filter.sales_user = asObjectId(requested) || requested;
      return;
    }
    if (!visible.includes(requested)) {
      filter.sales_user = { $in: [] };
      return;
    }
    filter.sales_user = asObjectId(requested) || requested;
    return;
  }

  // 2. 'mine' scope requested
  if (scope === 'mine') {
    if (visible !== null && !visible.includes(selfId)) {
      filter.sales_user = { $in: [] };
      return;
    }
    filter.sales_user = selfOid || selfId;
    return;
  }

  // 3. 'team' scope or all visible members
  if (visible === null) {
    // Admin: can view all portal members without restriction
    return;
  }

  // Manager: can view all permitted team members (self + direct reports)
  const oids = visible.map(asObjectId).filter(Boolean);
  filter.sales_user = { $in: oids };
}

module.exports = {
  userId,
  asObjectId,
  salesUserKey,
  getVisibleSalesUserIds,
  canAccessSalesUser,
  applySalesUserFilter,
};
