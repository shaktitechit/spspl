"use client";

import React from "react";
import { X, Filter, RotateCcw, Check, Calendar, DollarSign, Clock, ShieldCheck, User, Building2 } from "lucide-react";

interface QuotationFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  validityFilter: "" | "valid" | "expiring_soon" | "expired";
  setValidityFilter: (val: "" | "valid" | "expiring_soon" | "expired") => void;
  leadSourceFilter: "" | "linked" | "direct";
  setLeadSourceFilter: (val: "" | "linked" | "direct") => void;
  minAmount: string;
  setMinAmount: (val: string) => void;
  maxAmount: string;
  setMaxAmount: (val: string) => void;
  fromDate: string;
  setFromDate: (val: string) => void;
  toDate: string;
  setToDate: (val: string) => void;
  signatoryFilter: string;
  setSignatoryFilter: (val: string) => void;
  salesRepFilter: string;
  setSalesRepFilter: (val: string) => void;
  signatories?: string[];
  salesReps?: string[];
  onClear: () => void;
  activeFilterCount: number;
}

export function QuotationFilterDrawer({
  open,
  onClose,
  statusFilter,
  setStatusFilter,
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
  salesRepFilter,
  setSalesRepFilter,
  signatories = [],
  salesReps = [],
  onClear,
  activeFilterCount,
}: QuotationFilterDrawerProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
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
              <h3 className="text-sm font-bold text-foreground">Filter Quotations</h3>
              <p className="text-[11px] text-muted">
                {activeFilterCount > 0
                  ? `${activeFilterCount} active filter${activeFilterCount > 1 ? "s" : ""}`
                  : "Refine proposals and commercial pipeline"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
            aria-label="Close filters"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-none">
          {/* Status Facet */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
              Quotation Status
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: "all", label: "All Statuses" },
                { id: "converted", label: "Converted to Order" },
                { id: "pending_approval", label: "Pending Approval" },
                { id: "approved", label: "Approved" },
                { id: "draft", label: "Draft" },
                { id: "sent", label: "Sent" },
                { id: "in_negotiation", label: "In Negotiation" },
                { id: "accepted", label: "Accepted" },
                { id: "on_hold", label: "On Hold" },
                { id: "rejected", label: "Rejected" },
                { id: "expired", label: "Expired" },
              ].map((s) => {
                const selected = statusFilter === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatusFilter(s.id)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer text-left truncate ${
                      selected
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                        : "border-border bg-card text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Validity Status */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted" />
              Validity Window
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "", label: "All Validity" },
                { id: "valid", label: "Active & Valid" },
                { id: "expiring_soon", label: "Expiring Soon (≤3 Days)" },
                { id: "expired", label: "Expired" },
              ].map((v) => {
                const selected = validityFilter === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setValidityFilter(v.id as any)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer text-left ${
                      selected
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                        : "border-border bg-card text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lead Association Source */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted" />
              Quotation Source
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "", label: "All" },
                { id: "linked", label: "CRM Lead Linked" },
                { id: "direct", label: "Direct Quotation" },
              ].map((src) => {
                const selected = leadSourceFilter === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setLeadSourceFilter(src.id as any)}
                    className={`rounded-xl border px-2.5 py-2 text-xs font-semibold transition cursor-pointer text-center truncate ${
                      selected
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                        : "border-border bg-card text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    {src.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Value / Amount Range */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-muted" />
              Grand Total Range (₹)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted font-medium mb-1 block">Min Value</span>
                <input
                  type="number"
                  placeholder="₹ 0"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted font-medium mb-1 block">Max Value</span>
                <input
                  type="number"
                  placeholder="₹ Any"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted" />
              Quotation Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted font-medium mb-1 block">From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted/50 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted font-medium mb-1 block">To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted/50 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Signatory Filter (if options available) */}
          {signatories.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-muted" />
                Authorized Signatory
              </label>
              <select
                value={signatoryFilter}
                onChange={(e) => setSignatoryFilter(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
              >
                <option value="all">All Signatories</option>
                {signatories.map((sig) => (
                  <option key={sig} value={sig}>
                    {sig}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sales Representative Filter (if options available) */}
          {salesReps.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted" />
                Sales Representative
              </label>
              <select
                value={salesRepFilter}
                onChange={(e) => setSalesRepFilter(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-card focus:outline-none"
              >
                <option value="all">All Sales Representatives</option>
                {salesReps.map((rep) => (
                  <option key={rep} value={rep}>
                    {rep}
                  </option>
                ))}
              </select>
            </div>
          )}
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
