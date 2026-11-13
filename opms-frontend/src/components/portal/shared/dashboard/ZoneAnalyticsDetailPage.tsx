"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Compass,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import MonthlyPerformanceChart from "./MonthlyPerformanceChart";
import PartyBreakdownSection from "./PartyBreakdownSection";
import PeriodFilter from "./PeriodFilter";
import { formatPeriodCaption } from "./PeriodHeadingCaption";
import { useDashboardSummary } from "./useDashboardSummary";
import { reportFilename } from "./reportDownloadUtils";
import { useDashboardPdfExport } from "./dashboardPdfEngine";
import {
  useGetZoneQuery,
  useListZonesQuery,
  useListOrdersQuery,
  type ZoneRecord,
} from "@/store/api";

export interface ZoneAnalyticsDetailPageProps {
  zoneId: string;
  portalHome: string;
  role: "admin" | "coordinator" | "finance" | "account" | "super_admin";
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

export default function ZoneAnalyticsDetailPage({
  zoneId,
  portalHome,
  onBack,
}: ZoneAnalyticsDetailPageProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Fetch zone details
  const isUnzoned = zoneId === "unzoned";
  const { data: zoneRecord, isFetching: isZoneFetching } = useGetZoneQuery(
    zoneId,
    { skip: isUnzoned },
  );

  // Also fetch all zones to know the global party -> zone assignment
  const { data: allZonesData } = useListZonesQuery({ limit: 1000 });

  const { zoneName, zonePartyIdSet, otherZonesPartyIdSet } = useMemo(() => {
    const partySet = new Set<string>();
    const otherParties = new Set<string>();
    let name = isUnzoned ? "Unzoned / Other" : "Operational Zone";

    const allZones =
      allZonesData && typeof allZonesData === "object" && "data" in allZonesData
        ? (allZonesData.data as ZoneRecord[])
        : Array.isArray(allZonesData)
          ? (allZonesData as ZoneRecord[])
          : [];

    for (const z of allZones) {
      const zId = extractId(z._id);
      const isCurrent = zId === zoneId;
      if (isCurrent && z.name) {
        name = z.name;
      }

      for (const p of z.parties ?? []) {
        const pId = extractId(p);
        if (!pId) continue;
        if (isCurrent) {
          partySet.add(pId);
        } else {
          otherParties.add(pId);
        }
      }
    }

    if (!isUnzoned && zoneRecord && typeof zoneRecord === "object") {
      const z = zoneRecord as ZoneRecord;
      if (z.name) name = z.name;
      for (const p of z.parties ?? []) {
        const pId = extractId(p);
        if (pId) partySet.add(pId);
      }
    }

    return {
      zoneName: name,
      zonePartyIdSet: partySet,
      otherZonesPartyIdSet: otherParties,
    };
  }, [allZonesData, zoneRecord, zoneId, isUnzoned]);

  // 2. Fetch dashboard summary with filter controls
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

  // 3. Fetch raw orders list to feed into MonthlyPerformanceChart for this zone
  const {
    data: rawOrdersData,
    isFetching: isOrdersFetching,
    refetch: refetchOrders,
  } = useListOrdersQuery({ view: "list", limit: "2000" });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchSummary().unwrap(),
        refetchOrders().unwrap(),
      ]);
    } catch {
      // Ignore errors
    } finally {
      setIsRefreshing(false);
    }
  };

  const isAnyLoading =
    isSummaryFetching || isOrdersFetching || isZoneFetching || isRefreshing;

  const filterCaption = useMemo(() => {
    return formatPeriodCaption(
      dateFilter,
      customDateFrom,
      customDateTo,
      selectedYears,
      selectedMonths,
    );
  }, [dateFilter, customDateFrom, customDateTo, selectedYears, selectedMonths]);

  // 4. Filter orders belonging to this zone
  const zoneOrders = useMemo(() => {
    const list = Array.isArray(rawOrdersData) ? rawOrdersData : [];
    return list.filter((order) => {
      const pId = extractId((order as Record<string, unknown>).party);
      if (!pId) return isUnzoned;
      if (isUnzoned) {
        return !otherZonesPartyIdSet.has(pId);
      }
      return zonePartyIdSet.has(pId);
    });
  }, [rawOrdersData, isUnzoned, otherZonesPartyIdSet, zonePartyIdSet]);

  // 5. Aggregate Party-wise breakdown for this zone from filtered contributions
  const { partyRows, totalZoneQuantity, totalZoneRevenue } = useMemo(() => {
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

      const belongsToThisZone = isUnzoned
        ? !otherZonesPartyIdSet.has(pId)
        : zonePartyIdSet.has(pId);

      if (!belongsToThisZone) continue;

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
      totalZoneQuantity: sumQty,
      totalZoneRevenue: sumRev,
    };
  }, [summary?.contributions, isUnzoned, otherZonesPartyIdSet, zonePartyIdSet]);

  const { exportPdf, isExporting } = useDashboardPdfExport();

  const handleDownloadPdf = async () => {
    const qtyColHeader =
      dataType === "billed" ? "Billed Quantity (Qty)" : "Approved Quantity (Qty)";
    const revColHeader =
      dataType === "billed" ? "Billed Revenue (INR)" : "Approved Revenue (INR)";

    const headers = [
      "Party Name",
      qtyColHeader,
      revColHeader,
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
      totalZoneQuantity,
      totalZoneRevenue.toFixed(2),
      "100%",
    ]);

    await exportPdf({
      title: `Zone Analytics: ${zoneName}`,
      subtitle: `Party-wise sales distribution within ${zoneName} (${dataType === "billed" ? "Billed" : "Approved"} Orders)`,
      metaLines: [
        `Zone: ${zoneName}`,
        `Period: ${filterCaption || "All Time"}`,
        `Mode: ${dataType.toUpperCase()}`,
      ],
      headers,
      rows,
      filename: reportFilename(
        `zone_${zoneName.replace(/\s+/g, "_").toLowerCase()}_parties`,
        selectedYears,
        selectedMonths,
      ),
      orientation: "portrait",
    });
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
            <span className="text-xs font-semibold text-slate-500">Zone Details</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <Compass className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              <span>{zoneName}</span>
            </h1>
            <span className="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
              Zone Analytics
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Monthly order performance trends and dealer/client breakdown for{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {zoneName}
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
            <span>All Zones</span>
          </Link>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isAnyLoading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 text-slate-500 dark:text-slate-400 ${isAnyLoading ? "animate-spin" : ""
                }`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ZONE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Zone Quantity
          </span>
          <p className="mt-1 text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {totalZoneQuantity.toLocaleString("en-IN", {
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
            Zone Revenue
          </span>
          <p className="mt-1 text-lg sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatMoney(totalZoneRevenue)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {dataType === "billed" ? "Billed commercial value" : "Approved commercial value"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Buying Parties
          </span>
          <p className="mt-1 text-lg sm:text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {partyRows.length}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Active clients with orders</p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Avg Qty / Party
          </span>
          <p className="mt-1 text-lg sm:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
            {partyRows.length > 0
              ? Math.round(totalZoneQuantity / partyRows.length).toLocaleString("en-IN")
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

      {/* ── 1. ZONE MONTHLY CHART ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            {zoneName} - Monthly Order Performance
          </h2>
        </div>

        <MonthlyPerformanceChart
          orders={zoneOrders}
          isOrdersFetching={isOrdersFetching}
          qtyBasis={qtyBasis}
        />
      </div>

      {/* ── 2. PARTY-WISE BREAKDOWN OF THIS ZONE ────────────────────────────── */}
      <PartyBreakdownSection
        partyRows={partyRows}
        totalQuantity={totalZoneQuantity}
        totalRevenue={totalZoneRevenue}
        title={`Party-Wise Breakdown (${zoneName})`}
        subtitle={`Dealer and customer distribution within ${zoneName}`}
        dataType={dataType}
        onDataTypeChange={setDataType}
        portalHome={portalHome}
        onExportPdf={handleDownloadPdf}
        isExportingPdf={isExporting}
      />
    </div>
  );
}

