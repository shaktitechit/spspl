"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  PlusCircle,
  CalendarDays,
  FileText,
  BarChart3,
  TrendingUp,
  BookOpen,
  Network,
  User,
  ArrowRight,
  Sparkles,
  Command,
  X,
  Phone,
  Building2,
  CornerDownLeft,
} from "lucide-react";
import { useListLeadsQuery } from "@/store/api";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";

interface CommandPaletteModalProps {
  open: boolean;
  onClose: () => void;
}

interface NavAction {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "Navigation" | "Quick Action";
  roleCheck?: boolean;
}

export function CommandPaletteModal({ open, onClose }: CommandPaletteModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { isAdmin, isManager, isCoordinator, isExecutive } = useLeadManagerRole();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Fetch matched leads dynamically when searching
  const { data: leadsData, isFetching: isSearchingLeads } = useListLeadsQuery(
    debouncedQuery ? { search: debouncedQuery, limit: 6 } : (undefined as any),
    { skip: !open || debouncedQuery.length < 2 }
  );

  const leads = useMemo(() => {
    return leadsData?.items || [];
  }, [leadsData]);

  // Navigation shortcuts list
  const navActions = useMemo<NavAction[]>(() => {
    const actions: NavAction[] = [
      {
        id: "new-lead",
        title: "Create New Lead",
        description: "Register a fresh sales enquiry or prospect",
        href: "/dashboard/leads/new",
        icon: PlusCircle,
        category: "Quick Action",
        roleCheck: true,
      },
      {
        id: "follow-ups",
        title: "Follow-ups Calendar & Agenda",
        description: "View overdue, today's and scheduled follow-ups",
        href: "/dashboard/leads/follow-ups",
        icon: CalendarDays,
        category: "Quick Action",
        roleCheck: true,
      },
      {
        id: "all-leads",
        title: "Lead Pipeline",
        description: "Browse all incoming leads, status pipelines & filters",
        href: "/dashboard/leads",
        icon: Users,
        category: "Navigation",
        roleCheck: true,
      },
      {
        id: "quotations",
        title: "Quotations Commercial Hub",
        description: "Manage proposals, line items, pricing & revisions",
        href: "/dashboard/quotations",
        icon: FileText,
        category: "Navigation",
        roleCheck: isAdmin || isManager || isCoordinator || isExecutive,
      },
      {
        id: "lead-reports",
        title: "Sales Pipeline Reports",
        description: "Conversion metrics, loss analytics & rep performance",
        href: "/dashboard/leads/reports",
        icon: BarChart3,
        category: "Navigation",
        roleCheck: isAdmin || isManager || isCoordinator || isExecutive,
      },
      {
        id: "quote-reports",
        title: "Quotation Commercial Analytics",
        description: "Commercial pipeline value & quotation metrics",
        href: "/dashboard/quotations/reports",
        icon: TrendingUp,
        category: "Navigation",
        roleCheck: isAdmin || isManager || isCoordinator || isExecutive,
      },
      {
        id: "terms",
        title: "Terms & Conditions Master",
        description: "Configure commercial terms and payment defaults",
        href: "/dashboard/quotations/terms",
        icon: BookOpen,
        category: "Navigation",
        roleCheck: isAdmin || isManager || isCoordinator,
      },
      {
        id: "team-manager",
        title: "Team Hierarchy & Structure",
        description: "Manage sales reps, territories & assignments",
        href: "/dashboard/team-manager",
        icon: Network,
        category: "Navigation",
        roleCheck: isAdmin || isManager || isCoordinator,
      },
      {
        id: "profile",
        title: "User Profile & Security",
        description: "Account settings, portal role and active sessions",
        href: "/dashboard/profile",
        icon: User,
        category: "Navigation",
        roleCheck: true,
      },
    ];

    return actions.filter((a) => a.roleCheck);
  }, [isAdmin, isManager, isCoordinator, isExecutive]);

  // Filtered navigation actions based on user query
  const filteredNavActions = useMemo(() => {
    if (!query) return navActions;
    const q = query.toLowerCase();
    return navActions.filter(
      (a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    );
  }, [navActions, query]);

  // Combine items for keyboard arrow navigation
  const totalNavCount = filteredNavActions.length;
  const totalLeadCount = leads.length;
  const totalItems = totalNavCount + totalLeadCount;

  const navigateTo = (href: string) => {
    onClose();
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (totalItems > 0 ? (prev + 1) % totalItems : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (totalItems > 0 ? (prev - 1 + totalItems) % totalItems : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex < totalNavCount) {
        const item = filteredNavActions[selectedIndex];
        if (item) navigateTo(item.href);
      } else {
        const leadItem = leads[selectedIndex - totalNavCount];
        if (leadItem) navigateTo(`/dashboard/leads/${leadItem._id}`);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:pt-20 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header Search Input */}
        <div className="relative flex items-center border-b border-border px-4 py-3.5">
          <Search className="h-5 w-5 text-muted shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, page name, or search leads..."
            className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-muted hover:text-foreground mr-2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center rounded-md border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
          {/* Matched Leads Section (if searching) */}
          {debouncedQuery.length >= 2 && (
            <div>
              <div className="flex items-center justify-between px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary" /> Matched Leads
                </span>
                {isSearchingLeads && <span className="text-[10px] animate-pulse">Searching…</span>}
              </div>

              {leads.length > 0 ? (
                <div className="mt-1 space-y-1">
                  {leads.map((lead, idx) => {
                    const itemIndex = totalNavCount + idx;
                    const isSelected = selectedIndex === itemIndex;
                    const orgName = lead.company_name || (lead as any).organization_name;

                    return (
                      <div
                        key={lead._id}
                        onClick={() => navigateTo(`/dashboard/leads/${lead._id}`)}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs cursor-pointer transition ${
                          isSelected
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "hover:bg-surface-muted text-foreground border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted">
                            <Users className="h-4 w-4" />
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground truncate">
                                {lead.name || "Untitled Lead"}
                              </span>
                              {lead.lead_no && (
                                <span className="text-[10px] font-mono text-muted">
                                  #{lead.lead_no}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted truncate mt-0.5">
                              {orgName && (
                                <span className="flex items-center gap-1 truncate">
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  {orgName}
                                </span>
                              )}
                              {lead.phone && (
                                <span className="flex items-center gap-1 shrink-0">
                                  <Phone className="h-3 w-3 shrink-0" />
                                  {lead.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                            {lead.status?.replace("_", " ") || "New"}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                !isSearchingLeads && (
                  <p className="px-3 py-2 text-xs text-muted">
                    No leads matching &ldquo;{debouncedQuery}&rdquo;.
                  </p>
                )
              )}
            </div>
          )}

          {/* Navigation & Actions Section */}
          <div>
            <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted">
              Navigation &amp; Actions
            </div>

            <div className="mt-1 space-y-1">
              {filteredNavActions.map((action, idx) => {
                const Icon = action.icon;
                const isSelected = selectedIndex === idx;

                return (
                  <div
                    key={action.id}
                    onClick={() => navigateTo(action.href)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs cursor-pointer transition ${
                      isSelected
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "hover:bg-surface-muted text-foreground border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-primary text-white"
                            : "bg-surface-muted text-muted"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-foreground truncate">
                          {action.title}
                        </p>
                        <p className="text-[11px] text-muted truncate">
                          {action.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-muted">
                      <span className="rounded-md border border-border bg-card px-1.5 py-0.5">
                        {action.category}
                      </span>
                      {isSelected && (
                        <CornerDownLeft className="h-3 w-3 text-primary ml-1" />
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredNavActions.length === 0 && (
                <div className="p-6 text-center text-xs text-muted">
                  No actions matching &ldquo;{query}&rdquo;.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between border-t border-border bg-surface-muted/50 px-4 py-2.5 text-[11px] text-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px]">↑</kbd>
              <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px]">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px]">↵</kbd>
              to select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px]">esc</kbd>
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
