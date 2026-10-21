"use client";

import { useEffect, useState } from "react";

export type NextVisitPlanModalProps = {
  open: boolean;
  isSaving: boolean;
  partyLabel?: string;
  defaultDate?: string;
  currentPlanDate?: string;
  onClose: () => void;
  onConfirm: (planDate: string) => void | Promise<void>;
};

export function NextVisitPlanModal({
  open,
  isSaving,
  partyLabel,
  defaultDate,
  currentPlanDate,
  onClose,
  onConfirm,
}: NextVisitPlanModalProps) {
  const [planDate, setPlanDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setPlanDate(defaultDate || "");
  }, [open, defaultDate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, isSaving, onClose]);

  if (!open) return null;

  const sameAsCurrent =
    Boolean(planDate) &&
    Boolean(currentPlanDate) &&
    planDate === currentPlanDate;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="presentation"
      onClick={() => !isSaving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-md max-h-[92vh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        <div className="border-b border-border px-4 sm:px-5 py-3.5 sm:py-4">
          <h2 className="text-base sm:text-lg font-bold text-foreground">
            Next visit plan
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Pick a work plan date
            {partyLabel ? (
              <>
                {" "}
                for <span className="font-semibold text-foreground">{partyLabel}</span>
              </>
            ) : null}
            . A <span className="font-semibold">new pending visit</span> is created on that day&apos;s plan.
          </p>
        </div>
        <div className="space-y-3 px-4 sm:px-5 py-3.5 sm:py-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">
              Work plan date
            </label>
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {sameAsCurrent ? (
              <p className="mt-1 text-xs text-rose-600">
                Choose a date different from the current work plan.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 border-t border-border px-4 sm:px-5 py-3 bg-surface-muted/50">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-border bg-card px-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground transition hover:bg-surface-muted active:scale-[0.98] disabled:opacity-50 cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving || !planDate || sameAsCurrent}
            onClick={() => void onConfirm(planDate)}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 transition cursor-pointer shadow-md"
          >
            {isSaving ? "Scheduling…" : "Schedule next visit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NextVisitPlanModal;
