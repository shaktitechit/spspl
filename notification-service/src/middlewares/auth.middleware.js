const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { ApiError } = require('../utils/ApiError');

function authMiddleware(req, res, next) {
  req.user = null;
  let rawToken = null;
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) {
    rawToken = h.slice(7);
  } else if (typeof req.query?.token === 'string' && req.query.token.trim()) {
    rawToken = req.query.token.trim();
  }

  if (!rawToken) return next();

  try {
    const payload = jwt.verify(rawToken, JWT_SECRET);
    req.user = {
      _id: payload.sub || payload._id || payload.id,
      name: payload.name,
      email: payload.email,
      department: payload.department,
      roles: payload.roles || [],
    };
    return next();
  } catch (_e) {
    return next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  next();
}

/** Service-to-service JWTs use sub like `backend-service` / `auth-service`. */
function requireInternalService(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  const sub = String(req.user._id || '');
  if (!/-service$/i.test(sub)) {
    return next(new ApiError(403, 'Service authentication required'));
  }
  next();
}

function requirePermissions(...requiredOneOf) {
  return requireAuth;
}

module.exports = {
  authMiddleware,
  requireAuth,
  requireInternalService,
  requirePermissions,
};
