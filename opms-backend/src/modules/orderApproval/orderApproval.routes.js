/**
 * @fileoverview Unified order approval routes.
 * @module modules/orderApproval/orderApproval.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const controller = require('./orderApproval.controller');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.get('/deleted', controller.listDeleted);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.get);
router.patch(
  '/:id/super-sheet',
  controller.superSheetUpdate,
);
router.patch('/:id', controller.patch);
router.post('/:id/approve', controller.approve);
router.post('/:id/reject', controller.reject);
router.post('/:id/send-to-finance', controller.sendToFinance);
router.post('/:id/send-to-account', controller.sendToAccount);
router.post('/:id/finance-amend', controller.amendByFinance);
router.post('/:id/amend', controller.amend);
router.post(
  '/:id/resolve-dispatch',
  controller.resolvePartialDispatch,
);
router.delete('/:id', controller.softDelete);
router.post('/:id/restore', controller.restore);

module.exports = router;
