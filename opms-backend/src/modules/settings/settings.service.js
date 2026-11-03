/**
 * @fileoverview Portal & Workflow Settings Service.
 * Provides caching, default initialization, and atomic updates for portal settings.
 * @module modules/settings/settings.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');
const activityService = require('../activity/activity.service');

const SETTINGS_KEY = 'default_portal_settings';

const DEFAULT_SETTINGS = Object.freeze({
  key: SETTINGS_KEY,
  system_settings: {
    platform_name: 'Medica OPMS',
    support_email: 'support@medicaspl.com',
    currency: 'INR',
    currency_symbol: '₹',
    timezone: 'Asia/Kolkata',
    order_prefix: 'ORD-',
    fiscal_year_suffix: true,
    maintenance_mode: false,
    maintenance_message: 'System is currently undergoing scheduled maintenance.',
    session_timeout_minutes: 480,
    email_alerts_enabled: true,
    in_app_notifications_enabled: true,
  },
  workflow_settings: {
    performa_invoice_enabled: true,
    cost_sheet_enabled: true,
    kyc_verification_enabled: true,
    purchase_order_enabled: true,
    buy_back_enabled: false,
    buy_back_config: {
      require_inspection: true,
      auto_credit_ledger: false,
      default_valuation_rate: 30,
      terms: 'Buy Back is subject to technical inspection and serial verification.',
    },
  },
  role_access_settings: {
    sales_mapping: {
      can_see_and_map_quantity: true,
      can_see_and_map_volume: false,
      can_see_and_map_price: false,
    },
  },
});

let _cachedSettings = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute in-memory cache

async function getPortalSettings() {
  const now = Date.now();
  if (_cachedSettings && now - _cacheTime < CACHE_TTL_MS) {
    return _cachedSettings;
  }

  const { PortalSetting } = getModels();
  let settings = await PortalSetting.findOne({ key: SETTINGS_KEY }).lean();

  if (!settings) {
    const created = await PortalSetting.create(DEFAULT_SETTINGS);
    settings = created.toObject();
  } else {
    // Ensure nested defaults if older documents miss new keys
    settings.system_settings = {
      ...DEFAULT_SETTINGS.system_settings,
      ...(settings.system_settings || {}),
    };
    settings.workflow_settings = {
      ...DEFAULT_SETTINGS.workflow_settings,
      ...(settings.workflow_settings || {}),
      buy_back_config: {
        ...DEFAULT_SETTINGS.workflow_settings.buy_back_config,
        ...((settings.workflow_settings && settings.workflow_settings.buy_back_config) || {}),
      },
    };
    settings.role_access_settings = {
      ...DEFAULT_SETTINGS.role_access_settings,
      ...(settings.role_access_settings || {}),
      sales_mapping: {
        ...DEFAULT_SETTINGS.role_access_settings.sales_mapping,
        ...((settings.role_access_settings && settings.role_access_settings.sales_mapping) || {}),
      },
    };
  }

  _cachedSettings = settings;
  _cacheTime = now;
  return settings;
}

async function updatePortalSettings(payload, user) {
  const { PortalSetting } = getModels();

  let settings = await PortalSetting.findOne({ key: SETTINGS_KEY });
  if (!settings) {
    settings = new PortalSetting(DEFAULT_SETTINGS);
  }

  if (payload.system_settings && typeof payload.system_settings === 'object') {
    const currentSys = settings.system_settings
      ? typeof settings.system_settings.toObject === 'function'
        ? settings.system_settings.toObject()
        : settings.system_settings
      : {};
    settings.system_settings = {
      ...currentSys,
      ...payload.system_settings,
    };
    settings.markModified('system_settings');
  }

  if (payload.workflow_settings && typeof payload.workflow_settings === 'object') {
    const currentWf = settings.workflow_settings
      ? typeof settings.workflow_settings.toObject === 'function'
        ? settings.workflow_settings.toObject()
        : settings.workflow_settings
      : {};
    const newWf = payload.workflow_settings;

    settings.workflow_settings = {
      ...currentWf,
      ...newWf,
      buy_back_config: {
        ...(currentWf.buy_back_config || {}),
        ...(newWf.buy_back_config || {}),
      },
    };
    settings.markModified('workflow_settings');
  }

  if (payload.role_access_settings && typeof payload.role_access_settings === 'object') {
    const currentRa = settings.role_access_settings
      ? typeof settings.role_access_settings.toObject === 'function'
        ? settings.role_access_settings.toObject()
        : settings.role_access_settings
      : {};
    const newRa = payload.role_access_settings;

    settings.role_access_settings = {
      ...currentRa,
      ...newRa,
      sales_mapping: {
        ...((currentRa && currentRa.sales_mapping) || {}),
        ...((newRa && newRa.sales_mapping) || {}),
      },
    };
    settings.markModified('role_access_settings');
  }

  if (user && user._id) {
    settings.updated_by = user._id;
  }

  await settings.save();

  // Invalidate cache
  _cachedSettings = settings.toObject();
  _cacheTime = Date.now();

  try {
    await activityService.log({
      action: 'portal_settings_updated',
      entity_type: 'PortalSetting',
      entity_id: settings._id,
      actor_id: user?._id,
      actor_name: user?.name || 'Super Admin',
      actor_role: 'super_admin',
      details: {
        updated_keys: Object.keys(payload),
        workflow_flags: {
          performa_invoice_enabled: settings.workflow_settings.performa_invoice_enabled,
          cost_sheet_enabled: settings.workflow_settings.cost_sheet_enabled,
          kyc_verification_enabled: settings.workflow_settings.kyc_verification_enabled,
          purchase_order_enabled: settings.workflow_settings.purchase_order_enabled,
          buy_back_enabled: settings.workflow_settings.buy_back_enabled,
        },
      },
    });
  } catch (_e) {
    // Activity logging shouldn't block setting update
  }

  return _cachedSettings;
}

async function getWorkflowFlags() {
  const s = await getPortalSettings();
  return (
    s.workflow_settings || {
      performa_invoice_enabled: true,
      cost_sheet_enabled: true,
      kyc_verification_enabled: true,
      purchase_order_enabled: true,
      buy_back_enabled: false,
    }
  );
}

module.exports = {
  getPortalSettings,
  updatePortalSettings,
  getWorkflowFlags,
  DEFAULT_SETTINGS,
};

