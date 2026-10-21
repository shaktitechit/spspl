/**
 * @fileoverview Attachment Routes for lead-manager-backend.
 * @module modules/attachments/attachment.routes
 */
const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireLeadManagerAccess } = require('../../middlewares/leadManagerAuth.middleware');
const controller = require('./attachment.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const router = express.Router();

router.use(requireAuth);
router.use(requireLeadManagerAccess);

router.get('/', controller.list);
router.get('/deleted', controller.listDeleted);
router.get('/:id', controller.getById);
router.post('/', upload.single('file'), controller.create);
router.delete('/:id', controller.remove);
router.post('/:id/restore', controller.restore);

module.exports = router;
