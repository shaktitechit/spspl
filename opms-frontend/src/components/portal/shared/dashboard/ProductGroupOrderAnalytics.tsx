"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Download,
  ExternalLink,
  Layers,
  LayoutGrid,
  Package,
  Search,
  Table as TableIcon,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  useListProductGroupsQuery,
  useListProductsQuery,
  useListOrdersQuery,
} from "@/store/api";
import type { DashboardOrdersSummary } from "@/store/api/slices/dashboardApi";
import { reportFilename } from "./reportDownloadUtils";
import { useDashboardPdfExport } from "./dashboardPdfEngine";
import ReportDownloadButton from "./ReportDownloadButton";
import { shouldIncludeOrder } from "./featuredMatrixUtils";
import { itemMetricValue, type QtyBasis } from "./leaderboardUtils";

export interface ProductGroupOrderAnalyticsProps {
  contributions?: DashboardOrdersSummary["contributions"];
  isOrdersFetching: boolean;
  qtyBasis?: string;
  selectedYears?: number[];
  selectedMonths?: number[];
  externalFilterCaption?: string;
  className?: string;
  portalHome?: string;
  onSelectProductGroup?: (groupId: string, groupName?: string) => void;
  dataType?: "approved" | "billed";
  onDataTypeChange?: (type: "approved" | "billed") => void;
}

type MetricMode = "revenue" | "quantity";
type ViewMode = "split" | "chart" | "table";

const PRODUCT_GROUP_PALETTE = [
  "#2563EB", // Blue
  "#7C3AED", // Violet
  "#059669", // Emerald
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

export default function ProductGroupOrderAnalytics({
  contributions = [],
  isOrdersFetching,
  selectedYears = [],
  selectedMonths = [],
  externalFilterCaption,
  className = "",
  portalHome,
  onSelectProductGroup,
  dataType: propDataType,
  onDataTypeChange,
}: ProductGroupOrderAnalyticsProps) {
  const router = useRouter();
  const [metricMode, setMetricMode] = useState<MetricMode>("revenue");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const localDataType = propDataType ?? "approved";
  const activeQtyBasis = (propDataType === "billed" ? "dispatched" : "approved") as QtyBasis;

  // 1. Fetch Product Groups and Products catalogs
  const { data: groupsData, isFetching: isGroupsFetching } = useListProductGroupsQuery({
    limit: 1000,
  });
  const { data: productsData, isFetching: isProductsFetching } = useListProductsQuery({
    limit: "10000",
  });
  const { data: rawOrdersData, isFetching: isRawOrdersFetching } = useListOrdersQuery({
    limit: "10000",
  });

  // 2. Build product to product-group maps
  const { productToGroupMap, groupMetaMap } = useMemo(() => {
    const pToG = new Map<string, string>();
    const gMeta = new Map<string, { id: string; name: string; description: string }>();

    // Index product groups
    const groupsList = extractArray(groupsData);
    const groupByName = new Map<string, string>();

    for (const g of groupsList) {
      const gId = extractId(g._id ?? g.id);
      if (!gId) continue;
      const gName = String(g.name ?? "Untitled Group").trim();
      const gDesc = String(g.description ?? "").trim();
      gMeta.set(gId, { id: gId, name: gName, description: gDesc });
      groupByName.set(gName.toLowerCase(), gId);
    }

    // Index products to group
    const productsList = extractArray(productsData);
    for (const p of productsList) {
      const pId = extractId(p._id ?? p.id);
      if (!pId) continue;

      const groupRef = p.product_group;
      const refId = extractId(groupRef);
      if (refId && gMeta.has(refId)) {
        pToG.set(pId, refId);
      } else {
        const rawName = String(
          (groupRef as Record<string, unknown>)?.name || groupRef || ""
        ).trim().toLowerCase();
        if (rawName && groupByName.has(rawName)) {
          pToG.set(pId, groupByName.get(rawName)!);
        }
      }
    }

    gMeta.set("ungrouped", {
      id: "ungrouped",
      name: "Other / Uncategorized",
      description: "Products not assigned to a specific product group",
    });

    return { productToGroupMap: pToG, groupMetaMap: gMeta };
  }, [groupsData, productsData]);

  // 3. Aggregate Product Group metrics from contributions & raw orders
  const {
    productGroupRows,
    totalQuantity,
    totalRevenue,
    distinctGroupsCount,
  } = useMemo(() => {
    const groupMap = new Map<
      string,
      {
        id: string;
        name: string;
        description: string;
        quantity: number;
        revenue: number;
        products: Set<string>;
        parties: Set<string>;
        orderCount: number;
      }
    >();

    // Strategy A: Aggregate from contributions (fast & period-filtered)
    if (contributions && contributions.length > 0) {
      for (const cell of contributions) {
        const pId = cell.productId;
        const gId = (pId && productToGroupMap.get(pId)) || "ungrouped";
        const meta = groupMetaMap.get(gId) ?? {
          id: gId,
          name: gId === "ungrouped" ? "Other / Uncategorized" : "Product Group",
          description: "",
        };

        let rec = groupMap.get(gId);
        if (!rec) {
          rec = {
            id: gId,
            name: meta.name,
            description: meta.description,
            quantity: 0,
            revenue: 0,
            products: new Set<string>(),
            parties: new Set<string>(),
            orderCount: 0,
          };
          groupMap.set(gId, rec);
        }

        rec.quantity += Number(cell.quantity) || 0;
        rec.revenue += Number(cell.volume) || 0;
        if (pId) rec.products.add(pId);
        if (cell.partyId) rec.parties.add(cell.partyId);
      }
    }

    // Strategy B: Scan Raw Orders to enrich party counts, order counts, or fallback calculations
    const ordersList = extractArray(rawOrdersData);
    for (const order of ordersList) {
      if (!shouldIncludeOrder(order, activeQtyBasis)) continue;

      const pId = extractId(order.party);
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      const orderHitGroups = new Set<string>();

      for (const item of items) {
        const prodId = extractId(item.product ?? item.product_id);
        const gId = (prodId && productToGroupMap.get(prodId)) || "ungrouped";
        const meta = groupMetaMap.get(gId) ?? {
          id: gId,
          name: gId === "ungrouped" ? "Other / Uncategorized" : "Product Group",
          description: "",
        };

        orderHitGroups.add(gId);

        let rec = groupMap.get(gId);
        if (!rec) {
          rec = {
            id: gId,
            name: meta.name,
            description: meta.description,
            quantity: 0,
            revenue: 0,
            products: new Set<string>(),
            parties: new Set<string>(),
            orderCount: 0,
          };
          groupMap.set(gId, rec);
        }

        if (prodId) rec.products.add(prodId);
        if (pId) rec.parties.add(pId);

        // If contributions was empty, accumulate line item metrics directly
        if (!contributions || contributions.length === 0) {
          rec.quantity += itemMetricValue(item, "quantity", activeQtyBasis, items);
          rec.revenue += itemMetricValue(item, "volume", activeQtyBasis, items);
        }
      }

      for (const gId of orderHitGroups) {
        const r = groupMap.get(gId);
        if (r) r.orderCount += 1;
      }
    }

    const list = Array.from(groupMap.values())
      .filter((g) => g.quantity > 0 || g.revenue > 0)
      .sort((a, b) => {
        if (metricMode === "quantity") return b.quantity - a.quantity;
        return b.revenue - a.revenue;
      });

    const sumQty = list.reduce((acc, g) => acc + g.quantity, 0);
    const sumRev = list.reduce((acc, g) => acc + g.revenue, 0);

    const rowsWithColors = list.map((g, idx) => {
      const color = PRODUCT_GROUP_PALETTE[idx % PRODUCT_GROUP_PALETTE.length];
      const primaryValue = metricMode === "revenue" ? g.revenue : g.quantity;
      const totalPrimary = metricMode === "revenue" ? sumRev : sumQty;
      const pct = totalPrimary > 0 ? (primaryValue / totalPrimary) * 100 : 0;

      return {
        ...g,
        productsCount: g.products.size,
        partiesCount: g.parties.size,
        color,
        pct: Math.round(pct * 10) / 10,
        primaryValue,
      };
    });

    return {
      productGroupRows: rowsWithColors,
      totalQuantity: sumQty,
      totalRevenue: sumRev,
      distinctGroupsCount: list.length,
    };
  }, [
    contributions,
    rawOrdersData,
    activeQtyBasis,
    productToGroupMap,
    groupMetaMap,
    metricMode,
  ]);

  // Filtered rows for search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return productGroupRows;
    const q = searchQuery.toLowerCase().trim();
    return productGroupRows.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q),
    );
  }, [productGroupRows, searchQuery]);

  // Portfolio & SKU Depth metrics
  const totalActiveSKUs = useMemo(
    () => productGroupRows.reduce((acc, g) => acc + g.productsCount, 0),
    [productGroupRows],
  );

  const topGroup = useMemo(
    () => (productGroupRows.length > 0 ? productGroupRows[0] : null),
    [productGroupRows],
  );

  // Navigate to Group Details
  const handleGroupClick = (groupId: string, groupName: string) => {
    if (onSelectProductGroup) {
      onSelectProductGroup(groupId, groupName);
      return;
    }
    if (portalHome) {
      router.push(`${portalHome}/sales-analytics/orders/product-group/${encodeURIComponent(groupId)}`);
    }
  };

  const { exportPdf, isExporting } = useDashboardPdfExport();

  // PDF Export handler
  const handleExportPdf = async () => {
    const qtyColHeader =
      localDataType === "billed" ? "Billed Qty" : "Approved Qty";
    const revColHeader =
      localDataType === "billed" ? "Billed Revenue (INR)" : "Approved Revenue (INR)";

    const headers = [
      "Product Group",
      "Active SKUs",
      "Buying Parties",
      qtyColHeader,
      revColHeader,
      "Order Count",
      "Revenue Share (%)",
    ];

    const data = filteredRows.map((g) => [
      g.name,
      g.productsCount,
      g.partiesCount,
      g.quantity.toFixed(2),
      g.revenue.toFixed(2),
      g.orderCount,
      `${g.pct}%`,
    ]);

    data.push([
      "Total",
      "",
      "",
      totalQuantity.toFixed(2),
      totalRevenue.toFixed(2),
      "",
      "100%",
    ]);

    await exportPdf({
      title: "Product Group Order Analytics Report",
      subtitle: `Portfolio distribution (${localDataType === "billed" ? "Billed" : "Approved"} Orders)`,
      metaLines: [
        ...(externalFilterCaption ? [`Filter: ${externalFilterCaption}`] : []),
        `Basis: ${activeQtyBasis || "standard"} | Mode: ${localDataType}`,
      ],
      headers,
      rows: data,
      filename: reportFilename(
        `product_groups_order_analytics_${localDataType}`,
        selectedYears,
        selectedMonths,
      ),
      orientation: "portrait",
    });
  };

  const isLoading =
    isOrdersFetching ||
    isGroupsFetching ||
    isProductsFetching ||
    isRawOrdersFetching;

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-white/10 dark:bg-slate-900 ${className}`}
    >
      {/* ── HEADER & TOOLBAR ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Boxes className="h-4 w-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Product Group Wise Order Analytics
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Portfolio distribution of order volume, commercial revenue, and client adoption across product categories.
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
              onClick={() => setMetricMode("revenue")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                metricMode === "revenue"
                  ? "bg-white text-blue-600 shadow-2xs dark:bg-slate-900 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Revenue (₹)
            </button>
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
              title="Portfolio Treemap View"
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "chart"
                  ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
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

          {/* Export PDF Button */}
          <ReportDownloadButton
            onDownload={handleExportPdf}
            disabled={filteredRows.length === 0 || isLoading || isExporting}
            loading={isExporting}
            size="sm"
            label="PDF"
          />
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
            placeholder="Search product groups..."
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
            {distinctGroupsCount} active {distinctGroupsCount === 1 ? "group" : "groups"}
          </span>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="mt-8 flex h-60 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <span className="text-xs">Loading product group analytics...</span>
          </div>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center dark:border-white/10">
          <Boxes className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No product group records found
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            No order items booked under product groups for the active filters.
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
          {/* PORTFOLIO TREEMAP & CATEGORY MATRIX */}
          {viewMode !== "table" && (
            <div
              className={`flex flex-col rounded-xl bg-white p-4 sm:p-5 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-2xs ${
                viewMode === "split" ? "lg:col-span-6" : "w-full max-w-4xl mx-auto"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                      <LayoutGrid className="h-4 w-4" />
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Product Portfolio Treemap & Category Mix
                    </h4>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Proportional category contribution and catalog depth
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total {localDataType === "billed" ? "Billed" : "Approved"}
                  </span>
                  <div className="text-xs sm:text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                    {metricMode === "revenue"
                      ? formatMoney(totalRevenue)
                      : formatQuantity(totalQuantity)}
                  </div>
                </div>
              </div>

              {/* ── TREEMAP / CATEGORY TILES GRID ─────────────────────────────── */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {productGroupRows.map((group, idx) => {
                  const isHovered = hoveredGroupId === group.id;
                  const isTopCategory = idx === 0;

                  return (
                    <div
                      key={group.id}
                      onClick={() => handleGroupClick(group.id, group.name)}
                      onMouseEnter={() => setHoveredGroupId(group.id)}
                      onMouseLeave={() => setHoveredGroupId(null)}
                      className={`group relative rounded-xl border p-3.5 transition cursor-pointer ${
                        isTopCategory ? "sm:col-span-2" : ""
                      } ${
                        isHovered
                          ? "border-indigo-400 bg-indigo-50/40 dark:border-indigo-600 dark:bg-indigo-950/30 shadow-xs"
                          : "border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/60 dark:border-white/10 dark:bg-slate-800/40 dark:hover:bg-slate-800/70"
                      }`}
                    >
                      {/* Top row: Name & share pill */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: group.color }}
                          />
                          <h5 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400 truncate transition-colors">
                            {group.name}
                          </h5>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-indigo-100/80 px-2 py-0.5 text-[10px] font-extrabold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 shrink-0">
                          {group.pct}% share
                        </span>
                      </div>

                      {/* Primary Value */}
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                          {metricMode === "revenue"
                            ? formatMoney(group.revenue)
                            : formatQuantity(group.quantity)}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {metricMode === "revenue"
                            ? formatQuantity(group.quantity)
                            : formatMoney(group.revenue)}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(group.pct, group.pct > 0 ? 4 : 0))}%`,
                            backgroundColor: group.color,
                          }}
                        />
                      </div>

                      {/* Meta Footer */}
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/50 pt-2 dark:border-white/5">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3 text-slate-400" />
                          <strong>{group.productsCount}</strong> Active SKUs
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-slate-400" />
                          <strong>{group.partiesCount}</strong> Clients
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Diversification Insight */}
              <div className="mt-3.5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 border border-slate-100 dark:border-white/5">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  Portfolio spans <strong>{productGroupRows.length} categories</strong> across{" "}
                  <strong>{totalActiveSKUs} active SKUs</strong>.
                </span>
                {topGroup && (
                  <span className="hidden sm:inline font-semibold text-slate-700 dark:text-slate-300">
                    Lead: {topGroup.name} ({topGroup.pct}%)
                  </span>
                )}
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
                      <th className="py-2.5 px-3">Product Group</th>
                      <th className="py-2.5 px-3 text-center">SKUs</th>
                      <th className="py-2.5 px-3 text-center">Parties</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Revenue</th>
                      <th className="py-2.5 px-3 text-right">Share</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-slate-900 font-medium">
                    {filteredRows.map((group) => {
                      const isHovered = hoveredGroupId === group.id;
                      return (
                        <tr
                          key={group.id}
                          onMouseEnter={() => setHoveredGroupId(group.id)}
                          onMouseLeave={() => setHoveredGroupId(null)}
                          onClick={() => handleGroupClick(group.id, group.name)}
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
                                style={{ backgroundColor: group.color }}
                              />
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{group.name}</span>
                                  {group.id === "ungrouped" && (
                                    <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] text-slate-500 dark:bg-slate-800">
                                      Uncategorized
                                    </span>
                                  )}
                                </div>
                                {group.description && (
                                  <div className="text-[10px] text-slate-400 line-clamp-1 max-w-[200px]">
                                    {group.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <Package className="h-3 w-3 text-slate-500" />
                              <span>{group.productsCount}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <Users className="h-3 w-3 text-slate-500" />
                              <span>{group.partiesCount}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">
                            {group.quantity.toLocaleString("en-IN", {
                              maximumFractionDigits: 1,
                            })}{" "}
                            <span className="text-[10px] text-slate-400 font-normal">Qty</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">
                            {formatMoney(group.revenue)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {group.pct}%
                              </span>
                              <div className="h-1.5 w-12 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, group.pct)}%`,
                                    backgroundColor: group.color,
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
                                handleGroupClick(group.id, group.name);
                              }}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/60 cursor-pointer"
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
                        Total ({filteredRows.length} Groups)
                      </td>
                      <td className="py-2.5 px-3 text-center"></td>
                      <td className="py-2.5 px-3 text-center"></td>
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

