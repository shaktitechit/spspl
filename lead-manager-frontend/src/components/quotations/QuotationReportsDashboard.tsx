/**
 * @fileoverview Comprehensive Quotation Analytics & Reports Dashboard.
 * Full end-to-end insights: Funnel conversion, Rep performance scorecard,
 * Monthly trends, Top product breakdown, Discount analysis & CSV export.
 * @module components/portal/shared/quotations/QuotationReportsDashboard
 */
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  Users,
  Layers,
  ArrowRight,
  ShoppingCart,
  Percent,
  ChevronRight,
  Sparkles,
  Clock,
  XCircle,
  Package,
  FileSpreadsheet,
} from "lucide-react";
import {
  downloadMultiSheetXlsx,
  downloadTableXlsx,
  type ExportTableColumn,
  type ExportTableRow,
  type MultiSheetXlsxTab,
} from "@/components/portal/shared/exportTableDownloads";
import { toast } from "@/lib/toast";
import {
  useGetQuotationReportSummaryQuery,
  useGetQuotationReportSalesPerformanceQuery,
  useGetQuotationReportMonthlyTrendsQuery,
  useGetQuotationReportProductBreakdownQuery,
  useGetQuotationReportFunnelQuery,
  useListUsersQuery,
  type QuotationReportQueryParams,
  type QuotationSalesPerformanceRep,
  type QuotationProductPerformance,
} from "@/store/api";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { useLeadManagerTeamScope } from "@/hooks/useLeadManagerTeamScope";
import { formatCurrencyINR } from "./quotationUtils";
import { isUserInLeadManagerPortal, getLeadManagerPortalRole } from "../leads/leadUtils";

type Props = {
  portalHome?: string;
};

const PERIOD_OPTIONS = [
  { value: "all_time", label: "All Time (All Proposals)" },
  { value: "this_year", label: "This Financial Year (FY 2026-27)" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_week", label: "This Week" },
  { value: "today", label: "Today" },
  { value: "custom", label: "Custom Date Range" },
];

export function QuotationReportsDashboard({ portalHome = "/dashboard" }: Props) {
  const { isAdmin, isManager, isCoordinator, isExecutive, user } = useLeadManagerRole();
  const canFilterRep = isAdmin || isManager || isCoordinator;
  const [period, setPeriod] = useState<string>("all_time");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"funnel" | "reps" | "trends" | "products">("funnel");

  // Filter params
  const queryParams: QuotationReportQueryParams = useMemo(() => {
    const params: QuotationReportQueryParams = {};
    if (period !== "custom") {
      params.period = period;
    } else {
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
    }

    if (canFilterRep && selectedUser !== "all") {
      params.sales_person = selectedUser;
    }
    return params;
  }, [period, startDate, endDate, selectedUser, canFilterRep]);

  const { filterByTeam, withSelfInList } = useLeadManagerTeamScope();

  // Fetch users for rep filtering (admins: all LM users; managers/coordinators: reporting downline)
  const { data: usersData } = useListUsersQuery(undefined, { skip: !canFilterRep });
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

  // RTK Query endpoints
  const {
    data: summary,
    isLoading: loadingSummary,
    isFetching: fetchingSummary,
    refetch: refetchSummary,
  } = useGetQuotationReportSummaryQuery(queryParams);

  const {
    data: performance,
    isLoading: loadingPerformance,
    refetch: refetchPerformance,
  } = useGetQuotationReportSalesPerformanceQuery(queryParams);

  const {
    data: trends,
    isLoading: loadingTrends,
    refetch: refetchTrends,
  } = useGetQuotationReportMonthlyTrendsQuery(queryParams);

  const {
    data: products,
    isLoading: loadingProducts,
    refetch: refetchProducts,
  } = useGetQuotationReportProductBreakdownQuery(queryParams);

  const {
    data: funnel,
    isLoading: loadingFunnel,
    refetch: refetchFunnel,
  } = useGetQuotationReportFunnelQuery(queryParams);

  const handleRefreshAll = () => {
    refetchSummary();
    refetchPerformance();
    refetchTrends();
    refetchProducts();
    refetchFunnel();
  };

  // Comprehensive Multi-Sheet Excel Workbook Export
  const handleDownloadFullWorkbook = () => {
    const sheets: MultiSheetXlsxTab[] = [];

    // Sheet 1: Executive Summary
    if (summary) {
      const summaryCols: ExportTableColumn[] = [
        { key: "metric", label: "Executive Metric" },
        { key: "value", label: "Value / Metric Count" },
      ];
      const summaryRows: ExportTableRow[] = [
        { metric: "Total Proposals Created", value: summary.total_quotations || 0 },
        { metric: "Active Open Pipeline Negotiations", value: summary.active_negotiations?.count || 0 },
        { metric: "Active Negotiations Value (₹)", value: formatCurrencyINR(summary.active_negotiations?.value || 0) },
        { metric: "Total Net Quoted Pipeline (₹)", value: formatCurrencyINR(summary.total_net_value || 0) },
        { metric: "Total Gross Value (₹)", value: formatCurrencyINR(summary.total_gross_value || 0) },
        { metric: "Total Commercial Discount (₹)", value: formatCurrencyINR(summary.total_discount_value || 0) },
        { metric: "Average Discount %", value: `${summary.avg_discount_percent || 0}%` },
        { metric: "Average Deal Size (₹)", value: formatCurrencyINR(summary.avg_deal_size || 0) },
        { metric: "Won Proposals Count", value: summary.won_deals?.count || 0 },
        { metric: "Won Revenue Realized (₹)", value: formatCurrencyINR(summary.won_deals?.value || 0) },
        { metric: "Commercial Win Rate %", value: `${summary.won_deals?.win_rate || 0}%` },
        { metric: "Average Won Deal Size (₹)", value: formatCurrencyINR(summary.avg_won_deal_size || 0) },
        { metric: "Converted to OPMS Orders", value: summary.converted_orders?.count || 0 },
        { metric: "Converted Orders Revenue (₹)", value: formatCurrencyINR(summary.converted_orders?.value || 0) },
        { metric: "Order Conversion Rate %", value: `${summary.converted_orders?.conversion_rate || 0}%` },
      ];
      sheets.push({
        sheetName: "Executive Summary",
        title: `Quotation Commercial Intelligence Summary (${period.toUpperCase().replace(/_/g, " ")})`,
        columns: summaryCols,
        rows: summaryRows,
      });
    }

    // Sheet 2: Rep Performance Scorecard
    if (performance && performance.length > 0) {
      const repCols: ExportTableColumn[] = [
        { key: "name", label: "Sales Representative" },
        { key: "email", label: "Email" },
        { key: "department", label: "Department" },
        { key: "total_quotations", label: "Total Proposals" },
        { key: "total_quoted_value_fmt", label: "Quoted Value (₹)" },
        { key: "total_gross_value_fmt", label: "Gross Value (₹)" },
        { key: "total_discount_value_fmt", label: "Discount (₹)" },
        { key: "won_count", label: "Won Count" },
        { key: "won_value_fmt", label: "Won Value (₹)" },
        { key: "win_rate_fmt", label: "Win Rate %" },
        { key: "converted_count", label: "Converted Orders" },
        { key: "converted_value_fmt", label: "Converted Value (₹)" },
        { key: "expired_count", label: "Expired Count" },
        { key: "expired_value_fmt", label: "Expired Value (₹)" },
        { key: "avg_discount_fmt", label: "Avg Discount %" },
      ];
      const repRows: ExportTableRow[] = performance.map((r) => ({
        name: r.name,
        email: r.email,
        department: r.department,
        total_quotations: r.total_quotations,
        total_quoted_value_fmt: formatCurrencyINR(r.total_quoted_value),
        total_gross_value_fmt: formatCurrencyINR(r.total_gross_value),
        total_discount_value_fmt: formatCurrencyINR(r.total_discount_value),
        won_count: r.won_count,
        won_value_fmt: formatCurrencyINR(r.won_value),
        win_rate_fmt: `${r.win_rate}%`,
        converted_count: r.converted_count,
        converted_value_fmt: formatCurrencyINR(r.converted_value),
        expired_count: r.expired_count,
        expired_value_fmt: formatCurrencyINR(r.expired_value),
        avg_discount_fmt: `${r.avg_discount_percent}%`,
      }));
      sheets.push({
        sheetName: "Sales Reps Scorecard",
        title: "Sales Representative Commercial Scorecard",
        columns: repCols,
        rows: repRows,
      });
    }

    // Sheet 3: Top Quoted Products
    if (products && products.length > 0) {
      const prodCols: ExportTableColumn[] = [
        { key: "product_name", label: "Product Name" },
        { key: "hsn_code", label: "HSN Code" },
        { key: "unit", label: "Unit" },
        { key: "times_quoted", label: "Times Quoted" },
        { key: "total_quantity", label: "Total Qty Quoted" },
        { key: "total_quoted_value_fmt", label: "Quoted Value (₹)" },
        { key: "won_quantity", label: "Won Qty" },
        { key: "won_value_fmt", label: "Won Value (₹)" },
        { key: "converted_quantity", label: "Converted Qty" },
        { key: "converted_value_fmt", label: "Converted Value (₹)" },
        { key: "avg_unit_price_fmt", label: "Avg Unit Price (₹)" },
      ];
      const prodRows: ExportTableRow[] = products.map((p) => ({
        product_name: p.product_name,
        hsn_code: p.hsn_code || "—",
        unit: p.unit || "NOS",
        times_quoted: p.times_quoted,
        total_quantity: p.total_quantity,
        total_quoted_value_fmt: formatCurrencyINR(p.total_quoted_value),
        won_quantity: p.won_quantity,
        won_value_fmt: formatCurrencyINR(p.won_value),
        converted_quantity: p.converted_quantity,
        converted_value_fmt: formatCurrencyINR(p.converted_value),
        avg_unit_price_fmt: formatCurrencyINR(p.avg_unit_price),
      }));
      sheets.push({
        sheetName: "Product Breakdown",
        title: "Top Quoted Products & Revenue Realization",
        columns: prodCols,
        rows: prodRows,
      });
    }

    // Sheet 4: Monthly Trends
    if (trends && trends.length > 0) {
      const trendCols: ExportTableColumn[] = [
        { key: "period_label", label: "Period / Month" },
        { key: "total_quotations", label: "Total Proposals" },
        { key: "total_quoted_value_fmt", label: "Quoted Value (₹)" },
        { key: "won_count", label: "Won Count" },
        { key: "won_value_fmt", label: "Won Value (₹)" },
        { key: "converted_count", label: "Converted Orders" },
        { key: "converted_value_fmt", label: "Converted Value (₹)" },
        { key: "expired_count", label: "Expired Count" },
        { key: "expired_value_fmt", label: "Expired Value (₹)" },
      ];
      const trendRows: ExportTableRow[] = trends.map((t) => ({
        period_label: t.period_label || t.period_key || "—",
        total_quotations: t.total_quotations,
        total_quoted_value_fmt: formatCurrencyINR(t.total_quoted_value),
        won_count: t.won_count,
        won_value_fmt: formatCurrencyINR(t.won_value),
        converted_count: t.converted_count,
        converted_value_fmt: formatCurrencyINR(t.converted_value),
        expired_count: t.expired_count,
        expired_value_fmt: formatCurrencyINR(t.expired_value),
      }));
      sheets.push({
        sheetName: "Monthly Trends",
        title: "Quotation Pipeline Trends Over Time",
        columns: trendCols,
        rows: trendRows,
      });
    }

    if (sheets.length === 0) {
      toast.error("No analytics data available to export");
      return;
    }

    downloadMultiSheetXlsx({
      filename: `quotation_analytics_report_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets,
    });
    toast.success("Comprehensive Quotation Analytics Excel Workbook downloaded!");
  };

  const exportPerformanceExcel = () => {
    if (!performance || performance.length === 0) return;
    const cols: ExportTableColumn[] = [
      { key: "name", label: "Sales Representative" },
      { key: "email", label: "Email" },
      { key: "department", label: "Department" },
      { key: "total_quotations", label: "Total Proposals" },
      { key: "total_quoted_value_fmt", label: "Quoted Value (₹)" },
      { key: "total_gross_value_fmt", label: "Gross Value (₹)" },
      { key: "total_discount_value_fmt", label: "Discount (₹)" },
      { key: "won_count", label: "Won Count" },
      { key: "won_value_fmt", label: "Won Value (₹)" },
      { key: "win_rate_fmt", label: "Win Rate %" },
      { key: "converted_count", label: "Converted Orders" },
      { key: "converted_value_fmt", label: "Converted Value (₹)" },
      { key: "expired_count", label: "Expired Count" },
      { key: "expired_value_fmt", label: "Expired Value (₹)" },
      { key: "avg_discount_fmt", label: "Avg Discount %" },
    ];
    const rows: ExportTableRow[] = performance.map((r) => ({
      name: r.name,
      email: r.email,
      department: r.department,
      total_quotations: r.total_quotations,
      total_quoted_value_fmt: formatCurrencyINR(r.total_quoted_value),
      total_gross_value_fmt: formatCurrencyINR(r.total_gross_value),
      total_discount_value_fmt: formatCurrencyINR(r.total_discount_value),
      won_count: r.won_count,
      won_value_fmt: formatCurrencyINR(r.won_value),
      win_rate_fmt: `${r.win_rate}%`,
      converted_count: r.converted_count,
      converted_value_fmt: formatCurrencyINR(r.converted_value),
      expired_count: r.expired_count,
      expired_value_fmt: formatCurrencyINR(r.expired_value),
      avg_discount_fmt: `${r.avg_discount_percent}%`,
    }));

    downloadTableXlsx({
      filename: `quotation_sales_performance_${period}.xlsx`,
      sheetName: "Sales Performance",
      title: `Sales Representative Performance Scorecard (${period.toUpperCase().replace(/_/g, " ")})`,
      columns: cols,
      rows,
    });
    toast.success("Sales Performance Excel report downloaded!");
  };

  const exportProductsExcel = () => {
    if (!products || products.length === 0) return;
    const cols: ExportTableColumn[] = [
      { key: "product_name", label: "Product Name" },
      { key: "hsn_code", label: "HSN Code" },
      { key: "unit", label: "Unit" },
      { key: "times_quoted", label: "Times Quoted" },
      { key: "total_quantity", label: "Total Qty Quoted" },
      { key: "total_quoted_value_fmt", label: "Quoted Value (₹)" },
      { key: "won_quantity", label: "Won Qty" },
      { key: "won_value_fmt", label: "Won Value (₹)" },
      { key: "converted_quantity", label: "Converted Qty" },
      { key: "converted_value_fmt", label: "Converted Value (₹)" },
      { key: "avg_unit_price_fmt", label: "Avg Unit Price (₹)" },
    ];
    const rows: ExportTableRow[] = products.map((p) => ({
      product_name: p.product_name,
      hsn_code: p.hsn_code || "—",
      unit: p.unit || "NOS",
      times_quoted: p.times_quoted,
      total_quantity: p.total_quantity,
      total_quoted_value_fmt: formatCurrencyINR(p.total_quoted_value),
      won_quantity: p.won_quantity,
      won_value_fmt: formatCurrencyINR(p.won_value),
      converted_quantity: p.converted_quantity,
      converted_value_fmt: formatCurrencyINR(p.converted_value),
      avg_unit_price_fmt: formatCurrencyINR(p.avg_unit_price),
    }));

    downloadTableXlsx({
      filename: `quotation_product_breakdown_${period}.xlsx`,
      sheetName: "Product Demand",
      title: `Top Quoted Products & Revenue Realization (${period.toUpperCase().replace(/_/g, " ")})`,
      columns: cols,
      rows,
    });
    toast.success("Product Breakdown Excel report downloaded!");
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Controls */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900/60">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-md shadow-primary/20">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white">
                  Quotation Analytics &amp; Reports
                </h1>
                <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-primary">
                  {isAdmin ? "Org-wide" : isExecutive ? "My performance" : "My team"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Conversion yield, revenue pipeline, sales rep scorecards, and commercial metrics.
              </p>
            </div>
          </div>

          {/* Period & Rep Filter Toolbars */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Period Dropdown */}
            <div className="relative">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Date Inputs if Custom selected */}
            {period === "custom" && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
            )}

            {/* Sales Rep Filter */}
            {canFilterRep && (
              <div className="relative">
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 cursor-pointer max-w-[180px] truncate"
                >
                  <option value="all">{isAdmin ? "All Sales Reps" : "All Team Members"}</option>
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

            {/* Live Refresh */}
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={fetchingSummary}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${fetchingSummary ? "animate-spin" : ""}`} />
              Refresh
            </button>

            {/* Master Excel Report Download */}
            <button
              type="button"
              onClick={handleDownloadFullWorkbook}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:opacity-95 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Download Excel Report (.xlsx)
            </button>

            {/* Ledger Link */}
            <Link
              href={`${portalHome}/quotations`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
            >
              <FileText className="h-3.5 w-3.5" />
              All Quotations
            </Link>
          </div>
        </div>
      </div>

      {/* 6 Hero KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* Quoted Pipeline Value */}
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white p-4.5 shadow-xs dark:border-indigo-900/30 dark:from-indigo-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Quoted Pipeline
            </span>
            <div className="rounded-xl bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-xl font-black text-slate-900 dark:text-white">
            {formatCurrencyINR(summary?.total_net_value ?? 0)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {summary?.total_quotations ?? 0} Total Proposals ({formatCurrencyINR(summary?.total_gross_value ?? 0)} Gross)
          </p>
        </div>

        {/* Won Revenue & Win Rate */}
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-4.5 shadow-xs dark:border-emerald-900/30 dark:from-emerald-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Won Revenue
            </span>
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-xl font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrencyINR(summary?.won_deals?.value ?? 0)}
          </div>
          <p className="mt-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            {summary?.won_deals?.win_rate ?? 0}% Win Rate ({summary?.won_deals?.count ?? 0} won)
          </p>
        </div>

        {/* Converted to Orders */}
        <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/50 to-white p-4.5 shadow-xs dark:border-teal-900/30 dark:from-teal-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
              Orders Converted
            </span>
            <div className="rounded-xl bg-teal-100 p-2 text-teal-600 dark:bg-teal-900/50 dark:text-teal-300">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-xl font-black text-teal-600 dark:text-teal-400">
            {formatCurrencyINR(summary?.converted_orders?.value ?? 0)}
          </div>
          <p className="mt-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
            {summary?.converted_orders?.count ?? 0} Orders ({summary?.converted_orders?.conversion_rate ?? 0}% of won)
          </p>
        </div>

        {/* Active Negotiations */}
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white p-4.5 shadow-xs dark:border-blue-900/30 dark:from-blue-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Active In-Flight
            </span>
            <div className="rounded-xl bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-xl font-black text-blue-900 dark:text-blue-200">
            {formatCurrencyINR(summary?.active_negotiations?.value ?? 0)}
          </div>
          <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">
            {summary?.active_negotiations?.count ?? 0} Ongoing Deals
          </p>
        </div>

        {/* Expired Value Lost */}
        <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/50 to-white p-4.5 shadow-xs dark:border-rose-900/30 dark:from-rose-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Expired Lost
            </span>
            <div className="rounded-xl bg-rose-100 p-2 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-xl font-black text-rose-600 dark:text-rose-400">
            {formatCurrencyINR(summary?.status_breakdown?.expired?.value ?? 0)}
          </div>
          <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
            {summary?.status_breakdown?.expired?.count ?? 0} Proposals Expired
          </p>
        </div>

        {/* Commercial Discount */}
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/50 to-white p-4.5 shadow-xs dark:border-amber-900/30 dark:from-amber-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Avg Discount %
            </span>
            <div className="rounded-xl bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-xl font-black text-amber-700 dark:text-amber-400">
            {summary?.avg_discount_percent ?? 0}%
          </div>
          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
            -{formatCurrencyINR(summary?.total_discount_value ?? 0)} Given
          </p>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("funnel")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === "funnel"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <Layers className="h-4 w-4" />
          Conversion Funnel
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reps")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === "reps"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <Users className="h-4 w-4" />
          Sales Rep Scorecard
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("trends")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === "trends"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Periodic &amp; Monthly Trends
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === "products"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <Package className="h-4 w-4" />
          Product Demand Breakdown
        </button>
      </div>

      {/* TAB 1: STAGE CONVERSION FUNNEL */}
      {activeTab === "funnel" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Funnel Flow Bar */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
              <div className="border-b border-slate-100 pb-4 dark:border-white/10">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  Quotation Stage Conversion Funnel
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Visual journey of proposals from initial creation through signatory sign-off, client acceptance, and order conversion.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {loadingFunnel ? (
                  <div className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
                    Loading conversion funnel...
                  </div>
                ) : !funnel?.funnel || funnel.funnel.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    No conversion funnel data in this period.
                  </div>
                ) : (
                  funnel.funnel.map((step, idx) => {
                    const widthPct = Math.max(14, step.percentage || 0);
                    return (
                      <div key={step.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {idx + 1}
                            </span>
                            {step.stage} ({step.count} Quotes)
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-indigo-700 dark:text-indigo-300">
                              {formatCurrencyINR(step.value)}
                            </span>
                            <span className="rounded-md bg-indigo-50 border border-indigo-200/50 px-2 py-0.5 text-[11px] font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                              {step.percentage}%
                            </span>
                          </div>
                        </div>

                        <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            style={{ width: `${widthPct}%` }}
                            className="h-full rounded-full bg-gradient-to-r from-primary via-indigo-600 to-teal-500 transition-all duration-500"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">{step.description}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Drop-offs & Risk Highlights */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
              <div className="border-b border-slate-100 pb-3 dark:border-white/10">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  Pipeline Drop-Offs &amp; Risks
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Proposals requiring renewal, revival, or root-cause win/loss analysis.
                </p>
              </div>

              {/* Expired Proposals Box */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/30 dark:bg-rose-950/20">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-rose-600" />
                    Expired Validity
                  </div>
                  <span className="rounded-md bg-rose-200/70 px-2 py-0.5 text-xs font-black text-rose-900 dark:bg-rose-900/60 dark:text-rose-200">
                    {funnel?.drop_offs?.expired?.count ?? 0} Quotes
                  </span>
                </div>
                <div className="mt-2 text-lg font-black text-rose-900 dark:text-rose-200">
                  {formatCurrencyINR(funnel?.drop_offs?.expired?.value ?? 0)}
                </div>
                <p className="mt-1 text-[11px] text-rose-700/80 dark:text-rose-300/80">
                  Exceeded validity window. Can be restored or extended with one click.
                </p>
              </div>

              {/* Rejected Deals Box */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-slate-600" />
                    Customer Rejected
                  </div>
                  <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-black text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                    {funnel?.drop_offs?.rejected?.count ?? 0} Quotes
                  </span>
                </div>
                <div className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                  {formatCurrencyINR(funnel?.drop_offs?.rejected?.value ?? 0)}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Lost deals with captured rejection feedback notes.
                </p>
              </div>

              {/* On Hold Opportunities Box */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-600" />
                    Client On Hold
                  </div>
                  <span className="rounded-md bg-amber-200/70 px-2 py-0.5 text-xs font-black text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                    {funnel?.drop_offs?.on_hold?.count ?? 0} Quotes
                  </span>
                </div>
                <div className="mt-2 text-lg font-black text-amber-900 dark:text-amber-200">
                  {formatCurrencyINR(funnel?.drop_offs?.on_hold?.value ?? 0)}
                </div>
                <p className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-300/80">
                  Client paused discussion. Requires scheduled follow-up re-engagement.
                </p>
              </div>
            </div>
          </div>

          {/* Deal Size Metrics Banner */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Average Proposal Deal Size
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {formatCurrencyINR(summary?.avg_deal_size ?? 0)}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Average contract value across all generated quotation proposals.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-5 shadow-xs dark:border-emerald-900/30 dark:bg-emerald-950/20">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                Average Won Deal Size
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrencyINR(summary?.avg_won_deal_size ?? 0)}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Average value achieved per successfully closed customer proposal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALES REP SCORECARD */}
      {activeTab === "reps" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-white/10">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Sales Representative Performance Scorecard
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Proposals originated, won deals, order conversion yield, expired pipeline, and commercial discount discipline.
              </p>
            </div>

            <button
              type="button"
              onClick={exportPerformanceExcel}
              disabled={!performance || performance.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Export Scorecard (.xlsx)
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase text-slate-500 dark:border-white/5 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Sales Representative</th>
                  <th className="px-4 py-3.5 text-center">Total Quotes</th>
                  <th className="px-4 py-3.5 text-right">Quoted Value</th>
                  <th className="px-4 py-3.5 text-center">Won Deals</th>
                  <th className="px-4 py-3.5 text-right">Won Value</th>
                  <th className="px-4 py-3.5 text-center">Win Rate %</th>
                  <th className="px-4 py-3.5 text-center">Orders</th>
                  <th className="px-4 py-3.5 text-right">Converted Value</th>
                  <th className="px-4 py-3.5 text-center">Expired</th>
                  <th className="px-4 py-3.5 text-right">Expired Value</th>
                  <th className="px-4 py-3.5 text-center">Avg Disc %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {loadingPerformance ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
                      Loading sales performance scorecard...
                    </td>
                  </tr>
                ) : !performance || performance.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      No sales performance data found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  performance.map((rep) => (
                    <tr key={rep.email || rep.name} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white">
                        <div className="font-bold">{rep.name}</div>
                        <div className="text-[11px] font-normal text-slate-400">{rep.email}</div>
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold">{rep.total_quotations}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-indigo-700 dark:text-indigo-300">
                        {formatCurrencyINR(rep.total_quoted_value)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {rep.won_count}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyINR(rep.won_value)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                          rep.win_rate >= 50
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : rep.win_rate >= 25
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {rep.win_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-teal-600 dark:text-teal-400">
                        {rep.converted_count}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-teal-600 dark:text-teal-400">
                        {formatCurrencyINR(rep.converted_value)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-rose-600 dark:text-rose-400">
                        {rep.expired_count}
                      </td>
                      <td className="px-4 py-3.5 text-right text-rose-600 dark:text-rose-400">
                        {formatCurrencyINR(rep.expired_value)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-amber-700 dark:text-amber-400">
                        {rep.avg_discount_percent}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PERIODIC & MONTHLY TRENDS */}
      {activeTab === "trends" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="border-b border-slate-100 pb-4 dark:border-white/10">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Periodic &amp; Monthly Performance Trends
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Historical view of pipeline generation, won deals, converted orders, and expired proposals across monthly cycles.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase text-slate-500 dark:border-white/5 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Month / Period</th>
                  <th className="px-4 py-3.5 text-center">Total Generated</th>
                  <th className="px-4 py-3.5 text-right">Quoted Value</th>
                  <th className="px-4 py-3.5 text-center">Won Quotes</th>
                  <th className="px-4 py-3.5 text-right">Won Value</th>
                  <th className="px-4 py-3.5 text-center">Converted Orders</th>
                  <th className="px-4 py-3.5 text-right">Converted Value</th>
                  <th className="px-4 py-3.5 text-center">Expired Quotes</th>
                  <th className="px-4 py-3.5 text-right">Expired Value</th>
                  <th className="px-4 py-3.5 text-center">Rejected Quotes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {loadingTrends ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
                      Loading monthly trend data...
                    </td>
                  </tr>
                ) : !trends || trends.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No monthly trend data recorded yet.
                    </td>
                  </tr>
                ) : (
                  trends.map((t) => (
                    <tr key={t.period_key} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                        {t.period_label}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold">{t.total_quotations}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-indigo-700 dark:text-indigo-300">
                        {formatCurrencyINR(t.total_quoted_value)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {t.won_count}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyINR(t.won_value)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-teal-600 dark:text-teal-400">
                        {t.converted_count}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-teal-600 dark:text-teal-400">
                        {formatCurrencyINR(t.converted_value)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-rose-600 dark:text-rose-400">
                        {t.expired_count}
                      </td>
                      <td className="px-4 py-3.5 text-right text-rose-600 dark:text-rose-400">
                        {formatCurrencyINR(t.expired_value)}
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-500">
                        {t.rejected_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PRODUCT DEMAND BREAKDOWN */}
      {activeTab === "products" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-white/10">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Top Quoted Products &amp; Revenue Breakdown
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Product items sorted by commercial quotation demand, closed won volumes, and realized average pricing.
              </p>
            </div>

            <button
              type="button"
              onClick={exportProductsExcel}
              disabled={!products || products.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Export Products (.xlsx)
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase text-slate-500 dark:border-white/5 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Product Name &amp; Code</th>
                  <th className="px-4 py-3.5 text-center">Times Quoted</th>
                  <th className="px-4 py-3.5 text-center">Total Qty Quoted</th>
                  <th className="px-4 py-3.5 text-right">Quoted Value</th>
                  <th className="px-4 py-3.5 text-center">Won Qty</th>
                  <th className="px-4 py-3.5 text-right">Won Value</th>
                  <th className="px-4 py-3.5 text-center">Converted Qty</th>
                  <th className="px-4 py-3.5 text-right">Converted Value</th>
                  <th className="px-4 py-3.5 text-right">Avg Unit Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {loadingProducts ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
                      Loading product breakdown...
                    </td>
                  </tr>
                ) : !products || products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No quoted product items in this period.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.product_name} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                        <div>{p.product_name}</div>
                        {p.hsn_code && <div className="text-[10px] font-mono text-slate-400">HSN: {p.hsn_code}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold">{p.times_quoted}</td>
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-800 dark:text-slate-200">
                        {p.total_quantity.toLocaleString()} {p.unit || "NOS"}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-indigo-700 dark:text-indigo-300">
                        {formatCurrencyINR(p.total_quoted_value)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {p.won_quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyINR(p.won_value)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-teal-600 dark:text-teal-400">
                        {p.converted_quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-teal-600 dark:text-teal-400">
                        {formatCurrencyINR(p.converted_value)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-medium text-slate-900 dark:text-white">
                        {formatCurrencyINR(p.avg_unit_price)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
