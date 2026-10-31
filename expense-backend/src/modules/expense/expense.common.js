/**
 * @fileoverview Shared utilities, error wrappers, sequence generators, and maker-checker checks for Expense domain.
 * @module modules/expense/expense.common
 */
const { userId } = require('./expense.constants');
const { isSuperAdminBypass, isExpenseAdmin } = require('../../middlewares/expenseAuth.middleware');
const { ApiError } = require('../../utils/ApiError');

function toPlain(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === 'function') {
    doc = doc.toObject({ virtuals: true });
  }
  return JSON.parse(JSON.stringify(doc));
}

async function generateSequenceCode(prefix, Model) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = await Model.countDocuments();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${dateStr}-${String(count + 1).padStart(4, '0')}-${randomSuffix}`;
}

function resolveEffectiveSalesUser(expense) {
  if (!expense) return null;
  const val = expense.sales_user?._id || expense.sales_user;
  return val ? String(val) : null;
}

/**
 * Enforces Segregation of Duties / Maker-Checker controls:
 * Prohibits self-approval, self-disbursement, and self-settlement.
 */
function assertMakerChecker(targetSalesUser, actor, actionName = 'perform this action') {
  if (isSuperAdminBypass(actor)) {
    return; // Super admins can bypass for emergencies/testing
  }
  const actorId = String(userId(actor) || '');
  const targetId = String(targetSalesUser?._id || targetSalesUser || '');

  if (targetId && actorId && targetId === actorId) {
    throw new ApiError(
      403,
      `Segregation of Duties: You cannot ${actionName} on your own expense/advance record.`
    );
  }
}

function normalizePaymentMethod(method) {
  if (!method) return 'Bank Transfer';
  const norm = String(method).trim().toLowerCase().replace(/_/g, ' ');
  if (norm.includes('upi')) return 'UPI';
  if (norm.includes('bank') || norm.includes('transfer')) return 'Bank Transfer';
  if (norm.includes('cash')) return 'Cash';
  if (norm.includes('cheque') || norm.includes('check')) return 'Cheque';
  if (norm.includes('card')) return 'Corporate Card';
  if (norm.includes('offset')) return 'Advance Offset';
  return 'Bank Transfer';
}

module.exports = {
  ApiError,
  toPlain,
  generateSequenceCode,
  resolveEffectiveSalesUser,
  assertMakerChecker,
  normalizePaymentMethod,
};

