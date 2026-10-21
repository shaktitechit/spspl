const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ApiError } = require('../../utils/ApiError');
const { assertPasswordStrength } = require('../../utils/passwordPolicy');
const { JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN } = require('../../config/env');
const { sanitizeUser } = require('../../utils/sanitize');
const User = require('../../models/User');
const AuthHandoff = require('../../models/AuthHandoff');
const RefreshToken = require('../../models/RefreshToken');
const {
  loadUserForJwtSub,
  authenticate,
  matchesMasterPassword,
} = require('./mongoUserBridge');

const HANDOFF_TTL_MS = 60 * 1000;
/** Near-simultaneous refreshes of the same token (two tabs) must not revoke the family. */
const REUSE_GRACE_MS = 30 * 1000;

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function durationMs(value, fallbackMs) {
  const match = /^(\d+)\s*([smhd])$/i.exec(String(value || '').trim());
  if (!match) return fallbackMs;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const mult = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return n * mult[unit];
}

function refreshTtlMs(value) {
  return durationMs(value, 30 * 24 * 60 * 60 * 1000);
}

async function issueRefreshToken(userId, familyId) {
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const family = familyId || crypto.randomBytes(16).toString('hex');
  await RefreshToken.create({
    user_id: userId,
    family_id: family,
    token_hash: hashToken(refreshToken),
    expires_at: new Date(Date.now() + refreshTtlMs(JWT_REFRESH_EXPIRES_IN)),
  });
  return refreshToken;
}

function tokenLifetimes() {
  return {
    expiresIn: Math.floor(durationMs(JWT_EXPIRES_IN, 15 * 60 * 1000) / 1000),
    refreshExpiresIn: Math.floor(durationMs(JWT_REFRESH_EXPIRES_IN, 30 * 24 * 60 * 60 * 1000) / 1000),
  };
}

async function revokeFamily(familyId) {
  if (!familyId) return;
  await RefreshToken.updateMany(
    { family_id: familyId, revoked_at: null },
    { $set: { revoked_at: new Date() } }
  );
}

async function revokeAllForUser(userId) {
  if (!userId) return;
  await RefreshToken.updateMany(
    { user_id: userId, revoked_at: null },
    { $set: { revoked_at: new Date() } }
  );
}

function registerToken(user) {
  // Claims are a snapshot for clients; servers re-load the user from Mongo on each request.
  const payload = {
    sub: String(user._id),
    name: user.name,
    email: user.email,
    department: user.department,
    roles: user.roles || [],
    role_codes: user.role_codes || [],
    role_names: user.role_names || [],
    portals: user.portals || [],
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function hashHandoffCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

async function login(email, password) {
  const user = await authenticate(email, password);
  if (!user) throw new ApiError(401, 'Invalid credentials');

  const token = registerToken(user);
  const refreshToken = await issueRefreshToken(user._id);
  return { token, refreshToken, user, ...tokenLifetimes() };
}

async function me(userId) {
  const u = await loadUserForJwtSub(userId);
  if (!u) throw new ApiError(401, 'Unauthorized');
  return sanitizeUser(u);
}

async function changePassword(userId, currentPassword, newPassword) {
  const current = String(currentPassword || '');
  const next = String(newPassword || '');
  if (!current) throw new ApiError(400, 'Current password is required');
  assertPasswordStrength(next, 'New password');
  if (current === next) {
    throw new ApiError(400, 'New password must be different from the current password');
  }

  const doc = await User.findById(userId).select('+password');
  if (!doc || doc.is_active === false) throw new ApiError(401, 'Unauthorized');

  const ok =
    (typeof matchesMasterPassword === 'function' && matchesMasterPassword(current))
    || await bcrypt.compare(current, doc.password);
  if (!ok) throw new ApiError(400, 'Current password is incorrect');

  doc.password = await bcrypt.hash(next, 10);
  await doc.save();
  await revokeAllForUser(doc._id);
  return { success: true };
}

/**
 * Create a one-time SSO handoff code for the authenticated user (TTL ~60s).
 */
async function createHandoff(userId) {
  const user = await loadUserForJwtSub(userId);
  if (!user) throw new ApiError(401, 'Unauthorized');

  const code = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS);
  await AuthHandoff.create({
    code_hash: hashHandoffCode(code),
    user_id: user._id,
    expires_at: expiresAt,
  });

  return {
    code,
    expires_in: Math.floor(HANDOFF_TTL_MS / 1000),
  };
}

/**
 * Exchange a one-time handoff code for a fresh JWT + user (single use).
 */
async function exchangeHandoff(code) {
  const raw = String(code || '').trim();
  if (!raw || raw.length < 16) {
    throw new ApiError(400, 'Invalid handoff code');
  }

  const codeHash = hashHandoffCode(raw);
  const doc = await AuthHandoff.findOneAndUpdate(
    {
      code_hash: codeHash,
      used_at: null,
      expires_at: { $gt: new Date() },
    },
    { $set: { used_at: new Date() } },
    { new: true }
  );

  if (!doc) {
    throw new ApiError(401, 'Handoff code invalid, expired, or already used');
  }

  const user = await loadUserForJwtSub(String(doc.user_id));
  if (!user) throw new ApiError(401, 'Unauthorized');

  const token = registerToken(user);
  const refreshToken = await issueRefreshToken(user._id);
  return { token, refreshToken, user, ...tokenLifetimes() };
}

/**
 * Rotate one device family. Other families for the same user stay valid.
 */
async function refresh(rawToken) {
  const raw = String(rawToken || '').trim();
  if (!raw) throw new ApiError(401, 'Refresh token invalid or expired');

  const now = new Date();
  const claimed = await RefreshToken.findOneAndUpdate(
    { token_hash: hashToken(raw), revoked_at: null, expires_at: { $gt: now } },
    { $set: { revoked_at: now } },
    { new: false }
  );

  if (!claimed) {
    const existing = await RefreshToken.findOne({ token_hash: hashToken(raw) });
    if (existing?.revoked_at) {
      const age = Date.now() - new Date(existing.revoked_at).getTime();
      if (age > REUSE_GRACE_MS) await revokeFamily(existing.family_id);
    }
    throw new ApiError(401, 'Refresh token invalid or expired');
  }

  const user = await loadUserForJwtSub(String(claimed.user_id));
  if (!user) {
    await revokeFamily(claimed.family_id);
    throw new ApiError(401, 'Unauthorized');
  }

  const token = registerToken(user);
  const refreshToken = await issueRefreshToken(claimed.user_id, claimed.family_id);
  return { token, refreshToken, user, ...tokenLifetimes() };
}

/** Revoke only the presented token's device family. */
async function logout(rawToken) {
  const raw = String(rawToken || '').trim();
  if (!raw) return { success: true };
  const existing = await RefreshToken.findOne({ token_hash: hashToken(raw) });
  if (existing) await revokeFamily(existing.family_id);
  return { success: true };
}

module.exports = {
  login,
  me,
  changePassword,
  registerToken,
  createHandoff,
  exchangeHandoff,
  refresh,
  logout,
};
