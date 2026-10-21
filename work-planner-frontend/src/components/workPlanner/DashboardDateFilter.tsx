"use client";

import { useEffect, useState } from "react";
import { Calendar, Filter } from "lucide-react";
import { formatPlanDate } from "./workPlanUtils";

export type DateFilterPreset = "today" | "7d" | "current_month" | "last_month" | "all" | "custom";

export type DateRange = {
  from: string;
  to: string;
  preset: DateFilterPreset;
};

export type DashboardDateFilterProps = {
  onChange: (range: DateRange) => void;
};

export function toYmdString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function calculateDateRange(
  preset: DateFilterPreset,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  const now = new Date();

  if (preset === "all") {
    return { from: "", to: "" };
  }

  if (preset === "today") {
    const ymd = toYmdString(now);
    return { from: ymd, to: ymd };
  }

  if (preset === "7d") {
    const to = toYmdString(now);
    const fromDate = new Date(now);
    fromDate.setDate(now.getDate() - 6);
    const from = toYmdString(fromDate);
    return { from, to };
  }

  if (preset === "current_month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toYmdString(firstDay), to: toYmdString(lastDay) };
  }

  if (preset === "last_month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toYmdString(firstDay), to: toYmdString(lastDay) };
  }

  // Custom
  const defaultYmd = toYmdString(now);
  return {
    from: customFrom || defaultYmd,
    to: customTo || defaultYmd,
  };
}

const PRESETS: Array<{ id: DateFilterPreset; label: string }> = [
  { id: "current_month", label: "Current Month" },
  { id: "today", label: "Today" },
  { id: "7d", label: "7 Days" },
  { id: "last_month", label: "Last Month" },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom Date" },
];

export function DashboardDateFilter({ onChange }: DashboardDateFilterProps) {
  const [preset, setPreset] = useState<DateFilterPreset>("current_month");
  const todayYmd = toYmdString(new Date());
  const [customFrom, setCustomFrom] = useState(todayYmd);
  const [customTo, setCustomTo] = useState(todayYmd);

  // Trigger onChange when preset or custom dates change
  useEffect(() => {
    const range = calculateDateRange(preset, customFrom, customTo);
    onChange({
      from: range.from,
      to: range.to,
      preset,
    });
  }, [preset, customFrom, customTo, onChange]);

  const activeRange = calculateDateRange(preset, customFrom, customTo);

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-3.5 shadow-xs transition space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Filter className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Date Filter
            </h4>
            <p className="text-[11px] text-muted truncate">
              {activeRange.from && activeRange.to ? (
                <>
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {formatPlanDate(`${activeRange.from}T00:00:00`)}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-foreground">
                    {formatPlanDate(`${activeRange.to}T00:00:00`)}
                  </span>
                </>
              ) : (
                "Showing all historical records"
              )}
            </p>
          </div>
        </div>

        {/* Custom Date Inputs */}
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto bg-surface-muted/60 sm:bg-transparent p-2 sm:p-0 rounded-xl">
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[130px]">
              <span className="text-muted text-[11px] font-medium">From:</span>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full sm:w-auto rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[130px]">
              <span className="text-muted text-[11px] font-medium">To:</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full sm:w-auto rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>
        )}
      </div>

      {/* Preset Buttons - Mobile Swipeable Carousel */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 sm:flex-wrap">
        {PRESETS.map((p) => {
          const isActive = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-xl px-3 py-2 sm:py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition shrink-0 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-surface-muted text-muted hover:bg-surface-muted/80 hover:text-foreground border border-border/50"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DashboardDateFilter;
