"use client";

import React, { useState, useEffect } from "react";
import { X, RotateCcw, DollarSign, CreditCard, Building2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRefundTourAdvanceMutation } from "@/store/api/workPlannerApiSlice";
import { formatCurrency } from "../workPlanUtils";
import { ExpenseAttachmentUploader } from "./ExpenseAttachmentUploader";
import { FilePreviewModal, useFilePreview } from "../FilePreviewModal";
import type { WorkPlanTourAdvanceRecord, ExpenseAttachmentItem } from "@/types/workPlanner";

interface AdvanceRefundModalProps {
  advance: WorkPlanTourAdvanceRecord | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sessionToken?: string | null;
}

export function AdvanceRefundModal({ advance, open, onClose, onSuccess, sessionToken }: AdvanceRefundModalProps) {
  const [refundTourAdvance, { isLoading }] = useRefundTourAdvanceMutation();
  const [refundAmount, setRefundAmount] = useState<string>("");
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

  const remainingBalance =
    advance?.remaining_balance ?? (advance?.disbursed_amount ?? advance?.amount ?? 0);

  useEffect(() => {
    if (advance) {
      setRefundAmount(String(remainingBalance || ""));
      setPaymentMethod("bank_transfer");
      setTransactionRef("");
      setNotes("");
      setAttachments([]);
    }
  }, [advance, remainingBalance]);

  if (!open || !advance) return null;

  const salesUserName =
    typeof advance.sales_user === "object" && advance.sales_user
      ? advance.sales_user.name
      : "Executive";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = parseFloat(refundAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid refund amount greater than 0");
      return;
    }
    if (numAmount > remainingBalance) {
      toast.error(
        `Refund amount (${formatCurrency(numAmount)}) cannot exceed remaining advance balance (${formatCurrency(remainingBalance)})`
      );
      return;
    }

    try {
      const advId = advance?._id || advance?.id || "";
      await refundTourAdvance({
        advanceId: advId,
        amount: numAmount,
        payment_method: paymentMethod,
        transaction_reference: transactionRef.trim() || undefined,
        notes: notes.trim() || undefined,
        attachments: attachments.map((a) => a.attachment_id || a._id).filter(Boolean) as string[],
        attachment_details: attachments,
      }).unwrap();

      toast.success("Advance refund recorded successfully");
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
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-purple-500/10">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-purple-600 p-2 text-white">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Refund / Recover Advance</h2>
                <p className="text-xs text-muted">
                  {advance.advance_number} • {salesUserName}
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

          {/* Info Banner */}
          <div className="bg-surface-muted/60 px-5 py-3 border-b border-border flex items-center justify-between text-xs">
            <div>
              <span className="text-muted">Total Disbursed:</span>{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(advance.disbursed_amount ?? advance.amount)}
              </span>
            </div>
            <div>
              <span className="text-muted">Available to Refund:</span>{" "}
              <span className="font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(remainingBalance)}
              </span>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Refund Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-muted">₹</span>
                <input
                  type="number"
                  step="any"
                  required
                  min="1"
                  max={remainingBalance}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted pl-8 pr-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-primary transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Refund Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition"
                >
                  <option value="bank_transfer">Bank Transfer to Company</option>
                  <option value="upi">UPI to Company A/c</option>
                  <option value="cheque">Cheque Deposit</option>
                  <option value="cash">Cash Returned to Accounts</option>
                  <option value="payroll_deduction">Salary / Payroll Recovery</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Transaction / Receipt Ref.
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref / Bank UTR"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground outline-none focus:border-primary transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Refund Notes / Remarks
              </label>
              <textarea
                rows={2}
                placeholder="Reason for unspent advance refund..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted p-3 text-xs text-foreground outline-none focus:border-primary transition resize-none"
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
                resourceId={advance._id || advance.id}
              />
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 flex items-start gap-2 text-xs text-muted">
              <AlertCircle className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <span>
                This will deduct the refunded amount from the executive&apos;s active advance balance and record a credit entry in the company ledger.
              </span>
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
                disabled={isLoading}
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
