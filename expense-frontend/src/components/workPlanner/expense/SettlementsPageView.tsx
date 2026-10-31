"use client";

import React from "react";
import { CreditCard, Plus, Receipt, FileText, CheckCircle2 } from "lucide-react";
import { useExpensePageShell } from "./useExpensePageShell";
import { ExpenseSettlementsTab } from "./ExpenseSettlementsTab";
import { SettlementVoucherModal } from "./SettlementVoucherModal";
import { SettleExpenseModal } from "./SettleExpenseModal";

export function SettlementsPageView() {
  const shell = useExpensePageShell();
  const { isCurrentFinanceMode } = shell.roleCtx;

  return (
    <div className="space-y-4 font-sans w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-foreground">
              Payments &amp; Expense Settlements
            </h1>
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                isCurrentFinanceMode
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800"
              }`}
            >
              {isCurrentFinanceMode ? "Finance Execution Authority" : "Admin Settlement Audit"}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-muted mt-0.5">
            {isCurrentFinanceMode
              ? "Reconcile approved field claims with disbursed advances, execute net reimbursement payouts, and generate official financial settlement vouchers."
              : "Review completed claim-advance settlements, payment vouchers, bank transaction references, and settlement notes."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Finance Action: Create New Settlement */}
          {shell.perms.canSettleClaims && (
            <button
              type="button"
              onClick={() => {
                // If an executive is preselected in the filter, use that user; otherwise let user pick
                const exec = shell.executiveOptions.find((e) => e.id === shell.selectedExecutive);
                shell.setSettleUserTarget(exec ? { _id: exec.id, name: exec.name } : { _id: "", name: "" });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover active:scale-95 transition shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Process Settlement</span>
            </button>
          )}
        </div>
      </div>

      {/* Scope Switcher */}
      {shell.perms.isElevated && (
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => shell.setOwnershipScope("team")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              shell.ownershipScope === "team"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {shell.perms.isAdmin ? "All Staff Settlements" : "Team Settlements"}
          </button>
          <button
            type="button"
            onClick={() => shell.setOwnershipScope("mine")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              shell.ownershipScope === "mine"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            My Settlements
          </button>
        </div>
      )}

      {/* Settlements Tab Content */}
      <ExpenseSettlementsTab
        currentUser={shell.currentUser}
        ownershipScope={shell.ownershipScope}
        selectedExecutive={shell.selectedExecutive}
        setSelectedExecutive={shell.setSelectedExecutive}
        executiveOptions={shell.executiveOptions}
        dateFrom={shell.dateFrom}
        setDateFrom={shell.setDateFrom}
        dateTo={shell.dateTo}
        setDateTo={shell.setDateTo}
        onViewVoucher={(settlementId) => shell.setSelectedVoucherId(settlementId)}
      />

      {/* Settlement Voucher Modal */}
      {shell.selectedVoucherId && (
        <SettlementVoucherModal
          open={!!shell.selectedVoucherId}
          settlementId={shell.selectedVoucherId}
          onClose={() => shell.setSelectedVoucherId(null)}
        />
      )}

      {/* Settle Expense Modal */}
      {shell.settleUserTarget && (
        <SettleExpenseModal
          open={!!shell.settleUserTarget}
          salesUser={shell.settleUserTarget}
          sessionToken={shell.sessionToken}
          onClose={() => {
            shell.setSettleUserTarget(null);
            shell.refetchKpis();
          }}
        />
      )}
    </div>
  );
}

