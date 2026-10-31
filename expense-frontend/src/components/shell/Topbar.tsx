"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Sun,
  User,
  Settings,
  ShieldCheck,
  Landmark,
  ArrowRightLeft,
} from "lucide-react";
import type { UserSession, ThemeColor } from "@/types/workPlanner";
import { NotificationBell } from "./NotificationBell";
import { useExpenseRole } from "@/context/ExpenseRoleContext";

export function Topbar({
  companyInfo,
  session,
  isDark,
  onToggleDark,
  themeColor,
  onSelectThemeColor,
  onOpenMobileNav,
  onLogout,
}: {
  companyInfo?: any;
  session: UserSession;
  isDark: boolean;
  onToggleDark: () => void;
  themeColor?: ThemeColor;
  onSelectThemeColor?: (color: ThemeColor) => void;
  onOpenMobileNav: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const {
    activeMode,
    setActiveMode,
    hasDualRole,
    isCurrentAdminMode,
    isCurrentFinanceMode,
    isAdmin,
    isFinance,
    isSuper,
  } = useExpenseRole();

  const user = session?.user;

  const getPageHeader = () => {
    if (pathname.startsWith("/dashboard/settings")) {
      return {
        title: "Expense Policy Settings",
        subtitle: "Daily allowances, fuel rates, policies & approval cutoffs",
      };
    }
    if (pathname.startsWith("/dashboard/users")) {
      return {
        title: "Work Planner Users Directory",
        subtitle: "Field staff profiles, active claim volumes & live financial summaries",
      };
    }
    if (pathname.startsWith("/dashboard/claims")) {
      return {
        title: isCurrentAdminMode ? "Expense Claims Approval" : "Approved Claims Queue",
        subtitle: isCurrentAdminMode
          ? "Audit field staff daily claims, verify receipts & approve reimbursements"
          : "Review manager-audited claims queued for advance deduction & settlement",
      };
    }
    if (pathname.startsWith("/dashboard/advances")) {
      return {
        title: isCurrentAdminMode ? "Tour Advances & Sanctions" : "Advance Disbursements & Refunds",
        subtitle: isCurrentAdminMode
          ? "Request tour advances for staff itineraries & sanction pending applications"
          : "Execute bank disbursements via NEFT/UPI, record UTR & log advance refunds",
      };
    }
    if (pathname.startsWith("/dashboard/ledgers")) {
      return {
        title: "Account Passbooks & Running Ledgers",
        subtitle: "Individual debit/credit ledgers, running balances & statement downloads",
      };
    }
    if (pathname.startsWith("/dashboard/settlements")) {
      return {
        title: "Payments & Expense Settlements",
        subtitle: "Reconcile claims against advances, execute payouts & generate vouchers",
      };
    }
    if (pathname.startsWith("/dashboard/profile")) {
      return {
        title: "My Profile & Access",
        subtitle: "Account identity and assigned portal permissions",
      };
    }
    return {
      title: isCurrentAdminMode ? "Expense Control Center (Admin)" : "Expense Treasury & Accounting (Finance)",
      subtitle: isCurrentAdminMode
        ? "Operational overview of claims, pending advance approvals & field volume"
        : "Liquidity overview, pending payouts, outstanding advances & settlement velocity",
    };
  };

  const header = getPageHeader();

  const userRoleBadge = isSuper
    ? "SUPER ADMIN"
    : isAdmin && isFinance
    ? activeMode === "admin" ? "ADMIN DESK" : "FINANCE DESK"
    : isAdmin
    ? "EXPENSE ADMIN"
    : isFinance
    ? "EXPENSE FINANCE"
    : "EXPENSE VIEWER";

  return (
    <header className="relative z-30 flex shrink-0 items-center justify-between border-b border-border bg-card/95 backdrop-blur-md px-3.5 py-2.5 sm:px-6 sm:py-3">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          type="button"
          className="rounded-xl p-2 text-foreground hover:bg-surface-muted lg:hidden cursor-pointer"
          onClick={onOpenMobileNav}
          aria-label="Open Navigation Drawer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight truncate">
            {header.title}
          </h2>
          <p className="hidden sm:block text-[11px] text-muted truncate">{header.subtitle}</p>
        </div>
      </div>

      {/* Topbar Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Dual Role Quick Switcher in Topbar */}
        {hasDualRole && (
          <button
            type="button"
            onClick={() => setActiveMode(isCurrentAdminMode ? "finance" : "admin")}
            className={`hidden md:inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer ${
              isCurrentAdminMode
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                : "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/20"
            }`}
            title={`Switch to ${isCurrentAdminMode ? "Finance Desk" : "Admin Desk"}`}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>Switch to {isCurrentAdminMode ? "Finance" : "Admin"}</span>
          </button>
        )}

        {/* Notification Bell */}
        <NotificationBell />

        {/* Dark / Light Mode Toggle */}
        <button
          type="button"
          onClick={onToggleDark}
          className="rounded-xl border border-border bg-card p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
        </button>

        {/* User Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserDropdownOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-1.5 hover:bg-surface-muted transition cursor-pointer"
          >
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold text-white ${
                isCurrentAdminMode ? "bg-emerald-600" : "bg-indigo-600"
              }`}
            >
              {(user?.name || user?.email || "E").charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-foreground leading-none">{user?.name || user?.email}</p>
              <p
                className={`text-[10px] font-bold uppercase mt-0.5 ${
                  isCurrentAdminMode
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-indigo-600 dark:text-indigo-400"
                }`}
              >
                {userRoleBadge}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-2xl z-50 space-y-1">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-bold text-foreground">{user?.name}</p>
                <p className="text-[11px] text-muted truncate">{user?.email}</p>
                <div className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary uppercase">
                  {user?.department || "Field Staff"}
                </div>
              </div>

              {/* Mobile Dual Role Switch in Menu */}
              {hasDualRole && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode(isCurrentAdminMode ? "finance" : "admin");
                    setUserDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Switch Mode
                  </span>
                  <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-surface-muted border border-border">
                    {isCurrentAdminMode ? "To Finance" : "To Admin"}
                  </span>
                </button>
              )}

              <Link
                href="/dashboard/profile"
                onClick={() => setUserDropdownOpen(false)}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
              >
                <User className="h-3.5 w-3.5 text-muted" />
                Profile
              </Link>

              {isAdmin && (
                <Link
                  href="/dashboard/settings"
                  onClick={() => setUserDropdownOpen(false)}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                >
                  <Settings className="h-3.5 w-3.5 text-muted" />
                  Policy Settings
                </Link>
              )}

              <button
                onClick={() => {
                  setUserDropdownOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
