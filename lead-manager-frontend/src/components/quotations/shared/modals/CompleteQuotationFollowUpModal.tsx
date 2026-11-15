/**
 * @fileoverview Modal to complete a quotation follow-up and optionally schedule the next one.
 * @module components/quotations/CompleteQuotationFollowUpModal
 */
"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  Calendar,
  Clock,
  MessageSquare,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  useCompleteQuotationFollowUpMutation,
  type LeadQuotationFollowUp,
  type LeadQuotationRecord,
} from "@/store/api";

type Props = {
  followUp: LeadQuotationFollowUp | null;
  quotation: LeadQuotationRecord;
  open: boolean;
  onClose: () => void;
};

const QUICK_OUTCOMES = [
  "Client agreed to proposal terms, awaiting PO.",
  "Client requested discount revision on bulk order.",
  "Technical review in progress, follow up next week.",
  "Budget under management approval, decision in 3-4 days.",
  "Client requested product demonstration / sample test.",
  "Competitor quotation received, negotiating price match.",
];

export function CompleteQuotationFollowUpModal({
  followUp,
  quotation,
  open,
  onClose,
}: Props) {
  const [completeFollowUp, { isLoading }] = useCompleteQuotationFollowUpMutation();

  const [outcome, setOutcome] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 3);
  const defaultNextDate = nextWeek.toISOString().split("T")[0];

  const [nextDate, setNextDate] = useState(defaultNextDate);
  const [nextTime, setNextTime] = useState("11:00");
  const [nextType, setNextType] = useState<"call" | "meeting" | "email" | "whatsapp" | "visit" | "demo" | "other">("call");
  const [nextNotes, setNextNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!open || !followUp) return null;

  const leadId = typeof quotation.lead === "object" && quotation.lead !== null ? quotation.lead._id : (quotation.lead || undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcome.trim()) {
      setErrorMsg("Please enter the outcome of this follow-up discussion.");
      return;
    }

    try {
      setErrorMsg("");
      await completeFollowUp({
        followUpId: followUp._id,
        quotationId: quotation._id,
        leadId,
        data: {
          outcome: outcome.trim(),
          ...(scheduleNext && nextDate
            ? {
                next_follow_up_date: nextDate,
                next_follow_up_time: nextTime,
                next_type: nextType,
                next_notes: nextNotes,
              }
            : {}),
        },
      }).unwrap();

      onClose();
    } catch (err: any) {
      setErrorMsg(err?.data?.message || err?.message || "Failed to complete follow-up.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Log Follow-Up Outcome
              </h3>
              <p className="text-xs text-slate-500">
                {followUp.type.toUpperCase()} • Scheduled for {new Date(followUp.follow_up_date).toLocaleDateString("en-IN")}
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

        {/* Planned Notes reference */}
        {followUp.notes && (
          <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-100 dark:border-white/5">
            <span className="font-bold text-slate-800 dark:text-slate-200">Original Agenda:</span> {followUp.notes}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick suggestions */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Quick Outcome Suggestions:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_OUTCOMES.map((txt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setOutcome(txt)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer text-left"
                >
                  {txt}
                </button>
              ))}
            </div>
          </div>

          {/* Outcome Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-slate-400" /> Discussion Outcome &amp; Next Action *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Detail what the client said, any objections raised, pricing feedback, next expected steps..."
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white resize-none"
            />
          </div>

          {/* Toggle Schedule Next (Only if quotation not yet converted) */}
          {quotation.status !== "converted" ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-800/40 space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={scheduleNext}
                  onChange={(e) => setScheduleNext(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary accent-primary"
                />
                Schedule Next Follow-Up Now
              </label>

              {scheduleNext && (
                <div className="pt-2 space-y-3 border-t border-slate-200 dark:border-white/10 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Next Date *
                      </label>
                      <input
                        type="date"
                        required={scheduleNext}
                        value={nextDate}
                        onChange={(e) => setNextDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-xs focus:border-primary focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        value={nextTime}
                        onChange={(e) => setNextTime(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-xs focus:border-primary focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Channel
                      </label>
                      <select
                        value={nextType}
                        onChange={(e) => setNextType(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-xs focus:border-primary focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="call">Phone Call</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Email</option>
                        <option value="meeting">Meeting</option>
                        <option value="visit">Client Visit</option>
                        <option value="demo">Demo / Presentation</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Next Agenda / Note
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Check PO status"
                        value={nextNotes}
                        onChange={(e) => setNextNotes(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <strong>Quotation Converted to Order:</strong> Logging these remarks will complete and close this follow-up record.
              </span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
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
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Complete Follow-Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
