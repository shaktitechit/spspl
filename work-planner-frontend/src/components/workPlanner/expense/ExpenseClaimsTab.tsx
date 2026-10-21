"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  FileSpreadsheet,
  Eye,
  Paperclip,
  Users,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetExpensesQuery,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
} from "@/store/api/workPlannerApiSlice";
import { resolvePublicAssetUrl, withFileAccessToken } from "@/lib/env";
import {
  EXPENSE_CATEGORY_LABELS,
  formatCurrency,
  formatPlanDate,
  renderExpenseStatusBadge,
  salesUserLabel,
} from "../workPlanUtils";
import {
  canApproveExpenseRecord,
  canRejectExpenseRecord,
  resolveExpenseOwnerId,
} from "./expensePermissions";
import type {
  AuthUser,
  WorkPlanExpenseRecord,
  WorkPlanExpenseAttachment,
  SeniorRemarkFeedItem,
} from "@/types/workPlanner";

interface ExpenseClaimsTabProps {
  currentUser: AuthUser | null | undefined;
  ownershipScope: "mine" | "team";
  selectedExecutive: string;
  setSelectedExecutive: (id: string) => void;
  executiveOptions: Array<{ id: string; name: string }>;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
  onOpenPreview: (doc: { name: string; url: string; mime?: string }) => void;
  onOpenSeniorRemarks: (data: {
    planId: string;
    expenseId: string;
    title: string;
    currentStatus: string;
    assigneeName: string;
    remarks: string;
    history: any[];
  }) => void;
  onOpenThread: (item: SeniorRemarkFeedItem) => void;
  onOpenApproveModal: (target: { planId: string; expense: WorkPlanExpenseRecord }) => void;
  onOpenRejectModal: (target: { planId: string; expenseId: string }) => void;
  onOpenSettleModal: (user: { _id: string; name: string }, expenseId: string) => void;
  sessionToken?: string;
}

export function ExpenseClaimsTab({
  currentUser,
  ownershipScope,
  selectedExecutive,
  setSelectedExecutive,
  executiveOptions,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onOpenPreview,
  onOpenSeniorRemarks,
  onOpenThread,
  onOpenApproveModal,
  onOpenRejectModal,
  onOpenSettleModal,
  sessionToken,
}: ExpenseClaimsTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [approveExpenseMut] = useApproveExpenseMutation();

  const isViewingSelf =
    ownershipScope === "mine" ||
    (selectedExecutive !== "all" && String(selectedExecutive) === String(currentUser?._id || ""));

  const statusOptions = useMemo(() => {
    return isViewingSelf
      ? ["all", "submitted", "approved", "rejected", "draft"]
      : ["all", "submitted", "approved", "rejected"];
  }, [isViewingSelf]);

  // If user switched to team view / subordinate where draft is not allowed, reset statusFilter
  React.useEffect(() => {
    if (!isViewingSelf && statusFilter === "draft") {
      setStatusFilter("all");
    }
  }, [isViewingSelf, statusFilter]);

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

  const { data: expensesRes, isLoading, refetch } = useGetExpensesQuery(queryParams);

  const expenses = expensesRes?.data || [];
  const total = expensesRes?.total || 0;
  const pages = expensesRes?.pages || 1;

  async function handleApproveExpense(planId: string, expenseId: string) {
    try {
      await approveExpenseMut({ planId, expenseId }).unwrap();
      toast.success("Expense claim approved successfully");
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to approve expense";
      toast.error(msg);
    }
  }

  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return expenses;
    const q = searchQuery.toLowerCase();
    return expenses.filter((e) => {
      const cat = (EXPENSE_CATEGORY_LABELS[e.category] || e.category || "").toLowerCase();
      const desc = (e.description || "").toLowerCase();
      const userLabel = salesUserLabel(e.sales_user, executiveOptions).toLowerCase();
      return cat.includes(q) || desc.includes(q) || userLabel.includes(q);
    });
  }, [expenses, searchQuery, executiveOptions]);

  function buildExpenseThreadItem(exp: WorkPlanExpenseRecord, pId: string): SeniorRemarkFeedItem {
    const authRemarks = Array.isArray(exp.authority_remarks) ? exp.authority_remarks : [];
    const r = authRemarks.length > 0 ? authRemarks[authRemarks.length - 1] : ({} as any);
    const sUserId = resolveExpenseOwnerId(exp);
    const sUserName = salesUserLabel(exp.sales_user, executiveOptions);
    const expId = exp._id || exp.id || "";
    const categoryName = EXPENSE_CATEGORY_LABELS[exp.category] || exp.category;
    const amountStr = exp.amount != null ? `₹${exp.amount}` : "";
    const expTitle = `${categoryName} Claim ${amountStr ? `(${amountStr})` : ""} - ${exp.description || "Expense"}`;

    return {
      id: String(r._id || `${expId}_expense`),
      remark_id: String(r._id || "latest"),
      target_type: "expense",
      plan_id: String(pId || ""),
      target_id: String(expId),
      plan_date: exp.expense_date || undefined,
      title: expTitle,
      location: exp.vendor_name || exp.sub_category || exp.bill_number || "",
      sales_user: {
        _id: sUserId,
        name: sUserName,
        email: typeof exp.sales_user === "object" ? (exp.sales_user as any).email || "" : "",
      },
      senior_user: {
        _id: String(r.user || ""),
        name: r.user_name || "Senior Authority",
        role: r.role || "Senior Authority",
      },
      remark: r.remark || exp.manager_remarks || "",
      remark_type: r.remark_type || "instruction",
      priority: r.priority || "medium",
      expected_followup_date: r.expected_followup_date || null,
      status: r.status || "pending_response",
      followup_remarks: Array.isArray(r.followup_remarks) ? r.followup_remarks : [],
      resolution_remarks: r.resolution_remarks || "",
      resolved_at: r.resolved_at || null,
      resolved_by: r.resolved_by || null,
      resolved_by_name: r.resolved_by_name || "",
      created_at: r.created_at || (exp as any).updatedAt || (exp as any).createdAt || new Date().toISOString(),
    };
  }

  return (
    <div className="space-y-3.5">
      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1.5 overflow-x-auto scrollbar-none">
        {statusOptions.map((st) => (
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

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 bg-card p-3 rounded-2xl border border-border shadow-2xs">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search category, description, executive..."
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

      {/* Table Container */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-border">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted">Loading expense claims…</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">No expense claims found.</div>
          ) : (
            filteredExpenses.map((exp, idx) => {
              const expId = exp._id || exp.id || String(idx);
              const planId =
                exp.work_plan_id ||
                (typeof exp.work_plan === "string"
                  ? exp.work_plan
                  : (exp.work_plan as { _id?: string; id?: string })?._id ||
                    (exp.work_plan as { _id?: string; id?: string })?.id) ||
                "";
              const categoryName = EXPENSE_CATEGORY_LABELS[exp.category] || exp.category;
              const sUserId = resolveExpenseOwnerId(exp);
              const sUserName = salesUserLabel(exp.sales_user, executiveOptions);

              const canApprove = canApproveExpenseRecord(currentUser, exp);
              const canReject = canRejectExpenseRecord(currentUser, exp);

              const authRemarks = Array.isArray(exp.authority_remarks) ? exp.authority_remarks : [];
              const hasDirective = authRemarks.length > 0 || Boolean(exp.manager_remarks?.trim());

              return (
                <div key={expId} className="p-4 space-y-2.5 hover:bg-surface-muted/30 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-foreground">{categoryName}</span>
                        {exp.sub_category && (
                          <span className="text-[11px] text-muted">• {exp.sub_category}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                        <span>{formatPlanDate(exp.expense_date)}</span>
                        <span>•</span>
                        <span className="font-medium text-foreground">{sUserName}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-extrabold text-foreground">{formatCurrency(exp.amount)}</div>
                      <div className="mt-1">{renderExpenseStatusBadge(exp.status)}</div>
                    </div>
                  </div>

                  {exp.description && <p className="text-xs text-muted line-clamp-2">{exp.description}</p>}

                  {/* Senior Directive Callout only if issued */}
                  {hasDirective && (
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const item = buildExpenseThreadItem(exp, planId);
                          onOpenThread(item);
                        }}
                        className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>Senior Directive ({authRemarks.length || 1})</span>
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/50">
                    {canApprove && planId && (
                      <button
                        type="button"
                        onClick={() => onOpenApproveModal({ planId, expense: exp })}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
                      >
                        Approve
                      </button>
                    )}
                    {canReject && planId && (
                      <button
                        type="button"
                        onClick={() => onOpenRejectModal({ planId, expenseId: expId })}
                        className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/20 transition"
                      >
                        Reject
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
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Executive</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description / Breakdown</th>
                <th className="px-4 py-3">Receipts</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-muted">
                    Loading expense claims…
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-muted">
                    No expense claims found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp, idx) => {
                  const expId = exp._id || exp.id || String(idx);
                  const planId =
                    exp.work_plan_id ||
                    (typeof exp.work_plan === "string"
                      ? exp.work_plan
                      : (exp.work_plan as { _id?: string; id?: string })?._id ||
                        (exp.work_plan as { _id?: string; id?: string })?.id) ||
                    "";
                  const categoryName = EXPENSE_CATEGORY_LABELS[exp.category] || exp.category;
                  const isBike = exp.category === "Travel" && exp.sub_category === "Private Bike";
                  const sUserId = resolveExpenseOwnerId(exp);
                  const sUserName = salesUserLabel(exp.sales_user, executiveOptions);

                  const attList: (WorkPlanExpenseAttachment | string)[] = [];
                  if (Array.isArray(exp.attachments) && exp.attachments.length > 0) {
                    attList.push(...exp.attachments);
                  } else if (exp.receipt_attachment) {
                    attList.push(exp.receipt_attachment);
                  }

                  const authRemarks = Array.isArray(exp.authority_remarks) ? exp.authority_remarks : [];
                  const latestRemark = authRemarks.length > 0 ? authRemarks[authRemarks.length - 1] : null;
                  const hasDirective = authRemarks.length > 0 || Boolean(exp.manager_remarks?.trim());

                  const canApprove = canApproveExpenseRecord(currentUser, exp);
                  const canReject = canRejectExpenseRecord(currentUser, exp);

                  return (
                    <tr key={expId} className="hover:bg-surface-muted/30 transition">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                        {formatPlanDate(exp.expense_date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-foreground">
                        {sUserName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-semibold text-foreground">{categoryName}</span>
                        {exp.sub_category && (
                          <span className="block text-[10px] text-muted">{exp.sub_category}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-foreground font-medium line-clamp-2">
                          {exp.description || "—"}
                        </p>
                        {isBike && (exp.total_km != null || exp.rate_per_km != null) && (
                          <span className="text-[10px] text-muted block mt-0.5">
                            {exp.total_km ?? 0} km × ₹{exp.rate_per_km ?? 0}/km
                          </span>
                        )}
                        {/* Senior Directive Callout only if issued */}
                        {hasDirective && (
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                const item = buildExpenseThreadItem(exp, planId);
                                onOpenThread(item);
                              }}
                              className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                              title="Click to view senior directive & junior follow-up thread"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span>Senior Directive ({authRemarks.length || 1})</span>
                            </button>
                            {latestRemark?.remark && (
                              <p className="text-[10px] text-muted italic line-clamp-1 max-w-[200px]">
                                &ldquo;{latestRemark.remark}&rdquo;
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {attList.length > 0 ? (
                          <div className="flex items-center gap-1">
                            {attList.slice(0, 2).map((att, aIdx) => {
                              const rawUrl = typeof att === "string" ? att : att.url || "";
                              const mime = typeof att === "string" ? undefined : att.mime_type;
                              const title =
                                typeof att === "string"
                                  ? `Receipt ${aIdx + 1}`
                                  : att.original_name || `Receipt ${aIdx + 1}`;
                              const fullUrl = withFileAccessToken(
                                resolvePublicAssetUrl(rawUrl),
                                sessionToken
                              );

                              return (
                                <button
                                  key={aIdx}
                                  type="button"
                                  onClick={() => onOpenPreview({ name: title, url: fullUrl, mime })}
                                  className="inline-flex items-center gap-1 rounded border border-border bg-surface-muted px-2 py-1 text-[11px] text-foreground hover:bg-surface-muted/80 hover:border-primary/40 transition cursor-pointer"
                                >
                                  <Eye className="h-3 w-3 text-primary" />
                                  <span>View</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-muted text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {renderExpenseStatusBadge(exp.status)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {planId && !String(planId).startsWith("standalone") && (
                            <Link
                              href={`/dashboard/plans/${planId}`}
                              className="inline-flex items-center gap-1 rounded border border-border bg-surface-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-muted/80 hover:border-primary/40 transition"
                              title="Open Work Plan Detail"
                            >
                              <ExternalLink className="h-3 w-3 text-muted" />
                              <span>Plan</span>
                            </Link>
                          )}

                          {planId && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenSeniorRemarks({
                                  planId,
                                  expenseId: expId,
                                  title: `${categoryName} Claim (${formatCurrency(exp.amount)})`,
                                  currentStatus: exp.status,
                                  assigneeName: sUserName,
                                  remarks: exp.manager_remarks || "",
                                  history: exp.authority_remarks || [],
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
                              title="Directive / Remark"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              <span>Remark</span>
                            </button>
                          )}

                          {canApprove && planId && (
                            <button
                              type="button"
                              onClick={() => onOpenApproveModal({ planId, expense: exp })}
                              className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {canReject && planId && (
                            <button
                              type="button"
                              onClick={() => onOpenRejectModal({ planId, expenseId: expId })}
                              className="rounded bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/20 transition cursor-pointer"
                            >
                              Reject
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
    </div>
  );
}
