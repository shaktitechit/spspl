"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sun, Moon, ChevronDown, LogOut, User } from "lucide-react";
import type { UserSession, ThemeColor } from "@/types/userManager";
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

  const getPageHeader = () => {
    if (pathname.startsWith("/dashboard/profile")) {
      return {
        title: "Super Admin Portal / Profile",
        subtitle: "Your account details and access",
      };
    }
    if (pathname.startsWith("/dashboard/company-info")) {
      return {
        title: "Super Admin Portal / Company Information",
        subtitle: "Parent Organization Profile, Branding & System Settings",
      };
    }
    if (pathname.startsWith("/dashboard/user-directory")) {
      return {
        title: "Super Admin Portal / User Management",
        subtitle: "Decoupled Micro-Frontend Architecture & User Directory",
      };
    }
    return {
      title: "Super Admin Portal / Control Center",
      subtitle: "System Overview, Live Metrics & Core Operations",
    };
  };

  const header = getPageHeader();

  return (
    <header className="relative z-30 flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-lg p-2 text-foreground hover:bg-surface-muted lg:hidden"
          onClick={onOpenMobileNav}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight">
            {header.title}
          </h2>
          <p className="text-2xs text-muted">{header.subtitle}</p>
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
              {(session.user.name || "S").charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-foreground leading-none">{session.user.name}</p>
              <p className="text-3xs text-primary font-bold uppercase mt-0.5">Super Admin</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-2xl z-50 space-y-1">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-bold text-foreground">{session.user.name}</p>
                <p className="text-2xs text-muted truncate">{session.user.email}</p>
              </div>

              <Link
                href="/dashboard/profile"
                onClick={() => setUserDropdownOpen(false)}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
              >
                <User className="h-3.5 w-3.5 text-muted" />
                Profile
              </Link>

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
