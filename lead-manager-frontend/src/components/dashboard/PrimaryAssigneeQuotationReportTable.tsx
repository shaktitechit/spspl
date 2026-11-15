/**
 * @fileoverview Primary Assignee Commercials & Quotations Report Table.
 * Rendered inside LeadsDashboardSection for Organization (Admin) and My Team (Manager/Coordinator) scopes.
 * @module components/dashboard/PrimaryAssigneeQuotationReportTable
 */
"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { FileText, ArrowUpRight } from "lucide-react";
import {
  useGetQuotationReportSalesPerformanceQuery,
  type LeadReportQueryParams,
  type QuotationReportQueryParams,
} from "@/store/api";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { readSessionFromStorage } from "@/utils/authStorage";
import { canViewQuotations, formatCurrencyINR } from "@/components/quotations/quotationUtils";

type Props = {
  portalHome?: string;
  queryParams?: LeadReportQueryParams;
};

export function PrimaryAssigneeQuotationReportTable({ portalHome = "/dashboard", queryParams }: Props) {
  const { user } = useLeadManagerRole();
  const authUser = user || readSessionFromStorage()?.user;
  const canView = canViewQuotations(authUser);

  const quotationQueryParams = useMemo<QuotationReportQueryParams | undefined>(() => {
    if (!queryParams) return undefined;
    const params: QuotationReportQueryParams = {};
    if (queryParams.period) params.period = queryParams.period;
    if (queryParams.startDate) params.from = queryParams.startDate;
    if (queryParams.endDate) params.to = queryParams.endDate;
    if (queryParams.assigned_to) params.sales_person = queryParams.assigned_to;
    return Object.keys(params).length > 0 ? params : undefined;
  }, [queryParams]);

  const {
    data: rows = [],
    isLoading,
    isFetching,
  } = useGetQuotationReportSalesPerformanceQuery(quotationQueryParams, { skip: !canView });

  const activeRows = useMemo(() => {
    return rows.filter((r) => (r.total_quotations ?? 0) > 0);
  }, [rows]);

  const totals = useMemo(() => {
    return activeRows.reduce(
      (acc, r) => ({
        total_quotations: acc.total_quotations + (r.total_quotations ?? 0),
        pending_count: acc.pending_count + (r.pending_count ?? 0),
        in_negotiation_count: acc.in_negotiation_count + (r.in_negotiation_count ?? 0),
        won_count: acc.won_count + (r.won_count ?? 0),
        won_value: acc.won_value + (r.won_value ?? 0),
        pipeline_value: acc.pipeline_value + (r.pipeline_value ?? 0),
        expired_count: acc.expired_count + (r.expired_count ?? 0),
        rejected_count: acc.rejected_count + (r.rejected_count ?? 0),
      }),
      {
        total_quotations: 0,
        pending_count: 0,
        in_negotiation_count: 0,
        won_count: 0,
        won_value: 0,
        pipeline_value: 0,
        expired_count: 0,
        rejected_count: 0,
      }
    );
  }, [activeRows]);

  if (!canView) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border/70">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground tracking-tight truncate">
              Primary Assignee Commercials &amp; Quotations Report
            </h3>
            <p className="text-[11px] text-muted-foreground truncate">
              Proposal pipeline summary by primary assignee
            </p>
          </div>
        </div>
        <Link
          href={`${portalHome}/quotations`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0"
        >
          <span>View</span>
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
            No quotation data available.
          </div>
        ) : (
          <table className={`w-full text-left border-collapse ${isFetching ? "opacity-70" : ""}`}>
            <thead>
              <tr className="border-b border-border/70 bg-surface-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-3.5 py-2.5 whitespace-nowrap">Primary Assignee</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Total Quotations</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Pending Approvals</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">In Progress</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Won Deals</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Won Value</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Pipeline Value</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Expired Quote</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Rejected Quote</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-xs">
              {activeRows.map((row, idx) => {
                const isUnassigned = !row.user_id;
                return (
                  <tr
                    key={String(row.user_id || row.name || idx)}
                    className="hover:bg-surface-muted/30 transition-colors"
                  >
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                          {(row.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span
                            className={`font-semibold truncate block ${
                              isUnassigned ? "text-muted-foreground italic" : "text-foreground"
                            }`}
                          >
                            {row.name}
                          </span>
                          {row.department && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {row.department}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-foreground tabular-nums">
                      {row.total_quotations.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      {row.pending_count.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {row.in_negotiation_count.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {row.won_count.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                      {formatCurrencyINR(row.won_value)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-blue-600 dark:text-blue-400 tabular-nums whitespace-nowrap">
                      {formatCurrencyINR(row.pipeline_value ?? 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                      {row.expired_count.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-semibold text-red-600 dark:text-red-400 tabular-nums">
                      {row.rejected_count.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-muted/50 text-xs font-bold text-foreground">
                <td className="px-3.5 py-2.5">Total ({activeRows.length})</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {totals.total_quotations.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-amber-600 dark:text-amber-400 tabular-nums">
                  {totals.pending_count.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {totals.in_negotiation_count.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {totals.won_count.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                  {formatCurrencyINR(totals.won_value)}
                </td>
                <td className="px-3 py-2.5 text-right text-blue-600 dark:text-blue-400 tabular-nums whitespace-nowrap">
                  {formatCurrencyINR(totals.pipeline_value)}
                </td>
                <td className="px-3 py-2.5 text-right text-rose-600 dark:text-rose-400 tabular-nums">
                  {totals.expired_count.toLocaleString()}
                </td>
                <td className="px-3.5 py-2.5 text-right text-red-600 dark:text-red-400 tabular-nums">
                  {totals.rejected_count.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

