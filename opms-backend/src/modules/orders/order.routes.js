/**
 * @fileoverview Orders: Express router mounts + RBAC wrappers.
 * @module modules/orders/order.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const controller = require('./order.controller');

// Google Sheets sync webhook (auth via query secret / header — no JWT)
router.post('/google-sheet-webhook', controller.googleSheetWebhook);

router.use(requireAuth);
router.use(requireOpmsAccess);
router.get('/', controller.list);
router.get('/stats', controller.getWorkflowStats);
router.get('/workflow-context', controller.getWorkflowContext);

router.post('/', controller.create);

router.get('/deleted', controller.listDeleted);

router.get('/:id/history', controller.history);
router.get('/:id/fulfillment', controller.fulfillment);
router.get('/:id/approvals', controller.approvals);
router.get('/:id/assignees', controller.assignees);

router.delete('/:id', controller.softDelete);
router.post('/:id/restore', controller.restore);

router.get('/:id', controller.get);

router.patch(
  '/:id/super-sheet',
  controller.superSheetUpdate,
);

router.patch('/:id', controller.update);

router.post('/:id/close-after-full-delivery', controller.closeAfterFullDelivery);

router.post('/:id/submit', controller.submit);
router.post('/:id/transition', controller.transition);

module.exports = router;
