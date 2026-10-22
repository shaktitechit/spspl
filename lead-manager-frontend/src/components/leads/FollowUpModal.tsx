/**
 * @fileoverview Slide-Over Drawer to schedule a follow-up for a lead.
 * @module components/leads/FollowUpModal
 */
"use client";

import React, { useState } from "react";
import {
  CalendarClock,
  Calendar,
  Clock,
  Phone,
  Video,
  Mail,
  MessageCircle,
  MapPin,
  Check,
  AlertTriangle,
} from "lucide-react";
import {
  useCreateLeadFollowUpMutation,
  type LeadRecord,
  type LeadFollowUpType,
} from "@/store/api";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { FOLLOWUP_TYPE_CONFIG, canScheduleFollowUp } from "./leadUtils";
import { SlideOverDrawer } from "@/components/portal/shared/SlideOverDrawer";

type Props = {
  lead: LeadRecord;
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

export function FollowUpModal({ lead, open, onClose, onSuccess }: Props) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  const [date, setDate] = useState<string>(defaultDate);
  const [time, setTime] = useState<string>("11:00");
  const [type, setType] = useState<LeadFollowUpType>("call");
  const [notes, setNotes] = useState<string>("");

  const [createFollowUp, { isLoading }] = useCreateLeadFollowUpMutation();

  if (!open) return null;

  if (lead && !canScheduleFollowUp(lead.status)) {
    return (
      <SlideOverDrawer
        open={open}
        onClose={onClose}
        title="Follow-up Unavailable"
        subtitle={`Lead #${lead.lead_no} • Status: ${lead.status.toUpperCase()}`}
        icon={AlertTriangle}
        size="md"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover transition cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200">
          Follow-ups cannot be scheduled for closed leads (Status:{" "}
          <strong className="uppercase">{lead.status}</strong>).
        </div>
      </SlideOverDrawer>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast.error("Please select a follow-up date");
      return;
    }

    try {
      await createFollowUp({
        leadId: lead._id,
        follow_up_date: date,
        follow_up_time: time || undefined,
        type,
        notes: notes.trim() || undefined,
      }).unwrap();

      toast.success("Follow-up scheduled successfully");
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
        disabled={isLoading || !date}
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-hover transition cursor-pointer disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        <span>{isLoading ? "Scheduling..." : "Schedule Follow-up"}</span>
      </button>
    </div>
  );

  return (
    <SlideOverDrawer
      open={open}
      onClose={onClose}
      title="Schedule Follow-up"
      subtitle={`Lead #${lead.lead_no} • ${lead.name}`}
      icon={CalendarClock}
      footer={footerActions}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Follow-up Channel / Type */}
        <div>
          <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
            Follow-up Channel / Method
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TYPES.map((t) => {
              const isSelected = type === t;
              const cfg = FOLLOWUP_TYPE_CONFIG[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-xl border p-2.5 text-xs font-bold transition cursor-pointer text-center ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary shadow-2xs ring-1 ring-primary/30"
                      : "border-border bg-card text-foreground hover:bg-surface-muted"
                  }`}
                >
                  {cfg?.label || t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              Scheduled Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              Time <span className="text-muted text-[10px] font-normal">(Optional)</span>
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none transition"
            />
          </div>
        </div>

        {/* Agenda / Notes */}
        <div>
          <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
            Agenda / Discussion Points <span className="text-muted text-[10px] font-normal">(Optional)</span>
          </label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Key discussion topics, proposal review, demo arrangement, questions to ask..."
            className="w-full rounded-xl border border-border bg-surface-muted/50 p-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none transition"
          />
        </div>
      </form>
    </SlideOverDrawer>
  );
}
