"use client";

import React, { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileSpreadsheet,
  FileCheck,
  Receipt,
  Wallet,
  Scale,
  Users,
  ShieldCheck,
  Building2,
  BookOpen,
} from "lucide-react";
import {
  useGetMyTeamQuery,
  useGetExpenseKpisQuery,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
  useApproveTourAdvanceMutation,
  useRejectTourAdvanceMutation,
} from "@/store/api/workPlannerApiSlice";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import { readSessionFromStorage, hasWorkPlannerPortalAccess } from "@/utils/authStorage";
import { getExpensePermissions } from "./expense/expensePermissions";
import { useFilePreview, FilePreviewModal } from "./FilePreviewModal";
import { DownloadExpensesModal } from "./DownloadExpensesModal";
import { DownloadWorkPlansModal } from "./DownloadWorkPlansModal";
import { RejectExpenseModal } from "./RejectExpenseModal";
import { SeniorRemarksModal } from "./SeniorRemarksModal";
import { DirectiveThreadModal } from "./DirectiveThreadModal";

import { ExpenseKpiSummary } from "./expense/ExpenseKpiSummary";
import { ExpenseClaimsTab } from "./expense/ExpenseClaimsTab";
import { ExpenseAdvancesTab } from "./expense/ExpenseAdvancesTab";
import { ExpenseSettlementsTab } from "./expense/ExpenseSettlementsTab";
import { ExpenseBalancesTab } from "./expense/ExpenseBalancesTab";
import { AdvanceFormModal } from "./expense/AdvanceFormModal";
import { ApproveAdvanceModal } from "./expense/ApproveAdvanceModal";
import { RejectAdvanceModal } from "./expense/RejectAdvanceModal";
import { AdvanceDisburseModal } from "./expense/AdvanceDisburseModal";
import { AdvanceRefundModal } from "./expense/AdvanceRefundModal";
import { ApproveExpenseModal } from "./expense/ApproveExpenseModal";
import { SettleExpenseModal } from "./expense/SettleExpenseModal";
import { ExecutiveLedgerDrawer } from "./expense/ExecutiveLedgerDrawer";
import { SettlementVoucherModal } from "./expense/SettlementVoucherModal";

import type {
  SeniorRemarkFeedItem,
  WorkPlanExpenseRecord,
  WorkPlanTourAdvanceRecord,
} from "@/types/workPlanner";
import { toast } from "sonner";

type ExpenseTab = "claims" | "advances" | "settlements" | "balances";
type OwnershipScope = "mine" | "team";

export function ExpensesPage() {
  const searchParams = useSearchParams();
  const session = readSessionFromStorage();
  const currentUser = session?.user;
  const sessionToken = session?.token;

  const perms = useMemo(() => getExpensePermissions(currentUser), [currentUser]);

  // Tab state (defaults to 'claims' or searchParam 'tab')
  const initialTab = (searchParams?.get("tab") as ExpenseTab) || "claims";
  const [activeTab, setActiveTab] = useState<ExpenseTab>(
    ["claims", "advances", "settlements", "balances"].includes(initialTab) ? initialTab : "claims"
  );

  // Scope: Executives only have 'mine'. Elevated users can toggle 'mine' vs 'team'.
  const [ownershipScope, setOwnershipScope] = useState<OwnershipScope>(
    perms.isElevated ? "team" : "mine"
  );

  // Common Filters
  const [selectedExecutive, setSelectedExecutive] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Modals state
  const [downloadOpen, setDownloadOpen] = useState<boolean>(false);
  const [workPlanReportOpen, setWorkPlanReportOpen] = useState<boolean>(false);
  const [approveExpenseTarget, setApproveExpenseTarget] = useState<{
    planId: string;
    expense: WorkPlanExpenseRecord;
  } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ planId: string; expenseId: string } | null>(null);
  const [seniorRemarksTarget, setSeniorRemarksTarget] = useState<{
    planId: string;
    expenseId: string;
    title: string;
    currentStatus: string;
    assigneeName: string;
    remarks: string;
    history: any[];
  } | null>(null);
  const [selectedThreadItem, setSelectedThreadItem] = useState<SeniorRemarkFeedItem | null>(null);
  const [threadModalOpen, setThreadModalOpen] = useState<boolean>(false);

  // New Expense Workflow Modals
  const [advanceFormOpen, setAdvanceFormOpen] = useState<boolean>(false);
  const [advanceFormMode, setAdvanceFormMode] = useState<"request" | "direct_issue">("request");
  const [advancePreselectedUserId, setAdvancePreselectedUserId] = useState<string>("");
  const [approveAdvanceTarget, setApproveAdvanceTarget] = useState<WorkPlanTourAdvanceRecord | null>(null);
  const [rejectAdvanceTarget, setRejectAdvanceTarget] = useState<WorkPlanTourAdvanceRecord | null>(null);
  const [disburseTarget, setDisburseTarget] = useState<WorkPlanTourAdvanceRecord | null>(null);
  const [refundTarget, setRefundTarget] = useState<WorkPlanTourAdvanceRecord | null>(null);
  const [settleUserTarget, setSettleUserTarget] = useState<{ _id: string; name: string; email?: string } | null>(null);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [ledgerTarget, setLedgerTarget] = useState<{ userId: string; userName: string } | null>(null);

  // File Preview Hook
  const { previewDoc, previewBlobUrl, previewLoading, openPreview, closePreview, downloadFile } =
    useFilePreview(sessionToken);

  const [approveExpenseMut, { isLoading: isApprovingExpense }] = useApproveExpenseMutation();
  const [rejectExpenseMut, { isLoading: isRejectingExpense }] = useRejectExpenseMutation();
  const [approveTourAdvanceMut, { isLoading: isApprovingAdvance }] = useApproveTourAdvanceMutation();
  const [rejectTourAdvanceMut, { isLoading: isRejectingAdvance }] = useRejectTourAdvanceMutation();

  // Load team users for filters & modals
  const { data: usersData } = useGetUsersQuery(undefined, { skip: !perms.isAdmin });
  const { data: myTeamData } = useGetMyTeamQuery(undefined, { skip: perms.isAdmin || !perms.isElevated });

  const executiveOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();

    function addExec(id: string, name: string) {
      if (!id || id === "undefined" || id === "null") return;
      if (!map.has(id)) map.set(id, { id, name: name || "Unknown User" });
    }

    if (perms.isAdmin && usersData && Array.isArray(usersData)) {
      usersData.filter(hasWorkPlannerPortalAccess).forEach((u: any) => {
        addExec(String(u._id || u.id), u.name || u.email || "Unknown User");
      });
    } else if (myTeamData?.members && Array.isArray(myTeamData.members)) {
      myTeamData.members.forEach((m: any) => {
        addExec(String(m._id || m.id), m.name || m.email || "Unknown User");
      });
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [perms.isAdmin, perms.isElevated, usersData, myTeamData]);

  // Fetch KPI Summary
  const { data: kpiData, isLoading: kpiLoading, refetch: refetchKpis } = useGetExpenseKpisQuery({
    scope: perms.isElevated ? ownershipScope : "mine",
    user_id: selectedExecutive !== "all" ? selectedExecutive : undefined,
    from_date: dateFrom || undefined,
    to_date: dateTo || undefined,
  });

  async function handleApproveExpenseConfirm() {
    if (!approveExpenseTarget) return;
    try {
      const expId = approveExpenseTarget.expense._id || approveExpenseTarget.expense.id || "";
      await approveExpenseMut({
        planId: approveExpenseTarget.planId,
        expenseId: expId,
      }).unwrap();
      toast.success("Expense claim approved successfully");
      setApproveExpenseTarget(null);
      refetchKpis();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to approve expense";
      toast.error(msg);
    }
  }

  async function handleRejectExpenseConfirm(reason: string) {
    if (!rejectTarget) return;
    try {
      await rejectExpenseMut({
        planId: rejectTarget.planId,
        expenseId: rejectTarget.expenseId,
        rejection_reason: reason,
      }).unwrap();
      toast.success("Expense claim rejected");
      setRejectTarget(null);
      refetchKpis();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to reject expense";
      toast.error(msg);
    }
  }

  async function handleApproveAdvanceConfirm() {
    if (!approveAdvanceTarget) return;
    try {
      const advId = approveAdvanceTarget._id || approveAdvanceTarget.id || "";
      await approveTourAdvanceMut({ advanceId: advId }).unwrap();
      toast.success(`Tour advance ${approveAdvanceTarget.advance_number} approved`);
      setApproveAdvanceTarget(null);
      refetchKpis();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to approve advance";
      toast.error(msg);
    }
  }

  async function handleRejectAdvanceConfirm(reason: string) {
    if (!rejectAdvanceTarget) return;
    try {
      const advId = rejectAdvanceTarget._id || rejectAdvanceTarget.id || "";
      await rejectTourAdvanceMut({ advanceId: advId, rejection_reason: reason }).unwrap();
      toast.success(`Tour advance ${rejectAdvanceTarget.advance_number} rejected`);
      setRejectAdvanceTarget(null);
      refetchKpis();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to reject advance";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-4 font-sans w-full max-w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-2xs">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">
            Expense & Tour Advance Management
          </h1>
          <p className="text-[11px] sm:text-xs text-muted">
            {perms.isElevated
              ? ownershipScope === "mine"
                ? "Your own field expenses and tour advances — track submissions and reimbursements"
                : "Team financial management — claims verification, advances, settlements & ledger audit"
              : "Track tour advances, submit field visit claims, and check your live balance passbook"}
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 sm:flex-wrap">
          {/* Quick passbook button for executive / self */}
          <button
            type="button"
            onClick={() => {
              if (currentUser?._id) {
                setLedgerTarget({ userId: currentUser._id, userName: currentUser.name || "My Passbook" });
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 active:scale-95 transition shrink-0 cursor-pointer"
          >
            <BookOpen className="h-4 w-4" />
            <span>My Passbook</span>
          </button>

          <button
            type="button"
            onClick={() => setDownloadOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>Expense Report</span>
          </button>

          <button
            type="button"
            onClick={() => setWorkPlanReportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Work Plan Report</span>
          </button>
        </div>
      </div>

      {/* Scope Switcher (for Coordinator, Manager, Admin) */}
      {perms.isElevated && (
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setOwnershipScope("team")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              ownershipScope === "team"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {perms.isAdmin ? "All / Global View" : "Team View"}
          </button>
          <button
            type="button"
            onClick={() => setOwnershipScope("mine")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              ownershipScope === "mine"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            My View (Personal)
          </button>
        </div>
      )}

      {/* KPI Cards Summary */}
      <ExpenseKpiSummary kpis={kpiData} loading={kpiLoading} />

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card p-1.5 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("claims")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${
            activeTab === "claims"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted hover:bg-surface-muted hover:text-foreground"
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>Expense Claims</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("advances")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${
            activeTab === "advances"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted hover:bg-surface-muted hover:text-foreground"
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>Tour Advances</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settlements")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${
            activeTab === "settlements"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted hover:bg-surface-muted hover:text-foreground"
          }`}
        >
          <FileCheck className="h-4 w-4" />
          <span>Settlements History</span>
        </button>

        {perms.isElevated && (
          <button
            type="button"
            onClick={() => setActiveTab("balances")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              activeTab === "balances"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            <Scale className="h-4 w-4" />
            <span>Executive Balances & Settle</span>
          </button>
        )}
      </div>

      {/* Tab Panels */}
      {activeTab === "claims" && (
        <ExpenseClaimsTab
          currentUser={currentUser}
          ownershipScope={perms.isElevated ? ownershipScope : "mine"}
          selectedExecutive={selectedExecutive}
          setSelectedExecutive={setSelectedExecutive}
          executiveOptions={executiveOptions}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          onOpenPreview={openPreview}
          onOpenSeniorRemarks={setSeniorRemarksTarget}
          onOpenThread={(item) => {
            setSelectedThreadItem(item);
            setThreadModalOpen(true);
          }}
          onOpenApproveModal={(target) => setApproveExpenseTarget(target)}
          onOpenRejectModal={setRejectTarget}
          onOpenSettleModal={(user) => setSettleUserTarget(user)}
          sessionToken={sessionToken}
        />
      )}

      {activeTab === "advances" && (
        <ExpenseAdvancesTab
          currentUser={currentUser}
          ownershipScope={perms.isElevated ? ownershipScope : "mine"}
          selectedExecutive={selectedExecutive}
          setSelectedExecutive={setSelectedExecutive}
          executiveOptions={executiveOptions}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          isElevated={perms.isElevated}
          onRequestAdvance={() => {
            setAdvancePreselectedUserId("");
            setAdvanceFormMode("request");
            setAdvanceFormOpen(true);
          }}
          onIssueDirectAdvance={() => {
            setAdvancePreselectedUserId("");
            setAdvanceFormMode("direct_issue");
            setAdvanceFormOpen(true);
          }}
          onApproveAdvance={(adv) => setApproveAdvanceTarget(adv)}
          onRejectAdvance={(adv) => setRejectAdvanceTarget(adv)}
          onDisburseAdvance={(adv) => setDisburseTarget(adv)}
          onRefundAdvance={(adv) => setRefundTarget(adv)}
          sessionToken={sessionToken}
          onOpenPreview={openPreview}
        />
      )}

      {activeTab === "settlements" && (
        <ExpenseSettlementsTab
          currentUser={currentUser}
          ownershipScope={perms.isElevated ? ownershipScope : "mine"}
          selectedExecutive={selectedExecutive}
          setSelectedExecutive={setSelectedExecutive}
          executiveOptions={executiveOptions}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          onViewVoucher={(id) => setSelectedVoucherId(id)}
        />
      )}

      {activeTab === "balances" && perms.isElevated && (
        <ExpenseBalancesTab
          currentUser={currentUser}
          ownershipScope={ownershipScope}
          selectedExecutive={selectedExecutive}
          setSelectedExecutive={setSelectedExecutive}
          executiveOptions={executiveOptions}
          onOpenLedger={(userId, userName) => setLedgerTarget({ userId, userName })}
          onOpenSettleModal={(user) => setSettleUserTarget(user)}
          onIssueAdvance={(user) => {
            setAdvancePreselectedUserId(user._id);
            setAdvanceFormMode("direct_issue");
            setAdvanceFormOpen(true);
          }}
        />
      )}

      {/* Modals */}
      <AdvanceFormModal
        open={advanceFormOpen}
        onClose={() => {
          setAdvanceFormOpen(false);
          setAdvancePreselectedUserId("");
        }}
        onSuccess={() => refetchKpis()}
        sessionToken={sessionToken}
        isElevated={perms.isElevated}
        isAdmin={perms.isAdmin}
        executiveOptions={executiveOptions}
        initialMode={advanceFormMode}
        preselectedUserId={advancePreselectedUserId}
        currentUserId={String(currentUser?._id || "")}
        currentUserName={currentUser?.name || ""}
      />

      <ApproveAdvanceModal
        advance={approveAdvanceTarget}
        open={Boolean(approveAdvanceTarget)}
        isLoading={isApprovingAdvance}
        onClose={() => setApproveAdvanceTarget(null)}
        onConfirm={handleApproveAdvanceConfirm}
      />

      <RejectAdvanceModal
        advance={rejectAdvanceTarget}
        open={Boolean(rejectAdvanceTarget)}
        isLoading={isRejectingAdvance}
        onClose={() => setRejectAdvanceTarget(null)}
        onConfirm={handleRejectAdvanceConfirm}
      />

      <AdvanceDisburseModal
        advance={disburseTarget}
        open={Boolean(disburseTarget)}
        onClose={() => setDisburseTarget(null)}
        onSuccess={() => refetchKpis()}
        sessionToken={sessionToken}
      />

      <AdvanceRefundModal
        advance={refundTarget}
        open={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
        onSuccess={() => refetchKpis()}
        sessionToken={sessionToken}
      />

      <ApproveExpenseModal
        expense={approveExpenseTarget}
        open={Boolean(approveExpenseTarget)}
        isLoading={isApprovingExpense}
        onClose={() => setApproveExpenseTarget(null)}
        onConfirm={handleApproveExpenseConfirm}
      />

      <RejectExpenseModal
        open={Boolean(rejectTarget)}
        isRejecting={isRejectingExpense}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleRejectExpenseConfirm}
      />

      <SettleExpenseModal
        salesUser={settleUserTarget}
        open={Boolean(settleUserTarget)}
        onClose={() => setSettleUserTarget(null)}
        onSuccess={() => refetchKpis()}
        sessionToken={sessionToken}
      />

      <SettlementVoucherModal
        settlementId={selectedVoucherId}
        open={Boolean(selectedVoucherId)}
        onClose={() => setSelectedVoucherId(null)}
        sessionToken={sessionToken}
      />

      <ExecutiveLedgerDrawer
        userId={ledgerTarget?.userId || null}
        userName={ledgerTarget?.userName}
        open={Boolean(ledgerTarget)}
        onClose={() => setLedgerTarget(null)}
        executiveOptions={perms.isElevated ? executiveOptions : []}
        onSelectUser={(id, name) => setLedgerTarget({ userId: id, userName: name })}
        sessionToken={sessionToken}
      />

      {downloadOpen && (
        <DownloadExpensesModal
          open={downloadOpen}
          expenses={[]}
          onClose={() => setDownloadOpen(false)}
        />
      )}

      {workPlanReportOpen && (
        <DownloadWorkPlansModal
          open={workPlanReportOpen}
          onClose={() => setWorkPlanReportOpen(false)}
        />
      )}

      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={downloadFile}
      />

      {seniorRemarksTarget && (
        <SeniorRemarksModal
          open={Boolean(seniorRemarksTarget)}
          itemType="expense"
          title={seniorRemarksTarget.title}
          planId={seniorRemarksTarget.planId}
          itemId={seniorRemarksTarget.expenseId}
          currentStatus={seniorRemarksTarget.currentStatus}
          assigneeName={seniorRemarksTarget.assigneeName}
          initialRemarks={seniorRemarksTarget.remarks}
          authorityRemarksHistory={seniorRemarksTarget.history}
          onClose={() => setSeniorRemarksTarget(null)}
          onSuccess={() => refetchKpis()}
        />
      )}

      {threadModalOpen && (
        <DirectiveThreadModal
          open={threadModalOpen}
          item={selectedThreadItem}
          onClose={() => {
            setThreadModalOpen(false);
            setSelectedThreadItem(null);
          }}
          onSuccess={() => refetchKpis()}
        />
      )}
    </div>
  );
}

export default ExpensesPage;
