/**
 * @fileoverview Compact Commercials & Quotations KPI list card for the dashboard.
 * Displays Total Quotations, Pending Approvals, In Progress, Won Value, Pipeline Value, and Expired Quote.
 * @module components/dashboard/CommercialsQuotationsList
 */
"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Clock,
  MessageSquare,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  XCircle,
  ArrowUpRight,
} from "lucide-react";
import {
  useGetQuotationDashboardStatsQuery,
  useGetQuotationReportSummaryQuery,
  type LeadReportQueryParams,
  type QuotationReportQueryParams,
} from "@/store/api";
import {
  formatCurrencyINR,
  canViewQuotations,
} from "@/components/quotations/quotationUtils";
import { readSessionFromStorage } from "@/utils/authStorage";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";

type Props = {
  portalHome?: string;
  queryParams?: LeadReportQueryParams;
};

export function CommercialsQuotationsList({ portalHome = "/dashboard", queryParams }: Props) {
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

  const hasFilter = Boolean(
    quotationQueryParams &&
      ((quotationQueryParams.period && quotationQueryParams.period !== "all_time") ||
        quotationQueryParams.from ||
        quotationQueryParams.to ||
        quotationQueryParams.sales_person)
  );

  const { data: stats, isFetching: loadingStats } = useGetQuotationDashboardStatsQuery(undefined, {
    skip: !canView || hasFilter,
  });
  const { data: reportSummary, isFetching: loadingSummary } = useGetQuotationReportSummaryQuery(
    quotationQueryParams,
    { skip: !canView }
  );
  const isFetching = loadingStats || loadingSummary;

  if (!canView) return null;

  const s = hasFilter ? undefined : stats;
  const ss = reportSummary?.status_breakdown;
  const totalQuotations = s?.total_quotations ?? reportSummary?.total_quotations ?? 0;
  const pendingApprovals = s?.pending_approval_count ?? ss?.pending_approval?.count ?? 0;
  const inProgressCount =
    s?.active_pipeline_count ??
    s?.in_negotiation_count ??
    (ss
      ? (ss.approved?.count ?? 0) +
        (ss.sent?.count ?? 0) +
        (ss.in_negotiation?.count ?? 0) +
        (ss.on_hold?.count ?? 0)
      : 0);
  const wonValue = s?.total_won_value ?? reportSummary?.won_deals?.value ?? 0;
  const wonCount = s?.accepted_count ?? reportSummary?.won_deals?.count ?? 0;
  const pipelineValue =
    s?.active_pipeline_value ??
    s?.total_quoted_value ??
    (ss
      ? (ss.approved?.value ?? 0) +
        (ss.sent?.value ?? 0) +
        (ss.in_negotiation?.value ?? 0) +
        (ss.on_hold?.value ?? 0)
      : 0);
  const expiredCount = s?.expired_count ?? ss?.expired?.count ?? 0;
  const rejectedCount = s?.rejected_count ?? ss?.rejected?.count ?? 0;

  const items = [
    {
      key: "total",
      label: "Total Quotations",
      value: totalQuotations,
      href: `${portalHome}/quotations`,
      accent: "bg-slate-500",
      iconWrap: "bg-slate-100 dark:bg-slate-800/60",
      iconTone: "text-slate-600 dark:text-slate-300",
      Icon: FileText,
    },
    {
      key: "pending",
      label: "Pending Approvals",
      value: pendingApprovals,
      href: `${portalHome}/quotations?status=pending_approval`,
      accent: "bg-amber-500",
      iconWrap: "bg-amber-50 dark:bg-amber-950/30",
      iconTone: "text-amber-600 dark:text-amber-400",
      Icon: Clock,
    },
    {
      key: "in_progress",
      label: "In Progress",
      value: inProgressCount,
      href: `${portalHome}/quotations?status=in_negotiation`,
      accent: "bg-indigo-500",
      iconWrap: "bg-indigo-50 dark:bg-indigo-950/30",
      iconTone: "text-indigo-600 dark:text-indigo-400",
      Icon: MessageSquare,
    },
    {
      key: "won_value",
      label: "Won Value",
      subValue: `${wonCount} deals won`,
      value: formatCurrencyINR(wonValue),
      href: `${portalHome}/quotations?status=accepted`,
      accent: "bg-emerald-500",
      iconWrap: "bg-emerald-50 dark:bg-emerald-950/30",
      iconTone: "text-emerald-600 dark:text-emerald-400",
      Icon: CheckCircle2,
    },
    {
      key: "pipeline_value",
      label: "Pipeline Value",
      value: formatCurrencyINR(pipelineValue),
      href: `${portalHome}/quotations`,
      accent: "bg-blue-500",
      iconWrap: "bg-blue-50 dark:bg-blue-950/30",
      iconTone: "text-blue-600 dark:text-blue-400",
      Icon: TrendingUp,
    },
    {
      key: "expired",
      label: "Expired Quote",
      value: expiredCount,
      href: `${portalHome}/quotations?status=expired`,
      accent: "bg-rose-500",
      iconWrap: "bg-rose-50 dark:bg-rose-950/30",
      iconTone: "text-rose-600 dark:text-rose-400",
      Icon: AlertTriangle,
    },
    {
      key: "rejected",
      label: "Rejected Quote",
      value: rejectedCount,
      href: `${portalHome}/quotations?status=rejected`,
      accent: "bg-red-500",
      iconWrap: "bg-red-50 dark:bg-red-950/30",
      iconTone: "text-red-600 dark:text-red-400",
      Icon: XCircle,
    },
  ];

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-3 sm:p-3.5 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/70">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-foreground tracking-tight truncate">
              Commercials &amp; Quotations
            </h4>
            <p className="text-[11px] text-muted-foreground truncate">
              Proposal pipeline summary
            </p>
          </div>
        </div>
        <Link
          href={`${portalHome}/quotations`}
          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary hover:underline shrink-0"
        >
          View
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* List */}
      <div className="mt-2 flex-1 divide-y divide-border/60">
        {items.map(({ key, label, subValue, value, href, accent, iconWrap, iconTone, Icon }) => (
          <Link
            key={key}
            href={href}
            className="group relative flex items-center justify-between gap-2 py-2 px-2 rounded-lg transition-colors hover:bg-surface-muted/40"
          >
            <div
              className={`absolute inset-y-1.5 left-0 w-0.5 rounded-full ${accent} opacity-70 transition-opacity group-hover:opacity-100`}
            />
            <div className="flex items-center gap-2 min-w-0 pl-1.5">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${iconWrap}`}
              >
                <Icon className={`h-3.5 w-3.5 ${iconTone}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {label}
                </p>
                {subValue && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {subValue}
                  </p>
                )}
              </div>
            </div>
            <span
              className={`text-sm font-bold tracking-tight text-foreground shrink-0 tabular-nums ${
                isFetching ? "opacity-40" : ""
              }`}
            >
              {value}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

