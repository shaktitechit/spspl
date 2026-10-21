/**
 * @fileoverview Express middleware (auth.middleware) for JWT + auth-service identity.
 * @module middlewares/auth.middleware
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, AUTH_SERVICE_URL } = require('../config/env');
const { ApiError } = require('../utils/ApiError');

/**
 * Verifies the JWT signature, then loads the live user from auth-service (/me).
 * Falls back to JWT claims only if auth-service is unreachable.
 */
async function authMiddleware(req, res, next) {
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

    try {
      const resp = await axios.get(`${AUTH_SERVICE_URL.replace(/\/$/, '')}/api/auth/me`, {
        headers: { Authorization: `Bearer ${rawToken}` },
        timeout: 3000,
      });
      if (resp.data?.user) {
        req.user = resp.data.user;
        return next();
      }
    } catch (_lookupErr) {
      // auth-service down — fall through to claim snapshot
    }

    if (payload.email || payload.sub) {
      req.user = {
        _id: String(payload.sub || payload._id || ''),
        name: payload.name || '',
        email: payload.email || '',
        department: payload.department,
        roles: payload.roles || [],
        role_codes: payload.role_codes || [],
        portals: payload.portals || [],
      };
    }
    return next();
  } catch (_e) {
    return next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return next(
      new ApiError(401, 'Authentication required', {
        hint: 'POST /api/auth/login with { "email","password" }, then send header Authorization: Bearer <token>',
      })
    );
  }
  next();
}

module.exports = {
  authMiddleware,
  requireAuth,
};
