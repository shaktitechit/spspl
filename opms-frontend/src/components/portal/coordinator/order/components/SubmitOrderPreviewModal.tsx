"use client";

import { useMemo } from "react";
import {
  largeModalBackdropClass,
  largeModalPanelClass,
} from "@/components/portal/shared/ui/modals/modalLayout";
import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import {
  WorkflowEmailControls,
  type WorkflowEmailOptions,
} from "@/components/portal/shared/orders/modals/WorkflowEmailControls";

type SubmitIssue = {
  kind: "submit" | "approval";
  message: string;
} | null;

type SubmitOrderPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  detail: Record<string, unknown>;
  partyLabel: string;
  submitRemarks: string;
  onSubmitRemarksChange: (value: string) => void;
  onSubmit: () => void;
  onRetry?: () => void;
  isSubmitting: boolean;
  submitIssue?: SubmitIssue;
  emailOptions?: WorkflowEmailOptions;
  onEmailOptionsChange?: (value: WorkflowEmailOptions) => void;
};

function formatDate(v: unknown): string {
  if (v == null || v === "") return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function lineGross(line: Record<string, unknown>): number {
  const qty = Number(line.ordered_quantity ?? line.quantity ?? 0);
  const price = Number(line.unit_price ?? 0);
  return qty * price;
}

function lineDiscount(line: Record<string, unknown>): number {
  const gross = lineGross(line);
  const percent = Number(line.discount_percent ?? 0);
  if (percent > 0) return (gross * percent) / 100;
  return Number(line.discount_amount ?? 0);
}

function lineTaxable(line: Record<string, unknown>): number {
  return Math.max(0, lineGross(line) - lineDiscount(line));
}

function lineGst(line: Record<string, unknown>): number {
  return (lineTaxable(line) * Number(line.gst_percent ?? 0)) / 100;
}

function lineTotal(line: Record<string, unknown>): number {
  return lineTaxable(line) + lineGst(line);
}

export default function SubmitOrderPreviewModal({
  isOpen,
  onClose,
  detail,
  partyLabel,
  submitRemarks,
  onSubmitRemarksChange,
  onSubmit,
  onRetry,
  isSubmitting,
  submitIssue = null,
  emailOptions,
  onEmailOptionsChange,
}: SubmitOrderPreviewModalProps) {
  const items = useMemo(() => {
    if (!Array.isArray(detail.order_items)) return [];
    return detail.order_items as Record<string, unknown>[];
  }, [detail.order_items]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let taxable = 0;
    let gst = 0;
    let total = 0;

    for (const item of items) {
      subtotal += lineGross(item);
      discount += lineDiscount(item);
      taxable += lineTaxable(item);
      gst += lineGst(item);
      total += lineTotal(item);
    }

    const headerDisc = Number(detail.discount_amount ?? 0);
    const grandTotal = Number(
      detail.grand_total ??
      detail.total ??
      Math.max(0, total - headerDisc)
    );

    return { subtotal, discount, taxable, gst, grandTotal };
  }, [items, detail]);

  const needsRetry = Boolean(submitIssue);

  if (!isOpen) return null;

  return (
    <LargeModalPortal>
    <div className={largeModalBackdropClass}>
      <div className={largeModalPanelClass}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Review order before submit
            </h3>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              Confirm item pricing, quantities, and totals before submitting for admin review.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-white/5 cursor-pointer"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {submitIssue ? (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-semibold">
                {submitIssue.kind === "approval"
                  ? "Order submitted, but approval was not created"
                  : "Submit failed"}
              </p>
              <p className="mt-1 text-xs opacity-90">{submitIssue.message}</p>
              <p className="mt-1.5 text-2xs opacity-80">
                Use Retry to try again without losing this form.
              </p>
            </div>
          ) : null}

          <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="font-medium text-slate-500">Order No</dt>
              <dd className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                {String(detail.order_no ?? "—")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Party</dt>
              <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">{partyLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Order Date</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{formatDate(detail.order_date)}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Expected Delivery</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                {formatDate(detail.expected_delivery_date)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Priority</dt>
              <dd className="mt-0.5 capitalize font-semibold text-slate-900 dark:text-slate-100">
                {typeof detail.priority === "string" ? detail.priority : "normal"}
              </dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="font-medium text-slate-500">Order remarks</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-slate-900 dark:text-slate-100">
                {typeof detail.remarks === "string" && detail.remarks.trim() ? detail.remarks : "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-5 overflow-x-auto rounded-lg ring-1 ring-slate-200/90 dark:ring-white/10">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                  <th className="px-3 py-2 font-medium text-right">Free</th>
                  <th className="px-3 py-2 font-medium text-right">Rate Type</th>
                  <th className="px-3 py-2 font-medium text-right">Unit Price</th>
                  <th className="px-3 py-2 font-medium text-right">Discount</th>
                  <th className="px-3 py-2 font-medium text-right">GST</th>
                  <th className="px-3 py-2 font-medium text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-white/10">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                      No line items on this order.
                    </td>
                  </tr>
                ) : (
                  items.map((line, idx) => {
                    const qty = Number(line.ordered_quantity ?? line.quantity ?? 0);
                    const name =
                      typeof line.product_name === "string"
                        ? line.product_name
                        : "—";
                    const key = line._id != null ? String(line._id) : `line-${idx}`;
                    return (
                      <tr key={key} className="bg-white dark:bg-slate-900">
                        <td className="max-w-[200px] px-3 py-2">
                          <span className="line-clamp-2 font-semibold text-slate-800 dark:text-slate-200">
                            {name}
                          </span>
                          {typeof line.sku === "string" && line.sku ? (
                            <span className="mt-0.5 block font-mono text-2xs text-slate-500">
                              SKU {line.sku}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{qty}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(line.free_qty ?? line.free_quantity ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {typeof line.applied_rate_type === "string" ? line.applied_rate_type : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          ₹{formatMoney(line.unit_price ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(line.discount_percent ?? 0) > 0
                            ? `${line.discount_percent}%`
                            : Number(line.discount_amount ?? 0) > 0
                              ? `₹${formatMoney(line.discount_amount)}`
                              : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(line.gst_percent ?? 0)}%
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                          ₹{formatMoney(lineTotal(line))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown */}
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/20 p-4 dark:border-blue-900/30 dark:bg-blue-950/10">
            <h4 className="mb-2 text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Order Financial Summary
            </h4>
            <div className="grid gap-3 sm:grid-cols-4 font-sans text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Gross Subtotal</span>
                <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                  ₹{formatMoney(totals.subtotal)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Total Discount</span>
                <span className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  -₹{formatMoney(totals.discount)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Estimated GST</span>
                <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                  ₹{formatMoney(totals.gst)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block font-semibold text-emerald-600 dark:text-emerald-400">
                  Grand Total
                </span>
                <span className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  ₹{formatMoney(totals.grandTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Submission remarks (optional)
            </label>
            <textarea
              value={submitRemarks}
              onChange={(e) => onSubmitRemarksChange(e.target.value)}
              rows={3}
              disabled={isSubmitting || submitIssue?.kind === "approval"}
              className="mt-1.5 w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 disabled:opacity-60 dark:border-white/15 dark:bg-slate-950 dark:text-slate-50"
              placeholder="Notes for admin review…"
            />
          </div>

          {emailOptions && onEmailOptionsChange && (
            <WorkflowEmailControls
              order={detail}
              scope="submit"
              value={emailOptions}
              onChange={onEmailOptionsChange}
            />
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4 dark:border-white/5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-200/95 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/5 cursor-pointer"
          >
            Cancel
          </button>
          {needsRetry ? (
            <button
              type="button"
              onClick={() => (onRetry ? onRetry() : onSubmit())}
              disabled={isSubmitting || items.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Retrying…
                </>
              ) : submitIssue?.kind === "approval" ? (
                "Retry create approval"
              ) : (
                "Retry submit"
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || items.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting…
                </>
              ) : (
                "Submit order"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
    </LargeModalPortal>
  );
}
