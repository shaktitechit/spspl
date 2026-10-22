"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
} from "lucide-react";
import { useGetUrgentFollowUpsSummaryQuery } from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { isLeadAdmin, isLeadManagerRole } from "./leadUtils";
import { UrgentFollowUpAgendaModal } from "./UrgentFollowUpAgendaModal";

type Props = {
  portalHome?: string;
};

export function UrgentFollowUpBanner({ portalHome = "/dashboard" }: Props) {
  const authUser = useAppSelector((state) => state.auth.user);
  const isAdmin = isLeadAdmin(authUser, portalHome);
  const isManager = isLeadManagerRole(authUser, portalHome);

  const { data: summary } = useGetUrgentFollowUpsSummaryQuery(undefined, {
    pollingInterval: 30000,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!summary || (summary.overdue_count === 0 && summary.today_count === 0)) {
    return null;
  }

  const hasOverdue = summary.overdue_count > 0;
  const isQuoteFocus = (isManager || isAdmin) && summary.quote_count > 0;

  // Floating Minimized Floating Pill at Bottom-Right
  if (isMinimized) {
    return (
      <>
        <div className="fixed bottom-5 right-5 z-40 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div
            className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 shadow-2xl border transition-all hover:scale-105 ${
              hasOverdue
                ? "bg-rose-950/90 text-white border-rose-500/40 backdrop-blur-md"
                : "bg-slate-900/90 text-white border-primary/40 backdrop-blur-md"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                hasOverdue ? "bg-rose-500 text-white animate-pulse" : "bg-primary text-white"
              }`}
            >
              {hasOverdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            </span>

            <span className="text-xs font-semibold">
              {hasOverdue ? `${summary.overdue_count} Overdue` : `${summary.today_count} Scheduled Today`}
            </span>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              Agenda
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="text-white/60 hover:text-white p-1 ml-1"
              title="Expand banner"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
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

  return (
    <>
      <div
        className={`w-full px-4 py-2 transition-all animate-in fade-in slide-in-from-top-1 duration-200 border-b ${
          hasOverdue
            ? "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
            : "bg-primary/10 border-primary/20 text-primary dark:text-primary-hover"
        }`}
      >
        <div className="mx-auto flex max-w-[1720px] items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                hasOverdue
                  ? "bg-rose-500 text-white animate-pulse"
                  : "bg-primary text-white"
              }`}
            >
              {hasOverdue ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
            </span>

            <div className="text-xs">
              <span className="font-extrabold uppercase tracking-wide mr-1.5">
                {hasOverdue ? "Action Required:" : "Daily Agenda:"}
              </span>
              <span className="font-medium text-foreground">
                {hasOverdue
                  ? `${summary.overdue_count} overdue follow-up${summary.overdue_count > 1 ? "s" : ""}`
                  : `${summary.today_count} follow-up${summary.today_count > 1 ? "s" : ""} scheduled today`}
              </span>
              {isQuoteFocus && (
                <span className="ml-2 rounded-md bg-surface-muted border border-border px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                  {summary.quote_count} Quotation{summary.quote_count > 1 ? "s" : ""}
                </span>
              )}
              {summary.lead_count > 0 && isQuoteFocus && (
                <span className="ml-1.5 text-muted text-[11px]">• {summary.lead_count} Leads</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-primary-hover transition cursor-pointer"
            >
              <span>Review Agenda</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              title="Minimize to floating widget"
              aria-label="Minimize follow-up alert"
            >
              <ChevronDown className="h-4 w-4" />
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
