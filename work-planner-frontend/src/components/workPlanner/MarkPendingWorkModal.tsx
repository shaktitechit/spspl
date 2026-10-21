"use client";

import { useEffect, useState } from "react";

export type MarkPendingWorkModalProps = {
  open: boolean;
  isSaving: boolean;
  taskTitle?: string;
  initialRemarks?: string;
  onClose: () => void;
  onConfirm: (remarks: string) => void | Promise<void>;
};

export function MarkPendingWorkModal({
  open,
  isSaving,
  taskTitle,
  initialRemarks = "",
  onClose,
  onConfirm,
}: MarkPendingWorkModalProps) {
  const [remarks, setRemarks] = useState(initialRemarks);

  useEffect(() => {
    if (open) {
      setRemarks(initialRemarks || "");
    }
  }, [open, initialRemarks]);

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
            Mark task as Pending
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {taskTitle
              ? `Add pending remarks for “${taskTitle}”.`
              : "Add pending remarks for this work task."}
          </p>
        </div>
        <div className="px-4 sm:px-5 py-3.5 sm:py-4">
          <label className="mb-1.5 block text-xs font-semibold text-muted">
            Pending remarks
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={4}
            disabled={isSaving}
            className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 leading-relaxed"
            placeholder="Reason for setting/reverting task to pending..."
          />
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
            disabled={isSaving}
            onClick={() => void onConfirm(remarks.trim())}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-slate-700 px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-md"
          >
            {isSaving ? "Saving…" : "Mark Pending"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MarkPendingWorkModal;
