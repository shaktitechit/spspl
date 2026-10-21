/**
 * @fileoverview Resolve reporting managers for Work Planner emails/notifications (team hierarchy).
 * @module modules/workPlanner/workPlannerTeamReporting.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { asObjectId } = require('./teamVisibility.service');

async function loadActiveUserById(id) {
  if (!id) return null;
  const { User } = getModels();
  const oid = asObjectId(id);
  if (!oid) return null;
  return User.findOne({ _id: oid, is_active: { $ne: false } }).lean();
}

function extractSettingsCcEmails(settings, planType = 'Visits') {
  if (!settings) return [];
  const ptSetting = Array.isArray(settings.plan_type_settings)
    ? settings.plan_type_settings.find((p) => p.plan_type === planType)
    : null;
  if (Array.isArray(ptSetting?.cc_emails) && ptSetting.cc_emails.length > 0) {
    return ptSetting.cc_emails;
  }
  if (Array.isArray(settings.cc_emails) && settings.cc_emails.length > 0) {
    return settings.cc_emails;
  }
  return [];
}

/**
 * Primary manager id: plan-type settings → global settings → latest reporting edge → discussed manager on plan.
 */
async function resolveAssignedManagerId(salesUserId, planDoc = null) {
  const { UserWorkPlannerSettings, WorkPlannerReportingEdge } = getModels();
  const uid = asObjectId(salesUserId);
  if (!uid) return { managerId: null, settings: null };

  const planType = planDoc?.plan_type || 'Visits';
  const settings = await UserWorkPlannerSettings.findOne({ user: uid }).lean();

  let managerId = null;
  if (settings) {
    const ptSetting = Array.isArray(settings.plan_type_settings)
      ? settings.plan_type_settings.find((p) => p.plan_type === planType)
      : null;
    if (ptSetting?.assigned_manager) {
      managerId = ptSetting.assigned_manager;
    } else if (settings.assigned_manager) {
      managerId = settings.assigned_manager;
    }
  }

  if (!managerId) {
    const edges = await WorkPlannerReportingEdge.find({
      subordinate: uid,
      is_active: true,
    })
      .sort({ updatedAt: -1 })
      .select('manager')
      .lean();
    if (edges.length > 0) {
      managerId = edges[0].manager;
    }
  }

  if (!managerId && planDoc?.discussed_manager_id) {
    managerId = planDoc.discussed_manager_id;
  }

  return { managerId, settings };
}

/**
 * Walk active reporting edges upward from `startUserId` (managers of managers).
 */
async function getReportingUplineUserIds(startUserId, { maxDepth = 15, excludeUserId = null } = {}) {
  const { WorkPlannerReportingEdge } = getModels();
  const upline = [];
  const seen = new Set();
  let currentId = asObjectId(startUserId);
  let depth = 0;

  while (currentId && depth < maxDepth) {
    const edges = await WorkPlannerReportingEdge.find({
      subordinate: currentId,
      is_active: true,
    })
      .sort({ updatedAt: -1 })
      .select('manager')
      .lean();

    if (!edges.length) break;

    const nextMgrId = edges[0].manager;
    const nextKey = String(nextMgrId);
    if (!nextKey || seen.has(nextKey)) break;
    if (excludeUserId && nextKey === String(excludeUserId)) break;

    seen.add(nextKey);
    upline.push(nextMgrId);
    currentId = asObjectId(nextMgrId);
    depth += 1;
  }

  return upline;
}

async function resolveDirectReportingManager(salesUserId, planDoc = null) {
  const { managerId, settings } = await resolveAssignedManagerId(salesUserId, planDoc);
  let directManager = managerId ? await loadActiveUserById(managerId) : null;
  if (directManager && String(directManager._id) === String(salesUserId)) {
    directManager = null;
  }
  const planType = planDoc?.plan_type || 'Visits';
  const settingsCcEmails = extractSettingsCcEmails(settings, planType);
  return { directManager, settings, settingsCcEmails };
}

/**
 * Email/in-app routing for team-scoped auto notifications.
 */
async function resolveReportingStakeholderEmails(salesUserId, planDoc = null) {
  const { directManager, settingsCcEmails } = await resolveDirectReportingManager(salesUserId, planDoc);
  const primaryRecipientEmail = directManager?.email || '';

  const uplineIds = directManager?._id
    ? await getReportingUplineUserIds(directManager._id, { excludeUserId: salesUserId })
    : [];
  const uplineUsers = (await Promise.all(uplineIds.map((id) => loadActiveUserById(id)))).filter(Boolean);

  const ccSet = new Set(
    settingsCcEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
  );
  for (const u of uplineUsers) {
    if (u.email && u.email.toLowerCase() !== primaryRecipientEmail.toLowerCase()) {
      ccSet.add(u.email.toLowerCase());
    }
  }
  if (primaryRecipientEmail) {
    ccSet.delete(primaryRecipientEmail.toLowerCase());
  }

  const inAppUserIds = new Set();
  if (salesUserId) inAppUserIds.add(String(salesUserId));
  if (directManager?._id) inAppUserIds.add(String(directManager._id));
  for (const u of uplineUsers) {
    if (u._id) inAppUserIds.add(String(u._id));
  }

  return {
    directManager,
    uplineManagers: uplineUsers,
    primaryRecipientEmail,
    ccList: Array.from(ccSet),
    inAppUserIds: Array.from(inAppUserIds),
    settingsCcEmails,
  };
}

module.exports = {
  loadActiveUserById,
  extractSettingsCcEmails,
  resolveAssignedManagerId,
  getReportingUplineUserIds,
  resolveDirectReportingManager,
  resolveReportingStakeholderEmails,
};
