"use client";

import { useState, useMemo, useEffect } from "react";
import { MessageSquarePlus, X, Loader2, Clock, User, FileText } from "lucide-react";
import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import {
  formatTimestampedRemark,
  appendRemarkEntry,
} from "@/components/portal/shared/orders/list/unbilledOrders";

export type AddOrderRemarkModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderNo: string;
  partyName: string;
  statusLabel?: string;
  existingRemarks?: string;
  userName: string;
  onSave: (updatedRemarks: string) => Promise<void>;
};

export function AddOrderRemarkModal({
  isOpen,
  onClose,
  orderNo,
  partyName,
  statusLabel,
  existingRemarks,
  userName,
  onSave,
}: AddOrderRemarkModalProps) {
  const [remarkText, setRemarkText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRemarkText("");
      setIsSaving(false);
    }
  }, [isOpen]);

  const cleanExisting = useMemo(() => {
    const trimmed = (existingRemarks || "").trim();
    return trimmed && trimmed !== "—" ? trimmed : "";
  }, [existingRemarks]);

  const previewEntry = useMemo(() => {
    if (!remarkText.trim()) return "";
    return formatTimestampedRemark(userName, remarkText);
  }, [userName, remarkText]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarkText.trim() || isSaving) return;

    try {
      setIsSaving(true);
      const newEntry = formatTimestampedRemark(userName, remarkText);
      const finalRemarks = appendRemarkEntry(cleanExisting, newEntry);
      await onSave(finalRemarks);
      onClose();
    } catch {
      // Error handled by caller via toast
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LargeModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
                <MessageSquarePlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                  Add Order Remark
                </h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {orderNo}
                  </span>
                  <span>·</span>
                  <span className="truncate max-w-[200px]" title={partyName}>
                    {partyName}
                  </span>
                  {statusLabel ? (
                    <>
                      <span>·</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                        {statusLabel}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="mt-4 space-y-4">
            {/* Existing Remarks History */}
            {cleanExisting ? (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <FileText className="h-3.5 w-3.5" />
                  Previous Remarks
                </label>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap font-sans dark:border-white/10 dark:bg-slate-800/50 dark:text-slate-300">
                  {cleanExisting}
                </div>
              </div>
            ) : null}

            {/* New Remark Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="new-order-remark"
                className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
              >
                <span>New Remark</span>
                <span className="font-normal normal-case text-slate-400 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {userName}
                </span>
              </label>
              <textarea
                id="new-order-remark"
                rows={3}
                value={remarkText}
                onChange={(e) => setRemarkText(e.target.value)}
                placeholder="Type order remark here…"
                autoFocus
                disabled={isSaving}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-cyan-400 dark:disabled:bg-slate-900"
              />
            </div>

            {/* Format Preview Pill */}
            {previewEntry ? (
              <div className="rounded-xl border border-cyan-200/80 bg-cyan-50/60 p-3 text-2xs text-cyan-900 dark:border-cyan-900/40 dark:bg-cyan-950/30 dark:text-cyan-300">
                <div className="flex items-center gap-1 font-semibold text-cyan-700 dark:text-cyan-400 mb-1">
                  <Clock className="h-3 w-3" />
                  Format Preview:
                </div>
                <div className="font-mono break-words">{previewEntry}</div>
              </div>
            ) : (
              <div className="text-2xs text-slate-400 italic">
                Entry will be timestamped with your name and current date/time automatically.
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!remarkText.trim() || isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-cyan-500 dark:hover:bg-cyan-600"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                    Save Remark
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </LargeModalPortal>
  );
}

