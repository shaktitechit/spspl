/**
 * @fileoverview Work Planner Users Directory Page in Expense Portal.
 * Lists all users with work_planner access and their expense metrics.
 * @module app/dashboard/users/page
 */
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Receipt,
  Wallet,
  Scale,
  CreditCard,
  Plus,
  ArrowRight,
  Filter,
} from "lucide-react";
import { useGetWorkPlannerUsersQuery } from "@/store/api/expenseApiSlice";
import { isExpenseAdmin, isExpenseFinance, readSessionFromStorage } from "@/utils/authStorage";
import { ExecutiveLedgerDrawer } from "@/components/workPlanner/expense/ExecutiveLedgerDrawer";

export default function WorkPlannerUsersPage() {
  const session = readSessionFromStorage();
  const user = session?.user;

  const isAdmin = useMemo(() => isExpenseAdmin(user), [user]);
  const isFinance = useMemo(() => isExpenseFinance(user), [user]);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeLedgerUserId, setActiveLedgerUserId] = useState<string | null>(null);

  const { data: usersData, isLoading } = useGetWorkPlannerUsersQuery({ search });

  const filteredUsers = useMemo(() => {
    let list = usersData?.users || [];
    if (roleFilter !== "all") {
      list = list.filter((u) => (u.wp_role || "executive").toLowerCase() === roleFilter.toLowerCase());
    }
    return list;
  }, [usersData, roleFilter]);

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Work Planner Users</h1>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {filteredUsers.length} Users
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            All field staff with Work Planner portal access whose daily expenses, advances, and accounts are managed here.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/dashboard/advances"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              Issue Advance
            </Link>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search by name, email, department, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none transition"
          >
            <option value="all">All Work Planner Roles</option>
            <option value="executive">Executive</option>
            <option value="coordinator">Coordinator</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-muted/40 text-muted font-bold">
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">WP Role</th>
                <th className="py-3 px-4 text-right">Pending Claims</th>
                <th className="py-3 px-4 text-right">Active Advance Bal</th>
                <th className="py-3 px-4 text-right">Approved Liability</th>
                <th className="py-3 px-4 text-right">Net Position</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    Loading Work Planner users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    No Work Planner portal users found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const net = u.metrics?.net_balance || 0;
                  return (
                    <tr key={u._id} className="hover:bg-surface-muted/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-foreground">{u.name}</div>
                        <div className="text-[11px] text-muted">{u.email}</div>
                        {u.phone && <div className="text-[10px] text-muted">{u.phone}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-foreground uppercase border border-border">
                          {u.wp_role || "executive"}
                        </span>
                        {u.department && (
                          <div className="text-[10px] text-muted mt-0.5 capitalize">
                            {u.department}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {u.metrics?.pending_approval_count > 0 ? (
                          <div>
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              ₹{u.metrics.pending_approval_amount.toLocaleString("en-IN")}
                            </span>
                            <div className="text-[10px] text-muted">
                              {u.metrics.pending_approval_count} submitted
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted font-medium">₹0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-foreground">
                          ₹{Number(u.metrics?.active_advances_balance || 0).toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-muted">
                          {u.metrics?.active_advances_count || 0} active
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-emerald-600">
                          ₹{Number(u.metrics?.approved_unsettled_amount || 0).toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-muted">
                          {u.metrics?.approved_unsettled_count || 0} approved
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black">
                        <span
                          className={
                            net > 0 ? "text-rose-600" : net < 0 ? "text-emerald-600" : "text-muted"
                          }
                        >
                          ₹{Math.abs(net).toLocaleString("en-IN")}
                        </span>
                        <div className="text-[10px] font-medium text-muted">
                          {net > 0 ? "Payable to user" : net < 0 ? "Receivable from user" : "Settled"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && (
                            <Link
                              href={`/dashboard/claims?user=${u._id}`}
                              className="rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary/20 transition"
                              title="Review claims"
                            >
                              Claims
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => setActiveLedgerUserId(u._id)}
                            className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted hover:text-foreground hover:bg-surface-muted transition"
                            title="Open passbook drawer"
                          >
                            Passbook
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger Drawer */}
      {activeLedgerUserId && (
        <ExecutiveLedgerDrawer
          userId={activeLedgerUserId}
          open={true}
          onClose={() => setActiveLedgerUserId(null)}
        />
      )}
    </div>
  );
}
