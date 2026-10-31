"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  AlertCircle,
  Calendar,
  Users,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useCreateTourAdvanceMutation } from "@/store/api/expenseApiSlice";
import { ExpenseAttachmentUploader } from "@/components/expensePortal/shared/ExpenseAttachmentUploader";
import { FilePreviewModal, useFilePreview } from "@/components/expensePortal/shared/FilePreviewModal";
import type { ExpenseAttachmentItem } from "@/types/workPlanner";

interface AdvanceFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sessionToken?: string | null;
  executiveOptions?: Array<{ id: string; name: string }>;
  isElevated?: boolean;
  isAdmin?: boolean;
  preselectedUserId?: string;
  initialMode?: "request" | "direct_issue";
  currentUserId?: string;
  currentUserName?: string;
}

export function AdvanceFormModal({
  open,
  onClose,
  onSuccess,
  sessionToken,
  executiveOptions = [],
  isAdmin = false,
  preselectedUserId,
  currentUserId,
}: AdvanceFormModalProps) {
  const [createTourAdvance, { isLoading: isSubmitting }] = useCreateTourAdvanceMutation();

  const [selectedUserId, setSelectedUserId] = useState<string>(preselectedUserId || "");
  const [amount, setAmount] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");
  const [requestDate, setRequestDate] = useState<string>(new Date().toISOString().slice(0, 10));
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

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (preselectedUserId) {
        setSelectedUserId(preselectedUserId);
      } else if (currentUserId && executiveOptions.some((opt) => opt.id === currentUserId)) {
        setSelectedUserId(currentUserId);
      } else if (executiveOptions.length > 0) {
        setSelectedUserId(executiveOptions[0].id);
      }

      setAmount("");
      setPurpose("");
      setRequestDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      setAttachments([]);
    }
    prevOpenRef.current = open;
  }, [open, preselectedUserId, currentUserId]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid advance amount greater than 0");
      return;
    }
    if (!purpose.trim()) {
      toast.error("Please provide the purpose of this tour advance");
      return;
    }
    if (!selectedUserId) {
      toast.error("Please select the beneficiary employee for this advance");
      return;
    }

    try {
      await createTourAdvance({
        sales_user: selectedUserId,
        amount: numAmount,
        purpose: purpose.trim(),
        request_date: requestDate,
        notes: notes.trim() || undefined,
        auto_approve: true,
        attachments: attachments.map((a) => a.attachment_id || a._id).filter(Boolean) as string[],
        attachment_details: attachments,
      }).unwrap();

      toast.success(
        `Tour advance of ₹${numAmount.toLocaleString()} sanctioned successfully. Forwarded to Finance for disbursement.`
      );

      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to sanction tour advance";
      toast.error(msg);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-surface-muted/50">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl p-2 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Sanction Tour Advance
                </h2>
                <p className="text-xs text-muted">
                  Directly sanction and approve advance funds for an employee. Finance will disburse the funds.
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
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Beneficiary Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>Beneficiary Employee (Self or Team Member) *</span>
              </label>

              <select
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary transition"
              >
                <option value="" disabled>
                  Select Employee...
                </option>
                {executiveOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.id === currentUserId ? `${opt.name} (Myself)` : opt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Sanctioned Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-muted">₹</span>
                  <input
                    type="number"
                    step="any"
                    required
                    min="1"
                    placeholder="e.g. 10000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-muted pl-8 pr-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Sanction Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
                  <input
                    type="date"
                    required
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition"
                  />
                </div>
              </div>
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Tour Purpose / Destination <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 5-day multi-hospital institutional visit across Chandigarh & Amritsar"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground outline-none focus:border-primary transition"
              />
            </div>

            {/* Remarks / Notes */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Administrative Sanction Notes / Justification
              </label>
              <textarea
                rows={2}
                placeholder="Sanction authorization notes, tour itinerary details, or instructions for Finance..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted p-3 text-xs text-foreground outline-none focus:border-primary transition resize-none"
              />
            </div>

            {/* Attachments Section */}
            <div className="rounded-xl border border-border bg-surface-muted/30 p-3">
              <ExpenseAttachmentUploader
                label="Supporting Documents (Tour Plan, Quotations, Approval Slips)"
                attachments={attachments}
                onChange={setAttachments}
                onPreview={openPreview}
                resourceType="tour_advance"
              />
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-start gap-2 text-xs text-muted">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                This advance will be created directly in <strong>Approved (Sanctioned)</strong> status and queued for Finance disbursement.
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
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition shadow-xs cursor-pointer"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{isSubmitting ? "Sanctioning..." : "Sanction Advance"}</span>
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
