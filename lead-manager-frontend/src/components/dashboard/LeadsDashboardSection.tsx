/**
 * @fileoverview Dedicated Leads Management & Pipeline Dashboard Section.
 * Visualizes lead funnel, conversion stages, source performance, and scheduled interactions.
 * Scoped by role: admin org-wide, manager/coordinator team, executive self.
 * @module components/dashboard/LeadsDashboardSection
 */
"use client";

import React from "react";
import Link from "next/link";
import { Users, Plus, ChevronRight } from "lucide-react";
import LeadManagerStatsWidgets from "@/components/leads/LeadManagerStatsWidgets";

type Props = {
  portalHome?: string;
  assigned_to?: string;
  isAdmin?: boolean;
  isManager?: boolean;
  isCoordinator?: boolean;
  isExecutive?: boolean;
};

export function LeadsDashboardSection({
  portalHome = "/dashboard",
  assigned_to,
  isAdmin = false,
  isManager = false,
  isCoordinator = false,
  isExecutive = false,
}: Props) {
  const scopeBadge = isAdmin
    ? "Organization"
    : isManager || isCoordinator
    ? "My team"
    : isExecutive
    ? "My pipeline"
    : "Leads";

  const scopeHint = isAdmin
    ? "Organization-wide inquiry pipeline, assignments, and follow-up workload."
    : isManager || isCoordinator
    ? "Leads and follow-ups for your reporting team (including yourself)."
    : isExecutive
    ? "Leads assigned to you and your scheduled customer interactions."
    : "Lead acquisition, qualification funnel, and conversion metrics.";

  return (
    <section className="space-y-4 rounded-3xl border border-blue-200/70 bg-gradient-to-b from-blue-50/40 via-white to-white p-5 sm:p-6 shadow-xs dark:border-blue-900/30 dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-blue-100 dark:border-blue-900/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-600/30">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Leads Pipeline & Acquisition Hub
              </h2>
              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {scopeBadge}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{scopeHint}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`${portalHome}/leads`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-750 transition"
          >
            <span>{isExecutive ? "My Leads" : "View All Leads"}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>

          <Link
            href={`${portalHome}/leads/new`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Lead</span>
          </Link>
        </div>
      </div>

      <LeadManagerStatsWidgets
        portalHome={portalHome}
        assigned_to={assigned_to}
        isExecutive={isExecutive}
        isTeamScope={isAdmin || isManager || isCoordinator}
      />
    </section>
  );
}
