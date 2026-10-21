"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LifeBuoy,
  Plus,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Inbox,
  CheckCircle2,
  Users,
  X,
  ChevronDown,
} from "lucide-react";
import {
  useGetHelpDeskStatsQuery,
  useGetHelpTicketsQuery,
  useAcknowledgeHelpTicketMutation,
} from "@/store/api/helpDeskApiSlice";
import { HelpDeskStatsCards } from "./HelpDeskStatsCards";
import { HelpTicketCard } from "./HelpTicketCard";
import { CreateHelpTicketModal } from "./CreateHelpTicketModal";
import { ResolveHelpTicketModal } from "./ResolveHelpTicketModal";
import { HelpTicketDetailModal } from "./HelpTicketDetailModal";
import type {
  HelpTicketRecord,
} from "@/types/helpDesk";
import { readSessionFromStorage } from "@/utils/authStorage";

type ScopeType = "all" | "tagged" | "created" | "needs_my_approval";

export function HelpDeskPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [scope, setScope] = useState<ScopeType>("tagged");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(12);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedDetailTicketId, setSelectedDetailTicketId] = useState<string | null>(null);
  const [resolvingTicket, setResolvingTicket] = useState<HelpTicketRecord | null>(null);

  useEffect(() => {
    const session = readSessionFromStorage();
    if (session?.user) {
      setCurrentUser(session.user);
    }
  }, []);

  const currentUserId = String(currentUser?._id || currentUser?.id || "");

  // Fetch Stats
  const { data: stats, refetch: refetchStats } = useGetHelpDeskStatsQuery(undefined, {
    pollingInterval: 30000,
  });

  // Fetch Tickets List
  const {
    data: ticketsResponse,
    isLoading: isLoadingTickets,
    isFetching: isFetchingTickets,
    refetch: refetchTickets,
  } = useGetHelpTicketsQuery({
    scope,
    status: statusFilter === "all" ? undefined : statusFilter,
    category: categoryFilter === "all" ? undefined : categoryFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    search: searchQuery.trim() || undefined,
    page,
    limit,
  });

  const [acknowledgeTicket] = useAcknowledgeHelpTicketMutation();

  const handleRefresh = () => {
    refetchStats();
    refetchTickets();
  };

  const tickets = ticketsResponse?.data || [];
  const total = ticketsResponse?.total || 0;
  const totalPages = ticketsResponse?.pages || 1;

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (categoryFilter !== "all") count++;
    if (priorityFilter !== "all") count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [statusFilter, categoryFilter, priorityFilter, searchQuery]);

  const handleAcknowledge = async (ticketId: string) => {
    try {
      await acknowledgeTicket(ticketId).unwrap();
    } catch (err) {
      console.error("Failed to acknowledge ticket:", err);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6 max-w-[1600px] mx-auto animate-fadeIn pb-24 sm:pb-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-border/80 pb-4 sm:pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/20 shadow-xs">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground">
                Help Desk &amp; Requirements
              </h1>
              <p className="text-[11px] sm:text-xs text-muted line-clamp-1 sm:line-clamp-none">
                Tag teammates across company portals for instant support &amp; coordination
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className={`flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 sm:px-3.5 py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground active:scale-[0.98] transition shadow-xs cursor-pointer ${
              isFetchingTickets ? "animate-pulse" : ""
            }`}
            title="Refresh list"
            aria-label="Refresh list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetchingTickets ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3.5 sm:px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 active:scale-[0.98] transition cursor-pointer"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">Raise Help Request</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW CARDS */}
      <HelpDeskStatsCards
        stats={stats}
        activeScope={scope}
        onSelectScope={(newScope) => {
          setScope(newScope);
          setPage(1);
        }}
      />

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-xs space-y-3">
        {/* TOP ROW: SCOPE TABS & SEARCH */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* SCOPE TABS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 lg:pb-0 scrollbar-none snap-x snap-mandatory -mx-1 px-1">
            <button
              onClick={() => {
                setScope("tagged");
                setPage(1);
              }}
              className={`snap-start flex items-center gap-1.5 rounded-xl px-3 py-2 sm:py-1.5 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
                scope === "tagged"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs"
                  : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Tagged to Me</span>
              {stats?.tagged_to_me_open ? (
                <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-black">
                  {stats.tagged_to_me_open}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => {
                setScope("created");
                setPage(1);
              }}
              className={`snap-start flex items-center gap-1.5 rounded-xl px-3 py-2 sm:py-1.5 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
                scope === "created"
                  ? "bg-primary/15 text-primary border border-primary/30 shadow-xs"
                  : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Created by Me</span>
              {stats?.created_by_me_open ? (
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-black">
                  {stats.created_by_me_open}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => {
                setScope("needs_my_approval");
                setPage(1);
              }}
              className={`snap-start flex items-center gap-1.5 rounded-xl px-3 py-2 sm:py-1.5 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
                scope === "needs_my_approval"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs"
                  : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Awaiting My Approval</span>
              {stats?.solution_proposed_waiting_me ? (
                <span className="ml-1 rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-black">
                  {stats.solution_proposed_waiting_me}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => {
                setScope("all");
                setPage(1);
              }}
              className={`snap-start flex items-center gap-1.5 rounded-xl px-3 py-2 sm:py-1.5 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer shrink-0 ${
                scope === "all"
                  ? "bg-surface-muted text-foreground border border-border shadow-xs"
                  : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
              }`}
            >
              <span>All Tickets</span>
            </button>
          </div>

          {/* SEARCH INPUT & MOBILE FILTER TOGGLE */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search title, project, client, #ticket, user..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-border bg-surface-muted pl-8 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setPage(1);
                  }}
                  className="absolute right-2.5 top-2.5 text-muted hover:text-foreground cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Mobile Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setShowMobileFilters((prev) => !prev)}
              className={`sm:hidden flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                showMobileFilters || activeFiltersCount > 0
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface-muted text-muted"
              }`}
              aria-label="Toggle filters"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* BOTTOM ROW: FILTERS (Collapsible on mobile, always visible on sm+) */}
        <div
          className={`${
            showMobileFilters ? "flex" : "hidden sm:flex"
          } flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 pt-2 border-t border-border/60 animate-in fade-in duration-150`}
        >
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
            {/* STATUS FILTER */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none appearance-none pr-7 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open / Waiting</option>
                <option value="in_progress">In Progress</option>
                <option value="solution_proposed">Solution Proposed</option>
                <option value="resolved">Resolved</option>
                <option value="reopened">Reopened</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3 w-3 text-muted" />
            </div>

            {/* CATEGORY FILTER */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none appearance-none pr-7 cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="work_plan_support">Work Plan Support</option>
                <option value="visit_assistance">Field Visit Assistance</option>
                <option value="client_lead_requirement">Client / Lead Requirement</option>
                <option value="product_pricing_query">Product / Pricing Query</option>
                <option value="expense_account_query">Expense / Accounting</option>
                <option value="technical_portal_issue">Technical / Portal Issue</option>
                <option value="urgent_coordination">Urgent Coordination</option>
                <option value="general_requirement">General Requirement</option>
                <option value="other">Other</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3 w-3 text-muted" />
            </div>

            {/* PRIORITY FILTER */}
            <div className="relative">
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none appearance-none pr-7 cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent 🔥</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3 w-3 text-muted" />
            </div>

            {(statusFilter !== "all" || categoryFilter !== "all" || priorityFilter !== "all" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setCategoryFilter("all");
                  setPriorityFilter("all");
                  setSearchQuery("");
                  setPage(1);
                }}
                className="text-center sm:text-left text-[11px] text-muted hover:text-primary active:scale-95 transition underline font-medium py-1 cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0">
            <span className="text-[11px] text-muted font-medium">
              Showing {tickets.length} of {total} tickets
            </span>
          </div>
        </div>
      </div>

      {/* TICKETS LIST / GRID */}
      {isLoadingTickets ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-44 rounded-2xl border border-border bg-card/60 p-4 animate-pulse space-y-3"
            >
              <div className="h-4 w-1/3 rounded bg-surface-muted" />
              <div className="h-4 w-3/4 rounded bg-surface-muted" />
              <div className="h-12 w-full rounded bg-surface-muted" />
            </div>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 sm:p-12 text-center space-y-3">
          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-surface-muted text-muted">
            <Inbox className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">No Help Tickets Found</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {scope === "tagged"
                ? "You currently have no open tickets tagged to you. Great job staying on top of teammate requests!"
                : scope === "created"
                ? "You haven't created any help requests yet. Need assistance from another department or teammate? Raise one above."
                : scope === "needs_my_approval"
                ? "No solutions are currently waiting for your verification."
                : "No help tickets match your active filter criteria."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-primary/90 active:scale-95 transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Raise New Help Request</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {tickets.map((ticket) => (
            <HelpTicketCard
              key={ticket._id}
              ticket={ticket}
              currentUserId={currentUserId}
              onClick={(t) => setSelectedDetailTicketId(t._id)}
              onAcknowledge={handleAcknowledge}
              onResolve={(t) => setResolvingTicket(t)}
            />
          ))}
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted active:scale-95 disabled:opacity-40 transition cursor-pointer"
          >
            Previous
          </button>

          <span className="text-xs text-muted">
            Page <span className="font-bold text-foreground">{page}</span> of{" "}
            <span className="font-bold text-foreground">{totalPages}</span>
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted active:scale-95 disabled:opacity-40 transition cursor-pointer"
          >
            Next
          </button>
        </div>
      )}

      {/* MOBILE FLOATING ACTION BUTTON (FAB) */}
      <button
        type="button"
        onClick={() => setCreateModalOpen(true)}
        aria-label="Raise Help Request"
        className="sm:hidden fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl hover:scale-105 active:scale-95 transition cursor-pointer ring-4 ring-background"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* CREATE HELP TICKET MODAL */}
      <CreateHelpTicketModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(ticketId) => {
          setSelectedDetailTicketId(ticketId);
          refetchStats();
          refetchTickets();
        }}
      />

      {/* TICKET DETAIL DRAWER / MODAL */}
      <HelpTicketDetailModal
        ticketId={selectedDetailTicketId}
        isOpen={Boolean(selectedDetailTicketId)}
        onClose={() => setSelectedDetailTicketId(null)}
        onOpenResolveModal={(ticket) => {
          setResolvingTicket(ticket);
        }}
      />

      {/* CREATOR RESOLVE MODAL */}
      {resolvingTicket && (
        <ResolveHelpTicketModal
          open={Boolean(resolvingTicket)}
          ticket={resolvingTicket}
          onClose={() => setResolvingTicket(null)}
          onResolved={() => {
            setResolvingTicket(null);
            refetchStats();
            refetchTickets();
          }}
        />
      )}
    </div>
  );
}

export default HelpDeskPage;
