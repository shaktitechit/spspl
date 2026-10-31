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

  if (query.settlement_mode && query.settlement_mode !== 'all') {
    filter.settlement_mode = query.settlement_mode;
  }

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
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
      .populate('payment_entries.payment_entry')
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
    .populate('payment_entries.payment_entry')
    .lean();

  if (!settlement) throw new ApiError(404, 'Settlement voucher not found');
  return toPlain(settlement);
}

/**
 * Creates and executes a settlement voucher (Finance role only).
 */
async function createSettlement(body, actor) {
  if (!isExpenseFinance(actor) && !isExpenseAdmin(actor) && !isSuperAdminBypass(actor)) {
    throw new ApiError(403, 'Finance or Admin authority required to process settlements and payment vouchers.');
  }

  const { WorkPlanExpenseSettlement, WorkPlanExpense, WorkPlanTourAdvance } = getModels();

  if (!body.sales_user) {
    throw new ApiError(400, 'sales_user is required to process settlement');
  }

  assertMakerChecker(body.sales_user, actor, 'settle expenses for');

  let rawClaims = Array.isArray(body.claims) ? body.claims : [];
  if (rawClaims.length === 0 && Array.isArray(body.expense_ids)) {
    rawClaims = body.expense_ids.map((id) => ({ expense: id }));
  }
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

  // 1. Process Tour Advance Deductions
  let advanceDeductionAmount = 0;
  const processedAdvances = [];
  const rawAdvances = Array.isArray(body.advances) ? body.advances : [];

  for (const item of rawAdvances) {
    const advanceId = item.advance || item.advance_id || item._id || item.id;
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

  // 2. Process Direct Payment Entry Deductions (Treasury payments already given to user)
  let paymentEntryDeductionAmount = 0;
  const processedPaymentEntries = [];
  const rawPaymentEntries = Array.isArray(body.payment_entries) ? body.payment_entries : [];

  for (const item of rawPaymentEntries) {
    const paymentId = item.payment_entry || item.payment_id || item._id || item.id;
    const payDoc = await WorkPlanExpenseSettlement.findOne({ _id: paymentId, deletedAt: null });
    if (!payDoc) {
      throw new ApiError(404, `Payment entry ${paymentId} not found.`);
    }

    if (payDoc.settlement_mode !== 'payment_entry') {
      throw new ApiError(400, `Voucher ${payDoc.settlement_number} is not a direct payment entry.`);
    }

    const totalPaid = Number(payDoc.direct_payment_amount || 0);
    const settledSoFar = Number(payDoc.settled_amount || 0);
    const availableBal = (payDoc.remaining_balance !== undefined && payDoc.remaining_balance !== null && Number(payDoc.remaining_balance) > 0)
      ? Number(payDoc.remaining_balance)
      : Math.max(0, totalPaid - settledSoFar);

    const deductAmt = Number(item.deducted_amount || item.amount || 0);

    if (deductAmt > availableBal) {
      throw new ApiError(
        400,
        `Deduction amount (₹${deductAmt}) exceeds available balance (₹${availableBal}) on payment entry ${payDoc.settlement_number}.`
      );
    }

    if (deductAmt > 0) {
      paymentEntryDeductionAmount += deductAmt;
      processedPaymentEntries.push({
        payment_entry: payDoc._id,
        deducted_amount: deductAmt,
        payment_number: payDoc.settlement_number,
        _docRef: payDoc,
      });
    }
  }

  const directPaymentAmount = Math.max(
    0,
    totalClaimAmount - advanceDeductionAmount - paymentEntryDeductionAmount
  );

  let settlementMode = body.settlement_mode;
  if (!settlementMode) {
    const totalDeductions = advanceDeductionAmount + paymentEntryDeductionAmount;
    if (totalDeductions > 0 && directPaymentAmount > 0) {
      settlementMode = 'split';
    } else if (totalDeductions > 0) {
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
    payment_entries: processedPaymentEntries.map((p) => ({
      payment_entry: p.payment_entry,
      deducted_amount: p.deducted_amount,
      payment_number: p.payment_number,
    })),
    total_claim_amount: totalClaimAmount,
    advance_deduction_amount: advanceDeductionAmount,
    payment_entry_deduction_amount: paymentEntryDeductionAmount,
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

  // Update payment entry remaining balances
  for (const p of processedPaymentEntries) {
    const pay = p._docRef;
    const totalPaid = Number(pay.direct_payment_amount || 0);
    const newSettled = Number(pay.settled_amount || 0) + p.deducted_amount;
    pay.settled_amount = newSettled;
    pay.remaining_balance = Math.max(0, totalPaid - newSettled);
    pay.updated_by = asObjectId(userId(actor));
    await pay.save();
  }

  const plainSettlement = await getSettlement(settlementDoc._id);

  notifyExpenseSettlementCompleted({ settlement: plainSettlement, actorUser: actor }).catch(() => {});

  return plainSettlement;
}

/**
 * Record a direct payment, disbursement, or ledger adjustment entry for an employee (Finance/Admin role).
 */
async function recordPaymentEntry(body, actor) {
  if (!isExpenseFinance(actor) && !isExpenseAdmin(actor) && !isSuperAdminBypass(actor)) {
    throw new ApiError(403, 'Finance or Admin authority required to record payment entries.');
  }

  const { WorkPlanExpenseSettlement, User } = getModels();

  const targetUserId = body.sales_user || body.user_id || body.sales_user_id;
  if (!targetUserId) {
    throw new ApiError(400, 'sales_user is required to record payment entry.');
  }

  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Payment amount must be greater than zero.');
  }

  const userDoc = await User.findById(targetUserId).lean();
  if (!userDoc) {
    throw new ApiError(404, 'Employee record not found.');
  }

  const paymentNumber = await generateSequenceCode('PAY', WorkPlanExpenseSettlement);

  const settlementDoc = await WorkPlanExpenseSettlement.create({
    settlement_number: paymentNumber,
    sales_user: asObjectId(targetUserId),
    settlement_date: body.payment_date ? startOfDay(body.payment_date) : new Date(),
    claims: [],
    advances: [],
    payment_entries: [],
    total_claim_amount: 0,
    advance_deduction_amount: 0,
    payment_entry_deduction_amount: 0,
    direct_payment_amount: amount,
    remaining_balance: amount,
    settled_amount: 0,
    settlement_mode: 'payment_entry',
    payment_method: normalizePaymentMethod(body.payment_method),
    transaction_reference: body.transaction_reference?.trim() || undefined,
    bank_name: body.bank_name?.trim() || undefined,
    settlement_notes: body.notes?.trim() || body.settlement_notes?.trim() || 'Direct Treasury Payment / Disbursement Entry',
    attachments: Array.isArray(body.attachments) ? body.attachments.map(asObjectId).filter(Boolean) : [],
    settled_by: asObjectId(userId(actor)),
  });

  return await getSettlement(settlementDoc._id);
}

/**
 * Lists active unsettled direct payment entries for an employee that can be adjusted in settlements.
 */
async function getActivePaymentEntries(targetUserId) {
  const { WorkPlanExpenseSettlement } = getModels();
  if (!targetUserId || targetUserId === 'all') return [];

  const uOid = asObjectId(targetUserId);
  const matchIds = [targetUserId, uOid, String(targetUserId)].filter(Boolean);

  const payments = await WorkPlanExpenseSettlement.find({
    sales_user: { $in: matchIds },
    settlement_mode: 'payment_entry',
    deletedAt: null,
  })
    .sort({ settlement_date: 1, createdAt: 1 })
    .lean();

  return payments
    .map((p) => {
      const plain = toPlain(p);
      const settled = Number(plain.settled_amount || 0);
      const total = Number(plain.direct_payment_amount || 0);
      const remaining = (plain.remaining_balance !== undefined && plain.remaining_balance !== null && Number(plain.remaining_balance) > 0)
        ? Number(plain.remaining_balance)
        : Math.max(0, total - settled);

      return {
        ...plain,
        settled_amount: settled,
        remaining_balance: remaining,
      };
    })
    .filter((p) => p.remaining_balance > 0);
}

module.exports = {
  listSettlements,
  getSettlement,
  createSettlement,
  recordPaymentEntry,
  getActivePaymentEntries,
};

