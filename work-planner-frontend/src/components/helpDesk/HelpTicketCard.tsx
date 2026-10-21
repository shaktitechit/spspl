"use client";

import React from "react";
import {
  Clock,
  MessageSquare,
  Paperclip,
  Users,
  CheckCircle2,
  AlertTriangle,
  Send,
  Star,
  CornerDownRight,
  UserCheck,
  LifeBuoy,
  ChevronRight,
} from "lucide-react";
import type { HelpTicketRecord, HelpTicketStatus, HelpTicketPriority } from "@/types/helpDesk";

interface HelpTicketCardProps {
  ticket: HelpTicketRecord;
  currentUserId: string;
  onClick: (ticket: HelpTicketRecord) => void;
  onAcknowledge?: (ticketId: string) => void;
  onResolve?: (ticket: HelpTicketRecord) => void;
}

export function formatCategoryTitle(cat?: string) {
  const map: Record<string, string> = {
    work_plan_support: "Work Plan",
    visit_assistance: "Field Visit",
    client_lead_requirement: "Lead / Client",
    product_pricing_query: "Pricing",
    expense_account_query: "Expense",
    technical_portal_issue: "Technical",
    urgent_coordination: "Urgent",
    general_requirement: "General",
    other: "Other",
  };
  return map[cat || ""] || cat || "General";
}

export function formatEntityLabel(entity?: { entity_type?: string; entity_title?: string; entity_code?: string }) {
  if (!entity || !entity.entity_type || entity.entity_type === "none") return null;
  const typeMap: Record<string, string> = {
    work_plan: "Plan",
    visit: "Visit",
    work_task: "Task",
    project: "Project",
    expense: "Expense",
    lead: "Lead",
    client: "Client",
  };
  const label = typeMap[entity.entity_type] || entity.entity_type;
  const name = entity.entity_title || entity.entity_code || "";
  return { label, name };
}

export function renderStatusPill(status: HelpTicketStatus) {
  switch (status) {
    case "open":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          OPEN
        </span>
      );
    case "in_progress":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
          <Clock className="h-3 w-3" />
          IN PROGRESS
        </span>
      );
    case "solution_proposed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-500/30 ring-1 ring-purple-500/20 shrink-0">
          <CheckCircle2 className="h-3 w-3" />
          SOLUTION READY
        </span>
      );
    case "resolved":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
          <CheckCircle2 className="h-3 w-3" />
          RESOLVED
        </span>
      );
    case "reopened":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          REOPENED
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-muted border border-border shrink-0">
          CANCELLED
        </span>
      );
    default:
      return null;
  }
}

export function renderPriorityBadge(priority: HelpTicketPriority) {
  switch (priority) {
    case "urgent":
      return (
        <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black text-rose-600 dark:text-rose-400 border border-rose-500/25 shrink-0">
          🔥 URGENT
        </span>
      );
    case "high":
      return (
        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black text-amber-600 dark:text-amber-400 border border-amber-500/25 shrink-0">
          ⚡ HIGH
        </span>
      );
    case "low":
      return (
        <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-muted border border-border shrink-0">
          LOW
        </span>
      );
    default:
      return (
        <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
          MED
        </span>
      );
  }
}

export function HelpTicketCard({
  ticket,
  currentUserId,
  onClick,
  onAcknowledge,
  onResolve,
}: HelpTicketCardProps) {
  const creatorId = typeof ticket.created_by === "object" ? (ticket.created_by as any)?._id : ticket.created_by;
  const isCreator = String(creatorId || "") === currentUserId;
  const isTagged = (ticket.tagged_users || []).some(
    (t) => String(typeof t.user === "object" ? (t.user as any)?._id : t.user) === currentUserId
  );
  const myTaggedRecord = (ticket.tagged_users || []).find(
    (t) => String(typeof t.user === "object" ? (t.user as any)?._id : t.user) === currentUserId
  );
  const needsAcknowledgment = isTagged && ticket.status === "open" && !myTaggedRecord?.acknowledged_at;
  const waitingMyResolution = isCreator && ticket.status === "solution_proposed";

  const unseenCount = ticket.unseen_messages_count || 0;
  const repliesCount = ticket.replies_count ?? (ticket.replies?.length || 0);
  const attachmentsCount = ticket.attachments?.length || 0;
  const entityInfo = formatEntityLabel(ticket.related_entity);

  return (
    <div
      onClick={() => onClick(ticket)}
      className={`group relative flex flex-col justify-between rounded-2xl border bg-card p-3.5 sm:p-5 transition-all duration-200 cursor-pointer select-none active:scale-[0.99] hover:shadow-md ${
        unseenCount > 0
          ? "border-primary/60 ring-2 ring-primary/20 bg-primary/[0.02]"
          : waitingMyResolution
          ? "border-purple-500/50 ring-2 ring-purple-500/20 bg-purple-500/[0.03]"
          : needsAcknowledgment
          ? "border-amber-500/40 ring-1 ring-amber-500/20 bg-amber-500/[0.02]"
          : "border-border hover:border-border/90"
      }`}
    >
      <div className="space-y-2.5">
        {/* Card Header: Ticket # + Priority + Category + Unseen Badge + Status */}
        <div className="flex items-center justify-between gap-1.5 border-b border-border/50 pb-2.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="rounded-lg bg-surface-muted px-2 py-0.5 font-mono text-[11px] font-bold text-foreground shrink-0">
              #{ticket.ticket_number}
            </span>
            {renderPriorityBadge(ticket.priority)}
            <span className="rounded bg-surface-muted/80 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-muted truncate max-w-[90px] sm:max-w-none">
              {formatCategoryTitle(ticket.category)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {unseenCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[9px] sm:text-[10px] font-black text-rose-600 dark:text-rose-400 animate-pulse shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                {unseenCount} NEW
              </span>
            )}
            <div>{renderStatusPill(ticket.status)}</div>
          </div>
        </div>

        {/* Entity Identification Breadcrumb (if linked to project, lead, client, etc.) */}
        {entityInfo && (
          <div className="flex items-center gap-1 text-[10px] text-primary/90 font-semibold bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md w-fit max-w-full truncate">
            <span className="uppercase text-[8px] font-black tracking-wider text-primary/70">{entityInfo.label}:</span>
            <span className="truncate">{entityInfo.name || "Linked Entity"}</span>
          </div>
        )}

        {/* Title & Requirement Summary */}
        <div className="space-y-1">
          <h3 className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition line-clamp-1">
            {ticket.title}
          </h3>
          <p className="text-[11px] sm:text-xs text-muted leading-relaxed line-clamp-2">
            {ticket.description}
          </p>
        </div>

        {/* Latest Activity / Message Preview Snippet */}
        {ticket.latest_reply_preview && (
          <div className="rounded-xl bg-surface-muted/60 border border-border/60 p-2 text-[11px] flex items-start gap-1.5 text-muted leading-snug">
            <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 truncate">
              <span className="font-bold text-foreground mr-1">
                {ticket.latest_reply_preview.user_name}:
              </span>
              <span className="truncate">{ticket.latest_reply_preview.message}</span>
            </div>
          </div>
        )}

        {/* Action Banner for Solution Proposed / Awaiting Creator Confirmation */}
        {waitingMyResolution && (
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-2.5 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] text-purple-700 dark:text-purple-300 font-semibold truncate min-w-0">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
              <span className="truncate">
                Solution proposed &bull; Please verify
              </span>
            </div>
            {onResolve && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(ticket);
                }}
                className="shrink-0 rounded-lg bg-purple-600 px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-white hover:bg-purple-700 transition shadow-xs cursor-pointer active:scale-95"
              >
                Resolve
              </button>
            )}
          </div>
        )}

        {/* Action Banner for Responder Acknowledgment */}
        {needsAcknowledgment && onAcknowledge && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 flex items-center justify-between gap-2 shadow-xs">
            <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium truncate">
              Tagged to you &bull; Not started yet
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledge(ticket._id);
              }}
              className="shrink-0 rounded-lg bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-500/30 transition cursor-pointer"
            >
              Acknowledge
            </button>
          </div>
        )}
      </div>

      {/* Card Footer: Creator + Tagged Users Avatars + Thread Info */}
      <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between gap-2 text-[10px] sm:text-xs text-muted">
        {/* Creator Snapshot */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] sm:text-[10px] font-bold text-primary">
            {(ticket.creator_snapshot?.name || "U").slice(0, 2).toUpperCase()}
          </div>
          <div className="truncate">
            <span className="font-semibold text-foreground truncate">
              {ticket.creator_snapshot?.name || "Creator"}
            </span>
            {isCreator && <span className="ml-1 text-[9px] sm:text-[10px] text-primary font-bold">(You)</span>}
          </div>
        </div>

        {/* Tagged Collaborators Stack */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1" title={`${ticket.tagged_users?.length || 0} collaborator(s)`}>
            <div className="flex -space-x-1.5 overflow-hidden">
              {(ticket.tagged_users || []).slice(0, 3).map((t, idx) => (
                <div
                  key={idx}
                  className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-indigo-500/20 text-[8px] sm:text-[9px] font-bold text-indigo-700 dark:text-indigo-300 ring-1 ring-card"
                  title={t.name}
                >
                  {(t.name || "U").slice(0, 1)}
                </div>
              ))}
            </div>
            {(ticket.tagged_users?.length || 0) > 3 && (
              <span className="text-[9px] sm:text-[10px] font-bold text-muted">
                +{(ticket.tagged_users?.length || 0) - 3}
              </span>
            )}
          </div>

          {/* Activity / Messages count */}
          <div className="flex items-center gap-1.5 text-muted">
            {attachmentsCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]" title={`${attachmentsCount} file(s)`}>
                <Paperclip className="h-3 w-3 text-primary" />
                {attachmentsCount}
              </span>
            )}
            <span className="flex items-center gap-0.5 text-[10px]" title={`${repliesCount} message(s)`}>
              <MessageSquare className="h-3 w-3" />
              {repliesCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpTicketCard;
