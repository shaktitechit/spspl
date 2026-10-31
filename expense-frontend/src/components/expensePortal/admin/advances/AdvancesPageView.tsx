"use client";

import React from "react";
import { Wallet, Plus, CreditCard, Building2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useExpensePageShell } from "@/components/expensePortal/shared/useExpensePageShell";
import { ExpenseAdvancesTab } from "./ExpenseAdvancesTab";
import { AdvanceFormModal } from "@/components/expensePortal/admin/advances/AdvanceFormModal";
import { ApproveAdvanceModal } from "@/components/expensePortal/admin/advances/ApproveAdvanceModal";
import { RejectAdvanceModal } from "@/components/expensePortal/admin/advances/RejectAdvanceModal";
import { AdvanceDisburseModal } from "@/components/expensePortal/finance/disbursements/AdvanceDisburseModal";
import { AdvanceRefundModal } from "@/components/expensePortal/finance/disbursements/AdvanceRefundModal";
import { FilePreviewModal } from "@/components/expensePortal/shared/FilePreviewModal";

export function AdvancesPageView() {
  const shell = useExpensePageShell();
  const { isCurrentAdminMode, isCurrentFinanceMode } = shell.roleCtx;

  return (
    <div className="space-y-4 font-sans w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-foreground">
              {isCurrentAdminMode ? "Tour Advances & Sanctions" : "Advance Disbursements & Treasury"}
            </h1>
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                isCurrentAdminMode
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800"
              }`}
            >
              {isCurrentAdminMode ? "Admin Sanction Desk" : "Finance Treasury Desk"}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-muted mt-0.5">
            {isCurrentAdminMode
              ? "Create travel advance requests on behalf of field staff, review tour itineraries, and sanction requested tour advances."
              : "Disburse approved tour advances via bank transfer / UPI, enter payment UTRs, and log return refunds of unspent advance balances."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Admin Direct Sanction Tour Advance */}
          {shell.perms.isAdmin && (
            <button
              type="button"
              onClick={() => {
                shell.setAdvanceFormMode("direct_issue");
                shell.setAdvancePreselectedUserId("");
                shell.setAdvanceFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover active:scale-95 transition shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Sanction Tour Advance</span>
            </button>
          )}
        </div>
      </div>

      {/* Advances Tab Content */}
      <ExpenseAdvancesTab
        currentUser={shell.currentUser}
        ownershipScope={shell.ownershipScope}
        selectedExecutive={shell.selectedExecutive}
        setSelectedExecutive={shell.setSelectedExecutive}
        executiveOptions={shell.executiveOptions}
        dateFrom={shell.dateFrom}
        setDateFrom={shell.setDateFrom}
        dateTo={shell.dateTo}
        setDateTo={shell.setDateTo}
        onRequestAdvance={() => {
          shell.setAdvanceFormMode("request");
          shell.setAdvancePreselectedUserId("");
          shell.setAdvanceFormOpen(true);
        }}
        onIssueDirectAdvance={() => {
          shell.setAdvanceFormMode("direct_issue");
          shell.setAdvancePreselectedUserId("");
          shell.setAdvanceFormOpen(true);
        }}
        isElevated={shell.perms.isElevated}
        onApproveAdvance={(adv) => shell.setApproveAdvanceTarget(adv)}
        onRejectAdvance={(adv) => shell.setRejectAdvanceTarget(adv)}
        onDisburseAdvance={(adv) => shell.setDisburseTarget(adv)}
        onRefundAdvance={isCurrentFinanceMode ? (adv) => shell.setRefundTarget(adv) : undefined}
        sessionToken={shell.sessionToken}
        onOpenPreview={shell.openPreview}
      />

      {/* Modals */}
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

      {shell.approveAdvanceTarget && (
        <ApproveAdvanceModal
          open={!!shell.approveAdvanceTarget}
          advance={shell.approveAdvanceTarget}
          isLoading={shell.isApprovingAdvance}
          onConfirm={shell.handleApproveAdvanceConfirm}
          onClose={() => shell.setApproveAdvanceTarget(null)}
        />
      )}

      {shell.rejectAdvanceTarget && (
        <RejectAdvanceModal
          open={!!shell.rejectAdvanceTarget}
          advance={shell.rejectAdvanceTarget}
          isLoading={shell.isRejectingAdvance}
          onConfirm={shell.handleRejectAdvanceConfirm}
          onClose={() => shell.setRejectAdvanceTarget(null)}
        />
      )}

      {shell.disburseTarget && (
        <AdvanceDisburseModal
          open={!!shell.disburseTarget}
          advance={shell.disburseTarget}
          onClose={() => {
            shell.setDisburseTarget(null);
            shell.refetchKpis();
          }}
        />
      )}

      {isCurrentFinanceMode && shell.refundTarget && (
        <AdvanceRefundModal
          open={!!shell.refundTarget}
          advance={shell.refundTarget}
          onClose={() => {
            shell.setRefundTarget(null);
            shell.refetchKpis();
          }}
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

