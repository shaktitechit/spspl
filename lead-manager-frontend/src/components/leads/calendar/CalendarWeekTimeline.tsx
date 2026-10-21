/**
 * @fileoverview Interactive Weekly Timeline View for Follow-ups (Leads & Quotations).
 * @module components/leads/calendar/CalendarWeekTimeline
 */
"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  MessageSquare,
  MapPin,
  Tv,
  Users,
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import type { LeadFollowUpRecord } from "@/store/api";
import { formatLeadDate } from "../leadUtils";

export type CalendarWeekTimelineProps = {
  followUps: LeadFollowUpRecord[];
  currentDate: Date;
  onDateChange: (newDate: Date) => void;
  onSelectEvent: (fu: LeadFollowUpRecord) => void;
  hasQuotationAccess: boolean;
};

export function CalendarWeekTimeline({
  followUps,
  currentDate,
  onDateChange,
  onSelectEvent,
  hasQuotationAccess,
}: CalendarWeekTimelineProps) {
  const todayStr = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split("T")[0];
  }, []);

  // Compute 7 days of the current week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const dateStr = dayDate.toISOString().split("T")[0];
      days.push({
        date: dayDate,
        dateStr,
        dayName: dayDate.toLocaleDateString("en-US", { weekday: "short" }),
        dayNumber: dayDate.getDate(),
        monthShort: dayDate.toLocaleDateString("en-US", { month: "short" }),
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [currentDate, todayStr]);

  // Index follow-ups by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, LeadFollowUpRecord[]> = {};
    followUps.forEach((fu) => {
      if (!fu.follow_up_date) return;
      const dateKey = fu.follow_up_date.split("T")[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(fu);
    });
    return map;
  }, [followUps]);

  const handlePrevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    onDateChange(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    onDateChange(next);
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-3 w-3 shrink-0" />;
      case "meeting":
        return <Users className="h-3 w-3 shrink-0" />;
      case "whatsapp":
        return <MessageSquare className="h-3 w-3 shrink-0" />;
      case "email":
        return <Mail className="h-3 w-3 shrink-0" />;
      case "visit":
        return <MapPin className="h-3 w-3 shrink-0" />;
      case "demo":
        return <Tv className="h-3 w-3 shrink-0" />;
      default:
        return <HelpCircle className="h-3 w-3 shrink-0" />;
    }
  };

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) return "";
    const first = weekDays[0];
    const last = weekDays[6];
    return `${first.monthShort} ${first.dayNumber} – ${last.monthShort} ${last.dayNumber}, ${last.date.getFullYear()}`;
  }, [weekDays]);

  return (
    <div className="space-y-4">
      {/* Week Navigation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevWeek}
              className="rounded-xl border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Previous Week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              className="rounded-xl border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Next Week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {weekRangeLabel}
          </h2>

          <button
            type="button"
            onClick={handleToday}
            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Today
          </button>
        </div>
      </div>

      {/* Week Grid (7 columns) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {weekDays.map((day) => {
          const events = eventsByDate[day.dateStr] || [];
          const overdueEvents = events.filter(
            (e) => e.status !== "completed" && day.dateStr < todayStr
          );
          const completedEvents = events.filter((e) => e.status === "completed");

          return (
            <div
              key={day.dateStr}
              className={`flex flex-col rounded-2xl border p-3.5 shadow-xs transition ${
                day.isToday
                  ? "border-teal-500/40 bg-teal-50/20 dark:border-teal-500/30 dark:bg-teal-950/20"
                  : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900"
              }`}
            >
              {/* Day Header */}
              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/5">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {day.dayName}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-lg font-extrabold ${
                        day.isToday
                          ? "text-teal-600 dark:text-teal-400"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {day.dayNumber}
                    </span>
                    <span className="text-[11px] text-slate-400">{day.monthShort}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {day.isToday && (
                    <span className="rounded-full bg-teal-100 px-1.5 py-0.2 text-[9px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                      TODAY
                    </span>
                  )}
                  <span className="text-[10px] font-semibold text-slate-400">
                    {events.length} task{events.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {/* Day Events Stack */}
              <div className="flex-1 space-y-2 overflow-y-auto max-h-[420px]">
                {events.length === 0 ? (
                  <div className="py-8 text-center text-[11px] text-slate-300 dark:text-slate-600">
                    No scheduled tasks
                  </div>
                ) : (
                  events.map((ev) => {
                    const leadObj = typeof ev.lead === "object" && ev.lead !== null ? ev.lead : null;
                    const quoteObj = typeof ev.quotation === "object" && ev.quotation !== null ? ev.quotation : null;
                    const isQuotation = Boolean(quoteObj);
                    const isDone = ev.status === "completed";
                    const isOverdue = !isDone && day.dateStr < todayStr;
                    const isDueToday = !isDone && day.dateStr === todayStr;

                    const contactName =
                      (isQuotation ? quoteObj?.customer_name : leadObj?.name) || "Customer";
                    const company =
                      (isQuotation ? quoteObj?.customer_name : leadObj?.company_name) || "";
                    const refNo = isQuotation ? quoteObj?.quotation_no : leadObj?.lead_no;

                    return (
                      <div
                        key={ev._id}
                        onClick={() => onSelectEvent(ev)}
                        className={`cursor-pointer rounded-xl border p-2.5 text-xs transition hover:shadow-sm ${
                          isDone
                            ? "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                            : isOverdue
                            ? "border-rose-200 bg-rose-50/50 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20"
                            : isDueToday
                            ? "border-amber-200 bg-amber-50/50 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                            : isQuotation && hasQuotationAccess
                            ? "border-purple-200 bg-purple-50/50 hover:bg-purple-50 dark:border-purple-900/40 dark:bg-purple-950/20"
                            : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/60 dark:border-white/5 dark:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                            {getChannelIcon(ev.type)}
                            <span className="capitalize text-[11px]">{ev.type}</span>
                          </div>

                          {ev.follow_up_time && ev.follow_up_time !== "—" && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {ev.follow_up_time}
                            </span>
                          )}
                        </div>

                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {contactName}
                        </p>
                        {company && (
                          <p className="text-[10px] text-slate-400 truncate">{company}</p>
                        )}

                        {refNo && (
                          <div className="mt-1 flex items-center justify-between text-[10px]">
                            <span className="font-mono font-bold text-primary">{refNo}</span>
                            {hasQuotationAccess && isQuotation && (
                              <span className="rounded-xs bg-purple-100 px-1 text-[8px] font-black uppercase text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                                Quote
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
