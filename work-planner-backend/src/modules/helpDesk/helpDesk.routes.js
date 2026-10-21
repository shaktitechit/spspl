/**
 * @fileoverview Express router for Help Desk module with authentication.
 * @module modules/helpDesk/helpDesk.routes
 */

const { Router } = require('express');
const router = Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const controller = require('./helpDesk.controller');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// Attachment streaming & previews (supports ?token= or Authorization header)
router.get('/attachments/:attachmentId/preview', controller.previewAttachment);
router.get('/attachments/:attachmentId/view', controller.viewAttachment);
router.get('/attachments/:attachmentId/download', controller.downloadAttachment);
router.get('/files/:fileId/preview', controller.previewAttachment);
router.get('/files/:fileId/download', controller.downloadAttachment);

router.use(requireAuth);

// File uploads
router.post('/attachments/upload', upload.single('file'), controller.uploadAttachment);

// KPI Stats
router.get('/stats', controller.getHelpDeskStats);

// User directory for tagging collaborators
router.get('/users', controller.listUsers);

// Ticket CRUD & Lifecycle
router.get('/tickets', controller.listTickets);
router.post('/tickets', controller.createTicket);
router.get('/tickets/:id', controller.getTicketById);
router.post('/tickets/:id/read', controller.markTicketAsRead);

// Replies & Collaboration
router.post('/tickets/:id/replies', controller.addReply);
router.post('/tickets/:id/tag-users', controller.tagUsers);

// Lifecycle Transitions
router.post('/tickets/:id/acknowledge', controller.acknowledgeTicket);
router.post('/tickets/:id/propose-solution', controller.proposeSolution);
router.post('/tickets/:id/resolve', controller.resolveTicket); // Creator only
router.post('/tickets/:id/reopen', controller.reopenTicket); // Creator only
router.post('/tickets/:id/cancel', controller.cancelTicket); // Creator only

module.exports = router;

