"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Copy,
  Calendar,
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  User,
  Briefcase,
} from "lucide-react";
import { useLazyGetPlansQuery } from "@/store/api/workPlannerApiSlice";
import { formatPlanDate } from "./workPlanUtils";
import { useRouter } from "next/navigation";

export interface CopyWorkPlanModalProps {
  open: boolean;
  sourcePlanId: string;
  sourcePlanDate?: string;
  sourcePlanType?: string;
  sourceExecutiveName?: string;
  sourceSalesUserId?: string;
  onClose: () => void;
  onProceed?: (targetDate: string) => void;
}

export function CopyWorkPlanModal({
  open,
  sourcePlanId,
  sourcePlanDate,
  sourcePlanType = "Visits",
  sourceExecutiveName,
  sourceSalesUserId,
  onClose,
  onProceed,
}: CopyWorkPlanModalProps) {
  const router = useRouter();
  const [lazyGetPlans, { isFetching: checkingDate }] = useLazyGetPlansQuery();

  // Default to tomorrow or today
  const getDefaultTargetDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  const [targetDate, setTargetDate] = useState<string>(getDefaultTargetDate);
  const [existingPlan, setExistingPlan] = useState<{
    id: string;
    status: string;
    visitsCount?: number;
    worksCount?: number;
  } | null>(null);

  // Min selectable date (2 days back from today)
  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d.toISOString().split("T")[0];
  }, []);

  // Reset target date when modal opens
  useEffect(() => {
    if (open) {
      setTargetDate(getDefaultTargetDate());
      setExistingPlan(null);
    }
  }, [open, sourcePlanId]);

  // Check if work plan exists for target date
  useEffect(() => {
    if (!open || !targetDate || !sourceSalesUserId) return;

    let isMounted = true;
    async function checkDate() {
      try {
        const res = await lazyGetPlans({
          date: targetDate,
          sales_user: sourceSalesUserId,
          limit: 1,
        }).unwrap();

        if (!isMounted) return;

        const rawPlans = res?.data || [];
        const active = rawPlans.filter(
          (p: any) => String(p.status) !== "deleted" && !p.deletedAt && !p.is_deleted
        );

        if (active.length > 0) {
          const p = active[0];
          setExistingPlan({
            id: String(p._id || p.id),
            status: String(p.status || "planned"),
            visitsCount: Array.isArray(p.visits) ? p.visits.length : undefined,
            worksCount: Array.isArray(p.works) ? p.works.length : undefined,
          });
        } else {
          setExistingPlan(null);
        }
      } catch {
        if (isMounted) setExistingPlan(null);
      }
    }

    checkDate();
    return () => {
      isMounted = false;
    };
  }, [open, targetDate, sourceSalesUserId, lazyGetPlans]);

  if (!open) return null;

  const isCompletedPlan = existingPlan?.status === "completed";
  const hasActivePlan = existingPlan && !isCompletedPlan;

  const handleConfirm = () => {
    if (isCompletedPlan) return;
    if (onProceed) {
      onProceed(targetDate);
    } else {
      router.push(`/dashboard/plans/new?copy=${sourcePlanId}&date=${targetDate}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 font-sans animate-in fade-in duration-150">
      <div className="w-full sm:max-w-md max-h-[94vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 overflow-y-auto">
        {/* Mobile Drag Indicator Handle */}
        <div className="flex justify-center -mt-1 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Copy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground">Copy Work Plan</h2>
              <p className="text-[11px] sm:text-xs text-muted">
                Duplicate visits and tasks to another plan date
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground active:scale-95 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source Plan Info Card */}
        <div className="rounded-xl border border-border bg-surface-muted/50 p-3.5 space-y-2 text-xs">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            Source Plan Details
          </div>
          <div className="grid grid-cols-2 gap-2 text-foreground">
            <div>
              <span className="text-muted block text-[11px]">Original Date:</span>
              <span className="font-semibold">
                {sourcePlanDate ? formatPlanDate(sourcePlanDate) : "—"}
              </span>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Plan Type:</span>
              <span className="font-semibold">{sourcePlanType}</span>
            </div>
            {sourceExecutiveName && (
              <div className="col-span-2 pt-1 border-t border-border/50">
                <span className="text-muted block text-[11px]">Executive:</span>
                <span className="font-semibold">{sourceExecutiveName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Target Date Picker & Existence Check */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Select Target Date to Copy Into <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                min={minDate}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground focus:border-primary focus:outline-hidden"
              />
            </div>
          </div>

          {/* Date Collision / Existence Feedback Banner */}
          <div className="min-h-[52px]">
            {checkingDate ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted p-3 text-xs text-muted">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Checking if a work plan exists for {formatPlanDate(targetDate)}...</span>
              </div>
            ) : isCompletedPlan ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                <div>
                  <span className="font-bold">Completed Plan Already Exists:</span>
                  <p className="mt-0.5 leading-relaxed">
                    A work plan for {formatPlanDate(targetDate)} is already completed and locked. Please pick a different date.
                  </p>
                </div>
              </div>
            ) : hasActivePlan ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <span className="font-bold">
                    Existing Plan Found ({existingPlan.status.toUpperCase()}):
                  </span>
                  <p className="mt-0.5 leading-relaxed">
                    A work plan already exists for {formatPlanDate(targetDate)}. Copied items will be loaded to merge into this active plan.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>
                  No existing plan on {formatPlanDate(targetDate)}. A new work plan will be created.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground active:scale-[0.98] transition cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={checkingDate || isCompletedPlan || !targetDate}
            onClick={handleConfirm}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 transition cursor-pointer"
          >
            <span>
              {hasActivePlan ? "Merge & Proceed to Form" : "Proceed to Copy Form"}
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default CopyWorkPlanModal;
