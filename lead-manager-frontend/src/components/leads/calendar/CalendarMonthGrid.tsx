/**
 * @fileoverview Interactive Monthly Calendar Grid for Follow-ups (Leads & Quotations).
 * @module components/leads/calendar/CalendarMonthGrid
 */
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
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
  Plus,
} from "lucide-react";
import type { LeadFollowUpRecord } from "@/store/api";
import { formatLeadDate, formatCurrencyINR } from "../leadUtils";

export type CalendarMonthGridProps = {
  followUps: LeadFollowUpRecord[];
  currentDate: Date;
  onDateChange: (newDate: Date) => void;
  onSelectEvent: (fu: LeadFollowUpRecord) => void;
  onDayClick?: (dayStr: string) => void;
  hasQuotationAccess: boolean;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarMonthGrid({
  followUps,
  currentDate,
  onDateChange,
  onSelectEvent,
  onDayClick,
  hasQuotationAccess,
}: CalendarMonthGridProps) {
  const [selectedDayEvents, setSelectedDayEvents] = useState<{
    dateStr: string;
    events: LeadFollowUpRecord[];
  } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const todayStr = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split("T")[0];
  }, []);

  // Compute month matrix (7 columns x N weeks)
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday = 0, Sunday = 6
    let startDayIndex = firstDayOfMonth.getDay() - 1;
    if (startDayIndex < 0) startDayIndex = 6;

    const totalDaysInMonth = lastDayOfMonth.getDate();

    // Previous month trailing days
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const cells: Array<{
      date: Date;
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Prepend previous month days
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const d = new Date(year, month - 1, dayNum);
      const dateStr = d.toISOString().split("T")[0];
      cells.push({
        date: d,
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = d.toISOString().split("T")[0];
      cells.push({
        date: d,
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month trailing days to complete full grid (multiples of 7)
    const remaining = 7 - (cells.length % 7);
    if (remaining > 0 && remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i);
        const dateStr = d.toISOString().split("T")[0];
        cells.push({
          date: d,
          dateStr,
          dayNumber: i,
          isCurrentMonth: false,
          isToday: dateStr === todayStr,
        });
      }
    }

    return cells;
  }, [year, month, todayStr]);

  // Index follow-ups by YYYY-MM-DD
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

  const handlePrevMonth = () => {
    onDateChange(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    onDateChange(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-2.5 w-2.5 shrink-0" />;
      case "meeting":
        return <Users className="h-2.5 w-2.5 shrink-0" />;
      case "whatsapp":
        return <MessageSquare className="h-2.5 w-2.5 shrink-0" />;
      case "email":
        return <Mail className="h-2.5 w-2.5 shrink-0" />;
      case "visit":
        return <MapPin className="h-2.5 w-2.5 shrink-0" />;
      case "demo":
        return <Tv className="h-2.5 w-2.5 shrink-0" />;
      default:
        return <HelpCircle className="h-2.5 w-2.5 shrink-0" />;
    }
  };

  const monthLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* Month Navigation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-xl border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded-xl border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {monthLabel}
          </h2>

          <button
            type="button"
            onClick={handleToday}
            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Today
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Overdue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Due Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Completed</span>
          </div>
          {hasQuotationAccess && (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              <span>Quotation</span>
            </div>
          )}
        </div>
      </div>

      {/* Calendar Grid Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900">
        {/* Weekday Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-400">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="py-2.5 border-r border-slate-100 last:border-r-0 dark:border-white/5">
              {wd}
            </div>
          ))}
        </div>

        {/* Day Cells Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-white/5">
          {calendarCells.map((cell) => {
            const dayEvents = eventsByDate[cell.dateStr] || [];
            const maxVisible = 3;
            const visibleEvents = dayEvents.slice(0, maxVisible);
            const extraCount = dayEvents.length - maxVisible;

            const overdueCount = dayEvents.filter(
              (e) => e.status !== "completed" && cell.dateStr < todayStr
            ).length;
            const completedCount = dayEvents.filter((e) => e.status === "completed").length;

            return (
              <div
                key={cell.dateStr}
                onClick={() => onDayClick && onDayClick(cell.dateStr)}
                className={`group relative min-h-[115px] p-1.5 transition select-none ${
                  !cell.isCurrentMonth
                    ? "bg-slate-50/40 text-slate-300 dark:bg-slate-950/20 dark:text-slate-600"
                    : cell.isToday
                    ? "bg-teal-50/20 dark:bg-teal-950/10"
                    : "bg-white hover:bg-slate-50/60 dark:bg-slate-900 dark:hover:bg-white/[0.02]"
                }`}
              >
                {/* Date Header Strip */}
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${
                      cell.isToday
                        ? "bg-teal-600 text-white shadow-xs"
                        : cell.isCurrentMonth
                        ? "text-slate-800 group-hover:text-slate-950 dark:text-slate-200 dark:group-hover:text-white"
                        : "text-slate-300 dark:text-slate-600"
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  <div className="flex items-center gap-1">
                    {overdueCount > 0 && (
                      <span className="flex h-4 items-center rounded-full bg-rose-100 px-1 text-[9px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                        {overdueCount}
                      </span>
                    )}
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-semibold text-slate-400">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Event Chips List */}
                <div className="space-y-1">
                  {visibleEvents.map((ev) => {
                    const leadObj = typeof ev.lead === "object" && ev.lead !== null ? ev.lead : null;
                    const quoteObj = typeof ev.quotation === "object" && ev.quotation !== null ? ev.quotation : null;
                    const isQuotation = Boolean(quoteObj);
                    const isDone = ev.status === "completed";
                    const isOverdue = !isDone && cell.dateStr < todayStr;
                    const isDueToday = !isDone && cell.dateStr === todayStr;

                    const title =
                      (isQuotation ? quoteObj?.customer_name : leadObj?.name) ||
                      (leadObj?.company_name) ||
                      (isQuotation ? quoteObj?.quotation_no : leadObj?.lead_no) ||
                      "Follow-up";

                    return (
                      <button
                        key={ev._id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(ev);
                        }}
                        className={`w-full text-left truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium transition flex items-center gap-1 border shadow-2xs ${
                          isDone
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : isOverdue
                            ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-300"
                            : isDueToday
                            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300"
                            : isQuotation && hasQuotationAccess
                            ? "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800/40 dark:bg-purple-950/30 dark:text-purple-300"
                            : "border-slate-200 bg-slate-50 text-slate-800 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                        }`}
                        title={`${title} (${ev.type.toUpperCase()}) - ${ev.notes || "No notes"}`}
                      >
                        {getChannelIcon(ev.type)}
                        {hasQuotationAccess && isQuotation && (
                          <span className="rounded-xs bg-purple-200/60 px-0.5 text-[8px] font-black uppercase text-purple-900 dark:bg-purple-900/60 dark:text-purple-200">
                            Q
                          </span>
                        )}
                        <span className="truncate flex-1">{title}</span>
                      </button>
                    );
                  })}

                  {/* Overflow Trigger */}
                  {extraCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDayEvents({
                          dateStr: cell.dateStr,
                          events: dayEvents,
                        });
                      }}
                      className="w-full text-left rounded-md bg-slate-100/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      +{extraCount} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Overflow Popover / Modal */}
      {selectedDayEvents && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setSelectedDayEvents(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  Follow-ups for {formatLeadDate(selectedDayEvents.dateStr)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedDayEvents.events.length} touchpoint{selectedDayEvents.events.length === 1 ? "" : "s"} scheduled
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayEvents(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-2.5">
              {selectedDayEvents.events.map((ev) => {
                const leadObj = typeof ev.lead === "object" && ev.lead !== null ? ev.lead : null;
                const quoteObj = typeof ev.quotation === "object" && ev.quotation !== null ? ev.quotation : null;
                const isQuotation = Boolean(quoteObj);
                const isDone = ev.status === "completed";
                const isOverdue = !isDone && selectedDayEvents.dateStr < todayStr;

                const contactName = isQuotation ? quoteObj?.customer_name : leadObj?.name;
                const company = isQuotation ? quoteObj?.customer_name : leadObj?.company_name;
                const refNo = isQuotation ? quoteObj?.quotation_no : leadObj?.lead_no;
                const targetLink = isQuotation
                  ? `/dashboard/quotations/${quoteObj?._id || ""}`
                  : `/dashboard/leads/${leadObj?._id || ""}`;

                return (
                  <div
                    key={ev._id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs dark:border-white/5 dark:bg-slate-950/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                        {getChannelIcon(ev.type)}
                        <span className="capitalize">{ev.type}</span>
                        {ev.follow_up_time && ev.follow_up_time !== "—" && (
                          <span className="text-slate-400 font-normal">
                            at {ev.follow_up_time}
                          </span>
                        )}
                      </div>

                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          isDone
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : isOverdue
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                        }`}
                      >
                        {isDone ? "COMPLETED" : isOverdue ? "OVERDUE" : "PENDING"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {contactName}
                        </p>
                        <p className="text-[11px] text-slate-400">{company}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {refNo && (
                          <Link
                            href={targetLink}
                            className="inline-flex items-center gap-1 font-mono font-bold text-primary hover:underline"
                          >
                            {refNo}
                            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDayEvents(null);
                            onSelectEvent(ev);
                          }}
                          className="rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-teal-700 dark:bg-teal-500"
                        >
                          {isDone ? "View Log" : "Complete"}
                        </button>
                      </div>
                    </div>

                    {ev.notes && (
                      <p className="rounded-md bg-white p-2 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300 border border-slate-100 dark:border-white/5">
                        {ev.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
