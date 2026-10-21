"use client";

import { PRIORITY_OPTIONS } from "@/components/portal/shared/orders/lib/orderStatusOptions";

type TabItem = { id: string; label: string };

type OrderListSheetProcessFiltersProps = {
  processTabs: readonly TabItem[];
  activeProcessTab: string;
  onProcessTabChange: (tabId: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (value: string) => void;
  showReset?: boolean;
  onReset?: () => void;
  compact?: boolean;
};

/** In-modal queue + priority filters (replaces bottom tab strip on sheet views). */
export function OrderListSheetProcessFilters({
  processTabs,
  activeProcessTab,
  onProcessTabChange,
  priorityFilter,
  onPriorityFilterChange,
  showReset = false,
  onReset,
  compact = false,
}: OrderListSheetProcessFiltersProps) {
  const filterPy = compact ? "py-1.5" : "py-2";

  return (
    <div
      className={`flex shrink-0 flex-wrap items-center gap-3 border-t border-slate-200 bg-white/95 px-4 dark:border-white/10 dark:bg-slate-900/95 ${filterPy}`}
    >
      <div className="flex items-center gap-2">
        <label className="whitespace-nowrap text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Queue
        </label>
        <select
          value={activeProcessTab}
          onChange={(e) => onProcessTabChange(e.target.value)}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
        >
          {processTabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="whitespace-nowrap text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Priority
        </label>
        <select
          value={priorityFilter}
          onChange={(e) => onPriorityFilterChange(e.target.value)}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="all">All</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {showReset && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="cursor-pointer text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400"
        >
          Reset
        </button>
      )}
    </div>
  );
}
