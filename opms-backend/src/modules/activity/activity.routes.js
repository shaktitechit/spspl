/**
 * @fileoverview Activity: Express router mounts + RBAC wrappers.
 * @module modules/activity/activity.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const controller = require('./activity.controller');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.get('/', controller.list);

module.exports = router;
