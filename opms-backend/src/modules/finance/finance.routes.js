/**
 * @fileoverview Finance: Express router mounts + RBAC wrappers.
 * @module modules/finance/finance.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const controller = require('./finance.controller');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.get('/queue', controller.queue);
router.get('/summary', controller.summary);

module.exports = router;
