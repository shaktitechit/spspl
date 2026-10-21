"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  MessageSquare,
  Send,
  Loader2,
  Calendar,
  User,
  History,
  Mail,
  Bell,
  Sparkles,
  Info,
} from "lucide-react";
import { DayEndRichEditor } from "./DayEndRichEditor";
import { formatDateTime, stripHtml } from "./workPlanUtils";
import { readSessionFromStorage, roleLabel } from "@/utils/authStorage";
import type { AuthorityRemarkItem } from "@/types/workPlanner";
import {
  useAddWorkPlanAuthorityRemarkMutation,
  useAddVisitAuthorityRemarkMutation,
  useAddWorkAuthorityRemarkMutation,
  useAddExpenseAuthorityRemarkMutation,
} from "@/store/api/workPlannerApiSlice";
import { toast } from "sonner";

export interface SeniorRemarksModalProps {
  open: boolean;
  itemType: "plan" | "visit" | "task" | "expense";
  title: string;
  planId: string;
  itemId?: string; // visitId, workId, or expenseId
  planDate?: string;
  currentStatus?: string;
  assigneeName?: string;
  initialRemarks?: string;
  authorityRemarksHistory?: AuthorityRemarkItem[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function SeniorRemarksModal({
  open,
  itemType,
  title,
  planId,
  itemId,
  planDate,
  currentStatus,
  assigneeName,
  initialRemarks = "",
  authorityRemarksHistory = [],
  onClose,
  onSuccess,
}: SeniorRemarksModalProps) {
  const sessionUser = readSessionFromStorage()?.user;
  const currentRoleName = roleLabel(sessionUser);

  const [remarks, setRemarks] = useState("");
  const [remarkType, setRemarkType] = useState<"instruction" | "appreciation" | "objection">("instruction");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [expectedFollowupDate, setExpectedFollowupDate] = useState<string>("");

  const [addPlanRemark, { isLoading: isSavingPlan }] = useAddWorkPlanAuthorityRemarkMutation();
  const [addVisitRemark, { isLoading: isSavingVisit }] = useAddVisitAuthorityRemarkMutation();
  const [addWorkRemark, { isLoading: isSavingWork }] = useAddWorkAuthorityRemarkMutation();
  const [addExpenseRemark, { isLoading: isSavingExpense }] = useAddExpenseAuthorityRemarkMutation();

  const isSaving = isSavingPlan || isSavingVisit || isSavingWork || isSavingExpense;

  useEffect(() => {
    if (open) {
      setRemarks(initialRemarks || "");
      setRemarkType("instruction");
      setPriority("medium");
      setExpectedFollowupDate("");
    }
  }, [open, initialRemarks]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = remarks.trim();
    if (!clean || clean === "<p></p>") {
      toast.error("Please enter a senior remark or directive.");
      return;
    }

    try {
      const payload = {
        manager_remarks: clean,
        remark_type: remarkType,
        priority,
        expected_followup_date: expectedFollowupDate || undefined,
      };

      if (itemType === "plan") {
        await addPlanRemark({
          planId,
          body: payload,
        }).unwrap();
      } else if (itemType === "visit") {
        if (!itemId) throw new Error("Missing visit ID");
        await addVisitRemark({
          planId,
          visitId: itemId,
          body: payload,
        }).unwrap();
      } else if (itemType === "expense") {
        if (!itemId) throw new Error("Missing expense ID");
        await addExpenseRemark({
          planId,
          expenseId: itemId,
          body: payload,
        }).unwrap();
      } else {
        if (!itemId) throw new Error("Missing task ID");
        await addWorkRemark({
          planId,
          workId: itemId,
          body: payload,
        }).unwrap();
      }

      const typeMsg =
        remarkType === "appreciation"
          ? "Appreciation posted"
          : remarkType === "objection"
          ? "Objection recorded"
          : "Senior directive saved";

      toast.success(
        `${typeMsg}. Email & in-app notice dispatched to ${assigneeName || "executive"}.`
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to record senior remark");
    }
  };

  const typeLabel =
    itemType === "visit"
      ? "Field Visit"
      : itemType === "task"
      ? "Work Task"
      : itemType === "expense"
      ? "Expense Claim"
      : "Work Plan";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col w-full sm:max-w-2xl max-h-[94vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/15 via-surface-muted/30 to-transparent px-4 sm:px-6 py-3.5 sm:py-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                  Senior Directive
                </h3>
                <span className="rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary shrink-0">
                  {typeLabel}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted truncate">
                Official supervisory instructions &amp; guidance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Target Item Meta Card */}
          <div className="rounded-xl border border-border bg-surface-muted/30 p-3 sm:p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground truncate max-w-[340px]">
                {title || `${typeLabel} Details`}
              </span>
              {currentStatus && (
                <span className="rounded-md bg-secondary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground border border-secondary/30">
                  Status: {currentStatus.replace("_", " ")}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted pt-1 border-t border-border/50">
              {assigneeName && (
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Concerned Executive: <strong className="text-foreground">{assigneeName}</strong>
                  </span>
                </div>
              )}
              {planDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Plan Date: <strong className="text-foreground">{planDate}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Automated Notification Alert Banner */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 flex items-start gap-2.5 text-xs text-muted">
            <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold shrink-0 mt-0.5">
              <Mail className="h-4 w-4" />
              <Bell className="h-4 w-4" />
            </div>
            <p className="leading-relaxed">
              Submitting will automatically record this directive under your name (
              <strong className="text-foreground">{sessionUser?.name || "Senior"}</strong> &bull;{" "}
              <span className="text-primary font-semibold">{currentRoleName}</span>
              ) and trigger an <strong className="text-foreground">instant Email</strong> and{" "}
              <strong className="text-foreground">In-App Alert</strong> to the concerned executive.
            </p>
          </div>

          {/* Remark Classification (Directive vs Appreciation vs Objection) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Remark Intent &amp; Category <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-muted">Select intent type</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRemarkType("instruction")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition cursor-pointer ${
                  remarkType === "instruction"
                    ? "bg-primary/15 border-primary/40 text-primary shadow-xs"
                    : "border-border bg-surface-muted/50 text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Directive / Guidance</span>
              </button>

              <button
                type="button"
                onClick={() => setRemarkType("appreciation")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition cursor-pointer ${
                  remarkType === "appreciation"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30"
                    : "border-border bg-surface-muted/50 text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <span>⭐ Appreciation</span>
              </button>

              <button
                type="button"
                onClick={() => setRemarkType("objection")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition cursor-pointer ${
                  remarkType === "objection"
                    ? "bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 shadow-xs ring-1 ring-rose-500/30"
                    : "border-border bg-surface-muted/50 text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                <Info className="h-4 w-4 text-rose-500" />
                <span>⚠️ Objection</span>
              </button>
            </div>
          </div>

          {/* Priority & Expected Follow-up Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
              >
                <option value="low">🟢 Low Priority</option>
                <option value="medium">🔵 Medium Priority (Standard)</option>
                <option value="high">🟠 High Priority</option>
                <option value="urgent">🔴 Urgent / Critical Attention</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Expected Follow-up Date</span>
                <span className="text-[10px] text-muted">Optional</span>
              </label>
              <input
                type="date"
                value={expectedFollowupDate}
                onChange={(e) => setExpectedFollowupDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Directive Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                <span>
                  {remarkType === "appreciation"
                    ? "Appreciation & Praise Message"
                    : remarkType === "objection"
                    ? "Objection / Concern Details"
                    : "Senior Instruction / Guidance Note"}{" "}
                  <span className="text-rose-500">*</span>
                </span>
              </span>
              <span className="text-[11px] font-normal text-muted">Rich Text Supported</span>
            </label>
            <DayEndRichEditor
              value={remarks}
              onChange={setRemarks}
              minHeight="140px"
              placeholder={
                remarkType === "appreciation"
                  ? "Type words of commendation, deal congratulations, or appreciation for outstanding work..."
                  : remarkType === "objection"
                  ? "Describe the objection, route deviation, missing details, or required clarification from the executive..."
                  : "Type supervisory directives, review comments, follow-up instructions, or meeting guidance..."
              }
            />
          </div>

          {/* Senior Remarks History */}
          {Array.isArray(authorityRemarksHistory) && authorityRemarksHistory.length > 0 && (
            <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-bold text-foreground">
                    Previous Directives &amp; Remarks ({authorityRemarksHistory.length})
                  </h4>
                </div>
                <span className="text-[10px] text-muted font-medium">Chronological Log</span>
              </div>

              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {authorityRemarksHistory.map((item, idx) => {
                  const authorName =
                    item.user_name ||
                    (typeof item.user === "object" ? item.user?.name : "Senior Authority");
                  const role = item.role || "Senior Authority";
                  const roleLower = String(role).toLowerCase();
                  const badgeTone = roleLower.includes("admin")
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : roleLower.includes("coordinator")
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-primary/15 text-primary border-primary/20";

                  return (
                    <div
                      key={item._id || idx}
                      className="rounded-xl border border-border bg-card p-3 space-y-1.5 text-xs shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{authorName}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeTone}`}
                          >
                            {role}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted">
                          {formatDateTime(item.created_at)}
                        </span>
                      </div>
                      <div
                        className="rich-text-content text-muted text-[11px] prose prose-xs dark:prose-invert max-w-none bg-surface-muted/30 p-2 rounded-lg"
                        dangerouslySetInnerHTML={{ __html: item.remark }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 pt-3 sm:pt-4 border-t border-border">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="w-full sm:w-auto rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground active:scale-[0.98] transition cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md active:scale-[0.98] disabled:opacity-50 transition cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving &amp; Notifying...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Save Directive &amp; Notify Junior
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
