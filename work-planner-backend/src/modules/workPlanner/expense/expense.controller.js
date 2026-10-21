/**
 * @fileoverview Request controllers for Expense domain: Claims, Advances, Settlements, Balances, and Passbook.
 * @module modules/workPlanner/expense/expense.controller
 */

const advanceService = require('./advance.service');
const settlementService = require('./settlement.service');
const passbookService = require('./passbook.service');
const { logger } = require('../../../utils/logger');

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

// 1. KPI Summary
async function getExpenseKpiSummary(req, res) {
  try {
    const data = await passbookService.getExpenseKpiSummary(req.query, getActor(req));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'Failed to fetch expense KPIs');
  }
}

// 2. Advances
async function listAdvances(req, res) {
  try {
    const result = await advanceService.listAdvances(req.query, getActor(req));
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err, 'Failed to list tour advances');
  }
}

async function requestAdvance(req, res) {
  try {
    const data = await advanceService.requestAdvance(req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Tour advance requested successfully.' }, 201);
  } catch (err) {
    return handleError(res, err, 'Failed to request tour advance');
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
    return handleSuccess(res, { data, message: 'Tour advance refund accepted successfully.' });
  } catch (err) {
    return handleError(res, err, 'Failed to accept tour advance refund');
  }
}

async function getActiveAdvances(req, res) {
  try {
    const targetUserId = req.params.userId || req.query.userId || req.query.user_id;
    const data = await advanceService.getActiveAdvances(targetUserId, getActor(req));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'Failed to fetch active advances');
  }
}

// 3. Settlements
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
    const data = await settlementService.getSettlement(req.params.id, getActor(req));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'Failed to get settlement voucher');
  }
}

async function createSettlement(req, res) {
  try {
    const data = await settlementService.createSettlement(req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Expense settlement voucher generated successfully.' }, 201);
  } catch (err) {
    return handleError(res, err, 'Failed to create expense settlement');
  }
}

// 4. Balances & Passbook
async function getExecutiveBalances(req, res) {
  try {
    const result = await passbookService.getExecutiveBalances(req.query, getActor(req));
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err, 'Failed to fetch executive balances');
  }
}

async function getExecutivePassbook(req, res) {
  try {
    const requestedUserId =
      !req.params.userId || req.params.userId === 'me' || req.params.userId === 'null' || req.params.userId === 'undefined'
        ? req.user?._id
        : req.params.userId;
    const data = await passbookService.getExecutivePassbook(requestedUserId, req.query, getActor(req));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'Failed to fetch executive passbook');
  }
}

// 5. File Uploads (Supports receipts, disbursement proofs, refund slips, settlement documents)
async function uploadExpenseFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const { uploadMulterFile } = require('../../../services/fileManagement');
    const resourceType = req.body.resourceType || req.body.resource_type || 'work_plan_expense';
    const resourceId = req.body.resourceId || req.body.resource_id || req.body.advance_id || req.body.settlement_id || null;

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
        url: `/api/work-planner/attachments/${attachment._id}/preview`,
      },
    });
  } catch (err) {
    return handleError(res, err, 'Failed to upload expense file');
  }
}

async function issueDirectAdvance(req, res) {
  try {
    const data = await advanceService.issueDirectAdvance(req.body, getActor(req));
    return handleSuccess(res, { data, message: 'Tour advance issued and disbursed directly to executive.' }, 201);
  } catch (err) {
    return handleError(res, err, 'Failed to issue direct tour advance');
  }
}

module.exports = {
  getExpenseKpiSummary,
  listAdvances,
  requestAdvance,
  issueDirectAdvance,
  approveAdvance,
  rejectAdvance,
  disburseAdvance,
  refundAdvance,
  getActiveAdvances,
  listSettlements,
  getSettlement,
  createSettlement,
  getExecutiveBalances,
  getExecutivePassbook,
  uploadExpenseFile,
};
