/**
 * @fileoverview Middleware to validate work_planner portal access and portal roles.
 * @module middlewares/workPlannerAuth.middleware
 */
const { ApiError } = require('../utils/ApiError');
const {
  isExecutive,
  isWpAdmin,
  isWpManager,
  isWpCoordinator,
  isWpElevated,
  getWorkPlannerAccessRoles,
  hasWorkPlannerAccess,
} = require('../modules/workPlanner/workPlanner.constants');

/**
 * Validates that the user has access to work_planner portal.
 */
function requireWorkPlannerAccess(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (!hasWorkPlannerAccess(req.user)) {
    return next(new ApiError(403, 'Access denied: work_planner portal access required'));
  }
  next();
}

/**
 * Requires one of the specified portal roles (e.g. 'executive', 'coordinator', 'manager', 'admin') on work_planner portal.
 */
function requireWorkPlannerRole(...allowedRoles) {
  const allowed = allowedRoles.map((r) => String(r).toLowerCase());
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }

    const portalRoles = getWorkPlannerAccessRoles(req.user);
    const hasRole = allowed.some((role) => portalRoles.includes(role));
    if (hasRole) {
      return next();
    }

    return next(
      new ApiError(
        403,
        `Access denied: Requires ${allowedRoles.join(' or ')} role on work_planner portal`
      )
    );
  };
}

module.exports = {
  isExecutive,
  isWpAdmin,
  isWpManager,
  isWpCoordinator,
  isWpElevated,
  requireWorkPlannerAccess,
  requireWorkPlannerRole,
};
