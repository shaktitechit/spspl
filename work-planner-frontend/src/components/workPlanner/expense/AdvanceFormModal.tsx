"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Send,
  AlertCircle,
  DollarSign,
  Calendar,
  FileText,
  Paperclip,
  CheckCircle2,
  Users,
  CreditCard,
  Building2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  useRequestTourAdvanceMutation,
  useIssueDirectTourAdvanceMutation,
} from "@/store/api/workPlannerApiSlice";
import { ExpenseAttachmentUploader } from "./ExpenseAttachmentUploader";
import { FilePreviewModal, useFilePreview } from "../FilePreviewModal";
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
  isElevated = false,
  isAdmin = false,
  preselectedUserId,
  initialMode,
  currentUserId,
  currentUserName,
}: AdvanceFormModalProps) {
  const [requestTourAdvance, { isLoading: isRequesting }] = useRequestTourAdvanceMutation();
  const [issueDirectTourAdvance, { isLoading: isIssuing }] = useIssueDirectTourAdvanceMutation();

  const [selectedUserId, setSelectedUserId] = useState<string>(preselectedUserId || "");
  const [isDirectIssue, setIsDirectIssue] = useState<boolean>(
    initialMode ? initialMode === "direct_issue" : false
  );

  const [amount, setAmount] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");
  const [requestDate, setRequestDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [attachments, setAttachments] = useState<ExpenseAttachmentItem[]>([]);

  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  } = useFilePreview(sessionToken);

  // Filter subordinate options (excluding self for direct issue only for non-admin managers)
  const subordinateOptions = React.useMemo(() => {
    if (!currentUserId || isAdmin) return executiveOptions;
    return executiveOptions.filter((opt) => opt.id !== currentUserId);
  }, [executiveOptions, currentUserId, isAdmin]);

  useEffect(() => {
    if (open) {
      const isDirect = initialMode === "direct_issue";
      setIsDirectIssue(isDirect);

      if (preselectedUserId) {
        setSelectedUserId(preselectedUserId);
      } else if (isDirect) {
        const firstSubordinate = subordinateOptions[0]?.id || "";
        setSelectedUserId(firstSubordinate);
      } else {
        setSelectedUserId(currentUserId || executiveOptions[0]?.id || "");
      }

      setAmount("");
      setPurpose("");
      setRequestDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      setPaymentMethod("bank_transfer");
      setTransactionRef("");
      setBankName("");
      setAttachments([]);
    }
  }, [open, preselectedUserId, executiveOptions, subordinateOptions, isElevated, isAdmin, initialMode, currentUserId]);

  if (!open) return null;

  const isSubmitting = isRequesting || isIssuing;

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

    try {
      if (isElevated && isDirectIssue) {
        if (!selectedUserId) {
          toast.error("Please select the team member to issue this advance to");
          return;
        }

        if (!isAdmin && currentUserId && selectedUserId === currentUserId) {
          toast.error("Direct advance cannot be self-issued by managers. Please select a subordinate.");
          return;
        }

        await issueDirectTourAdvance({
          sales_user: selectedUserId,
          amount: numAmount,
          purpose: purpose.trim(),
          request_date: requestDate,
          notes: notes.trim() || undefined,
          payment_method: paymentMethod,
          transaction_reference: transactionRef.trim() || undefined,
          bank_name: bankName.trim() || undefined,
          disbursement_notes: notes.trim() || undefined,
          attachments: attachments.map((a) => a.attachment_id || a._id).filter(Boolean) as string[],
          attachment_details: attachments,
          disbursement_attachments: attachments.map((a) => a.attachment_id || a._id).filter(Boolean) as string[],
          disbursement_attachment_details: attachments,
        }).unwrap();

        toast.success("Tour advance directly issued & disbursed successfully");
      } else {
        const isRequestForOther = isElevated && selectedUserId && selectedUserId !== currentUserId;
        await requestTourAdvance({
          amount: numAmount,
          purpose: purpose.trim(),
          request_date: requestDate,
          notes: notes.trim() || undefined,
          sales_user: isRequestForOther ? selectedUserId : undefined,
          attachments: attachments.map((a) => a.attachment_id || a._id).filter(Boolean) as string[],
          attachment_details: attachments,
        }).unwrap();

        toast.success(
          isRequestForOther
            ? "Tour advance request submitted on behalf of team member"
            : "Tour advance request submitted successfully"
        );
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to process tour advance";
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
              <div
                className={`rounded-xl p-2 ${
                  isElevated && isDirectIssue
                    ? "bg-purple-600/10 text-purple-600 dark:text-purple-400"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {isElevated && isDirectIssue ? <Zap className="h-5 w-5" /> : <DollarSign className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {isElevated && isDirectIssue
                    ? "Direct Issue & Disburse Tour Advance"
                    : isElevated && selectedUserId && selectedUserId !== currentUserId
                    ? "Request Tour Advance on Behalf"
                    : "Request Tour Advance"}
                </h2>
                <p className="text-xs text-muted">
                  {isElevated && isDirectIssue
                    ? "Grant and disburse immediate advance funds into subordinate's ledger"
                    : "Submit advance fund request for upcoming field tours"}
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
            {/* Elevated Workflow Toggle */}
            {isElevated && (
              <div className="rounded-xl border border-border bg-surface-muted/40 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {isDirectIssue
                        ? "Subordinate Beneficiary *"
                        : "Beneficiary (Self or Subordinate) *"}
                    </span>
                  </label>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDirectIssue(true);
                        if (!selectedUserId || selectedUserId === currentUserId) {
                          setSelectedUserId(subordinateOptions[0]?.id || "");
                        }
                      }}
                      className={`rounded-md px-2 py-0.5 font-semibold transition cursor-pointer ${
                        isDirectIssue
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      Direct Disburse
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDirectIssue(false)}
                      className={`rounded-md px-2 py-0.5 font-semibold transition cursor-pointer ${
                        !isDirectIssue
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      Request Advance
                    </button>
                  </div>
                </div>

                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary transition"
                >
                  <option value="" disabled>
                    {isDirectIssue
                      ? "Select Subordinate Team Member..."
                      : "Select Team Member or Myself..."}
                  </option>
                  {isDirectIssue ? (
                    subordinateOptions.length === 0 ? (
                      <option value="" disabled>
                        No subordinates assigned in reporting team
                      </option>
                    ) : (
                      subordinateOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))
                    )
                  ) : (
                    executiveOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.id === currentUserId ? `${opt.name} (Myself)` : opt.name}
                      </option>
                    ))
                  )}
                </select>

                {isDirectIssue && (
                  <p className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                    ⚡ This will instantly credit the advance to the subordinate and record it as disbursed.
                  </p>
                )}
              </div>
            )}

            {/* Amount & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Advance Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-muted">₹</span>
                  <input
                    type="number"
                    step="any"
                    required
                    min="1"
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-muted pl-8 pr-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {isElevated && isDirectIssue ? "Disbursement Date" : "Tour / Request Date"}{" "}
                  <span className="text-rose-500">*</span>
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
                placeholder="e.g. 4-day hospital tour across Indore & Bhopal"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground outline-none focus:border-primary transition"
              />
            </div>

            {/* Direct Disbursement Payment Fields */}
            {isElevated && isDirectIssue && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5 space-y-3">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300 block">
                  Disbursement Payment Details:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">
                      Payment Mode <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
                    >
                      <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                      <option value="upi">UPI / Online Transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="cash">Company Cash</option>
                      <option value="company_card">Company Corporate Card</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">
                      UTR / Transaction Ref No.
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UTR12345678"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">
                    Bank / Account Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Main Corporate Account"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            {/* Remarks / Notes */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {isElevated && isDirectIssue ? "Disbursement Notes / Remarks" : "Additional Notes / Justification"}
              </label>
              <textarea
                rows={2}
                placeholder="Any payment references, tour itinerary details, or instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted p-3 text-xs text-foreground outline-none focus:border-primary transition resize-none"
              />
            </div>

            {/* Attachments Section */}
            <div className="rounded-xl border border-border bg-surface-muted/30 p-3">
              <ExpenseAttachmentUploader
                label={
                  isElevated && isDirectIssue
                    ? "Payment Proof / Transfer Slip / Itinerary"
                    : "Supporting Documents (Tour Plan, Quotations, Tickets)"
                }
                attachments={attachments}
                onChange={setAttachments}
                onPreview={openPreview}
                resourceType="tour_advance"
              />
            </div>

            <div className="rounded-xl border border-border bg-surface-muted/60 p-3 flex items-start gap-2 text-xs text-muted">
              <AlertCircle className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <span>
                {isElevated && isDirectIssue
                  ? "This will immediately credit the advance to the executive's ledger and record active in-hand balance."
                  : "Advance requests will be sent to your Reporting Manager and Finance team for verification and disbursement."}
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
                disabled={isSubmitting}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 active:scale-95 transition shadow-xs cursor-pointer ${
                  isElevated && isDirectIssue ? "bg-purple-600 hover:bg-purple-700" : "bg-primary hover:bg-primary/90"
                }`}
              >
                {isElevated && isDirectIssue ? <Zap className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                <span>
                  {isSubmitting
                    ? "Processing..."
                    : isElevated && isDirectIssue
                    ? "Issue & Disburse Now"
                    : "Submit Request"}
                </span>
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
