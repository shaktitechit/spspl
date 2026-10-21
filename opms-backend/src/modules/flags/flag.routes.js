/**
 * @fileoverview Flags: Express router mounts + RBAC wrappers.
 * @module modules/flags/flag.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const controller = require('./flag.controller');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.patch('/:id', controller.patch);

module.exports = router;
