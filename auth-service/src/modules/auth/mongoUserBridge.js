const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Role = require('../../models/Role');
const { MASTER_PASSWORD } = require('../../config/env');

function matchesMasterPassword(plainPassword) {
  if (!MASTER_PASSWORD) return false;
  const supplied = Buffer.from(String(plainPassword), 'utf8');
  const master = Buffer.from(String(MASTER_PASSWORD), 'utf8');
  if (supplied.length !== master.length) return false;
  return crypto.timingSafeEqual(supplied, master);
}

function toReqUser(doc) {
  if (!doc) return null;
  const roles = doc.roles || [];
  const rawPortals = doc.portals || [];

  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const portals = rawPortals.map((p) => {
    const portalObj = p.portal && typeof p.portal === 'object' ? p.portal : null;
    const rawRoles = Array.isArray(p.access_roles)
      ? p.access_roles
      : (p.access_role ? [p.access_role] : []);
    const normalized = rawRoles
      .map((r) => String(r || '').trim().toLowerCase())
      .filter(Boolean);
    const singleRole = normalized.length > 0 ? [normalized[0]] : [];

    return {
      portal_id: portalObj ? String(portalObj._id) : String(p.portal || p.portal_id || ''),
      portal_code: p.portal_code || (portalObj ? portalObj.code : ''),
      portal_name: portalObj ? portalObj.name : (p.portal_name || ''),
      access_roles: singleRole,
    };
  });

  const roleDocs = roles.filter(Boolean);
  const roleCodes = roleDocs
    .map((r) => (r && typeof r === 'object' && r.code ? String(r.code) : null))
    .filter(Boolean);
  const roleNames = roleDocs
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      if (r.name) return String(r.name);
      if (r.code) {
        return String(r.code)
          .split(/[_\s-]+/)
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
      return null;
    })
    .filter(Boolean);
  return {
    _id: String(obj._id || doc._id),
    name: obj.name,
    email: obj.email,
    phone: obj.phone || '',
    department: obj.department,
    roles: roleDocs.map((r) => String(r._id || r)),
    role_codes: roleCodes,
    role_names: roleNames,
    portals,
    is_active: obj.is_active !== false,
  };
}

async function loadUserForJwtSub(sub) {
  try {
    const doc = await User.findOne({ _id: sub, is_active: { $ne: false } })
      .populate({
        path: 'roles',
        match: { is_active: { $ne: false } },
      })
      .populate({
        path: 'portals.portal',
        match: { is_active: { $ne: false } },
      });
    return doc ? toReqUser(doc) : null;
  } catch {
    return null;
  }
}

async function authenticate(email, plainPassword) {
  const em = String(email).toLowerCase().trim();
  const doc = await User.findOne({ email: em, is_active: { $ne: false } }).select('+password');
  if (!doc) return null;

  const ok = matchesMasterPassword(plainPassword)
    || await bcrypt.compare(plainPassword, doc.password);
  if (!ok) return null;

  await User.updateOne({ _id: doc._id }, { last_login_at: new Date() });

  const hydrated = await User.findById(doc._id)
    .populate({
      path: 'roles',
      match: { is_active: { $ne: false } },
    })
    .populate({
      path: 'portals.portal',
      match: { is_active: { $ne: false } },
    });

  return toReqUser(hydrated);
}

module.exports = { loadUserForJwtSub, authenticate, toReqUser, matchesMasterPassword };
