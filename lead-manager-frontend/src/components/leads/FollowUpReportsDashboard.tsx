/**
 * @fileoverview Follow-Up Intelligence & Analytics Report Dashboard covering both Leads and Quotations.
 * @module components/leads/FollowUpReportsDashboard
 */
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  CalendarClock,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MessageSquare,
  MapPin,
  Tv,
  HelpCircle,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Users,
  TrendingUp,
  BarChart3,
  CalendarDays,
  Check,
  Building2,
  ChevronRight,
  SlidersHorizontal,
  X,
  ExternalLink,
} from "lucide-react";
import {
  useGetFollowUpAnalyticsReportQuery,
  useListUsersQuery,
  type FollowUpReportQueryParams,
  type FollowUpDetailedRecord,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { readSessionFromStorage } from "@/utils/authStorage";
import {
  isLeadAdmin,
  isLeadManagerRole,
  isLeadCoordinatorRole,
  isUserInLeadManagerPortal,
  getLeadManagerPortalRole,
  formatCurrencyINR,
  formatLeadDate,
  FOLLOWUP_TYPE_CONFIG,
} from "./leadUtils";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { useLeadManagerTeamScope } from "@/hooks/useLeadManagerTeamScope";
import { toast } from "@/lib/toast";
import { TablePaginationBar } from "@/components/portal/shared/pagination/TablePaginationBar";
import { PortalBusyOverlay } from "@/components/portal/shared/PortalBusyOverlay";
import {
  downloadTableXlsx,
  downloadMultiSheetXlsx,
  type ExportTableColumn,
  type ExportTableRow,
  type MultiSheetXlsxTab,
} from "@/components/portal/shared/exportTableDownloads";
import { DownloadFollowUpsPreviewModal } from "./DownloadFollowUpsPreviewModal";

type Props = {
  portalHome?: string;
};

const PERIOD_PRESETS = [
  { id: "this_month", label: "This Month" },
  { id: "this_week", label: "This Week" },
  { id: "today", label: "Today" },
  { id: "this_quarter", label: "This Quarter" },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom Range" },
];

const ENTITY_TABS = [
  { id: "all", label: "All Activities" },
  { id: "lead", label: "Leads Follow-ups" },
  { id: "quotation", label: "Quotation Follow-ups" },
];

export function FollowUpReportsDashboard({ portalHome = "/dashboard" }: Props) {
  const reduxUser = useAppSelector((state) => state.auth.user);
  const sessionUser = useMemo(() => (typeof window !== "undefined" ? readSessionFromStorage()?.user || null : null), []);
  const authUser = (reduxUser || sessionUser) as any;
  const { isAdmin, isManager, isCoordinator, user } = useLeadManagerRole();
  const { filterByTeam, withSelfInList } = useLeadManagerTeamScope();
  const canFilterRep = isAdmin || isManager || isCoordinator;
  const hasQuotationAccess =
    isLeadAdmin(authUser, portalHome) ||
    isLeadManagerRole(authUser, portalHome) ||
    isLeadCoordinatorRole(authUser, portalHome);

  // Available entity tabs based on quotation permission
  const availableEntityTabs = useMemo(() => {
    if (!hasQuotationAccess) {
      return [{ id: "lead", label: "My Leads Follow-ups" }];
    }
    return [
      { id: "all", label: "All Activities" },
      { id: "lead", label: "Leads Follow-ups" },
      { id: "quotation", label: "Quotation Follow-ups" },
    ];
  }, [hasQuotationAccess]);

  // Filters State
  const [period, setPeriod] = useState<string>("this_month");
  const [entityType, setEntityType] = useState<string>(() => hasQuotationAccess ? "all" : "lead");
  const [channelType, setChannelType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [repFilter, setRepFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Export Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);

  const { data: usersData } = useListUsersQuery();
  const users = (Array.isArray(usersData)
    ? usersData
    : (usersData as { data?: Array<{ _id: string; name: string; department?: string; portals?: Array<{ portal_code?: string; access_roles?: string[] }> }> })?.data || []) as Array<{ _id: string; name: string; department?: string; portals?: Array<{ portal_code?: string; access_roles?: string[] }> }>;

  const assignableUsers = useMemo(() => {
    let filtered = users.filter(isUserInLeadManagerPortal);
    if (filtered.length === 0) filtered = users;
    const scoped = filterByTeam(filtered);
    const selfRow = user?._id ? users.find((u) => String(u._id) === String(user._id)) : undefined;
    return withSelfInList(scoped, selfRow);
  }, [users, filterByTeam, withSelfInList, user]);

  const effectiveEntityType = hasQuotationAccess ? entityType : "lead";

  const queryArgs: FollowUpReportQueryParams = useMemo(() => {
    return {
      period: period !== "custom" ? period : undefined,
      from_date: period === "custom" && fromDate ? fromDate : undefined,
      to_date: period === "custom" && toDate ? toDate : undefined,
      entity_type: effectiveEntityType !== "all" ? effectiveEntityType : undefined,
      type: channelType !== "all" ? channelType : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      assigned_to: canFilterRep && repFilter !== "all" ? repFilter : undefined,
    };
  }, [period, fromDate, toDate, effectiveEntityType, channelType, statusFilter, repFilter, canFilterRep]);

  const {
    data: reportData,
    isLoading,
    isFetching,
    refetch,
  } = useGetFollowUpAnalyticsReportQuery(queryArgs);

  const summary = reportData?.summary;
  const channelBreakdown = reportData?.channel_breakdown || [];
  const outcomeBreakdown = reportData?.outcome_breakdown || [];
  const repScorecard = reportData?.rep_scorecard || [];
  const allRecords = reportData?.detailed_records || [];

  // Filter detailed records for live table
  const filteredRecords = useMemo(() => {
    if (!search.trim()) return allRecords;
    const q = search.toLowerCase();
    return allRecords.filter(
      (r) =>
        r.entity_ref_no.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        r.company_name.toLowerCase().includes(q) ||
        r.rep_name.toLowerCase().includes(q) ||
        r.outcome.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q)
    );
  }, [allRecords, search]);

  const totalFilteredCount = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / limit));
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredRecords.slice(start, start + limit);
  }, [filteredRecords, page, limit]);

  // Multi-Sheet Full Excel Workbook Export (.xlsx)
  const handleDownloadFullExcelWorkbook = () => {
    if (!reportData) {
      toast.error("No report data available to export");
      return;
    }

    const sheets: MultiSheetXlsxTab[] = [];

    // Sheet 1: Executive KPI Summary
    if (summary) {
      const summaryCols: ExportTableColumn[] = [
        { key: "metric", label: "Executive Metric" },
        { key: "value", label: "Value / Count" },
      ];
      const summaryRows: ExportTableRow[] = [
        { metric: "Total Scheduled Touchpoints", value: summary.total_followups || 0 },
        { metric: "Completed Touchpoints", value: summary.completed_count || 0 },
        { metric: "Touchpoint Execution Yield %", value: `${summary.completion_rate || 0}%` },
        { metric: "On-Time Completed Touchpoints", value: summary.on_time_completed_count || 0 },
        { metric: "On-Time Compliance Rate %", value: `${summary.on_time_rate || 0}%` },
        { metric: "Overdue Backlog Alert", value: summary.overdue_count || 0 },
        { metric: "Due Today Scheduled", value: summary.due_today_count || 0 },
        { metric: "Upcoming Scheduled", value: summary.upcoming_count || 0 },
        { metric: "Lead Qualification Follow-ups", value: summary.lead_followups_count || 0 },
        ...(hasQuotationAccess
          ? [{ metric: "Quotation Negotiation Follow-ups", value: summary.quotation_followups_count || 0 }]
          : []),
        { metric: "Cancelled Follow-ups", value: summary.cancelled_count || 0 },
        { metric: "Rescheduled Follow-ups", value: summary.rescheduled_count || 0 },
      ];
      sheets.push({
        sheetName: "Executive Summary",
        title: `Follow-Up Intelligence & Compliance Summary (${period.toUpperCase().replace(/_/g, " ")})`,
        columns: summaryCols,
        rows: summaryRows,
      });
    }

    // Sheet 2: Channel Performance
    if (channelBreakdown.length > 0) {
      const chCols: ExportTableColumn[] = [
        { key: "label", label: "Activity Channel" },
        { key: "total_count", label: "Total Scheduled" },
        { key: "completed_count", label: "Completed" },
        { key: "pending_count", label: "Pending" },
        { key: "overdue_count", label: "Overdue" },
        { key: "completion_rate_fmt", label: "Completion Rate %" },
        { key: "share_percent_fmt", label: "Channel Share %" },
      ];
      const chRows: ExportTableRow[] = channelBreakdown.map((ch) => ({
        label: ch.label,
        total_count: ch.total_count,
        completed_count: ch.completed_count,
        pending_count: ch.pending_count,
        overdue_count: ch.overdue_count,
        completion_rate_fmt: `${ch.completion_rate}%`,
        share_percent_fmt: `${ch.share_percent}%`,
      }));
      sheets.push({
        sheetName: "Channel Distribution",
        title: "Activity Distribution & Channel Completion Rates",
        columns: chCols,
        rows: chRows,
      });
    }

    // Sheet 3: Sales Rep Scorecard
    if (repScorecard.length > 0) {
      const repCols: ExportTableColumn[] = [
        { key: "name", label: "Sales Representative" },
        { key: "email", label: "Email" },
        { key: "department", label: "Department" },
        { key: "total_scheduled", label: "Total Scheduled" },
        { key: "completed", label: "Completed" },
        { key: "on_time", label: "On-Time Completed" },
        { key: "on_time_rate_fmt", label: "On-Time Rate %" },
        { key: "overdue", label: "Overdue Backlog" },
        { key: "lead_count", label: "Lead Touchpoints" },
        ...(hasQuotationAccess ? [{ key: "quotation_count", label: "Quote Touchpoints" }] : []),
      ];
      const repRows: ExportTableRow[] = repScorecard.map((r) => ({
        name: r.name,
        email: r.email,
        department: r.department,
        total_scheduled: r.total_scheduled,
        completed: r.completed,
        on_time: r.on_time,
        on_time_rate_fmt: `${r.on_time_rate}%`,
        overdue: r.overdue,
        lead_count: r.lead_count,
        ...(hasQuotationAccess ? { quotation_count: r.quotation_count } : {}),
      }));
      sheets.push({
        sheetName: "Rep Scorecard",
        title: "Sales Representative Follow-Up Activity & On-Time Compliance",
        columns: repCols,
        rows: repRows,
      });
    }

    // Sheet 4: Detailed Follow-Ups Activity Log
    if (allRecords.length > 0) {
      const detCols: ExportTableColumn[] = [
        { key: "entity_ref_no", label: "Ref No" },
        ...(hasQuotationAccess ? [{ key: "entity_type", label: "Entity Type" }] : []),
        { key: "customer_name", label: "Customer / Contact" },
        { key: "company_name", label: "Company / Clinic" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "city", label: "City" },
        { key: "rep_name", label: "Sales Rep" },
        { key: "type", label: "Channel" },
        { key: "status", label: "Status" },
        { key: "follow_up_date_fmt", label: "Scheduled Date" },
        { key: "completed_at_fmt", label: "Completed Date" },
        { key: "outcome", label: "Outcome / Result" },
        { key: "notes", label: "Discussion Notes" },
        { key: "commercial_value_fmt", label: "Commercial Value (₹)" },
      ];
      const detRows: ExportTableRow[] = allRecords.map((r) => ({
        entity_ref_no: r.entity_ref_no,
        ...(hasQuotationAccess ? { entity_type: r.entity_type === "quotation" ? "Quotation" : "Lead" } : {}),
        customer_name: r.customer_name,
        company_name: r.company_name,
        phone: r.phone,
        email: r.email,
        city: r.city,
        rep_name: r.rep_name,
        type: r.type.toUpperCase(),
        status: (r.display_status || r.status).toUpperCase().replace(/_/g, " "),
        follow_up_date_fmt: r.follow_up_date
          ? `${formatLeadDate(r.follow_up_date)}${r.follow_up_time && r.follow_up_time !== "—" ? ` ${r.follow_up_time}` : ""}`
          : "—",
        completed_at_fmt: r.completed_at ? formatLeadDate(r.completed_at) : "—",
        outcome: r.outcome,
        notes: r.notes,
        commercial_value_fmt: r.commercial_value ? formatCurrencyINR(r.commercial_value) : "₹0",
      }));
      sheets.push({
        sheetName: "Detailed Activity Log",
        title: "Master Follow-Up Touchpoints Log",
        columns: detCols,
        rows: detRows,
      });
    }

    if (sheets.length === 0) {
      toast.error("No activity data to export");
      return;
    }

    downloadMultiSheetXlsx({
      filename: `follow_ups_analytics_report_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets,
    });
    toast.success("Comprehensive Follow-Ups Excel Report downloaded!");
  };

  const clearFilters = () => {
    setPeriod("this_month");
    setEntityType("all");
    setChannelType("all");
    setStatusFilter("all");
    setRepFilter("all");
    setFromDate("");
    setToDate("");
    setSearch("");
    setPage(1);
  };

  const hasActiveFilters =
    period !== "this_month" ||
    entityType !== "all" ||
    channelType !== "all" ||
    statusFilter !== "all" ||
    repFilter !== "all" ||
    Boolean(fromDate) ||
    Boolean(toDate) ||
    Boolean(search);

  return (
    <div className="relative min-h-screen space-y-6 pb-20">
      <PortalBusyOverlay active={isFetching && !isLoading} />

      {/* Header Banner */}
      <div className="relative shrink-0 overflow-hidden rounded-2xl border border-teal-500/20 bg-gradient-to-r from-teal-500/10 via-teal-500/5 to-transparent px-6 py-4 shadow-sm">
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20 text-teal-700 dark:text-teal-300">
                <CalendarClock className="h-4 w-4" />
              </span>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Follow-Up Intelligence & Compliance Reports
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              End-to-end activity analysis, on-time compliance rates, overdue escalations, and sales rep turnaround across Leads and Quotations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 shadow-xs transition hover:bg-teal-100 dark:border-teal-500/20 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-950/70"
            >
              <Download className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              Export Activity Log (.xlsx / .csv / .pdf)
            </button>

            <button
              type="button"
              onClick={handleDownloadFullExcelWorkbook}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Download Excel Report (.xlsx)
            </button>

            <Link
              href="/dashboard/leads/follow-ups"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
              Task Calendar
            </Link>
          </div>
        </div>
      </div>

      {/* Entity Filter Tab Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-2">
        <div className="flex overflow-x-auto gap-2">
          {availableEntityTabs.map((tab) => {
            const isActive = effectiveEntityType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setEntityType(tab.id);
                  setPage(1);
                }}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "bg-teal-600 text-white shadow-xs dark:bg-teal-500"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Period Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIOD_PRESETS.map((p) => {
            const isActive = period === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPeriod(p.id);
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              showFilters || hasActiveFilters
                ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filters
            {hasActiveFilters && (
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            )}
          </button>
        </div>
      </div>

      {/* Advanced Filter Collapse Box */}
      {showFilters && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm dark:border-white/5 dark:bg-slate-950/50">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
            {/* Channel Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Activity Channel
              </label>
              <select
                value={channelType}
                onChange={(e) => {
                  setChannelType(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                <option value="all">All Channels</option>
                <option value="call">Phone Call</option>
                <option value="meeting">Meeting</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="visit">Field Visit</option>
                <option value="demo">Product Demo</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Follow-Up Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rescheduled">Rescheduled</option>
              </select>
            </div>

            {canFilterRep && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Sales Representative
                </label>
                <select
                  value={repFilter}
                  onChange={(e) => {
                    setRepFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                >
                  <option value="all">{isAdmin ? "All Representatives" : "All Team Members"}</option>
                  {assignableUsers.map((u) => {
                    const roleBadge = getLeadManagerPortalRole(u);
                    return (
                      <option key={u._id} value={u._id}>
                        {u.name} {roleBadge ? `(${roleBadge})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Custom Date Range */}
            {period === "custom" && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </>
            )}
          </div>

          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
              >
                <X className="h-3.5 w-3.5" />
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: Total Scheduled */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Scheduled
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
              <Calendar className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {(summary?.total_followups || 0).toLocaleString()}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-teal-600 dark:text-teal-400">
              {summary?.lead_followups_count || summary?.total_followups || 0} Leads
            </span>
            {hasQuotationAccess && (
              <>
                <span>•</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  {summary?.quotation_followups_count || 0} Quotes
                </span>
              </>
            )}
          </div>
        </div>

        {/* Card 2: Completed Touchpoints */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Completed Touchpoints
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {(summary?.completed_count || 0).toLocaleString()}
          </p>
          <div className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            {summary?.completion_rate || 0}% Execution Yield
          </div>
        </div>

        {/* Card 3: On-Time Compliance Rate */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              On-Time Compliance
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-teal-600 dark:text-teal-400">
            {summary?.on_time_rate || 100}%
          </p>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {summary?.on_time_completed_count || 0} completed on/before due date
          </div>
        </div>

        {/* Card 4: Overdue Backlog Alert */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-xs dark:border-rose-900/40 dark:bg-rose-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
              Overdue Backlog
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-700 dark:text-rose-400">
            {(summary?.overdue_count || 0).toLocaleString()}
          </p>
          <div className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-300">
            {summary?.overdue_count === 0 ? "✓ Zero overdue backlog" : "Requires immediate intervention"}
          </div>
        </div>

        {/* Card 5: Due Today & Upcoming */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              Today & Upcoming
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-400">
            {(summary?.due_today_count || 0).toLocaleString()}
          </p>
          <div className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-300">
            +{(summary?.upcoming_count || 0).toLocaleString()} scheduled upcoming
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid: Channel Breakdown + Outcome Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Channel Breakdown Box */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Touchpoint Channels & Execution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Breakdown of outreach channels and completion yield
              </p>
            </div>
            <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
              {channelBreakdown.length} Channels
            </span>
          </div>

          <div className="space-y-3">
            {channelBreakdown.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                No activity channels logged for this period.
              </p>
            ) : (
              channelBreakdown.map((ch) => (
                <div key={ch.type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {ch.label}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({ch.total_count} scheduled)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {ch.completed_count} done ({ch.completion_rate}%)
                      </span>
                      {ch.overdue_count > 0 && (
                        <span className="rounded-sm bg-rose-50 px-1 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                          {ch.overdue_count} overdue
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, ch.completion_rate)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Outcome Classification Box */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Follow-Up Outcomes & Feedback
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Prospect response outcomes recorded on completed follow-ups
              </p>
            </div>
            <span className="rounded-lg bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
              {outcomeBreakdown.length} Outcomes
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {outcomeBreakdown.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400 w-full">
                No completion outcomes recorded yet.
              </p>
            ) : (
              outcomeBreakdown.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs dark:border-white/5 dark:bg-slate-950/40"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {item.outcome}
                  </span>
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                    {item.count} ({item.percent}%)
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sales Representative Scorecard Table */}
      {repScorecard.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-6 py-4 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Sales Representatives Activity & On-Time Scorecard
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Individual outreach volume, completion speed, and overdue task compliance
                </p>
              </div>
              <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800 dark:bg-teal-950/30 dark:text-teal-200">
                {repScorecard.length} Executive{repScorecard.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-100 bg-slate-50 font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-slate-950/50 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3">Representative</th>
                  <th className="px-4 py-3 text-center">Total Scheduled</th>
                  <th className="px-4 py-3 text-center">Completed</th>
                  <th className="px-4 py-3 text-center">On-Time %</th>
                  <th className="px-4 py-3 text-center">Overdue Backlog</th>
                  <th className="px-4 py-3 text-center">Leads Touchpoints</th>
                  {hasQuotationAccess && (
                    <th className="px-4 py-3 text-center">Quote Touchpoints</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {repScorecard.map((rep) => (
                  <tr
                    key={rep.user_id}
                    className="transition hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {rep.name}
                      </p>
                      <p className="text-[11px] text-slate-400">{rep.email}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white">
                      {rep.total_scheduled}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                      {rep.completed} ({rep.completion_rate}%)
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-teal-600 dark:text-teal-400">
                      {rep.on_time_rate}%
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">
                      {rep.overdue > 0 ? (
                        <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                          {rep.overdue}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                      {rep.lead_count}
                    </td>
                    {hasQuotationAccess && (
                      <td className="px-4 py-3 text-center font-semibold text-purple-600 dark:text-purple-400">
                        {rep.quotation_count}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Master Follow-Ups Detailed Log Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-6 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Detailed Follow-Up Activities Log
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspect every touchpoint, scheduled time, discussion outcome, and linked commercial value
              </p>
            </div>

            <div className="relative min-w-[260px] max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by ref no, customer, rep, outcome..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-100 bg-slate-50 font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-slate-950/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Ref No</th>
                <th className="px-4 py-3">Customer / Clinic</th>
                <th className="px-4 py-3">Sales Rep</th>
                <th className="px-4 py-3 text-center">Channel</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Scheduled Date</th>
                <th className="px-4 py-3">Completed Date</th>
                <th className="px-4 py-3">Outcome / Result</th>
                <th className="px-4 py-3 text-right">Value (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                    No follow-up touchpoints match your search criteria.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r) => {
                  const isQuotation = hasQuotationAccess && r.entity_type === "quotation";
                  const targetLink = isQuotation
                    ? `/dashboard/quotations/${r.quotation_id || ""}`
                    : `/dashboard/leads/${r.lead_id || ""}`;

                  return (
                    <tr
                      key={r._id}
                      className="transition hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={targetLink}
                          className="inline-flex items-center gap-1 font-mono font-bold text-primary hover:underline"
                        >
                          {r.entity_ref_no}
                          <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                        </Link>
                        {hasQuotationAccess && (
                          <div>
                            <span
                              className={`inline-block rounded-xs px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                isQuotation
                                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                                  : "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
                              }`}
                            >
                              {isQuotation ? "Quotation" : "Lead"}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {r.customer_name}
                        </p>
                        <p className="text-[11px] text-slate-400">{r.company_name}</p>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                        {r.rep_name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 capitalize dark:bg-slate-800 dark:text-slate-300">
                          {r.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            r.display_status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : r.display_status === "overdue"
                              ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                              : r.display_status === "due_today"
                              ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              : "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                          }`}
                        >
                          {(r.display_status || r.status).toUpperCase().replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {r.follow_up_date ? formatLeadDate(r.follow_up_date) : "—"}
                        {r.follow_up_time && r.follow_up_time !== "—" && (
                          <span className="ml-1 text-[11px] text-slate-400">
                            {r.follow_up_time}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {r.completed_at ? formatLeadDate(r.completed_at) : "—"}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-slate-700 dark:text-slate-300">
                        <p className="truncate font-medium">{r.outcome}</p>
                        {r.notes && r.notes !== "—" && (
                          <p className="truncate text-[11px] text-slate-400">{r.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                        {r.commercial_value ? formatCurrencyINR(r.commercial_value) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="border-t border-slate-100 p-4 dark:border-white/10">
          <TablePaginationBar
            startEntry={totalFilteredCount === 0 ? 0 : (page - 1) * limit + 1}
            endEntry={Math.min(page * limit, totalFilteredCount)}
            totalEntries={totalFilteredCount}
            itemsPerPage={limit}
            onItemsPerPageChange={(val: number) => {
              setLimit(val);
              setPage(1);
            }}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p: number) => setPage(p)}
          />
        </div>
      </div>

      {/* Export Preview Modal */}
      {previewModalOpen && (
        <DownloadFollowUpsPreviewModal
          open={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          followUps={allRecords}
        />
      )}
    </div>
  );
}
