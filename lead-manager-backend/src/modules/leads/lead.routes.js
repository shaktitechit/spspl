const express = require('express');
const { requireAuth } = require('../../middlewares/auth.middleware');
const {
  requireLeadManagerAccess,
  requireLeadManagerOrWorkPlannerAccess,
} = require('../../middlewares/leadManagerAuth.middleware');
const controller = require('./lead.controller');

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

/* --- Follow-up Calendar & Agenda --- */
router.get('/follow-ups/calendar', controller.getFollowUpCalendar);
router.get('/follow-ups/urgent-summary', controller.getUrgentFollowUpsSummary);
router.put('/follow-ups/:followUpId/complete', controller.completeFollowUp);
router.post('/follow-ups/:followUpId/actions', controller.addFollowUpAction);

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

module.exports = router;
