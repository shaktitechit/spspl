"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import OverviewWidgets from "@/components/portal/shared/dashboard/OverviewWidgets";
import TransportPlannerStatsWidgets from "@/components/portal/shared/transportPlanner/TransportPlannerStatsWidgets";
import MonthlyPerformanceChart from "@/components/portal/shared/dashboard/MonthlyPerformanceChart";
import PartyLeaderboard from "@/components/portal/shared/dashboard/PartyLeaderboard";
import ProductLeaderboard from "@/components/portal/shared/dashboard/ProductLeaderboard";
import SalesLeaderboard from "@/components/portal/shared/dashboard/SalesLeaderboard";
import FeaturedMatrixSection from "@/components/portal/shared/dashboard/FeaturedMatrixSection";
import { formatPeriodCaption } from "@/components/portal/shared/dashboard/PeriodHeadingCaption";
import {
  useGetTransportPlanStatsQuery,
  useGetCompanyDataQuery,
} from "@/store/api";
import { OverviewFlagsWidget } from "@/components/portal/shared/orders/components/OverviewFlagsWidget";
import { useAppSelector } from "@/store/hooks";
import {
  Building2,
  FilePlus,
  RefreshCw,
  Users,
  Package,
  ShoppingCart,
  Truck,
  ClipboardList,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  UserCheck,
  LayoutGrid,
} from "lucide-react";
import PeriodFilter from "@/components/portal/shared/dashboard/PeriodFilter";
import { useDashboardSummary } from "@/components/portal/shared/dashboard/useDashboardSummary";
import { dashboardPeriodToStatsQuery } from "@/components/portal/shared/dashboard/periodFilterUtils";
import { buildSsoLaunchUrl } from "@/lib/ssoHandoff";

const PORTAL_HOME = "/super_admin" as const;

export default function SuperAdminOverview() {
  const user = useAppSelector((state) => state.auth.user);
  const token = useAppSelector((state) => state.auth.token);
  const userName =
    typeof user?.name === "string" ? user.name : "Super Administrator";

  const {
    isFetching: isSummaryFetching,
    refetch: refetchSummary,
    summary,
    dataType,
    setDataType,
    qtyBasis,
    availableYears,
    selectedYears,
    setSelectedYears,
    selectedMonths,
    setSelectedMonths,
    dateFilter,
    setDateFilter,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
  } = useDashboardSummary();

  const {
    isFetching: isParentDataFetching,
    refetch: refetchParentData,
  } = useGetCompanyDataQuery();

  const filterCaption = useMemo(() => {
    return formatPeriodCaption(
      dateFilter,
      customDateFrom,
      customDateTo,
      selectedYears,
      selectedMonths
    );
  }, [dateFilter, customDateFrom, customDateTo, selectedYears, selectedMonths]);

  const periodStatsQuery = useMemo(
    () =>
      dashboardPeriodToStatsQuery({
        dateFilter,
        customDateFrom,
        customDateTo,
        selectedYears,
        selectedMonths,
      }),
    [dateFilter, customDateFrom, customDateTo, selectedYears, selectedMonths],
  );

  const {
    isFetching: isTransportPlanStatsFetching,
    refetch: refetchTransportPlanStats,
  } = useGetTransportPlanStatsQuery(periodStatsQuery);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchSummary().unwrap(),
        refetchTransportPlanStats().unwrap(),
        refetchParentData().unwrap(),
      ]);
    } catch {
      // Ignore errors
    } finally {
      setIsRefreshing(false);
    }
  };

  const isAnyLoading =
    isSummaryFetching ||
    isTransportPlanStatsFetching ||
    isParentDataFetching;

  const handleOpenUserManager = () => {
    const currentToken = token || "";
    if (currentToken && typeof document !== "undefined") {
      document.cookie = `access_token=${encodeURIComponent(currentToken)}; path=/; SameSite=Lax; Max-Age=${60 * 60 * 8}`;
    }
    const baseUrl = process.env.NEXT_PUBLIC_USER_MANAGER_URL || "http://localhost:7004/dashboard";
    void (async () => {
      const targetUrl = currentToken ? await buildSsoLaunchUrl(baseUrl, currentToken) : baseUrl;
      window.open(targetUrl, "_blank");
    })();
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Super Admin Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Welcome,{" "}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {userName}
            </span>{" "}
            (Super Admin). Here is the system-wide status report for today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <OverviewFlagsWidget currentDepartment="admin" variant="headerButton" />

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing || isAnyLoading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 text-slate-500 dark:text-slate-400 ${
                isRefreshing || isAnyLoading ? "animate-spin" : ""
              }`}
            />
            Refresh Console
          </button>

          <Link
            href={`${PORTAL_HOME}/create-order`}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/10 transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            <FilePlus className="h-4 w-4" />
            New Order Draft
          </Link>
        </div>
      </div>

      <div className="sticky top-[-20px] md:top-[-32px] z-[20] flex justify-end bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-sm transition-all">
        <PeriodFilter
          availableYears={availableYears}
          selectedYears={selectedYears}
          selectedMonths={selectedMonths}
          onYearsChange={setSelectedYears}
          onMonthsChange={setSelectedMonths}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          customDateFrom={customDateFrom}
          onCustomDateFromChange={setCustomDateFrom}
          customDateTo={customDateTo}
          onCustomDateToChange={setCustomDateTo}
          dataType={dataType}
          onDataTypeChange={setDataType}
        />
      </div>

      <OverviewWidgets
        tabStats={summary?.tabStats}
        queueCounts={summary?.queueCounts}
        isOrdersFetching={isSummaryFetching}
        role="super_admin"
        portalHome={PORTAL_HOME}
        selectedYears={selectedYears}
        selectedMonths={selectedMonths}
        dateFilter={dateFilter}
        customDateFrom={customDateFrom}
        customDateTo={customDateTo}
        qtyBasis={qtyBasis}
      />



      <TransportPlannerStatsWidgets
        portalHome={PORTAL_HOME}
        dateFilter={dateFilter}
        customDateFrom={customDateFrom}
        customDateTo={customDateTo}
        selectedYears={selectedYears}
        selectedMonths={selectedMonths}
      />

      <MonthlyPerformanceChart
        monthly={summary?.monthly}
        isOrdersFetching={isSummaryFetching}
        qtyBasis={qtyBasis}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ProductLeaderboard
          rows={summary?.leaderboards.products}
          isOrdersFetching={isSummaryFetching}
          externalFilterCaption={filterCaption}
          qtyBasis={qtyBasis}
        />
        <PartyLeaderboard
          rows={summary?.leaderboards.parties}
          isOrdersFetching={isSummaryFetching}
          externalFilterCaption={filterCaption}
          qtyBasis={qtyBasis}
        />
        <SalesLeaderboard
          rows={summary?.leaderboards.salesUsers}
          isOrdersFetching={isSummaryFetching}
          externalFilterCaption={filterCaption}
          qtyBasis={qtyBasis}
        />
      </div>

      <FeaturedMatrixSection
        contributions={summary?.contributions}
        isOrdersFetching={isSummaryFetching}
        externalFilterCaption={filterCaption}
        qtyBasis={qtyBasis}
      />
    </div>
  );
}
