"use client";

import { useMemo, useState } from "react";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  Search,
  Table as TableIcon,
  X,
} from "lucide-react";

import { LargeModalBackdrop } from "@/components/portal/shared/ui/modals/LargeModalBackdrop";
import { largeModalPanelClass } from "@/components/portal/shared/ui/modals/modalLayout";
import {
  useListProductGroupsQuery,
  useListProductsQuery,
  useListOrdersQuery,
} from "@/store/api";
import type { DashboardOrdersSummary } from "@/store/api/slices/dashboardApi";
import {
  downloadCsvFile,
  reportFilename,
  roundToTwo,
} from "./reportDownloadUtils";
import {
  itemMetricValue,
  normalizeRateType,
  type QtyBasis,
} from "./leaderboardUtils";
import { shouldIncludeOrder } from "./featuredMatrixUtils";

export type ProductReportType =
  | "sku-ledger"
  | "group-summary"
  | "hierarchy-tree"
  | "rate-realization";

export interface ProductReportGeneratorProps {
  leaderboardProducts?: DashboardOrdersSummary["leaderboards"]["products"];
  isOrdersFetching?: boolean;
  qtyBasis?: string;
  selectedYears?: number[];
  selectedMonths?: number[];
  externalFilterCaption?: string;
  dataType?: "approved" | "billed";
  onDataTypeChange?: (type: "approved" | "billed") => void;
  className?: string;
}

type SkuRow = {
  id: string;
  name: string;
  code: string;
  groupId: string;
  groupName: string;
  quantity: number;
  revenue: number;
  srQty: number;
  srRev: number;
  sraQty: number;
  sraRev: number;
  crQty: number;
  crRev: number;
  parties: Set<string>;
  ordersCount: number;
};

type SkuRowFull = SkuRow & {
  rank: number;
  partiesCount: number;
  effectiveRate: number;
  revenuePct: number;
  quantityPct: number;
  abcClass: "A" | "B" | "C";
};

const REPORT_LABELS: Record<ProductReportType, string> = {
  "sku-ledger": "SKU Commercial Performance Ledger",
  "group-summary": "Product Group Commercial Summary",
  "hierarchy-tree": "Hierarchical Group → SKU Tree",
  "rate-realization": "Rate Tier Distribution (SR/SRA/CR)",
};

function formatMoney(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatQty(val: number): string {
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

function str(v: unknown, fallback = ""): string {
  if (v === undefined || v === null || v === "") return fallback;
  return String(v).trim();
}

export default function ProductReportGenerator({
  leaderboardProducts,
  isOrdersFetching = false,
  qtyBasis = "approved",
  selectedYears = [],
  selectedMonths = [],
  externalFilterCaption,
  dataType = "approved",
  onDataTypeChange,
  className = "",
}: ProductReportGeneratorProps) {
  const [reportType, setReportType] = useState<ProductReportType>("sku-ledger");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [metricMode, setMetricMode] = useState<"revenue" | "quantity">("revenue");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: groupsData, isFetching: isGroupsFetching } =
    useListProductGroupsQuery({ limit: 10000 });
  const { data: productsData, isFetching: isProductsFetching } =
    useListProductsQuery({ limit: "10000" });
  const { data: rawOrdersData, isFetching: isOrdersQueryFetching } =
    useListOrdersQuery({ limit: "10000" });

  const isLoading =
    isOrdersFetching || isGroupsFetching || isProductsFetching || isOrdersQueryFetching;

  const { groupList, productDetailsMap } = useMemo(() => {
    const gList: { id: string; name: string }[] = [];
    const gMeta = new Map<string, { id: string; name: string }>();
    const groupByName = new Map<string, string>();
    const pDetails = new Map<
      string,
      { name: string; code: string; groupId: string; groupName: string }
    >();

    for (const g of extractArray(groupsData)) {
      const gId = extractId(g._id ?? g.id);
      if (!gId) continue;
      const item = { id: gId, name: str(g.name, "Untitled Group") };
      gList.push(item);
      gMeta.set(gId, item);
      groupByName.set(item.name.toLowerCase(), gId);
    }

    for (const p of extractArray(productsData)) {
      const pId = extractId(p._id ?? p.id);
      if (!pId) continue;
      const groupRef = p.product_group;
      const refId = extractId(groupRef);
      let gId = "ungrouped";
      if (refId && gMeta.has(refId)) {
        gId = refId;
      } else {
        const rawName = str(
          (groupRef as Record<string, unknown> | undefined)?.name ?? groupRef,
        ).toLowerCase();
        if (rawName && groupByName.has(rawName)) gId = groupByName.get(rawName)!;
      }
      pDetails.set(pId, {
        name: str(p.product_name ?? p.name, "Product"),
        code: str(p.sku ?? p.code ?? p.product_code, "—"),
        groupId: gId,
        groupName: gMeta.get(gId)?.name ?? "Other / Uncategorized",
      });
    }

    gList.push({ id: "ungrouped", name: "Other / Uncategorized" });
    return { groupList: gList, productDetailsMap: pDetails };
  }, [groupsData, productsData]);

  const { skuLedgerRows, groupSummaryRows } = useMemo(() => {
    const skuMap = new Map<string, SkuRow>();
    const basis = qtyBasis as QtyBasis;

    for (const order of extractArray(rawOrdersData)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!shouldIncludeOrder(order as any, qtyBasis as any)) continue;
      const pId = extractId(order.party);
      const items = Array.isArray(order.order_items)
        ? (order.order_items as Record<string, unknown>[])
        : [];

      for (const it of items) {
        const pObj = (it.product as Record<string, unknown>) || {};
        const prodId = extractId(it.product_id ?? it.product ?? pObj._id ?? pObj.id);
        const details = prodId ? productDetailsMap.get(prodId) : undefined;
        const name = str(
          it.product_name ?? it.name ?? pObj.name ?? pObj.product_name ?? details?.name,
          "Product",
        );
        const code = str(
          it.product_code ?? it.code ?? pObj.code ?? pObj.product_code ?? details?.code,
          "—",
        );
        const key = prodId || `${name}___${code}`;

        let rec = skuMap.get(key);
        if (!rec) {
          rec = {
            id: key,
            name,
            code,
            groupId: details?.groupId ?? "ungrouped",
            groupName: details?.groupName ?? "Other / Uncategorized",
            quantity: 0,
            revenue: 0,
            srQty: 0,
            srRev: 0,
            sraQty: 0,
            sraRev: 0,
            crQty: 0,
            crRev: 0,
            parties: new Set<string>(),
            ordersCount: 0,
          };
          skuMap.set(key, rec);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q = itemMetricValue(it as any, "quantity", basis, items as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = itemMetricValue(it as any, "volume", basis, items as any);
        const rt = normalizeRateType(it.applied_rate_type as string);

        rec.quantity += q;
        rec.revenue += v;
        rec.ordersCount += 1;
        if (pId) rec.parties.add(pId);
        if (rt === "SR") {
          rec.srQty += q;
          rec.srRev += v;
        } else if (rt === "SRA") {
          rec.sraQty += q;
          rec.sraRev += v;
        } else if (rt === "CR") {
          rec.crQty += q;
          rec.crRev += v;
        }
      }
    }

    if (skuMap.size === 0 && leaderboardProducts?.length) {
      for (const lb of leaderboardProducts) {
        const qTot = Number(lb.quantity?.total) || 0;
        const vTot = Number(lb.volume?.total) || 0;
        if (qTot <= 0 && vTot <= 0) continue;
        skuMap.set(lb.name, {
          id: lb.name,
          name: lb.name,
          code: "—",
          groupId: "ungrouped",
          groupName: "Other / Uncategorized",
          quantity: qTot,
          revenue: vTot,
          srQty: Number(lb.quantity?.sr) || 0,
          srRev: Number(lb.volume?.sr) || 0,
          sraQty: Number(lb.quantity?.sra) || 0,
          sraRev: Number(lb.volume?.sra) || 0,
          crQty: Number(lb.quantity?.cr) || 0,
          crRev: Number(lb.volume?.cr) || 0,
          parties: new Set<string>(),
          ordersCount: 1,
        });
      }
    }

    const all = Array.from(skuMap.values())
      .filter((p) => p.quantity > 0 || p.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
    const totalRev = all.reduce((s, x) => s + x.revenue, 0);
    const totalQty = all.reduce((s, x) => s + x.quantity, 0);

    const cumulative = all.reduce<number[]>((acc, s) => {
      acc.push((acc.length ? acc[acc.length - 1] : 0) + s.revenue);
      return acc;
    }, []);
    const skus: SkuRowFull[] = all.map((s, idx) => {
      const cumPct = totalRev > 0 ? (cumulative[idx] / totalRev) * 100 : 0;
      return {
        ...s,
        rank: idx + 1,
        partiesCount: s.parties.size,
        effectiveRate: roundToTwo(s.quantity > 0 ? s.revenue / s.quantity : 0),
        revenuePct: roundToTwo(totalRev > 0 ? (s.revenue / totalRev) * 100 : 0),
        quantityPct: roundToTwo(totalQty > 0 ? (s.quantity / totalQty) * 100 : 0),
        abcClass: cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C",
      };
    });

    const gMap = new Map<
      string,
      {
        id: string;
        name: string;
        quantity: number;
        revenue: number;
        skus: SkuRowFull[];
        parties: Set<string>;
      }
    >();
    for (const s of skus) {
      let g = gMap.get(s.groupId);
      if (!g) {
        g = {
          id: s.groupId,
          name: s.groupName,
          quantity: 0,
          revenue: 0,
          skus: [],
          parties: new Set<string>(),
        };
        gMap.set(s.groupId, g);
      }
      g.quantity += s.quantity;
      g.revenue += s.revenue;
      g.skus.push(s);
      s.parties.forEach((p) => g!.parties.add(p));
    }

    const groups = Array.from(gMap.values())
      .map((g) => ({
        id: g.id,
        name: g.name,
        quantity: g.quantity,
        revenue: g.revenue,
        activeSKUsCount: g.skus.length,
        partiesCount: g.parties.size,
        effectiveRate: roundToTwo(g.quantity > 0 ? g.revenue / g.quantity : 0),
        revenuePct: roundToTwo(totalRev > 0 ? (g.revenue / totalRev) * 100 : 0),
        topSku: g.skus[0]?.name ?? "—",
        skus: g.skus,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return { skuLedgerRows: skus, groupSummaryRows: groups };
  }, [rawOrdersData, qtyBasis, productDetailsMap, leaderboardProducts]);

  const sortBy = <T extends { quantity: number; revenue: number }>(list: T[]) =>
    list
      .slice()
      .sort((a, b) =>
        metricMode === "quantity" ? b.quantity - a.quantity : b.revenue - a.revenue,
      );

  const filteredSkus = useMemo(() => {
    let list = skuLedgerRows;
    if (selectedGroupId !== "all") list = list.filter((s) => s.groupId === selectedGroupId);
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.groupName.toLowerCase().includes(q),
      );
    }
    return sortBy(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuLedgerRows, selectedGroupId, searchQuery, metricMode]);

  const filteredGroups = useMemo(() => {
    let list = groupSummaryRows;
    if (selectedGroupId !== "all") list = list.filter((g) => g.id === selectedGroupId);
    const q = searchQuery.toLowerCase().trim();
    if (q) list = list.filter((g) => g.name.toLowerCase().includes(q));
    return sortBy(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupSummaryRows, selectedGroupId, searchQuery, metricMode]);

  const totals = useMemo(() => {
    const qty = filteredSkus.reduce((a, s) => a + s.quantity, 0);
    const rev = filteredSkus.reduce((a, s) => a + s.revenue, 0);
    return {
      qty,
      rev,
      effRate: roundToTwo(qty > 0 ? rev / qty : 0),
      count: filteredSkus.length,
    };
  }, [filteredSkus]);

  const totalPages = Math.max(1, Math.ceil(filteredSkus.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSkus = filteredSkus.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleGroupExpand = (id: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleExportCsv = () => {
    const dl = dataType === "billed" ? "Billed" : "Approved";
    const meta = [
      `Report: ${REPORT_LABELS[reportType]}`,
      `Data Scope: ${dl} Orders`,
      `Period: ${externalFilterCaption || "All time"}`,
    ];
    const file = (base: string) =>
      reportFilename(`${base}_${dataType}`, selectedYears, selectedMonths);

    if (reportType === "sku-ledger") {
      downloadCsvFile(
        file("sku_performance_ledger"),
        [
          "Rank", "Product Name", "SKU Code", "Product Group",
          `${dl} Quantity (Qty)`, `${dl} Revenue (INR)`, "Effective Rate (INR/Qty)",
          "Revenue Share (%)", "Quantity Share (%)",
          "SR Revenue (INR)", "SRA Revenue (INR)", "CR Revenue (INR)",
          "Distinct Buyers", "ABC Class",
        ],
        filteredSkus.map((s, i) => [
          i + 1, s.name, s.code, s.groupName,
          roundToTwo(s.quantity), roundToTwo(s.revenue), s.effectiveRate,
          `${s.revenuePct}%`, `${s.quantityPct}%`,
          roundToTwo(s.srRev), roundToTwo(s.sraRev), roundToTwo(s.crRev),
          s.partiesCount, `Class ${s.abcClass}`,
        ]),
        meta,
      );
    } else if (reportType === "group-summary") {
      downloadCsvFile(
        file("product_group_summary"),
        [
          "Rank", "Product Group", "Active SKUs", `${dl} Quantity (Qty)`,
          `${dl} Revenue (INR)`, "Effective Rate (INR/Qty)", "Revenue Share (%)",
          "Distinct Buying Parties", "Top Selling SKU",
        ],
        filteredGroups.map((g, i) => [
          i + 1, g.name, g.activeSKUsCount, roundToTwo(g.quantity),
          roundToTwo(g.revenue), g.effectiveRate, `${g.revenuePct}%`,
          g.partiesCount, g.topSku,
        ]),
        meta,
      );
    } else if (reportType === "hierarchy-tree") {
      const rows: Array<Array<string | number>> = [];
      for (const g of filteredGroups) {
        rows.push([
          `[GROUP] ${g.name}`, "—", "Group", roundToTwo(g.quantity),
          roundToTwo(g.revenue), g.effectiveRate, `${g.revenuePct}%`,
        ]);
        for (const s of g.skus) {
          rows.push([
            `    ${s.name}`, s.code, "SKU", roundToTwo(s.quantity),
            roundToTwo(s.revenue), s.effectiveRate, `${s.revenuePct}%`,
          ]);
        }
      }
      downloadCsvFile(
        file("group_sku_hierarchy"),
        [
          "Group / SKU", "SKU Code", "Type", `${dl} Quantity (Qty)`,
          `${dl} Revenue (INR)`, "Effective Rate (INR/Qty)", "Share (%)",
        ],
        rows,
        meta,
      );
    } else {
      const rate = (r: number, q: number) => (q > 0 ? roundToTwo(r / q) : 0);
      downloadCsvFile(
        file("rate_tier_realization"),
        [
          "Product Name", "SKU Code", "Product Group",
          "SR Qty", "SR Rev (INR)", "SR Rate",
          "SRA Qty", "SRA Rev (INR)", "SRA Rate",
          "CR Qty", "CR Rev (INR)", "CR Rate",
          "Total Qty", "Total Rev (INR)", "Avg Rate (INR/Qty)",
        ],
        filteredSkus.map((s) => [
          s.name, s.code, s.groupName,
          roundToTwo(s.srQty), roundToTwo(s.srRev), rate(s.srRev, s.srQty),
          roundToTwo(s.sraQty), roundToTwo(s.sraRev), rate(s.sraRev, s.sraQty),
          roundToTwo(s.crQty), roundToTwo(s.crRev), rate(s.crRev, s.crQty),
          roundToTwo(s.quantity), roundToTwo(s.revenue), s.effectiveRate,
        ]),
        meta,
      );
    }
  };

  const toggleBtn = (active: boolean, accent: string) =>
    `rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
      active
        ? `bg-white ${accent} shadow-2xs dark:bg-slate-900`
        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
    }`;

  const selectCls =
    "w-full appearance-none rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100 cursor-pointer";

  const thCls = "py-2.5 px-3 font-semibold";

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-white/10 dark:bg-slate-900 ${className}`}
    >
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-4 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-xs">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Product &amp; Group Report Studio
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Generate SKU ledgers, category summaries, hierarchy statements and rate-tier reports.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onDataTypeChange && (
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              <button type="button" onClick={() => onDataTypeChange("approved")}
                className={toggleBtn(dataType === "approved", "text-blue-600 dark:text-blue-400")}>
                Approved
              </button>
              <button type="button" onClick={() => onDataTypeChange("billed")}
                className={toggleBtn(dataType === "billed", "text-blue-600 dark:text-blue-400")}>
                Billed
              </button>
            </div>
          )}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            <button type="button" onClick={() => setMetricMode("revenue")}
              className={toggleBtn(metricMode === "revenue", "text-emerald-600 dark:text-emerald-400")}>
              Revenue (₹)
            </button>
            <button type="button" onClick={() => setMetricMode("quantity")}
              className={toggleBtn(metricMode === "quantity", "text-blue-600 dark:text-blue-400")}>
              Quantity (Qty)
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Preview</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isLoading || filteredSkus.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* CONFIG */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Report Type
          </label>
          <div className="relative">
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as ProductReportType);
                setCurrentPage(1);
              }}
              className={selectCls}
            >
              {(Object.keys(REPORT_LABELS) as ProductReportType[]).map((k) => (
                <option key={k} value={k}>{REPORT_LABELS[k]}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Product Group
          </label>
          <div className="relative">
            <select
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setCurrentPage(1);
              }}
              className={selectCls}
            >
              <option value="all">All Product Groups ({groupList.length})</option>
              {groupList.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Product name, code, group..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: "SKUs in scope", value: String(totals.count), cls: "text-slate-900 dark:text-slate-100" },
          { label: "Volume", value: formatQty(totals.qty), cls: "text-blue-600 dark:text-blue-400" },
          { label: "Revenue", value: formatMoney(totals.rev), cls: "text-emerald-600 dark:text-emerald-400" },
          { label: "Avg Realization", value: `₹${totals.effRate.toLocaleString("en-IN")}/Qty`, cls: "text-indigo-600 dark:text-indigo-400" },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 dark:border-white/5 dark:bg-slate-800/40">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{c.label}</span>
            <p className={`mt-0.5 text-base font-bold ${c.cls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* PREVIEW MODAL */}
      {isPreviewOpen && (
        <LargeModalBackdrop>
          <div className={`${largeModalPanelClass} flex flex-col`}>
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:px-6 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                  <TableIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {REPORT_LABELS[reportType]}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {filteredSkus.length} SKUs · {dataType === "billed" ? "Billed" : "Approved"} data
                    {externalFilterCaption ? ` · ${externalFilterCaption}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
              {reportType === "sku-ledger" && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-white/10">
                    <tr className="text-slate-500 dark:text-slate-400">
                      <th className={thCls}>#</th>
                      <th className={thCls}>Product</th>
                      <th className={thCls}>Code</th>
                      <th className={thCls}>Group</th>
                      <th className={`${thCls} text-right`}>Qty</th>
                      <th className={`${thCls} text-right`}>Revenue</th>
                      <th className={`${thCls} text-right`}>₹/Qty</th>
                      <th className={`${thCls} text-right`}>Share</th>
                      <th className={`${thCls} text-center`}>ABC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {paginatedSkus.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 font-bold text-slate-400">{s.rank}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">{s.name}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{s.code}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{s.groupName}</td>
                        <td className="py-2.5 px-3 text-right">{formatQty(s.quantity)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(s.revenue)}</td>
                        <td className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400">₹{s.effectiveRate.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 px-3 text-right">{s.revenuePct}%</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              s.abcClass === "A"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                                : s.abcClass === "B"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {s.abcClass}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="font-bold border-t-2 border-slate-200 dark:border-white/10">
                    <tr>
                      <td colSpan={4} className="py-3 px-3">Total ({filteredSkus.length} SKUs)</td>
                      <td className="py-3 px-3 text-right">{formatQty(totals.qty)}</td>
                      <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400">{formatMoney(totals.rev)}</td>
                      <td className="py-3 px-3 text-right text-indigo-600 dark:text-indigo-400">₹{totals.effRate.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-3 text-right">100%</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}

              {reportType === "group-summary" && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-white/10">
                    <tr className="text-slate-500 dark:text-slate-400">
                      <th className={thCls}>#</th>
                      <th className={thCls}>Group</th>
                      <th className={`${thCls} text-center`}>SKUs</th>
                      <th className={`${thCls} text-right`}>Qty</th>
                      <th className={`${thCls} text-right`}>Revenue</th>
                      <th className={`${thCls} text-right`}>₹/Qty</th>
                      <th className={`${thCls} text-right`}>Share</th>
                      <th className={thCls}>Top SKU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredGroups.map((g, i) => (
                      <tr key={g.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 font-bold text-slate-400">{i + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">{g.name}</td>
                        <td className="py-2.5 px-3 text-center text-blue-600 dark:text-blue-400">{g.activeSKUsCount}</td>
                        <td className="py-2.5 px-3 text-right">{formatQty(g.quantity)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(g.revenue)}</td>
                        <td className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400">₹{g.effectiveRate.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 px-3 text-right">{g.revenuePct}%</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate max-w-xs">{g.topSku}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === "hierarchy-tree" && (
                <div className="space-y-3">
                  {filteredGroups.map((g) => {
                    const open = expandedGroups.has(g.id);
                    return (
                      <div key={g.id} className="rounded-xl border border-slate-200 overflow-hidden dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => toggleGroupExpand(g.id)}
                          className="w-full flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-slate-100/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            {open ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                            <Boxes className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="font-bold text-slate-900 dark:text-slate-100">{g.name}</span>
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                              {g.activeSKUsCount} SKUs
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="font-semibold text-slate-600 dark:text-slate-300">{formatQty(g.quantity)}</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(g.revenue)}</span>
                            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{g.revenuePct}%</span>
                          </div>
                        </button>
                        {open && (
                          <table className="w-full text-left border-collapse text-xs">
                            <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                              {g.skus.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40">
                                  <td className="py-2 px-4 font-medium text-slate-800 dark:text-slate-200">{s.name}</td>
                                  <td className="py-2 px-2 font-mono text-[11px] text-slate-500">{s.code}</td>
                                  <td className="py-2 px-2 text-right">{formatQty(s.quantity)}</td>
                                  <td className="py-2 px-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(s.revenue)}</td>
                                  <td className="py-2 px-4 text-right text-indigo-600 dark:text-indigo-400">₹{s.effectiveRate.toLocaleString("en-IN")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {reportType === "rate-realization" && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-white/10">
                    <tr className="text-slate-500 dark:text-slate-400">
                      <th className={thCls}>Product</th>
                      <th className={thCls}>Group</th>
                      <th className={`${thCls} text-right`}>SR</th>
                      <th className={`${thCls} text-right`}>SRA</th>
                      <th className={`${thCls} text-right`}>CR</th>
                      <th className={`${thCls} text-right`}>Total</th>
                      <th className={`${thCls} text-right`}>₹/Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {paginatedSkus.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">{s.name}</td>
                        <td className="py-2.5 px-3 text-slate-500">{s.groupName}</td>
                        <td className="py-2.5 px-3 text-right">{formatMoney(s.srRev)}</td>
                        <td className="py-2.5 px-3 text-right">{formatMoney(s.sraRev)}</td>
                        <td className="py-2.5 px-3 text-right">{formatMoney(s.crRev)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(s.revenue)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">₹{s.effectiveRate.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {(reportType === "sku-ledger" || reportType === "rate-realization") && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-6 dark:border-white/10">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>{filteredSkus.length} total</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(safePage - 1)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="px-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(safePage + 1)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </LargeModalBackdrop>
      )}
    </div>
  );
}
