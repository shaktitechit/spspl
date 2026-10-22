/**
 * @fileoverview Lead Manager Control Center Dashboard.
 * Features cleanly separated sections for Leads Management and Quotations Commercial Hub.
 * Tailored by role for Executive, Manager, and Admin.
 * @module app/dashboard/page
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { LeadsDashboardSection } from "@/components/dashboard/LeadsDashboardSection";
import { QuotationsDashboardSection } from "@/components/dashboard/QuotationsDashboardSection";
import {
  Users,
  CalendarDays,
  Plus,
  BarChart3,
  FileText,
  LayoutGrid,
  Sparkles,
  TrendingUp,
  Target,
  ArrowUpRight,
} from "lucide-react";

export default function DashboardPage() {
  const { user, isAdmin, isManager, isCoordinator, isExecutive, roleLabel } = useLeadManagerRole();
  const canAccessQuotations = isAdmin || isManager || isCoordinator || isExecutive;

  const [activeSection, setActiveSection] = useState<"all" | "leads" | "quotations">("all");

  return (
    <div className="space-y-6 font-sans">
      {/* Top Welcome & Navigation Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm">
        {/* Ambient background decoration */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 -bottom-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Welcome back, {user?.name || "User"}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                  isAdmin
                    ? "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                    : isManager
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : isCoordinator
                    ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                    : "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isAdmin
                      ? "bg-purple-500"
                      : isManager
                      ? "bg-amber-500"
                      : isCoordinator
                      ? "bg-indigo-500"
                      : "bg-blue-500"
                  } animate-pulse`}
                />
                {roleLabel} Access
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              {isAdmin
                ? "Lead Admin Control Center — Comprehensive pipeline tracking, commercial approvals, and sales conversion analytics."
                : isManager
                ? "Manager Lead & Commercial Hub — Oversee assigned leads, manage pricing proposals, and drive deal negotiations."
                : isCoordinator
                ? "Coordinator Operations Hub — Coordinate sales representatives, oversee team follow-ups, and track lead progression."
                : "Executive Lead Center — Manage assigned leads, review commercial proposals, execute follow-ups, and track performance."}
            </p>
          </div>

          {/* Global Action Links */}
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <>
                <Link
                  href="/dashboard/leads"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Team Pipeline</span>
                </Link>
                <Link
                  href="/dashboard/quotations"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Quotations Hub</span>
                </Link>
                <Link
                  href="/dashboard/quotations/reports"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Quote Reports</span>
                </Link>
                <Link
                  href="/dashboard/leads/reports"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Team Sales Reports</span>
                </Link>
              </>
            ) : isManager ? (
              <>
                <Link
                  href="/dashboard/leads/new"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Lead</span>
                </Link>
                <Link
                  href="/dashboard/quotations"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>My Quotations</span>
                </Link>
                <Link
                  href="/dashboard/leads/follow-ups"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Follow-Ups</span>
                </Link>
                <Link
                  href="/dashboard/quotations/reports"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Quote Reports</span>
                </Link>
                <Link
                  href="/dashboard/leads/reports"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Team Sales Report</span>
                </Link>
              </>
            ) : isCoordinator ? (
              <>
                <Link
                  href="/dashboard/leads/new"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Lead</span>
                </Link>
                <Link
                  href="/dashboard/quotations"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>My Quotations</span>
                </Link>
                <Link
                  href="/dashboard/leads/follow-ups"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Follow-Ups</span>
                </Link>
                <Link
                  href="/dashboard/quotations/reports"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Quote Reports</span>
                </Link>
                <Link
                  href="/dashboard/leads/reports"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Team Sales Report</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/dashboard/leads/new"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Lead</span>
                </Link>
                <Link
                  href="/dashboard/quotations"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>My Quotations</span>
                </Link>
                <Link
                  href="/dashboard/leads/follow-ups"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>My Follow-Ups</span>
                </Link>
                <Link
                  href="/dashboard/quotations/reports"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Quote Reports</span>
                </Link>
                <Link
                  href="/dashboard/leads/reports"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shadow-2xs"
                >
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Team Sales Reports</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Section Filter Switcher (When Quotations Access is Enabled) */}
      {canAccessQuotations && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-1.5 backdrop-blur-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveSection("all")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeSection === "all"
                  ? "bg-card text-foreground shadow-2xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-muted/50"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Complete Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("leads")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeSection === "leads"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-muted/50"
              }`}
            >
              <Target className="h-3.5 w-3.5" />
              <span>Leads Pipeline</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("quotations")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeSection === "quotations"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-muted/50"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Commercial Hub</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 pr-3 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Unified CRM &amp; Commercial Proposal Engine</span>
          </div>
        </div>
      )}

      {/* SECTION 1: Leads Management & Pipeline */}
      {(activeSection === "all" || activeSection === "leads") && (
        <LeadsDashboardSection
          portalHome="/dashboard"
          assigned_to={isExecutive ? (user?._id || (user as any)?.id) : undefined}
          isAdmin={isAdmin}
          isManager={isManager}
          isCoordinator={isCoordinator}
          isExecutive={isExecutive}
        />
      )}

      {/* SECTION 2: Quotations Commercial Hub */}
      {canAccessQuotations && (activeSection === "all" || activeSection === "quotations") && (
        <QuotationsDashboardSection portalHome="/dashboard" />
      )}
    </div>
  );
}
