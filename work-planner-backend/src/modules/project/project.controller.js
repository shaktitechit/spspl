/**
 * @fileoverview Project Management HTTP Controller.
 * @module modules/project/project.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./project.service');
const chatService = require('./projectChat.service');
const { uploadMulterFile } = require('../../services/fileManagement');
const {
  emitProjectMessage,
  emitProjectUpdated,
  emitStepUpdated,
  emitFileUploaded,
  emitProjectClosed,
} = require('../../socket/projectSocket');

// Projects CRUD
exports.listProjects = asyncHandler(async (req, res) => {
  const result = await service.listProjects(req.query, req.user);
  res.json({ success: true, ...result });
});

exports.getProject = asyncHandler(async (req, res) => {
  const data = await service.getProjectById(req.params.id, req.user);
  res.json({ success: true, data });
});

exports.createProject = asyncHandler(async (req, res) => {
  const data = await service.createProject(req.body, req.user);
  res.status(201).json({ success: true, data });
});

exports.updateProject = asyncHandler(async (req, res) => {
  const data = await service.updateProject(req.params.id, req.body, req.user);
  emitProjectUpdated(req.params.id, data);
  res.json({ success: true, data });
});

exports.closeProject = asyncHandler(async (req, res) => {
  const data = await service.closeProject(req.params.id, req.body, req.user);
  emitProjectClosed(req.params.id, data);
  res.json({ success: true, data });
});

exports.reopenProject = asyncHandler(async (req, res) => {
  const data = await service.reopenProject(req.params.id, req.user);
  emitProjectUpdated(req.params.id, data);
  res.json({ success: true, data });
});

exports.deleteProject = asyncHandler(async (req, res) => {
  const result = await service.deleteProject(req.params.id, req.user);
  res.json({ success: true, ...result });
});

// Action Steps
exports.listSteps = asyncHandler(async (req, res) => {
  const data = await service.listSteps(req.params.id, req.user);
  res.json({ success: true, data });
});

exports.createStep = asyncHandler(async (req, res) => {
  const data = await service.createStep(req.params.id, req.body, req.user);
  emitStepUpdated(req.params.id, data);
  res.status(201).json({ success: true, data });
});

exports.updateStep = asyncHandler(async (req, res) => {
  const data = await service.updateStep(req.params.id, req.params.stepId, req.body, req.user);
  emitStepUpdated(req.params.id, data);
  res.json({ success: true, data });
});

exports.updateStepStatus = asyncHandler(async (req, res) => {
  const data = await service.updateStepStatus(
    req.params.id,
    req.params.stepId,
    req.body.status,
    req.body,
    req.user
  );
  emitStepUpdated(req.params.id, data);
  res.json({ success: true, data });
});

exports.toggleChecklistItem = asyncHandler(async (req, res) => {
  const data = await service.toggleChecklistItem(
    req.params.id,
    req.params.stepId,
    req.params.checklistItemId,
    req.body.is_completed,
    req.user
  );
  emitStepUpdated(req.params.id, data);
  res.json({ success: true, data });
});

exports.deleteStep = asyncHandler(async (req, res) => {
  const result = await service.deleteStep(req.params.id, req.params.stepId, req.user);
  emitStepUpdated(req.params.id, { _id: req.params.stepId, isDeleted: true });
  res.json({ success: true, ...result });
});

// Step Workflow Actions
exports.addWorkflowAction = asyncHandler(async (req, res) => {
  const data = await service.addWorkflowAction(req.params.id, req.params.stepId, req.body, req.user);
  emitStepUpdated(req.params.id, data);
  res.status(201).json({ success: true, data });
});

exports.updateWorkflowAction = asyncHandler(async (req, res) => {
  const data = await service.updateWorkflowAction(
    req.params.id,
    req.params.stepId,
    req.params.actionId,
    req.body,
    req.user
  );
  emitStepUpdated(req.params.id, data);
  res.json({ success: true, data });
});

exports.deleteWorkflowAction = asyncHandler(async (req, res) => {
  const data = await service.deleteWorkflowAction(
    req.params.id,
    req.params.stepId,
    req.params.actionId,
    req.user
  );
  emitStepUpdated(req.params.id, data);
  res.json({ success: true, data });
});

// Chat Room
exports.listMessages = asyncHandler(async (req, res) => {
  const result = await chatService.listMessages(req.params.id, req.query, req.user);
  res.json({ success: true, ...result });
});

exports.postMessage = asyncHandler(async (req, res) => {
  const data = await chatService.postMessage(req.params.id, req.body, req.user);
  emitProjectMessage(req.params.id, data);
  res.status(201).json({ success: true, data });
});

exports.togglePinMessage = asyncHandler(async (req, res) => {
  const data = await chatService.togglePinMessage(req.params.id, req.params.messageId, req.user);
  res.json({ success: true, data });
});

// Files & Document Hub
exports.listFiles = asyncHandler(async (req, res) => {
  const data = await chatService.listFiles(req.params.id, req.query, req.user);
  res.json({ success: true, data });
});

exports.uploadProjectFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No file uploaded');
  }

  const attachment = await uploadMulterFile(
    req.file,
    'project_file',
    req.params.id
  );

  const fileRecord = await chatService.recordProjectFile(
    req.params.id,
    {
      action_step_id: req.body.action_step_id || null,
      attachment_id: attachment._id || attachment.id,
      file_name: req.file.originalname,
      folder: req.body.folder || 'General',
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
    },
    req.user
  );

  emitFileUploaded(req.params.id, fileRecord);

  res.status(201).json({ success: true, data: fileRecord, attachment });
});

exports.deleteFile = asyncHandler(async (req, res) => {
  const result = await chatService.deleteProjectFile(req.params.id, req.params.fileId, req.user);
  res.json({ success: true, ...result });
});

// Teams & Members Management
exports.getEligibleMembers = asyncHandler(async (req, res) => {
  const data = await service.getEligibleMembers(req.user);
  res.json({ success: true, data });
});

exports.addMember = asyncHandler(async (req, res) => {
  const data = await service.addProjectMember(req.params.id, req.body, req.user);
  emitProjectUpdated(req.params.id, data);
  res.status(201).json({ success: true, data });
});

exports.updateMemberRole = asyncHandler(async (req, res) => {
  const data = await service.updateProjectMemberRole(
    req.params.id,
    req.params.userId,
    req.body.role,
    req.user
  );
  emitProjectUpdated(req.params.id, data);
  res.json({ success: true, data });
});

exports.removeMember = asyncHandler(async (req, res) => {
  const data = await service.removeProjectMember(req.params.id, req.params.userId, req.user);
  emitProjectUpdated(req.params.id, data);
  res.json({ success: true, data });
});

exports.assignTeams = asyncHandler(async (req, res) => {
  const teamNames = req.body.team_names || req.body.teams || (req.body.team_name ? [req.body.team_name] : []);
  const autoEnroll = req.body.auto_enroll !== false;
  const data = await service.assignProjectTeams(req.params.id, teamNames, autoEnroll, req.user);
  emitProjectUpdated(req.params.id, data);
  res.status(201).json({ success: true, data });
});

exports.removeTeam = asyncHandler(async (req, res) => {
  const data = await service.removeProjectTeam(req.params.id, req.params.teamName, req.user);
  emitProjectUpdated(req.params.id, data);
  res.json({ success: true, data });
});

// -------------------------------------------------------------
// File Streaming & Preview Handlers
// -------------------------------------------------------------

exports.previewAttachment = asyncHandler(async (req, res) => {
  const { streamFileToResponse } = require('../../services/fileManagement');
  const identifier = req.params.attachmentId || req.params.fileId;
  await streamFileToResponse(identifier, res, { disposition: 'inline' });
});

exports.downloadAttachment = asyncHandler(async (req, res) => {
  const { streamFileToResponse } = require('../../services/fileManagement');
  const identifier = req.params.attachmentId || req.params.fileId;
  await streamFileToResponse(identifier, res, { disposition: 'attachment' });
});

exports.previewProjectFile = asyncHandler(async (req, res) => {
  const { streamFileToResponse } = require('../../services/fileManagement');
  const identifier = req.params.fileId || req.params.attachmentId;
  await streamFileToResponse(identifier, res, { disposition: 'inline' });
});

exports.downloadProjectFile = asyncHandler(async (req, res) => {
  const { streamFileToResponse } = require('../../services/fileManagement');
  const identifier = req.params.fileId || req.params.attachmentId;
  await streamFileToResponse(identifier, res, { disposition: 'attachment' });
});


