"use client";

import React from "react";
import {
  LifeBuoy,
  UserCheck,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
} from "lucide-react";
import type { HelpDeskStats } from "@/types/helpDesk";

interface HelpDeskStatsCardsProps {
  stats?: HelpDeskStats;
  activeScope: string;
  onSelectScope: (scope: "all" | "tagged" | "created" | "needs_my_approval") => void;
}

export function HelpDeskStatsCards({
  stats,
  activeScope,
  onSelectScope,
}: HelpDeskStatsCardsProps) {
  const taggedCount = stats?.tagged_to_me_open ?? 0;
  const createdCount = stats?.created_by_me_open ?? 0;
  const approvalWaitingCount = stats?.solution_proposed_waiting_me ?? 0;
  const resolvedMonthCount = stats?.resolved_this_month ?? 0;
  const urgentCount = stats?.urgent_count ?? 0;

  return (
    <div className="flex overflow-x-auto sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 no-scrollbar pb-1 sm:pb-0 scroll-smooth snap-x snap-mandatory">
      {/* 1. Tagged to Me / Assigned */}
      <div
        onClick={() => onSelectScope("tagged")}
        className={`relative overflow-hidden rounded-2xl border p-3.5 sm:p-5 transition-all duration-200 cursor-pointer select-none min-w-[170px] sm:min-w-0 flex-1 shrink-0 snap-start active:scale-[0.98] ${
          activeScope === "tagged"
            ? "border-amber-500/50 bg-amber-500/10 ring-2 ring-amber-500/30 shadow-md"
            : "border-border bg-card hover:bg-surface-muted/60 hover:border-border/80 shadow-xs"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5" />
            Tagged to Me
          </span>
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="mt-2.5 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-3xl font-black tracking-tight text-foreground">
            {taggedCount}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted font-medium">pending action</span>
        </div>
        <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-muted truncate">
          Help requests where your collaboration was tagged
        </div>
      </div>

      {/* 2. My Created Tickets */}
      <div
        onClick={() => onSelectScope("created")}
        className={`relative overflow-hidden rounded-2xl border p-3.5 sm:p-5 transition-all duration-200 cursor-pointer select-none min-w-[170px] sm:min-w-0 flex-1 shrink-0 snap-start active:scale-[0.98] ${
          activeScope === "created"
            ? "border-primary/50 bg-primary/10 ring-2 ring-primary/30 shadow-md"
            : "border-border bg-card hover:bg-surface-muted/60 hover:border-border/80 shadow-xs"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Created by Me
          </span>
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="mt-2.5 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-3xl font-black tracking-tight text-foreground">
            {createdCount}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted font-medium">active tickets</span>
        </div>
        <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-muted truncate">
          Your open requirements awaiting resolution
        </div>
      </div>

      {/* 3. Awaiting Creator Approval (Solution Proposed) */}
      <div
        onClick={() => onSelectScope("needs_my_approval")}
        className={`relative overflow-hidden rounded-2xl border p-3.5 sm:p-5 transition-all duration-200 cursor-pointer select-none min-w-[170px] sm:min-w-0 flex-1 shrink-0 snap-start active:scale-[0.98] ${
          activeScope === "needs_my_approval"
            ? "border-emerald-500/50 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-md"
            : "border-border bg-card hover:bg-surface-muted/60 hover:border-border/80 shadow-xs"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Verify Solution
          </span>
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="mt-2.5 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-3xl font-black tracking-tight text-foreground">
            {approvalWaitingCount}
          </span>
          <span className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
            ready to verify
          </span>
        </div>
        <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-muted truncate">
          Collaborators delivered solutions for you to verify
        </div>
      </div>

      {/* 4. Resolved This Month */}
      <div
        onClick={() => onSelectScope("all")}
        className={`relative overflow-hidden rounded-2xl border p-3.5 sm:p-5 transition-all duration-200 cursor-pointer select-none min-w-[170px] sm:min-w-0 flex-1 shrink-0 snap-start active:scale-[0.98] ${
          activeScope === "all"
            ? "border-cyan-500/50 bg-cyan-500/10 ring-2 ring-cyan-500/30 shadow-md"
            : "border-border bg-card hover:bg-surface-muted/60 hover:border-border/80 shadow-xs"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Resolved
          </span>
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
            <LifeBuoy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="mt-2.5 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-3xl font-black tracking-tight text-foreground">
            {resolvedMonthCount}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted font-medium">this month</span>
        </div>
        <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-muted truncate">
          {urgentCount > 0 ? (
            <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 inline" /> {urgentCount} urgent ticket(s)
            </span>
          ) : (
            "All company knowledge & resolved tickets"
          )}
        </div>
      </div>
    </div>
  );
}

export default HelpDeskStatsCards;
