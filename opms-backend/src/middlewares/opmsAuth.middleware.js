/**
 * @fileoverview Middleware + helpers for OPMS portal access (portal_code: opms).
 * Mirrors lead-manager portal gating: access_roles on portals[], not user.department.
 * @module middlewares/opmsAuth.middleware
 */
const { ApiError } = require('../utils/ApiError');
const ROLES = require('../constants/roles');

const OPMS_PORTAL_CODE = 'opms';

const OPMS_ACCESS_ROLES = Object.freeze([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.SALES,
  ROLES.FINANCE,
  ROLES.ACCOUNT,
  ROLES.DISPATCH,
]);

/** Priority for audit/actor fields when a user has multiple access_roles. */
const OPMS_ROLE_PRIORITY = Object.freeze([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.FINANCE,
  ROLES.ACCOUNT,
  ROLES.DISPATCH,
  ROLES.SALES,
]);

function normalizeRole(raw) {
  if (raw == null) return '';
  const s = String(raw).trim().toLowerCase();
  if (!s || s === 'null' || s === 'undefined') return '';
  if (s === 'superadmin' || s === 'super-admin' || s === 'super admin') return 'super_admin';
  if (s === 'administrator' || s === 'admin_user') return 'admin';
  if (s === 'accounts' || s === 'accounting') return 'account';
  if (s === 'salesman' || s === 'sales_user') return 'sales';
  if (s === 'dispatches' || s === 'dispatch_team') return 'dispatch';
  return s;
}

function getOpmsPortalAccess(user) {
  if (!user) return null;
  const portals = Array.isArray(user.portals)
    ? user.portals
    : Array.isArray(user.portal_access)
      ? user.portal_access
      : [];
  return (
    portals.find(
      (p) =>
        p &&
        (p.portal_code === OPMS_PORTAL_CODE ||
          p.portal === OPMS_PORTAL_CODE ||
          p.code === OPMS_PORTAL_CODE ||
          (typeof p.portal_name === 'string' && p.portal_name.toLowerCase().includes('opms')))
    ) || null
  );
}

function getOpmsAccessRole(user) {
  if (!user) return null;
  const portalAccess = getOpmsPortalAccess(user);
  let rawRole = null;

  if (portalAccess) {
    if (Array.isArray(portalAccess.access_roles) && portalAccess.access_roles.length > 0) {
      rawRole = portalAccess.access_roles[0];
    } else if (portalAccess.access_role) {
      rawRole = portalAccess.access_role;
    } else if (portalAccess.role) {
      rawRole = portalAccess.role;
    }
  }

  if (!rawRole) {
    if (user.access_role) rawRole = user.access_role;
    else if (Array.isArray(user.access_roles) && user.access_roles.length > 0) rawRole = user.access_roles[0];
    else if (user.role) rawRole = user.role;
    else if (Array.isArray(user.roles) && user.roles.length > 0) {
      const firstRole = user.roles[0];
      rawRole = typeof firstRole === 'object' && firstRole ? (firstRole.code || firstRole.name) : firstRole;
    }
    else if (Array.isArray(user.role_codes) && user.role_codes.length > 0) rawRole = user.role_codes[0];
    else if (typeof user.department === 'string') rawRole = user.department;
    else if (user.department && typeof user.department === 'object') {
      rawRole = user.department.code || user.department.name;
    }
    else if (user.department_code) rawRole = user.department_code;
    else if (user.department_name) rawRole = user.department_name;
  }

  if (!rawRole) return null;
  const normalized = normalizeRole(rawRole);
  return OPMS_ACCESS_ROLES.includes(normalized) ? normalized : normalized;
}

function getOpmsAccessRoles(user) {
  const role = getOpmsAccessRole(user);
  return role ? [role] : [];
}

function hasOpmsAccess(user) {
  return Boolean(getOpmsAccessRole(user));
}

function hasOpmsRole(user, ...roles) {
  const allowed = roles.flat().map(normalizeRole).filter(Boolean);
  if (!allowed.length) return false;
  const userRole = getOpmsAccessRole(user);
  return userRole ? allowed.includes(userRole) : false;
}

function hasAnyOpmsRole(user, roleList) {
  const list = Array.isArray(roleList) ? roleList : [roleList];
  return hasOpmsRole(user, ...list);
}

/**
 * Single role string for workflow/flag actor metadata.
 */
function primaryOpmsRole(user) {
  return getOpmsAccessRole(user);
}

function isOpmsAdmin(user) {
  return hasAnyOpmsRole(user, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);
}

function requireOpmsAccess(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (!hasOpmsAccess(req.user)) {
    return next(new ApiError(403, 'Access denied: opms portal access required'));
  }
  next();
}

function requireOpmsRole(...allowedRoles) {
  const flat = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }
    if (!hasOpmsAccess(req.user)) {
      return next(new ApiError(403, 'Access denied: opms portal access required'));
    }
    // admin / super_admin bypass for role-scoped routes (matches prior department policy)
    if (isOpmsAdmin(req.user)) {
      return next();
    }
    if (hasAnyOpmsRole(req.user, flat)) {
      return next();
    }
    return next(
      new ApiError(
        403,
        `Access denied: Requires ${flat.join(' or ')} role on opms portal`
      )
    );
  };
}

module.exports = {
  OPMS_PORTAL_CODE,
  OPMS_ACCESS_ROLES,
  OPMS_ROLE_PRIORITY,
  getOpmsPortalAccess,
  getOpmsAccessRole,
  getOpmsAccessRoles,
  hasOpmsAccess,
  hasOpmsRole,
  hasAnyOpmsRole,
  primaryOpmsRole,
  isOpmsAdmin,
  requireOpmsAccess,
  requireOpmsRole,
};
