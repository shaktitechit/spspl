/**
 * @fileoverview Dedicated Leads Management & Pipeline Dashboard Section.
 * Visualizes lead funnel, conversion stages, source performance, and scheduled interactions.
 * Scoped by role: admin org-wide, manager/coordinator team, executive self.
 * @module components/dashboard/LeadsDashboardSection
 */
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Users, Plus, ChevronRight } from "lucide-react";
import { useListUsersQuery, type LeadReportQueryParams } from "@/store/api";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { useLeadManagerTeamScope } from "@/hooks/useLeadManagerTeamScope";
import {
  isUserInLeadManagerPortal,
  getLeadManagerPortalRole,
} from "@/components/leads/leadUtils";
import LeadManagerStatsWidgets from "@/components/leads/LeadManagerStatsWidgets";
import { PrimaryAssigneeReportTable } from "./PrimaryAssigneeReportTable";
import { PrimaryAssigneeQuotationReportTable } from "./PrimaryAssigneeQuotationReportTable";

const PERIOD_OPTIONS = [
  { value: "all_time", label: "All Time (All Inquiries)" },
  { value: "this_year", label: "This Financial Year (FY 2026-27)" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_week", label: "This Week" },
  { value: "today", label: "Today" },
  { value: "custom", label: "Custom Date Range" },
];

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
  const canFilterRep = isAdmin || isManager || isCoordinator;
  const { user } = useLeadManagerRole();
  const { filterByTeam, withSelfInList } = useLeadManagerTeamScope();

  const [period, setPeriod] = useState<string>("all_time");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("all");

  const { data: usersData } = useListUsersQuery(undefined, { skip: !canFilterRep });
  const users = (Array.isArray(usersData)
    ? usersData
    : (usersData as { data?: Array<{ _id: string; name: string; department?: string; portals?: Array<{ portal_code?: string; access_roles?: string[] }> }> })?.data || []) as Array<{ _id: string; name: string; department?: string; portals?: Array<{ portal_code?: string; access_roles?: string[] }> }>;

  const assignableUsers = useMemo(() => {
    let filtered = users.filter(isUserInLeadManagerPortal);
    if (filtered.length === 0) filtered = users;
    const scoped = filterByTeam(filtered);
    const selfRow = user?._id ? users.find((u) => String(u._id) === String(user._id)) : undefined;
    return withSelfInList(scoped, selfRow);
  }, [users, filterByTeam, withSelfInList, user]);

  const queryParams: LeadReportQueryParams = useMemo(() => {
    const params: LeadReportQueryParams = {};
    if (period !== "custom") {
      params.period = period;
    } else {
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
    }
    if (canFilterRep && selectedUser !== "all") {
      params.assigned_to = selectedUser;
    }
    return params;
  }, [period, startDate, endDate, selectedUser, canFilterRep]);

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
    <section className="space-y-3 rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-border/70">
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

      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {period === "custom" && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
        )}

        {canFilterRep && (
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 cursor-pointer max-w-[180px] truncate"
            title={isAdmin ? "Filter by assignee" : "Filter by team member"}
          >
            <option value="all">{isAdmin ? "All Sales Reps" : "All Team Members"}</option>
            {assignableUsers.map((u) => {
              const roleBadge = getLeadManagerPortalRole(u);
              return (
                <option key={u._id} value={u._id}>
                  {u.name} {roleBadge ? `(${roleBadge})` : ""}
                </option>
              );
            })}
          </select>
        )}
      </div>

      <LeadManagerStatsWidgets
        portalHome={portalHome}
        assigned_to={assigned_to}
        isExecutive={isExecutive}
        isTeamScope={isAdmin || isManager || isCoordinator}
        reportQueryParams={queryParams}
      />

      {(isAdmin || isManager || isCoordinator) && (
        <>
          <PrimaryAssigneeReportTable portalHome={portalHome} queryParams={queryParams} />
          <PrimaryAssigneeQuotationReportTable portalHome={portalHome} queryParams={queryParams} />
        </>
      )}
    </section>
  );
}
