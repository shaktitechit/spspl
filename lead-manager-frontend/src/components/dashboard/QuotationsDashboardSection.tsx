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
    <section className="space-y-4 rounded-3xl border border-indigo-200/70 bg-gradient-to-b from-indigo-50/40 via-white to-white p-5 sm:p-6 shadow-xs dark:border-indigo-900/30 dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-indigo-100 dark:border-indigo-900/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Quotations & Commercial Proposals Hub
              </h2>
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                {scopeBadge}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{scopeHint}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${portalHome}/quotations`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/60 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-750 transition"
          >
            <span>{isExecutive ? "My Quotations" : "View All Quotations"}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>

          <Link
            href={`${portalHome}/leads/follow-ups`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200/80 bg-white px-3.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/60 dark:bg-slate-800 dark:text-indigo-300 transition"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Quote Follow-ups</span>
          </Link>

          <Link
            href={`${portalHome}/quotations/reports`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200/80 bg-white px-3.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/60 dark:bg-slate-800 dark:text-indigo-300 transition"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Quote Reports</span>
          </Link>

          {canCreate && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition cursor-pointer"
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
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Proposals</span>
            <FileText className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {loadingStats ? "…" : stats?.total_quotations || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {isExecutive ? "In your scope" : "All created quotes"}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className={`rounded-2xl border p-3.5 shadow-2xs transition ${
          stats?.pending_approval_count && stats.pending_approval_count > 0
            ? "border-amber-300 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/40"
            : "border-slate-200/80 bg-white dark:border-white/5 dark:bg-slate-800/80"
        }`}>
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending Approval</span>
            <Clock className={`h-3.5 w-3.5 ${stats?.pending_approval_count ? "animate-pulse text-amber-600" : ""}`} />
          </div>
          <div className="text-xl font-black text-amber-700 dark:text-amber-300">
            {loadingStats ? "…" : stats?.pending_approval_count || 0}
          </div>
          <div className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-0.5">Signatory review</div>
        </div>

        {/* In Negotiation */}
        <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-3.5 shadow-2xs dark:border-indigo-900/40 dark:bg-indigo-950/30">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">In Negotiation</span>
            <MessageSquare className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl font-black text-indigo-700 dark:text-indigo-300">
            {loadingStats ? "…" : stats?.active_pipeline_count ?? stats?.in_negotiation_count ?? 0}
          </div>
          <div className="text-[10px] text-indigo-600/80 dark:text-indigo-400 mt-0.5">
            Approved, sent &amp; negotiating
          </div>
        </div>

        {/* Won Proposals Value */}
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Won Value (Accepted)</span>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 truncate">
            {loadingStats ? "…" : formatCurrencyINR(stats?.total_won_value || 0)}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400 mt-0.5">
            {stats?.accepted_count || 0} Deals Won
          </div>
        </div>

        {/* Total Active Pipeline Value */}
        <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-3.5 shadow-2xs dark:border-blue-900/40 dark:bg-blue-950/30">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Quoted Pipeline</span>
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl font-black text-blue-700 dark:text-blue-300 truncate">
            {loadingStats ? "…" : formatCurrencyINR(stats?.active_pipeline_value ?? stats?.total_quoted_value ?? 0)}
          </div>
          <div className="text-[10px] text-blue-600/80 dark:text-blue-400 mt-0.5">Quoted pipeline (live deals)</div>
        </div>

        {/* Expired Proposals / Avg Discount */}
        {Boolean(stats?.expired_count && stats.expired_count > 0) ? (
          <Link
            href={`${portalHome}/quotations?status=expired`}
            className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5 shadow-2xs dark:border-rose-900/40 dark:bg-rose-950/30 hover:bg-rose-100/60 transition block"
          >
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Expired Quotes</span>
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <div className="text-xl font-black text-rose-700 dark:text-rose-300">
              {loadingStats ? "…" : stats?.expired_count || 0}
            </div>
            <div className="text-[10px] text-rose-600/80 dark:text-rose-400 mt-0.5">Needs extension →</div>
          </Link>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Avg. Discount</span>
              <Percent className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white">
              {loadingStats ? "…" : `${stats?.avg_discount_percent || 0}%`}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Margin health indicator</div>
          </div>
        )}
      </div>

      {/* Active Quotations Follow-Up Snapshot */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/5 dark:bg-slate-800/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {isExecutive ? "Recent proposals" : "Active negotiations"} ({recentQuotations.length})
            </h3>
          </div>
          <Link
            href={
              isExecutive
                ? `${portalHome}/quotations`
                : `${portalHome}/quotations?status=in_negotiation`
            }
            className="text-[11px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {isExecutive ? "View all →" : "View negotiation pipeline →"}
          </Link>
        </div>

        {loadingQuotes ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading proposals...</div>
        ) : recentQuotations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-white/10">
            {isExecutive
              ? "No quotations assigned to you yet."
              : "No quotations currently marked as in negotiation."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {recentQuotations.slice(0, 4).map((q) => {
              const salesRep =
                q.sales_person_name ||
                (typeof q.sales_person_user === "object" && q.sales_person_user?.name) ||
                "";
              return (
              <div
                key={q._id}
                className="flex items-center justify-between py-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 rounded-xl px-2 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-xs">
                    {q.version ? `v${q.version}` : "v1"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`${portalHome}/quotations/${q._id}`}
                        className="text-xs font-bold text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400 truncate"
                      >
                        {q.quotation_no}
                      </Link>
                      <span className="text-xs text-slate-400">• {q.customer_name || "Customer"}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                      <span>Total: <strong>{formatCurrencyINR(q.grand_total || 0)}</strong></span>
                      {q.status ? (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {String(q.status).replace(/_/g, " ")}
                        </span>
                      ) : null}
                      {salesRep && !isExecutive ? (
                        <span className="text-slate-500">Rep: {salesRep}</span>
                      ) : null}
                      {q.total_discount && q.total_discount > 0 ? (
                        <span className="text-emerald-600 font-medium">Disc: -{formatCurrencyINR(q.total_discount)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <Link
                  href={`${portalHome}/quotations/${q._id}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:text-indigo-300 transition shrink-0 ml-2"
                >
                  <span>Open</span>
                  <ExternalLink className="h-3 w-3" />
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
