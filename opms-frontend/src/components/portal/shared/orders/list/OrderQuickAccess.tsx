"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";

import {
  ORDER_QUICK_ACCESS_ROLE_CONFIG,
  type OrderQuickAccessRole,
} from "./orderQuickAccessConfig";
import { getOrderListTabIcon } from "./orderListTabIcons";
import { getOrderWorkflowTabAccent } from "./orderWorkflowTabMeta";
import type { OrderWorkflowCategoryOptions } from "./orderWorkflowTabs";

export type OrderQuickAccessProps = {
  orders?: unknown[];
  /** Unfiltered tab counts from the dashboard summary. */
  counts?: Record<string, number>;
  isOrdersFetching: boolean;
  categoryOptions?: OrderWorkflowCategoryOptions;
  role: OrderQuickAccessRole;
  /** Overrides role default path (e.g. super_admin). */
  portalHome?: string;
};

interface QuickAccessListItemProps {
  href: string;
  label: string;
  count: number;
  isOrdersFetching: boolean;
  tabId: string;
  Icon: LucideIcon;
}

function QuickAccessListItem({
  href,
  label,
  count,
  isOrdersFetching,
  tabId,
  Icon,
}: QuickAccessListItemProps) {
  const meta = getOrderWorkflowTabAccent(tabId);

  return (
    <Link
      href={href}
      className={`group relative flex items-center justify-between overflow-hidden rounded-lg border border-slate-200/70 bg-white px-2 py-1.5 sm:px-2.5 sm:py-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900 ${meta.borderHover}`}
    >
      <div className={`absolute inset-x-0 top-0 h-[2px] ${meta.accent}`} />

      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <div
          className={`shrink-0 rounded-md p-1 transition-colors ${meta.iconWrap}`}
          aria-hidden="true"
        >
          <Icon className={`h-3.5 w-3.5 ${meta.iconTone}`} />
        </div>
        <span className="truncate text-[11px] sm:text-xs font-semibold text-slate-700 transition-colors group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white">
          {label}
        </span>
      </div>

      {/* Power Number */}
      <div className="flex items-center gap-1 shrink-0 ml-1">
        <span
          title={`${count.toLocaleString("en-IN")} ${count === 1 ? "order" : "orders"}`}
          className={`inline-flex items-center justify-center min-w-[1.75rem] sm:min-w-[2rem] px-1 sm:px-1.5 py-0.5 rounded text-[11px] sm:text-xs font-bold tabular-nums font-mono transition-all ${
            count > 0
              ? `${meta.badgeWrap} ${meta.badgeTone} ring-1 ring-inset ring-current/10 shadow-xs`
              : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
          }`}
        >
          {isOrdersFetching ? (
            <span className="inline-block h-3.5 w-4 animate-pulse rounded bg-slate-300 dark:bg-slate-700" />
          ) : (
            count.toLocaleString("en-IN")
          )}
        </span>
      </div>
    </Link>
  );
}

/**
 * Dashboard Quick Access — compact 2-in-1 grid across mobile and desktop with live order Power Numbers.
 */
export default function OrderQuickAccess({
  orders = [],
  counts,
  isOrdersFetching,
  categoryOptions,
  role,
  portalHome,
}: OrderQuickAccessProps) {
  const config =
    ORDER_QUICK_ACCESS_ROLE_CONFIG[role] ?? ORDER_QUICK_ACCESS_ROLE_CONFIG.admin;
  const basePath = portalHome ?? config.path;

  const orderStats = useMemo(() => {
    if (counts) {
      return Object.fromEntries(
        Object.entries(counts).map(([id, count]) => [id, { count }]),
      );
    }
    return config.compute(orders, categoryOptions);
  }, [config, orders, categoryOptions, counts]);

  return (
    <section
      className="flex flex-col space-y-2.5"
      aria-labelledby="quick-access-heading"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5 dark:border-slate-800/80 min-h-[46px]">
        <div>
          <h2
            id="quick-access-heading"
            className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Quick Access
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
            Workflow queues with live order power counters
          </p>
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
        {/* 2-in-one grid on mobile and above */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          {config.tabs.map((tab) => {
            const stat = orderStats[tab.id] || { count: 0 };
            const Icon = getOrderListTabIcon(tab.id);

            return (
              <QuickAccessListItem
                key={tab.id}
                href={`${basePath}/orders/${tab.id}`}
                label={tab.label}
                count={stat.count}
                isOrdersFetching={isOrdersFetching}
                tabId={tab.id}
                Icon={Icon}
              />
            );
          })}
        </div>

        {/* Footer Summary aligned with Left KPI Footer */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium">
            Active Queues:{" "}
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {config.tabs.length}
            </span>
          </span>
          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
            Click any queue to navigate
          </span>
        </div>
      </div>
    </section>
  );
}
