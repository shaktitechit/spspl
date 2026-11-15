"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  CalendarClock,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MessageSquare,
  MapPin,
  Tv,
  HelpCircle,
  Search,
  Filter,
  Plus,
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Building2,
  Check,
  ListFilter,
  LayoutList,
  Table as TableIcon,
  Users,
  UserPlus,
  Send,
  Loader2,
  BarChart3,
} from "lucide-react";

import {
  useGetLeadFollowUpCalendarQuery,
  useListUsersQuery,
  useRunTodaysFollowUpRemindersMutation,
  useRunOverdueFollowUpRemindersMutation,
  type LeadFollowUpRecord,
  type LeadFollowUpType,
  type LeadFollowUpStatus,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { useLeadManagerTeamScope } from "@/hooks/useLeadManagerTeamScope";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import {
  FOLLOWUP_TYPE_CONFIG,
  formatLeadDate,
  formatLeadDateTime,
  isUserInLeadManagerPortal,
  getLeadManagerPortalRole,
  getDeptLabel,
  getFollowUpSalesRepName,
  getFollowUpSalesReps,
  getFollowUpAssigneeName,
  getFollowUpCreatorName,
  getFollowUpRoleBreakdown,
  isLeadAdmin,
  isLeadManagerRole,
} from "../leadUtils";
import { CompleteFollowUpModal } from "./modals/CompleteFollowUpModal";
import { SearchableMultiSelect, type MultiSelectOption } from "./LeadFilterDrawer";
import { CalendarMonthGrid } from "../calendar/CalendarMonthGrid";
import { CalendarWeekTimeline } from "../calendar/CalendarWeekTimeline";

export type FollowUpScope = "my" | "team" | "organisation" | "global" | "manager" | "coordinator";

type Props = {
  portalHome?: string;
  scope?: FollowUpScope;
};

type DateFilterPreset = "all" | "today" | "tomorrow" | "this_week" | "overdue" | "custom";

function FollowUpTypeBadge({ type }: { type: LeadFollowUpType }) {
  const cfg = FOLLOWUP_TYPE_CONFIG[type] || { label: type, icon: "HelpCircle" };
  const getIcon = () => {
    switch (type) {
      case "call":
        return <Phone className="h-3.5 w-3.5" />;
      case "meeting":
        return <Users className="h-3.5 w-3.5" />;
      case "email":
        return <Mail className="h-3.5 w-3.5" />;
      case "whatsapp":
        return <MessageSquare className="h-3.5 w-3.5" />;
      case "visit":
        return <MapPin className="h-3.5 w-3.5" />;
      case "demo":
        return <Tv className="h-3.5 w-3.5" />;
      default:
        return <HelpCircle className="h-3.5 w-3.5" />;
    }
  };

  const getStyle = () => {
    switch (type) {
      case "call":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
      case "meeting":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800";
      case "email":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800";
      case "whatsapp":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
      case "visit":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
      case "demo":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${getStyle()}`}
    >
      {getIcon()}
      <span>{cfg.label}</span>
    </span>
  );
}

export function LeadFollowUpsPage({ portalHome = "/dashboard", scope }: Props) {
  const currentUser = useAppSelector((state) => state.auth.user);
  const { isAdmin: isRoleAdmin, isManager: isRoleManager, isCoordinator: isRoleCoord, user } = useLeadManagerRole();
  const resolvedScope: "my" | "team" | "global" = useMemo(() => {
    if (scope === "organisation" || scope === "global") return "global";
    if (scope === "team" || scope === "manager" || scope === "coordinator") return "team";
    if (scope === "my") return "my";
    if (isRoleAdmin) return "global";
    if (isRoleManager || isRoleCoord) return "team";
    return "my";
  }, [scope, isRoleAdmin, isRoleManager, isRoleCoord]);

  const isGlobalScope = resolvedScope === "global";
  const isTeamScope = resolvedScope === "team";
  const isMyScope = resolvedScope === "my";
  const isAdmin = isGlobalScope;
  const { filterByTeam, withSelfInList, teamUserIds } = useLeadManagerTeamScope();
  const canFilterRep = isGlobalScope || isTeamScope;
  const myUserId = user?._id ? String(user._id) : currentUser?._id ? String(currentUser._id) : "";

  const [datePreset, setDatePreset] = useState<DateFilterPreset>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<"team" | "mine">("team");
  const [primaryAssigneeFilter, setPrimaryAssigneeFilter] = useState<string[]>([]);
  const [secondaryAssigneeFilter, setSecondaryAssigneeFilter] = useState<string[]>([]);
  const [createdByFilter, setCreatedByFilter] = useState<string[]>([]);
  const [search, setSearch] = useState<string>("");
  const [viewMode, setViewMode] = useState<"calendar" | "week" | "agenda" | "table">("calendar");
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  const [completeTarget, setCompleteTarget] = useState<LeadFollowUpRecord | null>(null);

  const [runTodaysReminders, { isLoading: sendingToday }] =
    useRunTodaysFollowUpRemindersMutation();
  const [runOverdueReminders, { isLoading: sendingOverdue }] =
    useRunOverdueFollowUpRemindersMutation();
  const sendingReminders = sendingToday || sendingOverdue;

  async function handleSendTodaysReminders() {
    try {
      const data = await runTodaysReminders({ force: true }).unwrap();
      toast.success(
        `Today's digests sent to ${data.recipientCount} user(s) (${data.followUpCount} follow-up${data.followUpCount === 1 ? "" : "s"}).`
      );
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  }

  async function handleSendOverdueReminders() {
    try {
      const data = await runOverdueReminders({ force: true }).unwrap();
      toast.success(
        `Overdue digests sent to ${data.recipientCount} user(s) (${data.followUpCount} follow-up${data.followUpCount === 1 ? "" : "s"}).`
      );
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  }

  const { data: usersData } = useListUsersQuery(undefined, {
    skip: !canFilterRep,
  });

  const assignableUsers = useMemo(() => {
    const raw = Array.isArray(usersData)
      ? usersData
      : (usersData as { data?: Array<{ _id: string; name: string; portals?: Array<{ portal_code?: string; access_roles?: string[] }> }> })?.data || [];
    let filtered = raw.filter(isUserInLeadManagerPortal);
    if (filtered.length === 0) filtered = raw;
    if (isGlobalScope) return filtered;
    const scoped = filterByTeam(filtered);
    const selfRow = user?._id ? raw.find((u) => String(u._id) === String(user._id)) : undefined;
    return withSelfInList(scoped, selfRow);
  }, [usersData, isGlobalScope, filterByTeam, withSelfInList, user]);

  const userMultiOptions = useMemo<MultiSelectOption[]>(() => {
    return assignableUsers.map((u) => ({
      value: String(u._id),
      label: u.name,
      sublabel: [getLeadManagerPortalRole(u), (u as { department?: string }).department ? getDeptLabel((u as { department?: string }).department!) : ""]
        .filter(Boolean)
        .join(" • ") || undefined,
    }));
  }, [assignableUsers]);

  const primaryAssigneeOptions = useMemo<MultiSelectOption[]>(
    () => [
      { value: "me", label: "Assigned to Me" },
      { value: "unassigned", label: "Unassigned" },
      ...userMultiOptions,
    ],
    [userMultiOptions]
  );

  const secondaryAssigneeOptions = useMemo<MultiSelectOption[]>(
    () => [{ value: "me", label: "Assigned to Me" }, ...userMultiOptions],
    [userMultiOptions]
  );

  const createdByOptions = useMemo<MultiSelectOption[]>(
    () => [{ value: "me", label: "Created by Me" }, ...userMultiOptions],
    [userMultiOptions]
  );

  // Calculate Date bounds for query if needed
  const dateQueryParams = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const toYmd = (d: Date) => d.toISOString().split("T")[0];

    const queryScope = isMyScope
      ? "mine"
      : scopeFilter === "mine"
      ? "mine"
      : isTeamScope
      ? "team"
      : undefined;

    const baseParams: {
      entity_type?: string;
      scope?: string;
      from_date?: string;
      to_date?: string;
    } = {
      entity_type: "lead",
      scope: queryScope,
    };

    if (datePreset === "today") {
      const todayStr = toYmd(startOfToday);
      return { ...baseParams, from_date: todayStr, to_date: todayStr };
    }
    if (datePreset === "tomorrow") {
      const tomorrow = new Date(startOfToday);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomStr = toYmd(tomorrow);
      return { ...baseParams, from_date: tomStr, to_date: tomStr };
    }
    if (datePreset === "this_week") {
      const day = startOfToday.getDay(); // 0 is Sunday
      const diff = startOfToday.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(startOfToday);
      monday.setDate(diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { ...baseParams, from_date: toYmd(monday), to_date: toYmd(sunday) };
    }
    if (datePreset === "custom" && (customFrom || customTo)) {
      return {
        ...baseParams,
        from_date: customFrom || undefined,
        to_date: customTo || undefined,
      };
    }
    if (viewMode === "calendar" && datePreset === "all") {
      const y = calendarDate.getFullYear();
      const m = calendarDate.getMonth();
      const first = new Date(y, m - 1, 20).toISOString().split("T")[0];
      const last = new Date(y, m + 2, 10).toISOString().split("T")[0];
      return { ...baseParams, from_date: first, to_date: last };
    }
    if (viewMode === "week" && datePreset === "all") {
      const d = new Date(calendarDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { ...baseParams, from_date: toYmd(monday), to_date: toYmd(sunday) };
    }
    return baseParams;
  }, [
    datePreset,
    customFrom,
    customTo,
    viewMode,
    calendarDate,
    isMyScope,
    isTeamScope,
    scopeFilter,
  ]);

  const {
    data: followUps = [],
    isFetching,
    refetch,
  } = useGetLeadFollowUpCalendarQuery(dateQueryParams);

  const todayStr = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split("T")[0];
  }, []);

  // Filter follow-ups on the client for instant search & multi-field matching
  const filteredFollowUps = useMemo(() => {
    return followUps.filter((fu) => {
      if (fu.quotation) return false;
      const leadObj = typeof fu.lead === "object" && fu.lead !== null ? fu.lead : null;

      const {
        primaryAssigneeId,
        secondaryAssigneeIds,
        assigneeIds,
        creatorIds,
        isPrimary,
        isSecondary,
        isCreator,
      } = getFollowUpRoleBreakdown(fu, myUserId);

      // 1. View Scope filter: "my", "team", or "global"
      const effectiveMineOnly = isMyScope || scopeFilter === "mine";
      if (effectiveMineOnly && myUserId) {
        const isMine = isPrimary || isSecondary || isCreator;
        if (!isMine) return false;
      } else if (isTeamScope && teamUserIds && teamUserIds.size > 0) {
        const inTeam =
          assigneeIds.some((id) => teamUserIds.has(id)) ||
          creatorIds.some((id) => teamUserIds.has(id)) ||
          (myUserId ? isPrimary || isSecondary || isCreator : false);
        if (!inTeam) return false;
      }

      const resolveUserFilterIds = (vals: string[]) =>
        vals.map((v) => (v === "me" ? myUserId : v)).filter(Boolean);

      // 2. Primary Assignee multi-select filter (team & global scopes)
      if (canFilterRep && primaryAssigneeFilter.length > 0) {
        const wantsUnassigned = primaryAssigneeFilter.includes("unassigned");
        const targetIds = resolveUserFilterIds(primaryAssigneeFilter.filter((v) => v !== "unassigned"));
        const matchesPrimary =
          (wantsUnassigned && !primaryAssigneeId) ||
          (Boolean(primaryAssigneeId) && targetIds.includes(primaryAssigneeId!));
        if (!matchesPrimary) return false;
      }

      // 4. Secondary Assignees multi-select filter (team & global scopes)
      if (canFilterRep && secondaryAssigneeFilter.length > 0) {
        const targetIds = resolveUserFilterIds(secondaryAssigneeFilter);
        const matchesSecondary = secondaryAssigneeIds.some((id) => targetIds.includes(id));
        if (!matchesSecondary) return false;
      }

      // 5. Created By multi-select filter (team & global scopes)
      if (canFilterRep && createdByFilter.length > 0) {
        const targetIds = resolveUserFilterIds(createdByFilter);
        const matchesCreator = creatorIds.some((id) => targetIds.includes(id));
        if (!matchesCreator) return false;
      }

      const leadNo = leadObj?.lead_no || "";
      const leadName = leadObj?.name || "";
      const companyName = leadObj?.company_name || "";
      const phone = leadObj?.phone || "";
      const email = leadObj?.email || "";
      const notes = fu.notes || "";
      const outcome = fu.outcome || "";
      const fuDate = fu.follow_up_date ? fu.follow_up_date.split("T")[0] : "";
      const isDone = fu.status === "completed";
      const isOverdue = !isDone && fuDate < todayStr;

      // Status filter
      if (statusFilter === "pending" && isDone) return false;
      if (statusFilter === "completed" && !isDone) return false;
      if (statusFilter === "overdue" && !isOverdue) return false;

      // Type filter
      if (typeFilter !== "all" && fu.type !== typeFilter) return false;

      // Overdue preset filter
      if (datePreset === "overdue" && !isOverdue) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matches =
          leadNo.toLowerCase().includes(q) ||
          leadName.toLowerCase().includes(q) ||
          companyName.toLowerCase().includes(q) ||
          phone.toLowerCase().includes(q) ||
          email.toLowerCase().includes(q) ||
          notes.toLowerCase().includes(q) ||
          outcome.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [
    followUps,
    statusFilter,
    typeFilter,
    datePreset,
    isMyScope,
    isTeamScope,
    teamUserIds,
    canFilterRep,
    scopeFilter,
    primaryAssigneeFilter,
    secondaryAssigneeFilter,
    createdByFilter,
    search,
    todayStr,
    myUserId,
  ]);

  // Groupings for Agenda View
  const groupedAgenda = useMemo(() => {
    const overdueList: LeadFollowUpRecord[] = [];
    const todayList: LeadFollowUpRecord[] = [];
    const upcomingList: LeadFollowUpRecord[] = [];
    const completedList: LeadFollowUpRecord[] = [];

    for (const fu of filteredFollowUps) {
      const fuDate = fu.follow_up_date ? fu.follow_up_date.split("T")[0] : "";
      const isDone = fu.status === "completed";

      if (isDone) {
        completedList.push(fu);
      } else if (fuDate < todayStr) {
        overdueList.push(fu);
      } else if (fuDate === todayStr) {
        todayList.push(fu);
      } else {
        upcomingList.push(fu);
      }
    }

    // Sort overdue asc, today asc by time, upcoming asc, completed desc
    return {
      overdue: overdueList,
      today: todayList,
      upcoming: upcomingList,
      completed: completedList,
    };
  }, [filteredFollowUps, todayStr]);

  return (
    <div className="space-y-3 pb-8 font-sans">
      {/* ── HEADER ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Link
              href={`${portalHome}/leads`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Leads Directory</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="text-xs font-semibold text-primary">
              Follow-up Agenda
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {isMyScope
              ? "My Lead Follow-ups"
              : isTeamScope
              ? "Team Lead Follow-ups"
              : "Organisation Lead Follow-ups"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {isMyScope
              ? "Track your scheduled customer interactions, overdue touchpoints, and meeting outcomes."
              : isTeamScope
              ? "Monitor and manage follow-up schedules across your reporting team."
              : "Organisation-wide follow-up schedule, team execution tracking, and reminder controls."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin ? (
            <>
              <button
                type="button"
                disabled={sendingReminders}
                onClick={() => void handleSendTodaysReminders()}
                className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-800 shadow-sm transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-200 dark:hover:bg-teal-950/70"
                title="Email + notify all assignees about today's pending follow-ups"
              >
                {sendingToday ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Send today’s emails</span>
              </button>
              <button
                type="button"
                disabled={sendingReminders}
                onClick={() => void handleSendOverdueReminders()}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-800 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/70"
                title="Email + notify all assignees about overdue pending follow-ups"
              >
                {sendingOverdue ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="h-3.5 w-3.5" />
                )}
                <span>Send overdue emails</span>
              </button>
            </>
          ) : null}
          <Link
            href="/dashboard/leads/follow-ups/reports"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <BarChart3 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Follow-Up Reports</span>
          </Link>
          <Link
            href={`${portalHome}/leads/new`}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create New Lead</span>
          </Link>
        </div>
      </div>

      {/* ── VIEW SCOPE & VIEW SWITCHER STRIP ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 dark:border-white/10 pb-2">
        {canFilterRep ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">View Scope:</span>
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold border border-slate-200/80 dark:border-white/10">
              <button
                type="button"
                onClick={() => setScopeFilter("team")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  scopeFilter === "team"
                    ? "bg-white dark:bg-slate-700 text-primary shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {isGlobalScope
                  ? "Organisation Follow-ups (All Users)"
                  : "Team Follow-ups (Assigned to or Created by Team)"}
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("mine")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  scopeFilter === "mine"
                    ? "bg-white dark:bg-slate-700 text-primary shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                My Follow-ups (Assigned to Me or Created by Me)
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50">
              <UserCheck className="h-3.5 w-3.5" />
              My Follow-ups (Primary, Secondary, or Created by Me)
            </span>
          </div>
        )}

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              viewMode === "calendar"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>Month Grid</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              viewMode === "week"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            <span>Week</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("agenda")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              viewMode === "agenda"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" />
            <span>Agenda</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              viewMode === "table"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* ── FILTER & CONTROL BAR ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-slate-900 space-y-2">
        {(viewMode === "agenda" || viewMode === "table") && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: "All Follow-ups" },
                { id: "today", label: "Today" },
                { id: "tomorrow", label: "Tomorrow" },
                { id: "this_week", label: "This Week" },
                { id: "overdue", label: "Overdue Only" },
                { id: "custom", label: "Custom Range" },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDatePreset(preset.id as DateFilterPreset)}
                  className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                    datePreset === preset.id
                      ? "bg-primary text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom date range inputs */}
        {(viewMode === "agenda" || viewMode === "table") && datePreset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/5">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Custom Date:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </div>
        )}

        {/* All Filters in One Line */}
        <div
          className={`grid grid-cols-1 gap-2.5 items-end ${
            canFilterRep ? "sm:grid-cols-2 lg:grid-cols-6" : "sm:grid-cols-3"
          }`}
        >
          {/* Search */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Lead, company, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:border-white/10 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-800"
              />
            </div>
          </div>

          {/* Channel Type filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Channel
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/10 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-800"
            >
              <option value="all">All Channels</option>
              <option value="call">Phone Call</option>
              <option value="meeting">Meeting</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="demo">Product Demo</option>
              <option value="visit">Site Visit</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/10 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-800"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {canFilterRep && (
            <>
              <SearchableMultiSelect
                label="Primary Assignee"
                placeholder={isTeamScope ? "Team primary..." : "Primary..."}
                options={primaryAssigneeOptions}
                selected={primaryAssigneeFilter}
                onChange={setPrimaryAssigneeFilter}
              />
              <SearchableMultiSelect
                label="Secondary Assignees"
                placeholder={isTeamScope ? "Team secondary..." : "Secondary..."}
                options={secondaryAssigneeOptions}
                selected={secondaryAssigneeFilter}
                onChange={setSecondaryAssigneeFilter}
              />
              <SearchableMultiSelect
                label="Created By"
                placeholder={isTeamScope ? "Team creators..." : "Creators..."}
                options={createdByOptions}
                selected={createdByFilter}
                onChange={setCreatedByFilter}
              />
            </>
          )}
        </div>
      </div>

      {/* ── CONTENT AREA ── */}
      {isFetching ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CalendarClock className="h-8 w-8 animate-pulse text-blue-500 mb-2" />
          <p className="text-xs font-semibold text-slate-500">Loading follow-up schedule...</p>
        </div>
      ) : viewMode === "calendar" ? (
        <CalendarMonthGrid
          followUps={filteredFollowUps}
          currentDate={calendarDate}
          onDateChange={setCalendarDate}
          onSelectEvent={(fu) => setCompleteTarget(fu)}
          hasQuotationAccess={false}
          currentUserId={myUserId}
        />
      ) : viewMode === "week" ? (
        <CalendarWeekTimeline
          followUps={filteredFollowUps}
          currentDate={calendarDate}
          onDateChange={setCalendarDate}
          onSelectEvent={(fu) => setCompleteTarget(fu)}
          hasQuotationAccess={false}
          currentUserId={myUserId}
        />
      ) : filteredFollowUps.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500/60 dark:text-emerald-400/40 mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            No follow-ups match your current filters
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Try adjusting your search criteria or schedule a new follow-up directly from any active lead.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setDatePreset("all");
                setStatusFilter("all");
                setTypeFilter("all");
                setSearch("");
                setScopeFilter("team");
                setPrimaryAssigneeFilter([]);
                setSecondaryAssigneeFilter([]);
                setCreatedByFilter([]);
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
            >
              Reset Filters
            </button>
            <Link
              href={`${portalHome}/leads`}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-hover"
            >
              View Leads Directory
            </Link>
          </div>
        </div>
      ) : viewMode === "agenda" ? (
        /* ── AGENDA VIEW (GROUPED CARDS) ── */
        <div className="space-y-8">
          {/* 1. OVERDUE SECTION */}
          {groupedAgenda.overdue.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Overdue Follow-ups ({groupedAgenda.overdue.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {groupedAgenda.overdue.map((fu) => (
                  <FollowUpCard
                    key={fu._id || fu.id}
                    followUp={fu}
                    portalHome={portalHome}
                    currentUserId={myUserId}
                    onComplete={() => setCompleteTarget(fu)}
                    isOverdue
                  />
                ))}
              </div>
            </div>
          )}

          {/* 2. TODAY SECTION */}
          {groupedAgenda.today.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-teal-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
                  Today&apos;s Schedule ({groupedAgenda.today.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {groupedAgenda.today.map((fu) => (
                  <FollowUpCard
                    key={fu._id || fu.id}
                    followUp={fu}
                    portalHome={portalHome}
                    currentUserId={myUserId}
                    onComplete={() => setCompleteTarget(fu)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 3. UPCOMING SECTION */}
          {groupedAgenda.upcoming.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Upcoming Follow-ups ({groupedAgenda.upcoming.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {groupedAgenda.upcoming.map((fu) => (
                  <FollowUpCard
                    key={fu._id || fu.id}
                    followUp={fu}
                    portalHome={portalHome}
                    currentUserId={myUserId}
                    onComplete={() => setCompleteTarget(fu)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase text-slate-500 dark:border-white/5 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Actions</th>
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Lead &amp; Organization</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3 min-w-[180px]">Requirement Summary &amp; Scope</th>
                  <th className="px-4 py-3 min-w-[170px]">Required Products</th>
                  <th className="px-4 py-3 min-w-[200px]">Agenda / Notes</th>
                  <th className="px-4 py-3 min-w-[200px]">Last Remarks</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredFollowUps.map((fu) => {
                  const leadObj = typeof fu.lead === "object" && fu.lead !== null ? fu.lead : null;
                  const leadId = leadObj?._id || (typeof fu.lead === "string" ? fu.lead : "");
                  const leadNo = leadObj?.lead_no || "Lead";
                  const leadName = leadObj?.name || "—";
                  const companyName = leadObj?.company_name;
                  const phone = leadObj?.phone;
                  const email = leadObj?.email;
                  const repName = getFollowUpSalesRepName(fu);
                  const isDone = fu.status === "completed";
                  const fuDate = fu.follow_up_date ? fu.follow_up_date.split("T")[0] : "";
                  const isOverdue = !isDone && fuDate < todayStr;
                  const { roles } = getFollowUpRoleBreakdown(fu, myUserId);
                  const reps = getFollowUpSalesReps(fu);
                  const primaryRep = reps.find((r) => r.isPrimary);
                  const secondaryReps = reps.filter((r) => !r.isPrimary);

                  return (
                    <tr
                      key={fu._id || fu.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Actions */}
                      <td className="px-4 py-3 text-left whitespace-nowrap">
                        <div className="flex items-center justify-start gap-1.5">
                          {!isDone && (
                            <button
                              type="button"
                              onClick={() => setCompleteTarget(fu)}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-500"
                            >
                              Complete
                            </button>
                          )}
                          {leadId && (
                            <Link
                              href={`${portalHome}/leads/${leadId}`}
                              className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                              title="Open Lead"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {formatLeadDate(fu.follow_up_date)}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {fu.follow_up_time || "All day"}
                        </div>
                      </td>

                      {/* Channel Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <FollowUpTypeBadge type={fu.type} />
                          {roles.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {roles.map((r) => (
                                <span
                                  key={r}
                                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                    r === "primary"
                                      ? "bg-blue-600 text-white"
                                      : r === "secondary"
                                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200"
                                      : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                                  }`}
                                >
                                  {r === "primary" ? "Primary" : r === "secondary" ? "Secondary" : "Creator"}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Lead info */}
                      <td className="px-4 py-3">
                        {leadId ? (
                          <Link
                            href={`${portalHome}/leads/${leadId}`}
                            className="font-bold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                          >
                            {leadName}
                            {companyName && (
                              <span className="font-normal text-slate-500 dark:text-slate-400 ml-1">
                                ({companyName})
                              </span>
                            )}
                            <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                              #{leadNo}
                            </div>
                          </Link>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Phone / Email */}
                      <td className="px-4 py-3 text-[11px] whitespace-nowrap">
                        {phone && (
                          <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{phone}</span>
                          </div>
                        )}
                        {email && (
                          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span className="truncate max-w-[130px]">{email}</span>
                          </div>
                        )}
                        {!phone && !email && <span className="text-slate-400">—</span>}
                      </td>

                      {/* Assigned Rep */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          {primaryRep ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                              <UserCheck className="h-3 w-3 text-blue-500" />
                              {primaryRep.name}
                              <span className="text-[9px] uppercase font-bold opacity-75">(Primary)</span>
                            </span>
                          ) : null}
                          {secondaryReps.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                              +{secondaryReps.map((r) => r.name).join(", ")}
                            </span>
                          )}
                          {!primaryRep && secondaryReps.length === 0 && (
                            <span className="text-slate-400 text-[11px]">Unassigned</span>
                          )}
                        </div>
                      </td>

                      {/* Created By */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          <Users className="h-3 w-3 text-slate-400" />
                          {getFollowUpCreatorName(fu)}
                        </span>
                      </td>

                      {/* Requirement Summary & Scope */}
                      <td className="px-4 py-3 max-w-[220px]">
                        {leadObj?.requirement || leadObj?.notes ? (
                          <div
                            className="space-y-0.5"
                            title={[leadObj?.requirement, leadObj?.notes].filter(Boolean).join(" — ")}
                          >
                            {leadObj?.requirement && (
                              <p className="text-[11px] font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                                {leadObj.requirement}
                              </p>
                            )}
                            {leadObj?.notes && (
                              <p className="text-[10px] text-slate-400 line-clamp-1">
                                {leadObj.notes}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* Required Products */}
                      <td className="px-4 py-3 max-w-[210px]">
                        {Array.isArray(leadObj?.products) && leadObj.products.length > 0 ? (
                          <div
                            className="space-y-0.5"
                            title={leadObj.products
                              .map((p) => `${p.product_name || "Item"} (${Number(p.quantity) || 0})`)
                              .join(", ")}
                          >
                            {leadObj.products.slice(0, 3).map((p, pIdx) => (
                              <div key={pIdx} className="flex items-center justify-between gap-1.5 text-[11px]">
                                <span className="truncate text-slate-800 dark:text-slate-200 font-medium">
                                  {p.product_name || "Item"}
                                </span>
                                <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-400">
                                  ({Number(p.quantity) || 0})
                                </span>
                              </div>
                            ))}
                            {leadObj.products.length > 3 && (
                              <span className="text-[10px] text-primary font-semibold">
                                +{leadObj.products.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* Notes / Outcome */}
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                          {fu.notes || "Routine follow-up touchpoint"}
                        </p>
                        {fu.outcome && (
                          <p className="mt-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Outcome: {fu.outcome}
                          </p>
                        )}
                      </td>

                      {/* Last Remarks */}
                      <td className="px-4 py-3 max-w-[230px]">
                        {leadObj?.last_action?.remarks ? (
                          <div
                            className="space-y-0.5"
                            title={[
                              leadObj.last_action.remarks,
                              leadObj.last_action.by_user?.name
                                ? `by ${leadObj.last_action.by_user.name}`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          >
                            <p className="text-[11px] text-slate-800 dark:text-slate-200 line-clamp-2">
                              {leadObj.last_action.remarks}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-slate-400">
                              {leadObj.last_action.timestamp && (
                                <span className="font-mono">
                                  {new Date(leadObj.last_action.timestamp).toLocaleString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                              {leadObj.last_action.by_user?.name && (
                                <span className="truncate font-medium text-slate-600 dark:text-slate-300">
                                  • {leadObj.last_action.by_user.name}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Completed
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                            <AlertCircle className="h-3 w-3" />
                            Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                            <Clock className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: RECORD OUTCOME & COMPLETE ── */}
      {completeTarget && (
        <CompleteFollowUpModal
          followUp={completeTarget}
          open={!!completeTarget}
          onClose={() => setCompleteTarget(null)}
          onSuccess={() => {
            setCompleteTarget(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

/** Individual Interactive Follow-up Card for Agenda View */
function FollowUpCard({
  followUp,
  portalHome,
  currentUserId,
  onComplete,
  isOverdue = false,
}: {
  followUp: LeadFollowUpRecord;
  portalHome: string;
  currentUserId?: string;
  onComplete: () => void;
  isOverdue?: boolean;
}) {
  const leadObj = typeof followUp.lead === "object" && followUp.lead !== null ? followUp.lead : null;
  const leadId = leadObj?._id || (typeof followUp.lead === "string" ? followUp.lead : "");
  const leadNo = leadObj?.lead_no || "Lead";
  const leadName = leadObj?.name || "—";
  const companyName = leadObj?.company_name;
  const phone = leadObj?.phone;
  const email = leadObj?.email;
  const isDone = followUp.status === "completed";
  const { roles } = getFollowUpRoleBreakdown(followUp, currentUserId);
  const reps = getFollowUpSalesReps(followUp);
  const primaryRep = reps.find((r) => r.isPrimary);
  const secondaryReps = reps.filter((r) => !r.isPrimary);

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-slate-900 ${
        isOverdue
          ? "border-rose-200 dark:border-rose-900/50 bg-rose-50/20"
          : isDone
          ? "border-slate-200/80 dark:border-white/10 opacity-80 hover:opacity-100"
          : "border-slate-200/80 dark:border-white/10"
      }`}
    >
      <div className="space-y-3">
        {/* Top bar: Type + Role Badges + Date/Time + Status */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <FollowUpTypeBadge type={followUp.type} />
            {roles.map((r) => (
              <span
                key={r}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  r === "primary"
                    ? "bg-blue-600 text-white"
                    : r === "secondary"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                }`}
              >
                {r === "primary" ? "Primary" : r === "secondary" ? "Secondary" : "Creator"}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Clock className="h-3 w-3 text-slate-400" />
              <span>{formatLeadDate(followUp.follow_up_date)}</span>
              {followUp.follow_up_time && (
                <span className="text-slate-400 font-normal">· {followUp.follow_up_time}</span>
              )}
            </div>
            {isDone ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Done
              </span>
            ) : isOverdue ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                <AlertCircle className="h-2.5 w-2.5" />
                Overdue
              </span>
            ) : null}
          </div>
        </div>

        {/* Middle: Lead & Organization Info */}
        <div>
          {leadId ? (
            <Link
              href={`${portalHome}/leads/${leadId}`}
              className="group/link flex items-start justify-between gap-2"
            >
              <div>
                <h4 className="text-sm font-bold text-slate-900 group-hover/link:text-blue-600 dark:text-white dark:group-hover/link:text-blue-400">
                  {leadName}
                </h4>
                {companyName && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Building2 className="h-3 w-3 text-slate-400" />
                    <span>{companyName}</span>
                  </div>
                )}
              </div>
              <span className="shrink-0 font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                #{leadNo}
              </span>
            </Link>
          ) : (
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{leadName}</h4>
          )}
        </div>

        {/* Contact links & Assignment / Creator */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-1 font-semibold text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
            >
              <Phone className="h-3 w-3 text-slate-400" />
              <span>{phone}</span>
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-1 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
            >
              <Mail className="h-3 w-3 text-slate-400" />
              <span className="truncate max-w-[160px]">{email}</span>
            </a>
          )}
          {primaryRep ? (
            <div className="flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-300 font-semibold">
              <UserCheck className="h-3 w-3 text-blue-500" />
              <span>Primary: {primaryRep.name}</span>
            </div>
          ) : null}
          {secondaryReps.length > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
              <Users className="h-3 w-3 text-indigo-500" />
              <span>Secondary: {secondaryReps.map((r) => r.name).join(", ")}</span>
            </div>
          )}
          {!primaryRep && secondaryReps.length === 0 && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <UserCheck className="h-3 w-3 text-slate-400" />
              <span>Unassigned</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <UserPlus className="h-3 w-3 text-slate-400" />
            <span>Created by: {getFollowUpCreatorName(followUp)}</span>
          </div>
        </div>

        {/* Notes & recorded outcome */}
        <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60 text-xs">
          <p className="text-slate-700 dark:text-slate-300 line-clamp-2">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Agenda: </span>
            {followUp.notes || "Follow-up discussion and customer requirement analysis"}
          </p>
          {followUp.outcome && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-white/5 text-[11px] text-emerald-700 dark:text-emerald-300">
              <span className="font-bold">Outcome: </span>
              {followUp.outcome}
            </div>
          )}
        </div>
      </div>

      {/* Footer action bar */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/10">
        {leadId ? (
          <Link
            href={`${portalHome}/leads/${leadId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
          >
            <span>View Lead Profile</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <div />
        )}

        {!isDone ? (
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 transition"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Complete & Record Outcome</span>
          </button>
        ) : (
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Check className="h-3 w-3" />
            Completed at {formatLeadDateTime(followUp.completed_at || followUp.updatedAt)}
          </span>
        )}
      </div>
    </div>
  );
}
