/**
 * @fileoverview Controller for User Task Catalogs & Visit Templates.
 * @module modules/workPlanner/userTemplate.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const userTemplateService = require('./userTemplate.service');

// ==========================================
// USER TASKS
// ==========================================

exports.getUserTasks = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const result = await userTemplateService.getUserTasks(userId, req.user);
  res.json({
    success: true,
    data: result,
  });
});

exports.updateUserTasks = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const result = await userTemplateService.updateUserTasks(userId, req.body, req.user);
  res.json({
    success: true,
    message: 'User task templates updated successfully',
    data: result,
  });
});

exports.getUserTasksSummary = asyncHandler(async (req, res) => {
  const result = await userTemplateService.getUserTasksSummary(req.user);
  res.json({
    success: true,
    data: result,
  });
});

// ==========================================
// USER VISIT TEMPLATE
// ==========================================

exports.getUserVisitTemplate = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const result = await userTemplateService.getUserVisitTemplate(userId, req.user);
  res.json({
    success: true,
    data: result,
  });
});

exports.updateUserVisitTemplate = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const result = await userTemplateService.updateUserVisitTemplate(userId, req.body, req.user);
  res.json({
    success: true,
    message: 'User visit template updated successfully',
    data: result,
  });
});

exports.getUserVisitTemplatesSummary = asyncHandler(async (req, res) => {
  const result = await userTemplateService.getUserVisitTemplatesSummary(req.user);
  res.json({
    success: true,
    data: result,
  });
});
