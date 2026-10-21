/**
 * Resolve whether a catalog product counts toward Unbilled Order gaps.
 * Group/subgroup exclusions cascade (AND). Product false excludes that SKU only.
 */
function refId(value) {
  if (value == null) return '';
  if (typeof value === 'object') return String(value._id ?? value.id ?? '');
  return String(value);
}

function isExcludedFlag(value) {
  return value === false;
}

function effectiveFromMaps(productId, productById, subgroupById, groupById, hint = null) {
  const pid = refId(productId);
  if (!pid) return true;

  const product = productById.get(pid) || hint;

  const groupId = refId(product?.product_group);
  if (groupId) {
    const group = groupById.get(groupId);
    if (group && isExcludedFlag(group.show_in_unbilled_order_list)) return false;
  }

  const subgroupId = refId(product?.product_subgroup);
  if (subgroupId) {
    const subgroup = subgroupById.get(subgroupId);
    if (subgroup && isExcludedFlag(subgroup.show_in_unbilled_order_list)) return false;
  }

  if (product && product.show_in_unbilled_order_list != null) {
    return !isExcludedFlag(product.show_in_unbilled_order_list);
  }

  return true;
}

module.exports = {
  refId,
  effectiveFromMaps,
};
