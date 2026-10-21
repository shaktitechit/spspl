/**
 * @fileoverview Express routes for Company Info
 * @module modules/companyInfo/companyInfo.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { ApiError } = require('../../utils/ApiError');
const controller = require('./companyInfo.controller');

// Public: basic company info (name, logo, favicon, contacts) for login page & headers
router.get('/', controller.get);

// Protected routes
router.use(requireAuth);

router.get('/data', controller.getData);
router.put('/', controller.update);
router.patch('/', controller.update);

module.exports = router;
