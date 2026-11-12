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
  UserRound,
} from "lucide-react";

import MonthlyPerformanceChart from "./MonthlyPerformanceChart";
import PartyBreakdownSection from "./PartyBreakdownSection";
import PeriodFilter from "./PeriodFilter";
import { formatPeriodCaption } from "./PeriodHeadingCaption";
import { useDashboardSummary } from "./useDashboardSummary";
import { downloadCsvFile, reportFilename } from "./reportDownloadUtils";
import {
  itemMetricValue,
  normalizeRateType,
  shouldIncludeOrder,
} from "./leaderboardUtils";
import { useListUsersQuery, useListPartiesQuery, useListOrdersQuery } from "@/store/api";
import { buildUserNameById, resolveUserDisplay } from "@/components/portal/shared/lib/userDisplay";

export interface SalesPersonAnalyticsDetailPageProps {
  salesPersonId: string;
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

export default function SalesPersonAnalyticsDetailPage({
  salesPersonId,
  portalHome,
  onBack,
}: SalesPersonAnalyticsDetailPageProps) {
  const router = useRouter();
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // 2. Fetch Users to resolve sales rep profile
  const { data: usersData, isFetching: isUsersFetching } = useListUsersQuery({});

  // 3. Orders query for monthly trend & granular line items
  const {
    data: rawOrdersData,
    isFetching: isOrdersFetching,
    refetch: refetchOrders,
  } = useListOrdersQuery({ view: "list", limit: "2000" });

  // 4. Parties query for party metadata
  const { data: allPartiesData, isFetching: isPartiesFetching } = useListPartiesQuery({});

  const userNameMap = useMemo(() => {
    const fromUsers = buildUserNameById(usersData);
    return { ...fromUsers, ...(summary?.salesUsersById || {}) };
  }, [usersData, summary?.salesUsersById]);

  // Resolve target sales person profile
  const targetUser = useMemo(() => {
    const list = extractArray(usersData);
    const decodedId = decodeURIComponent(salesPersonId).trim();
    const lowerDecoded = decodedId.toLowerCase();

    // Check exact ID match
    for (const u of list) {
      const id = extractId(u._id ?? u.id);
      if (id && id === decodedId) {
        return {
          id,
          name: String(u.name || u.username || "Sales Rep"),
          email: String(u.email || ""),
          role: String(u.access_role || u.role || "Sales Executive"),
        };
      }
    }

    // Check name or email match
    for (const u of list) {
      const name = String(u.name || u.username || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      if (name === lowerDecoded || email === lowerDecoded) {
        const id = extractId(u._id ?? u.id);
        return {
          id: id || decodedId,
          name: String(u.name || u.username || "Sales Rep"),
          email: String(u.email || ""),
          role: String(u.access_role || u.role || "Sales Executive"),
        };
      }
    }

    // Fallback: check summary.salesUsersById
    if (summary?.salesUsersById && summary.salesUsersById[decodedId]) {
      return {
        id: decodedId,
        name: summary.salesUsersById[decodedId],
        email: "",
        role: "Sales Executive",
      };
    }

    // Fallback: decode slug
    const fallbackName = decodedId.startsWith("user-")
      ? decodedId.replace(/^user-/, "").replace(/-/g, " ")
      : decodedId;

    return {
      id: decodedId,
      name: fallbackName
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      email: "",
      role: decodedId === "unassigned" ? "System Pool" : "Sales Executive",
    };
  }, [usersData, salesPersonId, summary]);

  // All sales users list for quick switcher
  const salesUsersList = useMemo(() => {
    const list = extractArray(usersData);
    return list
      .filter((u) => {
        const dept = String(
          typeof u.department === "string"
            ? u.department
            : (u.department as Record<string, unknown>)?.code ||
              (u.department as Record<string, unknown>)?.name ||
              ""
        ).toLowerCase();
        const role = String(u.access_role || u.role || "").toLowerCase();
        return dept.includes("sales") || role.includes("sales");
      })
      .map((u) => ({
        id: extractId(u._id ?? u.id),
        name: String(u.name || u.username || "User"),
      }))
      .filter((u) => Boolean(u.id));
  }, [usersData]);

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
    isUsersFetching ||
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

  // 5. Filter orders assigned to this sales person
  const salesPersonOrders = useMemo(() => {
    const list = extractArray(rawOrdersData);
    const targetId = targetUser.id;
    const targetNameLower = targetUser.name.toLowerCase().trim();
    const isUnassigned = targetId === "unassigned" || targetNameLower.includes("unassigned");

    return list.filter((order) => {
      if (!shouldIncludeOrder(order, qtyBasis)) return false;

      const rawSalesUser = order.assigned_sales_user;
      const uId = extractId(rawSalesUser);
      const salesName = resolveUserDisplay(rawSalesUser, userNameMap).toLowerCase().trim();

      if (isUnassigned) {
        return !uId || uId === "unassigned" || salesName.includes("unassigned");
      }

      if (uId && uId === targetId) return true;
      if (salesName && salesName === targetNameLower) return true;

      return false;
    });
  }, [rawOrdersData, qtyBasis, targetUser, userNameMap]);

  // 6. Aggregate Party-Wise Breakdown for this Sales Person
  const {
    partyRows,
    totalPersonQuantity,
    totalPersonRevenue,
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

    // Strategy A: From filtered salesPersonOrders
    for (const order of salesPersonOrders) {
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

    // Fallback B: If partyMap is empty, try contributions filtered by targetUser.id
    if (partyMap.size === 0 && summary?.contributions) {
      for (const cell of summary.contributions) {
        if (cell.salesUserId === targetUser.id || cell.salesUserName === targetUser.name) {
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
      totalPersonQuantity: sumQty,
      totalPersonRevenue: sumRev,
      distinctPartiesCount: list.length,
    };
  }, [
    salesPersonOrders,
    summary,
    targetUser,
    qtyBasis,
    partyMetaMap,
  ]);

  // 7. Aggregate Product-Wise Breakdown for this Sales Person
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

    for (const order of salesPersonOrders) {
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
  }, [salesPersonOrders, qtyBasis]);

  // 8. Aggregate Rate Type Breakdown for this Sales Person
  const rateTypeBreakdown = useMemo(() => {
    const buckets = {
      SR: { qty: 0, rev: 0 },
      SRA: { qty: 0, rev: 0 },
      CR: { qty: 0, rev: 0 },
      OTHER: { qty: 0, rev: 0 },
    };

    for (const order of salesPersonOrders) {
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
  }, [salesPersonOrders, qtyBasis]);

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

  // CSV Exports
  const handleExportPartyCsv = () => {
    const headers = [
      "Party Name",
      "City",
      "State",
      `Quantity (Qty)`,
      "Revenue (INR)",
      "Share (%)",
      "Orders",
    ];
    const data = partyRows.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.city.replace(/"/g, '""')}"`,
      `"${p.state.replace(/"/g, '""')}"`,
      p.quantity.toFixed(2),
      p.revenue.toFixed(2),
      `${p.pct}%`,
      p.orderCount,
    ]);
    downloadCsvFile(
      reportFilename(
        `salesperson-${targetUser.name.toLowerCase().replace(/\s+/g, "_")}-parties-${dataType}`,
        selectedYears,
        selectedMonths,
      ),
      headers,
      data,
    );
  };

  const handleExportProductCsv = () => {
    const headers = [
      "Product Name",
      "Product Code",
      "Category",
      `Quantity (Qty)`,
      "Revenue (INR)",
      "Avg Rate (INR/Qty)",
      "Share (%)",
      "Occurrences",
    ];
    const data = filteredProductRows.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.code.replace(/"/g, '""')}"`,
      `"${p.category.replace(/"/g, '""')}"`,
      p.quantity.toFixed(2),
      p.revenue.toFixed(2),
      p.avgRate.toFixed(2),
      `${p.pct}%`,
      p.orderCount,
    ]);
    downloadCsvFile(
      reportFilename(`salesrep_${targetUser.name.replace(/\s+/g, "_").toLowerCase()}_products_${dataType}`, selectedYears, selectedMonths),
      headers,
      data,
    );
  };

  const avgQtyPerParty =
    distinctPartiesCount > 0 ? totalPersonQuantity / distinctPartiesCount : 0;

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
              {targetUser.name}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-xs">
              {targetUser.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() || "SP"}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                  {targetUser.name}
                </h1>
                <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:border-blue-800/40 dark:text-blue-300">
                  {targetUser.role}
                </span>
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {targetUser.email ? `${targetUser.email} • ` : ""}
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

      {/* ── QUICK SALES REP SWITCHER PILLS ─────────────────────────────────── */}
      {salesUsersList.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Switch Rep:
          </span>
          {salesUsersList.map((user) => {
            const isSelected = targetUser.id === user.id || targetUser.name === user.name;
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  router.push(`${portalHome}/sales-analytics/orders/sales-person/${encodeURIComponent(user.id)}`);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                  isSelected
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-white/10 dark:hover:bg-slate-800"
                }`}
              >
                <UserRound className="h-3 w-3" />
                <span>{user.name}</span>
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
        {/* Card 1: Total Quantity */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Total Quantity
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {totalPersonQuantity.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {formatMoney(totalPersonRevenue)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Across {salesPersonOrders.length} bookings
          </p>
        </div>

        {/* Card 3: Active Buying Parties */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Active Buying Parties
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
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
            Buying in {targetUser.name}&apos;s portfolio
          </p>
        </div>

        {/* Card 4: Average Qty / Party */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Avg Qty / Client
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
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
            Per buying client account
          </p>
        </div>
      </div>

      {/* ── RATE TYPE SUMMARY PILLS ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Commercial Pricing Breakdown:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md dark:bg-blue-950/50 dark:text-blue-300">
            <span>SR (Standard):</span>
            <span className="font-bold">{rateTypeBreakdown.SR.qty.toFixed(0)} Qty</span>
            <span className="text-blue-500">({formatMoney(rateTypeBreakdown.SR.rev)})</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md dark:bg-emerald-950/50 dark:text-emerald-300">
            <span>SRA (Agreement):</span>
            <span className="font-bold">{rateTypeBreakdown.SRA.qty.toFixed(0)} Qty</span>
            <span className="text-emerald-500">({formatMoney(rateTypeBreakdown.SRA.rev)})</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md dark:bg-purple-950/50 dark:text-purple-300">
            <span>CR (Company):</span>
            <span className="font-bold">{rateTypeBreakdown.CR.qty.toFixed(0)} Qty</span>
            <span className="text-purple-500">({formatMoney(rateTypeBreakdown.CR.rev)})</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md dark:bg-amber-950/50 dark:text-amber-300">
            <span>OTHER:</span>
            <span className="font-bold">{rateTypeBreakdown.OTHER.qty.toFixed(0)} Qty</span>
            <span className="text-amber-500">({formatMoney(rateTypeBreakdown.OTHER.rev)})</span>
          </span>
        </div>
      </div>

      {/* ── MONTHLY PERFORMANCE CHART ───────────────────────────────────────── */}
      <MonthlyPerformanceChart
        orders={salesPersonOrders}
        isOrdersFetching={isAnyLoading}
        qtyBasis={qtyBasis}
      />

      {/* ── PARTY-WISE BREAKDOWN SECTION ────────────────────────────────────── */}
      <PartyBreakdownSection
        partyRows={partyRows}
        totalQuantity={totalPersonQuantity}
        totalRevenue={totalPersonRevenue}
        title={`Party Breakdown for ${targetUser.name}`}
        subtitle="Dealers and customer accounts managed by this sales representative."
        dataType={dataType}
        onDataTypeChange={setDataType}
        portalHome={portalHome}
        onExportCsv={handleExportPartyCsv}
      />

      {/* ── PRODUCT-WISE BREAKDOWN SECTION ─────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Product Breakdown for {targetUser.name}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Commercial SKUs ordered across {targetUser.name}&apos;s customer portfolio.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportProductCsv}
              disabled={filteredProductRows.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
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
              No product items ordered under {targetUser.name} in this filtered timeframe.
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
