/**
 * @fileoverview Flags: Express router mounts + RBAC wrappers.
 * @module modules/flags/flag.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const { uploadMiddleware } = require('../../middlewares/upload.middleware');
const controller = require('./flag.controller');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.get('/members', controller.listMembers);
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.patch('/:id', controller.patch);

// Chat loop messages, file uploads & status transitions
router.get('/:id/messages', controller.listMessages);
router.post('/:id/messages', controller.createMessage);
router.post('/:id/upload', uploadMiddleware().single('file'), controller.uploadChatFile);
router.patch('/:id/status', controller.updateStatus);

module.exports = router;
