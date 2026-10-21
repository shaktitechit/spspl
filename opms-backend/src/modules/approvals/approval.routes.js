/**
 * @fileoverview Approvals: Express router mounts + RBAC wrappers.
 * @module modules/approvals/approval.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const controller = require('./approval.controller');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.get('/', controller.list);

module.exports = router;
