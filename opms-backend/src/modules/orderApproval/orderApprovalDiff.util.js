/**
 * @fileoverview Diff and snapshot utilities for OrderApproval revision history.
 * @module modules/orderApproval/orderApprovalDiff.util
 */

function idString(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') {
    if (val._id) return String(val._id).trim();
    if (val.id) return String(val.id).trim();
  }
  return String(val).trim();
}

function resolveProductLabel(item, productMap) {
  const prod = item.product;
  if (prod && typeof prod === 'object' && prod.product_name) {
    return {
      name: String(prod.product_name || '—'),
      sku: typeof prod.sku === 'string' ? prod.sku : '',
    };
  }
  const pid = idString(prod);
  if (pid && productMap && productMap.has(pid)) {
    const cached = productMap.get(pid);
    return {
      name: String(cached.product_name || cached.name || '—'),
      sku: String(cached.sku || ''),
    };
  }
  return {
    name: String(item.product_name || '—'),
    sku: String(item.sku || ''),
  };
}

function itemKey(it) {
  const kitParent = idString(it.kit_parent_product);
  const lineId = idString(it.order_item_id);
  const prodId = idString(it.product);
  if (kitParent) {
    return `kit:${kitParent}:${lineId || prodId}`;
  }
  return `line:${lineId || prodId}`;
}

const TRACKED_NUMERIC_FIELDS = [
  'approved_quantity',
  'approved_unit_price',
  'approved_total_amount',
  'ordered_quantity',
  'discount_percent',
  'discount_amount',
  'gst_percent',
  'free_quantity',
];

const TRACKED_STRING_FIELDS = [
  'applied_rate_type',
  'remarks',
];

/**
 * Computes granular line-item differences between previous and next approval items.
 */
function computeApprovalDiff(previousItems = [], nextItems = [], productMap = new Map()) {
  const prevMap = new Map();
  for (const it of previousItems) {
    prevMap.set(itemKey(it), it);
  }

  const nextMap = new Map();
  for (const it of nextItems) {
    nextMap.set(itemKey(it), it);
  }

  const changes = [];

  // Check modified or added in next
  for (const [key, nextItem] of nextMap.entries()) {
    const prevItem = prevMap.get(key);
    const label = resolveProductLabel(nextItem, productMap);
    const orderItemId = idString(nextItem.order_item_id);
    const productId = idString(nextItem.product);
    const kitParent = idString(nextItem.kit_parent_product);

    if (!prevItem) {
      changes.push({
        order_item_id: orderItemId,
        product: productId,
        product_name: label.name,
        sku: label.sku,
        kit_parent_product: kitParent || null,
        change_type: 'added',
        field_changes: [],
        after: {
          approved_quantity: Number(nextItem.approved_quantity ?? 0),
          approved_unit_price: Number(nextItem.approved_unit_price ?? nextItem.ordered_unit_price ?? 0),
          approved_total_amount: Number(nextItem.approved_total_amount ?? 0),
          ordered_quantity: Number(nextItem.ordered_quantity ?? 0),
          discount_percent: Number(nextItem.discount_percent ?? 0),
          discount_amount: Number(nextItem.discount_amount ?? 0),
          gst_percent: Number(nextItem.gst_percent ?? 0),
          free_quantity: Number(nextItem.free_quantity ?? 0),
          applied_rate_type: String(nextItem.applied_rate_type ?? 'MANUAL'),
          remarks: String(nextItem.remarks ?? ''),
        },
      });
      continue;
    }

    // Compare fields
    const fieldChanges = [];
    for (const field of TRACKED_NUMERIC_FIELDS) {
      const fromVal = Number(prevItem[field] ?? 0);
      const toVal = Number(nextItem[field] ?? 0);
      // Small epsilon comparison for floats
      if (Math.abs(fromVal - toVal) > 0.0001) {
        fieldChanges.push({
          field,
          from: fromVal,
          to: toVal,
          difference: Number((toVal - fromVal).toFixed(2)),
        });
      }
    }

    for (const field of TRACKED_STRING_FIELDS) {
      const fromVal = String(prevItem[field] ?? '').trim();
      const toVal = String(nextItem[field] ?? '').trim();
      if (fromVal !== toVal) {
        fieldChanges.push({
          field,
          from: fromVal,
          to: toVal,
        });
      }
    }

    if (fieldChanges.length > 0) {
      changes.push({
        order_item_id: orderItemId,
        product: productId,
        product_name: label.name,
        sku: label.sku,
        kit_parent_product: kitParent || null,
        change_type: 'modified',
        field_changes: fieldChanges,
      });
    }
  }

  // Check removed
  for (const [key, prevItem] of prevMap.entries()) {
    if (!nextMap.has(key)) {
      const label = resolveProductLabel(prevItem, productMap);
      changes.push({
        order_item_id: idString(prevItem.order_item_id),
        product: idString(prevItem.product),
        product_name: label.name,
        sku: label.sku,
        kit_parent_product: idString(prevItem.kit_parent_product) || null,
        change_type: 'removed',
        field_changes: [],
        before: {
          approved_quantity: Number(prevItem.approved_quantity ?? 0),
          approved_unit_price: Number(prevItem.approved_unit_price ?? prevItem.ordered_unit_price ?? 0),
          approved_total_amount: Number(prevItem.approved_total_amount ?? 0),
          ordered_quantity: Number(prevItem.ordered_quantity ?? 0),
        },
      });
    }
  }

  return changes;
}

/**
 * Builds a clean snapshot of approval items.
 */
function buildApprovalSnapshot(items = [], productMap = new Map()) {
  return items.map((it) => {
    const label = resolveProductLabel(it, productMap);
    return {
      order_item_id: idString(it.order_item_id),
      product: idString(it.product),
      product_name: label.name,
      sku: label.sku,
      kit_parent_product: idString(it.kit_parent_product) || null,
      ordered_quantity: Number(it.ordered_quantity ?? 0),
      ordered_unit_price: Number(it.ordered_unit_price ?? 0),
      ordered_total_amount: Number(it.ordered_total_amount ?? 0),
      approved_quantity: Number(it.approved_quantity ?? 0),
      approved_unit_price: Number(it.approved_unit_price ?? 0),
      approved_total_amount: Number(it.approved_total_amount ?? 0),
      applied_rate_type: String(it.applied_rate_type ?? 'MANUAL'),
      discount_percent: Number(it.discount_percent ?? 0),
      discount_amount: Number(it.discount_amount ?? 0),
      gst_percent: Number(it.gst_percent ?? 0),
      free_quantity: Number(it.free_quantity ?? 0),
      remarks: String(it.remarks ?? ''),
    };
  });
}

/**
 * Persists an OrderApprovalHistory record.
 */
async function recordApprovalHistory({
  orderApprovalDoc,
  previousItems = [],
  previousFinancials = {},
  stage = 'amended',
  department = 'admin',
  action = 'amended',
  user,
  notes = '',
  models,
}) {
  try {
    const { OrderApprovalHistory, Product } = models;
    if (!OrderApprovalHistory) return null;

    const currentItems = orderApprovalDoc.approval_items || [];

    // Collect product IDs to batch resolve labels if needed
    const productIds = new Set();
    for (const it of [...previousItems, ...currentItems]) {
      const pid = idString(it.product);
      if (pid) productIds.add(pid);
    }

    const productMap = new Map();
    if (Product && productIds.size > 0) {
      const prods = await Product.find({ _id: { $in: Array.from(productIds) } })
        .select('product_name sku')
        .lean();
      for (const p of prods) {
        productMap.set(String(p._id), p);
      }
    }

    const changes = computeApprovalDiff(previousItems, currentItems, productMap);
    const snapshot = buildApprovalSnapshot(currentItems, productMap);

    const prevApproved = Number(previousFinancials.approved_total_amount ?? orderApprovalDoc.approved_total_amount ?? 0);
    const nextApproved = Number(orderApprovalDoc.approved_total_amount ?? 0);
    const prevOrdered = Number(previousFinancials.ordered_total_amount ?? orderApprovalDoc.ordered_total_amount ?? 0);
    const nextOrdered = Number(orderApprovalDoc.ordered_total_amount ?? 0);

    const historyRecord = await OrderApprovalHistory.create({
      order_approval: orderApprovalDoc._id,
      order: orderApprovalDoc.order,
      revision_number: orderApprovalDoc.revision_number || 1,
      stage,
      department,
      action,
      changed_by: user ? user._id : null,
      changed_at: new Date(),
      notes: String(notes || ''),
      financials: {
        previous_approved_total: prevApproved,
        new_approved_total: nextApproved,
        previous_ordered_total: prevOrdered,
        new_ordered_total: nextOrdered,
        difference_approved_total: Number((nextApproved - prevApproved).toFixed(2)),
      },
      changes,
      snapshot,
    });

    return historyRecord;
  } catch (err) {
    // History recording should be resilient and not crash main approval pipeline
    console.error('[recordApprovalHistory] Error recording approval history:', err);
    return null;
  }
}

module.exports = {
  computeApprovalDiff,
  buildApprovalSnapshot,
  recordApprovalHistory,
};

