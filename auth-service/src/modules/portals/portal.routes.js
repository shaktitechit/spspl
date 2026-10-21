const express = require('express');
const router = express.Router();
const portalController = require('./portal.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

router.get('/', requireAuth, portalController.listPortals);
router.post('/seed', requireAuth, portalController.seedPortals);
router.get('/:id', requireAuth, portalController.getPortal);
router.post('/', requireAuth, portalController.createPortal);
router.put('/:id', requireAuth, portalController.updatePortal);
router.delete('/:id', requireAuth, portalController.deletePortal);

module.exports = router;
