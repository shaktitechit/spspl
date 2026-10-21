/**
 * @fileoverview Dashboard KPIs (dashboard slice / super.dashboard).
 * @module modules/dashboard/super.dashboard
 */
const { getModels } = require('../../data/mongoRegistry');
const financeService = require('../finance/finance.service');

/**
 * Combined cross-department overview for super_admin.
 * Pulls key KPIs from every department in a single aggregated response.
 */
async function overview() {
  const { User, Order, OrderFlag, OrderDispatch, Vehicle, Driver } = getModels();

  const [
    totalUsers,
    activeUsers,
    orderStats,
    openFlags,
    financeSummary,
    dispatchPending,
    vehicleCount,
    driverCount,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ is_active: { $ne: false } }),
    Order.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    OrderFlag.countDocuments({ status: 'open' }),
    financeService.summary(),
    OrderDispatch.countDocuments({ status: 'pending', deletedAt: null }),
    Vehicle.countDocuments({ is_active: { $ne: false } }),
    Driver.countDocuments({ is_active: { $ne: false } }),
  ]);

  const ordersByStatus = {};
  let totalOrders = 0;
  for (const s of orderStats) {
    if (s._id) {
      ordersByStatus[s._id] = s.count;
    }
    totalOrders += s.count;
  }

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
    },
    orders: {
      total: totalOrders,
      by_status: ordersByStatus,
    },
    finance: {
      queue_size: financeSummary.awaiting_finance || 0,
      awaiting_finance: financeSummary.awaiting_finance,
    },
    dispatch: {
      pending_dispatches: dispatchPending,
    },
    fleet: {
      active_vehicles: vehicleCount,
      active_drivers: driverCount,
    },
    flags: {
      open_flags: openFlags,
    },
  };
}

module.exports = { overview };
