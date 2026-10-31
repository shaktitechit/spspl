/**
 * @fileoverview Domain service for Tour/Cash Advances lifecycle management (create, approve, reject, disburse, refund).
 * @module modules/expense/advance.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { startOfDay, endOfDay, userId } = require('./expense.constants');
const {
  ApiError,
  toPlain,
  generateSequenceCode,
  assertMakerChecker,
  normalizePaymentMethod,
} = require('./expense.common');
const {
  isExpenseAdmin,
  isExpenseFinance,
  isSuperAdminBypass,
} = require('../../middlewares/expenseAuth.middleware');
const {
  notifyTourAdvanceApproved,
  notifyTourAdvanceRejected,
  notifyTourAdvanceDisbursed,
} = require('./expenseNotification.service');
const mongoose = require('mongoose');

function asObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return null;
}

/**
 * List tour/cash advances.
 */
async function listAdvances(query = {}, actor) {
  const { WorkPlanTourAdvance } = getModels();
  const filter = { deletedAt: null };

  const targetUser = query.sales_user || query.user_id;
  if (targetUser && targetUser !== 'all') {
    filter.sales_user = asObjectId(targetUser) || targetUser;
  }

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
      { notes: rgx },
    ];
  }

  const limit = Math.min(parseInt(query.limit, 10) || 50, 1000);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    WorkPlanTourAdvance.countDocuments(filter),
    WorkPlanTourAdvance.find(filter)
      .populate('sales_user', '_id name email department phone')
      .populate('approved_by', '_id name email')
      .populate('disbursed_by', '_id name email')
      .populate('attachments')
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

/**
 * Create or Request advance on behalf of a Work Planner user (Admin role).
 */
async function createAdvance(body, actor) {
  const { WorkPlanTourAdvance } = getModels();

  const targetUserId = body.sales_user || body.user_id;
  if (!targetUserId) {
    throw new ApiError(400, 'sales_user is required (specify the Work Planner user).');
  }

  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Advance amount must be greater than zero.');
  }

  if (!body.purpose || !body.purpose.trim()) {
    throw new ApiError(400, 'Tour/Advance purpose is required.');
  }

  const advanceNumber = await generateSequenceCode('ADV', WorkPlanTourAdvance);
  const autoApprove = body.auto_approve === true || isExpenseAdmin(actor);

  const advance = await WorkPlanTourAdvance.create({
    advance_number: advanceNumber,
    sales_user: asObjectId(targetUserId),
    work_plan: asObjectId(body.work_plan),
    request_date: body.request_date ? startOfDay(body.request_date) : new Date(),
    amount,
    purpose: body.purpose.trim(),
    notes: body.notes?.trim() || undefined,
    attachments: Array.isArray(body.attachments) ? body.attachments.map(asObjectId).filter(Boolean) : [],
    status: autoApprove ? 'approved' : 'pending',
    approved_by: autoApprove ? asObjectId(userId(actor)) : undefined,
    approved_at: autoApprove ? new Date() : undefined,
    created_by: asObjectId(userId(actor)),
    updated_by: asObjectId(userId(actor)),
  });

  const plainAdvance = toPlain(
    await WorkPlanTourAdvance.findById(advance._id)
      .populate('sales_user', '_id name email department phone')
      .populate('approved_by', '_id name email')
  );

  return plainAdvance;
}

/**
 * Approve advance (Admin role).
 */
async function approveAdvance(advanceId, actor) {
  if (!isExpenseAdmin(actor) && !isSuperAdminBypass(actor)) {
    throw new ApiError(403, 'Only administrators can approve advances.');
  }

  const { WorkPlanTourAdvance } = getModels();
  const advance = await WorkPlanTourAdvance.findOne({ _id: advanceId, deletedAt: null });
  if (!advance) throw new ApiError(404, 'Tour advance record not found.');

  if (advance.status !== 'pending') {
    throw new ApiError(400, `Cannot approve an advance in status "${advance.status}".`);
  }

  assertMakerChecker(advance.sales_user, actor, 'approve the advance');

  advance.status = 'approved';
  advance.approved_by = asObjectId(userId(actor));
  advance.approved_at = new Date();
  advance.updated_by = asObjectId(userId(actor));
  await advance.save();

  const plainAdvance = toPlain(
    await WorkPlanTourAdvance.findById(advance._id)
      .populate('sales_user', '_id name email department phone')
      .populate('approved_by', '_id name email')
  );

  notifyTourAdvanceApproved({ advance: plainAdvance, actorUser: actor }).catch(() => {});

  return plainAdvance;
}

/**
 * Reject advance (Admin role).
 */
async function rejectAdvance(advanceId, body, actor) {
  if (!isExpenseAdmin(actor) && !isSuperAdminBypass(actor)) {
    throw new ApiError(403, 'Only administrators can reject advances.');
  }

  const { WorkPlanTourAdvance } = getModels();
  const advance = await WorkPlanTourAdvance.findOne({ _id: advanceId, deletedAt: null });
  if (!advance) throw new ApiError(404, 'Tour advance record not found.');

  if (advance.status !== 'pending' && advance.status !== 'approved') {
    throw new ApiError(400, `Cannot reject an advance in status "${advance.status}".`);
  }

  assertMakerChecker(advance.sales_user, actor, 'reject the advance');

  const reason = String(body.rejection_reason || body.reason || '').trim();
  if (!reason) {
    throw new ApiError(400, 'rejection_reason is required to reject an advance');
  }

  advance.status = 'rejected';
  advance.rejection_reason = reason;
  advance.updated_by = asObjectId(userId(actor));
  await advance.save();

  const plainAdvance = toPlain(
    await WorkPlanTourAdvance.findById(advance._id).populate('sales_user', '_id name email department phone')
  );

  notifyTourAdvanceRejected({ advance: plainAdvance, rejectionReason: reason, actorUser: actor }).catch(() => {});

  return plainAdvance;
}

/**
 * Disburse advance (Finance role).
 */
async function disburseAdvance(advanceId, body, actor) {
  if (!isExpenseFinance(actor) && !isSuperAdminBypass(actor)) {
    throw new ApiError(403, 'Only finance officers can disburse advances.');
  }

  const { WorkPlanTourAdvance } = getModels();
  const advance = await WorkPlanTourAdvance.findOne({ _id: advanceId, deletedAt: null });
  if (!advance) throw new ApiError(404, 'Tour advance record not found.');

  if (advance.status !== 'approved') {
    throw new ApiError(
      400,
      `Cannot disburse an advance in status "${advance.status}". Advance must be approved by Admin first.`
    );
  }

  assertMakerChecker(advance.sales_user, actor, 'disburse the advance');

  const disbursedAmount = Number(body.disbursed_amount || body.amount || advance.amount);
  if (!disbursedAmount || disbursedAmount <= 0) {
    throw new ApiError(400, 'Disbursed amount must be greater than zero.');
  }

  advance.status = 'disbursed';
  advance.disbursed_amount = disbursedAmount;
  advance.remaining_balance = disbursedAmount;
  advance.settled_amount = 0;
  advance.refunded_amount = 0;
  advance.disbursed_by = asObjectId(userId(actor));
  advance.disbursed_at = body.disbursed_at ? new Date(body.disbursed_at) : new Date();
  advance.payment_method = normalizePaymentMethod(body.payment_method);
  advance.transaction_reference = body.transaction_reference?.trim() || undefined;
  advance.bank_name = body.bank_name?.trim() || undefined;
  advance.disbursement_notes = body.disbursement_notes?.trim() || undefined;
  if (Array.isArray(body.attachments)) {
    advance.attachments = body.attachments.map(asObjectId).filter(Boolean);
  }
  advance.updated_by = asObjectId(userId(actor));

  await advance.save();

  const plainAdvance = toPlain(
    await WorkPlanTourAdvance.findById(advance._id)
      .populate('sales_user', '_id name email department phone')
      .populate('disbursed_by', '_id name email')
  );

  notifyTourAdvanceDisbursed({ advance: plainAdvance, actorUser: actor }).catch(() => {});

  return plainAdvance;
}

/**
 * Accept refund of unused advance balance (Finance role).
 */
async function refundAdvance(advanceId, body, actor) {
  if (!isExpenseFinance(actor) && !isSuperAdminBypass(actor)) {
    throw new ApiError(403, 'Only finance officers can accept advance refunds.');
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
  advance.refunded_at = new Date();
  advance.refunded_by = asObjectId(userId(actor));
  advance.refund_notes = body.notes?.trim() || undefined;
  advance.refund_reference = body.transaction_reference?.trim() || undefined;

  if (newRemaining === 0) {
    advance.status = 'refunded';
  }

  advance.updated_by = asObjectId(userId(actor));
  await advance.save();

  return toPlain(
    await WorkPlanTourAdvance.findById(advance._id)
      .populate('sales_user', '_id name email department phone')
      .populate('refunded_by', '_id name email')
  );
}

/**
 * Get active advances with remaining balance for a specific user.
 */
async function getActiveAdvances(targetUserId) {
  const { WorkPlanTourAdvance } = getModels();
  const advances = await WorkPlanTourAdvance.find({
    sales_user: asObjectId(targetUserId),
    status: { $in: ['disbursed', 'recovered', 'refunded'] },
    remaining_balance: { $gt: 0 },
    deletedAt: null,
  })
    .sort({ request_date: 1 })
    .lean();

  return advances.map(toPlain);
}

module.exports = {
  listAdvances,
  createAdvance,
  approveAdvance,
  rejectAdvance,
  disburseAdvance,
  refundAdvance,
  getActiveAdvances,
};

