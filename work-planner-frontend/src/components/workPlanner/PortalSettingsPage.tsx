"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Settings,
  ShieldCheck,
  Users,
  Search,
  Filter,
  ArrowRight,
  Layers,
  Sparkles,
  CheckCircle2,
  Briefcase,
  Building2,
  Mail,
  Sliders,
  Compass,
  FileText,
  Save,
  RotateCcw,
  Download,
  Clock,
  MapPin,
  IndianRupee,
  Bell,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import {
  useGetUserTasksSummaryQuery,
  useGetUserVisitTemplatesSummaryQuery,
} from "@/store/api/workPlannerApiSlice";
import {
  isWpAdmin,
  hasWorkPlannerPortalAccess,
  readSessionFromStorage,
} from "@/utils/authStorage";
import {
  getPortalAdminSettings,
  savePortalAdminSettings,
  resetPortalAdminSettings,
  exportPortalAdminSettingsJson,
  type PortalAdminSettings,
} from "@/utils/portalAdminSettings";

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getUserDepartmentName(u: any): string {
  if (!u || !u.department) return "Field Staff";
  if (typeof u.department === "object") {
    return String(u.department.name || u.department.code || u.department.title || "Field Staff");
  }
  return String(u.department);
}

export function PortalSettingsPage() {
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const adminAccess = isWpAdmin(sessionUser);

  const { data: usersData, isLoading: loadingUsers } = useGetUsersQuery(undefined, {
    skip: !adminAccess,
  });
  const { data: tasksSummary } = useGetUserTasksSummaryQuery(undefined, {
    skip: !adminAccess,
  });
  const { data: visitsSummary } = useGetUserVisitTemplatesSummaryQuery(undefined, {
    skip: !adminAccess,
  });

  // Active Tab: Unified Tasks & Visits vs Portal Policies
  const [activeTab, setActiveTab] = useState<"tasks_and_visits" | "portal_policies">("tasks_and_visits");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedDept, setSelectedDept] = useState<string>("all");

  // Portal Admin Settings Form State
  const [portalSettings, setPortalSettings] = useState<PortalAdminSettings>(getPortalAdminSettings());
  const [hasUnsavedPolicies, setHasUnsavedPolicies] = useState(false);

  useEffect(() => {
    setPortalSettings(getPortalAdminSettings());
  }, []);

  const handleUpdatePolicy = <K extends keyof PortalAdminSettings>(key: K, value: PortalAdminSettings[K]) => {
    setPortalSettings((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedPolicies(true);
  };

  const handleSavePolicies = () => {
    savePortalAdminSettings(portalSettings, sessionUser?.name || "Portal Admin");
    setHasUnsavedPolicies(false);
    toast.success("Portal governance policies saved!", {
      description: "Administrative rules updated successfully.",
    });
  };

  const handleResetPolicies = () => {
    const defaults = resetPortalAdminSettings(sessionUser?.name || "Portal Admin");
    setPortalSettings(defaults);
    setHasUnsavedPolicies(false);
    toast.info("Portal policies reset to system defaults.");
  };

  const handleExportPolicies = () => {
    const jsonStr = exportPortalAdminSettingsJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portal-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Configuration exported to JSON file");
  };

  // Portal Users
  const portalUsers = useMemo(() => {
    if (!Array.isArray(usersData)) return [];
    return usersData.filter(hasWorkPlannerPortalAccess);
  }, [usersData]);

  // Distinct departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    portalUsers.forEach((u: any) => {
      const d = getUserDepartmentName(u);
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [portalUsers]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return portalUsers.filter((u: any) => {
      const name = String(u.name || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      const username = String(u.username || "").toLowerCase();
      const dept = getUserDepartmentName(u).toLowerCase();
      const role = String(u.wp_role || "executive").toLowerCase();

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = name.includes(q) || email.includes(q) || username.includes(q) || dept.includes(q);
        if (!matches) return false;
      }

      // Role filter
      if (selectedRole !== "all" && role !== selectedRole.toLowerCase()) {
        return false;
      }

      // Department filter
      if (selectedDept !== "all" && dept !== selectedDept.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [portalUsers, searchQuery, selectedRole, selectedDept]);

  if (!adminAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] p-6 text-center animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500 mb-5 border border-amber-500/20 shadow-xl shadow-amber-500/5">
          <ShieldCheck className="h-10 w-10" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold uppercase tracking-wider mb-2 border border-rose-500/20">
          Admin Portal Only
        </div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Access Restricted</h2>
        <p className="mt-2 text-sm text-muted max-w-md leading-relaxed">
          The Portal Settings module is exclusively available to Work Planner Portal Administrators.
          You do not have permission to view or modify administrative configurations.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-95 transition shadow-sm"
        >
          Return to Dashboard Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans pb-28 max-w-7xl mx-auto">
      {/* Top Header Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-md shadow-primary/25 shrink-0">
              <Settings className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  Portal Settings &amp; Governance
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-300 border border-purple-500/20">
                  <ShieldCheck className="h-3 w-3" />
                  Portal Admin
                </span>
              </div>
              <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
                Configure user custom task catalogs, single visit templates, dynamic planning inputs, and completion outcome forms in one unified console.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar: Merged Tasks & Visits vs Policies */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("tasks_and_visits")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition border ${
            activeTab === "tasks_and_visits"
              ? "bg-primary/15 border-primary/30 text-primary shadow-xs"
              : "border-transparent text-muted hover:bg-surface-muted hover:text-foreground"
          }`}
        >
          <div className="flex items-center -space-x-1">
            <Layers className="h-4 w-4" />
            <Compass className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <span>Tasks &amp; Visits Templates</span>
          <span className="rounded-full bg-primary/20 text-primary px-2 py-0.2 text-[10px] font-extrabold">
            {portalUsers.length} Users
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("portal_policies")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition border ${
            activeTab === "portal_policies"
              ? "bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-400 shadow-xs"
              : "border-transparent text-muted hover:bg-surface-muted hover:text-foreground"
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Portal Policies &amp; Rules</span>
          {hasUnsavedPolicies && (
            <span className="rounded-full bg-amber-500/20 text-amber-600 px-2 py-0.2 text-[10px] font-extrabold">
              Unsaved
            </span>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: UNIFIED TASKS & VISITS TEMPLATES */}
      {/* ========================================================= */}
      {activeTab === "tasks_and_visits" && (
        <div className="space-y-5 animate-fade-in">
          {/* Description Banner */}
          <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted/30 px-4 py-2.5 text-xs text-muted">
            <span>
              <strong className="text-foreground">Unified Templates Governance:</strong> Manage tailored custom task catalogs and single universal visit templates per user. Click any user to design planning inputs and debrief outcome forms.
            </span>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name, username, email, department..."
                className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none shadow-2xs"
              />
            </div>

            {/* Role & Department Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none shadow-2xs"
              >
                <option value="all">All Roles</option>
                <option value="executive">Executives</option>
                <option value="manager">Managers</option>
                <option value="coordinator">Coordinators</option>
                <option value="admin">Admins</option>
              </select>

              {departments.length > 0 && (
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none shadow-2xs"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d.toLowerCase()}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Portal Users Grid */}
          {loadingUsers ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-52 rounded-3xl border border-border bg-card/60 p-4 space-y-3" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-muted mx-auto">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">No Portal Users Found</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                {searchQuery || selectedRole !== "all" || selectedDept !== "all"
                  ? "No users match your active filter criteria. Try resetting your search."
                  : "No users currently have access to the Work Planner portal."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredUsers.map((u: any) => {
                const userId = String(u._id || u.id || "");
                const username = String(u.username || u.email || userId);
                const dept = getUserDepartmentName(u);
                const role = String(u.wp_role || "Executive");
                const taskCount = tasksSummary?.[userId]?.count ?? tasksSummary?.[username]?.count ?? 0;
                const visitSummaryItem = visitsSummary?.[userId] ?? visitsSummary?.[username] ?? null;
                const hasVisitConfig = Boolean(visitSummaryItem?.hasTemplate);
                const visitCreateCount = visitSummaryItem?.createCount ?? 0;
                const visitOutcomeCount = visitSummaryItem?.outcomeCount ?? 0;

                const primaryUrl = `/dashboard/settings/${encodeURIComponent(username)}/tasks`;

                return (
                  <div
                    key={userId}
                    className="group relative flex flex-col justify-between rounded-3xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                  >
                    {/* User Top Card Info */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        {/* User Avatar */}
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 font-extrabold text-white text-sm shadow-xs group-hover:scale-105 transition">
                          {getInitials(u.name || username)}
                        </div>

                        {/* Role Pill */}
                        <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-primary">
                          {role}
                        </span>
                      </div>

                      {/* Name & Identity */}
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition">
                          {u.name || username}
                        </h3>
                        <p className="text-[11px] text-muted truncate mt-0.5 font-mono">
                          {u.username ? `@${u.username}` : u.email}
                        </p>
                        <p className="text-[10px] text-muted/80 truncate mt-0.5">
                          {dept}
                        </p>
                      </div>
                    </div>

                    {/* Dual Summary Blocks: Tasks & Visits */}
                    <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-border/60">
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-2.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                          <Layers className="h-3.5 w-3.5" />
                          <span>Tasks</span>
                        </div>
                        <p className="mt-1 text-xs font-black text-foreground">
                          {taskCount} {taskCount === 1 ? "Task" : "Tasks"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          <Compass className="h-3.5 w-3.5" />
                          <span>Visits</span>
                        </div>
                        <p className="mt-1 text-xs font-black text-foreground truncate">
                          {hasVisitConfig ? `${visitCreateCount}P • ${visitOutcomeCount}O` : "Default"}
                        </p>
                      </div>
                    </div>

                    {/* Direct Action Links Bar */}
                    <div className="mt-3 pt-2.5 border-t border-border/60 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-semibold text-muted">
                          Unified Designer
                        </span>

                        <Link
                          href={primaryUrl}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary group-hover:translate-x-0.5 transition hover:underline"
                        >
                          <span>Configure</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>

                      {/* Quick Pill Buttons to jump directly to Tasks or Visits tab */}
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <Link
                          href={`/dashboard/settings/${encodeURIComponent(username)}/tasks`}
                          className="text-center py-1 rounded-lg text-[10px] font-bold transition border bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                        >
                          Tasks ({taskCount})
                        </Link>

                        <Link
                          href={`/dashboard/settings/${encodeURIComponent(username)}/visits`}
                          className="text-center py-1 rounded-lg text-[10px] font-bold transition border bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                        >
                          Visit Template
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PORTAL POLICIES & GOVERNANCE RULES */}
      {/* ========================================================= */}
      {activeTab === "portal_policies" && (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
          {/* Top Policy Bar Actions */}
          <div className="flex items-center justify-between gap-3 p-4 rounded-3xl border border-border bg-card shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-foreground">Global Work Planning Rules &amp; Policies</h3>
              <p className="text-xs text-muted">
                Governs cutoff times, geofencing thresholds, reimbursement policies and automated notifications.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportPolicies}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-muted transition"
                title="Export JSON Configuration"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                type="button"
                onClick={handleResetPolicies}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={handleSavePolicies}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 transition"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Policies</span>
              </button>
            </div>
          </div>

          {/* Section 1: Work Planning & Cutoff Rules */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Work Planning &amp; Submission Rules</h4>
                <p className="text-[11px] text-muted">Daily plan submission windows, cutoff times, and backdating permissions</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Morning Plan Cutoff Time
                </label>
                <input
                  type="time"
                  value={portalSettings.planSubmissionCutoffTime}
                  onChange={(e) => handleUpdatePolicy("planSubmissionCutoffTime", e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
                <p className="text-[10px] text-muted mt-1">Plans submitted after this time will be flagged as late.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Max Advance Planning Days
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={portalSettings.maxAdvancePlanningDays}
                  onChange={(e) => handleUpdatePolicy("maxAdvancePlanningDays", Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
                <p className="text-[10px] text-muted mt-1">How many days in advance executives can submit plans.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted/30 p-3">
                <div>
                  <span className="text-xs font-bold text-foreground">Allow Backdated Plans</span>
                  <p className="text-[10px] text-muted">Permit executives to create plans for past dates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={portalSettings.allowBackdatedPlans}
                    onChange={(e) => handleUpdatePolicy("allowBackdatedPlans", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted/30 p-3">
                <div>
                  <span className="text-xs font-bold text-foreground">Manager Pre-Approval</span>
                  <p className="text-[10px] text-muted">Require manager approval before check-in is allowed</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={portalSettings.requireManagerPreApproval}
                    onChange={(e) => handleUpdatePolicy("requireManagerPreApproval", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Field Visits & GPS Geofencing */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Field Visits &amp; GPS Policies</h4>
                <p className="text-[11px] text-muted">Mandatory geolocation, geofence radius and visit photo proof requirements</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Geofence Tolerance (Meters)
                </label>
                <input
                  type="number"
                  min={50}
                  max={5000}
                  step={50}
                  value={portalSettings.geofenceToleranceMeters}
                  onChange={(e) => handleUpdatePolicy("geofenceToleranceMeters", Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
                <p className="text-[10px] text-muted mt-1">Acceptable distance between planned clinic/dealer and actual check-in point.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Minimum Visit Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={portalSettings.minVisitDurationMinutes}
                  onChange={(e) => handleUpdatePolicy("minVisitDurationMinutes", Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
                <p className="text-[10px] text-muted mt-1">Visits completed in less time will be flagged for review.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted/30 p-3">
                <div>
                  <span className="text-xs font-bold text-foreground">Mandatory GPS Check-In</span>
                  <p className="text-[10px] text-muted">Executives must grant location permission to start visits</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={portalSettings.mandatoryGpsCheckIn}
                    onChange={(e) => handleUpdatePolicy("mandatoryGpsCheckIn", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted/30 p-3">
                <div>
                  <span className="text-xs font-bold text-foreground">Mandatory Visit Photo Proof</span>
                  <p className="text-[10px] text-muted">Require camera photo upload upon visit completion</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={portalSettings.mandatoryVisitPhoto}
                    onChange={(e) => handleUpdatePolicy("mandatoryVisitPhoto", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Expense Claims & Reimbursements */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <IndianRupee className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Expense Claim &amp; Allowance Limits</h4>
                <p className="text-[11px] text-muted">Per-km fuel reimbursements, outstation limits and invoice requirements</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Daily Outstation Limit (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={portalSettings.dailyOutstationAllowanceLimit}
                  onChange={(e) => handleUpdatePolicy("dailyOutstationAllowanceLimit", Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  2-Wheeler Rate (₹ / km)
                </label>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  value={portalSettings.fuelRateTwoWheelerPerKm}
                  onChange={(e) => handleUpdatePolicy("fuelRateTwoWheelerPerKm", Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  4-Wheeler Rate (₹ / km)
                </label>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  value={portalSettings.fuelRateFourWheelerPerKm}
                  onChange={(e) => handleUpdatePolicy("fuelRateFourWheelerPerKm", Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted/30 p-3 pt-2">
              <div>
                <span className="text-xs font-bold text-foreground">Block Expense Without Approved Plan</span>
                <p className="text-[10px] text-muted">Expenses can only be logged for days with an approved work plan</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={portalSettings.blockExpenseWithoutApprovedPlan}
                  onChange={(e) => handleUpdatePolicy("blockExpenseWithoutApprovedPlan", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>

          {/* Section 4: Day-End Reporting & Notifications */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Day-End Reporting &amp; Notifications</h4>
                <p className="text-[11px] text-muted">Cutoff times, automated reminder alerts and AI debrief analysis</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Day-End Submission Cutoff Time
                </label>
                <input
                  type="time"
                  value={portalSettings.dayEndCutoffTime}
                  onChange={(e) => handleUpdatePolicy("dayEndCutoffTime", e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Evening Day-End Reminder Time
                </label>
                <input
                  type="time"
                  value={portalSettings.eveningDayEndReminderTime}
                  onChange={(e) => handleUpdatePolicy("eveningDayEndReminderTime", e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted/30 p-3 pt-2">
              <div>
                <span className="text-xs font-bold text-foreground">Block Next Day Plan if Day-End Pending</span>
                <p className="text-[10px] text-muted">Prevents submitting future plans until prior day end debrief is submitted</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={portalSettings.blockNextDayPlanIfDayEndPending}
                  onChange={(e) => handleUpdatePolicy("blockNextDayPlanIfDayEndPending", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
