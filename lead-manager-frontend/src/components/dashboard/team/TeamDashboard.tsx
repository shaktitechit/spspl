/**
 * @fileoverview Team Leads Pipeline & Acquisition Dashboard (Manager / Coordinator scope).
 * @module components/dashboard/team/TeamDashboard
 */
"use client";

import React from "react";
import Link from "next/link";
import { Users, Plus, ChevronRight } from "lucide-react";
import LeadManagerStatsWidgets from "@/components/leads/LeadManagerStatsWidgets";
import { PrimaryAssigneeReportTable } from "../PrimaryAssigneeReportTable";
import { PrimaryAssigneeQuotationReportTable } from "../PrimaryAssigneeQuotationReportTable";

type Props = {
  portalHome?: string;
};

export function TeamDashboard({ portalHome = "/dashboard" }: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-2xs">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                Leads Pipeline &amp; Acquisition Hub
              </h2>
              <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                My team
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Leads and follow-ups for your reporting team (including yourself).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`${portalHome}/leads`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/50 px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
          >
            <span>View All Leads</span>
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
        isExecutive={false}
        isTeamScope={true}
      />

      <PrimaryAssigneeReportTable portalHome={portalHome} />
      <PrimaryAssigneeQuotationReportTable portalHome={portalHome} />
    </section>
  );
}
