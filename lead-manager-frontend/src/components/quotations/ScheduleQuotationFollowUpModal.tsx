/**
 * @fileoverview Modal to schedule a new follow-up directly for a quotation.
 * @module components/quotations/ScheduleQuotationFollowUpModal
 */
"use client";

import React, { useState } from "react";
import {
  X,
  Calendar,
  Clock,
  Phone,
  MessageCircle,
  Mail,
  Users,
  MapPin,
  MonitorPlay,
  FileText,
  Loader2,
} from "lucide-react";
import { useScheduleQuotationFollowUpMutation, type LeadQuotationRecord } from "@/store/api";

type Props = {
  quotation: LeadQuotationRecord;
  open: boolean;
  onClose: () => void;
};

const FOLLOW_UP_TYPES = [
  { id: "call", label: "Phone Call", icon: Phone, color: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-900" },
  { id: "email", label: "Email", icon: Mail, color: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950 dark:border-indigo-900" },
  { id: "meeting", label: "Meeting", icon: Users, color: "text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-900" },
  { id: "visit", label: "Client Visit", icon: MapPin, color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900" },
  { id: "demo", label: "Demo / Presentation", icon: MonitorPlay, color: "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950 dark:border-rose-900" },
  { id: "other", label: "Other", icon: FileText, color: "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700" },
] as const;

export function ScheduleQuotationFollowUpModal({ quotation, open, onClose }: Props) {
  const [scheduleFollowUp, { isLoading }] = useScheduleQuotationFollowUpMutation();

  // Default date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().split("T")[0];

  const [followUpDate, setFollowUpDate] = useState(defaultDateStr);
  const [followUpTime, setFollowUpTime] = useState("11:00");
  const [type, setType] = useState<"call" | "whatsapp" | "email" | "meeting" | "visit" | "demo" | "other">("call");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!open) return null;

  const leadId = typeof quotation.lead === "object" && quotation.lead !== null ? quotation.lead._id : (quotation.lead || undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpDate) {
      setErrorMsg("Please select a valid follow-up date.");
      return;
    }

    try {
      setErrorMsg("");
      await scheduleFollowUp({
        quotationId: quotation._id,
        leadId,
        data: {
          follow_up_date: followUpDate,
          follow_up_time: followUpTime,
          type,
          notes,
        },
      }).unwrap();

      onClose();
    } catch (err: any) {
      setErrorMsg(err?.data?.message || err?.message || "Failed to schedule follow-up. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Schedule Quotation Follow-Up
              </h3>
              <p className="text-xs text-slate-500">
                Quotation #{quotation.quotation_no} • {quotation.customer_name || "Customer"}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Channel / Type Selector Grid */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
              Follow-Up Channel / Type
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {FOLLOW_UP_TYPES.map((t) => {
                const isSelected = type === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl p-2.5 text-xs font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[11px] truncate w-full text-center">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> Date *
              </label>
              <input
                type="date"
                required
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 shadow-xs focus:border-primary focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" /> Time
              </label>
              <input
                type="time"
                value={followUpTime}
                onChange={(e) => setFollowUpTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 shadow-xs focus:border-primary focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Agenda & Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-400" /> Agenda / Planned Discussion Notes
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Discuss 5% bulk discount, check technical scope confirmation, ask about PO issuance timeline..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white resize-none"
            />
          </div>

          {/* Footer Actions */}
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
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary/90 disabled:opacity-50 transition cursor-pointer"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Schedule Follow-Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
