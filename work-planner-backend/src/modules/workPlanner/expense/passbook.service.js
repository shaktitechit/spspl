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

function buildMatchUserIds(userIds = []) {
  const strIds = userIds.map((id) => String(id?._id || id)).filter(Boolean);
  const objIds = strIds.map(asObjectId).filter(Boolean);
  return Array.from(new Set([...strIds, ...objIds]));
}

/**
 * Computes executive balances and net financial positions for visible users.
 */
async function getExecutiveBalances(query = {}, actor) {
  const { User, WorkPlanExpense, WorkPlanTourAdvance } = getModels();

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

  // 4. Assemble Rows
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

    const activeAdvanceBalance = Math.round((adv.total_remaining_balance || 0) * 100) / 100;
    const unsettledApprovedAmount = Math.round((exp.unsettled_approved_amount || 0) * 100) / 100;
    const netPosition = Math.round((unsettledApprovedAmount - activeAdvanceBalance) * 100) / 100;

    results.push({
      sales_user: toPlain(u),
      active_advance_balance: activeAdvanceBalance,
      active_advance_count: adv.active_advances_count || 0,
      unsettled_approved_claims_amount: unsettledApprovedAmount,
      unsettled_approved_claims_count: exp.unsettled_approved_count || 0,
      total_settled_claims_amount: Math.round((exp.total_settled_amount || 0) * 100) / 100,
      total_settled_claims_count: exp.total_settled_count || 0,
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
    const actA = a.active_advance_balance + a.unsettled_approved_claims_amount + Math.abs(a.net_position);
    const actB = b.active_advance_balance + b.unsettled_approved_claims_amount + Math.abs(b.net_position);
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
  const targetId = String(targetUserId || userId(actor));

  if (targetId !== String(userId(actor))) {
    await assertAuthorityOverSalesUser(targetId, actor, 'view financial passbook for');
  }

  const userDoc = await User.findById(asObjectId(targetId))
    .select('_id name email department phone')
    .lean();

  const userMatchIds = buildMatchUserIds([targetId]);
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
      .lean(),
    WorkPlanExpense.find({
      deletedAt: null,
      $or: [
        { sales_user: { $in: userMatchIds } },
        {
          $and: [
            { sales_user: { $in: [null, undefined] } },
            { work_plan: { $in: userPlanIds } },
          ],
        },
      ],
    })
      .populate('work_plan', 'plan_date title sales_user')
      .populate('approved_by', 'name email')
      .lean(),
    WorkPlanExpenseSettlement.find({
      sales_user: { $in: userMatchIds },
      deletedAt: null,
    })
      .populate('settled_by', 'name email')
      .lean(),
  ]);

  const rawLedger = [];

  // 1. Tour Advances: Disbursements and Refunds
  for (const adv of advances) {
    if (adv.disbursed_at || ['disbursed', 'settled', 'recovered', 'refunded'].includes(adv.status)) {
      const disbDate = adv.disbursed_at || adv.updatedAt || adv.createdAt;
      const disbAmount = adv.disbursed_amount || adv.amount || 0;
      if (disbAmount > 0) {
        rawLedger.push({
          id: `ADV-DISB-${adv._id}`,
          entry_type: 'advance_disbursement',
          date: disbDate,
          reference: adv.advance_number || `ADV-${String(adv._id).slice(-6).toUpperCase()}`,
          title: `Tour Advance Disbursed (${adv.purpose || 'Tour'})`,
          amount: disbAmount,
          impact_advance_balance: +disbAmount,
          impact_claim_receivable: 0,
          payment_method: adv.payment_method || 'Bank Transfer',
          transaction_reference: adv.transaction_reference,
          actor_name: adv.disbursed_by?.name || 'Finance Authority',
          details: adv.disbursement_notes || adv.purpose || 'Tour advance funds disbursed',
        });
      }
    }

    if (Array.isArray(adv.refunds)) {
      for (const ref of adv.refunds) {
        const refAmount = ref.amount || 0;
        if (refAmount > 0) {
          rawLedger.push({
            id: `ADV-REF-${adv._id}-${ref._id || ref.refund_date}`,
            entry_type: 'advance_refund',
            date: ref.refund_date || ref.accepted_at || adv.updatedAt,
            reference: adv.advance_number || `ADV-${String(adv._id).slice(-6).toUpperCase()}`,
            title: `Tour Advance Refund (${adv.advance_number || 'Advance'})`,
            amount: refAmount,
            impact_advance_balance: -refAmount,
            impact_claim_receivable: 0,
            payment_method: ref.payment_method || 'bank_transfer',
            transaction_reference: ref.transaction_reference,
            actor_name: ref.accepted_by ? 'Manager / Finance' : 'Company',
            details: ref.notes || 'Unspent advance refunded back to company',
          });
        }
      }
    }
  }

  // 2. Approved Expense Claims
  for (const exp of expenses) {
    const effectiveOwner = resolveEffectiveSalesUser(exp, exp.work_plan);
    if (effectiveOwner && effectiveOwner !== targetId) continue;

    if (exp.status === 'approved' && (exp.amount || 0) > 0) {
      const expDate = exp.approved_at || exp.expense_date || exp.createdAt;
      rawLedger.push({
        id: `EXP-APP-${exp._id}`,
        entry_type: 'expense_approved',
        date: expDate,
        reference: exp.bill_number || `EXP-${String(exp._id).slice(-6).toUpperCase()}`,
        title: `Approved Expense Claim (${exp.category || 'General'})`,
        amount: exp.amount,
        impact_advance_balance: 0,
        impact_claim_receivable: +exp.amount,
        actor_name: exp.approved_by?.name || 'Manager',
        details: exp.description || exp.category || 'Verified field expense claim',
      });
    }
  }

  // 3. Settlements
  for (const set of settlements) {
    const setDate = set.settlement_date || set.settled_at || set.createdAt;
    rawLedger.push({
      id: `SETTLE-${set._id}`,
      entry_type: 'settlement_voucher',
      date: setDate,
      reference: set.settlement_number || `SETTLE-${String(set._id).slice(-6).toUpperCase()}`,
      title: `Expense Settlement Voucher #${set.settlement_number || ''}`,
      amount: set.total_claim_amount || 0,
      advance_deduction_amount: set.advance_deduction_amount || 0,
      direct_payment_amount: set.direct_payment_amount || 0,
      impact_advance_balance: -(set.advance_deduction_amount || 0),
      impact_claim_receivable: -(set.total_claim_amount || 0),
      payment_method: set.payment_method,
      transaction_reference: set.transaction_reference,
      actor_name: set.settled_by?.name || 'Finance Authority',
      details: set.settlement_notes || `Settled ${set.claims?.length || 0} claims (Deducted ₹${set.advance_deduction_amount || 0}, Paid ₹${set.direct_payment_amount || 0})`,
    });
  }

  // Sort chronological
  rawLedger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Handle Date Filtering with Opening Balance
  const fromDate = query.from_date || query.from ? startOfDay(query.from_date || query.from) : null;
  const toDate = query.to_date || query.to ? endOfDay(query.to_date || query.to) : null;

  let runningAdvance = 0;
  let runningReceivable = 0;

  let openingAdvance = 0;
  let openingReceivable = 0;

  const entries = [];

  for (const item of rawLedger) {
    const itemDate = new Date(item.date);

    if (fromDate && itemDate < fromDate) {
      openingAdvance += item.impact_advance_balance || 0;
      openingReceivable += item.impact_claim_receivable || 0;
      runningAdvance += item.impact_advance_balance || 0;
      runningReceivable += item.impact_claim_receivable || 0;
      continue;
    }

    runningAdvance += item.impact_advance_balance || 0;
    runningReceivable += item.impact_claim_receivable || 0;

    if (toDate && itemDate > toDate) {
      continue;
    }

    const runningNet = Math.round((runningReceivable - runningAdvance) * 100) / 100;

    entries.push({
      ...item,
      running_advance_balance: Math.round(runningAdvance * 100) / 100,
      running_claim_receivable: Math.round(runningReceivable * 100) / 100,
      running_net_position: runningNet,
    });
  }

  return {
    sales_user: toPlain(userDoc) || { _id: targetId, name: 'Executive' },
    opening_advance_balance: Math.round(openingAdvance * 100) / 100,
    opening_claim_receivable: Math.round(openingReceivable * 100) / 100,
    opening_net_position: Math.round((openingReceivable - openingAdvance) * 100) / 100,
    current_advance_balance: Math.round(runningAdvance * 100) / 100,
    current_claim_receivable: Math.round(runningReceivable * 100) / 100,
    current_net_position: Math.round((runningReceivable - runningAdvance) * 100) / 100,
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
