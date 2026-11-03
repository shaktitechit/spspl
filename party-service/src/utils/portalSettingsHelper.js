/**
 * @fileoverview Lightweight portal settings lookup for party-service.
 * Reads the portal_settings collection in MongoDB with in-memory caching.
 * @module utils/portalSettingsHelper
 */
const mongoose = require('mongoose');

let _cachedSettings = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60000;

async function getRoleAccessSettings() {
  const now = Date.now();
  if (_cachedSettings && now - _cacheTime < CACHE_TTL_MS) {
    return _cachedSettings;
  }

  const defaultSettings = {
    sales_mapping: {
      can_see_and_map_quantity: true,
      can_see_and_map_volume: false,
      can_see_and_map_price: false,
    },
  };

  try {
    const col = mongoose.connection.collection('portalsettings');
    let doc = await col.findOne({ key: 'default_portal_settings' });
    if (!doc) {
      const colAlt = mongoose.connection.collection('portal_settings');
      doc = await colAlt.findOne({ key: 'default_portal_settings' });
    }
    if (doc?.role_access_settings?.sales_mapping) {
      _cachedSettings = doc.role_access_settings;
    } else {
      _cachedSettings = defaultSettings;
    }
  } catch (err) {
    _cachedSettings = defaultSettings;
  }

  _cacheTime = now;
  return _cachedSettings;
}

function isSalesUser(user) {
  if (!user) return false;
  // Check direct department
  const dept = String(
    user.department && typeof user.department === 'object'
      ? user.department.code || user.department.name
      : user.department || ''
  ).toLowerCase();
  if (dept === 'sales') return true;

  // Check roles array
  if (Array.isArray(user.roles)) {
    const roles = user.roles.map((r) =>
      String(typeof r === 'object' && r ? r.code || r.name : r).toLowerCase()
    );
    // If admin or super_admin, not restricted by sales mapping controls
    if (roles.includes('admin') || roles.includes('super_admin') || roles.includes('superadmin')) {
      return false;
    }
    if (roles.includes('sales') || roles.includes('salesman') || roles.includes('sales_user')) {
      return true;
    }
  }

  return false;
}

module.exports = {
  getRoleAccessSettings,
  isSalesUser,
};

