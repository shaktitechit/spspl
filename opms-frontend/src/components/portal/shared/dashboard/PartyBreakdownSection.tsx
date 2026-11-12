"use client";

import { useMemo, useState } from "react";
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

export interface PartyBreakdownRow {
  id: string;
  name: string;
  city?: string;
  state?: string;
  color?: string;
  quantity: number;
  revenue: number;
  orderCount: number;
  pct?: number;
  primaryValue?: number;
}

export interface PartyBreakdownSectionProps {
  partyRows: PartyBreakdownRow[];
  totalQuantity: number;
  totalRevenue: number;
  title: string;
  subtitle?: string;
  dataType?: "approved" | "billed";
  onDataTypeChange?: (type: "approved" | "billed") => void;
  portalHome?: string;
  onSelectParty?: (partyId: string, partyName?: string) => void;
  onExportCsv?: () => void;
  className?: string;
}

const DEFAULT_PARTY_PALETTE = [
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

export default function PartyBreakdownSection({
  partyRows,
  totalQuantity,
  totalRevenue,
  title,
  subtitle,
  dataType = "approved",
  onDataTypeChange,
  portalHome,
  onSelectParty,
  onExportCsv,
  className = "",
}: PartyBreakdownSectionProps) {
  const [metricMode, setMetricMode] = useState<"revenue" | "quantity">("revenue");
  const [viewMode, setViewMode] = useState<"split" | "chart" | "table">("split");
  const [cutoffLimit, setCutoffLimit] = useState<number | "all">(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredPartyId, setHoveredPartyId] = useState<string | null>(null);

  // 1. Enrich rows with dynamic sorting & shares based on active metricMode
  const enrichedRows = useMemo(() => {
    const list = [...partyRows].sort((a, b) => {
      if (metricMode === "revenue") return b.revenue - a.revenue;
      return b.quantity - a.quantity;
    });

    const primaryTotal = metricMode === "revenue" ? totalRevenue : totalQuantity;

    return list.map((p, idx) => {
      const primaryValue = metricMode === "revenue" ? p.revenue : p.quantity;
      const pct = primaryTotal > 0 ? (primaryValue / primaryTotal) * 100 : 0;
      const color = p.color || DEFAULT_PARTY_PALETTE[idx % DEFAULT_PARTY_PALETTE.length];
      return {
        ...p,
        color,
        pct: Math.round(pct * 10) / 10,
        primaryValue,
      };
    });
  }, [partyRows, metricMode, totalRevenue, totalQuantity]);

  // 2. Max metric value for relative bar widths
  const maxPartyMetric = useMemo(
    () => (enrichedRows.length > 0 ? enrichedRows[0].primaryValue || 1 : 1),
    [enrichedRows],
  );

  // 3. Top 5 Pareto Share
  const top5Share = useMemo(() => {
    const sum = enrichedRows.slice(0, 5).reduce((acc, p) => acc + (p.pct || 0), 0);
    return Math.round(sum * 10) / 10;
  }, [enrichedRows]);

  // 4. ABC Account Classification
  const abcClassification = useMemo(() => {
    let tierACount = 0;
    let tierARev = 0;
    let tierBCount = 0;
    let tierBRev = 0;
    let tierCCount = 0;
    let tierCRev = 0;

    for (const p of enrichedRows) {
      if (p.revenue >= 1000000) {
        tierACount += 1;
        tierARev += p.revenue;
      } else if (p.revenue >= 200000) {
        tierBCount += 1;
        tierBRev += p.revenue;
      } else {
        tierCCount += 1;
        tierCRev += p.revenue;
      }
    }

    return {
      tierA: { count: tierACount, rev: tierARev },
      tierB: { count: tierBCount, rev: tierBRev },
      tierC: { count: tierCCount, rev: tierCRev },
    };
  }, [enrichedRows]);

  // 5. Filtered rows by cutoff limit for chart
  const displayedChartRows = useMemo(() => {
    if (cutoffLimit === "all") return enrichedRows;
    return enrichedRows.slice(0, cutoffLimit);
  }, [enrichedRows, cutoffLimit]);

  // 6. Aggregated Remainder for chart
  const otherPartiesData = useMemo(() => {
    if (cutoffLimit === "all" || enrichedRows.length <= cutoffLimit) return null;
    const remaining = enrichedRows.slice(cutoffLimit);
    const count = remaining.length;
    const revenue = remaining.reduce((acc, p) => acc + p.revenue, 0);
    const volume = remaining.reduce((acc, p) => acc + p.quantity, 0);
    const pct = Math.round(remaining.reduce((acc, p) => acc + (p.pct || 0), 0) * 10) / 10;
    const orders = remaining.reduce((acc, p) => acc + p.orderCount, 0);
    return { count, revenue, volume, pct, orders };
  }, [enrichedRows, cutoffLimit]);

  // 7. Filtered rows for table search
  const filteredTableRows = useMemo(() => {
    if (!searchQuery.trim()) return enrichedRows;
    const q = searchQuery.toLowerCase().trim();
    return enrichedRows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.state && p.state.toLowerCase().includes(q)),
    );
  }, [enrichedRows, searchQuery]);

  // 8. Navigation handler
  const handlePartyClick = (partyId: string, partyName: string) => {
    if (onSelectParty) {
      onSelectParty(partyId, partyName);
      return;
    }
    if (portalHome) {
      window.open(
        `${portalHome}/sales-analytics/parties?partyId=${encodeURIComponent(partyId)}`,
        "_self",
      );
    }
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm dark:border-white/10 dark:bg-slate-900 ${className}`}
    >
      {/* ── SECTION HEADER & CONTROLS ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {title}
              </h3>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {enrichedRows.length} {enrichedRows.length === 1 ? "Client" : "Clients"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subtitle ||
                `Dealer & enterprise ordering concentration (${
                  dataType === "billed" ? "Billed Data" : "Approved Data"
                })`}
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Approved vs Billed Data Switch */}
          {onDataTypeChange && (
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => onDataTypeChange("approved")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  dataType === "approved"
                    ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Approved Data
              </button>
              <button
                type="button"
                onClick={() => onDataTypeChange("billed")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  dataType === "billed"
                    ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Billed Data
              </button>
            </div>
          )}

          {/* Metric Selector: Revenue vs Quantity */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setMetricMode("revenue")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                metricMode === "revenue"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              Revenue (₹)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("quantity")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                metricMode === "quantity"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              Quantity (Qty)
            </button>
          </div>

          {/* View Mode Toggle: Split / Pareto Chart / Table */}
          <div className="hidden sm:inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-slate-800">
            <button
              type="button"
              title="Split View (Pareto Bars + Table)"
              onClick={() => setViewMode("split")}
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "split"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Pareto Bar Chart Only"
              onClick={() => setViewMode("chart")}
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "chart"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Table View Only"
              onClick={() => setViewMode("table")}
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Export CSV */}
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              disabled={enrichedRows.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* ── EMPTY STATE ──────────────────────────────────────────────────────── */}
      {enrichedRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
            No party order activity recorded for this period.
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
            {/* ── 1. RANKED PARETO CLIENT BAR CHART PANEL ──────────────────────── */}
            {(viewMode === "split" || viewMode === "chart") && (
              <div
                className={`flex flex-col rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-slate-900 shadow-2xs ${
                  viewMode === "split" ? "lg:col-span-6" : "w-full max-w-4xl mx-auto"
                }`}
              >
                {/* Header with Cutoff Limit Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                        <BarChart3 className="h-4 w-4" />
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Client Concentration & Pareto Ranking
                      </h4>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Ranked by {metricMode === "revenue" ? "Revenue" : "Quantity"} contribution
                    </p>
                  </div>

                  {/* Cutoff Selector */}
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-slate-800 self-start sm:self-auto">
                    {[5, 10, 20, "all" as const].map((limit) => (
                      <button
                        key={String(limit)}
                        type="button"
                        onClick={() => setCutoffLimit(limit)}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer ${
                          cutoffLimit === limit
                            ? "bg-white text-emerald-700 shadow-2xs dark:bg-slate-900 dark:text-emerald-300"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                        }`}
                      >
                        {limit === "all" ? "All" : `Top ${limit}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pareto Insight Pill */}
                <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50/70 px-3 py-2 text-xs border border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/40">
                  <div className="flex items-center gap-2 text-emerald-950 dark:text-emerald-200">
                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Top 5 clients drive{" "}
                      <strong className="font-extrabold text-emerald-700 dark:text-emerald-300">
                        {top5Share}%
                      </strong>{" "}
                      of total {metricMode === "revenue" ? "revenue" : "quantity"}.
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0 hidden sm:inline">
                    {enrichedRows.length} Accounts
                  </span>
                </div>

                {/* ABC Account Tiering Badges */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-blue-200/60 bg-blue-50/50 p-2 dark:border-blue-900/40 dark:bg-blue-950/20 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block">
                      Tier A (Key)
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                      {abcClassification.tierA.count} Accounts
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {formatMoney(abcClassification.tierA.rev)}
                    </span>
                  </div>
                  <div className="rounded-lg border border-teal-200/60 bg-teal-50/50 p-2 dark:border-teal-900/40 dark:bg-teal-950/20 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 block">
                      Tier B (Growth)
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                      {abcClassification.tierB.count} Accounts
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {formatMoney(abcClassification.tierB.rev)}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200/60 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-800/20 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                      Tier C (Retail)
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                      {abcClassification.tierC.count} Accounts
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {formatMoney(abcClassification.tierC.rev)}
                    </span>
                  </div>
                </div>

                {/* Ranked Horizontal Bars List */}
                <div className="mt-3.5 space-y-2 max-h-[360px] overflow-y-auto scrollbar-none pr-1">
                  {displayedChartRows.map((party, idx) => {
                    const relativeWidth =
                      maxPartyMetric > 0
                        ? Math.max(
                            4,
                            Math.round(
                              ((party.primaryValue || 0) / maxPartyMetric) * 100,
                            ),
                          )
                        : 0;
                    const isHovered = hoveredPartyId === party.id;

                    return (
                      <div
                        key={party.id}
                        onMouseEnter={() => setHoveredPartyId(party.id)}
                        onMouseLeave={() => setHoveredPartyId(null)}
                        onClick={() => handlePartyClick(party.id, party.name)}
                        className={`group rounded-lg border p-2 transition cursor-pointer ${
                          isHovered
                            ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-700 dark:bg-emerald-950/30 shadow-2xs"
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
                              style={{ backgroundColor: party.color }}
                            />
                            <span className="font-semibold text-slate-900 group-hover:text-emerald-600 dark:text-slate-100 dark:group-hover:text-emerald-400 truncate transition-colors">
                              {party.name}
                            </span>
                            {party.city && (
                              <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {party.city}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 shrink-0">
                              ({party.orderCount} {party.orderCount === 1 ? "order" : "orders"})
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {metricMode === "revenue"
                                ? formatMoney(party.revenue)
                                : formatQuantity(party.quantity)}
                            </span>
                            <span className="ml-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              {party.pct}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${relativeWidth}%`,
                              backgroundColor: party.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Aggregated Other Parties Row */}
                  {otherPartiesData && (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-2 dark:border-white/10 dark:bg-slate-800/20">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Other Clients ({otherPartiesData.count})
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({otherPartiesData.orders} orders)
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {metricMode === "revenue"
                              ? formatMoney(otherPartiesData.revenue)
                              : formatQuantity(otherPartiesData.volume)}
                          </span>
                          <span className="ml-1.5 text-[11px] font-semibold text-slate-500">
                            {otherPartiesData.pct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── 2. DATA TABLE PANEL ────────────────────────────────────────── */}
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
                      Client Performance Ledger
                    </span>
                  </div>

                  <div className="relative w-full sm:w-48">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search clients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Table Component */}
                <div className="overflow-x-auto scrollbar-none flex-1 max-h-[460px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/90 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 border-b border-slate-100 dark:border-white/5 sticky top-0 z-10 backdrop-blur-xs">
                      <tr>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider">
                          Client / Dealer
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider text-right">
                          {dataType === "billed" ? "Billed Qty" : "Approved Qty"}
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider text-right">
                          {dataType === "billed" ? "Billed Revenue" : "Approved Revenue"}
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider text-right">
                          Share
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase text-[10px] tracking-wider text-center">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {filteredTableRows.map((party) => {
                        const isHovered = hoveredPartyId === party.id;
                        return (
                          <tr
                            key={party.id}
                            onMouseEnter={() => setHoveredPartyId(party.id)}
                            onMouseLeave={() => setHoveredPartyId(null)}
                            onClick={() => handlePartyClick(party.id, party.name)}
                            className={`transition cursor-pointer ${
                              isHovered
                                ? "bg-emerald-50/50 dark:bg-emerald-950/30"
                                : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: party.color }}
                                />
                                <div className="min-w-0">
                                  <span className="font-semibold text-slate-900 group-hover:text-emerald-600 dark:text-slate-100 block truncate max-w-[170px]">
                                    {party.name}
                                  </span>
                                  {party.city && (
                                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5 truncate">
                                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                                      {party.city}
                                      {party.state ? `, ${party.state}` : ""}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                              {formatQuantity(party.quantity)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                              {formatMoney(party.revenue)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              {party.pct}%
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
                                View <ExternalLink className="h-3 w-3" />
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
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

