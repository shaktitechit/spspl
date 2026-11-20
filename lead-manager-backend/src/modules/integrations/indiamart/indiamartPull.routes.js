/**
 * @fileoverview Express Router for IndiaMART Pull Integration.
 * @module modules/integrations/indiamart/indiamartPull.routes
 */
const express = require('express');
const controller = require('./indiamartPull.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');
const { requireLeadManagerAccess } = require('../../../middlewares/leadManagerAuth.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/status', controller.getStatus);
router.post('/pull', requireLeadManagerAccess, controller.triggerPull);
router.get('/logs', requireLeadManagerAccess, controller.getLogs);

module.exports = router;
