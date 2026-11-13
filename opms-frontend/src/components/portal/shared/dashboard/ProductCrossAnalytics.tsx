"use client";

import { useMemo, useState } from "react";
import { BarChart3, Building2, CalendarDays, Download, Layers, UserRound } from "lucide-react";

import {
  useListProductGroupsQuery,
  useListProductsQuery,
  useListOrdersQuery,
} from "@/store/api";
import type { DashboardOrdersSummary } from "@/store/api/slices/dashboardApi";
import { reportFilename } from "./reportDownloadUtils";
import { useDashboardPdfExport } from "./dashboardPdfEngine";
import ReportDownloadButton from "./ReportDownloadButton";
import { itemMetricValue, shouldIncludeOrder, type QtyBasis } from "./leaderboardUtils";

type TabId = "product-monthly" | "group-monthly" | "group-sales" | "group-party";
type MetricMode = "revenue" | "quantity";

export interface ProductCrossAnalyticsProps {
  contributions?: DashboardOrdersSummary["contributions"];
  salesUsersById?: Record<string, string>;
  isOrdersFetching?: boolean;
  qtyBasis?: string;
  selectedYears?: number[];
  selectedMonths?: number[];
  externalFilterCaption?: string;
  dataType?: "approved" | "billed";
  onDataTypeChange?: (type: "approved" | "billed") => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TABS: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
  { id: "product-monthly", label: "Product · Monthly", icon: CalendarDays },
  { id: "group-monthly", label: "Group · Monthly", icon: Layers },
  { id: "group-sales", label: "Group × Sales Person", icon: UserRound },
  { id: "group-party", label: "Group × Party", icon: Building2 },
];

function fmtMoney(v: number): string {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtValue(v: number, m: MetricMode): string {
  if (m === "revenue") return fmtMoney(v);
  return `${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Qty`;
}

function idOf(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") {
    const o = val as { _id?: unknown; id?: unknown };
    return String(o._id ?? o.id ?? "").trim();
  }
  return "";
}

function arr(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: Record<string, unknown>[] }).data;
  }
  return [];
}

function s(v: unknown, fb = ""): string {
  return v === undefined || v === null || v === "" ? fb : String(v).trim();
}

function orderYM(order: Record<string, unknown>, basis: string): { y: number; m: number } | null {
  const raw =
    basis === "dispatched"
      ? (order.billing_date ?? order.dispatched_at ?? order.dispatch_date)
      : (order.order_date ?? order.created_at ?? order.createdAt);
  if (typeof raw !== "string" && typeof raw !== "number" && !(raw instanceof Date)) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return { y: d.getFullYear(), m: d.getMonth() };
}

function heat(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "transparent";
  const a = 0.08 + 0.55 * Math.min(1, value / max);
  return `rgba(79,70,229,${a.toFixed(2)})`;
}

export default function ProductCrossAnalytics({
  contributions,
  salesUsersById,
  isOrdersFetching = false,
  qtyBasis = "approved",
  selectedYears = [],
  selectedMonths = [],
  externalFilterCaption,
  dataType = "approved",
  onDataTypeChange,
}: ProductCrossAnalyticsProps) {
  const [tab, setTab] = useState<TabId>("product-monthly");
  const [metric, setMetric] = useState<MetricMode>("revenue");
  const [yearOverride, setYearOverride] = useState<number | null>(null);
  const [entityId, setEntityId] = useState<string>("all");
  const [groupFocus, setGroupFocus] = useState<string>("");

  const { data: groupsData } = useListProductGroupsQuery({ limit: 10000 });
  const { data: productsData } = useListProductsQuery({ limit: "10000" });
  const { data: ordersData, isFetching: ordersFetching } = useListOrdersQuery({ limit: "10000" });

  // product → group
  const { productGroup, groupNames } = useMemo(() => {
    const gNames = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const g of arr(groupsData)) {
      const id = idOf(g._id ?? g.id);
      if (!id) continue;
      const name = s(g.name, "Group");
      gNames.set(id, name);
      byName.set(name.toLowerCase(), id);
    }
    gNames.set("ungrouped", "Other / Uncategorized");
    const pg = new Map<string, { gid: string; name: string }>();
    for (const p of arr(productsData)) {
      const pid = idOf(p._id ?? p.id);
      if (!pid) continue;
      const ref = p.product_group;
      let gid = idOf(ref);
      if (!gid || !gNames.has(gid)) {
        const nm = s((ref as Record<string, unknown> | undefined)?.name ?? ref).toLowerCase();
        gid = (nm && byName.get(nm)) || "ungrouped";
      }
      pg.set(pid, { gid, name: s(p.product_name ?? p.name, "Product") });
    }
    return { productGroup: pg, groupNames: gNames };
  }, [groupsData, productsData]);

  // monthly aggregation: entity → year → 12 months
  const monthly = useMemo(() => {
    const basis = qtyBasis as QtyBasis;
    const products = new Map<string, { name: string; years: Map<number, number[]> }>();
    const groups = new Map<string, { name: string; years: Map<number, number[]> }>();
    const yearsSeen = new Set<number>();
    const bump = (
      map: typeof products,
      id: string,
      name: string,
      y: number,
      m: number,
      v: number,
    ) => {
      let e = map.get(id);
      if (!e) {
        e = { name, years: new Map() };
        map.set(id, e);
      }
      let row = e.years.get(y);
      if (!row) {
        row = Array(12).fill(0) as number[];
        e.years.set(y, row);
      }
      row[m] += v;
    };

    for (const order of arr(ordersData)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!shouldIncludeOrder(order as any, basis)) continue;
      const ym = orderYM(order, qtyBasis);
      if (!ym) continue;
      yearsSeen.add(ym.y);
      const items = Array.isArray(order.order_items)
        ? (order.order_items as Record<string, unknown>[])
        : [];
      for (const it of items) {
        const pObj = (it.product as Record<string, unknown>) || {};
        const pid = idOf(it.product_id ?? it.product ?? pObj._id ?? pObj.id);
        const meta = pid ? productGroup.get(pid) : undefined;
        const pname = s(it.product_name ?? it.name ?? pObj.name ?? pObj.product_name ?? meta?.name, "Product");
        const gid = meta?.gid ?? "ungrouped";
        const key = pid || pname;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const val = itemMetricValue(it as any, metric === "revenue" ? "volume" : "quantity", basis, items as any);
        if (!val) continue;
        bump(products, key, pname, ym.y, ym.m, val);
        bump(groups, gid, groupNames.get(gid) ?? "Group", ym.y, ym.m, val);
      }
    }
    return { products, groups, years: Array.from(yearsSeen).sort((a, b) => b - a) };
  }, [ordersData, qtyBasis, metric, productGroup, groupNames]);

  const activeYear =
    yearOverride && monthly.years.includes(yearOverride)
      ? yearOverride
      : (selectedYears.length === 1 ? selectedYears[0] : monthly.years[0]) ?? new Date().getFullYear();

  const isMonthlyTab = tab === "product-monthly" || tab === "group-monthly";
  const entityMap = tab === "product-monthly" ? monthly.products : monthly.groups;

  const monthlyRows = useMemo(() => {
    return Array.from(entityMap.entries())
      .map(([id, e]) => {
        const months = e.years.get(activeYear) ?? (Array(12).fill(0) as number[]);
        return { id, name: e.name, months, total: months.reduce((a, b) => a + b, 0) };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [entityMap, activeYear]);

  const focusMonths = useMemo(() => {
    if (entityId === "all") {
      const sum = Array(12).fill(0) as number[];
      for (const r of monthlyRows) r.months.forEach((v, i) => (sum[i] += v));
      return sum;
    }
    return monthlyRows.find((r) => r.id === entityId)?.months ?? (Array(12).fill(0) as number[]);
  }, [monthlyRows, entityId]);

  const focusName =
    entityId === "all" ? (tab === "product-monthly" ? "All products" : "All groups") : (monthlyRows.find((r) => r.id === entityId)?.name ?? "—");
  const focusMax = Math.max(1, ...focusMonths);
  const focusTotal = focusMonths.reduce((a, b) => a + b, 0);
  const activeMonths = focusMonths.filter((v) => v > 0).length;
  const avgRun = activeMonths ? focusTotal / activeMonths : 0;
  const heatMax = Math.max(1, ...monthlyRows.slice(0, 15).flatMap((r) => r.months));

  // cross matrix from contributions
  const cross = useMemo(() => {
    const dim = tab === "group-sales" ? "sales" : "party";
    const cells = new Map<string, Map<string, number>>();
    const colNames = new Map<string, string>();
    const colTotals = new Map<string, number>();
    const rowTotals = new Map<string, number>();
    for (const c of contributions ?? []) {
      const gid = productGroup.get(c.productId)?.gid ?? "ungrouped";
      const cid = dim === "sales" ? c.salesUserId : c.partyId;
      if (!cid) continue;
      const cname =
        dim === "sales"
          ? (c.salesUserName || salesUsersById?.[cid] || "Sales Rep")
          : (c.partyName || "Party");
      const v = Number(metric === "revenue" ? c.volume : c.quantity) || 0;
      if (v <= 0) continue;
      colNames.set(cid, cname);
      let row = cells.get(gid);
      if (!row) {
        row = new Map();
        cells.set(gid, row);
      }
      row.set(cid, (row.get(cid) ?? 0) + v);
      colTotals.set(cid, (colTotals.get(cid) ?? 0) + v);
      rowTotals.set(gid, (rowTotals.get(gid) ?? 0) + v);
    }
    const cols = Array.from(colTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);
    const rows = Array.from(rowTotals.entries()).sort((a, b) => b[1] - a[1]);
    return { cells, colNames, colTotals, rowTotals, cols, rows, dim };
  }, [tab, contributions, productGroup, salesUsersById, metric]);

  const crossMax = Math.max(
    1,
    ...cross.rows.flatMap(([gid]) => cross.cols.map((cid) => cross.cells.get(gid)?.get(cid) ?? 0)),
  );
  const focusGid = groupFocus && cross.cells.has(groupFocus) ? groupFocus : (cross.rows[0]?.[0] ?? "");
  const focusRanked = useMemo(() => {
    const row = cross.cells.get(focusGid);
    if (!row) return [];
    const total = cross.rowTotals.get(focusGid) ?? 0;
    return Array.from(row.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, v]) => ({ id, name: cross.colNames.get(id) ?? "—", value: v, pct: total > 0 ? (v / total) * 100 : 0 }));
  }, [cross, focusGid]);

  const { exportPdf, isExporting } = useDashboardPdfExport();
  const dl = dataType === "billed" ? "Billed" : "Approved";

  const exportPdfReport = async () => {
    const meta = [
      `Data Mode: ${dl}`,
      `Metric: ${metric === "revenue" ? "Revenue (INR)" : "Quantity (Qty)"}`,
      `Period: ${externalFilterCaption || "All time"}`,
    ];

    if (isMonthlyTab) {
      const headers = [
        tab === "product-monthly" ? "Product" : "Product Group",
        ...MONTHS,
        "Total",
      ];
      const rows = monthlyRows.map((r) => [
        r.name,
        ...r.months.map((v) => Math.round(v * 100) / 100),
        Math.round(r.total * 100) / 100,
      ]);

      // Calculate column month sums
      const monthSums = MONTHS.map((_, mIdx) => {
        const sum = monthlyRows.reduce((acc, r) => acc + (r.months[mIdx] || 0), 0);
        return Math.round(sum * 100) / 100;
      });
      const grandTot = Math.round(monthlyRows.reduce((acc, r) => acc + r.total, 0) * 100) / 100;
      rows.push(["Total", ...monthSums, grandTot]);

      await exportPdf({
        title: `Product Cross Analytics - ${tab === "product-monthly" ? "Product Monthly Trends" : "Group Monthly Trends"}`,
        subtitle: `Monthly matrix distribution for year ${activeYear}`,
        metaLines: [...meta, `Year: ${activeYear}`],
        headers,
        rows,
        filename: reportFilename(`${tab}_${activeYear}_${dataType}`, selectedYears, selectedMonths),
        orientation: "landscape",
      });
    } else {
      const headers = [
        "Product Group",
        ...cross.cols.map((c) => cross.colNames.get(c) ?? c),
        "Total",
      ];
      const rows = cross.rows.map(([gid, tot]) => [
        groupNames.get(gid) ?? "Group",
        ...cross.cols.map((c) => Math.round((cross.cells.get(gid)?.get(c) ?? 0) * 100) / 100),
        Math.round(tot * 100) / 100,
      ]);

      // Column sums
      const colSums = cross.cols.map((c) => {
        let sum = 0;
        for (const [gid] of cross.rows) {
          sum += cross.cells.get(gid)?.get(c) ?? 0;
        }
        return Math.round(sum * 100) / 100;
      });
      const grandSum = Math.round(cross.rows.reduce((s, [, tot]) => s + tot, 0) * 100) / 100;
      rows.push(["Total", ...colSums, grandSum]);

      await exportPdf({
        title: `Product Cross Analytics - ${tab === "group-sales" ? "Group × Sales Persons" : "Group × Parties"}`,
        subtitle: `Cross-dimensional sales matrix (${dl} data)`,
        metaLines: meta,
        headers,
        rows,
        filename: reportFilename(`${tab}_${dataType}`, selectedYears, selectedMonths),
        orientation: "landscape",
      });
    }
  };

  const seg = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
      active
        ? "bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400"
        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
    }`;
  const selectCls =
    "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100 cursor-pointer";
  const loading = isOrdersFetching || ordersFetching;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-4 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Product &amp; Group Deep Analytics
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Monthly trends by product and group, plus group × sales person and group × party matrices.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onDataTypeChange && (
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              <button type="button" onClick={() => onDataTypeChange("approved")} className={seg(dataType === "approved")}>Approved</button>
              <button type="button" onClick={() => onDataTypeChange("billed")} className={seg(dataType === "billed")}>Billed</button>
            </div>
          )}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            <button type="button" onClick={() => setMetric("revenue")} className={seg(metric === "revenue")}>Revenue (₹)</button>
            <button type="button" onClick={() => setMetric("quantity")} className={seg(metric === "quantity")}>Quantity (Qty)</button>
          </div>
          <ReportDownloadButton
            onDownload={exportPdfReport}
            disabled={loading || isExporting}
            loading={isExporting}
            size="sm"
            label="Export PDF"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setEntityId("all");
              }}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                active
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading && <p className="mt-4 text-xs text-slate-500">Loading analytics…</p>}

      {/* MONTHLY TABS */}
      {isMonthlyTab && !loading && (
        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <select value={activeYear} onChange={(e) => setYearOverride(Number(e.target.value))} className={selectCls}>
              {(monthly.years.length ? monthly.years : [activeYear]).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className={`${selectCls} max-w-xs`}>
              <option value="all">{tab === "product-monthly" ? "All products" : "All groups"}</option>
              {monthlyRows.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <span className="ml-auto text-xs text-slate-500">
              {focusName}: <b className="text-slate-900 dark:text-slate-100">{fmtValue(focusTotal, metric)}</b> · avg/month{" "}
              <b>{fmtValue(avgRun, metric)}</b>
            </span>
          </div>

          {/* Bar chart */}
          <div className="rounded-xl border border-slate-100 p-3 dark:border-white/5">
            <div className="relative flex h-48 items-end gap-1.5 sm:gap-2">
              {avgRun > 0 && (
                <div
                  className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-amber-500/70"
                  style={{ bottom: `${(avgRun / focusMax) * 100}%` }}
                >
                  <span className="absolute right-0 -top-4 text-[10px] font-semibold text-amber-600">avg</span>
                </div>
              )}
              {focusMonths.map((v, i) => {
                const prev = i > 0 ? focusMonths[i - 1] : 0;
                const mom = prev > 0 ? ((v - prev) / prev) * 100 : null;
                return (
                  <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end">
                    <span className="mb-1 hidden text-[10px] font-semibold text-slate-600 group-hover:block dark:text-slate-300">
                      {fmtValue(v, metric)}
                      {mom !== null && v > 0 && (
                        <span className={mom >= 0 ? "text-emerald-600" : "text-rose-600"}> {mom >= 0 ? "▲" : "▼"}{Math.abs(mom).toFixed(0)}%</span>
                      )}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-indigo-600 to-violet-400 transition-all"
                      style={{ height: `${(v / focusMax) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
                    />
                    <span className="mt-1 text-[10px] text-slate-500">{MONTHS[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Heatmap */}
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/5">
            <table className="w-full min-w-[820px] border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr className="text-slate-500 dark:text-slate-400">
                  <th className="py-2 px-3 text-left font-semibold">{tab === "product-monthly" ? "Product" : "Product Group"}</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="py-2 px-1.5 text-right font-semibold">{m}</th>
                  ))}
                  <th className="py-2 px-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {monthlyRows.slice(0, 15).map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/50" onClick={() => setEntityId(r.id)}>
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100 max-w-[220px] truncate">{r.name}</td>
                    {r.months.map((v, i) => (
                      <td key={i} className="py-2 px-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200" style={{ backgroundColor: heat(v, heatMax) }}>
                        {v > 0 ? (metric === "revenue" ? fmtMoney(v).replace("₹", "") : Math.round(v).toLocaleString("en-IN")) : "·"}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{fmtValue(r.total, metric)}</td>
                  </tr>
                ))}
                {monthlyRows.length === 0 && (
                  <tr><td colSpan={14} className="py-8 text-center text-slate-500">No orders for {activeYear}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400">Showing top 15 by total · click a row to chart it · CSV exports all rows.</p>
        </div>
      )}

      {/* CROSS TABS */}
      {!isMonthlyTab && !loading && (
        <div className="mt-4 space-y-5">
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/5">
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr className="text-slate-500 dark:text-slate-400">
                  <th className="py-2 px-3 text-left font-semibold">Product Group</th>
                  {cross.cols.map((c) => (
                    <th key={c} className="py-2 px-2 text-right font-semibold max-w-[110px] truncate">{cross.colNames.get(c)}</th>
                  ))}
                  <th className="py-2 px-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {cross.rows.map(([gid, tot]) => (
                  <tr
                    key={gid}
                    onClick={() => setGroupFocus(gid)}
                    className={`cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/50 ${gid === focusGid ? "bg-indigo-50/40 dark:bg-indigo-900/10" : ""}`}
                  >
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">{groupNames.get(gid) ?? "Group"}</td>
                    {cross.cols.map((c) => {
                      const v = cross.cells.get(gid)?.get(c) ?? 0;
                      return (
                        <td key={c} className="py-2 px-2 text-right tabular-nums" style={{ backgroundColor: heat(v, crossMax) }}>
                          {v > 0 ? (metric === "revenue" ? fmtMoney(v).replace("₹", "") : Math.round(v).toLocaleString("en-IN")) : "·"}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{fmtValue(tot, metric)}</td>
                  </tr>
                ))}
                {cross.rows.length === 0 && (
                  <tr><td colSpan={cross.cols.length + 2} className="py-8 text-center text-slate-500">No data for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {focusGid && focusRanked.length > 0 && (
            <div className="rounded-xl border border-slate-100 p-4 dark:border-white/5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Top {cross.dim === "sales" ? "sales people" : "parties"} in {groupNames.get(focusGid) ?? "group"}
              </h3>
              <div className="mt-3 space-y-2">
                {focusRanked.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3 text-xs">
                    <span className="w-5 text-right font-bold text-slate-400">{i + 1}</span>
                    <span className="w-40 sm:w-56 truncate font-medium text-slate-800 dark:text-slate-200">{r.name}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${Math.min(100, r.pct)}%` }} />
                    </div>
                    <span className="w-24 text-right font-semibold tabular-nums">{fmtValue(r.value, metric)}</span>
                    <span className="w-12 text-right text-slate-500">{r.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-400">
            Top 8 {cross.dim === "sales" ? "sales people" : "parties"} shown as columns · uses the selected period · click a group row for its ranking.
          </p>
        </div>
      )}
    </div>
  );
}

