/**
 * @fileoverview Quotation Analytics & Reports Controller.
 * @module modules/quotations/quotationReports.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const quotationReportsService = require('./quotationReports.service');

exports.getSummaryReport = asyncHandler(async (req, res) => {
  const data = await quotationReportsService.getQuotationSummaryReport(req.query, req.user);
  res.json({
    success: true,
    data,
  });
});

exports.getSalesPerformance = asyncHandler(async (req, res) => {
  const data = await quotationReportsService.getQuotationSalesPerformance(req.query, req.user);
  res.json({
    success: true,
    data,
  });
});

exports.getMonthlyTrends = asyncHandler(async (req, res) => {
  const data = await quotationReportsService.getQuotationMonthlyTrends(req.query, req.user);
  res.json({
    success: true,
    data,
  });
});

exports.getProductBreakdown = asyncHandler(async (req, res) => {
  const data = await quotationReportsService.getQuotationProductBreakdown(req.query, req.user);
  res.json({
    success: true,
    data,
  });
});

exports.getConversionFunnel = asyncHandler(async (req, res) => {
  const data = await quotationReportsService.getQuotationConversionFunnel(req.query, req.user);
  res.json({
    success: true,
    data,
  });
});
