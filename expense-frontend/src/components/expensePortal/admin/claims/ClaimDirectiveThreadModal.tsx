"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  Calendar,
  User,
  Clock,
  Sparkles,
  AlertTriangle,
  FileCheck2,
  Send,
  Loader2,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { formatDateTime } from "@/components/expensePortal/shared/workPlanUtils";
import {
  useAddExpenseAuthorityRemarkMutation,
  useUpdateExpenseAuthorityRemarkStatusMutation,
} from "@/store/api/expenseApiSlice";
import { toast } from "sonner";
import type { SeniorRemarkFeedItem } from "@/types/workPlanner";

export interface ClaimDirectiveThreadModalProps {
  open: boolean;
  item: SeniorRemarkFeedItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ClaimDirectiveThreadModal({
  open,
  item,
  onClose,
  onSuccess,
}: ClaimDirectiveThreadModalProps) {
  const [activeItem, setActiveItem] = useState<SeniorRemarkFeedItem | null>(item);

  useEffect(() => {
    setActiveItem(item);
  }, [item]);

  const [newRemark, setNewRemark] = useState("");
  const [remarkType, setRemarkType] = useState<"instruction" | "appreciation" | "objection">(
    (item?.remark_type as any) || "instruction"
  );
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  const [showResolveInput, setShowResolveInput] = useState(false);
  const [resolutionRemarks, setResolutionRemarks] = useState("");

  useEffect(() => {
    if (activeItem?.remark_type) {
      setRemarkType(activeItem.remark_type);
    }
  }, [activeItem?.remark_type]);

  const [addExpenseRemark, { isLoading: isSubmitting }] = useAddExpenseAuthorityRemarkMutation();
  const [updateStatusMut, { isLoading: isResolving }] = useUpdateExpenseAuthorityRemarkStatusMutation();

  if (!open || !activeItem) return null;

  const isObjection = activeItem.remark_type === "objection";
  const isAppreciation = activeItem.remark_type === "appreciation";
  const isDirective = activeItem.remark_type === "instruction" || (!isObjection && !isAppreciation);
  const isResolved = activeItem.status === "resolved";

  const followups = Array.isArray(activeItem.followup_remarks) ? activeItem.followup_remarks : [];

  const handleResolve = async () => {
    try {
      await updateStatusMut({
        expenseId: activeItem.target_id,
        remark_id: activeItem.remark_id,
        status: "resolved",
        resolution_remarks: resolutionRemarks.trim() || undefined,
      }).unwrap();

      toast.success(
        isObjection
          ? "Objection marked as Resolved & Closed!"
          : "Directive marked as Resolved & Closed!"
      );
      setShowResolveInput(false);
      setResolutionRemarks("");

      setActiveItem((prev: SeniorRemarkFeedItem | null) =>
        prev
          ? {
              ...prev,
              status: "resolved",
              resolved_at: new Date().toISOString(),
              resolved_by_name: "Admin",
              resolution_remarks: resolutionRemarks.trim() || undefined,
            }
          : null
      );
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to resolve query");
    }
  };

  const handleReopen = async () => {
    try {
      await updateStatusMut({
        expenseId: activeItem.target_id,
        remark_id: activeItem.remark_id,
        status: "pending_response",
      }).unwrap();

      toast.success("Query reopened for further clarification.");
      setActiveItem((prev: SeniorRemarkFeedItem | null) =>
        prev
          ? {
              ...prev,
              status: "pending_response",
              resolved_at: null,
              resolved_by_name: "",
              resolution_remarks: "",
            }
          : null
      );
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to reopen query");
    }
  };

  const handleSendNewRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newRemark.trim();
    if (!clean) {
      toast.error("Please enter a remark or follow-up directive.");
      return;
    }

    try {
      await addExpenseRemark({
        planId: activeItem.plan_id || "standalone",
        expenseId: activeItem.target_id,
        body: {
          manager_remarks: clean,
          remark: clean,
          remark_type: remarkType,
          priority,
        },
      }).unwrap();

      toast.success(
        remarkType === "objection"
          ? "Objection recorded on claim."
          : remarkType === "appreciation"
          ? "Appreciation recorded on claim."
          : "Directive recorded on claim."
      );
      setNewRemark("");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to record remark");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col w-full sm:max-w-2xl max-h-[94vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-amber-500/10 via-surface-muted/30 to-transparent px-4 sm:px-6 py-3.5 sm:py-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border ${
                isAppreciation
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : isObjection
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
                  : "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
              }`}
            >
              {isAppreciation ? (
                <Sparkles className="h-5 w-5" />
              ) : isObjection ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                  {isAppreciation
                    ? "Official Appreciation"
                    : isObjection
                    ? "Audit Objection Note"
                    : "Senior Directive Thread"}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold border capitalize shrink-0 ${
                    activeItem.priority === "urgent"
                      ? "bg-rose-500/15 text-rose-600 border-rose-500/30"
                      : activeItem.priority === "high"
                      ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                      : "bg-primary/15 text-primary border-primary/30"
                  }`}
                >
                  {activeItem.priority || "medium"} Priority
                </span>

                {/* Status Badge */}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border shrink-0 ${
                    isResolved
                      ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                      : activeItem.status === "responded"
                      ? "bg-sky-500/15 text-sky-600 border-sky-500/30"
                      : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                  }`}
                >
                  {isResolved
                    ? "✅ Closed & Resolved"
                    : activeItem.status === "responded"
                    ? "💬 Responded (Review Pending)"
                    : "⏳ Action Required"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted truncate mt-0.5">
                {activeItem.title || "Expense Claim Directive"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Item Meta Box */}
          <div className="rounded-xl border border-border bg-surface-muted/30 p-3 sm:p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-foreground truncate">
                {activeItem.title}
              </span>
              <span className="rounded-md bg-secondary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground border border-secondary/30">
                Status: {activeItem.status?.replace("_", " ") || "Pending"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted pt-1 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" />
                <span>
                  Concerned Executive: <strong className="text-foreground">{activeItem.sales_user?.name || "Executive"}</strong>
                </span>
              </div>
              {activeItem.plan_date && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Claim Date: <strong className="text-foreground">{formatDateTime(activeItem.plan_date)}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Resolution Banner (if closed) */}
          {isResolved && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Marked as Resolved &amp; Closed</span>
                </span>
                {activeItem.resolved_at && (
                  <span className="text-[10px] font-normal text-muted">
                    {formatDateTime(activeItem.resolved_at)}
                  </span>
                )}
              </div>
              {activeItem.resolved_by_name && (
                <div className="text-[11px] text-muted">
                  Resolved by: <strong className="text-foreground">{activeItem.resolved_by_name}</strong>
                </div>
              )}
              {activeItem.resolution_remarks && (
                <p className="text-xs text-foreground italic bg-surface-muted/60 p-2 rounded-lg border border-border">
                  &ldquo;{activeItem.resolution_remarks}&rdquo;
                </p>
              )}
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  disabled={isResolving}
                  onClick={handleReopen}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reopen query for clarification</span>
                </button>
              </div>
            </div>
          )}

          {/* Primary Directive / Objection Card */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-xs sm:text-sm">
                  {activeItem.senior_user?.name || "Senior Authority"}
                </span>
                <span className="rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {activeItem.senior_user?.role || "Authority"}
                </span>
              </div>
              <span className="text-[10px] text-muted flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDateTime(activeItem.created_at)}
              </span>
            </div>

            <div
              className="rich-text-content text-xs sm:text-sm text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: activeItem.remark }}
            />
          </div>

          {/* Follow-up responses thread from Executive */}
          {followups.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider text-muted">
                Executive Follow-up &amp; Responses ({followups.length})
              </h4>
              <div className="space-y-2.5">
                {followups.map((f: any, idx: number) => (
                  <div
                    key={f._id || idx}
                    className="rounded-xl border border-border bg-surface-muted/40 p-3 sm:p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{f.user_name || "Executive"}</span>
                        <span className="text-[10px] text-muted font-medium capitalize">
                          ({f.action_status?.replace("_", " ") || "Response"})
                        </span>
                      </div>
                      <span className="text-[10px] text-muted">{formatDateTime(f.created_at)}</span>
                    </div>
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">{f.response}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Resolve Action Panel */}
          {!isResolved && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Resolve &amp; Close {isObjection ? "Objection" : "Directive"}</span>
                  </h4>
                  <p className="text-[11px] text-muted">
                    Satisfied with executive clarification? Mark this audit query resolved.
                  </p>
                </div>

                {!showResolveInput && (
                  <button
                    type="button"
                    onClick={() => setShowResolveInput(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition cursor-pointer shadow-xs shrink-0"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Resolve Now</span>
                  </button>
                )}
              </div>

              {showResolveInput && (
                <div className="space-y-2.5 pt-2.5 border-t border-emerald-500/20">
                  <label className="text-[11px] font-semibold text-foreground block">
                    Resolution note / audit remarks (optional):
                  </label>
                  <textarea
                    value={resolutionRemarks}
                    onChange={(e) => setResolutionRemarks(e.target.value)}
                    rows={2}
                    placeholder="e.g., Bills verified, clarification accepted..."
                    className="w-full rounded-xl border border-emerald-500/30 bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-emerald-500"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowResolveInput(false)}
                      className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isResolving}
                      onClick={handleResolve}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {isResolving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Resolving...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Confirm Resolve</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add New Follow-up Directive / Instruction */}
          <div className="rounded-2xl border border-border bg-surface-muted/30 p-4 space-y-3">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-primary" />
              <span>
                {isObjection
                  ? "Add Follow-up Objection / Directive Note"
                  : "Add Follow-up Instruction / Directive"}
              </span>
            </h4>

            <form onSubmit={handleSendNewRemark} className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={remarkType}
                  onChange={(e) => setRemarkType(e.target.value as any)}
                  className="rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary"
                >
                  <option value="objection">⚠️ Objection Note</option>
                  <option value="instruction">📋 Directive / Guidance</option>
                  <option value="appreciation">⭐ Appreciation</option>
                </select>

                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <textarea
                value={newRemark}
                onChange={(e) => setNewRemark(e.target.value)}
                rows={3}
                placeholder={
                  isObjection
                    ? "Type additional objection note or request for further document clarification..."
                    : "Type additional instruction, review note, or follow-up directive for this claim..."
                }
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !newRemark.trim()}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-50 transition cursor-pointer ${
                    remarkType === "objection"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-primary hover:bg-primary-hover"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>
                        {remarkType === "objection" ? "Post Objection Note" : "Post Directive"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
