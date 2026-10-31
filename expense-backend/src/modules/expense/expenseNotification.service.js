/**
 * @fileoverview Notification helper for Expense Portal lifecycle events.
 * @module modules/expense/expenseNotification.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { logger } = require('../../utils/logger');

async function createExpenseNotification({ userId, title, message, type = 'info', link, metadata }) {
  try {
    const { Notification } = getModels();
    if (!Notification || !userId) return null;

    const notif = await Notification.create({
      user_id: userId,
      title,
      message,
      type,
      link: link || '/dashboard/expenses',
      metadata,
    });
    return notif;
  } catch (err) {
    logger.warn(`[ExpenseNotification] Failed to create notification: ${err.message}`);
    return null;
  }
}

async function notifyExpenseApproved({ expense, actorUser }) {
  const targetUserId = expense.sales_user?._id || expense.sales_user;
  return createExpenseNotification({
    userId: targetUserId,
    title: 'Expense Approved',
    message: `Your expense claim of ₹${expense.amount} for ${expense.category} has been approved by ${actorUser?.name || 'Admin'}.`,
    type: 'success',
    link: '/dashboard/expenses',
    metadata: { expenseId: expense._id, status: 'approved' },
  });
}

async function notifyExpenseRejected({ expense, rejectionReason, actorUser }) {
  const targetUserId = expense.sales_user?._id || expense.sales_user;
  return createExpenseNotification({
    userId: targetUserId,
    title: 'Expense Rejected',
    message: `Your expense claim of ₹${expense.amount} for ${expense.category} was rejected. Reason: ${rejectionReason}`,
    type: 'error',
    link: '/dashboard/expenses',
    metadata: { expenseId: expense._id, status: 'rejected', rejectionReason },
  });
}

async function notifyExpenseRemarkAdded({ expense, remarkText, actorUser }) {
  const targetUserId = expense.sales_user?._id || expense.sales_user;
  return createExpenseNotification({
    userId: targetUserId,
    title: 'New Remark on Expense Claim',
    message: `${actorUser?.name || 'Admin'} added a directive/remark to your ${expense.category} expense claim: "${remarkText}"`,
    type: 'warning',
    link: '/dashboard/expenses',
    metadata: { expenseId: expense._id, remark: remarkText },
  });
}

async function notifyTourAdvanceApproved({ advance, actorUser }) {
  const targetUserId = advance.sales_user?._id || advance.sales_user;
  return createExpenseNotification({
    userId: targetUserId,
    title: 'Tour Advance Sanctioned',
    message: `Your tour advance request ${advance.advance_number} of ₹${advance.amount} has been approved by ${actorUser?.name || 'Admin'} and sent to Finance for disbursement.`,
    type: 'success',
    link: '/dashboard/advances',
    metadata: { advanceId: advance._id, status: 'approved' },
  });
}

async function notifyTourAdvanceRejected({ advance, rejectionReason, actorUser }) {
  const targetUserId = advance.sales_user?._id || advance.sales_user;
  return createExpenseNotification({
    userId: targetUserId,
    title: 'Tour Advance Rejected',
    message: `Your tour advance request ${advance.advance_number} of ₹${advance.amount} was rejected. Reason: ${rejectionReason}`,
    type: 'error',
    link: '/dashboard/advances',
    metadata: { advanceId: advance._id, status: 'rejected', rejectionReason },
  });
}

async function notifyTourAdvanceDisbursed({ advance, actorUser }) {
  const targetUserId = advance.sales_user?._id || advance.sales_user;
  return createExpenseNotification({
    userId: targetUserId,
    title: 'Tour Advance Disbursed',
    message: `Tour advance ${advance.advance_number} of ₹${advance.disbursed_amount || advance.amount} has been disbursed via ${advance.payment_method}. Ref: ${advance.transaction_reference || 'N/A'}.`,
    type: 'success',
    link: '/dashboard/advances',
    metadata: { advanceId: advance._id, status: 'disbursed' },
  });
}

async function notifyExpenseSettlementCompleted({ settlement, actorUser }) {
  const targetUserId = settlement.sales_user?._id || settlement.sales_user;
  return createExpenseNotification({
    userId: targetUserId,
    title: 'Expense Settlement Processed',
    message: `Settlement voucher ${settlement.settlement_number} has been processed for total claims of ₹${settlement.total_claim_amount}.`,
    type: 'info',
    link: `/dashboard/settlements`,
    metadata: { settlementId: settlement._id },
  });
}

module.exports = {
  createExpenseNotification,
  notifyExpenseApproved,
  notifyExpenseRejected,
  notifyExpenseRemarkAdded,
  notifyTourAdvanceApproved,
  notifyTourAdvanceRejected,
  notifyTourAdvanceDisbursed,
  notifyExpenseSettlementCompleted,
};

