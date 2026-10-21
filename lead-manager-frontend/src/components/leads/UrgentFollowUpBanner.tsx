/**
 * @fileoverview Sticky Unskippable Urgent Follow-Up Alert Banner for Lead Manager.
 * @module components/leads/UrgentFollowUpBanner
 */
"use client";

import React, { useState } from "react";
import { AlertTriangle, Clock, Calendar, ChevronRight, FileText, Sparkles } from "lucide-react";
import { useGetUrgentFollowUpsSummaryQuery } from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { isLeadAdmin, isLeadManagerRole } from "./leadUtils";
import { UrgentFollowUpAgendaModal } from "./UrgentFollowUpAgendaModal";

type Props = {
  portalHome?: string;
};

export function UrgentFollowUpBanner({ portalHome = "/lead_manager" }: Props) {
  const authUser = useAppSelector((state) => state.auth.user);
  const isAdmin = isLeadAdmin(authUser, portalHome);
  const isManager = isLeadManagerRole(authUser, portalHome);

  const { data: summary } = useGetUrgentFollowUpsSummaryQuery(undefined, {
    pollingInterval: 30000,
  });

  const [modalOpen, setModalOpen] = useState(false);

  if (!summary || (summary.overdue_count === 0 && summary.today_count === 0)) {
    return null;
  }

  const hasOverdue = summary.overdue_count > 0;
  const isQuoteFocus = (isManager || isAdmin) && summary.quote_count > 0;

  return (
    <>
      <div
        className={`w-full px-4 py-2.5 transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${
          hasOverdue
            ? "bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 text-white shadow-sm"
            : "bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shadow-sm"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                hasOverdue ? "bg-white text-rose-700 animate-pulse" : "bg-white/20 text-white"
              }`}
            >
              {hasOverdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            </span>

            <div className="text-xs font-medium">
              <span className="font-extrabold uppercase tracking-wide">
                {hasOverdue ? "Action Required: " : "Daily Agenda: "}
              </span>
              <span>
                {hasOverdue
                  ? `${summary.overdue_count} overdue follow-up${summary.overdue_count > 1 ? "s" : ""}`
                  : `${summary.today_count} follow-up${summary.today_count > 1 ? "s" : ""} scheduled today`}
              </span>
              {isQuoteFocus && (
                <span className="ml-1.5 rounded-md bg-white/20 px-1.5 py-0.2 text-[11px] font-bold">
                  {summary.quote_count} Quotation{summary.quote_count > 1 ? "s" : ""}
                </span>
              )}
              {summary.lead_count > 0 && isQuoteFocus && (
                <span className="ml-1 opacity-90">• {summary.lead_count} Leads</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1 text-xs font-extrabold text-slate-900 shadow-xs hover:bg-slate-100 transition cursor-pointer"
            >
              <span>Review Agenda</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <UrgentFollowUpAgendaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        portalHome={portalHome}
      />
    </>
  );
}
