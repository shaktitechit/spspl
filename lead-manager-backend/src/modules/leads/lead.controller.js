/**
 * @fileoverview Lead Management HTTP handlers (controllers).
 * @module modules/leads/lead.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const leadService = require('./lead.service');
const followUpService = require('./leadFollowUp.service');
const reportService = require('./leadReport.service');
const validation = require('./lead.validation');

/* ----------------------------------------------------
 * LEADS
 * -------------------------------------------------- */

exports.list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await leadService.list(req.query, req.user) });
});

exports.get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await leadService.get(req.params.id, req.user) });
});

exports.create = asyncHandler(async (req, res) => {
  validation.assertCreate(req.body || {});
  res.status(201).json({
    success: true,
    data: await leadService.create(req.body, req.user),
  });
});

exports.bulkCreate = asyncHandler(async (req, res) => {
  validation.assertBulkCreate(req.body || {});
  res.status(201).json({
    success: true,
    data: await leadService.bulkCreate(req.body, req.user),
  });
});


exports.update = asyncHandler(async (req, res) => {
  validation.assertUpdate(req.body || {});
  res.json({
    success: true,
    data: await leadService.update(req.params.id, req.body, req.user),
  });
});

exports.checkDuplicates = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await leadService.checkDuplicates(req.body || {}),
  });
});

exports.assign = asyncHandler(async (req, res) => {
  validation.assertAssign(req.body || {});
  res.json({
    success: true,
    data: await leadService.assign(req.params.id, req.body, req.user),
  });
});

exports.changeStatus = asyncHandler(async (req, res) => {
  validation.assertStatusChange(req.body || {});
  res.json({
    success: true,
    data: await leadService.changeStatus(req.params.id, req.body, req.user),
  });
});

exports.qualify = asyncHandler(async (req, res) => {
  validation.assertQualify(req.body || {});
  res.json({
    success: true,
    data: await leadService.qualify(req.params.id, req.body, req.user),
  });
});

exports.markLost = asyncHandler(async (req, res) => {
  validation.assertMarkLost(req.body || {});
  res.json({
    success: true,
    data: await leadService.markLost(req.params.id, req.body, req.user),
  });
});

exports.convert = asyncHandler(async (req, res) => {
  validation.assertConvert(req.body || {});
  res.json({
    success: true,
    data: await leadService.convert(req.params.id, req.body, req.user),
  });
});

exports.getTimeline = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await leadService.getTimeline(req.params.id, req.user),
  });
});

exports.remove = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await leadService.remove(req.params.id, req.user),
  });
});

exports.bulkRemove = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await leadService.bulkDelete(req.body.ids || [], req.user),
  });
});

exports.restore = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await leadService.restore(req.params.id, req.user),
  });
});

/* ----------------------------------------------------
 * FOLLOW-UPS
 * -------------------------------------------------- */

exports.listFollowUps = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await followUpService.listForLead(req.params.id, req.user),
  });
});

exports.createFollowUp = asyncHandler(async (req, res) => {
  validation.assertFollowUpCreate(req.body || {});
  res.status(201).json({
    success: true,
    data: await followUpService.createForLead(req.params.id, req.body, req.user),
  });
});

exports.completeFollowUp = asyncHandler(async (req, res) => {
  validation.assertFollowUpComplete(req.body || {});
  res.json({
    success: true,
    data: await followUpService.complete(req.params.followUpId, req.body, req.user),
  });
});

exports.getFollowUpCalendar = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await followUpService.getCalendar(req.query, req.user),
  });
});

exports.getUrgentFollowUpsSummary = asyncHandler(async (req, res) => {
  const timeZone = req.query.tz || 'Asia/Kolkata';
  res.json({
    success: true,
    data: await followUpService.getUrgentSummary(req.user, timeZone),
  });
});

exports.runTodaysFollowUpReminders = asyncHandler(async (req, res) => {
  const { runTodaysFollowUpReminders } = require('../../jobs/followUpDailyReminder');
  const { isLeadAdmin } = require('./lead.service');
  if (!isLeadAdmin(req.user)) {
    return res.status(403).json({ success: false, message: 'Administrators only' });
  }
  const force = req.query.force === '1' || req.query.force === 'true' || req.body?.force === true;
  const data = await runTodaysFollowUpReminders({ force });
  res.json({ success: true, data });
});

exports.runOverdueFollowUpReminders = asyncHandler(async (req, res) => {
  const { runOverdueFollowUpReminders } = require('../../jobs/followUpDailyReminder');
  const { isLeadAdmin } = require('./lead.service');
  if (!isLeadAdmin(req.user)) {
    return res.status(403).json({ success: false, message: 'Administrators only' });
  }
  const force = req.query.force === '1' || req.query.force === 'true' || req.body?.force === true;
  const data = await runOverdueFollowUpReminders({ force });
  res.json({ success: true, data });
});

exports.runAllFollowUpReminders = asyncHandler(async (req, res) => {
  const { runAllFollowUpReminders } = require('../../jobs/followUpDailyReminder');
  const { isLeadAdmin } = require('./lead.service');
  if (!isLeadAdmin(req.user)) {
    return res.status(403).json({ success: false, message: 'Administrators only' });
  }
  const force = req.query.force === '1' || req.query.force === 'true' || req.body?.force === true;
  const data = await runAllFollowUpReminders({ force });
  res.json({ success: true, data });
});

/* ----------------------------------------------------
 * REPORTS & DASHBOARD
 * -------------------------------------------------- */

exports.getDashboardStats = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await reportService.getDashboardStats(req.query, req.user),
  });
});

exports.getSalesFunnel = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await reportService.getSalesFunnel(req.query, req.user),
  });
});

exports.getSalesPerformance = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await reportService.getSalesPerformance(req.query, req.user),
  });
});

exports.getSourcePerformance = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await reportService.getSourcePerformance(req.query, req.user),
  });
});

exports.getMonthlyTrends = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await reportService.getLeadMonthlyTrends(req.query, req.user),
  });
});

exports.getProductBreakdown = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await reportService.getLeadProductBreakdown(req.query, req.user),
  });
});

exports.getFollowUpReport = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await reportService.getFollowUpAnalyticsReport(req.query, req.user),
  });
});
