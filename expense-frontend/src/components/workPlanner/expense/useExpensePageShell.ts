"use client";

import { useState, useMemo } from "react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { getExpensePermissions } from "./expensePermissions";
import { useFilePreview } from "../FilePreviewModal";
import {
  useGetExpenseKpisQuery,
  useGetWorkPlannerUsersQuery,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
  useApproveTourAdvanceMutation,
  useRejectTourAdvanceMutation,
} from "@/store/api/workPlannerApiSlice";
import type {
  WorkPlanExpenseRecord,
  WorkPlanTourAdvanceRecord,
} from "@/types/workPlanner";
import { toast } from "sonner";
import { useExpenseRole } from "@/context/ExpenseRoleContext";

export function useExpensePageShell() {
  const session = readSessionFromStorage();
  const currentUser = session?.user;
  const sessionToken = session?.token;

  const roleCtx = useExpenseRole();
  const perms = useMemo(() => getExpensePermissions(currentUser), [currentUser]);

  // Common Filters
  const [selectedExecutive, setSelectedExecutive] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [ownershipScope, setOwnershipScope] = useState<"mine" | "team">("team");

  // Modals state
  const [downloadOpen, setDownloadOpen] = useState<boolean>(false);
  const [approveExpenseTarget, setApproveExpenseTarget] = useState<{
    planId: string;
    expense: WorkPlanExpenseRecord;
  } | null>(null);
  const [rejectExpenseTarget, setRejectExpenseTarget] = useState<{
    planId: string;
    expenseId: string;
  } | null>(null);

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

  // Load Work Planner users for filter dropdown
  const { data: wpUsersData } = useGetWorkPlannerUsersQuery(undefined);

  const executiveOptions = useMemo(() => {
    if (!wpUsersData?.users || !Array.isArray(wpUsersData.users)) return [];
    return wpUsersData.users
      .map((u: any) => ({
        id: String(u._id || u.id),
        name: u.name || u.email || "Unknown User",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [wpUsersData]);

  // Fetch KPI Summary
  const { data: kpiData, isLoading: kpiLoading, refetch: refetchKpis } = useGetExpenseKpisQuery({
    sales_user: selectedExecutive !== "all" ? selectedExecutive : undefined,
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
    if (!rejectExpenseTarget) return;
    try {
      await rejectExpenseMut({
        planId: rejectExpenseTarget.planId,
        expenseId: rejectExpenseTarget.expenseId,
        rejection_reason: reason,
      }).unwrap();
      toast.success("Expense claim rejected");
      setRejectExpenseTarget(null);
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

  return {
    currentUser,
    sessionToken,
    roleCtx,
    perms,
    selectedExecutive,
    setSelectedExecutive,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    ownershipScope,
    setOwnershipScope,
    executiveOptions,
    kpiData,
    kpiLoading,
    refetchKpis,
    // Modals & Handlers
    downloadOpen,
    setDownloadOpen,
    approveExpenseTarget,
    setApproveExpenseTarget,
    rejectExpenseTarget,
    setRejectExpenseTarget,
    handleApproveExpenseConfirm,
    handleRejectExpenseConfirm,
    isApprovingExpense,
    isRejectingExpense,
    advanceFormOpen,
    setAdvanceFormOpen,
    advanceFormMode,
    setAdvanceFormMode,
    advancePreselectedUserId,
    setAdvancePreselectedUserId,
    approveAdvanceTarget,
    setApproveAdvanceTarget,
    rejectAdvanceTarget,
    setRejectAdvanceTarget,
    handleApproveAdvanceConfirm,
    handleRejectAdvanceConfirm,
    isApprovingAdvance,
    isRejectingAdvance,
    disburseTarget,
    setDisburseTarget,
    refundTarget,
    setRefundTarget,
    settleUserTarget,
    setSettleUserTarget,
    selectedVoucherId,
    setSelectedVoucherId,
    ledgerTarget,
    setLedgerTarget,
    // Preview
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  };
}

