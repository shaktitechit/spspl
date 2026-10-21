/**
 * @fileoverview Controller for TermsAndConditions and TermsText in lead-manager-backend.
 * @module modules/terms_and_conditions/terms_and_conditions.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const termsService = require('./terms_and_conditions.service');

exports.create = asyncHandler(async (req, res) => {
  const result = await termsService.createTermsAndConditions(req.body, req.user);
  res.status(201).json({ success: true, data: result });
});

exports.list = asyncHandler(async (req, res) => {
  const result = await termsService.listTermsAndConditions(req.query, req.user);
  res.json({ success: true, ...result });
});

exports.getById = asyncHandler(async (req, res) => {
  const result = await termsService.getTermsAndConditionsById(req.params.id, req.user);
  res.json({ success: true, data: result });
});

exports.update = asyncHandler(async (req, res) => {
  const result = await termsService.updateTermsAndConditions(req.params.id, req.body, req.user);
  res.json({ success: true, data: result });
});

exports.remove = asyncHandler(async (req, res) => {
  const result = await termsService.deleteTermsAndConditions(req.params.id, req.user);
  res.json({ success: true, ...result });
});

exports.addText = asyncHandler(async (req, res) => {
  const result = await termsService.addTermsText(req.params.id, req.body, req.user);
  res.status(201).json({ success: true, data: result });
});

exports.updateText = asyncHandler(async (req, res) => {
  const result = await termsService.updateTermsText(req.params.textId, req.body, req.user);
  res.json({ success: true, data: result });
});

exports.deleteText = asyncHandler(async (req, res) => {
  const result = await termsService.deleteTermsText(req.params.textId, req.user);
  res.json({ success: true, ...result });
});

exports.getDefault = asyncHandler(async (req, res) => {
  const type = req.query.type || 'quotation';
  const result = await termsService.getDefaultTermsByType(type);
  res.json({ success: true, data: result });
});
