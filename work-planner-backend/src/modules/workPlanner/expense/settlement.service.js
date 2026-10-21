/**
 * @fileoverview Domain service for Expense Settlements and Payment Vouchers.
 * @module modules/workPlanner/expense/settlement.service
 */

const { getModels } = require('../../../data/mongoRegistry');
const {
  isWpAdmin,
  isWpManager,
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
  resolveEffectiveSalesUser,
  assertMakerChecker,
  assertAuthorityOverSalesUser,
  normalizePaymentMethod,
} = require('./expense.common');
const {
  notifyExpenseSettlementCompleted,
} = require('../workPlannerAutoNotification.service');
const { logger } = require('../../../utils/logger');

async function listSettlements(query = {}, actor) {
  const { WorkPlanExpenseSettlement } = getModels();
  const filter = { deletedAt: null };

  await applySalesUserFilter(filter, actor, query);

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
      { payment_reference: rgx },
    ];
  }

  const limit = Math.min(parseInt(query.limit, 10) || 50, 1000);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    WorkPlanExpenseSettlement.countDocuments(filter),
    WorkPlanExpenseSettlement.find(filter)
      .populate('sales_user', 'name email department phone')
      .populate('settled_by', 'name email')
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

async function getSettlement(settlementId, actor) {
  const { WorkPlanExpenseSettlement } = getModels();
  const settlement = await WorkPlanExpenseSettlement.findOne({
    _id: settlementId,
    deletedAt: null,
  })
    .populate('sales_user', 'name email department phone')
    .populate('settled_by', 'name email')
    .populate('claims.expense')
    .populate('advances.advance')
    .lean();

  if (!settlement) throw new ApiError(404, 'Settlement record not found');

  const sUserId = String(settlement.sales_user?._id || settlement.sales_user || '');
  if (sUserId !== String(userId(actor))) {
    await assertAuthorityOverSalesUser(sUserId, actor, 'view settlement voucher for');
  }

  return toPlain(settlement);
}

async function createSettlement(body, actor) {
  if (!isWpManager(actor) && !isWpAdmin(actor)) {
    throw new ApiError(403, 'Only managers or administrators can settle expense claims.');
  }

  const { WorkPlanExpense, WorkPlanTourAdvance, WorkPlanExpenseSettlement } = getModels();
  const targetSalesUserId = body.sales_user || body.sales_user_id;
  if (!targetSalesUserId) {
    throw new ApiError(400, 'Target sales user is required for settlement.');
  }

  assertMakerChecker(targetSalesUserId, actor, 'settle claims');
  await assertAuthorityOverSalesUser(targetSalesUserId, actor, 'settle claims for');

  const claimIds = Array.isArray(body.claim_ids) ? body.claim_ids : [];
  if (claimIds.length === 0) {
    throw new ApiError(400, 'At least one approved expense claim must be selected for settlement.');
  }

  // Load and validate claims
  const claims = await WorkPlanExpense.find({
    _id: { $in: claimIds.map(asObjectId).filter(Boolean) },
    deletedAt: null,
  })
    .populate('work_plan', 'sales_user')
    .lean();

  if (claims.length !== claimIds.length) {
    throw new ApiError(400, 'One or more selected claims could not be found.');
  }

  let calculatedTotalClaim = 0;
  const verifiedClaims = [];

  for (const c of claims) {
    const effectiveUser = resolveEffectiveSalesUser(c, c.work_plan);
    if (String(effectiveUser) !== String(targetSalesUserId)) {
      throw new ApiError(400, 'All selected claims must belong to the same executive.');
    }
    if (c.status !== 'approved') {
      throw new ApiError(
        400,
        `Claim #${c._id} is in status "${c.status}". Only approved claims can be settled.`
      );
    }
    if (c.settlement_status === 'settled') {
      throw new ApiError(409, `Claim #${c._id} is already settled.`);
    }

    const unSettledAmount = (c.amount || 0) - (c.settled_amount || 0);
    calculatedTotalClaim += unSettledAmount;
    verifiedClaims.push({
      expense: c._id,
      amount: unSettledAmount,
      category: c.category,
      description: c.description,
      expense_date: c.expense_date,
    });
  }

  calculatedTotalClaim = Math.round(calculatedTotalClaim * 100) / 100;

  // Advance Deductions
  const advanceDeductions = Array.isArray(body.advance_deductions) ? body.advance_deductions : [];
  let totalAdvanceDeduction = 0;
  const verifiedAdvances = [];
  const advanceUpdates = [];

  for (const item of advanceDeductions) {
    const advId = item.advance_id || item.advance || item._id;
    const deductAmt = Math.round(Number(item.amount || item.deducted_amount || 0) * 100) / 100;
    if (deductAmt <= 0) continue;

    const advDoc = await WorkPlanTourAdvance.findOne({
      _id: advId,
      sales_user: asObjectId(targetSalesUserId),
      deletedAt: null,
    });

    if (!advDoc) {
      throw new ApiError(404, `Advance #${advId} not found for this executive.`);
    }

    const availableBal = Math.round(Number(advDoc.remaining_balance || 0) * 100) / 100;
    if (deductAmt > availableBal) {
      throw new ApiError(
        400,
        `Deduction amount (₹${deductAmt}) exceeds available balance (₹${availableBal}) for advance #${advDoc.advance_number || advDoc._id}.`
      );
    }

    totalAdvanceDeduction += deductAmt;
    verifiedAdvances.push({
      advance: advDoc._id,
      deducted_amount: deductAmt,
      advance_number: advDoc.advance_number,
    });

    advanceUpdates.push({
      doc: advDoc,
      deductAmt,
      newRemaining: Math.max(0, Math.round((availableBal - deductAmt) * 100) / 100),
      newSettled: Math.round(((advDoc.settled_amount || 0) + deductAmt) * 100) / 100,
    });
  }

  totalAdvanceDeduction = Math.round(totalAdvanceDeduction * 100) / 100;
  const directPaymentAmount = Math.max(
    0,
    Math.round(Number(body.direct_payment_amount || 0) * 100) / 100
  );

  const settlementSum = Math.round((totalAdvanceDeduction + directPaymentAmount) * 100) / 100;

  // Validate strict split matching
  if (Math.abs(settlementSum - calculatedTotalClaim) > 0.01) {
    throw new ApiError(
      400,
      `Settlement total mismatch: Advance Deduction (₹${totalAdvanceDeduction}) + Direct Payment (₹${directPaymentAmount}) = ₹${settlementSum}, but Total Claim Amount is ₹${calculatedTotalClaim}.`
    );
  }

  let settlementMode = 'direct_payment';
  if (totalAdvanceDeduction > 0 && directPaymentAmount > 0) {
    settlementMode = 'split';
  } else if (totalAdvanceDeduction > 0) {
    settlementMode = 'advance_deduction';
  }

  const settlementNumber = await generateSequenceCode('SETTLE', WorkPlanExpenseSettlement);

  const settlement = await WorkPlanExpenseSettlement.create({
    settlement_number: settlementNumber,
    sales_user: targetSalesUserId,
    settlement_date: body.settlement_date ? startOfDay(body.settlement_date) : new Date(),
    claims: verifiedClaims,
    advances: verifiedAdvances,
    total_claim_amount: calculatedTotalClaim,
    advance_deduction_amount: totalAdvanceDeduction,
    direct_payment_amount: directPaymentAmount,
    settlement_mode: settlementMode,
    payment_method: directPaymentAmount > 0 ? normalizePaymentMethod(body.payment_method) : undefined,
    transaction_reference: directPaymentAmount > 0 ? body.transaction_reference?.trim() : undefined,
    bank_name: directPaymentAmount > 0 ? body.bank_name?.trim() : undefined,
    settlement_notes: body.settlement_notes?.trim() || undefined,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    attachment_details: Array.isArray(body.attachment_details) ? body.attachment_details : [],
    settled_by: userId(actor),
    settled_at: new Date(),
    created_by: userId(actor),
    updated_by: userId(actor),
  });

  // Apply advance updates
  for (const update of advanceUpdates) {
    update.doc.remaining_balance = update.newRemaining;
    update.doc.settled_amount = update.newSettled;
    if (update.newRemaining <= 0) {
      update.doc.status = 'settled';
    }
    update.doc.updated_by = userId(actor);
    await update.doc.save();
  }

  // Mark claims as settled
  await WorkPlanExpense.updateMany(
    { _id: { $in: claimIds.map(asObjectId).filter(Boolean) } },
    {
      $set: {
        settlement_status: 'settled',
        settlement_id: settlement._id,
        updated_by: userId(actor),
      },
    }
  );

  const resultDoc = await getSettlement(settlement._id, actor);

  notifyExpenseSettlementCompleted({
    settlementDoc: resultDoc,
    actorUser: actor,
  }).catch((err) => {
    logger.warn(`[SettlementService] Expense settlement notification failed: ${err.message}`);
  });

  return resultDoc;
}

module.exports = {
  listSettlements,
  getSettlement,
  createSettlement,
};
