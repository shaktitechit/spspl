"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Plus, CalendarDays, FileText, DollarSign, ArrowRight } from "lucide-react";
import { WorkPlannerStatsWidgets } from "@/components/workPlanner/WorkPlannerStatsWidgets";
import { DashboardDateFilter, type DateRange } from "@/components/workPlanner/DashboardDateFilter";
import { isWpElevated, readSessionFromStorage } from "@/utils/authStorage";

export default function DashboardPage() {
  const user = readSessionFromStorage()?.user;
  const elevatedRole = isWpElevated(user);

  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange({ from: range.from, to: range.to });
  }, []);

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-primary/90 via-primary to-primary-hover p-6 text-primary-foreground shadow-xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {user?.name || "Executive"}!
          </h1>
          <p className="mt-1 text-xs opacity-90 max-w-xl">
            {elevatedRole
              ? "Track field visit activities, inspect executive work plans, and manage expense claims in real-time."
              : "Plan field visits, complete client calls, record tasks, and claim trip expenses seamlessly."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/plans/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-card px-4 py-2.5 text-xs font-bold text-primary hover:bg-surface-muted shadow-md transition"
          >
            <Plus className="h-4 w-4" />
            New Work Plan
          </Link>
          <Link
            href="/dashboard/plans/calendar"
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary-foreground/30 bg-primary-foreground/10 px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/20 backdrop-blur-sm transition"
          >
            <CalendarDays className="h-4 w-4" />
            Calendar View
          </Link>
        </div>
      </div>

      {/* Date Filter Bar */}
      <DashboardDateFilter onChange={handleDateRangeChange} />

      {/* Analytical Widgets */}
      <WorkPlannerStatsWidgets fromDate={dateRange.from} toDate={dateRange.to} />

      {/* Quick Action Navigation Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/dashboard/plans"
          className="group rounded-xl border border-border bg-card p-5 shadow-xs hover:border-primary hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted group-hover:text-primary transition" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">
            Work Plans Management
          </h3>
          <p className="mt-1 text-xs text-muted">
            View all draft, submitted, and approved daily work plans.
          </p>
        </Link>

        <Link
          href="/dashboard/plans/calendar"
          className="group rounded-xl border border-border bg-card p-5 shadow-xs hover:border-primary hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted group-hover:text-primary transition" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">
            Interactive Calendar
          </h3>
          <p className="mt-1 text-xs text-muted">
            Visualize scheduled field visit dates and status indicators on a monthly grid.
          </p>
        </Link>

        <Link
          href="/dashboard/expenses"
          className="group rounded-xl border border-border bg-card p-5 shadow-xs hover:border-primary hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <DollarSign className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted group-hover:text-emerald-500 transition" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">
            Expense Claims
          </h3>
          <p className="mt-1 text-xs text-muted">
            Review submitted DA, stay, and local conveyance reimbursement claims.
          </p>
        </Link>
      </div>
    </div>
  );
}
