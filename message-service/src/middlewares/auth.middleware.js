/**
 * @fileoverview JWT Authentication middleware for message-service.
 * @module middlewares/auth.middleware
 */
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
      _id: payload.sub,
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

module.exports = {
  authMiddleware,
  requireAuth,
};
