/**
 * @fileoverview Middleware to enforce Super Admin role access controls on Sales mapping.
 * Enforces permissions for:
 * 1. can_see_and_map_quantity
 * 2. can_see_and_map_volume
 * 3. can_see_and_map_price
 * @module middlewares/salesMappingAccess.middleware
 */
const { hasOpmsRole, isOpmsAdmin } = require('./opmsAuth.middleware');
const ROLES = require('../constants/roles');
const settingsService = require('../modules/settings/settings.service');

async function salesMappingAccessMiddleware(req, res, next) {
  // If no user or not a sales user (or user is an admin/super_admin), allow through
  if (!req.user || !hasOpmsRole(req.user, ROLES.SALES) || isOpmsAdmin(req.user)) {
    return next();
  }

  try {
    const portalSettings = await settingsService.getPortalSettings();
    const salesAccess = portalSettings?.role_access_settings?.sales_mapping || {
      can_see_and_map_quantity: true,
      can_see_and_map_volume: false,
      can_see_and_map_price: false,
    };

    const isPriceRestricted = !salesAccess.can_see_and_map_price;
    const isQuantityRestricted = !salesAccess.can_see_and_map_quantity;

    const url = req.originalUrl || req.url || '';
    const isRatePath = url.includes('/rates');

    // 1. Price mapping restrictions
    if (isPriceRestricted) {
      // POST or PATCH to rates sub-resource (e.g. /api/party-products/:id/rates or /api/party-products/rates/:rateId)
      if ((req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') && isRatePath) {
        return res.status(403).json({
          success: false,
          message: 'Sales role is not authorized to map or modify product prices. This feature is restricted in Portal Settings by Super Admin.',
        });
      }

      // POST to create mapping with nested rates
      if (req.method === 'POST' && req.body && Array.isArray(req.body.rates) && req.body.rates.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Sales role is not authorized to map or modify product prices. This feature is restricted in Portal Settings by Super Admin.',
        });
      }
    }

    // 2. Quantity mapping restrictions
    if (isQuantityRestricted && req.body && typeof req.body === 'object') {
      // If expected_order_quantity is provided, remove or reset it
      if ('expected_order_quantity' in req.body) {
        delete req.body.expected_order_quantity;
      }
      if (Array.isArray(req.body.rates)) {
        req.body.rates.forEach((rate) => {
          delete rate.min_qty;
          delete rate.max_qty;
        });
      }
      if ('min_qty' in req.body) delete req.body.min_qty;
      if ('max_qty' in req.body) delete req.body.max_qty;
    }

    return next();
  } catch (err) {
    console.error('[WARN] salesMappingAccessMiddleware error:', err.message);
    return next();
  }
}

module.exports = { salesMappingAccessMiddleware };

