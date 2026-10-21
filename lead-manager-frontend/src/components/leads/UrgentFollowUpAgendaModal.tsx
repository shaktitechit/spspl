/**
 * @fileoverview Unskippable Urgent Follow-Up Agenda Modal for Leads & Quotations.
 * Role-aware for Executive (Leads), Manager (Leads + Quotations), and Admin (Global).
 * @module components/leads/UrgentFollowUpAgendaModal
 */
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  X,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MessageCircle,
  ExternalLink,
  FileText,
  Building2,
  Search,
  Check,
  RotateCcw,
  Sparkles,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import {
  useGetUrgentFollowUpsSummaryQuery,
  useCompleteLeadFollowUpMutation,
  type LeadFollowUpRecord,
  type LeadFollowUpType,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { isLeadAdmin, isLeadManagerRole, isLeadExecutiveRole } from "./leadUtils";
import { formatCurrencyINR } from "@/components/quotations/quotationUtils";
import { toast } from "@/lib/toast";

type Props = {
  open: boolean;
  onClose: () => void;
  portalHome?: string;
};

export function UrgentFollowUpAgendaModal({
  open,
  onClose,
  portalHome = "/lead_manager",
}: Props) {
  const authUser = useAppSelector((state) => state.auth.user);
  const isAdmin = isLeadAdmin(authUser, portalHome);
  const isManager = isLeadManagerRole(authUser, portalHome);
  const isExecutive = isLeadExecutiveRole(authUser, portalHome);

  const { data: summary, isLoading, refetch } = useGetUrgentFollowUpsSummaryQuery(undefined, {
    skip: !open,
    pollingInterval: 30000,
  });

  const [activeTab, setActiveTab] = useState<"overdue" | "today" | "all">("overdue");
  const [searchQuery, setSearchQuery] = useState("");
  const [completingItem, setCompletingItem] = useState<LeadFollowUpRecord | null>(null);
  const [outcomeText, setOutcomeText] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("11:00");
  const [nextType, setNextType] = useState<LeadFollowUpType>("call");

  const [completeLeadFollowUp, { isLoading: isCompleting }] = useCompleteLeadFollowUpMutation();

  const currentList = useMemo(() => {
    if (!summary) return [];
    let list: LeadFollowUpRecord[] = [];
    if (activeTab === "overdue") list = summary.overdue || [];
    else if (activeTab === "today") list = summary.due_today || [];
    else list = [...(summary.overdue || []), ...(summary.due_today || [])];

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((item) => {
      const leadObj = typeof item.lead === "object" && item.lead !== null ? item.lead : null;
      const quoteObj = typeof item.quotation === "object" && item.quotation !== null ? item.quotation : null;
      const leadNo = leadObj?.lead_no?.toLowerCase() || "";
      const quoteNo = quoteObj?.quotation_no?.toLowerCase() || "";
      const party = (leadObj?.company_name || leadObj?.name || quoteObj?.customer_name || "").toLowerCase();
      const notes = (item.notes || "").toLowerCase();
      return leadNo.includes(q) || quoteNo.includes(q) || party.includes(q) || notes.includes(q);
    });
  }, [summary, activeTab, searchQuery]);

  if (!open) return null;

  const handleStartComplete = (item: LeadFollowUpRecord) => {
    setCompletingItem(item);
    setOutcomeText("");
    setScheduleNext(false);
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    setNextDate(in3Days.toISOString().split("T")[0]);
    setNextTime("11:00");
    setNextType(item.type || "call");
  };

  const handleSaveComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingItem) return;
    if (!outcomeText.trim()) {
      toast.error("Please enter a follow-up outcome note");
      return;
    }

    try {
      const leadId =
        typeof completingItem.lead === "object" && completingItem.lead !== null
          ? completingItem.lead._id
          : typeof completingItem.lead === "string"
          ? completingItem.lead
          : undefined;

      await completeLeadFollowUp({
        followUpId: completingItem._id,
        leadId,
        outcome: outcomeText.trim(),
        next_follow_up_date: scheduleNext && nextDate ? nextDate : undefined,
        next_follow_up_time: scheduleNext && nextTime ? nextTime : undefined,
        next_type: scheduleNext ? nextType : undefined,
      }).unwrap();

      toast.success("Follow-up marked as completed");
      setCompletingItem(null);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to complete follow-up");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-white/5 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Action Required: Follow-Up Agenda
                </h3>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                  {isAdmin ? "Admin Overview" : isManager ? "Manager & Quotations" : "Executive Leads"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Unresolved customer interactions requiring calls, WhatsApp follow-ups, or proposal closing.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Metric Badges Row */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-100/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800 border border-slate-200/60 dark:border-white/5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overdue</div>
                <div className="text-base font-extrabold text-rose-600 dark:text-rose-400">{summary.overdue_count}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800 border border-slate-200/60 dark:border-white/5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Due Today</div>
                <div className="text-base font-extrabold text-blue-600 dark:text-blue-400">{summary.today_count}</div>
              </div>
            </div>

            {(isManager || isAdmin) && (
              <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800 border border-slate-200/60 dark:border-white/5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quotations</div>
                  <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">{summary.quote_count}</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800 border border-slate-200/60 dark:border-white/5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Leads In Scope</div>
                <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{summary.lead_count}</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("overdue")}
              className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                activeTab === "overdue"
                  ? "bg-rose-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              Overdue ({summary?.overdue_count || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("today")}
              className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                activeTab === "today"
                  ? "bg-blue-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              Today ({summary?.today_count || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                activeTab === "all"
                  ? "bg-slate-800 text-white shadow-xs font-bold dark:bg-slate-700"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              All Items ({summary?.total_urgent || 0})
            </button>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, quote #, lead #..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading urgent follow-up agenda...</div>
          ) : currentList.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-2" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">All Caught Up!</h4>
              <p className="text-xs text-slate-400 mt-1">No urgent follow-ups found in this category.</p>
            </div>
          ) : (
            currentList.map((item) => {
              const isQuote = Boolean(item.quotation);
              const quote = typeof item.quotation === "object" && item.quotation !== null ? item.quotation : null;
              const lead = typeof item.lead === "object" && item.lead !== null ? item.lead : null;

              const partyTitle = isQuote
                ? quote?.customer_name || quote?.kind_attn || "Customer"
                : lead?.company_name || lead?.name || "Customer";

              const phone = isQuote
                ? (quote?.phone || (quote as any)?.cell || "")
                : (lead?.phone || (lead as any)?.alternate_phone || lead?.contacts?.[0]?.phone || "");

              const cleanPhone = phone.replace(/[^0-9]/g, "");
              const whatsappLink = cleanPhone
                ? `https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`}?text=${encodeURIComponent(
                    isQuote
                      ? `Hello, following up on our proposal #${quote?.quotation_no} from Shakti Enterprises.`
                      : `Hello, following up on your requirement with Shakti Enterprises.`
                  )}`
                : "";

              const targetUrl = isQuote
                ? `${portalHome}/quotations/${quote?._id}`
                : lead?._id
                ? `${portalHome}/leads/${lead._id}`
                : "#";

              return (
                <div
                  key={item._id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 hover:bg-white hover:shadow-sm dark:border-white/5 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isQuote ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300">
                          <FileText className="h-3 w-3" /> QUOTE #{quote?.quotation_no} {quote?.version ? `v${quote.version}` : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                          <Building2 className="h-3 w-3" /> LEAD #{lead?.lead_no || "—"}
                        </span>
                      )}

                      <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300 uppercase">
                        {item.type}
                      </span>

                      {item.follow_up_time && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          <Clock className="h-3 w-3 text-slate-400" /> {item.follow_up_time}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{partyTitle}</span>
                      {isQuote && quote?.grand_total && (
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                          ({formatCurrencyINR(quote.grand_total)})
                        </span>
                      )}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                        "{item.notes}"
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 transition"
                      >
                        <Phone className="h-3.5 w-3.5" /> Call
                      </a>
                    )}

                    {whatsappLink && (
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 transition"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    )}

                    <Link
                      href={targetUrl}
                      onClick={onClose}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-200/80 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Details
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleStartComplete(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" /> Resolve
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Inline Completion Sub-Modal */}
        {completingItem && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-2xs">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Record Follow-Up Outcome</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setCompletingItem(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveComplete} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Outcome & Discussion Summary <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={outcomeText}
                    onChange={(e) => setOutcomeText(e.target.value)}
                    placeholder="Describe discussion results, client feedback, or next commitments..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    autoFocus
                  />
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-white/5 dark:bg-slate-800/40">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleNext}
                      onChange={(e) => setScheduleNext(e.target.checked)}
                      className="h-4 w-4 rounded text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Schedule Next Follow-Up Immediately
                    </span>
                  </label>

                  {scheduleNext && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Date</label>
                        <input
                          type="date"
                          value={nextDate}
                          onChange={(e) => setNextDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs dark:border-white/10 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Time</label>
                        <input
                          type="time"
                          value={nextTime}
                          onChange={(e) => setNextTime(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs dark:border-white/10 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Type</label>
                        <select
                          value={nextType}
                          onChange={(e) => setNextType(e.target.value as LeadFollowUpType)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs dark:border-white/10 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="call">Call</option>
                          <option value="meeting">Meeting</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="email">Email</option>
                          <option value="visit">Visit</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCompletingItem(null)}
                    className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCompleting || !outcomeText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                  >
                    {isCompleting ? "Saving..." : "Save Outcome"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
