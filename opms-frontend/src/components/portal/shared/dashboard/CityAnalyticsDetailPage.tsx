"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  MapPin,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import MonthlyPerformanceChart from "./MonthlyPerformanceChart";
import PartyBreakdownSection from "./PartyBreakdownSection";
import PeriodFilter from "./PeriodFilter";
import { formatPeriodCaption } from "./PeriodHeadingCaption";
import { useDashboardSummary } from "./useDashboardSummary";
import { downloadCsvFile, reportFilename } from "./reportDownloadUtils";
import {
  useGetPartyCityQuery,
  useListPartyCitiesQuery,
  useListPartiesQuery,
  useListOrdersQuery,
} from "@/store/api";

export interface CityAnalyticsDetailPageProps {
  cityId: string;
  portalHome: string;
  role?: "admin" | "coordinator" | "finance" | "account" | "super_admin";
  portalLabel?: string;
  onBack?: () => void;
}

const PARTY_PALETTE = [
  "#2563EB", // Blue
  "#059669", // Emerald
  "#7C3AED", // Violet
  "#D97706", // Amber
  "#DB2777", // Pink
  "#0891B2", // Cyan
  "#EA580C", // Orange
  "#4F46E5", // Indigo
  "#0D9488", // Teal
  "#65A30D", // Lime
  "#E11D48", // Rose
  "#475569", // Slate
];

function formatMoney(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function extractId(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") {
    const o = val as { _id?: unknown; id?: unknown };
    return String(o._id ?? o.id ?? "").trim();
  }
  return "";
}

function extractArray(raw: unknown): Record<string, unknown>[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (typeof raw === "object" && "data" in (raw as Record<string, unknown>)) {
    const d = (raw as Record<string, unknown>).data;
    if (Array.isArray(d)) return d as Record<string, unknown>[];
  }
  return [];
}

export default function CityAnalyticsDetailPage({
  cityId,
  portalHome,
  onBack,
}: CityAnalyticsDetailPageProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isUnspecified = cityId === "unspecified";
  const isMongoId = /^[a-f\d]{24}$/i.test(cityId);

  // 1. Fetch registered city record if valid mongoId
  const { data: cityRecord, isFetching: isCityRecordFetching } = useGetPartyCityQuery(
    cityId,
    { skip: !isMongoId },
  );

  // 2. Fetch all cities & parties
  const { data: allCitiesData, isFetching: isAllCitiesFetching } = useListPartyCitiesQuery(
    { limit: 10000, status: "active" },
  );
  const { data: allPartiesData, isFetching: isAllPartiesFetching } = useListPartiesQuery({});

  // 3. Resolve city name and party set for this city
  const { cityName, cityPartyIdSet, otherCitiesPartyIdSet } = useMemo(() => {
    const partySet = new Set<string>();
    const otherParties = new Set<string>();
    let name = isUnspecified ? "Unspecified City" : "City";

    // Recover name from pseudo ID if needed (e.g. city-mumbai -> Mumbai)
    if (cityId.startsWith("city-")) {
      name = cityId
        .replace(/^city-/, "")
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }

    // Direct match from cityRecord
    if (cityRecord?.name) {
      name = cityRecord.name;
    }

    // Match in all cities
    const citiesList = extractArray(allCitiesData);
    for (const c of citiesList) {
      const cId = extractId(c._id ?? c.id);
      if (cId === cityId && c.name) {
        name = String(c.name).trim();
        break;
      }
    }

    const targetLowerName = name.toLowerCase().trim();

    // Map parties to this city or other cities
    const partiesList = extractArray(allPartiesData);
    for (const p of partiesList) {
      const pId = extractId(p._id ?? p.id);
      if (!pId) continue;

      const pCityId = extractId(p.city_id);
      const rawCityName = String(
        p.city ||
        (p.billing_address as Record<string, unknown>)?.city ||
        (p.shipping_address as Record<string, unknown>)?.city ||
        ""
      ).trim();
      const pLowerName = rawCityName.toLowerCase();

      const isMatch = isUnspecified
        ? !pCityId && !rawCityName
        : pCityId === cityId || (targetLowerName && pLowerName === targetLowerName);

      if (isMatch) {
        partySet.add(pId);
      } else {
        otherParties.add(pId);
      }
    }

    return {
      cityName: name,
      cityPartyIdSet: partySet,
      otherCitiesPartyIdSet: otherParties,
    };
  }, [cityId, isUnspecified, cityRecord, allCitiesData, allPartiesData]);

  // 4. Period & Filter summary
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

  // 5. Orders list for monthly performance chart
  const {
    data: rawOrdersData,
    isFetching: isOrdersFetching,
    refetch: refetchOrders,
  } = useListOrdersQuery({ view: "list", limit: "2000" });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchSummary().unwrap(), refetchOrders().unwrap()]);
    } catch {
      // Ignore errors
    } finally {
      setIsRefreshing(false);
    }
  };

  const isAnyLoading =
    isSummaryFetching ||
    isOrdersFetching ||
    isCityRecordFetching ||
    isAllCitiesFetching ||
    isAllPartiesFetching ||
    isRefreshing;

  const filterCaption = useMemo(() => {
    return formatPeriodCaption(
      dateFilter,
      customDateFrom,
      customDateTo,
      selectedYears,
      selectedMonths,
    );
  }, [dateFilter, customDateFrom, customDateTo, selectedYears, selectedMonths]);

  // 6. Filter orders belonging to this city
  const cityOrders = useMemo(() => {
    const list = extractArray(rawOrdersData);
    const targetLowerName = cityName.toLowerCase().trim();

    return list.filter((order) => {
      const pId = extractId(order.party);
      if (pId && cityPartyIdSet.has(pId)) return true;

      const shipCity = String(
        (order.shipping_address as Record<string, unknown>)?.city ?? ""
      ).trim().toLowerCase();
      const billCity = String(
        (order.billing_address as Record<string, unknown>)?.city ?? ""
      ).trim().toLowerCase();

      if (isUnspecified) {
        if (!pId && !shipCity && !billCity) return true;
        if (pId && !otherCitiesPartyIdSet.has(pId)) return true;
        return false;
      }

      return (shipCity && shipCity === targetLowerName) || (billCity && billCity === targetLowerName);
    });
  }, [rawOrdersData, cityName, isUnspecified, cityPartyIdSet, otherCitiesPartyIdSet]);

  // 7. Aggregate Party-wise breakdown for this city from filtered contributions
  const { partyRows, totalCityQuantity, totalCityRevenue } = useMemo(() => {
    const contributions = summary?.contributions ?? [];
    const partyMap = new Map<
      string,
      {
        id: string;
        name: string;
        quantity: number;
        revenue: number;
        orderCount: number;
      }
    >();

    for (const cell of contributions) {
      const pId = cell.partyId;
      if (!pId) continue;

      const belongsToThisCity = isUnspecified
        ? !otherCitiesPartyIdSet.has(pId)
        : cityPartyIdSet.has(pId);

      if (!belongsToThisCity) continue;

      let rec = partyMap.get(pId);
      if (!rec) {
        rec = {
          id: pId,
          name: cell.partyName || "Unnamed Party",
          quantity: 0,
          revenue: 0,
          orderCount: 0,
        };
        partyMap.set(pId, rec);
      }

      rec.quantity += Number(cell.quantity) || 0;
      rec.revenue += Number(cell.volume) || 0;
      rec.orderCount += 1;
    }

    const list = Array.from(partyMap.values())
      .filter((p) => p.quantity > 0 || p.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const sumQty = list.reduce((acc, p) => acc + p.quantity, 0);
    const sumRev = list.reduce((acc, p) => acc + p.revenue, 0);

    const rowsWithColors = list.map((p, idx) => ({
      ...p,
      color: PARTY_PALETTE[idx % PARTY_PALETTE.length],
      pct: sumRev > 0 ? Math.round(((p.revenue / sumRev) * 100) * 10) / 10 : 0,
    }));

    return {
      partyRows: rowsWithColors,
      totalCityQuantity: sumQty,
      totalCityRevenue: sumRev,
    };
  }, [summary?.contributions, isUnspecified, otherCitiesPartyIdSet, cityPartyIdSet]);

  const handleDownloadCsv = () => {
    const headers = [
      "Party Name",
      dataType === "billed" ? "Billed Quantity (Qty)" : "Approved Quantity (Qty)",
      dataType === "billed" ? "Billed Revenue (INR)" : "Approved Revenue (INR)",
      "Percentage Share (%)",
    ];

    const rows = partyRows.map((p) => [
      p.name,
      p.quantity,
      p.revenue.toFixed(2),
      `${p.pct}%`,
    ]);

    rows.push([
      "Total",
      totalCityQuantity,
      totalCityRevenue.toFixed(2),
      "100%",
    ]);

    const filename = reportFilename(
      `city_${cityName.replace(/\s+/g, "_").toLowerCase()}_parties_${dataType}`,
      selectedYears,
      selectedMonths,
    );
    downloadCsvFile(filename, headers, rows);
  };

  const backHref = `${portalHome}/sales-analytics/orders`;

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Order Analytics</span>
              </Link>
            )}
            <span className="text-slate-400">/</span>
            <span className="text-xs font-semibold text-slate-500">City Details</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <MapPin className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
              <span>{cityName}</span>
            </h1>
            <span className="inline-flex items-center rounded-md bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
              City Analytics
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Monthly order performance trends and dealer/client breakdown for{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {cityName}
            </span>
            {filterCaption ? ` (${filterCaption})` : ""}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span>All Cities</span>
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

      {/* CITY KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            City Quantity
          </span>
          <p className="mt-1 text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {totalCityQuantity.toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}{" "}
            <span className="text-xs font-semibold text-slate-500">Qty</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {dataType === "billed" ? "Total billed units" : "Total approved units"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            City Revenue
          </span>
          <p className="mt-1 text-lg sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatMoney(totalCityRevenue)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {dataType === "billed" ? "Billed commercial value" : "Approved commercial value"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Buying Parties
          </span>
          <p className="mt-1 text-lg sm:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
            {partyRows.length}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Active clients with orders</p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Avg Qty / Party
          </span>
          <p className="mt-1 text-lg sm:text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {partyRows.length > 0
              ? Math.round(totalCityQuantity / partyRows.length).toLocaleString("en-IN")
              : 0}{" "}
            <span className="text-xs font-semibold text-slate-500">Qty</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Average ordering volume</p>
        </div>
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

      {/* ── 1. CITY MONTHLY CHART ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            {cityName} - Monthly Order Performance
          </h2>
        </div>

        <MonthlyPerformanceChart
          orders={cityOrders}
          isOrdersFetching={isOrdersFetching}
          qtyBasis={qtyBasis}
        />
      </div>

      {/* ── 2. PARTY-WISE BREAKDOWN OF THIS CITY ────────────────────────────── */}
      <PartyBreakdownSection
        partyRows={partyRows}
        totalQuantity={totalCityQuantity}
        totalRevenue={totalCityRevenue}
        title={`Party-Wise Breakdown (${cityName})`}
        subtitle={`Dealer and customer distribution within ${cityName}`}
        dataType={dataType}
        onDataTypeChange={setDataType}
        portalHome={portalHome}
        onExportCsv={handleDownloadCsv}
      />
    </div>
  );
}
