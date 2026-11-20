/**
 * @fileoverview Express Router for IndiaMART Webhook integration.
 * @module modules/webhooks/indiamart/indiamart.routes
 */
const express = require('express');
const controller = require('./indiamart.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');
const { requireLeadManagerAccess } = require('../../../middlewares/leadManagerAuth.middleware');

const router = express.Router();

/* --- Public Webhook Ingestion & Health Endpoints --- */
router.get('/health', controller.healthCheck);
router.post('/', controller.handlePush);
router.post('/:token', controller.handlePush);

/* --- Admin / Coordinator Audit Endpoint --- */
router.get('/logs', requireAuth, requireLeadManagerAccess, controller.getLogs);

module.exports = router;
