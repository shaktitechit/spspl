/**
 * @fileoverview Universal Quotation Master Page.
 * Accessible across Sales, Admin, Finance, and Super Admin portals.
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
import { FileSpreadsheet } from "lucide-react";

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
  { value: "converted", label: "Converted to Order", badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
  { value: "pending_approval", label: "Pending Approval", badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  { value: "approved", label: "Approved", badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
  { value: "draft", label: "Draft", badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { value: "sent", label: "Sent", badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300" },
  {
    value: "in_negotiation",
    label: "Quoted / In Negotiation",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  },
  { value: "accepted", label: "Accepted", badgeClass: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300" },
  { value: "rejected", label: "Rejected", badgeClass: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
  { value: "on_hold", label: "On Hold", badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" },
  { value: "expired", label: "Expired", badgeClass: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
];

export function ListQuotationsPage({
  portalHome = "/dashboard",
  portalLabel = "Lead Manager Portal",
}: Props) {
  void portalHome;
  // Query parameters state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 25;

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

  const quotations: QuotationRecord[] = useMemo(() => {
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

  // Metrics computation
  const metrics = useMemo(() => {
    const totalCount = quotations.length;
    const grandTotalSum = quotations.reduce((sum, q) => sum + (q.grand_total || 0), 0);
    const acceptedCount = quotations.filter((q) => q.status === "accepted").length;
    const acceptedValue = quotations
      .filter((q) => q.status === "accepted")
      .reduce((sum, q) => sum + (q.grand_total || 0), 0);
    const pendingCount = quotations.filter((q) => q.status === "draft" || q.status === "sent").length;

    return {
      totalCount,
      grandTotalSum,
      acceptedCount,
      acceptedValue,
      pendingCount,
    };
  }, [quotations]);

  return (
    <div className="w-full space-y-6 p-4 sm:p-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/20">
              <FileText className="h-5 w-5" />
            </div>
            Quotation Master
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {canManageQuotations(authUser)
              ? "View, generate, track, and manage all customer quotations across department operations."
              : "View and track quotations and proposals assigned to you as sales representative."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setDownloadQuotationsModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export Excel (.xlsx)
          </button>

          {canViewQuotations(authUser) && (
            <Link
              href={`${portalHome}/quotations/reports`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <TrendingUp className="h-4 w-4 text-primary" />
              Reports &amp; Analytics
            </Link>
          )}

          {(isAdmin(authUser as any) || isManager(authUser as any) || isCoordinator(authUser as any)) && (
            <Link
              href={`${portalHome}/quotations/terms`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <BookOpen className="h-4 w-4 text-primary" />
              Terms &amp; Conditions
            </Link>
          )}

          {canManageQuotations(authUser) && (
            <Link
              href={`${portalHome}/quotations/new`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-primary-hover transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Generate Quotation
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Quotations</span>
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{metrics.totalCount}</div>
          <p className="mt-1 text-xs text-slate-500">Active quotation documents</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Quoted Value</span>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrencyINR(metrics.grandTotalSum)}
          </div>
          <p className="mt-1 text-xs text-slate-500">Sum of all generated proposals</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Accepted Quotes</span>
            <div className="rounded-xl bg-teal-50 p-2.5 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.acceptedCount} ({formatCurrencyINR(metrics.acceptedValue)})
          </div>
          <p className="mt-1 text-xs text-slate-500">Successfully converted quotes</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending / Draft</span>
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-600 dark:text-amber-400">{metrics.pendingCount}</div>
          <p className="mt-1 text-xs text-slate-500">Awaiting customer response</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by quote #, ref #, customer, or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Status Pill Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                statusFilter === opt.value
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quotations Data Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-bold text-slate-500 dark:border-white/10 dark:bg-slate-800/50 dark:text-slate-400">
                <th className="px-5 py-3.5">Quotation / Ref</th>
                <th className="px-5 py-3.5">Customer &amp; Source</th>
                <th className="px-5 py-3.5">Subject</th>
                <th className="px-5 py-3.5">Date &amp; Validity</th>
                <th className="px-5 py-3.5 text-right">Grand Total</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Signatory</th>
                <th className="px-5 py-3.5">Sales Representative</th>
                <th className="px-5 py-3.5">Created By</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
                    Loading quotations...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-slate-500">
                    <FileText className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No Quotations Found</p>
                    <p className="text-xs text-slate-400 mt-1">Generate a new direct or lead-linked quotation to get started.</p>
                  </td>
                </tr>
              ) : (
                quotations.map((q) => {
                  const leadInfo = typeof q.lead === "object" && q.lead !== null ? q.lead : null;
                  const createdByInfo = q.created_by;
                  const salesRep = salesRepresentativeDisplay(q);

                  const statusOpt = STATUS_OPTIONS.find((s) => s.value === q.status) || {
                    badgeClass: "bg-slate-100 text-slate-700",
                    label: q.status,
                  };

                  return (
                    <tr
                      key={q._id}
                      className="group hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Quotation / Ref */}
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">
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
                          <div className="text-xs text-slate-400 font-mono">Ref: {q.ref_no}</div>
                        )}
                      </td>

                      {/* Customer & Lead Source */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          {q.customer_name || "Customer"}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {leadInfo ? (
                            <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              Lead: {leadInfo.lead_no || leadInfo.organization_name || "Linked"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              Direct Quotation
                            </span>
                          )}
                          {q.email && <span className="text-xs text-slate-400">• {q.email}</span>}
                        </div>
                      </td>

                      {/* Subject */}
                      <td className="px-5 py-4 max-w-xs truncate text-slate-700 dark:text-slate-300">
                        {q.subject || "Quotation Proposal"}
                      </td>

                      {/* Date & Validity */}
                      <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-400">
                        <div>
                          {q.quotation_date
                            ? new Date(q.quotation_date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Valid: {q.validity_days || 15} days
                        </div>
                      </td>

                      {/* Grand Total */}
                      <td className="px-5 py-4 text-right">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {formatCurrencyINR(q.grand_total || 0)}
                        </div>
                        {Boolean(q.total_discount && q.total_discount > 0) && (
                          <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            Disc: -{formatCurrencyINR(q.total_discount || 0)}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {(() => {
                          const expiryInfo = getQuotationExpiryInfo(q);
                          return (
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
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

                              {/* Expiring Soon Indicator */}
                              {expiryInfo.isExpiringSoon && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="h-3 w-3" /> {expiryInfo.label}
                                </span>
                              )}

                              {q.approval_status === "rejected" && (
                                <span className="text-[10px] text-rose-500 font-medium">
                                  Reason: {q.rejection_reason || "Rejected"}
                                </span>
                              )}
                              {q.status === "rejected" && q.lost_reason && (
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium truncate max-w-[150px]">
                                  Lost: {q.lost_reason}
                                </span>
                              )}
                              {q.next_follow_up_at && q.status !== "accepted" && q.status !== "rejected" && (
                                <div className="mt-0.5 flex items-center gap-1 text-[10px]">
                                  <Calendar className="h-3 w-3 text-blue-500" />
                                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                                    {new Date(q.next_follow_up_at).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Signatory */}
                      <td className="px-5 py-4 text-xs text-slate-700 dark:text-slate-300">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {q.signatory_name || "Authorized Signatory"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {q.signatory_designation || "Signatory"}
                        </div>
                        {q.signatory_email && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {q.signatory_email}
                          </div>
                        )}
                      </td>

                      {/* Sales Representative */}
                      <td className="px-5 py-4 text-xs text-slate-700 dark:text-slate-300">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {salesRep.name}
                        </div>
                        <div className="text-[11px] text-slate-500">{salesRep.designation}</div>
                        {salesRep.email && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {salesRep.email}
                          </div>
                        )}
                      </td>

                      {/* Created By */}
                      <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-400">
                        <div className="font-medium">{createdByInfo?.name || "System"}</div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        {(() => {
                          const isSignatory = isAssignedSignatory(authUser, q);
                          const canViewPdf = canViewQuotationPdf(authUser, q);
                          const canEmail = canEmailQuotation(q);
                          const canEdit = canEditQuotation(authUser, q);
                          const isPending = q.approval_status === "pending_approval" || q.status === "pending_approval";
                          const canSubmit = canSubmitForApproval(authUser, q as unknown as Parameters<typeof canSubmitForApproval>[1]);

                          return (
                            <div className="flex items-center justify-end gap-1">
                              {/* Draft: Send for Approval Button */}
                              {canSubmit && (
                                <button
                                  type="button"
                                  title="Send for Signatory Approval"
                                  disabled={isSubmitting}
                                  onClick={() => setSubmitApprovalTarget(q)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover cursor-pointer disabled:opacity-50 mr-1"
                                >
                                  <Send className="h-3.5 w-3.5" /> Send for Approval
                                </button>
                              )}

                              {/* Signatory Direct Approval / Rejection Buttons */}
                              {isPending && isSignatory && (
                                <div className="flex items-center gap-1 mr-1 border-r border-slate-200 dark:border-white/10 pr-1.5">
                                  <button
                                    type="button"
                                    title="Approve Quotation"
                                    disabled={isApproving || isRejecting}
                                    onClick={() => setApproveTarget(q)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
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

                              {/* Convert to Order Button - only active after client acceptance */}
                              {q.status === "accepted" && canConvertQuotation(authUser) && (
                                <button
                                  type="button"
                                  title="Convert Accepted Quotation to Confirmed Order"
                                  onClick={() => setConvertingQuotation(q)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-2 py-1 text-xs font-semibold text-white shadow-xs hover:opacity-95 cursor-pointer mr-1"
                                >
                                  <ShoppingCart className="h-3.5 w-3.5" /> Convert
                                </button>
                              )}

                              {/* Approved / Sent / On Hold: Status Action Buttons (Accept / Hold / Reject) */}
                              {(q.status === "approved" || q.status === "sent" || q.status === "on_hold") &&
                                canUpdateQuotationStatus(authUser, q) && (
                                <div className="flex items-center gap-1 mr-1 border-r border-slate-200 dark:border-white/10 pr-1.5">
                                  <button
                                    type="button"
                                    title="Mark Accepted by Customer"
                                    disabled={isUpdating}
                                    onClick={() => setAcceptTarget(q)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2 py-1 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 cursor-pointer disabled:opacity-50"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Accept
                                  </button>

                                  {q.status === "on_hold" ? (
                                    <button
                                      type="button"
                                      title="Resume Quotation"
                                      disabled={isUpdating}
                                      onClick={() => setOnHoldTarget(q)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 cursor-pointer disabled:opacity-50"
                                    >
                                      <Send className="h-3.5 w-3.5" /> Resume
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      title="Put Quotation On Hold"
                                      disabled={isUpdating}
                                      onClick={() => setOnHoldTarget(q)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 cursor-pointer disabled:opacity-50"
                                    >
                                      <PauseCircle className="h-3.5 w-3.5" /> Hold
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    title="Mark Customer Rejected"
                                    disabled={isUpdating || isRejecting}
                                    onClick={() => {
                                      setRejectTarget(q);
                                      setRejectionReason("");
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300 cursor-pointer disabled:opacity-50"
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> Reject
                                  </button>
                                </div>
                              )}

                              {/* View / PDF */}
                              <button
                                type="button"
                                title={canViewPdf ? "View / Print PDF" : "PDF view restricted until assigned signatory approves"}
                                onClick={() => {
                                  if (!canViewPdf) {
                                    toast.warning("PDF preview is restricted to the assigned signatory prior to approval. Creators can preview after approval.");
                                    return;
                                  }
                                  setViewQuotation(q as unknown as LeadQuotationRecord);
                                }}
                                className={`rounded-lg p-1.5 transition cursor-pointer ${
                                  canViewPdf
                                    ? "text-slate-500 hover:bg-primary/10 hover:text-primary"
                                    : "text-amber-500/70 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                }`}
                              >
                                {canViewPdf ? <Eye className="h-4 w-4" /> : <Lock className="h-4 w-4 text-amber-500" />}
                              </button>

                              {/* Email */}
                              <button
                                type="button"
                                title={
                                  canEmail
                                    ? "Send Email"
                                    : q.status === "accepted" || q.status === "rejected" || q.status === "expired"
                                    ? `Email sending disabled for ${q.status} quotation`
                                    : "Email locked until assigned signatory approves"
                                }
                                onClick={() => {
                                  if (!canEmail) {
                                    if (q.status === "accepted" || q.status === "rejected" || q.status === "expired") {
                                      toast.warning(`Email cannot be sent because this quotation is ${q.status}.`);
                                    } else {
                                      toast.warning("Email workflow is locked until the assigned signatory approves this quotation.");
                                    }
                                    return;
                                  }
                                  setEmailQuotation(q as unknown as LeadQuotationRecord);
                                }}
                                className={`rounded-lg p-1.5 transition cursor-pointer ${
                                  canEmail
                                    ? "text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950 dark:hover:text-emerald-400"
                                    : "text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                              >
                                <Mail className={`h-4 w-4 ${!canEmail ? "opacity-40" : ""}`} />
                              </button>

                              {/* Extend Validity */}
                              {q.status !== "converted" && (
                                <button
                                  type="button"
                                  title="Extend Quotation Validity / Restore Expired"
                                  onClick={() => setExtendValidityTarget(q)}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-400 transition cursor-pointer"
                                >
                                  <Calendar className="h-4 w-4" />
                                </button>
                              )}

                              {/* Copy Quotation */}
                              <Link
                                href={`${portalHome}/quotations/new?copy_from=${q._id}`}
                                title="Copy Quotation as New"
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400 transition cursor-pointer"
                              >
                                <Copy className="h-4 w-4" />
                              </Link>

                              {/* Edit */}
                              {canEdit ? (
                                <Link
                                  href={`${portalHome}/quotations/${q._id}/edit`}
                                  title="Edit Quotation"
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950 dark:hover:text-amber-400 cursor-pointer"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  title="Only the assigned signatory can edit approved quotations"
                                  onClick={() => toast.warning("Approved quotations can only be edited by the assigned signatory.")}
                                  className="rounded-lg p-1.5 text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <Pencil className="h-4 w-4 opacity-40" />
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-white/10">
          <div className="text-xs text-slate-500">
            Showing Page <span className="font-semibold">{page}</span> ({quotations.length} items)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              type="button"
              disabled={quotations.length < limit}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Send className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Submit Quotation for Approval?
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Are you sure you want to send this quotation to the assigned signatory for review and formal approval?
                </p>

                <div className="mt-3.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Quotation #:</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {submitApprovalTarget.quotation_no}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Customer:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                      {submitApprovalTarget.customer_name || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Grand Total:</span>
                    <span className="font-bold text-primary">
                      {formatCurrencyINR(submitApprovalTarget.grand_total || 0)}
                    </span>
                  </div>
                  {submitApprovalTarget.signatory_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Signatory:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {submitApprovalTarget.signatory_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSubmitApprovalTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitForApproval}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-md shadow-primary/20 hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                {isSubmitting ? "Submitting..." : "Submit for Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Approve Confirmation */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Approve Quotation?
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  By approving, you authorize this proposal as signatory. The official letterhead PDF and email delivery will be unlocked.
                </p>

                <div className="mt-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-xs dark:border-emerald-900/30 dark:bg-emerald-950/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Quotation #:</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {approveTarget.quotation_no}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Customer:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                      {approveTarget.customer_name || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Grand Total:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
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
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                {isApproving ? "Approving..." : "Confirm & Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reject Confirmation */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reject Quotation?
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Rejecting Quotation #{rejectTarget.quotation_no} will notify the creator and mark the proposal as rejected.
                </p>

                <div className="mt-3.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rejection Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejecting this quotation (e.g. margin too low, specs mismatch)..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
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
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isRejecting || !rejectionReason.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                {isRejecting ? "Rejecting..." : "Reject Quotation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mark Accepted Confirmation */}
      {acceptTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Mark Quotation as Accepted?
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  This will mark Quotation #{acceptTarget.quotation_no} as accepted by the customer.
                </p>

                <div className="mt-3.5 rounded-xl border border-teal-100 bg-teal-50/50 p-3 text-xs dark:border-teal-900/30 dark:bg-teal-950/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Quotation #:</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {acceptTarget.quotation_no}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Customer:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                      {acceptTarget.customer_name || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Grand Total:</span>
                    <span className="font-bold text-teal-700 dark:text-teal-300">
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
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <PauseCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {onHoldTarget.status === "on_hold" ? "Resume Quotation?" : "Put Quotation On Hold?"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {onHoldTarget.status === "on_hold"
                    ? `This will resume Quotation #${onHoldTarget.quotation_no} back to active sent status.`
                    : `This will place Quotation #${onHoldTarget.quotation_no} on hold temporary pause.`}
                </p>

                <div className="mt-3.5 rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-xs dark:border-amber-900/30 dark:bg-amber-950/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Quotation #:</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {onHoldTarget.quotation_no}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Customer:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                      {onHoldTarget.customer_name || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Grand Total:</span>
                    <span className="font-bold text-amber-700 dark:text-amber-300">
                      {formatCurrencyINR(onHoldTarget.grand_total || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setOnHoldTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOnHold}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-amber-600/20 hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
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
          onClose={() => setDownloadQuotationsModalOpen(false)}
          quotations={quotations}
        />
      )}

    </div>
  );
}
