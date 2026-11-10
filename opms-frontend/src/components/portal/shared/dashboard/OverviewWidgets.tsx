"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  Clock,
  LayoutGrid,
  Navigation,
  Package,
  PackageCheck,
  PauseCircle,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import OrderQuickAccess from "@/components/portal/shared/orders/list/OrderQuickAccess";
import type { OrderQuickAccessRole } from "@/components/portal/shared/orders/list/orderQuickAccessConfig";
import {
  computeOrderWorkflowTabStats,
  type OrderWorkflowCategoryOptions,
  type OrderWorkflowTabCategory,
  type OrderWorkflowTabStat,
  type OrderWorkflowTabStats,
} from "@/components/portal/shared/orders/list/orderWorkflowTabs";
import PeriodHeadingCaption from "./PeriodHeadingCaption";
import ReportDownloadButton from "./ReportDownloadButton";
import { formatPeriodLabel } from "./periodFilterUtils";
import { downloadCsvFile, reportFilename } from "./reportDownloadUtils";
import { usePortalSettings } from "@/hooks/usePortalSettings";

import type { QtyBasis } from "./leaderboardUtils";

interface OverviewWidgetsProps {
  orders?: unknown[];
  filteredOrders?: unknown[];
  tabStats?: Record<string, OrderWorkflowTabStat>;
  queueCounts?: Record<string, number>;
  isOrdersFetching: boolean;
  categoryOptions?: OrderWorkflowCategoryOptions;
  role: OrderQuickAccessRole;
  portalHome?: string;
  selectedYears: number[];
  selectedMonths?: number[];
  dateFilter?: string;
  customDateFrom?: string;
  customDateTo?: string;
  qtyBasis?: QtyBasis;
  showPricing?: boolean;
}

interface PieSliceItem {
  key: string;
  label: string;
  value: number;
  amount: number;
  quantity: number;
  kitQuantity: number;
  count: number;
  pct: number;
  color: string;
  hoverColor: string;
  Icon: LucideIcon;
}

const APPROVAL_PENDING_PIPELINE_TABS: OrderWorkflowTabCategory[] = [
  "pending_admin_approval",
  "due_sheet_pending",
  "pending_finance_approval",
  "pending_account_approval",
];

const EMPTY_STAT: OrderWorkflowTabStat = {
  count: 0,
  quantity: 0,
  kitQuantity: 0,
  amount: 0,
};

function formatMoney(v: number): string {
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatCenterMoney(v: number): string {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)} K`;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatQty(v: number): string {
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function sumStats(stats: OrderWorkflowTabStat[]): OrderWorkflowTabStat {
  return stats.reduce(
    (acc, row) => ({
      count: acc.count + row.count,
      quantity: acc.quantity + row.quantity,
      kitQuantity: acc.kitQuantity + row.kitQuantity,
      amount: acc.amount + row.amount,
    }),
    { ...EMPTY_STAT },
  );
}

export default function OverviewWidgets({
  filteredOrders = [],
  tabStats: tabStatsProp,
  queueCounts,
  isOrdersFetching,
  categoryOptions,
  role,
  portalHome,
  selectedYears,
  selectedMonths,
  dateFilter,
  customDateFrom,
  customDateTo,
  qtyBasis = "approved",
  showPricing,
}: OverviewWidgetsProps) {
  const { canSalesMapQuantity, canSalesMapVolume } = usePortalSettings();
  const isSales = role === "sales";
  const allowVolume = !isSales || canSalesMapVolume;
  const allowQuantity = !isSales || canSalesMapQuantity;
  const showAmount = showPricing ?? allowVolume;

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const tabStats = useMemo(
    () =>
      (tabStatsProp as OrderWorkflowTabStats | undefined) ??
      computeOrderWorkflowTabStats(filteredOrders, categoryOptions, qtyBasis),
    [tabStatsProp, filteredOrders, categoryOptions, qtyBasis],
  );

  const kpis = useMemo(() => {
    const delivered = tabStats.closed_delivered ?? EMPTY_STAT;
    const approvalPending = sumStats(
      APPROVAL_PENDING_PIPELINE_TABS.map((id) => tabStats[id] ?? EMPTY_STAT),
    );
    const dispatchPending = tabStats.open_dispatched ?? EMPTY_STAT;
    const transportPending = tabStats.transport_pending ?? EMPTY_STAT;
    const inTransit = tabStats.in_transit ?? EMPTY_STAT;
    const cancelled = tabStats.cancelled ?? EMPTY_STAT;
    const rejected = tabStats.rejected ?? EMPTY_STAT;
    const onHold = tabStats.on_hold ?? EMPTY_STAT;
    const all = tabStats.all ?? EMPTY_STAT;

    const orderVolume: OrderWorkflowTabStat = {
      count: Math.max(
        0,
        all.count - cancelled.count - rejected.count - onHold.count,
      ),
      quantity: Math.max(
        0,
        all.quantity - cancelled.quantity - rejected.quantity - onHold.quantity,
      ),
      kitQuantity: Math.max(
        0,
        all.kitQuantity -
          cancelled.kitQuantity -
          rejected.kitQuantity -
          onHold.kitQuantity,
      ),
      amount: Math.max(
        0,
        all.amount - cancelled.amount - rejected.amount - onHold.amount,
      ),
    };

    return {
      orderVolume,
      delivered,
      approvalPending,
      dispatchPending,
      transportPending,
      inTransit,
      cancelled,
      rejected,
      onHold,
    };
  }, [tabStats]);

  const rawSlices = useMemo(() => {
    const getValue = (stat: OrderWorkflowTabStat) =>
      showAmount ? stat.amount : allowQuantity ? stat.quantity : stat.count;

    return [
      {
        key: "delivered",
        label: "Delivered",
        value: getValue(kpis.delivered),
        amount: kpis.delivered.amount,
        quantity: kpis.delivered.quantity,
        kitQuantity: kpis.delivered.kitQuantity,
        count: kpis.delivered.count,
        color: "#10b981", // Emerald
        hoverColor: "#059669",
        Icon: PackageCheck,
      },
      {
        key: "in_transit",
        label: "In Transit",
        value: getValue(kpis.inTransit),
        amount: kpis.inTransit.amount,
        quantity: kpis.inTransit.quantity,
        kitQuantity: kpis.inTransit.kitQuantity,
        count: kpis.inTransit.count,
        color: "#0284c7", // Sky
        hoverColor: "#0369a1",
        Icon: Navigation,
      },
      {
        key: "dispatch_pending",
        label: "Dispatch Pending",
        value: getValue(kpis.dispatchPending),
        amount: kpis.dispatchPending.amount,
        quantity: kpis.dispatchPending.quantity,
        kitQuantity: kpis.dispatchPending.kitQuantity,
        count: kpis.dispatchPending.count,
        color: "#0d9488", // Teal
        hoverColor: "#0f766e",
        Icon: Package,
      },
      {
        key: "transport_pending",
        label: "Transport Pending",
        value: getValue(kpis.transportPending),
        amount: kpis.transportPending.amount,
        quantity: kpis.transportPending.quantity,
        kitQuantity: kpis.transportPending.kitQuantity,
        count: kpis.transportPending.count,
        color: "#06b6d4", // Cyan
        hoverColor: "#0891b2",
        Icon: Truck,
      },
      {
        key: "approval_pending",
        label: "Approval Pending",
        value: getValue(kpis.approvalPending),
        amount: kpis.approvalPending.amount,
        quantity: kpis.approvalPending.quantity,
        kitQuantity: kpis.approvalPending.kitQuantity,
        count: kpis.approvalPending.count,
        color: "#f59e0b", // Amber
        hoverColor: "#d97706",
        Icon: Clock,
      },
      {
        key: "on_hold",
        label: "On Hold",
        value: getValue(kpis.onHold),
        amount: kpis.onHold.amount,
        quantity: kpis.onHold.quantity,
        kitQuantity: kpis.onHold.kitQuantity,
        count: kpis.onHold.count,
        color: "#f97316", // Orange
        hoverColor: "#ea580c",
        Icon: PauseCircle,
      },
      {
        key: "cancelled",
        label: "Cancelled",
        value: getValue(kpis.cancelled),
        amount: kpis.cancelled.amount,
        quantity: kpis.cancelled.quantity,
        kitQuantity: kpis.cancelled.kitQuantity,
        count: kpis.cancelled.count,
        color: "#f43f5e", // Rose
        hoverColor: "#e11d48",
        Icon: Ban,
      },
      {
        key: "rejected",
        label: "Rejected",
        value: getValue(kpis.rejected),
        amount: kpis.rejected.amount,
        quantity: kpis.rejected.quantity,
        kitQuantity: kpis.rejected.kitQuantity,
        count: kpis.rejected.count,
        color: "#ef4444", // Red
        hoverColor: "#dc2626",
        Icon: XCircle,
      },
    ];
  }, [kpis, showAmount, allowQuantity]);

  const totalValue = useMemo(
    () => rawSlices.reduce((acc, s) => acc + s.value, 0),
    [rawSlices],
  );

  const slices: PieSliceItem[] = useMemo(() => {
    return rawSlices.map((s) => ({
      ...s,
      pct: totalValue > 0 ? Math.round((s.value / totalValue) * 100) : 0,
    }));
  }, [rawSlices, totalValue]);

  const slicesWithData = useMemo(
    () => slices.filter((s) => s.value > 0),
    [slices],
  );

  const hoveredSlice = useMemo(
    () => slices.find((s) => s.key === hoveredKey) ?? null,
    [slices, hoveredKey],
  );

  // SVG Geometry for Donut / Pie Chart (300 x 300 viewBox)
  const cx = 150;
  const cy = 150;
  const R = 126;
  const r = 80;

  const slicePaths = useMemo(() => {
    if (totalValue <= 0 || slicesWithData.length === 0) return [];

    let currentAngle = -Math.PI / 2;
    return slicesWithData.map((slice) => {
      const angle = (slice.value / totalValue) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const isHovered = hoveredKey === slice.key;
      const currentR = isHovered ? R + 7 : R;
      const currentInnerR = isHovered ? r - 2 : r;

      const pad = slicesWithData.length > 1 ? 0.012 : 0;
      const a1 = startAngle + pad;
      const a2 = endAngle - pad;

      const x1 = cx + currentR * Math.cos(a1);
      const y1 = cy + currentR * Math.sin(a1);
      const x2 = cx + currentR * Math.cos(a2);
      const y2 = cy + currentR * Math.sin(a2);

      const x3 = cx + currentInnerR * Math.cos(a2);
      const y3 = cy + currentInnerR * Math.sin(a2);
      const x4 = cx + currentInnerR * Math.cos(a1);
      const y4 = cy + currentInnerR * Math.sin(a1);

      const largeArc = a2 - a1 > Math.PI ? 1 : 0;
      const d = `M ${x1} ${y1} A ${currentR} ${currentR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${currentInnerR} ${currentInnerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;

      return {
        ...slice,
        d,
        isHovered,
      };
    });
  }, [totalValue, slicesWithData, hoveredKey]);

  const handleDownload = () => {
    const headers = showAmount
      ? [
          "Metric Category",
          "Amount (INR)",
          ...(allowQuantity ? ["Quantity (Items)", "Kit Quantity"] : []),
          "Order Count",
        ]
      : [
          "Metric Category",
          ...(allowQuantity ? ["Quantity (Items)", "Kit Quantity"] : []),
          "Order Count",
        ];

    const rows = [
      [
        "Total Order Volume",
        ...(showAmount ? [`₹${formatMoney(kpis.orderVolume.amount)}`] : []),
        ...(allowQuantity
          ? [
              formatQty(kpis.orderVolume.quantity),
              formatQty(kpis.orderVolume.kitQuantity),
            ]
          : []),
        kpis.orderVolume.count.toLocaleString("en-IN"),
      ],
      ...slices.map((slice) => {
        const row = [slice.label];
        if (showAmount) {
          row.push(`₹${formatMoney(slice.amount)}`);
        }
        if (allowQuantity) {
          row.push(formatQty(slice.quantity));
          row.push(formatQty(slice.kitQuantity));
        }
        row.push(slice.count.toLocaleString("en-IN"));
        return row;
      }),
    ];

    downloadCsvFile(
      reportFilename(`overview_widgets_${role}`, selectedYears, selectedMonths),
      headers,
      rows,
      [
        `Report: Overview Widgets (${role.toUpperCase()})`,
        `Period: ${formatPeriodLabel(selectedYears, selectedMonths)}`,
      ],
    );
  };

  return (
    <div className="w-full font-sans">
      {/* Both KPI & Quick Access side-by-side on tablet and above (md:) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* Left Column: KPI Pie Chart Section */}
        <section
          className="flex flex-col space-y-2.5"
          aria-labelledby="kpi-heading"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5 dark:border-slate-800/80 min-h-[46px]">
            <div className="min-w-0">
              <h2
                id="kpi-heading"
                className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Key Performance Indicators
              </h2>
              <PeriodHeadingCaption
                selectedYears={selectedYears}
                selectedMonths={selectedMonths}
                dateFilter={dateFilter}
                customDateFrom={customDateFrom}
                customDateTo={customDateTo}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ReportDownloadButton
                onDownload={handleDownload}
                disabled={isOrdersFetching}
                label="Export"
              />
            </div>
          </div>

          {/* Pie Chart Card Panel */}
          <div className="flex-1 rounded-xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
            {/* Main Area: Centered Larger Pie Chart in its own wrapper, and Right-Aligned Category List */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 my-auto py-1">
              {/* Wrapper 1: Dedicated Centered Pie Chart Wrapper */}
              <div className="flex-1 flex flex-col items-center justify-center min-w-0 w-full sm:w-auto">
                <div className="relative shrink-0 w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
                  {isOrdersFetching ? (
                    <div className="h-52 w-52 rounded-full border-12 border-slate-200 animate-pulse dark:border-slate-800" />
                  ) : totalValue <= 0 ? (
                    <svg
                      viewBox="0 0 300 300"
                      className="w-full h-full -rotate-90"
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={(R + r) / 2}
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth={R - r}
                        className="dark:stroke-slate-800"
                      />
                    </svg>
                  ) : slicesWithData.length === 1 ? (
                    <svg
                      viewBox="0 0 300 300"
                      className="w-full h-full -rotate-90 cursor-pointer"
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={(R + r) / 2}
                        fill="none"
                        stroke={slicesWithData[0].color}
                        strokeWidth={R - r}
                        className="transition-all duration-300"
                      />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 300 300"
                      className="w-full h-full -rotate-90 select-none overflow-visible"
                    >
                      {slicePaths.map((slice) => (
                        <path
                          key={slice.key}
                          d={slice.d}
                          fill={slice.color}
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="transition-all duration-200 cursor-pointer hover:opacity-95 dark:stroke-slate-900"
                          onMouseEnter={() => setHoveredKey(slice.key)}
                          onMouseLeave={() => setHoveredKey(null)}
                        />
                      ))}
                    </svg>
                  )}

                  {/* Donut Center Display */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-3">
                    <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate max-w-[130px]">
                      {hoveredSlice ? hoveredSlice.label : "Order Volume"}
                    </span>

                    <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums truncate max-w-[140px] leading-tight mt-0.5">
                      {isOrdersFetching ? (
                        <span className="inline-block h-5 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                      ) : hoveredSlice ? (
                        showAmount ? (
                          formatCenterMoney(hoveredSlice.amount)
                        ) : allowQuantity ? (
                          formatQty(hoveredSlice.quantity)
                        ) : (
                          hoveredSlice.count.toLocaleString("en-IN")
                        )
                      ) : showAmount ? (
                        formatCenterMoney(kpis.orderVolume.amount)
                      ) : allowQuantity ? (
                        formatQty(kpis.orderVolume.quantity)
                      ) : (
                        kpis.orderVolume.count.toLocaleString("en-IN")
                      )}
                    </span>

                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                      {isOrdersFetching ? (
                        "..."
                      ) : hoveredSlice ? (
                        `${hoveredSlice.pct}% · ${hoveredSlice.count} ${
                          hoveredSlice.count === 1 ? "order" : "orders"
                        }`
                      ) : (
                        `${kpis.orderVolume.count.toLocaleString("en-IN")} ${
                          kpis.orderVolume.count === 1 ? "order" : "orders"
                        }`
                      )}
                    </span>
                  </div>
                </div>

                {/* Below the circle: only stage - data */}
                <div className="mt-2 text-center min-h-[22px] flex items-center justify-center">
                  {hoveredSlice ? (
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: hoveredSlice.color }}
                      />
                      <span>{hoveredSlice.label}</span>
                      <span className="text-slate-400 font-normal">-</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                        {showAmount
                          ? `₹${formatMoney(hoveredSlice.amount)}`
                          : allowQuantity
                          ? formatQty(hoveredSlice.quantity)
                          : hoveredSlice.count.toLocaleString("en-IN")}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        ({hoveredSlice.pct}%) · {hoveredSlice.count} {hoveredSlice.count === 1 ? "order" : "orders"}
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span className="h-2 w-2 rounded-full shrink-0 bg-blue-600" />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Order Volume</span>
                      <span className="text-slate-400">-</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {showAmount
                          ? `₹${formatMoney(kpis.orderVolume.amount)}`
                          : allowQuantity
                          ? `${formatQty(kpis.orderVolume.quantity)} items`
                          : `${kpis.orderVolume.count} orders`}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">
                        · {kpis.orderVolume.count.toLocaleString("en-IN")} orders
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Wrapper 2: Right-Aligned Small-Font Category List */}
              <div className="shrink-0 flex flex-col justify-center items-end sm:ml-auto w-full sm:w-auto">
                <div className="flex flex-col justify-center gap-0.5 w-44 sm:w-48 py-0.5">
                  {slices.map((slice) => {
                    const isHovered = hoveredKey === slice.key;
                    return (
                      <div
                        key={slice.key}
                        onMouseEnter={() => setHoveredKey(slice.key)}
                        onMouseLeave={() => setHoveredKey(null)}
                        className={`flex items-center justify-between gap-2.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                          isHovered
                            ? "bg-slate-100 dark:bg-slate-800"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: slice.color }}
                          />
                          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                            {slice.label}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                          {slice.pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Commercial Volume Baseline Footer Note */}
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5 font-medium truncate">
                <LayoutGrid className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Commercial Volume:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {showAmount
                    ? `₹${formatMoney(kpis.orderVolume.amount)}`
                    : allowQuantity
                    ? `${formatQty(kpis.orderVolume.quantity)} items`
                    : `${kpis.orderVolume.count} orders`}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 shrink-0">
                {kpis.orderVolume.count.toLocaleString("en-IN")} active orders
              </span>
            </div>
          </div>
        </section>

        {/* Right Column: Quick Access with 2-in-one layout */}
        <OrderQuickAccess
          orders={filteredOrders}
          counts={queueCounts}
          isOrdersFetching={isOrdersFetching}
          categoryOptions={categoryOptions}
          role={role}
          portalHome={portalHome}
        />
      </div>
    </div>
  );
}
