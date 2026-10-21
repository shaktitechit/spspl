"use client";

import { useMemo, useState } from "react";
import { Search, X, CheckSquare, MapPin, Calendar, Clock, AlertCircle } from "lucide-react";
import { useGetPlansQuery } from "@/store/api/workPlannerApiSlice";
import type { WorkPlanRecord, WorkPlanVisitRecord, WorkPlanWorkRecord } from "@/types/workPlanner";
import { renderVisitStatusBadge, renderWorkStatusBadge, formatPlanDate, formatTime } from "./workPlanUtils";

interface SelectPreviousPendingItemsModalProps {
  open: boolean;
  mode: "visits" | "tasks";
  salesUserId?: string;
  excludeIds: string[];
  onClose: () => void;
  onAddItems: (selectedItems: Array<Record<string, any>>) => void;
}

export function SelectPreviousPendingItemsModal({
  open,
  mode,
  salesUserId,
  excludeIds,
  onClose,
  onAddItems,
}: SelectPreviousPendingItemsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: plansRes, isLoading } = useGetPlansQuery({
    limit: 200,
    include_visits: true,
    include_works: true,
  });

  const plans = useMemo(() => plansRes?.data || [], [plansRes]);

  // Extract eligible pending / in-progress items
  const eligibleItems = useMemo(() => {
    const list: Array<{
      id: string;
      planDate: string;
      titleOrParty: string;
      status: string;
      locationOrAddress?: string;
      descriptionOrNotes?: string;
      remarks?: string;
      raw: WorkPlanVisitRecord | WorkPlanWorkRecord;
    }> = [];

    const excludeSet = new Set(excludeIds.map(String));

    for (const p of plans) {
      // Filter by sales user if specified
      if (salesUserId) {
        const sUser = typeof p.sales_user === "object" ? p.sales_user?._id || p.sales_user?.id : p.sales_user;
        if (sUser && String(sUser) !== String(salesUserId)) {
          continue;
        }
      }

      const pDate = p.plan_date || "";

      if (mode === "visits" && Array.isArray(p.visits)) {
        for (const v of p.visits) {
          const vId = String(v._id || v.id || "");
          if (!vId || excludeSet.has(vId)) continue;
          if (["created", "pending", "in_progress", "checked_in"].includes(v.status)) {
            list.push({
              id: vId,
              planDate: pDate,
              titleOrParty: v.party_name || (typeof v.party === "object" ? (v.party as any)?.party_name : undefined) || "Field Visit",
              status: v.status,
              locationOrAddress: v.address || p.location || "",
              descriptionOrNotes: v.purpose || v.notes || "",
              remarks: v.in_progress_remarks || v.pending_remarks || "",
              raw: v,
            });
          }
        }
      } else if (mode === "tasks" && Array.isArray(p.works)) {
        for (const w of p.works) {
          const wId = String(w._id || w.id || "");
          if (!wId || excludeSet.has(wId)) continue;
          if (["created", "pending", "in_progress"].includes(w.status)) {
            list.push({
              id: wId,
              planDate: pDate,
              titleOrParty: w.title || "Work Task",
              status: w.status,
              locationOrAddress: p.location || "Office / Remote",
              descriptionOrNotes: w.description || "",
              remarks: w.in_progress_remarks || w.pending_remarks || "",
              raw: w,
            });
          }
        }
      }
    }

    return list;
  }, [plans, salesUserId, mode, excludeIds]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return eligibleItems;
    const q = searchQuery.toLowerCase().trim();
    return eligibleItems.filter((item) => {
      const text = `${item.titleOrParty} ${item.locationOrAddress} ${item.descriptionOrNotes} ${item.remarks} ${item.status}`.toLowerCase();
      return text.includes(q);
    });
  }, [eligibleItems, searchQuery]);

  if (!open) return null;

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  }

  function handleConfirm() {
    const selectedList = eligibleItems
      .filter((item) => selectedIds.has(item.id))
      .map((item) => ({ ...item.raw }));
    onAddItems(selectedList);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs transition-all duration-300">
      <div className="w-full sm:max-w-2xl max-h-[94vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Mobile Drag Indicator */}
        <div className="flex justify-center -mt-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                Add Previous Pending {mode === "visits" ? "Visits" : "Tasks"}
              </h2>
              <p className="text-[11px] text-muted">Select uncompleted items to carry forward</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground active:scale-95 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description Banner */}
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-400 flex items-start gap-2.5 shrink-0">
          <AlertCircle className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            Adding selected previous items will reassign them directly to this work plan. Their current status and pending remarks will be preserved.
          </div>
        </div>

        {/* Search & Select All Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder={`Search previous ${mode}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted/70 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
            />
          </div>
          {filteredItems.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-primary font-bold hover:underline self-end sm:self-auto py-1 px-2 rounded-md hover:bg-primary/5 active:scale-95 transition"
            >
              {selectedIds.size === filteredItems.length ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[180px]">
          {isLoading ? (
            <p className="text-xs text-muted text-center py-10">Loading previous items...</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-xs text-muted text-center py-10">
              No previous created, pending or in-progress {mode} found to add.
            </p>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition active:scale-[0.99] ${
                    isSelected
                      ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/20"
                      : "border-border bg-surface-muted/40 hover:bg-surface-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleItem(item.id)}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground truncate">
                        {item.titleOrParty}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {mode === "visits"
                          ? renderVisitStatusBadge(item.status)
                          : renderWorkStatusBadge(item.status)}
                        {item.planDate && (
                          <span className="text-[10px] text-muted flex items-center gap-1 font-medium bg-surface-muted px-2 py-0.5 rounded border border-border">
                            <Calendar className="h-3 w-3" />
                            {formatPlanDate(item.planDate)}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.locationOrAddress && (
                      <p className="text-[11px] text-muted flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {item.locationOrAddress}
                      </p>
                    )}

                    {item.descriptionOrNotes && (
                      <p className="text-[11px] text-muted line-clamp-2">{item.descriptionOrNotes}</p>
                    )}

                    {item.remarks && (
                      <p className="text-[10px] font-medium text-amber-500/90 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded inline-block truncate">
                        Remarks: {item.remarks}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 border-t border-border pt-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-[0.98] transition text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={handleConfirm}
            className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50 active:scale-[0.98] transition shadow-xs cursor-pointer text-center"
          >
            Add Selected Items ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
}
