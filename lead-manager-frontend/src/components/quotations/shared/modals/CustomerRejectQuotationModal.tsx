/**
 * @fileoverview Drawer to record customer rejection / lost quotation reason.
 * Upgraded to standard SlideOverDrawer design primitive.
 * @module components/quotations/CustomerRejectQuotationModal
 */
"use client";

import React, { useState } from "react";
import { XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useUpdateLeadQuotationMutation, type LeadQuotationRecord } from "@/store/api";
import { SlideOverDrawer } from "@/components/portal/shared/SlideOverDrawer";

type Props = {
  quotation: LeadQuotationRecord;
  open: boolean;
  onClose: () => void;
};

const LOST_REASONS = [
  "Competitor Selected (Lower Price)",
  "Competitor Selected (Better Specifications / Brand)",
  "Budget Frozen / Project Postponed",
  "Price Too High / No Budget Available",
  "Lead Time / Delivery Schedule Too Long",
  "Client Requirements Changed",
  "Internal Cancellation",
  "Other",
];

export function CustomerRejectQuotationModal({
  quotation,
  open,
  onClose,
}: Props) {
  const [updateQuotation, { isLoading }] = useUpdateLeadQuotationMutation();

  const [selectedReason, setSelectedReason] = useState(LOST_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const leadId =
    typeof quotation.lead === "object" && quotation.lead !== null
      ? quotation.lead._id
      : quotation.lead || undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = notes.trim()
      ? `${selectedReason} - ${notes.trim()}`
      : selectedReason;

    try {
      setErrorMsg("");
      await updateQuotation({
        quotationId: quotation._id,
        leadId,
        body: {
          status: "rejected",
          notes: finalReason,
        },
      }).unwrap();

      onClose();
    } catch (err: any) {
      setErrorMsg(err?.data?.message || err?.message || "Failed to record customer rejection.");
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl px-4 py-2 text-xs font-bold text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-rose-700 disabled:opacity-50 transition cursor-pointer"
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        Confirm Rejection / Lost
      </button>
    </div>
  );

  return (
    <SlideOverDrawer
      open={open}
      onClose={onClose}
      size="md"
      icon={XCircle}
      title="Customer Rejected / Lost Deal"
      subtitle={`Quotation #${quotation.quotation_no}`}
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-foreground mb-1.5">
            Primary Rejection / Lost Reason *
          </label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-medium text-foreground shadow-2xs focus:border-rose-500 focus:outline-hidden"
          >
            {LOST_REASONS.map((r, i) => (
              <option key={i} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-foreground mb-1.5">
            Customer Feedback &amp; Loss Details
          </label>
          <textarea
            rows={4}
            placeholder="e.g. Competitor offered 8% lower price with 1-week lead time, or client postponed capex purchase to next fiscal..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground shadow-2xs focus:border-rose-500 focus:outline-hidden resize-none"
          />
        </div>

        <div className="rounded-2xl bg-amber-50 p-3.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <span>
            Marking this quotation as rejected will update the lifecycle status to <strong>Lost</strong>. You can create a revised quotation later if negotiations resume.
          </span>
        </div>
      </form>
    </SlideOverDrawer>
  );
}
