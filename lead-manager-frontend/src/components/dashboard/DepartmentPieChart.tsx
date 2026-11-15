/**
 * @fileoverview Horizontal Bar Chart for department-wise lead distribution.
 * Supports leads linked to multiple departments without implying mutually exclusive slices.
 * @module components/dashboard/DepartmentPieChart
 */
"use client";

import React, { useMemo, useState } from "react";
import { Building2, Layers } from "lucide-react";
import type { LeadDepartmentBreakdown } from "@/store/api";
import { formatCurrencyINR } from "@/components/leads/leadUtils";

const DEPT_COLORS = [
  "#6366f1", // indigo-500
  "#0ea5e9", // sky-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ec4899", // pink-500
  "#8b5cf6", // violet-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
  "#ef4444", // rose-500
  "#64748b", // slate-500
];

type Props = {
  data: LeadDepartmentBreakdown[];
  totalLeads?: number;
  sharedLeadsCount?: number;
  isLoading?: boolean;
  showPricing?: boolean;
};

export function DepartmentBarChart({
  data,
  totalLeads,
  sharedLeadsCount = 0,
  isLoading = false,
  showPricing = false,
}: Props) {
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);

  const bars = useMemo(() => {
    const valid = (data || []).filter((d) => d.count > 0);
    if (valid.length === 0) return [];
    const maxCount = Math.max(...valid.map((d) => d.count), 1);
    const denominator = totalLeads && totalLeads > 0 ? totalLeads : valid.reduce((s, d) => s + d.count, 0);

    return valid.map((item, idx) => ({
      ...item,
      color: DEPT_COLORS[idx % DEPT_COLORS.length],
      barWidthPercent: Math.max(4, Math.round((item.count / maxCount) * 1000) / 10),
      leadSharePercent:
        denominator > 0 ? Math.round((item.count / denominator) * 1000) / 10 : item.percentage,
    }));
  }, [data, totalLeads]);

  const activeBar = useMemo(
    () => bars.find((b) => b.department === hoveredDept) || null,
    [bars, hoveredDept]
  );

  const displayTotal = totalLeads ?? bars.reduce((s, b) => s + b.count, 0);

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-3 sm:p-3.5 shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/70">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground tracking-tight">
              Leads Linked by Department
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {bars.length} {bars.length === 1 ? "department" : "departments"} · {displayTotal} total leads
            </p>
          </div>
        </div>

        {sharedLeadsCount > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300"
            title="Leads linked to more than one department"
          >
            <Layers className="h-3 w-3" />
            {sharedLeadsCount} shared
          </span>
        )}
      </div>

      {/* Horizontal Bar Chart */}
      {isLoading && bars.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-xs text-muted-foreground">
          Loading department distribution…
        </div>
      ) : bars.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <Building2 className="h-7 w-7 text-muted-foreground/40 mb-1.5" />
          <p className="text-xs font-semibold text-muted-foreground">
            No department data available
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            Leads linked to departments will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-2 flex flex-1 flex-col justify-between gap-2">
          <div className="space-y-1.5">
            {bars.map((bar) => {
              const isHovered = hoveredDept === bar.department;
              return (
                <div
                  key={bar.department}
                  onMouseEnter={() => setHoveredDept(bar.department)}
                  onMouseLeave={() => setHoveredDept(null)}
                  className={`rounded-lg px-1.5 py-1 transition-colors cursor-pointer ${
                    isHovered ? "bg-surface-muted/70" : "hover:bg-surface-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 text-[11px] mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: bar.color }}
                      />
                      <span className="font-semibold text-foreground truncate">
                        {bar.department}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 tabular-nums">
                      <span className="font-bold text-foreground">{bar.count}</span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        ({bar.leadSharePercent}%)
                      </span>
                    </div>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted/80">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${bar.barWidthPercent}%`,
                        backgroundColor: bar.color,
                        opacity: hoveredDept && !isHovered ? 0.55 : 1,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fixed-height Footer Note / Active Readout */}
          <div className="pt-2 border-t border-border/70">
            <div
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] flex items-center justify-between gap-2 min-h-[30px] transition-colors ${
                activeBar
                  ? "border-primary/20 bg-primary/5 text-foreground"
                  : "border-border/60 bg-surface-muted/30 text-muted-foreground"
              }`}
            >
              {activeBar ? (
                <>
                  <span className="font-bold truncate">{activeBar.department}</span>
                  <span className="text-muted-foreground shrink-0 truncate">
                    {activeBar.count} leads · {activeBar.won_count} won/converted
                    {showPricing && activeBar.value > 0
                      ? ` · ${formatCurrencyINR(activeBar.value)}`
                      : ""}
                  </span>
                </>
              ) : (
                <span className="truncate">
                  Leads may belong to multiple departments, so counts can overlap.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { DepartmentBarChart as DepartmentPieChart };
