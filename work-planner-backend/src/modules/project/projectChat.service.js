/**
 * @fileoverview Project Chat and File Sharing Service.
 * @module modules/project/projectChat.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');
const { isWpAdmin, isWpElevated, isSuperAdminBypass } = require('../workPlanner/workPlanner.constants');

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

async function verifyProjectAccess(projectId, currentUser) {
  const { Project } = getModels();
  const project = await Project.findOne({ _id: projectId, deletedAt: null }).lean();
  if (!project) throw new ApiError(404, 'Project not found');

  if (isSuperAdminBypass(currentUser) || isWpAdmin(currentUser) || isWpElevated(currentUser)) {
    return project;
  }

  const userId = getUserId(currentUser);
  const creatorId = extractId(project.created_by);
  const managerId = extractId(project.project_manager_id);

  let isMember =
    creatorId === userId ||
    managerId === userId ||
    (project.members || []).some((m) => extractId(m.user_id) === userId);

  if (!isMember && currentUser?.department && Array.isArray(project.assigned_team_ids)) {
    const userDept = String(currentUser.department).trim().toLowerCase();
    isMember = project.assigned_team_ids.some(
      (t) => String(t).trim().toLowerCase() === userDept
    );
  }

  if (!isMember) {
    throw new ApiError(403, 'Access denied: You are not assigned to this project');
  }

  return project;
}

// -------------------------------------------------------------
// Chat Messages
// -------------------------------------------------------------

async function listMessages(projectId, query = {}, currentUser) {
  await verifyProjectAccess(projectId, currentUser);
  const { ProjectMessage } = getModels();

  const filter = { project_id: projectId, deletedAt: null };
  if (query.action_step_id) {
    filter.action_step_id = query.action_step_id;
  }
  if (query.is_pinned !== undefined) {
    filter.is_pinned = query.is_pinned === 'true' || query.is_pinned === true;
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 100;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    ProjectMessage.find(filter)
      .populate('sender_id', 'name email')
      .populate('mentions', 'name email')
      .populate('pinned_by', 'name email')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProjectMessage.countDocuments(filter),
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

async function postMessage(projectId, data, currentUser) {
  const project = await verifyProjectAccess(projectId, currentUser);
  const { ProjectMessage } = getModels();
  const userId = getUserId(currentUser);

  const member = (project.members || []).find((m) => String(m.user_id) === userId);
  const senderRole = isWpAdmin(currentUser)
    ? 'Admin'
    : String(project.project_manager_id) === userId
    ? 'Manager'
    : member?.role || 'Member';

  const newMsg = new ProjectMessage({
    project_id: projectId,
    action_step_id: data.action_step_id || null,
    sender_id: userId,
    sender_name: currentUser?.name || 'Unknown User',
    sender_role: senderRole,
    message_type: data.message_type || (data.attachments?.length ? 'file' : 'text'),
    content: data.content || '',
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
    mentions: Array.isArray(data.mentions) ? data.mentions : [],
    read_by: [{ user_id: userId, read_at: new Date() }],
  });

  await newMsg.save();

  return await ProjectMessage.findById(newMsg._id)
    .populate('sender_id', 'name email')
    .populate('mentions', 'name email')
    .lean();
}

async function togglePinMessage(projectId, messageId, currentUser) {
  await verifyProjectAccess(projectId, currentUser);
  const { ProjectMessage } = getModels();

  const msg = await ProjectMessage.findOne({ _id: messageId, project_id: projectId, deletedAt: null });
  if (!msg) throw new ApiError(404, 'Message not found');

  const userId = getUserId(currentUser);
  msg.is_pinned = !msg.is_pinned;
  msg.pinned_by = msg.is_pinned ? userId : null;
  msg.pinned_at = msg.is_pinned ? new Date() : null;

  await msg.save();
  return msg;
}

// -------------------------------------------------------------
// Project Files & Attachments Hub
// -------------------------------------------------------------

async function listFiles(projectId, query = {}, currentUser) {
  await verifyProjectAccess(projectId, currentUser);
  const { ProjectFile } = getModels();

  const filter = { project_id: projectId, deletedAt: null, is_archived: false };
  if (query.folder) {
    filter.folder = query.folder;
  }
  if (query.action_step_id) {
    filter.action_step_id = query.action_step_id;
  }

  return await ProjectFile.find(filter)
    .populate('attachment_id')
    .populate('uploaded_by', 'name email')
    .sort({ createdAt: -1 })
    .lean();
}

async function recordProjectFile(projectId, fileData, currentUser) {
  await verifyProjectAccess(projectId, currentUser);
  const { ProjectFile } = getModels();
  const userId = getUserId(currentUser);

  const newFile = new ProjectFile({
    project_id: projectId,
    action_step_id: fileData.action_step_id || null,
    attachment_id: fileData.attachment_id,
    file_name: fileData.file_name,
    folder: fileData.folder || 'General',
    mime_type: fileData.mime_type || '',
    size_bytes: fileData.size_bytes || 0,
    uploaded_by: userId,
    uploader_name: currentUser?.name || 'User',
  });

  await newFile.save();
  return await ProjectFile.findById(newFile._id)
    .populate('attachment_id')
    .populate('uploaded_by', 'name email')
    .lean();
}

async function deleteProjectFile(projectId, fileId, currentUser) {
  await verifyProjectAccess(projectId, currentUser);
  const { ProjectFile } = getModels();

  const file = await ProjectFile.findOne({ _id: fileId, project_id: projectId, deletedAt: null });
  if (!file) throw new ApiError(404, 'File not found');

  const userId = getUserId(currentUser);
  if (!isWpAdmin(currentUser) && String(file.uploaded_by) !== userId) {
    throw new ApiError(403, 'Access denied: Only the uploader or admin can delete this file');
  }

  await ProjectFile.findByIdAndUpdate(fileId, { deletedAt: new Date(), is_archived: true });
  return { success: true, message: 'File deleted successfully' };
}

module.exports = {
  listMessages,
  postMessage,
  togglePinMessage,
  listFiles,
  recordProjectFile,
  deleteProjectFile,
};
