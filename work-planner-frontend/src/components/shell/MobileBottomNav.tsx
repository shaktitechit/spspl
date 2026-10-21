"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  CheckSquare,
  CalendarDays,
  DollarSign,
  Sparkles,
  Menu,
} from "lucide-react";
import { useGetSeniorRemarksFeedQuery } from "@/store/api/workPlannerApiSlice";

export function MobileBottomNav({
  onOpenMobileDrawer,
}: {
  onOpenMobileDrawer: () => void;
}) {
  const pathname = usePathname();
  const { data: remarksData } = useGetSeniorRemarksFeedQuery(undefined);
  const pendingDirectives = remarksData?.stats?.pending_response_count || 0;

  const isHomeActive = pathname === "/dashboard";
  const isPlansActive = pathname.startsWith("/dashboard/plans") && !pathname.startsWith("/dashboard/plans/calendar");
  const isTasksVisitsActive = pathname.startsWith("/dashboard/tasks-visits");
  const isExpensesActive = pathname.startsWith("/dashboard/expenses");
  const isDirectivesActive = pathname.startsWith("/dashboard/senior-remarks");

  const navItems = [
    {
      name: "Overview",
      href: "/dashboard",
      icon: LayoutGrid,
      active: isHomeActive,
    },
    {
      name: "Plans",
      href: "/dashboard/plans",
      icon: CheckSquare,
      active: isPlansActive,
    },
    {
      name: "Visits & Tasks",
      href: "/dashboard/tasks-visits",
      icon: CalendarDays,
      active: isTasksVisitsActive,
    },
    {
      name: "Expenses",
      href: "/dashboard/expenses",
      icon: DollarSign,
      active: isExpensesActive,
    },
    {
      name: "Directives",
      href: "/dashboard/senior-remarks",
      icon: Sparkles,
      active: isDirectivesActive,
      badge: pendingDirectives > 0 ? pendingDirectives : undefined,
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border/80 bg-card/90 px-1 py-1.5 backdrop-blur-lg shadow-2xl transition-all duration-200 lg:hidden pb-[calc(env(safe-area-inset-bottom,0px)+0.35rem)]"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`group relative flex flex-1 flex-col items-center justify-center rounded-xl py-1 text-[10px] font-semibold transition-all duration-150 ${
              item.active
                ? "text-primary"
                : "text-muted hover:text-foreground active:scale-95"
            }`}
          >
            {/* Active Indicator Top Pill */}
            {item.active && (
              <span className="absolute -top-1.5 h-1 w-6 rounded-full bg-primary animate-in fade-in zoom-in-75 duration-200" />
            )}

            <div className="relative flex items-center justify-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                  item.active
                    ? "bg-primary/15 text-primary shadow-xs"
                    : "text-muted group-hover:bg-surface-muted/60"
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>

              {/* Notification / Badge Counter */}
              {item.badge !== undefined && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-xs animate-pulse">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </div>

            <span className="mt-0.5 truncate tracking-tight text-[10px] font-medium leading-tight">
              {item.name}
            </span>
          </Link>
        );
      })}

      {/* More / Menu Drawer Trigger */}
      <button
        type="button"
        onClick={onOpenMobileDrawer}
        className="group relative flex flex-1 flex-col items-center justify-center rounded-xl py-1 text-[10px] font-semibold text-muted hover:text-foreground active:scale-95 transition-all duration-150 cursor-pointer"
        aria-label="Open More Menu"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-xl text-muted group-hover:bg-surface-muted/60">
          <Menu className="h-4.5 w-4.5" />
        </div>
        <span className="mt-0.5 truncate tracking-tight text-[10px] font-medium leading-tight">
          More
        </span>
      </button>
    </nav>
  );
}
