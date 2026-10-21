/**
 * @fileoverview Compute transport plan line weight (kg) and package (box) counts from product master.
 * @module modules/transportPlanner/planOrderLogistics
 */
const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');

function productIdFromRef(val) {
  if (val == null) return '';
  if (typeof val === 'object') {
    return String(val._id ?? val.id ?? '');
  }
  return String(val);
}

function qtyFromOrderItem(item) {
  if (String(item?.line_status || '').toLowerCase() === 'cancelled') return 0;

  const remaining = Number(item?.remaining_quantity);
  if (Number.isFinite(remaining) && remaining > 0) return remaining;

  const approved = Number(item?.approved_quantity) || 0;
  const dispatched = Number(item?.dispatched_quantity) || 0;
  const ordered = Number(item?.ordered_quantity ?? item?.quantity) || 0;
  const base = approved > 0 ? approved : ordered;
  let qty = base - dispatched;
  if (qty < 0) qty = 0;
  return qty;
}

function quantityLinesFromOrder(order) {
  const lines = [];
  for (const item of order?.order_items || []) {
    const qty = qtyFromOrderItem(item);
    if (qty <= 0) continue;
    const productId = productIdFromRef(item.product);
    const sku =
      item.sku != null && String(item.sku).trim()
        ? String(item.sku).trim().toUpperCase()
        : undefined;
    if (!productId && !sku) continue;
    lines.push({
      orderItemId: item._id ? String(item._id) : undefined,
      productId: productId || '',
      sku,
      quantity: qty,
      productName: item.product_name ? String(item.product_name) : undefined,
      unit: item.unit != null ? String(item.unit) : undefined,
    });
  }
  return lines;
}

function dispatchQty(item) {
  const dispatched = Number(item?.dispatched_quantity ?? item?.dispatch_quantity);
  if (Number.isFinite(dispatched) && dispatched > 0) return dispatched;
  const allocated = Number(item?.allocated_quantity);
  if (Number.isFinite(allocated) && allocated > 0) return allocated;
  return 0;
}

function productMetaFromDispatchRow(item, matchItem) {
  const populated =
    item?.product && typeof item.product === 'object' && !Array.isArray(item.product)
      ? item.product
      : null;
  const productId =
    productIdFromRef(item?.product) ||
    productIdFromRef(matchItem?.product) ||
    productIdFromRef(populated);
  let sku =
    matchItem?.sku != null && String(matchItem.sku).trim()
      ? String(matchItem.sku).trim().toUpperCase()
      : undefined;
  if (!sku && item?.sku != null && String(item.sku).trim()) {
    sku = String(item.sku).trim().toUpperCase();
  }
  if (!sku && populated?.sku != null && String(populated.sku).trim()) {
    sku = String(populated.sku).trim().toUpperCase();
  }
  let productName =
    matchItem?.product_name != null ? String(matchItem.product_name) : undefined;
  if (!productName && item?.product_name != null) productName = String(item.product_name);
  if (!productName && populated?.product_name != null) {
    productName = String(populated.product_name);
  }
  return { productId: productId || '', sku, productName };
}

function quantityLinesFromDispatch(dispatch, orderItems = []) {
  const lines = [];
  const items = dispatch?.dispatch_items || [];
  for (const item of items) {
    const qty = dispatchQty(item);
    if (qty <= 0) continue;

    const orderItemId = item.order_item_id ? String(item.order_item_id) : '';
    const matchItem =
      orderItems.find((li) => String(li._id ?? li.id ?? '') === orderItemId) ||
      orderItems.find((li) => productIdFromRef(li.product) === productIdFromRef(item.product));

    const { productId, sku, productName } = productMetaFromDispatchRow(item, matchItem);
    if (!productId && !sku) continue;

    lines.push({
      orderItemId: orderItemId || (matchItem?._id ? String(matchItem._id) : undefined),
      productId,
      sku,
      quantity: qty,
      productName,
      unit: matchItem?.unit != null ? String(matchItem.unit) : undefined,
    });
  }
  return lines;
}

function dispatchesForLogisticsPreview(dispatches = []) {
  const all = (dispatches || []).filter(
    (d) => String(d?.dispatch_status ?? d?.status ?? '') !== 'cancelled' && d?.deletedAt == null,
  );
  const submitted = all.filter((d) => {
    const status = String(d?.dispatch_status ?? d?.status ?? '');
    return status !== 'draft' && status !== 'cancelled';
  });
  return submitted.length > 0
    ? submitted
    : all.filter((d) => String(d?.dispatch_status ?? d?.status) === 'draft');
}

/** Prefer non-draft dispatch lines; else pending order lines. */
function collectLogisticsQuantityLines(order, dispatches = []) {
  const orderItems = order?.order_items || [];
  const fromDispatch = [];

  for (const dispatch of dispatchesForLogisticsPreview(dispatches)) {
    const dispatchLines = quantityLinesFromDispatch(dispatch, orderItems);
    const dispatchNo = String(dispatch.dispatch_no ?? dispatch._id ?? '').trim();
    for (const line of dispatchLines) {
      fromDispatch.push({
        ...line,
        dispatchNo: dispatchNo || undefined,
      });
    }
  }

  if (fromDispatch.length > 0) {
    return fromDispatch;
  }

  return quantityLinesFromOrder(order);
}

function resolveProductForLine(line, productMap) {
  if (line.productId && productMap.has(line.productId)) {
    return productMap.get(line.productId);
  }
  if (line.sku && productMap.has(line.sku)) {
    return productMap.get(line.sku);
  }
  return null;
}

/**
 * @param {Array<{ productId: string, quantity: number, productName?: string, sku?: string }>} qtyLines
 * @param {Map<string, { product_name?: string, unit_weight_kg?: number, units_per_box?: number }>} productMap
 */
function computeLogisticsFromQuantityLines(qtyLines, productMap) {
  if (!qtyLines.length) {
    return {
      weight: undefined,
      packed_boxes: undefined,
      open_boxes: undefined,
      packages: undefined,
      items: [],
      warnings: ['No dispatched or remaining quantity to preview'],
    };
  }

  let totalWeight = 0;
  let totalPacked = 0;
  let totalOpen = 0;
  let hasWeight = false;
  let hasBoxes = false;
  const warnings = [];
  const items = [];

  for (const line of qtyLines) {
    const prod = resolveProductForLine(line, productMap);
    const label = line.productName || prod?.product_name || line.sku || line.productId;

    const row = {
      order_item_id: line.orderItemId || undefined,
      product_id: prod?._id ? String(prod._id) : line.productId || undefined,
      product_name: label,
      sku: line.sku || (prod?.sku ? String(prod.sku) : undefined),
      unit: line.unit || undefined,
      quantity: line.quantity,
      unit_weight_kg:
        prod?.unit_weight_kg != null && prod.unit_weight_kg !== ''
          ? Number(prod.unit_weight_kg)
          : undefined,
      units_per_box:
        prod?.units_per_box != null && prod.units_per_box !== ''
          ? Number(prod.units_per_box)
          : undefined,
      weight_kg: undefined,
      packed_boxes: undefined,
      open_boxes: undefined,
      open_units: undefined,
      warning: undefined,
    };

    if (!prod) {
      row.warning = 'Product not found in master';
      warnings.push(`Product not found: ${label}`);
      items.push(row);
      continue;
    }

    const unitWeight = prod.unit_weight_kg;
    if (unitWeight != null && unitWeight !== '' && Number.isFinite(Number(unitWeight)) && Number(unitWeight) >= 0) {
      const lineWeight = line.quantity * Number(unitWeight);
      row.weight_kg = Math.round(lineWeight * 100) / 100;
      totalWeight += lineWeight;
      hasWeight = true;
    } else {
      row.warning = row.warning || 'Missing unit weight (kg) on product';
      warnings.push(`Missing unit weight (kg): ${label}`);
    }

    const unitsPerBox = prod.units_per_box;
    if (
      unitsPerBox != null &&
      unitsPerBox !== '' &&
      Number.isFinite(Number(unitsPerBox)) &&
      Number(unitsPerBox) >= 1
    ) {
      const upb = Number(unitsPerBox);
      const packed = Math.floor(line.quantity / upb);
      const remainder = line.quantity % upb;
      const open = remainder > 0 ? 1 : 0;
      row.packed_boxes = packed;
      row.open_boxes = open;
      row.open_units = remainder > 0 ? remainder : 0;
      totalPacked += packed;
      totalOpen += open;
      hasBoxes = true;
    } else {
      row.warning = row.warning || 'Missing units per box on product';
      warnings.push(`Missing units per box: ${label}`);
    }

    items.push(row);
  }

  const packages = hasBoxes ? totalPacked + totalOpen : undefined;

  return {
    weight: hasWeight ? Math.round(totalWeight * 100) / 100 : undefined,
    packed_boxes: hasBoxes ? totalPacked : undefined,
    open_boxes: hasBoxes ? totalOpen : undefined,
    packages,
    items,
    warnings: [...new Set(warnings)],
  };
}

async function loadProductMapForLines(qtyLines) {
  const productIds = [
    ...new Set(
      qtyLines
        .map((l) => l.productId)
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
    ),
  ];
  const skus = [
    ...new Set(qtyLines.map((l) => l.sku).filter(Boolean)),
  ];

  const { Product } = getModels();
  const or = [];
  if (productIds.length) or.push({ _id: { $in: productIds } });
  if (skus.length) or.push({ sku: { $in: skus } });

  if (or.length === 0) return new Map();

  const products = await Product.find({
    deletedAt: null,
    $or: or,
  })
    .select('product_name sku unit_weight_kg units_per_box')
    .lean();

  const productMap = new Map();
  for (const p of products) {
    productMap.set(String(p._id), p);
    if (p.sku) productMap.set(String(p.sku).trim().toUpperCase(), p);
  }
  return productMap;
}

/**
 * @param {{ order: object, dispatch?: object | null }} input
 */
async function computePlanOrderLogistics({ order, dispatch, dispatches }) {
  const orderItems = order?.order_items || [];
  let qtyLines;
  if (dispatch) {
    qtyLines = quantityLinesFromDispatch(dispatch, orderItems);
  } else if (Array.isArray(dispatches) && dispatches.length > 0) {
    qtyLines = collectLogisticsQuantityLines(order, dispatches);
  } else {
    qtyLines = quantityLinesFromOrder(order);
  }
  const productMap = await loadProductMapForLines(qtyLines);
  return computeLogisticsFromQuantityLines(qtyLines, productMap);
}

/**
 * Build insert payloads for transport plan order lines with logistics fields.
 */
async function loadDispatchesByOrderIds(orderIds) {
  const map = new Map();
  const ids = [...new Set((orderIds || []).map(String).filter(Boolean))];
  if (!ids.length) return map;

  const { OrderDispatch } = getModels();
  if (!OrderDispatch) return map;

  const rows = await OrderDispatch.find({
    order: { $in: ids },
    deletedAt: null,
    dispatch_status: { $nin: ['cancelled', 'draft'] },
  })
    .select('order dispatch_items dispatch_status dispatch_no')
    .lean();

  for (const d of rows) {
    const key = String(d.order);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(d);
  }
  return map;
}

async function buildPlanOrderDocuments(items, orderMap, dispatchMap, transportPlanId, orderDispatchesByOrder) {
  const dispatchesByOrder = orderDispatchesByOrder || new Map();
  const allQtyLines = items.map((item) => {
    const order = orderMap.get(String(item.order_id));
    const dispatch = item.dispatch_id ? dispatchMap.get(String(item.dispatch_id)) : null;
    if (dispatch) {
      return quantityLinesFromDispatch(dispatch, order?.order_items || []);
    }
    const dispatches = dispatchesByOrder.get(String(item.order_id)) || [];
    return collectLogisticsQuantityLines(order, dispatches);
  });

  const flatLines = allQtyLines.flat();
  const productMap = await loadProductMapForLines(flatLines);

  return items.map((item, index) => {
    const order = orderMap.get(String(item.order_id));
    const dispatch = item.dispatch_id ? dispatchMap.get(String(item.dispatch_id)) : null;
    const logistics = computeLogisticsFromQuantityLines(allQtyLines[index], productMap);

    return {
      transport_plan: transportPlanId,
      order: order._id,
      party: order.party || undefined,
      customer: order.customer || undefined,
      dispatch: dispatch ? dispatch._id : undefined,
      invoice_number: dispatch ? dispatch.bill_number || undefined : undefined,
      status: 'pending',
      packages: logistics.packages,
      packed_boxes: logistics.packed_boxes,
      open_boxes: logistics.open_boxes,
      weight: logistics.weight,
    };
  });
}

module.exports = {
  productIdFromRef,
  qtyFromOrderItem,
  quantityLinesFromOrder,
  quantityLinesFromDispatch,
  collectLogisticsQuantityLines,
  computeLogisticsFromQuantityLines,
  computePlanOrderLogistics,
  buildPlanOrderDocuments,
  loadDispatchesByOrderIds,
};
