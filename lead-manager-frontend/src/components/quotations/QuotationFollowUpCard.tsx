/**
 * @fileoverview Follow-Up Timeline & Management Card for Quotations.
 * @module components/quotations/QuotationFollowUpCard
 */
"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Phone,
  MessageCircle,
  Mail,
  Users,
  MapPin,
  MonitorPlay,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import {
  useListQuotationFollowUpsQuery,
  type LeadQuotationRecord,
  type LeadQuotationFollowUp,
} from "@/store/api";
import { ScheduleQuotationFollowUpModal } from "./ScheduleQuotationFollowUpModal";
import { CompleteQuotationFollowUpModal } from "./CompleteQuotationFollowUpModal";

type Props = {
  quotation?: LeadQuotationRecord | null;
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  meeting: Users,
  visit: MapPin,
  demo: MonitorPlay,
  other: FileText,
};

const TYPE_COLORS: Record<string, string> = {
  call: "text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300",
  whatsapp: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300",
  email: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-300",
  meeting: "text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-300",
  visit: "text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300",
  demo: "text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300",
  other: "text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-300",
};

export function QuotationFollowUpCard({ quotation }: Props) {
  const quotationId = quotation?._id || "";
  const { data: followUps = [], isLoading } = useListQuotationFollowUpsQuery(quotationId, {
    skip: !quotationId,
  });

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<LeadQuotationFollowUp | null>(null);

  if (!quotation) return null;

  const pendingFollowUps = followUps.filter((f) => f.status === "pending");
  const completedFollowUps = followUps.filter((f) => f.status === "completed");

  const nextPending = pendingFollowUps[0] || null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Follow-Up Activity ({followUps.length})
            </h3>
          </div>
        </div>

        {quotation.status !== "converted" ? (
          <button
            type="button"
            onClick={() => setScheduleModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Schedule Follow-Up
          </button>
        ) : (
          <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Order Converted • Closed
          </span>
        )}
      </div>

      {/* Active Next Pending Follow-Up Banner */}
      {nextPending && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Next Scheduled Follow-Up
              </span>
            </div>
            <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200 uppercase">
              {nextPending.type}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              {new Date(nextPending.follow_up_date).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
            {nextPending.follow_up_time && (
              <div className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                {nextPending.follow_up_time}
              </div>
            )}
          </div>

          {nextPending.notes && (
            <p className="text-xs text-slate-600 dark:text-slate-300 bg-white/70 p-2.5 rounded-xl dark:bg-slate-900/60 border border-blue-100 dark:border-white/5">
              {nextPending.notes}
            </p>
          )}

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => setCompleteTarget(nextPending)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Log Outcome / Close Remarks
            </button>
          </div>
        </div>
      )}

      {/* Follow-up Timeline List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading follow-ups...</div>
        ) : followUps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center dark:border-white/10">
            <Clock className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              No follow-ups scheduled yet
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Keep regular contact with the client to increase quotation conversion rate.
            </p>
            <button
              type="button"
              onClick={() => setScheduleModalOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Schedule First Follow-Up
            </button>
          </div>
        ) : (
          <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {followUps.map((fu) => {
              const isPending = fu.status === "pending";
              const Icon = TYPE_ICONS[fu.type] || FileText;
              const colorClass = TYPE_COLORS[fu.type] || TYPE_COLORS.other;

              return (
                <div key={fu._id} className="relative group">
                  {/* Bullet */}
                  <div
                    className={`absolute -left-4 top-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                      isPending ? "bg-blue-600 ring-2 ring-blue-400/30" : "bg-emerald-600"
                    }`}
                  />

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 dark:border-white/5 dark:bg-slate-800/40 space-y-2 hover:border-slate-300 dark:hover:border-white/10 transition">
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold ${colorClass}`}
                        >
                          <Icon className="h-3 w-3" /> {fu.type.toUpperCase()}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {new Date(fu.follow_up_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        {fu.follow_up_time && (
                          <span className="text-[11px] text-slate-400">@ {fu.follow_up_time}</span>
                        )}
                      </div>

                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          isPending
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {fu.status}
                      </span>
                    </div>

                    {/* Notes / Agenda */}
                    {fu.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {fu.notes}
                      </p>
                    )}

                    {/* Outcome if completed */}
                    {fu.outcome && (
                      <div className="mt-1 rounded-xl bg-emerald-50/80 p-2.5 text-xs text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-200/60 dark:border-emerald-900/40">
                        <span className="font-bold">Outcome:</span> {fu.outcome}
                      </div>
                    )}

                    {/* Action button if pending */}
                    {isPending && (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setCompleteTarget(fu)}
                          className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          Complete &amp; Record Outcome <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <ScheduleQuotationFollowUpModal
        quotation={quotation}
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
      />

      <CompleteQuotationFollowUpModal
        followUp={completeTarget}
        quotation={quotation}
        open={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
      />
    </div>
  );
}
