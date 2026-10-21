/**
 * @fileoverview Shared utilities, error wrappers, sequence generators, and maker-checker assertion checks for Expense domain.
 * @module modules/workPlanner/expense/expense.common
 */

const { isWpAdmin, isWpManager } = require('../workPlanner.constants');
const { userId, canAccessSalesUser } = require('../teamVisibility.service');

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

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

function resolveEffectiveSalesUser(expense, workPlan) {
  if (!expense) return null;
  const parentPlan = workPlan || (typeof expense.work_plan === 'object' && expense.work_plan !== null ? expense.work_plan : null);
  const val = (
    (expense.sales_user && (expense.sales_user._id || expense.sales_user)) ||
    (parentPlan && (parentPlan.sales_user?._id || parentPlan.sales_user))
  );
  return val ? String(val) : null;
}

/**
 * Enforces Segregation of Duties / Maker-Checker controls:
 * Prohibits self-approval, self-disbursement, and self-settlement.
 */
function assertMakerChecker(targetSalesUser, actor, actionName = 'perform this action') {
  if (isWpAdmin(actor)) {
    return; // Administrators have full authority to manage their own finances
  }
  const actorId = String(userId(actor) || '');
  const targetId = String(targetSalesUser?._id || targetSalesUser || '');

  if (targetId && actorId && targetId === actorId) {
    throw new ApiError(
      403,
      `Segregation of Duties Violation: You cannot ${actionName} on your own financial record.`
    );
  }
}

/**
 * Validates authority of actor over target sales user based on reporting hierarchy and portal role.
 */
async function assertAuthorityOverSalesUser(targetSalesUser, actor, actionName = 'manage records for') {
  if (isWpAdmin(actor)) return true;
  const targetId = String(targetSalesUser?._id || targetSalesUser || '');
  const isAuthorized = await canAccessSalesUser(actor, targetId);
  if (!isAuthorized) {
    throw new ApiError(403, `Unauthorized: You do not have authority to ${actionName} this executive.`);
  }
  return true;
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
  assertAuthorityOverSalesUser,
  normalizePaymentMethod,
};
