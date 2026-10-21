/**
 * @fileoverview Order due sheet routes.
 * @module modules/orderDueSheet/orderDueSheet.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const { uploadMiddleware } = require('../../middlewares/upload.middleware');
const controller = require('./orderDueSheet.controller');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.get(
  '/deleted',
  controller.listDeleted,
);
router.get('/order/:orderId/current', controller.getCurrentByOrder);
router.get('/', controller.list);
router.get('/:id', controller.get);

router.post(
  '/',
  uploadMiddleware().single('document'),
  controller.create,
);
router.patch('/:id', controller.patch);
router.post(
  '/:id/document',
  uploadMiddleware().single('document'),
  controller.replaceDocument,
);

router.delete(
  '/:id',
  controller.softDelete,
);
router.post(
  '/:id/restore',
  controller.restore,
);

module.exports = router;
