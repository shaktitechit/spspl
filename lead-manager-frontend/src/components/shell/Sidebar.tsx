"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutGrid,
  Network,
  TrendingUp,
  Users,
  X,
  Sparkles,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  badge?: string;
  show: boolean;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

export function Sidebar({
  mobileNavOpen,
  setMobileNavOpen,
  desktopCollapsed,
  setDesktopCollapsed,
  companyInfo,
}: {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  desktopCollapsed: boolean;
  setDesktopCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  companyInfo?: any;
}) {
  const pathname = usePathname();
  const { isAdmin, isManager, isCoordinator, isExecutive, roleLabel } = useLeadManagerRole();

  const companyLogoUrl = companyInfo?.logo_url || process.env.NEXT_PUBLIC_COMPANY_LOGO_URL || "";
  const companyTitle = companyInfo?.trade_name || companyInfo?.legal_name || process.env.NEXT_PUBLIC_COMPANY_NAME || "SPSPL";

  // Active route helpers
  const isDashboardActive = pathname === "/dashboard";
  const isLeadsActive =
    pathname === "/dashboard/leads" ||
    (pathname.startsWith("/dashboard/leads") &&
      !pathname.includes("follow-ups") &&
      !pathname.includes("reports"));
  const isFollowUpsActive = pathname.startsWith("/dashboard/leads/follow-ups");
  const isReportsActive = pathname.startsWith("/dashboard/leads/reports");
  const isQuotationsActive =
    pathname.startsWith("/dashboard/quotations") &&
    !pathname.includes("terms") &&
    !pathname.includes("reports");
  const isQuotationReportsActive = pathname.startsWith("/dashboard/quotations/reports");
  const isTermsActive = pathname.startsWith("/dashboard/quotations/terms");
  const isTeamManagerActive = pathname.startsWith("/dashboard/team-manager");

  const showLeadReports = isAdmin || isManager || isCoordinator || isExecutive;
  const leadReportsLabel = isAdmin || isManager || isCoordinator ? "Team Reports" : "My Reports";
  const canAccessQuotes = isAdmin || isManager || isCoordinator || isExecutive;
  const canAccessCommercialMasters = isAdmin || isManager || isCoordinator;

  // Grouped Navigation Structure
  const categories: NavCategory[] = [
    {
      title: "Workspace",
      items: [
        {
          label: "Dashboard",
          href: "/dashboard",
          icon: LayoutGrid,
          isActive: isDashboardActive,
          show: true,
        },
      ],
    },
    {
      title: "Pipeline",
      items: [
        {
          label: "Leads",
          href: "/dashboard/leads",
          icon: Users,
          isActive: isLeadsActive,
          show: true,
        },
        {
          label: "Follow-Ups",
          href: "/dashboard/leads/follow-ups",
          icon: CalendarDays,
          isActive: isFollowUpsActive,
          show: true,
        },
        {
          label: leadReportsLabel,
          href: "/dashboard/leads/reports",
          icon: BarChart3,
          isActive: isReportsActive,
          show: showLeadReports,
        },
      ],
    },
    {
      title: "Commercial",
      items: [
        {
          label: "Quotations",
          href: "/dashboard/quotations",
          icon: FileText,
          isActive: isQuotationsActive,
          show: canAccessQuotes,
        },
        {
          label: "Quote Reports",
          href: "/dashboard/quotations/reports",
          icon: TrendingUp,
          isActive: isQuotationReportsActive,
          show: canAccessQuotes,
        },
        {
          label: "Terms & Conditions",
          href: "/dashboard/quotations/terms",
          icon: BookOpen,
          isActive: isTermsActive,
          show: canAccessCommercialMasters,
        },
      ],
    },
    {
      title: "Organization",
      items: [
        {
          label: "Team Manager",
          href: "/dashboard/team-manager",
          icon: Network,
          isActive: isTeamManagerActive,
          show: canAccessCommercialMasters,
        },
      ],
    },
  ];

  const lgWidth = desktopCollapsed ? "lg:w-[68px] lg:min-w-[68px]" : "lg:w-60 lg:min-w-60";

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        aria-hidden={!mobileNavOpen}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileNavOpen(false)}
      />

      {/* Main Sidebar Shell */}
      <aside
        id="app-sidebar"
        className={`fixed left-0 top-0 z-40 flex h-screen max-h-screen min-h-0 w-[min(16rem,85vw)] flex-col overflow-hidden border-r border-border bg-card shadow-2xl transition-[width,min-width,transform] duration-300 ease-in-out lg:relative lg:z-0 lg:h-full lg:min-h-0 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none ${lgWidth} ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Company Header */}
        <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-border/80 px-3.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 min-w-0"
            onClick={() => setMobileNavOpen(false)}
          >
            {companyLogoUrl ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-muted p-0.5 shadow-2xs">
                <img
                  src={companyLogoUrl}
                  alt={companyTitle}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-primary-hover text-white shadow-2xs">
                <CheckSquare className="h-5 w-5" />
              </div>
            )}

            {!desktopCollapsed && (
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-xs font-black tracking-tight text-foreground uppercase truncate">
                  {companyTitle}
                </span>
                <span className="text-[10px] font-bold text-primary tracking-wider uppercase truncate mt-0.5">
                  Lead Manager
                </span>
              </div>
            )}
          </Link>

          {/* Mobile Close Button */}
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted lg:hidden transition cursor-pointer"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Categories & Items */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 scrollbar-none">
          {categories.map((cat, catIdx) => {
            const visibleItems = cat.items.filter((item) => item.show);
            if (visibleItems.length === 0) return null;

            return (
              <div key={cat.title} className="space-y-1">
                {/* Category Header (hidden when collapsed on desktop) */}
                {!desktopCollapsed && (
                  <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muted/70">
                    <span>{cat.title}</span>
                    {catIdx === 0 && (
                      <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase">
                        {roleLabel}
                      </span>
                    )}
                  </div>
                )}

                {/* Nav Links */}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.href} className="relative group">
                        <Link
                          href={item.href}
                          onClick={() => setMobileNavOpen(false)}
                          className={`relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                            desktopCollapsed ? "justify-center" : "justify-start"
                          } ${
                            item.isActive
                              ? "bg-primary/10 text-primary font-bold shadow-2xs border border-primary/20"
                              : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
                          }`}
                        >
                          <Icon
                            className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-105 ${
                              item.isActive ? "text-primary" : "text-muted"
                            }`}
                          />

                          {!desktopCollapsed && (
                            <span className="truncate">{item.label}</span>
                          )}

                          {item.badge && !desktopCollapsed && (
                            <span className="ml-auto rounded-full bg-primary/20 px-1.5 py-0.2 text-[9px] font-bold text-primary">
                              {item.badge}
                            </span>
                          )}
                        </Link>

                        {/* Collapsed Tooltip on Desktop */}
                        {desktopCollapsed && (
                          <div className="pointer-events-none fixed left-[72px] z-50 hidden rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-xl opacity-0 transition-opacity group-hover:opacity-100 lg:block">
                            <span>{item.label}</span>
                            <span className="ml-2 text-[10px] text-muted">
                              ({cat.title})
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Collapse Toggle (Desktop only) */}
        <div className="mt-auto hidden border-t border-border/80 p-2 lg:flex">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
            onClick={() => setDesktopCollapsed((c) => !c)}
            title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {desktopCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs font-semibold">Collapse Navigation</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
