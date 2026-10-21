/**
 * @fileoverview Team reporting hierarchy for Lead Manager (who reports to whom).
 * @module modules/team/team.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');
const {
  isAdmin,
  isManager,
  isExecutive,
  isLeadManagerElevated,
} = require('../../middlewares/leadManagerAuth.middleware');
const {
  asObjectId,
  getVisibleLeadUserIds,
  userId,
  isCoordinator,
} = require('./teamVisibility.service');

const ALLOWED_PAIRS = Object.freeze({
  executive: ['coordinator', 'manager'],
  coordinator: ['manager', 'admin'],
  manager: ['manager', 'admin'],
});

function normalizeRolesFromUserDoc(doc) {
  if (!doc) return [];
  const portals = Array.isArray(doc.portals) ? doc.portals : [];
  const portalAccess = portals.find(
    (p) => p && (p.portal_code === 'lead_manager' || p.portal === 'lead_manager')
  );
  if (!portalAccess || !Array.isArray(portalAccess.access_roles)) return [];
  const roles = portalAccess.access_roles.map((r) => String(r).toLowerCase().trim());
  if (roles.includes('admin')) return ['admin'];
  if (roles.includes('manager')) return ['manager'];
  if (roles.includes('coordinator')) return ['coordinator'];
  if (roles.includes('executive')) return ['executive'];
  return [];
}

function primaryLmRole(doc) {
  const roles = normalizeRolesFromUserDoc(doc);
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('manager')) return 'manager';
  if (roles.includes('coordinator')) return 'coordinator';
  if (roles.includes('executive')) return 'executive';
  const legacy = doc?.role ? String(doc.role).toLowerCase().trim() : '';
  if (['admin', 'manager', 'coordinator', 'executive'].includes(legacy)) {
    return legacy;
  }
  return null;
}

async function loadUserOrThrow(id) {
  const { User } = getModels();
  const oid = asObjectId(id);
  if (!oid) throw new ApiError(400, 'Invalid user id');
  const doc = await User.findOne({ _id: oid, is_active: { $ne: false } }).lean();
  if (!doc) throw new ApiError(404, 'User not found');
  return doc;
}

function assertAllowedPair(subRole, mgrRole) {
  const allowed = ALLOWED_PAIRS[subRole];
  if (!allowed || !allowed.includes(mgrRole)) {
    throw new ApiError(
      400,
      `Invalid reporting: ${subRole} cannot report to ${mgrRole}. Allowed: executive→coordinator/manager, coordinator→manager/admin, manager→manager/admin.`,
    );
  }
}

async function detectCycle(subordinateId, proposedManagerId) {
  const { LeadReportingEdge } = getModels();
  const visited = new Set([String(proposedManagerId)]);
  let currentLevel = [asObjectId(proposedManagerId)].filter(Boolean);
  let depth = 0;
  while (currentLevel.length > 0 && depth < 25) {
    const parentEdges = await LeadReportingEdge.find({
      subordinate: { $in: currentLevel },
      is_active: true,
    })
      .select('manager')
      .lean();

    currentLevel = [];
    for (const e of parentEdges) {
      const mid = String(e.manager);
      if (mid === String(subordinateId)) {
        return true;
      }
      if (!visited.has(mid)) {
        visited.add(mid);
        currentLevel.push(asObjectId(mid));
      }
    }
    depth++;
  }
  return false;
}

function isLmElevated(user) {
  return isLeadManagerElevated(user);
}

async function upsertEdge(body, actor) {
  if (!isAdmin(actor)) {
    throw new ApiError(403, 'Only Lead Manager admins can map reporting relationships');
  }

  const subordinateId = body.subordinate || body.subordinate_id;
  const managerId = body.manager || body.manager_id;
  if (!subordinateId || !managerId) {
    throw new ApiError(400, 'subordinate and manager are required');
  }
  if (String(subordinateId) === String(managerId)) {
    throw new ApiError(400, 'A user cannot report to themselves');
  }

  const [subDoc, mgrDoc] = await Promise.all([
    loadUserOrThrow(subordinateId),
    loadUserOrThrow(managerId),
  ]);

  const subRole = primaryLmRole(subDoc);
  const mgrRole = primaryLmRole(mgrDoc);
  if (!subRole) {
    throw new ApiError(400, 'Subordinate must have a lead_manager portal role');
  }
  if (!mgrRole) {
    throw new ApiError(400, 'Manager must have a lead_manager portal role');
  }
  assertAllowedPair(subRole, mgrRole);

  const { LeadReportingEdge } = getModels();

  // Block circular reporting
  const isCycle = await detectCycle(subordinateId, managerId);
  if (isCycle) {
    throw new ApiError(400, 'Circular reporting detected: cannot report to your own subordinate');
  }

  const edge = await LeadReportingEdge.findOneAndUpdate(
    {
      subordinate: asObjectId(subordinateId),
      manager: asObjectId(managerId),
    },
    {
      $set: {
        subordinate: asObjectId(subordinateId),
        manager: asObjectId(managerId),
        subordinate_role: subRole,
        manager_role: mgrRole,
        is_active: true,
        updated_by: userId(actor),
      },
      $setOnInsert: {
        created_by: userId(actor),
      },
    },
    { upsert: true, new: true },
  )
    .populate('subordinate', 'name email department portals')
    .populate('manager', 'name email department portals')
    .lean();

  return edge;
}

async function removeEdge(subordinateId, managerId, actor) {
  if (!isAdmin(actor)) {
    throw new ApiError(403, 'Only Lead Manager admins can unmap reporting relationships');
  }
  const { LeadReportingEdge } = getModels();
  const filter = { subordinate: asObjectId(subordinateId), is_active: true };
  if (managerId) {
    filter.manager = asObjectId(managerId);
  }

  if (managerId) {
    const edge = await LeadReportingEdge.findOneAndUpdate(
      filter,
      { $set: { is_active: false, updated_by: userId(actor) } },
      { new: true },
    ).lean();
    if (!edge) throw new ApiError(404, 'Reporting relationship not found');
  } else {
    await LeadReportingEdge.updateMany(
      filter,
      { $set: { is_active: false, updated_by: userId(actor) } },
    );
  }

  return {
    success: true,
    subordinate: String(subordinateId),
    manager: managerId ? String(managerId) : null,
  };
}

async function listEdges(actor) {
  if (!isLmElevated(actor)) {
    throw new ApiError(403, 'Elevated access required');
  }
  const { LeadReportingEdge } = getModels();
  const filter = { is_active: true };
  if (!isAdmin(actor)) {
    filter.manager = asObjectId(userId(actor));
  }
  const rows = await LeadReportingEdge.find(filter)
    .populate('subordinate', 'name email department portals')
    .populate('manager', 'name email department portals')
    .sort({ updatedAt: -1 })
    .lean();
  return rows;
}

async function getTree(actor) {
  if (!isAdmin(actor)) {
    throw new ApiError(403, 'Only Lead Manager admins can view the full team tree');
  }
  const { User, LeadReportingEdge } = getModels();

  const [users, edges] = await Promise.all([
    User.find({
      is_active: { $ne: false },
      portals: {
        $elemMatch: {
          portal_code: 'lead_manager',
          access_roles: { $in: ['executive', 'coordinator', 'manager', 'admin'] },
        },
      },
    })
      .select('name email department portals is_active')
      .lean(),
    LeadReportingEdge.find({ is_active: true })
      .select('subordinate manager subordinate_role manager_role')
      .lean(),
  ]);

  const managersBySub = new Map();
  const childrenByMgr = new Map();
  for (const e of edges) {
    const sid = String(e.subordinate);
    const mid = String(e.manager);
    if (!managersBySub.has(sid)) managersBySub.set(sid, []);
    managersBySub.get(sid).push(mid);

    if (!childrenByMgr.has(mid)) childrenByMgr.set(mid, []);
    childrenByMgr.get(mid).push(sid);
  }

  const enriched = users.map((u) => {
    const id = String(u._id);
    const role = primaryLmRole(u);
    const mgrIds = managersBySub.get(id) || [];
    return {
      ...u,
      wp_role: role,
      reports_to: mgrIds[0] || null,
      manager_ids: mgrIds,
      report_ids: childrenByMgr.get(id) || [],
    };
  });

  const admins = enriched.filter((u) => u.wp_role === 'admin');
  const managers = enriched.filter((u) => u.wp_role === 'manager');
  const coordinators = enriched.filter((u) => u.wp_role === 'coordinator');
  const executives = enriched.filter((u) => u.wp_role === 'executive');
  const unassignedManagers = managers.filter((m) => (m.manager_ids || []).length === 0);
  const unassignedCoordinators = coordinators.filter((c) => (c.manager_ids || []).length === 0);
  const unassignedExecutives = executives.filter((e) => (e.manager_ids || []).length === 0);

  return {
    users: enriched,
    edges,
    admins,
    managers,
    coordinators,
    executives,
    unassignedManagers,
    unassignedCoordinators,
    unassignedExecutives,
  };
}

async function getMyTeam(actor) {
  const selfId = String(userId(actor));

  if (isExecutive(actor) && !isLmElevated(actor)) {
    const { User } = getModels();
    const selfDoc = await User.findById(asObjectId(selfId))
      .select('name email department portals is_active')
      .lean();
    return {
      self_id: selfId,
      is_admin: false,
      is_manager: false,
      is_coordinator: false,
      members: selfDoc
        ? [{ ...selfDoc, wp_role: primaryLmRole(selfDoc) || 'executive' }]
        : [],
      edges: [],
      visible_user_ids: [selfId],
    };
  }

  if (!isLmElevated(actor)) {
    throw new ApiError(403, 'Manager, coordinator, executive, or admin access required');
  }

  const visibleIds = await getVisibleLeadUserIds(actor);
  const { User, LeadReportingEdge } = getModels();

  let memberFilter;
  if (visibleIds === null) {
    memberFilter = {
      is_active: { $ne: false },
      portals: {
        $elemMatch: {
          portal_code: 'lead_manager',
          access_roles: { $in: ['executive', 'coordinator', 'manager', 'admin'] },
        },
      },
    };
  } else {
    memberFilter = {
      _id: { $in: visibleIds.map(asObjectId).filter(Boolean) },
      is_active: { $ne: false },
      portals: {
        $elemMatch: {
          portal_code: 'lead_manager',
          access_roles: { $in: ['executive', 'coordinator', 'manager', 'admin'] },
        },
      },
    };
  }

  const members = await User.find(memberFilter)
    .select('name email department portals is_active')
    .lean();

  const edgeScopeIds =
    visibleIds === null
      ? null
      : [...new Set([String(userId(actor)), ...visibleIds.map(String)])];

  const edgeFilter = { is_active: true };
  if (edgeScopeIds !== null) {
    const oids = edgeScopeIds.map(asObjectId).filter(Boolean);
    edgeFilter.$or = [{ manager: { $in: oids } }, { subordinate: { $in: oids } }];
  }

  const edges = await LeadReportingEdge.find(edgeFilter)
    .populate('subordinate', 'name email department')
    .populate('manager', 'name email department')
    .lean();

  return {
    self_id: String(userId(actor)),
    is_admin: isAdmin(actor),
    is_manager: isManager(actor),
    is_coordinator: isCoordinator(actor),
    members: members.map((m) => ({
      ...m,
      wp_role: primaryLmRole(m),
    })),
    edges,
    visible_user_ids: visibleIds,
  };
}

module.exports = {
  upsertEdge,
  removeEdge,
  listEdges,
  getTree,
  getMyTeam,
  primaryLmRole,
  isLmElevated,
  ALLOWED_PAIRS,
};
