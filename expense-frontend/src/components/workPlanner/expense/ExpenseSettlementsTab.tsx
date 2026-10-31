"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  RefreshCw,
  FileCheck,
  Eye,
  Building2,
  Receipt,
  Wallet,
  Users,
} from "lucide-react";
import { useGetExpenseSettlementsQuery } from "@/store/api/workPlannerApiSlice";
import { formatCurrency, formatPlanDate, salesUserLabel } from "../workPlanUtils";
import type { AuthUser, WorkPlanExpenseSettlementRecord } from "@/types/workPlanner";

interface ExpenseSettlementsTabProps {
  currentUser: AuthUser | null | undefined;
  ownershipScope: "mine" | "team";
  selectedExecutive: string;
  setSelectedExecutive: (id: string) => void;
  executiveOptions: Array<{ id: string; name: string }>;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
  onViewVoucher: (settlementId: string) => void;
}

export function ExpenseSettlementsTab({
  currentUser,
  ownershipScope,
  selectedExecutive,
  setSelectedExecutive,
  executiveOptions,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onViewVoucher,
}: ExpenseSettlementsTabProps) {
  const [searchQuery, setSearchQuery] = useState<string>("" );
  const [currentPage, setCurrentPage] = useState<number>(1);

  const queryParams = useMemo(() => {
    const p: Record<string, string | number | undefined> = {
      scope: ownershipScope,
      page: currentPage,
      limit: 50,
    };
    if (selectedExecutive && selectedExecutive !== "all") p.user_id = selectedExecutive;
    if (dateFrom) p.from_date = dateFrom;
    if (dateTo) p.to_date = dateTo;
    return p;
  }, [ownershipScope, currentPage, selectedExecutive, dateFrom, dateTo]);

  const { data: settlementsRes, isLoading, refetch } = useGetExpenseSettlementsQuery(queryParams);

  const settlements = settlementsRes?.data || [];
  const total = settlementsRes?.total || 0;
  const pages = settlementsRes?.pages || 1;

  const filteredSettlements = useMemo(() => {
    if (!searchQuery.trim()) return settlements;
    const q = searchQuery.toLowerCase();
    return settlements.filter((s) => {
      const num = (s.settlement_number || "").toLowerCase();
      const notes = (s.settlement_notes || "").toLowerCase();
      const userLabel = salesUserLabel(s.sales_user, executiveOptions).toLowerCase();
      return num.includes(q) || notes.includes(q) || userLabel.includes(q);
    });
  }, [settlements, searchQuery, executiveOptions]);

  const hasActiveFilters = Boolean(
    (selectedExecutive && selectedExecutive !== "all") ||
      dateFrom ||
      dateTo ||
      searchQuery
  );

  function resetFilters() {
    setSelectedExecutive("all");
    setDateFrom("");
    setDateTo("");
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
            placeholder="Search settlement voucher #, executive, notes..."
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

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
          <span className="text-xs text-muted">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>

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

      {/* Settlements Table Container */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-border">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted">Loading settlement vouchers…</div>
          ) : filteredSettlements.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">No settlement vouchers found.</div>
          ) : (
            filteredSettlements.map((s) => {
              const sId = s._id || s.id || "";
              const sUserName = salesUserLabel(s.sales_user, executiveOptions);
              const settledByName =
                typeof s.settled_by === "object" && s.settled_by
                  ? s.settled_by.name
                  : "Authority";

              return (
                <div key={sId} className="p-4 space-y-2 hover:bg-surface-muted/30 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {s.settlement_number}
                      </span>
                      <div className="text-[11px] text-muted mt-0.5">
                        {formatPlanDate(s.settlement_date)} • {sUserName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-extrabold text-foreground">
                        {formatCurrency(s.total_claim_amount)}
                      </div>
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 capitalize inline-block mt-1">
                        {s.settlement_mode?.replace("_", " ") || "Settled"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px] text-muted">
                    <span>By {settledByName}</span>
                    <button
                      type="button"
                      onClick={() => onViewVoucher(sId)}
                      className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Voucher</span>
                    </button>
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
                <th className="px-4 py-3">Voucher #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Executive</th>
                <th className="px-4 py-3">Mode & Breakdown</th>
                <th className="px-4 py-3">Total Settled</th>
                <th className="px-4 py-3">Settled By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-muted">
                    Loading settlement vouchers…
                  </td>
                </tr>
              ) : filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-muted">
                    No settlement vouchers found.
                  </td>
                </tr>
              ) : (
                filteredSettlements.map((s) => {
                  const sId = s._id || s.id || "";
                  const sUserName = salesUserLabel(s.sales_user, executiveOptions);
                  const settledByName =
                    typeof s.settled_by === "object" && s.settled_by
                      ? s.settled_by.name
                      : "Authority";

                  return (
                    <tr key={sId} className="hover:bg-surface-muted/30 transition">
                      <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">
                        {s.settlement_number}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                        {formatPlanDate(s.settlement_date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-foreground">
                        {sUserName}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-foreground capitalize">
                          {s.settlement_mode?.replace("_", " ") || "Settled"}
                        </span>
                        <div className="text-[10px] text-muted space-x-2 mt-0.5">
                          {s.advance_deduction_amount > 0 && (
                            <span>Adv: {formatCurrency(s.advance_deduction_amount)}</span>
                          )}
                          {s.direct_payment_amount > 0 && (
                            <span>Direct: {formatCurrency(s.direct_payment_amount)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">
                        {formatCurrency(s.total_claim_amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-foreground">
                        {settledByName}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onViewVoucher(sId)}
                          className="inline-flex items-center gap-1 rounded border border-border bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted/80 hover:border-primary/40 transition cursor-pointer"
                        >
                          <Eye className="h-3 w-3 text-primary" />
                          <span>View Voucher</span>
                        </button>
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
