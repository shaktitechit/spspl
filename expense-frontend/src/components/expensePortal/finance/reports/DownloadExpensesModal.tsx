"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  X,
  Download,
  FileSpreadsheet,
  Filter,
  Search,
  RefreshCw,
  Calendar,
  IndianRupee,
  ShieldCheck,
  Wallet,
  Table,
  SlidersHorizontal,
  RotateCcw,
  Users,
  CreditCard,
  Building2,
  Receipt,
  FileText,
  ExternalLink,
  Eye,
  Layers,
} from "lucide-react";
import {
  useLazyGetExpensesQuery,
  useLazyGetTourAdvancesQuery,
  useLazyGetExpenseSettlementsQuery,
  useGetWorkPlannerUsersQuery,
} from "@/store/api/expenseApiSlice";
import {
  WORK_PLAN_EXPENSE_CATEGORIES,
  WORK_PLAN_EXPENSE_PAYMENT_MODES,
  WORK_PLAN_TRAVEL_SUB_CATEGORIES,
  type WorkPlanExpenseRecord,
  type WorkPlanTourAdvanceRecord,
  type WorkPlanExpenseSettlementRecord,
  type ExpenseAttachmentItem,
} from "@/types/workPlanner";
import {
  formatPlanDate,
  salesUserLabel,
  WORK_PLAN_EXPENSE_STATUS_TABS,
  renderExpenseStatusBadge,
  renderWorkPlanBadge,
  formatWorkPlanSummaryText,
  formatWorkPlanTasksVisits,
  formatWorkPlanLocation,
} from "@/components/expensePortal/shared/workPlanUtils";
import {
  calculateDateRange,
  type DateFilterPreset,
  toYmdString,
  extractRecordYmd,
} from "@/components/expensePortal/shared/dateRangeHelpers";
import { usePdfCompanyLetterhead } from "@/components/expensePortal/shared/pdfCompanyLetterhead";
import { downloadPdfReport } from "@/components/expensePortal/finance/reports/exportPdfReport";
import { downloadExcelReport } from "@/components/expensePortal/finance/reports/exportExcelReport";
import { isExpenseAdmin, isExpenseFinance, isSuperAdmin, readSessionFromStorage } from "@/utils/authStorage";
import { FilePreviewModal, useFilePreview } from "@/components/expensePortal/shared/FilePreviewModal";

export type DownloadExpensesModalProps = {
  open: boolean;
  expenses?: WorkPlanExpenseRecord[];
  onClose: () => void;
};

type ReportDatePreset = "all" | DateFilterPreset;
type ReportTab = "claims" | "advances" | "settlements";

export type ExtractedAttachment = {
  name: string;
  url: string;
  mime?: string;
};

export function extractExpenseAttachments(e: WorkPlanExpenseRecord): ExtractedAttachment[] {
  const list: ExtractedAttachment[] = [];

  const addOne = (att: any, defaultName: string) => {
    if (!att) return;
    if (typeof att === "string") {
      const isId = /^[0-9a-fA-F]{24}$/.test(att);
      const url = isId ? `/api/attachments/${att}/view` : att;
      list.push({ name: defaultName, url });
      return;
    }
    if (typeof att === "object") {
      const id = att._id || att.id;
      const originalName = att.original_name || att.filename || att.name || defaultName;
      const mime = att.mime_type || att.mime;
      const url = id ? `/api/attachments/${id}/view` : att.url || "";
      if (url) {
        list.push({ name: originalName, url, mime });
      }
    }
  };

  if (Array.isArray(e.attachments)) {
    e.attachments.forEach((a, i) => addOne(a, `Attachment #${i + 1}`));
  }
  if (e.receipt_attachment) {
    addOne(e.receipt_attachment, "Receipt Document");
  }
  if (e.start_reading_image) {
    addOne(e.start_reading_image, "Start Reading Image");
  }
  if (e.end_reading_image) {
    addOne(e.end_reading_image, "Closing Reading Image");
  }

  const seen = new Set<string>();
  return list.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export function extractAdvanceAttachments(adv: WorkPlanTourAdvanceRecord): ExtractedAttachment[] {
  const list: ExtractedAttachment[] = [];

  const addOne = (att: any, defaultName: string) => {
    if (!att) return;
    if (typeof att === "string") {
      const isId = /^[0-9a-fA-F]{24}$/.test(att);
      const url = isId ? `/api/attachments/${att}/view` : att;
      list.push({ name: defaultName, url });
      return;
    }
    if (typeof att === "object") {
      const id = att._id || att.id;
      const originalName = att.original_name || att.filename || att.name || defaultName;
      const mime = att.mime_type || att.mime;
      const url = id ? `/api/attachments/${id}/view` : att.url || "";
      if (url) {
        list.push({ name: originalName, url, mime });
      }
    }
  };

  if (Array.isArray(adv.attachments)) {
    adv.attachments.forEach((a, i) => addOne(a, `Advance Request Proof #${i + 1}`));
  }
  if (Array.isArray((adv as any).disbursement_attachments)) {
    (adv as any).disbursement_attachments.forEach((a: any, i: number) =>
      addOne(a, `Disbursement Proof #${i + 1}`),
    );
  }

  const seen = new Set<string>();
  return list.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export function extractSettlementAttachments(set: WorkPlanExpenseSettlementRecord): ExtractedAttachment[] {
  const list: ExtractedAttachment[] = [];

  const addOne = (att: any, defaultName: string) => {
    if (!att) return;
    if (typeof att === "string") {
      const isId = /^[0-9a-fA-F]{24}$/.test(att);
      const url = isId ? `/api/attachments/${att}/view` : att;
      list.push({ name: defaultName, url });
      return;
    }
    if (typeof att === "object") {
      const id = att._id || att.id;
      const originalName = att.original_name || att.filename || att.name || defaultName;
      const mime = att.mime_type || att.mime;
      const url = id ? `/api/attachments/${id}/view` : att.url || "";
      if (url) {
        list.push({ name: originalName, url, mime });
      }
    }
  };

  if (Array.isArray(set.attachments)) {
    set.attachments.forEach((a, i) => addOne(a, `Settlement Voucher #${i + 1}`));
  }

  const seen = new Set<string>();
  return list.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function formatMoney(n?: number) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resolveExpenseSalesUser(e?: WorkPlanExpenseRecord | null) {
  if (!e) return "";
  if (typeof e.work_plan === "object" && e.work_plan !== null && e.work_plan.sales_user) {
    return salesUserLabel(e.work_plan.sales_user);
  }
  return salesUserLabel(e.sales_user);
}

function formatModalDateHeader(dateInput: any): {
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

export function DownloadExpensesModal({
  open,
  expenses: initialExpenses = [],
  onClose,
}: DownloadExpensesModalProps) {
  const letterhead = usePdfCompanyLetterhead();
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const sessionToken = useMemo(() => readSessionFromStorage()?.token, []);
  const adminRole = isExpenseAdmin(sessionUser);
  const elevatedRole = isExpenseAdmin(sessionUser) || isExpenseFinance(sessionUser) || isSuperAdmin(sessionUser);

  const [activeTab, setActiveTab] = useState<ReportTab>("claims");

  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [loading, setLoading] = useState(false);

  // Data sets
  const [claimsItems, setClaimsItems] = useState<WorkPlanExpenseRecord[]>([]);
  const [advancesItems, setAdvancesItems] = useState<WorkPlanTourAdvanceRecord[]>([]);
  const [settlementsItems, setSettlementsItems] = useState<WorkPlanExpenseSettlementRecord[]>([]);

  // File Preview Hook
  const { previewDoc, previewBlobUrl, previewLoading, openPreview, closePreview, downloadFile } =
    useFilePreview(sessionToken);

  // Filter Panel Toggle & States
  const [showFilterPanel, setShowFilterPanel] = useState(true);
  const [datePreset, setDatePreset] = useState<ReportDatePreset>("all");
  const todayYmd = toYmdString(new Date());
  const [customFrom, setCustomFrom] = useState(todayYmd);
  const [customTo, setCustomTo] = useState(todayYmd);

  // Common & specific filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subCategoryFilter, setSubCategoryFilter] = useState("all");
  const [paymentModeFilter, setPaymentModeFilter] = useState("all");
  const [vendorLocationFilter, setVendorLocationFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [executiveFilter, setExecutiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [claimsViewMode, setClaimsViewMode] = useState<"grouped" | "flat">("grouped");

  // User directory for Team and Executive dropdowns
  const { data: wpUsersData } = useGetWorkPlannerUsersQuery(undefined, { skip: !elevatedRole });
  const usersList = useMemo(() => wpUsersData?.users || [], [wpUsersData]);

  // Build team (department) options
  const teamOptions = useMemo<Array<{ id: string; name: string; memberIds: string[] }>>(() => {
    if (!elevatedRole || !usersList.length) return [];
    const deptMap = new Map<string, string[]>();
    usersList.forEach((u: any) => {
      const dept = (u.department || "General").trim();
      const uid = String(u._id || u.id || "");
      if (!deptMap.has(dept)) deptMap.set(dept, []);
      deptMap.get(dept)!.push(uid);
    });
    return Array.from(deptMap.entries())
      .map(([dept, memberIds]) => ({
        id: dept,
        name: dept,
        memberIds,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [elevatedRole, usersList]);

  // Executive dropdown list from hierarchy
  const executiveOptions = useMemo<Array<{ id: string; name: string }>>(() => {
    if (!elevatedRole || !usersList.length) return [];
    return usersList
      .map((u: any) => ({
        id: String(u._id || u.id || ""),
        name: u.name || u.email || "Executive",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [elevatedRole, usersList]);

  // Selected team member IDs
  const selectedTeamMemberIds = useMemo<Set<string> | null>(() => {
    if (teamFilter === "all") return null;
    const found = teamOptions.find((t) => t.id === teamFilter);
    return found ? new Set(found.memberIds) : null;
  }, [teamFilter, teamOptions]);

  const [fetchExpenses] = useLazyGetExpensesQuery();
  const [fetchTourAdvances] = useLazyGetTourAdvancesQuery();
  const [fetchExpenseSettlements] = useLazyGetExpenseSettlementsQuery();

  // Fetch report data based on active tab and filters
  const loadReportData = async () => {
    if (!open) return;
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = { limit: 1000 };

      if (datePreset !== "all") {
        const range = calculateDateRange(datePreset as DateFilterPreset, customFrom, customTo);
        params.from_date = range.from;
        params.to_date = range.to;
        params.from = range.from;
        params.to = range.to;
      }
      if (elevatedRole) {
        params.scope = "team";
      }

      if (executiveFilter !== "all") {
        params.sales_user = executiveFilter;
      }

      // Explicitly pass status (even 'all') so finance role does not default to 'approved'
      params.status = statusFilter;

      if (activeTab === "claims") {
        if (categoryFilter !== "all") params.category = categoryFilter;
        const res = await fetchExpenses(params).unwrap();
        setClaimsItems(res.data || []);
      } else if (activeTab === "advances") {
        const res = await fetchTourAdvances(params).unwrap();
        setAdvancesItems((res as any)?.data || (res as any)?.advances || []);
      } else if (activeTab === "settlements") {
        if (paymentModeFilter !== "all") {
          params.settlement_mode = paymentModeFilter;
        }
        const res = await fetchExpenseSettlements(params).unwrap();
        setSettlementsItems((res as any)?.data || (res as any)?.settlements || []);
      }
    } catch (err) {
      console.error("Failed to fetch report data:", err);
      if (activeTab === "claims" && initialExpenses && initialExpenses.length > 0) {
        setClaimsItems(initialExpenses);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadReportData();
    }
  }, [open, activeTab, datePreset, customFrom, customTo, statusFilter, categoryFilter, executiveFilter]);

  // Reset All Filters
  const resetFilters = () => {
    setDatePreset("all");
    setCustomFrom(todayYmd);
    setCustomTo(todayYmd);
    setStatusFilter("all");
    setCategoryFilter("all");
    setSubCategoryFilter("all");
    setPaymentModeFilter("all");
    setVendorLocationFilter("");
    setTeamFilter("all");
    setExecutiveFilter("all");
    setSearchQuery("");
  };

  // Helper to extract executive ID from records
  const extractOwnerId = (record: any): string => {
    if (!record) return "";
    if (typeof record.sales_user === "object" && record.sales_user !== null) {
      return String(record.sales_user._id || record.sales_user.id || "");
    }
    if (typeof record.sales_user === "string") return record.sales_user;
    if (typeof record.work_plan === "object" && record.work_plan !== null) {
      const su = record.work_plan.sales_user;
      return String(typeof su === "object" && su !== null ? su._id || su.id : su || "");
    }
    if (record.user_id) return String(record.user_id);
    if (record.userId) return String(record.userId);
    return "";
  };

  // Filtered Claims
  const filteredClaims = useMemo(() => {
    const range = datePreset !== "all" ? calculateDateRange(datePreset as DateFilterPreset, customFrom, customTo) : null;
    const list = claimsItems.filter((e) => {
      const uid = extractOwnerId(e);
      if (selectedTeamMemberIds && uid && !selectedTeamMemberIds.has(uid)) return false;
      if (executiveFilter !== "all" && uid !== executiveFilter) return false;
      if (statusFilter !== "all" && (e.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (categoryFilter !== "all" && (e.category || "").toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (subCategoryFilter !== "all" && (e.sub_category || "").toLowerCase() !== subCategoryFilter.toLowerCase()) return false;
      if (paymentModeFilter !== "all" && (e.payment_mode || "").toLowerCase() !== paymentModeFilter.toLowerCase()) return false;
      if (
        vendorLocationFilter.trim() &&
        !(e.vendor_name || "").toLowerCase().includes(vendorLocationFilter.trim().toLowerCase())
      ) {
        return false;
      }
      if (range) {
        const wp = e.work_plan && typeof e.work_plan === "object" ? e.work_plan : null;
        const expDateStr = extractRecordYmd(wp?.plan_date || e.expense_date || e.bill_date || (e as any).createdAt);
        if (range.from && expDateStr && expDateStr < range.from) return false;
        if (range.to && expDateStr && expDateStr > range.to) return false;
      }
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const user = resolveExpenseSalesUser(e);
        const cat = (e.category || "").toLowerCase();
        const sub = (e.sub_category || "").toLowerCase();
        const vendor = (e.vendor_name || "").toLowerCase();
        const bill = (e.bill_number || "").toLowerCase();
        const desc = (e.description || "").toLowerCase();
        const st = (e.status || "").toLowerCase();
        const dt = formatPlanDate(e.expense_date).toLowerCase();
        const amt = String(e.amount || "");
        const match =
          user.toLowerCase().includes(q) ||
          cat.includes(q) ||
          sub.includes(q) ||
          vendor.includes(q) ||
          bill.includes(q) ||
          desc.includes(q) ||
          st.includes(q) ||
          dt.includes(q) ||
          amt.includes(q);
        if (!match) return false;
      }
      return true;
    });

    // Sort latest to oldest date order
    return [...list].sort((a, b) => {
      const wpA = a.work_plan && typeof a.work_plan === "object" ? a.work_plan : null;
      const wpB = b.work_plan && typeof b.work_plan === "object" ? b.work_plan : null;
      const dateA = extractRecordYmd(wpA?.plan_date || a.expense_date || a.bill_date || (a as any).createdAt) || "";
      const dateB = extractRecordYmd(wpB?.plan_date || b.expense_date || b.bill_date || (b as any).createdAt) || "";
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // Latest date first
      }
      const timeA = new Date((a as any).createdAt || 0).getTime();
      const timeB = new Date((b as any).createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [
    claimsItems,
    datePreset,
    customFrom,
    customTo,
    statusFilter,
    categoryFilter,
    selectedTeamMemberIds,
    executiveFilter,
    subCategoryFilter,
    paymentModeFilter,
    vendorLocationFilter,
    searchQuery,
  ]);

  // Group claims by date (latest to oldest), and per user under each date
  const groupedDateClaims = useMemo(() => {
    const dateMap = new Map<
      string,
      {
        dateKey: string;
        mainDate: string;
        weekday: string;
        isToday: boolean;
        isYesterday: boolean;
        userMap: Map<
          string,
          {
            userId: string;
            userName: string;
            workPlanId?: string;
            expenses: WorkPlanExpenseRecord[];
            totalAmount: number;
            workPlan?: any;
          }
        >;
        totalAmount: number;
        totalExpensesCount: number;
      }
    >();

    for (const e of filteredClaims) {
      const wp = e.work_plan && typeof e.work_plan === "object" ? e.work_plan : null;
      const rawDate = wp?.plan_date || e.expense_date || e.bill_date || (e as any).createdAt;
      const ymd = extractRecordYmd(rawDate) || "unknown";

      if (!dateMap.has(ymd)) {
        const headerInfo = formatModalDateHeader(rawDate);
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
      const amount = Number(e.amount) || 0;
      dateEntry.totalAmount += amount;
      dateEntry.totalExpensesCount += 1;

      const userName = resolveExpenseSalesUser(e) || "Unassigned";
      const userId = extractOwnerId(e) || userName;
      const wpId = wp?._id || (typeof e.work_plan === "string" ? e.work_plan : "");
      const userGroupKey = `${userId}__${wpId || "direct"}`;

      if (!dateEntry.userMap.has(userGroupKey)) {
        dateEntry.userMap.set(userGroupKey, {
          userId,
          userName,
          workPlanId: wpId,
          expenses: [],
          totalAmount: 0,
          workPlan: wp,
        });
      }

      const userEntry = dateEntry.userMap.get(userGroupKey)!;
      userEntry.expenses.push(e);
      userEntry.totalAmount += amount;
      if (!userEntry.workPlan && wp) {
        userEntry.workPlan = wp;
      }
    }

    const result = Array.from(dateMap.values()).map((d) => {
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

    result.sort((a, b) => {
      if (a.dateKey === "unknown") return 1;
      if (b.dateKey === "unknown") return -1;
      return b.dateKey.localeCompare(a.dateKey); // Latest date first
    });

    return result;
  }, [filteredClaims]);

  // Filtered Advances
  const filteredAdvances = useMemo(() => {
    const range = datePreset !== "all" ? calculateDateRange(datePreset as DateFilterPreset, customFrom, customTo) : null;
    return advancesItems.filter((adv) => {
      const uid = extractOwnerId(adv);
      if (selectedTeamMemberIds && uid && !selectedTeamMemberIds.has(uid)) return false;
      if (executiveFilter !== "all" && uid !== executiveFilter) return false;
      if (statusFilter !== "all" && (adv.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (paymentModeFilter !== "all" && (adv.payment_method || "").toLowerCase() !== paymentModeFilter.toLowerCase()) return false;
      if (range) {
        const advDateStr = extractRecordYmd(adv.request_date || (adv as any).disbursement_date || adv.createdAt);
        if (range.from && advDateStr && advDateStr < range.from) return false;
        if (range.to && advDateStr && advDateStr > range.to) return false;
      }
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const user = salesUserLabel(adv.sales_user);
        const advNum = (adv.advance_number || "").toLowerCase();
        const purpose = (adv.purpose || "").toLowerCase();
        const txn = (adv.transaction_reference || "").toLowerCase();
        const st = (adv.status || "").toLowerCase();
        const match =
          user.toLowerCase().includes(q) ||
          advNum.includes(q) ||
          purpose.includes(q) ||
          txn.includes(q) ||
          st.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [
    advancesItems,
    datePreset,
    customFrom,
    customTo,
    statusFilter,
    selectedTeamMemberIds,
    executiveFilter,
    paymentModeFilter,
    searchQuery,
  ]);

  // Filtered Settlements
  const filteredSettlements = useMemo(() => {
    const range = datePreset !== "all" ? calculateDateRange(datePreset as DateFilterPreset, customFrom, customTo) : null;
    return settlementsItems.filter((set) => {
      const uid = extractOwnerId(set);
      if (selectedTeamMemberIds && uid && !selectedTeamMemberIds.has(uid)) return false;
      if (executiveFilter !== "all" && uid !== executiveFilter) return false;
      if (
        paymentModeFilter !== "all" &&
        (set.payment_method || "").toLowerCase() !== paymentModeFilter.toLowerCase() &&
        (set.settlement_mode || "").toLowerCase() !== paymentModeFilter.toLowerCase()
      ) {
        return false;
      }
      if (range) {
        const setDateStr = extractRecordYmd(set.settlement_date || (set as any).createdAt);
        if (range.from && setDateStr && setDateStr < range.from) return false;
        if (range.to && setDateStr && setDateStr > range.to) return false;
      }
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const user = salesUserLabel(set.sales_user);
        const setNum = (set.settlement_number || "").toLowerCase();
        const txn = (set.transaction_reference || "").toLowerCase();
        const notes = (set.settlement_notes || "").toLowerCase();
        const match =
          user.toLowerCase().includes(q) ||
          setNum.includes(q) ||
          txn.includes(q) ||
          notes.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [
    settlementsItems,
    datePreset,
    customFrom,
    customTo,
    selectedTeamMemberIds,
    executiveFilter,
    paymentModeFilter,
    searchQuery,
  ]);

  // Active filters count badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (datePreset !== "all") count++;
    if (statusFilter !== "all") count++;
    if (categoryFilter !== "all") count++;
    if (subCategoryFilter !== "all") count++;
    if (paymentModeFilter !== "all") count++;
    if (vendorLocationFilter.trim()) count++;
    if (teamFilter !== "all") count++;
    if (executiveFilter !== "all") count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [
    datePreset,
    statusFilter,
    categoryFilter,
    subCategoryFilter,
    paymentModeFilter,
    vendorLocationFilter,
    teamFilter,
    executiveFilter,
    searchQuery,
  ]);

  // Summary Metrics for current tab
  const summaryMetrics = useMemo(() => {
    if (activeTab === "claims") {
      const totalCount = filteredClaims.length;
      const totalAmount = filteredClaims.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const approvedAmount = filteredClaims
        .filter((e) => e.status === "approved")
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const pendingCount = filteredClaims.filter((e) => e.status === "submitted").length;
      return { label1: "Claims", totalCount, totalAmount, approvedAmount, pendingCount };
    }
    if (activeTab === "advances") {
      const totalCount = filteredAdvances.length;
      const totalAmount = filteredAdvances.reduce(
        (sum, a) => sum + (Number(a.disbursed_amount || a.amount) || 0),
        0
      );
      const remainingBalance = filteredAdvances.reduce(
        (sum, a) => sum + (Number(a.remaining_balance) || 0),
        0
      );
      const pendingCount = filteredAdvances.filter((a) => a.status === "pending" || a.status === "approved").length;
      return { label1: "Advances", totalCount, totalAmount, remainingBalance, pendingCount };
    }
    const totalCount = filteredSettlements.length;
    const totalAmount = filteredSettlements.reduce(
      (sum, s) => sum + (Number(s.total_claim_amount) || 0),
      0
    );
    const directPaid = filteredSettlements.reduce(
      (sum, s) => sum + (Number(s.direct_payment_amount) || 0),
      0
    );
    const advanceDeducted = filteredSettlements.reduce(
      (sum, s) => sum + (Number(s.advance_deduction_amount) || 0),
      0
    );
    return { label1: "Settlements", totalCount, totalAmount, directPaid, advanceDeducted };
  }, [activeTab, filteredClaims, filteredAdvances, filteredSettlements]);

  if (!open) return null;

  // ----------------------------------------------------
  // ----------------------------------------------------
  // Export CSV
  // ----------------------------------------------------
  function exportCsv() {
    setDownloadingCsv(true);
    try {
      let headers: string[] = [];
      let rows: (string | number)[][] = [];
      const timestamp = new Date().toISOString().slice(0, 10);

      if (activeTab === "claims") {
        if (claimsViewMode === "grouped") {
          headers = [
            "Row #",
            "Category",
            "Sub Category",
            "Amount (₹)",
            "Payment Mode",
            "Vendor",
            "Bill No",
            "Bill Date",
            "Start Odometer",
            "Closing Odometer",
            "Total KM",
            "Attachments Count",
            "Status",
            "Description",
          ];
          let globalIdx = 0;
          for (const dateGroup of groupedDateClaims) {
            const weekdayStr = dateGroup.weekday ? ` (${dateGroup.weekday.toUpperCase()})` : "";
            rows.push([
              `"--- DATE: ${dateGroup.mainDate.toUpperCase()}${weekdayStr} | ${dateGroup.totalUsersCount} Executives | ${dateGroup.totalExpensesCount} Claims | Daily Total: Rs. ${formatMoney(dateGroup.totalAmount)} ---"`,
            ]);
            for (const userGroup of dateGroup.userGroups) {
              const wp = userGroup.workPlan;
              const wpSummary = wp ? formatWorkPlanSummaryText(wp) : "";
              const planSnippet = wpSummary && wpSummary !== "—" ? ` | Plan: ${wpSummary}` : " | Direct Claims (No Work Plan)";
              rows.push([
                `"--- Executive: ${userGroup.userName}${planSnippet} | ${userGroup.expenses.length} Claims | Subtotal: Rs. ${formatMoney(userGroup.totalAmount)} ---"`,
              ]);
              for (const e of userGroup.expenses) {
                globalIdx++;
                const attCount = extractExpenseAttachments(e).length;
                rows.push([
                  globalIdx,
                  `"${(e.category || "Other").replace(/"/g, '""')}"`,
                  `"${(e.sub_category || "—").replace(/"/g, '""')}"`,
                  e.amount || 0,
                  e.payment_mode || "Cash",
                  `"${(e.vendor_name || "—").replace(/"/g, '""')}"`,
                  `"${(e.bill_number || "—").replace(/"/g, '""')}"`,
                  e.bill_date ? formatPlanDate(e.bill_date) : "—",
                  e.start_reading ?? "—",
                  e.closing_reading ?? "—",
                  e.total_km ?? "—",
                  attCount,
                  e.status,
                  `"${(e.description || "—").replace(/"/g, '""')}"`,
                ]);
              }
              if (userGroup.expenses.length > 1) {
                rows.push([
                  "",
                  `"Subtotal — ${userGroup.userName}"`,
                  "",
                  userGroup.totalAmount,
                ]);
              }
            }
            if (dateGroup.totalUsersCount > 1) {
              rows.push([
                "",
                `"Daily Total — ${dateGroup.mainDate}"`,
                "",
                dateGroup.totalAmount,
              ]);
            }
          }
        } else {
          headers = [
            "Row #",
            "Expense Date",
            "Sales Executive",
            "Day Plan Type",
            "Tasks / Visits",
            "Plan Location",
            "Category",
            "Sub Category",
            "Amount (₹)",
            "Payment Mode",
            "Vendor",
            "Bill No",
            "Bill Date",
            "Start Odometer",
            "Closing Odometer",
            "Total KM",
            "Attachments Count",
            "Status",
            "Description",
          ];
          rows = filteredClaims.map((e, idx) => {
            const user = resolveExpenseSalesUser(e);
            const attCount = extractExpenseAttachments(e).length;
            const wp = e.work_plan && typeof e.work_plan === "object" ? e.work_plan : null;
            const planType = wp?.plan_type || "—";
            const tasksVisits = formatWorkPlanTasksVisits(wp) || "—";
            const planLocation = formatWorkPlanLocation(wp);
            return [
              idx + 1,
              formatPlanDate(e.expense_date),
              `"${user.replace(/"/g, '""')}"`,
              `"${planType.replace(/"/g, '""')}"`,
              `"${tasksVisits.replace(/"/g, '""')}"`,
              `"${planLocation.replace(/"/g, '""')}"`,
              e.category || "Other",
              e.sub_category || "—",
              e.amount || 0,
              e.payment_mode || "Cash",
              `"${(e.vendor_name || "").replace(/"/g, '""')}"`,
              `"${(e.bill_number || "").replace(/"/g, '""')}"`,
              e.bill_date ? formatPlanDate(e.bill_date) : "—",
              e.start_reading ?? "—",
              e.closing_reading ?? "—",
              e.total_km ?? "—",
              attCount,
              e.status,
              `"${(e.description || "").replace(/"/g, '""')}"`,
            ];
          });
        }
      } else if (activeTab === "advances") {
        headers = [
          "Row #",
          "Advance #",
          "Date",
          "Sales Executive",
          "Requested (₹)",
          "Disbursed (₹)",
          "Settled (₹)",
          "Remaining Balance (₹)",
          "Payment Method",
          "Txn Ref",
          "Status",
          "Purpose",
        ];
        rows = filteredAdvances.map((adv, idx) => {
          const user = salesUserLabel(adv.sales_user);
          return [
            idx + 1,
            adv.advance_number,
            formatPlanDate(adv.request_date || adv.createdAt),
            `"${user.replace(/"/g, '""')}"`,
            adv.amount || 0,
            adv.disbursed_amount || 0,
            adv.settled_amount || 0,
            adv.remaining_balance || 0,
            adv.payment_method || "Bank Transfer",
            `"${(adv.transaction_reference || "").replace(/"/g, '""')}"`,
            adv.status,
            `"${(adv.purpose || "").replace(/"/g, '""')}"`,
          ];
        });
      } else {
        headers = [
          "Row #",
          "Settlement #",
          "Date",
          "Sales Executive",
          "Mode",
          "Total Claimed (₹)",
          "Advance Deducted (₹)",
          "Direct Paid (₹)",
          "Payment Method",
          "Txn Ref",
          "Bank Name",
          "Claims Count",
          "Notes",
        ];
        rows = filteredSettlements.map((set, idx) => {
          const user = salesUserLabel(set.sales_user);
          return [
            idx + 1,
            set.settlement_number,
            formatPlanDate(set.settlement_date),
            `"${user.replace(/"/g, '""')}"`,
            set.settlement_mode,
            set.total_claim_amount || 0,
            set.advance_deduction_amount || 0,
            set.direct_payment_amount || 0,
            set.payment_method || "Bank Transfer",
            `"${(set.transaction_reference || "").replace(/"/g, '""')}"`,
            `"${(set.bank_name || "").replace(/"/g, '""')}"`,
            Array.isArray(set.claims) ? set.claims.length : 0,
            `"${(set.settlement_notes || "").replace(/"/g, '""')}"`,
          ];
        });
      }

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `expense_portal_${activeTab}_report_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export CSV failed:", err);
    } finally {
      setDownloadingCsv(false);
    }
  }

  // ----------------------------------------------------
  // Export Excel
  // ----------------------------------------------------
  async function exportExcel() {
    setDownloadingExcel(true);
    try {
      const timestamp = new Date().toISOString().slice(0, 10);

      if (activeTab === "claims") {
        if (claimsViewMode === "grouped") {
          const columns = [
            { key: "rowNum", label: "#" },
            { key: "category", label: "Category" },
            { key: "sub_category", label: "Sub Category" },
            { key: "amount", label: "Amount (₹)" },
            { key: "payment_mode", label: "Payment Mode" },
            { key: "vendor_name", label: "Vendor" },
            { key: "bill_number", label: "Bill #" },
            { key: "bill_date", label: "Bill Date" },
            { key: "start_reading", label: "Start KM" },
            { key: "closing_reading", label: "Closing KM" },
            { key: "total_km", label: "Total Distance" },
            { key: "attachments_count", label: "Attachments" },
            { key: "status", label: "Status" },
            { key: "description", label: "Description" },
          ];
          const rows: any[] = [];
          let globalIdx = 0;
          for (const dateGroup of groupedDateClaims) {
            const weekdayStr = dateGroup.weekday ? ` (${dateGroup.weekday.toUpperCase()})` : "";
            rows.push({
              rowNum: "",
              category: `DATE: ${dateGroup.mainDate.toUpperCase()}${weekdayStr} — ${dateGroup.totalUsersCount} Executives | ${dateGroup.totalExpensesCount} Claims`,
              sub_category: "Daily Total",
              amount: dateGroup.totalAmount,
            });
            for (const userGroup of dateGroup.userGroups) {
              const wp = userGroup.workPlan;
              const wpSummary = wp ? formatWorkPlanSummaryText(wp) : "";
              const planSnippet = wpSummary && wpSummary !== "—" ? ` | Plan: ${wpSummary}` : " — Direct Claims (No Work Plan)";
              rows.push({
                rowNum: "",
                category: `Executive: ${userGroup.userName}${planSnippet} — ${userGroup.expenses.length} Claims`,
                sub_category: "User Subtotal",
                amount: userGroup.totalAmount,
              });
              for (const r of userGroup.expenses) {
                globalIdx++;
                const attCount = extractExpenseAttachments(r).length;
                rows.push({
                  rowNum: globalIdx,
                  category: r.category || "Other",
                  sub_category: r.sub_category || "—",
                  amount: Number(r.amount) || 0,
                  payment_mode: r.payment_mode || "Cash",
                  vendor_name: r.vendor_name || "—",
                  bill_number: r.bill_number || "—",
                  bill_date: formatPlanDate(r.bill_date),
                  start_reading: r.start_reading ?? "—",
                  closing_reading: r.closing_reading ?? "—",
                  total_km: r.total_km ?? "—",
                  attachments_count: attCount > 0 ? `${attCount} file(s)` : "None",
                  status: (r.status || "draft").toUpperCase(),
                  description: r.description || "—",
                });
              }
              if (userGroup.expenses.length > 1) {
                rows.push({
                  rowNum: "",
                  category: `Subtotal — ${userGroup.userName}`,
                  sub_category: "",
                  amount: userGroup.totalAmount,
                });
              }
            }
            if (dateGroup.totalUsersCount > 1) {
              rows.push({
                rowNum: "",
                category: `Daily Total — ${dateGroup.mainDate}`,
                sub_category: "",
                amount: dateGroup.totalAmount,
              });
            }
          }
          // Grand Total
          rows.push({
            rowNum: "",
            category: "GRAND TOTAL",
            sub_category: "",
            amount: summaryMetrics.totalAmount,
          });

          downloadExcelReport({
            filename: `expense_claims_grouped_report_${timestamp}.xlsx`,
            sheetName: "Grouped Claims",
            title: "Expense Claims Master Sheet (Grouped by Date & Executive)",
            columns,
            rows,
          });
        } else {
          const columns = [
            { key: "rowNum", label: "#" },
            { key: "expense_date", label: "Date" },
            { key: "sales_user", label: "Executive" },
            { key: "plan_type", label: "Day Plan Type" },
            { key: "plan_tasks_visits", label: "Tasks / Visits" },
            { key: "plan_location", label: "Plan Location" },
            { key: "category", label: "Category" },
            { key: "sub_category", label: "Sub Category" },
            { key: "amount", label: "Amount (₹)" },
            { key: "payment_mode", label: "Payment Mode" },
            { key: "vendor_name", label: "Vendor" },
            { key: "bill_number", label: "Bill #" },
            { key: "bill_date", label: "Bill Date" },
            { key: "start_reading", label: "Start KM" },
            { key: "closing_reading", label: "Closing KM" },
            { key: "total_km", label: "Total Distance" },
            { key: "attachments_count", label: "Attachments" },
            { key: "status", label: "Status" },
            { key: "description", label: "Description" },
          ];
          const rows = filteredClaims.map((r, i) => {
            const attCount = extractExpenseAttachments(r).length;
            const wp = r.work_plan && typeof r.work_plan === "object" ? r.work_plan : null;
            return {
              rowNum: i + 1,
              expense_date: formatPlanDate(r.expense_date),
              sales_user: resolveExpenseSalesUser(r),
              plan_type: wp?.plan_type || "—",
              plan_tasks_visits: formatWorkPlanTasksVisits(wp) || "—",
              plan_location: formatWorkPlanLocation(wp),
              category: r.category || "Other",
              sub_category: r.sub_category || "—",
              amount: Number(r.amount) || 0,
              payment_mode: r.payment_mode || "Cash",
              vendor_name: r.vendor_name || "—",
              bill_number: r.bill_number || "—",
              bill_date: formatPlanDate(r.bill_date),
              start_reading: r.start_reading ?? "—",
              closing_reading: r.closing_reading ?? "—",
              total_km: r.total_km ?? "—",
              attachments_count: attCount > 0 ? `${attCount} file(s)` : "None",
              status: (r.status || "draft").toUpperCase(),
              description: r.description || "—",
            };
          });

          downloadExcelReport({
            filename: `expense_claims_report_${timestamp}.xlsx`,
            sheetName: "Expense Claims",
            title: "Expense Claims Master Sheet",
            columns,
            rows,
          });
        }
      } else if (activeTab === "advances") {
        const columns = [
          { key: "rowNum", label: "#" },
          { key: "advance_number", label: "Advance #" },
          { key: "date", label: "Date" },
          { key: "sales_user", label: "Executive" },
          { key: "amount", label: "Requested (₹)" },
          { key: "disbursed_amount", label: "Disbursed (₹)" },
          { key: "settled_amount", label: "Settled (₹)" },
          { key: "remaining_balance", label: "Balance (₹)" },
          { key: "payment_method", label: "Payment Mode" },
          { key: "transaction_reference", label: "Txn Ref" },
          { key: "status", label: "Status" },
          { key: "purpose", label: "Purpose" },
        ];
        const rows = filteredAdvances.map((a, i) => ({
          rowNum: i + 1,
          advance_number: a.advance_number,
          date: formatPlanDate(a.request_date || a.createdAt),
          sales_user: salesUserLabel(a.sales_user),
          amount: Number(a.amount) || 0,
          disbursed_amount: Number(a.disbursed_amount) || 0,
          settled_amount: Number(a.settled_amount) || 0,
          remaining_balance: Number(a.remaining_balance) || 0,
          payment_method: a.payment_method || "Bank Transfer",
          transaction_reference: a.transaction_reference || "—",
          status: (a.status || "").toUpperCase(),
          purpose: a.purpose || "—",
        }));

        downloadExcelReport({
          filename: `tour_advances_report_${timestamp}.xlsx`,
          sheetName: "Tour Advances",
          title: "Tour Advances & Balances Sheet",
          columns,
          rows,
        });
      } else {
        const columns = [
          { key: "rowNum", label: "#" },
          { key: "settlement_number", label: "Settlement #" },
          { key: "date", label: "Settlement Date" },
          { key: "sales_user", label: "Executive" },
          { key: "settlement_mode", label: "Mode" },
          { key: "total_claim_amount", label: "Total Claimed (₹)" },
          { key: "advance_deduction_amount", label: "Advance Deducted (₹)" },
          { key: "direct_payment_amount", label: "Direct Paid (₹)" },
          { key: "payment_method", label: "Payment Mode" },
          { key: "transaction_reference", label: "Txn Ref" },
          { key: "bank_name", label: "Bank Name" },
          { key: "claims_count", label: "Claims Settled" },
          { key: "settlement_notes", label: "Notes" },
        ];
        const rows = filteredSettlements.map((s, i) => ({
          rowNum: i + 1,
          settlement_number: s.settlement_number,
          date: formatPlanDate(s.settlement_date),
          sales_user: salesUserLabel(s.sales_user),
          settlement_mode: s.settlement_mode,
          total_claim_amount: Number(s.total_claim_amount) || 0,
          advance_deduction_amount: Number(s.advance_deduction_amount) || 0,
          direct_payment_amount: Number(s.direct_payment_amount) || 0,
          payment_method: s.payment_method || "Bank Transfer",
          transaction_reference: s.transaction_reference || "—",
          bank_name: s.bank_name || "—",
          claims_count: Array.isArray(s.claims) ? s.claims.length : 0,
          settlement_notes: s.settlement_notes || "—",
        }));

        downloadExcelReport({
          filename: `expense_settlements_report_${timestamp}.xlsx`,
          sheetName: "Settlements",
          title: "Expense Settlements & Vouchers Sheet",
          columns,
          rows,
        });
      }
    } catch (err) {
      console.error("Export Excel failed:", err);
    } finally {
      setDownloadingExcel(false);
    }
  }

  // ----------------------------------------------------
  // Export PDF
  // ----------------------------------------------------
  async function exportPdf() {
    setDownloadingPdf(true);
    try {
      const timestamp = new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const user = readSessionFromStorage()?.user;
      const downloadedBy = user?.name
        ? `${user.name} (${user.email || user.department || "Executive"})`
        : user?.email || "System User";

      const selectedExecName =
        executiveFilter === "all"
          ? "All Representatives"
          : executiveOptions.find((e) => e.id === executiveFilter)?.name || executiveFilter;
      const selectedTeamName =
        teamFilter === "all"
          ? "All Teams"
          : teamOptions.find((t) => t.id === teamFilter)?.name || teamFilter;

      const activeFilterPanel: Array<{ label: string; value: string }> = [
        {
          label: "Date Filter",
          value:
            datePreset === "custom"
              ? `${customFrom} to ${customTo}`
              : datePreset.toUpperCase(),
        },
        {
          label: "Team Filter",
          value: selectedTeamName,
        },
        {
          label: "Executive",
          value: selectedExecName,
        },
        {
          label: "Status",
          value: statusFilter === "all" ? "All Statuses" : statusFilter.toUpperCase(),
        },
        ...(activeTab === "claims"
          ? [
              {
                label: "Category",
                value: categoryFilter === "all" ? "All Categories" : categoryFilter,
              },
              {
                label: "Sub-Category",
                value: subCategoryFilter === "all" ? "All" : subCategoryFilter,
              },
            ]
          : []),
        {
          label: "Payment Mode",
          value: paymentModeFilter === "all" ? "All Modes" : paymentModeFilter.toUpperCase(),
        },
        { label: "Search Query", value: searchQuery.trim() || "None" },
      ];

      if (activeTab === "claims") {
        const rows: any[] = [];
        let globalIndex = 0;

        if (claimsViewMode === "grouped") {
          for (const dateGroup of groupedDateClaims) {
            // Day Header row
            const weekdayStr = dateGroup.weekday ? ` (${dateGroup.weekday.toUpperCase()})` : "";
            const dateTitle = `DATE: ${dateGroup.mainDate.toUpperCase()}${weekdayStr}`;
            const dateSummary = `${dateGroup.totalUsersCount} Executive${dateGroup.totalUsersCount !== 1 ? "s" : ""}  |  ${dateGroup.totalExpensesCount} Claim${dateGroup.totalExpensesCount !== 1 ? "s" : ""}`;
            const dateTotal = `Daily Total: Rs. ${formatMoney(dateGroup.totalAmount)}`;

            rows.push({
              _rowType: "DATE_HEADER",
              title: `${dateTitle}  —  ${dateSummary}`,
              summaryRight: dateTotal,
            });

            for (const userGroup of dateGroup.userGroups) {
              // Executive Header row with Day Work Plan details
              const wp = userGroup.workPlan;
              const wpSummary = wp ? formatWorkPlanSummaryText(wp) : "";
              const planSnippet = wpSummary && wpSummary !== "—" ? `  |  Plan: ${wpSummary}` : "  |  Direct Claims (No Work Plan)";
              const userTitle = `Executive: ${userGroup.userName}${planSnippet}`;
              const userSummary = `${userGroup.expenses.length} Claim${userGroup.expenses.length !== 1 ? "s" : ""}`;
              const userTotal = `Subtotal: Rs. ${formatMoney(userGroup.totalAmount)}`;

              rows.push({
                _rowType: "USER_HEADER",
                title: `${userTitle}  —  ${userSummary}`,
                summaryRight: userTotal,
              });

              // Expense rows — Omits Date, Executive, Plan Type, Location columns (already in headers)
              for (const e of userGroup.expenses) {
                globalIndex++;
                const attCount = extractExpenseAttachments(e).length;
                const startKm = e.start_reading ?? null;
                const closeKm = e.closing_reading ?? null;
                const odoText =
                  startKm != null && closeKm != null
                    ? `${startKm} → ${closeKm} (${(closeKm - startKm)} KM)`
                    : e.total_km != null
                    ? `${e.total_km} KM`
                    : "—";

                const billDateStr = e.bill_date ? formatPlanDate(e.bill_date) : "";
                const billInfo = e.bill_number
                  ? billDateStr
                    ? `${e.bill_number} (${billDateStr})`
                    : e.bill_number
                  : billDateStr || "—";

                rows.push({
                  rowNum: globalIndex,
                  category: (e.category || "").toUpperCase(),
                  subCategory: e.sub_category || "—",
                  amount: `Rs. ${formatMoney(e.amount)}`,
                  paymentMode: (e.payment_mode || "cash").toUpperCase(),
                  vendor: e.vendor_name || "—",
                  billInfo,
                  distance: odoText,
                  attachments: attCount > 0 ? `${attCount} doc(s)` : "—",
                  status: (e.status || "").toUpperCase(),
                  description: e.description || "—",
                });
              }

              // User Subtotal row if user has > 1 claim
              if (userGroup.expenses.length > 1) {
                rows.push({
                  _rowType: "USER_SUBTOTAL",
                  title: `Subtotal — ${userGroup.userName} (${userGroup.expenses.length} claims)`,
                  amount: `Rs. ${formatMoney(userGroup.totalAmount)}`,
                });
              }
            }

            // Daily Total footer if date has > 1 user
            if (dateGroup.totalUsersCount > 1) {
              rows.push({
                _rowType: "DATE_TOTAL",
                title: `Daily Total — ${dateGroup.mainDate} (${dateGroup.totalExpensesCount} claims across ${dateGroup.totalUsersCount} executives)`,
                amount: `Rs. ${formatMoney(dateGroup.totalAmount)}`,
              });
            }
          }

          // Grand Total row
          rows.push({
            _rowType: "TOTAL",
            title: "GRAND TOTAL",
            amount: `Rs. ${formatMoney(summaryMetrics.totalAmount)}`,
          });

          await downloadPdfReport({
            letterhead,
            filename: `expenses_report_${new Date().toISOString().slice(0, 10)}.pdf`,
            title: "Expense Claims Master Report (Grouped)",
            subtitle: "Claims & Reimbursements Summary with Day Work Plan Details (Vehicle Rate: Rs. 3.50/KM)",
            downloadedBy,
            timestamp,
            filterPanel: activeFilterPanel,
            metadata: [
              { label: "Total Claims", value: String(summaryMetrics.totalCount) },
              { label: "Total Amount", value: `Rs. ${formatMoney(summaryMetrics.totalAmount)}` },
              {
                label: "Approved Amount",
                value: `Rs. ${formatMoney(summaryMetrics.approvedAmount)}`,
              },
              { label: "Pending Claims", value: String(summaryMetrics.pendingCount) },
            ],
            columns: [
              { key: "rowNum", label: "#", width: 0.45, align: "center" },
              { key: "category", label: "Category", width: 1.15, align: "left" },
              { key: "subCategory", label: "Sub Category", width: 1.15, align: "left" },
              { key: "amount", label: "Amount", width: 1.25, align: "right" },
              { key: "paymentMode", label: "Pay Mode", width: 0.85, align: "center" },
              { key: "vendor", label: "Vendor", width: 1.35, align: "left" },
              { key: "billInfo", label: "Bill / Date", width: 1.25, align: "left" },
              { key: "distance", label: "Distance / KM", width: 1.15, align: "left" },
              { key: "attachments", label: "Docs", width: 0.65, align: "center" },
              { key: "status", label: "Status", width: 0.85, align: "center" },
              { key: "description", label: "Description", width: 2.3, align: "left" },
            ],
            rows,
          });
        } else {
          // Flat list format
          for (const e of filteredClaims) {
            globalIndex++;
            const attCount = extractExpenseAttachments(e).length;
            const wpRow = e.work_plan && typeof e.work_plan === "object" ? e.work_plan : null;
            const startKm = e.start_reading ?? null;
            const closeKm = e.closing_reading ?? null;
            const odoText =
              startKm != null && closeKm != null
                ? `${startKm} → ${closeKm} (${(closeKm - startKm)} KM)`
                : e.total_km != null
                ? `${e.total_km} KM`
                : "—";

            rows.push({
              rowNum: globalIndex,
              date: formatPlanDate(e.expense_date),
              executive: resolveExpenseSalesUser(e),
              planType: wpRow?.plan_type || "—",
              planLocation: formatWorkPlanLocation(wpRow),
              category: (e.category || "").toUpperCase(),
              subCategory: e.sub_category || "—",
              amount: `Rs. ${formatMoney(e.amount)}`,
              paymentMode: (e.payment_mode || "cash").toUpperCase(),
              vendor: e.vendor_name || "—",
              distance: odoText,
              attachments: attCount > 0 ? `${attCount} doc(s)` : "—",
              status: (e.status || "").toUpperCase(),
              description: e.description || "—",
            });
          }

          rows.push({
            _rowType: "TOTAL",
            title: "GRAND TOTAL",
            amount: `Rs. ${formatMoney(summaryMetrics.totalAmount)}`,
          });

          await downloadPdfReport({
            letterhead,
            filename: `expenses_flat_report_${new Date().toISOString().slice(0, 10)}.pdf`,
            title: "Expense Claims Master Report (Flat)",
            subtitle: "Claims & Reimbursements Ledger (Vehicle Rate: Rs. 3.50/KM)",
            downloadedBy,
            timestamp,
            filterPanel: activeFilterPanel,
            metadata: [
              { label: "Total Claims", value: String(summaryMetrics.totalCount) },
              { label: "Total Amount", value: `Rs. ${formatMoney(summaryMetrics.totalAmount)}` },
              {
                label: "Approved Amount",
                value: `Rs. ${formatMoney(summaryMetrics.approvedAmount)}`,
              },
              { label: "Pending Claims", value: String(summaryMetrics.pendingCount) },
            ],
            columns: [
              { key: "rowNum", label: "#", width: 0.45, align: "center" },
              { key: "date", label: "Date", width: 0.95, align: "left" },
              { key: "executive", label: "Executive", width: 1.35, align: "left" },
              { key: "planType", label: "Plan", width: 0.95, align: "left" },
              { key: "planLocation", label: "Location", width: 1.05, align: "left" },
              { key: "category", label: "Category", width: 1.05, align: "left" },
              { key: "subCategory", label: "Sub Category", width: 1.05, align: "left" },
              { key: "amount", label: "Amount", width: 1.15, align: "right" },
              { key: "paymentMode", label: "Pay Mode", width: 0.8, align: "center" },
              { key: "vendor", label: "Vendor", width: 1.15, align: "left" },
              { key: "distance", label: "KM", width: 1.0, align: "left" },
              { key: "attachments", label: "Docs", width: 0.65, align: "center" },
              { key: "status", label: "Status", width: 0.8, align: "center" },
              { key: "description", label: "Description", width: 1.8, align: "left" },
            ],
            rows,
          });
        }
      } else if (activeTab === "advances") {
        const rows = filteredAdvances.map((adv, idx) => ({
          rowNum: idx + 1,
          advNo: adv.advance_number,
          date: formatPlanDate(adv.request_date || adv.createdAt),
          executive: salesUserLabel(adv.sales_user),
          requested: `Rs. ${formatMoney(adv.amount)}`,
          disbursed: `Rs. ${formatMoney(adv.disbursed_amount)}`,
          settled: `Rs. ${formatMoney(adv.settled_amount)}`,
          balance: `Rs. ${formatMoney(adv.remaining_balance)}`,
          method: adv.payment_method || "Bank Transfer",
          status: (adv.status || "").toUpperCase(),
          purpose: adv.purpose || "—",
        }));

        await downloadPdfReport({
          letterhead,
          filename: `tour_advances_report_${new Date().toISOString().slice(0, 10)}.pdf`,
          title: "Tour Advances & Balances Report",
          subtitle: "Tour Advances Issuance & Ledger Reconciliation",
          downloadedBy,
          timestamp,
          filterPanel: activeFilterPanel,
          metadata: [
            { label: "Total Advances", value: String(summaryMetrics.totalCount) },
            { label: "Total Disbursed", value: `Rs. ${formatMoney(summaryMetrics.totalAmount)}` },
            {
              label: "Outstanding Balance",
              value: `Rs. ${formatMoney((summaryMetrics as any).remainingBalance)}`,
            },
            { label: "Pending Requests", value: String(summaryMetrics.pendingCount) },
          ],
          columns: [
            { key: "rowNum", label: "#", width: 0.5, align: "left" },
            { key: "advNo", label: "Adv #", width: 1.2, align: "left" },
            { key: "date", label: "Date", width: 1.1, align: "left" },
            { key: "executive", label: "Executive", width: 1.5, align: "left" },
            { key: "requested", label: "Requested", width: 1.2, align: "right" },
            { key: "disbursed", label: "Disbursed", width: 1.2, align: "right" },
            { key: "settled", label: "Settled", width: 1.1, align: "right" },
            { key: "balance", label: "Balance", width: 1.2, align: "right" },
            { key: "method", label: "Mode", width: 1.1, align: "center" },
            { key: "status", label: "Status", width: 1.0, align: "center" },
            { key: "purpose", label: "Purpose", width: 1.6, align: "left" },
          ],
          rows,
        });
      } else {
        const rows = filteredSettlements.map((set, idx) => ({
          rowNum: idx + 1,
          setNo: set.settlement_number,
          date: formatPlanDate(set.settlement_date),
          executive: salesUserLabel(set.sales_user),
          mode: set.settlement_mode?.toUpperCase(),
          claimed: `Rs. ${formatMoney(set.total_claim_amount)}`,
          advanceDeducted: `Rs. ${formatMoney(set.advance_deduction_amount)}`,
          directPaid: `Rs. ${formatMoney(set.direct_payment_amount)}`,
          method: set.payment_method || "Bank Transfer",
          txn: set.transaction_reference || "—",
          notes: set.settlement_notes || "—",
        }));

        await downloadPdfReport({
          letterhead,
          filename: `expense_settlements_report_${new Date().toISOString().slice(0, 10)}.pdf`,
          title: "Expense Settlements & Vouchers Report",
          subtitle: "Completed Financial Settlements & Direct Payment Vouchers",
          downloadedBy,
          timestamp,
          filterPanel: activeFilterPanel,
          metadata: [
            { label: "Total Settlements", value: String(summaryMetrics.totalCount) },
            { label: "Total Claimed", value: `Rs. ${formatMoney(summaryMetrics.totalAmount)}` },
            {
              label: "Advance Deducted",
              value: `Rs. ${formatMoney((summaryMetrics as any).advanceDeducted)}`,
            },
            {
              label: "Direct Paid",
              value: `Rs. ${formatMoney((summaryMetrics as any).directPaid)}`,
            },
          ],
          columns: [
            { key: "rowNum", label: "#", width: 0.5, align: "left" },
            { key: "setNo", label: "Voucher #", width: 1.3, align: "left" },
            { key: "date", label: "Date", width: 1.1, align: "left" },
            { key: "executive", label: "Executive", width: 1.5, align: "left" },
            { key: "mode", label: "Mode", width: 1.1, align: "center" },
            { key: "claimed", label: "Claimed", width: 1.2, align: "right" },
            { key: "advanceDeducted", label: "Adv Ded", width: 1.2, align: "right" },
            { key: "directPaid", label: "Paid", width: 1.2, align: "right" },
            { key: "method", label: "Method", width: 1.1, align: "center" },
            { key: "txn", label: "Txn Ref", width: 1.2, align: "left" },
            { key: "notes", label: "Notes", width: 1.5, align: "left" },
          ],
          rows,
        });
      }
    } catch (err) {
      console.error("Export PDF failed:", err);
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm"
        role="presentation"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="w-full h-full max-w-[98vw] max-h-[96vh] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border bg-surface-muted/40 px-4 sm:px-5 py-3 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                    Financial & Expenses Master Hub
                  </h2>
                  <span className="rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    Interactive Sheet
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-muted truncate">
                  Displaying {summaryMetrics.totalCount} {summaryMetrics.label1.toLowerCase()} entries
                </p>
              </div>
            </div>

            {/* Tab Navigation Controls */}
            <div className="flex items-center gap-1 rounded-xl bg-surface-muted p-1 border border-border">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("claims");
                  setStatusFilter("all");
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "claims"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-teal-500" />
                Claims ({filteredClaims.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("advances");
                  setStatusFilter("all");
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "advances"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Wallet className="h-3.5 w-3.5 text-indigo-500" />
                Advances ({filteredAdvances.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("settlements");
                  setStatusFilter("all");
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "settlements"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Receipt className="h-3.5 w-3.5 text-emerald-500" />
                Settlements ({filteredSettlements.length})
              </button>
            </div>

            {/* Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Claims View Mode Toggle */}
              {activeTab === "claims" && (
                <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-muted p-0.5">
                  <button
                    type="button"
                    onClick={() => setClaimsViewMode("grouped")}
                    className={`rounded px-2 py-1 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                      claimsViewMode === "grouped"
                        ? "bg-card text-foreground shadow-xs font-bold"
                        : "text-muted hover:text-foreground"
                    }`}
                    title="Group by Date & Executive"
                  >
                    <Layers className="h-3 w-3" />
                    <span className="hidden sm:inline">Grouped</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClaimsViewMode("flat")}
                    className={`rounded px-2 py-1 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                      claimsViewMode === "flat"
                        ? "bg-card text-foreground shadow-xs font-bold"
                        : "text-muted hover:text-foreground"
                    }`}
                    title="Flat Table"
                  >
                    <Table className="h-3 w-3" />
                    <span className="hidden sm:inline">Flat</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowFilterPanel((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold active:scale-95 transition ${
                  showFilterPanel
                    ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400"
                    : "border-border bg-card text-foreground hover:bg-surface-muted"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {activeFiltersCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-teal-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={loadReportData}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition disabled:opacity-50"
                title="Refresh sheet data"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                disabled={downloadingCsv || summaryMetrics.totalCount === 0}
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600/30 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 active:scale-95 disabled:opacity-50 transition shadow-xs"
              >
                <Download className="h-4 w-4" />
                {downloadingCsv ? "Exporting…" : "CSV"}
              </button>
              <button
                type="button"
                disabled={downloadingExcel || summaryMetrics.totalCount === 0}
                onClick={exportExcel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600/40 bg-teal-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-teal-700 active:scale-95 disabled:opacity-50 transition shadow-xs"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {downloadingExcel ? "Generating…" : "Excel"}
              </button>
              <button
                type="button"
                disabled={downloadingPdf || summaryMetrics.totalCount === 0}
                onClick={exportPdf}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 active:scale-95 disabled:opacity-50 transition shadow-xs"
              >
                <Download className="h-4 w-4" />
                {downloadingPdf ? "Generating…" : "PDF"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground active:scale-90 transition ml-auto sm:ml-0"
                title="Close report modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Expandable Filter Panel */}
          {showFilterPanel && (
            <div className="border-b border-border bg-card p-4 space-y-3 shadow-inner">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {activeTab === "claims"
                      ? "Expense Claims Filters"
                      : activeTab === "advances"
                      ? "Tour Advances Filters"
                      : "Expense Settlement Filters"}
                  </h4>
                  {activeFiltersCount > 0 && (
                    <span className="text-[11px] text-muted">
                      ({activeFiltersCount} filters applied)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 text-xs text-rose-500 hover:underline font-semibold"
                >
                  <RotateCcw className="h-3 w-3" /> Reset All Filters
                </button>
              </div>

              {/* Filter Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {/* 1. Date Range Preset */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted">Date Range</label>
                  <select
                    value={datePreset}
                    onChange={(e) => setDatePreset(e.target.value as ReportDatePreset)}
                    className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="this_week">This Week</option>
                    <option value="last_week">Last Week</option>
                    <option value="current_month">Current Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>

                {datePreset === "custom" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted">From Date</label>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted">To Date</label>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                      />
                    </div>
                  </>
                )}

                {/* 2. Hierarchy Team Filter */}
                {elevatedRole && teamOptions.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted">Reporting Team</label>
                    <select
                      value={teamFilter}
                      onChange={(e) => {
                        setTeamFilter(e.target.value);
                        setExecutiveFilter("all");
                      }}
                      className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                    >
                      <option value="all">All Visible Teams</option>
                      {teamOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 3. Executive Filter */}
                {elevatedRole && executiveOptions.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted">Sales Executive</label>
                    <select
                      value={executiveFilter}
                      onChange={(e) => setExecutiveFilter(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                    >
                      <option value="all">All Representatives</option>
                      {executiveOptions.map((exec) => (
                        <option key={exec.id} value={exec.id}>
                          {exec.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Claims-Specific: Category & Sub-Category */}
                {activeTab === "claims" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted">Category</label>
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                      >
                        <option value="all">All Categories</option>
                        {WORK_PLAN_EXPENSE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted">Sub-Category</label>
                      <select
                        value={subCategoryFilter}
                        onChange={(e) => setSubCategoryFilter(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                      >
                        <option value="all">All Sub-Categories</option>
                        {WORK_PLAN_TRAVEL_SUB_CATEGORIES.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Payment Mode */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted">Payment Mode</label>
                  <select
                    value={paymentModeFilter}
                    onChange={(e) => setPaymentModeFilter(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                  >
                    <option value="all">All Modes</option>
                    {WORK_PLAN_EXPENSE_PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Corporate Card">Corporate Card</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                  >
                    <option value="all">All Statuses</option>
                    {activeTab === "claims" ? (
                      WORK_PLAN_EXPENSE_STATUS_TABS.filter((t) => t.key !== "all").map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))
                    ) : activeTab === "advances" ? (
                      <>
                        <option value="pending">Pending Approval</option>
                        <option value="approved">Approved</option>
                        <option value="disbursed">Disbursed</option>
                        <option value="settled">Settled</option>
                        <option value="refunded">Refunded</option>
                        <option value="rejected">Rejected</option>
                      </>
                    ) : (
                      <option value="settled">Settled</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder={`Search ${activeTab} records, executive, reference, notes...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sheet Table View */}
          <div className="flex-1 overflow-auto bg-card">
            {loading ? (
              <div className="flex h-64 items-center justify-center text-xs text-muted gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-teal-500" />
                Loading {activeTab} spreadsheet data…
              </div>
            ) : summaryMetrics.totalCount === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-muted p-6 text-center">
                <Table className="h-10 w-10 text-muted/50 mb-2" />
                <p className="text-sm font-semibold text-foreground">No matching {activeTab} found</p>
                <p className="text-xs text-muted mt-1">
                  Try adjusting or resetting your filter criteria.
                </p>
              </div>
            ) : activeTab === "claims" ? (
              /* Claims Sheet */
              <table className="w-full border-collapse text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/80 text-[11px] font-bold text-muted uppercase tracking-wider select-none sticky top-0 z-10 shadow-xs">
                    <th className="w-12 border-r border-border px-3 py-2 text-center bg-surface-muted">
                      #
                    </th>
                    {claimsViewMode === "flat" && (
                      <>
                        <th className="border-r border-border px-3 py-2 w-32">Expense Date</th>
                        <th className="border-r border-border px-3 py-2 w-44">Sales Executive</th>
                        <th className="border-r border-border px-3 py-2 min-w-[200px]">Day Work Plan</th>
                      </>
                    )}
                    <th className="border-r border-border px-3 py-2 w-32">Category</th>
                    <th className="border-r border-border px-3 py-2 w-36">Sub Category</th>
                    <th className="border-r border-border px-3 py-2 w-32 text-right">Amount (₹)</th>
                    <th className="border-r border-border px-3 py-2 w-32">Payment Mode</th>
                    <th className="border-r border-border px-3 py-2 w-40">Vendor Name</th>
                    <th className="border-r border-border px-3 py-2 w-32">Bill No</th>
                    <th className="border-r border-border px-3 py-2 w-36 font-mono">
                      Odometer / Distance
                    </th>
                    <th className="border-r border-border px-3 py-2 w-28 text-center">Attachments</th>
                    <th className="border-r border-border px-3 py-2 w-32">Status</th>
                    <th className="px-3 py-2 min-w-[200px]">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {claimsViewMode === "grouped" ? (
                    groupedDateClaims.map((dateGroup) => (
                      <Fragment key={dateGroup.dateKey}>
                        {/* Date Header Row */}
                        <tr className="border-y-2 border-border/80 bg-surface-muted/90 text-foreground sticky top-8 z-[5]">
                          <td colSpan={11} className="px-4 py-2">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Calendar className="h-4 w-4 text-primary shrink-0" />
                                <span className="text-xs sm:text-sm font-bold">{dateGroup.mainDate}</span>
                                {dateGroup.weekday && (
                                   <span className="text-xs text-muted font-medium">({dateGroup.weekday})</span>
                                )}
                                {dateGroup.isToday && (
                                  <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                    Today
                                  </span>
                                )}
                                {dateGroup.isYesterday && (
                                  <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    Yesterday
                                  </span>
                                )}
                                <span className="text-muted text-[11px] font-normal ml-1">
                                  ({dateGroup.totalUsersCount} {dateGroup.totalUsersCount === 1 ? "executive" : "executives"} · {dateGroup.totalExpensesCount} {dateGroup.totalExpensesCount === 1 ? "claim" : "claims"})
                                </span>
                              </div>
                              <div className="text-right text-xs sm:text-sm font-extrabold text-foreground whitespace-nowrap">
                                <span className="text-[11px] text-muted font-normal mr-1.5">Daily Total:</span>
                                ₹{formatMoney(dateGroup.totalAmount)}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* User Groups under this date */}
                        {dateGroup.userGroups.map((userGroup) => (
                          <Fragment key={`${dateGroup.dateKey}__${userGroup.userId}__${userGroup.workPlanId || "direct"}`}>
                            {/* User Sub-Header Row */}
                            <tr className="border-b border-border/70 bg-card hover:bg-surface-muted/20">
                              <td colSpan={11} className="px-5 py-2">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                                      {userGroup.userName.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-bold text-xs text-foreground">{userGroup.userName}</span>
                                    <span className="text-[11px] text-muted font-normal">
                                      ({userGroup.expenses.length} {userGroup.expenses.length === 1 ? "claim" : "claims"})
                                    </span>
                                    <div className="ml-2">
                                      {userGroup.workPlan ? (
                                        renderWorkPlanBadge(userGroup.workPlan)
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted italic bg-surface-muted/50 border border-border/50">
                                          Direct Claims (No Work Plan)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-xs font-bold text-foreground whitespace-nowrap">
                                    <span className="text-[10px] text-muted font-normal mr-1.5">User Total:</span>
                                    ₹{formatMoney(userGroup.totalAmount)}
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {/* User Claims */}
                            {userGroup.expenses.map((e, idx) => {
                              const isBike = e.category === "Travel" && e.sub_category === "Private Bike";
                              const startKm = e.start_reading ?? null;
                              const closeKm = e.closing_reading ?? null;
                              const odoText =
                                startKm != null && closeKm != null
                                  ? `${startKm.toLocaleString()} → ${closeKm.toLocaleString()} (${(closeKm - startKm).toLocaleString()} KM${isBike ? " @ ₹3.5" : ""})`
                                  : "—";

                              const attachmentsList = extractExpenseAttachments(e);

                              return (
                                <tr
                                  key={e._id || e.id || idx}
                                  className="hover:bg-surface-muted/60 transition group"
                                >
                                  <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono font-medium bg-surface-muted/30 group-hover:bg-surface-muted">
                                    {idx + 1}
                                  </td>
                                  <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                                    <span className="rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 text-[11px] font-bold">
                                      {e.category || "Other"}
                                    </span>
                                  </td>
                                  <td className="border-r border-border/60 px-3 py-2 text-muted whitespace-nowrap">
                                    {e.sub_category || "—"}
                                  </td>
                                  <td className="border-r border-border/60 px-3 py-2 text-right font-bold text-foreground tabular-nums">
                                    ₹{formatMoney(e.amount)}
                                  </td>
                                  <td className="border-r border-border/60 px-3 py-2 text-muted whitespace-nowrap">
                                    {e.payment_mode || "Cash"}
                                  </td>
                                  <td className="border-r border-border/60 px-3 py-2 text-foreground truncate max-w-[160px]">
                                    {e.vendor_name || "—"}
                                  </td>
                                  <td className="border-r border-border/60 px-3 py-2 font-mono text-muted whitespace-nowrap">
                                    {e.bill_number || "—"}
                                  </td>
                                  <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[11px] whitespace-nowrap">
                                    {odoText}
                                  </td>
                                  <td className="border-r border-border/60 px-3 py-2 text-center whitespace-nowrap">
                                    {attachmentsList.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const a0 = attachmentsList[0];
                                          openPreview({
                                            name: a0.name,
                                            url: a0.url,
                                            mime: a0.mime,
                                          });
                                        }}
                                        className="inline-flex items-center gap-1 rounded bg-teal-500/10 hover:bg-teal-500/20 px-2 py-0.5 text-[11px] font-bold text-teal-600 dark:text-teal-400 transition cursor-pointer"
                                        title="Click to preview attachment"
                                      >
                                        <Eye className="h-3 w-3" />
                                        {attachmentsList.length} file{attachmentsList.length > 1 ? "s" : ""}
                                      </button>
                                    ) : (
                                      <span className="text-muted">—</span>
                                    )}
                                  </td>
                                  <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                                    {renderExpenseStatusBadge(e.status)}
                                  </td>
                                  <td className="px-3 py-2 text-muted truncate max-w-[250px]">
                                    {e.description || "—"}
                                  </td>
                                </tr>
                              );
                            })}

                            {/* User Subtotal row if > 1 claim */}
                            {userGroup.expenses.length > 1 && (
                              <tr className="bg-surface-muted/30 border-b border-border/60 text-xs">
                                <td colSpan={3} className="px-3 py-1.5 text-right font-semibold text-muted">
                                  Subtotal — {userGroup.userName}:
                                </td>
                                <td className="px-3 py-1.5 text-right font-extrabold text-foreground tabular-nums whitespace-nowrap">
                                  ₹{formatMoney(userGroup.totalAmount)}
                                </td>
                                <td colSpan={7} />
                              </tr>
                            )}
                          </Fragment>
                        ))}

                        {/* Date Total Footer if > 1 user on this date */}
                        {dateGroup.totalUsersCount > 1 && (
                          <tr className="bg-surface-muted/60 border-b-2 border-border text-xs font-bold">
                            <td colSpan={3} className="px-3 py-2 text-right text-foreground">
                              Daily Total — {dateGroup.mainDate}:
                            </td>
                            <td className="px-3 py-2 text-right font-extrabold text-foreground tabular-nums whitespace-nowrap">
                              ₹{formatMoney(dateGroup.totalAmount)}
                            </td>
                            <td colSpan={7} />
                          </tr>
                        )}
                      </Fragment>
                    ))
                  ) : (
                    filteredClaims.map((e, idx) => {
                      const exec = resolveExpenseSalesUser(e);
                      const isBike = e.category === "Travel" && e.sub_category === "Private Bike";
                      const startKm = e.start_reading ?? null;
                      const closeKm = e.closing_reading ?? null;
                      const odoText =
                        startKm != null && closeKm != null
                          ? `${startKm.toLocaleString()} → ${closeKm.toLocaleString()} (${(closeKm - startKm).toLocaleString()} KM${isBike ? " @ ₹3.5" : ""})`
                          : "—";

                      const attachmentsList = extractExpenseAttachments(e);

                      return (
                        <tr
                          key={e._id || e.id || idx}
                          className="hover:bg-surface-muted/60 transition group"
                        >
                          <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono font-medium bg-surface-muted/30 group-hover:bg-surface-muted">
                            {idx + 1}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 font-medium text-foreground whitespace-nowrap">
                            {formatPlanDate(e.expense_date)}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 font-semibold text-foreground whitespace-nowrap">
                            {exec}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2">
                            {renderWorkPlanBadge(e.work_plan)}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                            <span className="rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 text-[11px] font-bold">
                              {e.category || "Other"}
                            </span>
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted whitespace-nowrap">
                            {e.sub_category || "—"}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 text-right font-bold text-foreground tabular-nums">
                            ₹{formatMoney(e.amount)}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted whitespace-nowrap">
                            {e.payment_mode || "Cash"}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 text-foreground truncate max-w-[160px]">
                            {e.vendor_name || "—"}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 font-mono text-muted whitespace-nowrap">
                            {e.bill_number || "—"}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[11px] whitespace-nowrap">
                            {odoText}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 text-center whitespace-nowrap">
                            {attachmentsList.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const a0 = attachmentsList[0];
                                  openPreview({
                                    name: a0.name,
                                    url: a0.url,
                                    mime: a0.mime,
                                  });
                                }}
                                className="inline-flex items-center gap-1 rounded bg-teal-500/10 hover:bg-teal-500/20 px-2 py-0.5 text-[11px] font-bold text-teal-600 dark:text-teal-400 transition cursor-pointer"
                                title="Click to preview attachment"
                              >
                                <Eye className="h-3 w-3" />
                                {attachmentsList.length} file{attachmentsList.length > 1 ? "s" : ""}
                              </button>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                            {renderExpenseStatusBadge(e.status)}
                          </td>
                          <td className="px-3 py-2 text-muted truncate max-w-[250px]">
                            {e.description || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : activeTab === "advances" ? (
              /* Advances Sheet */
              <table className="w-full border-collapse text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/80 text-[11px] font-bold text-muted uppercase tracking-wider select-none sticky top-0 z-10 shadow-xs">
                    <th className="w-12 border-r border-border px-3 py-2 text-center bg-surface-muted">
                      #
                    </th>
                    <th className="border-r border-border px-3 py-2 w-32">Advance #</th>
                    <th className="border-r border-border px-3 py-2 w-32">Date</th>
                    <th className="border-r border-border px-3 py-2 w-44">Sales Executive</th>
                    <th className="border-r border-border px-3 py-2 w-32 text-right">Requested (₹)</th>
                    <th className="border-r border-border px-3 py-2 w-32 text-right">Disbursed (₹)</th>
                    <th className="border-r border-border px-3 py-2 w-32 text-right">Balance (₹)</th>
                    <th className="border-r border-border px-3 py-2 w-36">Payment Mode</th>
                    <th className="border-r border-border px-3 py-2 w-36 font-mono">Txn Ref</th>
                    <th className="border-r border-border px-3 py-2 w-28 text-center">Receipts</th>
                    <th className="border-r border-border px-3 py-2 w-32">Status</th>
                    <th className="px-3 py-2 min-w-[200px]">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredAdvances.map((adv, idx) => {
                    const exec = salesUserLabel(adv.sales_user);
                    const atts = extractAdvanceAttachments(adv);
                    return (
                      <tr
                        key={adv._id || adv.id || idx}
                        className="hover:bg-surface-muted/60 transition group"
                      >
                        <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono font-medium bg-surface-muted/30 group-hover:bg-surface-muted">
                          {idx + 1}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 font-mono font-semibold text-foreground whitespace-nowrap">
                          {adv.advance_number}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 font-medium text-foreground whitespace-nowrap">
                          {formatPlanDate(adv.request_date || adv.createdAt)}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 font-semibold text-foreground whitespace-nowrap">
                          {exec}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 text-right font-medium text-foreground tabular-nums">
                          ₹{formatMoney(adv.amount)}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          ₹{formatMoney(adv.disbursed_amount)}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 text-right font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                          ₹{formatMoney(adv.remaining_balance)}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 text-muted whitespace-nowrap">
                          {adv.payment_method || "Bank Transfer"}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 font-mono text-muted text-[11px] whitespace-nowrap">
                          {adv.transaction_reference || "—"}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 text-center whitespace-nowrap">
                          {atts.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const a0 = atts[0];
                                openPreview({ name: a0.name, url: a0.url, mime: a0.mime });
                              }}
                              className="inline-flex items-center gap-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 transition cursor-pointer"
                              title="Click to preview disbursement proof"
                            >
                              <Eye className="h-3 w-3" />
                              {atts.length} proof{atts.length > 1 ? "s" : ""}
                            </button>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              adv.status === "disbursed"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : adv.status === "settled"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : adv.status === "approved"
                                ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                                : adv.status === "rejected"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {adv.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted truncate max-w-[250px]">
                          {adv.purpose || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* Settlements Sheet */
              <table className="w-full border-collapse text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/80 text-[11px] font-bold text-muted uppercase tracking-wider select-none sticky top-0 z-10 shadow-xs">
                    <th className="w-12 border-r border-border px-3 py-2 text-center bg-surface-muted">
                      #
                    </th>
                    <th className="border-r border-border px-3 py-2 w-36">Voucher #</th>
                    <th className="border-r border-border px-3 py-2 w-32">Date</th>
                    <th className="border-r border-border px-3 py-2 w-44">Sales Executive</th>
                    <th className="border-r border-border px-3 py-2 w-32 text-center">Mode</th>
                    <th className="border-r border-border px-3 py-2 w-32 text-right">Total Claimed (₹)</th>
                    <th className="border-r border-border px-3 py-2 w-32 text-right">Adv Deducted (₹)</th>
                    <th className="border-r border-border px-3 py-2 w-32 text-right">Direct Paid (₹)</th>
                    <th className="border-r border-border px-3 py-2 w-36">Payment Mode</th>
                    <th className="border-r border-border px-3 py-2 w-36 font-mono">Txn / Bank</th>
                    <th className="border-r border-border px-3 py-2 w-28 text-center">Claims Count</th>
                    <th className="px-3 py-2 min-w-[200px]">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredSettlements.map((set, idx) => {
                    const exec = salesUserLabel(set.sales_user);
                    return (
                      <tr
                        key={set._id || set.id || idx}
                        className="hover:bg-surface-muted/60 transition group"
                      >
                        <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono font-medium bg-surface-muted/30 group-hover:bg-surface-muted">
                          {idx + 1}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 font-mono font-semibold text-foreground whitespace-nowrap">
                          {set.settlement_number}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 font-medium text-foreground whitespace-nowrap">
                          {formatPlanDate(set.settlement_date)}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 font-semibold text-foreground whitespace-nowrap">
                          {exec}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 text-center whitespace-nowrap">
                          <span className="rounded bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase">
                            {set.settlement_mode}
                          </span>
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 text-right font-bold text-foreground tabular-nums">
                          ₹{formatMoney(set.total_claim_amount)}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 text-right font-medium text-indigo-600 dark:text-indigo-400 tabular-nums">
                          ₹{formatMoney(set.advance_deduction_amount)}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          ₹{formatMoney(set.direct_payment_amount)}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 text-muted whitespace-nowrap">
                          {set.payment_method || "Bank Transfer"}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 font-mono text-muted text-[11px] whitespace-nowrap">
                          {set.transaction_reference || set.bank_name || "—"}
                        </td>
                        <td className="border-r border-border/60 px-3 py-2 text-center whitespace-nowrap">
                          <span className="rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 text-[11px] font-bold">
                            {Array.isArray(set.claims) ? set.claims.length : 0} claims
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted truncate max-w-[250px]">
                          {set.settlement_notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Status Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted/50 px-5 py-3 text-xs">
            <div className="flex items-center gap-4 text-muted">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <span className="h-2 w-2 rounded-full bg-teal-500" />
                Sheet Active
              </span>
              <span>
                Total Records: <strong className="text-foreground">{summaryMetrics.totalCount}</strong>
              </span>
              <span>
                Total Volume:{" "}
                <strong className="text-foreground">₹{formatMoney(summaryMetrics.totalAmount)}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded bg-card border border-border px-2.5 py-1 text-[11px] font-bold text-muted">
                Active Tab: {activeTab.toUpperCase()}
              </span>
              <button
                type="button"
                disabled={downloadingCsv || summaryMetrics.totalCount === 0}
                onClick={exportCsv}
                className="inline-flex items-center gap-1 rounded bg-surface-muted border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-card disabled:opacity-50 transition"
              >
                <Download className="h-3.5 w-3.5 text-muted" />
                Export CSV
              </button>
              <button
                type="button"
                disabled={downloadingExcel || summaryMetrics.totalCount === 0}
                onClick={exportExcel}
                className="inline-flex items-center gap-1 rounded bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export Excel (.xlsx)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Attachment Preview Modal */}
      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={downloadFile}
        subtitle="Financial Attachment Preview"
      />
    </>
  );
}

export default DownloadExpensesModal;
