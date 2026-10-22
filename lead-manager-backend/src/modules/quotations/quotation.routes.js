/**
 * @fileoverview Router for standalone `/api/quotations` endpoints.
 * @module modules/quotations/quotation.routes
 */
const express = require('express');
const { requireAuth } = require('../../middlewares/auth.middleware');
const {
  requireLeadManagerAccess,
  requireLeadManagerSalesTeamRole,
  requireLeadManagerElevatedRole,
} = require('../../middlewares/leadManagerAuth.middleware');
const controller = require('./quotation.controller');
const reportsController = require('./quotationReports.controller');

const router = express.Router();

const elevatedRoles = requireLeadManagerElevatedRole;
const allSalesRoles = requireLeadManagerSalesTeamRole;

router.use(requireAuth);
router.use(requireLeadManagerAccess);

// Reports & Analytics (Must precede /:id)
router.get('/reports/summary', allSalesRoles, reportsController.getSummaryReport);
router.get('/reports/sales-performance', allSalesRoles, reportsController.getSalesPerformance);
router.get('/reports/monthly-trends', allSalesRoles, reportsController.getMonthlyTrends);
router.get('/reports/product-breakdown', allSalesRoles, reportsController.getProductBreakdown);
router.get('/reports/funnel', allSalesRoles, reportsController.getConversionFunnel);

router.get('/default-terms', allSalesRoles, controller.getDefaultTerms);
router.get('/dashboard-stats', allSalesRoles, controller.getDashboardStats);
router.post('/auto-expire', elevatedRoles, controller.triggerAutoExpiry);
router.get('/', allSalesRoles, controller.list);
router.post('/', elevatedRoles, controller.create);
router.get('/:id', allSalesRoles, controller.getById);
router.get('/:id/versions/:version', allSalesRoles, controller.getVersionDetails);
router.get('/:id/compare', allSalesRoles, controller.compareVersions);
router.patch('/:id', allSalesRoles, controller.update);
router.put('/:id', allSalesRoles, controller.update);
router.post('/:id/submit-for-approval', allSalesRoles, controller.submitForApproval);
router.post('/:id/approve', allSalesRoles, controller.approve);
router.post('/:id/reject', allSalesRoles, controller.reject);
router.post('/:id/convert', elevatedRoles, controller.convert);
router.post('/:id/extend-validity', allSalesRoles, controller.extendValidity);
router.post('/:id/proforma', elevatedRoles, controller.saveProforma);
router.post('/:id/proforma-issued', elevatedRoles, controller.markProformaIssued);
router.delete('/:id', elevatedRoles, controller.remove);

// Quotation Follow-ups & Revisions
router.get('/:id/follow-ups', allSalesRoles, controller.listFollowUps);
router.post('/:id/follow-ups', allSalesRoles, controller.scheduleFollowUp);
router.patch('/follow-ups/:id/complete', allSalesRoles, controller.completeFollowUp);
router.post('/follow-ups/:id/actions', allSalesRoles, controller.addFollowUpAction);
router.post('/:id/revise', elevatedRoles, controller.reviseQuotation);

module.exports = router;
