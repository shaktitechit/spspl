"use client";

import React from "react";
import { X, CheckCircle2, AlertTriangle, DollarSign } from "lucide-react";
import { formatCurrency, formatPlanDate } from "../workPlanUtils";
import type { WorkPlanTourAdvanceRecord } from "@/types/workPlanner";

interface ApproveAdvanceModalProps {
  advance: WorkPlanTourAdvanceRecord | null;
  open: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ApproveAdvanceModal({
  advance,
  open,
  isLoading,
  onClose,
  onConfirm,
}: ApproveAdvanceModalProps) {
  if (!open || !advance) return null;

  const salesUserName =
    typeof advance.sales_user === "object" && advance.sales_user
      ? advance.sales_user.name
      : "Executive";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-emerald-500/10">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-emerald-600 p-2 text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Approve Tour Advance</h2>
              <p className="text-xs text-muted font-mono">{advance.advance_number}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5 text-xs">
          <p className="text-foreground">
            Are you sure you want to approve this tour advance request for{" "}
            <span className="font-semibold text-foreground">{salesUserName}</span>?
          </p>

          <div className="rounded-xl border border-border bg-surface-muted/50 p-3.5 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted">Requested Amount:</span>
              <span className="font-bold text-foreground">{formatCurrency(advance.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Request Date:</span>
              <span className="font-medium text-foreground">{formatPlanDate(advance.request_date)}</span>
            </div>
            <div className="pt-1 border-t border-border/50">
              <span className="text-muted block text-[10px] uppercase font-semibold">Purpose:</span>
              <p className="font-medium text-foreground mt-0.5">{advance.purpose}</p>
            </div>
          </div>

          <p className="text-[11px] text-muted">
            Once approved, the advance will move to the <strong className="text-sky-600 dark:text-sky-400">Approved (To Disburse)</strong> stage and can be disbursed by Finance/Management.
          </p>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-border px-4 py-2 font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isLoading ? "Approving..." : "Yes, Approve Advance"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
