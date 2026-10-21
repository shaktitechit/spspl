/** Helpers for account order closure — map warehouse returns to order lines. */

import { isReturnPending, isReturnReceivedAtWarehouse } from "@/constants/orderReturnStatus";

export function refId(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return String(o._id ?? o.id ?? "");
  }
  return String(value);
}

/** Sum returned_quantity from dispatch batch line items keyed by order_item_id. */
export function aggregateDispatchReturnsByOrderLine(
  dispatches: Record<string, unknown>[],
): Record<string, number> {
  const byLine: Record<string, number> = {};
  for (const dispatch of dispatches) {
    const status = String(dispatch.dispatch_status ?? dispatch.status ?? "");
    if (status === "cancelled") continue;
    const items = Array.isArray(dispatch.dispatch_items)
      ? dispatch.dispatch_items
      : Array.isArray(dispatch.items)
        ? dispatch.items
        : [];
    for (const rawItem of items) {
      const item = rawItem as Record<string, unknown>;
      const key = refId(item.order_item_id);
      if (!key) continue;
      byLine[key] = (byLine[key] || 0) + Number(item.returned_quantity || 0);
    }
  }
  return byLine;
}

export function aggregateReceivedReturnsByOrderLine(
  returns: Record<string, unknown>[],
  dispatches: Record<string, unknown>[],
) {
  const byLine: Record<string, number> = {};
  const dispatchById: Record<string, Record<string, unknown>> = {};
  for (const dispatch of dispatches) {
    dispatchById[String(dispatch._id ?? dispatch.id ?? "")] = dispatch;
  }

  for (const ret of returns) {
    if (!isReturnReceivedAtWarehouse(ret.return_status)) continue;
    const dispatch = dispatchById[refId(ret.dispatch)];
    if (!dispatch) continue;

    const items = Array.isArray(ret.return_items) ? ret.return_items : [];
    for (const rawItem of items) {
      const item = rawItem as Record<string, unknown>;
      const productId = refId(item.product);
      const qty = Number(item.returned_quantity || 0);
      if (!productId || qty <= 0) continue;

      const dispatchItems = Array.isArray(dispatch.dispatch_items) ? dispatch.dispatch_items : [];
      const matching = dispatchItems.filter(
        (di) => refId((di as Record<string, unknown>).product) === productId,
      );

      if (matching.length === 1) {
        const key = refId((matching[0] as Record<string, unknown>).order_item_id);
        if (!key) continue;
        byLine[key] = (byLine[key] || 0) + qty;
        continue;
      }

      if (matching.length > 1) {
        const totalDisp = matching.reduce(
          (sum, di) => sum + Number((di as Record<string, unknown>).dispatched_quantity || 0),
          0,
        );
        let allocated = 0;
        matching.forEach((di, idx) => {
          const row = di as Record<string, unknown>;
          const key = refId(row.order_item_id);
          if (!key) return;
          let share: number;
          if (idx === matching.length - 1) {
            share = qty - allocated;
          } else if (totalDisp > 0) {
            share = Math.round((Number(row.dispatched_quantity || 0) / totalDisp) * qty);
          } else {
            share = Math.floor(qty / matching.length);
          }
          allocated += share;
          byLine[key] = (byLine[key] || 0) + share;
        });
      }
    }
  }

  return byLine;
}

export function hasPendingReturns(returns: Record<string, unknown>[]): boolean {
  return returns.some((r) => isReturnPending(r.return_status));
}

export function totalPendingReturnQty(returns: Record<string, unknown>[]): number {
  return returns.reduce((sum, ret) => {
    if (!isReturnPending(ret.return_status)) return sum;
    const items = Array.isArray(ret.return_items) ? ret.return_items : [];
    return (
      sum +
      items.reduce(
        (itemSum, item) =>
          itemSum + Number((item as Record<string, unknown>).returned_quantity || 0),
        0,
      )
    );
  }, 0);
}

/** Pending return qty keyed by order line (via dispatch items when available). */
export function aggregatePendingReturnsByOrderLine(
  returns: Record<string, unknown>[],
  dispatches: Record<string, unknown>[],
): Record<string, number> {
  const pending = returns.filter((r) => isReturnPending(r.return_status));
  return aggregateReceivedReturnsByOrderLine(pending, dispatches);
}
