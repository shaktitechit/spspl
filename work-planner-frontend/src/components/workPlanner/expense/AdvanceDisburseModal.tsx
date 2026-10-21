"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, DollarSign, CreditCard, Building2, FileText, AlertTriangle, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { useDisburseTourAdvanceMutation } from "@/store/api/workPlannerApiSlice";
import { formatCurrency, formatPlanDate } from "../workPlanUtils";
import { ExpenseAttachmentUploader } from "./ExpenseAttachmentUploader";
import { FilePreviewModal, useFilePreview } from "../FilePreviewModal";
import type { WorkPlanTourAdvanceRecord, ExpenseAttachmentItem } from "@/types/workPlanner";

interface AdvanceDisburseModalProps {
  advance: WorkPlanTourAdvanceRecord | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sessionToken?: string | null;
}

export function AdvanceDisburseModal({ advance, open, onClose, onSuccess, sessionToken }: AdvanceDisburseModalProps) {
  const [disburseTourAdvance, { isLoading }] = useDisburseTourAdvanceMutation();
  const [disbursedAmount, setDisbursedAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
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

  useEffect(() => {
    if (advance) {
      setDisbursedAmount(String(advance.amount || ""));
      setPaymentMethod("bank_transfer");
      setTransactionRef("");
      setBankName("");
      setNotes("");
      setAttachments([]);
    }
  }, [advance]);

  if (!open || !advance) return null;

  const salesUserName =
    typeof advance.sales_user === "object" && advance.sales_user
      ? advance.sales_user.name
      : "Executive";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = parseFloat(disbursedAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid disbursement amount greater than 0");
      return;
    }

    try {
      const advId = advance?._id || advance?.id || "";
      await disburseTourAdvance({
        advanceId: advId,
        disbursed_amount: numAmount,
        payment_method: paymentMethod,
        transaction_reference: transactionRef.trim() || undefined,
        bank_name: bankName.trim() || undefined,
        disbursement_notes: notes.trim() || undefined,
        attachments: attachments.map((a) => a.attachment_id || a._id).filter(Boolean) as string[],
        attachment_details: attachments,
        disbursement_attachments: attachments.map((a) => a.attachment_id || a._id).filter(Boolean) as string[],
        disbursement_attachment_details: attachments,
      }).unwrap();

      toast.success(`Advance disbursed successfully for ${salesUserName}`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to disburse advance";
      toast.error(msg);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-emerald-500/10">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-emerald-600 p-2 text-white">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Disburse Tour Advance</h2>
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
              <span className="text-muted">Requested Amount:</span>{" "}
              <span className="font-bold text-foreground">{formatCurrency(advance.amount)}</span>
            </div>
            <div>
              <span className="text-muted">Request Date:</span>{" "}
              <span className="font-medium text-foreground">{formatPlanDate(advance.request_date)}</span>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Disbursed Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-muted">₹</span>
                <input
                  type="number"
                  step="any"
                  required
                  min="1"
                  value={disbursedAmount}
                  onChange={(e) => setDisbursedAmount(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted pl-8 pr-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-primary transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Payment Mode <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition"
                >
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="upi">UPI / QR</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Company Cash</option>
                  <option value="company_card">Company Corporate Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  UTR / Reference No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR12345678"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground outline-none focus:border-primary transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Bank / Payer Account Name
              </label>
              <input
                type="text"
                placeholder="e.g. HDFC Bank - Main Corporate A/c"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground outline-none focus:border-primary transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Disbursement Notes / Audit Remarks
              </label>
              <textarea
                rows={2}
                placeholder="Any payment or authorization notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted p-3 text-xs text-foreground outline-none focus:border-primary transition resize-none"
              />
            </div>

            {/* Payment Proof / Voucher Upload */}
            <div className="rounded-xl border border-border bg-surface-muted/30 p-3">
              <ExpenseAttachmentUploader
                label="Payment Proof / Bank Receipt / Transfer Screenshot"
                attachments={attachments}
                onChange={setAttachments}
                onPreview={openPreview}
                resourceType="tour_advance_disbursement"
                resourceId={advance._id || advance.id}
              />
            </div>

            {/* Maker-checker notice */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-start gap-2 text-xs text-muted">
              <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Disbursement will record an active advance balance in the executive&apos;s ledger, available for deduction during expense claim settlement.
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{isLoading ? "Disbursing..." : "Confirm Disbursement"}</span>
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
