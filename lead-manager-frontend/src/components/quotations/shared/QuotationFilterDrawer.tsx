"use client";

import React from "react";
import {
  X,
  Filter,
  RotateCcw,
  Search,
} from "lucide-react";
import { useLeadDepartmentOptions } from "@/components/leads/useLeadDepartmentOptions";
import {
  SearchableMultiSelect,
  type MultiSelectOption,
} from "@/components/leads/shared/LeadFilterDrawer";

interface QuotationFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  statusFilter: string[];
  setStatusFilter: (val: string[]) => void;
  departmentFilter: string[];
  setDepartmentFilter: (val: string[]) => void;
  validityFilter: string[];
  setValidityFilter: (val: string[]) => void;
  leadSourceFilter: string[];
  setLeadSourceFilter: (val: string[]) => void;
  minAmount: string;
  setMinAmount: (val: string) => void;
  maxAmount: string;
  setMaxAmount: (val: string) => void;
  fromDate: string;
  setFromDate: (val: string) => void;
  toDate: string;
  setToDate: (val: string) => void;
  signatoryFilter: string[];
  setSignatoryFilter: (val: string[]) => void;
  primaryRepFilter: string[];
  setPrimaryRepFilter: (val: string[]) => void;
  secondaryRepFilter: string[];
  setSecondaryRepFilter: (val: string[]) => void;
  createdByFilter: string[];
  setCreatedByFilter: (val: string[]) => void;
  signatoryOptions?: MultiSelectOption[];
  primaryRepOptions?: MultiSelectOption[];
  secondaryRepOptions?: MultiSelectOption[];
  createdByOptions?: MultiSelectOption[];
  onClear: () => void;
  activeFilterCount: number;
}

const QUOTATION_STATUS_OPTIONS: MultiSelectOption[] = [
  { value: "converted", label: "Converted to Order" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "in_negotiation", label: "In Negotiation" },
  { value: "accepted", label: "Accepted" },
  { value: "on_hold", label: "On Hold" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

const VALIDITY_OPTIONS: MultiSelectOption[] = [
  { value: "valid", label: "Active & Valid" },
  { value: "expiring_soon", label: "Expiring Soon (≤3 Days)" },
  { value: "expired", label: "Expired" },
];

const SOURCE_OPTIONS: MultiSelectOption[] = [
  { value: "linked", label: "CRM Lead Linked" },
  { value: "direct", label: "Direct Quotation" },
];

export function QuotationFilterDrawer({
  open,
  onClose,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  departmentFilter,
  setDepartmentFilter,
  validityFilter,
  setValidityFilter,
  leadSourceFilter,
  setLeadSourceFilter,
  minAmount,
  setMinAmount,
  maxAmount,
  setMaxAmount,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  signatoryFilter,
  setSignatoryFilter,
  primaryRepFilter,
  setPrimaryRepFilter,
  secondaryRepFilter,
  setSecondaryRepFilter,
  createdByFilter,
  setCreatedByFilter,
  signatoryOptions = [],
  primaryRepOptions = [],
  secondaryRepOptions = [],
  createdByOptions = [],
  onClear,
  activeFilterCount,
}: QuotationFilterDrawerProps) {
  const { departmentOptions } = useLeadDepartmentOptions(departmentFilter);

  if (!open) return null;

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
              <h3 className="text-sm font-bold text-foreground">Filter Quotations</h3>
              <p className="text-[11px] text-muted">
                {activeFilterCount > 0
                  ? `${activeFilterCount} active filter${activeFilterCount > 1 ? "s" : ""}`
                  : "Search, multi-select, and filter by sales reps, signatory, value, or date ranges"}
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
          {/* Row 1: Search + Status + Department + Source + Validity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {/* Search Quotations */}
            <div className="sm:col-span-2 lg:col-span-2 xl:col-span-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                Search Quotations
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Quote #, customer, subject..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted/40 pl-8 pr-7 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <SearchableMultiSelect
              label="Quotation Status"
              placeholder="All statuses"
              options={QUOTATION_STATUS_OPTIONS}
              selected={statusFilter}
              onChange={setStatusFilter}
            />

            <SearchableMultiSelect
              label="Department"
              placeholder="All departments"
              options={departmentOptions}
              selected={departmentFilter}
              onChange={setDepartmentFilter}
            />

            <SearchableMultiSelect
              label="Quotation Source"
              placeholder="All sources"
              options={SOURCE_OPTIONS}
              selected={leadSourceFilter}
              onChange={setLeadSourceFilter}
            />

            <SearchableMultiSelect
              label="Validity Window"
              placeholder="All validity"
              options={VALIDITY_OPTIONS}
              selected={validityFilter}
              onChange={setValidityFilter}
            />
          </div>

          {/* Row 2: Primary Sales Rep + Secondary Sales Reps + Authorized Signatory + Created By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-border/50">
            <SearchableMultiSelect
              label="Primary Sales Rep"
              placeholder="All primary reps"
              options={primaryRepOptions}
              selected={primaryRepFilter}
              onChange={setPrimaryRepFilter}
            />

            <SearchableMultiSelect
              label="Secondary Sales Reps"
              placeholder="All secondary reps"
              options={secondaryRepOptions}
              selected={secondaryRepFilter}
              onChange={setSecondaryRepFilter}
            />

            <SearchableMultiSelect
              label="Authorized Signatory"
              placeholder="All signatories"
              options={signatoryOptions}
              selected={signatoryFilter}
              onChange={setSignatoryFilter}
            />

            <SearchableMultiSelect
              label="Created By"
              placeholder="All creators"
              options={createdByOptions}
              selected={createdByFilter}
              onChange={setCreatedByFilter}
            />
          </div>

          {/* Row 3: Grand Total Range + Quotation Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-border/50">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                Min Grand Total (₹)
              </label>
              <input
                type="number"
                placeholder="₹ 0"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted/40 px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                Max Grand Total (₹)
              </label>
              <input
                type="number"
                placeholder="₹ Any"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted/40 px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                Quote Date From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted/40 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                Quote Date To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted/40 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
