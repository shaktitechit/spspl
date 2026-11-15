/**
 * @fileoverview Auto-Emails & Follow-Up Reminder Controller.
 * @module modules/auto_emails/autoEmail.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const { isLeadAdmin, isLeadManager, isLeadCoordinator } = require('../leads/lead.service');
const autoEmailService = require('./autoEmail.service');

function resolveAuthorizedReminderScope(req) {
  const isAdmin = isLeadAdmin(req.user);
  const canSeeTeam = isAdmin || isLeadManager(req.user) || isLeadCoordinator(req.user);
  const rawScope = String(req.query.scope || req.body?.scope || '').toLowerCase().trim();

  if (rawScope === 'organization' || rawScope === 'all') {
    if (!isAdmin) return { allowed: false, message: 'Administrators only for organization scope' };
    return { allowed: true, scope: 'organization' };
  }
  if (rawScope === 'team') {
    if (!canSeeTeam) return { allowed: false, message: 'Managers or coordinators only for team scope' };
    return { allowed: true, scope: 'team' };
  }
  if (rawScope === 'mine' || rawScope === 'me') {
    return { allowed: true, scope: 'mine' };
  }

  return {
    allowed: true,
    scope: isAdmin ? 'organization' : canSeeTeam ? 'team' : 'mine',
  };
}

exports.runTodaysFollowUpReminders = asyncHandler(async (req, res) => {
  const scopeCheck = resolveAuthorizedReminderScope(req);
  if (!scopeCheck.allowed) {
    return res.status(403).json({ success: false, message: scopeCheck.message });
  }
  const force = req.query.force === '1' || req.query.force === 'true' || req.body?.force === true;
  const data = await autoEmailService.runTodaysFollowUpReminders({
    force,
    scope: scopeCheck.scope,
    actorUser: req.user,
  });
  res.json({ success: true, data });
});

exports.runOverdueFollowUpReminders = asyncHandler(async (req, res) => {
  const scopeCheck = resolveAuthorizedReminderScope(req);
  if (!scopeCheck.allowed) {
    return res.status(403).json({ success: false, message: scopeCheck.message });
  }
  const force = req.query.force === '1' || req.query.force === 'true' || req.body?.force === true;
  const data = await autoEmailService.runOverdueFollowUpReminders({
    force,
    scope: scopeCheck.scope,
    actorUser: req.user,
  });
  res.json({ success: true, data });
});

exports.runAllFollowUpReminders = asyncHandler(async (req, res) => {
  const scopeCheck = resolveAuthorizedReminderScope(req);
  if (!scopeCheck.allowed) {
    return res.status(403).json({ success: false, message: scopeCheck.message });
  }
  const force = req.query.force === '1' || req.query.force === 'true' || req.body?.force === true;
  const data = await autoEmailService.runAllFollowUpReminders({
    force,
    scope: scopeCheck.scope,
    actorUser: req.user,
  });
  res.json({ success: true, data });
});
