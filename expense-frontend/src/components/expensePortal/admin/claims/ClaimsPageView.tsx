"use client";

import React, { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { useExpensePageShell } from "@/components/expensePortal/shared/useExpensePageShell";
import { ExpenseClaimsTab } from "./ExpenseClaimsTab";
import { ApproveExpenseModal } from "@/components/expensePortal/admin/claims/ApproveExpenseModal";
import { RejectExpenseModal } from "@/components/expensePortal/admin/claims/RejectExpenseModal";
import { SeniorRemarksModal } from "@/components/expensePortal/admin/claims/SeniorRemarksModal";
import { ClaimDirectiveThreadModal } from "@/components/expensePortal/admin/claims/ClaimDirectiveThreadModal";
import { SettleExpenseModal } from "@/components/expensePortal/finance/settlements/SettleExpenseModal";
import { FilePreviewModal } from "@/components/expensePortal/shared/FilePreviewModal";
import { DownloadExpensesModal } from "@/components/expensePortal/finance/reports/DownloadExpensesModal";

export function ClaimsPageView() {
  const shell = useExpensePageShell({ defaultCurrentMonth: true });
  const { isCurrentAdminMode } = shell.roleCtx;

  const [seniorRemarksTarget, setSeniorRemarksTarget] = useState<{
    planId: string;
    expenseId: string;
    title: string;
    currentStatus: string;
    assigneeName: string;
    remarks: string;
    history: any[];
  } | null>(null);

  const [selectedThreadItem, setSelectedThreadItem] = useState<any | null>(null);

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
              ? "Inspect field staff daily visit receipts, review fuel and food allowances, approve verified claims, add audit directives, or reject with feedback."
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
        onOpenSeniorRemarks={!shell.roleCtx.isCurrentFinanceMode ? (target) => setSeniorRemarksTarget(target) : undefined}
        onOpenThread={!shell.roleCtx.isCurrentFinanceMode ? (item) => setSelectedThreadItem(item) : undefined}
        onOpenApproveModal={shell.setApproveExpenseTarget}
        onOpenRejectModal={shell.setRejectExpenseTarget}
        onOpenSettleModal={(user) => shell.setSettleUserTarget(user)}
        sessionToken={shell.sessionToken}
        isFinanceMode={shell.roleCtx.isCurrentFinanceMode}
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

      {/* Senior Authority Remarks / Directive Modal (Admin only, not in finance queue) */}
      {!shell.roleCtx.isCurrentFinanceMode && seniorRemarksTarget && (
        <SeniorRemarksModal
          open={Boolean(seniorRemarksTarget)}
          title={seniorRemarksTarget.title}
          planId={seniorRemarksTarget.planId}
          itemId={seniorRemarksTarget.expenseId}
          currentStatus={seniorRemarksTarget.currentStatus}
          assigneeName={seniorRemarksTarget.assigneeName}
          initialRemarks={seniorRemarksTarget.remarks}
          authorityRemarksHistory={seniorRemarksTarget.history}
          onClose={() => setSeniorRemarksTarget(null)}
          onSuccess={() => {
            shell.refetchKpis();
          }}
        />
      )}

      {/* Senior Directive & Follow-up Thread Modal (Admin only, not in finance queue) */}
      {!shell.roleCtx.isCurrentFinanceMode && selectedThreadItem && (
        <ClaimDirectiveThreadModal
          open={Boolean(selectedThreadItem)}
          item={selectedThreadItem}
          onClose={() => setSelectedThreadItem(null)}
          onSuccess={() => {
            shell.refetchKpis();
          }}
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
