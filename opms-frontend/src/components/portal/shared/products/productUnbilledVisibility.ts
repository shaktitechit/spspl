export type UnbilledVisibilityCatalog = {
  products: Map<
    string,
    {
      show_in_unbilled_order_list?: boolean | null;
      product_group?: string | { _id?: string; name?: string };
      product_subgroup?: string | { _id?: string; name?: string };
      product_name?: string;
      sku?: string;
    }
  >;
  productBySku: Map<string, string>;
  productByName: Map<string, string>;
  groups: Map<string, { show_in_unbilled_order_list?: boolean; name?: string }>;
  subgroups: Map<
    string,
    { show_in_unbilled_order_list?: boolean; name?: string; group?: string | { _id?: string } }
  >;
};

export type UnbilledLineProductRef = {
  product?: unknown;
  product_name?: string;
  sku?: string;
};

function refId(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return String(o._id ?? o.id ?? "");
  }
  return String(value);
}

function isObjectIdString(value: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(value.trim());
}

function isExcludedFlag(value: unknown): boolean {
  return value === false;
}

function legacyRefName(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (!s || isObjectIdString(s)) return "";
    return s;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o.name != null && String(o.name).trim()) return String(o.name).trim();
  }
  return "";
}

function resolveGroupId(groupRef: unknown, catalog: UnbilledVisibilityCatalog): string {
  let groupId = refId(groupRef);
  if (groupId && isObjectIdString(groupId)) return groupId;
  const name = legacyRefName(groupRef);
  if (!name) return "";
  const n = name.toLowerCase();
  for (const [id, group] of catalog.groups.entries()) {
    if (String(group.name || "").trim().toLowerCase() === n) return id;
  }
  return "";
}

function resolveSubgroupId(
  subgroupRef: unknown,
  groupId: string,
  catalog: UnbilledVisibilityCatalog,
): string {
  let subgroupId = refId(subgroupRef);
  if (subgroupId && isObjectIdString(subgroupId)) return subgroupId;
  const name = legacyRefName(subgroupRef);
  if (!name) return "";
  const n = name.toLowerCase();
  for (const [id, subgroup] of catalog.subgroups.entries()) {
    if (String(subgroup.name || "").trim().toLowerCase() !== n) continue;
    if (groupId && refId(subgroup.group) !== groupId) continue;
    return id;
  }
  return "";
}

function resolveGroupSubgroupFromProduct(
  product: {
    product_group?: string | { _id?: string; name?: string };
    product_subgroup?: string | { _id?: string; name?: string };
  },
  catalog: UnbilledVisibilityCatalog,
): { subgroupId: string; groupId: string } {
  let groupId = resolveGroupId(product.product_group, catalog);
  const subgroupId = resolveSubgroupId(product.product_subgroup, groupId, catalog);
  if (!groupId && subgroupId) {
    const subgroup = catalog.subgroups.get(subgroupId);
    if (subgroup) groupId = resolveGroupId(subgroup.group, catalog);
  }
  return { subgroupId, groupId };
}

export function catalogNeedsVisibilityFilter(
  catalog?: UnbilledVisibilityCatalog | null,
): boolean {
  if (!catalog) return false;
  for (const group of catalog.groups.values()) {
    if (isExcludedFlag(group.show_in_unbilled_order_list)) return true;
  }
  for (const subgroup of catalog.subgroups.values()) {
    if (isExcludedFlag(subgroup.show_in_unbilled_order_list)) return true;
  }
  for (const product of catalog.products.values()) {
    if (isExcludedFlag(product.show_in_unbilled_order_list)) return true;
  }
  return false;
}

/** @deprecated use catalogNeedsVisibilityFilter */
export function catalogHasHiddenGroups(catalog?: UnbilledVisibilityCatalog | null): boolean {
  return catalogNeedsVisibilityFilter(catalog);
}

/** Line → product id (ref, else sku, else product_name). */
export function resolveProductIdFromLine(
  item: UnbilledLineProductRef,
  orderLine: UnbilledLineProductRef | null | undefined,
  catalog?: UnbilledVisibilityCatalog | null,
): string {
  const fromItem = refId(item.product);
  const fromLine = orderLine ? refId(orderLine.product) : "";
  const id = fromItem || fromLine;
  if (id && isObjectIdString(id)) return id;
  if (!catalog) return id;

  const sku = String(item.sku || orderLine?.sku || "")
    .trim()
    .toLowerCase();
  if (sku && catalog.productBySku.has(sku)) return catalog.productBySku.get(sku) || "";

  const name = String(item.product_name || orderLine?.product_name || "")
    .trim()
    .toLowerCase();
  if (name && catalog.productByName.has(name)) return catalog.productByName.get(name) || "";

  return id;
}

/**
 * From resolved product master: group → subgroup → inline product flag.
 */
export function effectiveShowInUnbilledList(
  productId: string,
  catalog?: UnbilledVisibilityCatalog | null,
): boolean {
  if (!catalog || !catalogNeedsVisibilityFilter(catalog)) return true;

  const pid = refId(productId);
  if (!pid) return true;

  const product = catalog.products.get(pid);
  if (!product) return true;

  const { subgroupId, groupId } = resolveGroupSubgroupFromProduct(product, catalog);

  if (groupId) {
    const group = catalog.groups.get(groupId);
    if (group && isExcludedFlag(group.show_in_unbilled_order_list)) return false;
  }

  if (subgroupId) {
    const subgroup = catalog.subgroups.get(subgroupId);
    if (subgroup && isExcludedFlag(subgroup.show_in_unbilled_order_list)) return false;
  }

  if (product.show_in_unbilled_order_list != null) {
    return !isExcludedFlag(product.show_in_unbilled_order_list);
  }

  return true;
}

export function lineShowInUnbilledList(
  item: UnbilledLineProductRef,
  orderLine: UnbilledLineProductRef | null | undefined,
  catalog?: UnbilledVisibilityCatalog | null,
): boolean {
  if (!catalog || !catalogNeedsVisibilityFilter(catalog)) return true;
  const productId = resolveProductIdFromLine(item, orderLine, catalog);
  return effectiveShowInUnbilledList(productId, catalog);
}

export function buildUnbilledVisibilityCatalog(input: {
  products?: unknown[];
  groups?: unknown[];
  subgroups?: unknown[];
}): UnbilledVisibilityCatalog {
  const products = new Map<
    string,
    {
      show_in_unbilled_order_list?: boolean | null;
      product_group?: string | { _id?: string; name?: string };
      product_subgroup?: string | { _id?: string; name?: string };
      product_name?: string;
      sku?: string;
    }
  >();
  const productBySku = new Map<string, string>();
  const productByName = new Map<string, string>();
  const groups = new Map<string, { show_in_unbilled_order_list?: boolean; name?: string }>();
  const subgroups = new Map<
    string,
    { show_in_unbilled_order_list?: boolean; name?: string; group?: string | { _id?: string } }
  >();

  for (const raw of input.groups ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = refId(row._id ?? row.id);
    if (!id) continue;
    groups.set(id, {
      show_in_unbilled_order_list: row.show_in_unbilled_order_list as boolean | undefined,
      name: row.name != null ? String(row.name) : undefined,
    });
  }

  for (const raw of input.subgroups ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = refId(row._id ?? row.id);
    if (!id) continue;
    subgroups.set(id, {
      show_in_unbilled_order_list: row.show_in_unbilled_order_list as boolean | undefined,
      name: row.name != null ? String(row.name) : undefined,
      group: row.group as string | { _id?: string },
    });
  }

  for (const raw of input.products ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = refId(row._id ?? row.id);
    if (!id) continue;
    const product_name = row.product_name != null ? String(row.product_name) : undefined;
    const sku = row.sku != null ? String(row.sku) : undefined;
    products.set(id, {
      show_in_unbilled_order_list: row.show_in_unbilled_order_list as boolean | null | undefined,
      product_group: row.product_group as string | { _id?: string; name?: string },
      product_subgroup: row.product_subgroup as string | { _id?: string; name?: string },
      product_name,
      sku,
    });
    const skuKey = String(sku || "").trim().toLowerCase();
    if (skuKey && !productBySku.has(skuKey)) productBySku.set(skuKey, id);
    const nameKey = String(product_name || "").trim().toLowerCase();
    if (nameKey && !productByName.has(nameKey)) productByName.set(nameKey, id);
  }

  return { products, productBySku, productByName, groups, subgroups };
}

export function productRowShowInUnbilledList(
  product: Record<string, unknown>,
  catalog?: UnbilledVisibilityCatalog | null,
): boolean {
  const id = refId(product._id ?? product.id);
  if (!id) return true;
  return effectiveShowInUnbilledList(id, catalog);
}
