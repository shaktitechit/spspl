"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Copy,
  Download,
  ExternalLink,
  Plus,
  RefreshCw,
  Trash2,
  Search,
  FileSpreadsheet,
  MessageSquare,
  Users,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetPlansQuery,
  useDeletePlanMutation,
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
import type { WorkPlanRecord } from "@/types/workPlanner";
import { ConfirmDeleteWorkPlanModal } from "./ConfirmDeleteWorkPlanModal";
import { DownloadWorkPlansModal } from "./DownloadWorkPlansModal";
import { DownloadExpensesModal } from "../expenses/DownloadExpensesModal";
import { CopyWorkPlanModal } from "./CopyWorkPlanModal";
import {
  WORK_PLAN_STATUS_TABS,
  WORK_PLAN_TYPE_TABS,
  canEditPlan,
  formatDiscussionMethod,
  formatPlanDate,
  planActivityLabel,
  planIdOf,
  renderPlanStatusBadge,
  salesUserLabel,
} from "../shared/workPlanUtils";

export function TeamPlansPage() {
  const searchParams = useSearchParams();

  const session = readSessionFromStorage();
  const user = session?.user;
  const currentUserId = String(user?._id || (user as any)?.id || "");
  const adminRole = isWpAdmin(user);
  const managerRole = isWpManager(user);
  const coordinatorRole = isWpCoordinator(user);
  const elevatedRole = isWpElevated(user);

  const initialStatus = searchParams.get("status") || "all";
  const initialPlanType = searchParams.get("plan_type") || "all";
  const initialSearch = searchParams.get("search") || searchParams.get("q") || "";
  const initialExecutive = searchParams.get("sales_user") || searchParams.get("user") || "all";

  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [planTypeFilter, setPlanTypeFilter] = useState(initialPlanType);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedExecutiveFilter, setSelectedExecutiveFilter] = useState<string>(initialExecutive);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [expenseReportOpen, setExpenseReportOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<WorkPlanRecord | null>(null);

  // Load team members
  const { data: myTeamData, isLoading: loadingTeam } = useGetMyTeamQuery(undefined, {
    skip: !elevatedRole,
  });
  const { data: usersData } = useGetUsersQuery(undefined, {
    skip: !adminRole,
  });

  // Extract distinct team / portal members, strictly excluding self
  const teamMembers = useMemo(() => {
    const list: Array<{ _id: string; name: string; email?: string; department?: string; role?: string }> = [];
    const seen = new Set<string>();

    const addMember = (m: any) => {
      if (!m) return;
      const mId = String(m._id || m.id || "");
      if (!mId || mId === currentUserId || seen.has(mId)) return;
      seen.add(mId);
      list.push({
        _id: mId,
        name: m.name || m.email || "Unnamed Member",
        email: m.email || "",
        department: m.department || "",
        role: m.wp_role || m.role || "",
      });
    };

    if (Array.isArray(myTeamData?.members)) {
      myTeamData.members.forEach(addMember);
    }
    if (adminRole && Array.isArray(usersData)) {
      usersData.filter((u) => hasWorkPlannerPortalAccess(u)).forEach(addMember);
    }
    return list;
  }, [myTeamData, usersData, adminRole, currentUserId]);

  const [deletePlanMut] = useDeletePlanMutation();

  const queryParams = useMemo(() => {
    const q: Record<string, string | number | undefined> = {
      page: currentPage,
      limit: itemsPerPage,
      scope: "team",
    };
    if (statusFilter && statusFilter !== "all") q.status = statusFilter;
    if (planTypeFilter && planTypeFilter !== "all") q.plan_type = planTypeFilter;
    if (dateFrom) q.from = dateFrom;
    if (dateTo) q.to = dateTo;
    if (selectedExecutiveFilter && selectedExecutiveFilter !== "all") {
      q.sales_user = selectedExecutiveFilter;
    }
    return q;
  }, [
    currentPage,
    itemsPerPage,
    statusFilter,
    planTypeFilter,
    dateFrom,
    dateTo,
    selectedExecutiveFilter,
  ]);

  const { data: plansRes, isLoading: loading, refetch: loadData } = useGetPlansQuery(queryParams, {
    skip: !elevatedRole,
  });

  const rawPlans = plansRes?.data || [];
  const total = plansRes?.total || 0;
  const pages = plansRes?.pages || 0;

  // STRICTLY filter out current user's plans so Team Plans contains team's content only!
  const teamPlans = useMemo(() => {
    return rawPlans.filter((r) => {
      const planSalesId =
        typeof r.sales_user === "object" && r.sales_user
          ? String(r.sales_user._id || r.sales_user.id || "")
          : String(r.sales_user || "");
      // Exclude self unless current user is explicitly filtered by param
      if (selectedExecutiveFilter === "all" && planSalesId && planSalesId === currentUserId) {
        return false;
      }
      return true;
    });
  }, [rawPlans, currentUserId, selectedExecutiveFilter]);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const filteredPlans = useMemo(() => {
    let list = teamPlans;

    // Filter by selected executive if set locally as well
    if (selectedExecutiveFilter && selectedExecutiveFilter !== "all") {
      list = list.filter((r) => {
        const planSalesId =
          typeof r.sales_user === "object" && r.sales_user
            ? String(r.sales_user._id || r.sales_user.id || "")
            : String(r.sales_user || "");
        return planSalesId === selectedExecutiveFilter;
      });
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((r) => {
      const sales = salesUserLabel(r.sales_user).toLowerCase();
      const remarks = (r.remarks || "").toLowerCase();
      const location = (r.location || "").toLowerCase();
      const status = (r.status || "").toLowerCase();
      const planType = (r.plan_type || "visits").toLowerCase();
      const managerName = (
        r.discussed_manager_name ||
        (typeof r.discussed_manager_id === "object"
          ? r.discussed_manager_id?.name
          : "") ||
        ""
      ).toLowerCase();
      const method = (r.discussion_method || "").toLowerCase();
      return (
        sales.includes(q) ||
        remarks.includes(q) ||
        location.includes(q) ||
        status.includes(q) ||
        planType.includes(q) ||
        managerName.includes(q) ||
        method.includes(q)
      );
    });
  }, [teamPlans, searchQuery, selectedExecutiveFilter]);

  // Team metrics
  const metrics = useMemo(() => {
    const planned = teamPlans.filter((p) => p.status === "planned").length;
    const approved = teamPlans.filter((p) => p.status === "approved").length;
    const completed = teamPlans.filter((p) => p.status === "completed").length;
    const activeMembers = new Set(
      teamPlans.map((p) =>
        typeof p.sales_user === "object" && p.sales_user
          ? String(p.sales_user._id || p.sales_user.id)
          : String(p.sales_user || "")
      )
    ).size;
    return {
      total: teamPlans.length,
      planned,
      approved,
      completed,
      activeMembers,
    };
  }, [teamPlans]);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deletePlanMut(deleteTarget.id).unwrap();
      toast.success("Work plan deleted");
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete plan";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  }

  if (!elevatedRole) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3 font-sans max-w-lg mx-auto mt-8">
        <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="text-base font-bold text-foreground">Access Restricted</h2>
        <p className="text-xs text-muted">
          Team Work Plans are reserved for Senior Authority roles (Coordinators, Managers, and Admins).
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard/plans"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover shadow-xs active:scale-95 transition"
          >
            Go to My Plans
          </Link>
        </div>
      </div>
    );
  }

  const selectedMemberObj = teamMembers.find((m) => m._id === selectedExecutiveFilter);

  return (
    <div className="space-y-4 font-sans w-full max-w-full">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-2xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-foreground">
              Team Work Plans
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
              <Users className="h-3 w-3" />
              <span>{adminRole ? "Portal Admin" : coordinatorRole ? "Coordinator" : "Manager"} View</span>
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-muted mt-0.5">
            {adminRole
              ? "All portal members' work plans — review itineraries, field activity, and approvals"
              : coordinatorRole
              ? "Your team's work plans — coordinate and track team members' planned visits"
              : "Your reporting team's work plans — supervise, review, and track daily field execution"}
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 sm:flex-wrap">
          <Link
            href="/dashboard/plans"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0"
            title="Switch to your personal plans"
          >
            <span>My Plans</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted" />
          </Link>
          <Link
            href="/dashboard/plans/calendar"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0"
          >
            <CalendarDays className="h-4 w-4 text-primary" />
            <span>Calendar</span>
          </Link>
          <button
            type="button"
            onClick={() => setDownloadOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Plans Report</span>
          </button>
          <button
            type="button"
            onClick={() => setExpenseReportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>Expense Report</span>
          </button>
        </div>
      </div>

      {/* Page Switcher Tabs: My Plans vs Team Plans */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 overflow-x-auto scrollbar-none">
        <Link
          href="/dashboard/plans"
          className="rounded-lg px-4 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition text-muted hover:bg-surface-muted hover:text-foreground"
        >
          My Plans
        </Link>
        <Link
          href="/dashboard/plans/team"
          className="rounded-lg px-4 py-1.5 text-xs font-bold whitespace-nowrap active:scale-95 transition bg-primary text-primary-foreground shadow-xs"
        >
          Team Plans
        </Link>
      </div>

      {/* Team Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-semibold">Team Plans</span>
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-1 text-lg sm:text-xl font-bold text-foreground">
            {metrics.total}
          </div>
          <div className="text-[10px] text-muted">Across team members</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-semibold">Active Members</span>
            <Users className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-1 text-lg sm:text-xl font-bold text-foreground">
            {metrics.activeMembers}
          </div>
          <div className="text-[10px] text-muted">With plans on record</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-semibold">Pending Review</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-1 text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">
            {metrics.planned}
          </div>
          <div className="text-[10px] text-muted">Needs managerial action</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-semibold">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-1 text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.completed}
          </div>
          <div className="text-[10px] text-muted">Executed by team</div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1.5 overflow-x-auto scrollbar-none">
        {WORK_PLAN_STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setStatusFilter(tab.id);
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition shrink-0 ${
              statusFilter === tab.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters bar with Portal Member Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 bg-card p-3 rounded-2xl border border-border shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search team member, location, remarks..."
            className="w-full rounded-xl border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Portal Member Filter Dropdown */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs flex-1 sm:flex-initial">
            <Users className="h-3.5 w-3.5 text-primary shrink-0" />
            <select
              value={selectedExecutiveFilter}
              onChange={(e) => {
                setSelectedExecutiveFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="all">
                {adminRole ? "👥 All Portal Members" : "👥 All Team Members"} ({teamMembers.length})
              </option>
              {teamMembers.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name} {member.department ? `• ${member.department}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Plan Type Filter */}
          <select
            value={planTypeFilter}
            onChange={(e) => {
              setPlanTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 sm:flex-initial rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground outline-none focus:border-primary cursor-pointer"
          >
            {WORK_PLAN_TYPE_TABS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-auto rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            />
            <span className="text-xs text-muted shrink-0">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-auto rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="rounded-xl p-2 text-muted hover:bg-surface-muted hover:text-foreground active:scale-95 transition cursor-pointer shrink-0"
            title="Refresh team plans"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Active Member Filter Banner if member is selected */}
      {selectedMemberObj && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2 text-xs font-semibold text-primary">
          <div className="flex items-center gap-2 min-w-0">
            <UserCheck className="h-4 w-4 shrink-0" />
            <span className="truncate">
              Filtering plans for <strong>{selectedMemberObj.name}</strong>
              {selectedMemberObj.department ? ` (${selectedMemberObj.department})` : ""}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/dashboard/plans/team/${selectedMemberObj._id}`}
              className="inline-flex items-center gap-1 font-bold underline hover:opacity-80 text-xs"
            >
              <span>Deep Dive Profile</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={() => {
                setSelectedExecutiveFilter("all");
                setCurrentPage(1);
              }}
              className="text-xs text-muted hover:text-foreground font-semibold cursor-pointer"
            >
              Clear Filter
            </button>
          </div>
        </div>
      )}

      {/* Mobile Touch Cards View (< md) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-xs text-muted">
            Loading team work plans…
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-xs text-muted">
            No team work plans found matching criteria.
          </div>
        ) : (
          filteredPlans.map((r) => {
            const id = planIdOf(r);
            const canEdit = canEditPlan(r.status, { isAdmin: elevatedRole });

            return (
              <div
                key={id}
                className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs transition hover:border-primary/40 active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">
                        {formatPlanDate(r.plan_date)}
                      </span>
                      <span className="inline-flex rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-foreground uppercase tracking-wider">
                        {r.plan_type || "Visits"}
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/plans/team/${
                        typeof r.sales_user === "object" && r.sales_user
                          ? r.sales_user._id || r.sales_user.id
                          : r.sales_user
                      }`}
                      className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline truncate mt-0.5"
                    >
                      <UserCheck className="h-3.5 w-3.5 shrink-0" />
                      <span>{salesUserLabel(r.sales_user)}</span>
                    </Link>
                  </div>
                  <div className="shrink-0">{renderPlanStatusBadge(r.status)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted pt-1 border-t border-border/50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted/80 block">Activity</span>
                    <span className="font-medium text-foreground">{planActivityLabel(r)}</span>
                  </div>
                  {r.location ? (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted/80 block">Location</span>
                      <span className="font-medium text-foreground truncate block">{r.location}</span>
                    </div>
                  ) : null}
                </div>

                {r.is_discussed_with_manager && (
                  <div className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Discussed ({formatDiscussionMethod(r.discussion_method)})</span>
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCopyTarget(r)}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-foreground active:scale-95 transition cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            id,
                            label: `Plan for ${formatPlanDate(r.plan_date)} (${salesUserLabel(r.sales_user)})`,
                          })
                        }
                        className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 active:scale-95 transition cursor-pointer"
                        title="Delete plan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <Link
                    href={`/dashboard/plans/${id}`}
                    className="inline-flex items-center gap-1 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 active:scale-95 transition"
                  >
                    <span>Review Plan</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted border-b border-border text-[11px] font-bold text-muted uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Team Member</th>
                <th className="px-4 py-3">Plan Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Manager Discussion</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-muted">
                    Loading team work plans…
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-muted">
                    No team work plans found matching criteria.
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
                      onClick={() => {
                        window.location.href = `/dashboard/plans/${id}`;
                      }}
                    >
                      {/* Team Member Column */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/dashboard/plans/team/${
                            typeof r.sales_user === "object" && r.sales_user
                              ? r.sales_user._id || r.sales_user.id
                              : r.sales_user
                          }`}
                          className="flex items-center gap-2 min-w-0 group/member hover:opacity-85 transition"
                          title="View member deep dive"
                        >
                          <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xs shrink-0 group-hover/member:bg-primary group-hover/member:text-primary-foreground transition">
                            {salesUserLabel(r.sales_user).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-foreground group-hover/member:text-primary transition block truncate">
                              {salesUserLabel(r.sales_user)}
                            </span>
                            {typeof r.sales_user === "object" && r.sales_user?.department && (
                              <span className="text-[10px] text-muted block truncate">
                                {r.sales_user.department}
                              </span>
                            )}
                          </div>
                        </Link>
                      </td>

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
                            <span className="truncate">
                              {r.discussed_manager_name || "Manager"} ({formatDiscussionMethod(r.discussion_method)})
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted text-[11px]">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/dashboard/plans/team/${
                              typeof r.sales_user === "object" && r.sales_user
                                ? r.sales_user._id || r.sales_user.id
                                : r.sales_user
                            }`}
                            className="rounded-lg border border-border p-1.5 text-muted hover:text-primary hover:bg-surface-muted transition"
                            title="Member Deep Dive Profile"
                          >
                            <User className="h-3.5 w-3.5" />
                          </Link>
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
                                  label: `Plan for ${formatPlanDate(r.plan_date)} (${salesUserLabel(r.sales_user)})`,
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

        {/* Pagination Bar */}
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
            <div className="text-muted">
              Showing page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
              <span className="font-semibold text-foreground">{pages}</span> ({total} total team plans)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 active:scale-95 transition cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= pages || loading}
                onClick={() => setCurrentPage((p) => Math.min(pages, p + 1))}
                className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 active:scale-95 transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

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

      {deleteTarget ? (
        <ConfirmDeleteWorkPlanModal
          planId={deleteTarget.id}
          planLabel={deleteTarget.label}
          isDeleting={isDeleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      {downloadOpen ? (
        <DownloadWorkPlansModal
          open={downloadOpen}
          plans={filteredPlans}
          onClose={() => setDownloadOpen(false)}
        />
      ) : null}

      {expenseReportOpen ? (
        <DownloadExpensesModal
          open={expenseReportOpen}
          onClose={() => setExpenseReportOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default TeamPlansPage;
