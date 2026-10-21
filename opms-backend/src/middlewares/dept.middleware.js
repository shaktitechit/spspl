/**
 * @fileoverview Express middleware (dept.middleware).
 * Department-named allow-lists are enforced via OPMS portal access_roles.
 * @module middlewares/dept.middleware
 */
const { ApiError } = require('../utils/ApiError');
const {
  hasOpmsAccess,
  hasAnyOpmsRole,
  isOpmsAdmin,
} = require('./opmsAuth.middleware');

function requireDepartment(...allowed) {
  const flat = allowed.flat();
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required'));
    if (!hasOpmsAccess(req.user)) {
      return next(new ApiError(403, 'Access denied: opms portal access required'));
    }
    if (isOpmsAdmin(req.user)) return next();
    if (flat.length && !hasAnyOpmsRole(req.user, flat)) {
      return next(new ApiError(403, 'Insufficient opms portal role access'));
    }
    return next();
  };
}

/** Role match only (admin/super_admin still bypass). */
function requireDepartmentOnly(...allowed) {
  return requireDepartment(...allowed);
}

module.exports = { requireDepartment, requireDepartmentOnly };
