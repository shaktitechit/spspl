/**
 * @fileoverview Collaborative Follow-Up & Communication Chat Panel for Leads and Quotations.
 * Allows multi-member teams to record scheduled touchpoints, post team notes, log intermediate
 * actions/remarks with author identity, timestamps, channel icons, and completion outcomes.
 * @module components/shared/followups/FollowUpChatPanel
 */
"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar,
  CalendarPlus,
  Clock,
  Phone,
  MessageCircle,
  MessageSquare,
  Mail,
  Users,
  MapPin,
  MonitorPlay,
  FileText,
  StickyNote,
  CheckCircle2,
  AlertCircle,
  Plus,
  Send,
  CornerDownRight,
  Filter,
  Search,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  useListQuotationFollowUpsQuery,
  useScheduleQuotationFollowUpMutation,
  useAddQuotationFollowUpActionMutation,
  useListLeadFollowUpsQuery,
  useCreateLeadFollowUpMutation,
  useAddLeadFollowUpActionMutation,
  type LeadQuotationRecord,
  type LeadQuotationFollowUp,
  type LeadRecord,
  type LeadFollowUpRecord,
  type FollowUpActionRecord,
  type LeadFollowUpType,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { toast } from "@/lib/toast";
import { ScheduleQuotationFollowUpModal } from "@/components/quotations/ScheduleQuotationFollowUpModal";
import { CompleteQuotationFollowUpModal } from "@/components/quotations/CompleteQuotationFollowUpModal";
import { FollowUpModal } from "@/components/leads/FollowUpModal";
import { CompleteFollowUpModal } from "@/components/leads/CompleteFollowUpModal";

export type FollowUpChatPanelProps = {
  context: "quotation" | "lead";
  quotation?: LeadQuotationRecord | null;
  lead?: LeadRecord | null;
  disabled?: boolean;
};

// Normalized Follow-Up Item representing both Quotation and Lead models
interface NormalizedFollowUp {
  _id: string;
  type: string;
  follow_up_date: string;
  follow_up_time?: string;
  notes?: string;
  outcome?: string;
  status: "pending" | "completed" | "cancelled" | "rescheduled";
  created_by?: { _id?: string; name?: string; email?: string; department?: string } | null;
  completed_by?: { _id?: string; name?: string; email?: string; department?: string } | null;
  completed_at?: string;
  actions: FollowUpActionRecord[];
  createdAt: string;
  rawQuotationItem?: LeadQuotationFollowUp;
  rawLeadItem?: LeadFollowUpRecord;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgBadge: string }
> = {
  call: {
    label: "Phone Call",
    icon: Phone,
    color: "text-blue-600 dark:text-blue-400",
    bgBadge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-900",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    color: "text-emerald-600 dark:text-emerald-400",
    bgBadge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-900",
  },
  email: {
    label: "Email",
    icon: Mail,
    color: "text-indigo-600 dark:text-indigo-400",
    bgBadge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-900",
  },
  meeting: {
    label: "Meeting",
    icon: Users,
    color: "text-purple-600 dark:text-purple-400",
    bgBadge: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-900",
  },
  visit: {
    label: "Site Visit",
    icon: MapPin,
    color: "text-amber-600 dark:text-amber-400",
    bgBadge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-900",
  },
  demo: {
    label: "Demo / Presentation",
    icon: MonitorPlay,
    color: "text-rose-600 dark:text-rose-400",
    bgBadge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-900",
  },
  note: {
    label: "Team Note",
    icon: StickyNote,
    color: "text-amber-700 dark:text-amber-300",
    bgBadge: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-900",
  },
  other: {
    label: "Touchpoint",
    icon: FileText,
    color: "text-slate-600 dark:text-slate-400",
    bgBadge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
};

const ACTION_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  comment: { label: "Remark", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  call_attempt: { label: "Call Attempt", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300" },
  status_change: { label: "Status Update", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300" },
  reschedule: { label: "Reschedule", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300" },
  requirement_update: { label: "Client Requirement", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300" },
};

function getInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name?: string): string {
  const colors = [
    "bg-blue-600 text-white",
    "bg-indigo-600 text-white",
    "bg-emerald-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-purple-600 text-white",
    "bg-teal-600 text-white",
    "bg-cyan-600 text-white",
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % colors.length;
  return colors[idx];
}

function formatRelativeOrDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec >= 0 && diffSec < 60) return "Just now";
  if (diffMin > 0 && diffMin < 60) return `${diffMin}m ago`;
  if (diffHr > 0 && diffHr < 24 && d.getDate() === now.getDate()) {
    return `${diffHr}h ago (${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })})`;
  }

  return `${d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatTouchpointDate(dateStr: string, timeStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dateFormatted = d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return timeStr ? `${dateFormatted} @ ${timeStr}` : dateFormatted;
}

export function FollowUpChatPanel({
  context,
  quotation,
  lead,
  disabled = false,
}: FollowUpChatPanelProps) {
  const authUser = useAppSelector((state) => state.auth.user) as {
    _id?: string;
    id?: string;
    name?: string;
    email?: string;
    department?: string;
    role?: string;
  } | null;

  // --- Quotation hooks ---
  const quotationId = quotation?._id || "";
  const { data: quoteFollowUps = [], isLoading: isQuoteLoading } = useListQuotationFollowUpsQuery(
    quotationId,
    { skip: context !== "quotation" || !quotationId }
  );
  const [scheduleQuotationFollowUp, { isLoading: isSchedulingQuote }] =
    useScheduleQuotationFollowUpMutation();
  const [addQuotationFollowUpAction, { isLoading: isAddingQuoteAction }] =
    useAddQuotationFollowUpActionMutation();

  // --- Lead hooks ---
  const leadId = lead?._id || "";
  const { data: leadFollowUps = [], isLoading: isLeadLoading } = useListLeadFollowUpsQuery(
    leadId,
    { skip: context !== "lead" || !leadId }
  );
  const [createLeadFollowUp, { isLoading: isSchedulingLead }] = useCreateLeadFollowUpMutation();
  const [addLeadFollowUpAction, { isLoading: isAddingLeadAction }] =
    useAddLeadFollowUpActionMutation();

  // Modals state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [completingItem, setCompletingItem] = useState<NormalizedFollowUp | null>(null);

  // Filter & Search state
  const [filterType, setFilterType] = useState<"all" | "touchpoints" | "notes" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Inline action reply box state
  const [replyingFollowUpId, setReplyingFollowUpId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyActionType, setReplyActionType] = useState("comment");

  // Bottom Composer state
  const [composerMode, setComposerMode] = useState<"note" | "action">("note");
  const [composerMessage, setComposerMessage] = useState("");
  const [selectedTargetFuId, setSelectedTargetFuId] = useState<string>("");

  const isLoading = context === "quotation" ? isQuoteLoading : isLeadLoading;

  // Normalize follow-up list across quotation / lead
  const normalizedList: NormalizedFollowUp[] = useMemo(() => {
    if (context === "quotation") {
      return (quoteFollowUps || []).map((qf) => ({
        _id: qf._id,
        type: qf.type || "other",
        follow_up_date: qf.follow_up_date,
        follow_up_time: qf.follow_up_time,
        notes: qf.notes,
        outcome: qf.outcome,
        status: qf.status,
        created_by: qf.created_by,
        completed_by: qf.completed_by,
        completed_at: qf.completed_at,
        actions: qf.actions || [],
        createdAt: qf.createdAt || qf.follow_up_date,
        rawQuotationItem: qf,
      }));
    } else {
      return (leadFollowUps || []).map((lf) => ({
        _id: lf._id,
        type: lf.type || "other",
        follow_up_date: lf.follow_up_date,
        follow_up_time: lf.follow_up_time,
        notes: lf.notes,
        outcome: lf.outcome,
        status: lf.status,
        created_by: lf.created_by,
        completed_by: lf.completed_by,
        completed_at: lf.completed_at,
        actions: lf.actions || [],
        createdAt: lf.createdAt || lf.follow_up_date,
        rawLeadItem: lf,
      }));
    }
  }, [context, quoteFollowUps, leadFollowUps]);

  // Find the next active pending touchpoint (scheduled for future or today)
  const pendingTouchpoints = useMemo(() => {
    return normalizedList
      .filter((item) => item.status === "pending" && item.type !== "note")
      .sort((a, b) => new Date(a.follow_up_date).getTime() - new Date(b.follow_up_date).getTime());
  }, [normalizedList]);

  const nextPending = pendingTouchpoints[0] || null;

  // Filtered & searched timeline list
  const filteredTimeline = useMemo(() => {
    return normalizedList
      .filter((item) => {
        if (filterType === "touchpoints") return item.type !== "note";
        if (filterType === "notes") return item.type === "note";
        if (filterType === "pending") return item.status === "pending";
        return true;
      })
      .filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const matchesAuthor =
          item.created_by?.name?.toLowerCase().includes(q) ||
          item.completed_by?.name?.toLowerCase().includes(q);
        const matchesNotes = item.notes?.toLowerCase().includes(q);
        const matchesOutcome = item.outcome?.toLowerCase().includes(q);
        const matchesActions = (item.actions || []).some(
          (a) =>
            a.message?.toLowerCase().includes(q) ||
            a.author?.name?.toLowerCase().includes(q) ||
            a.action_type?.toLowerCase().includes(q)
        );
        return matchesAuthor || matchesNotes || matchesOutcome || matchesActions;
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt || a.follow_up_date).getTime();
        const timeB = new Date(b.createdAt || b.follow_up_date).getTime();
        return timeB - timeA; // Most recent on top
      });
  }, [normalizedList, filterType, searchQuery]);

  // Quick Action Submitter (Inline)
  const handleAddInlineAction = async (followUpId: string) => {
    if (!replyMessage.trim()) {
      toast.error("Please enter a remark or action update");
      return;
    }

    try {
      if (context === "quotation") {
        await addQuotationFollowUpAction({
          followUpId,
          quotationId,
          leadId:
            typeof quotation?.lead === "object" && quotation?.lead !== null
              ? quotation.lead._id
              : (quotation?.lead as string | undefined),
          message: replyMessage.trim(),
          action_type: replyActionType,
        }).unwrap();
      } else {
        await addLeadFollowUpAction({
          followUpId,
          leadId,
          message: replyMessage.trim(),
          action_type: replyActionType,
        }).unwrap();
      }

      toast.success("Action recorded successfully");
      setReplyMessage("");
      setReplyingFollowUpId(null);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "data" in err && (err as { data?: { message?: string } }).data?.message
          ? (err as { data?: { message?: string } }).data?.message
          : "Failed to record action";
      toast.error(msg);
    }
  };

  // Bottom Composer Submitter
  const handleComposerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerMessage.trim()) return;

    if (composerMode === "note") {
      // Create a collaborative team note (type: 'note')
      try {
        if (context === "quotation") {
          await scheduleQuotationFollowUp({
            quotationId,
            leadId:
              typeof quotation?.lead === "object" && quotation?.lead !== null
                ? quotation.lead._id
                : (quotation?.lead as string | undefined),
            data: {
              type: "note",
              notes: composerMessage.trim(),
              follow_up_date: new Date().toISOString(),
            },
          }).unwrap();
        } else {
          await createLeadFollowUp({
            leadId,
            type: "note" as LeadFollowUpType,
            notes: composerMessage.trim(),
            follow_up_date: new Date().toISOString(),
          }).unwrap();
        }

        toast.success("Team note posted to timeline");
        setComposerMessage("");
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "data" in err && (err as { data?: { message?: string } }).data?.message
            ? (err as { data?: { message?: string } }).data?.message
            : "Failed to post note";
        toast.error(msg);
      }
    } else {
      // Append intermediate remark to selected follow-up or next pending
      const targetId = selectedTargetFuId || nextPending?._id || normalizedList[0]?._id;
      if (!targetId) {
        toast.error("No active follow-up available to comment on. Please schedule one first or switch to Team Note.");
        return;
      }

      try {
        if (context === "quotation") {
          await addQuotationFollowUpAction({
            followUpId: targetId,
            quotationId,
            leadId:
              typeof quotation?.lead === "object" && quotation?.lead !== null
                ? quotation.lead._id
                : (quotation?.lead as string | undefined),
            message: composerMessage.trim(),
            action_type: "comment",
          }).unwrap();
        } else {
          await addLeadFollowUpAction({
            followUpId: targetId,
            leadId,
            message: composerMessage.trim(),
            action_type: "comment",
          }).unwrap();
        }

        toast.success("Follow-up remark recorded");
        setComposerMessage("");
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "data" in err && (err as { data?: { message?: string } }).data?.message
            ? (err as { data?: { message?: string } }).data?.message
            : "Failed to post remark";
        toast.error(msg);
      }
    }
  };

  const isSubmitting =
    isSchedulingQuote || isAddingQuoteAction || isSchedulingLead || isAddingLeadAction;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900 overflow-hidden flex flex-col">
      {/* 1. Header with Title & Action Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-900/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Follow-Ups & Communication Stream
              </h3>
              <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {normalizedList.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Multi-member collaborative touchpoints, remarks & action trail
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!disabled ? (
            <button
              type="button"
              onClick={() => setScheduleModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition cursor-pointer"
            >
              <CalendarPlus className="h-4 w-4" />
              <span>Schedule Touchpoint</span>
            </button>
          ) : (
            <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Closed / Converted
            </span>
          )}
        </div>
      </div>

      {/* 2. Pinned Next Due Touchpoint (Hero Banner) */}
      {nextPending && (
        <div className="m-4 sm:m-5 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-blue-50/80 p-4.5 dark:border-blue-900/50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-900 dark:text-blue-200">
                  Upcoming Scheduled Touchpoint
                </span>
                {(() => {
                  const cfg = TYPE_CONFIG[nextPending.type] || TYPE_CONFIG.other;
                  const Icon = cfg.icon;
                  return (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${cfg.bgBadge}`}
                    >
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  );
                })()}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>{formatTouchpointDate(nextPending.follow_up_date, nextPending.follow_up_time)}</span>
                </div>

                {nextPending.created_by?.name && (
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Scheduled by:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {nextPending.created_by.name}
                    </span>
                    {nextPending.created_by.department && (
                      <span className="text-[10px] rounded bg-slate-200/70 px-1.5 py-0.2 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {nextPending.created_by.department}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {nextPending.notes && (
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium bg-white/70 dark:bg-slate-900/70 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40 mt-1">
                  <strong className="text-blue-900 dark:text-blue-300">Agenda / Goals:</strong>{" "}
                  {nextPending.notes}
                </p>
              )}
            </div>

            {!disabled && (
              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => setCompletingItem(nextPending)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Record Outcome</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplyingFollowUpId(nextPending._id);
                    setReplyActionType("comment");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-white/80 px-3 py-2 text-xs font-bold text-blue-800 shadow-xs hover:bg-white dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Remark</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Filter Bar & Search */}
      <div className="px-4 sm:px-5 py-2.5 border-y border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/40 dark:bg-slate-900/40">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              filterType === "all"
                ? "bg-primary text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            All Activity ({normalizedList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("touchpoints")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              filterType === "touchpoints"
                ? "bg-primary text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            Touchpoints ({normalizedList.filter((i) => i.type !== "note").length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("notes")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              filterType === "notes"
                ? "bg-primary text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            Team Notes ({normalizedList.filter((i) => i.type === "note").length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("pending")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              filterType === "pending"
                ? "bg-primary text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            Pending ({normalizedList.filter((i) => i.status === "pending").length})
          </button>
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search remarks or author..."
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* 4. Conversational Chat / Timeline Stream */}
      <div className="p-4 sm:p-5 space-y-4 max-h-[580px] overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">Loading follow-up communication stream...</span>
          </div>
        ) : filteredTimeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No follow-ups or notes recorded
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              Start by posting an internal team note below, or schedule a formal client touchpoint
              (call, meeting, whatsapp).
            </p>
          </div>
        ) : (
          filteredTimeline.map((item) => {
            const isNote = item.type === "note";
            const isCompleted = item.status === "completed";
            const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.other;
            const Icon = cfg.icon;
            const authorName = item.created_by?.name || "Team Member";
            const authorDept = item.created_by?.department;
            const isReplyingThis = replyingFollowUpId === item._id;

            return (
              <div
                key={item._id}
                className={`group rounded-2xl border transition ${
                  isNote
                    ? "border-amber-200/80 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20"
                    : isCompleted
                    ? "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/70"
                    : "border-blue-200/70 bg-blue-50/20 dark:border-blue-900/40 dark:bg-blue-950/10"
                } p-4 shadow-2xs space-y-3`}
              >
                {/* Header row: Author info, channel badge, time */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/5">
                  <div className="flex items-center gap-2.5">
                    {/* Author Avatar with initials */}
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold shadow-xs ${getAvatarColor(
                        authorName
                      )}`}
                      title={authorName}
                    >
                      {getInitials(authorName)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {authorName}
                        </span>
                        {authorDept && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {authorDept}
                          </span>
                        )}
                        {isNote && (
                          <span className="rounded-md bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Internal Note
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {formatRelativeOrDate(item.createdAt || item.follow_up_date)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Channel / Touchpoint badge */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase border ${cfg.bgBadge}`}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{cfg.label}</span>
                    </span>

                    {/* Status badge */}
                    {!isNote && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        {isCompleted ? (
                          <>
                            <CheckCircle2 className="h-2.5 w-2.5" /> Completed
                          </>
                        ) : (
                          <>
                            <Clock className="h-2.5 w-2.5" /> Pending
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Content Body */}
                <div className="space-y-2 text-xs">
                  {/* Scheduled touchpoint date if not note */}
                  {!isNote && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span>Scheduled for:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatTouchpointDate(item.follow_up_date, item.follow_up_time)}
                      </span>
                    </div>
                  )}

                  {/* Notes / Agenda */}
                  {item.notes && (
                    <div
                      className={`rounded-xl p-3 text-slate-800 dark:text-slate-200 leading-relaxed ${
                        isNote
                          ? "bg-amber-100/40 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-900/30"
                          : "bg-slate-50 dark:bg-slate-800/60"
                      }`}
                    >
                      {item.notes}
                    </div>
                  )}

                  {/* Completed Outcome Callout */}
                  {item.outcome && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 font-bold text-emerald-900 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Final Outcome Logged:
                        </span>
                        {item.completed_at && (
                          <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
                            {formatRelativeOrDate(item.completed_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-emerald-800 dark:text-emerald-200 font-medium pl-4.5">
                        {item.outcome}
                      </p>
                      {item.completed_by?.name && (
                        <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/90 pl-4.5">
                          Logged by: <strong>{item.completed_by.name}</strong>{" "}
                          {item.completed_by.department && `(${item.completed_by.department})`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. Nested Threaded Actions / Collaborative Remarks */}
                {item.actions && item.actions.length > 0 && (
                  <div className="pl-3 sm:pl-5 border-l-2 border-slate-200 dark:border-white/10 space-y-2 mt-2 pt-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Threaded Actions & Remarks ({item.actions.length})
                    </div>
                    {item.actions.map((act, actIdx) => {
                      const actAuthor = act.author?.name || "Team Member";
                      const actCfg = ACTION_TYPE_LABELS[act.action_type] || ACTION_TYPE_LABELS.comment;
                      return (
                        <div
                          key={act._id || actIdx}
                          className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5"
                        >
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${getAvatarColor(
                              actAuthor
                            )}`}
                          >
                            {getInitials(actAuthor)}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-white text-xs">
                                  {actAuthor}
                                </span>
                                {act.author?.department && (
                                  <span className="text-[10px] text-slate-500">
                                    • {act.author.department}
                                  </span>
                                )}
                                <span
                                  className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${actCfg.color}`}
                                >
                                  {actCfg.label}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {formatRelativeOrDate(act.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                              {act.message}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inline Action Bar & Reply Drawer */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingFollowUpId(isReplyingThis ? null : item._id);
                          setReplyActionType("comment");
                          setReplyMessage("");
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition cursor-pointer"
                      >
                        <CornerDownRight className="h-3 w-3" />
                        <span>{isReplyingThis ? "Cancel Reply" : "Reply / Add Remark"}</span>
                      </button>
                    )}
                  </div>

                  {!isCompleted && !isNote && !disabled && (
                    <button
                      type="button"
                      onClick={() => setCompletingItem(item)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 transition cursor-pointer"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Record Outcome</span>
                    </button>
                  )}
                </div>

                {/* Inline Reply Composer */}
                {isReplyingThis && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2.5 mt-2 animate-in fade-in duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Log Action / Remark as {authUser?.name || "CurrentUser"}:
                        </span>
                      </div>
                      <select
                        value={replyActionType}
                        onChange={(e) => setReplyActionType(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value="comment">Remark / Comment</option>
                        <option value="call_attempt">Call Attempt (No answer/busy)</option>
                        <option value="requirement_update">Client Requirement Note</option>
                        <option value="status_change">Progress Update</option>
                        <option value="reschedule">Reschedule Reason</option>
                      </select>
                    </div>

                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          handleAddInlineAction(item._id);
                        }
                      }}
                      placeholder="Type your action remark or comment... (Ctrl+Enter to send)"
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setReplyingFollowUpId(null)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting || !replyMessage.trim()}
                        onClick={() => handleAddInlineAction(item._id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        <span>Post Action</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 6. Bottom Composer Omnibox */}
      {!disabled && (
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-900/80">
          <form onSubmit={handleComposerSubmit} className="space-y-3">
            {/* Mode selection tabs */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-slate-200/60 dark:bg-slate-800/80 p-0.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setComposerMode("note")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition ${
                    composerMode === "note"
                      ? "bg-white text-primary shadow-xs dark:bg-slate-700 dark:text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <StickyNote className="h-3.5 w-3.5" />
                  <span>Team Note</span>
                </button>
                <button
                  type="button"
                  onClick={() => setComposerMode("action")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition ${
                    composerMode === "action"
                      ? "bg-white text-primary shadow-xs dark:bg-slate-700 dark:text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Remark on Follow-Up</span>
                </button>
              </div>

              {composerMode === "action" && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 text-[11px]">Target:</span>
                  <select
                    value={selectedTargetFuId || (nextPending?._id || "")}
                    onChange={(e) => setSelectedTargetFuId(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {nextPending && (
                      <option value={nextPending._id}>
                        Next Due: {TYPE_CONFIG[nextPending.type]?.label || nextPending.type} (
                        {formatTouchpointDate(nextPending.follow_up_date)})
                      </option>
                    )}
                    {normalizedList
                      .filter((f) => f._id !== nextPending?._id)
                      .slice(0, 5)
                      .map((f) => (
                        <option key={f._id} value={f._id}>
                          {TYPE_CONFIG[f.type]?.label || f.type} -{" "}
                          {formatTouchpointDate(f.follow_up_date)}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Expanding Textarea */}
            <div className="relative">
              <textarea
                value={composerMessage}
                onChange={(e) => setComposerMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleComposerSubmit(e);
                  }
                }}
                placeholder={
                  composerMode === "note"
                    ? "Write an internal team note, client sentiment, or pricing context... (Ctrl+Enter to post)"
                    : "Add an update or remark to this follow-up... (Ctrl+Enter to post)"
                }
                rows={2}
                className="w-full rounded-2xl border border-slate-200 bg-white p-3 pr-24 text-xs text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />

              <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
                <button
                  type="submit"
                  disabled={isSubmitting || !composerMessage.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50 transition cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Post</span>
                </button>
              </div>
            </div>

            {/* Quick response suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Quick Snippets:
              </span>
              {[
                "Client reviewed quotation, requested discount on freight.",
                "Spoke with purchaser, decision expected by end of week.",
                "WhatsApp catalog and data sheets sent to client.",
                "Requested technical team to verify customization feasibility.",
              ].map((snip, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => setComposerMessage(snip)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 hover:border-primary hover:text-primary dark:border-white/10 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white transition"
                >
                  {snip.length > 35 ? snip.slice(0, 35) + "..." : snip}
                </button>
              ))}
            </div>
          </form>
        </div>
      )}

      {/* 7. Modals: Schedule & Complete */}
      {context === "quotation" && quotation && (
        <>
          <ScheduleQuotationFollowUpModal
            quotation={quotation}
            open={scheduleModalOpen}
            onClose={() => setScheduleModalOpen(false)}
          />

          <CompleteQuotationFollowUpModal
            quotation={quotation}
            followUp={completingItem?.rawQuotationItem || null}
            open={!!completingItem}
            onClose={() => setCompletingItem(null)}
          />
        </>
      )}

      {context === "lead" && lead && (
        <>
          <FollowUpModal
            lead={lead}
            open={scheduleModalOpen}
            onClose={() => setScheduleModalOpen(false)}
          />

          {completingItem?.rawLeadItem && (
            <CompleteFollowUpModal
              followUp={completingItem.rawLeadItem}
              open={!!completingItem}
              onClose={() => setCompletingItem(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
