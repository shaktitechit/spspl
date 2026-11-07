"use client";

import { useState, useMemo } from "react";
import {
  X,
  History,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  FileText,
  AlertCircle,
  PlusCircle,
  Trash2,
  Edit3,
} from "lucide-react";
import {
  useGetOrderApprovalHistoryQuery,
  type OrderApprovalHistoryItem,
  type OrderApprovalHistoryLineChange,
} from "@/store/api/slices/orderApprovalApi";

type ApprovalChangesHistoryModalProps = {
  open: boolean;
  onClose: () => void;
  approvalId: string;
  approvalNo?: string;
  orderNo?: string;
  partyLabel?: string;
};

function formatDateTime(v: unknown): string {
  if (v == null || v === "") return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function fieldLabel(field: string): string {
  switch (field) {
    case "approved_quantity":
      return "Approved Qty";
    case "ordered_quantity":
      return "Ordered Qty";
    case "approved_unit_price":
      return "Unit Price";
    case "approved_total_amount":
      return "Line Total";
    case "applied_rate_type":
      return "Rate Type";
    case "discount_percent":
      return "Discount %";
    case "discount_amount":
      return "Discount ₹";
    case "gst_percent":
      return "GST %";
    case "free_quantity":
      return "Free Qty";
    case "remarks":
      return "Remarks";
    default:
      return field
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
}

function departmentBadge(dept: string) {
  switch (dept) {
    case "admin":
      return {
        label: "Admin",
        class: "bg-purple-50 text-purple-700 ring-1 ring-purple-600/20 dark:bg-purple-950/40 dark:text-purple-300",
      };
    case "finance":
      return {
        label: "Finance",
        class: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20 dark:bg-indigo-950/40 dark:text-indigo-300",
      };
    case "account":
      return {
        label: "Account",
        class: "bg-teal-50 text-teal-700 ring-1 ring-teal-600/20 dark:bg-teal-950/40 dark:text-teal-300",
      };
    case "coordinator":
      return {
        label: "Coordinator",
        class: "bg-sky-50 text-sky-700 ring-1 ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-300",
      };
    case "sales":
      return {
        label: "Sales",
        class: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300",
      };
    default:
      return {
        label: dept || "System",
        class: "bg-slate-100 text-slate-700 ring-1 ring-slate-600/10 dark:bg-slate-800 dark:text-slate-300",
      };
  }
}

function stageFriendlyName(stage: string): string {
  switch (stage) {
    case "admin_amendment":
      return "Admin Amendment";
    case "coordinator_amendment":
      return "Coordinator Amendment";
    case "finance_amendment":
      return "Finance Amendment";
    case "account_amendment":
      return "Account Amendment";
    case "partial_dispatch_settlement":
      return "Partial Dispatch Settlement";
    case "admin_approval":
      return "Admin Sign-off";
    case "finance_approval":
      return "Finance Clearance";
    case "account_approval":
      return "Account Clearance";
    case "sales_submission":
      return "Sales Submission";
    default:
      return stage
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
}

export function ApprovalChangesHistoryModal({
  open,
  onClose,
  approvalId,
  approvalNo = "—",
  orderNo = "—",
  partyLabel = "—",
}: ApprovalChangesHistoryModalProps) {
  const { data: historyData, isLoading, isError, refetch } =
    useGetOrderApprovalHistoryQuery(approvalId, {
      skip: !open || !approvalId,
    });

  const historyList: OrderApprovalHistoryItem[] = useMemo(() => {
    if (!Array.isArray(historyData)) return [];
    return [...historyData].sort(
      (a, b) => Number(b.revision_number ?? 0) - Number(a.revision_number ?? 0)
    );
  }, [historyData]);

  const [selectedRevisionIdx, setSelectedRevisionIdx] = useState(0);
  const [viewTab, setViewTab] = useState<"diff" | "snapshot">("diff");

  // Keep selected index valid
  const currentRevision = useMemo(() => {
    if (historyList.length === 0) return null;
    return historyList[selectedRevisionIdx] ?? historyList[0];
  }, [historyList, selectedRevisionIdx]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-white/10 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              <History className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Approval Changes &amp; Revisions
                </h3>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {approvalNo}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Order <span className="font-semibold text-slate-700 dark:text-slate-300">{orderNo}</span>
                {partyLabel && partyLabel !== "—" ? ` · ${partyLabel}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-violet-600 border-t-transparent dark:border-violet-400" />
              <p className="text-xs text-slate-500">Loading revision history…</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-10 w-10 text-rose-500 mb-2" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Failed to load change history
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-3 text-xs font-semibold text-violet-600 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : historyList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No recorded changes yet
              </h4>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                This approval record has not undergone any revisions or amendments yet.
              </p>
            </div>
          ) : (
            <>
              {/* Revision Selector Stepper */}
              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Select Revision to Inspect ({historyList.length}{" "}
                  {historyList.length === 1 ? "revision" : "revisions"})
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {historyList.map((rev, idx) => {
                    const isSelected = idx === selectedRevisionIdx;
                    const deptInfo = departmentBadge(rev.department);
                    return (
                      <button
                        key={rev._id || idx}
                        type="button"
                        onClick={() => setSelectedRevisionIdx(idx)}
                        className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium whitespace-nowrap transition cursor-pointer border ${
                          isSelected
                            ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                            : "bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:border-white/10 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span className="font-bold">Rev #{rev.revision_number}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-2xs font-medium ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : deptInfo.class
                          }`}
                        >
                          {deptInfo.label}
                        </span>
                        {idx === 0 && (
                          <span
                            className={`text-2xs uppercase tracking-wider font-semibold ${
                              isSelected ? "text-violet-200" : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            Latest
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {currentRevision && (
                <div className="space-y-4">
                  {/* Revision Summary Banner */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-950/40">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                            Revision #{currentRevision.revision_number}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {stageFriendlyName(currentRevision.stage)}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold ${
                              departmentBadge(currentRevision.department).class
                            }`}
                          >
                            {departmentBadge(currentRevision.department).label}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {formatDateTime(currentRevision.changed_at)}
                          </span>
                          <span>
                            By:{" "}
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {typeof currentRevision.changed_by === "object" && currentRevision.changed_by !== null
                                ? (currentRevision.changed_by as any).name ||
                                  (currentRevision.changed_by as any).username ||
                                  "—"
                                : String(currentRevision.changed_by || "—")}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Financial Impact Cards */}
                      {currentRevision.financials && (
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-slate-900 text-right">
                            <span className="block text-2xs font-medium text-slate-400">
                              Approved Total
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                              <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">
                                ₹{formatMoney(currentRevision.financials.new_approved_total)}
                              </span>
                              {currentRevision.financials.difference_approved_total !== 0 && (
                                <span
                                  className={`inline-flex items-center gap-0.5 text-2xs font-bold px-1.5 py-0.5 rounded ${
                                    currentRevision.financials.difference_approved_total > 0
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                  }`}
                                >
                                  {currentRevision.financials.difference_approved_total > 0 ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {currentRevision.financials.difference_approved_total > 0 ? "+" : ""}
                                  ₹{formatMoney(currentRevision.financials.difference_approved_total)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Amendment Notes if any */}
                    {currentRevision.notes ? (
                      <div className="mt-3 rounded-lg border border-slate-200/90 bg-white p-2.5 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
                        <span className="font-semibold text-slate-500 mr-1.5">
                          Amendment Notes / Reason:
                        </span>
                        <span className="font-sans italic">{currentRevision.notes}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Tabs: Changes Diff vs Snapshot */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewTab("diff")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                          viewTab === "diff"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        }`}
                      >
                        Line Item Changes ({currentRevision.changes?.length ?? 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewTab("snapshot")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                          viewTab === "snapshot"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        }`}
                      >
                        Revision Snapshot ({currentRevision.snapshot?.length ?? 0} items)
                      </button>
                    </div>
                  </div>

                  {/* TAB 1: Changes Diff View */}
                  {viewTab === "diff" && (
                    <div className="space-y-3">
                      {!currentRevision.changes || currentRevision.changes.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-white/10">
                          {currentRevision.is_legacy_fallback
                            ? "Granular item-level diffs are not recorded for this historical amendment, but you can view the full snapshot in the Revision Snapshot tab."
                            : "No individual line item modifications recorded in this revision (status or metadata update)."}
                        </div>
                      ) : (
                        currentRevision.changes.map((change, cIdx) => {
                          const isModified = change.change_type === "modified";
                          const isAdded = change.change_type === "added";
                          const isRemoved = change.change_type === "removed";

                          return (
                            <div
                              key={cIdx}
                              className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-900/60"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-white/5">
                                <div className="flex items-center gap-2">
                                  {isModified && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-2xs font-bold text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300">
                                      <Edit3 className="h-3 w-3" /> Modified
                                    </span>
                                  )}
                                  {isAdded && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-2xs font-bold text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300">
                                      <PlusCircle className="h-3 w-3" /> Added
                                    </span>
                                  )}
                                  {isRemoved && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-2xs font-bold text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300">
                                      <Trash2 className="h-3 w-3" /> Removed
                                    </span>
                                  )}
                                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                                    {change.product_name}
                                  </span>
                                  {change.sku && (
                                    <span className="font-mono text-2xs text-slate-500">
                                      ({change.sku})
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Field Diffs */}
                              {isModified && change.field_changes && change.field_changes.length > 0 ? (
                                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                  {change.field_changes.map((fc, fIdx) => (
                                    <div
                                      key={fIdx}
                                      className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-xs dark:border-white/5 dark:bg-slate-950/40"
                                    >
                                      <span className="block text-2xs font-semibold text-slate-400">
                                        {fieldLabel(fc.field)}
                                      </span>
                                      <div className="mt-1 flex items-center gap-2 font-mono text-xs">
                                        <span className="text-slate-400 line-through">
                                          {String(fc.from ?? "—")}
                                        </span>
                                        <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                                          {String(fc.to ?? "—")}
                                        </span>
                                        {fc.difference != null && fc.difference !== 0 && (
                                          <span
                                            className={`text-2xs font-bold ${
                                              fc.difference > 0
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-rose-600 dark:text-rose-400"
                                            }`}
                                          >
                                            ({fc.difference > 0 ? "+" : ""}
                                            {fc.difference})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : isAdded && change.after ? (
                                <div className="mt-2.5 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
                                  <span>
                                    Qty: <b>{change.after.approved_quantity ?? change.after.ordered_quantity}</b>
                                  </span>
                                  <span>
                                    Unit Price: <b>₹{formatMoney(change.after.approved_unit_price)}</b>
                                  </span>
                                  <span>
                                    Rate Type: <b>{change.after.applied_rate_type || "MANUAL"}</b>
                                  </span>
                                </div>
                              ) : isRemoved && change.before ? (
                                <div className="mt-2.5 text-xs text-rose-600 dark:text-rose-400">
                                  Previous Approved Qty: {change.before.approved_quantity} · Total: ₹{formatMoney(change.before.approved_total_amount)}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* TAB 2: Snapshot Table View */}
                  {viewTab === "snapshot" && (
                    <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-white/10">
                      <table className="w-full min-w-[700px] text-left font-sans text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950 font-medium text-slate-600 dark:text-slate-400">
                          <tr>
                            <th className="px-3 py-2">Product</th>
                            <th className="px-3 py-2">Rate Type</th>
                            <th className="px-3 py-2 text-right">Approved Qty</th>
                            <th className="px-3 py-2 text-right">Unit Price</th>
                            <th className="px-3 py-2 text-right">Discount</th>
                            <th className="px-3 py-2 text-right">GST</th>
                            <th className="px-3 py-2 text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {(currentRevision.snapshot || []).map((it, idx) => {
                            const qty = Number(it.approved_quantity ?? 0);
                            const price = Number(it.approved_unit_price ?? it.ordered_unit_price ?? 0);
                            const total = Number(it.approved_total_amount ?? qty * price);
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                                  <div>
                                    <span>{it.product_name || "—"}</span>
                                    {it.sku ? (
                                      <span className="block text-2xs font-mono text-slate-400">
                                        {it.sku}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                  {it.applied_rate_type || "MANUAL"}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-100">
                                  {qty}
                                  {Number(it.free_quantity || 0) > 0 && (
                                    <span className="ml-1 text-2xs text-indigo-600 dark:text-indigo-400">
                                      (+{it.free_quantity} free)
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                                  ₹{formatMoney(price)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {Number(it.discount_percent || 0) > 0
                                    ? `${it.discount_percent}%`
                                    : "—"}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {Number(it.gst_percent || 0) > 0
                                    ? `${it.gst_percent}%`
                                    : "0%"}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                  ₹{formatMoney(total)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-slate-200/80 px-5 py-3 dark:border-white/10 bg-slate-50/70 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApprovalChangesHistoryModal;

