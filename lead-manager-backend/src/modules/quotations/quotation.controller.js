/**
 * @fileoverview Quotation Controller.
 * @module modules/quotations/quotation.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ApiError } = require('../../utils/ApiError');
const quotationService = require('./quotation.service');
const validation = require('./quotation.validation');

exports.create = asyncHandler(async (req, res) => {
  validation.assertCreate(req.body);
  const data = await quotationService.create(req.params.id || req.body.lead, req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Quotation created successfully',
    data,
  });
});

exports.list = asyncHandler(async (req, res) => {
  if (req.params.id) {
    const data = await quotationService.listByLead(req.params.id, req.user);
    return res.json({
      success: true,
      data,
    });
  }

  const result = await quotationService.listAll(req.query, req.user);
  res.json({
    success: true,
    data: result.quotations,
    pagination: result.pagination,
  });
});

exports.getDashboardStats = asyncHandler(async (req, res) => {
  const data = await quotationService.getDashboardStats(req.query, req.user);
  res.json({
    success: true,
    data,
  });
});

exports.getById = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  const data = await quotationService.getById(quotationId, req.user);
  res.json({
    success: true,
    data,
  });
});

exports.getVersionDetails = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  const version = req.params.version;
  const data = await quotationService.getVersionDetails(quotationId, version, req.user);
  res.json({
    success: true,
    data,
  });
});

exports.compareVersions = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  const { from, to } = req.query;
  const data = await quotationService.compareVersions(quotationId, from, to, req.user);
  res.json({
    success: true,
    data,
  });
});

exports.update = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  validation.assertUpdate(req.body);
  const data = await quotationService.update(quotationId, req.body, req.user);
  res.json({
    success: true,
    message: 'Quotation updated successfully',
    data,
  });
});

exports.linkLead = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  const leadId = req.body.lead_id || req.body.lead || req.params.leadId;
  if (!leadId) {
    throw new ApiError(400, 'lead_id is required');
  }
  validation.assertObjectId(quotationId, 'quotationId');
  validation.assertObjectId(leadId, 'lead_id');
  const data = await quotationService.linkLead(quotationId, leadId, req.user);
  res.json({
    success: true,
    message: 'Quotation linked to lead successfully',
    data,
  });
});

exports.unlinkLead = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  validation.assertObjectId(quotationId, 'quotationId');
  const data = await quotationService.unlinkLead(quotationId, req.user);
  res.json({
    success: true,
    message: 'Quotation unlinked from lead successfully',
    data,
  });
});

exports.getDefaultTerms = asyncHandler(async (req, res) => {
  const data = await quotationService.getDefaultTerms();
  res.json({
    success: true,
    data,
  });
});

exports.remove = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  const data = await quotationService.remove(quotationId, req.user);
  res.json({
    success: true,
    message: 'Quotation deleted successfully',
    data,
  });
});

exports.submitForApproval = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  const data = await quotationService.submitForApproval(quotationId, req.user);
  res.json({
    success: true,
    message: 'Quotation submitted for approval',
    data,
  });
});

exports.approve = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  const data = await quotationService.approve(quotationId, req.user);
  res.json({
    success: true,
    message: 'Quotation approved successfully',
    data,
  });
});

exports.reject = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  const data = await quotationService.reject(quotationId, req.body.reason, req.user);
  res.json({
    success: true,
    message: 'Quotation rejected',
    data,
  });
});

exports.reviseQuotation = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  const data = await quotationService.reviseQuotation(quotationId, req.user);
  res.status(201).json({
    success: true,
    message: 'Quotation revision created successfully',
    data,
  });
});

exports.convert = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  const data = await quotationService.convert(quotationId, req.body, req.user);
  res.json({
    success: true,
    message: 'Quotation converted successfully',
    data,
  });
});

exports.markProformaIssued = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  const data = await quotationService.markProformaIssued(quotationId, req.user);
  res.json({
    success: true,
    message: 'Proforma invoice marked as issued',
    data,
  });
});

exports.saveProforma = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  const data = await quotationService.saveProformaDetails(quotationId, req.body, req.user);
  res.json({
    success: true,
    message: 'Proforma invoice saved successfully',
    data,
  });
});

exports.extendValidity = asyncHandler(async (req, res) => {
  const quotationId = req.params.quotationId || req.params.id;
  const data = await quotationService.extendValidity(quotationId, req.body, req.user);
  res.json({
    success: true,
    message: 'Quotation validity extended successfully',
    data,
  });
});

exports.triggerAutoExpiry = asyncHandler(async (req, res) => {
  const data = await quotationService.autoExpireQuotations();
  res.json({
    success: true,
    message: `Auto-expiry check completed. Expired ${data.count} quotation(s).`,
    data,
  });
});

exports.listPartyOrders = asyncHandler(async (req, res) => {
  const data = await quotationService.listPartyOrders(req.query, req.user);
  res.json({
    success: true,
    data,
  });
});

exports.saveConvertedOrderPerforma = asyncHandler(async (req, res) => {
  const data = await quotationService.saveConvertedOrderPerforma(
    req.params.orderId,
    req.body,
    req.user
  );
  res.json({
    success: true,
    message: 'Order performa updated successfully',
    data,
  });
});

