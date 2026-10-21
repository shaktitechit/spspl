"use client";

import type { PlanLogisticsItemRow } from "./planOrderLogistics";

const readonlyInputClass =
  "w-full rounded-lg border border-slate-200/95 bg-slate-50 px-3 py-1.5 text-xs tabular-nums text-slate-900 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-50";
const labelClass = "text-xs font-medium text-slate-700 dark:text-slate-300";

function displayNum(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return String(value);
}

type TransportLogisticsItemPreviewProps = {
  row: PlanLogisticsItemRow;
  index: number;
  weightUnit?: string;
};

export function TransportLogisticsItemPreview({
  row,
  index,
  weightUnit = "Kg",
}: TransportLogisticsItemPreviewProps) {
  const title = row.product_name || row.sku || `Item ${index + 1}`;
  const subtitle = [row.sku && row.product_name ? row.sku : null, row.dispatch_no ? `Dispatch ${row.dispatch_no}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-lg border border-slate-200/90 bg-white p-3 dark:border-white/10 dark:bg-slate-900/80">
      <div className="mb-2 min-w-0">
        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        {subtitle ? (
          <p className="truncate text-2xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
        {row.warning ? (
          <p className="mt-0.5 text-2xs text-amber-700 dark:text-amber-400">{row.warning}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClass}>Total Weight</label>
          <input
            readOnly
            type="text"
            value={displayNum(row.weight_kg)}
            className={readonlyInputClass}
            placeholder="E.g., 25.5"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Weight Unit</label>
          <input readOnly type="text" value={weightUnit} className={readonlyInputClass} />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className={labelClass}>
            Number of Packed Boxes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            readOnly
            type="text"
            value={displayNum(row.packed_boxes)}
            className={readonlyInputClass}
            placeholder="E.g., 12"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>
            Number of Open Boxes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            readOnly
            type="text"
            value={displayNum(row.open_boxes)}
            className={readonlyInputClass}
            placeholder="E.g., 2"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>
            Total Quantity <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            readOnly
            type="text"
            value={displayNum(row.quantity)}
            className={readonlyInputClass}
            placeholder="Total item quantity"
          />
        </div>
      </div>
    </div>
  );
}
