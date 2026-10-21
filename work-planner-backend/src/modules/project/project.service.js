/**
 * @fileoverview Project Management Service for business logic and data manipulation.
 * @module modules/project/project.service
 */
const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');
const { isWpAdmin, isWpManager, isWpCoordinator, isWpElevated, isSuperAdminBypass } = require('../workPlanner/workPlanner.constants');
const { PROJECT_STATUS, STEP_STATUS, PROJECT_ROLES } = require('./project.constants');

function getUserId(user) {
  if (!user) return null;
  return user._id ? String(user._id) : String(user.id || user.userId || '');
}

function extractId(val) {
  if (!val) return '';
  if (typeof val === 'object') {
    if (val._id) return String(val._id);
    if (val.id) return String(val.id);
  }
  return String(val);
}

/**
 * Generate a sequential project code: PRJ-YYYY-XXXX
 */
async function generateProjectCode() {
  const { Project } = getModels();
  const year = new Date().getFullYear();
  const count = await Project.countDocuments({
    createdAt: {
      $gte: new Date(year, 0, 1),
      $lte: new Date(year, 11, 31, 23, 59, 59),
    },
  });
  const seq = String(count + 1).padStart(4, '0');
  return `PRJ-${year}-${seq}`;
}

/**
 * Check if the user has edit/admin access to a project.
 */
function hasProjectAdminAccess(project, user) {
  if (!project || !user) return false;
  if (isSuperAdminBypass(user) || isWpAdmin(user) || isWpManager(user)) return true;
  const userId = getUserId(user);
  if (!userId) return false;

  const creatorId = extractId(project.created_by);
  if (creatorId && creatorId === userId) return true;

  const managerId = extractId(project.project_manager_id);
  if (managerId && managerId === userId) return true;

  const member = (project.members || []).find((m) => extractId(m.user_id) === userId);
  return member && (member.role === PROJECT_ROLES.ADMIN || member.role === PROJECT_ROLES.LEAD);
}

/**
 * Check if user is a member of the project, admin, or in an assigned department.
 */
function isProjectParticipant(project, user) {
  if (!project || !user) return false;
  if (isSuperAdminBypass(user) || isWpAdmin(user) || isWpElevated(user)) return true;
  const userId = getUserId(user);
  if (!userId) return false;

  const creatorId = extractId(project.created_by);
  if (creatorId && creatorId === userId) return true;

  const managerId = extractId(project.project_manager_id);
  if (managerId && managerId === userId) return true;

  const isMember = (project.members || []).some((m) => extractId(m.user_id) === userId);
  if (isMember) return true;

  if (user.department && Array.isArray(project.assigned_team_ids)) {
    const userDept = String(user.department).trim().toLowerCase();
    const matchesTeam = project.assigned_team_ids.some(
      (t) => String(t).trim().toLowerCase() === userDept
    );
    if (matchesTeam) return true;
  }

  return false;
}

/**
 * Recalculate progress of a project based on its action steps.
 */
async function recalculateProjectProgress(projectId) {
  const { Project, ProjectActionStep } = getModels();
  const steps = await ProjectActionStep.find({ project_id: projectId, deletedAt: null });
  const total = steps.length;
  const completed = steps.filter((s) => s.status === STEP_STATUS.COMPLETED || s.status === STEP_STATUS.SKIPPED).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  await Project.findByIdAndUpdate(projectId, {
    total_steps: total,
    completed_steps: completed,
    progress_percentage: percentage,
  });

  return { total, completed, percentage };
}

/**
 * Create a new Project.
 */
async function createProject(data, currentUser) {
  const { Project, ProjectActionStep, User } = getModels();
  const userId = getUserId(currentUser);

  const projectCode = data.project_code || (await generateProjectCode());

  // Format members
  let members = [];
  if (Array.isArray(data.members)) {
    const userIds = data.members.map((m) => m.user_id).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    members = data.members.map((m) => {
      const u = userMap.get(String(m.user_id));
      return {
        user_id: m.user_id,
        user_name: u?.name || m.user_name || '',
        user_email: u?.email || m.user_email || '',
        role: m.role || PROJECT_ROLES.CONTRIBUTOR,
        assigned_at: new Date(),
        assigned_by: userId,
      };
    });
  }

  const newProject = new Project({
    company_id: currentUser?.company_id || null,
    title: data.title,
    project_code: projectCode,
    description: data.description || '',
    category: data.category || 'General',
    priority: data.priority || 'medium',
    status: data.status || PROJECT_STATUS.PLANNING,
    start_date: data.start_date || null,
    target_end_date: data.target_end_date || null,
    created_by: userId,
    project_manager_id: data.project_manager_id || userId,
    assigned_team_ids: Array.isArray(data.assigned_team_ids) ? data.assigned_team_ids : [],
    members,
    tags: Array.isArray(data.tags) ? data.tags : [],
  });

  await newProject.save();

  // Create initial action steps if provided
  if (Array.isArray(data.steps) && data.steps.length > 0) {
    let stepNumber = 1;
    const stepDocs = data.steps.map((step) => ({
      project_id: newProject._id,
      phase_name: step.phase_name || 'Execution',
      step_number: step.step_number || stepNumber++,
      title: step.title,
      description: step.description || '',
      status: step.status || STEP_STATUS.PENDING,
      priority: step.priority || 'medium',
      assigned_to_user_id: step.assigned_to_user_id || null,
      assigned_to_user_name: step.assigned_to_user_name || '',
      due_date: step.due_date || null,
      checklist: Array.isArray(step.checklist) ? step.checklist : [],
      created_by: userId,
    }));

    await ProjectActionStep.insertMany(stepDocs);
    await recalculateProjectProgress(newProject._id);
  }

  return await Project.findById(newProject._id)
    .populate('created_by', 'name email')
    .populate('project_manager_id', 'name email')
    .populate('members.user_id', 'name email')
    .lean();
}

/**
 * List projects with filtering, pagination, and role scope.
 */
async function listProjects(query = {}, currentUser) {
  const { Project } = getModels();
  const userId = getUserId(currentUser);
  const filter = { deletedAt: null };

  if (query.status) {
    filter.status = query.status;
  }
  if (query.priority) {
    filter.priority = query.priority;
  }
  if (query.category) {
    filter.category = query.category;
  }
  if (query.is_archived !== undefined) {
    filter.is_archived = query.is_archived === 'true' || query.is_archived === true;
  }
  const andClauses = [];

  if (query.search) {
    const searchRegex = new RegExp(query.search, 'i');
    andClauses.push({
      $or: [
        { title: searchRegex },
        { project_code: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
      ],
    });
  }

  // Non-elevated users see projects where they are creator, manager, member, or assigned team
  if (!isSuperAdminBypass(currentUser) && !isWpAdmin(currentUser) && !isWpElevated(currentUser)) {
    const userScope = [
      { created_by: userId },
      { project_manager_id: userId },
      { 'members.user_id': userId },
    ];
    if (currentUser?.department) {
      userScope.push({ assigned_team_ids: currentUser.department });
    }
    andClauses.push({ $or: userScope });
  }

  if (andClauses.length > 0) {
    filter.$and = andClauses;
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Project.find(filter)
      .populate('created_by', 'name email')
      .populate('project_manager_id', 'name email')
      .populate('members.user_id', 'name email')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Project.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Get project details by ID.
 */
async function getProjectById(id, currentUser) {
  const { Project, ProjectActionStep } = getModels();
  const project = await Project.findOne({ _id: id, deletedAt: null })
    .populate('created_by', 'name email')
    .populate('project_manager_id', 'name email')
    .populate('members.user_id', 'name email')
    .populate('closed_by', 'name email')
    .lean();

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  if (!isProjectParticipant(project, currentUser)) {
    throw new ApiError(403, 'Access denied: You are not assigned to this project');
  }

  const steps = await ProjectActionStep.find({ project_id: id, deletedAt: null })
    .populate('assigned_to_user_id', 'name email')
    .sort({ step_number: 1 })
    .lean();

  return {
    ...project,
    steps,
  };
}

/**
 * Update project metadata.
 */
async function updateProject(id, updateData, currentUser) {
  const { Project, User } = getModels();
  const project = await Project.findOne({ _id: id, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  if (!hasProjectAdminAccess(project, currentUser)) {
    throw new ApiError(403, 'Access denied: Admin or Project Lead role required to edit project');
  }

  const allowedFields = [
    'title',
    'description',
    'category',
    'priority',
    'status',
    'start_date',
    'target_end_date',
    'project_manager_id',
    'assigned_team_ids',
    'tags',
  ];

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      project[field] = updateData[field];
    }
  }

  if (Array.isArray(updateData.members)) {
    const userIds = updateData.members.map((m) => m.user_id).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    project.members = updateData.members.map((m) => {
      const u = userMap.get(String(m.user_id));
      return {
        user_id: m.user_id,
        user_name: u?.name || m.user_name || '',
        user_email: u?.email || m.user_email || '',
        role: m.role || PROJECT_ROLES.CONTRIBUTOR,
        assigned_at: m.assigned_at || new Date(),
        assigned_by: getUserId(currentUser),
      };
    });
  }

  await project.save();
  return await getProjectById(id, currentUser);
}

/**
 * Close a project formally.
 */
async function closeProject(id, closureData = {}, currentUser) {
  const { Project, ProjectActionStep } = getModels();
  const project = await Project.findOne({ _id: id, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  if (!hasProjectAdminAccess(project, currentUser)) {
    throw new ApiError(403, 'Access denied: Only Admins or Project Managers can close a project');
  }

  const userId = getUserId(currentUser);

  // Check if force close or all steps completed
  const pendingSteps = await ProjectActionStep.countDocuments({
    project_id: id,
    status: { $in: [STEP_STATUS.PENDING, STEP_STATUS.IN_PROGRESS, STEP_STATUS.UNDER_REVIEW] },
    deletedAt: null,
  });

  project.status = PROJECT_STATUS.CLOSED;
  project.actual_closed_date = new Date();
  project.closed_by = userId;
  project.closure_remarks = closureData.remarks || (pendingSteps > 0 ? `Closed with ${pendingSteps} pending steps.` : 'Successfully completed and closed.');

  await project.save();
  return await getProjectById(id, currentUser);
}

/**
 * Reopen a closed project.
 */
async function reopenProject(id, currentUser) {
  const { Project } = getModels();
  const project = await Project.findOne({ _id: id, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  if (!hasProjectAdminAccess(project, currentUser)) {
    throw new ApiError(403, 'Access denied: Only Admins can reopen a project');
  }

  project.status = PROJECT_STATUS.ACTIVE;
  project.actual_closed_date = null;
  project.closed_by = null;
  await project.save();

  return await getProjectById(id, currentUser);
}

/**
 * Soft delete / Archive project.
 */
async function deleteProject(id, currentUser) {
  const { Project, ProjectActionStep, ProjectMessage, ProjectFile } = getModels();
  const project = await Project.findOne({ _id: id, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  if (!isSuperAdminBypass(currentUser) && !isWpAdmin(currentUser)) {
    throw new ApiError(403, 'Access denied: Only System Admins can delete projects');
  }

  const now = new Date();
  await Project.findByIdAndUpdate(id, { deletedAt: now, is_archived: true });
  await ProjectActionStep.updateMany({ project_id: id }, { deletedAt: now });
  await ProjectMessage.updateMany({ project_id: id }, { deletedAt: now });
  await ProjectFile.updateMany({ project_id: id }, { deletedAt: now });

  return { success: true, message: 'Project deleted successfully' };
}

// -------------------------------------------------------------
// Action Steps Management
// -------------------------------------------------------------

/**
 * Record a system event activity message in the Project Chat Room and broadcast via Socket.IO.
 */
async function recordStepChatActivity(projectId, stepId, content, currentUser) {
  try {
    const { ProjectMessage } = getModels();
    const { emitProjectMessage } = require('../../socket/projectSocket');
    const userId = getUserId(currentUser);

    const msg = new ProjectMessage({
      project_id: projectId,
      action_step_id: stepId || null,
      sender_id: userId,
      sender_name: currentUser?.name || 'System',
      sender_role: 'Activity',
      message_type: 'system_event',
      content: content,
      read_by: [{ user_id: userId, read_at: new Date() }],
    });

    await msg.save();
    const populated = await ProjectMessage.findById(msg._id)
      .populate('sender_id', 'name email')
      .lean();

    emitProjectMessage(projectId, populated);
    return populated;
  } catch (err) {
    console.error('[project.service] Failed to record step chat activity:', err?.message);
  }
}

async function listSteps(projectId, currentUser) {
  const { Project, ProjectActionStep } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null }).lean();
  if (!project) throw new ApiError(404, 'Project not found');

  if (!isProjectParticipant(project, currentUser)) {
    throw new ApiError(403, 'Access denied: You are not assigned to this project');
  }

  return await ProjectActionStep.find({ project_id: projectId, deletedAt: null })
    .populate('assigned_to_user_id', 'name email')
    .populate('workflow_actions.assigned_to_user_id', 'name email')
    .sort({ step_number: 1 })
    .lean();
}

async function createStep(projectId, stepData, currentUser) {
  const { Project, ProjectActionStep, User } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  if (!hasProjectAdminAccess(project, currentUser)) {
    throw new ApiError(403, 'Access denied: Admin or Project Lead role required to add steps');
  }

  const userId = getUserId(currentUser);

  // Calculate next step number if not provided
  let stepNumber = stepData.step_number;
  if (!stepNumber) {
    const highestStep = await ProjectActionStep.findOne({ project_id: projectId, deletedAt: null })
      .sort({ step_number: -1 })
      .lean();
    stepNumber = highestStep ? highestStep.step_number + 1 : 1;
  }

  let assignedUserName = stepData.assigned_to_user_name || '';
  if (stepData.assigned_to_user_id && !assignedUserName) {
    const u = await User.findById(stepData.assigned_to_user_id).lean();
    if (u) assignedUserName = u.name;
  }

  const newStep = new ProjectActionStep({
    project_id: projectId,
    phase_name: stepData.phase_name || 'Execution',
    step_number: stepNumber,
    title: stepData.title,
    description: stepData.description || '',
    status: stepData.status || STEP_STATUS.PENDING,
    priority: stepData.priority || 'medium',
    assigned_to_user_id: stepData.assigned_to_user_id || null,
    assigned_to_user_name: assignedUserName,
    due_date: stepData.due_date || null,
    start_date: stepData.start_date || null,
    dependencies: Array.isArray(stepData.dependencies) ? stepData.dependencies : [],
    checklist: Array.isArray(stepData.checklist) ? stepData.checklist : [],
    workflow_actions: Array.isArray(stepData.workflow_actions) ? stepData.workflow_actions : [],
    created_by: userId,
  });

  await newStep.save();
  await recalculateProjectProgress(projectId);

  await recordStepChatActivity(
    projectId,
    newStep._id,
    `📋 Action Step #${newStep.step_number} "${newStep.title}" created (${newStep.phase_name}) by ${currentUser?.name || 'User'}`,
    currentUser
  );

  return await ProjectActionStep.findById(newStep._id)
    .populate('assigned_to_user_id', 'name email')
    .populate('workflow_actions.assigned_to_user_id', 'name email')
    .lean();
}

async function updateStep(projectId, stepId, updateData, currentUser) {
  const { Project, ProjectActionStep, User } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  const step = await ProjectActionStep.findOne({ _id: stepId, project_id: projectId, deletedAt: null });
  if (!step) throw new ApiError(404, 'Action step not found');

  const userId = getUserId(currentUser);
  const isAssigned = step.assigned_to_user_id && String(step.assigned_to_user_id) === userId;
  const isLead = hasProjectAdminAccess(project, currentUser);

  if (!isLead && !isAssigned) {
    throw new ApiError(403, 'Access denied: You are not authorized to update this action step');
  }

  const allowedFields = [
    'title',
    'description',
    'phase_name',
    'step_number',
    'priority',
    'status',
    'assigned_to_user_id',
    'due_date',
    'start_date',
    'dependencies',
    'checklist',
    'workflow_actions',
  ];

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      step[field] = updateData[field];
    }
  }

  if (updateData.assigned_to_user_id) {
    const u = await User.findById(updateData.assigned_to_user_id).lean();
    if (u) step.assigned_to_user_name = u.name;
  }

  if (step.status === STEP_STATUS.COMPLETED && !step.completed_at) {
    step.completed_at = new Date();
    step.completed_by = userId;
  } else if (step.status !== STEP_STATUS.COMPLETED) {
    step.completed_at = null;
    step.completed_by = null;
  }

  step.updated_by = userId;
  await step.save();
  await recalculateProjectProgress(projectId);

  await recordStepChatActivity(
    projectId,
    stepId,
    `📝 Action Step #${step.step_number} "${step.title}" details updated by ${currentUser?.name || 'User'}`,
    currentUser
  );

  return await ProjectActionStep.findById(stepId)
    .populate('assigned_to_user_id', 'name email')
    .populate('workflow_actions.assigned_to_user_id', 'name email')
    .lean();
}

async function updateStepStatus(projectId, stepId, status, completionData = {}, currentUser) {
  const { Project, ProjectActionStep } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  const step = await ProjectActionStep.findOne({ _id: stepId, project_id: projectId, deletedAt: null });
  if (!step) throw new ApiError(404, 'Action step not found');

  const userId = getUserId(currentUser);
  const oldStatus = step.status;
  step.status = status;

  if (status === STEP_STATUS.COMPLETED) {
    step.completed_at = new Date();
    step.completed_by = userId;
  } else {
    step.completed_at = null;
    step.completed_by = null;
  }

  if (completionData.remark) {
    step.remarks.push({
      user_id: userId,
      user_name: currentUser?.name || 'User',
      comment: completionData.remark,
      created_at: new Date(),
    });
  }

  step.updated_by = userId;
  await step.save();
  await recalculateProjectProgress(projectId);

  await recordStepChatActivity(
    projectId,
    stepId,
    `🔄 Action Step #${step.step_number} "${step.title}" status changed to [${status.toUpperCase()}] by ${currentUser?.name || 'User'}${completionData.remark ? ` • Note: "${completionData.remark}"` : ''}`,
    currentUser
  );

  return await ProjectActionStep.findById(stepId)
    .populate('assigned_to_user_id', 'name email')
    .populate('workflow_actions.assigned_to_user_id', 'name email')
    .lean();
}

async function toggleChecklistItem(projectId, stepId, checklistItemId, isCompleted, currentUser) {
  const { ProjectActionStep } = getModels();
  const step = await ProjectActionStep.findOne({ _id: stepId, project_id: projectId, deletedAt: null });
  if (!step) throw new ApiError(404, 'Action step not found');

  const item = step.checklist.id(checklistItemId);
  if (!item) throw new ApiError(404, 'Checklist item not found');

  const userId = getUserId(currentUser);
  item.is_completed = isCompleted;
  item.completed_at = isCompleted ? new Date() : null;
  item.completed_by = isCompleted ? userId : null;

  await step.save();

  await recordStepChatActivity(
    projectId,
    stepId,
    `${isCompleted ? '✅' : '⚪'} Checklist item "${item.title}" ${isCompleted ? 'completed' : 'uncompleted'} on Step #${step.step_number} by ${currentUser?.name || 'User'}`,
    currentUser
  );

  return step;
}

async function deleteStep(projectId, stepId, currentUser) {
  const { Project, ProjectActionStep } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  if (!hasProjectAdminAccess(project, currentUser)) {
    throw new ApiError(403, 'Access denied: Admin or Project Lead role required to delete steps');
  }

  const step = await ProjectActionStep.findById(stepId).lean();
  await ProjectActionStep.findByIdAndUpdate(stepId, { deletedAt: new Date() });
  await recalculateProjectProgress(projectId);

  if (step) {
    await recordStepChatActivity(
      projectId,
      stepId,
      `🗑️ Action Step #${step.step_number} "${step.title}" deleted by ${currentUser?.name || 'User'}`,
      currentUser
    );
  }

  return { success: true, message: 'Step deleted successfully' };
}

// -------------------------------------------------------------
// Step Workflow Actions Management (Sequential 1-by-1 Execution)
// -------------------------------------------------------------

async function addWorkflowAction(projectId, stepId, actionData, currentUser) {
  const { Project, ProjectActionStep, User } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  const step = await ProjectActionStep.findOne({ _id: stepId, project_id: projectId, deletedAt: null });
  if (!step) throw new ApiError(404, 'Action step not found');

  const userId = getUserId(currentUser);
  const isAssigned = step.assigned_to_user_id && String(step.assigned_to_user_id) === userId;
  const isLead = hasProjectAdminAccess(project, currentUser);

  if (!isLead && !isAssigned) {
    throw new ApiError(403, 'Access denied: You are not authorized to add actions to this step');
  }

  let assignedUserName = actionData.assigned_to_user_name || '';
  if (actionData.assigned_to_user_id && !assignedUserName) {
    const u = await User.findById(actionData.assigned_to_user_id).lean();
    if (u) assignedUserName = u.name;
  }

  const nextOrder = (step.workflow_actions?.length || 0) + 1;
  const newAction = {
    action_order: actionData.action_order || nextOrder,
    title: actionData.title,
    description: actionData.description || '',
    status: actionData.status || 'pending',
    assigned_to_user_id: actionData.assigned_to_user_id || null,
    assigned_to_user_name: assignedUserName,
    started_at: actionData.status === 'in_progress' ? new Date() : null,
    performed_by: userId,
    performed_by_name: currentUser?.name || 'User',
    remarks: actionData.remarks || '',
  };

  step.workflow_actions.push(newAction);
  step.updated_by = userId;
  await step.save();

  await recordStepChatActivity(
    projectId,
    stepId,
    `⚡ Step #${step.step_number} ("${step.title}") workflow action added: "${newAction.title}" by ${currentUser?.name || 'User'}`,
    currentUser
  );

  return await ProjectActionStep.findById(stepId)
    .populate('assigned_to_user_id', 'name email')
    .populate('workflow_actions.assigned_to_user_id', 'name email')
    .lean();
}

async function updateWorkflowAction(projectId, stepId, actionId, updateData, currentUser) {
  const { Project, ProjectActionStep, User } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  const step = await ProjectActionStep.findOne({ _id: stepId, project_id: projectId, deletedAt: null });
  if (!step) throw new ApiError(404, 'Action step not found');

  const action = step.workflow_actions.id(actionId);
  if (!action) throw new ApiError(404, 'Workflow action not found');

  const userId = getUserId(currentUser);

  if (updateData.title !== undefined) action.title = updateData.title;
  if (updateData.description !== undefined) action.description = updateData.description;
  if (updateData.action_order !== undefined) action.action_order = updateData.action_order;
  if (updateData.remarks !== undefined) action.remarks = updateData.remarks;

  if (updateData.assigned_to_user_id !== undefined) {
    action.assigned_to_user_id = updateData.assigned_to_user_id || null;
    if (updateData.assigned_to_user_id) {
      const u = await User.findById(updateData.assigned_to_user_id).lean();
      action.assigned_to_user_name = u?.name || '';
    } else {
      action.assigned_to_user_name = '';
    }
  }

  const oldStatus = action.status;
  if (updateData.status && updateData.status !== oldStatus) {
    action.status = updateData.status;
    action.performed_by = userId;
    action.performed_by_name = currentUser?.name || 'User';

    if (updateData.status === 'in_progress') {
      action.started_at = action.started_at || new Date();
      if (step.status === 'pending') {
        step.status = 'in_progress';
      }
    } else if (updateData.status === 'completed') {
      action.completed_at = new Date();
      if (!action.started_at) action.started_at = new Date();

      // Check if all workflow actions in this step are completed
      const allCompleted = step.workflow_actions.every(
        (a) => String(a._id) === String(actionId) || a.status === 'completed' || a.status === 'skipped'
      );
      if (allCompleted && step.workflow_actions.length > 0 && step.status !== 'completed') {
        step.status = 'completed';
        step.completed_at = new Date();
        step.completed_by = userId;
      }
    }
  }

  step.updated_by = userId;
  await step.save();
  await recalculateProjectProgress(projectId);

  await recordStepChatActivity(
    projectId,
    stepId,
    `⚡ Step #${step.step_number} Action "${action.title}" updated to [${action.status.toUpperCase()}] by ${currentUser?.name || 'User'}${action.remarks ? ` • Note: "${action.remarks}"` : ''}`,
    currentUser
  );

  return await ProjectActionStep.findById(stepId)
    .populate('assigned_to_user_id', 'name email')
    .populate('workflow_actions.assigned_to_user_id', 'name email')
    .lean();
}

async function deleteWorkflowAction(projectId, stepId, actionId, currentUser) {
  const { Project, ProjectActionStep } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  const step = await ProjectActionStep.findOne({ _id: stepId, project_id: projectId, deletedAt: null });
  if (!step) throw new ApiError(404, 'Action step not found');

  const action = step.workflow_actions.id(actionId);
  if (!action) throw new ApiError(404, 'Workflow action not found');

  const actionTitle = action.title;
  step.workflow_actions.pull(actionId);
  step.updated_by = getUserId(currentUser);
  await step.save();
  await recalculateProjectProgress(projectId);

  await recordStepChatActivity(
    projectId,
    stepId,
    `🗑️ Step #${step.step_number} Action "${actionTitle}" deleted by ${currentUser?.name || 'User'}`,
    currentUser
  );

  return await ProjectActionStep.findById(stepId)
    .populate('assigned_to_user_id', 'name email')
    .populate('workflow_actions.assigned_to_user_id', 'name email')
    .lean();
}

// -------------------------------------------------------------
// Team & Member Assignment Management
// -------------------------------------------------------------

/**
 * Get eligible users and department teams for project assignment.
 */
async function getEligibleMembers(currentUser) {
  const { User } = getModels();
  const filter = { is_active: { $ne: false } };
  if (currentUser?.company_id) {
    filter.company_id = currentUser.company_id;
  }

  const users = await User.find(filter)
    .select('_id name email department phone')
    .sort({ name: 1 })
    .lean();

  const distinctDepts = await User.distinct('department', filter);
  const teams = (distinctDepts || [])
    .filter(Boolean)
    .map((d) => String(d).trim())
    .filter((d) => d.length > 0);

  // If no teams in DB yet, provide standard enterprise teams as suggestions
  const defaultTeams = ['Engineering', 'Design', 'Sales', 'Marketing', 'Operations', 'Quality Assurance', 'Management'];
  const allTeams = Array.from(new Set([...teams, ...defaultTeams]));

  return {
    users: users.map((u) => ({
      _id: String(u._id),
      name: u.name,
      email: u.email,
      department: u.department || 'General',
    })),
    teams: allTeams,
  };
}

/**
 * Add a member or list of members to a project.
 */
async function addProjectMember(projectId, memberData, currentUser) {
  const { Project, User } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  if (!hasProjectAdminAccess(project, currentUser)) {
    throw new ApiError(403, 'Access denied: Admin or Project Lead role required to add members');
  }

  const userId = getUserId(currentUser);
  const candidateIds = Array.isArray(memberData.user_ids)
    ? memberData.user_ids
    : [memberData.user_id].filter(Boolean);

  if (!candidateIds.length) {
    throw new ApiError(400, 'User ID is required');
  }

  const users = await User.find({ _id: { $in: candidateIds } }).lean();
  const defaultRole = memberData.role || PROJECT_ROLES.CONTRIBUTOR;

  if (!Array.isArray(project.members)) {
    project.members = [];
  }

  for (const u of users) {
    const existingIndex = project.members.findIndex(
      (m) => String(m.user_id) === String(u._id)
    );

    if (existingIndex >= 0) {
      project.members[existingIndex].role = defaultRole;
    } else {
      project.members.push({
        user_id: u._id,
        user_name: u.name || '',
        user_email: u.email || '',
        role: defaultRole,
        assigned_at: new Date(),
        assigned_by: userId,
      });
    }
  }

  await project.save();
  return await getProjectById(projectId, currentUser);
}

/**
 * Update member role in project.
 */
async function updateProjectMemberRole(projectId, memberUserId, newRole, currentUser) {
  const { Project } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  if (!hasProjectAdminAccess(project, currentUser)) {
    throw new ApiError(403, 'Access denied: Admin or Project Lead role required to update member roles');
  }

  const member = (project.members || []).find((m) => String(m.user_id) === String(memberUserId));
  if (!member) {
    throw new ApiError(404, 'Member not found in project');
  }

  member.role = newRole || PROJECT_ROLES.CONTRIBUTOR;
  await project.save();

  return await getProjectById(projectId, currentUser);
}

/**
 * Remove a member from a project.
 */
async function removeProjectMember(projectId, memberUserId, currentUser) {
  const { Project } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  if (!hasProjectAdminAccess(project, currentUser)) {
    throw new ApiError(403, 'Access denied: Admin or Project Lead role required to remove members');
  }

  // Do not allow removing the project creator or project manager directly without reassigning
  if (String(project.created_by) === String(memberUserId) && !isSuperAdminBypass(currentUser) && !isWpAdmin(currentUser)) {
    throw new ApiError(400, 'Cannot remove project creator from members');
  }

  project.members = (project.members || []).filter((m) => String(m.user_id) !== String(memberUserId));
  await project.save();

  return await getProjectById(projectId, currentUser);
}

/**
 * Assign team(s) to a project and auto-enroll team members.
 */
async function assignProjectTeams(projectId, teamNames, autoEnrollMembers = true, currentUser) {
  const { Project, User } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  if (!hasProjectAdminAccess(project, currentUser)) {
    throw new ApiError(403, 'Access denied: Admin or Project Lead role required to assign teams');
  }

  const teams = (Array.isArray(teamNames) ? teamNames : [teamNames])
    .filter(Boolean)
    .map((t) => String(t).trim());

  if (!teams.length) {
    throw new ApiError(400, 'At least one team name is required');
  }

  const currentTeams = new Set(project.assigned_team_ids || []);
  teams.forEach((t) => currentTeams.add(t));
  project.assigned_team_ids = Array.from(currentTeams);

  // Auto-enroll active users belonging to these departments
  if (autoEnrollMembers) {
    const usersInTeams = await User.find({
      department: { $in: teams },
      is_active: { $ne: false },
    }).lean();

    const userId = getUserId(currentUser);
    const existingMemberIds = new Set((project.members || []).map((m) => String(m.user_id)));

    for (const u of usersInTeams) {
      if (!existingMemberIds.has(String(u._id))) {
        project.members.push({
          user_id: u._id,
          user_name: u.name || '',
          user_email: u.email || '',
          role: PROJECT_ROLES.CONTRIBUTOR,
          assigned_at: new Date(),
          assigned_by: userId,
        });
        existingMemberIds.add(String(u._id));
      }
    }
  }

  await project.save();
  return await getProjectById(projectId, currentUser);
}

/**
 * Remove a team from a project.
 */
async function removeProjectTeam(projectId, teamName, currentUser) {
  const { Project } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');

  if (!hasProjectAdminAccess(project, currentUser)) {
    throw new ApiError(403, 'Access denied: Admin or Project Lead role required to remove teams');
  }

  const target = String(teamName).trim();
  project.assigned_team_ids = (project.assigned_team_ids || []).filter((t) => t !== target);
  await project.save();

  return await getProjectById(projectId, currentUser);
}

module.exports = {
  createProject,
  listProjects,
  getProjectById,
  updateProject,
  closeProject,
  reopenProject,
  deleteProject,
  listSteps,
  createStep,
  updateStep,
  updateStepStatus,
  toggleChecklistItem,
  deleteStep,
  recalculateProjectProgress,
  addWorkflowAction,
  updateWorkflowAction,
  deleteWorkflowAction,
  getEligibleMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  assignProjectTeams,
  removeProjectTeam,
};

