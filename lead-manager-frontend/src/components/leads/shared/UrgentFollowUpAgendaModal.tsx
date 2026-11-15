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
import {
  isLeadAdmin,
  isLeadManagerRole,
  isLeadCoordinatorRole,
  isLeadExecutiveRole,
  formatLeadDate,
  splitLeadAssignees,
} from "../leadUtils";
import { formatCurrencyINR } from "@/components/quotations/quotationUtils";
import { toast } from "@/lib/toast";

type Props = {
  open: boolean;
  onClose: () => void;
  portalHome?: string;
  defaultScope?: "organization" | "team" | "mine";
};

export function UrgentFollowUpAgendaModal({
  open,
  onClose,
  portalHome = "/lead_manager",
  defaultScope,
}: Props) {
  const authUser = useAppSelector((state) => state.auth.user);
  const isAdmin = isLeadAdmin(authUser, portalHome);
  const isManager = isLeadManagerRole(authUser, portalHome);
  const isCoordinator = isLeadCoordinatorRole(authUser, portalHome);
  const isExecutive = isLeadExecutiveRole(authUser, portalHome);
  const canSeeTeam = isAdmin || isManager || isCoordinator || !isExecutive;

  const resolvedDefaultScope: "organization" | "team" | "mine" =
    defaultScope ?? (isAdmin ? "organization" : isManager || isCoordinator ? "team" : "mine");
  const [scopeFilter, setScopeFilter] = useState<"organization" | "team" | "mine">(resolvedDefaultScope);

  const { data: summary, isLoading, refetch } = useGetUrgentFollowUpsSummaryQuery(
    { scope: scopeFilter },
    {
      skip: !open,
      pollingInterval: 30000,
    }
  );

  const [activeTab, setActiveTab] = useState<"overdue" | "today" | "all">("overdue");
  const [searchQuery, setSearchQuery] = useState("");
  const [completingItem, setCompletingItem] = useState<LeadFollowUpRecord | null>(null);
  const [outcomeText, setOutcomeText] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("11:00");
  const [nextType, setNextType] = useState<LeadFollowUpType>("call");

  const [completeLeadFollowUp, { isLoading: isCompleting }] = useCompleteLeadFollowUpMutation();

  const leadOverdueList = useMemo(
    () => (summary?.overdue || []).filter((item) => !item.quotation),
    [summary]
  );
  const leadTodayList = useMemo(
    () => (summary?.due_today || []).filter((item) => !item.quotation),
    [summary]
  );

  const currentList = useMemo(() => {
    let list: LeadFollowUpRecord[] = [];
    if (activeTab === "overdue") list = leadOverdueList;
    else if (activeTab === "today") list = leadTodayList;
    else list = [...leadOverdueList, ...leadTodayList];

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((item) => {
      const leadObj = typeof item.lead === "object" && item.lead !== null ? item.lead : null;
      const leadNo = leadObj?.lead_no?.toLowerCase() || "";
      const party = (leadObj?.company_name || leadObj?.name || "").toLowerCase();
      const notes = (item.notes || "").toLowerCase();
      return leadNo.includes(q) || party.includes(q) || notes.includes(q);
    });
  }, [leadOverdueList, leadTodayList, activeTab, searchQuery]);

  const overdueIdSet = useMemo(
    () => new Set(leadOverdueList.map((i) => i._id)),
    [leadOverdueList]
  );

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
    <div className="fixed inset-0 z-50 flex bg-slate-900/70 p-0 backdrop-blur-xs">
      <div className="relative flex h-full w-full flex-col bg-white dark:bg-slate-900 overflow-hidden">
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
                  {isAdmin ? "Admin Overview" : isManager ? "Manager Leads" : "Executive Leads"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Unresolved lead interactions requiring calls, WhatsApp follow-ups, or scheduled updates.
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-100/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800 border border-slate-200/60 dark:border-white/5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overdue</div>
                <div className="text-base font-extrabold text-rose-600 dark:text-rose-400">{leadOverdueList.length}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800 border border-slate-200/60 dark:border-white/5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Due Today</div>
                <div className="text-base font-extrabold text-blue-600 dark:text-blue-400">{leadTodayList.length}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800 border border-slate-200/60 dark:border-white/5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Leads In Scope</div>
                <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{leadOverdueList.length + leadTodayList.length}</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs, Scope & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 dark:border-white/5">
          <div className="flex flex-wrap items-center gap-3">
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
                Overdue ({leadOverdueList.length})
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
                Today ({leadTodayList.length})
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
                All Items ({leadOverdueList.length + leadTodayList.length})
              </button>
            </div>

            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-100 p-1 text-xs font-semibold dark:border-white/10 dark:bg-slate-800/80">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setScopeFilter("organization")}
                  className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                    scopeFilter === "organization"
                      ? "bg-white text-primary shadow-xs font-bold dark:bg-slate-700"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  Organization
                </button>
              )}
              {canSeeTeam && (
                <button
                  type="button"
                  onClick={() => setScopeFilter("team")}
                  className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                    scopeFilter === "team"
                      ? "bg-white text-primary shadow-xs font-bold dark:bg-slate-700"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  Team
                </button>
              )}
              <button
                type="button"
                onClick={() => setScopeFilter("mine")}
                className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                  scopeFilter === "mine"
                    ? "bg-white text-primary shadow-xs font-bold dark:bg-slate-700"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                My
              </button>
            </div>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, lead #..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading urgent follow-up agenda...</div>
          ) : currentList.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-2" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">All Caught Up!</h4>
              <p className="text-xs text-slate-400 mt-1">No urgent follow-ups found in this category.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="border-b border-slate-100 bg-slate-50 font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-slate-950/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Actions</th>
                      <th className="px-4 py-3">Ref No</th>
                      <th className="px-4 py-3">Customer / Organization</th>
                      <th className="px-4 py-3">Primary Assignee</th>
                      <th className="px-4 py-3">Secondary Assignees</th>
                      <th className="px-4 py-3">Created By</th>
                      <th className="px-4 py-3 min-w-[180px]">Requirements &amp; Scope</th>
                      <th className="px-4 py-3 min-w-[170px]">Products Requirements</th>
                      <th className="px-4 py-3 min-w-[200px]">Last Remarks</th>
                      <th className="px-4 py-3 text-center">Channel</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3">Scheduled Date</th>
                      <th className="px-4 py-3">Notes / Context</th>
                      <th className="px-4 py-3 text-right">Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {currentList.map((item) => {
                      const lead = typeof item.lead === "object" && item.lead !== null ? item.lead : null;

                      const refNo = lead?.lead_no || "—";
                      const customerName = lead?.name || lead?.company_name || "Customer";
                      const companyName = lead?.company_name || "";
                      const { primary: primaryAssignee, secondary: secondaryAssignees } = splitLeadAssignees(lead as any);
                      const createdByName =
                        typeof (lead as any)?.created_by === "object" && (lead as any)?.created_by !== null
                          ? (lead as any).created_by.name || "—"
                          : "—";
                      const requirementText = [(lead as any)?.requirement, (lead as any)?.notes]
                        .filter(Boolean)
                        .join(" — ");
                      const productsList = Array.isArray((lead as any)?.products) ? (lead as any).products : [];
                      const lastAction = (lead as any)?.last_action;
                      const commercialValue = Number((lead as any)?.estimated_value || 0);
                      const isOverdue = overdueIdSet.has(item._id);

                      const phone =
                        lead?.phone || (lead as any)?.alternate_phone || lead?.contacts?.[0]?.phone || "";

                      const cleanPhone = phone.replace(/[^0-9]/g, "");
                      const whatsappLink = cleanPhone
                        ? `https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`}?text=${encodeURIComponent(
                            `Hello, following up on your requirement with Shakti Enterprises.`
                          )}`
                        : "";

                      const targetUrl = lead?._id ? `${portalHome}/leads/${lead._id}` : "#";

                      return (
                        <tr
                          key={item._id}
                          className="transition hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                        >
                          {/* Actions */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {phone && (
                                <a
                                  href={`tel:${phone}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 transition"
                                  title={`Call ${phone}`}
                                >
                                  <Phone className="h-3 w-3" /> Call
                                </a>
                              )}
                              {whatsappLink && (
                                <a
                                  href={whatsappLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 transition"
                                  title="WhatsApp"
                                >
                                  <MessageCircle className="h-3 w-3" /> WA
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleStartComplete(item)}
                                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-primary/90 transition cursor-pointer"
                              >
                                <Check className="h-3 w-3" /> Resolve
                              </button>
                            </div>
                          </td>

                          {/* Ref No */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Link
                              href={targetUrl}
                              onClick={onClose}
                              className="inline-flex items-center gap-1 font-mono font-bold text-primary hover:underline"
                            >
                              {refNo}
                              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                            </Link>
                          </td>

                          {/* Customer / Organization */}
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                              {customerName}
                            </p>
                            {companyName && companyName !== customerName && (
                              <p className="text-[11px] text-slate-400 truncate max-w-[180px]">
                                {companyName}
                              </p>
                            )}
                          </td>

                          {/* Primary Assignee */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {primaryAssignee ? (
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                                {primaryAssignee.name}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Secondary Assignees */}
                          <td className="px-4 py-3">
                            {secondaryAssignees.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[180px]">
                                {secondaryAssignees.map((assignee) => (
                                  <span
                                    key={assignee._id}
                                    className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  >
                                    {assignee.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Created By */}
                          <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {createdByName}
                          </td>

                          {/* Requirements & Scope */}
                          <td className="px-4 py-3 max-w-[240px] text-slate-700 dark:text-slate-300">
                            {requirementText ? (
                              <p className="line-clamp-2 text-[11px] leading-relaxed" title={requirementText}>
                                {requirementText}
                              </p>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Products Requirements */}
                          <td className="px-4 py-3">
                            {productsList.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[220px]">
                                {productsList.map((p: any, idx: number) => (
                                  <span
                                    key={`${p.product_name || "prod"}-${idx}`}
                                    className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                                  >
                                    {p.product_name || "Product"}
                                    {p.quantity ? ` (${p.quantity})` : ""}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Last Remarks */}
                          <td className="px-4 py-3 max-w-[240px] text-slate-700 dark:text-slate-300">
                            {lastAction?.remarks ? (
                              <div>
                                <p className="line-clamp-2 text-[11px] font-medium" title={lastAction.remarks}>
                                  {lastAction.remarks}
                                </p>
                                {(lastAction.timestamp || lastAction.by_user?.name) && (
                                  <p className="mt-0.5 text-[10px] text-slate-400">
                                    {lastAction.timestamp ? formatLeadDate(lastAction.timestamp) : ""}
                                    {lastAction.by_user?.name ? ` • ${lastAction.by_user.name}` : ""}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Channel */}
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 capitalize dark:bg-slate-800 dark:text-slate-300">
                              {item.type}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                isOverdue
                                  ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                                  : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              }`}
                            >
                              {isOverdue ? "OVERDUE" : "DUE TODAY"}
                            </span>
                          </td>

                          {/* Scheduled Date */}
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {item.follow_up_date ? formatLeadDate(item.follow_up_date) : "—"}
                            {item.follow_up_time && (
                              <span className="ml-1 text-[11px] text-slate-400">
                                {item.follow_up_time}
                              </span>
                            )}
                          </td>

                          {/* Notes / Context */}
                          <td className="px-4 py-3 max-w-xs truncate text-slate-700 dark:text-slate-300" title={item.notes || ""}>
                            {item.notes ? (
                              <p className="truncate font-medium">{item.notes}</p>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Value (₹) */}
                          <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                            {commercialValue > 0 ? formatCurrencyINR(commercialValue) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
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
