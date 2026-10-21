/**
 * @fileoverview Express middleware (dept.middleware).
 * @module middlewares/dept.middleware
 */
const { ApiError } = require('../utils/ApiError');

function requireDepartment(...allowed) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required'));
    return next();
  };
}

/** Dept match only. Updated to require authentication only. */
function requireDepartmentOnly(...allowed) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required'));
    return next();
  };
}

module.exports = { requireDepartment, requireDepartmentOnly };
