"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Check,
  Loader2,
  Briefcase,
  MapPin,
  Home,
  Building2,
  Calendar,
  Layers,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useUpdatePlanMutation } from "@/store/api/workPlannerApiSlice";
import { formatPlanDate } from "./workPlanUtils";

export interface ChangePlanTypeModalProps {
  open: boolean;
  planId: string;
  currentPlanType?: string;
  planDate?: string;
  isCompleted?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface PlanTypeOption {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  badgeColor: string;
}

const PLAN_TYPE_OPTIONS: PlanTypeOption[] = [
  {
    id: "Visits",
    label: "Visits",
    description: "Field visits to clients, prospects, and on-site business meetings",
    icon: MapPin,
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    id: "Tasks & Visits",
    label: "Tasks & Visits",
    description: "Combined schedule of field client visits and assigned tasks",
    icon: Layers,
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  {
    id: "Work From Office",
    label: "Work From Office",
    description: "In-office tasks, meetings, operations, and internal projects",
    icon: Building2,
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  {
    id: "Work From Home",
    label: "Work From Home",
    description: "Remote desk work, client calls, documentation, and virtual tasks",
    icon: Home,
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  {
    id: "Leave",
    label: "Leave",
    description: "Approved official leave of absence for the scheduled date",
    icon: Calendar,
    badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
];

export function ChangePlanTypeModal({
  open,
  planId,
  currentPlanType = "Visits",
  planDate,
  isCompleted = false,
  onClose,
  onSuccess,
}: ChangePlanTypeModalProps) {
  const [selectedType, setSelectedType] = useState<string>(currentPlanType || "Visits");
  const [updatePlanMut, { isLoading: saving }] = useUpdatePlanMutation();

  useEffect(() => {
    if (open) {
      setSelectedType(currentPlanType || "Visits");
    }
  }, [open, currentPlanType]);

  if (!open) return null;

  const isUnchanged = selectedType === currentPlanType;

  async function handleSave() {
    if (isUnchanged) {
      onClose();
      return;
    }
    if (isCompleted) {
      toast.error("Completed work plans cannot have their plan type changed.");
      return;
    }

    try {
      await updatePlanMut({
        id: planId,
        body: { plan_type: selectedType as any },
      }).unwrap();

      toast.success(`Plan type updated to "${selectedType}" successfully!`);
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to update plan type";
      toast.error(msg);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs font-sans animate-in fade-in duration-150">
      <div className="w-full sm:max-w-lg max-h-[94vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
        {/* Mobile Drag Indicator Handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-4 sm:px-6 py-3.5 sm:py-4 bg-surface-muted/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground">Change Plan Type</h2>
              <p className="text-[11px] sm:text-xs text-muted truncate">
                {planDate ? `Work Plan for ${formatPlanDate(planDate)}` : "Select a new category for this work plan"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Current Plan Type Pill */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/40 p-3 text-xs">
            <span className="text-muted font-medium">Current Plan Type:</span>
            <span className="font-bold text-foreground bg-surface-muted px-2.5 py-1 rounded-lg border border-border">
              {currentPlanType || "Visits"}
            </span>
          </div>

          {/* Options Grid */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-foreground block">
              Select New Plan Type
            </label>
            <div className="grid gap-2.5">
              {PLAN_TYPE_OPTIONS.map((opt) => {
                const isSelected = selectedType === opt.id;
                const isCurrent = currentPlanType === opt.id;
                const IconComponent = opt.icon;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedType(opt.id)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left active:scale-[0.98] transition cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                        : "border-border hover:bg-surface-muted/60"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${opt.badgeColor}`}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{opt.label}</span>
                        {isCurrent && (
                          <span className="rounded-full bg-surface-muted border border-border px-2 py-0.5 text-[10px] font-semibold text-muted">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                    <div className="shrink-0 mt-0.5">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
                          isSelected
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-card"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advisory Notes */}
          {selectedType === "Leave" && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Setting plan type to <strong>Leave</strong> designates this day as an official leave. Visits and tasks will be hidden from daily execution flows.
              </span>
            </div>
          )}

          {selectedType !== "Leave" && currentPlanType === "Leave" && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Switching away from <strong>Leave</strong> will reactivate active visit and task tracking for this work plan.
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 border-t border-border px-4 sm:px-6 py-3.5 sm:py-4 bg-surface-muted/30 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-full sm:w-auto rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-[0.98] transition cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isUnchanged}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md active:scale-[0.98] transition ${
              isUnchanged
                ? "bg-gray-400 dark:bg-gray-700 cursor-not-allowed opacity-50"
                : "bg-primary hover:bg-primary/90 cursor-pointer"
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Apply Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
