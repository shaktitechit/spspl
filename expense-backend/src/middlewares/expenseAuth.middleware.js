/**
 * @fileoverview Middleware to validate expense portal access and role-based permissions (admin, finance).
 * @module middlewares/expenseAuth.middleware
 */
const { ApiError } = require('../utils/ApiError');

function normalize(str) {
  return String(str || '').trim().toLowerCase();
}

/**
 * Checks for super admin bypass across role flags and portal roles.
 */
function isSuperAdminBypass(user) {
  if (!user) return false;
  if (user.is_super_admin || user.isSuperAdmin || user.is_admin) return true;
  const role = normalize(user.role);
  if (role === 'super_admin' || role === 'admin' || role === 'superadmin') return true;
  if (Array.isArray(user.role_codes) && user.role_codes.some((r) => ['super_admin', 'superadmin'].includes(normalize(r)))) return true;
  if (Array.isArray(user.roles) && user.roles.some((r) => ['super_admin', 'superadmin'].includes(normalize(r.code || r.name || r)))) return true;
  return false;
}

/**
 * Extracts normalized access roles assigned to the user for the 'expense' portal.
 */
function getExpensePortalRoles(user) {
  if (!user) return [];
  const portals = Array.isArray(user.portals) ? user.portals : [];
  const expensePortal = portals.find((p) => {
    if (!p) return false;
    const code = normalize(p.portal_code || p.portal || p.code);
    return code === 'expense';
  });

  if (!expensePortal) return [];

  const roles = Array.isArray(expensePortal.access_roles)
    ? expensePortal.access_roles
    : expensePortal.access_role
    ? [expensePortal.access_role]
    : [];

  return roles.map(normalize).filter(Boolean);
}

/**
 * Checks if user has admin role on the expense portal (or super admin).
 */
function isExpenseAdmin(user) {
  if (!user) return false;
  if (isSuperAdminBypass(user)) return true;
  return getExpensePortalRoles(user).includes('admin');
}

/**
 * Checks if user has finance role on the expense portal (or super admin).
 */
function isExpenseFinance(user) {
  if (!user) return false;
  if (isSuperAdminBypass(user)) return true;
  const portalRoles = getExpensePortalRoles(user);
  if (portalRoles.includes('finance')) return true;

  // Fallback if user is in Finance department or has finance role globally
  const dept = normalize(user.department);
  if (dept === 'finance' || dept === 'accounts' || dept === 'account') return true;
  if (Array.isArray(user.role_codes) && user.role_codes.some((r) => ['finance', 'account', 'accounts'].includes(normalize(r)))) return true;

  return false;
}

/**
 * Checks if user has any access to the expense portal.
 */
function hasExpensePortalAccess(user) {
  if (!user) return false;
  if (isSuperAdminBypass(user)) return true;
  return isExpenseAdmin(user) || isExpenseFinance(user);
}

/**
 * Middleware: Requires that user is authenticated and has expense portal access.
 */
function requireExpensePortalAccess(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (!hasExpensePortalAccess(req.user)) {
    return next(new ApiError(403, 'Access denied: Expense Portal access required (admin or finance role)'));
  }
  next();
}

/**
 * Middleware: Requires 'admin' role in Expense Portal.
 */
function requireExpenseAdmin(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (!isExpenseAdmin(req.user)) {
    return next(new ApiError(403, 'Access denied: Expense Admin role required'));
  }
  next();
}

/**
 * Middleware: Requires 'finance' role in Expense Portal.
 */
function requireExpenseFinance(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (!isExpenseFinance(req.user)) {
    return next(new ApiError(403, 'Access denied: Expense Finance role required'));
  }
  next();
}

/**
 * Middleware: Requires any one of specified roles (e.g. 'admin', 'finance').
 */
function requireExpenseRole(...allowedRoles) {
  const allowed = allowedRoles.map(normalize);
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }
    if (isSuperAdminBypass(req.user)) {
      return next();
    }
    const isAdmin = isExpenseAdmin(req.user);
    const isFinance = isExpenseFinance(req.user);

    const hasAllowed = allowed.some((role) => {
      if (role === 'admin' && isAdmin) return true;
      if (role === 'finance' && isFinance) return true;
      return false;
    });

    if (hasAllowed) {
      return next();
    }

    return next(
      new ApiError(
        403,
        `Access denied: Requires ${allowedRoles.join(' or ')} role on Expense Portal`
      )
    );
  };
}

module.exports = {
  isSuperAdminBypass,
  getExpensePortalRoles,
  isExpenseAdmin,
  isExpenseFinance,
  hasExpensePortalAccess,
  requireExpensePortalAccess,
  requireExpenseAdmin,
  requireExpenseFinance,
  requireExpenseRole,
};

