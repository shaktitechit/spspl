/**
 * @fileoverview Team reporting hierarchy for Work Planner (who reports to whom).
 * @module modules/workPlanner/team.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const {
  getWorkPlannerAccessRoles,
  isWpAdmin,
  isWpManager,
  isWpCoordinator,
  isWpElevated,
} = require('./workPlanner.constants');
const {
  asObjectId,
  getVisibleSalesUserIds,
  userId,
} = require('./teamVisibility.service');

const ALLOWED_PAIRS = Object.freeze({
  executive: ['coordinator', 'manager'],
  coordinator: ['manager', 'admin'],
  manager: ['manager', 'admin'],
});

async function detectCycle(subordinateId, proposedManagerId) {
  const { WorkPlannerReportingEdge } = getModels();
  const visited = new Set([String(proposedManagerId)]);
  let currentLevel = [asObjectId(proposedManagerId)].filter(Boolean);
  let depth = 0;
  while (currentLevel.length > 0 && depth < 25) {
    const parentEdges = await WorkPlannerReportingEdge.find({
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

function normalizeRolesFromUserDoc(doc) {
  if (!doc) return [];
  const roles = getWorkPlannerAccessRoles(doc);
  if (roles.includes('admin')) return ['admin'];
  if (roles.includes('manager')) return ['manager'];
  if (roles.includes('coordinator')) return ['coordinator'];
  if (roles.includes('executive')) return ['executive'];
  return [];
}

function primaryWpRole(doc) {
  const roles = normalizeRolesFromUserDoc(doc);
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('manager')) return 'manager';
  if (roles.includes('coordinator')) return 'coordinator';
  if (roles.includes('executive')) return 'executive';
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
      `Invalid reporting: ${subRole} cannot report to ${mgrRole}. Allowed: executive→coordinator/manager, coordinator→manager/admin, manager→admin.`,
    );
  }
}

const ALL_PLAN_TYPES = Object.freeze([
  'Visits',
  'Tasks & Visits',
  'Leave',
  'Work From Home',
  'Work From Office',
]);

/**
 * Keep UserWorkPlannerSettings.assigned_manager (global + every plan type) in sync
 * with the reporting edge. Preserves existing CC emails and custom templates.
 */
async function syncAssignedManagerSettings(subordinateId, managerId, actor) {
  const { UserWorkPlannerSettings } = getModels();
  const uid = asObjectId(subordinateId);
  if (!uid) return;

  const mgrOid = managerId ? asObjectId(managerId) : null;
  const existing = await UserWorkPlannerSettings.findOne({ user: uid }).lean();
  const existingPts = new Map(
    (Array.isArray(existing?.plan_type_settings) ? existing.plan_type_settings : []).map((p) => [
      p.plan_type,
      p,
    ]),
  );

  const plan_type_settings = ALL_PLAN_TYPES.map((plan_type) => {
    const prev = existingPts.get(plan_type);
    return {
      plan_type,
      assigned_manager: mgrOid,
      cc_emails: Array.isArray(prev?.cc_emails) ? prev.cc_emails : [],
    };
  });

  await UserWorkPlannerSettings.findOneAndUpdate(
    { user: uid },
    {
      $set: {
        assigned_manager: mgrOid,
        plan_type_settings,
        updated_by: userId(actor),
      },
      $setOnInsert: {
        created_by: userId(actor),
        cc_emails: Array.isArray(existing?.cc_emails) ? existing.cc_emails : [],
        custom_work_templates: Array.isArray(existing?.custom_work_templates)
          ? existing.custom_work_templates
          : [],
      },
    },
    { upsert: true, new: true },
  );
}

async function upsertEdge(body, actor) {
  if (!isWpAdmin(actor)) {
    throw new ApiError(403, 'Only Work Planner admins can map reporting relationships');
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

  const subRole = primaryWpRole(subDoc);
  const mgrRole = primaryWpRole(mgrDoc);
  if (!subRole) {
    throw new ApiError(400, 'Subordinate must have a work_planner portal role');
  }
  if (!mgrRole) {
    throw new ApiError(400, 'Manager must have a work_planner portal role');
  }
  assertAllowedPair(subRole, mgrRole);

  const { WorkPlannerReportingEdge } = getModels();

  // Block circular reporting
  const isCycle = await detectCycle(subordinateId, managerId);
  if (isCycle) {
    throw new ApiError(400, 'Circular reporting detected: cannot report to your own subordinate');
  }

  const edge = await WorkPlannerReportingEdge.findOneAndUpdate(
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

  await syncAssignedManagerSettings(subordinateId, managerId, actor);

  return toPlain(edge);
}

async function removeEdge(subordinateId, managerId, actor) {
  if (!isWpAdmin(actor)) {
    throw new ApiError(403, 'Only Work Planner admins can unmap reporting relationships');
  }
  const { WorkPlannerReportingEdge } = getModels();
  const filter = { subordinate: asObjectId(subordinateId), is_active: true };
  if (managerId) {
    filter.manager = asObjectId(managerId);
  }

  if (managerId) {
    const edge = await WorkPlannerReportingEdge.findOneAndUpdate(
      filter,
      { $set: { is_active: false, updated_by: userId(actor) } },
      { new: true },
    ).lean();
    if (!edge) throw new ApiError(404, 'Reporting relationship not found');
  } else {
    await WorkPlannerReportingEdge.updateMany(
      filter,
      { $set: { is_active: false, updated_by: userId(actor) } },
    );
  }

  const remainingEdge = await WorkPlannerReportingEdge.findOne({
    subordinate: asObjectId(subordinateId),
    is_active: true,
  })
    .sort({ updatedAt: -1 })
    .lean();

  await syncAssignedManagerSettings(
    subordinateId,
    remainingEdge ? remainingEdge.manager : null,
    actor
  );

  return {
    success: true,
    subordinate: String(subordinateId),
    manager: managerId ? String(managerId) : null,
  };
}

async function listEdges(actor) {
  if (!isWpElevated(actor)) {
    throw new ApiError(403, 'Elevated access required');
  }
  const { WorkPlannerReportingEdge } = getModels();
  const filter = { is_active: true };
  if (!isWpAdmin(actor)) {
    filter.manager = asObjectId(userId(actor));
  }
  const rows = await WorkPlannerReportingEdge.find(filter)
    .populate('subordinate', 'name email department portals')
    .populate('manager', 'name email department portals')
    .sort({ updatedAt: -1 })
    .lean();
  return rows.map(toPlain);
}

async function getTree(actor) {
  if (!isWpAdmin(actor)) {
    throw new ApiError(403, 'Only Work Planner admins can view the full team tree');
  }
  const { User, WorkPlannerReportingEdge } = getModels();

  const [users, edges] = await Promise.all([
    User.find({
      is_active: { $ne: false },
      portals: {
        $elemMatch: {
          portal_code: 'work_planner',
          access_roles: { $in: ['executive', 'coordinator', 'manager', 'admin'] },
        },
      },
    })
      .select('name email department portals is_active')
      .lean(),
    WorkPlannerReportingEdge.find({ is_active: true })
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
    const role = primaryWpRole(u);
    const mgrIds = managersBySub.get(id) || [];
    return {
      ...toPlain(u),
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
    edges: edges.map(toPlain),
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
  if (!isWpElevatedSafe(actor)) {
    throw new ApiError(403, 'Manager, coordinator or admin access required');
  }

  const visibleIds = await getVisibleSalesUserIds(actor);
  const { User, WorkPlannerReportingEdge } = getModels();

  let memberFilter;
  if (visibleIds === null) {
    memberFilter = {
      is_active: { $ne: false },
      portals: {
        $elemMatch: {
          portal_code: 'work_planner',
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
          portal_code: 'work_planner',
          access_roles: { $in: ['executive', 'coordinator', 'manager', 'admin'] },
        },
      },
    };
  }

  const members = await User.find(memberFilter)
    .select('name email department portals is_active')
    .lean();

  const edges = await WorkPlannerReportingEdge.find({
    is_active: true,
    $or: [
      { manager: asObjectId(userId(actor)) },
      { subordinate: asObjectId(userId(actor)) },
    ],
  })
    .populate('subordinate', 'name email department')
    .populate('manager', 'name email department')
    .lean();

  return {
    self_id: String(userId(actor)),
    is_admin: isWpAdmin(actor),
    is_manager: isWpManager(actor),
    is_coordinator: isWpCoordinator(actor),
    members: members.map((m) => ({
      ...toPlain(m),
      wp_role: primaryWpRole(m),
    })),
    edges: edges.map(toPlain),
    visible_user_ids: visibleIds,
  };
}

function isWpElevatedSafe(user) {
  return isWpElevated(user);
}

async function getMembers(actor) {
  const team = await getMyTeam(actor);
  return {
    visible_user_ids: team.visible_user_ids,
    members: team.members,
  };
}

module.exports = {
  upsertEdge,
  removeEdge,
  listEdges,
  getTree,
  getMyTeam,
  getMembers,
  primaryWpRole,
  ALLOWED_PAIRS,
};
