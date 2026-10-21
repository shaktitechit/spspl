"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarDays,
  LayoutGrid,
  List,
  Search,
  RefreshCw,
  Clock,
  User,
  Users,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ArrowRight,
  Filter,
} from "lucide-react";
import {
  useGetSeniorRemarksFeedQuery,
  useGetMyTeamQuery,
} from "@/store/api/workPlannerApiSlice";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import {
  isWpAdmin,
  isWpManager,
  isWpCoordinator,
  isWpElevated,
  hasWorkPlannerPortalAccess,
  readSessionFromStorage,
} from "@/utils/authStorage";
import type { SeniorRemarkFeedItem, AuthorityRemarkType, AuthorityRemarkStatus } from "@/types/workPlanner";
import { formatPlanDate, formatDateTime } from "./workPlanUtils";
import { DirectiveThreadModal } from "./DirectiveThreadModal";

type ViewMode = "calendar" | "kanban" | "list";

export function SeniorRemarksPage() {
  const searchParams = useSearchParams();
  const sessionUser = readSessionFromStorage()?.user;
  const currentUserId = String(sessionUser?._id || (sessionUser as any)?.id || "");

  const adminRole = isWpAdmin(sessionUser);
  const managerRole = isWpManager(sessionUser);
  const coordinatorRole = isWpCoordinator(sessionUser);
  const elevatedRole = adminRole || managerRole || coordinatorRole;

  // View Mode
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");

  // Filters
  const [scope, setScope] = useState<"mine" | "team" | "all">(
    adminRole ? "all" : elevatedRole ? "team" : "mine"
  );
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedExecutive, setSelectedExecutive] = useState<string>("all");
  const [selectedSenior, setSelectedSenior] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Calendar State
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [calendarViewMode, setCalendarViewMode] = useState<"month" | "week">("month");

  // Thread Modal State
  const [selectedThreadItem, setSelectedThreadItem] = useState<SeniorRemarkFeedItem | null>(null);

  // User Roster Queries
  const { data: usersData } = useGetUsersQuery(undefined, { skip: !adminRole });
  const { data: myTeamData } = useGetMyTeamQuery(undefined, {
    skip: adminRole || (!managerRole && !coordinatorRole),
  });

  // Query Senior Remarks Feed
  const queryParams = useMemo(() => {
    const p: Record<string, any> = {};
    if (scope) {
      p.scope = scope;
      p.ownership = scope;
    }
    if (typeFilter !== "all") p.remark_type = typeFilter;
    if (statusFilter !== "all") p.status = statusFilter;
    if (priorityFilter !== "all") p.priority = priorityFilter;
    if (selectedExecutive !== "all") p.sales_user = selectedExecutive;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    if (searchQuery.trim()) p.search = searchQuery.trim();
    return p;
  }, [scope, typeFilter, statusFilter, priorityFilter, selectedExecutive, dateFrom, dateTo, searchQuery]);

  const { data: feedData, isLoading, isFetching, refetch } = useGetSeniorRemarksFeedQuery(queryParams);

  const items = feedData?.items || [];
  const stats = feedData?.stats || {
    total: 0,
    appreciation_count: 0,
    objection_count: 0,
    instruction_count: 0,
    pending_response_count: 0,
    responded_count: 0,
    resolved_count: 0,
  };

  // Senior Authority options for filter dropdown
  const seniorOptions = useMemo(() => {
    const list: { id: string; name: string; role?: string }[] = [];
    const seen = new Set<string>();
    items.forEach((item) => {
      if (item.senior_user?.name) {
        const key = item.senior_user._id || item.senior_user.name;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            id: key,
            name: item.senior_user.name,
            role: item.senior_user.role,
          });
        }
      }
    });
    return list;
  }, [items]);

  // Executive (Concerned User) options for filter dropdown
  const executiveOptions = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const seen = new Set<string>();

    const addExec = (id?: string, name?: string) => {
      if (!id || !name || seen.has(id)) return;
      seen.add(id);
      list.push({ id, name });
    };

    if (Array.isArray(usersData)) {
      usersData.filter(hasWorkPlannerPortalAccess).forEach((u: any) => addExec(u._id || u.id, u.name));
    }
    if (Array.isArray(myTeamData?.members)) {
      myTeamData.members.forEach((u: any) => addExec(u._id || u.id, u.name));
    }
    // Also include sales users present in feed items
    items.forEach((item) => {
      if (item.sales_user?.name) {
        addExec(item.sales_user._id, item.sales_user.name);
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [usersData, myTeamData, items]);

  // Filter items by selected senior authority
  const displayItems = useMemo(() => {
    if (selectedSenior === "all") return items;
    return items.filter(
      (item) => item.senior_user._id === selectedSenior || item.senior_user.name === selectedSenior
    );
  }, [items, selectedSenior]);

  // Calendar Calculations
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  const monthName = calendarDate.toLocaleString("default", { month: "long" });

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayIndex = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();

    const days: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: d, isCurrentMonth: false, key });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: d, isCurrentMonth: true, key });
    }

    // Next month padding to complete 35 or 42 grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: d, isCurrentMonth: false, key });
    }

    return days;
  }, [year, month]);

  // Items mapped by Date key (YYYY-MM-DD) using displayItems
  const itemsByDate = useMemo(() => {
    const map = new Map<string, SeniorRemarkFeedItem[]>();
    for (const item of displayItems) {
      // Prioritize plan_date or fallback to created_at
      const d = item.plan_date
        ? String(item.plan_date).slice(0, 10)
        : String(item.created_at).slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(item);
    }
    return map;
  }, [displayItems]);

  // Kanban Columns
  const pendingItems = useMemo(
    () => displayItems.filter((i) => i.status === "pending_response"),
    [displayItems]
  );
  const respondedItems = useMemo(
    () => displayItems.filter((i) => i.status === "responded"),
    [displayItems]
  );
  const resolvedItems = useMemo(
    () => displayItems.filter((i) => i.status === "resolved"),
    [displayItems]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Directives &amp; Follow-up Tracker
            </h1>
            <span className="rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-xs font-bold text-primary">
              Closed-Loop Tracking
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Supervisory instructions, objections, appreciations &amp; executive follow-up responses
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border bg-card p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === "calendar"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              <span>Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <List className="h-4 w-4" />
              <span>Table</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="rounded-xl border border-border bg-card p-2 text-muted hover:text-foreground transition cursor-pointer shadow-xs"
            title="Refresh Directives"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total Directives */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">Total Directives</span>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-black text-foreground">{stats.total}</div>
          <div className="text-[10px] text-muted mt-0.5">Recorded across portal</div>
        </div>

        {/* ⭐ Appreciations */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              ⭐ Appreciations
            </span>
            <Sparkles className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.appreciation_count}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
            Exemplary performances
          </div>
        </div>

        {/* ⚠️ Objections */}
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              ⚠️ Active Objections
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">
            {stats.objection_count}
          </div>
          <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
            {stats.objection_count === 0 ? "All objections resolved" : "Requires clarification"}
          </div>
        </div>

        {/* ⏳ Pending Junior Responses */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              ⏳ Awaiting Reply
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {stats.pending_response_count}
          </div>
          <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
            Pending junior response
          </div>
        </div>

        {/* ✅ Resolved */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">✅ Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-foreground">
            {stats.resolved_count}
          </div>
          <div className="text-[10px] text-muted mt-0.5">
            {stats.total > 0
              ? `${Math.round((stats.resolved_count / stats.total) * 100)}% resolution rate`
              : "0% resolution rate"}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
        {/* Intent Pills & Quick Toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 sm:flex-wrap">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
                typeFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-surface-muted text-muted hover:text-foreground"
              }`}
            >
              All Directives ({stats.total})
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter("objection")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
                typeFilter === "objection"
                  ? "bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30"
                  : "bg-surface-muted border-border text-muted hover:text-foreground"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
              <span>⚠️ Active Objections ({stats.objection_count})</span>
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter("appreciation")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
                typeFilter === "appreciation"
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30"
                  : "bg-surface-muted border-border text-muted hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              <span>⭐ Appreciations ({stats.appreciation_count})</span>
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter("instruction")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
                typeFilter === "instruction"
                  ? "bg-primary/15 border-primary/40 text-primary ring-1 ring-primary/30"
                  : "bg-surface-muted border-border text-muted hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>📋 Guidance ({stats.instruction_count})</span>
            </button>
          </div>

          {/* Scope Filter */}
          {elevatedRole && (
            <div className="flex rounded-lg border border-border bg-surface-muted p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setScope("mine")}
                className={`rounded-md px-2.5 py-1 font-semibold transition cursor-pointer ${
                  scope === "mine" ? "bg-card text-foreground shadow-xs" : "text-muted"
                }`}
              >
                My Directives
              </button>
              <button
                type="button"
                onClick={() => setScope("team")}
                className={`rounded-md px-2.5 py-1 font-semibold transition cursor-pointer ${
                  scope === "team" ? "bg-card text-foreground shadow-xs" : "text-muted"
                }`}
              >
                Team Directives
              </button>
              {adminRole && (
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`rounded-md px-2.5 py-1 font-semibold transition cursor-pointer ${
                    scope === "all" ? "bg-card text-foreground shadow-xs" : "text-muted"
                  }`}
                >
                  All Portal
                </button>
              )}
            </div>
          )}
        </div>

        {/* Secondary Inputs: Search, Status, Priority, Senior Authority, Executive */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${elevatedRole ? "md:grid-cols-5" : "md:grid-cols-4"} gap-3 text-xs`}>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search directive, remark..."
              className="w-full rounded-xl border border-border bg-surface-muted pl-8 pr-3 py-2 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
            >
              <option value="all">Status: All Lifecycle</option>
              <option value="pending_response">⏳ Pending Response</option>
              <option value="responded">💬 Responded / In Review</option>
              <option value="resolved">✅ Resolved / Closed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
            >
              <option value="all">Priority: All</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="medium">🔵 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
          </div>

          {/* Senior Authority (Raised By) Filter */}
          <div>
            <select
              value={selectedSenior}
              onChange={(e) => setSelectedSenior(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
            >
              <option value="all">Raised By: All Senior Authorities</option>
              {seniorOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name} {opt.role ? `(${opt.role})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Executive Filter (Elevated Manager / Admin view) */}
          {elevatedRole && (
            <div>
              <select
                value={selectedExecutive}
                onChange={(e) => setSelectedExecutive(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
              >
                <option value="all">Executive: All Team Members</option>
                {executiveOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. CALENDAR VIEW */}
      {/* ========================================================================= */}
      {viewMode === "calendar" && (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          {/* Calendar Header Navigation */}
          <div className="flex items-center justify-between border-b border-border bg-surface-muted/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarDate(new Date(year, month - 1, 1))
                  }
                  className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarDate(new Date(year, month + 1, 1))
                  }
                  className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <h2 className="text-base font-bold text-foreground">
                {monthName} {year}
              </h2>

              <button
                type="button"
                onClick={() => setCalendarDate(new Date())}
                className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted hover:text-foreground transition"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Objection
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Appreciation
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Directive
              </span>
            </div>
          </div>

          {/* Calendar Weekday Names */}
          <div className="grid grid-cols-7 border-b border-border bg-surface-muted text-center text-xs font-bold text-muted py-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Grid Days */}
          <div className="grid grid-cols-7 divide-x divide-y divide-border">
            {calendarDays.map((dayObj) => {
              const dateKey = dayObj.key;
              const dayItems = itemsByDate.get(dateKey) || [];
              const isToday =
                new Date().toISOString().slice(0, 10) === dateKey;

              return (
                <div
                  key={dateKey}
                  className={`min-h-[110px] p-2 flex flex-col justify-between transition ${
                    !dayObj.isCurrentMonth
                      ? "bg-surface-muted/20 opacity-40"
                      : isToday
                      ? "bg-primary/5"
                      : "bg-card hover:bg-surface-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center ${
                        isToday
                          ? "bg-primary text-primary-foreground font-extrabold"
                          : "text-foreground"
                      }`}
                    >
                      {dayObj.date.getDate()}
                    </span>

                    {dayItems.length > 0 && (
                      <span className="text-[10px] font-bold text-muted">
                        {dayItems.length}
                      </span>
                    )}
                  </div>

                  {/* Day Events */}
                  <div className="flex-1 space-y-1 overflow-y-auto max-h-[80px]">
                    {dayItems.map((item) => {
                      const isObj = item.remark_type === "objection";
                      const isApp = item.remark_type === "appreciation";
                      const isOwnDirective = !elevatedRole || scope === "mine";

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedThreadItem(item)}
                          className={`w-full text-left rounded-md px-1.5 py-1 text-[10px] font-bold truncate transition cursor-pointer border flex items-center gap-1 ${
                            isObj
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/25"
                              : isApp
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                              : "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25"
                          }`}
                          title={`Directive from ${item.senior_user.name} (${item.senior_user.role || "Senior"}): ${item.title}`}
                        >
                          {isObj ? (
                            <AlertTriangle className="h-3 w-3 shrink-0 text-rose-500" />
                          ) : isApp ? (
                            <Sparkles className="h-3 w-3 shrink-0 text-emerald-500" />
                          ) : (
                            <ShieldCheck className="h-3 w-3 shrink-0 text-primary" />
                          )}
                          <span className="truncate">
                            {isOwnDirective ? `By: ${item.senior_user.name}` : `${item.sales_user.name} (by ${item.senior_user.name})`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. KANBAN BOARD VIEW */}
      {/* ========================================================================= */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Column 1: Pending Response */}
          <div className="rounded-2xl border border-amber-500/30 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <h3 className="text-xs font-bold text-foreground">
                  1. Awaiting Junior Reply
                </h3>
              </div>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-600">
                {pendingItems.length}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
              {pendingItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                  No directives awaiting junior response.
                </div>
              ) : (
                pendingItems.map((item) => (
                  <DirectiveKanbanCard
                    key={item.id}
                    item={item}
                    onClick={() => setSelectedThreadItem(item)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 2: Responded / In Review */}
          <div className="rounded-2xl border border-sky-500/30 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-sky-500" />
                <h3 className="text-xs font-bold text-foreground">
                  2. Responded / In Review
                </h3>
              </div>
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-bold text-sky-600">
                {respondedItems.length}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
              {respondedItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                  No items under review.
                </div>
              ) : (
                respondedItems.map((item) => (
                  <DirectiveKanbanCard
                    key={item.id}
                    item={item}
                    onClick={() => setSelectedThreadItem(item)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 3: Resolved & Closed */}
          <div className="rounded-2xl border border-emerald-500/30 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-foreground">
                  3. Resolved &amp; Closed
                </h3>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-600">
                {resolvedItems.length}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
              {resolvedItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                  No resolved directives yet.
                </div>
              ) : (
                resolvedItems.map((item) => (
                  <DirectiveKanbanCard
                    key={item.id}
                    item={item}
                    onClick={() => setSelectedThreadItem(item)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DATA TABLE / MOBILE LIST VIEW */}
      {/* ========================================================================= */}
      {viewMode === "list" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          {/* Mobile Card List (< md) */}
          <div className="md:hidden divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted">
                Loading directives feed…
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">
                No directives matching current filters.
              </div>
            ) : (
              items.map((item) => {
                const isObj = item.remark_type === "objection";
                const isApp = item.remark_type === "appreciation";

                return (
                  <div key={item.id} className="p-4 space-y-3 hover:bg-surface-muted/30 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                            isObj
                              ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
                              : isApp
                              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                              : "bg-primary/15 border-primary/30 text-primary"
                          }`}
                        >
                          {isObj ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : isApp ? (
                            <Sparkles className="h-3 w-3" />
                          ) : (
                            <ShieldCheck className="h-3 w-3" />
                          )}
                          <span>
                            {isObj ? "Objection" : isApp ? "Appreciation" : "Directive"}
                          </span>
                        </span>

                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                            item.priority === "urgent"
                              ? "bg-rose-500/15 text-rose-600"
                              : item.priority === "high"
                              ? "bg-amber-500/15 text-amber-600"
                              : "bg-surface-muted text-muted"
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                          item.status === "resolved"
                            ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                            : item.status === "responded"
                            ? "bg-sky-500/15 text-sky-600 border-sky-500/30"
                            : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                        }`}
                      >
                        {item.status === "resolved"
                          ? "✅ Resolved"
                          : item.status === "responded"
                          ? "💬 Responded"
                          : "⏳ Awaiting Reply"}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-foreground leading-snug">
                        {item.title}
                      </h4>
                      <div className="text-[11px] text-muted flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 font-bold rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-primary">
                          <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
                          <span>Raised by: {item.senior_user.name}</span>
                          {item.senior_user.role && <span className="opacity-75 font-normal">({item.senior_user.role})</span>}
                        </span>
                        {elevatedRole && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-foreground">For: {item.sales_user.name}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{formatPlanDate(item.plan_date || item.created_at)}</span>
                      </div>
                    </div>

                    {item.expected_followup_date && (
                      <div className="text-[11px] text-rose-500 flex items-center gap-1 font-bold">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Follow-up Due: {formatPlanDate(item.expected_followup_date)}</span>
                      </div>
                    )}

                    <div
                      className="text-xs text-muted line-clamp-3 bg-surface-muted/50 rounded-lg p-2.5 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: item.remark }}
                    />

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[11px] text-muted flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        <span>{item.followup_remarks.length} discussion replies</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedThreadItem(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover transition"
                      >
                        <span>Open Thread</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-muted font-semibold text-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type &amp; Priority</th>
                  <th className="px-4 py-3">Raised By (Senior)</th>
                  {elevatedRole && <th className="px-4 py-3">Concerned Executive</th>}
                  <th className="px-4 py-3">Target Details</th>
                  <th className="px-4 py-3">Senior Directive</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {isLoading ? (
                  <tr>
                    <td colSpan={elevatedRole ? 8 : 7} className="p-8 text-center text-muted">
                      Loading directives feed…
                    </td>
                  </tr>
                ) : displayItems.length === 0 ? (
                  <tr>
                    <td colSpan={elevatedRole ? 8 : 7} className="p-8 text-center text-muted">
                      No directives matching current filters.
                    </td>
                  </tr>
                ) : (
                  displayItems.map((item) => {
                    const isObj = item.remark_type === "objection";
                    const isApp = item.remark_type === "appreciation";

                    return (
                      <tr key={item.id} className="hover:bg-surface-muted/50 transition">
                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap font-medium">
                          <div>{formatPlanDate(item.plan_date || item.created_at)}</div>
                          {item.expected_followup_date && (
                            <div className="text-[10px] text-rose-500 flex items-center gap-1 mt-0.5 font-bold">
                              <Clock className="h-3 w-3" />
                              <span>Due: {formatPlanDate(item.expected_followup_date)}</span>
                            </div>
                          )}
                        </td>

                        {/* Type & Priority */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                                isObj
                                  ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
                                  : isApp
                                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                  : "bg-primary/15 border-primary/30 text-primary"
                              }`}
                            >
                              {isObj ? (
                                <AlertTriangle className="h-3 w-3" />
                              ) : isApp ? (
                                <Sparkles className="h-3 w-3" />
                              ) : (
                                <ShieldCheck className="h-3 w-3" />
                              )}
                              <span>
                                {isObj
                                  ? "Objection"
                                  : isApp
                                  ? "Appreciation"
                                  : "Directive"}
                              </span>
                            </span>

                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                                item.priority === "urgent"
                                  ? "bg-rose-500/15 text-rose-600"
                                  : item.priority === "high"
                                  ? "bg-amber-500/15 text-amber-600"
                                  : "bg-surface-muted text-muted"
                              }`}
                            >
                              {item.priority}
                            </span>
                          </div>
                        </td>

                        {/* Raised By (Senior Authority) */}
                        <td className="px-4 py-3 font-semibold whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-foreground font-bold">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{item.senior_user.name}</span>
                          </div>
                          <div className="text-[10px] text-muted font-medium mt-0.5">
                            {item.senior_user.role || "Senior Authority"}
                          </div>
                        </td>

                        {/* Concerned Executive (Elevated Manager view) */}
                        {elevatedRole && (
                          <td className="px-4 py-3 font-semibold whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-foreground">
                              <User className="h-3.5 w-3.5 text-muted shrink-0" />
                              <span>{item.sales_user.name}</span>
                            </div>
                            {item.sales_user.email && (
                              <div className="text-[10px] text-muted font-normal">
                                {item.sales_user.email}
                              </div>
                            )}
                          </td>
                        )}

                        {/* Target */}
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="font-bold text-foreground truncate" title={item.title}>
                            {item.title}
                          </div>
                          <div className="text-[10px] text-muted capitalize">
                            {item.target_type === "expense"
                              ? "Expense Claim"
                              : item.target_type === "visit"
                              ? "Field Visit"
                              : item.target_type === "task"
                              ? "Work Task"
                              : "Work Plan"}
                          </div>
                        </td>

                        {/* Directive Snippet */}
                        <td className="px-4 py-3 max-w-[240px]">
                          <div
                            className="rich-text-content text-xs text-muted truncate"
                            dangerouslySetInnerHTML={{ __html: item.remark }}
                          />
                          {item.followup_remarks.length > 0 && (
                            <div className="text-[10px] text-primary flex items-center gap-1 mt-0.5 font-bold">
                              <MessageSquare className="h-3 w-3" />
                              <span>{item.followup_remarks.length} reply logged</span>
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                              item.status === "resolved"
                                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                : item.status === "responded"
                                ? "bg-sky-500/15 text-sky-600 border-sky-500/30"
                                : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                            }`}
                          >
                            {item.status === "resolved"
                              ? "✅ Resolved"
                              : item.status === "responded"
                              ? "💬 Responded"
                              : "⏳ Awaiting Reply"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedThreadItem(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
                          >
                            <span>Open Thread</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interactive Directive & Follow-up Thread Drawer/Modal */}
      {selectedThreadItem && (
        <DirectiveThreadModal
          open={Boolean(selectedThreadItem)}
          item={selectedThreadItem}
          onClose={() => setSelectedThreadItem(null)}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}

function DirectiveKanbanCard({
  item,
  onClick,
}: {
  item: SeniorRemarkFeedItem;
  onClick: () => void;
}) {
  const isObj = item.remark_type === "objection";
  const isApp = item.remark_type === "appreciation";

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-3.5 space-y-2.5 transition cursor-pointer shadow-xs hover:scale-[1.01] ${
        isObj
          ? "border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50"
          : isApp
          ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider border ${
            isObj
              ? "bg-rose-500/15 border-rose-500/30 text-rose-600"
              : isApp
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600"
              : "bg-primary/15 border-primary/30 text-primary"
          }`}
        >
          {isObj ? "⚠️ Objection" : isApp ? "⭐ Praise" : "📋 Directive"}
        </span>

        <span className="text-[10px] text-muted">
          {formatPlanDate(item.plan_date || item.created_at)}
        </span>
      </div>

      <div>
        <h4 className="text-xs font-bold text-foreground truncate">{item.title}</h4>
        
        {/* Senior Authority Badge */}
        <div className="mt-1.5 flex items-center justify-between gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2 py-1 text-[11px] text-primary font-bold">
          <span className="flex items-center gap-1 truncate">
            <ShieldCheck className="h-3 w-3 shrink-0" />
            <span className="truncate">By: {item.senior_user.name}</span>
          </span>
          {item.senior_user.role && (
            <span className="text-[9px] font-normal text-primary/80 shrink-0">
              ({item.senior_user.role})
            </span>
          )}
        </div>

        <div className="text-[10px] text-muted flex items-center gap-1 mt-1 font-medium">
          <User className="h-3 w-3 text-muted shrink-0" />
          <span>Target: <strong>{item.sales_user.name}</strong></span>
        </div>
      </div>

      <div
        className="rich-text-content text-[11px] text-muted line-clamp-2 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: item.remark }}
      />

      <div className="flex items-center justify-between border-t border-border/50 pt-2 text-[10px]">
        <div className="text-muted flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          <span>{item.followup_remarks.length} replies</span>
        </div>

        {item.expected_followup_date && (
          <div className="text-rose-500 font-bold flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Due: {formatPlanDate(item.expected_followup_date)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
