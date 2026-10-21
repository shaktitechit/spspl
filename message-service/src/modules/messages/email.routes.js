/**
 * @fileoverview Email routes mapping endpoints to email.controller.js.
 * @module modules/messages/email.routes
 */
const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const controller = require('./email.controller');

// Google OAuth endpoints (Callback must be accessible from OAuth redirect)
router.get('/google/auth', controller.getGoogleAuth);
router.get('/google/callback', controller.googleCallback);

// Protected routes
router.post('/', requireAuth, controller.sendEmail);
router.get('/', requireAuth, controller.listEmails);
router.get('/accounts', requireAuth, controller.listAccounts);
router.delete('/accounts/:id', requireAuth, controller.deleteAccount);
router.get('/:id', requireAuth, controller.getEmailById);

module.exports = router;
