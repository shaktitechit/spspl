"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  RotateCcw,
  Calendar,
  User as UserIcon,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  CheckSquare,
  Briefcase,
  TrendingUp,
  ShieldCheck,
  Award,
  Layers,
  Users,
  Compass,
  FileText,
  Clock,
  Printer,
  ChevronDown,
  Download,
  Loader2,
  Search,
} from "lucide-react";
import {
  useGetCaliberAnalyticsQuery,
  useRegenerateCaliberAnalyticsMutation,
  useGetTeamAnalyticsOverviewQuery,
  useGetTeamMembersQuery,
} from "@/store/api/workPlannerApiSlice";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import {
  isWpAdmin,
  isWpManager,
  isWpElevated,
  hasWorkPlannerPortalAccess,
  readSessionFromStorage,
} from "@/utils/authStorage";
import { formatPlanDate } from "./workPlanUtils";
import { toast } from "sonner";
import { AiAnalysisLoader } from "./AiAnalysisLoader";

export function WorkPlanAnalyticsPage() {
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const adminRole = isWpAdmin(sessionUser);
  const managerRole = isWpManager(sessionUser);
  const elevatedRole = isWpElevated(sessionUser);
  const currentUserId = String(sessionUser?._id || (sessionUser as any)?.id || "");

  // Date Range Presets
  const [datePreset, setDatePreset] = useState<"7d" | "30d" | "90d" | "custom">("30d");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split("T")[0]);

  // Target User Selection
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUserId);
  const [userSearch, setUserSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"complete" | "visits" | "tasks" | "team">("complete");

  // Fetch Team & Users
  const { data: usersData } = useGetUsersQuery(undefined, { skip: !adminRole });
  const { data: teamMembersData } = useGetTeamMembersQuery(undefined, { skip: adminRole || !elevatedRole });

  const rosterUsers = useMemo(() => {
    if (adminRole && Array.isArray(usersData)) {
      return usersData.filter(hasWorkPlannerPortalAccess).map((u: any) => ({
        _id: String(u._id || u.id),
        name: u.name,
        email: u.email,
        department: u.department,
      }));
    }
    if (Array.isArray(teamMembersData)) {
      const list = teamMembersData.map((m: any) => ({
        _id: String(m._id || m.id),
        name: m.name,
        email: m.email,
        department: m.department,
      }));
      if (sessionUser && !list.some((u) => u._id === currentUserId)) {
        list.unshift({
          _id: currentUserId,
          name: `${sessionUser.name} (Self)`,
          email: sessionUser.email,
          department: sessionUser.department,
        });
      }
      return list;
    }
    if (sessionUser) {
      return [{
        _id: currentUserId,
        name: sessionUser.name,
        email: sessionUser.email,
        department: sessionUser.department,
      }];
    }
    return [];
  }, [adminRole, usersData, teamMembersData, sessionUser, currentUserId]);

  // Compute Active Date Range
  const { activeFrom, activeTo } = useMemo(() => {
    const today = new Date();
    const toStr = today.toISOString().split("T")[0];
    if (datePreset === "custom") {
      return { activeFrom: customFrom, activeTo: customTo };
    }
    const fromDate = new Date();
    if (datePreset === "7d") fromDate.setDate(today.getDate() - 7);
    else if (datePreset === "30d") fromDate.setDate(today.getDate() - 30);
    else if (datePreset === "90d") fromDate.setDate(today.getDate() - 90);
    return {
      activeFrom: fromDate.toISOString().split("T")[0],
      activeTo: toStr,
    };
  }, [datePreset, customFrom, customTo]);

  // Analytics Query & Mutations
  const {
    data: caliberData,
    isLoading: loadingAnalytics,
    isFetching: fetchingAnalytics,
    refetch: refetchCaliber,
  } = useGetCaliberAnalyticsQuery({
    sales_user: selectedUserId,
    from: activeFrom,
    to: activeTo,
  });

  const { data: teamOverviewData, isLoading: loadingTeamOverview } = useGetTeamAnalyticsOverviewQuery(
    { from: activeFrom, to: activeTo },
    { skip: !elevatedRole || activeTab !== "team" }
  );

  const [regenerateMut, { isLoading: regenerating }] = useRegenerateCaliberAnalyticsMutation();

  const handleRegenerate = async () => {
    try {
      await regenerateMut({
        sales_user: selectedUserId,
        from: activeFrom,
        to: activeTo,
      }).unwrap();
      toast.success("AI 360° Caliber Assessment recalculated!");
      refetchCaliber();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to recalculate AI assessment");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const assessment = caliberData?.assessment;
  const overall = assessment?.overallCaliberReport;
  const visitsReport = assessment?.visitsReport;
  const tasksReport = assessment?.tasksReport;
  const synergy = assessment?.crossTrackSynergy;
  const coaching = assessment?.managerCoachingPlaybook;
  const actionPlan = assessment?.executiveActionPlan;

  const planMetrics = caliberData?.planMetrics;
  const visitMetrics = caliberData?.visitMetrics;
  const taskMetrics = caliberData?.taskMetrics;

  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case "Exceptional":
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "High Performer":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "Consistent":
        return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30";
      case "Needs Coaching":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      default:
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
    }
  };

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Top Header & Filters Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white shadow-md">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                360° Work Plan &amp; Caliber Analytics
              </h1>
              <p className="text-xs text-muted">
                Multi-dimensional performance diagnosis powered by OpenAI &amp; Work Planner Activity Logs
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted/80 transition cursor-pointer"
            >
              <Printer className="h-4 w-4 text-muted" />
              <span>Export Report</span>
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating || fetchingAnalytics}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              <span>{regenerating ? "Regenerating AI…" : "Regenerate AI"}</span>
            </button>
          </div>
        </div>

        {/* Controls: Target User & Date Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-border">
          {/* Executive Selector (if elevated) */}
          {elevatedRole && (
            <div>
              <label className="text-[11px] font-bold text-foreground block mb-1">
                Select Team Member
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
              >
                {rosterUsers.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} {u.department ? `(${u.department})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Presets */}
          <div className={elevatedRole ? "" : "sm:col-span-2"}>
            <label className="text-[11px] font-bold text-foreground block mb-1">
              Evaluation Timeframe
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDatePreset("7d")}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                  datePreset === "7d"
                    ? "border-primary bg-primary/10 text-primary font-bold"
                    : "border-border bg-surface-muted text-muted hover:text-foreground"
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("30d")}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                  datePreset === "30d"
                    ? "border-primary bg-primary/10 text-primary font-bold"
                    : "border-border bg-surface-muted text-muted hover:text-foreground"
                }`}
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("90d")}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                  datePreset === "90d"
                    ? "border-primary bg-primary/10 text-primary font-bold"
                    : "border-border bg-surface-muted text-muted hover:text-foreground"
                }`}
              >
                Quarter
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("custom")}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                  datePreset === "custom"
                    ? "border-primary bg-primary/10 text-primary font-bold"
                    : "border-border bg-surface-muted text-muted hover:text-foreground"
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Custom Date Pickers */}
          {datePreset === "custom" && (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted block mb-0.5">From Date</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted block mb-0.5">To Date</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hero Caliber Score & Core KPIs Card */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Overall Caliber Dial */}
        <div className="lg:col-span-1 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
              Overall Caliber Score
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-black text-foreground">
                {overall?.score ?? 0}
              </span>
              <span className="text-xs text-muted font-medium">/ 100</span>
            </div>
            {overall?.tier && (
              <span className={`inline-block mt-2 px-2.5 py-0.5 text-xs font-bold rounded-full border ${getTierBadge(overall.tier)}`}>
                {overall.tier}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted mt-3 leading-relaxed border-t border-border pt-3">
            Evaluated across {caliberData?.period?.daysCovered || 30} days of operational activity.
          </p>
        </div>

        {/* 3 Metric Cards */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Work Plan Rigor */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Work Plan Rigor</span>
                <Compass className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-black text-foreground mt-2">
                {planMetrics?.planCompletionRate ?? 0}%
              </div>
              <span className="text-[11px] text-muted block mt-0.5">
                {planMetrics?.completedPlans ?? 0} of {planMetrics?.totalPlans ?? 0} plans completed
              </span>
            </div>
            <div className="text-[11px] text-muted border-t border-border pt-2 mt-2">
              Manager Alignment: <strong>{planMetrics?.managerDiscussedRate ?? 0}%</strong>
            </div>
          </div>

          {/* Visits Acumen */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Field Visits Acumen</span>
                <MapPin className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-2xl font-black text-foreground mt-2">
                {visitsReport?.score ?? 0}
                <span className="text-xs text-muted font-normal"> / 100</span>
              </div>
              <span className="text-[11px] text-muted block mt-0.5">
                {visitMetrics?.completedVisits ?? 0} of {visitMetrics?.totalVisits ?? 0} visits completed
              </span>
            </div>
            <div className="text-[11px] text-muted border-t border-border pt-2 mt-2">
              New Leads: <strong>{visitMetrics?.newPartyRatio ?? 0}%</strong> • GPS: <strong>{visitMetrics?.geoComplianceRate ?? 0}%</strong>
            </div>
          </div>

          {/* Tasks Velocity */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Task Velocity</span>
                <CheckSquare className="h-4 w-4 text-purple-500" />
              </div>
              <div className="text-2xl font-black text-foreground mt-2">
                {tasksReport?.score ?? 0}
                <span className="text-xs text-muted font-normal"> / 100</span>
              </div>
              <span className="text-[11px] text-muted block mt-0.5">
                {taskMetrics?.completedTasks ?? 0} of {taskMetrics?.totalTasks ?? 0} tasks resolved
              </span>
            </div>
            <div className="text-[11px] text-muted border-t border-border pt-2 mt-2">
              Rollover Rate: <strong className={taskMetrics?.rolloverRate && taskMetrics.rolloverRate > 20 ? "text-rose-500" : ""}>{taskMetrics?.rolloverRate ?? 0}%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Header */}
      <div className="flex items-center border-b border-border bg-card px-3 sm:px-4 rounded-xl shadow-xs overflow-x-auto scrollbar-none gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("complete")}
          className={`flex items-center gap-2 py-3 sm:py-3.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
            activeTab === "complete"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <Compass className="h-4 w-4" />
          <span>1. Complete Plan 360° Profile</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("visits")}
          className={`flex items-center gap-2 py-3 sm:py-3.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
            activeTab === "visits"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <MapPin className="h-4 w-4" />
          <span>2. Visits Performance</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 py-3 sm:py-3.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
            activeTab === "tasks"
              ? "border-purple-500 text-purple-600 dark:text-purple-400"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <CheckSquare className="h-4 w-4" />
          <span>3. Tasks Execution</span>
        </button>
        {elevatedRole && (
          <button
            type="button"
            onClick={() => setActiveTab("team")}
            className={`flex items-center gap-2 py-3 sm:py-3.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
              activeTab === "team"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>4. Team Benchmark</span>
          </button>
        )}
      </div>

      {/* Tab Contents */}
      {loadingAnalytics || regenerating ? (
        <AiAnalysisLoader
          title="Synthesizing 360° AI Caliber Assessment…"
          subtitle="Processing complete work plans, geo check-in adherence, pipeline balance, task rollover velocity, and senior directives with OpenAI intelligence."
        />
      ) : (
        <>
          {/* TAB 1: Complete Plan 360° Profile */}
          {activeTab === "complete" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Executive Summary Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                  <Sparkles className="h-4 w-4" />
                  <span>Executive 360° Assessment Summary</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {overall?.executiveSummary}
                </p>
                {overall?.growthTrajectory && (
                  <div className="rounded-xl bg-surface-muted/60 p-3 text-xs text-muted border border-border">
                    <strong className="text-foreground">Growth Trajectory:</strong> {overall.growthTrajectory}
                  </div>
                )}
              </div>

              {/* 6 Dimension Competencies */}
              {overall?.dimensionRatings && (
                <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-foreground">
                    Core Competency Radar (Ratings out of 10)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(overall.dimensionRatings).map(([key, val]) => {
                      const labelMap: Record<string, string> = {
                        planningRigor: "Planning Rigor & Foresight",
                        executionDiscipline: "Execution & Punctuality",
                        clientEngagement: "Commercial & Client Acumen",
                        taskVelocity: "Task Execution Velocity",
                        reportingTransparency: "Day-End Reporting Integrity",
                        seniorCoachability: "Senior Feedback Responsiveness",
                      };
                      const scoreVal = Number(val) || 0;
                      return (
                        <div key={key} className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground">{labelMap[key] || key}</span>
                            <span className="font-extrabold text-foreground">{scoreVal} / 10</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden border border-border">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${scoreVal * 10}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Strengths & Blind Spots */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-3">
                  <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Key Operational Strengths
                  </h3>
                  <ul className="space-y-2 text-xs text-muted">
                    {overall?.coreStrengths?.map((str: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-bold text-emerald-500">•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-3">
                  <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Critical Blind Spots &amp; Friction Points
                  </h3>
                  <ul className="space-y-2 text-xs text-muted">
                    {overall?.criticalBlindSpots?.map((b: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-bold text-amber-500">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Manager Coaching & Action Targets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-border bg-card p-6 space-y-3 shadow-xs">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Manager's Coaching Playbook
                  </h3>
                  <ul className="space-y-2 text-xs text-muted">
                    {coaching?.confidentialDirectives?.map((d: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-bold text-primary">{idx + 1}.</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 space-y-3 shadow-xs">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Award className="h-5 w-5 text-emerald-500" />
                    Executive 30-Day Growth Targets
                  </h3>
                  <ul className="space-y-2 text-xs text-muted">
                    {actionPlan?.primaryGoals?.map((g: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Dedicated Visits Performance Report */}
          {activeTab === "visits" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Hero Banner */}
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      Field Visits Acumen &amp; Commercial Drive
                    </span>
                    {visitsReport?.tier && (
                      <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 uppercase">
                        {visitsReport.tier}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1 leading-relaxed max-w-xl">
                    {visitsReport?.commercialAcumenSummary}
                  </p>
                </div>
                <div className="text-right shrink-0 bg-card p-4 rounded-xl border border-border shadow-xs">
                  <span className="text-3xl font-black text-foreground">{visitsReport?.score ?? 0}</span>
                  <span className="text-xs text-muted"> / 100</span>
                  <span className="block text-[10px] text-muted">Field Caliber Score</span>
                </div>
              </div>

              {/* Visits Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <span className="text-xs text-muted block">Total Visits</span>
                  <span className="text-xl font-bold text-foreground">{visitMetrics?.totalVisits ?? 0}</span>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <span className="text-xs text-muted block">Completed</span>
                  <span className="text-xl font-bold text-emerald-600">{visitMetrics?.completedVisits ?? 0}</span>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <span className="text-xs text-muted block">New Account Ratio</span>
                  <span className="text-xl font-bold text-purple-600">{visitMetrics?.newPartyRatio ?? 0}%</span>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <span className="text-xs text-muted block">GPS Compliance</span>
                  <span className="text-xl font-bold text-blue-600">{visitMetrics?.geoComplianceRate ?? 0}%</span>
                </div>
              </div>

              {/* Analysis Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-border bg-card p-5 space-y-2 shadow-xs">
                  <h4 className="text-xs font-bold text-foreground">Pipeline Dynamics (Hunting vs Farming)</h4>
                  <p className="text-xs text-muted leading-relaxed">{visitsReport?.pipelineDynamicsAnalysis}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 space-y-2 shadow-xs">
                  <h4 className="text-xs font-bold text-foreground">Geo-Discipline &amp; Punctuality</h4>
                  <p className="text-xs text-muted leading-relaxed">{visitsReport?.geoDisciplineCritique}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 space-y-2 shadow-xs">
                  <h4 className="text-xs font-bold text-foreground">Meeting Outcomes &amp; Commercial Quality</h4>
                  <p className="text-xs text-muted leading-relaxed">{visitsReport?.meetingOutcomesCritique}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Dedicated Tasks Execution Report */}
          {activeTab === "tasks" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Hero Banner */}
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      Task Execution Velocity &amp; Operational Throughput
                    </span>
                    {tasksReport?.tier && (
                      <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 uppercase">
                        {tasksReport.tier}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1 leading-relaxed max-w-xl">
                    {tasksReport?.operationalVelocitySummary}
                  </p>
                </div>
                <div className="text-right shrink-0 bg-card p-4 rounded-xl border border-border shadow-xs">
                  <span className="text-3xl font-black text-foreground">{tasksReport?.score ?? 0}</span>
                  <span className="text-xs text-muted"> / 100</span>
                  <span className="block text-[10px] text-muted">Velocity Score</span>
                </div>
              </div>

              {/* Tasks Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <span className="text-xs text-muted block">Total Tasks</span>
                  <span className="text-xl font-bold text-foreground">{taskMetrics?.totalTasks ?? 0}</span>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <span className="text-xs text-muted block">Resolved Tasks</span>
                  <span className="text-xl font-bold text-emerald-600">{taskMetrics?.completedTasks ?? 0}</span>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <span className="text-xs text-muted block">Rollover Rate</span>
                  <span className={`text-xl font-bold ${taskMetrics?.rolloverRate && taskMetrics.rolloverRate > 20 ? "text-rose-600" : "text-foreground"}`}>
                    {taskMetrics?.rolloverRate ?? 0}%
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <span className="text-xs text-muted block">Template Duties</span>
                  <span className="text-xl font-bold text-purple-600">{taskMetrics?.templateRate ?? 0}%</span>
                </div>
              </div>

              {/* Analysis Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-border bg-card p-5 space-y-2 shadow-xs">
                  <h4 className="text-xs font-bold text-foreground">Throughput &amp; Velocity Critique</h4>
                  <p className="text-xs text-muted leading-relaxed">{tasksReport?.throughputCritique}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 space-y-2 shadow-xs">
                  <h4 className="text-xs font-bold text-foreground">Rollover &amp; Delay Diagnosis</h4>
                  <p className="text-xs text-muted leading-relaxed">{tasksReport?.rolloverDiagnosis}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 space-y-2 shadow-xs">
                  <h4 className="text-xs font-bold text-foreground">Initiative vs. Routine Balance</h4>
                  <p className="text-xs text-muted leading-relaxed">{tasksReport?.initiativeVsRoutineCritique}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Team Caliber Benchmark Matrix (for Managers & Admins) */}
          {activeTab === "team" && elevatedRole && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
                <div className="p-4 border-b border-border bg-surface-muted/30">
                  <h3 className="text-sm font-bold text-foreground">
                    Team Subordinate Caliber &amp; Performance Leaderboard
                  </h3>
                  <p className="text-xs text-muted">
                    Comparative evaluation across all reporting executives in your hierarchy.
                  </p>
                </div>

                {loadingTeamOverview ? (
                  <div className="flex items-center justify-center py-12 text-muted text-xs">
                    <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" /> Loading team matrix…
                  </div>
                ) : !teamOverviewData || teamOverviewData.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted">
                    No reporting team members found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-muted/50 text-muted border-b border-border uppercase text-[10px] font-bold">
                        <tr>
                          <th className="py-3 px-4">Executive</th>
                          <th className="py-3 px-4">Caliber Score</th>
                          <th className="py-3 px-4">Plan Completion</th>
                          <th className="py-3 px-4">Visits Done</th>
                          <th className="py-3 px-4">Task Completion</th>
                          <th className="py-3 px-4">Rollover %</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {teamOverviewData.map((item: any) => (
                          <tr key={item.user._id} className="hover:bg-surface-muted/30 transition">
                            <td className="py-3 px-4 font-semibold text-foreground">
                              {item.user.name}
                              <span className="block text-[10px] text-muted font-normal">{item.user.department || "Sales"}</span>
                            </td>
                            <td className="py-3 px-4">
                              {item.caliberScore ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-foreground">{item.caliberScore}</span>
                                  <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded-md border ${getTierBadge(item.caliberTier)}`}>
                                    {item.caliberTier}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted text-[11px]">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-medium">
                              {item.planMetrics?.planCompletionRate ?? 0}% ({item.planMetrics?.totalPlans ?? 0} plans)
                            </td>
                            <td className="py-3 px-4 font-medium">
                              {item.visitMetrics?.visitCompletionRate ?? 0}% ({item.visitMetrics?.totalVisits ?? 0} visits)
                            </td>
                            <td className="py-3 px-4 font-medium">
                              {item.taskMetrics?.taskCompletionRate ?? 0}%
                            </td>
                            <td className="py-3 px-4 font-medium">
                              <span className={item.taskMetrics?.rolloverRate > 20 ? "text-rose-600 font-bold" : ""}>
                                {item.taskMetrics?.rolloverRate ?? 0}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUserId(item.user._id);
                                  setActiveTab("complete");
                                }}
                                className="px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-surface-muted text-primary font-bold text-[11px] transition cursor-pointer"
                              >
                                View 360° Profile
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default WorkPlanAnalyticsPage;
