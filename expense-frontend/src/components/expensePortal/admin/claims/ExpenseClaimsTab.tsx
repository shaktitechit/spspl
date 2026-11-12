"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  RefreshCw,
  FileSpreadsheet,
  Eye,
  Paperclip,
  Users,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  FileCheck,
  Calendar,
  ChevronDown,
  ChevronRight,
  Layers,
  Table as TableIcon,
  ChevronsUpDown,
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
  renderWorkPlanBadge,
  salesUserLabel,
  stripHtml,
} from "@/components/expensePortal/shared/workPlanUtils";
import {
  canApproveExpenseRecord,
  canRejectExpenseRecord,
  resolveExpenseOwnerId,
} from "@/components/expensePortal/shared/expensePermissions";
import { extractRecordYmd, toYmdString, getCurrentMonthRange } from "@/components/expensePortal/shared/dateRangeHelpers";
import { useExpenseRole } from "@/context/ExpenseRoleContext";
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
  onOpenSeniorRemarks?: (data: {
    planId: string;
    expenseId: string;
    title: string;
    currentStatus: string;
    assigneeName: string;
    remarks: string;
    history: any[];
  }) => void;
  onOpenThread?: (item: any) => void;
  onOpenApproveModal: (target: { planId: string; expense: WorkPlanExpenseRecord }) => void;
  onOpenRejectModal: (target: { planId: string; expenseId: string }) => void;
  onOpenSettleModal?: (user: { _id: string; name: string }, expenseId: string) => void;
  sessionToken?: string;
  isFinanceMode?: boolean;
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
  isFinanceMode,
}: ExpenseClaimsTabProps) {
  const { isCurrentFinanceMode } = useExpenseRole();
  const isFinance = isFinanceMode ?? isCurrentFinanceMode;

  const [statusFilter, setStatusFilter] = useState<string>(isFinance ? "approved" : "all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const [collapsedUsers, setCollapsedUsers] = useState<Record<string, boolean>>({});

  const [approveExpenseMut] = useApproveExpenseMutation();

  const isViewingSelf =
    ownershipScope === "mine" ||
    (selectedExecutive !== "all" && String(selectedExecutive) === String(currentUser?._id || ""));

  // In admin claim list no draft; in finance only approved shall be shown
  const statusOptions = useMemo(() => {
    return isFinance ? ["approved"] : ["all", "submitted", "approved", "rejected"];
  }, [isFinance]);

  // Synchronize statusFilter when switching between admin and finance modes
  useEffect(() => {
    if (isFinance) {
      if (statusFilter !== "approved") {
        setStatusFilter("approved");
        setCurrentPage(1);
      }
    } else if (statusFilter === "draft") {
      setStatusFilter("all");
      setCurrentPage(1);
    }
  }, [isFinance, statusFilter]);

  const currentMonthRange = useMemo(() => getCurrentMonthRange(), []);
  const isCurrentMonthActive = Boolean(
    dateFrom &&
      dateTo &&
      dateFrom === currentMonthRange.from &&
      dateTo === currentMonthRange.to
  );

  const hasActiveFilters = Boolean(
    (!isFinance && statusFilter !== "all") ||
      (selectedExecutive && selectedExecutive !== "all") ||
      dateFrom ||
      dateTo ||
      searchQuery
  );

  function resetFilters() {
    setStatusFilter(isFinance ? "approved" : "all");
    setSelectedExecutive("all");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
    setCurrentPage(1);
  }

  const queryParams = useMemo(() => {
    const p: Record<string, string | number | undefined> = {
      page: currentPage,
      limit: 100,
    };
    if (isFinance) {
      p.status = "approved";
      p.role = "finance";
    } else if (statusFilter !== "all") {
      p.status = statusFilter;
    }
    if (selectedExecutive && selectedExecutive !== "all") p.user_id = selectedExecutive;
    if (dateFrom) p.from_date = dateFrom;
    if (dateTo) p.to_date = dateTo;
    return p;
  }, [currentPage, isFinance, statusFilter, selectedExecutive, dateFrom, dateTo]);

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

interface UserExpenseGroup {
  userId: string;
  userName: string;
  userEmail: string;
  workPlanId?: string;
  workPlan?: any;
  expenses: WorkPlanExpenseRecord[];
  totalAmount: number;
  statusCounts: Record<string, number>;
}

interface DateExpenseGroup {
  dateKey: string;
  mainDate: string;
  weekday: string;
  isToday: boolean;
  isYesterday: boolean;
  userGroups: UserExpenseGroup[];
  totalAmount: number;
  totalExpensesCount: number;
  totalUsersCount: number;
}

function formatGroupDateHeader(dateInput: any): {
  mainDate: string;
  weekday: string;
  isToday: boolean;
  isYesterday: boolean;
} {
  const ymd = extractRecordYmd(dateInput);
  if (!ymd) {
    return {
      mainDate: dateInput ? formatPlanDate(dateInput) : "Unspecified Date",
      weekday: "",
      isToday: false,
      isYesterday: false,
    };
  }

  const [yearStr, monthStr, dayStr] = ymd.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) {
    return {
      mainDate: formatPlanDate(dateInput),
      weekday: "",
      isToday: false,
      isYesterday: false,
    };
  }

  const now = new Date();
  const todayYmd = toYmdString(now);
  const isToday = ymd === todayYmd;

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const isYesterday = ymd === toYmdString(yesterdayDate);

  const mainDate = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const weekday = d.toLocaleDateString("en-IN", { weekday: "long" });

  return { mainDate, weekday, isToday, isYesterday };
}

  const filteredExpenses = useMemo(() => {
    let list = expenses;
    if (isFinance) {
      list = list.filter((e) => e.status === "approved");
    } else {
      list = list.filter((e) => e.status !== "draft");
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => {
        const cat = (EXPENSE_CATEGORY_LABELS[e.category] || e.category || "").toLowerCase();
        const desc = (e.description || "").toLowerCase();
        const userLabel = salesUserLabel(e.sales_user || (e as any).work_plan?.sales_user || (e as any).work_plan, executiveOptions).toLowerCase();
        return cat.includes(q) || desc.includes(q) || userLabel.includes(q);
      });
    }

    // Sort latest to oldest date order (checking Work Plan of the day first)
    return [...list].sort((a, b) => {
      const wpA = a.work_plan && typeof a.work_plan === "object" ? a.work_plan : null;
      const wpB = b.work_plan && typeof b.work_plan === "object" ? b.work_plan : null;
      const dateA = extractRecordYmd(wpA?.plan_date || a.expense_date || (a as any).createdAt) || "";
      const dateB = extractRecordYmd(wpB?.plan_date || b.expense_date || (b as any).createdAt) || "";
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // Latest date first
      }
      const timeA = new Date((a as any).createdAt || a.expense_date || 0).getTime();
      const timeB = new Date((b as any).createdAt || b.expense_date || 0).getTime();
      return timeB - timeA;
    });
  }, [expenses, searchQuery, executiveOptions, isFinance]);

  // Group expenses by Work Plan of the day first, and list expenses by work plan id
  const groupedDateExpenses = useMemo(() => {
    const dateMap = new Map<
      string,
      {
        dateKey: string;
        mainDate: string;
        weekday: string;
        isToday: boolean;
        isYesterday: boolean;
        userMap: Map<string, UserExpenseGroup>;
        totalAmount: number;
        totalExpensesCount: number;
      }
    >();

    for (const exp of filteredExpenses) {
      const wp = exp.work_plan && typeof exp.work_plan === "object" ? exp.work_plan : null;
      const wpId = wp ? String(wp._id || wp.id || "") : (typeof exp.work_plan === "string" ? exp.work_plan : "");

      // 1. First check work plan of the day: determine date from work plan's plan_date if linked
      const rawDate = wp?.plan_date || exp.expense_date || (exp as any).createdAt;
      const ymd = extractRecordYmd(rawDate) || "unknown";

      if (!dateMap.has(ymd)) {
        const headerInfo = formatGroupDateHeader(rawDate);
        dateMap.set(ymd, {
          dateKey: ymd,
          mainDate: headerInfo.mainDate,
          weekday: headerInfo.weekday,
          isToday: headerInfo.isToday,
          isYesterday: headerInfo.isYesterday,
          userMap: new Map(),
          totalAmount: 0,
          totalExpensesCount: 0,
        });
      }

      const dateEntry = dateMap.get(ymd)!;
      const amount = Number(exp.amount) || 0;
      dateEntry.totalAmount += amount;
      dateEntry.totalExpensesCount += 1;

      const sUserId = resolveExpenseOwnerId(exp);
      const sUserName = salesUserLabel(
        exp.sales_user || wp?.sales_user,
        executiveOptions
      );
      let sUserEmail = "";
      if (typeof exp.sales_user === "object" && exp.sales_user !== null) {
        sUserEmail = (exp.sales_user as any).email || "";
      } else if (wp && typeof wp === "object" && wp.sales_user) {
        const wpUser = wp.sales_user;
        if (typeof wpUser === "object" && wpUser !== null) {
          sUserEmail = wpUser.email || "";
        }
      }

      // 2. Group within the day by executive AND work plan id (so expenses are strictly listed by work plan id)
      const planGroupKey = `${sUserId || sUserName || "unassigned"}__${wpId || "direct"}`;

      if (!dateEntry.userMap.has(planGroupKey)) {
        dateEntry.userMap.set(planGroupKey, {
          userId: sUserId,
          userName: sUserName,
          userEmail: sUserEmail,
          workPlanId: wpId,
          workPlan: wp,
          expenses: [],
          totalAmount: 0,
          statusCounts: {},
        });
      }

      const userEntry = dateEntry.userMap.get(planGroupKey)!;
      userEntry.expenses.push(exp);
      userEntry.totalAmount += amount;
      const st = exp.status || "submitted";
      userEntry.statusCounts[st] = (userEntry.statusCounts[st] || 0) + 1;
      if (!userEntry.workPlan && wp) {
        userEntry.workPlan = wp;
      }
    }

    const result: DateExpenseGroup[] = Array.from(dateMap.values()).map((d) => {
      const userGroups = Array.from(d.userMap.values()).sort((a, b) =>
        a.userName.localeCompare(b.userName)
      );

      for (const u of userGroups) {
        u.expenses.sort((a, b) => {
          const tA = new Date((a as any).createdAt || a.expense_date || 0).getTime();
          const tB = new Date((b as any).createdAt || b.expense_date || 0).getTime();
          return tB - tA;
        });
      }

      return {
        dateKey: d.dateKey,
        mainDate: d.mainDate,
        weekday: d.weekday,
        isToday: d.isToday,
        isYesterday: d.isYesterday,
        userGroups,
        totalAmount: d.totalAmount,
        totalExpensesCount: d.totalExpensesCount,
        totalUsersCount: userGroups.length,
      };
    });

    // Sort dates descending: latest date first
    result.sort((a, b) => {
      if (a.dateKey === "unknown") return 1;
      if (b.dateKey === "unknown") return -1;
      return b.dateKey.localeCompare(a.dateKey);
    });

    return result;
  }, [filteredExpenses, executiveOptions]);

  function toggleDate(dateKey: string) {
    setCollapsedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  }

  function toggleUser(key: string) {
    setCollapsedUsers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  const areAllCollapsed = useMemo(() => {
    if (groupedDateExpenses.length === 0) return false;
    return groupedDateExpenses.every((d) => collapsedDates[d.dateKey]);
  }, [groupedDateExpenses, collapsedDates]);

  function handleToggleAllCollapse() {
    if (areAllCollapsed) {
      setCollapsedDates({});
      setCollapsedUsers({});
    } else {
      const nextCollapsed: Record<string, boolean> = {};
      for (const d of groupedDateExpenses) {
        nextCollapsed[d.dateKey] = true;
      }
      setCollapsedDates(nextCollapsed);
    }
  }

  function renderExpenseRow(exp: WorkPlanExpenseRecord, idx: number, showDateAndUser: boolean) {
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
    const sUserName = salesUserLabel(
      exp.sales_user || (exp as any).work_plan?.sales_user || (exp as any).work_plan,
      executiveOptions
    );

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
        {showDateAndUser && (
          <>
            <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
              {formatPlanDate(exp.expense_date)}
            </td>
            <td className="px-4 py-3 whitespace-nowrap font-semibold text-foreground">
              <div>{sUserName}</div>
              {exp.work_plan && typeof exp.work_plan === "object" && (
                <div className="mt-1">
                  {renderWorkPlanBadge(exp.work_plan)}
                </div>
              )}
            </td>
          </>
        )}
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
          {!isFinance && hasDirective && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              {(() => {
                const isObj =
                  latestRemark?.remark_type === "objection" ||
                  (!latestRemark?.remark_type && /objection/i.test(exp.manager_remarks || ""));
                const isApp =
                  latestRemark?.remark_type === "appreciation" ||
                  (!latestRemark?.remark_type && /appreciation/i.test(exp.manager_remarks || ""));
                const btnColor = isObj
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20"
                  : isApp
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20";
                const label = isObj
                  ? `⚠️ Objection (${authRemarks.length || 1})`
                  : isApp
                  ? `⭐ Appreciation (${authRemarks.length || 1})`
                  : `📋 Senior Directive (${authRemarks.length || 1})`;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      const item = buildExpenseThreadItem(exp, planId);
                      onOpenThread?.(item);
                    }}
                    className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${btnColor}`}
                    title="Click to view directive & follow-up thread"
                  >
                    <MessageSquare className="h-3 w-3" />
                    <span>{label}</span>
                  </button>
                );
              })()}
              {latestRemark?.remark ? (
                <p className="text-[10px] text-muted italic line-clamp-1 max-w-[200px]">
                  &ldquo;{stripHtml(latestRemark.remark)}&rdquo;
                </p>
              ) : exp.manager_remarks ? (
                <p className="text-[10px] text-muted italic line-clamp-1 max-w-[200px]">
                  &ldquo;{stripHtml(exp.manager_remarks)}&rdquo;
                </p>
              ) : null}
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
        <td className="px-4 py-3 whitespace-nowrap">
          {exp.approved_by ? (
            <div>
              <span className="font-semibold text-foreground text-xs block">
                {typeof exp.approved_by === "object"
                  ? (exp.approved_by as any).name || (exp.approved_by as any).email
                  : exp.approved_by}
              </span>
              {exp.approved_at && (
                <span className="text-[10px] text-muted block">
                  {formatPlanDate(exp.approved_at)}
                </span>
              )}
            </div>
          ) : exp.status === "approved" ? (
            <span className="text-emerald-600 font-semibold text-xs">Approved</span>
          ) : (
            <span className="text-muted text-[11px]">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-1.5">
            {!isFinance && (
              <button
                type="button"
                onClick={() => {
                  onOpenSeniorRemarks?.({
                    planId: planId || "standalone",
                    expenseId: expId,
                    title: `${categoryName} Claim (${formatCurrency(exp.amount)})`,
                    currentStatus: exp.status,
                    assigneeName: sUserName,
                    remarks: exp.manager_remarks || "",
                    history: exp.authority_remarks || [],
                  });
                }}
                className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
                title="Add Supervisory Directive / Remark"
              >
                <ShieldCheck className="h-3 w-3" />
                <span>Remark</span>
              </button>
            )}

            {canApprove && (
              <button
                type="button"
                onClick={() => onOpenApproveModal({ planId: planId || "standalone", expense: exp })}
                className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
              >
                Approve
              </button>
            )}
            {canReject && (
              <button
                type="button"
                onClick={() => onOpenRejectModal({ planId: planId || "standalone", expenseId: expId })}
                className="rounded bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/20 transition cursor-pointer"
              >
                Reject
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  function renderExpenseMobileCard(exp: WorkPlanExpenseRecord, idx: number, showDateAndUser: boolean) {
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
    const sUserName = salesUserLabel(
      exp.sales_user || (exp as any).work_plan?.sales_user || (exp as any).work_plan,
      executiveOptions
    );

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
      <div key={expId} className="p-4 space-y-2.5 hover:bg-surface-muted/30 transition">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-foreground">{categoryName}</span>
              {exp.sub_category && (
                <span className="text-[11px] text-muted">• {exp.sub_category}</span>
              )}
            </div>
            {showDateAndUser && (
              <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5 flex-wrap">
                <span>{formatPlanDate(exp.expense_date)}</span>
                <span>•</span>
                <span className="font-medium text-foreground">{sUserName}</span>
                {exp.work_plan && typeof exp.work_plan === "object" && (
                  <div className="w-full mt-1">
                    {renderWorkPlanBadge(exp.work_plan)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs font-extrabold text-foreground">{formatCurrency(exp.amount)}</div>
            <div className="mt-1">{renderExpenseStatusBadge(exp.status)}</div>
          </div>
        </div>

        {exp.description && <p className="text-xs text-muted line-clamp-2">{exp.description}</p>}
        {isBike && (exp.total_km != null || exp.rate_per_km != null) && (
          <span className="text-[10px] text-muted block">
            {exp.total_km ?? 0} km × ₹{exp.rate_per_km ?? 0}/km
          </span>
        )}

        {/* Senior Directive Callout */}
        {!isFinance && hasDirective && (
          <div className="pt-0.5 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(() => {
                const isObj =
                  latestRemark?.remark_type === "objection" ||
                  (!latestRemark?.remark_type && /objection/i.test(exp.manager_remarks || ""));
                const isApp =
                  latestRemark?.remark_type === "appreciation" ||
                  (!latestRemark?.remark_type && /appreciation/i.test(exp.manager_remarks || ""));
                const btnColor = isObj
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20"
                  : isApp
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20";
                const label = isObj
                  ? `⚠️ Objection (${authRemarks.length || 1})`
                  : isApp
                  ? `⭐ Appreciation (${authRemarks.length || 1})`
                  : `📋 Senior Directive (${authRemarks.length || 1})`;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      const item = buildExpenseThreadItem(exp, planId);
                      onOpenThread?.(item);
                    }}
                    className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${btnColor}`}
                  >
                    <MessageSquare className="h-3 w-3" />
                    <span>{label}</span>
                  </button>
                );
              })()}
              {exp.manager_remarks && !authRemarks.length && (
                <span className="text-[10px] text-muted italic line-clamp-1">
                  &ldquo;{exp.manager_remarks}&rdquo;
                </span>
              )}
            </div>
          </div>
        )}

        {/* Receipts & Actions */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
          <div>
            {attList.length > 0 && (
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
                      className="inline-flex items-center gap-1 rounded border border-border bg-surface-muted px-2 py-0.5 text-[10px] text-foreground hover:border-primary/40 transition cursor-pointer"
                    >
                      <Eye className="h-3 w-3 text-primary" />
                      <span>Receipt</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {!isFinance && (
              <button
                type="button"
                onClick={() => {
                  onOpenSeniorRemarks?.({
                    planId: planId || "standalone",
                    expenseId: expId,
                    title: `${categoryName} Claim (${formatCurrency(exp.amount)})`,
                    currentStatus: exp.status,
                    assigneeName: sUserName,
                    remarks: exp.manager_remarks || "",
                    history: exp.authority_remarks || [],
                  });
                }}
                className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition cursor-pointer inline-flex items-center gap-1"
                title="Add Directive / Remark"
              >
                <ShieldCheck className="h-3 w-3" />
                <span>Remark</span>
              </button>
            )}
            {canApprove && (
              <button
                type="button"
                onClick={() => onOpenApproveModal({ planId: planId || "standalone", expense: exp })}
                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
              >
                Approve
              </button>
            )}
            {canReject && (
              <button
                type="button"
                onClick={() => onOpenRejectModal({ planId: planId || "standalone", expenseId: expId })}
                className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/20 transition cursor-pointer"
              >
                Reject
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function buildExpenseThreadItem(exp: WorkPlanExpenseRecord, pId: string): SeniorRemarkFeedItem {
    const authRemarks = Array.isArray(exp.authority_remarks) ? exp.authority_remarks : [];
    const r = authRemarks.length > 0 ? authRemarks[authRemarks.length - 1] : ({} as any);
    const sUserId = resolveExpenseOwnerId(exp);
    const sUserName = salesUserLabel(exp.sales_user || (exp as any).work_plan?.sales_user || (exp as any).work_plan, executiveOptions);
    const expId = exp._id || exp.id || "";
    const categoryName = EXPENSE_CATEGORY_LABELS[exp.category] || exp.category;
    const amountStr = exp.amount != null ? `₹${exp.amount}` : "";
    const expTitle = `${categoryName} Claim ${amountStr ? `(${amountStr})` : ""} - ${exp.description || "Expense"}`;

    const isObjectionNote =
      r.remark_type === "objection" ||
      (!r.remark_type && /objection/i.test(exp.manager_remarks || ""));
    const isAppreciationNote =
      r.remark_type === "appreciation" ||
      (!r.remark_type && /appreciation/i.test(exp.manager_remarks || ""));
    const computedRemarkType = isObjectionNote
      ? "objection"
      : isAppreciationNote
      ? "appreciation"
      : (r.remark_type || "instruction");

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
      remark_type: computedRemarkType,
      priority: computedRemarkType === "objection" ? (r.priority || "high") : (r.priority || "medium"),
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
              if (isFinance) return;
              setStatusFilter(st);
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize whitespace-nowrap active:scale-95 transition shrink-0 cursor-pointer ${
              statusFilter === st
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {st === "all" ? "All Claims" : st === "approved" && isFinance ? "Approved Claims" : st}
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
          <button
            type="button"
            onClick={() => {
              const range = getCurrentMonthRange();
              setDateFrom(range.from);
              setDateTo(range.to);
              setCurrentPage(1);
            }}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              isCurrentMonthActive
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface-muted text-muted hover:text-foreground hover:bg-card"
            }`}
            title="Filter to current month"
          >
            This Month
          </button>
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

        {/* View mode toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grouped")}
            className={`rounded px-2 py-1 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
              viewMode === "grouped"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
            title="Group by Date & User"
          >
            <Layers className="h-3 w-3" />
            <span className="hidden sm:inline">Grouped</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("flat")}
            className={`rounded px-2 py-1 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
              viewMode === "flat"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
            title="Flat table view"
          >
            <TableIcon className="h-3 w-3" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {/* ───────────── GROUPED VIEW ───────────── */}
      {viewMode === "grouped" && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-xs text-muted">
              Loading expense claims…
            </div>
          ) : groupedDateExpenses.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-xs text-muted">
              No expense claims found.
            </div>
          ) : (
            <>
              {/* Collapse-all toolbar */}
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] text-muted">
                  <span className="font-semibold text-foreground">{groupedDateExpenses.length}</span>{" "}
                  date{groupedDateExpenses.length !== 1 ? "s" : ""} ·{" "}
                  <span className="font-semibold text-foreground">{filteredExpenses.length}</span> expense
                  {filteredExpenses.length !== 1 ? "s" : ""}
                </p>
                <button
                  type="button"
                  onClick={handleToggleAllCollapse}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
                >
                  <ChevronsUpDown className="h-3 w-3" />
                  {areAllCollapsed ? "Expand All" : "Collapse All"}
                </button>
              </div>

              {groupedDateExpenses.map((dateGroup) => {
                const isDateCollapsed = !!collapsedDates[dateGroup.dateKey];
                return (
                  <div
                    key={dateGroup.dateKey}
                    className="rounded-xl border border-border bg-card overflow-hidden shadow-xs"
                  >
                    {/* ── DATE HEADER ── */}
                    <button
                      type="button"
                      onClick={() => toggleDate(dateGroup.dateKey)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface-muted/60 hover:bg-surface-muted transition cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <Calendar className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">
                            {dateGroup.mainDate}
                          </span>
                          {dateGroup.weekday && (
                            <span className="text-[11px] text-muted">{dateGroup.weekday}</span>
                          )}
                          {dateGroup.isToday && (
                            <span className="text-[10px] font-extrabold uppercase bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">
                              Today
                            </span>
                          )}
                          {dateGroup.isYesterday && (
                            <span className="text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                              Yesterday
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-1">
                          <span className="text-[11px] text-muted">
                            {dateGroup.totalUsersCount} user{dateGroup.totalUsersCount !== 1 ? "s" : ""}
                          </span>
                          <span className="text-muted">·</span>
                          <span className="text-[11px] text-muted">
                            {dateGroup.totalExpensesCount} claim{dateGroup.totalExpensesCount !== 1 ? "s" : ""}
                          </span>
                          <span className="text-muted">·</span>
                          <span className="text-xs font-bold text-foreground">
                            {formatCurrency(dateGroup.totalAmount)}
                          </span>
                        </div>
                      </div>
                      {isDateCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted shrink-0" />
                      )}
                    </button>

                    {/* ── USER GROUPS UNDER DATE ── */}
                    {!isDateCollapsed && (
                      <div className="divide-y divide-border/60">
                        {dateGroup.userGroups.map((userGroup) => {
                          const userKey = `${dateGroup.dateKey}__${userGroup.userId || userGroup.userName}__${userGroup.workPlanId || "direct"}`;
                          const isUserCollapsed = !!collapsedUsers[userKey];
                          const initials = userGroup.userName
                            .split(" ")
                            .slice(0, 2)
                            .map((w: string) => w[0]?.toUpperCase() || "")
                            .join("");

                          return (
                            <div key={userKey}>
                              {/* User sub-header */}
                              <button
                                type="button"
                                onClick={() => toggleUser(userKey)}
                                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-card hover:bg-surface-muted/40 transition cursor-pointer text-left"
                              >
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-extrabold">
                                    {initials}
                                  </div>
                                  <div>
                                    <span className="text-xs font-semibold text-foreground">
                                      {userGroup.userName}
                                    </span>
                                    {userGroup.userEmail && (
                                      <span className="block text-[10px] text-muted">
                                        {userGroup.userEmail}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 ml-2 flex-wrap">
                                    <span className="text-[11px] text-muted">
                                      {userGroup.expenses.length} claim{userGroup.expenses.length !== 1 ? "s" : ""}
                                    </span>
                                    <span className="text-muted">·</span>
                                    <span className="text-xs font-bold text-foreground">
                                      {formatCurrency(userGroup.totalAmount)}
                                    </span>
                                    {/* Status summary pills */}
                                    <div className="hidden sm:flex items-center gap-1">
                                      {Object.entries(userGroup.statusCounts).map(([st, cnt]) => (
                                        <span key={st} className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-surface-muted border border-border text-muted">
                                          {st} {cnt}
                                        </span>
                                      ))}
                                    </div>
                                    {/* Work Plan Badge */}
                                    <div className="hidden lg:flex items-center gap-1 ml-1">
                                      {userGroup.workPlan ? (
                                        renderWorkPlanBadge(userGroup.workPlan)
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted italic bg-surface-muted/50 border border-border/50">
                                          Direct Claim
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {isUserCollapsed ? (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted shrink-0" />
                                )}
                              </button>

                              {/* Expenses for this user on this date */}
                              {!isUserCollapsed && (
                                <>
                                  {/* Day Work Plan Details Bar */}
                                  <div className="flex items-center justify-between gap-3 px-4 py-2 bg-surface-muted/30 border-b border-border/60 text-xs flex-wrap">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                                        Day Work Plan:
                                      </span>
                                      {userGroup.workPlan ? (
                                        renderWorkPlanBadge(userGroup.workPlan)
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted bg-surface-muted/50 border border-border/50">
                                          Direct Claims (No Work Plan)
                                        </span>
                                      )}
                                    </div>
                                    {userGroup.workPlan?.status && (
                                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-card border border-border text-muted">
                                        Plan: {userGroup.workPlan.status}
                                      </span>
                                    )}
                                  </div>
                                  {/* Mobile cards */}
                                  <div className="md:hidden divide-y divide-border/50 bg-surface-muted/10">
                                    {userGroup.expenses.map((exp, idx) =>
                                      renderExpenseMobileCard(exp, idx, false)
                                    )}
                                  </div>

                                  {/* Desktop table */}
                                  <div className="hidden md:block overflow-x-auto bg-surface-muted/10">
                                    <table className="w-full text-left text-xs text-muted">
                                      <thead className="border-b border-border/60 bg-surface-muted/30 text-[10px] font-semibold uppercase text-muted">
                                        <tr>
                                          <th className="px-4 py-2">Category</th>
                                          <th className="px-4 py-2">Description / Breakdown</th>
                                          <th className="px-4 py-2">Receipts</th>
                                          <th className="px-4 py-2">Amount</th>
                                          <th className="px-4 py-2">Status</th>
                                          <th className="px-4 py-2">Approved By</th>
                                          <th className="px-4 py-2 text-right">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/50">
                                        {userGroup.expenses.map((exp, idx) =>
                                          renderExpenseRow(exp, idx, false)
                                        )}
                                      </tbody>
                                      {userGroup.expenses.length > 1 && (
                                        <tfoot className="border-t border-border/60 bg-surface-muted/20">
                                          <tr>
                                            <td colSpan={3} className="px-4 py-2 text-[11px] font-semibold text-foreground">
                                              Subtotal — {userGroup.userName}
                                            </td>
                                            <td className="px-4 py-2 text-xs font-extrabold text-foreground whitespace-nowrap">
                                              {formatCurrency(userGroup.totalAmount)}
                                            </td>
                                            <td colSpan={3} />
                                          </tr>
                                        </tfoot>
                                      )}
                                    </table>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}

                        {/* Date total footer */}
                        {dateGroup.totalUsersCount > 1 && (
                          <div className="px-4 py-2.5 bg-surface-muted/40 flex items-center justify-between border-t border-border/60">
                            <span className="text-[11px] text-muted font-semibold">
                              Daily Total — {dateGroup.mainDate}
                            </span>
                            <span className="text-sm font-extrabold text-foreground">
                              {formatCurrency(dateGroup.totalAmount)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Pagination (grouped mode) */}
          {pages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-xs">
              <div className="text-muted">
                Page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
                <span className="font-semibold text-foreground">{pages}</span> ({total} total)
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
      )}

      {/* ───────────── FLAT TABLE VIEW ───────────── */}
      {viewMode === "flat" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Mobile View */}
          <div className="md:hidden divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted">Loading expense claims…</div>
            ) : filteredExpenses.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">No expense claims found.</div>
            ) : (
              filteredExpenses.map((exp, idx) => renderExpenseMobileCard(exp, idx, true))
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
                  <th className="px-4 py-3">Approved By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-xs text-muted">
                      Loading expense claims…
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-xs text-muted">
                      No expense claims found.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp, idx) => renderExpenseRow(exp, idx, true))
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
      )}
    </div>
  );
}
