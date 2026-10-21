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
  Layers,
  Sparkles,
  TrendingUp,
} from "lucide-react";

export default function DashboardPage() {
  const { user, isAdmin, isManager, isCoordinator, isExecutive, roleLabel } = useLeadManagerRole();
  const canAccessQuotations = isAdmin || isManager || isCoordinator || isExecutive;

  const [activeSection, setActiveSection] = useState<"all" | "leads" | "quotations">("all");

  return (
    <div className="space-y-6 font-sans">
      {/* Top Welcome & Navigation Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-primary/95 via-primary to-primary-hover p-6 text-primary-foreground shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight">
              Welcome back, {user?.name || "User"}!
            </h1>
            <span
              className={`rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                isAdmin
                  ? "bg-purple-400 text-slate-900"
                  : isManager
                  ? "bg-amber-400 text-slate-900"
                  : isCoordinator
                  ? "bg-indigo-400 text-slate-900"
                  : "bg-blue-400 text-slate-900"
              }`}
            >
              {roleLabel} Access
            </span>
          </div>
          <p className="mt-1 text-xs opacity-90 max-w-xl">
            {isAdmin
              ? "Lead Admin Control Center — Comprehensive pipeline tracking, quotation commercial approvals, and sales conversion analytics."
              : isManager
              ? "Manager Lead & Commercial Hub — Oversee assigned leads, manage pricing proposals, and drive deal negotiations."
              : isCoordinator
              ? "Coordinator Operations Hub — Coordinate sales representatives, oversee team follow-ups, and track lead progression."
              : "Executive Lead Center — Manage assigned leads, view your quotations and proposals, execute follow-ups, and track performance."}
          </p>
        </div>

        {/* Global Action Links */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <>
              <Link
                href="/dashboard/leads"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <Users className="h-4 w-4" />
                Team Pipeline
              </Link>
              <Link
                href="/dashboard/quotations"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <FileText className="h-4 w-4" />
                Quotations Hub
              </Link>
              <Link
                href="/dashboard/quotations/reports"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <TrendingUp className="h-4 w-4" />
                Quote Reports
              </Link>
              <Link
                href="/dashboard/leads/reports"
                className="flex items-center gap-1.5 rounded-xl bg-white text-primary px-3.5 py-2 text-xs font-bold hover:bg-white/90 shadow-md transition"
              >
                <BarChart3 className="h-4 w-4" />
                Team Sales Reports
              </Link>
            </>
          ) : isManager ? (
            <>
              <Link
                href="/dashboard/leads/new"
                className="flex items-center gap-1.5 rounded-xl bg-white text-primary px-3.5 py-2 text-xs font-bold hover:bg-white/90 shadow-md transition"
              >
                <Plus className="h-4 w-4" />
                Create Lead
              </Link>
              <Link
                href="/dashboard/quotations"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <FileText className="h-4 w-4" />
                My Quotations
              </Link>
              <Link
                href="/dashboard/leads/follow-ups"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <CalendarDays className="h-4 w-4" />
                Follow-Ups
              </Link>
              <Link
                href="/dashboard/quotations/reports"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <TrendingUp className="h-4 w-4" />
                Quote Reports
              </Link>
              <Link
                href="/dashboard/leads/reports"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <BarChart3 className="h-4 w-4" />
                Team Sales Report
              </Link>
            </>
          ) : isCoordinator ? (
            <>
              <Link
                href="/dashboard/leads/new"
                className="flex items-center gap-1.5 rounded-xl bg-white text-primary px-3.5 py-2 text-xs font-bold hover:bg-white/90 shadow-md transition"
              >
                <Plus className="h-4 w-4" />
                Create Lead
              </Link>
              <Link
                href="/dashboard/quotations"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <FileText className="h-4 w-4" />
                My Quotations
              </Link>
              <Link
                href="/dashboard/leads/follow-ups"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <CalendarDays className="h-4 w-4" />
                Follow-Ups
              </Link>
              <Link
                href="/dashboard/quotations/reports"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <TrendingUp className="h-4 w-4" />
                Quote Reports
              </Link>
              <Link
                href="/dashboard/leads/reports"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <BarChart3 className="h-4 w-4" />
                Team Sales Report
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/dashboard/leads/new"
                className="flex items-center gap-1.5 rounded-xl bg-white text-primary px-3.5 py-2 text-xs font-bold hover:bg-white/90 shadow-md transition"
              >
                <Plus className="h-4 w-4" />
                Create Lead
              </Link>
              <Link
                href="/dashboard/quotations"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <FileText className="h-4 w-4" />
                My Quotations
              </Link>
              <Link
                href="/dashboard/leads/follow-ups"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <CalendarDays className="h-4 w-4" />
                My Follow-Ups
              </Link>
              <Link
                href="/dashboard/quotations/reports"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <TrendingUp className="h-4 w-4" />
                Quote Reports
              </Link>
              <Link
                href="/dashboard/leads/reports"
                className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <BarChart3 className="h-4 w-4" />
                Team Sales Reports
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Section Filter Switcher (When Quotations Access is Enabled) */}
      {canAccessQuotations && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-white/10 dark:bg-slate-900/60">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveSection("all")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeSection === "all"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Complete Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("leads")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeSection === "leads"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>🎯 Leads Pipeline Hub</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("quotations")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeSection === "quotations"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>💼 Quotations & Proposals Hub</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 pr-3 text-[11px] font-semibold text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Separated Operational & Commercial Modules</span>
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
