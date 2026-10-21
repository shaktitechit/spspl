"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Copy, Download, ExternalLink, Plus, RefreshCw, Trash2, Search, FileSpreadsheet, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useGetPlansQuery, useDeletePlanMutation } from "@/store/api/workPlannerApiSlice";
import { isWpElevated, readSessionFromStorage } from "@/utils/authStorage";
import type { WorkPlanRecord } from "@/types/workPlanner";
import { ConfirmDeleteWorkPlanModal } from "./ConfirmDeleteWorkPlanModal";
import { DownloadWorkPlansModal } from "./DownloadWorkPlansModal";
import { DownloadExpensesModal } from "./DownloadExpensesModal";
import {
  WORK_PLAN_STATUS_TABS,
  WORK_PLAN_TYPE_TABS,
  canEditPlan,
  formatDiscussionMethod,
  formatPlanDate,
  planActivityLabel,
  planIdOf,
  renderPlanStatusBadge,
  salesUserLabel,
} from "./workPlanUtils";

import { CopyWorkPlanModal } from "./CopyWorkPlanModal";

type OwnershipScope = "mine" | "team";

export function WorkPlansPage() {
  const searchParams = useSearchParams();

  const user = readSessionFromStorage()?.user;
  const elevatedRole = isWpElevated(user);

  const initialStatus = searchParams.get("status") || "all";
  const initialPlanType = searchParams.get("plan_type") || "all";
  const initialSearch = searchParams.get("search") || searchParams.get("q") || "";
  const initialScope = (searchParams.get("scope") === "team" ? "team" : "mine") as OwnershipScope;
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [planTypeFilter, setPlanTypeFilter] = useState(initialPlanType);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [ownershipScope, setOwnershipScope] = useState<OwnershipScope>(
    elevatedRole ? initialScope : "mine"
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [expenseReportOpen, setExpenseReportOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<WorkPlanRecord | null>(null);

  const [deletePlanMut] = useDeletePlanMutation();

  const queryParams = useMemo(() => {
    const q: Record<string, string | number | undefined> = {
      page: currentPage,
      limit: itemsPerPage,
    };
    if (statusFilter && statusFilter !== "all") q.status = statusFilter;
    if (planTypeFilter && planTypeFilter !== "all") q.plan_type = planTypeFilter;
    if (dateFrom) q.from = dateFrom;
    if (dateTo) q.to = dateTo;
    if (elevatedRole) {
      q.scope = ownershipScope;
    }
    return q;
  }, [currentPage, itemsPerPage, statusFilter, planTypeFilter, dateFrom, dateTo, elevatedRole, ownershipScope]);

  const { data: plansRes, isLoading: loading, refetch: loadData } = useGetPlansQuery(queryParams);

  const plans = plansRes?.data || [];
  const total = plansRes?.total || 0;
  const pages = plansRes?.pages || 0;

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const filteredPlans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((r) => {
      const sales = salesUserLabel(r.sales_user).toLowerCase();
      const remarks = (r.remarks || "").toLowerCase();
      const location = (r.location || "").toLowerCase();
      const status = (r.status || "").toLowerCase();
      const planType = (r.plan_type || "visits").toLowerCase();
      const managerName = (
        r.discussed_manager_name ||
        (typeof r.discussed_manager_id === "object"
          ? r.discussed_manager_id?.name
          : "") ||
        ""
      ).toLowerCase();
      const method = (r.discussion_method || "").toLowerCase();
      return (
        sales.includes(q) ||
        remarks.includes(q) ||
        location.includes(q) ||
        status.includes(q) ||
        planType.includes(q) ||
        managerName.includes(q) ||
        method.includes(q)
      );
    });
  }, [plans, searchQuery]);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deletePlanMut(deleteTarget.id).unwrap();
      toast.success("Work plan deleted");
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete plan";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-3.5 sm:space-y-4 font-sans w-full max-w-full">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3.5 sm:p-4 rounded-2xl border border-border shadow-2xs">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">
            Work Plans Management
          </h1>
          <p className="text-[11px] sm:text-xs text-muted">
            {elevatedRole
              ? ownershipScope === "mine"
                ? "Your own work plans — create, track, and complete"
                : "Team work plans — review visits, tasks, and approvals"
              : "Plan and track daily field visits, tasks, and expense entries"}
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 sm:flex-wrap">
          <Link
            href="/dashboard/plans/calendar"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0"
          >
            <CalendarDays className="h-4 w-4 text-primary" />
            <span>Calendar</span>
          </Link>
          <button
            type="button"
            onClick={() => setDownloadOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Plans Report</span>
          </button>
          <button
            type="button"
            onClick={() => setExpenseReportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>Expense Report</span>
          </button>
          <Link
            href="/dashboard/plans/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 sm:px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover shadow-xs active:scale-95 transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Plan</span>
          </Link>
        </div>
      </div>

      {/* My Plans vs Team Plans (admin / manager) */}
      {elevatedRole && (
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setOwnershipScope("mine");
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition ${
              ownershipScope === "mine"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            My Plans
          </button>
          <button
            type="button"
            onClick={() => {
              setOwnershipScope("team");
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition ${
              ownershipScope === "team"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            Team Plans
          </button>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1.5 overflow-x-auto scrollbar-none">
        {WORK_PLAN_STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setStatusFilter(tab.id);
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition shrink-0 ${
              statusFilter === tab.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 bg-card p-3 rounded-2xl border border-border shadow-2xs">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by executive, location, remarks..."
            className="w-full rounded-xl border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <select
            value={planTypeFilter}
            onChange={(e) => {
              setPlanTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 sm:flex-initial rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
          >
            {WORK_PLAN_TYPE_TABS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-auto rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            />
            <span className="text-xs text-muted shrink-0">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-auto rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="rounded-xl p-2 text-muted hover:bg-surface-muted hover:text-foreground active:scale-95 transition cursor-pointer shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile Touch Cards View (< md) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-xs text-muted">
            Loading work plans…
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-xs text-muted">
            No work plans found for selected filters.
          </div>
        ) : (
          filteredPlans.map((r) => {
            const id = planIdOf(r);
            const canEdit = canEditPlan(r.status, { isAdmin: elevatedRole });

            return (
              <div
                key={id}
                className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs transition hover:border-primary/40 active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">
                        {formatPlanDate(r.plan_date)}
                      </span>
                      <span className="inline-flex rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-foreground uppercase tracking-wider">
                        {r.plan_type || "Visits"}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-muted truncate">
                      {salesUserLabel(r.sales_user)}
                    </p>
                  </div>
                  <div className="shrink-0">{renderPlanStatusBadge(r.status)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted pt-1 border-t border-border/50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted/80 block">Activity</span>
                    <span className="font-medium text-foreground">{planActivityLabel(r)}</span>
                  </div>
                  {r.location ? (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted/80 block">Location</span>
                      <span className="font-medium text-foreground truncate block">{r.location}</span>
                    </div>
                  ) : null}
                </div>

                {r.is_discussed_with_manager && (
                  <div className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Discussed ({formatDiscussionMethod(r.discussion_method)})</span>
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCopyTarget(r)}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-foreground active:scale-95 transition cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            id,
                            label: `Plan for ${formatPlanDate(r.plan_date)}`,
                          })
                        }
                        className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 active:scale-95 transition cursor-pointer"
                        title="Delete plan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <Link
                    href={`/dashboard/plans/${id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 active:scale-95 transition shadow-xs"
                  >
                    <span>Open Plan</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop / Tablet Table View (≥ md) */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-muted font-semibold text-muted">
              <tr>
                <th className="px-4 py-3">Plan Date</th>
                <th className="px-4 py-3">Executive</th>
                <th className="px-4 py-3">Plan Type</th>
                <th className="px-4 py-3">Location / City</th>
                <th className="px-4 py-3">Discussion</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted">
                    Loading work plans…
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted">
                    No work plans found for selected filters.
                  </td>
                </tr>
              ) : (
                filteredPlans.map((r) => {
                  const id = planIdOf(r);
                  const canEdit = canEditPlan(r.status, { isAdmin: elevatedRole });

                  return (
                    <tr key={id} className="hover:bg-surface-muted/50 transition">
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">
                        {formatPlanDate(r.plan_date)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {salesUserLabel(r.sales_user)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                          {r.plan_type || "Visits"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {r.location || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.is_discussed_with_manager ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <MessageSquare className="h-3 w-3" />
                              {formatDiscussionMethod(r.discussion_method)}
                            </span>
                            <div
                              className="text-[11px] text-muted truncate max-w-[140px]"
                              title={
                                r.discussed_manager_name ||
                                (typeof r.discussed_manager_id === "object"
                                  ? r.discussed_manager_id?.name
                                  : "") ||
                                "Manager"
                              }
                            >
                              with{" "}
                              {r.discussed_manager_name ||
                                (typeof r.discussed_manager_id === "object"
                                  ? r.discussed_manager_id?.name
                                  : "") ||
                                "Manager"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted font-medium">
                        {planActivityLabel(r)}
                      </td>
                      <td className="px-4 py-3">{renderPlanStatusBadge(r.status)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/plans/${id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline active:scale-95 transition"
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setCopyTarget(r)}
                            className="rounded p-1 text-muted hover:bg-primary/10 hover:text-primary active:scale-95 transition cursor-pointer"
                            title="Copy plan"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                    id,
                                    label: `Plan for ${formatPlanDate(r.plan_date)}`,
                                })
                              }
                              className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500 active:scale-95 transition cursor-pointer"
                              title="Delete plan"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
            <div className="text-muted">
              Showing page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
              <span className="font-semibold text-foreground">{pages}</span> ({total} total plans)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 active:scale-95 transition cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= pages || loading}
                onClick={() => setCurrentPage((p) => Math.min(pages, p + 1))}
                className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 active:scale-95 transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {copyTarget && (
        <CopyWorkPlanModal
          open={Boolean(copyTarget)}
          sourcePlanId={String(copyTarget._id || copyTarget.id)}
          sourcePlanDate={copyTarget.plan_date}
          sourcePlanType={copyTarget.plan_type}
          sourceExecutiveName={salesUserLabel(copyTarget.sales_user)}
          sourceSalesUserId={
            typeof copyTarget.sales_user === "object" && copyTarget.sales_user
              ? String(copyTarget.sales_user._id || copyTarget.sales_user.id)
              : String(copyTarget.sales_user || "")
          }
          onClose={() => setCopyTarget(null)}
        />
      )}

      {deleteTarget ? (
        <ConfirmDeleteWorkPlanModal
          planId={deleteTarget.id}
          planLabel={deleteTarget.label}
          isDeleting={isDeleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      {downloadOpen ? (
        <DownloadWorkPlansModal
          open={downloadOpen}
          plans={filteredPlans}
          onClose={() => setDownloadOpen(false)}
        />
      ) : null}

      {expenseReportOpen ? (
        <DownloadExpensesModal
          open={expenseReportOpen}
          onClose={() => setExpenseReportOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default WorkPlansPage;
