"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, MessageSquare } from "lucide-react";
import { formatCurrency, formatPlanDate, EXPENSE_CATEGORY_LABELS } from "@/components/expensePortal/shared/workPlanUtils";
import type { WorkPlanExpenseRecord } from "@/types/workPlanner";

interface ApproveExpenseModalProps {
  expense: { planId: string; expense: WorkPlanExpenseRecord } | null;
  open: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (remarks?: string) => void | Promise<void>;
}

export function ApproveExpenseModal({
  expense,
  open,
  isLoading,
  onClose,
  onConfirm,
}: ApproveExpenseModalProps) {
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (open) {
      setRemarks("");
    }
  }, [open]);

  if (!open || !expense) return null;

  const exp = expense.expense;
  const categoryName = EXPENSE_CATEGORY_LABELS[exp.category] || exp.category;
  const salesUserName =
    typeof exp.sales_user === "object" && exp.sales_user
      ? exp.sales_user.name
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
              <h2 className="text-base font-bold text-foreground">Approve Expense Claim</h2>
              <p className="text-xs text-muted">{categoryName} Claim</p>
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

        {/* Body */}
        <div className="p-5 space-y-3.5 text-xs">
          <p className="text-foreground">
            Are you sure you want to approve this expense claim submitted by{" "}
            <span className="font-semibold text-foreground">{salesUserName}</span>?
          </p>

          <div className="rounded-xl border border-border bg-surface-muted/50 p-3.5 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted">Claim Amount:</span>
              <span className="font-bold text-foreground">{formatCurrency(exp.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Expense Date:</span>
              <span className="font-medium text-foreground">{formatPlanDate(exp.expense_date)}</span>
            </div>
            {exp.description && (
              <div className="pt-1 border-t border-border/50">
                <span className="text-muted block text-[10px] uppercase font-semibold">Description:</span>
                <p className="font-medium text-foreground mt-0.5 line-clamp-2">{exp.description}</p>
              </div>
            )}
          </div>

          {/* Remarks Input */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                <span>Approval Remarks / Audit Notes</span>
              </span>
              <span className="text-[10px] text-muted">Optional</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add audit notes, verification comments, or remarks for this approval..."
              rows={2}
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground placeholder-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <p className="text-[11px] text-muted">
            Once approved, this claim will become eligible for settlement against available tour advances or direct reimbursement payout.
          </p>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-border px-4 py-2 font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onConfirm(remarks.trim() || undefined)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isLoading ? "Approving..." : "Yes, Approve Claim"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
