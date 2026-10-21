"use client";

import React, { useState } from "react";
import { X, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "../workPlanUtils";
import type { WorkPlanTourAdvanceRecord } from "@/types/workPlanner";

interface RejectAdvanceModalProps {
  advance: WorkPlanTourAdvanceRecord | null;
  open: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function RejectAdvanceModal({
  advance,
  open,
  isLoading,
  onClose,
  onConfirm,
}: RejectAdvanceModalProps) {
  const [reason, setReason] = useState<string>("");

  if (!open || !advance) return null;

  const salesUserName =
    typeof advance.sales_user === "object" && advance.sales_user
      ? advance.sales_user.name
      : "Executive";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please provide a reason for rejecting this tour advance");
      return;
    }
    onConfirm(reason.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-rose-500/10">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-rose-600 p-2 text-white">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Reject Tour Advance</h2>
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="rounded-xl border border-border bg-surface-muted/50 p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Executive:</span>
              <span className="font-semibold text-foreground">{salesUserName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Amount:</span>
              <span className="font-bold text-foreground">{formatCurrency(advance.amount)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Rejection Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="State why this advance request is being rejected..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted p-3 text-xs text-foreground outline-none focus:border-rose-500 transition resize-none"
            />
          </div>

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
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700 disabled:opacity-50 active:scale-95 transition shadow-xs cursor-pointer"
            >
              <XCircle className="h-4 w-4" />
              <span>{isLoading ? "Rejecting..." : "Confirm Rejection"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
