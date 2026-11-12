"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  Package,
  UserRound,
} from "lucide-react";

export interface SalesAnalyticsDropdownProps {
  portalHome: string;
  currentView: "overview" | "sales-analytics";
  currentSubPage?: "orders" | "products" | "parties" | "sales-persons" | string;
  className?: string;
  variant?: "header" | "compact";
}

const ANALYTICS_SUBPAGES = [
  {
    id: "orders",
    label: "Order Analytics",
    icon: ClipboardList,
    sub: "Monthly volume & trends",
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "products",
    label: "Product Analytics",
    icon: Package,
    sub: "SKU rankings & rate splits",
    color: "text-violet-600 dark:text-violet-400",
  },
  {
    id: "parties",
    label: "Party Analytics",
    icon: Building2,
    sub: "Client & dealer ordering",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "sales-persons",
    label: "Sales Person Analytics",
    icon: UserRound,
    sub: "Team rankings & matrix",
    color: "text-indigo-600 dark:text-indigo-400",
  },
] as const;

export default function SalesAnalyticsDropdown({
  portalHome,
  currentView,
  currentSubPage = "orders",
  className = "",
  variant = "header",
}: SalesAnalyticsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const overviewHref = portalHome;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${className}`}
    >
      <button
        type="button"
        id="sales-analytics-menu-button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={
          variant === "compact"
            ? "flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            : "flex items-center gap-2 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 px-3.5 py-2 text-sm font-semibold text-blue-700 shadow-2xs hover:from-blue-100 hover:to-indigo-100 dark:border-blue-500/30 dark:from-blue-950/40 dark:to-indigo-950/40 dark:text-blue-300 dark:hover:from-blue-900/60 dark:hover:to-indigo-900/60 transition cursor-pointer"
        }
      >
        <BarChart3
          className={
            variant === "compact"
              ? "h-3.5 w-3.5 text-blue-600 dark:text-blue-400"
              : "h-4 w-4 text-blue-600 dark:text-blue-400"
          }
        />
        <span className="truncate">
          {currentView === "sales-analytics" ? "Sales Analytics" : "Sales Analytics"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-blue-500/80 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5 dark:border-white/10 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5">
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
              Dashboard Navigation
            </p>
          </div>

          <div className="py-1 space-y-1">
            <Link
              href={overviewHref}
              onClick={() => setIsOpen(false)}
              className={`flex items-start gap-3 rounded-xl p-2.5 transition text-left ${
                currentView === "overview"
                  ? "bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200 font-semibold"
                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
              }`}
            >
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  currentView === "overview"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Overview Dashboard
                  </span>
                  {currentView === "overview" && (
                    <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                  Pipeline donut, queue cards & quick access
                </p>
              </div>
            </Link>
          </div>

          <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-white/5 px-1">
            <p className="text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500 px-2 py-1">
              Sales Analytics Pages
            </p>
            <div className="space-y-0.5">
              {ANALYTICS_SUBPAGES.map((sub) => {
                const SubIcon = sub.icon;
                const isSubActive =
                  currentView === "sales-analytics" &&
                  currentSubPage === sub.id;
                const href = `${portalHome}/sales-analytics/${sub.id}`;
                return (
                  <Link
                    key={sub.id}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition text-left ${
                      isSubActive
                        ? "bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200 font-semibold"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <SubIcon
                      className={`h-4 w-4 shrink-0 mt-0.5 ${sub.color}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {sub.label}
                        </span>
                        {isSubActive && (
                          <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        {sub.sub}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
