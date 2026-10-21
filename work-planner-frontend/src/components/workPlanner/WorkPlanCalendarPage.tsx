"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  List,
  MapPin,
  Network,
  Plus,
  RefreshCw,
  User,
  Users,
} from "lucide-react";
import {
  useGetPlansQuery,
  useGetMyTeamQuery,
  useGetTeamTreeQuery,
} from "@/store/api/workPlannerApiSlice";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import type { WorkPlanRecord, WorkPlanStatus } from "@/types/workPlanner";
import {
  formatPlanDate,
  formatTime,
  planActivityLabel,
  planIdOf,
  planTypeShort,
  renderPlanStatusBadge,
  renderVisitStatusBadge,
  renderWorkStatusBadge,
  salesUserLabel,
} from "./workPlanUtils";
import {
  isWpAdmin,
  isWpManager,
  isWpElevated,
  hasWorkPlannerPortalAccess,
  readSessionFromStorage,
} from "@/utils/authStorage";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const STATUS_DOT: Record<WorkPlanStatus, string> = {
  draft: "bg-muted",
  planned: "bg-blue-500",
  submitted: "bg-primary",
  approved: "bg-emerald-500",
  rejected: "bg-rose-500",
  completed: "bg-emerald-500",
};

const STATUS_CHIP: Record<WorkPlanStatus, string> = {
  draft: "bg-surface-muted text-muted",
  planned: "bg-blue-500/10 text-blue-500",
  submitted: "bg-primary/10 text-primary",
  approved: "bg-emerald-500/10 text-emerald-500",
  rejected: "bg-rose-500/10 text-rose-500",
  completed: "bg-emerald-500/10 text-emerald-500",
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function planDayKey(planDate: unknown): string {
  if (!planDate) return "";
  const d = new Date(String(planDate));
  if (isNaN(d.getTime())) return "";
  return toYmd(d);
}

function buildMonthCells(month: Date) {
  const first = startOfMonth(month);
  const startPad = first.getDay();
  const daysInMonth = endOfMonth(month).getDate();
  const cells: Array<{ date: Date | null; ymd: string | null }> = [];

  for (let i = 0; i < startPad; i += 1) {
    cells.push({ date: null, ymd: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    cells.push({ date, ymd: toYmd(date) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, ymd: null });
  }
  return cells;
}

interface ExecutiveUser {
  _id: string;
  id?: string;
  name: string;
  email: string;
  department?: string;
  portals?: Array<{
    portal_code?: string;
    portal?: { code?: string };
    code?: string;
    access_roles?: string[];
  }>;
}

function hasWorkPlannerAccess(u: ExecutiveUser | any, sessionUserId?: string): boolean {
  if (!u) return false;
  const uId = String(u._id || u.id || "");
  if (sessionUserId && uId === String(sessionUserId)) return true;
  return hasWorkPlannerPortalAccess(u);
}

export function WorkPlanCalendarPage() {
  const user = readSessionFromStorage()?.user;
  const adminRole = isWpAdmin(user);
  const managerRole = isWpManager(user);
  const elevatedRole = isWpElevated(user);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedYmd, setSelectedYmd] = useState<string | null>(() => toYmd(new Date()));

  // Role Scoping & Team / Executive filter
  const [ownershipScope, setOwnershipScope] = useState<"mine" | "team">(
    elevatedRole ? "team" : "mine"
  );
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all");
  const [selectedExecutiveFilter, setSelectedExecutiveFilter] = useState<string>("all");

  const { data: usersData } = useGetUsersQuery(undefined, { skip: !adminRole });
  const { data: tree } = useGetTeamTreeQuery(undefined, { skip: !adminRole });
  const { data: myTeamData } = useGetMyTeamQuery(undefined, { skip: adminRole || !managerRole });

  const allUsers = useMemo<ExecutiveUser[]>(() => {
    if (adminRole) return (usersData as ExecutiveUser[]) || [];
    const list: ExecutiveUser[] = [];
    const seen = new Set<string>();

    const addUser = (u: any) => {
      if (!u) return;
      const id = String(u._id || u.id || "");
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push(u as ExecutiveUser);
      }
    };

    if (user) addUser(user);
    if (Array.isArray(myTeamData?.members)) {
      myTeamData.members.forEach(addUser);
    }
    if (Array.isArray(myTeamData?.edges)) {
      myTeamData.edges.forEach((e: any) => {
        if (e.manager) addUser(e.manager);
        if (e.user) addUser(e.user);
      });
    }
    return list;
  }, [adminRole, usersData, user, myTeamData]);

  // Teams list (Managers with their teams)
  const teamOptions = useMemo<Array<{ id: string; name: string; memberIds: string[] }>>(() => {
    if (!elevatedRole) return [];
    if (adminRole) {
      const mgrs = (tree?.managers || []) as Array<{ _id?: string; id?: string; name: string; report_ids?: string[] }>;
      return mgrs.map((m) => {
        const mId = String(m._id || m.id || "");
        const reportIds = (m.report_ids || []).map(String);
        return {
          id: mId,
          name: `${m.name}'s Team`,
          memberIds: [mId, ...reportIds],
        };
      });
    }

    if (managerRole && user?._id) {
      const myTeamMembers = (myTeamData?.members || []) as Array<{ _id?: string; id?: string }>;
      const memberIds = [String(user._id), ...myTeamMembers.map((m) => String(m._id || m.id || ""))];
      return [
        {
          id: String(user._id),
          name: `${user.name} (My Reporting Team)`,
          memberIds,
        },
      ];
    }

    return [];
  }, [adminRole, managerRole, elevatedRole, tree, myTeamData, user]);

  // Allowed Executives for executive dropdown
  const allowedExecutives = useMemo<ExecutiveUser[]>(() => {
    if (!elevatedRole) {
      if (!user) return [];
      return [
        {
          _id: user._id || (user as { id?: string }).id || "",
          id: user._id || (user as { id?: string }).id || "",
          name: `${user.name} (Self)`,
          email: user.email,
          department: user.department,
        },
      ];
    }

    // If a specific Team is selected, scope allowed executives to that team
    if (selectedTeamFilter !== "all") {
      const team = teamOptions.find((t) => t.id === selectedTeamFilter);
      if (team) {
        const teamMemberSet = new Set(team.memberIds);
        return allUsers.filter((u) => teamMemberSet.has(String(u._id || u.id || "")));
      }
    }

    if (adminRole) {
      return allUsers.filter((u) => hasWorkPlannerAccess(u, user?._id));
    }

    const myTeamMembers = (myTeamData?.members || []) as Array<{ _id?: string; id?: string }>;
    const teamIdSet = new Set<string>(
      myTeamMembers.map((m) => String(m._id || m.id || ""))
    );
    if (user?._id) {
      teamIdSet.add(String(user._id));
    }
    return allUsers.filter((u) => teamIdSet.has(String(u._id || u.id || "")));
  }, [allUsers, user, adminRole, elevatedRole, myTeamData, selectedTeamFilter, teamOptions]);

  const fromYmd = useMemo(() => toYmd(startOfMonth(currentMonth)), [currentMonth]);
  const toYmdVal = useMemo(() => toYmd(endOfMonth(currentMonth)), [currentMonth]);

  const queryParams = useMemo(() => {
    const q: Record<string, string | number | boolean | undefined> = {
      from: fromYmd,
      to: toYmdVal,
      limit: 250,
      include_visits: "true",
      include_works: "true",
    };
    if (elevatedRole) {
      q.scope = ownershipScope;
    }
    if (selectedExecutiveFilter && selectedExecutiveFilter !== "all") {
      q.sales_user = selectedExecutiveFilter;
    }
    return q;
  }, [fromYmd, toYmdVal, elevatedRole, ownershipScope, selectedExecutiveFilter]);

  const { data: plansRes, isLoading: loading, refetch: loadMonthPlans } = useGetPlansQuery(queryParams);
  const rawPlans = plansRes?.data || [];

  // Filter plans based on ownership scope, team filter & executive filter client-side
  const plans = useMemo(() => {
    if (!elevatedRole) return rawPlans;
    if (ownershipScope === "mine") {
      const currentUid = String(user?._id || "");
      return rawPlans.filter((p) => {
        const sUserId =
          typeof p.sales_user === "object"
            ? p.sales_user?._id || p.sales_user?.id || ""
            : String(p.sales_user || "");
        return sUserId === currentUid;
      });
    }

    let result = rawPlans;

    // Apply Team Filter if selected
    if (selectedTeamFilter !== "all") {
      const team = teamOptions.find((t) => t.id === selectedTeamFilter);
      if (team) {
        const memberSet = new Set(team.memberIds);
        result = result.filter((p) => {
          const sUserId =
            typeof p.sales_user === "object"
              ? p.sales_user?._id || p.sales_user?.id || ""
              : String(p.sales_user || "");
          return memberSet.has(sUserId);
        });
      }
    }

    // Apply Executive Filter if selected
    if (selectedExecutiveFilter !== "all") {
      result = result.filter((p) => {
        const sUserId =
          typeof p.sales_user === "object"
            ? p.sales_user?._id || p.sales_user?.id || ""
            : String(p.sales_user || "");
        return sUserId === String(selectedExecutiveFilter);
      });
    }

    return result;
  }, [rawPlans, elevatedRole, ownershipScope, selectedTeamFilter, teamOptions, selectedExecutiveFilter, user]);

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }, [currentMonth]);

  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const cells = useMemo(() => buildMonthCells(currentMonth), [currentMonth]);

  const plansByDay = useMemo(() => {
    const map = new Map<string, WorkPlanRecord[]>();
    for (const p of plans) {
      const k = planDayKey(p.plan_date);
      if (!k) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return map;
  }, [plans]);

  const selectedPlans = useMemo(() => {
    if (!selectedYmd) return [];
    return plansByDay.get(selectedYmd) || [];
  }, [selectedYmd, plansByDay]);

  // KPI Metrics
  const totalMonthPlans = plans.length;
  const completedMonthPlans = plans.filter((p) => p.status === "completed").length;
  const approvedMonthPlans = plans.filter((p) => p.status === "approved").length;
  const pendingMonthPlans = plans.filter(
    (p) => p.status === "planned" || p.status === "submitted" || p.status === "draft"
  ).length;

  function prevMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  function goToday() {
    const now = new Date();
    setCurrentMonth(startOfMonth(now));
    setSelectedYmd(toYmd(now));
  }

  return (
    <div className="space-y-3.5 sm:space-y-4 font-sans w-full max-w-full">
      {/* Calendar Top Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-xl border border-border p-2 hover:bg-surface-muted active:scale-95 transition cursor-pointer shrink-0"
            title="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base sm:text-lg font-bold text-foreground min-w-[130px] sm:min-w-[160px] text-center truncate">
            {monthLabel}
          </h2>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-xl border border-border p-2 hover:bg-surface-muted active:scale-95 transition cursor-pointer shrink-0"
            title="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-xl border border-border bg-surface-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-card active:scale-95 transition cursor-pointer shrink-0"
          >
            Today
          </button>
        </div>

        {/* Elevated Controls: My vs Team & Executive Filtering */}
        {elevatedRole && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 sm:flex-wrap">
            <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setOwnershipScope("mine");
                  setSelectedExecutiveFilter("all");
                }}
                className={`rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
                  ownershipScope === "mine"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                My Plans
              </button>
              <button
                type="button"
                onClick={() => setOwnershipScope("team")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
                  ownershipScope === "team"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                {adminRole ? "All Members" : "My Team"}
              </button>
            </div>

            {/* Team Filter Dropdown when viewing team (admin sees all manager teams) */}
            {ownershipScope === "team" && teamOptions.length > 0 && (
              <div className="flex items-center gap-1.5 bg-card border border-border px-2.5 py-1 rounded-xl shrink-0">
                <Network className="h-3.5 w-3.5 text-muted" />
                <select
                  value={selectedTeamFilter}
                  onChange={(e) => {
                    setSelectedTeamFilter(e.target.value);
                    setSelectedExecutiveFilter("all");
                  }}
                  className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer max-w-[140px] sm:max-w-[170px]"
                >
                  <option value="all">All Teams</option>
                  {teamOptions.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Executive Filter Dropdown when viewing team */}
            {ownershipScope === "team" && (
              <div className="flex items-center gap-1.5 bg-card border border-border px-2.5 py-1 rounded-xl shrink-0">
                <Users className="h-3.5 w-3.5 text-muted" />
                <select
                  value={selectedExecutiveFilter}
                  onChange={(e) => setSelectedExecutiveFilter(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer max-w-[140px] sm:max-w-[180px]"
                >
                  <option value="all">All Executives</option>
                  {allowedExecutives.map((exec) => (
                    <option key={exec._id || exec.id} value={exec._id || exec.id}>
                      {exec.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 sm:flex-wrap">
          <Link
            href={`/dashboard/plans/new${selectedYmd ? `?date=${selectedYmd}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover shadow-xs active:scale-95 transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Plan</span>
          </Link>
          <Link
            href="/dashboard/plans"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0"
          >
            <List className="h-4 w-4 text-muted" />
            <span>List View</span>
          </Link>
          <button
            type="button"
            onClick={loadMonthPlans}
            disabled={loading}
            className="rounded-xl border border-border p-2 text-muted hover:bg-surface-muted hover:text-foreground active:scale-95 transition cursor-pointer shrink-0"
            title="Refresh calendar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="text-xs text-muted font-medium">Total Plans ({monthLabel})</div>
          <div className="text-lg font-extrabold text-foreground mt-0.5">
            {totalMonthPlans}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 shadow-xs">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Completed Plans</div>
          <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
            {completedMonthPlans}
          </div>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 shadow-xs">
          <div className="text-xs text-primary font-medium">Approved Plans</div>
          <div className="text-lg font-extrabold text-primary mt-0.5">
            {approvedMonthPlans}
          </div>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 shadow-xs">
          <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Planned / Pending</div>
          <div className="text-lg font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">
            {pendingMonthPlans}
          </div>
        </div>
      </div>

      {/* Grid Layout: Calendar Grid on Left, Day Inspector Sidebar on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar Grid (2 cols on lg) */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="grid grid-cols-7 border-b border-border bg-surface-muted text-center text-xs font-bold text-muted">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-2.5">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-border">
            {cells.map((cell, idx) => {
              if (!cell.date || !cell.ymd) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[110px] bg-surface-muted/30"
                  />
                );
              }

              const isToday = cell.ymd === todayYmd;
              const isSelected = cell.ymd === selectedYmd;
              const dayPlans = plansByDay.get(cell.ymd) || [];

              return (
                <div
                  key={cell.ymd}
                  onClick={() => setSelectedYmd(cell.ymd)}
                  className={`group relative flex flex-col justify-between min-h-[110px] p-1.5 transition cursor-pointer ${
                    isSelected
                      ? "bg-primary/10 ring-2 ring-inset ring-primary"
                      : "hover:bg-surface-muted"
                  } ${isToday ? "border-t-2 border-t-amber-500" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        isToday
                          ? "bg-amber-500 text-white"
                          : isSelected
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>

                    {dayPlans.length > 0 && (
                      <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-extrabold text-primary">
                        {dayPlans.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex-1 space-y-1 overflow-y-auto max-h-[80px]">
                    {dayPlans.map((p) => {
                      const id = planIdOf(p);
                      const typeLabel = planTypeShort(p.plan_type);
                      const actLabel = planActivityLabel(p);
                      const userName = salesUserLabel(p.sales_user);
                      const dotClass = STATUS_DOT[p.status] || STATUS_DOT.draft;
                      const chipClass = STATUS_CHIP[p.status] || STATUS_CHIP.draft;

                      return (
                        <div
                          key={id}
                          className="block rounded bg-surface-muted/90 p-1 text-[10px] font-medium text-foreground transition hover:bg-primary/15 border border-border/50 space-y-0.5"
                        >
                          <div className="flex items-center justify-between gap-1 overflow-hidden">
                            <span className="truncate font-bold text-foreground" title={userName}>
                              {userName}
                            </span>
                            <span className={`shrink-0 rounded px-1 py-0.2 text-[9px] font-semibold capitalize ${chipClass}`}>
                              {p.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted truncate">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
                            <span className="truncate">{typeLabel}: {actLabel}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Work Plans Inspector Sidebar (1 col on lg) */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <div className="text-xs text-muted font-semibold">Selected Day Schedule</div>
              <h3 className="text-sm font-bold text-foreground">
                {selectedYmd ? formatPlanDate(selectedYmd) : "Select a date"}
              </h3>
            </div>
            <Link
              href={`/dashboard/plans/new${selectedYmd ? `?date=${selectedYmd}` : ""}`}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover shadow-xs transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              + Add Plan
            </Link>
          </div>

          {selectedPlans.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-muted">
              <FileText className="h-10 w-10 text-muted/40 mb-2" />
              <p className="text-xs font-semibold text-foreground">No work plans for this day</p>
              <p className="text-[11px] text-muted max-w-[220px] mt-1">
                No work plan scheduled for {selectedYmd ? formatPlanDate(selectedYmd) : "this day"}. Click below to create one.
              </p>
              <Link
                href={`/dashboard/plans/new${selectedYmd ? `?date=${selectedYmd}` : ""}`}
                className="mt-3 inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Plan for Day
              </Link>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[560px] pr-1">
              {selectedPlans.map((p) => {
                const id = planIdOf(p);
                const userName = salesUserLabel(p.sales_user);
                const visitsCount = p.visits?.length || 0;
                const worksCount = p.works?.length || 0;

                return (
                  <div
                    key={id}
                    className="rounded-xl border border-border bg-surface-muted/50 p-3.5 space-y-2.5 hover:border-primary/40 transition"
                  >
                    {/* Header: User & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                          <User className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{userName}</span>
                        </div>
                        <span className="inline-block mt-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {p.plan_type || "Visits"} Plan
                        </span>
                      </div>
                      <div>
                        {renderPlanStatusBadge(p.status)}
                      </div>
                    </div>

                    {/* Location */}
                    <div className="text-[11px] text-muted flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0 text-muted" />
                      <span className="truncate">{p.location || "No location specified"}</span>
                    </div>

                    {/* Visits Summary */}
                    {visitsCount > 0 && (
                      <div className="rounded-lg border border-border/70 bg-card p-2 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
                          <div className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                            <Building2 className="h-3.5 w-3.5" />
                            <span>Field Visits ({visitsCount})</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {p.visits?.slice(0, 3).map((v, vIdx) => {
                            const pName =
                              v.party_name ||
                              (typeof v.party === "object" ? (v.party as any)?.party_name : undefined) ||
                              `Visit #${vIdx + 1}`;
                            return (
                              <div
                                key={v._id || v.id || vIdx}
                                className="flex items-center justify-between text-[10px] text-muted gap-1 font-medium truncate"
                              >
                                <span className="truncate text-foreground">• {pName}</span>
                                <span className="shrink-0">{renderVisitStatusBadge(v.status)}</span>
                              </div>
                            );
                          })}
                          {visitsCount > 3 && (
                            <div className="text-[10px] text-muted font-semibold pl-2">
                              +{visitsCount - 3} more visit(s)
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Work Tasks Summary */}
                    {worksCount > 0 && (
                      <div className="rounded-lg border border-border/70 bg-card p-2 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
                          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <Briefcase className="h-3.5 w-3.5" />
                            <span>Work Tasks ({worksCount})</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {p.works?.slice(0, 3).map((w, wIdx) => {
                            return (
                              <div
                                key={w._id || w.id || wIdx}
                                className="flex items-center justify-between text-[10px] text-muted gap-1 font-medium truncate"
                              >
                                <span className="truncate text-foreground">• {w.title}</span>
                                <span className="shrink-0">{renderWorkStatusBadge(w.status)}</span>
                              </div>
                            );
                          })}
                          {worksCount > 3 && (
                            <div className="text-[10px] text-muted font-semibold pl-2">
                              +{worksCount - 3} more task(s)
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Remarks if any */}
                    {p.remarks && (
                      <p className="text-[11px] text-muted italic line-clamp-2">
                        "{p.remarks}"
                      </p>
                    )}

                    {/* Discussed with Manager tag */}
                    {p.is_discussed_with_manager && (
                      <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <span>✓ Discussed with Manager</span>
                        {p.discussed_manager_name && <span>({p.discussed_manager_name})</span>}
                      </div>
                    )}

                    {/* Bottom Link Action */}
                    <div className="border-t border-border pt-2 flex items-center justify-end">
                      <Link
                        href={`/dashboard/plans/${id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
                      >
                        <span>Open Work Plan</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkPlanCalendarPage;
