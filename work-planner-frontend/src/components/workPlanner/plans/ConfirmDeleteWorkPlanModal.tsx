"use client";

import { useEffect } from "react";

export type ConfirmDeleteWorkPlanModalProps = {
  planId: string | null;
  planLabel: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDeleteWorkPlanModal({
  planId,
  planLabel,
  isDeleting,
  onClose,
  onConfirm,
}: ConfirmDeleteWorkPlanModalProps) {
  const open = planId != null && planId !== "";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, isDeleting, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="presentation"
      onClick={() => !isDeleting && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full sm:max-w-md max-h-[92vh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border border-rose-500/30 bg-card shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        <div className="border-b border-border px-4 sm:px-5 py-3.5 sm:py-4 bg-rose-500/10">
          <h2 className="text-base sm:text-lg font-bold text-foreground">
            Delete work plan?
          </h2>
          <p className="mt-1 text-xs text-muted">
            This will soft-delete{" "}
            <span className="font-semibold text-foreground">
              {planLabel.trim() || planId}
            </span>{" "}
            and its visits/expenses.
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 border-t border-border px-4 sm:px-5 py-3 bg-surface-muted/50">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-border bg-card px-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground transition hover:bg-surface-muted active:scale-[0.98] disabled:opacity-50 cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => void onConfirm()}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-rose-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-md"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteWorkPlanModal;
