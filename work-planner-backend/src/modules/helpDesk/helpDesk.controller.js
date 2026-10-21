/**
 * @fileoverview Express controller for Help Desk endpoints.
 * @module modules/helpDesk/helpDesk.controller
 */

const helpDeskService = require('./helpDesk.service');
const { logger } = require('../../utils/logger');

async function createTicket(req, res) {
  try {
    const ticket = await helpDeskService.createTicket(req.user, req.body);
    return res.status(201).json({
      success: true,
      message: 'Help ticket created successfully and tagged users notified.',
      data: ticket,
    });
  } catch (err) {
    logger.error(`[HelpDeskController] createTicket error: ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function listTickets(req, res) {
  try {
    const result = await helpDeskService.listTickets(req.user, req.query);
    return res.json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: result.pages,
    });
  } catch (err) {
    logger.error(`[HelpDeskController] listTickets error: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getTicketById(req, res) {
  try {
    const ticket = await helpDeskService.getTicketById(req.user, req.params.id);
    return res.json({
      success: true,
      data: ticket,
    });
  } catch (err) {
    logger.error(`[HelpDeskController] getTicketById error: ${err.message}`);
    return res.status(err.message.includes('not found') ? 404 : 400).json({
      success: false,
      message: err.message,
    });
  }
}

async function markTicketAsRead(req, res) {
  try {
    const result = await helpDeskService.markTicketAsRead(req.user, req.params.id);
    return res.json({
      success: true,
      message: 'Ticket and messages marked as read.',
      data: result,
    });
  } catch (err) {
    logger.error(`[HelpDeskController] markTicketAsRead error: ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function addReply(req, res) {
  try {
    const reply = await helpDeskService.addReply(req.user, req.params.id, req.body);
    return res.status(201).json({
      success: true,
      message: 'Reply posted successfully.',
      data: reply,
    });
  } catch (err) {
    logger.error(`[HelpDeskController] addReply error: ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function tagUsers(req, res) {
  try {
    const ticket = await helpDeskService.tagUsers(req.user, req.params.id, req.body);
    return res.json({
      success: true,
      message: 'Collaborators tagged successfully.',
      data: ticket,
    });
  } catch (err) {
    logger.error(`[HelpDeskController] tagUsers error: ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function acknowledgeTicket(req, res) {
  try {
    const ticket = await helpDeskService.acknowledgeTicket(req.user, req.params.id);
    return res.json({
      success: true,
      message: 'Ticket acknowledged and moved to In-Progress.',
      data: ticket,
    });
  } catch (err) {
    logger.error(`[HelpDeskController] acknowledgeTicket error: ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function proposeSolution(req, res) {
  try {
    const ticket = await helpDeskService.proposeSolution(req.user, req.params.id, req.body);
    return res.json({
      success: true,
      message: 'Solution proposed. Creator has been alerted to verify resolution.',
      data: ticket,
    });
  } catch (err) {
    logger.error(`[HelpDeskController] proposeSolution error: ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function resolveTicket(req, res) {
  try {
    const ticket = await helpDeskService.resolveTicket(req.user, req.params.id, req.body);
    return res.json({
      success: true,
      message: 'Ticket successfully resolved and closed by creator.',
      data: ticket,
    });
  } catch (err) {
    logger.error(`[HelpDeskController] resolveTicket error: ${err.message}`);
    return res.status(403).json({ success: false, message: err.message });
  }
}

async function reopenTicket(req, res) {
  try {
    const ticket = await helpDeskService.reopenTicket(req.user, req.params.id, req.body);
    return res.json({
      success: true,
      message: 'Ticket reopened and feedback sent to collaborators.',
      data: ticket,
    });
  } catch (err) {
    logger.error(`[HelpDeskController] reopenTicket error: ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function cancelTicket(req, res) {
  try {
    const ticket = await helpDeskService.cancelTicket(req.user, req.params.id, req.body);
    return res.json({
      success: true,
      message: 'Ticket cancelled.',
      data: ticket,
    });
  } catch (err) {
    logger.error(`[HelpDeskController] cancelTicket error: ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function getHelpDeskStats(req, res) {
  try {
    const stats = await helpDeskService.getHelpDeskStats(req.user);
    return res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    logger.error(`[HelpDeskController] getHelpDeskStats error: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function uploadAttachment(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const { uploadMulterFile } = require('../../services/fileManagement');
    const attachment = await uploadMulterFile(
      req.file,
      'help_desk_ticket',
      req.body.ticket_id || null
    );
    return res.status(201).json({
      success: true,
      message: 'Attachment uploaded successfully',
      data: {
        _id: attachment._id,
        file_id: attachment.filename || attachment._id,
        filename: attachment.filename,
        original_name: attachment.original_name || attachment.file_name || req.file.originalname,
        mime_type: attachment.mime_type || req.file.mimetype,
        size: attachment.size || req.file.size,
        url: `/api/work-planner/attachments/${attachment._id}/preview`,
      },
    });
  } catch (err) {
    logger.error(`[HelpDeskController] uploadAttachment error: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function previewAttachment(req, res) {
  try {
    const { streamFileToResponse } = require('../../services/fileManagement');
    const identifier = req.params.attachmentId || req.params.fileId;
    await streamFileToResponse(identifier, res, { disposition: 'inline' });
  } catch (err) {
    logger.error(`[HelpDeskController] previewAttachment error: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function viewAttachment(req, res) {
  try {
    const { streamFileToResponse } = require('../../services/fileManagement');
    const identifier = req.params.attachmentId || req.params.fileId;
    await streamFileToResponse(identifier, res, { disposition: 'inline' });
  } catch (err) {
    logger.error(`[HelpDeskController] viewAttachment error: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function downloadAttachment(req, res) {
  try {
    const { streamFileToResponse } = require('../../services/fileManagement');
    const identifier = req.params.attachmentId || req.params.fileId;
    await streamFileToResponse(identifier, res, { disposition: 'attachment' });
  } catch (err) {
    logger.error(`[HelpDeskController] downloadAttachment error: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function listUsers(req, res) {
  try {
    const users = await helpDeskService.listUsers(req.user);
    return res.json({ success: true, data: users });
  } catch (err) {
    logger.error(`[HelpDeskController] listUsers error: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  createTicket,
  listTickets,
  getTicketById,
  markTicketAsRead,
  addReply,
  tagUsers,
  acknowledgeTicket,
  proposeSolution,
  resolveTicket,
  reopenTicket,
  cancelTicket,
  getHelpDeskStats,
  uploadAttachment,
  previewAttachment,
  viewAttachment,
  downloadAttachment,
  listUsers,
};

