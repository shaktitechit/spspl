"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Sun,
  User,
  Search,
  Sparkles,
  Command,
} from "lucide-react";
import type { UserSession, ThemeColor } from "@/types/leadManager";
import { isAdmin, isCoordinator, isManager } from "@/utils/authStorage";
import { NotificationBell } from "./NotificationBell";
import { Breadcrumbs } from "./Breadcrumbs";
import { CommandPaletteModal } from "./CommandPaletteModal";

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
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const user = session?.user;
  const adminRole = isAdmin(user);
  const managerRole = isManager(user);
  const coordinatorRole = isCoordinator(user);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const userRoleBadge = adminRole
    ? "Lead Admin"
    : managerRole
    ? "Lead Manager"
    : coordinatorRole
    ? "Coordinator"
    : "Executive";

  const userInitials = (user?.name || user?.email || "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-card/85 backdrop-blur-md px-3 sm:px-6 transition-colors">
        {/* Left Section: Mobile Nav Trigger & Dynamic Breadcrumbs */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            className="rounded-xl p-2 text-foreground hover:bg-surface-muted lg:hidden transition cursor-pointer"
            onClick={onOpenMobileNav}
            aria-label="Open mobile navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex items-center">
            <Breadcrumbs />
          </div>
        </div>

        {/* Center / Action Section: Quick Search (Cmd+K) Trigger */}
        <div className="hidden md:flex items-center mx-4 flex-1 max-w-sm">
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="group flex w-full items-center justify-between gap-2 rounded-xl border border-border/80 bg-surface-muted/60 px-3 py-1.5 text-xs text-muted hover:border-primary/40 hover:bg-surface-muted transition shadow-2xs cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted group-hover:text-primary transition-colors" />
              <span className="text-muted/80">Search leads, actions, quotes…</span>
            </span>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted shadow-2xs">
              <Command className="h-2.5 w-2.5" /> K
            </kbd>
          </button>
        </div>

        {/* Right Section: Mobile Search, Notifications, Theme, User Dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile Search Button */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="flex md:hidden rounded-xl border border-border bg-card p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
            title="Search (Cmd+K)"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Notification Bell */}
          <NotificationBell />

          {/* Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={onToggleDark}
            className="rounded-xl border border-border bg-card p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle color theme"
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700 transition-transform hover:-rotate-12" />
            )}
          </button>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdownOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl border border-border bg-card p-1 sm:px-2.5 sm:py-1 hover:bg-surface-muted transition cursor-pointer shadow-2xs"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-primary-hover text-xs font-bold text-white shadow-2xs">
                {userInitials}
              </div>
              <div className="hidden sm:block text-left max-w-[120px] truncate">
                <p className="text-xs font-bold text-foreground leading-none truncate">
                  {user?.name || user?.email}
                </p>
                <p className="text-[10px] font-semibold text-primary uppercase mt-0.5 tracking-wider truncate">
                  {userRoleBadge}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted hidden sm:block" />
            </button>

            {userDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-border bg-card p-2 shadow-2xl z-50 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2.5 border-b border-border/80">
                    <p className="text-xs font-bold text-foreground truncate">
                      {user?.name || "Portal User"}
                    </p>
                    <p className="text-[11px] text-muted truncate mt-0.5">
                      {user?.email}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary uppercase">
                        {userRoleBadge}
                      </span>
                      {user?.department && (
                        <span className="inline-block rounded-full bg-surface-muted px-2 py-0.5 text-[9px] font-semibold text-muted uppercase">
                          {user.department}
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    href="/dashboard/profile"
                    onClick={() => setUserDropdownOpen(false)}
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                  >
                    <User className="h-3.5 w-3.5 text-muted" />
                    Account Profile
                  </Link>

                  <button
                    type="button"
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
              </>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Palette Modal */}
      <CommandPaletteModal
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </>
  );
}
