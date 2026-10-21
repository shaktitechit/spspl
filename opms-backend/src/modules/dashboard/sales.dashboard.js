const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');

async function forUser(userId) {
  if (!userId) {
    return { my_orders: 0, draft: 0, pending_submit: 0 };
  }

  const { Order } = getModels();
  const userObjectId =
    typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

  const results = await Order.aggregate([
    {
      $match: {
        deletedAt: null,
        $or: [{ created_by: userObjectId }, { assigned_sales_user: userObjectId }],
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  let total = 0;
  let draftCount = 0;
  let submittedCount = 0;
  for (const row of results) {
    total += row.count;
    if (row._id === 'draft') draftCount = row.count;
    if (row._id === 'submitted') submittedCount = row.count;
  }

  return {
    my_orders: total,
    draft: draftCount,
    pending_submit: draftCount + submittedCount,
  };
}

module.exports = { forUser };
