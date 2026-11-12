"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  Package,
  RefreshCw,
  UserRound,
} from "lucide-react";

import MonthlyPerformanceChart from "./MonthlyPerformanceChart";
import ZoneOrderAnalytics from "./ZoneOrderAnalytics";
import ZoneAnalyticsDetailPage from "./ZoneAnalyticsDetailPage";
import CityOrderAnalytics from "./CityOrderAnalytics";
import CityAnalyticsDetailPage from "./CityAnalyticsDetailPage";
import RateTypeOrderAnalytics from "./RateTypeOrderAnalytics";
import RateTypeAnalyticsDetailPage from "./RateTypeAnalyticsDetailPage";
import SalesPersonOrderAnalytics from "./SalesPersonOrderAnalytics";
import SalesPersonAnalyticsDetailPage from "./SalesPersonAnalyticsDetailPage";
import ProductGroupOrderAnalytics from "./ProductGroupOrderAnalytics";
import ProductGroupAnalyticsDetailPage from "./ProductGroupAnalyticsDetailPage";
import PartyLeaderboard from "./PartyLeaderboard";
import ProductLeaderboard from "./ProductLeaderboard";
import ProductReportGenerator from "./ProductReportGenerator";
import ProductCrossAnalytics from "./ProductCrossAnalytics";
import SalesLeaderboard from "./SalesLeaderboard";
import FeaturedMatrixSection from "./FeaturedMatrixSection";
import PeriodFilter from "./PeriodFilter";
import SalesAnalyticsDropdown from "./SalesAnalyticsDropdown";
import { formatPeriodCaption } from "./PeriodHeadingCaption";
import { useDashboardSummary } from "./useDashboardSummary";
import { useAppSelector } from "@/store/hooks";

export type AnalyticsSubPage = "orders" | "products" | "parties" | "sales-persons";

export interface SalesAnalyticsPageProps {
  portalHome: string;
  role: "admin" | "coordinator" | "finance" | "account" | "super_admin";
  portalLabel?: string;
  subPage?: string;
  zoneId?: string;
  cityId?: string;
  rateType?: string;
  salesPersonId?: string;
  productGroupId?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  coordinator: "Coordinator",
  finance: "Finance",
  account: "Account",
  super_admin: "Super Admin",
};

const SUBPAGE_CONFIG = {
  orders: {
    id: "orders",
    label: "Order Analytics",
    icon: ClipboardList,
    title: "Order Analytics",
    subtitle:
      "Historical volume trends, monthly performance comparisons, and order fulfillment tracking.",
  },
  products: {
    id: "products",
    label: "Product Analytics",
    icon: Package,
    title: "Product Analytics",
    subtitle:
      "Product volume rankings, SKU commercial breakdown, and product group distribution.",
  },
  parties: {
    id: "parties",
    label: "Party Analytics",
    icon: Building2,
    title: "Party Analytics",
    subtitle:
      "Client & dealer ordering analytics, commercial volume rankings, and regional activity.",
  },
  "sales-persons": {
    id: "sales-persons",
    label: "Sales Person Analytics",
    icon: UserRound,
    title: "Sales Person Analytics",
    subtitle:
      "Sales executive performance rankings, target achievements, and portfolio contribution matrix.",
  },
} as const;

export default function SalesAnalyticsPage({
  portalHome,
  role,
  portalLabel,
  subPage = "orders",
  zoneId,
  cityId,
  rateType,
  salesPersonId,
  productGroupId,
}: SalesAnalyticsPageProps) {
  const router = useRouter();
  const [localZoneId, setLocalZoneId] = useState<string | null>(null);
  const selectedZoneId = zoneId || localZoneId;

  const [localCityId, setLocalCityId] = useState<string | null>(null);
  const selectedCityId = cityId || localCityId;

  const [localRateType, setLocalRateType] = useState<string | null>(null);
  const selectedRateType = rateType || localRateType;

  const [localSalesPersonId, setLocalSalesPersonId] = useState<string | null>(null);
  const selectedSalesPersonId = salesPersonId || localSalesPersonId;

  const [localProductGroupId, setLocalProductGroupId] = useState<string | null>(null);
  const selectedProductGroupId = productGroupId || localProductGroupId;

  const user = useAppSelector((state) => state.auth.user);
  const userName =
    typeof user?.name === "string" ? user.name : "Authorized User";

  const displayRole = portalLabel || ROLE_LABELS[role] || role;

  const validSubPage: AnalyticsSubPage =
    subPage in SUBPAGE_CONFIG ? (subPage as AnalyticsSubPage) : "orders";

  const activeConfig = SUBPAGE_CONFIG[validSubPage];

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

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchSummary().unwrap();
    } catch {
      // Ignore errors
    } finally {
      setIsRefreshing(false);
    }
  };

  const isAnyLoading = isSummaryFetching || isRefreshing;

  const filterCaption = useMemo(() => {
    return formatPeriodCaption(
      dateFilter,
      customDateFrom,
      customDateTo,
      selectedYears,
      selectedMonths,
    );
  }, [dateFilter, customDateFrom, customDateTo, selectedYears, selectedMonths]);

  // If a specific zone is selected, render the dedicated Zone Analytics Detail Page
  if (selectedZoneId) {
    return (
      <ZoneAnalyticsDetailPage
        zoneId={selectedZoneId}
        portalHome={portalHome}
        role={role}
        portalLabel={portalLabel}
        onBack={() => {
          setLocalZoneId(null);
          router.push(`${portalHome}/sales-analytics/orders`);
        }}
      />
    );
  }

  // If a specific city is selected, render the dedicated City Analytics Detail Page
  if (selectedCityId) {
    return (
      <CityAnalyticsDetailPage
        cityId={selectedCityId}
        portalHome={portalHome}
        role={role}
        portalLabel={portalLabel}
        onBack={() => {
          setLocalCityId(null);
          router.push(`${portalHome}/sales-analytics/orders`);
        }}
      />
    );
  }

  // If a specific rate type is selected, render the dedicated Rate Type Analytics Detail Page
  if (selectedRateType) {
    return (
      <RateTypeAnalyticsDetailPage
        rateType={selectedRateType}
        portalHome={portalHome}
        role={role}
        portalLabel={portalLabel}
        onBack={() => {
          setLocalRateType(null);
          router.push(`${portalHome}/sales-analytics/orders`);
        }}
      />
    );
  }

  // If a specific sales person is selected, render the dedicated Sales Person Analytics Detail Page
  if (selectedSalesPersonId) {
    return (
      <SalesPersonAnalyticsDetailPage
        salesPersonId={selectedSalesPersonId}
        portalHome={portalHome}
        role={role}
        portalLabel={portalLabel}
        onBack={() => {
          setLocalSalesPersonId(null);
          router.push(`${portalHome}/sales-analytics/orders`);
        }}
      />
    );
  }

  // If a specific product group is selected, render the dedicated Product Group Analytics Detail Page
  if (selectedProductGroupId) {
    return (
      <ProductGroupAnalyticsDetailPage
        productGroupId={selectedProductGroupId}
        portalHome={portalHome}
        role={role}
        portalLabel={portalLabel}
        onBack={() => {
          setLocalProductGroupId(null);
          router.push(`${portalHome}/sales-analytics/orders`);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              {activeConfig.title}
            </h1>
            <span className="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
              {displayRole} Portal
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Welcome,{" "}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {userName}
            </span>
            . {activeConfig.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SalesAnalyticsDropdown
            portalHome={portalHome}
            currentView="sales-analytics"
            currentSubPage={validSubPage}
          />

          <Link
            href={portalHome}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span>Overview Dashboard</span>
          </Link>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isAnyLoading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 text-slate-500 dark:text-slate-400 ${
                isAnyLoading ? "animate-spin" : ""
              }`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* SALES ANALYTICS NAVIGATION TABS */}
      <div className="border-b border-slate-200 dark:border-white/10">
        <nav
          className="-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto scrollbar-none"
          aria-label="Sales Analytics Pages"
        >
          {(
            Object.keys(SUBPAGE_CONFIG) as Array<keyof typeof SUBPAGE_CONFIG>
          ).map((key) => {
            const item = SUBPAGE_CONFIG[key];
            const isActive = validSubPage === key;
            const ItemIcon = item.icon;
            const href = `${portalHome}/sales-analytics/${key}`;

            return (
              <Link
                key={key}
                href={href}
                className={`group inline-flex items-center gap-2 border-b-2 py-3 px-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-white/20 dark:hover:text-slate-200"
                }`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
                      : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700"
                  }`}
                >
                  <ItemIcon className="h-4 w-4" />
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* STICKY PERIOD FILTER PANEL */}
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

      {/* ── 1. ORDER ANALYTICS PAGE ─────────────────────────────────────────── */}
      {validSubPage === "orders" && (
        <div className="space-y-6">
          <MonthlyPerformanceChart
            monthly={summary?.monthly}
            isOrdersFetching={isSummaryFetching}
            qtyBasis={qtyBasis}
          />

          <ZoneOrderAnalytics
            contributions={summary?.contributions}
            isOrdersFetching={isSummaryFetching}
            qtyBasis={qtyBasis}
            selectedYears={selectedYears}
            selectedMonths={selectedMonths}
            externalFilterCaption={filterCaption}
            portalHome={portalHome}
            dataType={dataType}
            onDataTypeChange={setDataType}
            onSelectZone={(zId) => {
              setLocalZoneId(zId);
              router.push(`${portalHome}/sales-analytics/orders/zone/${zId}`);
            }}
          />

          <CityOrderAnalytics
            contributions={summary?.contributions}
            isOrdersFetching={isSummaryFetching}
            qtyBasis={qtyBasis}
            selectedYears={selectedYears}
            selectedMonths={selectedMonths}
            externalFilterCaption={filterCaption}
            portalHome={portalHome}
            dataType={dataType}
            onDataTypeChange={setDataType}
            onSelectCity={(cId) => {
              setLocalCityId(cId);
              router.push(`${portalHome}/sales-analytics/orders/city/${encodeURIComponent(cId)}`);
            }}
          />

          <RateTypeOrderAnalytics
            contributions={summary?.contributions}
            leaderboards={summary?.leaderboards}
            isOrdersFetching={isSummaryFetching}
            qtyBasis={qtyBasis}
            selectedYears={selectedYears}
            selectedMonths={selectedMonths}
            externalFilterCaption={filterCaption}
            portalHome={portalHome}
            dataType={dataType}
            onDataTypeChange={setDataType}
            onSelectRateType={(rCode) => {
              setLocalRateType(rCode);
              router.push(`${portalHome}/sales-analytics/orders/rate-type/${encodeURIComponent(rCode)}`);
            }}
          />

          <SalesPersonOrderAnalytics
            contributions={summary?.contributions}
            leaderboards={summary?.leaderboards}
            salesUsersById={summary?.salesUsersById}
            isOrdersFetching={isSummaryFetching}
            qtyBasis={qtyBasis}
            selectedYears={selectedYears}
            selectedMonths={selectedMonths}
            externalFilterCaption={filterCaption}
            portalHome={portalHome}
            dataType={dataType}
            onDataTypeChange={setDataType}
            onSelectSalesPerson={(spId) => {
              setLocalSalesPersonId(spId);
              router.push(`${portalHome}/sales-analytics/orders/sales-person/${encodeURIComponent(spId)}`);
            }}
          />

          <ProductGroupOrderAnalytics
            contributions={summary?.contributions}
            isOrdersFetching={isSummaryFetching}
            qtyBasis={qtyBasis}
            selectedYears={selectedYears}
            selectedMonths={selectedMonths}
            externalFilterCaption={filterCaption}
            portalHome={portalHome}
            dataType={dataType}
            onDataTypeChange={setDataType}
            onSelectProductGroup={(gId) => {
              setLocalProductGroupId(gId);
              router.push(`${portalHome}/sales-analytics/orders/product-group/${encodeURIComponent(gId)}`);
            }}
          />
        </div>
      )}

      {/* ── 2. PRODUCT ANALYTICS PAGE ───────────────────────────────────────── */}
      {validSubPage === "products" && (
        <div className="space-y-6">
          <ProductReportGenerator
            leaderboardProducts={summary?.leaderboards.products}
            isOrdersFetching={isSummaryFetching}
            qtyBasis={qtyBasis}
            selectedYears={selectedYears}
            selectedMonths={selectedMonths}
            externalFilterCaption={filterCaption}
            dataType={dataType}
            onDataTypeChange={setDataType}
          />

          <ProductCrossAnalytics
            contributions={summary?.contributions}
            salesUsersById={summary?.salesUsersById}
            isOrdersFetching={isSummaryFetching}
            qtyBasis={qtyBasis}
            selectedYears={selectedYears}
            selectedMonths={selectedMonths}
            externalFilterCaption={filterCaption}
            dataType={dataType}
            onDataTypeChange={setDataType}
          />

          <ProductLeaderboard
            rows={summary?.leaderboards.products}
            isOrdersFetching={isSummaryFetching}
            externalFilterCaption={filterCaption}
            qtyBasis={qtyBasis}
            dataType={dataType}
            onDataTypeChange={setDataType}
          />

          <ProductGroupOrderAnalytics
            contributions={summary?.contributions}
            isOrdersFetching={isSummaryFetching}
            qtyBasis={qtyBasis}
            selectedYears={selectedYears}
            selectedMonths={selectedMonths}
            externalFilterCaption={filterCaption}
            portalHome={portalHome}
            dataType={dataType}
            onDataTypeChange={setDataType}
            onSelectProductGroup={(gId) => {
              setLocalProductGroupId(gId);
              router.push(`${portalHome}/sales-analytics/orders/product-group/${encodeURIComponent(gId)}`);
            }}
          />

          <FeaturedMatrixSection
            contributions={summary?.contributions}
            salesUsersById={summary?.salesUsersById}
            isOrdersFetching={isSummaryFetching}
            externalFilterCaption={filterCaption}
            qtyBasis={qtyBasis}
          />
        </div>
      )}

      {/* ── 3. PARTY ANALYTICS PAGE ─────────────────────────────────────────── */}
      {validSubPage === "parties" && (
        <div className="space-y-6">
          <PartyLeaderboard
            rows={summary?.leaderboards.parties}
            isOrdersFetching={isSummaryFetching}
            externalFilterCaption={filterCaption}
            qtyBasis={qtyBasis}
            dataType={dataType}
            onDataTypeChange={setDataType}
          />

          <FeaturedMatrixSection
            contributions={summary?.contributions}
            salesUsersById={summary?.salesUsersById}
            isOrdersFetching={isSummaryFetching}
            externalFilterCaption={filterCaption}
            qtyBasis={qtyBasis}
          />
        </div>
      )}

      {/* ── 4. SALES PERSON ANALYTICS PAGE ──────────────────────────────────── */}
      {validSubPage === "sales-persons" && (
        <div className="space-y-6">
          <SalesLeaderboard
            rows={summary?.leaderboards.salesUsers}
            isOrdersFetching={isSummaryFetching}
            externalFilterCaption={filterCaption}
            qtyBasis={qtyBasis}
            dataType={dataType}
            onDataTypeChange={setDataType}
          />

          <FeaturedMatrixSection
            contributions={summary?.contributions}
            salesUsersById={summary?.salesUsersById}
            isOrdersFetching={isSummaryFetching}
            externalFilterCaption={filterCaption}
            qtyBasis={qtyBasis}
          />
        </div>
      )}
    </div>
  );
}
