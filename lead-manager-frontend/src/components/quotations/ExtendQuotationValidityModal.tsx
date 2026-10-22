/**
 * @fileoverview Modal component for extending quotation validity and restoring expired quotations.
 * Upgraded to standard SlideOverDrawer design primitive.
 * @module components/portal/shared/quotations/ExtendQuotationValidityModal
 */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  History,
  ShieldCheck,
  Send,
  FileText,
} from "lucide-react";
import {
  useExtendQuotationValidityMutation,
  type LeadQuotationRecord,
  type QuotationStatus,
} from "@/store/api";
import { toast } from "@/lib/toast";
import { formatCurrencyINR, isQuotationExpired } from "./quotationUtils";
import { SlideOverDrawer } from "@/components/portal/shared/SlideOverDrawer";

type Props = {
  open: boolean;
  onClose: () => void;
  quotation: LeadQuotationRecord | null;
  onSuccess?: (updated: LeadQuotationRecord) => void;
};

const PRESET_OPTIONS = [
  { label: "+7 Days", days: 7 },
  { label: "+15 Days", days: 15 },
  { label: "+30 Days", days: 30 },
  { label: "+60 Days", days: 60 },
];

export function ExtendQuotationValidityModal({
  open,
  onClose,
  quotation,
  onSuccess,
}: Props) {
  const [selectedPreset, setSelectedPreset] = useState<number>(15);
  const [isCustomDate, setIsCustomDate] = useState<boolean>(false);
  const [customDate, setCustomDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [restoreStatus, setRestoreStatus] = useState<QuotationStatus>("sent");

  const [extendValidity, { isLoading }] = useExtendQuotationValidityMutation();

  const isExpired = useMemo(() => isQuotationExpired(quotation), [quotation]);

  // Compute default proposed date
  useEffect(() => {
    if (!open) return;
    setSelectedPreset(15);
    setIsCustomDate(false);
    setReason("");

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 15);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
    const dd = String(targetDate.getDate()).padStart(2, "0");
    setCustomDate(`${yyyy}-${mm}-${dd}`);

    if (quotation) {
      if (
        quotation.approval_status === "approved" ||
        quotation.status === "approved" ||
        quotation.status === "sent"
      ) {
        setRestoreStatus("sent");
      } else {
        setRestoreStatus((quotation.status as QuotationStatus) || "draft");
      }
    }
  }, [open, quotation]);

  const calculatedDate = useMemo(() => {
    if (isCustomDate && customDate) {
      const d = new Date(customDate);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date();
    d.setDate(d.getDate() + selectedPreset);
    return d;
  }, [isCustomDate, customDate, selectedPreset]);

  if (!quotation) return null;

  const currentValidUntil = quotation.valid_until
    ? new Date(quotation.valid_until).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not set";

  const handleSelectPreset = (days: number) => {
    setSelectedPreset(days);
    setIsCustomDate(false);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
    const dd = String(targetDate.getDate()).padStart(2, "0");
    setCustomDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calculatedDate) {
      toast.error("Please provide a valid extension date");
      return;
    }

    try {
      const result = await extendValidity({
        quotationId: quotation._id,
        leadId: typeof quotation.lead === "object" ? quotation.lead?._id : quotation.lead,
        body: {
          valid_until: calculatedDate.toISOString(),
          validity_days: selectedPreset,
          reason: reason.trim() || undefined,
          restore_status: isExpired ? restoreStatus : undefined,
        },
      }).unwrap();

      toast.success(
        `Validity extended to ${calculatedDate.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`
      );
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to extend quotation validity";
      toast.error(msg);
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-2.5">
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-muted transition cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading || !calculatedDate}
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-hover disabled:opacity-50 transition cursor-pointer"
      >
        {isLoading ? (
          <>
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            <span>Updating...</span>
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Confirm Extension</span>
          </>
        )}
      </button>
    </div>
  );

  return (
    <SlideOverDrawer
      open={open}
      onClose={onClose}
      size="md"
      icon={Calendar}
      title="Extend Quotation Validity"
      subtitle={
        <span>
          Quote #{quotation.ref_no || quotation.quotation_no} • {quotation.customer_name || "Customer"}
        </span>
      }
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Expiry Banner Notice */}
        <div
          className={`rounded-2xl p-3.5 text-xs flex items-center gap-3 ${
            isExpired
              ? "bg-rose-50 text-rose-800 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
              : "bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50"
          }`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <span className="font-bold">
              {isExpired ? "Status: Expired" : "Current Validity"}:
            </span>{" "}
            Valid until {currentValidUntil}. Extending validity will re-enable order conversions and customer actions.
          </div>
        </div>

        {/* Quick Presets */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-2">
            Extend By Duration
          </label>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => handleSelectPreset(opt.days)}
                className={`rounded-xl py-2 px-3 text-xs font-bold transition text-center cursor-pointer border ${
                  !isCustomDate && selectedPreset === opt.days
                    ? "bg-primary text-white border-primary shadow-2xs"
                    : "bg-card text-foreground border-border hover:bg-surface-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-foreground">
              Or Select Exact Validity End Date
            </label>
            <button
              type="button"
              onClick={() => setIsCustomDate(!isCustomDate)}
              className="text-[11px] font-bold text-primary hover:underline"
            >
              {isCustomDate ? "Use Presets" : "Pick Date"}
            </button>
          </div>
          <input
            type="date"
            value={customDate}
            onChange={(e) => {
              setCustomDate(e.target.value);
              setIsCustomDate(true);
            }}
            min={new Date().toISOString().split("T")[0]}
            className={`w-full rounded-xl border px-3.5 py-2 text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-hidden bg-card text-foreground ${
              isCustomDate
                ? "border-primary bg-primary/5"
                : "border-border"
            }`}
          />
        </div>

        {/* New Expiry Date Confirmation Card */}
        {calculatedDate && (
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/30 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                New Expiry Date
              </div>
              <div className="text-sm font-black text-foreground">
                {calculatedDate.toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
            <div className="rounded-xl bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs">
              Active for {Math.max(1, Math.ceil((calculatedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days
            </div>
          </div>
        )}

        {/* If Expired: Status Restoration Selection */}
        {isExpired && (
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Restore Quotation Status To
            </label>
            <select
              value={restoreStatus}
              onChange={(e) => setRestoreStatus(e.target.value as QuotationStatus)}
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-hidden text-foreground"
            >
              <option value="sent">Sent to Customer (Active Negotiation)</option>
              <option value="in_negotiation">In Negotiation</option>
              <option value="approved">Approved by Signatory</option>
              <option value="draft">Draft (Needs Re-submission)</option>
            </select>
          </div>
        )}

        {/* Reason / Notes */}
        <div>
          <label className="block text-xs font-bold text-foreground mb-1.5">
            Reason for Extension <span className="text-muted font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Client requested budget approval window extension"
            className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs placeholder:text-muted focus:ring-2 focus:ring-primary focus:outline-hidden text-foreground"
          />
        </div>

        {/* Previous Extension History */}
        {Array.isArray(quotation.validity_extension_history) && quotation.validity_extension_history.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface-muted/50 p-3 text-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted mb-1.5">
              <History className="h-3.5 w-3.5" />
              <span>Extension History ({quotation.validity_extension_history.length})</span>
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-[10px] text-muted scrollbar-none">
              {quotation.validity_extension_history.map((ext, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-border/50 pb-0.5 last:border-0">
                  <span>
                    Extended to {ext.new_valid_until ? new Date(ext.new_valid_until).toLocaleDateString("en-IN") : "N/A"}
                    {ext.reason ? ` (${ext.reason})` : ""}
                  </span>
                  <span className="text-muted">
                    {ext.extended_at ? new Date(ext.extended_at).toLocaleDateString("en-IN") : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </SlideOverDrawer>
  );
}
