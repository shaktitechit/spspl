/**
 * @fileoverview Slide-Over Drawer to record outcome and complete a scheduled follow-up.
 * @module components/leads/CompleteFollowUpModal
 */
"use client";

import React, { useState } from "react";
import { CheckCircle, Calendar, Clock, MessageSquare, Check } from "lucide-react";
import {
  useCompleteLeadFollowUpMutation,
  type LeadFollowUpRecord,
  type LeadFollowUpType,
} from "@/store/api";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { SlideOverDrawer } from "@/components/portal/shared/SlideOverDrawer";

type Props = {
  followUp: LeadFollowUpRecord;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const TYPES: LeadFollowUpType[] = [
  "call",
  "meeting",
  "email",
  "whatsapp",
  "visit",
  "demo",
  "other",
];

export function CompleteFollowUpModal({ followUp, open, onClose, onSuccess }: Props) {
  const [outcome, setOutcome] = useState<string>("");
  const [scheduleNext, setScheduleNext] = useState<boolean>(false);
  const [nextDate, setNextDate] = useState<string>("");
  const [nextTime, setNextTime] = useState<string>("11:00");
  const [nextType, setNextType] = useState<LeadFollowUpType>(followUp.type || "call");
  const [nextNotes, setNextNotes] = useState<string>("");

  const [completeFollowUp, { isLoading }] = useCompleteLeadFollowUpMutation();

  if (!open) return null;

  const leadId =
    typeof followUp.lead === "object" && followUp.lead !== null
      ? followUp.lead._id
      : (followUp.lead || undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcome.trim()) {
      toast.error("Please record the follow-up outcome");
      return;
    }
    if (scheduleNext && !nextDate) {
      toast.error("Please select the next follow-up date");
      return;
    }

    try {
      await completeFollowUp({
        followUpId: followUp._id,
        leadId,
        outcome: outcome.trim(),
        next_follow_up_date: scheduleNext && nextDate ? nextDate : undefined,
        next_follow_up_time: scheduleNext && nextTime ? nextTime : undefined,
        next_type: scheduleNext ? nextType : undefined,
        next_notes: scheduleNext && nextNotes.trim() ? nextNotes.trim() : undefined,
      }).unwrap();

      toast.success("Follow-up completed successfully");
      onClose();
      onSuccess?.();
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  };

  const footerActions = (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={isLoading}
        className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition cursor-pointer"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading || !outcome.trim()}
        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        <span>{isLoading ? "Saving..." : "Mark as Completed"}</span>
      </button>
    </div>
  );

  return (
    <SlideOverDrawer
      open={open}
      onClose={onClose}
      title="Complete Follow-Up"
      subtitle={`${(followUp.type || "touchpoint").toUpperCase()} • Scheduled: ${new Date(
        followUp.follow_up_date
      ).toLocaleDateString("en-IN")}`}
      icon={CheckCircle}
      footer={footerActions}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Outcome */}
        <div>
          <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
            Outcome &amp; Customer Response <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={4}
            required
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="Record the summary of conversation, client reactions, objections, decision makers..."
            className="w-full rounded-xl border border-border bg-surface-muted/50 p-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none transition"
          />
        </div>

        {/* Schedule Next Follow-up Option */}
        <div className="rounded-xl border border-border bg-surface-muted/30 p-3.5 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleNext}
              onChange={(e) => setScheduleNext(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span className="text-xs font-bold text-foreground">
              Schedule Next Follow-up in pipeline
            </span>
          </label>

          {scheduleNext && (
            <div className="space-y-3 pt-2 border-t border-border/60 animate-in fade-in duration-150">
              {/* Type */}
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Next Touchpoint Method
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNextType(t)}
                      className={`rounded-lg border py-1.5 px-2 text-center text-xs font-semibold transition cursor-pointer capitalize ${
                        nextType === t
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                          : "border-border bg-card text-foreground hover:bg-surface-muted"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required={scheduleNext}
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={nextTime}
                    onChange={(e) => setNextTime(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Next Agenda Notes
                </label>
                <textarea
                  rows={2}
                  value={nextNotes}
                  onChange={(e) => setNextNotes(e.target.value)}
                  placeholder="Items to follow up on..."
                  className="w-full rounded-xl border border-border bg-card p-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </form>
    </SlideOverDrawer>
  );
}
