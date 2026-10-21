/**
 * @fileoverview Work Planner: HTTP handlers (thin controllers).
 * @module modules/workPlanner/workPlanner.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./workPlanner.service');
const validation = require('./workPlanner.validation');

exports.list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.list(req.query, req.user) });
});

exports.stats = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.stats(req.query, req.user) });
});

exports.listAllExpenses = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listAllExpenses(req.query, req.user) });
});

exports.get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.get(req.params.id, req.user) });
});

exports.create = asyncHandler(async (req, res) => {
  validation.assertCreate(req.body || {});
  res.status(201).json({ success: true, data: await service.create(req.body, req.user) });
});

exports.update = asyncHandler(async (req, res) => {
  validation.assertUpdate(req.body || {});
  res.json({ success: true, data: await service.update(req.params.id, req.body, req.user) });
});

exports.remove = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.remove(req.params.id, req.user) });
});

exports.submit = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.submit(req.params.id, req.user, req.body || {}) });
});

exports.approve = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.approve(req.params.id, req.user) });
});

exports.reject = asyncHandler(async (req, res) => {
  validation.assertReject(req.body || {});
  res.json({ success: true, data: await service.reject(req.params.id, req.body, req.user) });
});

exports.complete = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.completePlan(req.params.id, req.user, req.body) });
});

exports.getDayEndDraft = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getDayEndDraft(req.params.id, req.user) });
});

exports.getEligibleManagers = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getEligibleManagers(req.user) });
});


exports.addStandaloneVisit = asyncHandler(async (req, res) => {
  validation.assertVisitCreate(req.body || {});
  res.status(201).json({
    success: true,
    data: await service.addStandaloneVisit(req.body, req.user),
  });
});

exports.updateStandaloneVisit = asyncHandler(async (req, res) => {
  validation.assertVisitUpdate(req.body || {});
  res.json({
    success: true,
    data: await service.updateStandaloneVisit(req.params.visitId, req.body, req.user),
  });
});

exports.removeStandaloneVisit = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.removeStandaloneVisit(req.params.visitId, req.user),
  });
});

exports.addStandaloneWork = asyncHandler(async (req, res) => {
  validation.assertWorkCreate(req.body || {});
  res.status(201).json({
    success: true,
    data: await service.addStandaloneWork(req.body, req.user),
  });
});

exports.updateStandaloneWork = asyncHandler(async (req, res) => {
  validation.assertWorkUpdate(req.body || {});
  res.json({
    success: true,
    data: await service.updateStandaloneWork(req.params.workId, req.body, req.user),
  });
});

exports.removeStandaloneWork = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.removeStandaloneWork(req.params.workId, req.user),
  });
});

exports.addVisit = asyncHandler(async (req, res) => {
  validation.assertVisitCreate(req.body || {});
  res.status(201).json({
    success: true,
    data: await service.addVisit(req.params.id, req.body, req.user),
  });
});

exports.updateVisit = asyncHandler(async (req, res) => {
  validation.assertVisitUpdate(req.body || {});
  res.json({
    success: true,
    data: await service.updateVisit(req.params.id, req.params.visitId, req.body, req.user),
  });
});

exports.removeVisit = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.removeVisit(req.params.id, req.params.visitId, req.user),
  });
});

exports.addWork = asyncHandler(async (req, res) => {
  validation.assertWorkCreate(req.body || {});
  res.status(201).json({
    success: true,
    data: await service.addWork(req.params.id, req.body, req.user),
  });
});

exports.updateWork = asyncHandler(async (req, res) => {
  validation.assertWorkUpdate(req.body || {});
  res.json({
    success: true,
    data: await service.updateWork(req.params.id, req.params.workId, req.body, req.user),
  });
});

exports.removeWork = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.removeWork(req.params.id, req.params.workId, req.user),
  });
});

exports.checkIn = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.checkIn(req.params.id, req.params.visitId, req.body || {}, req.user),
  });
});

exports.checkOut = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.checkOut(req.params.id, req.params.visitId, req.body || {}, req.user),
  });
});

exports.completeVisit = asyncHandler(async (req, res) => {
  validation.assertCompleteVisit(req.body || {});
  res.json({
    success: true,
    data: await service.completeVisit(req.params.id, req.params.visitId, req.body, req.user),
  });
});

exports.listExpenses = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.listExpenses(req.params.id, req.user),
  });
});

exports.addExpense = asyncHandler(async (req, res) => {
  validation.assertExpenseCreate(req.body || {});
  res.status(201).json({
    success: true,
    data: await service.addExpense(req.params.id, req.body, req.user),
  });
});

exports.updateExpense = asyncHandler(async (req, res) => {
  validation.assertExpenseUpdate(req.body || {});
  res.json({
    success: true,
    data: await service.updateExpense(
      req.params.id,
      req.params.expenseId,
      req.body,
      req.user,
    ),
  });
});

exports.removeExpense = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.removeExpense(req.params.id, req.params.expenseId, req.user),
  });
});

exports.submitExpense = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.submitExpense(req.params.id, req.params.expenseId, req.user),
  });
});

exports.approveExpense = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.approveExpense(req.params.id, req.params.expenseId, req.user),
  });
});

exports.rejectExpense = asyncHandler(async (req, res) => {
  validation.assertReject(req.body || {});
  res.json({
    success: true,
    data: await service.rejectExpense(
      req.params.id,
      req.params.expenseId,
      req.body,
      req.user,
    ),
  });
});

exports.submitAllExpenses = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.submitAllExpenses(req.params.id, req.user),
  });
});

exports.approveAllExpenses = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.approveAllExpenses(req.params.id, req.user),
  });
});

exports.rejectAllExpenses = asyncHandler(async (req, res) => {
  validation.assertReject(req.body || {});
  res.json({
    success: true,
    data: await service.rejectAllExpenses(req.params.id, req.body, req.user),
  });
});

exports.uploadExpenseReceipt = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No document file uploaded');
  }
  const { uploadMulterFile } = require('../../services/fileManagement');
  const attachment = await uploadMulterFile(
    req.file,
    'work_plan_expense',
    req.body.plan_id || 'expense'
  );
  res.status(201).json({ success: true, data: attachment });
});

exports.uploadAttachment = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No file uploaded');
  }
  const { uploadMulterFile } = require('../../services/fileManagement');
  const attachment = await uploadMulterFile(
    req.file,
    'work_plan_day_end',
    req.body.resourceId || req.body.plan_id || null
  );
  res.status(201).json({ success: true, data: attachment });
});

exports.viewAttachment = asyncHandler(async (req, res) => {
  const { streamFileToResponse } = require('../../services/fileManagement');
  const identifier = req.params.attachmentId || req.params.fileId;
  await streamFileToResponse(identifier, res, { disposition: 'inline' });
});

exports.previewAttachment = asyncHandler(async (req, res) => {
  const { streamFileToResponse } = require('../../services/fileManagement');
  const identifier = req.params.attachmentId || req.params.fileId;
  await streamFileToResponse(identifier, res, { disposition: 'inline' });
});

exports.downloadAttachment = asyncHandler(async (req, res) => {
  const { streamFileToResponse } = require('../../services/fileManagement');
  const identifier = req.params.attachmentId || req.params.fileId;
  await streamFileToResponse(identifier, res, { disposition: 'attachment' });
});

exports.getUserSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getUserSettings(req.params.userId, req.user) });
});

exports.updateUserSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateUserSettings(req.params.userId, req.body || {}, req.user) });
});

exports.addWorkPlanAuthorityRemark = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.addWorkPlanAuthorityRemark(req.params.id, req.body || {}, req.user),
  });
});

exports.addVisitAuthorityRemark = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.addVisitAuthorityRemark(req.params.id, req.params.visitId, req.body || {}, req.user),
  });
});

exports.addWorkAuthorityRemark = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.addWorkAuthorityRemark(req.params.id, req.params.workId, req.body || {}, req.user),
  });
});

exports.addExpenseAuthorityRemark = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.addExpenseAuthorityRemark(req.params.id, req.params.expenseId, req.body || {}, req.user),
  });
});

exports.getDraft = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.getWorkPlanDraft(req.query || {}, req.user),
  });
});

exports.saveDraft = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.saveWorkPlanDraft(req.body || {}, req.user),
  });
});

exports.deleteDraft = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.deleteWorkPlanDraft(req.query || {}, req.user),
  });
});

exports.getSeniorRemarks = asyncHandler(async (req, res) => {
  const result = await service.getSeniorRemarksFeed(req.query || {}, req.user);
  res.json({
    success: true,
    data: result.items,
    stats: result.stats,
  });
});

exports.addJuniorFollowup = asyncHandler(async (req, res) => {
  const result = await service.addJuniorFollowup(req.body || {}, req.user);
  res.json({
    success: true,
    data: result.remark,
  });
});

exports.updateSeniorRemarkStatus = asyncHandler(async (req, res) => {
  const result = await service.updateSeniorRemarkStatus(req.body || {}, req.user);
  res.json({
    success: true,
    data: result.remark,
  });
});

