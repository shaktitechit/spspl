"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Scale, BookOpen, FileSpreadsheet, ArrowDownRight, ArrowUpRight, DollarSign, RotateCcw } from "lucide-react";
import { useExpensePageShell } from "@/components/expensePortal/shared/useExpensePageShell";
import { ExpenseBalancesTab } from "@/components/expensePortal/admin/governance/ExpenseBalancesTab";
import { ExecutiveLedgerDrawer } from "@/components/expensePortal/admin/governance/ExecutiveLedgerDrawer";
import { SettleExpenseModal } from "@/components/expensePortal/finance/settlements/SettleExpenseModal";
import { AdvanceRefundModal } from "@/components/expensePortal/finance/disbursements/AdvanceRefundModal";

export function LedgersPageView() {
  const shell = useExpensePageShell();
  const { isCurrentAdminMode, isCurrentFinanceMode } = shell.roleCtx;

  const [refundModalOpen, setRefundModalOpen] = useState<boolean>(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState<{ _id: string; name: string; email?: string } | null>(null);

  return (
    <div className="space-y-4 font-sans w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-foreground">
              Staff Running Balances &amp; Passbooks
            </h1>
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                isCurrentFinanceMode
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800"
              }`}
            >
              {isCurrentFinanceMode ? "Finance Treasury &amp; Ledgers" : "Admin Financial Governance"}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-muted mt-0.5">
            {isCurrentFinanceMode
              ? "Comprehensive running debit & credit ledgers for all Work Planner field staff. Click any employee to view their detailed passbook, execute settlements, disburse advances, or log payment entries & refunds."
              : "Monitor running advance balances and credit positions of field staff. Click any employee to inspect their passbook dossier, claim history, and sanction tour advances."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Finance Action: Record Refund */}
          {isCurrentFinanceMode && shell.perms.canSettleClaims && (
            <button
              type="button"
              onClick={() => {
                const exec = shell.executiveOptions.find((e) => e.id === shell.selectedExecutive);
                setSelectedUserForModal(exec ? { _id: exec.id, name: exec.name } : null);
                setRefundModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3.5 py-2 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 active:scale-95 transition cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>+ Record Refund</span>
            </button>
          )}

          {/* Quick open self passbook */}
          {shell.currentUser?._id && (
            <Link
              href={`/dashboard/ledgers/${shell.currentUser._id}/passbook-ledger`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition cursor-pointer"
            >
              <BookOpen className="h-4 w-4" />
              <span>My Passbook</span>
            </Link>
          )}
        </div>
      </div>

      {/* Balances Tab Content */}
      <ExpenseBalancesTab
        currentUser={shell.currentUser}
        ownershipScope={shell.ownershipScope}
        selectedExecutive={shell.selectedExecutive}
        setSelectedExecutive={shell.setSelectedExecutive}
        executiveOptions={shell.executiveOptions}
        onOpenLedger={(userId, userName) => shell.setLedgerTarget({ userId, userName })}
        onOpenSettleModal={(user) => shell.setSettleUserTarget(user)}
        onOpenRefundModal={isCurrentFinanceMode ? (user) => {
          setSelectedUserForModal(user);
          setRefundModalOpen(true);
        } : undefined}
      />

      {/* Ledger Drawer */}
      {shell.ledgerTarget && (
        <ExecutiveLedgerDrawer
          open={!!shell.ledgerTarget}
          userId={shell.ledgerTarget.userId}
          userName={shell.ledgerTarget.userName}
          executiveOptions={shell.executiveOptions}
          sessionToken={shell.sessionToken}
          isFinanceMode={isCurrentFinanceMode}
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

      {/* Record Advance Refund Modal */}
      {refundModalOpen && (
        <AdvanceRefundModal
          open={refundModalOpen}
          user={selectedUserForModal}
          userOptions={shell.executiveOptions}
          sessionToken={shell.sessionToken}
          onClose={() => {
            setRefundModalOpen(false);
            setSelectedUserForModal(null);
            shell.refetchKpis();
          }}
          onSuccess={() => {
            setRefundModalOpen(false);
            setSelectedUserForModal(null);
            shell.refetchKpis();
          }}
        />
      )}
    </div>
  );
}
