/**
 * @fileoverview Main Dashboard page for Expense Portal with tailored Admin and Finance views.
 * @module app/dashboard/page
 */
"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Receipt,
  Wallet,
  Scale,
  CreditCard,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FileSpreadsheet,
  ShieldCheck,
  Landmark,
  ArrowRightLeft,
} from "lucide-react";
import { useGetExpenseKpisQuery, useGetWorkPlannerUsersQuery } from "@/store/api/expenseApiSlice";
import { useExpenseRole } from "@/context/ExpenseRoleContext";

export default function ExpenseDashboardPage() {
  const {
    activeMode,
    setActiveMode,
    hasDualRole,
    isCurrentAdminMode,
    isCurrentFinanceMode,
    isAdmin,
    isFinance,
    user,
  } = useExpenseRole();

  const { data: kpi, isLoading: kpiLoading } = useGetExpenseKpisQuery();
  const { data: wpUsersData } = useGetWorkPlannerUsersQuery();

  const totalUsers = wpUsersData?.total || 0;

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner - Customized by active mode */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6 text-white shadow-xl transition-all duration-300 ${
          isCurrentAdminMode
            ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700"
            : "bg-gradient-to-r from-indigo-700 via-slate-800 to-indigo-900"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-sm">
              {isCurrentAdminMode ? "Admin Operations Desk" : "Finance Treasury & Ledgers Desk"}
            </span>
            <span className="text-xs text-white/80">Work Planner Integrated</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Welcome back, {user?.name || "User"}!
          </h1>
          <p className="mt-1 text-xs text-white/90 max-w-xl">
            {isCurrentAdminMode
              ? "Oversee daily field expense claims, inspect attached visit bills, and sanction tour advances for all Work Planner users."
              : "Access running account ledgers, track passbook debit/credit positions, disburse sanctioned advances, and execute claim settlements."}
          </p>
        </div>

        {/* Quick Action Header Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {isCurrentAdminMode && (
            <>
              <Link
                href="/dashboard/claims"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 shadow-md transition cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Review Pending Claims ({(kpi?.pending_approval_claims || 0)})
              </Link>

              <Link
                href="/dashboard/advances"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/20 backdrop-blur-sm transition cursor-pointer"
              >
                <Wallet className="h-4 w-4" />
                Sanction Advances ({(kpi?.pending_advances_count || 0)})
              </Link>
            </>
          )}

          {isCurrentFinanceMode && (
            <>
              <Link
                href="/dashboard/settlements"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-indigo-900 hover:bg-indigo-50 shadow-md transition cursor-pointer"
              >
                <CreditCard className="h-4 w-4 text-indigo-600" />
                Process Settlement
              </Link>

              <Link
                href="/dashboard/ledgers"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/20 backdrop-blur-sm transition cursor-pointer"
              >
                <Scale className="h-4 w-4" />
                User Ledgers &amp; Passbooks
              </Link>
            </>
          )}

          <Link
            href="/dashboard/users"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/20 backdrop-blur-sm transition cursor-pointer"
          >
            <Users className="h-4 w-4" />
            Field Users ({totalUsers})
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pending Claims */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">Pending Claims Approval</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-foreground">
              {kpiLoading ? "…" : kpi?.pending_approval_claims || 0}
            </span>
            <p className="mt-0.5 text-xs text-muted">Awaiting admin review</p>
          </div>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
            <span className="text-muted">Total: ₹{(kpi?.total_claims_amount || 0).toLocaleString()}</span>
            <Link href="/dashboard/claims" className="font-bold text-primary hover:underline">
              Inspect &rarr;
            </Link>
          </div>
        </div>

        {/* Pending Advances */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">
              {isCurrentAdminMode ? "Pending Advance Requests" : "Advances for Disbursement"}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-foreground">
              {kpiLoading ? "…" : kpi?.pending_advances_count || 0}
            </span>
            <p className="mt-0.5 text-xs text-muted">
              {isCurrentAdminMode ? "Pending approval" : "Awaiting bank payout"}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
            <span className="text-muted">Disbursed: ₹{(kpi?.disbursed_advances_amount || 0).toLocaleString()}</span>
            <Link href="/dashboard/advances" className="font-bold text-primary hover:underline">
              Manage &rarr;
            </Link>
          </div>
        </div>

        {/* Outstanding Field Balance */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">Unspent Field Cash</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-foreground">
              ₹{kpiLoading ? "…" : (kpi?.outstanding_advances_balance || 0).toLocaleString()}
            </span>
            <p className="mt-0.5 text-xs text-muted">Held with field personnel</p>
          </div>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
            <span className="text-muted">{totalUsers} Active Staff</span>
            <Link href="/dashboard/ledgers" className="font-bold text-primary hover:underline">
              Passbooks &rarr;
            </Link>
          </div>
        </div>

        {/* Net Liquidity Position */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">Net Position</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              ₹{kpiLoading ? "…" : Math.abs(kpi?.net_financial_position || 0).toLocaleString()}
            </span>
            <span
              className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                (kpi?.net_financial_position || 0) > 0
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                  : (kpi?.net_financial_position || 0) < 0
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
                  : "bg-surface-muted text-muted"
              }`}
            >
              {(kpi?.net_financial_position || 0) > 0
                ? "Company Payable"
                : (kpi?.net_financial_position || 0) < 0
                ? "Advance Surplus"
                : "Balanced"}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
            <span className="text-muted">Settled: ₹{(kpi?.settled_claims_amount || 0).toLocaleString()}</span>
            <Link href="/dashboard/settlements" className="font-bold text-primary hover:underline">
              Settlements &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Primary Modules Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Module 1: Claims */}
        <Link
          href="/dashboard/claims"
          className="group rounded-2xl border border-border bg-card p-5 shadow-xs hover:border-emerald-500 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-105 transition">
              <Receipt className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted group-hover:text-emerald-600 transition" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">Expense Claims</h3>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            {isCurrentAdminMode
              ? "Review, verify attached receipts & meter readings, and approve or reject submitted expense claims."
              : "View all approved expense claims ready for payment processing and advance offset."}
          </p>
        </Link>

        {/* Module 2: Tour Advances */}
        <Link
          href="/dashboard/advances"
          className="group rounded-2xl border border-border bg-card p-5 shadow-xs hover:border-blue-500 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 group-hover:scale-105 transition">
              <Wallet className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted group-hover:text-blue-600 transition" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">Tour Advances</h3>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            {isCurrentAdminMode
              ? "Create advance requests on behalf of Work Planner users and sanction pending tour applications."
              : "Disburse approved tour advances with UTR and bank details, and log unused cash refunds."}
          </p>
        </Link>

        {/* Module 3: Account Ledgers & Passbook */}
        <Link
          href="/dashboard/ledgers"
          className="group rounded-2xl border border-border bg-card p-5 shadow-xs hover:border-purple-500 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 group-hover:scale-105 transition">
              <Scale className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted group-hover:text-purple-600 transition" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">User Ledgers &amp; Passbook</h3>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Comprehensive account passbooks for all Work Planner users. Track running debits, credits, and export statements.
          </p>
        </Link>

        {/* Module 4: Settlements & Payments */}
        <Link
          href="/dashboard/settlements"
          className="group rounded-2xl border border-border bg-card p-5 shadow-xs hover:border-teal-500 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 group-hover:scale-105 transition">
              <CreditCard className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted group-hover:text-teal-600 transition" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">Settlements &amp; Vouchers</h3>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Execute claim settlements (advance deductions, direct reimbursements, split payouts) and generate vouchers.
          </p>
        </Link>
      </div>

      {/* Work Planner Users Directory Preview */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Work Planner Portal Access Users</h2>
            <p className="text-xs text-muted">
              Live financial snapshot of all field staff who submit daily expenses through the Work Planner portal.
            </p>
          </div>
          <Link
            href="/dashboard/users"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            <span>View Full Directory</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted uppercase font-bold tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Field Executive</th>
                <th className="py-2.5 px-3">Role / Dept</th>
                <th className="py-2.5 px-3 text-right">Advances Disbursed</th>
                <th className="py-2.5 px-3 text-right">Claims Settled</th>
                <th className="py-2.5 px-3 text-right">Outstanding Balance</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {wpUsersData?.users && wpUsersData.users.length > 0 ? (
                wpUsersData.users.slice(0, 8).map((u) => (
                  <tr key={u._id} className="hover:bg-surface-muted/50 transition">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-foreground">{u.name}</div>
                      <div className="text-[11px] text-muted">{u.email}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-muted uppercase">
                        {u.wp_role || "Executive"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-foreground">
                      ₹{(u.metrics?.total_disbursed_amount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-foreground">
                      ₹{(u.metrics?.total_settled_amount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      <span
                        className={
                          (u.metrics?.active_advances_balance || 0) > 0
                            ? "text-purple-600 dark:text-purple-400"
                            : "text-muted"
                        }
                      >
                        ₹{(u.metrics?.active_advances_balance || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Link
                        href={`/dashboard/ledgers`}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-surface-muted transition"
                      >
                        <Scale className="h-3 w-3 text-primary" />
                        <span>Passbook</span>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted">
                    No Work Planner users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
