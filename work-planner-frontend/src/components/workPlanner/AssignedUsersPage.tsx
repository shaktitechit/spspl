"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  RefreshCw,
  FileText,
  CheckSquare,
  DollarSign,
  ShieldCheck,
  Building2,
  Mail,
  UserCheck,
  Clock,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  Grid,
  List,
  ExternalLink,
  Settings,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import { useGetPlansQuery, useGetExpensesQuery, useGetMyTeamQuery } from "@/store/api/workPlannerApiSlice";
import { isWpAdmin, isWpElevated, isWpManager, isWpCoordinator, hasWorkPlannerPortalAccess, readSessionFromStorage } from "@/utils/authStorage";
import { resolveRoleLabels } from "@/utils/resolveRoleLabels";
import type { WorkPlanRecord, WorkPlanExpenseRecord } from "@/types/workPlanner";
import { formatPlanDate, formatCurrency, salesUserLabel } from "./workPlanUtils";

function getUserDepartmentName(u: any): string {
  if (!u || !u.department) return "";
  if (typeof u.department === "object") {
    return String(u.department.name || u.department.code || u.department.title || "");
  }
  return String(u.department);
}

export type TeamDirectoryMode = "my-team" | "assigned-teams";

export function AssignedUsersPage({ mode = "my-team" }: { mode?: TeamDirectoryMode }) {
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const adminAccess = isWpAdmin(sessionUser);
  const managerAccess = isWpManager(sessionUser);
  const coordinatorAccess = isWpCoordinator(sessionUser);
  const elevatedAccess = isWpElevated(sessionUser);
  const canAccess =
    mode === "assigned-teams" ? adminAccess : elevatedAccess;

  const pageTitle = mode === "assigned-teams" ? "Assigned Teams" : "My Team";
  const pageBadge =
    mode === "assigned-teams"
      ? "Admin View"
      : adminAccess
      ? "Admin View"
      : managerAccess
      ? "Manager View"
      : coordinatorAccess
      ? "Coordinator View"
      : "Team View";
  const pageSubtitle =
    mode === "assigned-teams"
      ? "All Work Planner teams, plan activity, and expense claims across the organisation."
      : "Your direct reports and your own Work Planner activity.";
  const kpiLabel = mode === "assigned-teams" ? "Team Members" : "My Team";
  const accessDeniedTitle = mode === "assigned-teams" ? "Admin Access Required" : "Elevated Access Required";
  const accessDeniedBody =
    mode === "assigned-teams"
      ? "Assigned Teams is restricted to Work Planner admins."
      : "My Team is restricted to coordinators, managers, and administrators.";

  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Queries
  // Admins: fetch full user list from auth service.
  // Managers: the work-planner /team/my-team endpoint already returns full user objects
  //           (name, email, department, portals) — no need to hit the auth API.
  const { data: usersData, isLoading: loadingUsers, refetch: refetchUsers } = useGetUsersQuery(
    undefined,
    { skip: !adminAccess }
  );
  const { data: plansRes, isLoading: loadingPlans, refetch: refetchPlans } = useGetPlansQuery({ limit: 500 });
  const { data: expensesRes, isLoading: loadingExpenses, refetch: refetchExpenses } = useGetExpensesQuery({ limit: 500 });
  const { data: myTeamData, isLoading: loadingMyTeam, refetch: refetchMyTeam } = useGetMyTeamQuery(undefined, {
    skip: !elevatedAccess,
  });

  // rawUsers: for admins use auth API result; for managers use my-team members directly
  const rawUsers = useMemo(() => {
    if (adminAccess) return Array.isArray(usersData) ? (usersData as any[]).filter(hasWorkPlannerPortalAccess) : [];
    // Manager mode: myTeamData.members comes from the WP backend with full user info
    return Array.isArray(myTeamData?.members) ? myTeamData.members : [];
  }, [adminAccess, usersData, myTeamData]);

  const plans: WorkPlanRecord[] = plansRes?.data || [];
  const expenses: WorkPlanExpenseRecord[] = expensesRes?.data || [];


  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, departmentFilter, statusFilter]);

  // Refetch all data
  function handleRefreshAll() {
    if (adminAccess) refetchUsers();
    refetchPlans();
    refetchExpenses();
    refetchMyTeam();
  }

  // Calculate per-user aggregated stats
  const userStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalPlans: number;
        pendingPlans: number;
        approvedPlans: number;
        completedPlans: number;
        todayPlan: WorkPlanRecord | null;
        totalExpensesCount: number;
        totalExpensesAmount: number;
        pendingExpensesCount: number;
        pendingExpensesAmount: number;
      }
    >();

    plans.forEach((p) => {
      const uId =
        typeof p.sales_user === "object" && p.sales_user
          ? p.sales_user._id || p.sales_user.id
          : String(p.sales_user || "");

      if (!uId) return;

      const uEmail =
        typeof p.sales_user === "object" && p.sales_user ? p.sales_user.email?.toLowerCase() : "";

      const keys = [uId, uEmail].filter(Boolean) as string[];

      keys.forEach((key) => {
        let curr = map.get(key);
        if (!curr) {
          curr = {
            totalPlans: 0,
            pendingPlans: 0,
            approvedPlans: 0,
            completedPlans: 0,
            todayPlan: null,
            totalExpensesCount: 0,
            totalExpensesAmount: 0,
            pendingExpensesCount: 0,
            pendingExpensesAmount: 0,
          };
          map.set(key, curr);
        }

        curr.totalPlans++;
        if (p.status === "submitted") curr.pendingPlans++;
        if (p.status === "approved") curr.approvedPlans++;
        if (p.status === "completed") curr.completedPlans++;

        // Today check
        const todayStr = new Date().toISOString().split("T")[0];
        const pDateStr = p.plan_date ? String(p.plan_date).split("T")[0] : "";
        if (pDateStr === todayStr) {
          curr.todayPlan = p;
        }
      });
    });

    expenses.forEach((e) => {
      const user =
        (typeof e.sales_user === "object" && e.sales_user ? e.sales_user : null) ||
        (typeof e.work_plan === "object" && e.work_plan && typeof (e.work_plan as any).sales_user === "object"
          ? (e.work_plan as any).sales_user
          : null) ||
        (typeof e.created_by === "object" && e.created_by ? e.created_by : null);

      const uId =
        typeof user === "object" && user
          ? String(user._id || (user as any).id || "")
          : typeof e.sales_user === "string"
          ? e.sales_user
          : typeof e.created_by === "string"
          ? e.created_by
          : "";

      const uEmail =
        typeof user === "object" && user && user.email ? user.email.toLowerCase().trim() : "";

      const keys = [uId, uEmail].filter(Boolean) as string[];

      keys.forEach((key) => {
        let curr = map.get(key);
        if (!curr) {
          curr = {
            totalPlans: 0,
            pendingPlans: 0,
            approvedPlans: 0,
            completedPlans: 0,
            todayPlan: null,
            totalExpensesCount: 0,
            totalExpensesAmount: 0,
            pendingExpensesCount: 0,
            pendingExpensesAmount: 0,
          };
          map.set(key, curr);
        }

        curr.totalExpensesCount++;
        curr.totalExpensesAmount += Number(e.amount || 0);

        if (e.status === "submitted") {
          curr.pendingExpensesCount++;
          curr.pendingExpensesAmount += Number(e.amount || 0);
        }
      });
    });

    return map;
  }, [plans, expenses]);

  // Departments list for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    rawUsers.forEach((u: any) => {
      const dept = getUserDepartmentName(u);
      if (dept) set.add(dept);
    });
    return Array.from(set).sort();
  }, [rawUsers]);

  // Filtered assigned users list (only assigned Work Planner users)
  const filteredUsers = useMemo(() => {
    return rawUsers.filter((u: any) => {
      const uId = String(u._id || u.id || "");
      const uEmail = (u.email || "").toLowerCase();
      const stats = userStatsMap.get(uId) || userStatsMap.get(uEmail);
      const userDept = getUserDepartmentName(u);

      // For admins (full auth user list): only show WP-assigned users.
      // For managers: rawUsers is already myTeamData.members (all WP team members), so skip gate.
      if (adminAccess) {
        const isWorkPlannerAssigned =
          hasWorkPlannerPortalAccess(u) || Boolean(stats && (stats.totalPlans > 0 || stats.totalExpensesCount > 0));
        if (!isWorkPlannerAssigned) return false;
      }


      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (u.name || "").toLowerCase();
        const dept = userDept.toLowerCase();
        const email = uEmail;
        if (!name.includes(q) && !dept.includes(q) && !email.includes(q)) {
          return false;
        }
      }

      // Department filter
      if (departmentFilter !== "all" && userDept !== departmentFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === "pending_approvals") {
        const hasPending = (stats?.pendingPlans || 0) > 0 || (stats?.pendingExpensesCount || 0) > 0;
        if (!hasPending) return false;
      } else if (statusFilter === "active_today") {
        if (!stats?.todayPlan) return false;
      } else if (statusFilter === "has_plans") {
        if ((stats?.totalPlans || 0) === 0) return false;
      }

      return true;
    });
  }, [rawUsers, adminAccess, searchQuery, departmentFilter, statusFilter, userStatsMap]);

  // Total pages and paginated users
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  }, [filteredUsers.length, itemsPerPage]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  // Overall Manager Summary Stats
  const summaryStats = useMemo(() => {
    let pendingPlansTotal = 0;
    let pendingExpensesTotal = 0;
    let activeTodayTotal = 0;
    let totalAssignedCount = 0;

    rawUsers.forEach((u: any) => {
      const uId = String(u._id || u.id || "");
      const uEmail = (u.email || "").toLowerCase();
      const stats = userStatsMap.get(uId) || userStatsMap.get(uEmail);

      // For admins: apply WP portal gate. For managers: all rawUsers are WP team members.
      const isIncluded = adminAccess
        ? hasWorkPlannerPortalAccess(u) || Boolean(stats && (stats.totalPlans > 0 || stats.totalExpensesCount > 0))
        : true;

      if (isIncluded) {
        totalAssignedCount++;
        if (stats) {
          pendingPlansTotal += stats.pendingPlans;
          pendingExpensesTotal += stats.pendingExpensesCount;
          if (stats.todayPlan) activeTodayTotal++;
        }
      }
    });

    return {
      totalAssignedUsers: totalAssignedCount,
      activeToday: activeTodayTotal,
      pendingPlans: pendingPlansTotal,
      pendingExpenses: pendingExpensesTotal,
    };
  }, [rawUsers, adminAccess, userStatsMap]);

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4 border border-amber-500/20 shadow-lg">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{accessDeniedTitle}</h2>
        <p className="mt-2 text-sm text-muted max-w-md">{accessDeniedBody}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition shadow-sm"
        >
          Return to Dashboard Overview
        </Link>
      </div>
    );
  }

  const isLoading = (adminAccess ? loadingUsers : loadingMyTeam) || loadingPlans || loadingExpenses;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                {pageTitle}
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                  <ShieldCheck className="h-3 w-3" />
                  {pageBadge}
                </span>
              </h1>
              <p className="text-xs text-muted mt-0.5">
                {pageSubtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-2xs disabled:opacity-50"
            title="Refresh Users & Metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">{kpiLabel}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">{summaryStats.totalAssignedUsers}</span>
            <span className="text-[11px] text-muted font-medium">Work Planner Users</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Active Today</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-500">{summaryStats.activeToday}</span>
            <span className="text-[11px] text-muted font-medium">With work plans</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Pending Plans</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-500">{summaryStats.pendingPlans}</span>
            <span className="text-[11px] text-muted font-medium">Need manager review</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Pending Expenses</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-500">{summaryStats.pendingExpenses}</span>
            <span className="text-[11px] text-muted font-medium">Awaiting approval</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-2xl border border-border shadow-2xs">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assigned user by name, email, department..."
              className="w-full rounded-xl border border-border bg-background py-2 left-3 pl-9 pr-4 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="pending_approvals">Pending Manager Approvals</option>
            <option value="active_today">Active Work Plan Today</option>
            <option value="has_plans">Has Submitted Work Plans</option>
          </select>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 border-l border-border pl-3">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`p-2 rounded-xl transition ${
              viewMode === "table"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="Tabular View (Default)"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-xl transition ${
              viewMode === "grid"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="Grid View"
          >
            <Grid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Users Display Section */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-xs font-semibold text-muted">Loading assigned users and team activity...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-muted mb-3">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">No Assigned Work Planner Users Found</h3>
          <p className="mt-1 text-xs text-muted max-w-sm">
            {searchQuery || departmentFilter !== "all" || statusFilter !== "all"
              ? "No assigned Work Planner team members matched your current filter criteria."
              : "No users currently assigned to Work Planner portal."}
          </p>
          {(searchQuery || departmentFilter !== "all" || statusFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setDepartmentFilter("all");
                setStatusFilter("all");
              }}
              className="mt-4 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-primary hover:bg-surface-muted transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* TABULAR VIEW (DEFAULT) */
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3.5">Assigned User</th>
                  <th className="px-4 py-3.5">Department & Roles</th>
                  <th className="px-4 py-3.5">Total Work Plans</th>
                  <th className="px-4 py-3.5">Expense Claims</th>
                  <th className="px-4 py-3.5 text-right">Manager Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium">
                {paginatedUsers.map((u: any) => {
                  const uId = String(u._id || u.id || "");
                  const uEmail = (u.email || "").toLowerCase();
                  const stats = userStatsMap.get(uId) || userStatsMap.get(uEmail);
                  const name = typeof u.name === "string" ? u.name : u.email || "Unnamed User";
                  const userDept = getUserDepartmentName(u);
                  const roleLabels = resolveRoleLabels(u);

                  return (
                    <tr key={uId} className="hover:bg-surface-muted/40 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-xs shadow-2xs">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-foreground truncate">{name}</div>
                            <div className="text-[10px] text-muted truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {userDept && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-muted text-foreground border border-border">
                              <Building2 className="h-3 w-3 text-muted" />
                              {userDept}
                            </span>
                          )}
                          {roleLabels.map((r: string) => (
                            <span
                              key={r}
                              className="inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-bold text-foreground">
                        <div>{stats?.totalPlans || 0} plan(s)</div>
                        {Boolean(stats?.pendingPlans) && (
                          <div className="text-[10px] text-amber-500 font-bold">
                            {stats?.pendingPlans} pending approval
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground">
                          {formatCurrency(stats?.totalExpensesAmount || 0)}
                        </div>
                        <div className="text-[10px] text-muted">
                          {stats?.totalExpensesCount || 0} claim(s)
                          {Boolean(stats?.pendingExpensesCount) && (
                            <span className="text-rose-500 font-bold ml-1">
                              ({stats?.pendingExpensesCount} pend)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/dashboard/plans?search=${encodeURIComponent(name)}`}
                            className="rounded-lg border border-border p-1.5 text-muted hover:text-primary hover:border-primary/30 transition"
                            title="View Work Plans"
                          >
                            <FileText className="h-4 w-4" />
                          </Link>
                          <Link
                            href={`/dashboard/expenses?search=${encodeURIComponent(name)}`}
                            className="rounded-lg border border-border p-1.5 text-muted hover:text-primary hover:border-primary/30 transition"
                            title="View Expense Claims"
                          >
                            <DollarSign className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setSelectedUser(u)}
                            className="rounded-lg border border-border p-1.5 text-muted hover:text-primary hover:border-primary/30 transition"
                            title="View User Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <Link
                            href={`/dashboard/assigned-users/${uId}`}
                            className="rounded-lg bg-primary/10 border border-primary/20 p-1.5 text-primary hover:bg-primary hover:text-primary-foreground transition"
                            title="Configure User Settings"
                          >
                            <Settings className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedUsers.map((u: any) => {
            const uId = String(u._id || u.id || "");
            const uEmail = (u.email || "").toLowerCase();
            const stats = userStatsMap.get(uId) || userStatsMap.get(uEmail);

            const hasPendingPlans = (stats?.pendingPlans || 0) > 0;
            const hasPendingExpenses = (stats?.pendingExpensesCount || 0) > 0;

            const name = typeof u.name === "string" ? u.name : u.email || "Unnamed User";
            const initial = name.charAt(0).toUpperCase();

            const userDept = getUserDepartmentName(u);
            const roleLabels = resolveRoleLabels(u);

            return (
              <div
                key={uId}
                className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-2xs hover:border-primary/40 hover:shadow-xs transition duration-200"
              >
                <div>
                  {/* Top Header line */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 text-primary font-black text-base shadow-2xs">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition">
                          {name}
                        </h3>
                        <p className="text-[11px] text-muted truncate flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3 shrink-0" />
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Department & Role badges */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    {userDept && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-surface-muted text-foreground border border-border">
                        <Building2 className="h-3 w-3 text-muted" />
                        {userDept}
                      </span>
                    )}
                    {roleLabels.map((r: string) => (
                      <span
                        key={r}
                        className="inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20"
                      >
                        {r}
                      </span>
                    ))}
                  </div>

                  {/* Metrics Stats Pills */}
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3.5">
                    <div className="rounded-xl bg-surface-muted/60 p-2.5 border border-border/40">
                      <div className="flex items-center justify-between text-[10px] text-muted font-bold uppercase tracking-wider">
                        <span>Work Plans</span>
                        <FileText className="h-3 w-3 text-muted" />
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-sm font-black text-foreground">
                          {stats?.totalPlans || 0}
                        </span>
                        {hasPendingPlans && (
                          <span className="text-[10px] font-extrabold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">
                            {stats?.pendingPlans} pending
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl bg-surface-muted/60 p-2.5 border border-border/40">
                      <div className="flex items-center justify-between text-[10px] text-muted font-bold uppercase tracking-wider">
                        <span>Expenses</span>
                        <DollarSign className="h-3 w-3 text-muted" />
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-xs font-black text-foreground">
                          {formatCurrency(stats?.totalExpensesAmount || 0)}
                        </span>
                        {hasPendingExpenses && (
                          <span className="text-[10px] font-extrabold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-full border border-rose-500/20">
                            {stats?.pendingExpensesCount} pend
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Manager Quick Actions */}
                <div className="mt-5 border-t border-border/60 pt-3.5 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/dashboard/plans?search=${encodeURIComponent(name)}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition"
                      title="View user work plans"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Plans
                    </Link>
                    <Link
                      href={`/dashboard/expenses?search=${encodeURIComponent(name)}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition"
                      title="View user expenses"
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                      Expenses
                    </Link>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedUser(u)}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:text-foreground transition"
                      title="User Activity Summary"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Details
                    </button>
                    <Link
                      href={`/dashboard/assigned-users/${uId}`}
                      className="inline-flex items-center gap-1 rounded-xl bg-primary/10 border border-primary/20 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition"
                      title="Configure User Settings"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {filteredUsers.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-3.5 rounded-2xl border border-border shadow-2xs">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted font-medium">
            <span>
              Showing <strong className="text-foreground font-bold">{Math.min(filteredUsers.length, (currentPage - 1) * itemsPerPage + 1)}</strong> to{" "}
              <strong className="text-foreground font-bold">{Math.min(filteredUsers.length, currentPage * itemsPerPage)}</strong> of{" "}
              <strong className="text-foreground font-bold">{filteredUsers.length}</strong> assigned users
            </span>
            <div className="flex items-center gap-1 border-l border-border pl-2 text-muted">
              <span>Per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>

            <div className="px-2 text-xs font-bold text-foreground">
              Page {currentPage} of {totalPages}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition disabled:opacity-40 disabled:pointer-events-none"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* USER DETAIL MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30 text-primary font-black text-lg">
                  {(selectedUser.name || selectedUser.email || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {selectedUser.name || selectedUser.email}
                  </h3>
                  <p className="text-xs text-muted">{selectedUser.email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-xl p-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* User Profile Info */}
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-muted/40 p-4 border border-border/50 text-xs">
                <div>
                  <span className="text-muted block text-[10px] font-bold uppercase tracking-wider">Department</span>
                  <span className="font-bold text-foreground mt-0.5 block">{getUserDepartmentName(selectedUser) || "Not specified"}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] font-bold uppercase tracking-wider">User ID</span>
                  <span className="font-mono text-muted text-[11px] mt-0.5 block truncate">{selectedUser._id || selectedUser.id}</span>
                </div>
              </div>

              {/* Work Plans Overview for this user */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                    Work Plans Summary
                  </h4>
                  <Link
                    href={`/dashboard/plans?search=${encodeURIComponent(selectedUser.name || selectedUser.email)}`}
                    onClick={() => setSelectedUser(null)}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    View All Plans <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                {plans.filter((p) => {
                  const s = salesUserLabel(p.sales_user).toLowerCase();
                  return s.includes((selectedUser.name || "").toLowerCase()) || s.includes((selectedUser.email || "").toLowerCase());
                }).length === 0 ? (
                  <p className="text-xs text-muted italic bg-surface-muted/30 p-3 rounded-xl">No work plans created by this user yet.</p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {plans
                      .filter((p) => {
                        const s = salesUserLabel(p.sales_user).toLowerCase();
                        return s.includes((selectedUser.name || "").toLowerCase()) || s.includes((selectedUser.email || "").toLowerCase());
                      })
                      .slice(0, 5)
                      .map((p) => (
                        <div key={p._id || p.id} className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-background text-xs">
                          <div>
                            <span className="font-bold text-foreground">{formatPlanDate(p.plan_date)}</span>
                            <span className="text-muted text-[10px] ml-2">({p.plan_type || "Visits"})</span>
                          </div>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            p.status === "approved" ? "bg-emerald-500/15 text-emerald-500" :
                            p.status === "submitted" ? "bg-amber-500/15 text-amber-500" : "bg-surface-muted text-muted"
                          }`}>
                            {p.status}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Expenses Overview for this user */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                    Expense Claims Summary
                  </h4>
                  <Link
                    href={`/dashboard/expenses?search=${encodeURIComponent(selectedUser.name || selectedUser.email)}`}
                    onClick={() => setSelectedUser(null)}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    View All Expenses <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                {expenses.filter((e) => {
                  const user =
                    (typeof e.sales_user === "object" && e.sales_user ? e.sales_user : null) ||
                    (typeof e.work_plan === "object" && e.work_plan && typeof (e.work_plan as any).sales_user === "object"
                      ? (e.work_plan as any).sales_user
                      : null) ||
                    (typeof e.created_by === "object" && e.created_by ? e.created_by : null);
                  const uId = typeof user === "object" && user ? String(user._id || (user as any).id || "") : String(e.sales_user || e.created_by || "");
                  const uEmail = (typeof user === "object" && user?.email ? user.email : "").toLowerCase();
                  const targetId = String(selectedUser._id || selectedUser.id || "");
                  const targetEmail = (selectedUser.email || "").toLowerCase();
                  if (targetId && uId && targetId === uId) return true;
                  if (targetEmail && uEmail && targetEmail === uEmail) return true;
                  const s = salesUserLabel(user).toLowerCase();
                  return (
                    (selectedUser.name && s.includes(selectedUser.name.toLowerCase())) ||
                    (targetEmail && s.includes(targetEmail))
                  );
                }).length === 0 ? (
                  <p className="text-xs text-muted italic bg-surface-muted/30 p-3 rounded-xl">No expense claims filed by this user yet.</p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {expenses
                      .filter((e) => {
                        const user =
                          (typeof e.sales_user === "object" && e.sales_user ? e.sales_user : null) ||
                          (typeof e.work_plan === "object" && e.work_plan && typeof (e.work_plan as any).sales_user === "object"
                            ? (e.work_plan as any).sales_user
                            : null) ||
                          (typeof e.created_by === "object" && e.created_by ? e.created_by : null);
                        const uId = typeof user === "object" && user ? String(user._id || (user as any).id || "") : String(e.sales_user || e.created_by || "");
                        const uEmail = (typeof user === "object" && user?.email ? user.email : "").toLowerCase();
                        const targetId = String(selectedUser._id || selectedUser.id || "");
                        const targetEmail = (selectedUser.email || "").toLowerCase();
                        if (targetId && uId && targetId === uId) return true;
                        if (targetEmail && uEmail && targetEmail === uEmail) return true;
                        const s = salesUserLabel(user).toLowerCase();
                        return (
                          (selectedUser.name && s.includes(selectedUser.name.toLowerCase())) ||
                          (targetEmail && s.includes(targetEmail))
                        );
                      })
                      .slice(0, 5)
                      .map((e) => (
                        <div key={e._id || e.id} className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-background text-xs">
                          <div>
                            <span className="font-bold text-foreground">{e.category}</span>
                            <span className="text-muted text-[10px] ml-2">({formatCurrency(e.amount)})</span>
                          </div>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            e.status === "approved" ? "bg-emerald-500/15 text-emerald-500" :
                            e.status === "submitted" ? "bg-rose-500/15 text-rose-500" : "bg-surface-muted text-muted"
                          }`}>
                            {e.status}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border p-4 bg-surface-muted/30 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
