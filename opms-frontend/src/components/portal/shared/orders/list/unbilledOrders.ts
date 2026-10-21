import { deriveOrderWorkflowStatus } from "@/components/portal/shared/orders/lib/orderLifecycle";
import {
  lineApprovalQuantities,
  num,
  resolveAccountApprovalStatus,
} from "@/components/portal/shared/orders/lib/orderLineQuantities";
import {
  getOrderWorkflowTabCategory,
  type OrderWorkflowCategoryOptions,
} from "@/components/portal/shared/orders/list/orderWorkflowTabs";
import type {
  UnbilledOrderItem,
  UnbilledOrderRecord,
} from "@/store/api/slices/unbilledOrderApi";
import {
  lineShowInUnbilledList,
  type UnbilledVisibilityCatalog,
} from "@/components/portal/shared/products/productUnbilledVisibility";

export type UnbilledStatusLabelOptions = {
  /** Live list order (enriched) — preferred over sparse UnbilledOrder.order populate. */
  order?: Record<string, unknown> | null;
  /** Same transport/dispatch sets as ListOrdersPage tabs. */
  categoryOptions?: OrderWorkflowCategoryOptions;
};

/** Dispatch batches that count as created + submitted (not draft / cancelled). */
const SUBMITTED_DISPATCH_STATUSES = new Set(["submitted", "transport_created"]);

export type UnbilledOrderOptions = {
  /** Qty from OrderDispatch rows with status submitted / transport_created, keyed by order id. */
  submittedDispatchQtyByOrderId?: Map<string, number>;
  /** Same qty keyed by `${orderId}:${orderItemId}`. */
  submittedDispatchQtyByOrderLineId?: Map<string, number>;
  /** Same transport/dispatch sets as ListOrdersPage tabs. */
  categoryOptions?: OrderWorkflowCategoryOptions;
  /** Product group/subgroup/product flags for Unbilled list eligibility. */
  visibilityCatalog?: UnbilledVisibilityCatalog | null;
};

export type UnbilledOrderLine = {
  orderItemId: string;
  productId: string;
  productName: string;
  sku: string;
  approved: number;
  submittedDispatch: number;
  remaining: number;
};

function refId(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return String(o._id ?? o.id ?? "");
  }
  return String(value);
}

function orderLineKey(orderId: string, orderItemId: string): string {
  return `${orderId}:${orderItemId}`;
}

function resolveProductLabel(line: Record<string, unknown>): {
  id: string;
  name: string;
  sku: string;
} {
  const product = line.product;
  if (product && typeof product === "object") {
    const p = product as Record<string, unknown>;
    return {
      id: String(p._id ?? p.id ?? ""),
      name: String(p.product_name ?? p.name ?? line.product_name ?? "Item"),
      sku: String(p.sku ?? line.sku ?? ""),
    };
  }
  if (typeof product === "string" && product) {
    return {
      id: product,
      name: String(line.product_name ?? line.name ?? "Item"),
      sku: String(line.sku ?? ""),
    };
  }
  return {
    id: "",
    name: String(line.product_name ?? line.name ?? "Item"),
    sku: String(line.sku ?? ""),
  };
}

/**
 * Sum dispatched qty on a submitted / transport_created OrderDispatch.
 * Bill number is not required — Un Billed compares approval vs dispatch qty.
 */
export function dispatchSubmittedQuantity(dispatch: unknown): number {
  if (!dispatch || typeof dispatch !== "object") return 0;
  const row = dispatch as Record<string, unknown>;
  const status = String(row.dispatch_status ?? row.status ?? "").toLowerCase();
  if (!SUBMITTED_DISPATCH_STATUSES.has(status)) return 0;

  const items = Array.isArray(row.dispatch_items)
    ? row.dispatch_items
    : Array.isArray(row.items)
      ? row.items
      : [];
  let total = 0;
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    total += num(item.dispatched_quantity ?? item.dispatch_quantity ?? item.allocated_quantity);
  }
  return total;
}


function lineTrackableForUnbilled(
  line: Record<string, unknown>,
  catalog?: UnbilledVisibilityCatalog | null,
): boolean {
  return lineShowInUnbilledList(
    {
      product: line.product,
      product_name: line.product_name as string | undefined,
      sku: line.sku as string | undefined,
    },
    line,
    catalog,
  );
}

export function orderApprovedQuantity(
  order: unknown,
  catalog?: UnbilledVisibilityCatalog | null,
): number {
  if (!order || typeof order !== "object") return 0;
  const row = order as Record<string, unknown>;
  const items = Array.isArray(row.order_items) ? row.order_items : [];
  const accountStatus = resolveAccountApprovalStatus(row);
  let approved = 0;
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const line = raw as Record<string, unknown>;
    if (!lineTrackableForUnbilled(line, catalog)) continue;
    const q = lineApprovalQuantities(line, {
      accountApprovalStatus: accountStatus,
    });
    const qty =
      q.accountCleared > 0
        ? q.accountCleared
        : q.financeApproved > 0
          ? q.financeApproved
          : q.salesApproved > 0
            ? q.salesApproved
            : q.ordered;
    approved += qty;
  }
  return approved;
}

export function orderUnbilledQuantityTotals(
  order: unknown,
  options?: UnbilledOrderOptions,
): {
  approved: number;
  /** Qty from billed OrderDispatch batches with status submitted / transport_created. */
  submittedDispatch: number;
} {
  const catalog = options?.visibilityCatalog;
  const approved = orderApprovedQuantity(order, catalog);
  if (!order || typeof order !== "object") {
    return { approved, submittedDispatch: 0 };
  }
  const row = order as Record<string, unknown>;
  const orderId = refId(row._id ?? row.id);
  const lineMap = options?.submittedDispatchQtyByOrderLineId;
  if (lineMap && orderId) {
    const items = Array.isArray(row.order_items) ? row.order_items : [];
    let submittedDispatch = 0;
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const line = raw as Record<string, unknown>;
      if (!lineTrackableForUnbilled(line, catalog)) continue;
      const lineId = refId(line._id ?? line.id);
      if (!lineId) continue;
      submittedDispatch += lineMap.get(orderLineKey(orderId, lineId)) ?? 0;
    }
    return { approved, submittedDispatch };
  }
  const fromMap = orderId
    ? options?.submittedDispatchQtyByOrderId?.get(orderId)
    : undefined;
  return {
    approved,
    submittedDispatch: fromMap ?? 0,
  };
}


function orderLineMapFromOrder(
  liveOrder?: Record<string, unknown> | null,
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  if (!liveOrder) return map;
  const items = Array.isArray(liveOrder.order_items)
    ? liveOrder.order_items
    : [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const line = raw as Record<string, unknown>;
    const key = refId(line._id ?? line.id);
    if (key) map.set(key, line);
  }
  return map;
}

/** Map `/api/unbilled-orders` line snapshots → modal line rows. */
export function listUnbilledLinesFromRecord(
  record: UnbilledOrderRecord,
  catalog?: UnbilledVisibilityCatalog | null,
  liveOrder?: Record<string, unknown> | null,
): UnbilledOrderLine[] {
  const items = Array.isArray(record.unbilled_items) ? record.unbilled_items : [];
  const lines: UnbilledOrderLine[] = [];
  const orderLineById = orderLineMapFromOrder(liveOrder);

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as UnbilledOrderItem;
    const remaining = num(item.remaining_quantity);
    if (remaining <= 0) continue;

    const product = item.product;
    let productId = "";
    let productName = String(item.product_name || "Item");
    let sku = String(item.sku || "");
    if (product && typeof product === "object") {
      const p = product as Record<string, unknown>;
      productId = String(p._id ?? p.id ?? "");
      productName = String(p.product_name ?? p.name ?? productName);
      sku = String(p.sku ?? sku);
    } else if (typeof product === "string") {
      productId = product;
    }

    const orderItemId = refId(item.order_item_id);
    const orderLine = orderItemId ? orderLineById.get(orderItemId) : undefined;
    if (!productId && orderLine) {
      productId = refId(orderLine.product);
    }

    if (
      !lineShowInUnbilledList(
        {
          product: item.product,
          product_name: item.product_name,
          sku: item.sku,
        },
        orderLine ?? null,
        catalog,
      )
    ) {
      continue;
    }

    lines.push({
      orderItemId: refId(item.order_item_id),
      productId,
      productName,
      sku,
      approved: num(item.approved_quantity),
      submittedDispatch: num(item.billed_dispatched_quantity),
      remaining,
    });
  }

  return lines;
}

/** Only true billing-gap stages belong in the Un Billed modal. */
const TRACKABLE_STATUS_STAGES = new Set(["partially_billed", "unbilled"]);

/**
 * Status label for an UnbilledOrder API row — Unbilled or Partially Billed only.
 */
export function unbilledRecordStatusLabel(
  record: UnbilledOrderRecord,
  _options?: UnbilledStatusLabelOptions,
): string {
  const stage = String(record.pipeline_stage || "").toLowerCase();
  if (stage === "partially_billed") return "Partially Billed";
  if (stage === "unbilled") return "Unbilled";

  const billing = String(record.billing_status || "").toLowerCase();
  if (billing === "partially_billed") return "Partially Billed";
  if (Number(record.billed_dispatched_quantity ?? 0) > 0) {
    return "Partially Billed";
  }
  return "Unbilled";
}

export function unbilledRecordOrderId(record: UnbilledOrderRecord): string {
  return refId(record.order) || "";
}

export function unbilledRecordOrderNo(record: UnbilledOrderRecord): string {
  if (record.order_no) return String(record.order_no);
  if (record.order && typeof record.order === "object") {
    const o = record.order as Record<string, unknown>;
    return String(o.order_no ?? o.order_number ?? unbilledRecordOrderId(record) ?? "—");
  }
  return unbilledRecordOrderId(record) || "—";
}

export function unbilledRecordPartyId(record: UnbilledOrderRecord): string {
  const fromParty = refId(record.party);
  if (fromParty) return fromParty;
  if (record.order && typeof record.order === "object") {
    const o = record.order as Record<string, unknown>;
    return refId(o.party) || refId(o.customer) || "";
  }
  return "";
}

/** Sales rep id from the linked order (`assigned_sales_user`). */
export function unbilledRecordSalesUserId(record: UnbilledOrderRecord): string {
  if (record.order && typeof record.order === "object") {
    const o = record.order as Record<string, unknown>;
    return refId(o.assigned_sales_user) || "";
  }
  return "";
}

export function unbilledRecordPartyLabel(
  record: UnbilledOrderRecord,
  partyNameById?: Map<string, string>,
): string {
  if (record.party && typeof record.party === "object") {
    const p = record.party as Record<string, unknown>;
    const name = String(p.party_name ?? p.name ?? "").trim();
    if (name) return name;
  }
  const partyId = unbilledRecordPartyId(record);
  if (partyId && partyNameById?.has(partyId)) {
    return partyNameById.get(partyId) || "—";
  }
  return partyId || "—";
}


/**
 * True when approved qty exceeds submitted/transport_created dispatch qty.
 * Does not include approval / due-sheet / transport-pending workflow buckets.
 */
export function isUnbilledOrder(
  order: unknown,
  options?: UnbilledOrderOptions,
): boolean {
  if (!order || typeof order !== "object") return false;
  const row = order as Record<string, unknown>;
  const status = deriveOrderWorkflowStatus(row);

  if (
    status === "draft" ||
    status === "cancelled" ||
    status === "finance_rejected" ||
    status === "account_rejected" ||
    status === "on_hold"
  ) {
    return false;
  }

  const adminApproval = String(row.admin_approval_status || "").toLowerCase();
  const financeApproval = String(row.finance_approval_status || "").toLowerCase();
  const accountApproval = String(row.account_approval_status || "").toLowerCase();
  if (
    adminApproval === "rejected" ||
    financeApproval === "rejected" ||
    accountApproval === "rejected"
  ) {
    return false;
  }

  const lifecycle = String(row.lifecycle_status || "").toLowerCase();
  const stage = String(row.workflow_stage || "").toLowerCase();
  if (lifecycle === "cancelled" || stage === "cancelled") return false;

  // Exclude approval-pending / in-transit list buckets. Transport-pending rows
  // may still qualify when approved qty > dispatched qty (shown as Partially Billed).
  const cat = getOrderWorkflowTabCategory(row, options?.categoryOptions);
  if (
    cat === "pending_admin_approval" ||
    cat === "due_sheet_pending" ||
    cat === "pending_finance_approval" ||
    cat === "pending_account_approval" ||
    cat === "in_transit"
  ) {
    return false;
  }

  const { approved, submittedDispatch } = orderUnbilledQuantityTotals(
    order,
    options,
  );
  return approved > submittedDispatch;
}

export function filterUnbilledOrders(
  orders: unknown[],
  options?: UnbilledOrderOptions,
): unknown[] {
  return orders.filter((order) => isUnbilledOrder(order, options));
}

/**
 * Whether an UnbilledOrder API row should appear in the Un Billed modal.
 * Only `unbilled` / `partially_billed` stages with remaining qty.
 */
export function isUnbilledModalRecord(
  record: UnbilledOrderRecord,
  options?: UnbilledStatusLabelOptions & {
    visibilityCatalog?: UnbilledVisibilityCatalog | null;
  },
): boolean {
  const stage = String(record.pipeline_stage || "").toLowerCase();
  if (!TRACKABLE_STATUS_STAGES.has(stage)) return false;
  const liveOrder =
    options?.order && typeof options.order === "object"
      ? (options.order as Record<string, unknown>)
      : null;
  const lines = listUnbilledLinesFromRecord(
    record,
    options?.visibilityCatalog,
    liveOrder,
  );
  const trackableRemaining = lines.reduce((sum, line) => sum + line.remaining, 0);
  if (trackableRemaining > 0) return true;
  return (
    Number(record.remaining_quantity ?? 0) > 0 ||
    Boolean(record.manual_remaining)
  );
}

