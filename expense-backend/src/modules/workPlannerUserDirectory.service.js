/**
 * @fileoverview Service to query and enrich all Work Planner portal access users with their expense KPIs & ledger balances.
 * @module modules/workPlannerUserDirectory.service
 */
const { getModels } = require('../data/mongoRegistry');
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
 * Finds all active users that have access to the 'work_planner' portal.
 */
async function getWorkPlannerUsersQuery(query = {}) {
  const { User } = getModels();

  const filter = {
    is_active: { $ne: false },
    portals: {
      $elemMatch: {
        portal_code: 'work_planner',
        access_roles: { $in: ['executive', 'coordinator', 'manager', 'admin'] },
      },
    },
  };

  const search = String(query.search || query.q || '').trim();
  if (search) {
    const rgx = new RegExp(search, 'i');
    filter.$or = [
      { name: rgx },
      { email: rgx },
      { department: rgx },
      { phone: rgx },
    ];
  }

  const users = await User.find(filter)
    .select('_id name email department phone portals is_active createdAt')
    .lean();

  return users.map((u) => {
    const wpPortal = (u.portals || []).find((p) => p?.portal_code === 'work_planner');
    const roles = Array.isArray(wpPortal?.access_roles) ? wpPortal.access_roles : [];
    return {
      _id: String(u._id),
      name: u.name,
      email: u.email,
      department: u.department || 'sales',
      phone: u.phone || '',
      wp_roles: roles,
      wp_role: roles[0] || 'executive',
      is_active: u.is_active !== false,
      createdAt: u.createdAt,
    };
  });
}

/**
 * Lists all Work Planner portal users enriched with current expense and advance financial metrics.
 */
async function listWorkPlannerUsersWithFinancials(query = {}) {
  const { WorkPlanExpense, WorkPlanTourAdvance } = getModels();

  const users = await getWorkPlannerUsersQuery(query);
  if (users.length === 0) {
    return { total: 0, users: [] };
  }

  const userIds = users.map((u) => u._id);
  const userOids = userIds.map(asObjectId).filter(Boolean);
  const matchIds = Array.from(new Set([...userIds, ...userOids]));

  // 1. Aggregate Expenses per User
  const expensesAgg = await WorkPlanExpense.aggregate([
    {
      $match: {
        sales_user: { $in: matchIds },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: '$sales_user',
        total_claims_count: { $sum: 1 },
        total_claims_amount: { $sum: '$amount' },
        pending_approval_count: {
          $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] },
        },
        pending_approval_amount: {
          $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, '$amount', 0] },
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
        total_settled_amount: {
          $sum: {
            $cond: [{ $eq: ['$settlement_status', 'settled'] }, '$amount', 0],
          },
        },
      },
    },
  ]);

  const expenseStatsMap = new Map();
  expensesAgg.forEach((agg) => expenseStatsMap.set(String(agg._id), agg));

  // 2. Aggregate Advances per User
  const advancesAgg = await WorkPlanTourAdvance.aggregate([
    {
      $match: {
        sales_user: { $in: matchIds },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: '$sales_user',
        total_advances_count: { $sum: 1 },
        pending_advances_count: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
        },
        pending_advances_amount: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] },
        },
        approved_advances_count: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
        },
        approved_advances_amount: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0] },
        },
        active_advances_count: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', ['disbursed', 'recovered', 'refunded']] },
                  { $gt: ['$remaining_balance', 0] },
                ],
              },
              1,
              0,
            ],
          },
        },
        active_advances_balance: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', ['disbursed', 'recovered', 'refunded']] },
                  { $gt: ['$remaining_balance', 0] },
                ],
              },
              '$remaining_balance',
              0,
            ],
          },
        },
        total_disbursed_amount: {
          $sum: { $ifNull: ['$disbursed_amount', 0] },
        },
      },
    },
  ]);

  const advanceStatsMap = new Map();
  advancesAgg.forEach((agg) => advanceStatsMap.set(String(agg._id), agg));

  // Assemble enriched users
  const enriched = users.map((u) => {
    const exp = expenseStatsMap.get(u._id) || {
      total_claims_count: 0,
      total_claims_amount: 0,
      pending_approval_count: 0,
      pending_approval_amount: 0,
      approved_unsettled_count: 0,
      approved_unsettled_amount: 0,
      total_settled_amount: 0,
    };

    const adv = advanceStatsMap.get(u._id) || {
      total_advances_count: 0,
      pending_advances_count: 0,
      pending_advances_amount: 0,
      approved_advances_count: 0,
      approved_advances_amount: 0,
      active_advances_count: 0,
      active_advances_balance: 0,
      total_disbursed_amount: 0,
    };

    const netBalance = (exp.approved_unsettled_amount || 0) - (adv.active_advances_balance || 0);

    return {
      ...u,
      metrics: {
        pending_approval_count: exp.pending_approval_count,
        pending_approval_amount: exp.pending_approval_amount,
        approved_unsettled_count: exp.approved_unsettled_count,
        approved_unsettled_amount: exp.approved_unsettled_amount,
        pending_advances_count: adv.pending_advances_count,
        pending_advances_amount: adv.pending_advances_amount,
        approved_advances_count: adv.approved_advances_count,
        approved_advances_amount: adv.approved_advances_amount,
        active_advances_count: adv.active_advances_count,
        active_advances_balance: adv.active_advances_balance,
        total_disbursed_amount: adv.total_disbursed_amount,
        total_settled_amount: exp.total_settled_amount,
        net_balance: netBalance,
        position_type: netBalance > 0 ? 'company_payable' : netBalance < 0 ? 'advance_receivable' : 'settled',
      },
    };
  });

  return {
    total: enriched.length,
    users: enriched,
  };
}

module.exports = {
  getWorkPlannerUsersQuery,
  listWorkPlannerUsersWithFinancials,
};

