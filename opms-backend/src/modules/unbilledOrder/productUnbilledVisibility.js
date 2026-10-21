/**
 * Unbilled line visibility: resolve product from line → subgroup → group, then
 * apply flags in order group → subgroup → product (inline).
 */
const mongoose = require('mongoose');

function refId(value) {
  if (value == null) return '';
  if (typeof value === 'object') return String(value._id ?? value.id ?? '');
  return String(value);
}

function isObjectIdString(value) {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim());
}

function legacyRefName(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s || isObjectIdString(s)) return '';
    return s;
  }
  if (typeof value === 'object' && value.name != null && String(value.name).trim()) {
    return String(value.name).trim();
  }
  return '';
}

/** Only an explicit `false` opts out; missing/undefined defaults to visible. */
function isExcludedFlag(value) {
  return value === false;
}

function resolveGroupId(groupRef, groupById) {
  let groupId = refId(groupRef);
  if (groupId && isObjectIdString(groupId)) return groupId;
  const name = legacyRefName(groupRef);
  if (!name) return '';
  const n = name.toLowerCase();
  for (const [id, group] of groupById.entries()) {
    if (String(group.name || '').trim().toLowerCase() === n) return id;
  }
  return '';
}

function resolveSubgroupId(subgroupRef, groupId, subgroupById) {
  let subgroupId = refId(subgroupRef);
  if (subgroupId && isObjectIdString(subgroupId)) return subgroupId;
  const name = legacyRefName(subgroupRef);
  if (!name) return '';
  const n = name.toLowerCase();
  for (const [id, subgroup] of subgroupById.entries()) {
    if (String(subgroup.name || '').trim().toLowerCase() !== n) continue;
    if (groupId && refId(subgroup.group) !== groupId) continue;
    return id;
  }
  return '';
}

/**
 * From product master: subgroup id (if any), then group id (product group or subgroup.parent).
 */
function resolveGroupSubgroupFromProduct(product, subgroupById, groupById) {
  if (!product) return { subgroupId: '', groupId: '' };
  let groupId = resolveGroupId(product.product_group, groupById);
  const subgroupId = resolveSubgroupId(product.product_subgroup, groupId, subgroupById);
  if (!groupId && subgroupId) {
    const subgroup = subgroupById.get(subgroupId);
    if (subgroup) groupId = resolveGroupId(subgroup.group, groupById);
  }
  return { subgroupId, groupId };
}

/**
 * Visibility from catalog only: group → subgroup → inline product flag.
 */
function effectiveFromMaps(productId, productById, subgroupById, groupById) {
  const pid = refId(productId);
  if (!pid) return true;

  const product = productById.get(pid);
  if (!product) return true;

  const { subgroupId, groupId } = resolveGroupSubgroupFromProduct(
    product,
    subgroupById,
    groupById,
  );

  if (groupId) {
    const group = groupById.get(groupId);
    if (group && isExcludedFlag(group.show_in_unbilled_order_list)) return false;
  }

  if (subgroupId) {
    const subgroup = subgroupById.get(subgroupId);
    if (subgroup && isExcludedFlag(subgroup.show_in_unbilled_order_list)) return false;
  }

  if (product.show_in_unbilled_order_list != null) {
    return !isExcludedFlag(product.show_in_unbilled_order_list);
  }

  return true;
}

function indexProductRow(row, productById, productBySku, productByName) {
  const id = String(row._id);
  productById.set(id, row);
  const sku = String(row.sku || '').trim().toLowerCase();
  if (sku && !productBySku.has(sku)) productBySku.set(sku, id);
  const name = String(row.product_name || '').trim().toLowerCase();
  if (name && !productByName.has(name)) productByName.set(name, id);
}

function collectProductIdsFromOrder(order) {
  const ids = new Set();
  for (const line of order?.order_items || []) {
    const id = refId(line?.product);
    if (id && mongoose.Types.ObjectId.isValid(id)) ids.add(id);
  }
  return [...ids];
}

function collectProductIdsFromItems(items) {
  const ids = new Set();
  for (const item of items || []) {
    const id = refId(item?.product);
    if (id && mongoose.Types.ObjectId.isValid(id)) ids.add(id);
  }
  return [...ids];
}

function lineKeyFromRow(row) {
  return {
    sku: String(row?.sku || '').trim(),
    product_name: String(row?.product_name || '').trim(),
  };
}

function collectLineKeysFromOrder(order) {
  const keys = [];
  for (const line of order?.order_items || []) {
    keys.push(lineKeyFromRow(line));
  }
  return keys;
}

function collectLineKeysFromItems(items) {
  const keys = [];
  for (const item of items || []) {
    keys.push(lineKeyFromRow(item));
  }
  return keys;
}

function collectProductIdsFromUnbilledRows(rows) {
  const ids = new Set();
  for (const row of rows || []) {
    for (const id of collectProductIdsFromItems(row?.unbilled_items)) {
      ids.add(id);
    }
    const order = row?.order;
    if (order && typeof order === 'object') {
      for (const id of collectProductIdsFromOrder(order)) {
        ids.add(id);
      }
    }
  }
  return [...ids];
}

function collectLineKeysFromUnbilledRows(rows) {
  const keys = [];
  for (const row of rows || []) {
    for (const item of row?.unbilled_items || []) {
      keys.push(lineKeyFromRow(item));
    }
    const order = row?.order;
    if (order && typeof order === 'object') {
      keys.push(...collectLineKeysFromOrder(order));
    }
  }
  return keys;
}

function orderLineByItemId(order) {
  const map = new Map();
  if (!order || typeof order !== 'object') return map;
  for (const line of order.order_items || []) {
    const key = String(line._id || '');
    if (key) map.set(key, line);
  }
  return map;
}

/**
 * Line → product id (ref on line, else sku, else product_name on catalog).
 */
function resolveProductIdFromLine(item, orderLine, maps) {
  if (!maps) return refId(item?.product) || refId(orderLine?.product);
  const { productBySku, productByName } = maps;
  const fromItem = refId(item?.product);
  const fromLine = refId(orderLine?.product);
  const id = fromItem || fromLine;
  if (id && mongoose.Types.ObjectId.isValid(id)) return id;

  const sku = String(item?.sku || orderLine?.sku || '').trim().toLowerCase();
  if (sku && productBySku?.has(sku)) return productBySku.get(sku);

  const name = String(item?.product_name || orderLine?.product_name || '').trim().toLowerCase();
  if (name && productByName?.has(name)) return productByName.get(name);

  return id || '';
}

async function loadUnbilledVisibilityMaps(productIds, models = null, lineKeys = []) {
  const { Product, ProductSubgroup, ProductGroup } = models || require('../../data/mongoRegistry').getModels();
  const unique = [...new Set((productIds || []).map((id) => refId(id)).filter(Boolean))];

  const productById = new Map();
  const productBySku = new Map();
  const productByName = new Map();
  const subgroupById = new Map();
  const groupById = new Map();

  const [allGroups, allSubgroups] = await Promise.all([
    ProductGroup.find({ deletedAt: null })
      .select('_id name show_in_unbilled_order_list')
      .lean(),
    ProductSubgroup.find({ deletedAt: null })
      .select('_id name group show_in_unbilled_order_list')
      .lean(),
  ]);
  for (const row of allGroups) {
    groupById.set(String(row._id), row);
  }
  for (const row of allSubgroups) {
    subgroupById.set(String(row._id), row);
  }

  const skuQuery = new Set();
  const nameQuery = new Set();
  for (const key of lineKeys || []) {
    if (key?.sku) skuQuery.add(String(key.sku).trim());
    if (key?.product_name) nameQuery.add(String(key.product_name).trim());
  }

  const orClauses = [];
  if (unique.length) orClauses.push({ _id: { $in: unique } });
  if (skuQuery.size) orClauses.push({ sku: { $in: [...skuQuery] } });
  if (nameQuery.size) orClauses.push({ product_name: { $in: [...nameQuery] } });

  if (orClauses.length) {
    const products = await Product.find({
      deletedAt: null,
      $or: orClauses,
    })
      .select('_id product_group product_subgroup show_in_unbilled_order_list product_name sku')
      .lean();

    const subgroupIds = new Set();
    const groupIds = new Set();

    for (const row of products) {
      indexProductRow(row, productById, productBySku, productByName);
      const sg = refId(row.product_subgroup);
      const gr = refId(row.product_group);
      if (sg && isObjectIdString(sg)) subgroupIds.add(sg);
      if (gr && isObjectIdString(gr)) groupIds.add(gr);
    }

    if (subgroupIds.size) {
      const subgroups = await ProductSubgroup.find({ _id: { $in: [...subgroupIds] }, deletedAt: null })
        .select('_id group show_in_unbilled_order_list name')
        .lean();
      for (const row of subgroups) {
        subgroupById.set(String(row._id), row);
        const gr = refId(row.group);
        if (gr && isObjectIdString(gr)) groupIds.add(gr);
      }
    }

    if (groupIds.size) {
      const groups = await ProductGroup.find({ _id: { $in: [...groupIds] }, deletedAt: null })
        .select('_id name show_in_unbilled_order_list')
        .lean();
      for (const row of groups) {
        const id = String(row._id);
        const prev = groupById.get(id) || {};
        groupById.set(id, { ...prev, ...row });
      }
    }
  }

  return { productById, productBySku, productByName, subgroupById, groupById };
}

function catalogHasHiddenEntries(groupById, subgroupById, productById) {
  for (const group of groupById.values()) {
    if (isExcludedFlag(group.show_in_unbilled_order_list)) return true;
  }
  for (const subgroup of subgroupById.values()) {
    if (isExcludedFlag(subgroup.show_in_unbilled_order_list)) return true;
  }
  for (const product of productById.values()) {
    if (isExcludedFlag(product.show_in_unbilled_order_list)) return true;
  }
  return false;
}

function productVisibleForUnbilled(productId, maps) {
  if (!maps) return true;
  const { productById, subgroupById, groupById } = maps;
  if (!catalogHasHiddenEntries(groupById, subgroupById, productById)) return true;
  return effectiveFromMaps(productId, productById, subgroupById, groupById);
}

/** Copy group/subgroup snapshot fields from order line + product master. */
function snapshotFieldsForUnbilledLine(orderLine, productDoc) {
  const fromProductGroup = productDoc?.product_group;
  const fromProductSubgroup = productDoc?.product_subgroup;
  let product_group_id = '';
  if (fromProductGroup && isObjectIdString(refId(fromProductGroup))) {
    product_group_id = refId(fromProductGroup);
  }
  const product_group =
    (orderLine?.product_group && String(orderLine.product_group).trim())
    || legacyRefName(fromProductGroup)
    || '';
  const product_subgroup =
    (orderLine?.product_subgroup && String(orderLine.product_subgroup).trim())
    || legacyRefName(fromProductSubgroup)
    || '';
  return { product_group, product_subgroup, product_group_id };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Drop excluded lines and recompute rollups on a lean UnbilledOrder row. */
function applyVisibilityToUnbilledRow(row, maps) {
  if (!row || !maps) return row;
  const { subgroupById, groupById, productById } = maps;
  if (!catalogHasHiddenEntries(groupById, subgroupById, productById)) return row;
  const items = Array.isArray(row.unbilled_items) ? row.unbilled_items : [];
  const kept = [];
  const orderLineMap = orderLineByItemId(
    row.order && typeof row.order === 'object' ? row.order : null,
  );

  for (const item of items) {
    const orderLineKey = String(item?.order_item_id || '');
    const orderLine = orderLineKey ? orderLineMap.get(orderLineKey) : null;
    const productId = resolveProductIdFromLine(item, orderLine, maps);
    if (!productVisibleForUnbilled(productId, maps)) continue;
    kept.push(item);
  }

  const remainingTotal = kept.reduce((sum, line) => sum + num(line.remaining_quantity), 0);
  const approvedTotal = kept.reduce((sum, line) => sum + num(line.approved_quantity), 0);
  const billedTotal = kept.reduce((sum, line) => sum + num(line.billed_dispatched_quantity), 0);

  return {
    ...row,
    unbilled_items: kept,
    remaining_quantity: remainingTotal,
    approved_quantity: approvedTotal,
    billed_dispatched_quantity: billedTotal,
  };
}

function unbilledRowVisibleAfterFilter(row) {
  if (!row) return false;
  const remaining = num(row.remaining_quantity);
  if (remaining > 0) return true;
  const items = Array.isArray(row.unbilled_items) ? row.unbilled_items : [];
  return items.some((line) => num(line.remaining_quantity) > 0);
}

module.exports = {
  refId,
  effectiveFromMaps,
  collectProductIdsFromOrder,
  collectProductIdsFromItems,
  collectProductIdsFromUnbilledRows,
  collectLineKeysFromOrder,
  collectLineKeysFromItems,
  collectLineKeysFromUnbilledRows,
  loadUnbilledVisibilityMaps,
  resolveProductIdFromLine,
  productVisibleForUnbilled,
  applyVisibilityToUnbilledRow,
  unbilledRowVisibleAfterFilter,
  snapshotFieldsForUnbilledLine,
  orderLineByItemId,
};
