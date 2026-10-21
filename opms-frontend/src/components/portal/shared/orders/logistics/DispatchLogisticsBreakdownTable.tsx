"use client";

import type { PlanLogisticsItemRow, PlanLogisticsResult } from "./planOrderLogistics";

function cellNum(value: number | undefined | null, digits = 2): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  if (digits === 0) return String(Math.round(n));
  return String(Math.round(n * 10 ** digits) / 10 ** digits);
}

type DispatchLogisticsBreakdownTableProps = {
  result: PlanLogisticsResult | null | undefined;
  loading?: boolean;
  title?: string;
  emptyMessage?: string;
};

export function DispatchLogisticsBreakdownTable({
  result,
  loading = false,
  title = "Dispatched items — packing breakdown",
  emptyMessage = "No dispatch line quantities to show.",
}: DispatchLogisticsBreakdownTableProps) {
  const items = result?.items ?? [];

  const totalQty = items.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const totalClosed = items.reduce((s, r) => s + (Number(r.packed_boxes) || 0), 0);
  const totalOpen = items.reduce((s, r) => s + (Number(r.open_boxes) || 0), 0);
  const totalWeightFromRows = items.reduce((s, r) => s + (Number(r.weight_kg) || 0), 0);
  const totalWeight =
    result?.weight != null && Number.isFinite(result.weight)
      ? result.weight
      : totalWeightFromRows > 0
        ? Math.round(totalWeightFromRows * 100) / 100
        : undefined;

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 p-3 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-800/40">
        {title} — loading product packing data…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200/90 bg-slate-50/50 p-3 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-800/30">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/90 dark:border-white/10">
      <p className="border-b border-slate-200/90 bg-slate-50/90 px-3 py-2 text-xs font-semibold text-slate-800 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100">
        {title}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-slate-100/90 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/80 dark:text-slate-400">
            <tr>
              <th className="px-2 py-2">Product</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Unit wt (kg)</th>
              <th className="px-2 py-2 text-right">Qty / box</th>
              <th className="px-2 py-2 text-right">Closed boxes</th>
              <th className="px-2 py-2 text-right">Open boxes</th>
              <th className="px-2 py-2 text-right">Line weight (kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map((row: PlanLogisticsItemRow, idx: number) => (
              <tr
                key={row.order_item_id || row.product_id || `${row.product_name}-${idx}`}
                className={row.warning ? "bg-amber-50/60 dark:bg-amber-950/20" : "bg-white dark:bg-slate-900/80"}
              >
                <td className="max-w-[180px] px-2 py-2">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                    {row.product_name || row.sku || "—"}
                  </p>
                  {row.sku && row.product_name ? (
                    <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{row.sku}</p>
                  ) : null}
                  {row.warning ? (
                    <p className="text-[10px] text-amber-700 dark:text-amber-400">{row.warning}</p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                  {cellNum(row.quantity, 0)}
                  {row.unit ? ` ${row.unit}` : ""}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{cellNum(row.unit_weight_kg)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{cellNum(row.units_per_box, 0)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{cellNum(row.packed_boxes, 0)}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {row.open_boxes != null ? (
                    <>
                      {cellNum(row.open_boxes, 0)}
                      {row.open_units != null && row.open_units > 0 ? (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {" "}
                          ({row.open_units} u)
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-medium">
                  {cellNum(row.weight_kg)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200/90 bg-slate-50/90 text-xs font-semibold tabular-nums text-slate-900 dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-50">
            <tr>
              <td className="px-2 py-2.5">Total</td>
              <td className="px-2 py-2.5 text-right">{cellNum(totalQty, 0)}</td>
              <td className="px-2 py-2.5 text-right">—</td>
              <td className="px-2 py-2.5 text-right">—</td>
              <td className="px-2 py-2.5 text-right">{cellNum(totalClosed, 0)}</td>
              <td className="px-2 py-2.5 text-right">{cellNum(totalOpen, 0)}</td>
              <td className="px-2 py-2.5 text-right">{cellNum(totalWeight)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {(result?.warnings?.length ?? 0) > 0 ? (
        <p className="border-t border-slate-200/80 px-3 py-2 text-[10px] text-amber-700 dark:border-white/10 dark:text-amber-400">
          {result!.warnings.slice(0, 3).join(" · ")}
          {result!.warnings.length > 3 ? ` (+${result!.warnings.length - 3} more)` : ""}
        </p>
      ) : null}
    </div>
  );
}
