"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  RefreshCw,
  Wallet,
  BookOpen,
  FileCheck,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Users,
  Zap,
} from "lucide-react";
import { useGetExecutiveBalancesQuery } from "@/store/api/workPlannerApiSlice";
import { formatCurrency } from "../workPlanUtils";
import { canSettleForUser } from "./expensePermissions";
import type { AuthUser, ExecutiveBalanceItem } from "@/types/workPlanner";

interface ExpenseBalancesTabProps {
  currentUser: AuthUser | null | undefined;
  ownershipScope: "mine" | "team";
  selectedExecutive: string;
  setSelectedExecutive: (id: string) => void;
  executiveOptions: Array<{ id: string; name: string }>;
  onOpenLedger: (userId: string, userName: string) => void;
  onOpenSettleModal: (user: { _id: string; name: string; email?: string }) => void;
  onIssueAdvance?: (user: { _id: string; name: string }) => void;
}

export function ExpenseBalancesTab({
  currentUser,
  ownershipScope,
  selectedExecutive,
  setSelectedExecutive,
  executiveOptions,
  onOpenLedger,
  onOpenSettleModal,
  onIssueAdvance,
}: ExpenseBalancesTabProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const queryParams = useMemo(() => {
    const p: Record<string, string | number | undefined> = {
      scope: ownershipScope,
      page: currentPage,
      limit: 50,
    };
    if (selectedExecutive && selectedExecutive !== "all") p.user_id = selectedExecutive;
    return p;
  }, [ownershipScope, currentPage, selectedExecutive]);

  const { data: balancesRes, isLoading, refetch } = useGetExecutiveBalancesQuery(queryParams);

  const balances = balancesRes?.data || [];
  const total = balancesRes?.total || 0;
  const pages = balancesRes?.pages || 1;

  const filteredBalances = useMemo(() => {
    if (!searchQuery.trim()) return balances;
    const q = searchQuery.toLowerCase();
    return balances.filter((b) => {
      const name = (b.sales_user?.name || "").toLowerCase();
      const email = (b.sales_user?.email || "").toLowerCase();
      const dept = (b.sales_user?.department || "").toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q);
    });
  }, [balances, searchQuery]);

  const hasActiveFilters = Boolean(
    (selectedExecutive && selectedExecutive !== "all") || searchQuery
  );

  function resetFilters() {
    setSelectedExecutive("all");
    setSearchQuery("");
    setCurrentPage(1);
  }

  return (
    <div className="space-y-3.5">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 bg-card p-3 rounded-2xl border border-border shadow-2xs">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search executive name, email, department..."
            className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>

        {ownershipScope === "team" && executiveOptions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted shrink-0" />
            <select
              value={selectedExecutive}
              onChange={(e) => {
                setSelectedExecutive(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            >
              <option value="all">All Team Members</option>
              {executiveOptions.map((exec) => (
                <option key={exec.id} value={exec.id}>
                  {exec.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition cursor-pointer whitespace-nowrap"
          >
            Clear Filters
          </button>
        )}

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isLoading}
          className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          title="Refresh table"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Balances Table Container */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-border">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted">Loading executive balances…</div>
          ) : filteredBalances.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">No balances found.</div>
          ) : (
            filteredBalances.map((b) => {
              const uId = b.sales_user?._id || "";
              const uName = b.sales_user?.name || "Executive";
              const canSettle = canSettleForUser(currentUser, uId) && b.unsettled_approved_claims_amount > 0;

              return (
                <div key={uId} className="p-4 space-y-2.5 hover:bg-surface-muted/30 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-foreground">{uName}</span>
                      <div className="text-[11px] text-muted">{b.sales_user?.email}</div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs font-extrabold ${
                          b.position_status === "due_to_employee"
                            ? "text-rose-600 dark:text-rose-400"
                            : b.position_status === "due_to_company"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground"
                        }`}
                      >
                        {formatCurrency(Math.abs(b.net_position))}
                      </span>
                      <span className="block text-[10px] text-muted">
                        {b.position_status === "due_to_employee"
                          ? "Due to Employee"
                          : b.position_status === "due_to_company"
                          ? "Due to Company"
                          : "Balanced"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-muted/50 p-2 text-xs">
                    <div>
                      <span className="text-[10px] text-muted uppercase font-semibold">Advance in Hand</span>
                      <p className="font-bold text-purple-600 dark:text-purple-400">
                        {formatCurrency(b.active_advance_balance)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted uppercase font-semibold">Unsettled Claims</span>
                      <p className="font-bold text-sky-600 dark:text-sky-400">
                        {formatCurrency(b.unsettled_approved_claims_amount)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => onOpenLedger(uId, uName)}
                      className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition cursor-pointer"
                    >
                      <BookOpen className="h-3 w-3" />
                      <span>Passbook</span>
                    </button>
                    {canSettle && (
                      <button
                        type="button"
                        onClick={() => onOpenSettleModal(b.sales_user)}
                        className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-700 transition cursor-pointer"
                      >
                        <FileCheck className="h-3 w-3" />
                        <span>Settle Claims</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-muted">
            <thead className="border-b border-border bg-surface-muted/50 text-[11px] font-semibold uppercase text-foreground">
              <tr>
                <th className="px-4 py-3">Executive</th>
                <th className="px-4 py-3">Active Advances (In Hand)</th>
                <th className="px-4 py-3">Unsettled Approved Claims</th>
                <th className="px-4 py-3">Settled Claims Total</th>
                <th className="px-4 py-3">Net Position</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted">
                    Loading executive balances…
                  </td>
                </tr>
              ) : filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted">
                    No balances found.
                  </td>
                </tr>
              ) : (
                filteredBalances.map((b) => {
                  const uId = b.sales_user?._id || "";
                  const uName = b.sales_user?.name || "Executive";
                  const canSettle = canSettleForUser(currentUser, uId) && b.unsettled_approved_claims_amount > 0;

                  return (
                    <tr key={uId} className="hover:bg-surface-muted/30 transition">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-semibold text-foreground block">{uName}</span>
                        <span className="text-[11px] text-muted">{b.sales_user?.email}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                          {formatCurrency(b.active_advance_balance)}
                        </span>
                        <span className="text-[10px] text-muted block">
                          ({b.active_advance_count} active)
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-sky-600 dark:text-sky-400">
                          {formatCurrency(b.unsettled_approved_claims_amount)}
                        </span>
                        <span className="text-[10px] text-muted block">
                          ({b.unsettled_approved_claims_count} approved)
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                        {formatCurrency(b.total_settled_claims_amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            b.position_status === "due_to_employee"
                              ? "text-rose-600 dark:text-rose-400"
                              : b.position_status === "due_to_company"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-foreground"
                          }`}
                        >
                          {formatCurrency(Math.abs(b.net_position))}
                        </span>
                        <span className="text-[10px] block text-muted">
                          {b.position_status === "due_to_employee"
                            ? "Due to Employee (Payout)"
                            : b.position_status === "due_to_company"
                            ? "Due to Company (Refund)"
                            : "Balanced"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {onIssueAdvance && (
                            <button
                              type="button"
                              onClick={() => onIssueAdvance({ _id: uId, name: uName })}
                              className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
                              title="Direct Issue Advance"
                            >
                              <Zap className="h-3 w-3" />
                              <span>Advance</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenLedger(uId, uName)}
                            className="inline-flex items-center gap-1 rounded border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition cursor-pointer"
                            title="View Full Passbook & Financial Timeline"
                          >
                            <BookOpen className="h-3 w-3" />
                            <span>Passbook</span>
                          </button>
                          {canSettle && (
                            <button
                              type="button"
                              onClick={() => onOpenSettleModal(b.sales_user)}
                              className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 transition cursor-pointer"
                              title="Settle Approved Claims"
                            >
                              <FileCheck className="h-3 w-3" />
                              <span>Settle</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
            <div className="text-muted">
              Showing page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
              <span className="font-semibold text-foreground">{pages}</span> ({total} items)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 transition"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= pages || isLoading}
                onClick={() => setCurrentPage((p) => Math.min(pages, p + 1))}
                className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
