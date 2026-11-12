"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Crown,
  Download,
  ExternalLink,
  Layers,
  Medal,
  Search,
  Table as TableIcon,
  Trophy,
  UserCheck,
  UserRound,
} from "lucide-react";

import { useListUsersQuery, useListOrdersQuery } from "@/store/api";
import type { DashboardOrdersSummary } from "@/store/api/slices/dashboardApi";
import { downloadCsvFile, reportFilename } from "./reportDownloadUtils";
import { shouldIncludeOrder } from "./featuredMatrixUtils";
import { itemMetricValue, type QtyBasis } from "./leaderboardUtils";
import { buildUserNameById, resolveUserDisplay } from "@/components/portal/shared/lib/userDisplay";

export interface SalesPersonOrderAnalyticsProps {
  contributions?: DashboardOrdersSummary["contributions"];
  leaderboards?: DashboardOrdersSummary["leaderboards"];
  salesUsersById?: Record<string, string>;
  isOrdersFetching: boolean;
  qtyBasis?: string;
  selectedYears?: number[];
  selectedMonths?: number[];
  externalFilterCaption?: string;
  className?: string;
  portalHome?: string;
  onSelectSalesPerson?: (salesPersonId: string, salesPersonName?: string) => void;
  dataType?: "approved" | "billed";
  onDataTypeChange?: (type: "approved" | "billed") => void;
}

type MetricMode = "quantity" | "revenue";
type ViewMode = "split" | "chart" | "table";

const SALES_PERSON_PALETTE = [
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

export default function SalesPersonOrderAnalytics({
  contributions = [],
  leaderboards,
  salesUsersById: propSalesUsersById,
  isOrdersFetching,
  selectedYears = [],
  selectedMonths = [],
  externalFilterCaption,
  className = "",
  portalHome,
  onSelectSalesPerson,
  dataType: propDataType,
  onDataTypeChange,
}: SalesPersonOrderAnalyticsProps) {
  const router = useRouter();
  const [metricMode, setMetricMode] = useState<MetricMode>("revenue");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const localDataType = propDataType ?? "approved";
  const activeQtyBasis = (propDataType === "billed" ? "dispatched" : "approved") as QtyBasis;

  // 1. Fetch Users List to map IDs, names, and emails
  const { data: usersData, isFetching: isUsersFetching } = useListUsersQuery({});

  // 2. Fetch Raw Orders for fallback granular aggregations
  const { data: rawOrdersData, isFetching: isRawOrdersFetching } = useListOrdersQuery({
    limit: "10000",
  });

  const userNameMap = useMemo(() => {
    const fromUsers = buildUserNameById(usersData);
    return { ...fromUsers, ...(propSalesUsersById || {}) };
  }, [usersData, propSalesUsersById]);

  const userMetaMap = useMemo(() => {
    const map = new Map<string, { name: string; email: string; role: string }>();
    const list = extractArray(usersData);
    for (const u of list) {
      const id = extractId(u._id ?? u.id);
      if (!id) continue;
      const name = String(u.name || u.username || "User").trim();
      const email = String(u.email || "").trim();
      const role = String(u.access_role || u.role || "sales").trim();
      map.set(id, { name, email, role });
    }
    return map;
  }, [usersData]);

  // 3. Aggregate Sales Person Analytics
  const {
    salesPersonRows,
    totalQuantity,
    totalRevenue,
    distinctPersonsCount,
  } = useMemo(() => {
    const personMap = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        role: string;
        quantity: number;
        revenue: number;
        parties: Set<string>;
        orderCount: number;
      }
    >();

    // Strategy A: Aggregate from contributions (fast & period-filtered)
    if (contributions && contributions.length > 0) {
      for (const cell of contributions) {
        const uId = cell.salesUserId || "unassigned";
        const meta = userMetaMap.get(uId);
        const name =
          cell.salesUserName ||
          meta?.name ||
          userNameMap[uId] ||
          (uId === "unassigned" ? "Unassigned Sales" : `Rep ${uId.slice(-6)}`);

        let rec = personMap.get(uId);
        if (!rec) {
          rec = {
            id: uId,
            name,
            email: meta?.email || "",
            role: meta?.role || "sales",
            quantity: 0,
            revenue: 0,
            parties: new Set<string>(),
            orderCount: 0,
          };
          personMap.set(uId, rec);
        }

        rec.quantity += Number(cell.quantity) || 0;
        rec.revenue += Number(cell.volume) || 0;
        if (cell.partyId) rec.parties.add(cell.partyId);
      }
    }

    // Strategy B: Scan Raw Orders to enrich party counts, order counts, or fallback calculations
    const ordersList = extractArray(rawOrdersData);
    for (const order of ordersList) {
      if (!shouldIncludeOrder(order, activeQtyBasis)) continue;

      const rawSalesUser = order.assigned_sales_user;
      const uId = extractId(rawSalesUser) || "unassigned";
      const meta = userMetaMap.get(uId);
      const name =
        resolveUserDisplay(rawSalesUser, userNameMap) ||
        meta?.name ||
        (uId === "unassigned" ? "Unassigned Sales" : `Rep ${uId.slice(-6)}`);

      let rec = personMap.get(uId);
      if (!rec) {
        rec = {
          id: uId,
          name,
          email: meta?.email || "",
          role: meta?.role || "sales",
          quantity: 0,
          revenue: 0,
          parties: new Set<string>(),
          orderCount: 0,
        };
        personMap.set(uId, rec);
      }

      rec.orderCount += 1;
      const pId = extractId(order.party);
      if (pId) rec.parties.add(pId);

      // If contributions was empty, sum line item metrics directly
      if (!contributions || contributions.length === 0) {
        const items = Array.isArray(order.order_items) ? order.order_items : [];
        for (const item of items) {
          rec.quantity += itemMetricValue(item, "quantity", activeQtyBasis, items);
          rec.revenue += itemMetricValue(item, "volume", activeQtyBasis, items);
        }
      }
    }

    // Fallback C: If personMap is still empty, populate from leaderboards.salesUsers
    if (personMap.size === 0 && leaderboards?.salesUsers) {
      for (const row of leaderboards.salesUsers) {
        const name = row.name || "Sales Rep";
        const qty = row.quantity?.total ?? 0;
        const rev = row.volume?.total ?? 0;
        personMap.set(name, {
          id: name,
          name,
          email: "",
          role: "sales",
          quantity: qty,
          revenue: rev,
          parties: new Set<string>(),
          orderCount: 1,
        });
      }
    }

    const list = Array.from(personMap.values())
      .filter((p) => p.quantity > 0 || p.revenue > 0)
      .sort((a, b) => {
        if (metricMode === "quantity") return b.quantity - a.quantity;
        return b.revenue - a.revenue;
      });

    const sumQty = list.reduce((acc, p) => acc + p.quantity, 0);
    const sumRev = list.reduce((acc, p) => acc + p.revenue, 0);

    const rowsWithColors = list.map((p, idx) => {
      const color = SALES_PERSON_PALETTE[idx % SALES_PERSON_PALETTE.length];
      const primaryValue = metricMode === "revenue" ? p.revenue : p.quantity;
      const totalPrimary = metricMode === "revenue" ? sumRev : sumQty;
      const pct = totalPrimary > 0 ? (primaryValue / totalPrimary) * 100 : 0;

      return {
        ...p,
        partiesCount: p.parties.size,
        color,
        pct: Math.round(pct * 10) / 10,
        primaryValue,
      };
    });

    return {
      salesPersonRows: rowsWithColors,
      totalQuantity: sumQty,
      totalRevenue: sumRev,
      distinctPersonsCount: list.length,
    };
  }, [
    contributions,
    rawOrdersData,
    activeQtyBasis,
    leaderboards,
    userMetaMap,
    userNameMap,
    metricMode,
  ]);

  // Filtered rows for search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return salesPersonRows;
    const q = searchQuery.toLowerCase().trim();
    return salesPersonRows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q),
    );
  }, [salesPersonRows, searchQuery]);

  // Top 3 Podium and ranking metrics
  const topPerformers = useMemo(
    () => salesPersonRows.slice(0, 3),
    [salesPersonRows],
  );
  const maxMetricValue = useMemo(
    () => (salesPersonRows.length > 0 ? salesPersonRows[0].primaryValue : 1),
    [salesPersonRows],
  );

  // Navigate to Sales Person Details
  const handlePersonClick = (personId: string, personName: string) => {
    if (onSelectSalesPerson) {
      onSelectSalesPerson(personId, personName);
      return;
    }
    if (portalHome) {
      router.push(`${portalHome}/sales-analytics/orders/sales-person/${encodeURIComponent(personId)}`);
    }
  };

  // CSV Export handler
  const handleExportCsv = () => {
    const headers = [
      "Sales Representative",
      "Email",
      "Role",
      `Total Quantity (Qty)`,
      "Total Revenue (INR)",
      "Active Buying Parties",
      "Order Count",
      "Share (%)",
    ];

    const data = filteredRows.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.email.replace(/"/g, '""')}"`,
      `"${p.role.replace(/"/g, '""')}"`,
      p.quantity.toFixed(2),
      p.revenue.toFixed(2),
      p.partiesCount,
      p.orderCount,
      `${p.pct}%`,
    ]);

    data.push([
      "Total",
      "",
      "",
      totalQuantity.toFixed(2),
      totalRevenue.toFixed(2),
      "",
      "",
      "100%",
    ]);

    const filename = reportFilename(
      `salespersons_order_analytics_${localDataType}`,
      selectedYears,
      selectedMonths,
    );
    downloadCsvFile(filename, headers, data);
  };

  const isLoading = isOrdersFetching || isUsersFetching || isRawOrdersFetching;

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-white/10 dark:bg-slate-900 ${className}`}
    >
      {/* ── HEADER & TOOLBAR ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <UserRound className="h-4 w-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Sales Person Wise Order Analytics
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Portfolio distribution of order volume, revenue, and active client coverage across sales executives.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Approved vs Billed Data Switch */}
          {onDataTypeChange && (
            <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 border border-slate-200/60 dark:border-white/5">
              <button
                type="button"
                onClick={() => onDataTypeChange("approved")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  localDataType === "approved"
                    ? "bg-white text-blue-600 shadow-2xs dark:bg-slate-900 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Approved Data
              </button>
              <button
                type="button"
                onClick={() => onDataTypeChange("billed")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  localDataType === "billed"
                    ? "bg-white text-blue-600 shadow-2xs dark:bg-slate-900 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Billed Data
              </button>
            </div>
          )}

          {/* Metric Mode Toggle */}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setMetricMode("quantity")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                metricMode === "quantity"
                  ? "bg-white text-blue-600 shadow-2xs dark:bg-slate-900 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Quantity (Qty)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("revenue")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                metricMode === "revenue"
                  ? "bg-white text-blue-600 shadow-2xs dark:bg-slate-900 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Revenue (₹)
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode("split")}
              title="Split View"
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "split"
                  ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("chart")}
              title="Podium & Leaderboard View"
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "chart"
                  ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Trophy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View"
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── SEARCH & FILTER CAPTION ─────────────────────────────────────────── */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sales representatives..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-slate-800/60 dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-400"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {externalFilterCaption && (
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400 dark:text-slate-500">
              {externalFilterCaption}
            </span>
          )}
          <span>•</span>
          <span>
            {distinctPersonsCount} active {distinctPersonsCount === 1 ? "rep" : "reps"}
          </span>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="mt-8 flex h-60 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="text-xs">Loading sales person analytics...</span>
          </div>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center dark:border-white/10">
          <UserRound className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No sales person records found
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            No orders booked under the active date and status filters.
          </p>
        </div>
      ) : (
        <div
          className={`mt-6 grid gap-6 ${
            viewMode === "split"
              ? "grid-cols-1 lg:grid-cols-12"
              : viewMode === "chart"
              ? "grid-cols-1 max-w-2xl mx-auto"
              : "grid-cols-1"
          }`}
        >
          {/* PODIUM & PERFORMANCE VELOCITY LEADERBOARD */}
          {viewMode !== "table" && (
            <div
              className={`flex flex-col rounded-xl bg-white p-4 sm:p-5 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-2xs ${
                viewMode === "split" ? "lg:col-span-6" : "w-full max-w-4xl mx-auto"
              }`}
            >
              {/* Podium Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                      <Trophy className="h-4 w-4" />
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Sales Executive Podium & Velocity
                    </h4>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Leaderboard rankings, deal velocity, and portfolio revenue contribution
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total {localDataType === "billed" ? "Billed" : "Approved"}
                  </span>
                  <div className="text-xs sm:text-sm font-extrabold text-blue-600 dark:text-blue-400">
                    {metricMode === "revenue"
                      ? formatMoney(totalRevenue)
                      : formatQuantity(totalQuantity)}
                  </div>
                </div>
              </div>

              {/* ── TOP 3 PODIUM CARDS ──────────────────────────────────────── */}
              {topPerformers.length > 0 && (
                <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {topPerformers.map((person, idx) => {
                    const isGold = idx === 0;
                    const isSilver = idx === 1;

                    const cardBg = isGold
                      ? "border-amber-300/80 bg-gradient-to-b from-amber-50/70 to-white dark:border-amber-500/30 dark:from-amber-950/20 dark:to-slate-900 ring-1 ring-amber-400/20"
                      : isSilver
                      ? "border-slate-300/80 bg-gradient-to-b from-slate-100/60 to-white dark:border-slate-700 dark:from-slate-800/40 dark:to-slate-900"
                      : "border-orange-300/80 bg-gradient-to-b from-orange-50/60 to-white dark:border-orange-600/30 dark:from-orange-950/20 dark:to-slate-900";

                    const badgeStyle = isGold
                      ? "bg-amber-500 text-white"
                      : isSilver
                      ? "bg-slate-500 text-white"
                      : "bg-orange-500 text-white";

                    const badgeLabel = isGold ? "#1 Top" : isSilver ? "#2" : "#3";

                    const aov =
                      person.orderCount > 0
                        ? formatMoney(person.revenue / person.orderCount)
                        : formatMoney(person.revenue);

                    return (
                      <div
                        key={person.id}
                        onClick={() => handlePersonClick(person.id, person.name)}
                        className={`group relative rounded-xl border p-3 transition cursor-pointer hover:shadow-xs ${cardBg}`}
                      >
                        {/* Rank Pill */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shadow-2xs ${badgeStyle}`}
                          >
                            {isGold ? <Crown className="h-2.5 w-2.5" /> : <Medal className="h-2.5 w-2.5" />}
                            {badgeLabel}
                          </span>
                          <span className="text-[11px] font-black text-slate-900 dark:text-slate-100">
                            {person.pct}% share
                          </span>
                        </div>

                        {/* Name & Role */}
                        <div className="mt-2 flex items-center gap-2">
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: person.color }}
                          >
                            {person.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400 truncate transition-colors">
                              {person.name}
                            </h5>
                            <span className="text-[10px] text-slate-400 capitalize block truncate">
                              {person.role || "Sales Rep"}
                            </span>
                          </div>
                        </div>

                        {/* Primary Value */}
                        <div className="mt-2.5 text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100">
                          {metricMode === "revenue"
                            ? formatMoney(person.revenue)
                            : formatQuantity(person.quantity)}
                        </div>

                        {/* Throughput & Clients */}
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200/50 pt-1.5 dark:border-white/5">
                          <span>{person.orderCount} Deals · Avg {aov}</span>
                          <span>{person.partiesCount} Clients</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── RANKED VELOCITY BARS LIST ─────────────────────────────────── */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-2">
                  <span>Executive Velocity Ranking</span>
                  <span>{metricMode === "revenue" ? "Revenue" : "Quantity"} · Share</span>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-none pr-1">
                  {salesPersonRows.map((person, idx) => {
                    const relativeWidth =
                      maxMetricValue > 0
                        ? Math.max(4, Math.round((person.primaryValue / maxMetricValue) * 100))
                        : 0;

                    const isHovered = hoveredPersonId === person.id;

                    return (
                      <div
                        key={person.id}
                        onMouseEnter={() => setHoveredPersonId(person.id)}
                        onMouseLeave={() => setHoveredPersonId(null)}
                        onClick={() => handlePersonClick(person.id, person.name)}
                        className={`group rounded-lg border p-2 transition cursor-pointer ${
                          isHovered
                            ? "border-blue-300 bg-blue-50/40 dark:border-blue-700 dark:bg-blue-950/30"
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
                              style={{ backgroundColor: person.color }}
                            />
                            <span className="font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400 truncate transition-colors">
                              {person.name}
                            </span>
                            <span className="text-[10px] text-slate-400 hidden sm:inline">
                              ({person.orderCount} orders)
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {metricMode === "revenue"
                                ? formatMoney(person.revenue)
                                : formatQuantity(person.quantity)}
                            </span>
                            <span className="ml-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                              {person.pct}%
                            </span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${relativeWidth}%`,
                              backgroundColor: person.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* DATA TABLE */}
          {viewMode !== "chart" && (
            <div
              className={`overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 ${
                viewMode === "split" ? "lg:col-span-6" : ""
              }`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase font-semibold border-b border-slate-200/80 dark:border-white/10">
                    <tr>
                      <th className="py-2.5 px-3">Sales Person</th>
                      <th className="py-2.5 px-3 text-center">Parties</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Revenue</th>
                      <th className="py-2.5 px-3 text-right">Share</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-slate-900 font-medium">
                    {filteredRows.map((person) => {
                      const isHovered = hoveredPersonId === person.id;
                      return (
                        <tr
                          key={person.id}
                          onMouseEnter={() => setHoveredPersonId(person.id)}
                          onMouseLeave={() => setHoveredPersonId(null)}
                          onClick={() => handlePersonClick(person.id, person.name)}
                          className={`transition cursor-pointer ${
                            isHovered
                              ? "bg-blue-50/60 dark:bg-blue-950/40"
                              : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: person.color }}
                              />
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{person.name}</span>
                                  {person.id === "unassigned" && (
                                    <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] text-slate-500 dark:bg-slate-800">
                                      Unassigned
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {person.orderCount} {person.orderCount === 1 ? "order" : "orders"}
                                  {person.email ? ` • ${person.email}` : ""}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <UserCheck className="h-3 w-3 text-slate-500" />
                              <span>{person.partiesCount}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">
                            {person.quantity.toLocaleString("en-IN", {
                              maximumFractionDigits: 1,
                            })}{" "}
                            <span className="text-[10px] text-slate-400 font-normal">Qty</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">
                            {formatMoney(person.revenue)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {person.pct}%
                              </span>
                              <div className="h-1.5 w-12 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, person.pct)}%`,
                                    backgroundColor: person.color,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePersonClick(person.id, person.name);
                              }}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/60 cursor-pointer"
                            >
                              <span>View</span>
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white">
                    <tr>
                      <td className="py-2.5 px-3">
                        Total ({filteredRows.length} Sales Reps)
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {/* Distinct parties count */}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {totalQuantity.toLocaleString("en-IN", {
                          maximumFractionDigits: 1,
                        })}{" "}
                        <span className="text-[10px] font-normal text-slate-500">Qty</span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {formatMoney(totalRevenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right">100%</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
