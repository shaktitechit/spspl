"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Compass,
  Download,
  ExternalLink,
  Layers,
  MapPin,
  PieChart,
  Search,
  Table as TableIcon,
} from "lucide-react";

import { useListZonesQuery } from "@/store/api";
import type { DashboardOrdersSummary } from "@/store/api/slices/dashboardApi";
import { downloadCsvFile, reportFilename } from "./reportDownloadUtils";

export interface ZoneOrderAnalyticsProps {
  contributions?: DashboardOrdersSummary["contributions"];
  isOrdersFetching: boolean;
  qtyBasis?: string;
  selectedYears?: number[];
  selectedMonths?: number[];
  externalFilterCaption?: string;
  className?: string;
  portalHome?: string;
  onSelectZone?: (zoneId: string, zoneName?: string) => void;
  dataType?: "approved" | "billed";
  onDataTypeChange?: (type: "approved" | "billed") => void;
}

type MetricMode = "quantity" | "revenue";
type ViewMode = "split" | "chart" | "table";

const ZONE_PALETTE = [
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

function formatQuantity(val: number): string {
  return `${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Qty`;
}

export default function ZoneOrderAnalytics({
  contributions = [],
  isOrdersFetching,
  qtyBasis,
  selectedYears = [],
  selectedMonths = [],
  externalFilterCaption,
  className = "",
  portalHome,
  onSelectZone,
  dataType: propDataType,
  onDataTypeChange,
}: ZoneOrderAnalyticsProps) {
  const router = useRouter();
  const [metricMode, setMetricMode] = useState<MetricMode>("revenue");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const effectiveDataType = propDataType ?? (qtyBasis === "dispatched" ? "billed" : "approved");

  const handleDataTypeChange = (type: "approved" | "billed") => {
    if (onDataTypeChange) {
      onDataTypeChange(type);
    }
  };

  const handleZoneClick = (zId: string, zName?: string) => {
    if (onSelectZone) {
      onSelectZone(zId, zName);
    } else if (portalHome) {
      router.push(`${portalHome}/sales-analytics/orders/zone/${zId}`);
    }
  };

  const { data: zonesData, isFetching: isZonesFetching } = useListZonesQuery(
    { limit: 1000 },
  );

  // 1. Build partyId -> zone mapping & zone metadata
  const { partyToZoneMap, zoneMetaMap } = useMemo(() => {
    const pMap = new Map<string, string>();
    const zMap = new Map<string, { id: string; name: string }>();

    const zonesRaw =
      zonesData && typeof zonesData === "object" && "data" in zonesData
        ? (zonesData.data as Array<Record<string, unknown>>)
        : Array.isArray(zonesData)
        ? (zonesData as Array<Record<string, unknown>>)
        : [];

    for (const z of zonesRaw) {
      const zId = String(z._id ?? z.id ?? "");
      if (!zId) continue;
      const zName = String(z.name ?? "Unnamed Zone");
      zMap.set(zId, { id: zId, name: zName });

      const parties = Array.isArray(z.parties) ? z.parties : [];
      for (const p of parties) {
        const pId = typeof p === "string" ? p : String((p as Record<string, unknown>)?._id ?? (p as Record<string, unknown>)?.id ?? "");
        if (pId) pMap.set(pId, zId);
      }
    }

    zMap.set("unzoned", { id: "unzoned", name: "Unzoned / Other" });

    return { partyToZoneMap: pMap, zoneMetaMap: zMap };
  }, [zonesData]);

  // 2. Aggregate zone-wise metrics from filtered contributions
  const { zoneRows, totalVolume, totalRevenue, totalUniqueParties } = useMemo(() => {
    const aggMap = new Map<
      string,
      {
        id: string;
        name: string;
        volume: number;
        revenue: number;
        partiesSet: Set<string>;
      }
    >();

    const allPartiesGlobal = new Set<string>();

    for (const cell of contributions) {
      const pId = cell.partyId;
      if (pId) allPartiesGlobal.add(pId);

      const zoneId = (pId && partyToZoneMap.get(pId)) || "unzoned";
      const meta = zoneMetaMap.get(zoneId) ?? {
        id: zoneId,
        name: zoneId === "unzoned" ? "Unzoned / Other" : "Unknown Zone",
      };

      let rec = aggMap.get(zoneId);
      if (!rec) {
        rec = {
          id: zoneId,
          name: meta.name,
          volume: 0,
          revenue: 0,
          partiesSet: new Set<string>(),
        };
        aggMap.set(zoneId, rec);
      }

      rec.volume += Number(cell.quantity) || 0;
      rec.revenue += Number(cell.volume) || 0;
      if (pId) rec.partiesSet.add(pId);
    }

    // Convert to sorted rows
    const list = Array.from(aggMap.values())
      .filter((r) => r.volume > 0 || r.revenue > 0)
      .sort((a, b) => {
        if (metricMode === "quantity") {
          return b.volume - a.volume;
        }
        return b.revenue - a.revenue;
      });

    const sumVol = list.reduce((acc, r) => acc + r.volume, 0);
    const sumRev = list.reduce((acc, r) => acc + r.revenue, 0);

    const rowsWithColors = list.map((r, idx) => {
      const color = ZONE_PALETTE[idx % ZONE_PALETTE.length];
      const primaryValue = metricMode === "revenue" ? r.revenue : r.volume;
      const totalPrimary = metricMode === "revenue" ? sumRev : sumVol;
      const pct = totalPrimary > 0 ? (primaryValue / totalPrimary) * 100 : 0;

      return {
        id: r.id,
        name: r.name,
        volume: r.volume,
        revenue: r.revenue,
        partiesCount: r.partiesSet.size,
        color,
        pct: Math.round(pct * 10) / 10,
        primaryValue,
      };
    });

    return {
      zoneRows: rowsWithColors,
      totalVolume: sumVol,
      totalRevenue: sumRev,
      totalUniqueParties: allPartiesGlobal.size,
    };
  }, [contributions, partyToZoneMap, zoneMetaMap, metricMode]);

  // Filtered rows by search query
  const filteredZoneRows = useMemo(() => {
    if (!searchQuery.trim()) return zoneRows;
    const q = searchQuery.toLowerCase().trim();
    return zoneRows.filter((r) => r.name.toLowerCase().includes(q));
  }, [zoneRows, searchQuery]);

  // Active value for hovered slice
  const hoveredZone = useMemo(
    () => zoneRows.find((r) => r.id === hoveredZoneId) ?? null,
    [zoneRows, hoveredZoneId],
  );

  // SVG Geometry for Donut / Pie Chart (300 x 300 viewBox)
  const cx = 150;
  const cy = 150;
  const R = 124;
  const r = 78;

  const totalPrimaryMetric = metricMode === "revenue" ? totalRevenue : totalVolume;

  const slicePaths = useMemo(() => {
    if (totalPrimaryMetric <= 0 || zoneRows.length === 0) return [];

    let currentAngle = -Math.PI / 2;
    return zoneRows.map((zone) => {
      const sliceVal = zone.primaryValue;
      const angle = (sliceVal / totalPrimaryMetric) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const isHovered = hoveredZoneId === zone.id;
      const currentR = isHovered ? R + 6 : R;
      const currentInnerR = isHovered ? r - 2 : r;

      const pad = zoneRows.length > 1 ? 0.015 : 0;
      const a1 = startAngle + pad;
      const a2 = endAngle - pad;

      const x1 = cx + currentR * Math.cos(a1);
      const y1 = cy + currentR * Math.sin(a1);
      const x2 = cx + currentR * Math.cos(a2);
      const y2 = cy + currentR * Math.sin(a2);

      const x3 = cx + currentInnerR * Math.cos(a2);
      const y3 = cy + currentInnerR * Math.sin(a2);
      const x4 = cx + currentInnerR * Math.cos(a1);
      const y4 = cy + currentInnerR * Math.sin(a1);

      const largeArc = a2 - a1 > Math.PI ? 1 : 0;
      const d = `M ${x1} ${y1} A ${currentR} ${currentR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${currentInnerR} ${currentInnerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;

      return {
        ...zone,
        d,
        isHovered,
      };
    });
  }, [totalPrimaryMetric, zoneRows, hoveredZoneId]);

  const handleDownloadCsv = () => {
    const headers = [
      "Zone Name",
      "Active Buying Parties",
      "Order Quantity",
      "Commercial Revenue (INR)",
      "Percentage Share (%)",
    ];

    const rows = zoneRows.map((z) => [
      z.name,
      z.partiesCount,
      z.volume,
      z.revenue.toFixed(2),
      `${z.pct}%`,
    ]);

    rows.push([
      "Total",
      totalUniqueParties,
      totalVolume,
      totalRevenue.toFixed(2),
      "100%",
    ]);

    const filename = reportFilename("zone_wise_orders", selectedYears, selectedMonths);
    downloadCsvFile(filename, headers, rows);
  };

  const isLoading = isOrdersFetching || isZonesFetching;

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm dark:border-white/10 dark:bg-slate-900 ${className}`}
    >
      {/* SECTION HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xs">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Zone-Wise Order Analytics
              </h2>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {zoneRows.length} {zoneRows.length === 1 ? "Zone" : "Zones"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {externalFilterCaption
                ? `Distribution for ${externalFilterCaption} (${
                    effectiveDataType === "billed" ? "Billed Data" : "Approved Data"
                  })`
                : `Geographical distribution of ${
                    effectiveDataType === "billed" ? "billed" : "approved"
                  } order volume, revenue, and client activity`}
            </p>
          </div>
        </div>

        {/* CONTROLS: Data Basis Mode & Metric Mode & View Mode & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Approved vs Billed Data Switch */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => handleDataTypeChange("approved")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                effectiveDataType === "approved"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              Approved Data
            </button>
            <button
              type="button"
              onClick={() => handleDataTypeChange("billed")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                effectiveDataType === "billed"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              Billed Data
            </button>
          </div>

          {/* Metric Selector: Quantity vs Revenue */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setMetricMode("quantity")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                metricMode === "quantity"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              Quantity (Qty)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("revenue")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                metricMode === "revenue"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              Revenue (₹)
            </button>
          </div>

          {/* View Mode Toggle: Split / Chart / Table */}
          <div className="hidden sm:inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-slate-800">
            <button
              type="button"
              title="Split View (Chart + Table)"
              onClick={() => setViewMode("split")}
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "split"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Pie Chart View"
              onClick={() => setViewMode("chart")}
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "chart"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <PieChart className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Table View"
              onClick={() => setViewMode("table")}
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Download CSV */}
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={zoneRows.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-xs text-slate-500">Loading zone order analytics…</p>
          </div>
        </div>
      ) : zoneRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
            <MapPin className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            No zone order data found
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 max-w-sm">
            There are no orders or sales activity mapped to operational zones in the selected period.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <div
            className={`grid gap-6 ${
              viewMode === "split"
                ? "grid-cols-1 lg:grid-cols-12"
                : "grid-cols-1"
            }`}
          >
            {/* ── PIE CHART & REGIONAL CARDS PANEL ──────────────────────── */}
            {(viewMode === "split" || viewMode === "chart") && (
              <div
                className={`flex flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-slate-900 shadow-2xs ${
                  viewMode === "split" ? "lg:col-span-6" : "w-full max-w-4xl mx-auto"
                }`}
              >
                {/* Header */}
                <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                      <Compass className="h-4 w-4" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Territory Share & Macro Distribution
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Regional breakdown by {metricMode === "revenue" ? "Revenue" : "Quantity"}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {zoneRows.length} Zones
                  </span>
                </div>

                <div className="relative flex items-center justify-center mt-3">
                  <svg
                    viewBox="0 0 300 300"
                    className="w-[220px] h-[220px] sm:w-[240px] sm:h-[240px] drop-shadow-sm select-none transition-all duration-300"
                  >
                    {/* Background circle track */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={(R + r) / 2}
                      fill="transparent"
                      stroke="#f1f5f9"
                      strokeWidth={R - r}
                      className="dark:stroke-slate-800"
                    />

                    {/* Slices */}
                    {slicePaths.map((slice) => (
                      <path
                        key={slice.id}
                        d={slice.d}
                        fill={slice.color}
                        stroke="#ffffff"
                        strokeWidth={slice.isHovered ? 2.5 : 1.5}
                        className="cursor-pointer transition-all duration-200 dark:stroke-slate-900 hover:opacity-90"
                        onMouseEnter={() => setHoveredZoneId(slice.id)}
                        onMouseLeave={() => setHoveredZoneId(null)}
                        onClick={() => handleZoneClick(slice.id, slice.name)}
                      >
                        <title>{`${slice.name}: ${
                          metricMode === "revenue"
                            ? formatMoney(slice.revenue)
                            : formatQuantity(slice.volume)
                        } (${slice.pct}%) - Click to view zone analytics`}</title>
                      </path>
                    ))}

                    {/* Inner Hub Circle */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r - 4}
                      fill="#ffffff"
                      className="dark:fill-slate-900"
                    />
                  </svg>

                  {/* Inner Hub Center Text */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
                      {metricMode === "revenue"
                        ? effectiveDataType === "billed"
                          ? "Billed Revenue"
                          : "Approved Revenue"
                        : effectiveDataType === "billed"
                          ? "Billed Quantity"
                          : "Approved Quantity"}
                    </span>
                    <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight mt-0.5 truncate max-w-[140px]">
                      {metricMode === "revenue"
                        ? formatMoney(totalRevenue)
                        : formatQuantity(totalVolume)}
                    </span>
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                      {zoneRows.length} Active {zoneRows.length === 1 ? "Zone" : "Zones"}
                    </span>
                  </div>
                </div>

                {/* Hover Callout beneath circle */}
                <div className="mt-2 min-h-[30px] flex items-center justify-center text-center">
                  {hoveredZone ? (
                    <button
                      type="button"
                      onClick={() => handleZoneClick(hoveredZone.id, hoveredZone.name)}
                      className="group inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white px-3.5 py-1 text-xs shadow-2xs hover:border-blue-400 hover:shadow-xs transition dark:border-white/10 dark:bg-slate-900 cursor-pointer"
                      title={`Click to open ${hoveredZone.name} analytics`}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: hoveredZone.color }}
                      />
                      <span className="font-bold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400 transition-colors">
                        {hoveredZone.name}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {metricMode === "revenue"
                          ? formatMoney(hoveredZone.revenue)
                          : formatQuantity(hoveredZone.volume)}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        ({hoveredZone.pct}%)
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 underline decoration-blue-300 ml-1">
                        View Zone →
                      </span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                      Click or hover on any zone to inspect regional metrics
                    </span>
                  )}
                </div>

                {/* Territory Contribution Grid */}
                <div className="mt-3.5 w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {zoneRows.map((zone) => {
                    const isHovered = hoveredZoneId === zone.id;
                    return (
                      <div
                        key={zone.id}
                        onClick={() => handleZoneClick(zone.id, zone.name)}
                        onMouseEnter={() => setHoveredZoneId(zone.id)}
                        onMouseLeave={() => setHoveredZoneId(null)}
                        className={`group rounded-lg border p-2.5 transition cursor-pointer ${
                          isHovered
                            ? "border-blue-400 bg-blue-50/40 dark:border-blue-600 dark:bg-blue-950/30 shadow-2xs"
                            : "border-slate-100 bg-slate-50/60 hover:bg-slate-100/60 dark:border-white/5 dark:bg-slate-800/40 dark:hover:bg-slate-800/70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: zone.color }}
                            />
                            <span className="font-bold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400 truncate transition-colors">
                              {zone.name}
                            </span>
                          </div>
                          <span className="font-extrabold text-blue-600 dark:text-blue-400 shrink-0">
                            {zone.pct}%
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>
                            {metricMode === "revenue"
                              ? formatMoney(zone.revenue)
                              : formatQuantity(zone.volume)}
                          </span>
                          <span>{zone.partiesCount} Clients</span>
                        </div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, Math.max(zone.pct, zone.pct > 0 ? 4 : 0))}%`,
                              backgroundColor: zone.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TABLE PANEL ────────────────────────────────────────────── */}
            {(viewMode === "split" || viewMode === "table") && (
              <div
                className={`flex flex-col rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs dark:border-white/10 dark:bg-slate-900 ${
                  viewMode === "split" ? "lg:col-span-6" : "w-full"
                }`}
              >
                {/* Table Header Strip with Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 p-3 sm:px-4 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-center gap-2">
                    <TableIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Zone Breakdown Table
                    </span>
                  </div>

                  {zoneRows.length > 5 && (
                    <div className="relative w-full sm:w-48">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter zones..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                  )}
                </div>

                {/* Table Component */}
                <div className="overflow-x-auto scrollbar-none flex-1">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/90 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 border-b border-slate-100 dark:border-white/5">
                      <tr>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider">
                          Operational Zone
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider text-center">
                          Buying Parties
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider text-right">
                          {effectiveDataType === "billed"
                            ? "Billed Qty"
                            : "Approved Qty"}
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider text-right">
                          {effectiveDataType === "billed"
                            ? "Billed Revenue (INR)"
                            : "Approved Revenue (INR)"}
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider text-right min-w-[120px]">
                          Share (%)
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-200">
                      {filteredZoneRows.map((zone) => {
                        const isHovered = hoveredZoneId === zone.id;
                        return (
                          <tr
                            key={zone.id}
                            onClick={() => handleZoneClick(zone.id, zone.name)}
                            onMouseEnter={() => setHoveredZoneId(zone.id)}
                            onMouseLeave={() => setHoveredZoneId(null)}
                            className={`transition cursor-pointer group ${
                              isHovered
                                ? "bg-blue-50/70 dark:bg-blue-950/40"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <td className="py-2.5 px-3 font-medium">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: zone.color }}
                                />
                                <span className="font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400 transition-colors">
                                  {zone.name}
                                </span>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                <Building2 className="h-3 w-3 text-slate-400" />
                                {zone.partiesCount}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-right font-medium">
                              {zone.volume.toLocaleString("en-IN", {
                                maximumFractionDigits: 0,
                              })}
                            </td>

                            <td className="py-2.5 px-3 text-right font-medium">
                              {formatMoney(zone.revenue)}
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-bold text-[11px] min-w-[36px]">
                                  {zone.pct}%
                                </span>
                                <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                                  <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                      width: `${Math.min(100, zone.pct)}%`,
                                      backgroundColor: zone.color,
                                    }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleZoneClick(zone.id, zone.name);
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 transition cursor-pointer"
                                title={`View ${zone.name} Details`}
                              >
                                <span>View Zone</span>
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Summary Footer Row */}
                    <tfoot className="border-t-2 border-slate-200 bg-slate-50/90 font-bold dark:border-white/10 dark:bg-slate-800/80">
                      <tr>
                        <td className="py-2.5 px-3 text-slate-900 dark:text-slate-100">
                          Total ({zoneRows.length} Zones)
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-900 dark:text-slate-100">
                          {totalUniqueParties}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-900 dark:text-slate-100">
                          {totalVolume.toLocaleString("en-IN", {
                            maximumFractionDigits: 0,
                          })}{" "}
                          Qty
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-900 dark:text-slate-100">
                          {formatMoney(totalRevenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400 font-extrabold">
                          100.0%
                        </td>
                        <td className="py-2.5 px-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
