"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, Moon, Sun, User, Settings } from "lucide-react";
import type { UserSession, ThemeColor } from "@/types/workPlanner";
import { isWpAdmin, isWpManager, isWpCoordinator } from "@/utils/authStorage";
import { NotificationBell } from "./NotificationBell";

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

  const user = session?.user;
  const adminRole = isWpAdmin(user);
  const managerRole = isWpManager(user);
  const coordinatorRole = isWpCoordinator(user);

  const getPageHeader = () => {
    if (pathname.startsWith("/dashboard/settings") && pathname.includes("/visits")) {
      return {
        title: "Visit Template Designer",
        subtitle: "Single field visit planning & outcome reporting template",
      };
    }
    if (pathname.startsWith("/dashboard/settings") && pathname.includes("/tasks")) {
      return {
        title: "Task Template Designer",
        subtitle: "Custom user tasks, creation requirements & outcome report templates",
      };
    }
    if (pathname.startsWith("/dashboard/settings")) {
      return {
        title: "Portal Settings",
        subtitle: "Global work planning policies, GPS rules & allowances",
      };
    }
    if (pathname.startsWith("/dashboard/team-manager")) {
      return {
        title: "Team Manager",
        subtitle: "Map who reports to whom across teams",
      };
    }
    if (pathname.startsWith("/dashboard/assigned-teams")) {
      return {
        title: "Assigned Teams",
        subtitle: "Organisation-wide team activity & expenses",
      };
    }
    if (pathname.startsWith("/dashboard/my-team") || pathname.startsWith("/dashboard/assigned-users")) {
      return {
        title: "My Team",
        subtitle: "Your direct reports and team activity",
      };
    }
    if (pathname.startsWith("/dashboard/profile")) {
      return {
        title: "Profile & Settings",
        subtitle: "Your account details and portal access",
      };
    }
    if (pathname.startsWith("/dashboard/senior-remarks")) {
      return {
        title: "Senior Directives",
        subtitle: "Supervisory directives, guidance & objections",
      };
    }
    if (pathname.startsWith("/dashboard/tasks-visits")) {
      return {
        title: "Tasks & Visits",
        subtitle: "Field visits, activities & doctor meetings",
      };
    }
    if (pathname.startsWith("/dashboard/plans/calendar")) {
      return {
        title: "Calendar Schedule",
        subtitle: "Interactive schedule & planned visits calendar",
      };
    }
    if (pathname.startsWith("/dashboard/plans")) {
      return {
        title: "Work Plans",
        subtitle: "Daily visit itineraries, tasks & field logs",
      };
    }
    if (pathname.startsWith("/dashboard/expenses")) {
      return {
        title: "Expense Claims",
        subtitle: "Reimbursements, receipts & travel claims",
      };
    }
    if (pathname.startsWith("/dashboard/analytics")) {
      return {
        title: "Analytics & Caliber",
        subtitle: "Performance metrics, AI score & execution stats",
      };
    }
    return {
      title: "Control Center",
      subtitle: "Execution overview, stats & field activity",
    };
  };

  const header = getPageHeader();

  const userRoleBadge = adminRole
    ? "ADMIN PORTAL"
    : managerRole
    ? "MANAGER PORTAL"
    : coordinatorRole
    ? "COORDINATOR PORTAL"
    : "EXECUTIVE PORTAL";

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
        {/* Notification Bell */}
        <NotificationBell />

        {/* Dark / Light Mode Toggle */}
        <button
          type="button"
          onClick={onToggleDark}
          className="rounded-xl border border-border bg-card p-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
        </button>

        {/* User Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserDropdownOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-1.5 hover:bg-surface-muted transition"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-white">
              {(user?.name || user?.email || "W").charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-foreground leading-none">{user?.name || user?.email}</p>
              <p className="text-[10px] text-primary font-bold uppercase mt-0.5">{userRoleBadge}</p>
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

              <Link
                href="/dashboard/profile"
                onClick={() => setUserDropdownOpen(false)}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
              >
                <User className="h-3.5 w-3.5 text-muted" />
                Profile
              </Link>

              {adminRole && (
                <Link
                  href="/dashboard/settings"
                  onClick={() => setUserDropdownOpen(false)}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                >
                  <Settings className="h-3.5 w-3.5 text-muted" />
                  Portal Settings
                </Link>
              )}

              <button
                onClick={() => {
                  setUserDropdownOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition"
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
