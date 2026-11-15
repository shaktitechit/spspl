/**
 * @fileoverview Router for `/api/auto-emails` (follow-up email reminders & automation).
 * @module modules/auto_emails/autoEmail.routes
 */
const express = require('express');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireLeadManagerAccess } = require('../../middlewares/leadManagerAuth.middleware');
const controller = require('./autoEmail.controller');

const router = express.Router();

router.post('/reminders/run', requireAuth, requireLeadManagerAccess, controller.runAllFollowUpReminders);
router.post('/reminders/today', requireAuth, requireLeadManagerAccess, controller.runTodaysFollowUpReminders);
router.post('/reminders/overdue', requireAuth, requireLeadManagerAccess, controller.runOverdueFollowUpReminders);

module.exports = router;
