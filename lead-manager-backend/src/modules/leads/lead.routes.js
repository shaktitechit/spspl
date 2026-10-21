const express = require('express');
const { requireAuth } = require('../../middlewares/auth.middleware');
const {
  requireLeadManagerAccess,
  requireLeadManagerOrWorkPlannerAccess,
  requireLeadManagerSalesTeamRole,
  requireLeadManagerElevatedRole,
} = require('../../middlewares/leadManagerAuth.middleware');
const controller = require('./lead.controller');
const quotationController = require('./leadQuotation.controller');

const router = express.Router();

router.use(requireAuth);

/* --- Leads list (also used by Work Planner to search an executive's leads) --- */
router.get('/', requireLeadManagerOrWorkPlannerAccess, controller.list);

router.use(requireLeadManagerAccess);

/* --- Duplicate Check --- */
router.post('/check-duplicates', controller.checkDuplicates);

/* --- Reports & Dashboard --- */
router.get('/reports/dashboard', controller.getDashboardStats);
router.get('/reports/funnel', controller.getSalesFunnel);
router.get('/reports/sales-performance', controller.getSalesPerformance);
router.get('/reports/source-performance', controller.getSourcePerformance);
router.get('/reports/monthly-trends', controller.getMonthlyTrends);
router.get('/reports/products', controller.getProductBreakdown);
router.get('/reports/follow-ups', controller.getFollowUpReport);

/* --- Follow-up Calendar & Reminders --- */
router.get('/follow-ups/calendar', controller.getFollowUpCalendar);
router.get('/follow-ups/urgent-summary', controller.getUrgentFollowUpsSummary);
router.post('/follow-ups/reminders/run', controller.runAllFollowUpReminders);
router.post('/follow-ups/reminders/today', controller.runTodaysFollowUpReminders);
router.post('/follow-ups/reminders/overdue', controller.runOverdueFollowUpReminders);
router.put('/follow-ups/:followUpId/complete', controller.completeFollowUp);

/* --- Lead Quotations --- */
router.get('/quotations/default-terms', requireLeadManagerSalesTeamRole, quotationController.getDefaultTerms);
router.get('/quotations/:quotationId', requireLeadManagerSalesTeamRole, quotationController.getById);
router.patch('/quotations/:quotationId', requireLeadManagerSalesTeamRole, quotationController.update);
router.post('/quotations/:quotationId/submit-for-approval', requireLeadManagerSalesTeamRole, quotationController.submitForApproval);
router.post('/quotations/:quotationId/approve', requireLeadManagerSalesTeamRole, quotationController.approve);
router.post('/quotations/:quotationId/reject', requireLeadManagerSalesTeamRole, quotationController.reject);
router.post('/quotations/:quotationId/convert', requireLeadManagerElevatedRole, quotationController.convert);
router.post('/quotations/:quotationId/extend-validity', requireLeadManagerSalesTeamRole, quotationController.extendValidity);
router.delete('/quotations/:quotationId', requireLeadManagerElevatedRole, quotationController.remove);

/* --- Leads CRUD --- */
router.post('/', controller.create);
router.post('/bulk-upload', controller.bulkCreate);
router.delete('/bulk', controller.bulkRemove);

router.get('/:id', controller.get);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/restore', controller.restore);

/* --- Lead Actions --- */
router.post('/:id/assign', controller.assign);
router.post('/:id/status', controller.changeStatus);
router.post('/:id/qualify', controller.qualify);
router.post('/:id/mark-lost', controller.markLost);
router.post('/:id/convert', controller.convert);
router.get('/:id/timeline', controller.getTimeline);

/* --- Lead Follow-ups --- */
router.get('/:id/follow-ups', controller.listFollowUps);
router.post('/:id/follow-ups', controller.createFollowUp);

/* --- Lead Quotations per Lead --- */
router.get('/:id/quotations', requireLeadManagerSalesTeamRole, quotationController.list);
router.post('/:id/quotations', requireLeadManagerElevatedRole, quotationController.create);

module.exports = router;
