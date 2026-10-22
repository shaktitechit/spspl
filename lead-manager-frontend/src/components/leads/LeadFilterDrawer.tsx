"use client";

import React from "react";
import { X, Filter, RotateCcw, Check, Calendar, MapPin, User, Building2 } from "lucide-react";
import { LEAD_DEPARTMENT_OPTIONS, getLeadManagerPortalRole, isUserInLeadManagerPortal } from "./leadUtils";

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  priorityFilter: string;
  setPriorityFilter: (val: string) => void;
  departmentFilter: string;
  setDepartmentFilter: (val: string) => void;
  sourceFilter: string;
  setSourceFilter: (val: string) => void;
  salesUserFilter: string;
  setSalesUserFilter: (val: string) => void;
  createdByFilter: string;
  setCreatedByFilter: (val: string) => void;
  cityFilter: string;
  setCityFilter: (val: string) => void;
  followUpFilter: "" | "today" | "overdue" | "upcoming";
  setFollowUpFilter: (val: "" | "today" | "overdue" | "upcoming") => void;
  fromDate: string;
  setFromDate: (val: string) => void;
  toDate: string;
  setToDate: (val: string) => void;
  onClear: () => void;
  sources?: Array<{ _id: string; name: string }>;
  assignableUsers?: Array<{ _id: string; name: string; department?: string }>;
  allUsers?: Array<{ _id: string; name: string; department?: string }>;
  isAdmin: boolean;
  canFilterRep: boolean;
  activeFilterCount: number;
}

export function LeadFilterDrawer({
  open,
  onClose,
  priorityFilter,
  setPriorityFilter,
  departmentFilter,
  setDepartmentFilter,
  sourceFilter,
  setSourceFilter,
  salesUserFilter,
  setSalesUserFilter,
  createdByFilter,
  setCreatedByFilter,
  cityFilter,
  setCityFilter,
  followUpFilter,
  setFollowUpFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  onClear,
  sources = [],
  assignableUsers = [],
  allUsers = [],
  isAdmin,
  canFilterRep,
  activeFilterCount,
}: FilterDrawerProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col bg-card border-l border-border shadow-2xl animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Filter Leads</h3>
              <p className="text-[11px] text-muted">
                {activeFilterCount > 0
                  ? `${activeFilterCount} active filter${activeFilterCount > 1 ? "s" : ""}`
                  : "Refine pipeline results"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Priority */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              Priority
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "all", label: "All Priorities" },
                { id: "urgent", label: "Urgent" },
                { id: "high", label: "High" },
                { id: "medium", label: "Medium" },
                { id: "low", label: "Low" },
              ].map((p) => {
                const selected = priorityFilter === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriorityFilter(p.id)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer text-left ${
                      selected
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                        : "border-border bg-card text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              Department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
            >
              <option value="all">All Departments</option>
              {LEAD_DEPARTMENT_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Follow-up State */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              Follow-up Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "", label: "Any State" },
                { id: "overdue", label: "⚠️ Overdue" },
                { id: "today", label: "📅 Due Today" },
                { id: "upcoming", label: "⏳ Upcoming" },
              ].map((f) => {
                const selected = followUpFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFollowUpFilter(f.id as any)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer text-left ${
                      selected
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                        : "border-border bg-card text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              Lead Source
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
            >
              <option value="all">All Sources</option>
              {sources.map((s) => (
                <option key={s._id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assigned Rep */}
          {canFilterRep && (
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                Assigned Team Member
              </label>
              <select
                value={salesUserFilter}
                onChange={(e) => setSalesUserFilter(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
              >
                <option value="all">{isAdmin ? "All Users" : "All Team Members"}</option>
                <option value="unassigned">Unassigned Leads Only</option>
                {assignableUsers.map((u) => {
                  const roleBadge = getLeadManagerPortalRole(u as any);
                  return (
                    <option key={u._id} value={u._id}>
                      {u.name} {roleBadge ? `(${roleBadge})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Created By (Admin Only) */}
          {isAdmin && (
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                Created By
              </label>
              <select
                value={createdByFilter}
                onChange={(e) => setCreatedByFilter(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
              >
                <option value="all">All Creators</option>
                {allUsers.filter(isUserInLeadManagerPortal).map((u) => {
                  const roleBadge = getLeadManagerPortalRole(u as any);
                  return (
                    <option key={u._id} value={u._id}>
                      {u.name} {roleBadge ? `(${roleBadge})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Location / City */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              City / Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="text"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                placeholder="Mumbai, Pune, Delhi..."
                className="w-full rounded-xl border border-border bg-surface-muted/50 pl-9 pr-3 py-2 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
              />
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              Created Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted mb-1 block">From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted/50 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted mb-1 block">To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted/50 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-surface-muted/40 p-4">
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset All
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-hover transition cursor-pointer"
          >
            <Check className="h-4 w-4" />
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
