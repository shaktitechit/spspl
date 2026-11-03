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
  const { WorkPlanExpense, WorkPlanTourAdvance, WorkPlanExpenseSettlement } = getModels();

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
        total_refunded_amount: {
          $sum: { $ifNull: ['$refunded_amount', 0] },
        },
      },
    },
  ]);

  const [settlementKpis] = await WorkPlanExpenseSettlement.aggregate([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: null,
        total_payment_entries_amount: {
          $sum: { $cond: [{ $eq: ['$settlement_mode', 'payment_entry'] }, '$direct_payment_amount', 0] },
        },
        total_direct_payouts_amount: {
          $sum: { $cond: [{ $ne: ['$settlement_mode', 'payment_entry'] }, '$direct_payment_amount', 0] },
        },
      },
    },
  ]);

  const exp = expenseKpis || {};
  const adv = advanceKpis || {};
  const set = settlementKpis || {};

  const netBalance = (exp.approved_unsettled_amount || 0) - (adv.active_advances_balance || 0) - (set.total_payment_entries_amount || 0);

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
    total_refunded_advances_amount: adv.total_refunded_amount || 0,
    total_payment_entries_amount: set.total_payment_entries_amount || 0,
    total_direct_payouts_amount: set.total_direct_payouts_amount || 0,
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
  const { User, WorkPlanExpense, WorkPlanTourAdvance, WorkPlanExpenseSettlement } = getModels();

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

  // 3. Settlements Aggregate (Payment entries by user)
  const settlementsAgg = await WorkPlanExpenseSettlement.aggregate([
    {
      $match: {
        sales_user: { $in: matchIds },
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
    const set = settlementMap.get(sId) || {
      total_payment_entries: 0,
      payment_entries_count: 0,
    };

    const netBal = exp.unsettled_approved_amount - adv.total_remaining_balance - set.total_payment_entries;
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
      total_payment_entries: set.total_payment_entries,
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
 * Builds chronological debit/credit passbook ledger and comprehensive financial dossier for a Work Planner user.
 * Supports targetUserId as an ObjectId, email, or username.
 */
async function getExecutivePassbook(targetUserId, query = {}) {
  const { User, WorkPlanExpense, WorkPlanTourAdvance, WorkPlanExpenseSettlement } = getModels();

  let userDoc = null;
  if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)) {
    userDoc = await User.findById(targetUserId)
      .select('_id name email department phone wp_role')
      .lean();
  }

  if (!userDoc && targetUserId) {
    const rawTarget = String(targetUserId).trim();
    const slugName = rawTarget.replace(/-/g, ' ');
    userDoc = await User.findOne({
      $or: [
        { email: rawTarget },
        { name: new RegExp(`^${slugName}$`, 'i') },
        { name: new RegExp(`^${rawTarget}$`, 'i') },
      ],
    })
      .select('_id name email department phone wp_role')
      .lean();
  }

  if (!userDoc) {
    throw new Error(`User "${targetUserId}" not found.`);
  }

  const actualUserId = userDoc._id;
  const matchUserIds = [actualUserId, String(actualUserId), asObjectId(actualUserId)].filter(Boolean);

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
  const advances = await WorkPlanTourAdvance.find(advFilter)
    .populate('approved_by', '_id name email')
    .populate('disbursed_by', '_id name email')
    .populate('refunded_by', '_id name email')
    .lean();

  // 2. Fetch Approved Claims (Credit to User = Company liability / expense payable)
  const expFilter = {
    sales_user: { $in: matchUserIds },
    status: 'approved',
    deletedAt: null,
  };
  if (dateFilter.$gte || dateFilter.$lte) {
    expFilter.approved_at = dateFilter;
  }
  const expenses = await WorkPlanExpense.find(expFilter)
    .populate('approved_by', '_id name email')
    .populate('receipt_attachment')
    .lean();

  // 3. Fetch Settlements (Offsetting transactions and payment entries)
  const setFilter = {
    sales_user: { $in: matchUserIds },
    deletedAt: null,
  };
  if (dateFilter.$gte || dateFilter.$lte) {
    setFilter.settlement_date = dateFilter;
  }
  const settlements = await WorkPlanExpenseSettlement.find(setFilter)
    .populate('settled_by', '_id name email')
    .populate('claims.expense')
    .populate('advances.advance')
    .populate('payment_entries.payment_entry')
    .lean();

  // 4. Fetch All Claims for Dossier
  const allClaims = await WorkPlanExpense.find({
    sales_user: { $in: matchUserIds },
    deletedAt: null,
  })
    .populate('approved_by', '_id name email')
    .populate('receipt_attachment')
    .populate('attachments')
    .populate('start_reading_image')
    .populate('end_reading_image')
    .sort({ expense_date: -1, createdAt: -1 })
    .lean();

  // 5. Fetch All Advances for Dossier
  const allAdvances = await WorkPlanTourAdvance.find({
    sales_user: { $in: matchUserIds },
    deletedAt: null,
  })
    .populate('approved_by', '_id name email')
    .populate('disbursed_by', '_id name email')
    .populate('attachments')
    .sort({ request_date: -1, createdAt: -1 })
    .lean();

  // Assemble chronological ledger events
  const ledgerEntries = [];

  // Advances Disbursed & Refunds
  advances.forEach((adv) => {
    // 1. Advance disbursement event (Debit: cash received by user)
    const disbAmount = adv.disbursed_amount || adv.amount || 0;
    if (disbAmount > 0) {
      ledgerEntries.push({
        id: String(adv._id),
        date: adv.disbursed_at || adv.request_date || adv.createdAt,
        type: 'ADVANCE_DISBURSED',
        entry_type: 'advance_disbursement',
        category: 'Tour Advance',
        reference_number: adv.advance_number,
        reference: adv.advance_number || `ADV-${String(adv._id).slice(-6).toUpperCase()}`,
        description: adv.purpose || 'Tour Advance Disbursed',
        title: `Tour Advance Disbursed (${adv.purpose || 'Tour'})`,
        details: adv.disbursement_notes || adv.purpose || 'Tour advance funds disbursed',
        payment_method: adv.payment_method || 'Bank Transfer',
        transaction_reference: adv.transaction_reference,
        amount: disbAmount,
        debit: disbAmount, // Advance given
        credit: 0,
        status: adv.status,
        approved_by: adv.approved_by,
        disbursed_by: adv.disbursed_by,
        actor_name: adv.disbursed_by?.name || 'Finance Authority',
        attachments: adv.attachments || [],
        attachment_details: adv.attachment_details || [],
      });
    }

    // 2. Advance Refund event(s) (Credit: cash returned by user, reducing advance debt)
    if (Array.isArray(adv.refunds) && adv.refunds.length > 0) {
      adv.refunds.forEach((ref, rIdx) => {
        const refAmt = Number(ref.amount || 0);
        if (refAmt > 0) {
          ledgerEntries.push({
            id: `${adv._id}_refund_${rIdx}`,
            date: ref.refund_date || adv.refunded_at || adv.updatedAt || adv.createdAt,
            type: 'ADVANCE_REFUND',
            entry_type: 'advance_refund',
            category: 'Advance Refund',
            reference_number: adv.advance_number,
            reference: adv.advance_number || `ADV-${String(adv._id).slice(-6).toUpperCase()}`,
            description: ref.notes ? `Refund of unused balance: ${ref.notes}` : `Refund of unused advance (${adv.advance_number})`,
            title: `Tour Advance Refund (${adv.advance_number || 'Advance'})`,
            details: ref.notes || 'Unspent advance refunded back to company',
            payment_method: ref.payment_method || 'Refund',
            transaction_reference: ref.transaction_reference || adv.refund_reference,
            amount: refAmt,
            debit: 0,
            credit: refAmt,
            status: 'refunded',
            refunded_by: adv.refunded_by,
            actor_name: adv.refunded_by?.name || (typeof ref.accepted_by === 'object' ? ref.accepted_by?.name : 'Finance Authority'),
            attachments: ref.attachments || [],
            attachment_details: ref.attachment_details || [],
          });
        }
      });
    } else if (Number(adv.refunded_amount || 0) > 0) {
      const refAmt = Number(adv.refunded_amount || 0);
      ledgerEntries.push({
        id: `${adv._id}_refund`,
        date: adv.refunded_at || adv.updatedAt || adv.createdAt,
        type: 'ADVANCE_REFUND',
        entry_type: 'advance_refund',
        category: 'Advance Refund',
        reference_number: adv.advance_number,
        reference: adv.advance_number || `ADV-${String(adv._id).slice(-6).toUpperCase()}`,
        description: adv.refund_notes ? `Refund of unused balance: ${adv.refund_notes}` : `Refund of unused advance (${adv.advance_number})`,
        title: `Tour Advance Refund (${adv.advance_number || 'Advance'})`,
        details: adv.refund_notes || 'Unspent advance refunded back to company',
        payment_method: 'Refund',
        transaction_reference: adv.refund_reference,
        amount: refAmt,
        debit: 0,
        credit: refAmt,
        status: 'refunded',
        refunded_by: adv.refunded_by,
        actor_name: adv.refunded_by?.name || 'Finance Authority',
      });
    }

    // 3. Rejected Advance event
    if (adv.status === 'rejected') {
      const rejAmount = Number(adv.amount || 0);
      ledgerEntries.push({
        id: `ADV-REJ-${adv._id}`,
        advance_id: String(adv._id),
        date: adv.approved_at || adv.updatedAt || adv.createdAt,
        type: 'ADVANCE_REJECTED',
        entry_type: 'advance_rejected',
        category: 'Tour Advance',
        reference_number: adv.advance_number,
        reference: adv.advance_number || `ADV-${String(adv._id).slice(-6).toUpperCase()}`,
        description: adv.rejection_reason ? `Rejected: ${adv.rejection_reason}` : (adv.purpose || 'Tour advance rejected'),
        title: `Rejected Tour Advance (${adv.purpose || 'Advance'})`,
        details: adv.rejection_reason ? `Rejected: ${adv.rejection_reason}` : (adv.purpose || 'Tour advance rejected'),
        rejection_reason: adv.rejection_reason || 'Advance request rejected',
        remarks: adv.rejection_reason || 'Advance request rejected',
        payment_method: 'Advance Request',
        amount: rejAmount,
        debit: 0,
        credit: 0,
        status: 'rejected',
        approved_by: adv.approved_by,
        actor_name: adv.approved_by?.name || 'Manager / Authority',
        attachments: adv.attachments || [],
        attachment_details: adv.attachment_details || (Array.isArray(adv.attachments) ? adv.attachments : []),
      });
    }
  });

  // Approved Expenses (Credit: Company reimburses employee)
  expenses.forEach((exp) => {
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
    if (exp.start_reading_image) addUniqueAtt(exp.start_reading_image);
    if (exp.end_reading_image) addUniqueAtt(exp.end_reading_image);

    ledgerEntries.push({
      id: String(exp._id),
      date: exp.approved_at || exp.expense_date,
      type: 'EXPENSE_APPROVED',
      entry_type: 'expense_approved',
      category: exp.category,
      sub_category: exp.sub_category,
      reference_number: exp.bill_number || `EXP-${String(exp._id).slice(-6)}`,
      reference: exp.bill_number || `EXP-${String(exp._id).slice(-6)}`,
      description: exp.description || `${exp.category} expense`,
      title: `Approved Expense Claim (${exp.category || 'General'})`,
      details: exp.description || `${exp.category} expense`,
      payment_method: exp.payment_mode,
      amount: exp.amount,
      debit: 0,
      credit: exp.amount, // Claim approved
      status: exp.settlement_status === 'settled' ? 'Settled' : 'Unsettled',
      approved_by: exp.approved_by,
      actor_name: exp.approved_by?.name || 'Manager',
      approved_at: exp.approved_at,
      attachments: exp.attachments || [],
      attachment_details: allAtts,
    });
  });

  // Settlements Executed
  settlements.forEach((set) => {
    if (set.settlement_mode === 'payment_entry') {
      ledgerEntries.push({
        id: String(set._id),
        settlement_id: String(set._id),
        date: set.settlement_date,
        type: 'PAYMENT_ENTRY',
        entry_type: 'payment_entry',
        category: 'Treasury Payment',
        reference_number: set.settlement_number,
        reference: set.settlement_number || `PAY-${String(set._id).slice(-6).toUpperCase()}`,
        description: set.settlement_notes || 'Direct Treasury Payment / Disbursement Entry',
        title: set.settlement_notes || 'Direct Treasury Payment Entry',
        details: set.settlement_notes || 'Direct treasury payment entry',
        payment_method: set.payment_method,
        transaction_reference: set.transaction_reference,
        amount: set.direct_payment_amount || 0,
        debit: set.direct_payment_amount || 0, // Reduces payable liability
        credit: 0,
        status: 'Processed',
        settled_by: set.settled_by,
        actor_name: set.settled_by?.name || 'Finance Authority',
      });
      return;
    }

    if (set.advance_deduction_amount > 0) {
      ledgerEntries.push({
        id: `${set._id}_advance_offset`,
        settlement_id: String(set._id),
        date: set.settlement_date,
        type: 'SETTLEMENT_ADVANCE_OFFSET',
        entry_type: 'settlement_voucher',
        category: 'Settlement Offset',
        reference_number: set.settlement_number,
        reference: set.settlement_number || `SETTLE-${String(set._id).slice(-6).toUpperCase()}`,
        description: set.settlement_notes || `Claims settled via Advance Offset (₹${Number(set.advance_deduction_amount || 0).toLocaleString('en-IN')}) (${set.claims?.length || 0} claims)`,
        title: `Settlement Voucher #${set.settlement_number || ''}`,
        details: set.settlement_notes || `Claims settled via Advance Offset (₹${Number(set.advance_deduction_amount || 0).toLocaleString('en-IN')}) (${set.claims?.length || 0} claims)`,
        payment_method: 'Advance Offset',
        offset_amount: set.advance_deduction_amount,
        advance_deduction_amount: set.advance_deduction_amount,
        amount: set.advance_deduction_amount,
        debit: 0, // Internal reconciliation: does not duplicate cash debit
        credit: 0,
        status: 'Processed',
        settled_by: set.settled_by,
        actor_name: set.settled_by?.name || 'Finance Authority',
      });
    }

    if (set.payment_entry_deduction_amount > 0) {
      ledgerEntries.push({
        id: `${set._id}_payment_offset`,
        settlement_id: String(set._id),
        date: set.settlement_date,
        type: 'SETTLEMENT_PAYMENT_OFFSET',
        entry_type: 'settlement_voucher',
        category: 'Settlement Offset',
        reference_number: set.settlement_number,
        reference: set.settlement_number || `SETTLE-${String(set._id).slice(-6).toUpperCase()}`,
        description: set.settlement_notes || `Claims settled via Direct Payment Offset (₹${Number(set.payment_entry_deduction_amount || 0).toLocaleString('en-IN')}) (${set.claims?.length || 0} claims)`,
        title: `Settlement Voucher #${set.settlement_number || ''}`,
        details: set.settlement_notes || `Claims settled via Direct Payment Offset (₹${Number(set.payment_entry_deduction_amount || 0).toLocaleString('en-IN')}) (${set.claims?.length || 0} claims)`,
        payment_method: 'Payment Entry Offset',
        offset_amount: set.payment_entry_deduction_amount,
        payment_entry_deduction_amount: set.payment_entry_deduction_amount,
        amount: set.payment_entry_deduction_amount,
        debit: 0,
        credit: 0,
        status: 'Processed',
        settled_by: set.settled_by,
        actor_name: set.settled_by?.name || 'Finance Authority',
      });
    }

    if (set.direct_payment_amount > 0) {
      ledgerEntries.push({
        id: `${set._id}_direct_payout`,
        settlement_id: String(set._id),
        date: set.settlement_date,
        type: 'SETTLEMENT_DIRECT_PAYOUT',
        entry_type: 'settlement_voucher',
        category: 'Settlement Payout',
        reference_number: set.settlement_number,
        reference: set.settlement_number || `SETTLE-${String(set._id).slice(-6).toUpperCase()}`,
        description: set.settlement_notes || `Reimbursement Direct Payout (${set.claims?.length || 0} claims)`,
        title: `Settlement Voucher #${set.settlement_number || ''}`,
        details: set.settlement_notes || `Reimbursement Direct Payout (${set.claims?.length || 0} claims)`,
        payment_method: set.payment_method,
        transaction_reference: set.transaction_reference,
        amount: set.direct_payment_amount,
        direct_payment_amount: set.direct_payment_amount,
        debit: set.direct_payment_amount,
        credit: 0,
        status: 'Paid',
        settled_by: set.settled_by,
        actor_name: set.settled_by?.name || 'Finance Authority',
      });
    }
  });

  // Sort chronological
  ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Compute running balance
  let runningBalance = 0;
  let runningAdvance = 0;
  let runningPayment = 0;
  let runningClaim = 0;
  const enrichedEntries = ledgerEntries.map((item) => {
    // Credit increases net payable to user, Debit decreases it
    runningBalance += (item.credit - item.debit);
    if (item.type === 'ADVANCE_DISBURSED') runningAdvance += (item.debit || 0);
    if (item.type === 'ADVANCE_REFUND') runningAdvance -= (item.credit || 0);
    if (item.type === 'EXPENSE_APPROVED') runningClaim += (item.credit || 0);
    if (item.type === 'PAYMENT_ENTRY') runningPayment += (item.debit || 0);
    if (item.type === 'SETTLEMENT_ADVANCE_OFFSET') runningAdvance -= (item.offset_amount || 0);
    if (item.type === 'SETTLEMENT_PAYMENT_OFFSET') runningPayment -= (item.offset_amount || 0);
    if (item.type === 'SETTLEMENT_DIRECT_PAYOUT') runningClaim -= (item.debit || 0);

    return {
      ...item,
      running_balance: runningBalance,
      running_advance_balance: Math.max(0, runningAdvance),
      running_payment_entry: Math.max(0, runningPayment),
      running_claim_receivable: Math.max(0, runningClaim),
      running_net_position: runningBalance,
    };
  });

  // Metrics computation
  const totalAdvancesReceived = advances.reduce(
    (acc, adv) => acc + (adv.disbursed_amount || adv.amount || 0),
    0
  );
  const totalAdvancesRefunded = allAdvances.reduce(
    (acc, adv) => acc + Number(adv.refunded_amount || 0),
    0
  );
  const totalSubmittedAmt = allClaims.reduce((acc, c) => acc + (c.amount || 0), 0);
  const approvedClaims = allClaims.filter((c) => c.status === 'approved');
  const totalApprovedAmt = approvedClaims.reduce((acc, c) => acc + (c.amount || 0), 0);
  const totalSettledAmt = allClaims.reduce((acc, c) => acc + (c.settled_amount || 0), 0);
  const unsettledApprovedAmt = approvedClaims.reduce(
    (acc, c) => acc + Math.max(0, (c.amount || 0) - (c.settled_amount || 0)),
    0
  );
  const activeAdvanceBal = allAdvances
    .filter((a) => ['disbursed', 'recovered', 'refunded'].includes(a.status))
    .reduce((acc, a) => acc + Number(a.remaining_balance || 0), 0);

  const paymentEntrySettlements = settlements.filter((s) => s.settlement_mode === 'payment_entry');
  const totalPaymentEntriesAmt = paymentEntrySettlements.reduce(
    (acc, s) => acc + Number(s.direct_payment_amount || 0),
    0
  );
  const activePaymentEntriesBal = paymentEntrySettlements.reduce((acc, s) => {
    const rem = s.remaining_balance !== undefined
      ? Number(s.remaining_balance)
      : Math.max(0, Number(s.direct_payment_amount || 0) - Number(s.settled_amount || 0));
    return acc + rem;
  }, 0);
  const claimDirectPayouts = settlements.filter((s) => s.settlement_mode !== 'payment_entry');
  const totalDirectPayoutsAmt = claimDirectPayouts.reduce(
    (acc, s) => acc + Number(s.direct_payment_amount || 0),
    0
  );
  const totalTreasuryPayouts = totalPaymentEntriesAmt + totalDirectPayoutsAmt;

  return {
    user: toPlain(userDoc),
    sales_user: toPlain(userDoc),
    current_advance_balance: activeAdvanceBal,
    current_claim_receivable: unsettledApprovedAmt,
    current_payment_entry: activePaymentEntriesBal,
    total_payment_entries: totalPaymentEntriesAmt,
    current_net_position: runningBalance,
    summary: {
      total_entries: enrichedEntries.length,
      current_running_balance: runningBalance,
      net_balance: runningBalance,
      position: runningBalance > 0 ? 'Company Payable' : runningBalance < 0 ? 'User Owes Company' : 'Settled',
      total_advances_received: totalAdvancesReceived,
      total_advances_refunded: totalAdvancesRefunded,
      net_advances_disbursed: totalAdvancesReceived - totalAdvancesRefunded,
      total_claims_submitted_count: allClaims.length,
      total_claims_submitted_amount: totalSubmittedAmt,
      total_claims_approved_count: approvedClaims.length,
      total_claims_approved_amount: totalApprovedAmt,
      total_settled_amount: totalSettledAmt,
      unsettled_approved_amount: unsettledApprovedAmt,
      active_advance_balance: activeAdvanceBal,
      active_payment_entry_balance: activePaymentEntriesBal,
      total_payment_entries_count: paymentEntrySettlements.length,
      total_payment_entries_amount: totalPaymentEntriesAmt,
      total_direct_payouts_amount: totalDirectPayoutsAmt,
      total_treasury_payouts: totalTreasuryPayouts,
    },
    entries: enrichedEntries,
    claims: allClaims.map(toPlain),
    approved_claims: approvedClaims.map(toPlain),
    advances: allAdvances.map(toPlain),
    settlements: settlements.map(toPlain),
  };
}

module.exports = {
  getExpenseKpiSummary,
  getExecutiveBalances,
  getExecutivePassbook,
};
