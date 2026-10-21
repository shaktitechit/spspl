"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Calendar,
  Building2,
  CheckSquare,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { UserNoteRecord } from "@/types/workPlanner";

interface BatchConvertToWorkPlanModalProps {
  open: boolean;
  selectedNotes: UserNoteRecord[];
  isConverting?: boolean;
  onClose: () => void;
  onConvert?: (payload: { note_ids: string[]; target_date: string }) => Promise<any>;
  onClearSelection?: () => void;
}

export function BatchConvertToWorkPlanModal({
  open,
  selectedNotes,
  onClose,
  onClearSelection,
}: BatchConvertToWorkPlanModalProps) {
  const router = useRouter();

  // Default to tomorrow if after 5 PM, else today
  const defaultDate = useMemo(() => {
    const d = new Date();
    if (d.getHours() >= 17) {
      d.setDate(d.getDate() + 1);
    }
    return d.toISOString().slice(0, 10);
  }, []);

  const [targetDate, setTargetDate] = useState(defaultDate);

  const visitNotes = useMemo(
    () => selectedNotes.filter((n) => n.type === "visit"),
    [selectedNotes]
  );
  const taskNotes = useMemo(
    () => selectedNotes.filter((n) => n.type === "task"),
    [selectedNotes]
  );
  const generalNotes = useMemo(
    () =>
      selectedNotes.filter(
        (n) => n.type === "general" || (!n.type && n.type !== "task" && n.type !== "visit")
      ),
    [selectedNotes]
  );

  if (!open || selectedNotes.length === 0) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDate) {
      toast.error("Please select a target plan date");
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "opms_workplan_import_notes",
        JSON.stringify({
          targetDate,
          notes: selectedNotes,
        })
      );
    }

    toast.info(
      `Opening Work Plan for ${new Date(targetDate).toLocaleDateString()} with ${selectedNotes.length} item(s)...`
    );
    if (onClearSelection) {
      onClearSelection();
    }
    onClose();
    router.push(`/dashboard/plans/new?date=${targetDate}&fromNotes=1`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-muted/50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Make Daily Work Plan
              </h2>
              <p className="text-xs text-muted">
                Transfer {selectedNotes.length} selected item(s) to Work Plan Form
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-foreground transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form State */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Target Date Picker */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Target Work Plan Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-hidden"
                required
              />
            </div>
            <p className="text-[11px] text-muted mt-1">
              You will land on the daily work plan form with these selected items pre-loaded, ready for your review and submission.
            </p>
          </div>

          {/* Selected Summary */}
          <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Selected Items to Transfer ({selectedNotes.length})
            </h4>

            {/* Visit Notes */}
            {visitNotes.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  Field Visits ({visitNotes.length})
                </span>
                <div className="grid gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {visitNotes.map((v, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-semibold text-foreground truncate">
                        🏢 {v.party_name || v.title}
                      </span>
                      <span className="text-[10px] text-muted truncate ml-2">
                        {[v.locality, v.city].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Task Notes */}
            {taskNotes.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <CheckSquare className="h-3.5 w-3.5" />
                  Planned Tasks ({taskNotes.length})
                </span>
                <div className="grid gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {taskNotes.map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-semibold text-foreground truncate">
                        📋 {t.title}
                      </span>
                      <span className="text-[10px] text-muted uppercase font-bold ml-2">
                        {t.priority || "medium"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* General Notes / Memos */}
            {generalNotes.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Notes &amp; Memos ({generalNotes.length})
                </span>
                <div className="grid gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {generalNotes.map((g, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-semibold text-foreground truncate">
                        📝 {g.title}
                      </span>
                      <span className="text-[10px] text-muted uppercase font-bold ml-2">
                        {g.category || "General"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-hover hover:text-foreground transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover transition shadow-xs cursor-pointer"
            >
              <span>Proceed to Work Plan</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
