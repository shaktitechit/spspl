/**
 * @fileoverview Order dispatch routes.
 * @module modules/dispatch/dispatch.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const { uploadMiddleware } = require('../../middlewares/upload.middleware');
const controller = require('./dispatch.controller');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.get('/deleted', controller.listDeleted);
router.get('/', controller.list);
router.delete('/:id', controller.softDelete);
router.post('/:id/restore', controller.restore);
router.get('/:id', controller.get);
router.post(
  '/',
  uploadMiddleware().single('bill_document'),
  controller.create,
);
router.patch('/:id', controller.patch);

module.exports = router;
