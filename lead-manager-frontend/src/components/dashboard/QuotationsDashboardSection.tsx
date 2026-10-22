/**
 * @fileoverview Dedicated Quotations Commercial Proposals Dashboard Section.
 * Visualizes quotation pipeline, signatory approval queue, discounts, and deal follow-ups.
 * Visible to Lead Manager and Lead Admin access roles.
 * @module components/dashboard/QuotationsDashboardSection
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Percent,
  Plus,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Send,
  MessageSquare,
  Building2,
  Calendar,
} from "lucide-react";
import {
  useGetQuotationDashboardStatsQuery,
  useListQuotationsQuery,
  type LeadQuotationRecord,
} from "@/store/api";
import {
  formatCurrencyINR,
  canManageQuotations,
  canViewQuotations,
} from "@/components/quotations/quotationUtils";
import { QuotationFormModal } from "@/components/quotations/QuotationFormModal";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { readSessionFromStorage } from "@/utils/authStorage";

type Props = {
  portalHome?: string;
};

export function QuotationsDashboardSection({ portalHome = "/dashboard" }: Props) {
  const { user, isAdmin, isManager, isCoordinator, isExecutive } = useLeadManagerRole();
  const sessionUser = readSessionFromStorage()?.user;
  const authUser = user || sessionUser;
  const canCreate = canManageQuotations(authUser);
  const canView = canViewQuotations(authUser);

  const scopeBadge = isAdmin
    ? "Organization"
    : isManager || isCoordinator
    ? "My team"
    : isExecutive
    ? "My proposals"
    : "Commercial";

  const scopeHint = isExecutive
    ? "Proposals where you are the sales representative — view, follow up, and track outcomes."
    : isManager || isCoordinator
    ? "Team quotations, negotiations, and signatory pipeline (scoped to your reporting tree)."
    : "Commercial proposals, pricing discounts, signatory reviews, and active negotiations.";

  const { data: stats, isLoading: loadingStats } = useGetQuotationDashboardStatsQuery(undefined, {
    skip: !canView,
  });
  const { data: quotationsData, isLoading: loadingQuotes } = useListQuotationsQuery(
    {
      limit: 5,
      page: 1,
      status: "in_negotiation",
    },
    { skip: !canView }
  );

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const rawQuotations = (quotationsData as any)?.data || (quotationsData as any)?.quotations || (Array.isArray(quotationsData) ? quotationsData : []);
  const recentQuotations: LeadQuotationRecord[] = Array.isArray(rawQuotations) ? rawQuotations : [];

  if (!canView) return null;

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-2xs transition-all">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-2xs">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                Quotations &amp; Commercial Proposals Hub
              </h2>
              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                {scopeBadge}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{scopeHint}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${portalHome}/quotations`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/50 px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
          >
            <span>{isExecutive ? "My Quotations" : "View All Quotations"}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>

          <Link
            href={`${portalHome}/leads/follow-ups`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/50 px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
          >
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Quote Follow-ups</span>
          </Link>

          <Link
            href={`${portalHome}/quotations/reports`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/50 px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
          >
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Quote Reports</span>
          </Link>

          {canCreate && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Generate Quotation</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Proposals */}
        <div className="rounded-2xl border border-border bg-surface-muted/30 hover:bg-surface-muted/50 p-3.5 shadow-2xs transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Total Proposals</span>
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold tracking-tight text-foreground">
            {loadingStats ? "…" : stats?.total_quotations || 0}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {isExecutive ? "In your scope" : "All created quotes"}
          </div>
        </div>

        {/* Pending Approvals */}
        <div
          className={`rounded-2xl border p-3.5 shadow-2xs transition-colors ${
            stats?.pending_approval_count && stats.pending_approval_count > 0
              ? "border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20"
              : "border-border bg-surface-muted/30 hover:bg-surface-muted/50"
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Pending Approval</span>
            <Clock
              className={`h-3.5 w-3.5 ${
                stats?.pending_approval_count ? "animate-pulse text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              }`}
            />
          </div>
          <div
            className={`text-xl font-bold tracking-tight ${
              stats?.pending_approval_count && stats.pending_approval_count > 0
                ? "text-amber-700 dark:text-amber-300"
                : "text-foreground"
            }`}
          >
            {loadingStats ? "…" : stats?.pending_approval_count || 0}
          </div>
          <div className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-0.5">Signatory review</div>
        </div>

        {/* In Negotiation */}
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-950/20 hover:bg-indigo-500/10 p-3.5 shadow-2xs transition-colors">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">In Negotiation</span>
            <MessageSquare className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl font-bold tracking-tight text-indigo-700 dark:text-indigo-300">
            {loadingStats ? "…" : stats?.active_pipeline_count ?? stats?.in_negotiation_count ?? 0}
          </div>
          <div className="text-[10px] text-indigo-600/80 dark:text-indigo-400 mt-0.5">
            Approved, sent &amp; negotiating
          </div>
        </div>

        {/* Won Proposals Value */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 hover:bg-emerald-500/10 p-3.5 shadow-2xs transition-colors">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Won Value</span>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300 truncate">
            {loadingStats ? "…" : formatCurrencyINR(stats?.total_won_value || 0)}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400 mt-0.5">
            {stats?.accepted_count || 0} Deals Won
          </div>
        </div>

        {/* Total Active Pipeline Value */}
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20 hover:bg-blue-500/10 p-3.5 shadow-2xs transition-colors">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Quoted Pipeline</span>
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl font-bold tracking-tight text-blue-700 dark:text-blue-300 truncate">
            {loadingStats ? "…" : formatCurrencyINR(stats?.active_pipeline_value ?? stats?.total_quoted_value ?? 0)}
          </div>
          <div className="text-[10px] text-blue-600/80 dark:text-blue-400 mt-0.5">Quoted live deals</div>
        </div>

        {/* Expired Proposals / Avg Discount */}
        {Boolean(stats?.expired_count && stats.expired_count > 0) ? (
          <Link
            href={`${portalHome}/quotations?status=expired`}
            className="rounded-2xl border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/25 p-3.5 shadow-2xs hover:bg-rose-500/15 transition-colors block"
          >
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Expired Quotes</span>
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <div className="text-xl font-bold tracking-tight text-rose-700 dark:text-rose-300">
              {loadingStats ? "…" : stats?.expired_count || 0}
            </div>
            <div className="text-[10px] text-rose-600/80 dark:text-rose-400 mt-0.5">Needs extension &rarr;</div>
          </Link>
        ) : (
          <div className="rounded-2xl border border-border bg-surface-muted/30 hover:bg-surface-muted/50 p-3.5 shadow-2xs transition-colors">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Avg. Discount</span>
              <Percent className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">
              {loadingStats ? "…" : `${stats?.avg_discount_percent || 0}%`}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Margin health indicator</div>
          </div>
        )}
      </div>

      {/* Active Quotations Follow-Up Snapshot */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-border/70 mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {isExecutive ? "Recent proposals" : "Active negotiations"} ({recentQuotations.length})
            </h3>
          </div>
          <Link
            href={
              isExecutive
                ? `${portalHome}/quotations`
                : `${portalHome}/quotations?status=in_negotiation`
            }
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            {isExecutive ? "View all →" : "View negotiation pipeline →"}
          </Link>
        </div>

        {loadingQuotes ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Loading proposals...</div>
        ) : recentQuotations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            {isExecutive
              ? "No quotations assigned to you yet."
              : "No quotations currently marked as in negotiation."}
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {recentQuotations.slice(0, 4).map((q) => {
              const salesRep =
                q.sales_person_name ||
                (typeof q.sales_person_user === "object" && q.sales_person_user?.name) ||
                "";
              return (
                <div
                  key={q._id}
                  className="flex items-center justify-between py-2.5 px-2 hover:bg-surface-muted/50 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 font-bold text-xs text-indigo-700 dark:text-indigo-300 font-mono">
                      {q.version ? `v${q.version}` : "v1"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`${portalHome}/quotations/${q._id}`}
                          className="text-xs font-bold text-foreground hover:text-primary truncate"
                        >
                          {q.quotation_no}
                        </Link>
                        <span className="text-xs text-muted-foreground">&bull; {q.customer_name || "Customer"}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                        <span>Total: <strong className="text-foreground">{formatCurrencyINR(q.grand_total || 0)}</strong></span>
                        {q.status ? (
                          <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                            {String(q.status).replace(/_/g, " ")}
                          </span>
                        ) : null}
                        {salesRep && !isExecutive ? (
                          <span className="text-muted-foreground">Rep: {salesRep}</span>
                        ) : null}
                        {q.total_discount && q.total_discount > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Disc: -{formatCurrencyINR(q.total_discount)}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`${portalHome}/quotations/${q._id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-muted/60 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shrink-0 ml-2 shadow-2xs"
                  >
                    <span>Open</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canCreate && (
        <QuotationFormModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          portalHome={portalHome}
        />
      )}
    </section>
  );
}
