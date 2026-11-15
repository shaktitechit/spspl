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
import { formatLeadDate, getFollowUpRoleBreakdown } from "../leadUtils";

export type CalendarMonthGridProps = {
  followUps: LeadFollowUpRecord[];
  currentDate: Date;
  onDateChange: (newDate: Date) => void;
  onSelectEvent: (fu: LeadFollowUpRecord) => void;
  onDayClick?: (dayStr: string) => void;
  hasQuotationAccess: boolean;
  currentUserId?: string;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarMonthGrid({
  followUps,
  currentDate,
  onDateChange,
  onSelectEvent,
  onDayClick,
  hasQuotationAccess,
  currentUserId,
}: CalendarMonthGridProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const todayStr = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split("T")[0];
  }, []);

  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

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
    setSelectedDateStr(todayStr);
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

  const selectedEvents = eventsByDate[selectedDateStr] || [];

  return (
    <div className="space-y-2.5">
      {/* Month Navigation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-xs dark:border-white/10 dark:bg-slate-900">
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

          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
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

      {/* Calendar + Right Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* Calendar Grid Table */}
        <div className="lg:col-span-8 xl:col-span-9 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900">
          {/* Weekday Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-400">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="py-1.5 border-r border-slate-100 last:border-r-0 dark:border-white/5">
                {wd}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-white/5">
            {calendarCells.map((cell) => {
              const dayEvents = eventsByDate[cell.dateStr] || [];
              const maxVisible = 2;
              const visibleEvents = dayEvents.slice(0, maxVisible);
              const extraCount = dayEvents.length - maxVisible;
              const isSelected = selectedDateStr === cell.dateStr;

              const overdueCount = dayEvents.filter(
                (e) => e.status !== "completed" && cell.dateStr < todayStr
              ).length;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => {
                    setSelectedDateStr(cell.dateStr);
                    onDayClick?.(cell.dateStr);
                  }}
                  className={`group relative min-h-[76px] p-1 transition select-none cursor-pointer ${
                    isSelected
                      ? "ring-2 ring-inset ring-primary/70 bg-primary/[0.04] dark:bg-primary/10"
                      : !cell.isCurrentMonth
                      ? "bg-slate-50/40 text-slate-300 dark:bg-slate-950/20 dark:text-slate-600"
                      : cell.isToday
                      ? "bg-teal-50/20 dark:bg-teal-950/10"
                      : "bg-white hover:bg-slate-50/60 dark:bg-slate-900 dark:hover:bg-white/[0.02]"
                  }`}
                >
                  {/* Date Header Strip */}
                  <div className="mb-0.5 flex items-center justify-between">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold transition ${
                        cell.isToday
                          ? "bg-teal-600 text-white shadow-xs"
                          : isSelected
                          ? "bg-primary text-white shadow-xs"
                          : cell.isCurrentMonth
                          ? "text-slate-800 group-hover:text-slate-950 dark:text-slate-200 dark:group-hover:text-white"
                          : "text-slate-300 dark:text-slate-600"
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    <div className="flex items-center gap-1">
                      {overdueCount > 0 && (
                        <span className="flex h-3.5 items-center rounded-full bg-rose-100 px-1 text-[9px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
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
                      (isQuotation ? quoteObj?.customer_name : leadObj?.company_name) ||
                      (isQuotation ? quoteObj?.kind_attn : leadObj?.name) ||
                      (isQuotation ? quoteObj?.quotation_no : leadObj?.lead_no) ||
                      "Follow-up";
                    const { roles } = getFollowUpRoleBreakdown(ev, currentUserId);
                    const roleLabelText = roles
                      .map((r) => (r === "primary" ? "Primary" : r === "secondary" ? "Secondary" : "Creator"))
                      .join(", ");

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
                        title={`${title} (${ev.type.toUpperCase()})${roleLabelText ? ` [${roleLabelText}]` : ""} - ${ev.notes || "No notes"}`}
                      >
                        {getChannelIcon(ev.type)}
                        {hasQuotationAccess && isQuotation && (
                          <span className="rounded-xs bg-purple-200/60 px-0.5 text-[8px] font-black uppercase text-purple-900 dark:bg-purple-900/60 dark:text-purple-200">
                            Q
                          </span>
                        )}
                        <span className="truncate flex-1">{title}</span>
                        {roles.length > 0 && (
                          <span className="shrink-0 flex items-center gap-0.5">
                            {roles.map((r) => (
                              <span
                                key={r}
                                className={`rounded-xs px-1 text-[8px] font-black uppercase ${
                                  r === "primary"
                                    ? "bg-blue-600 text-white"
                                    : r === "secondary"
                                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200"
                                    : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                                }`}
                              >
                                {r === "primary" ? "P" : r === "secondary" ? "S" : "C"}
                              </span>
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Overflow Trigger */}
                  {extraCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDateStr(cell.dateStr);
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

        {/* Right Side Panel: Selected Day Follow-ups */}
        <aside className="lg:col-span-4 xl:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5 dark:border-white/10">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>{formatLeadDate(selectedDateStr)}</span>
                {selectedDateStr === todayStr && (
                  <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                    Today
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {selectedEvents.length} follow-up{selectedEvents.length === 1 ? "" : "s"} scheduled
              </p>
            </div>
          </div>

          <div className="max-h-[470px] overflow-y-auto p-2.5 space-y-2">
            {selectedEvents.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500">
                No follow-ups scheduled for this date.
              </div>
            ) : (
              selectedEvents.map((ev) => {
                const leadObj = typeof ev.lead === "object" && ev.lead !== null ? ev.lead : null;
                const quoteObj = typeof ev.quotation === "object" && ev.quotation !== null ? ev.quotation : null;
                const isQuotation = Boolean(quoteObj);
                const isDone = ev.status === "completed";
                const isOverdue = !isDone && selectedDateStr < todayStr;

                const contactName = isQuotation ? quoteObj?.customer_name : leadObj?.name;
                const company = isQuotation ? quoteObj?.customer_name : leadObj?.company_name;
                const refNo = isQuotation ? quoteObj?.quotation_no : leadObj?.lead_no;
                const targetLink = isQuotation
                  ? `/dashboard/quotations/${quoteObj?._id || ""}`
                  : `/dashboard/leads/${leadObj?._id || ""}`;
                const { roles } = getFollowUpRoleBreakdown(ev, currentUserId);

                return (
                  <div
                    key={ev._id}
                    className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 text-xs dark:border-white/5 dark:bg-slate-950/40"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1 font-bold text-slate-900 dark:text-white">
                        {getChannelIcon(ev.type)}
                        <span className="capitalize text-[11px]">{ev.type}</span>
                        {ev.follow_up_time && ev.follow_up_time !== "—" && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            · {ev.follow_up_time}
                          </span>
                        )}
                      </div>

                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
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

                    {roles.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {roles.map((r) => (
                          <span
                            key={r}
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              r === "primary"
                                ? "bg-blue-600 text-white"
                                : r === "secondary"
                                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200"
                                : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {r === "primary" ? "Primary" : r === "secondary" ? "Secondary" : "Creator"}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2 text-slate-600 dark:text-slate-300">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {company || contactName}
                        </p>
                        {company && contactName && company !== contactName && (
                          <p className="text-[11px] text-slate-400 truncate">{contactName}</p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {refNo && (
                          <Link
                            href={targetLink}
                            className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-primary hover:underline"
                          >
                            {refNo}
                            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectEvent(ev)}
                          className="rounded-lg bg-teal-600 px-2 py-1 text-[10px] font-bold text-white shadow-xs hover:bg-teal-700 dark:bg-teal-500"
                        >
                          {isDone ? "View" : "Complete"}
                        </button>
                      </div>
                    </div>

                    {ev.notes && (
                      <p className="rounded-md bg-white p-1.5 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300 border border-slate-100 dark:border-white/5 line-clamp-2">
                        {ev.notes}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
