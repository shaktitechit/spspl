/**
 * @fileoverview Service for managing custom User Tasks & dynamic Visit Templates.
 * @module modules/workPlanner/userTemplate.service
 */
const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');
const { isWpAdmin, isWpElevated } = require('./workPlanner.constants');
const { canAccessSalesUser, userId } = require('./teamVisibility.service');

/**
 * Resolves a target user by ObjectId, username, or email.
 */
async function resolveUser(userParam) {
  const { User } = getModels();
  if (!userParam) {
    throw new ApiError(400, 'User parameter is required');
  }

  const trimmed = String(userParam).trim();
  let found = null;

  // 1. Try as valid Mongo ObjectId
  if (mongoose.Types.ObjectId.isValid(trimmed) && String(new mongoose.Types.ObjectId(trimmed)) === trimmed) {
    found = await User.findById(trimmed)
      .select('_id name email username department wp_role roles role_codes portals')
      .lean();
  }

  // 2. Try by username or email
  if (!found) {
    found = await User.findOne({
      $or: [
        { username: trimmed },
        { username: trimmed.toLowerCase() },
        { email: trimmed.toLowerCase() },
      ],
    })
      .select('_id name email username department wp_role roles role_codes portals')
      .lean();
  }

  if (!found) {
    throw new ApiError(404, `User '${userParam}' not found`);
  }

  return found;
}

// ==========================================
// USER TASKS (CATALOG & DYNAMIC TEMPLATES)
// ==========================================

async function getUserTasks(userParam, actor) {
  const { UserTaskCatalog } = getModels();
  const target = await resolveUser(userParam);

  const actorId = String(userId(actor));
  const targetId = String(target._id);
  const isSelf = actorId === targetId;

  if (!isSelf && !isWpAdmin(actor) && !(await canAccessSalesUser(actor, target._id))) {
    throw new ApiError(403, "Access denied: cannot view this user's custom task catalog");
  }

  const catalog = await UserTaskCatalog.findOne({ user: target._id }).lean();

  return {
    user: {
      _id: String(target._id),
      name: target.name,
      email: target.email,
      username: target.username || '',
      department: target.department,
      wp_role: target.wp_role,
    },
    tasks: Array.isArray(catalog?.tasks)
      ? catalog.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description || '',
          category: t.category || '',
          isDefault: Boolean(t.is_default),
          plannedStartTime: t.planned_start_time || '',
          plannedEndTime: t.planned_end_time || '',
          createTemplate: {
            enabled: t.create_template?.enabled !== false,
            title: t.create_template?.title || 'Task Planning Requirements',
            description: t.create_template?.description || '',
            fields: Array.isArray(t.create_template?.fields) ? t.create_template.fields : [],
          },
          outcomeTemplate: {
            enabled: t.outcome_template?.enabled !== false,
            title: t.outcome_template?.title || 'Task Outcome & Completion Report',
            description: t.outcome_template?.description || '',
            fields: Array.isArray(t.outcome_template?.fields) ? t.outcome_template.fields : [],
          },
          createdAt: t.created_at || t.createdAt,
          updatedAt: t.updated_at || t.updatedAt,
        }))
      : [],
    updatedAt: catalog?.updatedAt || null,
  };
}

async function updateUserTasks(userParam, payload, actor) {
  const { UserTaskCatalog } = getModels();
  if (!isWpAdmin(actor)) {
    throw new ApiError(403, 'Access denied: only Work Planner Portal Admins can configure user task catalogs');
  }

  const target = await resolveUser(userParam);
  const tasksInput = Array.isArray(payload?.tasks) ? payload.tasks : Array.isArray(payload) ? payload : [];

  const normalizedTasks = tasksInput.map((t, idx) => ({
    id: String(t.id || `task_${Date.now()}_${idx}`),
    title: String(t.title || 'Untitled Task').trim(),
    description: String(t.description || '').trim(),
    category: String(t.category || '').trim(),
    is_default: Boolean(t.isDefault ?? t.is_default),
    planned_start_time: String(t.plannedStartTime || t.planned_start_time || '').trim(),
    planned_end_time: String(t.plannedEndTime || t.planned_end_time || '').trim(),
    create_template: {
      enabled: t.createTemplate?.enabled !== false,
      title: String(t.createTemplate?.title || 'Task Planning Requirements').trim(),
      description: String(t.createTemplate?.description || '').trim(),
      fields: Array.isArray(t.createTemplate?.fields) ? t.createTemplate.fields : [],
    },
    outcome_template: {
      enabled: t.outcomeTemplate?.enabled !== false,
      title: String(t.outcomeTemplate?.title || 'Task Outcome & Completion Report').trim(),
      description: String(t.outcomeTemplate?.description || '').trim(),
      fields: Array.isArray(t.outcomeTemplate?.fields) ? t.outcomeTemplate.fields : [],
    },
    created_at: t.createdAt ? new Date(t.createdAt) : new Date(),
    updated_at: new Date(),
  }));

  const updated = await UserTaskCatalog.findOneAndUpdate(
    { user: target._id },
    {
      $set: {
        tasks: normalizedTasks,
        updated_by: userId(actor),
      },
    },
    { new: true, upsert: true }
  ).lean();

  return getUserTasks(target._id, actor);
}

async function getUserTasksSummary(actor) {
  const { UserTaskCatalog } = getModels();
  if (!isWpAdmin(actor) && !isWpElevated(actor)) {
    throw new ApiError(403, 'Access denied: elevated permissions required');
  }

  const catalogs = await UserTaskCatalog.find({}).select('user tasks updatedAt').lean();
  const summary = {};

  catalogs.forEach((c) => {
    if (c.user) {
      summary[String(c.user)] = {
        count: Array.isArray(c.tasks) ? c.tasks.length : 0,
        defaultCount: Array.isArray(c.tasks) ? c.tasks.filter((t) => t.is_default).length : 0,
        updatedAt: c.updatedAt,
      };
    }
  });

  return summary;
}

// ==========================================
// USER VISIT TEMPLATE (SINGLE PER USER)
// ==========================================

async function getUserVisitTemplate(userParam, actor) {
  const { UserVisitTemplate } = getModels();
  const target = await resolveUser(userParam);

  const actorId = String(userId(actor));
  const targetId = String(target._id);
  const isSelf = actorId === targetId;

  if (!isSelf && !isWpAdmin(actor) && !(await canAccessSalesUser(actor, target._id))) {
    throw new ApiError(403, "Access denied: cannot view this user's visit template");
  }

  const doc = await UserVisitTemplate.findOne({ user: target._id }).lean();

  if (!doc) {
    return {
      userIdOrUsername: String(target._id),
      user: {
        _id: String(target._id),
        name: target.name,
        email: target.email,
        username: target.username || '',
        department: target.department,
        wp_role: target.wp_role,
      },
      templateTitle: 'Standard Field Visit Template',
      description: '',
      createTemplate: {
        enabled: true,
        title: 'Pre-Visit Planning Details',
        description: '',
        fields: [],
      },
      outcomeTemplate: {
        enabled: true,
        title: 'Post-Visit Debrief & Outcomes',
        description: '',
        fields: [],
      },
      isConfigured: false,
      updatedAt: null,
    };
  }

  return {
    userIdOrUsername: String(target._id),
    user: {
      _id: String(target._id),
      name: target.name,
      email: target.email,
      username: target.username || '',
      department: target.department,
      wp_role: target.wp_role,
    },
    templateTitle: doc.template_title || 'Standard Field Visit Template',
    description: doc.description || '',
    createTemplate: {
      enabled: doc.create_template?.enabled !== false,
      title: doc.create_template?.title || 'Pre-Visit Planning Details',
      description: doc.create_template?.description || '',
      fields: Array.isArray(doc.create_template?.fields) ? doc.create_template.fields : [],
    },
    outcomeTemplate: {
      enabled: doc.outcome_template?.enabled !== false,
      title: doc.outcome_template?.title || 'Post-Visit Debrief & Outcomes',
      description: doc.outcome_template?.description || '',
      fields: Array.isArray(doc.outcome_template?.fields) ? doc.outcome_template.fields : [],
    },
    isConfigured: true,
    updatedAt: doc.updatedAt,
  };
}

async function updateUserVisitTemplate(userParam, payload, actor) {
  const { UserVisitTemplate } = getModels();
  if (!isWpAdmin(actor)) {
    throw new ApiError(403, 'Access denied: only Work Planner Portal Admins can configure visit templates');
  }

  const target = await resolveUser(userParam);

  const updateDoc = {
    template_title: String(payload.templateTitle || payload.template_title || 'Standard Field Visit Template').trim(),
    description: String(payload.description || '').trim(),
    create_template: {
      enabled: payload.createTemplate?.enabled !== false,
      title: String(payload.createTemplate?.title || 'Pre-Visit Planning Details').trim(),
      description: String(payload.createTemplate?.description || '').trim(),
      fields: Array.isArray(payload.createTemplate?.fields) ? payload.createTemplate.fields : [],
    },
    outcome_template: {
      enabled: payload.outcomeTemplate?.enabled !== false,
      title: String(payload.outcomeTemplate?.title || 'Post-Visit Debrief & Outcomes').trim(),
      description: String(payload.outcomeTemplate?.description || '').trim(),
      fields: Array.isArray(payload.outcomeTemplate?.fields) ? payload.outcomeTemplate.fields : [],
    },
    updated_by: userId(actor),
  };

  await UserVisitTemplate.findOneAndUpdate(
    { user: target._id },
    { $set: updateDoc },
    { new: true, upsert: true }
  ).lean();

  return getUserVisitTemplate(target._id, actor);
}

async function getUserVisitTemplatesSummary(actor) {
  const { UserVisitTemplate } = getModels();
  if (!isWpAdmin(actor) && !isWpElevated(actor)) {
    throw new ApiError(403, 'Access denied: elevated permissions required');
  }

  const templates = await UserVisitTemplate.find({}).select('user create_template outcome_template updatedAt').lean();
  const summary = {};

  templates.forEach((t) => {
    if (t.user) {
      summary[String(t.user)] = {
        hasTemplate: true,
        createCount: Array.isArray(t.create_template?.fields) ? t.create_template.fields.length : 0,
        outcomeCount: Array.isArray(t.outcome_template?.fields) ? t.outcome_template.fields.length : 0,
        updatedAt: t.updatedAt,
      };
    }
  });

  return summary;
}

module.exports = {
  resolveUser,
  getUserTasks,
  updateUserTasks,
  getUserTasksSummary,
  getUserVisitTemplate,
  updateUserVisitTemplate,
  getUserVisitTemplatesSummary,
};
