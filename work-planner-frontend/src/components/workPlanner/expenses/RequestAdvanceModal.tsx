"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Wallet,
  Send,
  Calendar,
  AlertCircle,
  FileText,
  Loader2,
  DollarSign,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useRequestTourAdvanceMutation } from "@/store/api/workPlannerApiSlice";
import { ExpenseAttachmentUploader } from "./ExpenseAttachmentUploader";
import { FilePreviewModal, useFilePreview } from "../shared/FilePreviewModal";
import type { ExpenseAttachmentItem } from "@/types/workPlanner";

interface RequestAdvanceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sessionToken?: string | null;
  currentUserId?: string;
  currentUserName?: string;
  currentDepartment?: string;
}

const QUICK_AMOUNTS = [2000, 5000, 10000, 15000, 25000];

export function RequestAdvanceModal({
  open,
  onClose,
  onSuccess,
  sessionToken,
  currentUserName = "Executive",
  currentDepartment = "Operations",
}: RequestAdvanceModalProps) {
  const [requestTourAdvance, { isLoading: isSubmitting }] = useRequestTourAdvanceMutation();

  const [amount, setAmount] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");
  const [requestDate, setRequestDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
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
    if (open) {
      setAmount("");
      setPurpose("");
      setRequestDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      setAttachments([]);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid advance amount greater than ₹0");
      return;
    }
    if (!purpose.trim()) {
      toast.error("Please provide the tour purpose or destination");
      return;
    }

    try {
      const attIds = attachments
        .map((a) => (typeof a === "string" ? a : a.attachment_id || a._id || a.file_id))
        .filter(Boolean) as string[];

      await requestTourAdvance({
        amount: numAmount,
        purpose: purpose.trim(),
        request_date: requestDate,
        notes: notes.trim() || undefined,
        attachments: attIds,
        attachment_details: attachments,
      }).unwrap();

      toast.success(
        `Tour advance request of ₹${numAmount.toLocaleString("en-IN")} submitted successfully.`
      );

      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to submit tour advance request";
      toast.error(msg);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col overflow-hidden text-foreground"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4 bg-surface-muted/40">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-600 dark:text-purple-400">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Request Tour Advance</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted">Requisition for {currentUserName}</span>
                  <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                    {currentDepartment}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            {/* Advance Amount */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                Advance Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-8 pr-4 text-sm font-bold text-foreground placeholder:text-muted/60 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition"
                />
              </div>

              {/* Quick Suggestion Pills */}
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span className="text-[10px] text-muted font-medium">Quick Select:</span>
                {QUICK_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(String(val))}
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer ${
                      amount === String(val)
                        ? "bg-purple-600 text-white shadow-2xs"
                        : "border border-border bg-surface-muted text-foreground hover:bg-surface-muted/80"
                    }`}
                  >
                    ₹{val.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
            </div>

            {/* Tour Purpose */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                Tour Purpose & Destination <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. 3-Day Client Visit to Jaipur, Hotel & Transport"
                required
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition"
              />
            </div>

            {/* Request Date */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                Required Tour / Requisition Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                <input
                  type="date"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-xs text-foreground focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition"
                />
              </div>
            </div>

            {/* Notes / Justification */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                Additional Notes / Estimated Breakdown (Optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details of estimated travel, lodging, meal expenses or client itinerary..."
                className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted/60 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition resize-none"
              />
            </div>

            {/* Attachments */}
            <div>
              <ExpenseAttachmentUploader
                label="Supporting Estimates / Travel Proofs (Optional)"
                attachments={attachments}
                onChange={setAttachments}
                onPreview={openPreview}
                resourceType="tour_advance"
                disabled={isSubmitting}
              />
            </div>

            {/* Informational Notice */}
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-muted/50 p-3 text-[11px] text-muted">
              <Info className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <span>
                Once submitted, this advance request is routed to your Manager & Finance for approval. Upon disbursement, the advance balance will immediately reflect in your passbook.
              </span>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-semibold text-white hover:bg-purple-700 active:scale-95 transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Submitting…</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Submit Advance Request</span>
                  </>
                )}
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

