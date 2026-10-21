"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  Briefcase,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Plus,
  ExternalLink,
  Clock,
  UserCheck,
  MapPin,
  CheckSquare,
  FileText,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Users,
  User,
  ShieldCheck,
  Phone,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetPlansQuery,
  useLazyGetPlansQuery,
  useGetMyTeamQuery,
} from "@/store/api/workPlannerApiSlice";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import {
  isWpAdmin,
  isWpManager,
  isWpElevated,
  hasWorkPlannerPortalAccess,
  readSessionFromStorage,
} from "@/utils/authStorage";
import type {
  WorkPlanRecord,
  WorkPlanVisitRecord,
  WorkPlanWorkRecord,
} from "@/types/workPlanner";
import {
  formatPlanDate,
  formatTime,
  salesUserLabel,
  renderVisitStatusBadge,
  renderWorkStatusBadge,
  planIdOf,
} from "./workPlanUtils";
import { DownloadTasksVisitsReportModal } from "./DownloadTasksVisitsReportModal";
import { SeniorRemarksModal } from "./SeniorRemarksModal";

export interface DisplayTaskVisitItem {
  id: string;
  planId: string;
  planDate: string;
  planStatus: string;
  itemType: "visit" | "task";
  salesUserId: string;
  executiveName: string;
  executiveEmail: string;
  titleOrParty: string;
  contactPerson: string;
  contactNumber: string;
  locationOrAddress: string;
  descriptionOrNotes: string;
  plannedTime: string;
  status: string;
  raw: WorkPlanVisitRecord | WorkPlanWorkRecord;
  parentPlan: WorkPlanRecord;
}

type OwnershipScope = "mine" | "team";
type ViewMode = "list" | "visits_calendar" | "tasks_calendar";

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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function toYmd(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

export function TasksVisitsPage() {
  const searchParams = useSearchParams();
  const user = readSessionFromStorage()?.user;
  const adminRole = isWpAdmin(user);
  const managerRole = isWpManager(user);
  const elevatedRole = isWpElevated(user);
  const currentUserId = String(user?._id || (user as any)?.id || "");

  // View Mode: "list" | "visits_calendar" | "tasks_calendar"
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Calendar States
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedYmd, setSelectedYmd] = useState<string | null>(() => toYmd(new Date()));

  // Executive selector for scoping
  const [selectedExecutiveFilter, setSelectedExecutiveFilter] = useState<string>("all");

  // Filter States
  const initialSearch = searchParams.get("search") || searchParams.get("q") || "";
  const initialScope = (searchParams.get("scope") === "team" ? "team" : "mine") as OwnershipScope;
  const [ownershipScope, setOwnershipScope] = useState<OwnershipScope>(
    elevatedRole ? initialScope : "mine"
  );
  const [categoryFilter, setCategoryFilter] = useState<"all" | "visits" | "tasks">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 20;

  // Report Modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Action targets for remarks modal
  const [seniorRemarksTarget, setSeniorRemarksTarget] = useState<DisplayTaskVisitItem | null>(null);

  // User Roster and Team queries
  const { data: usersData } = useGetUsersQuery(undefined, { skip: !adminRole });
  const { data: myTeamData } = useGetMyTeamQuery(undefined, { skip: adminRole || !managerRole });

  // Lazy queries
  const [lazyGetPlans] = useLazyGetPlansQuery();

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

  // Allowed Executives for planning:
  // - Admin: all portal members with work_planner access
  // - Manager: himself + executives reporting to him
  // - Executive: himself only
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

    if (adminRole) {
      return allUsers.filter((u) => hasWorkPlannerAccess(u, user?._id));
    }

    // Manager role: himself + executives reporting to him
    const myTeamMembers = (myTeamData?.members || []) as Array<{ _id?: string; id?: string }>;
    const teamIdSet = new Set<string>(
      myTeamMembers.map((m) => String(m._id || m.id || ""))
    );
    if (user?._id) {
      teamIdSet.add(String(user._id));
    }
    return allUsers.filter((u) => teamIdSet.has(String(u._id || u.id || "")));
  }, [allUsers, user, adminRole, elevatedRole, myTeamData]);

  const monthFromYmd = useMemo(() => toYmd(startOfMonth(currentMonth)), [currentMonth]);
  const monthToYmd = useMemo(() => toYmd(endOfMonth(currentMonth)), [currentMonth]);

  const queryParams = useMemo(() => {
    const q: Record<string, string | number | boolean | undefined> = {
      page: 1,
      limit: 250,
      include_visits: true,
      include_works: true,
    };
    if (viewMode === "list") {
      if (dateFrom) q.from = dateFrom;
      if (dateTo) q.to = dateTo;
    } else {
      q.from = monthFromYmd;
      q.to = monthToYmd;
    }
    if (elevatedRole) {
      q.scope = ownershipScope;
    }
    if (selectedExecutiveFilter && selectedExecutiveFilter !== "all") {
      q.sales_user = selectedExecutiveFilter;
    }
    return q;
  }, [
    viewMode,
    dateFrom,
    dateTo,
    monthFromYmd,
    monthToYmd,
    elevatedRole,
    ownershipScope,
    selectedExecutiveFilter,
  ]);

  const { data: plansRes, isLoading: loading, refetch: loadData } = useGetPlansQuery(queryParams);

  const plans = plansRes?.data || [];

  // Flatten all visits and works from fetched work plans
  const allItems = useMemo<DisplayTaskVisitItem[]>(() => {
    const list: DisplayTaskVisitItem[] = [];

    for (const p of plans) {
      const pId = planIdOf(p);
      const pDate = p.plan_date || "";
      const pStatus = p.status || "planned";
      const planSalesUserId =
        typeof p.sales_user === "object"
          ? p.sales_user?._id || p.sales_user?.id || ""
          : String(p.sales_user || "");
      const execName = salesUserLabel(p.sales_user);
      const execEmail = typeof p.sales_user === "object" ? p.sales_user?.email || "" : "";

      // Flatten Visits
      if (Array.isArray(p.visits)) {
        for (const v of p.visits) {
          const vId = v._id || v.id || `visit-${list.length}`;
          const visitSalesUserObj =
            typeof v.sales_user === "object" && v.sales_user ? v.sales_user : p.sales_user;
          const sUserId =
            typeof v.sales_user === "object" && v.sales_user
              ? v.sales_user._id || v.sales_user.id || planSalesUserId
              : String(v.sales_user || planSalesUserId || "");
          const visitExecName =
            typeof v.sales_user === "object" && v.sales_user
              ? salesUserLabel(v.sales_user)
              : execName;
          const visitExecEmail =
            typeof v.sales_user === "object" && v.sales_user
              ? v.sales_user?.email || ""
              : execEmail;

          // Scope / Executive Filter check
          if (elevatedRole) {
            if (ownershipScope === "mine") {
              const currentUid = String(user?._id || "");
              if (sUserId && sUserId !== currentUid) continue;
            } else if (ownershipScope === "team" && selectedExecutiveFilter !== "all") {
              if (sUserId && sUserId !== String(selectedExecutiveFilter)) continue;
            }
          }

          const visitContacts = Array.isArray(v.contacts) && v.contacts.length > 0
            ? v.contacts
            : (v.contact_person || v.contact_number || v.phone || v.contact_email)
              ? [
                  {
                    contact_person: v.contact_person,
                    contact_number: v.contact_number || v.phone,
                    contact_email: v.contact_email,
                  },
                ]
              : [];

          const contactPersonStr = visitContacts.length > 0
            ? visitContacts.map((c) => c.contact_person).filter(Boolean).join(", ") || ""
            : v.contact_person || "";

          const contactNumberStr = visitContacts.length > 0
            ? visitContacts.map((c) => c.contact_number).filter(Boolean).join(", ") || ""
            : v.contact_number || v.phone || "";

          list.push({
            id: vId,
            planId: pId,
            planDate: v.plan_date || pDate,
            planStatus: pStatus,
            itemType: "visit",
            salesUserId: sUserId,
            executiveName: visitExecName,
            executiveEmail: visitExecEmail,
            titleOrParty:
              v.party_name ||
              (typeof v.party === "object" ? (v.party as any)?.party_name : undefined) ||
              "Field Visit",
            contactPerson: contactPersonStr,
            contactNumber: contactNumberStr,
            locationOrAddress: v.address || p.location || "",
            descriptionOrNotes: v.purpose || v.notes || "",
            plannedTime: formatTime(v.planned_start_time),
            status: v.status || "created",
            raw: v,
            parentPlan: p,
          });
        }
      }

      // Flatten Work Tasks
      if (Array.isArray(p.works)) {
        for (const w of p.works) {
          const wId = w._id || w.id || `work-${list.length}`;
          const workSalesUserObj =
            typeof w.sales_user === "object" && w.sales_user ? w.sales_user : p.sales_user;
          const sUserId =
            typeof w.sales_user === "object" && w.sales_user
              ? w.sales_user._id || w.sales_user.id || planSalesUserId
              : String(w.sales_user || planSalesUserId || "");
          const workExecName =
            typeof w.sales_user === "object" && w.sales_user
              ? salesUserLabel(w.sales_user)
              : execName;
          const workExecEmail =
            typeof w.sales_user === "object" && w.sales_user
              ? w.sales_user?.email || ""
              : execEmail;

          // Scope / Executive Filter check
          if (elevatedRole) {
            if (ownershipScope === "mine") {
              const currentUid = String(user?._id || "");
              if (sUserId && sUserId !== currentUid) continue;
            } else if (ownershipScope === "team" && selectedExecutiveFilter !== "all") {
              if (sUserId && sUserId !== String(selectedExecutiveFilter)) continue;
            }
          }

          list.push({
            id: wId,
            planId: pId,
            planDate: w.plan_date || pDate,
            planStatus: pStatus,
            itemType: "task",
            salesUserId: sUserId,
            executiveName: workExecName,
            executiveEmail: workExecEmail,
            titleOrParty: w.title || "Work Task",
            contactPerson: "",
            contactNumber: "",
            locationOrAddress: p.location || "Office / Remote",
            descriptionOrNotes: w.description || "",
            plannedTime: formatTime(w.planned_start_time),
            status: w.status || "created",
            raw: w,
            parentPlan: p,
          });
        }
      }
    }

    return list;
  }, [plans, elevatedRole, ownershipScope, selectedExecutiveFilter, user]);

  // Visits & Tasks grouped by Day (YYYY-MM-DD)
  const visitsByDay = useMemo(() => {
    const map = new Map<string, DisplayTaskVisitItem[]>();
    for (const item of allItems) {
      if (item.itemType !== "visit") continue;
      const ymd = toYmd(item.planDate);
      if (!ymd) continue;
      if (!map.has(ymd)) map.set(ymd, []);
      map.get(ymd)!.push(item);
    }
    return map;
  }, [allItems]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, DisplayTaskVisitItem[]>();
    for (const item of allItems) {
      if (item.itemType !== "task") continue;
      const ymd = toYmd(item.planDate);
      if (!ymd) continue;
      if (!map.has(ymd)) map.set(ymd, []);
      map.get(ymd)!.push(item);
    }
    return map;
  }, [allItems]);

  // Month navigation helpers
  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }, [currentMonth]);

  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const monthCells = useMemo(() => buildMonthCells(currentMonth), [currentMonth]);

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

  // Selected Day items in Planner views
  const selectedDayVisits = useMemo(() => {
    if (!selectedYmd) return [];
    return visitsByDay.get(selectedYmd) || [];
  }, [selectedYmd, visitsByDay]);

  const selectedDayTasks = useMemo(() => {
    if (!selectedYmd) return [];
    return tasksByDay.get(selectedYmd) || [];
  }, [selectedYmd, tasksByDay]);

  // Apply filters for List View
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (categoryFilter === "visits" && item.itemType !== "visit") return false;
      if (categoryFilter === "tasks" && item.itemType !== "task") return false;

      if (statusFilter !== "all") {
        if (
          statusFilter === "in_progress" &&
          (item.status === "in_progress" || item.status === "checked_in")
        ) {
          // match
        } else if (String(item.status).toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const text = `${item.titleOrParty} ${item.executiveName} ${item.contactPerson} ${item.locationOrAddress} ${item.descriptionOrNotes} ${item.status}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [allItems, categoryFilter, statusFilter, searchQuery]);

  // Paginated rows for List View
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const STATUS_TABS = [
    { id: "all", label: "All Statuses" },
    { id: "created", label: "Created" },
    { id: "pending", label: "Pending" },
    { id: "in_progress", label: "In Progress" },
    { id: "completed", label: "Completed" },
  ];

  return (
    <div className="space-y-3.5 sm:space-y-4 font-sans w-full max-w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3.5 sm:p-4 rounded-2xl border border-border shadow-2xs">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">
            Tasks &amp; Field Visits Management
          </h1>
          <p className="text-[11px] sm:text-xs text-muted">
            {adminRole
              ? "Portal Admin — Plan & manage visits and tasks for all portal members"
              : managerRole
              ? "Portal Manager — Plan & manage visits and tasks for yourself and your reporting team"
              : "Executive — Track and plan your scheduled field visits and work tasks"}
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 sm:flex-wrap">
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition cursor-pointer shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Report</span>
          </button>
          <Link
            href="/dashboard/plans"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0"
          >
            <FileText className="h-4 w-4 text-primary" />
            <span>Work Plans</span>
          </Link>
          <Link
            href="/dashboard/plans/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 sm:px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover shadow-xs active:scale-95 transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Plan</span>
          </Link>
        </div>
      </div>

      {/* Primary Mode Navigation & Role Filtering Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-1.5 bg-surface-muted p-1 rounded-xl border border-border overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
              viewMode === "list"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:text-foreground hover:bg-card"
            }`}
          >
            <CheckSquare className="h-4 w-4" />
            <span>📋 Directory List View</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode("visits_calendar");
              if (!selectedYmd) setSelectedYmd(toYmd(new Date()));
            }}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
              viewMode === "visits_calendar"
                ? "bg-sky-600 text-white shadow-xs"
                : "text-muted hover:text-foreground hover:bg-card"
            }`}
          >
            <Building2 className="h-4 w-4 text-sky-400" />
            <span>📍 Visits Planner</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode("tasks_calendar");
              if (!selectedYmd) setSelectedYmd(toYmd(new Date()));
            }}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
              viewMode === "tasks_calendar"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-muted hover:text-foreground hover:bg-card"
            }`}
          >
            <Briefcase className="h-4 w-4 text-emerald-400" />
            <span>💼 Tasks Planner</span>
          </button>
        </div>

        {/* Elevated Controls: My vs Team & Executive Filtering */}
        {elevatedRole && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => {
                  setOwnershipScope("mine");
                  setSelectedExecutiveFilter("all");
                  setCurrentPage(1);
                }}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                  ownershipScope === "mine"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                My Activity
              </button>
              <button
                type="button"
                onClick={() => {
                  setOwnershipScope("team");
                  setCurrentPage(1);
                }}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                  ownershipScope === "team"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                {adminRole ? "All Portal Members" : "My Team Activity"}
              </button>
            </div>

            {/* Executive Filter Dropdown when viewing team */}
            {ownershipScope === "team" && (
              <div className="flex items-center gap-1.5 bg-card border border-border px-2.5 py-1 rounded-xl">
                <Users className="h-3.5 w-3.5 text-muted" />
                <select
                  value={selectedExecutiveFilter}
                  onChange={(e) => {
                    setSelectedExecutiveFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer"
                >
                  <option value="all">
                    {adminRole ? "All Portal Members" : "All Team Members"}
                  </option>
                  {allowedExecutives.map((exec) => (
                    <option key={exec._id || exec.id} value={exec._id || exec.id}>
                      {exec.name} {exec._id === user?._id ? "(Self)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. VISITS PLANNER & CALENDAR VIEW */}
      {/* ========================================================================= */}
      {viewMode === "visits_calendar" && (
        <div className="space-y-4">
          {/* Calendar Top Controls & KPI Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded-lg border border-border bg-card p-1.5 hover:bg-surface-muted transition cursor-pointer"
                title="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-sky-500" />
                <h2 className="text-base font-bold text-foreground">
                  Visits Calendar &mdash; {monthLabel}
                </h2>
              </div>
              <button
                type="button"
                onClick={nextMonth}
                className="rounded-lg border border-border bg-card p-1.5 hover:bg-surface-muted transition cursor-pointer"
                title="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
              >
                Today
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="rounded-lg border border-border bg-card p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
                title="Refresh visits"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Visits KPI Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <div className="text-xs text-muted font-medium">Total Planned Visits</div>
              <div className="text-lg font-extrabold text-foreground mt-0.5">
                {allItems.filter((i) => i.itemType === "visit").length}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 shadow-xs">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Completed Visits</div>
              <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {allItems.filter((i) => i.itemType === "visit" && i.status === "completed").length}
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 shadow-xs">
              <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">In Progress / Checked In</div>
              <div className="text-lg font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                {
                  allItems.filter(
                    (i) =>
                      i.itemType === "visit" &&
                      (i.status === "in_progress" || i.status === "checked_in")
                  ).length
                }
              </div>
            </div>
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 shadow-xs">
              <div className="text-xs text-sky-600 dark:text-sky-400 font-medium">Pending / Created</div>
              <div className="text-lg font-extrabold text-sky-700 dark:text-sky-300 mt-0.5">
                {
                  allItems.filter(
                    (i) =>
                      i.itemType === "visit" &&
                      (i.status === "created" || i.status === "pending" || i.status === "planned")
                  ).length
                }
              </div>
            </div>
          </div>

          {/* Grid Layout: Calendar on Left, Day Inspector on Right */}
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
                {monthCells.map((cell, idx) => {
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
                  const dayVisits = visitsByDay.get(cell.ymd) || [];

                  return (
                    <div
                      key={cell.ymd}
                      onClick={() => setSelectedYmd(cell.ymd)}
                      className={`group relative flex flex-col justify-between min-h-[110px] p-1.5 transition cursor-pointer ${
                        isSelected
                          ? "bg-sky-500/10 ring-2 ring-inset ring-sky-500"
                          : "hover:bg-surface-muted"
                      } ${isToday ? "border-t-2 border-t-amber-500" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            isToday
                              ? "bg-amber-500 text-white"
                              : isSelected
                              ? "bg-sky-600 text-white"
                              : "text-foreground"
                          }`}
                        >
                          {cell.date.getDate()}
                        </span>

                        {dayVisits.length > 0 ? (
                          <span className="rounded-full bg-sky-500/20 px-1.5 py-0.2 text-[10px] font-extrabold text-sky-600 dark:text-sky-400">
                            {dayVisits.length}
                          </span>
                        ) : cell.date.getDay() === 0 ? (
                          <span className="text-[9px] font-semibold text-purple-600/70 dark:text-purple-400/70">
                            Off
                          </span>
                        ) : null}
                      </div>

                      {/* Day Visit Pills */}
                      <div className="mt-1 flex-1 space-y-1 overflow-y-auto max-h-[85px]">
                        {dayVisits.slice(0, 3).map((v) => (
                          <div
                            key={v.id}
                            className={`rounded px-1.5 py-0.5 text-[10px] truncate font-medium flex items-center gap-1 ${
                              v.status === "completed"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : v.status === "in_progress" || v.status === "checked_in"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                : "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                            }`}
                            title={`${v.titleOrParty} (${v.executiveName}) - ${v.status}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                v.status === "completed"
                                  ? "bg-emerald-500"
                                  : v.status === "in_progress" || v.status === "checked_in"
                                  ? "bg-amber-500"
                                  : "bg-sky-500"
                              }`}
                            />
                            <span className="truncate">{v.titleOrParty}</span>
                          </div>
                        ))}
                        {dayVisits.length > 3 && (
                          <div className="text-[10px] text-muted font-bold pl-1">
                            +{dayVisits.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Visits Inspector */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <div className="text-xs text-muted font-semibold">Selected Day Schedule</div>
                  <h3 className="text-sm font-bold text-foreground">
                    {selectedYmd ? formatPlanDate(selectedYmd) : "Select a date"}
                  </h3>
                </div>
              </div>

              {selectedDayVisits.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-muted">
                  <Building2 className="h-10 w-10 text-muted/40 mb-2" />
                  <p className="text-xs font-semibold text-foreground">No field visits planned for this day</p>
                  <p className="text-[11px] text-muted max-w-[220px] mt-1">
                    Field visits are scheduled by creating or updating a Work Plan.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 overflow-y-auto max-h-[460px] pr-1">
                  {selectedDayVisits.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-surface-muted/50 p-3 space-y-2 hover:border-sky-500/30 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-foreground text-xs">{item.titleOrParty}</div>
                          {item.executiveName && (
                            <div className="text-[11px] text-muted font-medium">{item.executiveName}</div>
                          )}
                        </div>
                        {renderVisitStatusBadge(item.status)}
                      </div>

                      {item.locationOrAddress && (
                        <div className="text-[11px] text-muted flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{item.locationOrAddress}</span>
                        </div>
                      )}

                      {item.contactPerson && (
                        <div className="text-[11px] text-muted flex items-center gap-1">
                          <UserCheck className="h-3 w-3 shrink-0" />
                          <span>
                            {item.contactPerson} {item.contactNumber ? `(${item.contactNumber})` : ""}
                          </span>
                        </div>
                      )}

                      {item.descriptionOrNotes && (
                        <div className="text-[11px] text-muted bg-card p-1.5 rounded border border-border">
                          {item.descriptionOrNotes}
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-border pt-2">
                        <div className="text-[10px] text-muted flex items-center gap-1">
                          {item.plannedTime && (
                            <>
                              <Clock className="h-3 w-3" />
                              <span>{item.plannedTime}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {elevatedRole && currentUserId !== item.salesUserId && (
                            <button
                              type="button"
                              onClick={() => setSeniorRemarksTarget(item)}
                              className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
                              title="Add or view senior remarks"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              <span>Senior</span>
                              {Array.isArray((item.raw as any)?.authority_remarks) &&
                                (item.raw as any).authority_remarks.length > 0 && (
                                  <span className="ml-0.5 rounded-full bg-primary/20 px-1 py-0.2 text-[8px] font-bold">
                                    {(item.raw as any).authority_remarks.length}
                                  </span>
                                )}
                            </button>
                          )}
                          <Link
                            href={`/dashboard/plans/${item.planId}`}
                            className="rounded p-1 text-muted hover:text-foreground transition"
                            title="View parent Work Plan"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TASKS PLANNER & CALENDAR VIEW */}
      {/* ========================================================================= */}
      {viewMode === "tasks_calendar" && (
        <div className="space-y-4">
          {/* Calendar Top Controls & KPI Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded-lg border border-border bg-card p-1.5 hover:bg-surface-muted transition cursor-pointer"
                title="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-emerald-500" />
                <h2 className="text-base font-bold text-foreground">
                  Tasks Calendar &mdash; {monthLabel}
                </h2>
              </div>
              <button
                type="button"
                onClick={nextMonth}
                className="rounded-lg border border-border bg-card p-1.5 hover:bg-surface-muted transition cursor-pointer"
                title="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
              >
                Today
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="rounded-lg border border-border bg-card p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
                title="Refresh tasks"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Tasks KPI Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <div className="text-xs text-muted font-medium">Total Planned Tasks</div>
              <div className="text-lg font-extrabold text-foreground mt-0.5">
                {allItems.filter((i) => i.itemType === "task").length}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 shadow-xs">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Completed Tasks</div>
              <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {allItems.filter((i) => i.itemType === "task" && i.status === "completed").length}
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 shadow-xs">
              <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">In Progress</div>
              <div className="text-lg font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                {allItems.filter((i) => i.itemType === "task" && i.status === "in_progress").length}
              </div>
            </div>
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 shadow-xs">
              <div className="text-xs text-sky-600 dark:text-sky-400 font-medium">Pending / Created</div>
              <div className="text-lg font-extrabold text-sky-700 dark:text-sky-300 mt-0.5">
                {
                  allItems.filter(
                    (i) =>
                      i.itemType === "task" &&
                      (i.status === "created" || i.status === "pending" || i.status === "planned")
                  ).length
                }
              </div>
            </div>
          </div>

          {/* Grid Layout: Tasks Calendar on Left, Day Inspector on Right */}
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
                {monthCells.map((cell, idx) => {
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
                  const dayTasks = tasksByDay.get(cell.ymd) || [];

                  return (
                    <div
                      key={cell.ymd}
                      onClick={() => setSelectedYmd(cell.ymd)}
                      className={`group relative flex flex-col justify-between min-h-[110px] p-1.5 transition cursor-pointer ${
                        isSelected
                          ? "bg-emerald-500/10 ring-2 ring-inset ring-emerald-500"
                          : "hover:bg-surface-muted"
                      } ${isToday ? "border-t-2 border-t-amber-500" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            isToday
                              ? "bg-amber-500 text-white"
                              : isSelected
                              ? "bg-emerald-600 text-white"
                              : "text-foreground"
                          }`}
                        >
                          {cell.date.getDate()}
                        </span>

                        {dayTasks.length > 0 ? (
                          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                            {dayTasks.length}
                          </span>
                        ) : cell.date.getDay() === 0 ? (
                          <span className="text-[9px] font-semibold text-purple-600/70 dark:text-purple-400/70">
                            Off
                          </span>
                        ) : null}
                      </div>

                      {/* Day Task Pills */}
                      <div className="mt-1 flex-1 space-y-1 overflow-y-auto max-h-[85px]">
                        {dayTasks.slice(0, 3).map((t) => (
                          <div
                            key={t.id}
                            className={`rounded px-1.5 py-0.5 text-[10px] truncate font-medium flex items-center gap-1 ${
                              t.status === "completed"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : t.status === "in_progress"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                : "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                            }`}
                            title={`${t.titleOrParty} (${t.executiveName}) - ${t.status}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                t.status === "completed"
                                  ? "bg-emerald-500"
                                  : t.status === "in_progress"
                                  ? "bg-amber-500"
                                  : "bg-sky-500"
                              }`}
                            />
                            <span className="truncate">{t.titleOrParty}</span>
                          </div>
                        ))}
                        {dayTasks.length > 3 && (
                          <div className="text-[10px] text-muted font-bold pl-1">
                            +{dayTasks.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Tasks Inspector */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <div className="text-xs text-muted font-semibold">Selected Day Tasks</div>
                  <h3 className="text-sm font-bold text-foreground">
                    {selectedYmd ? formatPlanDate(selectedYmd) : "Select a date"}
                  </h3>
                </div>
              </div>

              {selectedDayTasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-muted">
                  <Briefcase className="h-10 w-10 text-muted/40 mb-2" />
                  <p className="text-xs font-semibold text-foreground">No tasks planned for this day</p>
                  <p className="text-[11px] text-muted max-w-[220px] mt-1">
                    Work tasks are scheduled by creating or updating a Work Plan.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 overflow-y-auto max-h-[460px] pr-1">
                  {selectedDayTasks.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-surface-muted/50 p-3 space-y-2 hover:border-emerald-500/30 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-foreground text-xs">{item.titleOrParty}</div>
                          {item.executiveName && (
                            <div className="text-[11px] text-muted font-medium">{item.executiveName}</div>
                          )}
                        </div>
                        {renderWorkStatusBadge(item.status)}
                      </div>

                      {item.locationOrAddress && (
                        <div className="text-[11px] text-muted flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{item.locationOrAddress}</span>
                        </div>
                      )}

                      {item.descriptionOrNotes && (
                        <div className="text-[11px] text-muted bg-card p-1.5 rounded border border-border">
                          {item.descriptionOrNotes}
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-border pt-2">
                        <div className="text-[10px] text-muted flex items-center gap-1">
                          {item.plannedTime && (
                            <>
                              <Clock className="h-3 w-3" />
                              <span>{item.plannedTime}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {elevatedRole && currentUserId !== item.salesUserId && (
                            <button
                              type="button"
                              onClick={() => setSeniorRemarksTarget(item)}
                              className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
                              title="Add or view senior remarks"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              <span>Senior</span>
                              {Array.isArray((item.raw as any)?.authority_remarks) &&
                                (item.raw as any).authority_remarks.length > 0 && (
                                  <span className="ml-0.5 rounded-full bg-primary/20 px-1 py-0.2 text-[8px] font-bold">
                                    {(item.raw as any).authority_remarks.length}
                                  </span>
                                )}
                            </button>
                          )}
                          <Link
                            href={`/dashboard/plans/${item.planId}`}
                            className="rounded p-1 text-muted hover:text-foreground transition"
                            title="View parent Work Plan"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. STANDARD DIRECTORY LIST VIEW */}
      {/* ========================================================================= */}
      {viewMode === "list" && (
        <div className="space-y-4">
          {/* Category Selection Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-1">
            <button
              type="button"
              onClick={() => {
                setCategoryFilter("all");
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                categoryFilter === "all"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <CheckSquare className="h-4 w-4" />
              <span>All Activity Items ({allItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCategoryFilter("visits");
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                categoryFilter === "visits"
                  ? "border-sky-500 text-sky-600 dark:text-sky-400"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <Building2 className="h-4 w-4 text-sky-500" />
              <span>Field Visits ({allItems.filter((i) => i.itemType === "visit").length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCategoryFilter("tasks");
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                categoryFilter === "tasks"
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <Briefcase className="h-4 w-4 text-emerald-500" />
              <span>Work Tasks ({allItems.filter((i) => i.itemType === "task").length})</span>
            </button>
          </div>

          {/* Status Filter Bar */}
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setCurrentPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filters bar */}
          <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by executive, party name, task title, address..."
                className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              />
              <span className="text-xs text-muted">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              title="Refresh activity data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Mobile Touch Cards View (< md) */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted">
                Loading activity items…
              </div>
            ) : currentItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-xs text-muted">
                No field visits or tasks found matching current filters.
              </div>
            ) : (
              currentItems.map((item) => {
                const isVisit = item.itemType === "visit";
                const phone = item.contactNumber;

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs transition hover:border-primary/40 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isVisit ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">
                              <Building2 className="h-3 w-3" />
                              Field Visit
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <Briefcase className="h-3 w-3" />
                              Work Task
                            </span>
                          )}
                          <span className="text-xs font-bold text-foreground">
                            {formatPlanDate(item.planDate)}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-muted">
                          {item.executiveName}
                        </p>
                      </div>
                      {isVisit
                        ? renderVisitStatusBadge(item.status)
                        : renderWorkStatusBadge(item.status)}
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-foreground">
                        {item.titleOrParty}
                      </h4>
                      {item.descriptionOrNotes && (
                        <p className="text-xs text-muted line-clamp-2">
                          {item.descriptionOrNotes}
                        </p>
                      )}
                    </div>

                    {(item.contactPerson || item.locationOrAddress || phone) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted pt-1 border-t border-border/50">
                        {item.contactPerson && (
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <UserCheck className="h-3 w-3 text-muted shrink-0" />
                            {item.contactPerson}
                          </span>
                        )}
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="h-3 w-3" />
                            <span>Call</span>
                          </a>
                        )}
                        {item.locationOrAddress && (
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(item.locationOrAddress)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[11px] text-muted hover:text-primary transition truncate max-w-[200px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                            <span className="truncate">{item.locationOrAddress}</span>
                          </a>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                      {elevatedRole && currentUserId !== item.salesUserId ? (
                        <button
                          type="button"
                          onClick={() => setSeniorRemarksTarget(item)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Senior Remark</span>
                        </button>
                      ) : (
                        <span />
                      )}

                      <Link
                        href={`/dashboard/plans/${item.planId}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                      >
                        <span>Open Plan</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop / Tablet Main Activity Table (≥ md) */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-muted font-semibold text-muted">
                  <tr>
                    <th className="px-4 py-3">Date &amp; Time</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Executive</th>
                    <th className="px-4 py-3">Title / Party Name</th>
                    <th className="px-4 py-3">Contact / Location</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted">
                        Loading activity items…
                      </td>
                    </tr>
                  ) : currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted">
                        No field visits or tasks found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((item) => {
                      const isVisit = item.itemType === "visit";

                      return (
                        <tr key={item.id} className="hover:bg-surface-muted/50 transition">
                          {/* Plan Date & Schedule */}
                          <td className="px-4 py-3 font-semibold whitespace-nowrap">
                            <div>{formatPlanDate(item.planDate)}</div>
                            {item.plannedTime && (
                              <div className="text-[10px] text-muted flex items-center gap-1 font-normal mt-0.5">
                                <Clock className="h-3 w-3" />
                                {item.plannedTime}
                              </div>
                            )}
                          </td>

                          {/* Category Badge */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {isVisit ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-bold text-sky-600 dark:text-sky-400">
                                <Building2 className="h-3 w-3" />
                                Field Visit
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                <Briefcase className="h-3 w-3" />
                                Work Task
                              </span>
                            )}
                          </td>

                          {/* Executive */}
                          <td className="px-4 py-3 font-medium truncate max-w-[140px]">
                            {item.executiveName}
                          </td>

                          {/* Title or Party Name & Description */}
                          <td className="px-4 py-3 max-w-[200px]">
                            <div className="font-bold text-foreground truncate" title={item.titleOrParty}>
                              {item.titleOrParty}
                            </div>
                            {item.descriptionOrNotes && (
                              <div className="text-[11px] text-muted truncate mt-0.5" title={item.descriptionOrNotes}>
                                {item.descriptionOrNotes}
                              </div>
                            )}
                          </td>

                          {/* Contact / Location */}
                          <td className="px-4 py-3 max-w-[180px]">
                            {isVisit ? (
                              <div className="space-y-0.5">
                                {item.contactPerson && (
                                  <div className="font-semibold text-foreground flex items-center gap-1 truncate text-[11px]">
                                    <UserCheck className="h-3 w-3 text-muted shrink-0" />
                                    {item.contactPerson}
                                  </div>
                                )}
                                {item.locationOrAddress && (
                                  <div className="text-[11px] text-muted flex items-center gap-1 truncate">
                                    <MapPin className="h-3 w-3 text-muted shrink-0" />
                                    {item.locationOrAddress}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted flex items-center gap-1 truncate">
                                <MapPin className="h-3 w-3 text-muted shrink-0" />
                                {item.locationOrAddress}
                              </div>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {isVisit
                              ? renderVisitStatusBadge(item.status)
                              : renderWorkStatusBadge(item.status)}
                          </td>

                          {/* Direct Row Actions */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {elevatedRole && currentUserId !== item.salesUserId && (
                                <button
                                  type="button"
                                  onClick={() => setSeniorRemarksTarget(item)}
                                  className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
                                  title="Add or view senior directives & remarks"
                                >
                                  <ShieldCheck className="h-3 w-3" />
                                  <span>Senior Remark</span>
                                  {Array.isArray((item.raw as any)?.authority_remarks) &&
                                    (item.raw as any).authority_remarks.length > 0 && (
                                      <span className="ml-0.5 rounded-full bg-primary/20 px-1.5 py-0.2 text-[9px] font-bold">
                                        {(item.raw as any).authority_remarks.length}
                                      </span>
                                    )}
                                </button>
                              )}

                              {/* Link to parent Work Plan */}
                              <Link
                                href={`/dashboard/plans/${item.planId}`}
                                className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground transition ml-1"
                                title="View parent Work Plan"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
                <div className="text-muted">
                  Showing page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
                  <span className="font-semibold text-foreground">{totalPages}</span> ({totalItems} total items)
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 transition cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unified Senior Directives & Remarks Modal */}
      {seniorRemarksTarget && (
        <SeniorRemarksModal
          open={Boolean(seniorRemarksTarget)}
          itemType={seniorRemarksTarget.itemType}
          title={seniorRemarksTarget.titleOrParty}
          planId={seniorRemarksTarget.planId}
          itemId={seniorRemarksTarget.id}
          planDate={seniorRemarksTarget.planDate}
          currentStatus={seniorRemarksTarget.status}
          assigneeName={seniorRemarksTarget.executiveName}
          initialRemarks={(seniorRemarksTarget.raw as any)?.manager_remarks}
          authorityRemarksHistory={(seniorRemarksTarget.raw as any)?.authority_remarks}
          onClose={() => setSeniorRemarksTarget(null)}
          onSuccess={() => {
            loadData();
          }}
        />
      )}


      {/* Report Download Modal */}
      {reportModalOpen && (
        <DownloadTasksVisitsReportModal
          open={reportModalOpen}
          plans={plans}
          onClose={() => setReportModalOpen(false)}
        />
      )}
    </div>
  );
}

export default TasksVisitsPage;
