"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Filter, RotateCcw, Check, Search, ChevronDown } from "lucide-react";
import { getLeadManagerPortalRole, getDeptLabel, DEFAULT_INDUSTRIES } from "../leadUtils";
import { useLeadDepartmentOptions } from "../useLeadDepartmentOptions";

export type MultiSelectOption = {
  value: string;
  label: string;
  sublabel?: string;
};

interface SearchableMultiSelectProps {
  label: string;
  placeholder?: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export function SearchableMultiSelect({
  label,
  placeholder = "Search & select...",
  options,
  selected,
  onChange,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  const toggle = (val: string) => {
    onChange(
      selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]
    );
  };

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return selected.map((v) => map.get(v) || v);
  }, [options, selected]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-muted">
          {label}
        </label>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] font-semibold text-rose-500 hover:underline cursor-pointer"
          >
            Clear ({selected.length})
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs transition cursor-pointer ${selected.length > 0
          ? "border-primary/50 bg-primary/5 text-foreground font-semibold"
          : "border-border bg-surface-muted/50 text-muted hover:bg-surface-muted"
          }`}
      >
        <span className="truncate">
          {selected.length === 0
            ? placeholder
            : selected.length === 1
              ? selectedLabels[0]
              : `${selected.length} selected (${selectedLabels.slice(0, 2).join(", ")}${selected.length > 2 ? "..." : ""
              })`}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-xl border border-border bg-card shadow-2xl">
          <div className="border-b border-border p-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to filter..."
                autoFocus
                className="w-full rounded-lg border border-border bg-surface-muted/50 pl-7 pr-2 py-1 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-44 overflow-y-auto p-1 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-2 text-[11px] text-muted text-center">
                No matches found
              </div>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition cursor-pointer ${isSelected
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover:bg-surface-muted"
                      }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{opt.label}</div>
                      {opt.sublabel && (
                        <div className="truncate text-[10px] text-muted">{opt.sublabel}</div>
                      )}
                    </div>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isSelected
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-card"
                        }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const PIPELINE_STATUS_OPTIONS: MultiSelectOption[] = [
  { value: "new", label: "New" },
  { value: "assigned", label: "Assigned" },
  { value: "follow_up", label: "Follow Up" },
  { value: "quotation", label: "Quotation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "converted", label: "Converted" },
];

const PRIORITY_OPTIONS: MultiSelectOption[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const INDUSTRY_MULTI_SELECT_OPTIONS: MultiSelectOption[] = DEFAULT_INDUSTRIES.map((ind) => ({
  value: ind,
  label: ind,
}));

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  search: string;
  setSearch: (val: string) => void;
  contactOrgFilter: string[];
  setContactOrgFilter: (val: string[]) => void;
  departmentFilter: string[];
  setDepartmentFilter: (val: string[]) => void;
  sourceFilter: string[];
  setSourceFilter: (val: string[]) => void;
  industryFilter?: string[];
  setIndustryFilter?: (val: string[]) => void;
  statusFilter: string[];
  setStatusFilter: (val: string[]) => void;
  priorityFilter: string[];
  setPriorityFilter: (val: string[]) => void;
  primaryAssigneeFilter: string[];
  setPrimaryAssigneeFilter: (val: string[]) => void;
  secondaryAssigneeFilter: string[];
  setSecondaryAssigneeFilter: (val: string[]) => void;
  productFilter: string[];
  setProductFilter: (val: string[]) => void;
  createdByFilter: string[];
  setCreatedByFilter: (val: string[]) => void;
  minQty: string;
  setMinQty: (val: string) => void;
  maxQty: string;
  setMaxQty: (val: string) => void;
  minValue: string;
  setMinValue: (val: string) => void;
  maxValue: string;
  setMaxValue: (val: string) => void;
  followUpFrom: string;
  setFollowUpFrom: (val: string) => void;
  followUpTo: string;
  setFollowUpTo: (val: string) => void;
  fromDate: string;
  setFromDate: (val: string) => void;
  toDate: string;
  setToDate: (val: string) => void;
  onClear: () => void;
  contactOrgOptions?: MultiSelectOption[];
  productOptions?: MultiSelectOption[];
  sources?: Array<{ _id: string; name: string }>;
  assignableUsers?: Array<{
    _id: string;
    name: string;
    department?: string;
    role?: string;
    portals?: Array<{ portal_code?: string; portal?: string; access_roles?: string[] }>;
  }>;
  allUsers?: Array<{
    _id: string;
    name: string;
    department?: string;
    role?: string;
    portals?: Array<{ portal_code?: string; portal?: string; access_roles?: string[] }>;
  }>;
  isAdmin: boolean;
  canFilterRep: boolean;
  showPricing?: boolean;
  activeFilterCount: number;
}

export function LeadFilterDrawer({
  open,
  onClose,
  search,
  setSearch,
  contactOrgFilter,
  setContactOrgFilter,
  departmentFilter,
  setDepartmentFilter,
  sourceFilter,
  setSourceFilter,
  industryFilter = [],
  setIndustryFilter,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  primaryAssigneeFilter,
  setPrimaryAssigneeFilter,
  secondaryAssigneeFilter,
  setSecondaryAssigneeFilter,
  productFilter,
  setProductFilter,
  createdByFilter,
  setCreatedByFilter,
  minQty,
  setMinQty,
  maxQty,
  setMaxQty,
  minValue,
  setMinValue,
  maxValue,
  setMaxValue,
  followUpFrom,
  setFollowUpFrom,
  followUpTo,
  setFollowUpTo,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  onClear,
  contactOrgOptions = [],
  productOptions = [],
  sources = [],
  assignableUsers = [],
  allUsers = [],
  isAdmin,
  canFilterRep,
  showPricing = true,
  activeFilterCount,
}: FilterDrawerProps) {
  const { departmentOptions } = useLeadDepartmentOptions(departmentFilter);

  if (!open) return null;

  const sourceOptions: MultiSelectOption[] = sources.map((s) => ({
    value: s.name,
    label: s.name,
  }));

  const primaryAssigneeOptions: MultiSelectOption[] = [
    { value: "unassigned", label: "Unassigned" },
    ...assignableUsers.map((u) => ({
      value: u._id,
      label: u.name,
      sublabel: [getLeadManagerPortalRole(u), u.department ? getDeptLabel(u.department) : ""]
        .filter(Boolean)
        .join(" • "),
    })),
  ];

  const secondaryAssigneeOptions: MultiSelectOption[] = assignableUsers.map((u) => ({
    value: u._id,
    label: u.name,
    sublabel: [getLeadManagerPortalRole(u), u.department ? getDeptLabel(u.department) : ""]
      .filter(Boolean)
      .join(" • "),
  }));

  const createdByOptions: MultiSelectOption[] = (allUsers.length > 0 ? allUsers : assignableUsers).map((u) => ({
    value: u._id,
    label: u.name,
    sublabel: u.department ? getDeptLabel(u.department) : undefined,
  }));

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-top-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Filter Leads</h3>
              <p className="text-[11px] text-muted">
                {activeFilterCount > 0
                  ? `${activeFilterCount} active filter${activeFilterCount > 1 ? "s" : ""}`
                  : "Search, multi-select, and filter by quantity, value, or date ranges"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset All</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary-hover transition cursor-pointer"
            >
              Apply &amp; Close
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Horizontal Grid Body */}
        <div className="p-4 space-y-3">
          {/* Row 1: Search Leads + Multi-Selects */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {/* Search for leads */}
            <div className="sm:col-span-2 lg:col-span-2 xl:col-span-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                Search Leads
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Lead No, name, phone, req..."
                  className="w-full rounded-xl border border-border bg-surface-muted/50 pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-2 text-muted hover:text-foreground cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <SearchableMultiSelect
              label="Contact & Organization"
              placeholder="All contacts / orgs"
              options={contactOrgOptions}
              selected={contactOrgFilter}
              onChange={setContactOrgFilter}
            />

            <SearchableMultiSelect
              label="Departments"
              placeholder="All departments"
              options={departmentOptions}
              selected={departmentFilter}
              onChange={setDepartmentFilter}
            />

            <SearchableMultiSelect
              label="Source"
              placeholder="All sources"
              options={sourceOptions}
              selected={sourceFilter}
              onChange={setSourceFilter}
            />

            {setIndustryFilter && (
              <SearchableMultiSelect
                label="Industry / Domain"
                placeholder="All industries"
                options={INDUSTRY_MULTI_SELECT_OPTIONS}
                selected={industryFilter}
                onChange={setIndustryFilter}
              />
            )}

            <SearchableMultiSelect
              label="Pipeline Status"
              placeholder="All statuses"
              options={PIPELINE_STATUS_OPTIONS}
              selected={statusFilter}
              onChange={setStatusFilter}
            />

            <SearchableMultiSelect
              label="Priority"
              placeholder="All priorities"
              options={PRIORITY_OPTIONS}
              selected={priorityFilter}
              onChange={setPriorityFilter}
            />

            {canFilterRep && (
              <>
                <SearchableMultiSelect
                  label="Primary Assignee"
                  placeholder="All primary assignees"
                  options={primaryAssigneeOptions}
                  selected={primaryAssigneeFilter}
                  onChange={setPrimaryAssigneeFilter}
                />

                <SearchableMultiSelect
                  label="Secondary Assignees"
                  placeholder="All secondary assignees"
                  options={secondaryAssigneeOptions}
                  selected={secondaryAssigneeFilter}
                  onChange={setSecondaryAssigneeFilter}
                />
              </>
            )}

            <SearchableMultiSelect
              label="Required Products"
              placeholder="All products"
              options={productOptions}
              selected={productFilter}
              onChange={setProductFilter}
            />

            {isAdmin && (
              <SearchableMultiSelect
                label="Created By"
                placeholder="All creators"
                options={createdByOptions}
                selected={createdByFilter}
                onChange={setCreatedByFilter}
              />
            )}
          </div>

          {/* Row 2: Range Filters (Est. Qty, Est. Value, Follow-Up Date, Created Date) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-border/70 pt-3">
            {/* Est. Qty Range */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                Est. Qty Range
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={minQty}
                  onChange={(e) => setMinQty(e.target.value)}
                  placeholder="Min Qty"
                  className="w-full rounded-xl border border-border bg-surface-muted/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none"
                />
                <input
                  type="number"
                  min={0}
                  value={maxQty}
                  onChange={(e) => setMaxQty(e.target.value)}
                  placeholder="Max Qty"
                  className="w-full rounded-xl border border-border bg-surface-muted/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none"
                />
              </div>
            </div>

            {/* Est. Value Range */}
            {showPricing && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                  Est. Value Range (₹)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={minValue}
                    onChange={(e) => setMinValue(e.target.value)}
                    placeholder="Min ₹"
                    className="w-full rounded-xl border border-border bg-surface-muted/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    value={maxValue}
                    onChange={(e) => setMaxValue(e.target.value)}
                    placeholder="Max ₹"
                    className="w-full rounded-xl border border-border bg-surface-muted/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Follow-up Date Range */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                Follow-Up Date Range
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="date"
                  value={followUpFrom}
                  onChange={(e) => setFollowUpFrom(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted/50 px-2 py-1.5 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
                />
                <input
                  type="date"
                  value={followUpTo}
                  onChange={(e) => setFollowUpTo(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted/50 px-2 py-1.5 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
                />
              </div>
            </div>

            {/* Created Date Range */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                Created Date Range
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted/50 px-2 py-1.5 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted/50 px-2 py-1.5 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
