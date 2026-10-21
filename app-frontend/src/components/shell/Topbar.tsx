"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, Moon, Sun, User } from "lucide-react";
import type { UserSession, ThemeColor } from "@/types/leadManager";
import {
  formatLabel,
  getDepartment,
  getPrimaryRoleCode,
  getRoleCodes,
} from "@/constants/dashboardAccess";
import { NotificationBell } from "./NotificationBell";
import { resolveRoleLabels } from "@/utils/resolveRoleLabels";

export function Topbar({
  session,
  isDark,
  onToggleDark,
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
  const department = getDepartment(user);
  const roleCodes = getRoleCodes(user);
  const roleLabels = resolveRoleLabels(user);
  const primaryRole = getPrimaryRoleCode(user);
  const deptLabel = formatLabel(department) || department;
  const roleLabel =
    roleLabels[0] ||
    (primaryRole
      ? formatLabel(primaryRole)
      : roleCodes.map(formatLabel).filter(Boolean).join(", "));

  const isProfile = pathname.startsWith("/dashboard/profile");

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
            {isProfile
              ? "My Profile"
              : deptLabel
                ? `${deptLabel} Dashboard`
                : "Dashboard"}
          </h2>
          <p className="text-[11px] text-muted">
            {isProfile
              ? "Account details and password"
              : [deptLabel, roleLabel].filter(Boolean).join(" · ") ||
                "Portal control center"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationBell />

        <button
          type="button"
          onClick={onToggleDark}
          className="rounded-xl border border-border bg-card p-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-slate-700" />
          )}
        </button>

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
              <p className="text-xs font-semibold text-foreground leading-none">
                {user?.name || user?.email}
              </p>
              <p className="text-[10px] text-primary font-bold uppercase mt-0.5">
                {roleLabel || deptLabel || "USER"}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-2xl z-50 space-y-1">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-bold text-foreground">{user?.name}</p>
                <p className="text-[11px] text-muted truncate">{user?.email}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {department ? (
                    <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary uppercase">
                      {deptLabel}
                    </span>
                  ) : null}
                  {roleLabels.length
                    ? roleLabels.map((label) => (
                        <span
                          key={label}
                          className="inline-block rounded-full bg-surface-muted px-2 py-0.5 text-[9px] font-bold text-muted uppercase"
                        >
                          {label}
                        </span>
                      ))
                    : roleCodes.map((code) => (
                        <span
                          key={code}
                          className="inline-block rounded-full bg-surface-muted px-2 py-0.5 text-[9px] font-bold text-muted uppercase"
                        >
                          {formatLabel(code)}
                        </span>
                      ))}
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
