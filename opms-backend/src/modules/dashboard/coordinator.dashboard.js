const { getModels } = require('../../data/mongoRegistry');

async function overview(userId = null) {
  const { Order, OrderFlag } = getModels();

  const [orders, flagCount, myOrdersCount] = await Promise.all([
    Order.find({ deletedAt: null }).select('status').lean(),
    OrderFlag.countDocuments({ status: 'open' }),
    userId
      ? Order.countDocuments({
          deletedAt: null,
          $or: [{ created_by: userId }, { assigned_sales_user: userId }],
        })
      : 0,
  ]);

  const byStatus = {};
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  }

  return {
    orders_total: orders.length,
    orders_by_status: byStatus,
    open_flags: flagCount,
    draft: byStatus.draft || 0,
    submitted: byStatus.submitted || 0,
    pending_submit: (byStatus.draft || 0) + (byStatus.submitted || 0),
    my_orders: myOrdersCount || orders.length,
  };
}

module.exports = { overview };
