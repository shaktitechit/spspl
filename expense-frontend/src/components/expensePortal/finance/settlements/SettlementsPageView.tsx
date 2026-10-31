"use client";

import React, { useState } from "react";
import { CreditCard, Plus, Receipt, FileText, CheckCircle2, Banknote, RotateCcw } from "lucide-react";
import { useExpensePageShell } from "@/components/expensePortal/shared/useExpensePageShell";
import { ExpenseSettlementsTab } from "./ExpenseSettlementsTab";
import { SettlementVoucherModal } from "@/components/expensePortal/finance/settlements/SettlementVoucherModal";
import { SettleExpenseModal } from "@/components/expensePortal/finance/settlements/SettleExpenseModal";
import { PaymentEntryModal } from "@/components/expensePortal/finance/settlements/PaymentEntryModal";
import { AdvanceRefundModal } from "@/components/expensePortal/finance/disbursements/AdvanceRefundModal";

export function SettlementsPageView() {
  const shell = useExpensePageShell();
  const { isCurrentFinanceMode } = shell.roleCtx;

  const [settleModalOpen, setSettleModalOpen] = useState<boolean>(false);
  const [paymentEntryModalOpen, setPaymentEntryModalOpen] = useState<boolean>(false);
  const [refundModalOpen, setRefundModalOpen] = useState<boolean>(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState<{ _id: string; name: string; email?: string } | null>(null);

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
              ? "Global treasury ledger of all payments, claims settlements, and direct payout vouchers across the entire enterprise."
              : "Review completed claim-advance settlements, payment vouchers, bank transaction references, and settlement notes."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Finance Action 1: Record Direct Payment Entry */}
          {shell.perms.canSettleClaims && (
            <button
              type="button"
              onClick={() => {
                const exec = shell.executiveOptions.find((e) => e.id === shell.selectedExecutive);
                setSelectedUserForModal(exec ? { _id: exec.id, name: exec.name } : null);
                setPaymentEntryModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 active:scale-95 transition cursor-pointer"
            >
              <Banknote className="h-4 w-4" />
              <span>+ Record Payment Entry</span>
            </button>
          )}

          {/* Finance Action 2: Record Refund */}
          {shell.perms.canSettleClaims && (
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

          {/* Finance Action 3: Process Settlement */}
          {shell.perms.canSettleClaims && (
            <button
              type="button"
              onClick={() => {
                const exec = shell.executiveOptions.find((e) => e.id === shell.selectedExecutive);
                setSelectedUserForModal(exec ? { _id: exec.id, name: exec.name } : null);
                setSettleModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover active:scale-95 transition shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Process Settlement</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Settlements Tab Content - No Team / My scope restriction */}
      <ExpenseSettlementsTab
        currentUser={shell.currentUser}
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

      {/* Settle Expense Modal with user selection */}
      {settleModalOpen && (
        <SettleExpenseModal
          open={settleModalOpen}
          salesUser={selectedUserForModal}
          userOptions={shell.executiveOptions}
          sessionToken={shell.sessionToken}
          onClose={() => {
            setSettleModalOpen(false);
            setSelectedUserForModal(null);
            shell.refetchKpis();
          }}
          onSuccess={() => {
            setSettleModalOpen(false);
            setSelectedUserForModal(null);
            shell.refetchKpis();
          }}
        />
      )}

      {/* Direct Payment Entry Modal with user selection */}
      {paymentEntryModalOpen && (
        <PaymentEntryModal
          open={paymentEntryModalOpen}
          user={selectedUserForModal}
          userOptions={shell.executiveOptions}
          onClose={() => {
            setPaymentEntryModalOpen(false);
            setSelectedUserForModal(null);
            shell.refetchKpis();
          }}
          onSuccess={() => {
            setPaymentEntryModalOpen(false);
            setSelectedUserForModal(null);
            shell.refetchKpis();
          }}
        />
      )}

      {/* Record Advance Refund Modal with user selection */}
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
