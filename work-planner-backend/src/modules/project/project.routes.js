/**
 * @fileoverview Express Router for Project Management module.
 * @module modules/project/project.routes
 */
const { Router } = require('express');
const multer = require('multer');
const { requireAuth } = require('../../middlewares/auth.middleware');
const {
  requireWorkPlannerAccess,
  requireWorkPlannerRole,
} = require('../../middlewares/workPlannerAuth.middleware');
const controller = require('./project.controller');

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file upload
});

const elevatedRoles = requireWorkPlannerRole('coordinator', 'manager', 'admin');
const adminRole = requireWorkPlannerRole('admin');

router.use(requireAuth);
router.use(requireWorkPlannerAccess);

// Projects Listing, Creation & Metadata
router.get('/eligible-members', controller.getEligibleMembers);
router.get('/', controller.listProjects);
router.post('/', elevatedRoles, controller.createProject);

// Single Project Operations
router.get('/:id', controller.getProject);
router.patch('/:id', controller.updateProject);
router.put('/:id', controller.updateProject);
router.post('/:id/close', elevatedRoles, controller.closeProject);
router.post('/:id/reopen', adminRole, controller.reopenProject);
router.delete('/:id', adminRole, controller.deleteProject);

// Project Members & Teams Management
router.post('/:id/members', elevatedRoles, controller.addMember);
router.patch('/:id/members/:userId', elevatedRoles, controller.updateMemberRole);
router.delete('/:id/members/:userId', elevatedRoles, controller.removeMember);
router.post('/:id/teams', elevatedRoles, controller.assignTeams);
router.delete('/:id/teams/:teamName', elevatedRoles, controller.removeTeam);

// Project Action Steps
router.get('/:id/steps', controller.listSteps);
router.post('/:id/steps', controller.createStep);
router.patch('/:id/steps/:stepId', controller.updateStep);
router.patch('/:id/steps/:stepId/status', controller.updateStepStatus);
router.patch('/:id/steps/:stepId/checklist/:checklistItemId', controller.toggleChecklistItem);
router.delete('/:id/steps/:stepId', controller.deleteStep);

// Step Workflow Actions
router.post('/:id/steps/:stepId/actions', controller.addWorkflowAction);
router.patch('/:id/steps/:stepId/actions/:actionId', controller.updateWorkflowAction);
router.delete('/:id/steps/:stepId/actions/:actionId', controller.deleteWorkflowAction);

// Project Chat Room
router.get('/:id/messages', controller.listMessages);
router.post('/:id/messages', controller.postMessage);
router.post('/:id/messages/:messageId/pin', controller.togglePinMessage);

// Project Files & Document Hub
router.get('/:id/files', controller.listFiles);
router.post('/:id/files/upload', upload.single('file'), controller.uploadProjectFile);
router.delete('/:id/files/:fileId', controller.deleteFile);

// Project File & Attachment Streaming / Previews
router.get('/attachments/:attachmentId/preview', controller.previewAttachment);
router.get('/attachments/:attachmentId/view', controller.previewAttachment);
router.get('/attachments/:attachmentId/download', controller.downloadAttachment);
router.get('/files/:fileId/preview', controller.previewProjectFile);
router.get('/files/:fileId/view', controller.previewProjectFile);
router.get('/files/:fileId/download', controller.downloadProjectFile);

module.exports = router;
