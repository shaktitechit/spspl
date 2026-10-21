/**
 * @fileoverview User Manager / admin portal gate for auth-service user APIs.
 * Mirrors user-manager-frontend hasSuperAdminAccess.
 */
const { ApiError } = require('../utils/ApiError');

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_');
}

function hasUserManagerAdminAccess(user) {
  if (!user) return false;
  const dept = normalize(user.department);
  if (dept === 'super_admin' || dept === 'admin') return true;

  const roleCodes = Array.isArray(user.role_codes) ? user.role_codes.map(normalize) : [];
  if (roleCodes.includes('super_admin') || roleCodes.includes('admin')) return true;

  const roles = Array.isArray(user.roles) ? user.roles.map(normalize) : [];
  if (roles.includes('super_admin') || roles.includes('admin')) return true;

  const portals = Array.isArray(user.portals) ? user.portals : [];
  for (const p of portals) {
    const code = normalize(p?.portal_code || p?.portal);
    if (code !== 'user_manager') continue;
    const access = Array.isArray(p.access_roles) ? p.access_roles.map(normalize) : [];
    if (access.includes('super_admin') || access.includes('admin')) return true;
  }
  return false;
}

function requireUserManagerAdmin(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (!hasUserManagerAdminAccess(req.user)) {
    return next(
      new ApiError(403, 'User Manager admin access required', {
        hint: 'Requires department/role admin|super_admin or user_manager portal access_roles',
      })
    );
  }
  return next();
}

module.exports = {
  hasUserManagerAdminAccess,
  requireUserManagerAdmin,
};
