/**
 * @fileoverview Domain service for Expense Claims (submission, review, approvals, rejections, inspection).
 * @module modules/expense/expenseClaim.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { startOfDay, endOfDay, userId } = require('./expense.constants');
const { ApiError, toPlain, assertMakerChecker } = require('./expense.common');
const { isExpenseAdmin, isExpenseFinance } = require('../../middlewares/expenseAuth.middleware');
const { notifyExpenseApproved, notifyExpenseRejected } = require('./expenseNotification.service');
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
 * List expense claims with extensive filtering.
 */
async function listExpenses(query = {}, actor) {
  const { WorkPlanExpense } = getModels();
  const filter = { deletedAt: null };

  // Filter by user
  const targetUser = query.sales_user || query.user_id;
  if (targetUser && targetUser !== 'all') {
    const uOid = asObjectId(targetUser);
    filter.sales_user = uOid || targetUser;
  }

  // Filter by status
  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  } else if (isExpenseFinance(actor) && !isExpenseAdmin(actor) && query.status !== 'all') {
    // Finance by default focuses on approved/settled claims if no status is specified
    if (!query.status) {
      filter.status = { $in: ['approved'] };
    }
  }

  // Filter by category
  if (query.category && query.category !== 'all') {
    filter.category = query.category;
  }

  // Filter by settlement status
  if (query.settlement_status && query.settlement_status !== 'all') {
    filter.settlement_status = query.settlement_status;
  }

  // Filter by date range
  const fromDate = query.from_date || query.from || query.start_date;
  const toDate = query.to_date || query.to || query.end_date;
  if (fromDate || toDate) {
    filter.expense_date = {};
    if (fromDate) filter.expense_date.$gte = startOfDay(fromDate);
    if (toDate) filter.expense_date.$lte = endOfDay(toDate);
  }

  // Search keyword (vendor, bill #, description)
  const search = String(query.q || query.search || '').trim();
  if (search) {
    const rgx = new RegExp(search, 'i');
    filter.$or = [
      { vendor_name: rgx },
      { bill_number: rgx },
      { description: rgx },
      { category: rgx },
      { sub_category: rgx },
    ];
  }

  const limit = Math.min(parseInt(query.limit, 10) || 50, 1000);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    WorkPlanExpense.countDocuments(filter),
    WorkPlanExpense.find(filter)
      .populate('sales_user', '_id name email department phone')
      .populate({
        path: 'work_plan',
        select: '_id plan_date sales_user',
        populate: {
          path: 'sales_user',
          select: '_id name email department phone',
        },
      })
      .populate('approved_by', '_id name email')
      .populate('receipt_attachment')
      .populate('attachments')
      .populate('start_reading_image')
      .populate('end_reading_image')
      .sort({ expense_date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const normalized = rows.map((r) => {
    const plain = toPlain(r);
    if (!plain.sales_user && plain.work_plan && typeof plain.work_plan === 'object' && plain.work_plan.sales_user) {
      plain.sales_user = plain.work_plan.sales_user;
    }
    return plain;
  });

  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 0,
    data: normalized,
  };
}

/**
 * Get single expense record with full details.
 */
async function getExpenseById(id) {
  const { WorkPlanExpense } = getModels();
  const expense = await WorkPlanExpense.findOne({ _id: id, deletedAt: null })
    .populate('sales_user', '_id name email department phone')
    .populate({
      path: 'work_plan',
      select: '_id plan_date sales_user',
      populate: {
        path: 'sales_user',
        select: '_id name email department phone',
      },
    })
    .populate('approved_by', '_id name email')
    .populate('receipt_attachment')
    .populate('attachments')
    .populate('start_reading_image')
    .populate('end_reading_image')
    .populate('settlement_id')
    .lean();

  if (!expense) throw new ApiError(404, 'Expense record not found');
  const plain = toPlain(expense);
  if (!plain.sales_user && plain.work_plan && typeof plain.work_plan === 'object' && plain.work_plan.sales_user) {
    plain.sales_user = plain.work_plan.sales_user;
  }
  return plain;
}

/**
 * Approve an expense claim (Admin role only).
 */
async function approveExpense(expenseId, body = {}, actor) {
  const { WorkPlanExpense } = getModels();
  const expense = await WorkPlanExpense.findOne({ _id: expenseId, deletedAt: null });
  if (!expense) throw new ApiError(404, 'Expense claim not found');

  if (expense.status === 'approved') {
    return toPlain(expense);
  }

  assertMakerChecker(expense.sales_user, actor, 'approve');

  expense.status = 'approved';
  expense.approved_by = asObjectId(userId(actor));
  expense.approved_at = new Date();
  expense.rejection_reason = undefined;
  if (body.manager_remarks || body.remarks) {
    expense.manager_remarks = String(body.manager_remarks || body.remarks).trim();
  }
  expense.updated_by = asObjectId(userId(actor));
  await expense.save();

  notifyExpenseApproved({ expense, actorUser: actor }).catch(() => {});

  return getExpenseById(expense._id);
}

/**
 * Bulk approve multiple expenses (Admin role only).
 */
async function bulkApproveExpenses(expenseIds = [], body = {}, actor) {
  if (!Array.isArray(expenseIds) || expenseIds.length === 0) {
    throw new ApiError(400, 'expense_ids must be a non-empty array');
  }

  const results = [];
  for (const id of expenseIds) {
    try {
      const approved = await approveExpense(id, body, actor);
      results.push({ id, success: true, data: approved });
    } catch (err) {
      results.push({ id, success: false, error: err.message });
    }
  }

  return {
    total: expenseIds.length,
    approved_count: results.filter((r) => r.success).length,
    results,
  };
}

/**
 * Reject an expense claim (Admin role only).
 */
async function rejectExpense(expenseId, body = {}, actor) {
  const reason = String(body.rejection_reason || body.reason || '').trim();
  if (!reason) {
    throw new ApiError(400, 'rejection_reason is required to reject an expense claim');
  }

  const { WorkPlanExpense } = getModels();
  const expense = await WorkPlanExpense.findOne({ _id: expenseId, deletedAt: null });
  if (!expense) throw new ApiError(404, 'Expense claim not found');

  if (expense.settlement_status === 'settled') {
    throw new ApiError(400, 'Cannot reject an expense that has already been settled');
  }

  assertMakerChecker(expense.sales_user, actor, 'reject');

  expense.status = 'rejected';
  expense.rejection_reason = reason;
  expense.approved_by = undefined;
  expense.approved_at = undefined;
  expense.updated_by = asObjectId(userId(actor));
  await expense.save();

  notifyExpenseRejected({ expense, rejectionReason: reason, actorUser: actor }).catch(() => {});

  return getExpenseById(expense._id);
}

/**
 * Create an expense directly.
 */
async function createExpense(data = {}, actor) {
  const { WorkPlanExpense } = getModels();

  const targetSalesUser = data.sales_user || data.user_id || userId(actor);
  if (!targetSalesUser) {
    throw new ApiError(400, 'sales_user is required');
  }

  const expenseDate = data.expense_date ? new Date(data.expense_date) : new Date();
  const amount = Number(data.amount);
  if (Number.isNaN(amount) || amount <= 0) {
    throw new ApiError(400, 'Valid amount is required (greater than 0)');
  }

  const category = data.category;
  if (!category) {
    throw new ApiError(400, 'category is required');
  }

  const newDoc = await WorkPlanExpense.create({
    sales_user: asObjectId(targetSalesUser),
    expense_date: expenseDate,
    category,
    sub_category: data.sub_category || '',
    amount,
    payment_mode: data.payment_mode || 'Cash',
    vendor_name: data.vendor_name || '',
    bill_number: data.bill_number || '',
    bill_date: data.bill_date ? new Date(data.bill_date) : undefined,
    description: data.description || '',
    receipt_attachment: asObjectId(data.receipt_attachment),
    attachments: Array.isArray(data.attachments) ? data.attachments.map(asObjectId).filter(Boolean) : [],
    start_reading: data.start_reading,
    closing_reading: data.closing_reading,
    total_km: data.total_km,
    rate_per_km: data.rate_per_km || 3.5,
    start_reading_image: asObjectId(data.start_reading_image),
    end_reading_image: asObjectId(data.end_reading_image),
    status: data.status === 'draft' ? 'draft' : 'submitted',
    created_by: asObjectId(userId(actor)),
  });

  return getExpenseById(newDoc._id);
}

module.exports = {
  listExpenses,
  getExpenseById,
  approveExpense,
  bulkApproveExpenses,
  rejectExpense,
  createExpense,
};

