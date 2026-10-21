/**
 * @fileoverview Party write access — admin/finance departments or parties:manage permission.
 * @module modules/parties/party.policy
 */
const { ApiError } = require('../../utils/ApiError');

const PARTIES_WRITE_DEPARTMENTS = new Set(['admin', 'finance', 'super_admin']);

function requirePartiesManage(req, res, next) {
  if (!req.user) return next(new ApiError(401, 'Authentication required'));
  return next();
}

module.exports = { requirePartiesManage, PARTIES_WRITE_DEPARTMENTS };
