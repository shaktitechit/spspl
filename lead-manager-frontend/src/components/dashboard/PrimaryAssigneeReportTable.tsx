/**
 * @fileoverview Primary Assignee Lead Pipeline & Acquisition Report Table.
 * Rendered inside LeadsDashboardSection for Organization (Admin) and My Team (Manager/Coordinator) scopes.
 * @module components/dashboard/PrimaryAssigneeReportTable
 */
"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Users, ArrowUpRight } from "lucide-react";
import { useGetLeadSalesPerformanceQuery, type LeadReportQueryParams } from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { canViewLeadPricing, formatCurrencyINR } from "@/components/leads/leadUtils";

type Props = {
  portalHome?: string;
  queryParams?: LeadReportQueryParams;
};

export function PrimaryAssigneeReportTable({ portalHome = "/dashboard", queryParams }: Props) {
  const authUser = useAppSelector((state) => state.auth.user);
  const showPricing = canViewLeadPricing(authUser, portalHome);

  const { data: rows = [], isLoading, isFetching } = useGetLeadSalesPerformanceQuery({
    ...queryParams,
    primary_only: true,
  });

  const activeRows = useMemo(() => {
    return rows.filter((r) => (r.total_leads ?? 0) > 0);
  }, [rows]);

  const totals = useMemo(() => {
    return activeRows.reduce(
      (acc, r) => ({
        total_leads: acc.total_leads + (r.total_leads ?? 0),
        in_progress_leads: acc.in_progress_leads + (r.in_progress_leads ?? 0),
        won_leads: acc.won_leads + (r.won_leads ?? 0),
        lost_leads: acc.lost_leads + (r.lost_leads ?? 0),
        pipeline_qty: acc.pipeline_qty + (r.pipeline_qty ?? r.pipeline_quantity ?? 0),
        pipeline_value: acc.pipeline_value + (r.pipeline_value ?? 0),
        won_value: acc.won_value + (r.won_value ?? 0),
      }),
      {
        total_leads: 0,
        in_progress_leads: 0,
        won_leads: 0,
        lost_leads: 0,
        pipeline_qty: 0,
        pipeline_value: 0,
        won_value: 0,
      }
    );
  }, [activeRows]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border/70">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Users className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground tracking-tight truncate">
              Primary Assignee Pipeline Report
            </h3>
            <p className="text-[11px] text-muted-foreground truncate">
              Enquiry status, pipeline quantity, and deal value by primary assignee
            </p>
          </div>
        </div>
        <Link
          href={`${portalHome}/leads/reports`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0"
        >
          <span>Full Report</span>
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-surface-muted/60" />
            ))}
          </div>
        ) : activeRows.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No assignee enquiry data available.
          </div>
        ) : (
          <table className={`w-full text-left border-collapse ${isFetching ? "opacity-70" : ""}`}>
            <thead>
              <tr className="border-b border-border/70 bg-surface-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-3.5 py-2.5 whitespace-nowrap">Primary Assignee</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Total Enquiries</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">In Progress Leads</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Won &amp; Converted Leads</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Lost Inquiries</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Pipeline Qty</th>
                {showPricing && (
                  <>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Pipeline Value</th>
                    <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Won Value</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-xs">
              {activeRows.map((row) => {
                const isUnassigned = row.user_id === "unassigned";
                const pipelineQty = row.pipeline_qty ?? row.pipeline_quantity ?? 0;

                return (
                  <tr
                    key={String(row.user_id)}
                    className="hover:bg-surface-muted/30 transition-colors"
                  >
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                          {(row.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          {isUnassigned ? (
                            <span className="font-semibold text-muted-foreground italic">
                              {row.name}
                            </span>
                          ) : (
                            <Link
                              href={`${portalHome}/leads?assigned_to=${row.user_id}`}
                              className="font-semibold text-foreground hover:text-primary hover:underline truncate block"
                            >
                              {row.name}
                            </Link>
                          )}
                          {row.department && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {row.department}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-foreground tabular-nums">
                      {row.total_leads.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      {(row.in_progress_leads ?? 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {row.won_leads.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                      {row.lost_leads.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
                      {pipelineQty.toLocaleString()}
                    </td>
                    {showPricing && (
                      <>
                        <td className="px-3 py-2.5 text-right font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums whitespace-nowrap">
                          {formatCurrencyINR(row.pipeline_value)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                          {formatCurrencyINR(row.won_value)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-muted/50 text-xs font-bold text-foreground">
                <td className="px-3.5 py-2.5">Total ({activeRows.length})</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {totals.total_leads.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-amber-600 dark:text-amber-400 tabular-nums">
                  {totals.in_progress_leads.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {totals.won_leads.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-rose-600 dark:text-rose-400 tabular-nums">
                  {totals.lost_leads.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-violet-600 dark:text-violet-400 tabular-nums">
                  {totals.pipeline_qty.toLocaleString()}
                </td>
                {showPricing && (
                  <>
                    <td className="px-3 py-2.5 text-right text-indigo-600 dark:text-indigo-400 tabular-nums whitespace-nowrap">
                      {formatCurrencyINR(totals.pipeline_value)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                      {formatCurrencyINR(totals.won_value)}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

