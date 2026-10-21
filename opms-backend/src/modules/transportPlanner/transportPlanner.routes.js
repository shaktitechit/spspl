/**
 * @fileoverview Transport Planner: Express router mounts.
 * @module modules/transportPlanner/transportPlanner.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const controller = require('./transportPlanner.controller');
const { ensureTransportPlanOrderIndexes } = require('./transportPlanner.indexes');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.use(async (_req, _res, next) => {
  try {
    await ensureTransportPlanOrderIndexes();
  } catch (_) {
    // Index ensure is best-effort; request handlers still run.
  }
  next();
});

router.get('/', controller.list);
router.get('/stats', controller.stats);
router.get('/eligible-orders', controller.eligibleOrders);
router.get('/logistics-preview', controller.previewOrderLogistics);
router.post('/', controller.create);

router.get('/:id', controller.get);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

router.post('/:id/submit', controller.submit);
router.post('/:id/complete', controller.complete);
router.post('/:id/cancel', controller.cancel);

router.post('/:id/orders', controller.addOrders);
router.delete('/:id/orders/:planOrderId', controller.removeOrder);
router.post(
  '/:id/orders/:planOrderId/cancel',
  controller.cancelPlanOrder
);

router.patch(
  '/:id/orders/:planOrderId',
  controller.updateDispatchDetails
);
router.post(
  '/:id/orders/:planOrderId/generate-lr',
  controller.generateLr
);
router.post(
  '/:id/orders/:planOrderId/mark-packed',
  controller.markPacked
);
router.post(
  '/:id/orders/:planOrderId/mark-dispatched',
  controller.markDispatched
);
router.post(
  '/:id/orders/:planOrderId/mark-delivered',
  controller.markDelivered
);

module.exports = router;
