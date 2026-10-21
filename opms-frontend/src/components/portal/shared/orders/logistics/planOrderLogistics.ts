import { isKitShellDispatchSource } from "../detail/dispatchKitDisplay";

export type ProductLogisticsMaster = {
  _id?: string;
  id?: string;
  product_name?: string;
  sku?: string;
  unit_weight_kg?: number | null;
  units_per_box?: number | null;
};

export type PlanLogisticsItemRow = {
  order_item_id?: string;
  product_id?: string;
  product_name?: string;
  sku?: string;
  unit?: string;
  quantity?: number;
  unit_weight_kg?: number;
  units_per_box?: number;
  weight_kg?: number;
  packed_boxes?: number;
  open_boxes?: number;
  open_units?: number;
  dispatch_no?: string;
  warning?: string;
};

export type PlanLogisticsResult = {
  weight?: number;
  packed_boxes?: number;
  open_boxes?: number;
  packages?: number;
  items?: PlanLogisticsItemRow[];
  warnings: string[];
};

function refId(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "object") {
    const o = val as Record<string, unknown>;
    return String(o._id ?? o.id ?? "");
  }
  return String(val);
}

/** Match backend planOrderLogistics.js */
export function qtyFromOrderItem(item: Record<string, unknown>): number {
  if (String(item.line_status || "").toLowerCase() === "cancelled") return 0;

  const remaining = Number(item.remaining_quantity);
  if (Number.isFinite(remaining) && remaining > 0) return remaining;

  const approved = Number(item.approved_quantity) || 0;
  const dispatched = Number(item.dispatched_quantity) || 0;
  const ordered = Number(item.ordered_quantity ?? item.quantity) || 0;
  const base = approved > 0 ? approved : ordered;
  let qty = base - dispatched;
  if (qty < 0) qty = 0;
  return qty;
}

export function pickDispatchList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as Record<string, unknown>[];
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
  }
  return [];
}

function dispatchQty(row: Record<string, unknown>): number {
  const dispatched = Number(row.dispatched_quantity ?? row.dispatch_quantity);
  if (Number.isFinite(dispatched) && dispatched > 0) return dispatched;
  const allocated = Number(row.allocated_quantity);
  if (Number.isFinite(allocated) && allocated > 0) return allocated;
  return 0;
}

function productMetaFromDispatchRow(
  row: Record<string, unknown>,
  matchItem?: Record<string, unknown>,
): { productId: string; sku?: string; productName?: string } {
  const populated =
    row.product && typeof row.product === "object" && !Array.isArray(row.product)
      ? (row.product as Record<string, unknown>)
      : null;

  const productId = refId(row.product) || refId(matchItem?.product) || refId(populated);
  let sku =
    matchItem?.sku != null && String(matchItem.sku).trim()
      ? String(matchItem.sku).trim().toUpperCase()
      : undefined;
  if (!sku && row.sku != null && String(row.sku).trim()) {
    sku = String(row.sku).trim().toUpperCase();
  }
  if (!sku && populated?.sku != null && String(populated.sku).trim()) {
    sku = String(populated.sku).trim().toUpperCase();
  }

  let productName =
    matchItem?.product_name != null ? String(matchItem.product_name) : undefined;
  if (!productName && row.product_name != null) productName = String(row.product_name);
  if (!productName && populated?.product_name != null) {
    productName = String(populated.product_name);
  }

  return { productId: productId || "", sku, productName };
}

function dispatchesForLogisticsPreview(raw: unknown): Record<string, unknown>[] {
  const all = pickDispatchList(raw).filter(
    (d) => String(d.dispatch_status ?? d.status ?? "") !== "cancelled" && d.deletedAt == null,
  );
  const submitted = all.filter((d) => {
    const status = String(d.dispatch_status ?? d.status ?? "");
    return status !== "draft" && status !== "cancelled";
  });
  return submitted.length > 0 ? submitted : all.filter((d) => String(d.dispatch_status ?? d.status) === "draft");
}

export type LogisticsQuantityLine = {
  orderItemId?: string;
  productId: string;
  sku?: string;
  quantity: number;
  productName?: string;
  unit?: string;
  dispatchNo?: string;
};

export function quantityLinesFromDispatch(
  dispatch: Record<string, unknown>,
  orderItems: Record<string, unknown>[] = [],
): LogisticsQuantityLine[] {
  const dispatchNo = String(dispatch.dispatch_no ?? dispatch._id ?? "").trim();
  const items = Array.isArray(dispatch.dispatch_items)
    ? (dispatch.dispatch_items as Record<string, unknown>[])
    : Array.isArray(dispatch.items)
      ? (dispatch.items as Record<string, unknown>[])
      : [];

  const lines: LogisticsQuantityLine[] = [];

  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const qty = dispatchQty(row);
    if (qty <= 0) continue;

    const orderItemId = refId(row.order_item_id);
    const matchItem =
      orderItems.find((li) => refId(li._id ?? li.id) === orderItemId) ??
      orderItems.find((li) => refId(li.product) === refId(row.product));

    if (isKitShellDispatchSource(row, items, orderItems)) continue;

    const { productId, sku, productName } = productMetaFromDispatchRow(row, matchItem);
    if (!productId && !sku) continue;

    lines.push({
      orderItemId: orderItemId || refId(matchItem?._id ?? matchItem?.id) || undefined,
      productId,
      sku,
      quantity: qty,
      productName,
      unit: matchItem?.unit != null ? String(matchItem.unit) : undefined,
      dispatchNo: dispatchNo || undefined,
    });
  }

  return lines;
}

/** Prefer submitted/open dispatch lines; else pending order lines. */
export function collectLogisticsQuantityLines(
  order: Record<string, unknown> | null | undefined,
  dispatchesRaw: unknown,
  orderItems: Record<string, unknown>[] = [],
): {
  source: "dispatch" | "order";
  dispatchLabel?: string;
  lines: {
    orderItemId?: string;
    productId: string;
    sku?: string;
    quantity: number;
    productName?: string;
    unit?: string;
    dispatchNo?: string;
  }[];
} {
  const dispatches = dispatchesForLogisticsPreview(dispatchesRaw);

  const fromDispatch: LogisticsQuantityLine[] = [];

  for (const dispatch of dispatches) {
    fromDispatch.push(...quantityLinesFromDispatch(dispatch, orderItems));
  }

  if (fromDispatch.length > 0) {
    return { source: "dispatch", lines: fromDispatch };
  }

  const orderLines = quantityLinesFromOrder(order).map((l) => ({
    ...l,
    dispatchNo: undefined as string | undefined,
  }));
  return { source: "order", lines: orderLines };
}

export function quantityLinesFromOrder(order: Record<string, unknown> | null | undefined) {
  const lines: {
    orderItemId?: string;
    productId: string;
    sku?: string;
    quantity: number;
    productName?: string;
    unit?: string;
  }[] = [];
  const items = Array.isArray(order?.order_items) ? order!.order_items : [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const qty = qtyFromOrderItem(item);
    if (qty <= 0) continue;
    const populated =
      item.product && typeof item.product === "object" && !Array.isArray(item.product)
        ? (item.product as Record<string, unknown>)
        : null;
    const productId = refId(item.product) || refId(populated);
    let sku =
      item.sku != null && String(item.sku).trim()
        ? String(item.sku).trim().toUpperCase()
        : undefined;
    if (!sku && populated?.sku != null && String(populated.sku).trim()) {
      sku = String(populated.sku).trim().toUpperCase();
    }
    if (!productId && !sku) continue;
    lines.push({
      orderItemId: refId(item._id ?? item.id) || undefined,
      productId: productId || "",
      sku,
      quantity: qty,
      productName:
        (item.product_name ? String(item.product_name) : undefined) ??
        (populated?.product_name ? String(populated.product_name) : undefined),
      unit: item.unit != null ? String(item.unit) : undefined,
    });
  }
  return lines;
}

export function normalizeProductsList(products: unknown): ProductLogisticsMaster[] {
  if (Array.isArray(products)) {
    return products.filter((p): p is ProductLogisticsMaster => p != null && typeof p === "object");
  }
  if (products && typeof products === "object") {
    const data = (products as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data.filter((p): p is ProductLogisticsMaster => p != null && typeof p === "object");
    }
  }
  return [];
}

function resolveProductForLine(
  line: { productId: string; sku?: string },
  productMap: Map<string, ProductLogisticsMaster>,
): ProductLogisticsMaster | undefined {
  if (line.productId && productMap.has(line.productId)) {
    return productMap.get(line.productId);
  }
  if (line.sku && productMap.has(line.sku)) {
    return productMap.get(line.sku);
  }
  return undefined;
}

export function buildProductLogisticsMap(products: unknown): Map<string, ProductLogisticsMaster> {
  const map = new Map<string, ProductLogisticsMaster>();
  for (const p of normalizeProductsList(products)) {
    const id = refId(p);
    if (id) map.set(id, p);
    if (p.sku) map.set(String(p.sku).trim().toUpperCase(), p);
  }
  return map;
}

export function computeLogisticsFromQuantityLines(
  qtyLines: {
    orderItemId?: string;
    productId: string;
    sku?: string;
    quantity: number;
    productName?: string;
    unit?: string;
    dispatchNo?: string;
  }[],
  productMap: Map<string, ProductLogisticsMaster>,
): PlanLogisticsResult {
  if (!qtyLines.length) {
    return {
      items: [],
      warnings: ["No dispatched or remaining quantity to preview"],
    };
  }

  let totalWeight = 0;
  let totalPacked = 0;
  let totalOpen = 0;
  let hasWeight = false;
  let hasBoxes = false;
  const warnings: string[] = [];
  const items: PlanLogisticsItemRow[] = [];

  for (const line of qtyLines) {
    const prod = resolveProductForLine(line, productMap);
    const label = line.productName || prod?.product_name || line.sku || line.productId;

    const row: PlanLogisticsItemRow = {
      order_item_id: line.orderItemId,
      product_id: prod ? refId(prod) : line.productId || undefined,
      product_name: label,
      sku: line.sku || (prod?.sku ? String(prod.sku) : undefined),
      unit: line.unit,
      quantity: line.quantity,
      dispatch_no: line.dispatchNo,
      unit_weight_kg:
        prod?.unit_weight_kg != null ? Number(prod.unit_weight_kg) : undefined,
      units_per_box:
        prod?.units_per_box != null ? Number(prod.units_per_box) : undefined,
    };

    if (!prod) {
      row.warning = "Product not found in master";
      warnings.push(`Product not found: ${label}`);
      items.push(row);
      continue;
    }

    const unitWeight = prod.unit_weight_kg;
    if (unitWeight != null && Number.isFinite(Number(unitWeight)) && Number(unitWeight) >= 0) {
      const w = line.quantity * Number(unitWeight);
      row.weight_kg = Math.round(w * 100) / 100;
      totalWeight += w;
      hasWeight = true;
    } else {
      row.warning = row.warning || "Missing unit weight (kg) on product";
      warnings.push(`Missing unit weight (kg): ${label}`);
    }

    const unitsPerBox = prod.units_per_box;
    if (unitsPerBox != null && Number.isFinite(Number(unitsPerBox)) && Number(unitsPerBox) >= 1) {
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
      row.warning = row.warning || "Missing units per box on product";
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

export function computeOrderPlanLogistics(
  order: Record<string, unknown> | null | undefined,
  products: unknown,
  dispatchesRaw?: unknown,
): PlanLogisticsResult {
  const orderItems = Array.isArray(order?.order_items)
    ? (order!.order_items as Record<string, unknown>[])
    : [];
  const { lines } = collectLogisticsQuantityLines(order, dispatchesRaw, orderItems);
  const productMap = buildProductLogisticsMap(products);
  return computeLogisticsFromQuantityLines(lines, productMap);
}

/** Logistics totals for a single dispatch batch (Create Transport). */
export function computeDispatchPlanLogistics(
  dispatch: Record<string, unknown> | null | undefined,
  orderItems: Record<string, unknown>[],
  products: unknown,
): PlanLogisticsResult {
  if (!dispatch) return { items: [], warnings: [] };
  const lines = quantityLinesFromDispatch(dispatch, orderItems);
  const productMap = buildProductLogisticsMap(products);
  return computeLogisticsFromQuantityLines(lines, productMap);
}

export function formatPlanLogisticsSummary(result: PlanLogisticsResult): string {
  const weight =
    result.weight != null && Number.isFinite(result.weight)
      ? `${result.weight} kg`
      : "— kg";
  const packed =
    result.packed_boxes != null && Number.isFinite(result.packed_boxes)
      ? `${result.packed_boxes} packed`
      : "— packed";
  const open =
    result.open_boxes != null && Number.isFinite(result.open_boxes)
      ? `${result.open_boxes} open`
      : "— open";
  return `${weight} · ${packed} · ${open}`;
}
