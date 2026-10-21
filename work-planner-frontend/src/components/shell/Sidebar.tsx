"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  FolderKanban,
  LayoutGrid,
  Users,
  X,
  Sparkles,
  ShieldCheck,
  StickyNote,
  LifeBuoy,
  Settings,
} from "lucide-react";
import type { UserSession } from "@/types/workPlanner";
import { isWpAdmin, isWpManager, isWpCoordinator, readSessionFromStorage } from "@/utils/authStorage";
import { useGetHelpDeskStatsQuery } from "@/store/api/helpDeskApiSlice";

export function Sidebar({
  mobileNavOpen,
  setMobileNavOpen,
  desktopCollapsed,
  setDesktopCollapsed,
  companyInfo,
  session,
}: {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  desktopCollapsed: boolean;
  setDesktopCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  companyInfo?: any;
  session?: UserSession | null;
}) {
  const pathname = usePathname();
  const lgW = desktopCollapsed ? "lg:w-[64px] lg:min-w-[64px]" : "lg:w-[14.5rem] lg:min-w-[14.5rem]";

  const [activeUser, setActiveUser] = useState(session?.user || null);

  useEffect(() => {
    if (session?.user) {
      setActiveUser(session.user);
    } else {
      const s = readSessionFromStorage();
      if (s?.user) setActiveUser(s.user);
    }
  }, [session]);

  const coordinatorRole = isWpCoordinator(activeUser);
  const managerRole = isWpManager(activeUser);
  const adminRole = isWpAdmin(activeUser);

  const { data: helpDeskStats } = useGetHelpDeskStatsQuery(undefined, {
    pollingInterval: 45000,
  });
  const pendingHelpDeskCount = (helpDeskStats?.tagged_to_me_open || 0) + (helpDeskStats?.solution_proposed_waiting_me || 0);

  const companyLogoUrl = companyInfo?.logo_url || process.env.NEXT_PUBLIC_COMPANY_LOGO_URL || "";
  const companyTitle = companyInfo?.trade_name || companyInfo?.legal_name || process.env.NEXT_PUBLIC_COMPANY_NAME || "Portal";

  const isDashboardActive = pathname === "/dashboard";
  const isProjectsActive = pathname.startsWith("/dashboard/projects");
  const isNotesActive = pathname.startsWith("/dashboard/notes");
  const isHelpDeskActive = pathname.startsWith("/dashboard/help-desk");
  const isPlansActive = pathname === "/dashboard/plans";
  const isTasksVisitsActive = pathname.startsWith("/dashboard/tasks-visits");
  const isCalendarActive = pathname.startsWith("/dashboard/plans/calendar");
  const isSeniorRemarksActive = pathname.startsWith("/dashboard/senior-remarks");
  const isExpensesActive = pathname.startsWith("/dashboard/expenses");
  const isAnalyticsActive = pathname.startsWith("/dashboard/analytics");
  const isAssignedUsersActive = pathname.startsWith("/dashboard/assigned-users");
  const isMyTeamActive = pathname.startsWith("/dashboard/my-team");
  const isAssignedTeamsActive = pathname.startsWith("/dashboard/assigned-teams");
  const isTeamManagerActive = pathname.startsWith("/dashboard/team-manager");
  const isSettingsActive = pathname.startsWith("/dashboard/settings");

  return (
    <>
      {/* Mobile Nav Overlay */}
      <div
        aria-hidden={!mobileNavOpen}
        className={[
          "fixed inset-0 z-[35] bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          mobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={() => setMobileNavOpen(false)}
      />

      <aside
        id="app-sidebar"
        className={[
          "fixed left-0 top-0 z-[40] flex h-[100vh] max-h-[100vh] min-h-0 w-[min(15rem,85vw)] flex-col overflow-hidden border-r border-border bg-card shadow-2xl transition-[transform,width,min-width] duration-300 ease-out",
          "lg:relative lg:z-0 lg:h-full lg:min-h-0 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none",
          lgW,
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {/* Company Header with Logo, Company Name & Portal Name */}
        <div className="relative flex shrink-0 flex-col gap-1 border-b border-border p-3.5">
          <div className="flex items-center justify-between gap-2">
            <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
              {companyLogoUrl ? (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-muted shadow-xs">
                  <img
                    src={companyLogoUrl}
                    alt={companyTitle}
                    className="h-full w-full object-contain p-1"
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
                  <CheckSquare className="h-5 w-5" />
                </div>
              )}

              {!desktopCollapsed && (
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="text-xs font-black tracking-tight text-foreground uppercase truncate">
                    {companyTitle}
                  </span>
                  <span className="text-[10px] font-bold text-primary tracking-wider uppercase truncate mt-0.5">
                    Work Planner Portal
                  </span>
                </div>
              )}
            </Link>

            <button
              type="button"
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted lg:hidden"
              onClick={() => setMobileNavOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <div className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted ${desktopCollapsed ? "hidden" : "block"}`}>
            Navigation
          </div>

          {/* Dashboard Overview */}
          <Link
            href="/dashboard"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              isDashboardActive
                ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="Dashboard Overview"
          >
            <LayoutGrid className={`h-4 w-4 shrink-0 ${isDashboardActive ? "text-primary" : ""}`} />
            {!desktopCollapsed && <span>Dashboard</span>}
          </Link>

          {/* Projects Management */}
          <Link
            href="/dashboard/projects"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              isProjectsActive
                ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="Projects Management"
          >
            <FolderKanban className={`h-4 w-4 shrink-0 ${isProjectsActive ? "text-primary" : ""}`} />
            {!desktopCollapsed && <span>Projects</span>}
          </Link>

          {/* My Notes & Scratchpad */}
          <Link
            href="/dashboard/notes"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              isNotesActive
                ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="My Notes & Scratchpad"
          >
            <StickyNote className={`h-4 w-4 shrink-0 ${isNotesActive ? "text-primary" : ""}`} />
            {!desktopCollapsed && <span>My Notes &amp; Scratchpad</span>}
          </Link>

          {/* Work Plans */}
          <Link
            href="/dashboard/plans"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              isPlansActive
                ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="Work Plans"
          >
            <FileText className={`h-4 w-4 shrink-0 ${isPlansActive ? "text-primary" : ""}`} />
            {!desktopCollapsed && <span>Work Plans</span>}
          </Link>

          {/* Tasks & Visits */}
          <Link
            href="/dashboard/tasks-visits"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              isTasksVisitsActive
                ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="Tasks & Field Visits"
          >
            <CheckSquare className={`h-4 w-4 shrink-0 ${isTasksVisitsActive ? "text-primary" : ""}`} />
            {!desktopCollapsed && <span>Tasks & Visits</span>}
          </Link>

          {/* Calendar View */}
          <Link
            href="/dashboard/plans/calendar"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              isCalendarActive
                ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="Calendar View"
          >
            <CalendarDays className={`h-4 w-4 shrink-0 ${isCalendarActive ? "text-primary" : ""}`} />
            {!desktopCollapsed && <span>Calendar View</span>}
          </Link>

          {/* Directives & Objections Tracker */}
          <Link
            href="/dashboard/senior-remarks"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              isSeniorRemarksActive
                ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="Directives, Objections & Follow-ups"
          >
            <ShieldCheck className={`h-4 w-4 shrink-0 ${isSeniorRemarksActive ? "text-primary" : ""}`} />
            {!desktopCollapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="truncate">Directives &amp; Objections</span>
                <span className="ml-1 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 shrink-0">
                  Track
                </span>
              </div>
            )}
          </Link>

          {/* Help Desk & Requirements */}
          <Link
            href="/dashboard/help-desk"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              isHelpDeskActive
                ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="Inter-Portal Help Desk & Requirements"
          >
            <LifeBuoy className={`h-4 w-4 shrink-0 ${isHelpDeskActive ? "text-primary" : ""}`} />
            {!desktopCollapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="truncate">Help Desk</span>
                {pendingHelpDeskCount > 0 ? (
                  <span className="ml-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500 text-white shrink-0 animate-pulse">
                    {pendingHelpDeskCount}
                  </span>
                ) : (
                  <span className="ml-1 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 shrink-0">
                    Live
                  </span>
                )}
              </div>
            )}
          </Link>

          {/* 360° AI Analytics */}
          <Link
            href="/dashboard/analytics"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              isAnalyticsActive
                ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="360° AI Work Plan & Caliber Analytics"
          >
            <Sparkles className={`h-4 w-4 shrink-0 ${isAnalyticsActive ? "text-primary animate-pulse" : "text-primary/70"}`} />
            {!desktopCollapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="truncate">360° AI Analytics</span>
                <span className="ml-1 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 shrink-0">
                  AI
                </span>
              </div>
            )}
          </Link>

          {/* Expense Claims */}
          <Link
            href="/dashboard/expenses"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              isExpensesActive
                ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="Expense Claims"
          >
            <DollarSign className={`h-4 w-4 shrink-0 ${isExpensesActive ? "text-primary" : ""}`} />
            {!desktopCollapsed && <span>Expense Claims</span>}
          </Link>

          {/* My Team (Manager / Coordinator) */}
          {(managerRole || coordinatorRole) && (
            <Link
              href="/dashboard/my-team"
              onClick={() => setMobileNavOpen(false)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                isMyTeamActive || isAssignedUsersActive
                  ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                  : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
              }`}
              title="My Team"
            >
              <Users className={`h-4 w-4 shrink-0 ${isMyTeamActive ? "text-primary" : ""}`} />
              {!desktopCollapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="truncate">My Team</span>
                  <span className="ml-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary shrink-0">
                    {coordinatorRole ? "Coordinator" : "Manager"}
                  </span>
                </div>
              )}
            </Link>
          )}

          {/* Assigned Teams + Team Manager (Admin) */}
          {adminRole && (
            <>
              <Link
                href="/dashboard/assigned-teams"
                onClick={() => setMobileNavOpen(false)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isAssignedTeamsActive
                    ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                }`}
                title="Assigned Teams"
              >
                <Users className={`h-4 w-4 shrink-0 ${isAssignedTeamsActive ? "text-primary" : ""}`} />
                {!desktopCollapsed && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="truncate">Assigned Teams</span>
                    <span className="ml-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary shrink-0">
                      Admin
                    </span>
                  </div>
                )}
              </Link>
              <Link
                href="/dashboard/team-manager"
                onClick={() => setMobileNavOpen(false)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isTeamManagerActive
                    ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                }`}
                title="Team Manager"
              >
                <Users className={`h-4 w-4 shrink-0 ${isTeamManagerActive ? "text-primary" : ""}`} />
                {!desktopCollapsed && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="truncate">Team Manager</span>
                    <span className="ml-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary shrink-0">
                      Admin
                    </span>
                  </div>
                )}
              </Link>
              <Link
                href="/dashboard/settings"
                onClick={() => setMobileNavOpen(false)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isSettingsActive
                    ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                }`}
                title="Portal Settings"
              >
                <Settings className={`h-4 w-4 shrink-0 ${isSettingsActive ? "text-primary" : ""}`} />
                {!desktopCollapsed && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="truncate">Portal Settings</span>
                    <span className="ml-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary shrink-0">
                      Admin
                    </span>
                  </div>
                )}
              </Link>
            </>
          )}
        </div>

        {/* Footer Collapse Toggle */}
        <div className="mt-auto hidden border-t border-border p-2 lg:flex">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
            onClick={() => setDesktopCollapsed((c) => !c)}
            title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {desktopCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 text-muted" />}
            {!desktopCollapsed && <span className="text-xs font-medium">Collapse Menu</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
