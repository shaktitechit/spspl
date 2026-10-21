/**
 * @fileoverview Orders: policy checks (ownership / portal role / state).
 * @module modules/orders/order.policy
 */
const { ApiError } = require('../../utils/ApiError');
const orderRules = require('../workflow/workflow.rules');
const {
  hasAnyOpmsRole,
  isOpmsAdmin,
  hasOpmsRole,
} = require('../../middlewares/opmsAuth.middleware');
const ROLES = require('../../constants/roles');

function assertDepartment(user, allowedList) {
  if (!user) throw new ApiError(401, 'Unauthorized');
  if (isOpmsAdmin(user)) return;
  if (!hasAnyOpmsRole(user, allowedList)) {
    throw new ApiError(403, 'Insufficient opms portal role access');
  }
}

function assertMayEditOrderPricing(user, order) {
  if (!user) throw new ApiError(401, 'Unauthorized');
  if (isOpmsAdmin(user)) return;
  if (hasOpmsRole(user, ROLES.SALES) && !orderRules.salesMayEditPricing(order.status)) {
    throw new ApiError(403, 'Sales cannot edit pricing after finance approval (blocking rule)');
  }
  if (hasOpmsRole(user, ROLES.DISPATCH) && !hasAnyOpmsRole(user, [ROLES.SALES, ROLES.FINANCE, ROLES.ACCOUNT])) {
    throw new ApiError(403, 'This department cannot edit order commercial fields');
  }
}

function assertDispatchMayNotChangeCommercials(user, payloadKeys) {
  const banned = new Set([
    'party',
    'order_date',
    'payment_status',
    'notes',
    'order_items',
    'subtotal',
    'discount_amount',
    'gst_amount',
    'grand_total',
    'assigned_sales_user',
  ]);
  // Only enforce when user is dispatch-only (no overlapping commercial roles)
  if (!hasOpmsRole(user, ROLES.DISPATCH)) return;
  if (hasAnyOpmsRole(user, [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.SALES, ROLES.FINANCE, ROLES.ACCOUNT])) {
    return;
  }
  for (const k of Object.keys(payloadKeys)) {
    if (banned.has(k)) {
      throw new ApiError(403, 'Dispatch cannot edit party or pricing details (blocking rule)');
    }
  }
}

module.exports = {
  assertDepartment,
  assertMayEditOrderPricing,
  assertDispatchMayNotChangeCommercials,
};
