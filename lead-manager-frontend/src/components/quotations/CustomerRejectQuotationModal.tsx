/**
 * @fileoverview Modal to record customer rejection / lost quotation reason.
 * @module components/quotations/CustomerRejectQuotationModal
 */
"use client";

import React, { useState } from "react";
import { X, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useUpdateLeadQuotationMutation, type LeadQuotationRecord } from "@/store/api";

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

  if (!open) return null;

  const leadId = typeof quotation.lead === "object" && quotation.lead !== null ? quotation.lead._id : (quotation.lead || undefined);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-900/40 dark:bg-slate-900 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Customer Rejected / Lost Deal
              </h3>
              <p className="text-xs text-slate-500">
                Quotation #{quotation.quotation_no}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Primary Rejection / Lost Reason *
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-900 shadow-xs focus:border-rose-500 focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white"
            >
              {LOST_REASONS.map((r, i) => (
                <option key={i} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Customer Feedback &amp; Loss Details
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Competitor offered 8% lower price with 1-week lead time, or client postponed capex purchase to next fiscal..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 shadow-xs focus:border-rose-500 focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white resize-none"
            />
          </div>

          <div className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Marking this quotation as rejected will update the lifecycle status to <strong>Lost</strong>. You can create a revised quotation later if negotiations resume.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-700 disabled:opacity-50 transition cursor-pointer"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Rejection / Lost
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
