"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  Home,
  IndianRupee,
  MapPin,
  Sun,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useGetStatsQuery } from "@/store/api/workPlannerApiSlice";
import { isWpElevated, readSessionFromStorage } from "@/utils/authStorage";
import type { WorkPlannerStats } from "@/types/workPlanner";

type OwnershipScope = "mine" | "team";

type StatCard = {
  key: string;
  label: string;
  value: number | string;
  sub?: string;
  href: string;
  accent: string;
  iconWrap: string;
  iconTone: string;
  Icon: LucideIcon;
};

function formatMoney(n?: number) {
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function StatsBlock({
  title,
  subtitle,
  tag,
  scope,
  fromDate,
  toDate,
}: {
  title: string;
  subtitle: string;
  tag?: string;
  scope?: OwnershipScope;
  fromDate?: string;
  toDate?: string;
}) {
  const queryParams = useMemo(() => {
    const q: Record<string, string | undefined> = {};
    if (fromDate && toDate) {
      q.from = fromDate;
      q.to = toDate;
    }
    if (scope) {
      q.scope = scope;
    }
    return Object.keys(q).length > 0 ? q : undefined;
  }, [fromDate, toDate, scope]);

  const { data, isLoading: loading } = useGetStatsQuery(queryParams);

  const typeCounts = data?.by_plan_type ?? {};
  const planCount = data?.total_plans ?? 0;

  const scopeParam = scope ? `scope=${scope}` : "";
  const dateParams = fromDate && toDate ? `from=${fromDate}&to=${toDate}` : "";

  function buildUrl(basePath: string, extraParams: string = "") {
    const params = [extraParams, scopeParam, dateParams].filter(Boolean).join("&");
    return params ? `${basePath}?${params}` : basePath;
  }

  const cards: StatCard[] = [
    {
      key: "today",
      label: "Total Plans",
      value: planCount,
      sub: `${data?.total_visits ?? 0} visits · ${data?.total_works ?? 0} tasks`,
      href: buildUrl("/dashboard/plans"),
      accent: "bg-primary",
      iconWrap: "bg-primary/10",
      iconTone: "text-primary",
      Icon: CalendarDays,
    },
    {
      key: "type-visits",
      label: "Visits",
      value: typeCounts.Visits ?? 0,
      href: buildUrl("/dashboard/plans", "plan_type=Visits"),
      accent: "bg-cyan-500",
      iconWrap: "bg-cyan-500/10",
      iconTone: "text-cyan-500",
      Icon: MapPin,
    },
    {
      key: "type-leave",
      label: "Leave",
      value: typeCounts.Leave ?? 0,
      href: buildUrl("/dashboard/plans", "plan_type=Leave"),
      accent: "bg-amber-500",
      iconWrap: "bg-amber-500/10",
      iconTone: "text-amber-500",
      Icon: Sun,
    },
    {
      key: "type-wfh",
      label: "Work From Home",
      value: typeCounts["Work From Home"] ?? 0,
      href: buildUrl("/dashboard/plans", "plan_type=Work From Home"),
      accent: "bg-purple-500",
      iconWrap: "bg-purple-500/10",
      iconTone: "text-purple-500",
      Icon: Home,
    },
    {
      key: "type-wfo",
      label: "Work From Office",
      value: typeCounts["Work From Office"] ?? 0,
      href: buildUrl("/dashboard/plans", "plan_type=Work From Office"),
      accent: "bg-teal-500",
      iconWrap: "bg-teal-500/10",
      iconTone: "text-teal-500",
      Icon: Building2,
    },
    {
      key: "planned",
      label: "Planned",
      value: data?.by_status?.planned ?? data?.approved ?? 0,
      href: buildUrl("/dashboard/plans", "status=planned"),
      accent: "bg-blue-500",
      iconWrap: "bg-blue-500/10",
      iconTone: "text-blue-500",
      Icon: ShieldCheck,
    },
  ];

  const statusCards: StatCard[] = [
    {
      key: "completed",
      label: "Completed",
      value: data?.completed ?? 0,
      href: buildUrl("/dashboard/plans", "status=completed"),
      accent: "bg-emerald-500",
      iconWrap: "bg-emerald-500/10",
      iconTone: "text-emerald-500",
      Icon: CheckCircle,
    },
  ];

  const expenseCards: StatCard[] = [
    {
      key: "exp-total",
      label: "Total Expenses",
      value: `₹${formatMoney(data?.expense_total)}`,
      href: buildUrl("/dashboard/expenses"),
      accent: "bg-teal-500",
      iconWrap: "bg-teal-500/10",
      iconTone: "text-teal-500",
      Icon: IndianRupee,
    },
    {
      key: "exp-pending",
      label: "Pending Expense Approvals",
      value: data?.expense_pending_approval ?? 0,
      href: buildUrl("/dashboard/expenses", "status=submitted"),
      accent: "bg-primary",
      iconWrap: "bg-primary/10",
      iconTone: "text-primary",
      Icon: ShieldCheck,
    },
    {
      key: "exp-approved",
      label: "Approved Expenses",
      value: data?.expense_approved_count ?? 0,
      href: buildUrl("/dashboard/expenses", "status=approved"),
      accent: "bg-emerald-500",
      iconWrap: "bg-emerald-500/10",
      iconTone: "text-emerald-500",
      Icon: Wallet,
    },
  ];

  const trend = data?.monthly_trend ?? [];
  const expenseTrend = data?.expense_monthly_trend ?? [];

  return (
    <div className="space-y-3 font-sans w-full">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              {title}
            </h3>
            {tag && (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {tag}
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5">{subtitle}</p>
        </div>
        <Link
          href={buildUrl("/dashboard/plans")}
          className="text-xs font-semibold text-primary hover:underline active:scale-95 transition"
        >
          View plans →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3 w-full">
        {cards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className={`group relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-3.5 shadow-xs transition active:scale-[0.98] hover:border-primary ${
              loading ? "opacity-70 animate-pulse" : ""
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-0.5 ${card.accent}`} />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted truncate">
                  {card.label}
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-foreground">
                  {card.value}
                </div>
                {card.sub ? (
                  <div className="mt-0.5 text-[10px] text-muted line-clamp-1">
                    {card.sub}
                  </div>
                ) : null}
              </div>
              <div
                className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg ${card.iconWrap}`}
              >
                <card.Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${card.iconTone}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-3 w-full">
        {statusCards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className={`group relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-3.5 shadow-xs transition active:scale-[0.98] hover:border-primary ${
              loading ? "opacity-70 animate-pulse" : ""
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-0.5 ${card.accent}`} />
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-muted">
                  {card.label}
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-foreground">
                  {card.value}
                </div>
              </div>
              <div
                className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg ${card.iconWrap}`}
              >
                <card.Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${card.iconTone}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-3 w-full">
        {expenseCards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className={`group relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-3.5 shadow-xs transition active:scale-[0.98] hover:border-primary ${
              loading ? "opacity-70 animate-pulse" : ""
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-0.5 ${card.accent}`} />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted truncate">
                  {card.label}
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-foreground truncate">
                  {card.value}
                </div>
              </div>
              <div
                className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg ${card.iconWrap}`}
              >
                <card.Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${card.iconTone}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {trend.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Monthly Plan Trend
          </div>
          <div className="flex flex-wrap gap-2">
            {trend.map((m) => (
              <div
                key={`${m.year}-${m.month}`}
                className="rounded-lg bg-surface-muted px-2.5 sm:px-3 py-1.5 text-xs"
              >
                <span className="font-medium text-foreground">
                  {m.year}-{String(m.month).padStart(2, "0")}
                </span>
                <span className="ml-2 tabular-nums text-muted font-bold">{m.count} plans</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {expenseTrend.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Monthly Approved Expenses
          </div>
          <div className="flex flex-wrap gap-2">
            {expenseTrend.map((m) => (
              <div
                key={`exp-${m.year}-${m.month}`}
                className="rounded-lg bg-emerald-500/10 px-2.5 sm:px-3 py-1.5 text-xs"
              >
                <span className="font-medium text-foreground">
                  {m.year}-{String(m.month).padStart(2, "0")}
                </span>
                <span className="ml-2 tabular-nums text-emerald-500 font-bold">
                  ₹{formatMoney(m.amount)}
                </span>
                <span className="ml-1 text-muted">({m.count} claims)</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type WorkPlannerStatsWidgetsProps = {
  fromDate?: string;
  toDate?: string;
};

export function WorkPlannerStatsWidgets({
  fromDate,
  toDate,
}: WorkPlannerStatsWidgetsProps = {}) {
  const user = readSessionFromStorage()?.user;
  const elevatedRole = isWpElevated(user);

  if (!elevatedRole) {
    return (
      <StatsBlock
        title="Work Planner Overview"
        subtitle="Field visits, tasks, leave, and expense claims summary"
        scope="mine"
        fromDate={fromDate}
        toDate={toDate}
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 w-full">
      <StatsBlock
        title="My Overview"
        tag="Personal"
        subtitle="Your own field visits, tasks, leave, and expense claims"
        scope="mine"
        fromDate={fromDate}
        toDate={toDate}
      />

      <StatsBlock
        title="Team Overview"
        tag="Team Oversight"
        subtitle="Team-wide field visits, tasks, leave, and expense claims"
        scope="team"
        fromDate={fromDate}
        toDate={toDate}
      />
    </div>
  );
}
