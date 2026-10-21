/**
 * @fileoverview Finance: policy checks (ownership / portal role / state).
 * @module modules/finance/finance.policy
 */
const { ApiError } = require('../../utils/ApiError');
const { hasAnyOpmsRole, isOpmsAdmin } = require('../../middlewares/opmsAuth.middleware');
const ROLES = require('../../constants/roles');

function assertFinanceDept(user, message = 'Finance or admin required') {
  if (!user) throw new ApiError(401, 'Unauthorized');
  if (isOpmsAdmin(user)) return;
  if (!hasAnyOpmsRole(user, [ROLES.FINANCE, ROLES.ADMIN])) {
    throw new ApiError(403, message);
  }
}

module.exports = { assertFinanceDept };
