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
    <section className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-2xs transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-2xs">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                Leads Pipeline & Acquisition Hub
              </h2>
              <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {scopeBadge}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{scopeHint}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`${portalHome}/leads`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/50 px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
          >
            <span>{isExecutive ? "My Leads" : "View All Leads"}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>

          <Link
            href={`${portalHome}/leads/new`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
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
