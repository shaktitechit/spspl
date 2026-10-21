"use client";

import { useMemo } from "react";

import { useListProductsQuery } from "@/store/api";
import { DispatchLogisticsBreakdownTable } from "./DispatchLogisticsBreakdownTable";
import {
  computeDispatchPlanLogistics,
  quantityLinesFromDispatch,
} from "./planOrderLogistics";

export function dispatchIdFromTransport(tr: Record<string, unknown>): string {
  const ref = tr.dispatch;
  if (ref && typeof ref === "object" && !Array.isArray(ref)) {
    const o = ref as Record<string, unknown>;
    return String(o._id ?? o.id ?? "");
  }
  return ref != null && ref !== "" ? String(ref) : "";
}

type TransportDispatchLogisticsBlockProps = {
  dispatchId: string;
  dispatches: Record<string, unknown>[];
  orderItems?: Record<string, unknown>[];
  className?: string;
};

export function TransportDispatchLogisticsBlock({
  dispatchId,
  dispatches,
  orderItems = [],
  className = "mt-4",
}: TransportDispatchLogisticsBlockProps) {
  const selectedDispatch = useMemo(() => {
    if (!dispatchId) return null;
    return (
      dispatches.find((d) => String(d._id ?? d.id ?? "") === dispatchId) ?? null
    );
  }, [dispatchId, dispatches]);

  const lines = useMemo(
    () =>
      selectedDispatch ? quantityLinesFromDispatch(selectedDispatch, orderItems) : [],
    [selectedDispatch, orderItems],
  );

  const productListParams = useMemo(() => {
    const ids = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
    const skus = [
      ...new Set(
        lines.map((l) => (l.sku ? String(l.sku).trim().toUpperCase() : "")).filter(Boolean),
      ),
    ];
    if (!ids.length && !skus.length) return undefined;
    if (ids.length) return { ids: ids.join(",") };
    return { skus: skus.join(",") };
  }, [lines]);

  const productsQ = useListProductsQuery(productListParams, {
    skip: !selectedDispatch || !productListParams,
  });

  const result = useMemo(
    () =>
      selectedDispatch
        ? computeDispatchPlanLogistics(selectedDispatch, orderItems, productsQ.data)
        : null,
    [selectedDispatch, orderItems, productsQ.data],
  );

  if (!dispatchId) {
    return (
      <p className={`text-xs text-slate-500 ${className}`}>
        No dispatch linked — item packing breakdown unavailable.
      </p>
    );
  }

  if (!selectedDispatch) {
    return (
      <p className={`text-xs text-slate-500 ${className}`}>
        Dispatch record not loaded — refresh or open order dispatches tab.
      </p>
    );
  }

  return (
    <div className={className}>
      <DispatchLogisticsBreakdownTable
        result={result}
        loading={Boolean(productListParams) && productsQ.isLoading && productsQ.data === undefined}
        title="Dispatched items — packing breakdown"
        emptyMessage="No shippable quantities on linked dispatch."
      />
    </div>
  );
}
