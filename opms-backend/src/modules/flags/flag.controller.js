/**
 * @fileoverview Flags: HTTP handlers (thin controllers).
 * @module modules/flags/flag.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./flag.service');
const validation = require('./flag.validation');

exports.listMembers = asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  res.json({ success: true, data: await service.listOpmsMembers(token) });
});

exports.list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.list(req.query, req.user) });
});

exports.get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.get(req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  validation.assertCreate(req.body || {});
  res.status(201).json({ success: true, data: await service.create(req.body, req.user) });
});

exports.patch = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.patch(req.params.id, req.body, req.user) });
});

exports.listMessages = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listMessages(req.params.id, req.user) });
});

exports.createMessage = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await service.createMessage(req.params.id, req.body || {}, req.user) });
});

exports.uploadChatFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'File is required' });
  }
  res.status(201).json({
    success: true,
    data: await service.uploadChatFile(req.params.id, req.file, req.user),
  });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, resolution_note } = req.body || {};
  if (!status) {
    return res.status(400).json({ success: false, message: 'status is required' });
  }
  res.json({ success: true, data: await service.updateStatus(req.params.id, status, resolution_note, req.user) });
});
