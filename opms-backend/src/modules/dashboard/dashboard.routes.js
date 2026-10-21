/**
 * @fileoverview Dashboard: Express router mounts + RBAC wrappers.
 * @module modules/dashboard/dashboard.routes
 */
const { Router } = require('express');
const router = Router();
const asyncHandler = require('../../utils/asyncHandler');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireOpmsAccess } = require('../../middlewares/opmsAuth.middleware');
const adminDash = require('./admin.dashboard');
const salesDash = require('./sales.dashboard');
const financeDash = require('./finance.dashboard');
const dispatchDash = require('./dispatch.dashboard');
const accountDash = require('./account.dashboard');
const superDash = require('./super.dashboard');
const ordersSummaryService = require('./ordersSummary.service');
const { buildBaseQuery } = require('../orders/order.service');

router.use(requireAuth);
router.use(requireOpmsAccess);

router.get(
  '/orders-summary',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await ordersSummaryService.ordersSummary(req.query, req.user, buildBaseQuery),
    });
  }),
);

router.get(
  '/admin',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await adminDash.overview() });
  })
);

router.get(
  '/sales',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await salesDash.forUser(req.user._id) });
  })
);

router.get(
  '/finance',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await financeDash.summary() });
  })
);

router.get(
  '/dispatch',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await dispatchDash.summary() });
  })
);

router.get(
  '/account',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await accountDash.summary() });
  })
);

router.get(
  '/super',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await superDash.overview() });
  })
);

module.exports = router;
