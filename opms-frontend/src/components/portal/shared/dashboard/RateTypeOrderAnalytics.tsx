"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Building2,
  Coins,
  Download,
  ExternalLink,
  Layers,
  Scale,
  Search,
  Table as TableIcon,
  Tag,
} from "lucide-react";

import { useListOrdersQuery } from "@/store/api";
import type { DashboardOrdersSummary } from "@/store/api/slices/dashboardApi";
import { downloadCsvFile, reportFilename } from "./reportDownloadUtils";
import { normalizeRateType, itemMetricValue, type QtyBasis } from "./leaderboardUtils";
import { shouldIncludeOrder } from "./featuredMatrixUtils";

export interface RateTypeOrderAnalyticsProps {
  contributions?: DashboardOrdersSummary["contributions"];
  leaderboards?: DashboardOrdersSummary["leaderboards"];
  isOrdersFetching: boolean;
  qtyBasis?: string;
  selectedYears?: number[];
  selectedMonths?: number[];
  externalFilterCaption?: string;
  className?: string;
  portalHome?: string;
  onSelectRateType?: (rateTypeId: string, rateTypeName?: string) => void;
  dataType?: "approved" | "billed";
  onDataTypeChange?: (type: "approved" | "billed") => void;
}

type MetricMode = "quantity" | "revenue";
type ViewMode = "split" | "chart" | "table";

export interface RateTypeMeta {
  id: "SR" | "SRA" | "CR" | "OTHER";
  code: string;
  name: string;
  shortDescription: string;
  color: string;
  badgeBg: string;
  badgeText: string;
}

export const RATE_TYPE_CONFIG: Record<string, RateTypeMeta> = {
  SR: {
    id: "SR",
    code: "SR",
    name: "Standard Rate",
    shortDescription: "Default catalog base pricing applied across standard orders",
    color: "#2563EB", // Blue
    badgeBg: "bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/40",
    badgeText: "text-blue-700 dark:text-blue-300",
  },
  SRA: {
    id: "SRA",
    code: "SRA",
    name: "Special Rate Agreement",
    shortDescription: "Contractual and negotiated institutional minimum sale rates",
    color: "#059669", // Emerald
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/40",
    badgeText: "text-emerald-700 dark:text-emerald-300",
  },
  CR: {
    id: "CR",
    code: "CR",
    name: "Company Rate",
    shortDescription: "Company retail / list rate pricing structure",
    color: "#7C3AED", // Violet
    badgeBg: "bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/40",
    badgeText: "text-purple-700 dark:text-purple-300",
  },
  OTHER: {
    id: "OTHER",
    code: "OTHER",
    name: "Manual / Other Rate",
    shortDescription: "Manually overridden rates and customized quotation pricing",
    color: "#D97706", // Amber
    badgeBg: "bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/40",
    badgeText: "text-amber-700 dark:text-amber-300",
  },
};

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

export default function RateTypeOrderAnalytics({
  leaderboards,
  isOrdersFetching,
  qtyBasis,
  selectedYears = [],
  selectedMonths = [],
  externalFilterCaption,
  className = "",
  portalHome,
  onSelectRateType,
  dataType: propDataType,
  onDataTypeChange,
}: RateTypeOrderAnalyticsProps) {
  const router = useRouter();
  const [metricMode, setMetricMode] = useState<MetricMode>("revenue");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [hoveredRateTypeId, setHoveredRateTypeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const effectiveDataType = propDataType ?? (qtyBasis === "dispatched" ? "billed" : "approved");
  const activeQtyBasis: QtyBasis = effectiveDataType === "billed" ? "dispatched" : "approved";

  const handleDataTypeChange = (type: "approved" | "billed") => {
    if (onDataTypeChange) {
      onDataTypeChange(type);
    }
  };

  const handleRateTypeClick = (rId: string, rName?: string) => {
    if (onSelectRateType) {
      onSelectRateType(rId, rName);
    } else if (portalHome) {
      router.push(`${portalHome}/sales-analytics/orders/rate-type/${encodeURIComponent(rId)}`);
    }
  };

  // 1. Fetch orders list to count unique buying parties and line items per rate type
  const { data: rawOrdersData, isFetching: isRawOrdersFetching } = useListOrdersQuery({
    view: "list",
    limit: "2000",
  });

  // 2. Aggregate rate type metrics
  const { rateTypeRows, totalVolume, totalRevenue, totalUniqueParties } = useMemo(() => {
    const rateTotals = {
      SR: { volume: 0, revenue: 0, parties: new Set<string>(), orderCount: 0, lineCount: 0 },
      SRA: { volume: 0, revenue: 0, parties: new Set<string>(), orderCount: 0, lineCount: 0 },
      CR: { volume: 0, revenue: 0, parties: new Set<string>(), orderCount: 0, lineCount: 0 },
      OTHER: { volume: 0, revenue: 0, parties: new Set<string>(), orderCount: 0, lineCount: 0 },
    };

    const globalParties = new Set<string>();

    // Strategy A: If leaderboards data is available from summary, sum directly for exact matches
    const partyLeaderboards = leaderboards?.parties ?? [];
    if (partyLeaderboards.length > 0) {
      for (const row of partyLeaderboards) {
        if (row.name) globalParties.add(row.name);
        rateTotals.SR.volume += row.quantity?.sr ?? 0;
        rateTotals.SR.revenue += row.volume?.sr ?? 0;

        rateTotals.SRA.volume += row.quantity?.sra ?? 0;
        rateTotals.SRA.revenue += row.volume?.sra ?? 0;

        rateTotals.CR.volume += row.quantity?.cr ?? 0;
        rateTotals.CR.revenue += row.volume?.cr ?? 0;
      }
    }

    // Strategy B: Scan orders for accurate party counts, order counts, and fallback calculations
    const ordersList = extractArray(rawOrdersData);
    for (const order of ordersList) {
      if (!shouldIncludeOrder(order, activeQtyBasis)) continue;

      const pId = extractId(order.party);
      if (pId) globalParties.add(pId);

      const items = Array.isArray(order.order_items) ? order.order_items : [];
      const orderHitRateTypes = new Set<string>();

      for (const item of items) {
        const rawCode = String((item as Record<string, unknown>).applied_rate_type ?? "SR").toUpperCase();
        const code = normalizeRateType(rawCode);
        let key: keyof typeof rateTotals = "SR";

        if (code === "SRA") key = "SRA";
        else if (code === "CR") key = "CR";
        else if (code === "SR") key = "SR";
        else key = "OTHER";

        orderHitRateTypes.add(key);
        rateTotals[key].lineCount += 1;
        if (pId) rateTotals[key].parties.add(pId);

        // If partyLeaderboards was empty, accumulate volume and revenue directly from order items
        if (partyLeaderboards.length === 0) {
          const qty = itemMetricValue(item, "quantity", activeQtyBasis, items);
          const rev = itemMetricValue(item, "volume", activeQtyBasis, items);
          rateTotals[key].volume += qty;
          rateTotals[key].revenue += rev;
        }
      }

      for (const rKey of orderHitRateTypes) {
        rateTotals[rKey as keyof typeof rateTotals].orderCount += 1;
      }
    }

    const rows = (["SR", "SRA", "CR", "OTHER"] as const)
      .map((code) => {
        const meta = RATE_TYPE_CONFIG[code];
        const data = rateTotals[code];
        return {
          id: code,
          code,
          name: meta.name,
          shortDescription: meta.shortDescription,
          color: meta.color,
          badgeBg: meta.badgeBg,
          badgeText: meta.badgeText,
          volume: data.volume,
          revenue: data.revenue,
          partiesCount: data.parties.size,
          orderCount: data.orderCount,
          lineCount: data.lineCount,
        };
      })
      .filter((r) => r.volume > 0 || r.revenue > 0 || r.id !== "OTHER");

    const sumVol = rows.reduce((acc, r) => acc + r.volume, 0);
    const sumRev = rows.reduce((acc, r) => acc + r.revenue, 0);

    const rowsWithPcts = rows
      .map((r) => {
        const primaryValue = metricMode === "revenue" ? r.revenue : r.volume;
        const totalPrimary = metricMode === "revenue" ? sumRev : sumVol;
        const pct = totalPrimary > 0 ? (primaryValue / totalPrimary) * 100 : 0;
        return {
          ...r,
          pct: Math.round(pct * 10) / 10,
          primaryValue,
        };
      })
      .sort((a, b) => {
        if (metricMode === "quantity") return b.volume - a.volume;
        return b.revenue - a.revenue;
      });

    return {
      rateTypeRows: rowsWithPcts,
      totalVolume: sumVol,
      totalRevenue: sumRev,
      totalUniqueParties: globalParties.size,
    };
  }, [leaderboards, rawOrdersData, activeQtyBasis, metricMode]);

  // 3. Filtered rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rateTypeRows;
    const q = searchQuery.toLowerCase().trim();
    return rateTypeRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.shortDescription.toLowerCase().includes(q),
    );
  }, [rateTypeRows, searchQuery]);

  // 4. Overall realization and dual-metric shares
  const overallRealization = useMemo(() => {
    return totalVolume > 0 ? totalRevenue / totalVolume : 0;
  }, [totalRevenue, totalVolume]);

  const enrichedRateTypes = useMemo(() => {
    return rateTypeRows.map((r) => {
      const revShare = totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0;
      const volShare = totalVolume > 0 ? (r.volume / totalVolume) * 100 : 0;
      const realization = r.volume > 0 ? r.revenue / r.volume : 0;
      const diffPct =
        overallRealization > 0
          ? ((realization - overallRealization) / overallRealization) * 100
          : 0;
      return {
        ...r,
        revShare: Math.round(revShare * 10) / 10,
        volShare: Math.round(volShare * 10) / 10,
        realization: Math.round(realization),
        diffPct: Math.round(diffPct * 10) / 10,
      };
    });
  }, [rateTypeRows, totalRevenue, totalVolume, overallRealization]);

  // CSV download
  const handleDownloadCsv = () => {
    const headers = [
      "Rate Type Code",
      "Rate Type Name",
      "Buying Parties Count",
      effectiveDataType === "billed" ? "Billed Quantity (Qty)" : "Approved Quantity (Qty)",
      effectiveDataType === "billed" ? "Billed Revenue (INR)" : "Approved Revenue (INR)",
      "Percentage Share (%)",
    ];

    const rows = rateTypeRows.map((r) => [
      r.code,
      r.name,
      r.partiesCount,
      r.volume,
      r.revenue.toFixed(2),
      `${r.pct}%`,
    ]);

    rows.push([
      "Total",
      "All Rate Types",
      totalUniqueParties,
      totalVolume,
      totalRevenue.toFixed(2),
      "100%",
    ]);

    const filename = reportFilename(
      `rate_type_order_analytics_${effectiveDataType}`,
      selectedYears,
      selectedMonths,
    );
    downloadCsvFile(filename, headers, rows);
  };

  const isLoading = isOrdersFetching || isRawOrdersFetching;

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm dark:border-white/10 dark:bg-slate-900 ${className}`}
    >
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xs">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Rate Type-Wise Order Analytics
              </h2>
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                {rateTypeRows.length} Pricing Structures
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {externalFilterCaption
                ? `Distribution for ${externalFilterCaption} (${
                    effectiveDataType === "billed" ? "Billed Data" : "Approved Data"
                  })`
                : `Commercial distribution across Standard (SR), Special (SRA), and Company (CR) rate types`}
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
              title="Price Realization & Share Matrix"
              onClick={() => setViewMode("chart")}
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "chart"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5" />
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
            disabled={rateTypeRows.length === 0}
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
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
            <p className="text-xs text-slate-500">Loading rate type analytics…</p>
          </div>
        </div>
      ) : rateTypeRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
            <Tag className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            No rate type order data found
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 max-w-sm">
            There are no orders mapped to commercial rate types in the selected period.
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
            {/* ── PRICE REALIZATION & DUAL-METRIC COMPARISON PANEL ────────────────── */}
            {(viewMode === "split" || viewMode === "chart") && (
              <div
                className={`flex flex-col rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-slate-900 shadow-2xs ${
                  viewMode === "split" ? "lg:col-span-6" : "w-full max-w-4xl mx-auto"
                }`}
              >
                {/* Header & Benchmark Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-white/5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300">
                        <Scale className="h-4 w-4" />
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Pricing Realization & Contribution Matrix
                      </h4>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Revenue Share vs Volume Share exposing pricing power and margin differential
                    </p>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl bg-purple-50/80 px-3 py-1.5 border border-purple-200/60 dark:bg-purple-950/40 dark:border-purple-800/40 shrink-0">
                    <Coins className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700/80 dark:text-purple-300/80">
                        Catalog Avg Realization
                      </div>
                      <div className="text-xs sm:text-sm font-extrabold text-purple-950 dark:text-purple-100">
                        ₹{overallRealization.toLocaleString("en-IN", { maximumFractionDigits: 0 })} <span className="text-[10px] font-semibold text-purple-700/70 dark:text-purple-300/70">/ Qty</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metric Legend */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-xs bg-blue-500" />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Revenue %</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Volume %</span>
                    </span>
                  </div>
                  <span className="hidden sm:inline text-[11px] text-slate-400 dark:text-slate-500">
                    Click card to view details
                  </span>
                </div>

                {/* Cards for each rate type */}
                <div className="mt-3 space-y-2.5">
                  {enrichedRateTypes.map((r) => {
                    const isHovered = hoveredRateTypeId === r.id;
                    const isPremium = r.diffPct > 0;
                    const isDiscount = r.diffPct < 0;

                    return (
                      <div
                        key={r.id}
                        onClick={() => handleRateTypeClick(r.id, r.name)}
                        onMouseEnter={() => setHoveredRateTypeId(r.id)}
                        onMouseLeave={() => setHoveredRateTypeId(null)}
                        className={`group rounded-xl border p-3 transition cursor-pointer ${
                          isHovered
                            ? "border-purple-400 bg-purple-50/30 dark:border-purple-600 dark:bg-purple-950/20 shadow-xs"
                            : "border-slate-200/80 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800/40 dark:hover:border-white/20"
                        }`}
                      >
                        {/* Top row: Rate info + Price Realization Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: r.color }}
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900 group-hover:text-purple-600 dark:text-slate-100 dark:group-hover:text-purple-400 transition-colors">
                                  {r.name}
                                </span>
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${r.badgeBg} ${r.badgeText}`}>
                                  {r.code}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                {r.shortDescription}
                              </p>
                            </div>
                          </div>

                          {/* Price Realization & Premium/Discount badge */}
                          <div className="text-right shrink-0">
                            <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                              ₹{r.realization.toLocaleString("en-IN")} <span className="text-[10px] font-medium text-slate-400">/ Qty</span>
                            </div>
                            <div className="mt-0.5">
                              {isPremium ? (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/40">
                                  <ArrowUpRight className="h-2.5 w-2.5" />
                                  +{r.diffPct}% Premium
                                </span>
                              ) : isDiscount ? (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/40">
                                  <ArrowDownRight className="h-2.5 w-2.5" />
                                  {r.diffPct}% Discount
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  At Par
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Paired comparison bars */}
                        <div className="mt-2.5 space-y-1.5">
                          {/* Revenue Bar */}
                          <div>
                            <div className="flex justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                              <span>Revenue: <strong className="text-slate-900 dark:text-slate-200">{formatMoney(r.revenue)}</strong></span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">{r.revShare}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(r.revShare, r.revShare > 0 ? 3 : 0))}%` }}
                              />
                            </div>
                          </div>

                          {/* Volume Bar */}
                          <div>
                            <div className="flex justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                              <span>Quantity: <strong className="text-slate-900 dark:text-slate-200">{formatQuantity(r.volume)}</strong></span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{r.volShare}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(r.volShare, r.volShare > 0 ? 3 : 0))}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Footer meta */}
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 pt-1.5 dark:border-white/5">
                          <span>{r.partiesCount} Buying Clients · {r.orderCount} Orders</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-purple-600 group-hover:underline dark:text-purple-400">
                            Details <ExternalLink className="h-3 w-3" />
                          </span>
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
                      Rate Type Breakdown Table
                    </span>
                  </div>

                  {rateTypeRows.length > 3 && (
                    <div className="relative w-full sm:w-48">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter rate types..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-purple-500 focus:outline-hidden dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
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
                          Rate Type
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider text-center">
                          Buying Parties
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider text-right">
                          {effectiveDataType === "billed" ? "Billed Qty" : "Approved Qty"}
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider text-right">
                          {effectiveDataType === "billed" ? "Billed Revenue (INR)" : "Approved Revenue (INR)"}
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
                      {filteredRows.map((rateType) => {
                        const isHovered = hoveredRateTypeId === rateType.id;
                        return (
                          <tr
                            key={rateType.id}
                            onClick={() => handleRateTypeClick(rateType.id, rateType.name)}
                            onMouseEnter={() => setHoveredRateTypeId(rateType.id)}
                            onMouseLeave={() => setHoveredRateTypeId(null)}
                            className={`transition cursor-pointer group ${
                              isHovered
                                ? "bg-purple-50/70 dark:bg-purple-950/40"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <td className="py-2.5 px-3 font-medium">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: rateType.color }}
                                />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[10px] font-extrabold ${rateType.badgeBg} ${rateType.badgeText}`}
                                    >
                                      {rateType.code}
                                    </span>
                                    <span className="font-semibold text-slate-900 group-hover:text-purple-600 dark:text-slate-100 dark:group-hover:text-purple-400 transition-colors">
                                      {rateType.name}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                                    {rateType.shortDescription}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                <Building2 className="h-3 w-3 text-slate-400" />
                                {rateType.partiesCount > 0 ? rateType.partiesCount : "—"}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-right font-medium">
                              {rateType.volume.toLocaleString("en-IN", {
                                maximumFractionDigits: 0,
                              })}
                            </td>

                            <td className="py-2.5 px-3 text-right font-medium">
                              {formatMoney(rateType.revenue)}
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-bold text-[11px] min-w-[36px]">
                                  {rateType.pct}%
                                </span>
                                <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                                  <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                      width: `${Math.min(100, rateType.pct)}%`,
                                      backgroundColor: rateType.color,
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
                                  handleRateTypeClick(rateType.id, rateType.name);
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900/60 transition cursor-pointer"
                                title={`View ${rateType.name} Details`}
                              >
                                <span>View Rate</span>
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
                          Total ({rateTypeRows.length} Pricing Types)
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
                        <td className="py-2.5 px-3 text-right text-purple-600 dark:text-purple-400 font-extrabold">
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
