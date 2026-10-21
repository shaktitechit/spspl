/**
 * @fileoverview Middleware to validate lead_manager portal access and portal roles.
 * @module middlewares/leadManagerAuth.middleware
 */
const { ApiError } = require('../utils/ApiError');

function normalizeLmRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase();
}

function findLeadManagerPortal(user) {
  if (!user || !Array.isArray(user.portals)) return null;
  return user.portals.find(
    (p) => p && normalizeLmRole(p.portal_code || p.portal) === 'lead_manager'
  );
}

/** Raw portal access_roles (lowercased). */
function getLeadManagerAccessRoles(user) {
  const portalAccess = findLeadManagerPortal(user);
  if (!portalAccess || !Array.isArray(portalAccess.access_roles)) return [];
  return portalAccess.access_roles.map(normalizeLmRole).filter(Boolean);
}

/** Portal roles plus legacy aliases (e.g. sales → executive for read access). */
function getLeadManagerEffectiveRoles(user) {
  const roles = getLeadManagerAccessRoles(user);
  const set = new Set(roles);

  for (const r of roles) {
    if (['sales', 'sales_executive', 'account_executive', 'field_executive'].includes(r)) {
      set.add('executive');
    }
    if (r.includes('executive')) {
      set.add('executive');
    }
  }

  if (user) {
    const codes = Array.isArray(user.role_codes) ? user.role_codes : [];
    for (const code of codes) {
      const c = normalizeLmRole(code);
      if (c.includes('executive') || c === 'sales' || c === 'sales_executive') {
        set.add('executive');
      }
    }
    const legacy = normalizeLmRole(user.role);
    if (legacy === 'sales' || legacy.includes('executive')) {
      set.add('executive');
    }
  }

  return [...set];
}

function rolesInclude(user, role) {
  const want = normalizeLmRole(role);
  return getLeadManagerEffectiveRoles(user).includes(want);
}

/**
 * Admin role on lead_manager portal.
 */
function isAdmin(user) {
  if (!user) return false;
  return rolesInclude(user, 'admin') || rolesInclude(user, 'super_admin');
}

/**
 * Manager role on lead_manager portal.
 */
function isManager(user) {
  if (!user) return false;
  if (isAdmin(user)) return false;
  return rolesInclude(user, 'manager');
}

/**
 * Coordinator role on lead_manager portal.
 */
function isCoordinator(user) {
  if (!user) return false;
  if (isAdmin(user) || isManager(user)) return false;
  return rolesInclude(user, 'coordinator');
}

/**
 * Executive role on lead_manager portal (incl. legacy sales / sales_executive portal roles).
 */
function isExecutive(user) {
  if (!user) return false;
  if (isAdmin(user) || isManager(user) || isCoordinator(user)) return false;
  return rolesInclude(user, 'executive');
}

function hasPortalAccess(user, portalCode) {
  if (!user) return false;
  const code = normalizeLmRole(portalCode);
  const portalAccess = Array.isArray(user.portals)
    ? user.portals.find((p) => p && normalizeLmRole(p.portal_code || p.portal) === code)
    : null;
  return Boolean(
    portalAccess && Array.isArray(portalAccess.access_roles) && portalAccess.access_roles.length > 0
  );
}

/**
 * Validates that the user has access to lead_manager portal.
 */
function requireLeadManagerAccess(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (!hasPortalAccess(req.user, 'lead_manager')) {
    return next(new ApiError(403, 'Access denied: lead_manager portal access required'));
  }
  next();
}

/**
 * Allows lead_manager or work_planner portal users (for cross-portal lead search from Work Planner).
 */
function requireLeadManagerOrWorkPlannerAccess(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (hasPortalAccess(req.user, 'lead_manager') || hasPortalAccess(req.user, 'work_planner')) {
    return next();
  }

  return next(
    new ApiError(403, 'Access denied: lead_manager or work_planner portal access required')
  );
}

/** Sales team roles (read + self-scoped write such as follow-ups). */
const LEAD_MANAGER_SALES_TEAM_ROLES = [
  'admin',
  'manager',
  'coordinator',
  'executive',
  'sales',
  'sales_executive',
];

/** Elevated roles (create/edit/approve quotations, T&C master, team ops, etc.). */
const LEAD_MANAGER_ELEVATED_ROLES = ['admin', 'manager', 'coordinator', 'executive'];

/**
 * Requires one of the specified portal roles on lead_manager portal.
 * `super_admin` on the portal satisfies any role check.
 */
function requireLeadManagerRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }

    const effective = getLeadManagerEffectiveRoles(req.user);
    if (effective.includes('super_admin')) {
      return next();
    }

    const allowed = allowedRoles.map(normalizeLmRole);
    const hasRole = allowed.some((role) => effective.includes(role));
    if (hasRole) {
      return next();
    }

    return next(
      new ApiError(
        403,
        `Access denied: Requires ${allowedRoles.join(' or ')} role on lead_manager portal`
      )
    );
  };
}

const requireLeadManagerSalesTeamRole = requireLeadManagerRole(...LEAD_MANAGER_SALES_TEAM_ROLES);
const requireLeadManagerElevatedRole = requireLeadManagerRole(...LEAD_MANAGER_ELEVATED_ROLES);

/** Admin, manager, coordinator, or executive on lead_manager portal. */
function isLeadManagerElevated(user) {
  return isAdmin(user) || isManager(user) || isCoordinator(user) || isExecutive(user);
}

module.exports = {
  isAdmin,
  isManager,
  isCoordinator,
  isExecutive,
  isLeadManagerElevated,
  hasPortalAccess,
  requireLeadManagerAccess,
  requireLeadManagerOrWorkPlannerAccess,
  requireLeadManagerRole,
  requireLeadManagerSalesTeamRole,
  requireLeadManagerElevatedRole,
  LEAD_MANAGER_SALES_TEAM_ROLES,
  LEAD_MANAGER_ELEVATED_ROLES,
  getLeadManagerAccessRoles,
  getLeadManagerEffectiveRoles,
};
