"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import {
  useLazyGetExpensesQuery,
  useLazyGetTourAdvancesQuery,
  useLazyGetExpenseSettlementsQuery,
  useGetTeamTreeQuery,
  useGetMyTeamQuery,
} from "@/store/api/workPlannerApiSlice";
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
} from "./workPlanUtils";
import { calculateDateRange, type DateFilterPreset, toYmdString } from "./DashboardDateFilter";
import { usePdfCompanyLetterhead } from "./pdfCompanyLetterhead";
import { downloadPdfReport } from "./exportPdfReport";
import { downloadExcelReport } from "./exportExcelReport";
import { isWpAdmin, isWpElevated, readSessionFromStorage } from "@/utils/authStorage";
import { FilePreviewModal, useFilePreview } from "./FilePreviewModal";

export type DownloadExpensesModalProps = {
  open: boolean;
  expenses?: WorkPlanExpenseRecord[];
  onClose: () => void;
};

type ReportDatePreset = "all" | DateFilterPreset;
type ReportTab = "claims" | "advances" | "settlements";

function formatMoney(n?: number) {
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 0,
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

export function DownloadExpensesModal({
  open,
  expenses: initialExpenses = [],
  onClose,
}: DownloadExpensesModalProps) {
  const letterhead = usePdfCompanyLetterhead();
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const adminRole = isWpAdmin(sessionUser);
  const elevatedRole = isWpElevated(sessionUser);

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
    useFilePreview();

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

  // Hierarchy Queries (Strict portal role filtered)
  const { data: tree } = useGetTeamTreeQuery(undefined, { skip: !adminRole });
  const { data: myTeamData } = useGetMyTeamQuery(undefined, { skip: !elevatedRole || adminRole });

  // Build team options
  const teamOptions = useMemo<Array<{ id: string; name: string; memberIds: string[] }>>(() => {
    if (!elevatedRole) return [];
    if (adminRole && tree) {
      const mgrs = [...(tree?.managers || []), ...(tree?.coordinators || [])] as Array<{
        _id?: string;
        id?: string;
        name: string;
        report_ids?: string[];
      }>;
      return mgrs.map((m) => {
        const mId = String(m._id || m.id || "");
        const reportIds = (m.report_ids || []).map(String);
        return { id: mId, name: `${m.name}'s Team`, memberIds: [mId, ...reportIds] };
      });
    }
    if (elevatedRole && !adminRole && sessionUser?._id) {
      const myTeamMembers = (myTeamData?.members || []) as Array<{ _id?: string; id?: string }>;
      const memberIds = [
        String(sessionUser._id),
        ...myTeamMembers.map((m) => String(m._id || m.id || "")),
      ];
      return [{ id: String(sessionUser._id), name: "My Reporting Team", memberIds }];
    }
    return [];
  }, [adminRole, elevatedRole, tree, myTeamData, sessionUser]);

  // Executive dropdown list from hierarchy
  const executiveOptions = useMemo<Array<{ id: string; name: string }>>(() => {
    if (!elevatedRole) return [];
    if (adminRole && tree) {
      const all: Array<{ _id?: string; id?: string; name: string }> = [
        ...(tree.executives || []),
        ...(tree.managers || []),
        ...(tree.coordinators || []),
      ];
      const seen = new Set<string>();
      return all
        .filter((u) => {
          const id = String(u._id || u.id || "");
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map((u) => ({ id: String(u._id || u.id), name: u.name }));
    }
    if (myTeamData?.members) {
      return (myTeamData.members as Array<{ _id?: string; id?: string; name: string }>).map((m) => ({
        id: String(m._id || m.id),
        name: m.name,
      }));
    }
    return [];
  }, [adminRole, elevatedRole, tree, myTeamData]);

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
        params.from = range.from;
        params.to = range.to;
      }
      if (elevatedRole) {
        params.scope = "team";
      }

      if (activeTab === "claims") {
        if (statusFilter !== "all") params.status = statusFilter;
        if (categoryFilter !== "all") params.category = categoryFilter;
        const res = await fetchExpenses(params).unwrap();
        setClaimsItems(res.data || []);
      } else if (activeTab === "advances") {
        if (statusFilter !== "all") params.status = statusFilter;
        const res = await fetchTourAdvances(params).unwrap();
        setAdvancesItems((res as any)?.data || (res as any)?.advances || []);
      } else if (activeTab === "settlements") {
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
  }, [open, activeTab, datePreset, customFrom, customTo, statusFilter, categoryFilter]);

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
    return "";
  };

  // Filtered Claims
  const filteredClaims = useMemo(() => {
    return claimsItems.filter((e) => {
      const uid = extractOwnerId(e);
      if (selectedTeamMemberIds && uid && !selectedTeamMemberIds.has(uid)) return false;
      if (executiveFilter !== "all" && uid !== executiveFilter) return false;
      if (subCategoryFilter !== "all" && e.sub_category !== subCategoryFilter) return false;
      if (paymentModeFilter !== "all" && e.payment_mode !== paymentModeFilter) return false;
      if (
        vendorLocationFilter.trim() &&
        !(e.vendor_name || "").toLowerCase().includes(vendorLocationFilter.trim().toLowerCase())
      ) {
        return false;
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
  }, [
    claimsItems,
    selectedTeamMemberIds,
    executiveFilter,
    subCategoryFilter,
    paymentModeFilter,
    vendorLocationFilter,
    searchQuery,
  ]);

  // Filtered Advances
  const filteredAdvances = useMemo(() => {
    return advancesItems.filter((adv) => {
      const uid = extractOwnerId(adv);
      if (selectedTeamMemberIds && uid && !selectedTeamMemberIds.has(uid)) return false;
      if (executiveFilter !== "all" && uid !== executiveFilter) return false;
      if (paymentModeFilter !== "all" && adv.payment_method !== paymentModeFilter) return false;
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
  }, [advancesItems, selectedTeamMemberIds, executiveFilter, paymentModeFilter, searchQuery]);

  // Filtered Settlements
  const filteredSettlements = useMemo(() => {
    return settlementsItems.filter((set) => {
      const uid = extractOwnerId(set);
      if (selectedTeamMemberIds && uid && !selectedTeamMemberIds.has(uid)) return false;
      if (executiveFilter !== "all" && uid !== executiveFilter) return false;
      if (paymentModeFilter !== "all" && set.payment_method !== paymentModeFilter) return false;
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
  }, [settlementsItems, selectedTeamMemberIds, executiveFilter, paymentModeFilter, searchQuery]);

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
  // Export CSV
  // ----------------------------------------------------
  function exportCsv() {
    setDownloadingCsv(true);
    try {
      let headers: string[] = [];
      let rows: (string | number)[][] = [];
      const timestamp = new Date().toISOString().slice(0, 10);

      if (activeTab === "claims") {
        headers = [
          "Row #",
          "Expense Date",
          "Sales Executive",
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
          const attCount = Array.isArray(e.attachments)
            ? e.attachments.length
            : e.receipt_attachment
            ? 1
            : 0;
          return [
            idx + 1,
            formatPlanDate(e.expense_date),
            `"${user.replace(/"/g, '""')}"`,
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
      link.setAttribute("download", `work_planner_${activeTab}_report_${timestamp}.csv`);
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
        const columns = [
          { key: "rowNum", label: "#" },
          { key: "expense_date", label: "Date" },
          { key: "sales_user", label: "Executive" },
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
          const attCount = Array.isArray(r.attachments)
            ? r.attachments.length
            : r.receipt_attachment
            ? 1
            : 0;
          return {
            rowNum: i + 1,
            expense_date: formatPlanDate(r.expense_date),
            sales_user: resolveExpenseSalesUser(r),
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
          value: teamFilter === "all" ? "All Teams" : "Selected Team",
        },
        {
          label: "Executive",
          value: executiveFilter === "all" ? "All Representatives" : executiveFilter,
        },
        {
          label: "Payment Mode",
          value: paymentModeFilter === "all" ? "All Modes" : paymentModeFilter.toUpperCase(),
        },
        { label: "Search Query", value: searchQuery.trim() || "None" },
      ];

      if (activeTab === "claims") {
        const rows = filteredClaims.map((e, idx) => {
          const userLabel = resolveExpenseSalesUser(e);
          const attCount = Array.isArray(e.attachments)
            ? e.attachments.length
            : e.receipt_attachment
            ? 1
            : 0;
          return {
            rowNum: idx + 1,
            date: formatPlanDate(e.expense_date),
            executive: userLabel,
            category: (e.category || "").toUpperCase(),
            subCategory: e.sub_category || "—",
            amount: `₹${formatMoney(e.amount)}`,
            paymentMode: (e.payment_mode || "cash").toUpperCase(),
            vendor: e.vendor_name || "—",
            attachments: attCount > 0 ? `${attCount} doc(s)` : "—",
            status: (e.status || "").toUpperCase(),
            description: e.description || "—",
          };
        });

        await downloadPdfReport({
          letterhead,
          filename: `expenses_report_${new Date().toISOString().slice(0, 10)}.pdf`,
          title: "Work Planner Expense Claims Master Report",
          subtitle: "Claims & Reimbursements Summary (Vehicle Rate: ₹3.50/KM)",
          downloadedBy,
          timestamp,
          filterPanel: activeFilterPanel,
          metadata: [
            { label: "Total Claims", value: String(summaryMetrics.totalCount) },
            { label: "Total Amount", value: `₹${formatMoney(summaryMetrics.totalAmount)}` },
            {
              label: "Approved Amount",
              value: `₹${formatMoney(summaryMetrics.approvedAmount)}`,
            },
            { label: "Pending Claims", value: String(summaryMetrics.pendingCount) },
          ],
          columns: [
            { key: "rowNum", label: "#", width: 0.5, align: "left" },
            { key: "date", label: "Date", width: 1.1, align: "left" },
            { key: "executive", label: "Executive", width: 1.5, align: "left" },
            { key: "category", label: "Category", width: 1.1, align: "left" },
            { key: "subCategory", label: "Sub Category", width: 1.2, align: "left" },
            { key: "amount", label: "Amount", width: 1.2, align: "right" },
            { key: "paymentMode", label: "Pay Mode", width: 1.0, align: "center" },
            { key: "vendor", label: "Vendor", width: 1.3, align: "left" },
            { key: "attachments", label: "Docs", width: 0.9, align: "center" },
            { key: "status", label: "Status", width: 1.0, align: "center" },
            { key: "description", label: "Description", width: 1.8, align: "left" },
          ],
          rows,
        });
      } else if (activeTab === "advances") {
        const rows = filteredAdvances.map((adv, idx) => ({
          rowNum: idx + 1,
          advNo: adv.advance_number,
          date: formatPlanDate(adv.request_date || adv.createdAt),
          executive: salesUserLabel(adv.sales_user),
          requested: `₹${formatMoney(adv.amount)}`,
          disbursed: `₹${formatMoney(adv.disbursed_amount)}`,
          settled: `₹${formatMoney(adv.settled_amount)}`,
          balance: `₹${formatMoney(adv.remaining_balance)}`,
          method: adv.payment_method || "Bank Transfer",
          status: (adv.status || "").toUpperCase(),
          purpose: adv.purpose || "—",
        }));

        await downloadPdfReport({
          letterhead,
          filename: `tour_advances_report_${new Date().toISOString().slice(0, 10)}.pdf`,
          title: "Work Planner Tour Advances & Balances Report",
          subtitle: "Tour Advances Issuance & Ledger Reconciliation",
          downloadedBy,
          timestamp,
          filterPanel: activeFilterPanel,
          metadata: [
            { label: "Total Advances", value: String(summaryMetrics.totalCount) },
            { label: "Total Disbursed", value: `₹${formatMoney(summaryMetrics.totalAmount)}` },
            {
              label: "Outstanding Balance",
              value: `₹${formatMoney((summaryMetrics as any).remainingBalance)}`,
            },
            { label: "Pending Requests", value: String(summaryMetrics.pendingCount) },
          ],
          columns: [
            { key: "rowNum", label: "#", width: 0.5, align: "left" },
            { key: "advNo", label: "Adv #", width: 1.2, align: "left" },
            { key: "date", label: "Date", width: 1.1, align: "left" },
            { key: "executive", label: "Executive", width: 1.5, align: "left" },
            { key: "requested", label: "Req (₹)", width: 1.1, align: "right" },
            { key: "disbursed", label: "Disb (₹)", width: 1.1, align: "right" },
            { key: "settled", label: "Settled (₹)", width: 1.1, align: "right" },
            { key: "balance", label: "Balance (₹)", width: 1.1, align: "right" },
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
          claimed: `₹${formatMoney(set.total_claim_amount)}`,
          advanceDeducted: `₹${formatMoney(set.advance_deduction_amount)}`,
          directPaid: `₹${formatMoney(set.direct_payment_amount)}`,
          method: set.payment_method || "Bank Transfer",
          txn: set.transaction_reference || "—",
          notes: set.settlement_notes || "—",
        }));

        await downloadPdfReport({
          letterhead,
          filename: `expense_settlements_report_${new Date().toISOString().slice(0, 10)}.pdf`,
          title: "Work Planner Expense Settlements & Vouchers Report",
          subtitle: "Completed Financial Settlements & Direct Payment Vouchers",
          downloadedBy,
          timestamp,
          filterPanel: activeFilterPanel,
          metadata: [
            { label: "Total Settlements", value: String(summaryMetrics.totalCount) },
            { label: "Total Claimed", value: `₹${formatMoney(summaryMetrics.totalAmount)}` },
            {
              label: "Advance Deducted",
              value: `₹${formatMoney((summaryMetrics as any).advanceDeducted)}`,
            },
            {
              label: "Direct Paid",
              value: `₹${formatMoney((summaryMetrics as any).directPaid)}`,
            },
          ],
          columns: [
            { key: "rowNum", label: "#", width: 0.5, align: "left" },
            { key: "setNo", label: "Voucher #", width: 1.3, align: "left" },
            { key: "date", label: "Date", width: 1.1, align: "left" },
            { key: "executive", label: "Executive", width: 1.5, align: "left" },
            { key: "mode", label: "Mode", width: 1.2, align: "center" },
            { key: "claimed", label: "Claimed (₹)", width: 1.2, align: "right" },
            { key: "advanceDeducted", label: "Adv Ded (₹)", width: 1.2, align: "right" },
            { key: "directPaid", label: "Paid (₹)", width: 1.2, align: "right" },
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
                onClick={() => setActiveTab("claims")}
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
                onClick={() => setActiveTab("advances")}
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
                onClick={() => setActiveTab("settlements")}
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
                    <option value="7d">Last 7 Days</option>
                    <option value="current_month">Current Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>

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
                      WORK_PLAN_EXPENSE_STATUS_TABS.map((t) => (
                        <option key={t.id} value={t.id}>
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

              {/* Custom Dates & Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {datePreset === "custom" && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs">
                    <span className="text-muted text-[11px] font-semibold">From:</span>
                    <input
                      type="date"
                      value={customFrom}
                      max={customTo || undefined}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="bg-transparent text-foreground outline-none text-xs"
                    />
                    <span className="text-muted text-[11px] font-semibold ml-2">To:</span>
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom || undefined}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="bg-transparent text-foreground outline-none text-xs"
                    />
                  </div>
                )}

                <div className="relative min-w-[280px] flex-1 max-w-md">
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
                    <th className="border-r border-border px-3 py-2 w-32">Expense Date</th>
                    <th className="border-r border-border px-3 py-2 w-44">Sales Executive</th>
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
                  {filteredClaims.map((e, idx) => {
                    const exec = resolveExpenseSalesUser(e);
                    const isBike = e.category === "Travel" && e.sub_category === "Private Bike";
                    const startKm = e.start_reading ?? null;
                    const closeKm = e.closing_reading ?? null;
                    const odoText =
                      startKm != null && closeKm != null
                        ? `${startKm.toLocaleString()} → ${closeKm.toLocaleString()} (${(closeKm - startKm).toLocaleString()} KM${isBike ? " @ ₹3.5" : ""})`
                        : "—";

                    const attachmentsList: ExpenseAttachmentItem[] = Array.isArray(e.attachments)
                      ? (e.attachments as any[])
                      : e.receipt_attachment
                      ? [{ url: e.receipt_attachment, name: "Receipt Document" }]
                      : [];

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
                          {attachmentsList.length > 0 && attachmentsList[0]?.url ? (
                            <button
                              type="button"
                              onClick={() => {
                                const a0 = attachmentsList[0];
                                openPreview({
                                  name: a0.original_name || a0.filename || (a0 as any).name || "Expense Attachment",
                                  url: a0.url || "",
                                  mime: a0.mime_type || (a0 as any).mime,
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded bg-teal-500/10 hover:bg-teal-500/20 px-2 py-0.5 text-[11px] font-bold text-teal-600 dark:text-teal-400 transition"
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
                    const atts = Array.isArray(adv.attachments) ? adv.attachments : [];
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
                                const url = typeof a0 === "string" ? a0 : a0?.url || "";
                                const name = typeof a0 === "object" ? a0?.original_name || a0?.filename || a0?.name || "Disbursement Proof" : "Disbursement Proof";
                                const mime = typeof a0 === "object" ? a0?.mime_type || a0?.mime : undefined;
                                openPreview({ name, url, mime });
                              }}
                              className="inline-flex items-center gap-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 transition"
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
