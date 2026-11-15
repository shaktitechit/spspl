/**
 * @fileoverview Full-width Monthly Lead Trends Line Graph.
 * Supports two display modes:
 * 1) Pipeline-wise: Total Leads, In Process, Won/Converted, and Lost leads
 * 2) Department-wise: Individual trend lines per department
 * @module components/dashboard/LeadTrendsLineChart
 */
"use client";

import React, { useMemo, useState } from "react";
import { TrendingUp, GitBranch, Building2 } from "lucide-react";
import {
  useGetLeadMonthlyTrendsQuery,
  useListLeadsQuery,
  type LeadMonthlyTrend,
  type LeadReportQueryParams,
} from "@/store/api";

type TrendMode = "pipeline" | "department";

type SeriesDef = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

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
  assigned_to?: string;
  queryParams?: LeadReportQueryParams;
};

export function LeadTrendsLineChart({ assigned_to, queryParams: externalQueryParams }: Props) {
  const [mode, setMode] = useState<TrendMode>("pipeline");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});

  const queryParams = useMemo<LeadReportQueryParams | undefined>(() => {
    const merged: LeadReportQueryParams = {
      ...(externalQueryParams || {}),
      ...(assigned_to ? { assigned_to } : {}),
    };
    return Object.keys(merged).length > 0 ? merged : undefined;
  }, [assigned_to, externalQueryParams]);

  const { data: apiTrends = [], isFetching: isTrendsFetching } =
    useGetLeadMonthlyTrendsQuery(queryParams);

  const hasBackendDeptTrends = useMemo(
    () =>
      Array.isArray(apiTrends) &&
      apiTrends.some(
        (t) => t.department_counts && Object.keys(t.department_counts).length > 0
      ),
    [apiTrends]
  );

  // Fallback for department-wise monthly trends if backend hasn't been restarted yet
  const { data: leadsListData, isFetching: isLeadsFetching } = useListLeadsQuery(
    {
      limit: 1000,
      ...(queryParams?.assigned_to ? { assigned_to: queryParams.assigned_to } : {}),
      ...(queryParams?.startDate ? { from_date: queryParams.startDate } : {}),
      ...(queryParams?.endDate ? { to_date: queryParams.endDate } : {}),
    },
    {
      skip: hasBackendDeptTrends && apiTrends.length > 0,
    }
  );

  const monthlyData = useMemo<LeadMonthlyTrend[]>(() => {
    if (Array.isArray(apiTrends) && apiTrends.length > 0 && hasBackendDeptTrends) {
      return apiTrends;
    }

    const items = leadsListData?.items;
    if (Array.isArray(items) && items.length > 0) {
      const monthMap = new Map<string, LeadMonthlyTrend>();
      for (const lead of items) {
        const d = lead.createdAt ? new Date(lead.createdAt) : new Date();
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-IN", {
          month: "short",
          year: "numeric",
        });

        if (!monthMap.has(key)) {
          monthMap.set(key, {
            period_key: key,
            period_label: label,
            total_leads: 0,
            pipeline_value: 0,
            in_process_count: 0,
            won_count: 0,
            won_value: 0,
            converted_count: 0,
            converted_value: 0,
            lost_count: 0,
            lost_value: 0,
            quotation_count: 0,
            department_counts: {},
          });
        }

        const entry = monthMap.get(key)!;
        const estVal = Number(lead.estimated_value) || 0;
        const st = lead.status;

        entry.total_leads += 1;
        entry.pipeline_value += estVal;

        const deptCandidates: string[] =
          Array.isArray(lead.departments) && lead.departments.length > 0
            ? lead.departments.map((dep: string) => String(dep || "").trim()).filter(Boolean)
            : lead.department && String(lead.department).trim()
            ? [String(lead.department).trim()]
            : lead.assigned_to &&
              typeof lead.assigned_to === "object" &&
              lead.assigned_to.department
            ? [String(lead.assigned_to.department).trim()]
            : ["Unassigned"];

        const uniqueDepts = Array.from(
          new Set<string>(deptCandidates.length ? deptCandidates : ["Unassigned"])
        );
        for (const deptName of uniqueDepts) {
          entry.department_counts![deptName] =
            (entry.department_counts![deptName] || 0) + 1;
        }

        if (st === "won" || st === "converted") {
          entry.won_count += 1;
          entry.won_value += estVal;
          if (st === "converted") {
            entry.converted_count += 1;
            entry.converted_value += estVal;
          }
        } else if (st === "lost") {
          entry.lost_count += 1;
          entry.lost_value += estVal;
        } else {
          entry.in_process_count = (entry.in_process_count ?? 0) + 1;
          if (st === "quotation") {
            entry.quotation_count += 1;
          }
        }
      }

      return Array.from(monthMap.values()).sort((a, b) =>
        a.period_key.localeCompare(b.period_key)
      );
    }

    return Array.isArray(apiTrends) ? apiTrends : [];
  }, [apiTrends, hasBackendDeptTrends, leadsListData?.items]);

  const seriesList = useMemo<SeriesDef[]>(() => {
    if (monthlyData.length === 0) return [];

    if (mode === "pipeline") {
      return [
        {
          key: "total",
          label: "Total Leads",
          color: "#6366f1",
          values: monthlyData.map((m) => m.total_leads ?? 0),
        },
        {
          key: "in_process",
          label: "In Process",
          color: "#f59e0b",
          values: monthlyData.map(
            (m) =>
              m.in_process_count ??
              Math.max(0, (m.total_leads ?? 0) - (m.won_count ?? 0) - (m.lost_count ?? 0))
          ),
        },
        {
          key: "won_converted",
          label: "Won / Converted",
          color: "#10b981",
          values: monthlyData.map((m) => m.won_count ?? 0),
        },
        {
          key: "lost",
          label: "Lost",
          color: "#ef4444",
          values: monthlyData.map((m) => m.lost_count ?? 0),
        },
      ];
    }

    // Department-wise mode: collect all departments sorted by total count descending
    const deptTotals = new Map<string, number>();
    for (const m of monthlyData) {
      const counts = m.department_counts || {};
      for (const [dept, count] of Object.entries(counts)) {
        deptTotals.set(dept, (deptTotals.get(dept) || 0) + (Number(count) || 0));
      }
    }

    const sortedDepts = Array.from(deptTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([dept]) => dept);

    return sortedDepts.map((dept, idx) => ({
      key: `dept:${dept}`,
      label: dept,
      color: DEPT_COLORS[idx % DEPT_COLORS.length],
      values: monthlyData.map((m) => m.department_counts?.[dept] ?? 0),
    }));
  }, [monthlyData, mode]);

  const visibleSeries = useMemo(
    () => seriesList.filter((s) => !hiddenSeries[s.key]),
    [seriesList, hiddenSeries]
  );

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // SVG Chart Geometry
  const SVG_W = 860;
  const SVG_H = 230;
  const PAD_L = 42;
  const PAD_R = 20;
  const PAD_T = 16;
  const PAD_B = 34;
  const PLOT_W = SVG_W - PAD_L - PAD_R;
  const PLOT_H = SVG_H - PAD_T - PAD_B;

  const { maxY, yTicks } = useMemo(() => {
    const allVals = visibleSeries.flatMap((s) => s.values);
    const rawMax = allVals.length > 0 ? Math.max(...allVals, 1) : 4;
    const step = rawMax <= 4 ? 1 : Math.ceil(rawMax / 4);
    const top = step * 4;
    return {
      maxY: top,
      yTicks: [0, step, step * 2, step * 3, top],
    };
  }, [visibleSeries]);

  const getX = (idx: number) => {
    if (monthlyData.length <= 1) return PAD_L + PLOT_W / 2;
    return PAD_L + (idx / (monthlyData.length - 1)) * PLOT_W;
  };

  const getY = (val: number) => {
    if (maxY <= 0) return PAD_T + PLOT_H;
    return PAD_T + PLOT_H - (val / maxY) * PLOT_H;
  };

  const activeMonth =
    hoveredIdx !== null && monthlyData[hoveredIdx] ? monthlyData[hoveredIdx] : null;

  const isLoading = isTrendsFetching || isLeadsFetching;

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-3 sm:p-3.5 shadow-2xs space-y-2.5">
      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/70">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground tracking-tight">
              Monthly Lead Trends
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {mode === "pipeline"
                ? "Pipeline stages over months (Total, In Process, Won/Converted, Lost)"
                : "Department-wise lead volume over months"}
            </p>
          </div>
        </div>

        {/* 2-Way Toggle */}
        <div className="inline-flex items-center rounded-xl border border-border bg-surface-muted/50 p-0.5">
          <button
            type="button"
            onClick={() => {
              setMode("pipeline");
              setHiddenSeries({});
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
              mode === "pipeline"
                ? "bg-card text-foreground shadow-2xs border border-border/70"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GitBranch className="h-3 w-3" />
            <span>Pipeline-wise</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("department");
              setHiddenSeries({});
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
              mode === "department"
                ? "bg-card text-foreground shadow-2xs border border-border/70"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="h-3 w-3" />
            <span>Department-wise</span>
          </button>
        </div>
      </div>

      {/* Series Legend Pills */}
      {seriesList.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {seriesList.map((s) => {
            const isHidden = Boolean(hiddenSeries[s.key]);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSeries(s.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition-all cursor-pointer ${
                  isHidden
                    ? "border-border/50 bg-surface-muted/20 text-muted-foreground opacity-50 line-through"
                    : "border-border bg-surface-muted/40 text-foreground hover:bg-surface-muted/70"
                }`}
                title={isHidden ? `Show ${s.label}` : `Hide ${s.label}`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Chart Area */}
      {isLoading && monthlyData.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
          Loading monthly lead trends…
        </div>
      ) : monthlyData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <TrendingUp className="h-7 w-7 text-muted-foreground/40 mb-1.5" />
          <p className="text-xs font-semibold text-muted-foreground">
            No monthly trend data available
          </p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full h-52 min-w-[320px] select-none"
            role="img"
            aria-label="Monthly lead trends line chart"
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {/* Horizontal Gridlines & Y-Axis Labels */}
            {yTicks.map((tick) => {
              const y = getY(tick);
              return (
                <g key={tick}>
                  <line
                    x1={PAD_L}
                    y1={y}
                    x2={SVG_W - PAD_R}
                    y2={y}
                    stroke="currentColor"
                    className="text-border/60"
                    strokeDasharray={tick === 0 ? undefined : "3 3"}
                    strokeWidth={1}
                  />
                  <text
                    x={PAD_L - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px] font-medium tabular-nums"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Vertical Hover Crosshair */}
            {hoveredIdx !== null && monthlyData[hoveredIdx] && (
              <line
                x1={getX(hoveredIdx)}
                y1={PAD_T}
                x2={getX(hoveredIdx)}
                y2={PAD_T + PLOT_H}
                stroke="currentColor"
                className="text-primary/40"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            )}

            {/* Trend Lines & Points */}
            {visibleSeries.map((series) => {
              const points = series.values.map((v, idx) => `${getX(idx)},${getY(v)}`).join(" ");
              return (
                <g key={series.key}>
                  {series.values.length > 1 && (
                    <polyline
                      fill="none"
                      stroke={series.color}
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={points}
                    />
                  )}
                  {series.values.map((v, idx) => {
                    const isHovered = hoveredIdx === idx;
                    return (
                      <circle
                        key={idx}
                        cx={getX(idx)}
                        cy={getY(v)}
                        r={isHovered ? 4.5 : 3}
                        fill={series.color}
                        stroke="var(--card, #ffffff)"
                        strokeWidth={1.5}
                        className="transition-all duration-100"
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* X-Axis Month Labels */}
            {monthlyData.map((m, idx) => {
              const step = monthlyData.length > 12 ? Math.ceil(monthlyData.length / 10) : 1;
              if (idx % step !== 0 && idx !== monthlyData.length - 1) return null;
              return (
                <text
                  key={m.period_key}
                  x={getX(idx)}
                  y={SVG_H - 10}
                  textAnchor="middle"
                  className={`text-[10px] font-medium ${
                    hoveredIdx === idx ? "fill-foreground font-bold" : "fill-muted-foreground"
                  }`}
                >
                  {m.period_label}
                </text>
              );
            })}

            {/* Invisible Hover Columns for Smooth Month Selection */}
            {monthlyData.map((m, idx) => {
              const colW =
                monthlyData.length <= 1 ? PLOT_W : PLOT_W / Math.max(monthlyData.length - 1, 1);
              const x = getX(idx) - colW / 2;
              return (
                <rect
                  key={`hover-${m.period_key}`}
                  x={Math.max(PAD_L, x)}
                  y={PAD_T}
                  width={colW}
                  height={PLOT_H + PAD_B}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoveredIdx(idx)}
                />
              );
            })}
          </svg>
        </div>
      )}

      {/* Fixed-height Hover Readout Footer */}
      {monthlyData.length > 0 && (
        <div
          className={`rounded-lg border px-2.5 py-1.5 text-[11px] flex flex-wrap items-center justify-between gap-2 min-h-[30px] transition-colors ${
            activeMonth
              ? "border-primary/20 bg-primary/5 text-foreground"
              : "border-border/60 bg-surface-muted/30 text-muted-foreground"
          }`}
        >
          {activeMonth && hoveredIdx !== null ? (
            <>
              <span className="font-bold shrink-0">{activeMonth.period_label}</span>
              <div className="flex flex-wrap items-center gap-3">
                {visibleSeries.map((s) => (
                  <span key={s.key} className="inline-flex items-center gap-1 tabular-nums">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-muted-foreground">{s.label}:</span>
                    <span className="font-bold text-foreground">{s.values[hoveredIdx] ?? 0}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <span>Hover over any month on the chart to inspect exact lead counts.</span>
          )}
        </div>
      )}
    </div>
  );
}

