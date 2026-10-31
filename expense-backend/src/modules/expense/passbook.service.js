/**
 * @fileoverview Domain service for Executive Passbook, User Ledgers, Running Balances, and Financial KPIs.
 * @module modules/expense/passbook.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { startOfDay, endOfDay } = require('./expense.constants');
const { toPlain } = require('./expense.common');
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
 * Computes high-level KPI metrics for the portal.
 */
async function getExpenseKpiSummary(query = {}) {
  const { WorkPlanExpense, WorkPlanTourAdvance } = getModels();

  const [expenseKpis] = await WorkPlanExpense.aggregate([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: null,
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

  const [advanceKpis] = await WorkPlanTourAdvance.aggregate([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: null,
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

  const exp = expenseKpis || {};
  const adv = advanceKpis || {};

  const netBalance = (exp.approved_unsettled_amount || 0) - (adv.active_advances_balance || 0);

  return {
    pending_approval_claims: exp.pending_approval_count || 0,
    pending_approval_amount: exp.pending_approval_amount || 0,
    approved_unsettled_claims: exp.approved_unsettled_count || 0,
    approved_unsettled_amount: exp.approved_unsettled_amount || 0,
    pending_advances_count: adv.pending_advances_count || 0,
    pending_advances_amount: adv.pending_advances_amount || 0,
    approved_advances_count: adv.approved_advances_count || 0,
    approved_advances_amount: adv.approved_advances_amount || 0,
    active_advances_count: adv.active_advances_count || 0,
    active_advances_balance: adv.active_advances_balance || 0,
    total_disbursed_advances_amount: adv.total_disbursed_amount || 0,
    total_settled_claims_amount: exp.total_settled_amount || 0,
    net_financial_position: netBalance,
    position_type: netBalance > 0 ? 'company_payable' : netBalance < 0 ? 'advance_receivable' : 'settled',
    pending_approval: { amount: exp.pending_approval_amount || 0, count: exp.pending_approval_count || 0 },
    approved_unsettled: { amount: exp.approved_unsettled_amount || 0, count: exp.approved_unsettled_count || 0 },
    active_tour_advances: { amount: adv.active_advances_balance || 0, count: adv.active_advances_count || 0 },
  };
}

/**
 * Computes executive ledger balances for all or specific Work Planner users.
 */
async function getExecutiveBalances(query = {}) {
  const { User, WorkPlanExpense, WorkPlanTourAdvance } = getModels();

  const userFilter = {
    is_active: { $ne: false },
    portals: {
      $elemMatch: {
        portal_code: 'work_planner',
        access_roles: { $in: ['executive', 'coordinator', 'manager', 'admin'] },
      },
    },
  };

  const requestedUser = query.sales_user || query.user_id;
  if (requestedUser && requestedUser !== 'all') {
    userFilter._id = asObjectId(requestedUser) || requestedUser;
  }

  const users = await User.find(userFilter)
    .select('_id name email department phone')
    .sort({ name: 1 })
    .lean();

  if (users.length === 0) {
    return { total: 0, data: [] };
  }

  const userIds = users.map((u) => u._id);
  const matchIds = Array.from(new Set([...userIds, ...userIds.map(String)]));

  // 1. Advances Aggregate
  const advancesAgg = await WorkPlanTourAdvance.aggregate([
    {
      $match: {
        sales_user: { $in: matchIds },
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

  // 2. Expenses Aggregate
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
      },
    },
  ]);

  const expenseMap = new Map();
  expensesAgg.forEach((e) => expenseMap.set(String(e._id), e));

  const results = users.map((u) => {
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
    };

    const netBal = exp.unsettled_approved_amount - adv.total_remaining_balance;
    const posStatus = netBal > 0 ? 'due_to_employee' : netBal < 0 ? 'due_to_company' : 'balanced';

    return {
      sales_user: {
        _id: sId,
        name: u.name,
        email: u.email,
        department: u.department,
        phone: u.phone,
      },
      active_advance_balance: adv.total_remaining_balance,
      total_advances_disbursed: adv.total_disbursed_amount,
      active_advances_count: adv.active_advances_count,
      unsettled_approved_claims: exp.unsettled_approved_amount,
      unsettled_approved_claims_amount: exp.unsettled_approved_amount,
      unsettled_approved_count: exp.unsettled_approved_count,
      total_settled_amount: exp.total_settled_amount,
      net_balance: netBal,
      net_position: netBal,
      position: netBal > 0 ? 'Company Owes User' : netBal < 0 ? 'User Owes Company' : 'Settled',
      position_status: posStatus,
    };
  });

  return {
    total: results.length,
    data: results,
  };
}

/**
 * Builds chronological debit/credit passbook ledger for a single Work Planner user.
 */
async function getExecutivePassbook(targetUserId, query = {}) {
  const { User, WorkPlanExpense, WorkPlanTourAdvance, WorkPlanExpenseSettlement } = getModels();

  const userDoc = await User.findById(targetUserId)
    .select('_id name email department phone')
    .lean();

  if (!userDoc) {
    throw new Error('User not found');
  }

  const uOid = asObjectId(targetUserId);
  const matchUserIds = [targetUserId, String(targetUserId), uOid].filter(Boolean);

  const dateFilter = {};
  if (query.from_date || query.from) {
    dateFilter.$gte = startOfDay(query.from_date || query.from);
  }
  if (query.to_date || query.to) {
    dateFilter.$lte = endOfDay(query.to_date || query.to);
  }

  // 1. Fetch Disbursed Advances (Debit to User = Cash received from company)
  const advFilter = {
    sales_user: { $in: matchUserIds },
    status: { $in: ['disbursed', 'recovered', 'refunded', 'settled'] },
    deletedAt: null,
  };
  if (dateFilter.$gte || dateFilter.$lte) {
    advFilter.disbursed_at = dateFilter;
  }
  const advances = await WorkPlanTourAdvance.find(advFilter).lean();

  // 2. Fetch Approved Claims (Credit to User = Company liability / expense payable)
  const expFilter = {
    sales_user: { $in: matchUserIds },
    status: 'approved',
    deletedAt: null,
  };
  if (dateFilter.$gte || dateFilter.$lte) {
    expFilter.approved_at = dateFilter;
  }
  const expenses = await WorkPlanExpense.find(expFilter).lean();

  // 3. Fetch Settlements (Offsetting transactions)
  const setFilter = {
    sales_user: { $in: matchUserIds },
    deletedAt: null,
  };
  if (dateFilter.$gte || dateFilter.$lte) {
    setFilter.settlement_date = dateFilter;
  }
  const settlements = await WorkPlanExpenseSettlement.find(setFilter).lean();

  // Assemble chronological events
  const ledgerEntries = [];

  // Advances Disbursed (Debit: Increases advance balance held by user)
  advances.forEach((adv) => {
    ledgerEntries.push({
      id: String(adv._id),
      date: adv.disbursed_at || adv.request_date || adv.createdAt,
      type: 'ADVANCE_DISBURSED',
      category: 'Tour Advance',
      reference_number: adv.advance_number,
      description: adv.purpose || 'Tour Advance Disbursed',
      payment_method: adv.payment_method,
      transaction_reference: adv.transaction_reference,
      debit: adv.disbursed_amount || adv.amount, // Advance given
      credit: 0,
      status: adv.status,
    });

    if (adv.refunded_amount > 0 && adv.refunded_at) {
      ledgerEntries.push({
        id: `${adv._id}_refund`,
        date: adv.refunded_at,
        type: 'ADVANCE_REFUND',
        category: 'Advance Refund',
        reference_number: adv.advance_number,
        description: `Refund of unused balance: ${adv.refund_notes || ''}`,
        payment_method: 'Refund',
        transaction_reference: adv.refund_reference,
        debit: 0,
        credit: adv.refunded_amount, // Refund reduces advance liability
        status: 'refunded',
      });
    }
  });

  // Approved Expenses (Credit: Company reimburses employee)
  expenses.forEach((exp) => {
    ledgerEntries.push({
      id: String(exp._id),
      date: exp.approved_at || exp.expense_date,
      type: 'EXPENSE_APPROVED',
      category: exp.category,
      sub_category: exp.sub_category,
      reference_number: exp.bill_number || `EXP-${String(exp._id).slice(-6)}`,
      description: exp.description || `${exp.category} expense`,
      payment_method: exp.payment_mode,
      debit: 0,
      credit: exp.amount, // Claim approved
      status: exp.settlement_status === 'settled' ? 'Settled' : 'Unsettled',
    });
  });

  // Settlements Executed
  settlements.forEach((set) => {
    if (set.advance_deduction_amount > 0) {
      ledgerEntries.push({
        id: `${set._id}_advance_offset`,
        date: set.settlement_date,
        type: 'SETTLEMENT_ADVANCE_OFFSET',
        category: 'Settlement',
        reference_number: set.settlement_number,
        description: `Claims settled via Advance Offset (${set.claims?.length || 0} claims)`,
        payment_method: 'Advance Offset',
        debit: set.advance_deduction_amount,
        credit: 0,
        status: 'Processed',
      });
    }

    if (set.direct_payment_amount > 0) {
      ledgerEntries.push({
        id: `${set._id}_direct_payout`,
        date: set.settlement_date,
        type: 'SETTLEMENT_DIRECT_PAYOUT',
        category: 'Settlement',
        reference_number: set.settlement_number,
        description: `Reimbursement Direct Payout (${set.claims?.length || 0} claims)`,
        payment_method: set.payment_method,
        transaction_reference: set.transaction_reference,
        debit: set.direct_payment_amount,
        credit: 0,
        status: 'Paid',
      });
    }
  });

  // Sort chronological
  ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Compute running balance
  let runningBalance = 0;
  const enrichedEntries = ledgerEntries.map((item) => {
    // Credit increases net payable to user, Debit decreases it
    runningBalance += (item.credit - item.debit);
    return {
      ...item,
      running_balance: runningBalance,
    };
  });

  return {
    user: toPlain(userDoc),
    summary: {
      total_entries: enrichedEntries.length,
      current_running_balance: runningBalance,
      position: runningBalance > 0 ? 'Company Payable' : runningBalance < 0 ? 'Advance Receivable' : 'Settled',
    },
    entries: enrichedEntries,
  };
}

module.exports = {
  getExpenseKpiSummary,
  getExecutiveBalances,
  getExecutivePassbook,
};
