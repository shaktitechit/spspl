"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  Download,
  ExternalLink,
  Layers,
  MapPin,
  Search,
  Table as TableIcon,
  TrendingUp,
} from "lucide-react";

import { useListPartiesQuery, useListPartyCitiesQuery } from "@/store/api";
import type { DashboardOrdersSummary } from "@/store/api/slices/dashboardApi";
import { downloadCsvFile, reportFilename } from "./reportDownloadUtils";

export interface CityOrderAnalyticsProps {
  contributions?: DashboardOrdersSummary["contributions"];
  isOrdersFetching: boolean;
  qtyBasis?: string;
  selectedYears?: number[];
  selectedMonths?: number[];
  externalFilterCaption?: string;
  className?: string;
  portalHome?: string;
  onSelectCity?: (cityId: string, cityName?: string) => void;
  dataType?: "approved" | "billed";
  onDataTypeChange?: (type: "approved" | "billed") => void;
}

type MetricMode = "quantity" | "revenue";
type ViewMode = "split" | "chart" | "table";

const CITY_PALETTE = [
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

export default function CityOrderAnalytics({
  contributions = [],
  isOrdersFetching,
  qtyBasis,
  selectedYears = [],
  selectedMonths = [],
  externalFilterCaption,
  className = "",
  portalHome,
  onSelectCity,
  dataType: propDataType,
  onDataTypeChange,
}: CityOrderAnalyticsProps) {
  const router = useRouter();
  const [metricMode, setMetricMode] = useState<MetricMode>("revenue");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [hoveredCityId, setHoveredCityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const effectiveDataType = propDataType ?? (qtyBasis === "dispatched" ? "billed" : "approved");

  const handleDataTypeChange = (type: "approved" | "billed") => {
    if (onDataTypeChange) {
      onDataTypeChange(type);
    }
  };

  const handleCityClick = (cId: string, cName?: string) => {
    if (onSelectCity) {
      onSelectCity(cId, cName);
    } else if (portalHome) {
      router.push(`${portalHome}/sales-analytics/orders/city/${encodeURIComponent(cId)}`);
    }
  };

  // 1. Fetch cities catalog & parties catalog
  const { data: citiesData, isFetching: isCitiesFetching } = useListPartyCitiesQuery(
    { limit: 10000, status: "active" },
  );
  const { data: partiesData, isFetching: isPartiesFetching } = useListPartiesQuery({});

  // 2. Build city maps and partyId -> city mapping
  const { partyToCityMap, cityMetaMap } = useMemo(() => {
    const pMap = new Map<string, string>();
    const cMap = new Map<string, { id: string; name: string }>();

    // Index registered cities
    const citiesRaw = extractArray(citiesData);
    const nameToCityId = new Map<string, string>();

    for (const c of citiesRaw) {
      const cId = extractId(c._id ?? c.id);
      if (!cId) continue;
      const cName = String(c.name ?? "").trim() || "Unnamed City";
      cMap.set(cId, { id: cId, name: cName });
      nameToCityId.set(cName.toLowerCase(), cId);
    }

    // Index parties to city
    const partiesRaw = extractArray(partiesData);
    for (const p of partiesRaw) {
      const pId = extractId(p._id ?? p.id);
      if (!pId) continue;

      let matchedCityId = "";
      const cityIdDirect = extractId(p.city_id);
      if (cityIdDirect && cMap.has(cityIdDirect)) {
        matchedCityId = cityIdDirect;
      } else {
        const rawCityName = String(
          p.city ||
          (p.billing_address as Record<string, unknown>)?.city ||
          (p.shipping_address as Record<string, unknown>)?.city ||
          ""
        ).trim();

        if (rawCityName) {
          const lowerName = rawCityName.toLowerCase();
          if (nameToCityId.has(lowerName)) {
            matchedCityId = nameToCityId.get(lowerName)!;
          } else {
            // Unregistered city with a known name -> use slug/name as ID
            const pseudoId = `city-${lowerName.replace(/[^a-z0-9]/g, "-")}`;
            matchedCityId = pseudoId;
            if (!cMap.has(pseudoId)) {
              cMap.set(pseudoId, { id: pseudoId, name: rawCityName });
            }
          }
        }
      }

      if (matchedCityId) {
        pMap.set(pId, matchedCityId);
      }
    }

    cMap.set("unspecified", { id: "unspecified", name: "Unspecified City" });

    return { partyToCityMap: pMap, cityMetaMap: cMap };
  }, [citiesData, partiesData]);

  // 3. Aggregate city-wise metrics from filtered contributions
  const { cityRows, totalVolume, totalRevenue, totalUniqueParties } = useMemo(() => {
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

      const cityId = (pId && partyToCityMap.get(pId)) || "unspecified";
      const meta = cityMetaMap.get(cityId) ?? {
        id: cityId,
        name: cityId === "unspecified" ? "Unspecified City" : "Unknown City",
      };

      let rec = aggMap.get(cityId);
      if (!rec) {
        rec = {
          id: cityId,
          name: meta.name,
          volume: 0,
          revenue: 0,
          partiesSet: new Set<string>(),
        };
        aggMap.set(cityId, rec);
      }

      rec.volume += Number(cell.quantity) || 0;
      rec.revenue += Number(cell.volume) || 0;
      if (pId) rec.partiesSet.add(pId);
    }

    const list = Array.from(aggMap.values())
      .filter((c) => c.volume > 0 || c.revenue > 0)
      .sort((a, b) => {
        if (metricMode === "quantity") return b.volume - a.volume;
        return b.revenue - a.revenue;
      });

    const sumVol = list.reduce((acc, c) => acc + c.volume, 0);
    const sumRev = list.reduce((acc, c) => acc + c.revenue, 0);

    const rowsWithPcts = list.map((c, idx) => {
      const color = CITY_PALETTE[idx % CITY_PALETTE.length];
      const primaryValue = metricMode === "revenue" ? c.revenue : c.volume;
      const totalPrimary = metricMode === "revenue" ? sumRev : sumVol;
      const pct = totalPrimary > 0 ? (primaryValue / totalPrimary) * 100 : 0;

      return {
        ...c,
        color,
        pct: Math.round(pct * 10) / 10,
        primaryValue,
        partiesCount: c.partiesSet.size,
      };
    });

    return {
      cityRows: rowsWithPcts,
      totalVolume: sumVol,
      totalRevenue: sumRev,
      totalUniqueParties: allPartiesGlobal.size,
    };
  }, [contributions, partyToCityMap, cityMetaMap, metricMode]);

  // 4. Filter cities by search query
  const filteredCityRows = useMemo(() => {
    if (!searchQuery.trim()) return cityRows;
    const q = searchQuery.toLowerCase().trim();
    return cityRows.filter((c) => c.name.toLowerCase().includes(q));
  }, [cityRows, searchQuery]);

  // 5. Pareto & Cutoff Calculations
  const [cityLimit, setCityLimit] = useState<number | "all">(10);

  const maxCityMetric = useMemo(
    () => (cityRows.length > 0 ? cityRows[0].primaryValue : 1),
    [cityRows],
  );

  const top5Share = useMemo(() => {
    return (
      Math.round(
        cityRows.slice(0, 5).reduce((acc, c) => acc + c.pct, 0) * 10,
      ) / 10
    );
  }, [cityRows]);

  const displayedCityRows = useMemo(() => {
    if (cityLimit === "all") return cityRows;
    return cityRows.slice(0, cityLimit);
  }, [cityRows, cityLimit]);

  const otherCitiesData = useMemo(() => {
    if (cityLimit === "all" || cityRows.length <= cityLimit) return null;
    const remaining = cityRows.slice(cityLimit);
    const count = remaining.length;
    const revenue = remaining.reduce((acc, c) => acc + c.revenue, 0);
    const volume = remaining.reduce((acc, c) => acc + c.volume, 0);
    const pct =
      Math.round(remaining.reduce((acc, c) => acc + c.pct, 0) * 10) / 10;
    const partiesCount = remaining.reduce((acc, c) => acc + c.partiesCount, 0);
    return { count, revenue, volume, pct, partiesCount };
  }, [cityRows, cityLimit]);

  // CSV download
  const handleDownloadCsv = () => {
    const headers = [
      "City Name",
      "Buying Parties Count",
      effectiveDataType === "billed" ? "Billed Quantity (Qty)" : "Approved Quantity (Qty)",
      effectiveDataType === "billed" ? "Billed Revenue (INR)" : "Approved Revenue (INR)",
      "Percentage Share (%)",
    ];

    const rows = cityRows.map((c) => [
      c.name,
      c.partiesCount,
      c.volume,
      c.revenue.toFixed(2),
      `${c.pct}%`,
    ]);

    rows.push([
      "Total",
      totalUniqueParties,
      totalVolume,
      totalRevenue.toFixed(2),
      "100%",
    ]);

    const filename = reportFilename(
      `city_order_analytics_${effectiveDataType}`,
      selectedYears,
      selectedMonths,
    );
    downloadCsvFile(filename, headers, rows);
  };

  const isLoading = isOrdersFetching || isCitiesFetching || isPartiesFetching;

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm dark:border-white/10 dark:bg-slate-900 ${className}`}
    >
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-xs">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                City-Wise Order Analytics
              </h2>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {cityRows.length} {cityRows.length === 1 ? "City" : "Cities"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {externalFilterCaption
                ? `Distribution for ${externalFilterCaption} (${
                    effectiveDataType === "billed" ? "Billed Data" : "Approved Data"
                  })`
                : `Geographical distribution of ${
                    effectiveDataType === "billed" ? "billed" : "approved"
                  } order volume, revenue, and client activity across cities`}
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
              title="Pareto Bar Chart View"
              onClick={() => setViewMode("chart")}
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "chart"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
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
            disabled={cityRows.length === 0}
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
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-xs text-slate-500">Loading city order analytics…</p>
          </div>
        </div>
      ) : cityRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
            <MapPin className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            No city order data found
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 max-w-sm">
            There are no orders mapped to cities in the selected period.
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
            {/* ── RANKED PARETO BAR CHART PANEL ─────────────────────────── */}
            {(viewMode === "split" || viewMode === "chart") && (
              <div
                className={`flex flex-col rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-slate-900 shadow-2xs ${
                  viewMode === "split" ? "lg:col-span-6" : "w-full max-w-4xl mx-auto"
                }`}
              >
                {/* Header & Cutoff Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-white/5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                        <BarChart3 className="h-4 w-4" />
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        City Distribution & Pareto Ranking
                      </h4>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Top delivery hubs sorted by {metricMode === "revenue" ? "Revenue" : "Quantity"}
                    </p>
                  </div>

                  {/* Cutoff Limit Selector */}
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-slate-800 self-start sm:self-auto">
                    {[5, 10, 20, "all" as const].map((limit) => (
                      <button
                        key={String(limit)}
                        type="button"
                        onClick={() => setCityLimit(limit)}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer ${
                          cityLimit === limit
                            ? "bg-white text-indigo-700 shadow-2xs dark:bg-slate-900 dark:text-indigo-300"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                        }`}
                      >
                        {limit === "all" ? "All" : `Top ${limit}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pareto Insight Pill */}
                <div className="mt-3 flex items-center justify-between rounded-lg bg-indigo-50/70 px-3 py-2 text-xs border border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900/40">
                  <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200">
                    <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>
                      Top 5 cities generate{" "}
                      <strong className="font-extrabold text-indigo-700 dark:text-indigo-300">
                        {top5Share}%
                      </strong>{" "}
                      of all {effectiveDataType === "billed" ? "billed" : "approved"}{" "}
                      {metricMode === "revenue" ? "revenue" : "quantity"}.
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0 hidden sm:inline">
                    {cityRows.length} Active Hubs
                  </span>
                </div>

                {/* Ranked Bars List */}
                <div className="mt-3.5 space-y-2 max-h-[360px] overflow-y-auto scrollbar-none pr-1">
                  {displayedCityRows.map((city, idx) => {
                    const relativeWidth =
                      maxCityMetric > 0
                        ? Math.max(
                            4,
                            Math.round((city.primaryValue / maxCityMetric) * 100),
                          )
                        : 0;
                    const isHovered = hoveredCityId === city.id;

                    return (
                      <div
                        key={city.id}
                        onMouseEnter={() => setHoveredCityId(city.id)}
                        onMouseLeave={() => setHoveredCityId(null)}
                        onClick={() => handleCityClick(city.id, city.name)}
                        className={`group rounded-lg border p-2 transition cursor-pointer ${
                          isHovered
                            ? "border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/30 shadow-2xs"
                            : "border-slate-100 bg-slate-50/60 hover:bg-slate-100/60 dark:border-white/5 dark:bg-slate-800/40 dark:hover:bg-slate-800/70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-[10px] font-bold text-slate-600 shadow-2xs dark:bg-slate-800 dark:text-slate-300 shrink-0">
                              #{idx + 1}
                            </span>
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: city.color }}
                            />
                            <span className="font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400 truncate transition-colors">
                              {city.name}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              ({city.partiesCount} {city.partiesCount === 1 ? "party" : "parties"})
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {metricMode === "revenue"
                                ? formatMoney(city.revenue)
                                : formatQuantity(city.volume)}
                            </span>
                            <span className="ml-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                              {city.pct}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${relativeWidth}%`,
                              backgroundColor: city.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Aggregated Other Cities Row */}
                  {otherCitiesData && (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-2 dark:border-white/10 dark:bg-slate-800/20">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Other Cities ({otherCitiesData.count})
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({otherCitiesData.partiesCount} parties)
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {metricMode === "revenue"
                              ? formatMoney(otherCitiesData.revenue)
                              : formatQuantity(otherCitiesData.volume)}
                          </span>
                          <span className="ml-1.5 text-[11px] font-semibold text-slate-500">
                            {otherCitiesData.pct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
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
                      City Breakdown Table
                    </span>
                  </div>

                  {cityRows.length > 5 && (
                    <div className="relative w-full sm:w-48">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter cities..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                  )}
                </div>

                {/* Table Component */}
                <div className="overflow-x-auto scrollbar-none flex-1 max-h-[460px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/90 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 border-b border-slate-100 dark:border-white/5 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider">
                          City
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
                      {filteredCityRows.map((city) => {
                        const isHovered = hoveredCityId === city.id;
                        return (
                          <tr
                            key={city.id}
                            onClick={() => handleCityClick(city.id, city.name)}
                            onMouseEnter={() => setHoveredCityId(city.id)}
                            onMouseLeave={() => setHoveredCityId(null)}
                            className={`transition cursor-pointer group ${
                              isHovered
                                ? "bg-indigo-50/70 dark:bg-indigo-950/40"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <td className="py-2.5 px-3 font-medium">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: city.color }}
                                />
                                <span className="font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400 transition-colors">
                                  {city.name}
                                </span>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                <Building2 className="h-3 w-3 text-slate-400" />
                                {city.partiesCount}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-right font-medium">
                              {city.volume.toLocaleString("en-IN", {
                                maximumFractionDigits: 0,
                              })}
                            </td>

                            <td className="py-2.5 px-3 text-right font-medium">
                              {formatMoney(city.revenue)}
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-bold text-[11px] min-w-[36px]">
                                  {city.pct}%
                                </span>
                                <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                                  <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                      width: `${Math.min(100, city.pct)}%`,
                                      backgroundColor: city.color,
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
                                  handleCityClick(city.id, city.name);
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition cursor-pointer"
                                title={`View ${city.name} Details`}
                              >
                                <span>View City</span>
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Summary Footer Row */}
                    <tfoot className="border-t-2 border-slate-200 bg-slate-50/90 font-bold dark:border-white/10 dark:bg-slate-800/80 sticky bottom-0">
                      <tr>
                        <td className="py-2.5 px-3 text-slate-900 dark:text-slate-100">
                          Total ({cityRows.length} Cities)
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
                        <td className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400 font-extrabold">
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

