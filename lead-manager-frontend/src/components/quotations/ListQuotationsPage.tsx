/**
 * @fileoverview Universal Quotation Master Page.
 * Accessible across Sales, Admin, Finance, and Super Admin portals.
 * Elevated to enterprise SaaS standards with dual-mode responsive layout,
 * faceted filter drawer, floating bulk actions dock, and skeleton states.
 * @module components/portal/shared/quotations/ListQuotationsPage
 */
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Search,
  Plus,
  Eye,
  Pencil,
  Mail,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  Clock,
  Building2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  BookOpen,
  Check,
  X,
  Lock,
  Send,
  XCircle,
  PauseCircle,
  Calendar,
  ShoppingCart,
  Copy,
  FileSpreadsheet,
  Filter,
  CheckSquare,
  Square,
  LayoutGrid,
  List as ListIcon,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  useListQuotationsQuery,
  useSubmitQuotationForApprovalMutation,
  useApproveQuotationMutation,
  useRejectQuotationMutation,
  useUpdateLeadQuotationMutation,
  type QuotationRecord,
  type LeadQuotationRecord,
  type LeadRecord,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { toast } from "@/lib/toast";
import { isAdmin, isCoordinator, isManager, readSessionFromStorage } from "@/utils/authStorage";
import {
  formatCurrencyINR,
  isAssignedSignatory,
  isStrictSignatory,
  canViewQuotationPdf,
  canEmailQuotation,
  canEditQuotation,
  canManageQuotations,
  canViewQuotations,
  isQuotationRosterVisible,
  canSubmitForApproval,
  canUpdateQuotationStatus,
  isDraftVisible,
  canConvertQuotation,
  isQuotationExpired,
  isQuotationExpiringSoon,
  getQuotationExpiryInfo,
} from "./quotationUtils";
import { QuotationViewModal } from "./QuotationViewModal";
import { SendQuotationEmailModal } from "./SendQuotationEmailModal";
import { ConvertQuotationModal } from "./ConvertQuotationModal";
import { ExtendQuotationValidityModal } from "./ExtendQuotationValidityModal";
import { DownloadQuotationsPreviewModal } from "./DownloadQuotationsPreviewModal";
import { QuotationFilterDrawer } from "./QuotationFilterDrawer";
import { TableSkeletonRows, CardSkeletonFeed } from "@/components/shared/Skeletons";

type Props = {
  portalHome?: string;
  portalLabel?: string;
};

function salesRepresentativeDisplay(q: QuotationRecord): {
  name: string;
  designation: string;
  email: string;
} {
  const userRef = q.sales_person_user;
  const fromUser =
    typeof userRef === "object" && userRef !== null
      ? {
          name: userRef.name || "",
          email: userRef.email || "",
          designation: (userRef as { designation?: string }).designation || "",
        }
      : null;
  return {
    name: q.sales_person_name?.trim() || fromUser?.name || "—",
    designation:
      q.sales_person_designation?.trim() || fromUser?.designation || "Sales Representative",
    email: q.sales_person_email?.trim() || fromUser?.email || "",
  };
}

const STATUS_OPTIONS: Array<{ value: string; label: string; badgeClass: string }> = [
  { value: "all", label: "All Statuses", badgeClass: "" },
  { value: "converted", label: "Converted", badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
  { value: "pending_approval", label: "Pending Approval", badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  { value: "approved", label: "Approved", badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
  { value: "draft", label: "Draft", badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { value: "sent", label: "Sent", badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300" },
  {
    value: "in_negotiation",
    label: "In Negotiation",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  },
  { value: "accepted", label: "Accepted", badgeClass: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300" },
  { value: "on_hold", label: "On Hold", badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" },
  { value: "rejected", label: "Rejected", badgeClass: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
  { value: "expired", label: "Expired", badgeClass: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
];

export function ListQuotationsPage({
  portalHome = "/dashboard",
  portalLabel = "Lead Manager Portal",
}: Props) {
  // Query parameters state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [validityFilter, setValidityFilter] = useState<"" | "valid" | "expiring_soon" | "expired">("");
  const [leadSourceFilter, setLeadSourceFilter] = useState<"" | "linked" | "direct">("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [signatoryFilter, setSignatoryFilter] = useState("all");
  const [salesRepFilter, setSalesRepFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 25;

  // View mode & selection state
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportOnlySelected, setExportOnlySelected] = useState(false);

  const reduxUser = useAppSelector((state) => state.auth.user);
  const sessionUser = useMemo(() => readSessionFromStorage()?.user || null, []);
  const authUser = (reduxUser || sessionUser) as any;

  // RTK Query API call
  const { data: rawQuotations, isLoading, isFetching, refetch } = useListQuotationsQuery({
    search: searchTerm || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    page,
    limit,
  });

  const baseQuotations: QuotationRecord[] = useMemo(() => {
    let list: QuotationRecord[] = [];
    if (Array.isArray(rawQuotations)) {
      list = rawQuotations;
    } else if (rawQuotations && typeof rawQuotations === "object") {
      if ("data" in rawQuotations && Array.isArray((rawQuotations as any).data)) {
        list = (rawQuotations as any).data;
      } else if ("quotations" in rawQuotations && Array.isArray((rawQuotations as any).quotations)) {
        list = (rawQuotations as any).quotations;
      }
    }
    const currentUser = authUser || (typeof window !== "undefined" ? readSessionFromStorage()?.user : null);
    if (!currentUser) return list;
    if (canManageQuotations(currentUser) || canViewQuotations(currentUser)) {
      return list;
    }
    return list.filter((q) => isQuotationRosterVisible(currentUser as any, q as any));
  }, [rawQuotations, authUser]);

  // Unique facet values from current data
  const { availableSignatories, availableSalesReps } = useMemo(() => {
    const sigSet = new Set<string>();
    const repSet = new Set<string>();
    baseQuotations.forEach((q) => {
      if (q.signatory_name?.trim()) sigSet.add(q.signatory_name.trim());
      const rep = salesRepresentativeDisplay(q);
      if (rep.name && rep.name !== "—") repSet.add(rep.name);
    });
    return {
      availableSignatories: Array.from(sigSet).sort(),
      availableSalesReps: Array.from(repSet).sort(),
    };
  }, [baseQuotations]);

  // Extended client-side faceted filtering
  const quotations: QuotationRecord[] = useMemo(() => {
    return baseQuotations.filter((q) => {
      // Validity filter
      if (validityFilter === "valid" && isQuotationExpired(q)) return false;
      if (validityFilter === "expiring_soon" && !isQuotationExpiringSoon(q)) return false;
      if (validityFilter === "expired" && !isQuotationExpired(q)) return false;

      // Lead source filter
      if (leadSourceFilter === "linked" && !q.lead) return false;
      if (leadSourceFilter === "direct" && Boolean(q.lead)) return false;

      // Min amount filter
      if (minAmount && (q.grand_total || 0) < parseFloat(minAmount)) return false;

      // Max amount filter
      if (maxAmount && (q.grand_total || 0) > parseFloat(maxAmount)) return false;

      // Date range filter
      if (fromDate) {
        const qDate = q.quotation_date ? new Date(q.quotation_date) : null;
        if (!qDate || qDate < new Date(fromDate)) return false;
      }
      if (toDate) {
        const qDate = q.quotation_date ? new Date(q.quotation_date) : null;
        if (!qDate || qDate > new Date(toDate + "T23:59:59")) return false;
      }

      // Signatory filter
      if (signatoryFilter !== "all" && q.signatory_name !== signatoryFilter) return false;

      // Sales rep filter
      if (salesRepFilter !== "all") {
        const rep = salesRepresentativeDisplay(q);
        if (rep.name !== salesRepFilter) return false;
      }

      return true;
    });
  }, [
    baseQuotations,
    validityFilter,
    leadSourceFilter,
    minAmount,
    maxAmount,
    fromDate,
    toDate,
    signatoryFilter,
    salesRepFilter,
  ]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (validityFilter) count++;
    if (leadSourceFilter) count++;
    if (minAmount) count++;
    if (maxAmount) count++;
    if (fromDate) count++;
    if (toDate) count++;
    if (signatoryFilter !== "all") count++;
    if (salesRepFilter !== "all") count++;
    return count;
  }, [
    statusFilter,
    validityFilter,
    leadSourceFilter,
    minAmount,
    maxAmount,
    fromDate,
    toDate,
    signatoryFilter,
    salesRepFilter,
  ]);

  const handleClearFilters = () => {
    setStatusFilter("all");
    setValidityFilter("");
    setLeadSourceFilter("");
    setMinAmount("");
    setMaxAmount("");
    setFromDate("");
    setToDate("");
    setSignatoryFilter("all");
    setSalesRepFilter("all");
    setSearchTerm("");
  };

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    if (selectedIds.size === quotations.length && quotations.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(quotations.map((q) => q._id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Selected quotations list
  const selectedQuotations = useMemo(() => {
    if (!exportOnlySelected) return quotations;
    return quotations.filter((q) => selectedIds.has(q._id));
  }, [quotations, selectedIds, exportOnlySelected]);

  // Modal States
  const [downloadQuotationsModalOpen, setDownloadQuotationsModalOpen] = useState(false);
  const [convertingQuotation, setConvertingQuotation] = useState<QuotationRecord | null>(null);
  const [extendValidityTarget, setExtendValidityTarget] = useState<QuotationRecord | null>(null);
  const [viewQuotation, setViewQuotation] = useState<LeadQuotationRecord | null>(null);
  const [emailQuotation, setEmailQuotation] = useState<LeadQuotationRecord | null>(null);
  const [submitApprovalTarget, setSubmitApprovalTarget] = useState<QuotationRecord | null>(null);
  const [approveTarget, setApproveTarget] = useState<QuotationRecord | null>(null);
  const [rejectTarget, setRejectTarget] = useState<QuotationRecord | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<QuotationRecord | null>(null);
  const [onHoldTarget, setOnHoldTarget] = useState<QuotationRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  const [submitForApproval, { isLoading: isSubmitting }] = useSubmitQuotationForApprovalMutation();
  const [approveQuotation, { isLoading: isApproving }] = useApproveQuotationMutation();
  const [rejectQuotation, { isLoading: isRejecting }] = useRejectQuotationMutation();
  const [updateLeadQuotation, { isLoading: isUpdating }] = useUpdateLeadQuotationMutation();

  const handleSubmitForApproval = async () => {
    if (!submitApprovalTarget) return;
    const qNo = submitApprovalTarget.quotation_no;
    try {
      await submitForApproval({ quotationId: submitApprovalTarget._id }).unwrap();
      toast.success(`Quotation ${qNo} submitted for signatory approval`);
      setSubmitApprovalTarget(null);
      refetch();
    } catch {
      toast.error("Failed to submit quotation for approval");
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    const qNo = approveTarget.quotation_no;
    try {
      await approveQuotation({ quotationId: approveTarget._id }).unwrap();
      toast.success(`Quotation ${qNo} approved successfully`);
      setApproveTarget(null);
      refetch();
    } catch {
      toast.error("Failed to approve quotation");
    }
  };

  const handleAccept = async () => {
    if (!acceptTarget) return;
    const qNo = acceptTarget.quotation_no;
    try {
      await updateLeadQuotation({
        quotationId: acceptTarget._id,
        body: { status: "accepted" },
      }).unwrap();
      toast.success(`Quotation ${qNo} marked as Accepted`);
      setAcceptTarget(null);
      refetch();
    } catch {
      toast.error("Failed to mark quotation as accepted");
    }
  };

  const handleOnHold = async () => {
    if (!onHoldTarget) return;
    const qNo = onHoldTarget.quotation_no;
    const isCurrentlyHold = onHoldTarget.status === "on_hold";
    const nextStatus = isCurrentlyHold ? "sent" : "on_hold";
    try {
      await updateLeadQuotation({
        quotationId: onHoldTarget._id,
        body: { status: nextStatus },
      }).unwrap();
      toast.success(
        isCurrentlyHold
          ? `Quotation ${qNo} resumed`
          : `Quotation ${qNo} put On Hold`
      );
      setOnHoldTarget(null);
      refetch();
    } catch {
      toast.error("Failed to update quotation status");
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    const qNo = rejectTarget.quotation_no;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejecting this quotation");
      return;
    }
    try {
      await rejectQuotation({
        quotationId: rejectTarget._id,
        rejection_reason: rejectionReason.trim(),
      }).unwrap();
      toast.success(`Quotation ${qNo} rejected`);
      setRejectTarget(null);
      setRejectionReason("");
      refetch();
    } catch {
      toast.error("Failed to reject quotation");
    }
  };

  const allVisibleSelected = quotations.length > 0 && selectedIds.size === quotations.length;
  const someVisibleSelected = selectedIds.size > 0 && !allVisibleSelected;

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 transition-colors">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/20">
              <FileText className="h-5 w-5" />
            </div>
            Quotation Master
          </h1>
          <p className="mt-1 text-sm text-muted">
            {canManageQuotations(authUser)
              ? "View, generate, track, and manage all customer quotations across department operations."
              : "View and track quotations and proposals assigned to you as sales representative."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-surface-muted transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setExportOnlySelected(false);
              setDownloadQuotationsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-surface-muted transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export Excel
          </button>

          {canViewQuotations(authUser) && (
            <Link
              href={`${portalHome}/quotations/reports`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-surface-muted transition cursor-pointer"
            >
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              Reports
            </Link>
          )}

          {(isAdmin(authUser as any) || isManager(authUser as any) || isCoordinator(authUser as any)) && (
            <Link
              href={`${portalHome}/quotations/terms`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-surface-muted transition cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              Terms
            </Link>
          )}

          {canManageQuotations(authUser) && (
            <Link
              href={`${portalHome}/quotations/new`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-hover transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Generate Quotation
            </Link>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by quote #, ref #, customer, or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted/50 pl-10 pr-9 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Drawer Trigger Button */}
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                activeFilterCount > 0
                  ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                  : "border-border bg-card text-foreground hover:bg-surface-muted"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Clear All Filters Button */}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-2 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-muted transition cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="h-3 w-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            {/* View Mode Toggle (Desktop / Mobile Friendly) */}
            <div className="flex items-center rounded-xl border border-border bg-surface-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`rounded-lg p-1.5 transition cursor-pointer ${
                  viewMode === "table"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted hover:text-foreground"
                }`}
                title="Table View"
                aria-label="Table View"
              >
                <ListIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`rounded-lg p-1.5 transition cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted hover:text-foreground"
                }`}
                title="Card Feed View"
                aria-label="Card Feed View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Pill Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar border-t border-border/60">
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  isSelected
                    ? "bg-primary text-white shadow-2xs"
                    : "border border-border bg-card text-foreground hover:bg-surface-muted"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "table" ? (
        /* High-Density Desktop Table View */
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 font-bold text-muted">
                  <th className="w-10 px-4 py-3.5 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAllVisible}
                      className="text-muted hover:text-foreground cursor-pointer inline-flex items-center justify-center"
                      title={allVisibleSelected ? "Deselect all" : "Select all visible"}
                    >
                      {allVisibleSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : someVisibleSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary/60" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3.5">Quotation / Ref</th>
                  <th className="px-4 py-3.5">Customer &amp; Source</th>
                  <th className="px-4 py-3.5">Subject</th>
                  <th className="px-4 py-3.5">Date &amp; Validity</th>
                  <th className="px-4 py-3.5 text-right">Grand Total</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Signatory</th>
                  <th className="px-4 py-3.5">Sales Rep</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <TableSkeletonRows rows={8} cols={10} />
                ) : quotations.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-muted">
                      <FileText className="mx-auto h-10 w-10 text-muted/60 mb-3" />
                      <p className="font-semibold text-foreground text-sm">No Quotations Found</p>
                      <p className="text-xs text-muted mt-1">
                        {activeFilterCount > 0
                          ? "No quotations match your current filter facets. Try resetting filters."
                          : "Generate a new direct or lead-linked quotation to get started."}
                      </p>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Clear Filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  quotations.map((q) => {
                    const leadInfo = typeof q.lead === "object" && q.lead !== null ? q.lead : null;
                    const salesRep = salesRepresentativeDisplay(q);
                    const isSelected = selectedIds.has(q._id);
                    const expiryInfo = getQuotationExpiryInfo(q);

                    const statusOpt = STATUS_OPTIONS.find((s) => s.value === q.status) || {
                      badgeClass: "bg-slate-100 text-slate-700",
                      label: q.status,
                    };

                    const isSignatory = isAssignedSignatory(authUser, q);
                    const canViewPdf = canViewQuotationPdf(authUser, q);
                    const canEmail = canEmailQuotation(q);
                    const canEdit = canEditQuotation(authUser, q);
                    const isPending = q.approval_status === "pending_approval" || q.status === "pending_approval";
                    const canSubmit = canSubmitForApproval(authUser, q as unknown as Parameters<typeof canSubmitForApproval>[1]);

                    return (
                      <tr
                        key={q._id}
                        className={`group transition-colors ${
                          isSelected
                            ? "bg-primary/5 hover:bg-primary/10"
                            : "hover:bg-surface-muted/50"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(q._id)}
                            className="text-muted hover:text-foreground cursor-pointer inline-flex items-center justify-center"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </td>

                        {/* Quotation / Ref */}
                        <td className="px-4 py-3.5 font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`${portalHome}/quotations/${q._id}`}
                              className="font-bold text-primary hover:underline"
                            >
                              {q.quotation_no}
                            </Link>
                            {q.version && q.version > 1 ? (
                              <span className="inline-flex items-center rounded-md bg-indigo-50 border border-indigo-200 px-1 py-0.2 text-[9px] font-extrabold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                v{q.version}
                              </span>
                            ) : null}
                          </div>
                          {q.ref_no && (
                            <div className="text-[11px] text-muted font-mono mt-0.5">Ref: {q.ref_no}</div>
                          )}
                        </td>

                        {/* Customer & Lead Source */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted shrink-0" />
                            <span className="truncate max-w-[160px]">{q.customer_name || "Customer"}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {leadInfo ? (
                              <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                Lead: {leadInfo.lead_no || leadInfo.organization_name || "Linked"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted">
                                Direct Quote
                              </span>
                            )}
                            {q.email && <span className="text-[11px] text-muted truncate max-w-[140px]">• {q.email}</span>}
                          </div>
                        </td>

                        {/* Subject */}
                        <td className="px-4 py-3.5 max-w-[180px] truncate text-foreground/80">
                          {q.subject || "Quotation Proposal"}
                        </td>

                        {/* Date & Validity */}
                        <td className="px-4 py-3.5 text-foreground/80">
                          <div>
                            {q.quotation_date
                              ? new Date(q.quotation_date).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "-"}
                          </div>
                          <div className="text-[11px] text-muted">
                            Valid: {q.validity_days || 15} days
                          </div>
                        </td>

                        {/* Grand Total */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="font-bold text-foreground">
                            {formatCurrencyINR(q.grand_total || 0)}
                          </div>
                          {Boolean(q.total_discount && q.total_discount > 0) && (
                            <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              Disc: -{formatCurrencyINR(q.total_discount || 0)}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                expiryInfo.isExpired
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300/40"
                                  : q.approval_status === "pending_approval" || q.status === "pending_approval"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                                  : q.approval_status === "approved"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                  : statusOpt.badgeClass
                              }`}
                            >
                              {(q.approval_status === "pending_approval" || q.status === "pending_approval") && (
                                <Clock className="h-3 w-3" />
                              )}
                              {expiryInfo.isExpired
                                ? "Expired"
                                : q.approval_status === "pending_approval" || q.status === "pending_approval"
                                ? "Pending Approval"
                                : q.status === "in_negotiation"
                                ? "In Negotiation"
                                : q.status}
                            </span>

                            {expiryInfo.isExpiringSoon && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3 w-3" /> {expiryInfo.label}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Signatory */}
                        <td className="px-4 py-3.5 text-foreground/80">
                          <div className="font-semibold text-foreground truncate max-w-[130px]">
                            {q.signatory_name || "Signatory"}
                          </div>
                          <div className="text-[11px] text-muted truncate max-w-[130px]">
                            {q.signatory_designation || "Signatory"}
                          </div>
                        </td>

                        {/* Sales Representative */}
                        <td className="px-4 py-3.5 text-foreground/80">
                          <div className="font-semibold text-foreground truncate max-w-[130px]">
                            {salesRep.name}
                          </div>
                          <div className="text-[11px] text-muted truncate max-w-[130px]">
                            {salesRep.designation}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Draft Submit */}
                            {canSubmit && (
                              <button
                                type="button"
                                title="Send for Signatory Approval"
                                disabled={isSubmitting}
                                onClick={() => setSubmitApprovalTarget(q)}
                                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-primary-hover cursor-pointer disabled:opacity-50"
                              >
                                <Send className="h-3.5 w-3.5" /> Submit
                              </button>
                            )}

                            {/* Signatory Actions */}
                            {isPending && isSignatory && (
                              <div className="flex items-center gap-1 mr-1 border-r border-border pr-1.5">
                                <button
                                  type="button"
                                  title="Approve Quotation"
                                  disabled={isApproving || isRejecting}
                                  onClick={() => setApproveTarget(q)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="h-3.5 w-3.5" /> Approve
                                </button>
                                <button
                                  type="button"
                                  title="Reject Quotation"
                                  disabled={isApproving || isRejecting}
                                  onClick={() => {
                                    setRejectTarget(q);
                                    setRejectionReason("");
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300 cursor-pointer disabled:opacity-50"
                                >
                                  <X className="h-3.5 w-3.5" /> Reject
                                </button>
                              </div>
                            )}

                            {/* Convert to Order */}
                            {q.status === "accepted" && canConvertQuotation(authUser) && (
                              <button
                                type="button"
                                title="Convert to Confirmed Order"
                                onClick={() => setConvertingQuotation(q)}
                                className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:opacity-95 cursor-pointer mr-1"
                              >
                                <ShoppingCart className="h-3.5 w-3.5" /> Convert
                              </button>
                            )}

                            {/* View / PDF */}
                            <button
                              type="button"
                              title={canViewPdf ? "View / Print PDF" : "PDF locked until signatory approves"}
                              onClick={() => {
                                if (!canViewPdf) {
                                  toast.warning("PDF preview is restricted to the assigned signatory prior to approval.");
                                  return;
                                }
                                setViewQuotation(q as unknown as LeadQuotationRecord);
                              }}
                              className={`rounded-lg p-1.5 transition cursor-pointer ${
                                canViewPdf
                                  ? "text-muted hover:bg-surface-muted hover:text-foreground"
                                  : "text-amber-500/70 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                              }`}
                            >
                              {canViewPdf ? <Eye className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-amber-500" />}
                            </button>

                            {/* Email */}
                            <button
                              type="button"
                              title={canEmail ? "Send Email" : "Email locked until approved"}
                              onClick={() => {
                                if (!canEmail) {
                                  toast.warning("Email workflow is locked until the assigned signatory approves.");
                                  return;
                                }
                                setEmailQuotation(q as unknown as LeadQuotationRecord);
                              }}
                              className={`rounded-lg p-1.5 transition cursor-pointer ${
                                canEmail
                                  ? "text-muted hover:bg-surface-muted hover:text-foreground"
                                  : "text-muted/40 cursor-not-allowed"
                              }`}
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </button>

                            {/* Extend Validity */}
                            {q.status !== "converted" && (
                              <button
                                type="button"
                                title="Extend Validity"
                                onClick={() => setExtendValidityTarget(q)}
                                className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
                              >
                                <Calendar className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Copy Quote */}
                            <Link
                              href={`${portalHome}/quotations/new?copy_from=${q._id}`}
                              title="Copy as New Quotation"
                              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Link>

                            {/* Edit Quote */}
                            {canEdit && (
                              <Link
                                href={`${portalHome}/quotations/${q._id}/edit`}
                                title="Edit Quotation"
                                className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
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

          {/* Pagination Bar */}
          <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-surface-muted/30">
            <div className="text-xs text-muted">
              Showing Page <span className="font-semibold text-foreground">{page}</span> ({quotations.length} records)
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-surface-muted disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <button
                type="button"
                disabled={quotations.length < limit}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-surface-muted disabled:opacity-40 cursor-pointer"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Responsive Card Feed View for Mobile & Tablet */
        <div className="space-y-3">
          {isLoading ? (
            <CardSkeletonFeed count={6} />
          ) : quotations.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted">
              <FileText className="mx-auto h-10 w-10 text-muted/60 mb-3" />
              <p className="font-semibold text-foreground text-sm">No Quotations Found</p>
              <p className="text-xs text-muted mt-1">Try resetting your active search or filters.</p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {quotations.map((q) => {
                const leadInfo = typeof q.lead === "object" && q.lead !== null ? q.lead : null;
                const salesRep = salesRepresentativeDisplay(q);
                const isSelected = selectedIds.has(q._id);
                const expiryInfo = getQuotationExpiryInfo(q);

                const statusOpt = STATUS_OPTIONS.find((s) => s.value === q.status) || {
                  badgeClass: "bg-slate-100 text-slate-700",
                  label: q.status,
                };

                const canViewPdf = canViewQuotationPdf(authUser, q);
                const canEmail = canEmailQuotation(q);
                const canEdit = canEditQuotation(authUser, q);

                return (
                  <div
                    key={q._id}
                    className={`rounded-2xl border transition-all p-4 space-y-3 shadow-2xs ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-border/80"
                    }`}
                  >
                    {/* Top Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(q._id)}
                          className="text-muted hover:text-foreground cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                        <Link
                          href={`${portalHome}/quotations/${q._id}`}
                          className="font-bold text-primary hover:underline text-xs"
                        >
                          {q.quotation_no}
                        </Link>
                        {q.version && q.version > 1 ? (
                          <span className="rounded bg-indigo-50 border border-indigo-200 px-1 py-0.2 text-[9px] font-extrabold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            v{q.version}
                          </span>
                        ) : null}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          expiryInfo.isExpired
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
                            : statusOpt.badgeClass
                        }`}
                      >
                        {expiryInfo.isExpired ? "Expired" : q.status}
                      </span>
                    </div>

                    {/* Customer & Subject */}
                    <div>
                      <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted shrink-0" />
                        <span className="truncate">{q.customer_name || "Customer"}</span>
                      </h4>
                      {q.subject && (
                        <p className="text-xs text-muted truncate mt-0.5">{q.subject}</p>
                      )}
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {leadInfo ? (
                          <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            Lead: {leadInfo.lead_no || leadInfo.organization_name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted">
                            Direct Quote
                          </span>
                        )}
                        {q.ref_no && <span className="text-[10px] font-mono text-muted">Ref: {q.ref_no}</span>}
                      </div>
                    </div>

                    {/* Value & Validity Box */}
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-muted/50 p-2.5 text-xs">
                      <div>
                        <span className="text-[10px] text-muted block">Grand Total</span>
                        <span className="font-bold text-foreground">{formatCurrencyINR(q.grand_total || 0)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block">Valid Until</span>
                        <span className="font-medium text-foreground">
                          {q.valid_until
                            ? new Date(q.valid_until).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                              })
                            : `${q.validity_days || 15} days`}
                        </span>
                      </div>
                    </div>

                    {/* Sales Rep / Signatory */}
                    <div className="flex items-center justify-between text-[11px] text-muted border-t border-border/60 pt-2">
                      <span className="truncate max-w-[140px]">Rep: {salesRep.name}</span>
                      <span className="truncate max-w-[140px]">Sig: {q.signatory_name || "Signatory"}</span>
                    </div>

                    {/* Card Actions Bar */}
                    <div className="flex items-center justify-end gap-1.5 border-t border-border/60 pt-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!canViewPdf) {
                            toast.warning("PDF preview is restricted to the assigned signatory prior to approval.");
                            return;
                          }
                          setViewQuotation(q as unknown as LeadQuotationRecord);
                        }}
                        className="rounded-lg border border-border p-1.5 text-muted hover:text-foreground cursor-pointer"
                        title="View PDF"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>

                      {canEmail && (
                        <button
                          type="button"
                          onClick={() => setEmailQuotation(q as unknown as LeadQuotationRecord)}
                          className="rounded-lg border border-border p-1.5 text-muted hover:text-foreground cursor-pointer"
                          title="Send Email"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {q.status !== "converted" && (
                        <button
                          type="button"
                          onClick={() => setExtendValidityTarget(q)}
                          className="rounded-lg border border-border p-1.5 text-muted hover:text-foreground cursor-pointer"
                          title="Extend Validity"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <Link
                        href={`${portalHome}/quotations/new?copy_from=${q._id}`}
                        className="rounded-lg border border-border p-1.5 text-muted hover:text-foreground cursor-pointer"
                        title="Copy Quotation"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Link>

                      {canEdit && (
                        <Link
                          href={`${portalHome}/quotations/${q._id}/edit`}
                          className="rounded-lg border border-border p-1.5 text-muted hover:text-foreground cursor-pointer"
                          title="Edit Quotation"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      )}

                      <Link
                        href={`${portalHome}/quotations/${q._id}`}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-hover transition"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk Action Dock */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-in fade-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur-md">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                {selectedIds.size}
              </span>
              Selected
            </span>

            <div className="h-4 w-px bg-border" />

            <button
              type="button"
              onClick={() => {
                setExportOnlySelected(true);
                setDownloadQuotationsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export Selected
            </button>

            <button
              type="button"
              onClick={handleClearSelection}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter Drawer */}
      <QuotationFilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        validityFilter={validityFilter}
        setValidityFilter={setValidityFilter}
        leadSourceFilter={leadSourceFilter}
        setLeadSourceFilter={setLeadSourceFilter}
        minAmount={minAmount}
        setMinAmount={setMinAmount}
        maxAmount={maxAmount}
        setMaxAmount={setMaxAmount}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        signatoryFilter={signatoryFilter}
        setSignatoryFilter={setSignatoryFilter}
        salesRepFilter={salesRepFilter}
        setSalesRepFilter={setSalesRepFilter}
        signatories={availableSignatories}
        salesReps={availableSalesReps}
        onClear={handleClearFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* Modal: View Quotation */}
      <QuotationViewModal
        open={Boolean(viewQuotation)}
        quotation={viewQuotation}
        onClose={() => setViewQuotation(null)}
        portalLabel={portalLabel}
      />

      {/* Modal: Send Email */}
      <SendQuotationEmailModal
        open={Boolean(emailQuotation)}
        quotation={emailQuotation}
        lead={
          emailQuotation?.lead && typeof emailQuotation.lead === "object"
            ? (emailQuotation.lead as LeadRecord)
            : null
        }
        onClose={() => setEmailQuotation(null)}
        onSuccess={() => refetch()}
      />

      {/* Modal: Submit for Approval Confirmation */}
      {submitApprovalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Send className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-foreground">
                  Submit Quotation for Approval?
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Send this quotation to the assigned signatory for formal review and digital signature authorization.
                </p>

                <div className="mt-3.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-medium">Quotation #:</span>
                    <span className="font-bold text-foreground font-mono">
                      {submitApprovalTarget.quotation_no}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-medium">Customer:</span>
                    <span className="font-semibold text-foreground truncate max-w-[200px]">
                      {submitApprovalTarget.customer_name || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-medium">Grand Total:</span>
                    <span className="font-bold text-primary">
                      {formatCurrencyINR(submitApprovalTarget.grand_total || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSubmitApprovalTarget(null)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitForApproval}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                {isSubmitting ? "Submitting..." : "Submit for Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Signatory Approve Confirmation */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-foreground">
                  Approve Quotation?
                </h3>
                <p className="mt-1 text-xs text-muted">
                  By approving, you authorize this proposal as designated signatory. The official letterhead PDF and email delivery will be unlocked.
                </p>

                <div className="mt-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-medium">Quotation #:</span>
                    <span className="font-bold text-foreground font-mono">
                      {approveTarget.quotation_no}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-medium">Grand Total:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyINR(approveTarget.grand_total || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                {isApproving ? "Approving..." : "Confirm & Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Signatory Reject Confirmation */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-foreground">
                  Reject Quotation?
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Rejecting Quotation #{rejectTarget.quotation_no} will notify the sales team and mark the proposal as rejected.
                </p>

                <div className="mt-3.5">
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Rejection Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejecting this quotation..."
                    className="w-full rounded-xl border border-border bg-surface-muted/50 p-2.5 text-xs text-foreground placeholder:text-muted focus:border-rose-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectionReason("");
                }}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isRejecting || !rejectionReason.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                {isRejecting ? "Rejecting..." : "Reject Quotation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mark Customer Accepted Confirmation */}
      {acceptTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-foreground">
                  Mark Quotation as Accepted?
                </h3>
                <p className="mt-1 text-xs text-muted">
                  This confirms customer agreement for Quotation #{acceptTarget.quotation_no}. It enables order conversion and proforma invoicing.
                </p>

                <div className="mt-3.5 rounded-xl border border-teal-500/20 bg-teal-500/5 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-medium">Grand Total:</span>
                    <span className="font-bold text-teal-600 dark:text-teal-400">
                      {formatCurrencyINR(acceptTarget.grand_total || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAcceptTarget(null)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isUpdating ? "Updating..." : "Mark Accepted"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Put On Hold / Resume Confirmation */}
      {onHoldTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <PauseCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-foreground">
                  {onHoldTarget.status === "on_hold" ? "Resume Quotation?" : "Put Quotation On Hold?"}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {onHoldTarget.status === "on_hold"
                    ? `This will resume Quotation #${onHoldTarget.quotation_no} back to active sent status.`
                    : `This will place Quotation #${onHoldTarget.quotation_no} on hold temporary pause.`}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setOnHoldTarget(null)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOnHold}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
              >
                <PauseCircle className="h-3.5 w-3.5" />
                {isUpdating
                  ? "Updating..."
                  : onHoldTarget.status === "on_hold"
                  ? "Resume Quotation"
                  : "Put On Hold"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert Quotation to Order Modal */}
      {convertingQuotation && (
        <ConvertQuotationModal
          quotation={convertingQuotation as unknown as LeadQuotationRecord}
          open={Boolean(convertingQuotation)}
          onClose={() => setConvertingQuotation(null)}
          onSuccess={() => refetch()}
        />
      )}

      {/* Extend Quotation Validity Modal */}
      {extendValidityTarget && (
        <ExtendQuotationValidityModal
          quotation={extendValidityTarget as unknown as LeadQuotationRecord}
          open={Boolean(extendValidityTarget)}
          onClose={() => setExtendValidityTarget(null)}
          onSuccess={() => refetch()}
        />
      )}

      {/* Download / Export Quotations Master Modal */}
      {downloadQuotationsModalOpen && (
        <DownloadQuotationsPreviewModal
          open={downloadQuotationsModalOpen}
          onClose={() => {
            setDownloadQuotationsModalOpen(false);
            setExportOnlySelected(false);
          }}
          quotations={selectedQuotations}
        />
      )}
    </div>
  );
}
