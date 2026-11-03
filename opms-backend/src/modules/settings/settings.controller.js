/**
 * @fileoverview Portal & Workflow Settings HTTP Handlers.
 * @module modules/settings/settings.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const settingsService = require('./settings.service');

exports.getSettings = asyncHandler(async (_req, res) => {
  const data = await settingsService.getPortalSettings();
  res.json({ success: true, data });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.updatePortalSettings(req.body, req.user);
  res.json({ success: true, data, message: 'Portal settings updated successfully' });
});

exports.getWorkflowFlags = asyncHandler(async (_req, res) => {
  const data = await settingsService.getWorkflowFlags();
  res.json({ success: true, data });
});

