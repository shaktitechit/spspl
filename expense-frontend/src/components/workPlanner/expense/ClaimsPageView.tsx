"use client";

import React from "react";
import { Receipt, FileSpreadsheet, ShieldAlert, CheckCircle, Clock } from "lucide-react";
import { useExpensePageShell } from "./useExpensePageShell";
import { ExpenseClaimsTab } from "./ExpenseClaimsTab";
import { ApproveExpenseModal } from "./ApproveExpenseModal";
import { RejectExpenseModal } from "../RejectExpenseModal";
import { SettleExpenseModal } from "./SettleExpenseModal";
import { FilePreviewModal } from "../FilePreviewModal";
import { DownloadExpensesModal } from "../DownloadExpensesModal";

export function ClaimsPageView() {
  const shell = useExpensePageShell();
  const { isCurrentAdminMode, isCurrentFinanceMode } = shell.roleCtx;

  return (
    <div className="space-y-4 font-sans w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-foreground">
              {isCurrentAdminMode ? "Expense Claims Approval" : "Approved Claims & Audit"}
            </h1>
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                isCurrentAdminMode
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800"
              }`}
            >
              {isCurrentAdminMode ? "Admin Governance" : "Finance Settlement Queue"}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-muted mt-0.5">
            {isCurrentAdminMode
              ? "Inspect field staff daily visit receipts, review fuel and food allowances, approve verified claims, or reject with feedback."
              : "Review claims audited by managers/admin. Process direct reimbursement payouts or advance offset settlements."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shell.setDownloadOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Export Claims</span>
          </button>
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
            {shell.perms.isAdmin ? "All Staff Claims" : "Team Claims"}
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
            My Own Claims
          </button>
        </div>
      )}

      {/* Claims Tab Content */}
      <ExpenseClaimsTab
        currentUser={shell.currentUser}
        ownershipScope={shell.ownershipScope}
        selectedExecutive={shell.selectedExecutive}
        setSelectedExecutive={shell.setSelectedExecutive}
        executiveOptions={shell.executiveOptions}
        dateFrom={shell.dateFrom}
        setDateFrom={shell.setDateFrom}
        dateTo={shell.dateTo}
        setDateTo={shell.setDateTo}
        onOpenPreview={shell.openPreview}
        onOpenApproveModal={shell.setApproveExpenseTarget}
        onOpenRejectModal={shell.setRejectExpenseTarget}
        onOpenSettleModal={(user) => shell.setSettleUserTarget(user)}
        sessionToken={shell.sessionToken}
      />

      {/* Modals */}
      {shell.approveExpenseTarget && (
        <ApproveExpenseModal
          open={!!shell.approveExpenseTarget}
          expense={shell.approveExpenseTarget}
          isLoading={shell.isApprovingExpense}
          onConfirm={shell.handleApproveExpenseConfirm}
          onClose={() => shell.setApproveExpenseTarget(null)}
        />
      )}

      {shell.rejectExpenseTarget && (
        <RejectExpenseModal
          open={!!shell.rejectExpenseTarget}
          isRejecting={shell.isRejectingExpense}
          onConfirm={shell.handleRejectExpenseConfirm}
          onClose={() => shell.setRejectExpenseTarget(null)}
        />
      )}

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

      {shell.downloadOpen && (
        <DownloadExpensesModal
          open={shell.downloadOpen}
          onClose={() => shell.setDownloadOpen(false)}
        />
      )}

      {shell.previewDoc && (
        <FilePreviewModal
          doc={shell.previewDoc}
          blobUrl={shell.previewBlobUrl}
          loading={shell.previewLoading}
          onClose={shell.closePreview}
          onDownload={shell.downloadFile}
        />
      )}
    </div>
  );
}
