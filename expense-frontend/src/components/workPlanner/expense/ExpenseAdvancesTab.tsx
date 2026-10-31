"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  RefreshCw,
  Plus,
  Wallet,
  CheckCircle2,
  XCircle,
  RotateCcw,
  DollarSign,
  Users,
  CreditCard,
  Building2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetTourAdvancesQuery,
  useApproveTourAdvanceMutation,
  useRejectTourAdvanceMutation,
} from "@/store/api/workPlannerApiSlice";
import { formatCurrency, formatPlanDate, salesUserLabel } from "../workPlanUtils";
import {
  canApproveAdvanceRecord,
  canRejectAdvanceRecord,
  canDisburseAdvanceRecord,
  canRefundAdvanceRecord,
  resolveAdvanceOwnerId,
  getExpensePermissions,
} from "./expensePermissions";
import { ExpenseAttachmentList } from "./ExpenseAttachmentList";
import { FilePreviewModal, useFilePreview } from "../FilePreviewModal";
import type { AuthUser, WorkPlanTourAdvanceRecord, TourAdvanceStatus, ExpenseAttachmentItem } from "@/types/workPlanner";

interface ExpenseAdvancesTabProps {
  currentUser: AuthUser | null | undefined;
  ownershipScope: "mine" | "team";
  selectedExecutive: string;
  setSelectedExecutive: (id: string) => void;
  executiveOptions: Array<{ id: string; name: string }>;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
  onRequestAdvance: () => void;
  onIssueDirectAdvance?: () => void;
  isElevated?: boolean;
  onApproveAdvance: (advance: WorkPlanTourAdvanceRecord) => void;
  onRejectAdvance: (advance: WorkPlanTourAdvanceRecord) => void;
  onDisburseAdvance: (advance: WorkPlanTourAdvanceRecord) => void;
  onRefundAdvance: (advance: WorkPlanTourAdvanceRecord) => void;
  sessionToken?: string | null;
  onOpenPreview?: (doc: { name: string; url: string; mime?: string }) => void;
}

export function ExpenseAdvancesTab({
  currentUser,
  ownershipScope,
  selectedExecutive,
  setSelectedExecutive,
  executiveOptions,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onRequestAdvance,
  onIssueDirectAdvance,
  isElevated = false,
  onApproveAdvance,
  onRejectAdvance,
  onDisburseAdvance,
  onRefundAdvance,
  sessionToken,
  onOpenPreview,
}: ExpenseAdvancesTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  } = useFilePreview(sessionToken);

  const handlePreview = onOpenPreview || openPreview;

  const [approveTourAdvanceMut] = useApproveTourAdvanceMutation();
  const [rejectTourAdvanceMut] = useRejectTourAdvanceMutation();

  const queryParams = useMemo(() => {
    const p: Record<string, string | number | undefined> = {
      scope: ownershipScope,
      page: currentPage,
      limit: 50,
    };
    if (statusFilter !== "all") p.status = statusFilter;
    if (selectedExecutive && selectedExecutive !== "all") p.user_id = selectedExecutive;
    if (dateFrom) p.from_date = dateFrom;
    if (dateTo) p.to_date = dateTo;
    return p;
  }, [ownershipScope, currentPage, statusFilter, selectedExecutive, dateFrom, dateTo]);

  const { data: advancesRes, isLoading, refetch } = useGetTourAdvancesQuery(queryParams);

  const advances = advancesRes?.data || [];
  const total = advancesRes?.total || 0;
  const pages = advancesRes?.pages || 1;

  async function handleApprove(advanceId: string) {
    try {
      await approveTourAdvanceMut({ advanceId }).unwrap();
      toast.success("Tour advance request approved");
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to approve advance";
      toast.error(msg);
    }
  }

  async function handleReject(advanceId: string) {
    const reason = window.prompt("Enter rejection reason for this tour advance:");
    if (!reason || !reason.trim()) return;

    try {
      await rejectTourAdvanceMut({ advanceId, rejection_reason: reason.trim() }).unwrap();
      toast.success("Tour advance rejected");
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to reject advance";
      toast.error(msg);
    }
  }

  const filteredAdvances = useMemo(() => {
    if (!searchQuery.trim()) return advances;
    const q = searchQuery.toLowerCase();
    return advances.filter((adv) => {
      const num = (adv.advance_number || "").toLowerCase();
      const purpose = (adv.purpose || "").toLowerCase();
      const userLabel = salesUserLabel(adv.sales_user, executiveOptions).toLowerCase();
      return num.includes(q) || purpose.includes(q) || userLabel.includes(q);
    });
  }, [advances, searchQuery, executiveOptions]);

  function renderStatusBadge(status: TourAdvanceStatus) {
    switch (status) {
      case "pending":
        return (
          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            Pending Approval
          </span>
        );
      case "approved":
        return (
          <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
            Approved (To Disburse)
          </span>
        );
      case "disbursed":
        return (
          <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
            Disbursed / In Hand
          </span>
        );
      case "settled":
        return (
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            Fully Settled
          </span>
        );
      case "refunded":
        return (
          <span className="rounded-md bg-zinc-500/10 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
            Refunded / Closed
          </span>
        );
      case "rejected":
        return (
          <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
            Rejected
          </span>
        );
      default:
        return (
          <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted">
            {status}
          </span>
        );
    }
  }

  const hasActiveFilters = Boolean(
    statusFilter !== "all" ||
      (selectedExecutive && selectedExecutive !== "all") ||
      dateFrom ||
      dateTo ||
      searchQuery
  );

  function resetFilters() {
    setStatusFilter("all");
    setSelectedExecutive("all");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
    setCurrentPage(1);
  }

  return (
    <div className="space-y-3.5">
      {/* Top Controls & Request Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3.5 rounded-2xl border border-border shadow-2xs">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-muted/50 p-1 overflow-x-auto scrollbar-none">
          {["all", "pending", "approved", "disbursed", "settled", "refunded", "rejected"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setCurrentPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize whitespace-nowrap active:scale-95 transition shrink-0 cursor-pointer ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {getExpensePermissions(currentUser).canDisburseAdvance && onIssueDirectAdvance && (
            <button
              type="button"
              onClick={onIssueDirectAdvance}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 active:scale-95 transition shadow-xs shrink-0 cursor-pointer"
            >
              <Zap className="h-4 w-4" />
              <span>Issue Direct Advance</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRequestAdvance}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:scale-95 transition shadow-xs shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Request Tour Advance</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 bg-card p-3 rounded-2xl border border-border shadow-2xs">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search advance number, purpose, executive..."
            className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>

        {ownershipScope === "team" && executiveOptions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted shrink-0" />
            <select
              value={selectedExecutive}
              onChange={(e) => {
                setSelectedExecutive(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            >
              <option value="all">All Team Members</option>
              {executiveOptions.map((exec) => (
                <option key={exec.id} value={exec.id}>
                  {exec.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
          <span className="text-xs text-muted">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition cursor-pointer whitespace-nowrap"
          >
            Clear Filters
          </button>
        )}

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isLoading}
          className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          title="Refresh table"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Advances Table Container */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-border">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted">Loading tour advances…</div>
          ) : filteredAdvances.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">No tour advances found.</div>
          ) : (
            filteredAdvances.map((adv) => {
              const advId = adv._id || adv.id || "";
              const sUserName = salesUserLabel(adv.sales_user, executiveOptions);
              const remaining = adv.remaining_balance ?? (adv.disbursed_amount ?? adv.amount);

              const canApprove = canApproveAdvanceRecord(currentUser, adv);
              const canReject = canRejectAdvanceRecord(currentUser, adv);
              const canDisburse = canDisburseAdvanceRecord(currentUser, adv);
              const canRefund = canRefundAdvanceRecord(currentUser, adv);

              return (
                <div key={advId} className="p-4 space-y-2 hover:bg-surface-muted/30 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {adv.advance_number}
                      </span>
                      <div className="text-[11px] text-muted mt-0.5">
                        {formatPlanDate(adv.request_date)} • {sUserName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-extrabold text-foreground">
                        {formatCurrency(adv.amount)}
                      </div>
                      <div className="mt-1">{renderStatusBadge(adv.status)}</div>
                    </div>
                  </div>

                  <p className="text-xs text-muted">{adv.purpose}</p>

                  {adv.status === "disbursed" && (
                    <div className="rounded-lg bg-surface-muted/50 p-2 text-[11px] flex justify-between">
                      <span className="text-muted">Unspent Balance:</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">
                        {formatCurrency(remaining)}
                      </span>
                    </div>
                  )}

                  {/* Attachments preview list */}
                  {((adv.attachment_details && adv.attachment_details.length > 0) ||
                    (adv.disbursement_attachment_details && adv.disbursement_attachment_details.length > 0) ||
                    (adv.attachments && adv.attachments.length > 0)) && (
                    <div className="pt-1">
                      <ExpenseAttachmentList
                        attachments={[
                          ...(adv.attachment_details || []),
                          ...(adv.disbursement_attachment_details || []),
                        ]}
                        attachmentIds={[
                          ...(adv.attachments || []),
                          ...(adv.disbursement_attachments || []),
                        ]}
                        onPreview={handlePreview}
                        onDownload={downloadFile}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/50">
                    {canApprove && (
                      <button
                        type="button"
                        onClick={() => onApproveAdvance(adv)}
                        className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
                      >
                        Approve
                      </button>
                    )}
                    {canReject && (
                      <button
                        type="button"
                        onClick={() => onRejectAdvance(adv)}
                        className="rounded bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/20 transition cursor-pointer"
                      >
                        Reject
                      </button>
                    )}
                    {canDisburse && (
                      <button
                        type="button"
                        onClick={() => onDisburseAdvance(adv)}
                        className="rounded bg-purple-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-purple-700 transition cursor-pointer"
                      >
                        Disburse
                      </button>
                    )}
                    {canRefund && (
                      <button
                        type="button"
                        onClick={() => onRefundAdvance(adv)}
                        className="rounded border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-purple-600 hover:bg-purple-500/20 transition cursor-pointer"
                      >
                        Refund / Recover
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-muted">
            <thead className="border-b border-border bg-surface-muted/50 text-[11px] font-semibold uppercase text-foreground">
              <tr>
                <th className="px-4 py-3">Adv Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Executive</th>
                <th className="px-4 py-3">Purpose / Notes</th>
                <th className="px-4 py-3">Req Amount</th>
                <th className="px-4 py-3">Disbursed / Balance</th>
                <th className="px-4 py-3">Attachments</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-xs text-muted">
                    Loading tour advances…
                  </td>
                </tr>
              ) : filteredAdvances.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-xs text-muted">
                    No tour advances found.
                  </td>
                </tr>
              ) : (
                filteredAdvances.map((adv) => {
                  const advId = adv._id || adv.id || "";
                  const sUserName = salesUserLabel(adv.sales_user, executiveOptions);
                  const remaining = adv.remaining_balance ?? (adv.disbursed_amount ?? adv.amount);

                  const canApprove = canApproveAdvanceRecord(currentUser, adv);
                  const canReject = canRejectAdvanceRecord(currentUser, adv);
                  const canDisburse = canDisburseAdvanceRecord(currentUser, adv);
                  const canRefund = canRefundAdvanceRecord(currentUser, adv);

                  const allAtts = [
                    ...(adv.attachment_details || []),
                    ...(adv.disbursement_attachment_details || []),
                  ];
                  const allAttIds = [
                    ...(adv.attachments || []),
                    ...(adv.disbursement_attachments || []),
                  ];

                  return (
                    <tr key={advId} className="hover:bg-surface-muted/30 transition">
                      <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">
                        {adv.advance_number}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                        {formatPlanDate(adv.request_date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-foreground">
                        {sUserName}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-foreground font-medium line-clamp-1">{adv.purpose}</p>
                        {adv.notes && <p className="text-[11px] text-muted line-clamp-1">{adv.notes}</p>}
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">
                        {formatCurrency(adv.amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {adv.disbursed_amount != null ? (
                          <div>
                            <span className="font-semibold text-foreground">
                              {formatCurrency(adv.disbursed_amount)}
                            </span>
                            <span className="text-[11px] text-purple-600 dark:text-purple-400 block font-medium">
                              Bal: {formatCurrency(remaining)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap max-w-[180px]">
                        {allAtts.length > 0 || allAttIds.length > 0 ? (
                          <ExpenseAttachmentList
                            attachments={allAtts}
                            attachmentIds={allAttIds}
                            onPreview={handlePreview}
                            onDownload={downloadFile}
                          />
                        ) : (
                          <span className="text-muted text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{renderStatusBadge(adv.status)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {canApprove && (
                            <button
                              type="button"
                              onClick={() => onApproveAdvance(adv)}
                              className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {canReject && (
                            <button
                              type="button"
                              onClick={() => onRejectAdvance(adv)}
                              className="rounded bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/20 transition cursor-pointer"
                            >
                              Reject
                            </button>
                          )}
                          {canDisburse && (
                            <button
                              type="button"
                              onClick={() => onDisburseAdvance(adv)}
                              className="rounded bg-purple-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-purple-700 transition cursor-pointer"
                            >
                              Disburse
                            </button>
                          )}
                          {canRefund && (
                            <button
                              type="button"
                              onClick={() => onRefundAdvance(adv)}
                              className="rounded border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[11px] font-semibold text-purple-600 hover:bg-purple-500/20 transition cursor-pointer"
                              title="Record unspent advance refund"
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
            <div className="text-muted">
              Showing page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
              <span className="font-semibold text-foreground">{pages}</span> ({total} items)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 transition"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= pages || isLoading}
                onClick={() => setCurrentPage((p) => Math.min(pages, p + 1))}
                className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={downloadFile}
      />
    </div>
  );
}
