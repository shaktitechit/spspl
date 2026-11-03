/**
 * @fileoverview Portal & Workflow Settings Express Router.
 * @module modules/settings/settings.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess, requireOpmsRole } = require('../../middlewares/opmsAuth.middleware');
const controller = require('./settings.controller');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.get('/portal', controller.getSettings);
router.put('/portal', requireOpmsRole('super_admin'), controller.updateSettings);
router.get('/workflow-flags', controller.getWorkflowFlags);

// Default aliases for convenience:
router.get('/', controller.getSettings);
router.put('/', requireOpmsRole('super_admin'), controller.updateSettings);

module.exports = router;

