/**
 * @fileoverview Domain service for Expense Settlements and Payment Vouchers (Finance role).
 * @module modules/expense/settlement.service
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
  isExpenseFinance,
  isSuperAdminBypass,
} = require('../../middlewares/expenseAuth.middleware');
const { notifyExpenseSettlementCompleted } = require('./expenseNotification.service');
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
 * Lists all processed expense settlement vouchers.
 */
async function listSettlements(query = {}, actor) {
  const { WorkPlanExpenseSettlement } = getModels();
  const filter = { deletedAt: null };

  const targetUser = query.sales_user || query.user_id;
  if (targetUser && targetUser !== 'all') {
    filter.sales_user = asObjectId(targetUser) || targetUser;
  }

  const fromDate = query.from_date || query.from || query.start_date;
  const toDate = query.to_date || query.to || query.end_date;
  if (fromDate || toDate) {
    filter.settlement_date = {};
    if (fromDate) filter.settlement_date.$gte = startOfDay(fromDate);
    if (toDate) filter.settlement_date.$lte = endOfDay(toDate);
  }

  const searchParam = query.q || query.search;
  if (searchParam && String(searchParam).trim()) {
    const rgx = new RegExp(String(searchParam).trim(), 'i');
    filter.$or = [
      { settlement_number: rgx },
      { settlement_notes: rgx },
      { transaction_reference: rgx },
    ];
  }

  const limit = Math.min(parseInt(query.limit, 10) || 50, 1000);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    WorkPlanExpenseSettlement.countDocuments(filter),
    WorkPlanExpenseSettlement.find(filter)
      .populate('sales_user', '_id name email department phone')
      .populate('settled_by', '_id name email')
      .populate('claims.expense')
      .populate('advances.advance')
      .sort({ settlement_date: -1, createdAt: -1 })
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
 * Gets detailed settlement voucher by ID.
 */
async function getSettlement(settlementId) {
  const { WorkPlanExpenseSettlement } = getModels();
  const settlement = await WorkPlanExpenseSettlement.findOne({
    _id: settlementId,
    deletedAt: null,
  })
    .populate('sales_user', '_id name email department phone')
    .populate('settled_by', '_id name email')
    .populate('claims.expense')
    .populate('advances.advance')
    .lean();

  if (!settlement) throw new ApiError(404, 'Settlement voucher not found');
  return toPlain(settlement);
}

/**
 * Creates and executes a settlement voucher (Finance role only).
 */
async function createSettlement(body, actor) {
  if (!isExpenseFinance(actor) && !isSuperAdminBypass(actor)) {
    throw new ApiError(403, 'Only Finance officers can process settlements and payment vouchers.');
  }

  const { WorkPlanExpenseSettlement, WorkPlanExpense, WorkPlanTourAdvance } = getModels();

  if (!body.sales_user) {
    throw new ApiError(400, 'sales_user is required to process settlement');
  }

  assertMakerChecker(body.sales_user, actor, 'settle expenses for');

  const rawClaims = Array.isArray(body.claims) ? body.claims : [];
  if (rawClaims.length === 0) {
    throw new ApiError(400, 'At least one approved claim must be selected for settlement.');
  }

  const targetUserId = String(body.sales_user);
  let totalClaimAmount = 0;
  const processedClaims = [];

  for (const item of rawClaims) {
    const expenseId = item.expense || item._id || item.id;
    const expDoc = await WorkPlanExpense.findOne({ _id: expenseId, deletedAt: null });
    if (!expDoc) {
      throw new ApiError(404, `Expense claim ${expenseId} not found.`);
    }

    if (expDoc.status !== 'approved') {
      throw new ApiError(400, `Expense claim ${expenseId} is not approved. Only approved claims can be settled.`);
    }

    if (expDoc.settlement_status === 'settled') {
      throw new ApiError(400, `Expense claim ${expenseId} is already fully settled.`);
    }

    const claimAmt = Number(item.amount || expDoc.amount - (expDoc.settled_amount || 0));
    if (claimAmt <= 0) {
      throw new ApiError(400, `Claim amount for expense ${expenseId} must be greater than zero.`);
    }

    totalClaimAmount += claimAmt;
    processedClaims.push({
      expense: expDoc._id,
      amount: claimAmt,
      category: expDoc.category,
      description: expDoc.description,
      expense_date: expDoc.expense_date,
      _docRef: expDoc,
    });
  }

  let advanceDeductionAmount = 0;
  const processedAdvances = [];
  const rawAdvances = Array.isArray(body.advances) ? body.advances : [];

  for (const item of rawAdvances) {
    const advanceId = item.advance || item._id || item.id;
    const advDoc = await WorkPlanTourAdvance.findOne({ _id: advanceId, deletedAt: null });
    if (!advDoc) {
      throw new ApiError(404, `Tour advance ${advanceId} not found.`);
    }

    if (!['disbursed', 'recovered', 'refunded'].includes(advDoc.status)) {
      throw new ApiError(400, `Advance ${advDoc.advance_number} is not in disbursed status.`);
    }

    const availableBal = Number(advDoc.remaining_balance || 0);
    const deductAmt = Number(item.deducted_amount || item.amount || 0);

    if (deductAmt > availableBal) {
      throw new ApiError(
        400,
        `Deduction amount (₹${deductAmt}) exceeds available advance balance (₹${availableBal}) on advance ${advDoc.advance_number}.`
      );
    }

    if (deductAmt > 0) {
      advanceDeductionAmount += deductAmt;
      processedAdvances.push({
        advance: advDoc._id,
        deducted_amount: deductAmt,
        advance_number: advDoc.advance_number,
        _docRef: advDoc,
      });
    }
  }

  const directPaymentAmount = Math.max(0, totalClaimAmount - advanceDeductionAmount);

  let settlementMode = body.settlement_mode;
  if (!settlementMode) {
    if (advanceDeductionAmount > 0 && directPaymentAmount > 0) {
      settlementMode = 'split';
    } else if (advanceDeductionAmount > 0) {
      settlementMode = 'advance_deduction';
    } else {
      settlementMode = 'direct_payment';
    }
  }

  const settlementNumber = await generateSequenceCode('EXP-SET', WorkPlanExpenseSettlement);

  const settlementDoc = await WorkPlanExpenseSettlement.create({
    settlement_number: settlementNumber,
    sales_user: asObjectId(targetUserId),
    settlement_date: body.settlement_date ? startOfDay(body.settlement_date) : new Date(),
    claims: processedClaims.map((c) => ({
      expense: c.expense,
      amount: c.amount,
      category: c.category,
      description: c.description,
      expense_date: c.expense_date,
    })),
    advances: processedAdvances.map((a) => ({
      advance: a.advance,
      deducted_amount: a.deducted_amount,
      advance_number: a.advance_number,
    })),
    total_claim_amount: totalClaimAmount,
    advance_deduction_amount: advanceDeductionAmount,
    direct_payment_amount: directPaymentAmount,
    settlement_mode: settlementMode,
    payment_method: normalizePaymentMethod(body.payment_method),
    transaction_reference: body.transaction_reference?.trim() || undefined,
    bank_name: body.bank_name?.trim() || undefined,
    settlement_notes: body.settlement_notes?.trim() || undefined,
    attachments: Array.isArray(body.attachments) ? body.attachments.map(asObjectId).filter(Boolean) : [],
    settled_by: asObjectId(userId(actor)),
  });

  // Update claim settlement statuses
  for (const c of processedClaims) {
    const exp = c._docRef;
    const newSettledAmount = (exp.settled_amount || 0) + c.amount;
    exp.settled_amount = newSettledAmount;
    exp.settlement_status = newSettledAmount >= exp.amount ? 'settled' : 'partially_settled';
    exp.settlement_id = settlementDoc._id;
    exp.updated_by = asObjectId(userId(actor));
    await exp.save();
  }

  // Update advance remaining balances
  for (const a of processedAdvances) {
    const adv = a._docRef;
    const newRemaining = Math.max(0, (adv.remaining_balance || 0) - a.deducted_amount);
    const newSettled = (adv.settled_amount || 0) + a.deducted_amount;
    adv.remaining_balance = newRemaining;
    adv.settled_amount = newSettled;
    if (newRemaining === 0) {
      adv.status = 'settled';
    }
    adv.updated_by = asObjectId(userId(actor));
    await adv.save();
  }

  const plainSettlement = await getSettlement(settlementDoc._id);

  notifyExpenseSettlementCompleted({ settlement: plainSettlement, actorUser: actor }).catch(() => {});

  return plainSettlement;
}

module.exports = {
  listSettlements,
  getSettlement,
  createSettlement,
};

