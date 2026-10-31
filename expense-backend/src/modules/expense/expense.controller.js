/**
 * @fileoverview Request controller for Expense Portal: Claims, Advances, Ledgers, Settlements, Directory.
 * @module modules/expense/expense.controller
 */
const claimService = require('./expenseClaim.service');
const advanceService = require('./advance.service');
const settlementService = require('./settlement.service');
const passbookService = require('./passbook.service');
const userDirectoryService = require('../workPlannerUserDirectory.service');
const { logger } = require('../../utils/logger');

function getActor(req) {
  return req.user;
}

function handleSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

function handleError(res, err, defaultMsg = 'Expense operation failed') {
  logger.error(`[ExpenseController] ${err.message}`, { stack: err.stack });
  const statusCode = err.status || (err.name === 'ValidationError' ? 400 : 500);
  return res.status(statusCode).json({
    success: false,
    message: err.message || defaultMsg,
    error: err.message,
  });
}

// 1. Work Planner Users Directory
async function listWorkPlannerUsers(req, res) {
  try {
    const result = await userDirectoryService.listWorkPlannerUsersWithFinancials(req.query);
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err, 'Failed to fetch Work Planner users');
  }
}

// 2. KPI Summary
async function getExpenseKpiSummary(req, res) {
  try {
    const data = await passbookService.getExpenseKpiSummary(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'Failed to fetch expense KPIs');
  }
}

// 3. Expense Claims
async function listExpenses(req, res) {
  try {
    const result = await claimService.listExpenses(req.query, getActor(req));
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err, 'Failed to list expenses');
  }
}

async function getExpenseById(req, res) {
  try {
    const data = await claimService.getExpenseById(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'Failed to get expense claim');
  }
}

async function createExpense(req, res) {
  try {
    const data = await claimService.createExpense(req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Expense claim logged successfully.' }, 201);
  } catch (err) {
    return handleError(res, err, 'Failed to create expense claim');
  }
}

async function approveExpense(req, res) {
  try {
    const data = await claimService.approveExpense(req.params.id, req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Expense claim approved.' });
  } catch (err) {
    return handleError(res, err, 'Failed to approve expense claim');
  }
}

async function bulkApproveExpenses(req, res) {
  try {
    const expenseIds = req.body.expense_ids || req.body.ids;
    const result = await claimService.bulkApproveExpenses(expenseIds, req.body, getActor(req));
    return handleSuccess(res, { ...result, message: 'Bulk approval processed.' });
  } catch (err) {
    return handleError(res, err, 'Failed to bulk approve expenses');
  }
}

async function rejectExpense(req, res) {
  try {
    const data = await claimService.rejectExpense(req.params.id, req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Expense claim rejected.' });
  } catch (err) {
    return handleError(res, err, 'Failed to reject expense claim');
  }
}

async function addExpenseAuthorityRemark(req, res) {
  try {
    const data = await claimService.addExpenseAuthorityRemark(req.params.id, req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Directive / Remark recorded successfully.' });
  } catch (err) {
    return handleError(res, err, 'Failed to add remark to expense claim');
  }
}

async function updateExpenseRemarkStatus(req, res) {
  try {
    const data = await claimService.updateExpenseRemarkStatus(req.params.id, req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Objection / Directive status updated successfully.' });
  } catch (err) {
    return handleError(res, err, 'Failed to update remark status');
  }
}

// 4. Advances
async function listAdvances(req, res) {
  try {
    const result = await advanceService.listAdvances(req.query, getActor(req));
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err, 'Failed to list advances');
  }
}

async function createAdvance(req, res) {
  try {
    const data = await advanceService.createAdvance(req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Advance request created successfully.' }, 201);
  } catch (err) {
    return handleError(res, err, 'Failed to create advance request');
  }
}

async function approveAdvance(req, res) {
  try {
    const data = await advanceService.approveAdvance(req.params.id, getActor(req));
    return handleSuccess(res, { data, message: 'Tour advance approved.' });
  } catch (err) {
    return handleError(res, err, 'Failed to approve tour advance');
  }
}

async function rejectAdvance(req, res) {
  try {
    const data = await advanceService.rejectAdvance(req.params.id, req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Tour advance rejected.' });
  } catch (err) {
    return handleError(res, err, 'Failed to reject tour advance');
  }
}

async function disburseAdvance(req, res) {
  try {
    const data = await advanceService.disburseAdvance(req.params.id, req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Tour advance disbursed successfully.' });
  } catch (err) {
    return handleError(res, err, 'Failed to disburse tour advance');
  }
}

async function refundAdvance(req, res) {
  try {
    const data = await advanceService.refundAdvance(req.params.id, req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Tour advance refund recorded successfully.' });
  } catch (err) {
    return handleError(res, err, 'Failed to record tour advance refund');
  }
}

async function getActiveAdvances(req, res) {
  try {
    const targetUserId = req.params.userId || req.query.userId || req.query.user_id;
    const data = await advanceService.getActiveAdvances(targetUserId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'Failed to fetch active advances');
  }
}

// 5. Settlements
async function listSettlements(req, res) {
  try {
    const result = await settlementService.listSettlements(req.query, getActor(req));
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err, 'Failed to list settlements');
  }
}

async function getSettlement(req, res) {
  try {
    const data = await settlementService.getSettlement(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'Failed to get settlement voucher');
  }
}

async function createSettlement(req, res) {
  try {
    const data = await settlementService.createSettlement(req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Expense settlement voucher processed successfully.' }, 201);
  } catch (err) {
    return handleError(res, err, 'Failed to process expense settlement');
  }
}

async function recordPaymentEntry(req, res) {
  try {
    const data = await settlementService.recordPaymentEntry(req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Payment entry recorded successfully.' }, 201);
  } catch (err) {
    return handleError(res, err, 'Failed to record payment entry');
  }
}

async function getActivePaymentEntries(req, res) {
  try {
    const targetUserId = req.params.userId || req.query.userId || req.query.user_id || req.query.sales_user;
    const data = await settlementService.getActivePaymentEntries(targetUserId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'Failed to fetch active payment entries');
  }
}

// 6. Balances & Passbook
async function getExecutiveBalances(req, res) {
  try {
    const result = await passbookService.getExecutiveBalances(req.query);
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err, 'Failed to fetch executive balances');
  }
}

async function getExecutivePassbook(req, res) {
  try {
    const candidateId = req.params.userId || req.query.userId || req.query.user_id;
    const requestedUserId =
      !candidateId || candidateId === 'me' || candidateId === 'null' || candidateId === 'undefined'
        ? req.user?._id
        : candidateId;
    const data = await passbookService.getExecutivePassbook(requestedUserId, req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'Failed to fetch executive passbook');
  }
}

// 7. File Uploads
async function uploadExpenseFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const { uploadMulterFile } = require('../../services/fileManagement');
    const resourceType = req.body.resourceType || req.body.resource_type || 'expense';
    const resourceId = req.body.resourceId || req.body.resource_id || null;

    const attachment = await uploadMulterFile(req.file, resourceType, resourceId);

    return res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        _id: attachment._id,
        attachment_id: attachment._id,
        file_id: attachment.filename || attachment._id,
        filename: attachment.filename,
        original_name: attachment.original_name || attachment.file_name || req.file.originalname,
        mime_type: attachment.mime_type || req.file.mimetype,
        size: attachment.size || req.file.size,
        url: `/api/attachments/${attachment._id}/preview`,
      },
    });
  } catch (err) {
    return handleError(res, err, 'Failed to upload expense file');
  }
}

module.exports = {
  listWorkPlannerUsers,
  getExpenseKpiSummary,
  listExpenses,
  getExpenseById,
  createExpense,
  approveExpense,
  bulkApproveExpenses,
  rejectExpense,
  addExpenseAuthorityRemark,
  updateExpenseRemarkStatus,
  listAdvances,
  createAdvance,
  approveAdvance,
  rejectAdvance,
  disburseAdvance,
  refundAdvance,
  getActiveAdvances,
  listSettlements,
  getSettlement,
  createSettlement,
  recordPaymentEntry,
  getActivePaymentEntries,
  getExecutiveBalances,
  getExecutivePassbook,
  uploadExpenseFile,
};

