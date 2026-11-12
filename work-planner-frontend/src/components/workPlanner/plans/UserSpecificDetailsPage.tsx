"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  Users,
  CheckSquare,
  Building2,
  Briefcase,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  TrendingUp,
  Receipt,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetPlansQuery,
  useGetStatsQuery,
  useGetMyTeamQuery,
  useGetUserSettingsQuery,
  useGetSeniorRemarksFeedQuery,
  useGetExecutivePassbookQuery,
  useDeletePlanMutation,
} from "@/store/api/workPlannerApiSlice";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import {
  isWpAdmin,
  isWpManager,
  isWpCoordinator,
  isWpElevated,
  readSessionFromStorage,
} from "@/utils/authStorage";
import type {
  WorkPlanRecord,
  SeniorRemarkFeedItem,
  WorkPlannerStats,
} from "@/types/workPlanner";
import {
  WORK_PLAN_STATUS_TABS,
  WORK_PLAN_TYPE_TABS,
  canEditPlan,
  formatDiscussionMethod,
  formatPlanDate,
  formatTime,
  planActivityLabel,
  planIdOf,
  renderPlanStatusBadge,
  renderVisitStatusBadge,
  renderWorkStatusBadge,
  salesUserLabel,
} from "../shared/workPlanUtils";
import { ConfirmDeleteWorkPlanModal } from "./ConfirmDeleteWorkPlanModal";
import { CopyWorkPlanModal } from "./CopyWorkPlanModal";
import { DownloadWorkPlansModal } from "./DownloadWorkPlansModal";
import { DirectiveThreadModal } from "./DirectiveThreadModal";
import { SeniorRemarksModal } from "../senior-remarks/SeniorRemarksModal";

export type DetailTab = "overview" | "plans" | "tasks" | "directives" | "passbook";

export interface UserSpecificDetailsPageProps {
  userId: string;
  initialTab?: DetailTab;
  backHref?: string;
}

export function UserSpecificDetailsPage({
  userId,
  initialTab = "overview",
  backHref = "/dashboard/plans/team",
}: UserSpecificDetailsPageProps) {
  const router = useRouter();
  const session = readSessionFromStorage();
  const currentUser = session?.user;
  const currentUserId = String(currentUser?._id || (currentUser as any)?.id || "");
  const adminRole = isWpAdmin(currentUser);
  const managerRole = isWpManager(currentUser);
  const coordinatorRole = isWpCoordinator(currentUser);
  const elevatedRole = isWpElevated(currentUser);

  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab);

  // Plans Tab Filters
  const [planStatusFilter, setPlanStatusFilter] = useState("all");
  const [planTypeFilter, setPlanTypeFilter] = useState("all");
  const [planSearch, setPlanSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Tasks Tab Filters
  const [taskCategory, setTaskCategory] = useState<"all" | "visits" | "tasks">("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [taskSearch, setTaskSearch] = useState("");

  // Modals state
  const [copyTarget, setCopyTarget] = useState<WorkPlanRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [activeThreadItem, setActiveThreadItem] = useState<SeniorRemarkFeedItem | null>(null);
  const [directiveModalOpen, setDirectiveModalOpen] = useState(false);

  const [deletePlanMut] = useDeletePlanMutation();

  // Queries
  const { data: myTeamData, isLoading: loadingTeam } = useGetMyTeamQuery(undefined, {
    skip: !elevatedRole,
  });
  const { data: usersData, isLoading: loadingUsers } = useGetUsersQuery(undefined, {
    skip: !adminRole,
  });
  const { data: userSettings, isLoading: loadingSettings } = useGetUserSettingsQuery(userId, {
    skip: !elevatedRole || !userId,
  });
  const { data: statsData, isLoading: loadingStats } = useGetStatsQuery(
    { sales_user: userId },
    { skip: !elevatedRole || !userId }
  );
  const {
    data: plansRes,
    isLoading: loadingPlans,
    refetch: refetchPlans,
  } = useGetPlansQuery(
    {
      sales_user: userId,
      limit: 250,
      include_visits: true,
      include_works: true,
    },
    { skip: !elevatedRole || !userId }
  );
  const {
    data: remarksData,
    isLoading: loadingRemarks,
    refetch: refetchRemarks,
  } = useGetSeniorRemarksFeedQuery(
    { sales_user: userId },
    { skip: !elevatedRole || !userId }
  );
  const { data: passbookData, isLoading: loadingPassbook } = useGetExecutivePassbookQuery(
    { userId },
    { skip: !elevatedRole || !userId }
  );

  // Resolve target user profile info
  const targetUser = useMemo(() => {
    // 1. Check in myTeamData members
    if (Array.isArray(myTeamData?.members)) {
      const match = myTeamData.members.find(
        (m: any) => String(m._id || m.id) === String(userId)
      );
      if (match) return match;
    }
    // 2. Check in usersData
    if (Array.isArray(usersData)) {
      const match = usersData.find(
        (u: any) => String(u._id || u.id) === String(userId)
      );
      if (match) return match;
    }
    return null;
  }, [myTeamData, usersData, userId]);

  const memberName = targetUser?.name || userSettings?.name || "Team Member";
  const memberEmail = targetUser?.email || userSettings?.email || "";
  const memberDepartment =
    typeof targetUser?.department === "object"
      ? targetUser?.department?.name || targetUser?.department?.code || ""
      : targetUser?.department || "";
  const memberRole = targetUser?.wp_role || targetUser?.role || "Executive";
  const assignedManagerName =
    userSettings?.assignedManagerName || userSettings?.assigned_manager?.name || "Direct Assignment";
  const assignedManagerEmail =
    userSettings?.assignedManagerEmail || userSettings?.assigned_manager?.email || "";

  const allPlans = plansRes?.data || [];

  // Filtered Plans for Plans Tab
  const filteredPlans = useMemo(() => {
    return allPlans.filter((p) => {
      if (planStatusFilter !== "all" && p.status !== planStatusFilter) return false;
      if (planTypeFilter !== "all" && p.plan_type !== planTypeFilter) return false;
      if (dateFrom && p.plan_date && p.plan_date < dateFrom) return false;
      if (dateTo && p.plan_date && p.plan_date > dateTo) return false;
      if (planSearch.trim()) {
        const q = planSearch.trim().toLowerCase();
        const text = `${p.remarks || ""} ${p.location || ""} ${p.plan_type || ""} ${p.status || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [allPlans, planStatusFilter, planTypeFilter, dateFrom, dateTo, planSearch]);

  // Flatten Visits and Works for Tasks Tab
  const allVisitsAndTasks = useMemo(() => {
    const list: Array<{
      id: string;
      itemType: "visit" | "task";
      titleOrParty: string;
      planId: string;
      planDate: string;
      status: string;
      location?: string;
      contactPerson?: string;
      phone?: string;
      purposeOrNotes?: string;
      outcomeNotes?: string;
      time?: string;
      raw: any;
    }> = [];

    for (const p of allPlans) {
      const pId = planIdOf(p);
      const pDate = p.plan_date || "";

      if (Array.isArray(p.visits)) {
        for (const v of p.visits) {
          const vAny = v as any;
          list.push({
            id: String(v._id || v.id),
            itemType: "visit",
            titleOrParty:
              v.party_name ||
              (typeof v.party === "object" ? (v.party as any)?.party_name : undefined) ||
              (typeof v.party === "string" ? v.party : "") ||
              vAny.doctor_name ||
              "Field Visit",
            planId: pId,
            planDate: pDate,
            status: String(v.status || "created").toLowerCase(),
            location: vAny.location || v.address || p.location || "",
            contactPerson: v.contact_person || vAny.doctor_name || "",
            phone: v.phone || v.contact_number || "",
            purposeOrNotes: v.purpose || vAny.notes || "",
            outcomeNotes: vAny.outcome_notes || vAny.remarks || "",
            time: vAny.time || vAny.visit_time || "",
            raw: v,
          });
        }
      }

      if (Array.isArray(p.works)) {
        for (const w of p.works) {
          const wAny = w as any;
          list.push({
            id: String(w._id || w.id),
            itemType: "task",
            titleOrParty: w.title || wAny.work_title || "Work Task",
            planId: pId,
            planDate: pDate,
            status: String(w.status || "created").toLowerCase(),
            location: p.location || "",
            purposeOrNotes: w.description || wAny.remarks || "",
            outcomeNotes: wAny.outcome_notes || "",
            time: wAny.time || "",
            raw: w,
          });
        }
      }
    }

    return list.sort((a, b) => (b.planDate > a.planDate ? 1 : -1));
  }, [allPlans]);

  // Filtered Visits & Tasks
  const filteredVisitsAndTasks = useMemo(() => {
    return allVisitsAndTasks.filter((item) => {
      if (taskCategory === "visits" && item.itemType !== "visit") return false;
      if (taskCategory === "tasks" && item.itemType !== "task") return false;
      if (taskStatusFilter !== "all") {
        if (
          taskStatusFilter === "in_progress" &&
          (item.status === "in_progress" || item.status === "checked_in")
        ) {
          // match
        } else if (item.status !== taskStatusFilter) {
          return false;
        }
      }
      if (taskSearch.trim()) {
        const q = taskSearch.trim().toLowerCase();
        const text = `${item.titleOrParty} ${item.location} ${item.contactPerson} ${item.purposeOrNotes} ${item.outcomeNotes}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [allVisitsAndTasks, taskCategory, taskStatusFilter, taskSearch]);

  // Directives Feed
  const directives = remarksData?.items || [];

  // Metrics summary
  const summary = useMemo(() => {
    const totalPlans = allPlans.length;
    const completedPlans = allPlans.filter((p) => p.status === "completed").length;
    const plannedPlans = allPlans.filter((p) => p.status === "planned").length;
    const approvedPlans = allPlans.filter((p) => p.status === "approved").length;

    const totalVisits = allVisitsAndTasks.filter((i) => i.itemType === "visit").length;
    const completedVisits = allVisitsAndTasks.filter(
      (i) => i.itemType === "visit" && (i.status === "completed" || i.status === "checked_out")
    ).length;

    const totalTasks = allVisitsAndTasks.filter((i) => i.itemType === "task").length;
    const completedTasks = allVisitsAndTasks.filter(
      (i) => i.itemType === "task" && i.status === "completed"
    ).length;

    const openDirectives = directives.filter((d) => d.status === "pending_response").length;
    const resolvedDirectives = directives.filter((d) => d.status === "resolved").length;

    return {
      totalPlans,
      completedPlans,
      plannedPlans,
      approvedPlans,
      totalVisits,
      completedVisits,
      totalTasks,
      completedTasks,
      openDirectives,
      resolvedDirectives,
    };
  }, [allPlans, allVisitsAndTasks, directives]);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deletePlanMut(deleteTarget.id).unwrap();
      toast.success("Work plan deleted");
      setDeleteTarget(null);
      refetchPlans();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete plan";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  }

  // Access check
  if (!elevatedRole) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3 font-sans max-w-lg mx-auto mt-8">
        <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="text-base font-bold text-foreground">Access Restricted</h2>
        <p className="text-xs text-muted">
          Member Deep Dive profiles are only accessible to Coordinators, Managers, and Admins.
        </p>
        <Link
          href="/dashboard/plans"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover shadow-xs active:scale-95 transition"
        >
          Go to My Plans
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans w-full max-w-full pb-10">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Team Overview</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/assigned-users/${userId}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
            title="Configure CC emails, manager, and custom templates"
          >
            <Settings className="h-3.5 w-3.5 text-primary" />
            <span>Templates &amp; Config</span>
          </Link>

          <Link
            href={`/dashboard/plans/new?sales_user=${userId}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover shadow-xs active:scale-95 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Plan</span>
          </Link>
        </div>
      </div>

      {/* Member Profile Header Banner */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-primary/10 border-2 border-primary/25 flex items-center justify-center text-primary font-black text-2xl sm:text-3xl shrink-0 shadow-xs">
              {memberName.charAt(0).toUpperCase()}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                  {memberName}
                </h1>
                <span className="inline-flex rounded-lg bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-[11px] font-bold text-primary uppercase tracking-wider">
                  {memberRole}
                </span>
                {memberDepartment && (
                  <span className="inline-flex rounded-lg bg-surface-muted border border-border px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                    {memberDepartment}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                {memberEmail && (
                  <a
                    href={`mailto:${memberEmail}`}
                    className="inline-flex items-center gap-1.5 hover:text-primary transition"
                  >
                    <Mail className="h-3.5 w-3.5 text-muted" />
                    <span>{memberEmail}</span>
                  </a>
                )}
                <div className="inline-flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Reporting to: <strong className="text-foreground">{assignedManagerName}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Deep Dive Actions */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border">
            <button
              type="button"
              onClick={() => {
                refetchPlans();
                refetchRemarks();
                toast.success("Refreshed user data");
              }}
              className="rounded-xl border border-border p-2.5 text-muted hover:text-foreground hover:bg-surface-muted transition cursor-pointer"
              title="Refresh member data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDownloadOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-card transition cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Export Plans</span>
            </button>
            <button
              type="button"
              onClick={() => setDirectiveModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Issue Directive</span>
            </button>
          </div>
        </div>

        {/* User Specific KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-border/70">
          <div className="rounded-2xl border border-border/70 bg-surface-muted/50 p-3">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Total Plans</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-foreground">{summary.totalPlans}</span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {summary.completedPlans} done
              </span>
            </div>
            <span className="text-[10px] text-muted block mt-0.5">{summary.plannedPlans} pending review</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface-muted/50 p-3">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Field Visits</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-sky-600 dark:text-sky-400">{summary.totalVisits}</span>
              <span className="text-[11px] font-semibold text-muted">
                {summary.completedVisits} executed
              </span>
            </div>
            <span className="text-[10px] text-muted block mt-0.5">Doctor &amp; party meetings</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface-muted/50 p-3">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Assigned Tasks</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-foreground">{summary.totalTasks}</span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {summary.completedTasks} completed
              </span>
            </div>
            <span className="text-[10px] text-muted block mt-0.5">Work &amp; follow-up items</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface-muted/50 p-3">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Directives &amp; Feedback</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-foreground">{directives.length}</span>
              {summary.openDirectives > 0 ? (
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  {summary.openDirectives} waiting reply
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  All resolved
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted block mt-0.5">Supervisory closed-loop tracker</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-border pb-1 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${
            activeTab === "overview"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted hover:text-foreground hover:bg-card"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>360° Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("plans")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${
            activeTab === "plans"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted hover:text-foreground hover:bg-card"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Work Plans ({allPlans.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${
            activeTab === "tasks"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted hover:text-foreground hover:bg-card"
          }`}
        >
          <CheckSquare className="h-4 w-4" />
          <span>Tasks &amp; Visits ({allVisitsAndTasks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("directives")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${
            activeTab === "directives"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted hover:text-foreground hover:bg-card"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Directives &amp; Objections ({directives.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("passbook")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${
            activeTab === "passbook"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted hover:text-foreground hover:bg-card"
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>Passbook &amp; Ledger</span>
        </button>
      </div>

      {/* TAB 1: 360° OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left 2 cols: Recent Plans & Visits */}
            <div className="lg:col-span-2 space-y-4">
              {/* Recent Work Plans */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Recent Work Plans</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("plans")}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    View All ({allPlans.length}) <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                {allPlans.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                    No work plans logged by this member yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {allPlans.slice(0, 5).map((p) => {
                      const pId = planIdOf(p);
                      return (
                        <div
                          key={pId}
                          className="flex items-center justify-between py-2.5 gap-3 hover:bg-surface-muted/40 transition px-2 rounded-xl"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-foreground">
                                {formatPlanDate(p.plan_date)}
                              </span>
                              <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[9px] font-bold text-muted uppercase">
                                {p.plan_type || "Visits"}
                              </span>
                              {p.location && (
                                <span className="text-[11px] text-muted truncate max-w-[150px]">
                                  📍 {p.location}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted truncate">
                              {planActivityLabel(p)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {renderPlanStatusBadge(p.status)}
                            <Link
                              href={`/dashboard/plans/${pId}`}
                              className="rounded-lg border border-border p-1.5 text-muted hover:text-primary transition"
                              title="Review plan"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Field Visits */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-sky-500" />
                    <span>Recent Field Visits</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("tasks")}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    View All ({allVisitsAndTasks.length}) <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                {allVisitsAndTasks.filter((i) => i.itemType === "visit").length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                    No field visits scheduled by this member yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {allVisitsAndTasks
                      .filter((i) => i.itemType === "visit")
                      .slice(0, 5)
                      .map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between py-2.5 gap-3 hover:bg-surface-muted/40 transition px-2 rounded-xl"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-foreground truncate">
                                {v.titleOrParty}
                              </span>
                              <span className="text-[10px] text-muted whitespace-nowrap">
                                📅 {formatPlanDate(v.planDate)}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted truncate">
                              {v.location ? `📍 ${v.location}` : ""} {v.contactPerson ? `• Contact: ${v.contactPerson}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0">{renderVisitStatusBadge(v.status)}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right 1 col: Member Meta, Directives, Passbook quick card */}
            <div className="space-y-4">
              {/* Supervisory Directives Snapshot */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span>Recent Directives</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("directives")}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    View ({directives.length})
                  </button>
                </div>

                {directives.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">
                    No supervisory directives logged for this member.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {directives.slice(0, 3).map((d) => (
                      <div
                        key={d.id || d.remark_id}
                        onClick={() => setActiveThreadItem(d)}
                        className="rounded-xl border border-border bg-surface-muted/40 p-3 space-y-1 hover:border-primary/40 cursor-pointer transition"
                      >
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="font-bold text-foreground truncate">{d.title}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              d.status === "pending_response"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {d.status === "pending_response" ? "Pending" : "Resolved"}
                          </span>
                        </div>
                        <p className="text-xs text-muted line-clamp-2">{d.remark}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Passbook Snapshot */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 text-primary" />
                    <span>Passbook Status</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("passbook")}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Ledger
                  </button>
                </div>

                <div className="rounded-xl bg-surface-muted/60 p-3 space-y-2 border border-border/60 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Current Net Position:</span>
                    <span className="font-bold text-foreground">
                      ₹{passbookData?.current_net_position ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">Current Advance Balance:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      ₹{passbookData?.current_advance_balance ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">Claims Receivable:</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      ₹{passbookData?.current_claim_receivable ?? passbookData?.approved_claim_amount ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WORK PLANS */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1.5 overflow-x-auto scrollbar-none">
            {WORK_PLAN_STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPlanStatusFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition shrink-0 ${
                  planStatusFilter === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 bg-card p-3 rounded-2xl border border-border shadow-2xs">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
              <input
                type="text"
                value={planSearch}
                onChange={(e) => setPlanSearch(e.target.value)}
                placeholder="Search plans by location, remarks..."
                className="w-full rounded-xl border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <select
                value={planTypeFilter}
                onChange={(e) => setPlanTypeFilter(e.target.value)}
                className="rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground outline-none focus:border-primary cursor-pointer"
              >
                {WORK_PLAN_TYPE_TABS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
                <span className="text-xs text-muted">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <button
                type="button"
                onClick={refetchPlans}
                disabled={loadingPlans}
                className="rounded-xl p-2 text-muted hover:bg-surface-muted hover:text-foreground active:scale-95 transition cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loadingPlans ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Plans Table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-muted border-b border-border text-[11px] font-bold text-muted uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Plan Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Activity</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Discussion</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingPlans ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-muted">
                        Loading work plans…
                      </td>
                    </tr>
                  ) : filteredPlans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-muted">
                        No work plans found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPlans.map((r) => {
                      const id = planIdOf(r);
                      const canEdit = canEditPlan(r.status, { isAdmin: elevatedRole });

                      return (
                        <tr
                          key={id}
                          className="hover:bg-surface-muted/60 transition group cursor-pointer"
                          onClick={() => router.push(`/dashboard/plans/${id}`)}
                        >
                          <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                            {formatPlanDate(r.plan_date)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex rounded-md bg-surface-muted border border-border px-2 py-0.5 text-[10px] font-bold text-foreground uppercase tracking-wider">
                              {r.plan_type || "Visits"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground max-w-[180px] truncate">
                            {planActivityLabel(r)}
                          </td>
                          <td className="px-4 py-3 text-muted max-w-[150px] truncate">
                            {r.location || "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderPlanStatusBadge(r.status)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {r.is_discussed_with_manager ? (
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                                <span>{formatDiscussionMethod(r.discussion_method)}</span>
                              </div>
                            ) : (
                              <span className="text-muted text-[11px]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setCopyTarget(r)}
                                className="rounded-lg border border-border p-1.5 text-muted hover:text-foreground hover:bg-surface-muted transition cursor-pointer"
                                title="Copy plan"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      id,
                                      label: `Plan for ${formatPlanDate(r.plan_date)}`,
                                    })
                                  }
                                  className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-500 hover:bg-rose-500/20 transition cursor-pointer"
                                  title="Delete plan"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <Link
                                href={`/dashboard/plans/${id}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition"
                              >
                                <span>Review</span>
                                <ExternalLink className="h-3 w-3" />
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
          </div>
        </div>
      )}

      {/* TAB 3: TASKS & VISITS */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-2xs">
            <div className="flex items-center gap-1 bg-surface-muted p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setTaskCategory("all")}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  taskCategory === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                All ({allVisitsAndTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setTaskCategory("visits")}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  taskCategory === "visits"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Visits ({summary.totalVisits})
              </button>
              <button
                type="button"
                onClick={() => setTaskCategory("tasks")}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  taskCategory === "tasks"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Tasks ({summary.totalTasks})
              </button>
            </div>

            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted pointer-events-none" />
                <input
                  type="text"
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="Filter visits and tasks..."
                  className="w-full rounded-xl border border-border bg-surface-muted pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <select
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value)}
                className="rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="created">Created</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Visits & Tasks List */}
          {filteredVisitsAndTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-xs text-muted">
              No visits or tasks found matching criteria.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredVisitsAndTasks.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border bg-card p-4 space-y-2 hover:border-primary/40 transition shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            item.itemType === "visit"
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {item.itemType === "visit" ? "📍 Visit" : "💼 Task"}
                        </span>
                        <h4 className="text-sm font-bold text-foreground truncate">
                          {item.titleOrParty}
                        </h4>
                        <span className="text-[11px] text-muted whitespace-nowrap">
                          📅 {formatPlanDate(item.planDate)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        {item.location && <span>📍 {item.location}</span>}
                        {item.contactPerson && <span>👤 {item.contactPerson}</span>}
                        {item.phone && <span>📞 {item.phone}</span>}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {item.itemType === "visit"
                        ? renderVisitStatusBadge(item.status)
                        : renderWorkStatusBadge(item.status)}
                    </div>
                  </div>

                  {item.purposeOrNotes && (
                    <p className="text-xs text-muted bg-surface-muted/50 p-2.5 rounded-xl border border-border/50">
                      {item.purposeOrNotes}
                    </p>
                  )}

                  {item.outcomeNotes && (
                    <div className="flex items-start gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded-xl">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>Outcome: {item.outcomeNotes}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted">
                    <Link
                      href={`/dashboard/plans/${item.planId}`}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <span>View Parent Work Plan</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DIRECTIVES & OBJECTIONS */}
      {activeTab === "directives" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-card p-3 rounded-2xl border border-border shadow-2xs">
            <div>
              <h3 className="text-xs font-bold text-foreground">
                Supervisory Directives &amp; Action Log
              </h3>
              <p className="text-[11px] text-muted">
                Track closed-loop feedback, instructions, and objections given to this member
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDirectiveModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover shadow-xs active:scale-95 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Issue Directive</span>
            </button>
          </div>

          {directives.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center space-y-2">
              <ShieldCheck className="h-10 w-10 text-muted mx-auto" />
              <h4 className="text-sm font-bold text-foreground">No Directives on Record</h4>
              <p className="text-xs text-muted max-w-sm mx-auto">
                No directives, objections, or guidance entries have been issued to this member yet.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setDirectiveModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Send First Directive</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {directives.map((d) => (
                <div
                  key={d.id || d.remark_id}
                  className="rounded-2xl border border-border bg-card p-4 space-y-3 hover:border-primary/40 transition shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground truncate">
                          {d.title || "Directive Item"}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            d.remark_type === "objection"
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              : d.remark_type === "appreciation"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : "bg-primary/10 text-primary border border-primary/20"
                          }`}
                        >
                          {d.remark_type || "Instruction"}
                        </span>
                        <span className="text-[10px] font-semibold text-muted">
                          Priority: <strong className="uppercase">{d.priority || "Medium"}</strong>
                        </span>
                      </div>
                      <p className="text-[11px] text-muted">
                        Issued by: <strong>{d.senior_user?.name || "Senior Authority"}</strong> on{" "}
                        {formatPlanDate(d.created_at)}
                      </p>
                    </div>

                    <div className="shrink-0">
                      <span
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase ${
                          d.status === "pending_response"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {d.status === "pending_response" ? "Pending Response" : "Resolved"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-surface-muted/50 p-3 rounded-xl border border-border/60 text-xs text-foreground">
                    <p className="whitespace-pre-wrap">{d.remark}</p>
                  </div>

                  {d.resolution_remarks && (
                    <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300">
                      <span className="font-bold block mb-0.5">Resolution Notes:</span>
                      <p className="whitespace-pre-wrap">{d.resolution_remarks}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                    <span className="text-muted">
                      {d.followup_remarks?.length || 0} follow-up thread updates
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveThreadItem(d)}
                      className="inline-flex items-center gap-1 font-bold text-primary hover:underline cursor-pointer"
                    >
                      <span>Open Thread &amp; Follow-up</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PASSBOOK & LEDGER */}
      {activeTab === "passbook" && (
        <div className="space-y-4">
          {/* Summary Financial Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
              <span className="text-xs font-bold text-muted uppercase">Net Position</span>
              <div className="text-2xl font-black text-foreground mt-1">
                ₹{passbookData?.current_net_position ?? 0}
              </div>
              <span className="text-[11px] text-muted">Running ledger position</span>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
              <span className="text-xs font-bold text-muted uppercase">Advance Balance</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                ₹{passbookData?.current_advance_balance ?? 0}
              </div>
              <span className="text-[11px] text-muted">Tour &amp; travel advances held</span>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
              <span className="text-xs font-bold text-muted uppercase">Claims Receivable</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                ₹{passbookData?.current_claim_receivable ?? passbookData?.approved_claim_amount ?? 0}
              </div>
              <span className="text-[11px] text-muted">Approved / submitted claims pending payout</span>
            </div>
          </div>

          {/* Passbook Entries Table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="p-3.5 border-b border-border bg-surface-muted/40 flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Receipt className="h-4 w-4 text-primary" />
                <span>Passbook Transaction Timeline</span>
              </h3>
              <Link
                href={`/dashboard/expenses?search=${encodeURIComponent(memberName)}`}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>Full Passbook View</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-muted border-b border-border text-[11px] font-bold text-muted uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Particulars / Details</th>
                    <th className="px-4 py-3">Claim Impact</th>
                    <th className="px-4 py-3">Advance Impact</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingPassbook ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-muted">
                        Loading passbook entries…
                      </td>
                    </tr>
                  ) : !passbookData?.entries || passbookData.entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-muted">
                        No financial passbook transactions on record for this member.
                      </td>
                    </tr>
                  ) : (
                    passbookData.entries.map((e: any, idx: number) => (
                      <tr key={e._id || e.id || idx} className="hover:bg-surface-muted/50 transition">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                          {formatPlanDate(e.date || e.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              e.entry_type === "advance" || e.type === "advance"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {e.entry_type || e.type || "Ledger Entry"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium max-w-xs truncate">
                          {e.title || e.details || e.remarks || e.description || e.reference || "Transaction"}
                        </td>
                        <td className="px-4 py-3 font-bold text-amber-600 dark:text-amber-400">
                          {e.impact_claim_receivable || e.debit ? `₹${e.impact_claim_receivable || e.debit}` : "—"}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                          {e.impact_advance_balance || e.credit ? `₹${e.impact_advance_balance || e.credit}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="rounded-md bg-surface-muted border border-border px-2 py-0.5 text-[10px] font-bold text-foreground uppercase">
                            {e.settlement_status || e.status || "Settled"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Copy Plan Modal */}
      {copyTarget && (
        <CopyWorkPlanModal
          open={Boolean(copyTarget)}
          sourcePlanId={String(copyTarget._id || copyTarget.id)}
          sourcePlanDate={copyTarget.plan_date}
          sourcePlanType={copyTarget.plan_type}
          sourceExecutiveName={salesUserLabel(copyTarget.sales_user)}
          sourceSalesUserId={
            typeof copyTarget.sales_user === "object" && copyTarget.sales_user
              ? String(copyTarget.sales_user._id || copyTarget.sales_user.id)
              : String(copyTarget.sales_user || "")
          }
          onClose={() => setCopyTarget(null)}
        />
      )}

      {/* Delete Plan Modal */}
      {deleteTarget && (
        <ConfirmDeleteWorkPlanModal
          planId={deleteTarget.id}
          planLabel={deleteTarget.label}
          isDeleting={isDeleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* Export Modal */}
      {downloadOpen && (
        <DownloadWorkPlansModal
          open={downloadOpen}
          plans={filteredPlans}
          onClose={() => setDownloadOpen(false)}
        />
      )}

      {/* Directive Thread Modal */}
      {activeThreadItem && (
        <DirectiveThreadModal
          open={Boolean(activeThreadItem)}
          item={activeThreadItem}
          onClose={() => setActiveThreadItem(null)}
          onSuccess={() => {
            refetchRemarks();
          }}
        />
      )}

      {/* Senior Remarks Modal */}
      {directiveModalOpen && (
        <SeniorRemarksModal
          open={directiveModalOpen}
          itemType="plan"
          title={`Directive for ${memberName}`}
          planId={allPlans[0] ? planIdOf(allPlans[0]) : "000000000000000000000000"}
          itemId={userId}
          assigneeName={memberName}
          onClose={() => setDirectiveModalOpen(false)}
          onSuccess={() => {
            setDirectiveModalOpen(false);
            refetchRemarks();
            toast.success("Directive issued successfully");
          }}
        />
      )}
    </div>
  );
}

export default UserSpecificDetailsPage;
