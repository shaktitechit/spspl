"use client";

import React from "react";
import { Scale, BookOpen, FileSpreadsheet, ArrowDownRight, ArrowUpRight, DollarSign } from "lucide-react";
import { useExpensePageShell } from "./useExpensePageShell";
import { ExpenseBalancesTab } from "./ExpenseBalancesTab";
import { ExecutiveLedgerDrawer } from "./ExecutiveLedgerDrawer";
import { SettleExpenseModal } from "./SettleExpenseModal";
import { AdvanceFormModal } from "./AdvanceFormModal";

export function LedgersPageView() {
  const shell = useExpensePageShell();
  const { isCurrentAdminMode, isCurrentFinanceMode } = shell.roleCtx;

  return (
    <div className="space-y-4 font-sans w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-foreground">
              User Account Ledgers &amp; Passbooks
            </h1>
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                isCurrentFinanceMode
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800"
              }`}
            >
              {isCurrentFinanceMode ? "Finance Passbook Custodian" : "Admin Financial Monitor"}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-muted mt-0.5">
            {isCurrentFinanceMode
              ? "Comprehensive running debit & credit ledgers for all Work Planner field staff. Reconcile advances, verify claim deductions, and export account statements."
              : "Monitor running advance balances and credit status of field staff to prevent over-sanctioning before approving new tour advances."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick open self passbook */}
          {shell.currentUser?._id && (
            <button
              type="button"
              onClick={() => {
                shell.setLedgerTarget({
                  userId: shell.currentUser!._id,
                  userName: shell.currentUser!.name || "My Passbook",
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3.5 py-2 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 active:scale-95 transition cursor-pointer"
            >
              <BookOpen className="h-4 w-4" />
              <span>My Passbook</span>
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
            {shell.perms.isAdmin ? "All Staff Ledgers" : "Team Ledgers"}
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
            My Own Ledger
          </button>
        </div>
      )}

      {/* Balances Tab Content */}
      <ExpenseBalancesTab
        currentUser={shell.currentUser}
        ownershipScope={shell.ownershipScope}
        selectedExecutive={shell.selectedExecutive}
        setSelectedExecutive={shell.setSelectedExecutive}
        executiveOptions={shell.executiveOptions}
        onOpenLedger={(userId, userName) => shell.setLedgerTarget({ userId, userName })}
        onOpenSettleModal={(user) => shell.setSettleUserTarget(user)}
        onIssueAdvance={(user) => {
          shell.setAdvanceFormMode("request");
          shell.setAdvancePreselectedUserId(user._id);
          shell.setAdvanceFormOpen(true);
        }}
      />

      {/* Ledger Drawer */}
      {shell.ledgerTarget && (
        <ExecutiveLedgerDrawer
          open={!!shell.ledgerTarget}
          userId={shell.ledgerTarget.userId}
          userName={shell.ledgerTarget.userName}
          executiveOptions={shell.executiveOptions}
          sessionToken={shell.sessionToken}
          onClose={() => shell.setLedgerTarget(null)}
        />
      )}

      {/* Settle Modal */}
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

      {/* Advance Form Modal */}
      {shell.advanceFormOpen && (
        <AdvanceFormModal
          open={shell.advanceFormOpen}
          initialMode={shell.advanceFormMode}
          preselectedUserId={shell.advancePreselectedUserId}
          executiveOptions={shell.executiveOptions}
          isAdmin={shell.perms.isAdmin}
          isElevated={shell.perms.isElevated}
          sessionToken={shell.sessionToken}
          currentUserId={shell.currentUser?._id}
          currentUserName={shell.currentUser?.name}
          onClose={() => {
            shell.setAdvanceFormOpen(false);
            shell.refetchKpis();
          }}
        />
      )}
    </div>
  );
}

