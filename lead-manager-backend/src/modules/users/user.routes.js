/**
 * @fileoverview GET /api/users — portal roster (before auth-service proxy).
 */
const express = require('express');
const userController = require('./user.controller');
const { requireLeadManagerAccess } = require('../../middlewares/leadManagerAuth.middleware');

const router = express.Router();

router.use(requireLeadManagerAccess);
router.get('/', userController.listRoster);

module.exports = router;
