/**
 * @fileoverview Domain service for Executive Passbook, Ledger, Net Balances and Expense KPI summaries.
 * @module modules/workPlanner/expense/passbook.service
 */

const { getModels } = require('../../../data/mongoRegistry');
const {
  isWpAdmin,
  startOfDay,
  endOfDay,
} = require('../workPlanner.constants');
const {
  userId,
  asObjectId,
  getVisibleSalesUserIds,
} = require('../teamVisibility.service');
const { toPlain, assertAuthorityOverSalesUser, resolveEffectiveSalesUser } = require('./expense.common');
const { withFreshExpenseAttachmentUrls } = require('../../../services/fileManagement');

function buildMatchUserIds(userIds = []) {
  const strIds = userIds.map((id) => String(id?._id || id)).filter(Boolean);
  const objIds = strIds.map(asObjectId).filter(Boolean);
  return Array.from(new Set([...strIds, ...objIds]));
}

/**
 * Computes executive balances and net financial positions for visible users.
 */
async function getExecutiveBalances(query = {}, actor) {
  const { User, WorkPlanExpense, WorkPlanTourAdvance, WorkPlanExpenseSettlement } = getModels();

  let targetUserIds = [];
  const visible = await getVisibleSalesUserIds(actor);
  const requestedUser = query.sales_user || query.user_id;

  if (requestedUser && requestedUser !== 'all') {
    const requested = String(requestedUser);
    if (visible === null || visible.includes(requested)) {
      targetUserIds = [requested];
    } else {
      return { total: 0, page: 1, limit: 50, pages: 0, data: [] };
    }
  } else if (visible === null) {
    // Admin: load all active work_planner portal users
    const users = await User.find({
      is_active: { $ne: false },
      portals: {
        $elemMatch: {
          portal_code: 'work_planner',
          access_roles: { $in: ['executive', 'coordinator', 'manager', 'admin'] },
        },
      },
    })
      .select('_id name email department phone')
      .lean();
    targetUserIds = users.map((u) => String(u._id));
  } else {
    targetUserIds = visible;
  }

  const userOids = targetUserIds.map(asObjectId).filter(Boolean);
  if (userOids.length === 0) {
    return { total: 0, page: 1, limit: 50, pages: 0, data: [] };
  }

  const matchUserIds = buildMatchUserIds(targetUserIds);

  // 1. Fetch Users
  const userDocs = await User.find({
    _id: { $in: userOids },
    is_active: { $ne: false },
  })
    .select('_id name email department phone')
    .lean();

  const userMap = new Map();
  userDocs.forEach((u) => userMap.set(String(u._id), u));

  // 2. Aggregate Active Tour Advances
  const advancesAgg = await WorkPlanTourAdvance.aggregate([
    {
      $match: {
        sales_user: { $in: matchUserIds },
        status: { $in: ['disbursed', 'recovered', 'refunded'] },
        remaining_balance: { $gt: 0 },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: '$sales_user',
        total_remaining_balance: { $sum: '$remaining_balance' },
        total_disbursed_amount: { $sum: '$disbursed_amount' },
        active_advances_count: { $sum: 1 },
      },
    },
  ]);

  const advanceMap = new Map();
  advancesAgg.forEach((a) => advanceMap.set(String(a._id), a));

  // 3. Aggregate Unsettled Approved Claims & Settled Claims with effective_sales_user resolution
  const expensesAgg = await WorkPlanExpense.aggregate([
    {
      $match: {
        deletedAt: null,
      },
    },
    {
      $lookup: {
        from: 'workplans',
        localField: 'work_plan',
        foreignField: '_id',
        as: 'parent_plan',
      },
    },
    {
      $unwind: {
        path: '$parent_plan',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        $or: [
          { 'parent_plan.deletedAt': null },
          { 'parent_plan.deletedAt': { $exists: false } },
        ],
      },
    },
    {
      $addFields: {
        effective_sales_user: {
          $ifNull: ['$sales_user', '$parent_plan.sales_user'],
        },
      },
    },
    {
      $match: {
        effective_sales_user: { $in: matchUserIds },
      },
    },
    {
      $group: {
        _id: '$effective_sales_user',
        unsettled_approved_amount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'approved'] },
                  { $ne: ['$settlement_status', 'settled'] },
                ],
              },
              { $subtract: ['$amount', { $ifNull: ['$settled_amount', 0] }] },
              0,
            ],
          },
        },
        unsettled_approved_count: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'approved'] },
                  { $ne: ['$settlement_status', 'settled'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        total_settled_amount: {
          $sum: {
            $cond: [{ $eq: ['$settlement_status', 'settled'] }, '$amount', 0],
          },
        },
        total_settled_count: {
          $sum: {
            $cond: [{ $eq: ['$settlement_status', 'settled'] }, 1, 0],
          },
        },
      },
    },
  ]);

  const expenseMap = new Map();
  expensesAgg.forEach((e) => expenseMap.set(String(e._id), e));

  // 4. Aggregate Active Payment Entries
  const settlementsAgg = await WorkPlanExpenseSettlement.aggregate([
    {
      $match: {
        sales_user: { $in: matchUserIds },
        deletedAt: null,
        settlement_mode: 'payment_entry',
      },
    },
    {
      $group: {
        _id: '$sales_user',
        total_payment_entries: {
          $sum: {
            $cond: [
              { $ifNull: ['$remaining_balance', false] },
              '$remaining_balance',
              { $subtract: ['$direct_payment_amount', { $ifNull: ['$settled_amount', 0] }] },
            ],
          },
        },
        payment_entries_count: { $sum: 1 },
      },
    },
  ]);

  const settlementMap = new Map();
  settlementsAgg.forEach((s) => settlementMap.set(String(s._id), s));

  // 5. Assemble Rows
  const results = [];
  for (const u of userDocs) {
    const sId = String(u._id);
    const adv = advanceMap.get(sId) || {
      total_remaining_balance: 0,
      total_disbursed_amount: 0,
      active_advances_count: 0,
    };
    const exp = expenseMap.get(sId) || {
      unsettled_approved_amount: 0,
      unsettled_approved_count: 0,
      total_settled_amount: 0,
      total_settled_count: 0,
    };
    const set = settlementMap.get(sId) || {
      total_payment_entries: 0,
      payment_entries_count: 0,
    };

    const activeAdvanceBalance = Math.round((adv.total_remaining_balance || 0) * 100) / 100;
    const unsettledApprovedAmount = Math.round((exp.unsettled_approved_amount || 0) * 100) / 100;
    const totalPaymentEntries = Math.round((set.total_payment_entries || 0) * 100) / 100;
    const netPosition = Math.round((unsettledApprovedAmount - activeAdvanceBalance - totalPaymentEntries) * 100) / 100;

    results.push({
      sales_user: toPlain(u),
      active_advance_balance: activeAdvanceBalance,
      active_advance_count: adv.active_advances_count || 0,
      unsettled_approved_claims_amount: unsettledApprovedAmount,
      unsettled_approved_claims_count: exp.unsettled_approved_count || 0,
      total_settled_claims_amount: Math.round((exp.total_settled_amount || 0) * 100) / 100,
      total_settled_claims_count: exp.total_settled_count || 0,
      total_payment_entries: totalPaymentEntries,
      payment_entries_count: set.payment_entries_count || 0,
      net_position: netPosition,
      position_status:
        netPosition > 0
          ? 'due_to_employee'
          : netPosition < 0
          ? 'due_to_company'
          : 'balanced',
    });
  }

  let filtered = results;
  if (query.search && query.search.trim()) {
    const s = query.search.trim().toLowerCase();
    filtered = results.filter(
      (r) =>
        r.sales_user?.name?.toLowerCase().includes(s) ||
        r.sales_user?.email?.toLowerCase().includes(s) ||
        r.sales_user?.department?.toLowerCase().includes(s)
    );
  }

  // Sort by highest activity / balance
  filtered.sort((a, b) => {
    const actA = a.active_advance_balance + a.unsettled_approved_claims_amount + (a.total_payment_entries || 0) + Math.abs(a.net_position);
    const actB = b.active_advance_balance + b.unsettled_approved_claims_amount + (b.total_payment_entries || 0) + Math.abs(b.net_position);
    return actB - actA;
  });

  const limit = Math.min(parseInt(query.limit, 10) || 50, 1000);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const skip = (page - 1) * limit;
  const paginated = filtered.slice(skip, skip + limit);

  return {
    total: filtered.length,
    page,
    limit,
    pages: Math.ceil(filtered.length / limit) || 0,
    data: paginated,
  };
}

/**
 * Returns unified chronological financial ledger / passbook for a given executive.
 */
async function getExecutivePassbook(targetUserId, query = {}, actor) {
  const { User, WorkPlan, WorkPlanExpense, WorkPlanTourAdvance, WorkPlanExpenseSettlement } = getModels();
  const rawTarget =
    targetUserId && targetUserId !== 'me' && targetUserId !== 'null' && targetUserId !== 'undefined'
      ? String(targetUserId)
      : String(userId(actor) || '');

  const actorId = String(userId(actor) || '');
  if (rawTarget && rawTarget !== actorId) {
    await assertAuthorityOverSalesUser(rawTarget, actor, 'view financial passbook for');
  }

  const userDoc = await User.findOne({
    $or: [{ _id: asObjectId(rawTarget) }, { id: rawTarget }].filter(Boolean),
  })
    .select('_id name email department phone')
    .lean();

  const finalTargetId = userDoc ? String(userDoc._id) : rawTarget;
  const userMatchIds = buildMatchUserIds([finalTargetId, rawTarget]);
  const userPlanIds = await WorkPlan.find({
    sales_user: { $in: userMatchIds },
    deletedAt: null,
  }).distinct('_id');

  const [advances, expenses, settlements] = await Promise.all([
    WorkPlanTourAdvance.find({
      sales_user: { $in: userMatchIds },
      deletedAt: null,
    })
      .populate('approved_by', 'name email')
      .populate('disbursed_by', 'name email')
      .populate('attachments')
      .populate('disbursement_attachments')
      .lean(),
    WorkPlanExpense.find({
      deletedAt: null,
      $or: [
        { sales_user: { $in: userMatchIds } },
        { work_plan: { $in: userPlanIds } },
      ],
    })
      .populate('work_plan', 'plan_date title sales_user plan_type location')
      .populate('approved_by', 'name email')
      .populate('receipt_attachment')
      .populate('attachments')
      .lean(),
    WorkPlanExpenseSettlement.find({
      deletedAt: null,
      $or: [
        { sales_user: { $in: userMatchIds } },
      ],
    })
      .populate('settled_by', 'name email')
      .lean(),
  ]);

  const rawLedger = [];

  // 1. Tour Advances: Requested, Approved, Disbursed, Refunds, Rejected
  for (const adv of advances) {
    const advRef = adv.advance_number || `ADV-${String(adv._id).slice(-6).toUpperCase()}`;

    // A. Pending Requisition
    if (adv.status === 'pending') {
      const reqDate = adv.request_date || adv.createdAt;
      const reqAmount = Number(adv.amount || 0);
      rawLedger.push({
        id: `ADV-REQ-${adv._id}`,
        advance_id: String(adv._id),
        entry_type: 'advance_requested',
        advance_status: 'pending',
        date: reqDate,
        reference: advRef,
        title: `Tour Advance Requested (${adv.purpose || 'Tour'})`,
        amount: reqAmount,
        impact_advance_balance: 0,
        impact_payment_entry: 0,
        impact_claim_receivable: 0,
        payment_method: 'Advance Request',
        actor_name: userDoc?.name || 'Self',
        details: adv.purpose || 'Tour advance request pending approval',
        attachments: adv.attachments || [],
        attachment_details: adv.attachment_details || (Array.isArray(adv.attachments) ? adv.attachments : []),
      });
    }

    // B. Approved Awaiting Disbursement
    if (adv.status === 'approved' && !adv.disbursed_at) {
      const appDate = adv.approved_at || adv.updatedAt || adv.createdAt;
      const appAmount = Number(adv.amount || 0);
      rawLedger.push({
        id: `ADV-APP-${adv._id}`,
        advance_id: String(adv._id),
        entry_type: 'advance_approved',
        advance_status: 'approved',
        date: appDate,
        reference: advRef,
        title: `Tour Advance Approved (${adv.purpose || 'Tour'})`,
        amount: appAmount,
        impact_advance_balance: 0,
        impact_payment_entry: 0,
        impact_claim_receivable: 0,
        payment_method: 'Approved (Pending Payout)',
        actor_name: adv.approved_by?.name || 'Manager',
        approved_by: adv.approved_by,
        details: 'Tour advance approved — awaiting disbursement by treasury / finance',
        attachments: adv.attachments || [],
        attachment_details: adv.attachment_details || (Array.isArray(adv.attachments) ? adv.attachments : []),
      });
    }

    // C. Disbursed Advance
    if (adv.disbursed_at || ['disbursed', 'settled', 'recovered', 'refunded'].includes(adv.status)) {
      const disbDate = adv.disbursed_at || adv.updatedAt || adv.createdAt;
      const disbAmount = adv.disbursed_amount || adv.amount || 0;
      if (disbAmount > 0) {
        rawLedger.push({
          id: `ADV-DISB-${adv._id}`,
          advance_id: String(adv._id),
          entry_type: 'advance_disbursement',
          advance_status: adv.status,
          date: disbDate,
          reference: advRef,
          title: `Tour Advance Disbursed (${adv.purpose || 'Tour'})`,
          amount: disbAmount,
          impact_advance_balance: +disbAmount,
          impact_payment_entry: 0,
          impact_claim_receivable: 0,
          payment_method: adv.payment_method || 'Bank Transfer',
          transaction_reference: adv.transaction_reference,
          actor_name: adv.disbursed_by?.name || 'Finance Authority',
          approved_by: adv.approved_by,
          disbursed_by: adv.disbursed_by,
          details: adv.disbursement_notes || adv.purpose || 'Tour advance funds disbursed',
          attachments: adv.disbursement_attachments || adv.attachments || [],
          attachment_details: adv.disbursement_attachments || adv.attachment_details || [],
        });
      }
    }

    // D. Refunds
    if (Array.isArray(adv.refunds) && adv.refunds.length > 0) {
      for (const ref of adv.refunds) {
        const refAmount = ref.amount || 0;
        if (refAmount > 0) {
          rawLedger.push({
            id: `ADV-REF-${adv._id}-${ref._id || ref.refund_date}`,
            advance_id: String(adv._id),
            entry_type: 'advance_refund',
            advance_status: 'refunded',
            date: ref.refund_date || ref.accepted_at || adv.updatedAt,
            reference: advRef,
            title: `Tour Advance Refund (${adv.advance_number || 'Advance'})`,
            amount: refAmount,
            impact_advance_balance: -refAmount,
            impact_payment_entry: 0,
            impact_claim_receivable: 0,
            payment_method: ref.payment_method || 'Bank Transfer',
            transaction_reference: ref.transaction_reference,
            actor_name: ref.accepted_by ? (ref.accepted_by?.name || 'Manager / Finance') : 'Company',
            refunded_by: adv.refunded_by || (typeof ref.accepted_by === 'object' ? ref.accepted_by : undefined),
            details: ref.notes || 'Unspent advance refunded back to company',
            attachments: ref.attachments || [],
            attachment_details: ref.attachment_details || [],
          });
        }
      }
    } else if (Number(adv.refunded_amount || 0) > 0) {
      const refAmount = Number(adv.refunded_amount);
      rawLedger.push({
        id: `ADV-REF-${adv._id}`,
        advance_id: String(adv._id),
        entry_type: 'advance_refund',
        advance_status: 'refunded',
        date: adv.refunded_at || adv.updatedAt || adv.createdAt,
        reference: advRef,
        title: `Tour Advance Refund (${adv.advance_number || 'Advance'})`,
        amount: refAmount,
        impact_advance_balance: -refAmount,
        impact_payment_entry: 0,
        impact_claim_receivable: 0,
        payment_method: adv.refund_reference ? 'Bank / UPI' : 'Refund',
        transaction_reference: adv.refund_reference,
        actor_name: adv.refunded_by?.name || 'Finance Authority',
        refunded_by: adv.refunded_by,
        details: adv.refund_notes || 'Unspent advance refunded back to company',
      });
    }

    // E. Rejected Advance
    if (adv.status === 'rejected') {
      const rejDate = adv.approved_at || adv.updatedAt || adv.createdAt;
      const rejAmount = Number(adv.amount || 0);
      rawLedger.push({
        id: `ADV-REJ-${adv._id}`,
        advance_id: String(adv._id),
        entry_type: 'advance_rejected',
        advance_status: 'rejected',
        date: rejDate,
        reference: advRef,
        title: `Rejected Tour Advance (${adv.purpose || 'Advance'})`,
        amount: rejAmount,
        impact_advance_balance: 0,
        impact_payment_entry: 0,
        impact_claim_receivable: 0,
        payment_method: 'Advance Request',
        actor_name: adv.approved_by?.name || 'Manager / Authority',
        approved_by: adv.approved_by,
        details: adv.rejection_reason ? `Rejected: ${adv.rejection_reason}` : (adv.purpose || 'Tour advance request rejected'),
        rejection_reason: adv.rejection_reason || 'Advance request rejected',
        remarks: adv.rejection_reason || 'Advance request rejected',
        attachments: adv.attachments || [],
        attachment_details: adv.attachment_details || (Array.isArray(adv.attachments) ? adv.attachments : []),
      });
    }
  }

  // 2. Expense Claims (Approved, Submitted, Rejected, Draft)
  let draftClaimsAmount = 0;
  let draftClaimsCount = 0;
  let submittedClaimsAmount = 0;
  let submittedClaimsCount = 0;
  let approvedClaimsAmount = 0;
  let approvedClaimsCount = 0;

  for (const rawExp of expenses) {
    const exp = (await withFreshExpenseAttachmentUrls(rawExp).catch(() => rawExp)) || rawExp;
    const effectiveOwner = resolveEffectiveSalesUser(exp, exp.work_plan);
    if (effectiveOwner && !userMatchIds.map(String).includes(String(effectiveOwner))) continue;

    const allAtts = [];
    const seenAttIds = new Set();
    const addUniqueAtt = (item) => {
      if (!item) return;
      const idKey = String(typeof item === 'object' ? (item._id || item.attachment_id || item.filename || item.url) : item);
      if (idKey && !seenAttIds.has(idKey)) {
        seenAttIds.add(idKey);
        if (typeof item === 'object') allAtts.push(item);
        else allAtts.push({ _id: item, original_name: 'Attachment' });
      }
    };
    if (exp.receipt_attachment) addUniqueAtt(exp.receipt_attachment);
    if (Array.isArray(exp.attachments)) {
      for (const a of exp.attachments) addUniqueAtt(a);
    }

    if (exp.status === 'draft' && (exp.amount || 0) > 0) {
      draftClaimsAmount += Number(exp.amount) || 0;
      draftClaimsCount += 1;
      const expDate = exp.expense_date || exp.createdAt;
      rawLedger.push({
        id: `EXP-DRAFT-${exp._id}`,
        expense_id: String(exp._id),
        entry_type: 'expense_draft',
        claim_status: 'draft',
        date: expDate,
        reference: exp.bill_number || `EXP-${String(exp._id).slice(-6).toUpperCase()}`,
        title: `Draft Expense Claim (${exp.category || 'General'})`,
        amount: exp.amount,
        impact_advance_balance: 0,
        impact_payment_entry: 0,
        impact_claim_receivable: 0,
        actor_name: userDoc?.name || 'Self',
        details: exp.description || exp.category || 'Draft field expense claim (Unsubmitted)',
        category: exp.category,
        sub_category: exp.sub_category,
        vendor_name: exp.vendor_name,
        attachments: exp.attachments || [],
        attachment_details: allAtts,
      });
    } else if (exp.status === 'submitted' && (exp.amount || 0) > 0) {
      submittedClaimsAmount += Number(exp.amount) || 0;
      submittedClaimsCount += 1;
      const expDate = exp.submitted_at || exp.expense_date || exp.createdAt;
      rawLedger.push({
        id: `EXP-SUB-${exp._id}`,
        expense_id: String(exp._id),
        entry_type: 'expense_submitted',
        claim_status: 'submitted',
        date: expDate,
        reference: exp.bill_number || `EXP-${String(exp._id).slice(-6).toUpperCase()}`,
        title: `Submitted Expense Claim (${exp.category || 'General'})`,
        amount: exp.amount,
        impact_advance_balance: 0,
        impact_payment_entry: 0,
        impact_claim_receivable: 0,
        actor_name: userDoc?.name || 'Self',
        details: exp.description || exp.category || 'Field expense claim submitted for approval',
        category: exp.category,
        sub_category: exp.sub_category,
        vendor_name: exp.vendor_name,
        attachments: exp.attachments || [],
        attachment_details: allAtts,
      });
    } else if (exp.status === 'approved' && (exp.amount || 0) > 0) {
      approvedClaimsAmount += Number(exp.amount) || 0;
      approvedClaimsCount += 1;
      const expDate = exp.approved_at || exp.expense_date || exp.createdAt;
      rawLedger.push({
        id: `EXP-APP-${exp._id}`,
        expense_id: String(exp._id),
        entry_type: 'expense_approved',
        claim_status: 'approved',
        date: expDate,
        reference: exp.bill_number || `EXP-${String(exp._id).slice(-6).toUpperCase()}`,
        title: `Approved Expense Claim (${exp.category || 'General'})`,
        amount: exp.amount,
        impact_advance_balance: 0,
        impact_payment_entry: 0,
        impact_claim_receivable: +exp.amount,
        actor_name: exp.approved_by?.name || 'Manager',
        approved_by: exp.approved_by,
        details: exp.description || exp.category || 'Verified field expense claim',
        category: exp.category,
        sub_category: exp.sub_category,
        vendor_name: exp.vendor_name,
        settlement_status: exp.settlement_status || 'unsettled',
        attachments: exp.attachments || [],
        attachment_details: allAtts,
      });
    } else if (exp.status === 'rejected' && (exp.amount || 0) > 0) {
      const expDate = exp.updatedAt || exp.expense_date || exp.createdAt;
      rawLedger.push({
        id: `EXP-REJ-${exp._id}`,
        expense_id: String(exp._id),
        entry_type: 'expense_rejected',
        claim_status: 'rejected',
        date: expDate,
        reference: exp.bill_number || `EXP-${String(exp._id).slice(-6).toUpperCase()}`,
        title: `Rejected Expense Claim (${exp.category || 'General'})`,
        amount: exp.amount,
        impact_advance_balance: 0,
        impact_payment_entry: 0,
        impact_claim_receivable: 0,
        actor_name: exp.approved_by?.name || 'Manager',
        approved_by: exp.approved_by,
        details: exp.rejection_reason ? `Rejected: ${exp.rejection_reason}` : (exp.description || 'Expense claim rejected'),
        category: exp.category,
        sub_category: exp.sub_category,
        vendor_name: exp.vendor_name,
        attachments: exp.attachments || [],
        attachment_details: allAtts,
      });
    }
  }

  // 3. Settlements & Direct Payment Entries
  for (const set of settlements) {
    const setDate = set.settlement_date || set.settled_at || set.createdAt;

    if (set.settlement_mode === 'payment_entry') {
      const payAmount = set.direct_payment_amount || set.amount || 0;
      rawLedger.push({
        id: `PAY-ENTRY-${set._id}`,
        settlement_id: String(set._id),
        entry_type: 'payment_entry',
        date: setDate,
        reference: set.settlement_number || `PAY-${String(set._id).slice(-6).toUpperCase()}`,
        title: set.settlement_notes || `Direct Treasury Payment Entry`,
        amount: payAmount,
        advance_deduction_amount: 0,
        payment_entry_deduction_amount: 0,
        direct_payment_amount: payAmount,
        impact_advance_balance: 0,
        impact_payment_entry: +payAmount,
        impact_claim_receivable: 0,
        payment_method: set.payment_method || 'Bank Transfer',
        transaction_reference: set.transaction_reference,
        actor_name: set.settled_by?.name || 'Finance Authority',
        settled_by: set.settled_by,
        details: set.settlement_notes || `Direct Treasury payment of ₹${Number(payAmount).toLocaleString('en-IN')}`,
      });
      continue;
    }

    rawLedger.push({
      id: `SETTLE-${set._id}`,
      settlement_id: String(set._id),
      entry_type: 'settlement_voucher',
      date: setDate,
      reference: set.settlement_number || `SETTLE-${String(set._id).slice(-6).toUpperCase()}`,
      title: `Expense Settlement Voucher #${set.settlement_number || ''}`,
      amount: set.total_claim_amount || 0,
      advance_deduction_amount: set.advance_deduction_amount || 0,
      payment_entry_deduction_amount: set.payment_entry_deduction_amount || 0,
      direct_payment_amount: set.direct_payment_amount || 0,
      impact_advance_balance: -(set.advance_deduction_amount || 0),
      impact_payment_entry: -(set.payment_entry_deduction_amount || 0),
      impact_claim_receivable: -(set.total_claim_amount || 0),
      payment_method: set.payment_method,
      transaction_reference: set.transaction_reference,
      actor_name: set.settled_by?.name || 'Finance Authority',
      settled_by: set.settled_by,
      details: set.settlement_notes || `Settled ${set.claims?.length || 0} claims (Adv Ded: ₹${set.advance_deduction_amount || 0}, Pay Offset: ₹${set.payment_entry_deduction_amount || 0}, Paid: ₹${set.direct_payment_amount || 0})`,
    });
  }

  // Chronological sort with type priority so on matching dates/timestamps:
  // Advances disbursed first, then expenses approved, then settlements applied, then refunds
  const typePriority = {
    advance_disbursement: 1,
    advance_approved: 2,
    advance_requested: 3,
    expense_draft: 4,
    expense_submitted: 5,
    expense_approved: 6,
    settlement_voucher: 7,
    payment_entry: 8,
    advance_refund: 9,
    advance_rejected: 10,
    expense_rejected: 11,
  };
  rawLedger.sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (diff !== 0) return diff;
    return (typePriority[a.entry_type] || 50) - (typePriority[b.entry_type] || 50);
  });

  // Calculate Lifetime Balances across entire history
  let lifetimeAdvance = 0;
  let lifetimePaymentEntry = 0;
  let lifetimeReceivable = 0;
  for (const item of rawLedger) {
    lifetimeAdvance += item.impact_advance_balance || 0;
    lifetimePaymentEntry += item.impact_payment_entry || 0;
    lifetimeReceivable += item.impact_claim_receivable || 0;
  }

  // Handle Date Filtering with Opening Balance
  const fromDate = query.from_date || query.from ? startOfDay(query.from_date || query.from) : null;
  const toDate = query.to_date || query.to ? endOfDay(query.to_date || query.to) : null;

  let runningAdvance = 0;
  let runningPaymentEntry = 0;
  let runningReceivable = 0;

  let openingAdvance = 0;
  let openingPaymentEntry = 0;
  let openingReceivable = 0;

  const entries = [];

  for (const item of rawLedger) {
    const itemDate = new Date(item.date);

    if (fromDate && itemDate < fromDate) {
      openingAdvance += item.impact_advance_balance || 0;
      openingPaymentEntry += item.impact_payment_entry || 0;
      openingReceivable += item.impact_claim_receivable || 0;
      runningAdvance += item.impact_advance_balance || 0;
      runningPaymentEntry += item.impact_payment_entry || 0;
      runningReceivable += item.impact_claim_receivable || 0;
      continue;
    }

    if (toDate && itemDate > toDate) {
      // Future item beyond date filter: does not affect filtered period balance or entries
      continue;
    }

    runningAdvance += item.impact_advance_balance || 0;
    runningPaymentEntry += item.impact_payment_entry || 0;
    runningReceivable += item.impact_claim_receivable || 0;

    const runningNet = Math.round((runningReceivable - runningAdvance - runningPaymentEntry) * 100) / 100;

    entries.push({
      ...item,
      running_advance_balance: Math.round(runningAdvance * 100) / 100,
      running_payment_entry: Math.round(runningPaymentEntry * 100) / 100,
      running_claim_receivable: Math.round(runningReceivable * 100) / 100,
      running_net_position: runningNet,
    });
  }

  return {
    sales_user: toPlain(userDoc) || { _id: finalTargetId, name: 'Executive' },
    opening_advance_balance: Math.round(openingAdvance * 100) / 100,
    opening_payment_entry: Math.round(openingPaymentEntry * 100) / 100,
    opening_claim_receivable: Math.round(openingReceivable * 100) / 100,
    opening_net_position: Math.round((openingReceivable - openingAdvance - openingPaymentEntry) * 100) / 100,
    current_advance_balance: Math.round(runningAdvance * 100) / 100,
    current_payment_entry: Math.round(runningPaymentEntry * 100) / 100,
    total_payment_entries: Math.round(runningPaymentEntry * 100) / 100,
    current_claim_receivable: Math.round(runningReceivable * 100) / 100,
    current_net_position: Math.round((runningReceivable - runningAdvance - runningPaymentEntry) * 100) / 100,
    lifetime_advance_balance: Math.round(lifetimeAdvance * 100) / 100,
    lifetime_payment_entry: Math.round(lifetimePaymentEntry * 100) / 100,
    lifetime_claim_receivable: Math.round(lifetimeReceivable * 100) / 100,
    lifetime_net_position: Math.round((lifetimeReceivable - lifetimeAdvance - lifetimePaymentEntry) * 100) / 100,
    draft_claim_amount: Math.round(draftClaimsAmount * 100) / 100,
    draft_claim_count: draftClaimsCount,
    submitted_claim_amount: Math.round(submittedClaimsAmount * 100) / 100,
    submitted_claim_count: submittedClaimsCount,
    approved_claim_amount: Math.round(approvedClaimsAmount * 100) / 100,
    approved_claim_count: approvedClaimsCount,
    entries: entries.reverse(), // most recent first for UI
  };
}

/**
 * Returns overall high-level KPI metrics for the expense domain dashboard.
 */
async function getExpenseKpiSummary(query = {}, actor) {
  const { WorkPlanExpense, WorkPlanTourAdvance, WorkPlanExpenseSettlement } = getModels();

  let targetUserIds = null;
  const visible = await getVisibleSalesUserIds(actor);
  const requestedUser = query.sales_user || query.user_id;

  if (query.scope === 'mine') {
    targetUserIds = [String(userId(actor))];
  } else if (requestedUser && requestedUser !== 'all') {
    targetUserIds = [String(requestedUser)];
  } else if (visible !== null) {
    targetUserIds = visible;
  }

  const matchUserIds = targetUserIds ? buildMatchUserIds(targetUserIds) : null;

  const fromDate = query.from_date || query.from;
  const toDate = query.to_date || query.to;

  // Expense Aggregation Pipeline
  const expensePipeline = [
    {
      $match: {
        deletedAt: null,
      },
    },
    {
      $lookup: {
        from: 'workplans',
        localField: 'work_plan',
        foreignField: '_id',
        as: 'parent_plan',
      },
    },
    {
      $unwind: {
        path: '$parent_plan',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        $or: [
          { 'parent_plan.deletedAt': null },
          { 'parent_plan.deletedAt': { $exists: false } },
        ],
      },
    },
    {
      $addFields: {
        effective_sales_user: {
          $ifNull: ['$sales_user', '$parent_plan.sales_user'],
        },
      },
    },
  ];

  const selfId = String(userId(actor) || '');
  const isMineScope = query.scope === 'mine' || (requestedUser && String(requestedUser) === selfId);

  // Drafts of subordinates are private and must not be populated in team metrics
  if (!isMineScope) {
    if (selfId) {
      expensePipeline.push({
        $match: {
          $or: [
            { sales_user: asObjectId(selfId), status: 'draft' },
            { status: { $ne: 'draft' } },
          ],
        },
      });
    } else {
      expensePipeline.push({
        $match: {
          status: { $ne: 'draft' },
        },
      });
    }
  }

  const expenseMatch = {};
  if (matchUserIds && matchUserIds.length > 0) {
    expenseMatch.effective_sales_user = { $in: matchUserIds };
  }
  if (fromDate || toDate) {
    expenseMatch.expense_date = {};
    if (fromDate) expenseMatch.expense_date.$gte = startOfDay(fromDate);
    if (toDate) expenseMatch.expense_date.$lte = endOfDay(toDate);
  }

  if (Object.keys(expenseMatch).length > 0) {
    expensePipeline.push({ $match: expenseMatch });
  }

  expensePipeline.push({
    $group: {
      _id: null,
      total_logged_amount: { $sum: '$amount' },
      total_logged_count: { $sum: 1 },
      pending_approval_amount: {
        $sum: {
          $cond: [{ $eq: ['$status', 'submitted'] }, '$amount', 0],
        },
      },
      pending_approval_count: {
        $sum: {
          $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0],
        },
      },
      approved_unsettled_amount: {
        $sum: {
          $cond: [
            {
              $and: [
                { $eq: ['$status', 'approved'] },
                { $ne: ['$settlement_status', 'settled'] },
              ],
            },
            { $subtract: ['$amount', { $ifNull: ['$settled_amount', 0] }] },
            0,
          ],
        },
      },
      approved_unsettled_count: {
        $sum: {
          $cond: [
            {
              $and: [
                { $eq: ['$status', 'approved'] },
                { $ne: ['$settlement_status', 'settled'] },
              ],
            },
            1,
            0,
          ],
        },
      },
    },
  });

  // Advance filter
  const advanceFilter = {
    status: { $in: ['disbursed', 'recovered', 'refunded'] },
    remaining_balance: { $gt: 0 },
    deletedAt: null,
  };
  if (matchUserIds && matchUserIds.length > 0) {
    advanceFilter.sales_user = { $in: matchUserIds };
  }
  if (fromDate || toDate) {
    advanceFilter.request_date = {};
    if (fromDate) advanceFilter.request_date.$gte = startOfDay(fromDate);
    if (toDate) advanceFilter.request_date.$lte = endOfDay(toDate);
  }

  // Settlement filter
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const settlementFilter = {
    deletedAt: null,
    settlement_date: { $gte: startOfMonth },
  };
  if (matchUserIds && matchUserIds.length > 0) {
    settlementFilter.sales_user = { $in: matchUserIds };
  }

  const [claimsAgg, advancesAgg, settlementsAgg] = await Promise.all([
    WorkPlanExpense.aggregate(expensePipeline),
    WorkPlanTourAdvance.aggregate([
      { $match: advanceFilter },
      {
        $group: {
          _id: null,
          active_advances_amount: { $sum: '$remaining_balance' },
          active_advances_count: { $sum: 1 },
        },
      },
    ]),
    WorkPlanExpenseSettlement.aggregate([
      { $match: settlementFilter },
      {
        $group: {
          _id: null,
          settled_this_month_amount: { $sum: '$total_claim_amount' },
          settled_this_month_count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const claims = claimsAgg[0] || {};
  const advances = advancesAgg[0] || {};
  const settlements = settlementsAgg[0] || {};

  return {
    total_claims_logged: {
      amount: claims.total_logged_amount || 0,
      count: claims.total_logged_count || 0,
    },
    pending_approval: {
      amount: claims.pending_approval_amount || 0,
      count: claims.pending_approval_count || 0,
    },
    approved_unsettled: {
      amount: claims.approved_unsettled_amount || 0,
      count: claims.approved_unsettled_count || 0,
    },
    active_tour_advances: {
      amount: advances.active_advances_amount || 0,
      count: advances.active_advances_count || 0,
    },
    settled_this_month: {
      amount: settlements.settled_this_month_amount || 0,
      count: settlements.settled_this_month_count || 0,
    },
  };
}

module.exports = {
  getExecutiveBalances,
  getExecutivePassbook,
  getExpenseKpiSummary,
};
