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

exports.addFollowUpAction = asyncHandler(async (req, res) => {
  const followUpId = req.params.followUpId || req.params.id;
  res.status(201).json({
    success: true,
    data: await followUpService.addAction(followUpId, req.body, req.user),
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
  const scope = req.query.scope || '';
  res.json({
    success: true,
    data: await followUpService.getUrgentSummary(req.user, timeZone, scope),
  });
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
