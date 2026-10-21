/**
 * @fileoverview Comprehensive Lead Analytics & Reports Dashboard.
 * Full pipeline conversion, sales rep scorecards, monthly trends, source ROI, product demand & multi-sheet Excel export.
 * @module components/portal/shared/leads/LeadReportsDashboard
 */
"use client";

import Link from "next/link";
import React, { useState, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Layers,
  Filter,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  Download,
  Calendar,
  Package,
  Clock,
  ShoppingCart,
  Percent,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Target,
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
  useGetLeadDashboardStatsQuery,
  useGetLeadSalesFunnelQuery,
  useGetLeadSalesPerformanceQuery,
  useGetLeadSourcePerformanceQuery,
  useGetLeadMonthlyTrendsQuery,
  useGetLeadProductBreakdownQuery,
  useListUsersQuery,
  type LeadSalesPerformance,
  type LeadReportQueryParams,
  type LeadMonthlyTrend,
  type LeadProductPerformance,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { useLeadManagerTeamScope } from "@/hooks/useLeadManagerTeamScope";
import {
  formatCurrencyINR,
  canViewLeadPricing,
  isUserInLeadManagerPortal,
  getLeadManagerPortalRole,
} from "./leadUtils";
import { ExecutiveLeadDetailsModal } from "./ExecutiveLeadDetailsModal";

type Props = {
  portalHome?: string;
};

const PERIOD_OPTIONS = [
  { value: "all_time", label: "All Time (All Inquiries)" },
  { value: "this_year", label: "This Financial Year (FY 2026-27)" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_week", label: "This Week" },
  { value: "today", label: "Today" },
  { value: "custom", label: "Custom Date Range" },
];

export function LeadReportsDashboard({ portalHome = "/dashboard" }: Props) {
  const authUser = useAppSelector((state) => state.auth.user);
  const { isAdmin, isManager, isCoordinator, isExecutive, user } = useLeadManagerRole();
  const { filterByTeam, withSelfInList } = useLeadManagerTeamScope();
  const canFilterRep = isAdmin || isManager || isCoordinator;
  const isTeamLeadReports = isAdmin || isManager || isCoordinator;
  const [period, setPeriod] = useState<string>("all_time");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"funnel" | "reps" | "trends" | "sources" | "products">("funnel");
  const [detailsExecutive, setDetailsExecutive] = useState<LeadSalesPerformance | null>(null);

  const showPricing = canViewLeadPricing(authUser, portalHome);

  // Filter params
  const queryParams: LeadReportQueryParams = useMemo(() => {
    const params: LeadReportQueryParams = {};
    if (period !== "custom") {
      params.period = period;
    } else {
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
    }

    if (canFilterRep && selectedUser !== "all") {
      params.assigned_to = selectedUser;
    }
    return params;
  }, [period, startDate, endDate, selectedUser, canFilterRep]);

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
    data: stats,
    isLoading: loadingStats,
    isFetching: fetchingStats,
    refetch: refetchStats,
  } = useGetLeadDashboardStatsQuery(queryParams);

  const {
    data: funnel,
    isLoading: loadingFunnel,
    refetch: refetchFunnel,
  } = useGetLeadSalesFunnelQuery(queryParams);

  const {
    data: perfData,
    isLoading: loadingPerf,
    refetch: refetchPerf,
  } = useGetLeadSalesPerformanceQuery(queryParams);

  const {
    data: sourcePerf,
    isLoading: loadingSource,
    refetch: refetchSource,
  } = useGetLeadSourcePerformanceQuery(queryParams);

  const {
    data: trends,
    isLoading: loadingTrends,
    refetch: refetchTrends,
  } = useGetLeadMonthlyTrendsQuery(queryParams);

  const {
    data: products,
    isLoading: loadingProducts,
    refetch: refetchProducts,
  } = useGetLeadProductBreakdownQuery(queryParams);

  const handleRefreshAll = () => {
    refetchStats();
    refetchFunnel();
    refetchPerf();
    refetchSource();
    refetchTrends();
    refetchProducts();
  };

  const salesPerformance = Array.isArray(perfData) ? perfData : [];

  // Master Comprehensive Multi-Sheet Excel Workbook Export
  const handleDownloadLeadAnalyticsWorkbook = () => {
    const sheets: MultiSheetXlsxTab[] = [];

    // Sheet 1: Pipeline & Funnel Summary
    if (stats || funnel) {
      const summaryCols: ExportTableColumn[] = [
        { key: "metric", label: "Pipeline Metric" },
        { key: "count", label: "Leads Volume" },
        { key: "value", label: "Commercial Value (₹)" },
      ];
      const totalWonVal = stats?.totalWonValue ?? 0;
      const totalPipelineVal = stats?.totalPipelineValue ?? 0;
      const calcConvRate = stats?.totalLeads ? Math.round(((stats.wonLeads || 0) / stats.totalLeads) * 100) : 0;

      const summaryRows: ExportTableRow[] = [
        { metric: "Total Inquiries in Pipeline", count: stats?.totalLeads ?? 0, value: formatCurrencyINR(totalPipelineVal) },
        { metric: "New Inquiries", count: stats?.newLeads ?? 0, value: "—" },
        { metric: "Assigned Leads", count: stats?.assignedLeads ?? 0, value: "—" },
        { metric: "Follow-Up / In Progress", count: stats?.followUpLeads ?? 0, value: "—" },
        { metric: "Qualified Proposals / Quotes", count: stats?.quotationLeads ?? 0, value: "—" },
        { metric: "Won Deals", count: stats?.wonLeads ?? 0, value: formatCurrencyINR(totalWonVal) },
        { metric: "Lost Opportunities", count: stats?.lostLeads ?? 0, value: "—" },
        { metric: "Converted to Master Accounts", count: stats?.convertedLeads ?? 0, value: "—" },
        { metric: "Overall Win Rate %", count: `${stats?.win_rate ?? calcConvRate}%`, value: "—" },
        { metric: "Today Scheduled Follow-ups", count: stats?.followUpsToday ?? 0, value: "—" },
        { metric: "Overdue Follow-ups Alert", count: stats?.overdueFollowUps ?? 0, value: "—" },
      ];
      sheets.push({
        sheetName: "Pipeline Summary",
        title: `Lead Pipeline & Conversion Analytics (${period.toUpperCase().replace(/_/g, " ")})`,
        columns: summaryCols,
        rows: summaryRows,
      });
    }

    // Sheet 2: Executive Performance Breakdown
    if (salesPerformance.length > 0) {
      const repCols: ExportTableColumn[] = [
        { key: "name", label: "Sales Executive" },
        { key: "email", label: "Email" },
        { key: "department", label: "Department" },
        { key: "total_leads", label: "Total Assigned Leads" },
        { key: "qualified_leads", label: "Qualified Leads" },
        { key: "quotations", label: "Quotations Raised" },
        { key: "won_leads", label: "Won Deals" },
        { key: "won_value_fmt", label: "Won Value (₹)" },
        { key: "lost_leads", label: "Lost Deals" },
        { key: "conversion_rate_fmt", label: "Conversion Rate %" },
        { key: "pipeline_value_fmt", label: "Pipeline Value (₹)" },
        { key: "completed_followups", label: "Follow-ups Done" },
        { key: "overdue_followups", label: "Overdue Follow-ups" },
      ];
      const repRows: ExportTableRow[] = salesPerformance.map((sp) => ({
        name: sp.name || "Unassigned",
        email: sp.email || "—",
        department: sp.department || "Sales",
        total_leads: sp.total_leads || 0,
        qualified_leads: sp.qualified_leads || 0,
        quotations: sp.quotations || 0,
        won_leads: sp.won_leads || 0,
        won_value_fmt: formatCurrencyINR(sp.won_value || 0),
        lost_leads: sp.lost_leads || 0,
        conversion_rate_fmt: `${sp.conversion_rate || 0}%`,
        pipeline_value_fmt: formatCurrencyINR(sp.pipeline_value || 0),
        completed_followups: sp.completed_followups || 0,
        overdue_followups: sp.overdue_followups || 0,
      }));
      sheets.push({
        sheetName: "Sales Rep Scorecard",
        title: "Sales Team Lead Conversion Scorecard",
        columns: repCols,
        rows: repRows,
      });
    }

    // Sheet 3: Monthly Pipeline Trends
    if (trends && Array.isArray(trends) && trends.length > 0) {
      const trendCols: ExportTableColumn[] = [
        { key: "period_label", label: "Period / Month" },
        { key: "total_leads", label: "Total Inquiries" },
        { key: "pipeline_value_fmt", label: "Pipeline Value (₹)" },
        { key: "quotation_count", label: "Quotations Raised" },
        { key: "won_count", label: "Won Deals" },
        { key: "won_value_fmt", label: "Won Value (₹)" },
        { key: "converted_count", label: "Converted Accounts" },
        { key: "lost_count", label: "Lost Deals" },
      ];
      const trendRows: ExportTableRow[] = trends.map((t) => ({
        period_label: t.period_label || t.period_key,
        total_leads: t.total_leads,
        pipeline_value_fmt: formatCurrencyINR(t.pipeline_value),
        quotation_count: t.quotation_count,
        won_count: t.won_count,
        won_value_fmt: formatCurrencyINR(t.won_value),
        converted_count: t.converted_count,
        lost_count: t.lost_count,
      }));
      sheets.push({
        sheetName: "Monthly Trends",
        title: "Monthly Lead Pipeline & Conversion Trajectory",
        columns: trendCols,
        rows: trendRows,
      });
    }

    // Sheet 4: Lead Sources ROI
    if (sourcePerf && Array.isArray(sourcePerf) && sourcePerf.length > 0) {
      const srcCols: ExportTableColumn[] = [
        { key: "source_name", label: "Lead Source Channel" },
        { key: "total_leads", label: "Total Inquiries" },
        { key: "qualified_leads", label: "Qualified Leads" },
        { key: "won_leads", label: "Won Deals" },
        { key: "conversion_rate_fmt", label: "Win Rate %" },
        { key: "pipeline_value_fmt", label: "Pipeline Value (₹)" },
        { key: "won_value_fmt", label: "Won Revenue (₹)" },
      ];
      const srcRows: ExportTableRow[] = sourcePerf.map((src: any) => ({
        source_name: src.source || src.source_name || src.name || "Direct",
        total_leads: src.total_leads ?? 0,
        qualified_leads: src.qualified_leads ?? 0,
        won_leads: src.won_leads ?? 0,
        conversion_rate_fmt: `${src.conversion_rate ?? 0}%`,
        pipeline_value_fmt: formatCurrencyINR(src.pipeline_value ?? 0),
        won_value_fmt: formatCurrencyINR(src.won_value ?? 0),
      }));
      sheets.push({
        sheetName: "Lead Sources ROI",
        title: "Lead Acquisition Channels & ROI Performance",
        columns: srcCols,
        rows: srcRows,
      });
    }

    // Sheet 5: Product Demand Breakdown
    if (products && Array.isArray(products) && products.length > 0) {
      const prodCols: ExportTableColumn[] = [
        { key: "product_name", label: "Product Name" },
        { key: "unit", label: "Unit" },
        { key: "times_inquired", label: "Times Inquired" },
        { key: "total_quantity", label: "Total Quantity" },
        { key: "total_estimated_value_fmt", label: "Estimated Pipeline (₹)" },
        { key: "won_quantity", label: "Won Qty" },
        { key: "won_value_fmt", label: "Won Value (₹)" },
        { key: "converted_quantity", label: "Converted Qty" },
      ];
      const prodRows: ExportTableRow[] = products.map((p) => ({
        product_name: p.product_name,
        unit: p.unit || "Nos",
        times_inquired: p.times_inquired,
        total_quantity: p.total_quantity,
        total_estimated_value_fmt: formatCurrencyINR(p.total_estimated_value),
        won_quantity: p.won_quantity,
        won_value_fmt: formatCurrencyINR(p.won_value),
        converted_quantity: p.converted_quantity,
      }));
      sheets.push({
        sheetName: "Product Demand",
        title: "Top Inquired Products & Demand Realization",
        columns: prodCols,
        rows: prodRows,
      });
    }

    if (sheets.length === 0) {
      toast.error("No lead analytics data available to export");
      return;
    }

    downloadMultiSheetXlsx({
      filename: `leads_analytics_report_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets,
    });
    toast.success("Lead Analytics Excel Workbook downloaded!");
  };

  // Tab 1: Funnel Export
  const handleDownloadFunnelReport = () => {
    if (!funnel?.stages || funnel.stages.length === 0) {
      toast.error("No funnel stage data available to export");
      return;
    }
    const cols: ExportTableColumn[] = [
      { key: "stage", label: "Funnel Stage" },
      { key: "count", label: "Leads Count" },
      { key: "quantity", label: "Total Quantity" },
      { key: "value_fmt", label: "Estimated Value (₹)" },
      { key: "percentage", label: "Stage Yield %" },
    ];
    const rows: ExportTableRow[] = funnel.stages.map((s) => ({
      stage: s.label,
      count: s.count,
      quantity: s.quantity || 0,
      value_fmt: formatCurrencyINR(s.estimated_value),
      percentage: `${s.percentage}%`,
    }));

    downloadTableXlsx({
      filename: `lead_conversion_funnel_${period}.xlsx`,
      sheetName: "Conversion Funnel",
      title: `Lead Conversion Funnel (${period.toUpperCase().replace(/_/g, " ")})`,
      columns: cols,
      rows,
    });
    toast.success("Conversion Funnel Excel report downloaded!");
  };

  // Tab 2: Reps Scorecard Export
  const handleDownloadRepsReport = () => {
    if (salesPerformance.length === 0) {
      toast.error("No sales performance data to export");
      return;
    }
    const cols: ExportTableColumn[] = [
      { key: "name", label: "Sales Executive" },
      { key: "email", label: "Email" },
      { key: "department", label: "Department" },
      { key: "total_leads", label: "Total Leads" },
      { key: "qualified_leads", label: "Qualified" },
      { key: "won_leads", label: "Won Deals" },
      { key: "won_value_fmt", label: "Won Value (₹)" },
      { key: "win_rate_fmt", label: "Win Rate %" },
      { key: "pipeline_value_fmt", label: "Pipeline Value (₹)" },
      { key: "completed_followups", label: "Follow-ups Done" },
      { key: "overdue_followups", label: "Overdue" },
    ];
    const rows: ExportTableRow[] = salesPerformance.map((sp) => ({
      name: sp.name || "Unassigned",
      email: sp.email || "—",
      department: sp.department || "Sales",
      total_leads: sp.total_leads || 0,
      qualified_leads: sp.qualified_leads || 0,
      won_leads: sp.won_leads || 0,
      won_value_fmt: formatCurrencyINR(sp.won_value || 0),
      win_rate_fmt: `${sp.win_rate ?? sp.conversion_rate ?? 0}%`,
      pipeline_value_fmt: formatCurrencyINR(sp.pipeline_value || 0),
      completed_followups: sp.completed_followups || 0,
      overdue_followups: sp.overdue_followups || 0,
    }));

    const sheetTitle = isManager || isCoordinator ? "Team Sales Scorecard" : "Sales Rep Scorecard";
    downloadTableXlsx({
      filename: `${(isManager || isCoordinator ? "team_sales_report_" : "lead_sales_rep_scorecard_")}${period}.xlsx`,
      sheetName: sheetTitle,
      title: `${(isManager || isCoordinator ? "Team Sales Performance Scorecard" : "Sales Rep Lead Performance Scorecard")} (${period.toUpperCase().replace(/_/g, " ")})`,
      columns: cols,
      rows,
    });
    toast.success(`${sheetTitle} Excel report downloaded!`);
  };

  // Tab 3: Monthly Trends Export
  const handleDownloadTrendsReport = () => {
    if (!trends || trends.length === 0) {
      toast.error("No trend data available to export");
      return;
    }
    const cols: ExportTableColumn[] = [
      { key: "period_label", label: "Period / Month" },
      { key: "total_leads", label: "Total Inquiries" },
      { key: "pipeline_value_fmt", label: "Pipeline Value (₹)" },
      { key: "quotation_count", label: "Quotations Raised" },
      { key: "won_count", label: "Won Deals" },
      { key: "won_value_fmt", label: "Won Value (₹)" },
      { key: "converted_count", label: "Converted Accounts" },
      { key: "lost_count", label: "Lost Deals" },
    ];
    const rows: ExportTableRow[] = trends.map((t) => ({
      period_label: t.period_label || t.period_key,
      total_leads: t.total_leads,
      pipeline_value_fmt: formatCurrencyINR(t.pipeline_value),
      quotation_count: t.quotation_count,
      won_count: t.won_count,
      won_value_fmt: formatCurrencyINR(t.won_value),
      converted_count: t.converted_count,
      lost_count: t.lost_count,
    }));

    downloadTableXlsx({
      filename: `lead_monthly_trends_${period}.xlsx`,
      sheetName: "Monthly Trends",
      title: `Lead Monthly Pipeline Trends (${period.toUpperCase().replace(/_/g, " ")})`,
      columns: cols,
      rows,
    });
    toast.success("Monthly Trends Excel report downloaded!");
  };

  // Tab 4: Sources Export
  const handleDownloadSourcesReport = () => {
    if (!sourcePerf || sourcePerf.length === 0) {
      toast.error("No source performance data available to export");
      return;
    }
    const cols: ExportTableColumn[] = [
      { key: "source_name", label: "Lead Source Channel" },
      { key: "total_leads", label: "Total Inquiries" },
      { key: "qualified_leads", label: "Qualified Leads" },
      { key: "won_leads", label: "Won Deals" },
      { key: "conversion_rate_fmt", label: "Win Rate %" },
      { key: "pipeline_value_fmt", label: "Pipeline Value (₹)" },
      { key: "won_value_fmt", label: "Won Revenue (₹)" },
    ];
    const rows: ExportTableRow[] = sourcePerf.map((src: any) => ({
      source_name: src.source || src.source_name || "Direct",
      total_leads: src.total_leads ?? 0,
      qualified_leads: src.qualified_leads ?? 0,
      won_leads: src.won_leads ?? 0,
      conversion_rate_fmt: `${src.conversion_rate ?? 0}%`,
      pipeline_value_fmt: formatCurrencyINR(src.pipeline_value ?? 0),
      won_value_fmt: formatCurrencyINR(src.won_value ?? 0),
    }));

    downloadTableXlsx({
      filename: `lead_sources_roi_${period}.xlsx`,
      sheetName: "Source ROI",
      title: `Lead Sources & Acquisition Yield (${period.toUpperCase().replace(/_/g, " ")})`,
      columns: cols,
      rows,
    });
    toast.success("Lead Sources Excel report downloaded!");
  };

  // Tab 5: Product Demand Export
  const handleDownloadProductReport = () => {
    if (!products || products.length === 0) {
      toast.error("No product demand data available to export");
      return;
    }
    const cols: ExportTableColumn[] = [
      { key: "product_name", label: "Product Name" },
      { key: "unit", label: "Unit" },
      { key: "times_inquired", label: "Times Inquired" },
      { key: "total_quantity", label: "Total Quantity" },
      { key: "total_estimated_value_fmt", label: "Estimated Pipeline (₹)" },
      { key: "won_quantity", label: "Won Qty" },
      { key: "won_value_fmt", label: "Won Value (₹)" },
    ];
    const rows: ExportTableRow[] = products.map((p) => ({
      product_name: p.product_name,
      unit: p.unit || "Nos",
      times_inquired: p.times_inquired,
      total_quantity: p.total_quantity,
      total_estimated_value_fmt: formatCurrencyINR(p.total_estimated_value),
      won_quantity: p.won_quantity,
      won_value_fmt: formatCurrencyINR(p.won_value),
    }));

    downloadTableXlsx({
      filename: `lead_product_demand_${period}.xlsx`,
      sheetName: "Product Demand",
      title: `Top Inquired Products Demand (${period.toUpperCase().replace(/_/g, " ")})`,
      columns: cols,
      rows,
    });
    toast.success("Product Demand Excel report downloaded!");
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
                  {isAdmin || isManager || isCoordinator
                    ? "Team Sales Reports"
                    : "My Reports"}
                </h1>
                <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-primary">
                  {isAdmin
                    ? "All Leads (Global)"
                    : isManager || isCoordinator
                    ? "Team Leads (Assigned to Team)"
                    : "My Leads (Assigned & Created by Me)"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAdmin
                  ? "Global pipeline analytics across all sales reps and company inquiries."
                  : isManager || isCoordinator
                  ? "Team pipeline analytics — conversion funnel, sales rep scorecards, monthly trends, and performance for leads assigned to your team."
                  : "Personal pipeline analytics — conversion funnel, monthly trends, and performance for leads assigned to you or created by you."}
                {isTeamLeadReports ? " Quotation commercial reports live under Quote Reports in the sidebar." : ""}
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

            {canFilterRep && (
              <div className="relative">
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 cursor-pointer max-w-[180px] truncate"
                  title={isAdmin ? "Filter by assignee" : "Filter by team member"}
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
              disabled={fetchingStats}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${fetchingStats ? "animate-spin" : ""}`} />
              Refresh
            </button>

            {/* Master Excel Report Download */}
            <button
              type="button"
              onClick={handleDownloadLeadAnalyticsWorkbook}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:opacity-95 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Download Excel Report (.xlsx)
            </button>

            {/* Direct Links */}
            <Link
              href={`${portalHome}/leads`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
            >
              <FileText className="h-3.5 w-3.5" />
              All Leads
            </Link>
          </div>
        </div>
      </div>

      {/* 6 Hero KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* Active Pipeline Value */}
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white p-4.5 shadow-xs dark:border-indigo-900/30 dark:from-indigo-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Active Pipeline
            </span>
            <div className="rounded-xl bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-xl font-black text-slate-900 dark:text-white">
            {showPricing ? formatCurrencyINR(stats?.totalPipelineValue ?? 0) : `${(stats?.totalPipelineQuantity ?? 0).toLocaleString()} units`}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {stats?.totalLeads ?? 0} Inquiries ({stats?.active_pipeline?.count ?? (stats?.newLeads ?? 0) + (stats?.assignedLeads ?? 0) + (stats?.followUpLeads ?? 0) + (stats?.quotationLeads ?? 0)} Active)
          </p>
        </div>

        {/* Won Deals & Win Rate */}
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-4.5 shadow-xs dark:border-emerald-900/30 dark:from-emerald-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Won Deals
            </span>
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-xl font-black text-emerald-600 dark:text-emerald-400">
            {showPricing ? formatCurrencyINR(stats?.totalWonValue ?? 0) : `${(stats?.totalWonQuantity ?? 0).toLocaleString()} units`}
          </div>
          <p className="mt-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            {stats?.win_rate ?? 0}% Win Rate ({stats?.wonLeads ?? 0} won)
          </p>
        </div>

        {/* Converted to Accounts */}
        <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/50 to-white p-4.5 shadow-xs dark:border-teal-900/30 dark:from-teal-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
              Converted Accounts
            </span>
            <div className="rounded-xl bg-teal-100 p-2 text-teal-600 dark:bg-teal-900/50 dark:text-teal-300">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-xl font-black text-teal-600 dark:text-teal-400">
            {stats?.convertedLeads ?? 0}
          </div>
          <p className="mt-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
            {stats?.conversion_rate ?? 0}% Conversion to Client
          </p>
        </div>

        {/* In Follow-up / Quotation */}
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white p-4.5 shadow-xs dark:border-blue-900/30 dark:from-blue-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              In Follow-Up &amp; Quotes
            </span>
            <div className="rounded-xl bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-xl font-black text-blue-900 dark:text-blue-200">
            {(stats?.followUpLeads ?? 0) + (stats?.quotationLeads ?? 0)}
          </div>
          <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">
            {stats?.quotationLeads ?? 0} Quotes Raised
          </p>
        </div>

        {/* Lost Opportunities */}
        <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/50 to-white p-4.5 shadow-xs dark:border-rose-900/30 dark:from-rose-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Lost Inquiries
            </span>
            <div className="rounded-xl bg-rose-100 p-2 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-xl font-black text-rose-600 dark:text-rose-400">
            {stats?.lostLeads ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
            Closed Lost Opportunities
          </p>
        </div>

        {/* Follow-up Reminders & Alerts */}
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/50 to-white p-4.5 shadow-xs dark:border-amber-900/30 dark:from-amber-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Follow-ups Today
            </span>
            <div className="rounded-xl bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 text-xl font-black text-amber-700 dark:text-amber-400">
            {stats?.followUpsToday ?? 0}
          </div>
          <p className={`mt-1 text-[11px] font-semibold ${(stats?.overdueFollowUps ?? 0) > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-amber-700 dark:text-amber-400"}`}>
            {(stats?.overdueFollowUps ?? 0) > 0 ? `⚠ ${stats?.overdueFollowUps} Overdue` : "All on schedule"}
          </p>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
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
          {isManager || isCoordinator ? "Team Sales Scorecard" : "Sales Rep Scorecard"}
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
          onClick={() => setActiveTab("sources")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === "sources"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <Target className="h-4 w-4" />
          Lead Sources &amp; Channels
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

      {/* TAB 1: CONVERSION FUNNEL */}
      {activeTab === "funnel" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Funnel Flow Bar */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
              <div className="border-b border-slate-100 pb-4 dark:border-white/10">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  Lead Progression &amp; Conversion Funnel
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Visual journey of inquiries from initial capture through sales assignment, quotation, and customer deal closing.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {loadingFunnel ? (
                  <div className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
                    Loading conversion funnel...
                  </div>
                ) : !funnel?.stages || funnel.stages.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    No conversion funnel data in this period.
                  </div>
                ) : (
                  funnel.stages.map((step, idx) => {
                    const widthPct = Math.max(14, step.percentage || 0);
                    return (
                      <div key={step.key} className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-black">
                              {idx + 1}
                            </span>
                            <span>{step.label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {step.count} Leads
                            </span>
                            {showPricing && (
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                {formatCurrencyINR(step.estimated_value)}
                              </span>
                            )}
                            <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-extrabold text-primary">
                              {step.percentage}%
                            </span>
                          </div>
                        </div>

                        {/* Bar */}
                        <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            style={{ width: `${widthPct}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                              idx === 0
                                ? "bg-blue-500"
                                : idx === 1
                                ? "bg-indigo-500"
                                : idx === 2
                                ? "bg-blue-600"
                                : idx === 3
                                ? "bg-purple-600"
                                : idx === 4
                                ? "bg-emerald-600"
                                : "bg-teal-600"
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Drop-offs & Funnel Analytics Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                Pipeline Drop-Off &amp; Leakage
              </h3>

              <div className="space-y-3">
                <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3.5 dark:border-rose-900/30 dark:bg-rose-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                      Lost Inquiries
                    </span>
                    <span className="rounded-md bg-rose-200/80 px-2 py-0.5 text-[10px] font-black text-rose-900 dark:bg-rose-900 dark:text-rose-200">
                      {funnel?.drop_offs?.lost?.count ?? stats?.lostLeads ?? 0} Leads
                    </span>
                  </div>
                  {showPricing && (
                    <div className="mt-1 text-sm font-black text-rose-700 dark:text-rose-300">
                      {formatCurrencyINR(funnel?.drop_offs?.lost?.value ?? 0)}
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                    Lost to competitors, price mismatch, or canceled requirements.
                  </p>
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3.5 dark:border-amber-900/30 dark:bg-amber-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                      Overdue Follow-ups
                    </span>
                    <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-black text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                      {stats?.overdueFollowUps ?? 0} Pending
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                    Leads with past follow-up dates requiring immediate sales attention.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-white/5 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-600 dark:text-slate-400">Overall Win Rate:</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                      {stats?.win_rate ?? 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold mt-1">
                    <span className="text-slate-600 dark:text-slate-400">Account Conversion Rate:</span>
                    <span className="font-extrabold text-teal-600 dark:text-teal-400">
                      {stats?.conversion_rate ?? 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Full Funnel Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Stage Yield &amp; Volume Metrics
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Detailed tabular breakdown of lead volumes and estimated commercial values across funnel stages
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadFunnelReport}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export Funnel Excel
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase text-slate-500 dark:border-white/5 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Funnel Stage</th>
                    <th className="px-4 py-3 text-center">Leads Count</th>
                    <th className="px-4 py-3 text-center">Quantity (Units)</th>
                    {showPricing && <th className="px-4 py-3 text-right">Estimated Value (₹)</th>}
                    <th className="px-4 py-3 text-right">Stage Yield %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {!funnel?.stages || funnel.stages.length === 0 ? (
                    <tr>
                      <td colSpan={showPricing ? 5 : 4} className="py-8 text-center text-slate-400">
                        No funnel stage records available.
                      </td>
                    </tr>
                  ) : (
                    funnel.stages.map((st) => (
                      <tr key={st.key} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                          {st.label}
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold">{st.count}</td>
                        <td className="px-4 py-3.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                          {(st.quantity || 0).toLocaleString()}
                        </td>
                        {showPricing && (
                          <td className="px-4 py-3.5 text-right font-black text-indigo-600 dark:text-indigo-400">
                            {formatCurrencyINR(st.estimated_value)}
                          </td>
                        )}
                        <td className="px-4 py-3.5 text-right font-extrabold text-slate-900 dark:text-white">
                          {st.percentage}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALES REP PERFORMANCE SCORECARD */}
      {activeTab === "reps" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {isManager || isCoordinator
                  ? "Team Sales Performance Scorecard"
                  : "Sales Executive Lead Conversion Scorecard"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Individual performance ranking, pipeline generation, deal closures, and follow-up discipline.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadRepsReport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export Scorecard Excel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase text-slate-500 dark:border-white/5 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5 text-center">Rank</th>
                  <th className="px-4 py-3.5">Sales Executive</th>
                  <th className="px-4 py-3.5 text-center">Assigned Leads</th>
                  <th className="px-4 py-3.5 text-center">Qualified</th>
                  <th className="px-4 py-3.5 text-center">Quotations</th>
                  <th className="px-4 py-3.5 text-center">Won Deals</th>
                  <th className="px-4 py-3.5 text-center">Win Rate</th>
                  {showPricing && <th className="px-4 py-3.5 text-right">Pipeline Value</th>}
                  {showPricing && <th className="px-4 py-3.5 text-right">Won Revenue</th>}
                  <th className="px-4 py-3.5 text-center">Follow-ups Done</th>
                  <th className="px-4 py-3.5 text-center">Overdue</th>
                  <th className="px-4 py-3.5 text-center">Roster</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {loadingPerf ? (
                  <tr>
                    <td colSpan={showPricing ? 12 : 10} className="py-8 text-center text-slate-400">
                      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-primary mb-2" />
                      Loading sales performance...
                    </td>
                  </tr>
                ) : salesPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={showPricing ? 12 : 10} className="py-8 text-center text-slate-400">
                      No sales performance records in this period.
                    </td>
                  </tr>
                ) : (
                  salesPerformance.map((rep, idx) => (
                    <tr key={rep.user_id || idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5 text-center font-bold">
                        {idx === 0 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-extrabold text-xs">
                            🥇
                          </span>
                        ) : idx === 1 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 font-extrabold text-xs">
                            🥈
                          </span>
                        ) : idx === 2 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700/20 text-amber-900 dark:bg-amber-950 dark:text-amber-400 font-extrabold text-xs">
                            🥉
                          </span>
                        ) : (
                          `#${idx + 1}`
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                        {rep.name || "Unassigned"}
                        <div className="text-[11px] font-normal text-slate-400">
                          {rep.email || rep.department || "Sales Team"}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-900 dark:text-white">
                        {rep.total_leads}
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-primary">
                        {rep.qualified_leads}
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                        {rep.quotations}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {rep.won_leads}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {rep.win_rate ?? rep.conversion_rate ?? 0}%
                          </span>
                          <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, rep.win_rate ?? rep.conversion_rate ?? 0)}%` }}
                              className="h-full bg-emerald-500 rounded-full"
                            />
                          </div>
                        </div>
                      </td>
                      {showPricing && (
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">
                          {formatCurrencyINR(rep.pipeline_value)}
                        </td>
                      )}
                      {showPricing && (
                        <td className="px-4 py-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrencyINR(rep.won_value)}
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {rep.completed_followups}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-rose-600 dark:text-rose-400">
                        {rep.overdue_followups > 0 ? rep.overdue_followups : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setDetailsExecutive(rep)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 text-primary" />
                          View Leads
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MONTHLY & PERIODIC TRENDS */}
      {activeTab === "trends" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Monthly Pipeline &amp; Conversion Trajectory
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Historical view of new inquiries, quotations generated, won deals, and revenue pipeline over monthly cycles.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTrendsReport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export Monthly Trends Excel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase text-slate-500 dark:border-white/5 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Month / Period</th>
                  <th className="px-4 py-3.5 text-center">New Inquiries</th>
                  {showPricing && <th className="px-4 py-3.5 text-right">Pipeline Revenue</th>}
                  <th className="px-4 py-3.5 text-center">Quotations Raised</th>
                  <th className="px-4 py-3.5 text-center">Won Deals</th>
                  {showPricing && <th className="px-4 py-3.5 text-right">Won Value</th>}
                  <th className="px-4 py-3.5 text-center">Converted Accounts</th>
                  <th className="px-4 py-3.5 text-center">Lost Deals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {loadingTrends ? (
                  <tr>
                    <td colSpan={showPricing ? 8 : 6} className="py-8 text-center text-slate-400">
                      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-primary mb-2" />
                      Loading periodic trends...
                    </td>
                  </tr>
                ) : !trends || trends.length === 0 ? (
                  <tr>
                    <td colSpan={showPricing ? 8 : 6} className="py-8 text-center text-slate-400">
                      No monthly trend records in this period.
                    </td>
                  </tr>
                ) : (
                  trends.map((t) => (
                    <tr key={t.period_key} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                        {t.period_label || t.period_key}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold">{t.total_leads}</td>
                      {showPricing && (
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-900 dark:text-white">
                          {formatCurrencyINR(t.pipeline_value)}
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                        {t.quotation_count}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {t.won_count}
                      </td>
                      {showPricing && (
                        <td className="px-4 py-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrencyINR(t.won_value)}
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-center font-bold text-teal-600 dark:text-teal-400">
                        {t.converted_count}
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-rose-600 dark:text-rose-400">
                        {t.lost_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LEAD SOURCES & CHANNELS */}
      {activeTab === "sources" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Lead Acquisition Channels &amp; ROI
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Evaluate marketing and outreach channels to measure conversion rate and won deal revenue.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadSourcesReport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export Sources Excel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase text-slate-500 dark:border-white/5 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Lead Source Channel</th>
                  <th className="px-4 py-3.5 text-center">Total Inquiries</th>
                  <th className="px-4 py-3.5 text-center">Qualified</th>
                  <th className="px-4 py-3.5 text-center">Won Deals</th>
                  <th className="px-4 py-3.5 text-center">Lost Deals</th>
                  <th className="px-4 py-3.5 text-center">Win Rate %</th>
                  <th className="px-4 py-3.5 text-center">Pipeline Quantity</th>
                  {showPricing && <th className="px-4 py-3.5 text-right">Pipeline Value</th>}
                  {showPricing && <th className="px-4 py-3.5 text-right">Won Revenue</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {loadingSource ? (
                  <tr>
                    <td colSpan={showPricing ? 9 : 7} className="py-8 text-center text-slate-400">
                      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-primary mb-2" />
                      Loading source performance...
                    </td>
                  </tr>
                ) : !sourcePerf || sourcePerf.length === 0 ? (
                  <tr>
                    <td colSpan={showPricing ? 9 : 7} className="py-8 text-center text-slate-400">
                      No lead source records available in this period.
                    </td>
                  </tr>
                ) : (
                  sourcePerf.map((src) => (
                    <tr key={src.source} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                        {src.source}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold">{src.total_leads}</td>
                      <td className="px-4 py-3.5 text-center text-primary font-semibold">
                        {src.qualified_leads}
                      </td>
                      <td className="px-4 py-3.5 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                        {src.won_leads}
                      </td>
                      <td className="px-4 py-3.5 text-center text-rose-600 dark:text-rose-400 font-semibold">
                        {src.lost_leads}
                      </td>
                      <td className="px-4 py-3.5 text-center font-extrabold text-slate-900 dark:text-white">
                        {src.conversion_rate}%
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                        {(src.pipeline_qty ?? src.pipeline_quantity ?? 0).toLocaleString()}
                      </td>
                      {showPricing && (
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">
                          {formatCurrencyINR(src.pipeline_value)}
                        </td>
                      )}
                      {showPricing && (
                        <td className="px-4 py-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrencyINR(src.won_value)}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PRODUCT & INQUIRY DEMAND */}
      {activeTab === "products" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Product Demand &amp; Revenue Breakdown
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Catalog products most frequently inquired by customers with estimated pipeline potential and closed units.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadProductReport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export Product Demand Excel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase text-slate-500 dark:border-white/5 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Product Name</th>
                  <th className="px-4 py-3.5 text-center">Unit</th>
                  <th className="px-4 py-3.5 text-center">Times Inquired</th>
                  <th className="px-4 py-3.5 text-center">Total Inquired Qty</th>
                  {showPricing && <th className="px-4 py-3.5 text-right">Estimated Pipeline (₹)</th>}
                  <th className="px-4 py-3.5 text-center">Won Qty</th>
                  {showPricing && <th className="px-4 py-3.5 text-right">Won Revenue (₹)</th>}
                  <th className="px-4 py-3.5 text-center">Converted Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {loadingProducts ? (
                  <tr>
                    <td colSpan={showPricing ? 8 : 6} className="py-8 text-center text-slate-400">
                      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-primary mb-2" />
                      Loading product demand...
                    </td>
                  </tr>
                ) : !products || products.length === 0 ? (
                  <tr>
                    <td colSpan={showPricing ? 8 : 6} className="py-8 text-center text-slate-400">
                      No product demand records in this period.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.product_name} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                        {p.product_name}
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-500">{p.unit || "Nos"}</td>
                      <td className="px-4 py-3.5 text-center font-bold">{p.times_inquired}</td>
                      <td className="px-4 py-3.5 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                        {p.total_quantity.toLocaleString()}
                      </td>
                      {showPricing && (
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-900 dark:text-white">
                          {formatCurrencyINR(p.total_estimated_value)}
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {p.won_quantity.toLocaleString()}
                      </td>
                      {showPricing && (
                        <td className="px-4 py-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrencyINR(p.won_value)}
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-center font-bold text-teal-600 dark:text-teal-400">
                        {p.converted_quantity.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Details Modal for Executive Leads Roster */}
      {detailsExecutive && (
        <ExecutiveLeadDetailsModal
          open={Boolean(detailsExecutive)}
          onClose={() => setDetailsExecutive(null)}
          executive={detailsExecutive}
          portalHome={portalHome}
        />
      )}
    </div>
  );
}
