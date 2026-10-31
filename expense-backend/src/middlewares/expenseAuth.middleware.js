/**
 * @fileoverview Middleware to validate expense portal access and role-based permissions (admin, finance).
 * Only users explicitly assigned to the Expense Portal can access.
 * @module middlewares/expenseAuth.middleware
 */
const { ApiError } = require('../utils/ApiError');

function normalize(str) {
  return String(str || '').trim().toLowerCase();
}

const EXPENSE_PORTAL_CODES = Object.freeze([
  'expense',
  'expenses',
  'expense_portal',
  'expense_management',
]);

const VALID_EXPENSE_ROLES = Object.freeze([
  'admin',
  'finance',
  'super_admin',
  'superadmin',
]);

/**
 * Finds the expense portal entry from user's portals array.
 * Returns null if user is not assigned to the expense portal.
 */
function getExpensePortalEntry(user) {
  if (!user) return null;
  const portals = Array.isArray(user.portals)
    ? user.portals
    : Array.isArray(user.portal_access)
    ? user.portal_access
    : [];

  return (
    portals.find((p) => {
      if (!p) return false;
      const code = normalize(
        p.portal_code ||
          p.code ||
          (typeof p.portal === 'object' ? p.portal?.code || p.portal?.portal_code : p.portal)
      );
      return EXPENSE_PORTAL_CODES.includes(code);
    }) || null
  );
}

/**
 * Checks if user is marked as a super admin globally.
 */
function isGlobalSuperAdmin(user) {
  if (!user) return false;
  if (user.is_super_admin || user.isSuperAdmin) return true;
  const dept = normalize(user.department);
  if (dept === 'super_admin' || dept === 'superadmin') return true;
  const role = normalize(user.role);
  if (role === 'super_admin' || role === 'superadmin') return true;
  if (
    Array.isArray(user.role_codes) &&
    user.role_codes.some((r) => ['super_admin', 'superadmin'].includes(normalize(r)))
  )
    return true;
  if (
    Array.isArray(user.roles) &&
    user.roles.some((r) => ['super_admin', 'superadmin'].includes(normalize(r.code || r.name || r)))
  )
    return true;
  return false;
}

/**
 * Extracts normalized access roles assigned to the user for the Expense Portal.
 * Returns empty array if user is not assigned to the Expense Portal.
 */
function getExpensePortalRoles(user) {
  if (!user) return [];
  const entry = getExpensePortalEntry(user);
  if (!entry) return [];

  const rawRoles = Array.isArray(entry.access_roles)
    ? entry.access_roles
    : entry.access_role
    ? [entry.access_role]
    : Array.isArray(entry.roles)
    ? entry.roles
    : [];

  const normalized = rawRoles
    .map(normalize)
    .filter((r) => VALID_EXPENSE_ROLES.includes(r));

  // If super admin is assigned to expense portal, grant full admin & finance permissions
  if (
    isGlobalSuperAdmin(user) ||
    normalized.includes('super_admin') ||
    normalized.includes('superadmin')
  ) {
    return Array.from(new Set([...normalized, 'admin', 'finance']));
  }

  return normalized;
}

/**
 * Checks if user has explicit access to the expense portal.
 * Only users assigned to the expense portal with valid roles can access.
 */
function hasExpensePortalAccess(user) {
  if (!user) return false;
  const entry = getExpensePortalEntry(user);
  if (!entry) return false;
  return getExpensePortalRoles(user).length > 0;
}

/**
 * Checks if user has admin role on the expense portal (or super admin assigned to portal).
 */
function isExpenseAdmin(user) {
  if (!user) return false;
  if (!hasExpensePortalAccess(user)) return false;
  const roles = getExpensePortalRoles(user);
  return roles.includes('admin') || roles.includes('super_admin') || roles.includes('superadmin');
}

/**
 * Checks if user has finance role on the expense portal (or super admin assigned to portal).
 */
function isExpenseFinance(user) {
  if (!user) return false;
  if (!hasExpensePortalAccess(user)) return false;
  const roles = getExpensePortalRoles(user);
  return roles.includes('finance') || roles.includes('super_admin') || roles.includes('superadmin');
}

/**
 * Checks for super admin bypass across role flags and portal roles.
 * Applies only if user is assigned to the expense portal.
 */
function isSuperAdminBypass(user) {
  if (!user) return false;
  if (!hasExpensePortalAccess(user)) return false;
  if (isGlobalSuperAdmin(user)) return true;
  const roles = getExpensePortalRoles(user);
  return roles.includes('super_admin') || roles.includes('superadmin');
}

/**
 * Middleware: Requires that user is authenticated and has expense portal access.
 */
function requireExpensePortalAccess(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (!hasExpensePortalAccess(req.user)) {
    return next(
      new ApiError(
        403,
        'Access denied: You do not have permission for the Expense Portal. Only expense portal assigned users can access.'
      )
    );
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
    if (!hasExpensePortalAccess(req.user)) {
      return next(
        new ApiError(
          403,
          'Access denied: You do not have permission for the Expense Portal. Only expense portal assigned users can access.'
        )
      );
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
  getExpensePortalEntry,
  getExpensePortalRoles,
  isExpenseAdmin,
  isExpenseFinance,
  hasExpensePortalAccess,
  requireExpensePortalAccess,
  requireExpenseAdmin,
  requireExpenseFinance,
  requireExpenseRole,
};
