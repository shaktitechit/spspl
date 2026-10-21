/**
 * @fileoverview Work Planner: Express router mounts with portal-based authorization.
 * @module modules/workPlanner/workPlanner.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const {
  requireWorkPlannerAccess,
  requireWorkPlannerRole,
} = require('../../middlewares/workPlannerAuth.middleware');
const controller = require('./workPlanner.controller');
const notesController = require('./notes.controller');
const teamController = require('./team.controller');
const emailPreferenceController = require('./emailPreference.controller');
const analyticsController = require('./workPlanAnalytics.controller');
const userTemplateController = require('./userTemplate.controller');
const expenseRoutes = require('./expense/expense.routes');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const elevatedRoles = requireWorkPlannerRole('coordinator', 'manager', 'admin');
const adminRole = requireWorkPlannerRole('admin');

router.use(requireAuth);
router.use(requireWorkPlannerAccess);

// Email notification preferences (per profile)
router.get('/email-preferences/me', emailPreferenceController.getMyEmailPreferences);
router.put('/email-preferences/me', emailPreferenceController.updateMyEmailPreferences);
router.post('/email-preferences/me/reset', emailPreferenceController.resetMyEmailPreferences);

// Expense & Tour Advance Domain
router.use('/expenses', expenseRoutes);

// 360° AI Work Plan Analytics & Caliber Assessment (must be before /:id)
router.get('/analytics/caliber', analyticsController.getCaliberAnalytics);
router.post('/analytics/caliber/regenerate', analyticsController.regenerateCaliberAnalytics);
router.get('/analytics/plan/:id/ai-analysis', analyticsController.getSinglePlanAiAnalysis);
router.get('/analytics/team-overview', analyticsController.getTeamOverview);

// Authenticated attachment streaming & previews (accepts Authorization header or ?token=)
router.get('/attachments/:attachmentId/preview', controller.previewAttachment);
router.get('/attachments/:attachmentId/view', controller.viewAttachment);
router.get('/attachments/:attachmentId/download', controller.downloadAttachment);
router.get('/files/:fileId/preview', controller.previewAttachment);
router.get('/files/:fileId/view', controller.viewAttachment);
router.get('/files/:fileId/download', controller.downloadAttachment);

router.post('/expenses/upload', upload.single('file'), controller.uploadExpenseReceipt);
router.post('/attachments/upload', upload.single('file'), controller.uploadAttachment);
router.get('/user-settings/:userId', controller.getUserSettings);
router.put('/user-settings/:userId', elevatedRoles, controller.updateUserSettings);
router.get('/eligible-managers', controller.getEligibleManagers);

// User Tasks & Dynamic Templates
router.get('/user-tasks/summary', elevatedRoles, userTemplateController.getUserTasksSummary);
router.get('/user-tasks/:userId', userTemplateController.getUserTasks);
router.put('/user-tasks/:userId', adminRole, userTemplateController.updateUserTasks);

// User Visit Templates (Single per user)
router.get('/user-visit-templates/summary', elevatedRoles, userTemplateController.getUserVisitTemplatesSummary);
router.get('/user-visit-template/:userId', userTemplateController.getUserVisitTemplate);
router.put('/user-visit-template/:userId', adminRole, userTemplateController.updateUserVisitTemplate);

// Team hierarchy (must be before /:id)
router.get('/team/tree', adminRole, teamController.getTree);
router.get('/team/my-team', elevatedRoles, teamController.getMyTeam);
router.get('/team/members', elevatedRoles, teamController.getMembers);
router.get('/team/edges', elevatedRoles, teamController.listEdges);
router.put('/team/edges', adminRole, teamController.upsertEdge);
router.delete('/team/edges/:subordinateId', adminRole, teamController.removeEdge);
router.delete('/team/edges/:subordinateId/:managerId', adminRole, (req, res, next) => {
  if (req.params.managerId) req.query.manager = req.params.managerId;
  return teamController.removeEdge(req, res, next);
});

router.get('/drafts', controller.getDraft);
router.put('/drafts', controller.saveDraft);
router.delete('/drafts', controller.deleteDraft);

// Personal Scratchpad / User Notes (must be before /:id)
router.get('/notes', notesController.listNotes);
router.get('/notes/kpis', notesController.getNotesKpis);
router.post('/notes', notesController.createNote);
router.post('/notes/bulk-convert', notesController.bulkConvertToWorkPlan);
router.post('/notes/batch-convert', notesController.bulkConvertToWorkPlan);
router.post('/notes/mark-converted', notesController.markNotesConverted);
router.get('/notes/:id', notesController.getNote);
router.patch('/notes/:id', notesController.updateNote);
router.delete('/notes/:id', notesController.deleteNote);
router.post('/notes/:id/toggle-pin', notesController.togglePin);
router.post('/notes/:id/toggle-archive', notesController.toggleArchive);
router.patch('/notes/:id/toggle-complete', notesController.toggleTaskComplete);

// Senior Remarks, Objections & Junior Follow-ups
router.get('/senior-remarks', controller.getSeniorRemarks);
router.post('/senior-remarks/followup', controller.addJuniorFollowup);
router.patch('/senior-remarks/status', elevatedRoles, controller.updateSeniorRemarkStatus);

router.get('/', controller.list);
router.get('/stats', controller.stats);
router.get('/expenses', controller.listAllExpenses);
router.post('/', controller.create);

// Standalone Visits & Tasks (independent of Work Plans)
router.post('/standalone-visits', controller.addStandaloneVisit);
router.patch('/standalone-visits/:visitId', controller.updateStandaloneVisit);
router.delete('/standalone-visits/:visitId', controller.removeStandaloneVisit);

router.post('/standalone-works', controller.addStandaloneWork);
router.patch('/standalone-works/:workId', controller.updateStandaloneWork);
router.delete('/standalone-works/:workId', controller.removeStandaloneWork);

router.get('/:id', controller.get);
router.get('/:id/day-end-draft', controller.getDayEndDraft);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

router.post('/:id/submit', controller.submit);
router.post('/:id/approve', elevatedRoles, controller.approve);
router.post('/:id/reject', elevatedRoles, controller.reject);
router.post('/:id/complete', controller.complete);
router.post('/:id/authority-remarks', elevatedRoles, controller.addWorkPlanAuthorityRemark);

router.post('/:id/visits', controller.addVisit);
router.patch('/:id/visits/:visitId', controller.updateVisit);
router.delete('/:id/visits/:visitId', controller.removeVisit);
router.post('/:id/visits/:visitId/authority-remarks', elevatedRoles, controller.addVisitAuthorityRemark);

router.post('/:id/works', controller.addWork);
router.patch('/:id/works/:workId', controller.updateWork);
router.delete('/:id/works/:workId', controller.removeWork);
router.post('/:id/works/:workId/authority-remarks', elevatedRoles, controller.addWorkAuthorityRemark);

router.post('/:id/visits/:visitId/check-in', controller.checkIn);
router.post('/:id/visits/:visitId/check-out', controller.checkOut);
router.post('/:id/visits/:visitId/complete', controller.completeVisit);

router.get('/:id/expenses', controller.listExpenses);
router.post('/:id/expenses', controller.addExpense);
router.post('/:id/expenses/submit-all', controller.submitAllExpenses);
router.post('/:id/expenses/approve-all', elevatedRoles, controller.approveAllExpenses);
router.post('/:id/expenses/reject-all', elevatedRoles, controller.rejectAllExpenses);
router.patch('/:id/expenses/:expenseId', controller.updateExpense);
router.delete('/:id/expenses/:expenseId', controller.removeExpense);
router.post('/:id/expenses/:expenseId/submit', controller.submitExpense);
router.post('/:id/expenses/:expenseId/approve', elevatedRoles, controller.approveExpense);
router.post('/:id/expenses/:expenseId/reject', elevatedRoles, controller.rejectExpense);
router.post('/:id/expenses/:expenseId/authority-remarks', elevatedRoles, controller.addExpenseAuthorityRemark);

module.exports = router;
