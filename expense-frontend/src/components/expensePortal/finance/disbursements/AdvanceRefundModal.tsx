"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, RotateCcw, DollarSign, CreditCard, Building2, AlertCircle, Users, Calendar, Banknote, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRefundTourAdvanceMutation, useGetActiveAdvancesQuery } from "@/store/api/expenseApiSlice";
import { formatCurrency, formatPlanDate } from "@/components/expensePortal/shared/workPlanUtils";
import { ExpenseAttachmentUploader } from "@/components/expensePortal/shared/ExpenseAttachmentUploader";
import { FilePreviewModal, useFilePreview } from "@/components/expensePortal/shared/FilePreviewModal";
import type { WorkPlanTourAdvanceRecord, ExpenseAttachmentItem } from "@/types/workPlanner";

export interface AdvanceRefundModalProps {
  advance?: WorkPlanTourAdvanceRecord | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sessionToken?: string | null;
  user?: {
    _id: string;
    name: string;
    email?: string;
  } | null;
  userOptions?: Array<{ id: string; name: string; email?: string }>;
}

export function AdvanceRefundModal({
  advance,
  open,
  onClose,
  onSuccess,
  sessionToken,
  user,
  userOptions = [],
}: AdvanceRefundModalProps) {
  const [refundTourAdvance, { isLoading }] = useRefundTourAdvanceMutation();

  // Employee Selection (when advance is not pre-provided)
  const [selectedUserId, setSelectedUserId] = useState<string>(
    user?._id || (userOptions.length > 0 ? userOptions[0].id : "")
  );

  // Active Advances query for selected user
  const { data: activeAdvances = [], isLoading: isLoadingAdvances } = useGetActiveAdvancesQuery(
    selectedUserId,
    { skip: !open || !!advance || !selectedUserId }
  );

  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string>("");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [refundDate, setRefundDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [attachments, setAttachments] = useState<ExpenseAttachmentItem[]>([]);

  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  } = useFilePreview(sessionToken);

  const prevOpenRef = React.useRef(false);

  // Determine current active user
  const activeUser = useMemo(() => {
    if (advance) {
      if (typeof advance.sales_user === "object" && advance.sales_user) {
        return {
          _id: advance.sales_user._id || advance.sales_user.id,
          name: advance.sales_user.name || "Executive",
          email: advance.sales_user.email,
        };
      }
      return { _id: String(advance.sales_user || ""), name: "Executive" };
    }
    if (selectedUserId && userOptions.length > 0) {
      const match = userOptions.find((u) => u.id === selectedUserId);
      if (match) return { _id: match.id, name: match.name, email: match.email };
    }
    return user || null;
  }, [advance, selectedUserId, userOptions, user]);

  // Determine effective advance
  const effectiveAdvance = useMemo<WorkPlanTourAdvanceRecord | null>(() => {
    if (advance) return advance;
    if (!selectedAdvanceId || activeAdvances.length === 0) return null;
    return activeAdvances.find((a: any) => (a._id || a.id) === selectedAdvanceId) || null;
  }, [advance, selectedAdvanceId, activeAdvances]);

  const remainingBalance =
    effectiveAdvance?.remaining_balance ?? (effectiveAdvance?.disbursed_amount ?? effectiveAdvance?.amount ?? 0);

  // Reset or initialize on open
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (advance) {
        const uId = typeof advance.sales_user === "object" ? advance.sales_user?._id : advance.sales_user;
        setSelectedUserId(uId || "");
        setSelectedAdvanceId(advance._id || advance.id || "");
        const bal = advance.remaining_balance ?? (advance.disbursed_amount ?? advance.amount ?? 0);
        setRefundAmount(String(bal || ""));
      } else {
        if (user?._id) {
          setSelectedUserId(user._id);
        } else if (userOptions.length > 0) {
          setSelectedUserId(userOptions[0].id);
        }
        setSelectedAdvanceId("");
        setRefundAmount("");
      }
      setRefundDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod("bank_transfer");
      setTransactionRef("");
      setNotes("");
      setAttachments([]);
    }
    prevOpenRef.current = open;
  }, [open, advance, user?._id]);

  // Auto-select advance when activeAdvances load in selector mode
  useEffect(() => {
    if (!open || advance) return;
    if (activeAdvances.length > 0) {
      const currentValid = activeAdvances.some((a: any) => (a._id || a.id) === selectedAdvanceId);
      if (!currentValid) {
        const first = activeAdvances[0];
        const firstId = first._id || first.id || "";
        setSelectedAdvanceId(firstId);
        const bal = first.remaining_balance ?? (first.disbursed_amount ?? first.amount ?? 0);
        setRefundAmount(String(bal || ""));
      }
    } else {
      setSelectedAdvanceId("");
      setRefundAmount("");
    }
  }, [open, advance, activeAdvances, selectedAdvanceId]);

  if (!open) return null;

  const salesUserName = activeUser?.name || "Executive";

  function handleSelectAdvance(advItem: any) {
    const advId = advItem._id || advItem.id || "";
    setSelectedAdvanceId(advId);
    const bal = advItem.remaining_balance ?? (advItem.disbursed_amount ?? advItem.amount ?? 0);
    setRefundAmount(String(bal || ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!effectiveAdvance) {
      toast.error("Please select an active advance to refund.");
      return;
    }

    const numAmount = parseFloat(refundAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid refund amount greater than 0");
      return;
    }

    if (numAmount > remainingBalance) {
      toast.error(
        `Refund amount (${formatCurrency(numAmount)}) cannot exceed available advance balance (${formatCurrency(remainingBalance)})`
      );
      return;
    }

    try {
      const advId = effectiveAdvance._id || effectiveAdvance.id || "";
      await refundTourAdvance({
        advanceId: advId,
        amount: numAmount,
        refund_date: refundDate,
        payment_method: paymentMethod,
        transaction_reference: transactionRef.trim() || undefined,
        notes: notes.trim() || undefined,
        attachments: attachments.map((a) => a.attachment_id || a._id).filter(Boolean) as string[],
        attachment_details: attachments,
      }).unwrap();

      toast.success(`Advance refund of ₹${numAmount.toLocaleString()} recorded successfully for ${salesUserName}.`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to record refund";
      toast.error(msg);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-sans">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-purple-500/10">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-purple-600 p-2 text-white">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Record Advance Refund</h2>
                <p className="text-xs text-muted">
                  {effectiveAdvance?.advance_number ? `${effectiveAdvance.advance_number} • ` : ""}
                  <span className="font-semibold text-foreground">{salesUserName}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
            {/* Employee Selector (when not pre-locked to a specific advance) */}
            {!advance && userOptions.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Select Employee</span>
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setSelectedAdvanceId("");
                    setRefundAmount("");
                  }}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-purple-600 transition"
                >
                  {userOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name} {opt.email ? `(${opt.email})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Advance Picker (when multiple active advances exist for the user) */}
            {!advance && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    Active Advance to Recover / Refund
                  </span>
                  {isLoadingAdvances && <span className="text-[10px] text-muted">Loading advances...</span>}
                </label>

                {isLoadingAdvances ? (
                  <div className="p-4 rounded-xl border border-border bg-surface-muted/40 text-center text-xs text-muted animate-pulse">
                    Loading active advances for {salesUserName}...
                  </div>
                ) : activeAdvances.length === 0 ? (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">No Active Advances Found</p>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        {salesUserName} currently does not have any active disbursed advances with an unspent balance available to refund.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {activeAdvances.map((advItem: any) => {
                      const advId = advItem._id || advItem.id;
                      const isSelected = (selectedAdvanceId || "") === advId;
                      const bal = advItem.remaining_balance ?? (advItem.disbursed_amount ?? advItem.amount ?? 0);

                      return (
                        <div
                          key={advId}
                          onClick={() => handleSelectAdvance(advItem)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? "border-purple-600 bg-purple-500/10 text-foreground ring-1 ring-purple-600/30"
                              : "border-border bg-surface-muted/40 hover:bg-surface-muted text-muted hover:text-foreground"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{advItem.advance_number}</span>
                              <span className="text-[10px] text-muted">
                                {advItem.request_date ? formatPlanDate(advItem.request_date) : ""}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted truncate mt-0.5">
                              {advItem.purpose || "Tour Advance"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-muted block uppercase">Available</span>
                            <span className="font-extrabold text-purple-600 dark:text-purple-400">
                              {formatCurrency(bal)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Advance Balance Banner */}
            {effectiveAdvance && (
              <div className="bg-surface-muted/60 px-4 py-3 rounded-xl border border-border flex items-center justify-between text-xs">
                <div>
                  <span className="text-muted block text-[10px] uppercase font-bold">Total Disbursed</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(effectiveAdvance.disbursed_amount ?? effectiveAdvance.amount ?? 0)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted block text-[10px] uppercase font-bold">Available to Refund</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                    {formatCurrency(remainingBalance)}
                  </span>
                </div>
              </div>
            )}

            {/* Refund Amount & Quick Fill */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-foreground">
                  Refund Amount (₹) <span className="text-rose-500">*</span>
                </label>
                {remainingBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setRefundAmount(String(remainingBalance))}
                    className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    Full Balance ({formatCurrency(remainingBalance)})
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-muted">₹</span>
                <input
                  type="number"
                  step="any"
                  required
                  min="1"
                  max={remainingBalance || undefined}
                  disabled={!effectiveAdvance || remainingBalance <= 0}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border bg-surface-muted pl-8 pr-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-purple-600 disabled:opacity-50 transition"
                />
              </div>
            </div>

            {/* Refund Date & Payment Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Refund Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted pointer-events-none" />
                  <input
                    type="date"
                    required
                    value={refundDate}
                    onChange={(e) => setRefundDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs font-medium text-foreground outline-none focus:border-purple-600 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Refund Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-purple-600 transition"
                >
                  <option value="bank_transfer">Bank Transfer to Company</option>
                  <option value="upi">UPI to Company A/c</option>
                  <option value="cheque">Cheque Deposit</option>
                  <option value="cash">Cash Returned to Accounts</option>
                  <option value="payroll_deduction">Salary / Payroll Recovery</option>
                </select>
              </div>
            </div>

            {/* Transaction Reference */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Transaction / Receipt Ref.
              </label>
              <input
                type="text"
                placeholder="e.g. UPI Ref / Bank UTR / Deposit Slip #"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground outline-none focus:border-purple-600 transition"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Refund Notes / Remarks
              </label>
              <textarea
                rows={2}
                placeholder="Reason for unspent advance refund..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted p-3 text-xs text-foreground outline-none focus:border-purple-600 transition resize-none"
              />
            </div>

            {/* Refund Receipt / Proof Upload */}
            <div className="rounded-xl border border-border bg-surface-muted/30 p-3">
              <ExpenseAttachmentUploader
                label="Refund Receipt / Deposit Slip / Bank Transfer Proof"
                attachments={attachments}
                onChange={setAttachments}
                onPreview={openPreview}
                resourceType="tour_advance_refund"
                resourceId={effectiveAdvance?._id || effectiveAdvance?.id || "refund_proof"}
              />
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 flex items-start gap-2 text-xs text-muted">
              <AlertCircle className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <span>
                This will deduct the refunded amount from the executive&apos;s active advance balance and record a credit entry in the company passbook ledger.
              </span>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !effectiveAdvance || remainingBalance <= 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50 active:scale-95 transition shadow-xs cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isLoading ? "Recording..." : "Confirm Refund"}</span>
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

// Re-export alias for semantic clarity
export const RecordRefundModal = AdvanceRefundModal;
