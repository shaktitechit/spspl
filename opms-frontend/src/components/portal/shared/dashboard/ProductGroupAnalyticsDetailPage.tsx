"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  Building2,
  Coins,
  Download,
  Package,
  RefreshCw,
  Search,
  Tag,
  TrendingUp,
} from "lucide-react";

import MonthlyPerformanceChart from "./MonthlyPerformanceChart";
import PartyBreakdownSection from "./PartyBreakdownSection";
import PeriodFilter from "./PeriodFilter";
import { formatPeriodCaption } from "./PeriodHeadingCaption";
import { useDashboardSummary } from "./useDashboardSummary";
import { reportFilename } from "./reportDownloadUtils";
import { useDashboardPdfExport } from "./dashboardPdfEngine";
import ReportDownloadButton from "./ReportDownloadButton";
import {
  itemMetricValue,
  normalizeRateType,
  shouldIncludeOrder,
} from "./leaderboardUtils";
import {
  useGetProductGroupQuery,
  useListProductGroupsQuery,
  useListProductsQuery,
  useListPartiesQuery,
  useListOrdersQuery,
} from "@/store/api";

export interface ProductGroupAnalyticsDetailPageProps {
  productGroupId: string;
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

export default function ProductGroupAnalyticsDetailPage({
  productGroupId,
  portalHome,
  onBack,
}: ProductGroupAnalyticsDetailPageProps) {
  const router = useRouter();
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isMongoId = /^[a-f\d]{24}$/i.test(productGroupId);
  const isUngrouped = productGroupId === "ungrouped";

  // 1. Period & Filter summary
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

  // 2. Fetch specific product group record if mongoId
  const { data: groupRecord, isFetching: isGroupRecordFetching } = useGetProductGroupQuery(
    productGroupId,
    { skip: !isMongoId },
  );

  // 3. Fetch all product groups & products
  const { data: allGroupsData, isFetching: isAllGroupsFetching } = useListProductGroupsQuery({
    limit: 1000,
  });
  const { data: allProductsData, isFetching: isAllProductsFetching } = useListProductsQuery({
    limit: "10000",
  });

  // 4. Fetch orders & parties
  const {
    data: rawOrdersData,
    isFetching: isOrdersFetching,
    refetch: refetchOrders,
  } = useListOrdersQuery({ view: "list", limit: "2000" });
  const { data: allPartiesData, isFetching: isPartiesFetching } = useListPartiesQuery({});

  // Resolve target group metadata & matching product IDs
  const {
    groupName,
    groupDescription,
    targetGroupProductIds,
    allOtherGroupsProductIds,
  } = useMemo(() => {
    let name = isUngrouped ? "Other / Uncategorized" : "Product Group";
    let desc = "";
    const decodedId = decodeURIComponent(productGroupId).trim();

    if (groupRecord && typeof groupRecord === "object") {
      name = String(groupRecord.name || name);
      desc = String(groupRecord.description || "");
    } else {
      const groupsList = extractArray(allGroupsData);
      for (const g of groupsList) {
        const id = extractId(g._id ?? g.id);
        const gName = String(g.name ?? "");
        if (
          id === decodedId ||
          gName.toLowerCase() === decodedId.toLowerCase() ||
          `group-${gName.toLowerCase().replace(/[^a-z0-9]/g, "-")}` === decodedId
        ) {
          name = gName;
          desc = String(g.description ?? "");
          break;
        }
      }
    }

    const targetLowerName = name.toLowerCase().trim();
    const targetProdIds = new Set<string>();
    const otherProdIds = new Set<string>();

    const prodsList = extractArray(allProductsData);
    for (const p of prodsList) {
      const pId = extractId(p._id ?? p.id);
      if (!pId) continue;

      const groupRef = p.product_group;
      const refId = extractId(groupRef);
      const rawRefName = String(
        (groupRef as Record<string, unknown>)?.name || groupRef || ""
      ).trim().toLowerCase();

      const isMatch = isUngrouped
        ? !refId && !rawRefName
        : refId === decodedId ||
          (targetLowerName && rawRefName === targetLowerName);

      if (isMatch) {
        targetProdIds.add(pId);
      } else {
        otherProdIds.add(pId);
      }
    }

    return {
      groupName: name,
      groupDescription: desc,
      targetGroupProductIds: targetProdIds,
      allOtherGroupsProductIds: otherProdIds,
    };
  }, [productGroupId, isUngrouped, groupRecord, allGroupsData, allProductsData]);

  // List of product groups for quick switcher
  const availableGroups = useMemo(() => {
    const list = extractArray(allGroupsData);
    return list
      .map((g) => ({
        id: extractId(g._id ?? g.id),
        name: String(g.name ?? "Group"),
      }))
      .filter((g) => Boolean(g.id));
  }, [allGroupsData]);

  const partyMetaMap = useMemo(() => {
    const map = new Map<string, { name: string; city: string; state: string }>();
    const list = extractArray(allPartiesData);
    for (const p of list) {
      const pId = extractId(p._id ?? p.id);
      if (!pId) continue;
      const name = String(p.party_name || p.name || "Unnamed Party");
      const rawCity = String(
        p.city ||
          (p.billing_address as Record<string, unknown>)?.city ||
          (p.shipping_address as Record<string, unknown>)?.city ||
          ""
      ).trim();
      const rawState = String(
        p.state ||
          (p.billing_address as Record<string, unknown>)?.state ||
          ""
      ).trim();
      map.set(pId, { name, city: rawCity, state: rawState });
    }
    return map;
  }, [allPartiesData]);

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
    isGroupRecordFetching ||
    isAllGroupsFetching ||
    isAllProductsFetching ||
    isPartiesFetching ||
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

  // 5. Filter orders belonging to this Product Group
  const productGroupOrders = useMemo(() => {
    const list = extractArray(rawOrdersData);
    const out: Record<string, unknown>[] = [];
    const targetLowerName = groupName.toLowerCase().trim();

    for (const order of list) {
      if (!shouldIncludeOrder(order, qtyBasis)) continue;

      const rawItems = Array.isArray(order.order_items)
        ? (order.order_items as Record<string, unknown>[])
        : Array.isArray(order.items)
        ? (order.items as Record<string, unknown>[])
        : [];

      const matchingItems = rawItems.filter((item) => {
        const prodId = extractId(item.product ?? item.product_id);
        if (prodId && targetGroupProductIds.has(prodId)) return true;

        const rawGroup = String(
          item.group_name ||
            item.category ||
            (item.product as Record<string, unknown>)?.group_name ||
            ""
        ).trim().toLowerCase();

        if (isUngrouped) {
          if (!prodId && !rawGroup) return true;
          if (prodId && !allOtherGroupsProductIds.has(prodId)) return true;
          return false;
        }

        return targetLowerName && rawGroup === targetLowerName;
      });

      if (matchingItems.length > 0) {
        out.push({
          ...order,
          order_items: matchingItems,
          items: matchingItems,
        });
      }
    }
    return out;
  }, [
    rawOrdersData,
    qtyBasis,
    groupName,
    isUngrouped,
    targetGroupProductIds,
    allOtherGroupsProductIds,
  ]);

  // 6. Aggregate Party-Wise Breakdown for this Product Group
  const {
    partyRows,
    totalGroupQuantity,
    totalGroupRevenue,
    distinctPartiesCount,
  } = useMemo(() => {
    const partyMap = new Map<
      string,
      {
        id: string;
        name: string;
        city: string;
        state: string;
        quantity: number;
        revenue: number;
        orderCount: number;
      }
    >();

    // Strategy A: From productGroupOrders
    for (const order of productGroupOrders) {
      const pId = extractId(order.party);
      const fallbackMeta = pId ? partyMetaMap.get(pId) : null;
      const partyName =
        String(
          (order.party as Record<string, unknown>)?.party_name ||
            (order.party as Record<string, unknown>)?.name ||
            order.party_name ||
            fallbackMeta?.name ||
            (pId ? `Party ${pId.slice(-6)}` : "Unnamed Party")
        ).trim();

      const city = String(
        (order.shipping_address as Record<string, unknown>)?.city ||
          (order.billing_address as Record<string, unknown>)?.city ||
          fallbackMeta?.city ||
          ""
      ).trim();

      const state = String(
        (order.shipping_address as Record<string, unknown>)?.state ||
          (order.billing_address as Record<string, unknown>)?.state ||
          fallbackMeta?.state ||
          ""
      ).trim();

      const key = pId || partyName;
      let rec = partyMap.get(key);
      if (!rec) {
        rec = {
          id: pId || key,
          name: partyName,
          city,
          state,
          quantity: 0,
          revenue: 0,
          orderCount: 0,
        };
        partyMap.set(key, rec);
      }

      rec.orderCount += 1;
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      for (const it of items) {
        rec.quantity += itemMetricValue(it, "quantity", qtyBasis, items);
        rec.revenue += itemMetricValue(it, "volume", qtyBasis, items);
      }
    }

    // Fallback B: If partyMap empty, try contributions matching targetGroupProductIds
    if (partyMap.size === 0 && summary?.contributions) {
      for (const cell of summary.contributions) {
        const belongsToGroup = isUngrouped
          ? !allOtherGroupsProductIds.has(cell.productId)
          : targetGroupProductIds.has(cell.productId);

        if (!belongsToGroup) continue;

        const pId = cell.partyId || "party";
        let rec = partyMap.get(pId);
        if (!rec) {
          rec = {
            id: pId,
            name: cell.partyName || "Party",
            city: "",
            state: "",
            quantity: 0,
            revenue: 0,
            orderCount: 1,
          };
          partyMap.set(pId, rec);
        }
        rec.quantity += Number(cell.quantity) || 0;
        rec.revenue += Number(cell.volume) || 0;
      }
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
      totalGroupQuantity: sumQty,
      totalGroupRevenue: sumRev,
      distinctPartiesCount: list.length,
    };
  }, [
    productGroupOrders,
    summary,
    isUngrouped,
    targetGroupProductIds,
    allOtherGroupsProductIds,
    qtyBasis,
    partyMetaMap,
  ]);

  // 7. Aggregate Products / SKUs Breakdown within this Group
  const productRows = useMemo(() => {
    const prodMap = new Map<
      string,
      {
        id: string;
        name: string;
        code: string;
        category: string;
        quantity: number;
        revenue: number;
        orderCount: number;
      }
    >();

    for (const order of productGroupOrders) {
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      for (const it of items) {
        const pObj = (it.product as Record<string, unknown>) || {};
        const pName = String(
          it.product_name ||
            it.name ||
            pObj.name ||
            pObj.product_name ||
            "Product"
        ).trim();
        const pCode = String(
          it.product_code ||
            it.code ||
            pObj.code ||
            pObj.product_code ||
            "—"
        ).trim();
        const pCat = String(
          it.group_name ||
            it.category ||
            pObj.group_name ||
            pObj.category ||
            groupName
        ).trim();

        const key = `${pName}___${pCode}`;
        let rec = prodMap.get(key);
        if (!rec) {
          rec = {
            id: key,
            name: pName,
            code: pCode,
            category: pCat,
            quantity: 0,
            revenue: 0,
            orderCount: 0,
          };
          prodMap.set(key, rec);
        }

        rec.orderCount += 1;
        rec.quantity += itemMetricValue(it, "quantity", qtyBasis, items);
        rec.revenue += itemMetricValue(it, "volume", qtyBasis, items);
      }
    }

    const list = Array.from(prodMap.values())
      .filter((p) => p.quantity > 0 || p.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const totalProdRev = list.reduce((acc, p) => acc + p.revenue, 0);

    return list.map((p) => {
      const avgRate = p.quantity > 0 ? p.revenue / p.quantity : 0;
      const pct = totalProdRev > 0 ? (p.revenue / totalProdRev) * 100 : 0;
      return {
        ...p,
        avgRate,
        pct: Math.round(pct * 10) / 10,
      };
    });
  }, [productGroupOrders, qtyBasis, groupName]);

  // 8. Rate Type Breakdown for this Product Group
  const rateTypeBreakdown = useMemo(() => {
    const buckets = {
      SR: { qty: 0, rev: 0 },
      SRA: { qty: 0, rev: 0 },
      CR: { qty: 0, rev: 0 },
      OTHER: { qty: 0, rev: 0 },
    };

    for (const order of productGroupOrders) {
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      for (const it of items) {
        const rawCode = String(it.applied_rate_type ?? "SR").toUpperCase();
        const code = normalizeRateType(rawCode);
        const q = itemMetricValue(it, "quantity", qtyBasis, items);
        const v = itemMetricValue(it, "volume", qtyBasis, items);

        if (code === "SRA") {
          buckets.SRA.qty += q;
          buckets.SRA.rev += v;
        } else if (code === "CR") {
          buckets.CR.qty += q;
          buckets.CR.rev += v;
        } else if (code === "SR") {
          buckets.SR.qty += q;
          buckets.SR.rev += v;
        } else {
          buckets.OTHER.qty += q;
          buckets.OTHER.rev += v;
        }
      }
    }
    return buckets;
  }, [productGroupOrders, qtyBasis]);

  // Filtered product rows
  const filteredProductRows = useMemo(() => {
    if (!productSearchQuery.trim()) return productRows;
    const q = productSearchQuery.toLowerCase().trim();
    return productRows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
    );
  }, [productRows, productSearchQuery]);

  const { exportPdf, isExporting } = useDashboardPdfExport();

  // PDF Exports
  const handleExportPartyPdf = async () => {
    const qtyColHeader =
      dataType === "billed" ? "Billed Qty" : "Approved Qty";
    const revColHeader =
      dataType === "billed" ? "Billed Revenue (INR)" : "Approved Revenue (INR)";

    const headers = [
      "Party Name",
      "City",
      "State",
      qtyColHeader,
      revColHeader,
      "Share (%)",
      "Orders",
    ];
    const data = partyRows.map((p) => [
      p.name,
      p.city,
      p.state,
      p.quantity.toFixed(2),
      p.revenue.toFixed(2),
      `${p.pct}%`,
      p.orderCount,
    ]);

    const totalQty = partyRows.reduce((s, p) => s + p.quantity, 0);
    const totalRev = partyRows.reduce((s, p) => s + p.revenue, 0);
    data.push([
      "Total",
      "",
      "",
      totalQty.toFixed(2),
      totalRev.toFixed(2),
      "100%",
      partyRows.reduce((s, p) => s + (p.orderCount || 0), 0),
    ]);

    await exportPdf({
      title: `Product Group: ${groupName} - Party Breakdown`,
      subtitle: `Customer distribution of orders & volumes for ${groupName} (${dataType === "billed" ? "Billed" : "Approved"} Orders)`,
      metaLines: [
        `Group: ${groupName}`,
        `Period: ${filterCaption || "All Time"}`,
        `Mode: ${dataType.toUpperCase()}`,
      ],
      headers,
      rows: data,
      filename: reportFilename(`prodgroup_${groupName.replace(/\s+/g, "_").toLowerCase()}_parties_${dataType}`, selectedYears, selectedMonths),
      orientation: "portrait",
    });
  };

  const handleExportProductPdf = async () => {
    const qtyColHeader =
      dataType === "billed" ? "Billed Qty" : "Approved Qty";
    const revColHeader =
      dataType === "billed" ? "Billed Revenue (INR)" : "Approved Revenue (INR)";

    const headers = [
      "Product Name",
      "Product Code",
      "Category",
      qtyColHeader,
      revColHeader,
      "Avg Rate (INR/Qty)",
      "Revenue Share (%)",
      "Occurrences",
    ];
    const data = filteredProductRows.map((p) => [
      p.name,
      p.code,
      p.category,
      p.quantity.toFixed(2),
      p.revenue.toFixed(2),
      p.avgRate.toFixed(2),
      `${p.pct}%`,
      p.orderCount,
    ]);

    const totalQty = filteredProductRows.reduce((s, p) => s + p.quantity, 0);
    const totalRev = filteredProductRows.reduce((s, p) => s + p.revenue, 0);
    data.push([
      "Total",
      "",
      "",
      totalQty.toFixed(2),
      totalRev.toFixed(2),
      "",
      "100%",
      filteredProductRows.reduce((s, p) => s + (p.orderCount || 0), 0),
    ]);

    await exportPdf({
      title: `Product Group: ${groupName} - SKU Breakdown`,
      subtitle: `Commercial performance of individual SKUs in ${groupName} (${dataType === "billed" ? "Billed" : "Approved"} Orders)`,
      metaLines: [
        `Group: ${groupName}`,
        `Period: ${filterCaption || "All Time"}`,
        `Mode: ${dataType.toUpperCase()}`,
      ],
      headers,
      rows: data,
      filename: reportFilename(`prodgroup_${groupName.replace(/\s+/g, "_").toLowerCase()}_skus_${dataType}`, selectedYears, selectedMonths),
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── BREADCRUMB & HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Link
              href={portalHome}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              Overview
            </Link>
            <span>/</span>
            <Link
              href={`${portalHome}/sales-analytics`}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              Sales Analytics
            </Link>
            <span>/</span>
            <Link
              href={`${portalHome}/sales-analytics/orders`}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              Order Analytics
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {groupName}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white shadow-xs">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                  {groupName}
                </h1>
                <span className="inline-flex items-center rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800/40 dark:text-indigo-300">
                  PRODUCT GROUP
                </span>
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {groupDescription ? `${groupDescription} • ` : ""}
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {filterCaption}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Back to Orders</span>
            </button>
          ) : (
            <Link
              href={`${portalHome}/sales-analytics/orders`}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Back to Orders</span>
            </Link>
          )}

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

      {/* ── QUICK PRODUCT GROUP SWITCHER PILLS ─────────────────────────────── */}
      {availableGroups.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Switch Group:
          </span>
          {availableGroups.map((g) => {
            const isSelected = productGroupId === g.id || groupName === g.name;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  router.push(`${portalHome}/sales-analytics/orders/product-group/${encodeURIComponent(g.id)}`);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                  isSelected
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-white/10 dark:hover:bg-slate-800"
                }`}
              >
                <Boxes className="h-3 w-3" />
                <span>{g.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── STICKY PERIOD FILTER PANEL ──────────────────────────────────────── */}
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

      {/* ── KPI STATS CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Revenue */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Total Revenue
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {formatMoney(totalGroupRevenue)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {dataType === "billed" ? "Billed" : "Approved"} commercial revenue
          </p>
        </div>

        {/* Card 2: Total Quantity */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Total Quantity
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {totalGroupQuantity.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs font-semibold text-slate-500">Qty</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Across {productGroupOrders.length} order bookings
          </p>
        </div>

        {/* Card 3: Active SKUs */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Active Products / SKUs
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {productRows.length}
            </span>
            <span className="text-xs font-semibold text-slate-500">SKUs</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Catalog items in {groupName}
          </p>
        </div>

        {/* Card 4: Active Buying Parties */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Active Buying Parties
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {distinctPartiesCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">Clients</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Purchasing products in this group
          </p>
        </div>
      </div>

      {/* ── COMMERCIAL RATE TYPE SUMMARY PILLS ──────────────────────────────── */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Group Commercial Pricing Distribution:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md dark:bg-blue-950/50 dark:text-blue-300">
            <span>SR (Standard):</span>
            <span className="font-bold">{formatMoney(rateTypeBreakdown.SR.rev)}</span>
            <span className="text-blue-500">({rateTypeBreakdown.SR.qty.toFixed(0)} Qty)</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md dark:bg-emerald-950/50 dark:text-emerald-300">
            <span>SRA (Agreement):</span>
            <span className="font-bold">{formatMoney(rateTypeBreakdown.SRA.rev)}</span>
            <span className="text-emerald-500">({rateTypeBreakdown.SRA.qty.toFixed(0)} Qty)</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md dark:bg-purple-950/50 dark:text-purple-300">
            <span>CR (Company):</span>
            <span className="font-bold">{formatMoney(rateTypeBreakdown.CR.rev)}</span>
            <span className="text-purple-500">({rateTypeBreakdown.CR.qty.toFixed(0)} Qty)</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md dark:bg-amber-950/50 dark:text-amber-300">
            <span>OTHER:</span>
            <span className="font-bold">{formatMoney(rateTypeBreakdown.OTHER.rev)}</span>
            <span className="text-amber-500">({rateTypeBreakdown.OTHER.qty.toFixed(0)} Qty)</span>
          </span>
        </div>
      </div>

      {/* ── MONTHLY PERFORMANCE CHART ───────────────────────────────────────── */}
      <MonthlyPerformanceChart
        orders={productGroupOrders}
        isOrdersFetching={isAnyLoading}
        qtyBasis={qtyBasis}
      />

      {/* ── PRODUCT / SKU BREAKDOWN SECTION ─────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Products & SKUs in {groupName}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Commercial performance, quantity sold, and revenue share of each product under {groupName}.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ReportDownloadButton
              onDownload={handleExportProductPdf}
              disabled={filteredProductRows.length === 0 || isExporting}
              loading={isExporting}
              size="sm"
              label="PDF"
            />
          </div>
        </div>

        {/* Product Search */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              placeholder="Search products by SKU or code..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-slate-800/60 dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-400"
            />
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Showing {filteredProductRows.length} of {productRows.length} products
          </div>
        </div>

        {/* Product Table */}
        {filteredProductRows.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center dark:border-white/10">
            <Package className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No product items found
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              No products ordered in this group for the selected timeframe.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase font-semibold border-b border-slate-200/80 dark:border-white/10">
                  <tr>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                    <th className="py-2.5 px-3 text-right">Avg Rate</th>
                    <th className="py-2.5 px-3 text-right">Revenue Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-slate-900 font-medium">
                  {filteredProductRows.map((prod) => (
                    <tr
                      key={prod.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {prod.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {prod.code}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">
                        {prod.quantity.toLocaleString("en-IN", {
                          maximumFractionDigits: 1,
                        })}{" "}
                        <span className="text-[10px] text-slate-400 font-normal">Qty</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">
                        {formatMoney(prod.revenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                        ₹{prod.avgRate.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        <span className="text-[10px] text-slate-400 font-normal">/Qty</span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {prod.pct}%
                          </span>
                          <div className="h-1.5 w-12 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${Math.min(100, prod.pct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── PARTY-WISE BREAKDOWN SECTION ────────────────────────────────────── */}
      <PartyBreakdownSection
        partyRows={partyRows}
        totalQuantity={totalGroupQuantity}
        totalRevenue={totalGroupRevenue}
        title={`Party Breakdown for ${groupName}`}
        subtitle="Customer distribution of order volumes and revenue for products in this group."
        dataType={dataType}
        onDataTypeChange={setDataType}
        portalHome={portalHome}
        onExportPdf={handleExportPartyPdf}
        isExportingPdf={isExporting}
      />
    </div>
  );
}
