/**
 * @fileoverview Domain service for Tour Advances lifecycle management (request, approve, reject, disburse, refund).
 * @module modules/workPlanner/expense/advance.service
 */

const { getModels } = require('../../../data/mongoRegistry');
const {
  isWpAdmin,
  isWpManager,
  isWpElevated,
  startOfDay,
  endOfDay,
} = require('../workPlanner.constants');
const {
  userId,
  asObjectId,
  applySalesUserFilter,
} = require('../teamVisibility.service');
const {
  ApiError,
  toPlain,
  generateSequenceCode,
  assertMakerChecker,
  assertAuthorityOverSalesUser,
} = require('./expense.common');
const {
  notifyTourAdvanceRequested,
  notifyTourAdvanceApproved,
  notifyTourAdvanceRejected,
  notifyTourAdvanceDisbursed,
  notifyTourAdvanceRefunded,
} = require('../workPlannerAutoNotification.service');
const { logger } = require('../../../utils/logger');

function normalizePaymentMethod(method) {
  if (!method) return 'Bank Transfer';
  const norm = String(method).trim().toLowerCase().replace(/_/g, ' ');
  if (norm.includes('upi')) return 'UPI';
  if (norm.includes('bank') || norm.includes('transfer')) return 'Bank Transfer';
  if (norm.includes('cash')) return 'Cash';
  if (norm.includes('cheque') || norm.includes('check')) return 'Cheque';
  if (norm.includes('card')) return 'Corporate Card';
  if (norm.includes('offset')) return 'Advance Offset';
  return 'Bank Transfer';
}

async function listAdvances(query = {}, actor) {
  const { WorkPlanTourAdvance } = getModels();
  const filter = { deletedAt: null };

  await applySalesUserFilter(filter, actor, query);

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }

  const fromDate = query.from_date || query.from || query.start_date;
  const toDate = query.to_date || query.to || query.end_date;
  if (fromDate || toDate) {
    filter.request_date = {};
    if (fromDate) filter.request_date.$gte = startOfDay(fromDate);
    if (toDate) filter.request_date.$lte = endOfDay(toDate);
  }

  const searchParam = query.q || query.search;
  if (searchParam && String(searchParam).trim()) {
    const rgx = new RegExp(String(searchParam).trim(), 'i');
    filter.$or = [
      { advance_number: rgx },
      { purpose: rgx },
      { destination: rgx },
      { notes: rgx },
    ];
  }

  const limit = Math.min(parseInt(query.limit, 10) || 50, 1000);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    WorkPlanTourAdvance.countDocuments(filter),
    WorkPlanTourAdvance.find(filter)
      .populate('sales_user', 'name email department phone')
      .populate('approved_by', 'name email')
      .populate('disbursed_by', 'name email')
      .populate('refunds.accepted_by', 'name email')
      .sort({ request_date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 0,
    data: rows.map(toPlain),
  };
}

async function requestAdvance(body, actor) {
  const { WorkPlanTourAdvance } = getModels();
  let targetSalesUserId = userId(actor);

  if (body.sales_user && String(body.sales_user) !== String(userId(actor))) {
    if (!isWpElevated(actor)) {
      throw new ApiError(403, 'Executives can only request advances for themselves.');
    }
    await assertAuthorityOverSalesUser(body.sales_user, actor, 'request advances for');
    targetSalesUserId = body.sales_user;
  }

  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Advance amount must be greater than zero.');
  }

  if (!body.purpose || !body.purpose.trim()) {
    throw new ApiError(400, 'Tour purpose is required.');
  }

  const advanceNumber = await generateSequenceCode('ADV', WorkPlanTourAdvance);

  const advance = await WorkPlanTourAdvance.create({
    advance_number: advanceNumber,
    sales_user: targetSalesUserId,
    work_plan: body.work_plan || null,
    request_date: body.request_date ? startOfDay(body.request_date) : new Date(),
    amount,
    purpose: body.purpose.trim(),
    notes: body.notes?.trim() || undefined,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    attachment_details: Array.isArray(body.attachment_details) ? body.attachment_details : [],
    status: 'pending',
    created_by: userId(actor),
    updated_by: userId(actor),
  });

  const plainAdvance = toPlain(
    await WorkPlanTourAdvance.findById(advance._id).populate('sales_user', 'name email department')
  );

  notifyTourAdvanceRequested({
    advanceDoc: plainAdvance,
    actorUser: actor,
    selectedCcEmails: body.cc_emails || [],
  }).catch((err) => {
    logger.warn(`[AdvanceService] Tour advance requested notification failed: ${err.message}`);
  });

  return plainAdvance;
}

async function approveAdvance(advanceId, actor) {
  if (!isWpManager(actor) && !isWpAdmin(actor)) {
    throw new ApiError(403, 'Only managers or administrators can approve advances.');
  }

  const { WorkPlanTourAdvance } = getModels();
  const advance = await WorkPlanTourAdvance.findOne({ _id: advanceId, deletedAt: null });
  if (!advance) throw new ApiError(404, 'Tour advance record not found.');

  if (advance.status !== 'pending') {
    throw new ApiError(400, `Cannot approve an advance in status "${advance.status}".`);
  }

  assertMakerChecker(advance.sales_user, actor, 'approve the advance');
  await assertAuthorityOverSalesUser(advance.sales_user, actor, 'approve advances for');

  advance.status = 'approved';
  advance.approved_by = userId(actor);
  advance.approved_at = new Date();
  advance.updated_by = userId(actor);
  await advance.save();

  const plainAdvance = toPlain(
    await WorkPlanTourAdvance.findById(advance._id)
      .populate('sales_user', 'name email department')
      .populate('approved_by', 'name email')
  );

  notifyTourAdvanceApproved({
    advanceDoc: plainAdvance,
    actorUser: actor,
  }).catch((err) => {
    logger.warn(`[AdvanceService] Tour advance approved notification failed: ${err.message}`);
  });

  return plainAdvance;
}

async function rejectAdvance(advanceId, body, actor) {
  if (!isWpManager(actor) && !isWpAdmin(actor)) {
    throw new ApiError(403, 'Only managers or administrators can reject advances.');
  }

  const { WorkPlanTourAdvance } = getModels();
  const advance = await WorkPlanTourAdvance.findOne({ _id: advanceId, deletedAt: null });
  if (!advance) throw new ApiError(404, 'Tour advance record not found.');

  if (advance.status !== 'pending' && advance.status !== 'approved') {
    throw new ApiError(400, `Cannot reject an advance in status "${advance.status}".`);
  }

  assertMakerChecker(advance.sales_user, actor, 'reject the advance');
  await assertAuthorityOverSalesUser(advance.sales_user, actor, 'reject advances for');

  advance.status = 'rejected';
  advance.rejection_reason = body.rejection_reason?.trim() || 'Advance request rejected by manager.';
  advance.updated_by = userId(actor);
  await advance.save();

  const plainAdvance = toPlain(
    await WorkPlanTourAdvance.findById(advance._id).populate('sales_user', 'name email department')
  );

  notifyTourAdvanceRejected({
    advanceDoc: plainAdvance,
    reason: advance.rejection_reason,
    actorUser: actor,
  }).catch((err) => {
    logger.warn(`[AdvanceService] Tour advance rejected notification failed: ${err.message}`);
  });

  return plainAdvance;
}

async function disburseAdvance(advanceId, body, actor) {
  if (!isWpManager(actor) && !isWpAdmin(actor)) {
    throw new ApiError(403, 'Only managers or finance administrators can disburse advances.');
  }

  const { WorkPlanTourAdvance } = getModels();
  const advance = await WorkPlanTourAdvance.findOne({ _id: advanceId, deletedAt: null });
  if (!advance) throw new ApiError(404, 'Tour advance record not found.');

  if (advance.status !== 'approved') {
    throw new ApiError(
      400,
      `Cannot disburse an advance in status "${advance.status}". Advance must be approved before disbursement.`
    );
  }

  assertMakerChecker(advance.sales_user, actor, 'disburse the advance');
  await assertAuthorityOverSalesUser(advance.sales_user, actor, 'disburse advances for');

  const disbursedAmount = Number(body.disbursed_amount || body.amount || advance.amount);
  if (!disbursedAmount || disbursedAmount <= 0) {
    throw new ApiError(400, 'Disbursed amount must be greater than zero.');
  }

  advance.status = 'disbursed';
  advance.disbursed_amount = disbursedAmount;
  advance.remaining_balance = disbursedAmount;
  advance.settled_amount = 0;
  advance.refunded_amount = 0;
  advance.disbursed_by = userId(actor);
  advance.disbursed_at = new Date();
  advance.payment_method = normalizePaymentMethod(body.payment_method);
  advance.transaction_reference = body.transaction_reference?.trim() || undefined;
  advance.bank_name = body.bank_name?.trim() || undefined;
  advance.disbursement_notes = body.disbursement_notes?.trim() || undefined;
  if (Array.isArray(body.attachments) || Array.isArray(body.disbursement_attachments)) {
    advance.disbursement_attachments = body.disbursement_attachments || body.attachments || [];
  }
  if (Array.isArray(body.attachment_details) || Array.isArray(body.disbursement_attachment_details)) {
    advance.disbursement_attachment_details =
      body.disbursement_attachment_details || body.attachment_details || [];
  }
  advance.updated_by = userId(actor);

  await advance.save();

  const plainAdvance = toPlain(
    await WorkPlanTourAdvance.findById(advance._id)
      .populate('sales_user', 'name email department')
      .populate('disbursed_by', 'name email')
  );

  notifyTourAdvanceDisbursed({
    advanceDoc: plainAdvance,
    actorUser: actor,
  }).catch((err) => {
    logger.warn(`[AdvanceService] Tour advance disbursed notification failed: ${err.message}`);
  });

  return plainAdvance;
}

async function refundAdvance(advanceId, body, actor) {
  if (!isWpManager(actor) && !isWpAdmin(actor)) {
    throw new ApiError(403, 'Only managers or administrators can accept advance refunds.');
  }

  const { WorkPlanTourAdvance } = getModels();
  const advance = await WorkPlanTourAdvance.findOne({ _id: advanceId, deletedAt: null });
  if (!advance) throw new ApiError(404, 'Tour advance record not found.');

  if (
    advance.status !== 'disbursed' &&
    advance.status !== 'recovered' &&
    advance.status !== 'refunded'
  ) {
    throw new ApiError(
      400,
      `Cannot refund an advance in status "${advance.status}". Only disbursed advances can be refunded.`
    );
  }

  assertMakerChecker(advance.sales_user, actor, 'accept refund for the advance');
  await assertAuthorityOverSalesUser(advance.sales_user, actor, 'accept advance refunds for');

  const refundAmount = Number(body.amount);
  if (!refundAmount || refundAmount <= 0) {
    throw new ApiError(400, 'Refund amount must be greater than zero.');
  }

  const currentBalance = Number(advance.remaining_balance || 0);
  if (refundAmount > currentBalance) {
    throw new ApiError(
      400,
      `Refund amount (₹${refundAmount}) cannot exceed available advance balance (₹${currentBalance}).`
    );
  }

  const newRefunded = Number(advance.refunded_amount || 0) + refundAmount;
  const newRemaining = Math.max(0, currentBalance - refundAmount);

  advance.refunded_amount = newRefunded;
  advance.remaining_balance = newRemaining;

  if (newRemaining === 0) {
    advance.status = 'refunded';
  }

  const newRefundObj = {
    amount: refundAmount,
    refund_date: body.refund_date ? startOfDay(body.refund_date) : new Date(),
    payment_method: normalizePaymentMethod(body.payment_method || 'UPI'),
    transaction_reference: body.transaction_reference?.trim() || undefined,
    notes: body.notes?.trim() || undefined,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    attachment_details: Array.isArray(body.attachment_details) ? body.attachment_details : [],
    accepted_by: userId(actor),
    accepted_at: new Date(),
  };

  advance.refunds.push(newRefundObj);

  advance.updated_by = userId(actor);
  await advance.save();

  const plainAdvance = toPlain(
    await WorkPlanTourAdvance.findById(advance._id)
      .populate('sales_user', 'name email department')
      .populate('refunds.accepted_by', 'name email')
  );

  notifyTourAdvanceRefunded({
    advanceDoc: plainAdvance,
    refundItem: newRefundObj,
    actorUser: actor,
  }).catch((err) => {
    logger.warn(`[AdvanceService] Tour advance refunded notification failed: ${err.message}`);
  });

  return plainAdvance;
}

async function getActiveAdvances(targetUserId, actor) {
  const { WorkPlanTourAdvance } = getModels();
  const targetId = String(targetUserId || userId(actor));

  if (targetId !== String(userId(actor))) {
    await assertAuthorityOverSalesUser(targetId, actor, 'view active advances for');
  }

  const advances = await WorkPlanTourAdvance.find({
    sales_user: asObjectId(targetId),
    status: { $in: ['disbursed', 'recovered', 'refunded'] },
    remaining_balance: { $gt: 0 },
    deletedAt: null,
  })
    .sort({ request_date: 1 })
    .lean();

  return advances.map(toPlain);
}

async function issueDirectAdvance(body, actor) {
  if (!isWpElevated(actor)) {
    throw new ApiError(403, 'Only managers, coordinators, or administrators can directly issue tour advances.');
  }

  const { WorkPlanTourAdvance } = getModels();

  if (!body.sales_user) {
    throw new ApiError(400, 'Please select the executive/team member to issue the advance to.');
  }

  await assertAuthorityOverSalesUser(body.sales_user, actor, 'issue advances for');

  const amount = Number(body.amount || body.disbursed_amount);
  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Advance amount must be greater than zero.');
  }

  if (!body.purpose || !body.purpose.trim()) {
    throw new ApiError(400, 'Tour purpose is required.');
  }

  const advanceNumber = await generateSequenceCode('ADV', WorkPlanTourAdvance);
  const now = new Date();
  const requestDate = body.request_date ? startOfDay(body.request_date) : now;

  const disbursementAttachments = Array.isArray(body.disbursement_attachments)
    ? body.disbursement_attachments
    : Array.isArray(body.attachments)
    ? body.attachments
    : [];

  const disbursementAttachmentDetails = Array.isArray(body.disbursement_attachment_details)
    ? body.disbursement_attachment_details
    : Array.isArray(body.attachment_details)
    ? body.attachment_details
    : [];

  const advance = await WorkPlanTourAdvance.create({
    advance_number: advanceNumber,
    sales_user: body.sales_user,
    work_plan: body.work_plan || null,
    request_date: requestDate,
    amount,
    purpose: body.purpose.trim(),
    notes: body.notes?.trim() || undefined,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    attachment_details: Array.isArray(body.attachment_details) ? body.attachment_details : [],
    status: 'disbursed',
    approved_by: userId(actor),
    approved_at: now,
    disbursed_amount: amount,
    remaining_balance: amount,
    settled_amount: 0,
    refunded_amount: 0,
    disbursed_by: userId(actor),
    disbursed_at: now,
    payment_method: normalizePaymentMethod(body.payment_method),
    transaction_reference: body.transaction_reference?.trim() || undefined,
    bank_name: body.bank_name?.trim() || undefined,
    disbursement_notes: body.disbursement_notes?.trim() || body.notes?.trim() || undefined,
    disbursement_attachments: disbursementAttachments,
    disbursement_attachment_details: disbursementAttachmentDetails,
    created_by: userId(actor),
    updated_by: userId(actor),
  });

  const plainAdvance = toPlain(
    await WorkPlanTourAdvance.findById(advance._id)
      .populate('sales_user', 'name email department')
      .populate('approved_by', 'name email')
      .populate('disbursed_by', 'name email')
  );

  notifyTourAdvanceDisbursed({
    advanceDoc: plainAdvance,
    actorUser: actor,
  }).catch((err) => {
    logger.warn(`[AdvanceService] Tour advance directly issued notification failed: ${err.message}`);
  });

  return plainAdvance;
}

module.exports = {
  listAdvances,
  requestAdvance,
  issueDirectAdvance,
  approveAdvance,
  rejectAdvance,
  disburseAdvance,
  refundAdvance,
  getActiveAdvances,
};
