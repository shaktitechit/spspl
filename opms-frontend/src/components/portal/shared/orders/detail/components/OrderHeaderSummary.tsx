"use client";

import {
  FINANCE_ORDER_TAB_LABELS,
  type FinanceOrderTabCategory,
} from "@/components/portal/finance/financeOrderUtils";
import {
  OrderFulfillmentPipelineStrip,
  type FulfillmentPipelineStepConfig,
} from "@/components/portal/shared/ui/fulfillment/FulfillmentCircleStep";
import { formatDateShort, renderPriorityBadge } from "../orderDetailUtils";

export type OrderHeaderSummaryProps = {
  orderNo: string;
  custLabel: string;
  orderDate?: unknown;
  edd?: unknown;
  isSra?: boolean;
  priority?: string;
  workflowCategory?: FinanceOrderTabCategory | null;
  showFinanceWorkflowBadge?: boolean;
  pipelineSteps: FulfillmentPipelineStepConfig[];
  onOpenFulfillmentModal?: () => void;
  onRefetch?: () => void;
};

export function renderWorkflowStatusBadge(category: FinanceOrderTabCategory | null) {
  if (!category) return null;
  const label = FINANCE_ORDER_TAB_LABELS[category] ?? category;
  let bgClass =
    "bg-slate-50 text-slate-700 ring-slate-500/10 dark:bg-white/5 dark:text-slate-400 dark:ring-white/10";
  switch (category) {
    case "open_dispatched":
      bgClass =
        "bg-teal-50 text-teal-700 ring-teal-600/10 dark:bg-teal-950/30 dark:text-teal-400 dark:ring-teal-500/25";
      break;
    case "transport_pending":
      bgClass =
        "bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-500/25";
      break;
    case "in_transit":
      bgClass =
        "bg-sky-50 text-sky-700 ring-sky-600/10 dark:bg-sky-950/30 dark:text-sky-400 dark:ring-sky-500/25";
      break;
    case "pending_finance_approval":
      bgClass =
        "bg-purple-50 text-purple-700 ring-purple-600/10 dark:bg-purple-950/30 dark:text-purple-400 dark:ring-purple-500/25";
      break;
    case "closed_delivered":
      bgClass =
        "bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-500/25";
      break;
    case "on_hold":
      bgClass =
        "bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-500/25";
      break;
    case "rejected":
      bgClass =
        "bg-red-50 text-red-700 ring-red-600/10 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-500/25";
      break;
    case "cancelled":
      bgClass =
        "bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-950/30 dark:text-rose-400 dark:ring-rose-500/25";
      break;
    default:
      break;
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wider ring-1 ring-inset ${bgClass}`}
    >
      {label}
    </span>
  );
}

export function OrderHeaderSummary({
  orderNo,
  custLabel,
  orderDate,
  edd,
  isSra,
  priority,
  workflowCategory,
  showFinanceWorkflowBadge,
  pipelineSteps,
}: OrderHeaderSummaryProps) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 w-full min-w-0">
      {/* Separator from Search */}
      <div className="hidden sm:block h-6 w-px bg-border shrink-0" />

      {/* Party Name & Metadata */}
      <div className="min-w-0 flex flex-col justify-center shrink-0 max-w-[200px] sm:max-w-[260px] lg:max-w-[320px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="truncate text-xs sm:text-sm font-bold text-foreground"
            title={custLabel}
          >
            {custLabel}
          </span>
          {isSra && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-2xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-400 shrink-0">
              SRA
            </span>
          )}
          {priority && (
            <span className="shrink-0 scale-90 origin-left">
              {renderPriorityBadge(priority)}
            </span>
          )}
          {showFinanceWorkflowBadge && workflowCategory
            ? renderWorkflowStatusBadge(workflowCategory)
            : null}
        </div>
        <div className="flex items-center gap-x-2 text-2xs text-muted-foreground whitespace-nowrap overflow-hidden">
          <span>
            No: <b className="font-semibold text-blue-600 dark:text-blue-400">{orderNo}</b>
          </span>
          {Boolean(orderDate) ? <span>Date: {formatDateShort(orderDate)}</span> : null}
          {Boolean(edd) ? <span>EDD: {formatDateShort(edd)}</span> : null}
        </div>
      </div>

      {/* Fulfillment Pipeline Progress Bar - Right Aligned */}
      <div className="hidden md:flex min-w-0 items-center justify-end shrink-0 ml-auto pl-2">
        <div className="min-w-0 overflow-x-auto lg:min-w-[340px] xl:min-w-[380px]">
          <OrderFulfillmentPipelineStrip steps={pipelineSteps} size="sm" />
        </div>
      </div>
    </div>
  );
}
