"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  CheckCircle2,
  DollarSign,
  CreditCard,
  Building2,
  AlertCircle,
  FileCheck,
  ChevronRight,
  Calculator,
  ShieldCheck,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCreateExpenseSettlementMutation,
  useGetActiveTourAdvancesQuery,
  useGetExpensesQuery,
} from "@/store/api/workPlannerApiSlice";
import { formatCurrency, formatPlanDate, EXPENSE_CATEGORY_LABELS } from "../workPlanUtils";
import { ExpenseAttachmentUploader } from "./ExpenseAttachmentUploader";
import { FilePreviewModal, useFilePreview } from "../FilePreviewModal";
import type { WorkPlanExpenseRecord, WorkPlanTourAdvanceRecord, ExpenseAttachmentItem } from "@/types/workPlanner";

interface SettleExpenseModalProps {
  salesUser: { _id: string; name: string; email?: string } | null;
  initialSelectedExpenseIds?: string[];
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sessionToken?: string | null;
}

export function SettleExpenseModal({
  salesUser,
  initialSelectedExpenseIds = [],
  open,
  onClose,
  onSuccess,
  sessionToken,
}: SettleExpenseModalProps) {
  const [createExpenseSettlement, { isLoading }] = useCreateExpenseSettlementMutation();

  const userId = salesUser?._id || "";

  // Fetch approved & unsettled expenses for this user
  const { data: expensesRes, isLoading: loadingExpenses } = useGetExpensesQuery(
    {
      scope: "all",
      user_id: userId,
      status: "approved",
      limit: 100,
    },
    { skip: !open || !userId }
  );

  // Fetch active advances for this user
  const { data: activeAdvancesRes, isLoading: loadingAdvances } = useGetActiveTourAdvancesQuery(
    { userId },
    { skip: !open || !userId }
  );

  const availableClaims: WorkPlanExpenseRecord[] = useMemo(() => {
    const list = expensesRes?.data || [];
    return list.filter((e) => (e.settlement_status || "unsettled") !== "settled");
  }, [expensesRes]);

  const activeAdvances: WorkPlanTourAdvanceRecord[] = useMemo(() => {
    return activeAdvancesRes?.data || [];
  }, [activeAdvancesRes]);

  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [advanceDeductions, setAdvanceDeductions] = useState<Record<string, number>>({});
  const [directPaymentAmount, setDirectPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [settlementNotes, setSettlementNotes] = useState<string>("");
  const [settlementDate, setSettlementDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [attachments, setAttachments] = useState<ExpenseAttachmentItem[]>([]);

  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  } = useFilePreview(sessionToken);

  // Initialize selected claims
  useEffect(() => {
    if (open) {
      if (initialSelectedExpenseIds.length > 0) {
        setSelectedClaimIds(initialSelectedExpenseIds);
      } else if (availableClaims.length > 0) {
        setSelectedClaimIds(availableClaims.map((c) => c._id || c.id || ""));
      }
      setAttachments([]);
    }
  }, [open, initialSelectedExpenseIds, availableClaims]);

  // Calculate totals
  const totalClaimAmount = useMemo(() => {
    return availableClaims
      .filter((c) => selectedClaimIds.includes(c._id || c.id || ""))
      .reduce((sum, c) => {
        const amt = c.amount || 0;
        const settledAmt = c.settled_amount || 0;
        return sum + Math.max(0, amt - settledAmt);
      }, 0);
  }, [availableClaims, selectedClaimIds]);

  const totalAdvanceDeduction = useMemo(() => {
    return Object.values(advanceDeductions).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [advanceDeductions]);

  // Auto-allocate advance deduction when claim amount changes or auto button clicked
  function autoAllocate() {
    let remainingToCover = totalClaimAmount;
    const newDeductions: Record<string, number> = {};

    for (const adv of activeAdvances) {
      const advId = adv._id || adv.id || "";
      const advAvail = adv.remaining_balance ?? (adv.disbursed_amount ?? adv.amount);
      if (remainingToCover > 0 && advAvail > 0) {
        const deduct = Math.min(remainingToCover, advAvail);
        newDeductions[advId] = deduct;
        remainingToCover -= deduct;
      } else {
        newDeductions[advId] = 0;
      }
    }

    setAdvanceDeductions(newDeductions);
    setDirectPaymentAmount(remainingToCover > 0 ? remainingToCover : 0);
  }

  const grandSettlementTotal = totalAdvanceDeduction + (Number(directPaymentAmount) || 0);
  const diff = grandSettlementTotal - totalClaimAmount;
  const isBalanced = Math.abs(diff) < 0.01 && totalClaimAmount > 0;

  function toggleClaimSelection(id: string) {
    setSelectedClaimIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleAdvanceDeductionChange(advId: string, value: string, maxAvailable: number) {
    const num = parseFloat(value) || 0;
    const clamped = Math.max(0, Math.min(num, maxAvailable));
    setAdvanceDeductions((prev) => ({
      ...prev,
      [advId]: clamped,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedClaimIds.length === 0) {
      toast.error("Please select at least one approved expense claim to settle");
      return;
    }
    if (!isBalanced) {
      toast.error(
        `Settlement split total (${formatCurrency(grandSettlementTotal)}) must exactly equal claim total (${formatCurrency(totalClaimAmount)})`
      );
      return;
    }

    const advancesPayload = Object.entries(advanceDeductions)
      .filter(([_, amt]) => amt > 0)
      .map(([advId, amt]) => ({
        advance_id: advId,
        deducted_amount: amt,
      }));

    try {
      await createExpenseSettlement({
        sales_user: userId,
        settlement_date: settlementDate,
        expense_ids: selectedClaimIds,
        advances: advancesPayload,
        direct_payment_amount: directPaymentAmount,
        payment_method: directPaymentAmount > 0 ? paymentMethod : undefined,
        transaction_reference: transactionRef.trim() || undefined,
        bank_name: bankName.trim() || undefined,
        settlement_notes: settlementNotes.trim() || undefined,
        attachments: attachments.map((a) => a.attachment_id || a._id).filter(Boolean) as string[],
        attachment_details: attachments,
      }).unwrap();

      toast.success("Expense settlement voucher generated successfully!");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to process settlement";
      toast.error(msg);
    }
  }

  if (!open || !salesUser) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-sky-500/10">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-sky-600 p-2 text-white">
                <FileCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Settle Approved Expense Claims</h2>
                <p className="text-xs text-muted">
                  Executive: <span className="font-semibold text-foreground">{salesUser.name}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Section 1: Claims to Settle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  1. Select Approved Claims to Settle ({selectedClaimIds.length} / {availableClaims.length})
                </span>
                <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                  Total Claims: {formatCurrency(totalClaimAmount)}
                </span>
              </div>

              {loadingExpenses ? (
                <div className="p-4 text-center text-xs text-muted">Loading approved claims…</div>
              ) : availableClaims.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted">
                  No approved unsettled claims found for this executive.
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border bg-surface-muted/30">
                  {availableClaims.map((claim) => {
                    const claimId = claim._id || claim.id || "";
                    const isChecked = selectedClaimIds.includes(claimId);
                    const netClaimAmt = (claim.amount || 0) - (claim.settled_amount || 0);

                    return (
                      <label
                        key={claimId}
                        className="flex items-center justify-between p-2.5 hover:bg-surface-muted/60 transition cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleClaimSelection(claimId)}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                          />
                          <div>
                            <div className="font-semibold text-foreground">
                              {EXPENSE_CATEGORY_LABELS[claim.category] || claim.category}
                              {claim.sub_category ? ` • ${claim.sub_category}` : ""}
                            </div>
                            <div className="text-[11px] text-muted">
                              {formatPlanDate(claim.expense_date)} • {claim.description || "Field visit expense"}
                            </div>
                          </div>
                        </div>
                        <div className="font-bold text-foreground">{formatCurrency(netClaimAmt)}</div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 2: Settlement Payment & Deduction Breakdown */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  2. Settlement Funding & Deduction Allocation
                </span>
                <button
                  type="button"
                  onClick={autoAllocate}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  <span>Auto Allocate</span>
                </button>
              </div>

              {/* Advance Deductions */}
              {activeAdvances.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-border bg-purple-500/5 p-3">
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                    Deduct from Available Tour Advances:
                  </span>
                  <div className="space-y-2">
                    {activeAdvances.map((adv) => {
                      const advId = adv._id || adv.id || "";
                      const avail = adv.remaining_balance ?? (adv.disbursed_amount ?? adv.amount);
                      const currentDeduction = advanceDeductions[advId] || 0;

                      return (
                        <div
                          key={advId}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border text-xs"
                        >
                          <div>
                            <span className="font-bold text-foreground">{adv.advance_number}</span>
                            <span className="text-muted ml-2">
                              (Avail: {formatCurrency(avail)})
                            </span>
                            <p className="text-[11px] text-muted">{adv.purpose}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted text-[11px]">Deduct: ₹</span>
                            <input
                              type="number"
                              min="0"
                              max={avail}
                              step="any"
                              value={currentDeduction || ""}
                              onChange={(e) =>
                                handleAdvanceDeductionChange(advId, e.target.value, avail)
                              }
                              placeholder="0"
                              className="w-24 rounded-lg border border-border bg-surface-muted px-2 py-1 text-xs font-bold text-foreground outline-none focus:border-primary text-right"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted p-2 rounded-lg bg-surface-muted/40 border border-border">
                  No active tour advances in hand for this executive. Entire claim will be paid via Direct Company Payment.
                </div>
              )}

              {/* Direct Payout Amount */}
              <div className="rounded-xl border border-border bg-emerald-500/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Direct Company Payment (Reimbursement Payout)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted text-[11px]">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={directPaymentAmount || ""}
                      onChange={(e) => setDirectPaymentAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-28 rounded-lg border border-border bg-surface-muted px-2.5 py-1 text-xs font-bold text-foreground outline-none focus:border-primary text-right"
                    />
                  </div>
                </div>

                {directPaymentAmount > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted mb-1">
                        Payment Mode
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary"
                      >
                        <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                        <option value="upi">UPI / Direct Online</option>
                        <option value="cheque">Cheque</option>
                        <option value="cash">Company Cash</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted mb-1">
                        Bank Ref / UTR
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. UTR987654321"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Settlement Proof Upload */}
              <div className="rounded-xl border border-border bg-surface-muted/30 p-3">
                <ExpenseAttachmentUploader
                  label="Settlement Voucher / Bank Proof / Signed Approval Sheet"
                  attachments={attachments}
                  onChange={setAttachments}
                  onPreview={openPreview}
                  resourceType="expense_settlement"
                />
              </div>
            </div>

            {/* Section 3: Summary Match Box */}
            <div className="rounded-xl border border-border bg-surface-muted p-3.5 space-y-2 text-xs">
              <div className="flex justify-between text-muted">
                <span>Total Selected Claims:</span>
                <span className="font-bold text-foreground">{formatCurrency(totalClaimAmount)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Advance Deductions:</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  - {formatCurrency(totalAdvanceDeduction)}
                </span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Direct Payment Payout:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  + {formatCurrency(directPaymentAmount)}
                </span>
              </div>
              <div className="pt-2 border-t border-border flex justify-between items-center font-bold">
                <span>Settlement Split Total:</span>
                <span
                  className={
                    isBalanced
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }
                >
                  {formatCurrency(grandSettlementTotal)}
                </span>
              </div>

              {!isBalanced && (
                <div className="text-[11px] text-rose-500 font-semibold flex items-center gap-1.5 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Discrepancy of {formatCurrency(Math.abs(diff))}. Allocation must equal Claim Total.
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !isBalanced || totalClaimAmount === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 active:scale-95 transition shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{isLoading ? "Generating Voucher..." : "Authorize & Settle Voucher"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={downloadFile}
      />
    </>
  );
}
