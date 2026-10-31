/**
 * @fileoverview Application Sidebar for Expense Portal with tailored Admin and Finance interfaces.
 * @module components/shell/Sidebar
 */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Receipt,
  Wallet,
  Scale,
  CreditCard,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Building2,
  ArrowRightLeft,
  Briefcase,
  Landmark,
} from "lucide-react";
import type { UserSession } from "@/types/workPlanner";
import { useGetExpenseKpisQuery } from "@/store/api/expenseApiSlice";
import { useExpenseRole } from "@/context/ExpenseRoleContext";

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
  const {
    activeMode,
    setActiveMode,
    hasDualRole,
    isCurrentAdminMode,
    isCurrentFinanceMode,
    isAdmin,
    isFinance,
  } = useExpenseRole();

  const lgW = desktopCollapsed ? "lg:w-[64px] lg:min-w-[64px]" : "lg:w-[15.5rem] lg:min-w-[15.5rem]";

  const { data: kpiData } = useGetExpenseKpisQuery(undefined, {
    pollingInterval: 30000,
  });

  const companyLogoUrl = companyInfo?.logo_url || process.env.NEXT_PUBLIC_COMPANY_LOGO_URL || "";
  const companyTitle = companyInfo?.trade_name || companyInfo?.legal_name || process.env.NEXT_PUBLIC_COMPANY_NAME || "Company";

  const isDashboardActive = pathname === "/dashboard";
  const isClaimsActive = pathname === "/dashboard/claims" || pathname.startsWith("/dashboard/claims");
  const isAdvancesActive = pathname === "/dashboard/advances" || pathname.startsWith("/dashboard/advances");
  const isLedgersActive = pathname === "/dashboard/ledgers" || pathname.startsWith("/dashboard/ledgers");
  const isSettlementsActive = pathname === "/dashboard/settlements" || pathname.startsWith("/dashboard/settlements");
  const isUsersActive = pathname === "/dashboard/users" || pathname.startsWith("/dashboard/users");
  const isSettingsActive = pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings");

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
          "fixed left-0 top-0 z-[40] flex h-[100vh] max-h-[100vh] min-h-0 w-[min(15.5rem,85vw)] flex-col overflow-hidden border-r border-border bg-card shadow-2xl transition-[transform,width,min-width] duration-300 ease-out",
          "lg:relative lg:z-0 lg:h-full lg:min-h-0 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none",
          lgW,
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {/* Company & Portal Header */}
        <div className="relative flex shrink-0 flex-col gap-2 border-b border-border p-3.5">
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
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs ${
                    isCurrentAdminMode
                      ? "bg-emerald-600/10 border-emerald-600/20 text-emerald-600"
                      : "bg-indigo-600/10 border-indigo-600/20 text-indigo-600"
                  }`}
                >
                  {isCurrentAdminMode ? <Receipt className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
                </div>
              )}

              {!desktopCollapsed && (
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="text-xs font-black tracking-tight text-foreground uppercase truncate">
                    {companyTitle}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-[10px] font-bold tracking-wider uppercase truncate ${
                        isCurrentAdminMode
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-indigo-600 dark:text-indigo-400"
                      }`}
                    >
                      Expense Portal
                    </span>
                    <span
                      className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase border ${
                        isCurrentAdminMode
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                      }`}
                    >
                      {isCurrentAdminMode ? "Admin Desk" : "Finance Desk"}
                    </span>
                  </div>
                </div>
              )}
            </Link>
          </div>

          {/* Dual Role Switcher Pill */}
          {!desktopCollapsed && hasDualRole && (
            <div className="mt-1 flex items-center rounded-xl bg-surface-muted p-0.5 border border-border">
              <button
                type="button"
                onClick={() => setActiveMode("admin")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold rounded-lg transition ${
                  isCurrentAdminMode
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <ShieldCheck className="h-3 w-3" />
                <span>Admin View</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("finance")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold rounded-lg transition ${
                  isCurrentFinanceMode
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Landmark className="h-3 w-3" />
                <span>Finance View</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 space-y-1">
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
            {!desktopCollapsed && <span>Dashboard Overview</span>}
          </Link>

          {/* ================= ADMIN VIEW NAVIGATION ================= */}
          {isCurrentAdminMode ? (
            <>
              {!desktopCollapsed && (
                <div className="pt-3 pb-1 px-3 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Operations &amp; Claims
                </div>
              )}

              {/* Expense Claims */}
              <Link
                href="/dashboard/claims"
                onClick={() => setMobileNavOpen(false)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isClaimsActive
                    ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                }`}
                title="Expense Claims Approval"
              >
                <Receipt className={`h-4 w-4 shrink-0 ${isClaimsActive ? "text-primary" : ""}`} />
                {!desktopCollapsed && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="truncate">Claims Approval</span>
                    {(kpiData?.pending_approval_claims || 0) > 0 && (
                      <span className="ml-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500 text-white shrink-0">
                        {kpiData?.pending_approval_claims}
                      </span>
                    )}
                  </div>
                )}
              </Link>

              {/* Tour Advances */}
              <Link
                href="/dashboard/advances"
                onClick={() => setMobileNavOpen(false)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isAdvancesActive
                    ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                }`}
                title="Tour Advances"
              >
                <Wallet className={`h-4 w-4 shrink-0 ${isAdvancesActive ? "text-primary" : ""}`} />
                {!desktopCollapsed && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="truncate">Tour Advances</span>
                    {(kpiData?.pending_advances_count || 0) > 0 && (
                      <span className="ml-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-blue-500 text-white shrink-0">
                        {kpiData?.pending_advances_count}
                      </span>
                    )}
                  </div>
                )}
              </Link>

              {!desktopCollapsed && (
                <div className="pt-3 pb-1 px-3 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Field Organization
                </div>
              )}

              {/* Work Planner Users Directory */}
              <Link
                href="/dashboard/users"
                onClick={() => setMobileNavOpen(false)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isUsersActive
                    ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                }`}
                title="Work Planner Portal Users"
              >
                <Users className={`h-4 w-4 shrink-0 ${isUsersActive ? "text-primary" : ""}`} />
                {!desktopCollapsed && <span>Work Planner Users</span>}
              </Link>

              {/* Staff Running Ledgers */}
              <Link
                href="/dashboard/ledgers"
                onClick={() => setMobileNavOpen(false)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isLedgersActive
                    ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                }`}
                title="Staff Running Balances"
              >
                <Scale className={`h-4 w-4 shrink-0 ${isLedgersActive ? "text-primary" : ""}`} />
                {!desktopCollapsed && <span>Staff Running Balances</span>}
              </Link>

              {!desktopCollapsed && (
                <div className="pt-3 pb-1 px-3 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Policy Governance
                </div>
              )}

              {/* Settings */}
              <Link
                href="/dashboard/settings"
                onClick={() => setMobileNavOpen(false)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isSettingsActive
                    ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                }`}
                title="Expense Policy & Allowance Settings"
              >
                <Settings className={`h-4 w-4 shrink-0 ${isSettingsActive ? "text-primary" : ""}`} />
                {!desktopCollapsed && <span>Policy Settings</span>}
              </Link>
            </>
          ) : (
            /* ================= FINANCE VIEW NAVIGATION ================= */
            <>
              {!desktopCollapsed && (
                <div className="pt-3 pb-1 px-3 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Treasury &amp; Ledgers
                </div>
              )}

              {/* User Passbooks & Ledgers */}
              <Link
                href="/dashboard/ledgers"
                onClick={() => setMobileNavOpen(false)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isLedgersActive
                    ? "bg-indigo-600/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                }`}
                title="User Passbooks & Running Ledgers"
              >
                <Scale className={`h-4 w-4 shrink-0 ${isLedgersActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                {!desktopCollapsed && <span>User Passbooks &amp; Ledgers</span>}
              </Link>

              {/* Settlements & Payments */}
              <Link
                href="/dashboard/settlements"
                onClick={() => setMobileNavOpen(false)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isSettlementsActive
                    ? "bg-indigo-600/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                }`}
                title="Payments & Final Settlements"
              >
                <CreditCard className={`h-4 w-4 shrink-0 ${isSettlementsActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                {!desktopCollapsed && <span>Payments &amp; Settlements</span>}
              </Link>

              {/* Advance Disbursements */}
              <Link
                href="/dashboard/advances"
                onClick={() => setMobileNavOpen(false)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isAdvancesActive
                    ? "bg-indigo-600/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                }`}
                title="Advance Disbursements & Refunds"
              >
                <Wallet className={`h-4 w-4 shrink-0 ${isAdvancesActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                {!desktopCollapsed && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="truncate">Disbursements</span>
                    {(kpiData?.pending_advances_count || 0) > 0 && (
                      <span className="ml-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-indigo-500 text-white shrink-0">
                        {kpiData?.pending_advances_count}
                      </span>
                    )}
                  </div>
                )}
              </Link>

              {!desktopCollapsed && (
                <div className="pt-3 pb-1 px-3 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Audited Claims Queue
                </div>
              )}

              {/* Approved Claims Queue */}
              <Link
                href="/dashboard/claims"
                onClick={() => setMobileNavOpen(false)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isClaimsActive
                    ? "bg-indigo-600/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                }`}
                title="Approved Claims for Settlement"
              >
                <Receipt className={`h-4 w-4 shrink-0 ${isClaimsActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                {!desktopCollapsed && <span>Approved Claims Queue</span>}
              </Link>

              {!desktopCollapsed && (
                <div className="pt-3 pb-1 px-3 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Field Personnel
                </div>
              )}

              {/* Work Planner Users Directory */}
              <Link
                href="/dashboard/users"
                onClick={() => setMobileNavOpen(false)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isUsersActive
                    ? "bg-indigo-600/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                }`}
                title="Work Planner Portal Users Financials"
              >
                <Users className={`h-4 w-4 shrink-0 ${isUsersActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                {!desktopCollapsed && <span>Work Planner Users</span>}
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
