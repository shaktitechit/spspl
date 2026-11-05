/**
 * @fileoverview Controller for Work Planner Portal Global Settings & Policies API endpoints.
 * @module modules/workPlanner/portalSettings.controller
 */
const portalSettingsService = require('./portalSettings.service');
const asyncHandler = require('../../utils/asyncHandler');

const getPortalSettings = asyncHandler(async (req, res) => {
  const companyId = req.user?.company_id || null;
  const settings = await portalSettingsService.getSettings(companyId);
  res.json({
    success: true,
    data: settings,
  });
});

const updatePortalSettings = asyncHandler(async (req, res) => {
  const updated = await portalSettingsService.updateSettings(req.body, req.user);
  res.json({
    success: true,
    message: 'Portal governance policies updated successfully',
    data: updated,
  });
});

const resetPortalSettings = asyncHandler(async (req, res) => {
  const reset = await portalSettingsService.resetSettings(req.user);
  res.json({
    success: true,
    message: 'Portal policies reset to system defaults',
    data: reset,
  });
});

module.exports = {
  getPortalSettings,
  updatePortalSettings,
  resetPortalSettings,
};

