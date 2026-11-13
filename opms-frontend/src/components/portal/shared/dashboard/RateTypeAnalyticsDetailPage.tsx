"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Coins,
  Download,
  Layers,
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
  normalizeRateType,
  itemMetricValue,
  shouldIncludeOrder,
} from "./leaderboardUtils";
import { RATE_TYPE_CONFIG, type RateTypeMeta } from "./RateTypeOrderAnalytics";
import { useListPartiesQuery, useListOrdersQuery } from "@/store/api";

export interface RateTypeAnalyticsDetailPageProps {
  rateType: string;
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

export default function RateTypeAnalyticsDetailPage({
  rateType,
  portalHome,
  onBack,
}: RateTypeAnalyticsDetailPageProps) {
  const router = useRouter();
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Normalize rate type code
  const rawKey = (rateType || "SR").toUpperCase().trim();
  let normalizedKey: "SR" | "SRA" | "CR" | "OTHER" = "SR";
  if (rawKey === "SRA") normalizedKey = "SRA";
  else if (rawKey === "CR") normalizedKey = "CR";
  else if (rawKey === "OTHER" || rawKey === "MANUAL") normalizedKey = "OTHER";
  else normalizedKey = "SR";

  const meta: RateTypeMeta = RATE_TYPE_CONFIG[normalizedKey] || RATE_TYPE_CONFIG.SR;

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

  // 2. Orders query for monthly trend & granular line item mapping
  const {
    data: rawOrdersData,
    isFetching: isOrdersFetching,
    refetch: refetchOrders,
  } = useListOrdersQuery({ view: "list", limit: "2000" });

  // 3. Parties query for party metadata resolution
  const { data: allPartiesData, isFetching: isPartiesFetching } = useListPartiesQuery({});

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
    isSummaryFetching || isOrdersFetching || isPartiesFetching || isRefreshing;

  const filterCaption = useMemo(() => {
    return formatPeriodCaption(
      dateFilter,
      customDateFrom,
      customDateTo,
      selectedYears,
      selectedMonths,
    );
  }, [dateFilter, customDateFrom, customDateTo, selectedYears, selectedMonths]);

  // 4. Filter orders and retain only items matching this rate type
  const rateTypeOrders = useMemo(() => {
    const list = extractArray(rawOrdersData);
    const out: Record<string, unknown>[] = [];

    for (const order of list) {
      if (!shouldIncludeOrder(order, qtyBasis)) continue;

      const rawItems = Array.isArray(order.order_items)
        ? (order.order_items as Record<string, unknown>[])
        : Array.isArray(order.items)
        ? (order.items as Record<string, unknown>[])
        : [];

      const matchingItems = rawItems.filter((item) => {
        const itemType = normalizeRateType(String(item.applied_rate_type ?? "SR").toUpperCase());
        if (normalizedKey === "OTHER") {
          return itemType !== "SR" && itemType !== "SRA" && itemType !== "CR";
        }
        return itemType === normalizedKey;
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
  }, [rawOrdersData, qtyBasis, normalizedKey]);

  // 5. Aggregate Party Breakdown under this Rate Type
  const {
    partyRows,
    totalRateQuantity,
    totalRateRevenue,
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

    for (const order of rateTypeOrders) {
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

    // Fallback: If raw orders didn't populate but summary leaderboards exist
    if (partyMap.size === 0 && summary?.leaderboards?.parties) {
      const lowerKey = normalizedKey.toLowerCase() as "sr" | "sra" | "cr";
      for (const row of summary.leaderboards.parties) {
        const qty = row.quantity?.[lowerKey] ?? 0;
        const rev = row.volume?.[lowerKey] ?? 0;
        if (qty > 0 || rev > 0) {
          const pName = row.name || "Party";
          partyMap.set(pName, {
            id: pName,
            name: pName,
            city: "",
            state: "",
            quantity: qty,
            revenue: rev,
            orderCount: 1,
          });
        }
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
      totalRateQuantity: sumQty,
      totalRateRevenue: sumRev,
      distinctPartiesCount: list.length,
    };
  }, [rateTypeOrders, summary, normalizedKey, qtyBasis, partyMetaMap]);

  // 6. Aggregate Product Breakdown under this Rate Type
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

    for (const order of rateTypeOrders) {
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      for (const it of items) {
        const pObj = (it.product as Record<string, unknown>) || {};
        const pName = String(
          it.product_name ||
            it.name ||
            pObj.name ||
            pObj.product_name ||
            "Standard Product"
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
            "General"
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
  }, [rateTypeOrders, qtyBasis]);

  // Filtered product rows
  const filteredProductRows = useMemo(() => {
    if (!productSearchQuery.trim()) return productRows;
    const q = productSearchQuery.toLowerCase().trim();
    return productRows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [productRows, productSearchQuery]);

  const { exportPdf, isExporting } = useDashboardPdfExport();

  // PDF export handlers
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
      title: `Rate Type: ${meta.code} (${meta.name}) - Party Breakdown`,
      subtitle: `Distribution across dealers & institutional buyers (${dataType === "billed" ? "Billed" : "Approved"} Orders)`,
      metaLines: [
        `Rate Type: ${meta.code} - ${meta.name}`,
        `Period: ${filterCaption || "All Time"}`,
        `Mode: ${dataType.toUpperCase()}`,
      ],
      headers,
      rows: data,
      filename: reportFilename(`ratetype-${normalizedKey.toLowerCase()}-parties-${dataType}`, selectedYears, selectedMonths),
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
      "Share (%)",
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
      title: `Rate Type: ${meta.code} (${meta.name}) - Product Breakdown`,
      subtitle: `Commercial SKUs ordered under ${meta.name} (${dataType === "billed" ? "Billed" : "Approved"} Orders)`,
      metaLines: [
        `Rate Type: ${meta.code} - ${meta.name}`,
        `Period: ${filterCaption || "All Time"}`,
        `Mode: ${dataType.toUpperCase()}`,
      ],
      headers,
      rows: data,
      filename: reportFilename(`ratetype-${normalizedKey.toLowerCase()}-products-${dataType}`, selectedYears, selectedMonths),
      orientation: "landscape",
    });
  };

  const avgQtyPerParty =
    distinctPartiesCount > 0 ? totalRateQuantity / distinctPartiesCount : 0;

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
              {meta.name} ({meta.code})
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl shadow-xs text-white"
              style={{ backgroundColor: meta.color }}
            >
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                  {meta.name}
                </h1>
                <span
                  className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold tracking-wide ${meta.badgeBg} ${meta.badgeText}`}
                >
                  {meta.code} RATE TYPE
                </span>
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {meta.shortDescription} •{" "}
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

      {/* ── RATE TYPE QUICK SWITCHER PILLS ─────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
          Switch Rate Type:
        </span>
        {(["SR", "SRA", "CR", "OTHER"] as const).map((rCode) => {
          const cfg = RATE_TYPE_CONFIG[rCode];
          const isSelected = normalizedKey === rCode;
          return (
            <button
              key={rCode}
              type="button"
              onClick={() => {
                router.push(`${portalHome}/sales-analytics/orders/rate-type/${rCode}`);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                isSelected
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-white/10 dark:hover:bg-slate-800"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: cfg.color }}
              />
              <span>{cfg.code}</span>
              <span className="opacity-75 font-normal">({cfg.name})</span>
            </button>
          );
        })}
      </div>

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
        {/* Card 1: Total Quantity */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Total Quantity
            </span>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
            >
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {totalRateQuantity.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold text-slate-500">Qty</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {dataType === "billed" ? "Billed" : "Approved"} commercial volume
          </p>
        </div>

        {/* Card 2: Total Revenue */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Total Revenue
            </span>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
            >
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {formatMoney(totalRateRevenue)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Across {rateTypeOrders.length} order bookings
          </p>
        </div>

        {/* Card 3: Active Buying Parties */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Active Buying Parties
            </span>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
            >
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
            Ordering under {meta.code} rate
          </p>
        </div>

        {/* Card 4: Average Qty / Party */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Avg Qty / Party
            </span>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
            >
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {avgQtyPerParty.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs font-semibold text-slate-500">Qty</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Per active client in period
          </p>
        </div>
      </div>

      {/* ── MONTHLY PERFORMANCE CHART ───────────────────────────────────────── */}
      <MonthlyPerformanceChart
        orders={rateTypeOrders}
        isOrdersFetching={isAnyLoading}
        qtyBasis={qtyBasis}
      />

      {/* ── PARTY-WISE BREAKDOWN SECTION ────────────────────────────────────── */}
      <PartyBreakdownSection
        partyRows={partyRows}
        totalQuantity={totalRateQuantity}
        totalRevenue={totalRateRevenue}
        title={`Party Breakdown under ${meta.code} (${meta.name})`}
        subtitle="Distribution of orders, volumes, and revenue across dealers and institutional buyers."
        dataType={dataType}
        onDataTypeChange={setDataType}
        portalHome={portalHome}
        onExportPdf={handleExportPartyPdf}
        isExportingPdf={isExporting}
      />

      {/* ── PRODUCT-WISE BREAKDOWN SECTION ─────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Product Breakdown under {meta.code} ({meta.name})
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Commercial SKUs ordered with {meta.name} pricing structures.
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
              No product records found
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              No product items ordered under {meta.code} in this filtered timeframe.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase font-semibold border-b border-slate-200/80 dark:border-white/10">
                  <tr>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                    <th className="py-2.5 px-3 text-right">Avg Rate</th>
                    <th className="py-2.5 px-3 text-right">Share</th>
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
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {prod.category}
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
    </div>
  );
}
