/**
 * @fileoverview Modal to compare two versions of a quotation side-by-side.
 * Shows financial delta, item additions/removals/modifications, and terms diff.
 * @module components/quotations/QuotationVersionDiffModal
 */
"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  GitCompare,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  MinusCircle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";
import {
  type LeadQuotationRecord,
  useCompareQuotationVersionsQuery,
} from "@/store/api";
import { formatCurrencyINR } from "./quotationUtils";

type Props = {
  quotation: LeadQuotationRecord;
  open: boolean;
  onClose: () => void;
  initialFromVersion?: number;
  initialToVersion?: number;
};

export function QuotationVersionDiffModal({
  quotation,
  open,
  onClose,
  initialFromVersion,
  initialToVersion,
}: Props) {
  const currentVersion = quotation.version || 1;
  const historyVersions = useMemo(() => {
    const list: number[] = [];
    if (quotation.revision_history && quotation.revision_history.length > 0) {
      quotation.revision_history.forEach((r) => {
        if (!list.includes(r.version)) list.push(r.version);
      });
    }
    if (!list.includes(currentVersion)) {
      list.push(currentVersion);
    }
    return list.sort((a, b) => a - b);
  }, [quotation, currentVersion]);

  const defaultFrom =
    initialFromVersion ??
    (historyVersions.length > 1
      ? historyVersions[historyVersions.length - 2]
      : historyVersions[0]);
  const defaultTo = initialToVersion ?? currentVersion;

  const [fromVersion, setFromVersion] = useState<number>(defaultFrom);
  const [toVersion, setToVersion] = useState<number>(defaultTo);

  const {
    data: comparisonData,
    isLoading,
    isError,
  } = useCompareQuotationVersionsQuery(
    {
      quotationId: quotation._id,
      fromVersion,
      toVersion,
    },
    {
      skip: !open || !quotation._id || fromVersion === toVersion,
    }
  );

  if (!open) return null;

  const fin = comparisonData?.financial_comparison;
  const grandDelta = fin?.grand_total_delta ?? 0;
  const grandDeltaPct =
    fin && fin.grand_total_from > 0
      ? ((grandDelta / fin.grand_total_from) * 100).toFixed(1)
      : null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 sm:p-6 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
              <GitCompare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Compare Quotation Revisions
                <span className="font-mono text-xs text-primary font-normal">
                  #{quotation.quotation_no}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Inspect changes between commercial quotation iterations
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Version Pickers Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-3.5 dark:border-white/5 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">From:</span>
              <select
                value={fromVersion}
                onChange={(e) => setFromVersion(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 dark:border-white/10 dark:bg-slate-800 dark:text-white cursor-pointer"
              >
                {historyVersions.map((v) => (
                  <option key={v} value={v}>
                    Version v{v} {v === currentVersion ? "(Current)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-400" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">To:</span>
              <select
                value={toVersion}
                onChange={(e) => setToVersion(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 dark:border-white/10 dark:bg-slate-800 dark:text-white cursor-pointer"
              >
                {historyVersions.map((v) => (
                  <option key={v} value={v}>
                    Version v{v} {v === currentVersion ? "(Current)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-400" />
            <span>Total versions: <strong>{historyVersions.length}</strong></span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {fromVersion === toVersion ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
              <AlertCircle className="h-8 w-8 mb-2 text-amber-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Please select two different versions to compare.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Choose a baseline version (e.g., v1) and an updated version (e.g., v{currentVersion}) above.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex h-64 items-center justify-center text-xs text-slate-400">
              Comparing versions v{fromVersion} and v{toVersion}...
            </div>
          ) : isError || !comparisonData ? (
            <div className="p-8 text-center text-xs text-rose-500">
              Failed to load comparison data between v{fromVersion} and v{toVersion}.
            </div>
          ) : (
            <>
              {/* Financial Comparison KPIs */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Financial Delta Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-slate-800/60 shadow-xs">
                    <span className="text-[11px] font-medium text-slate-400">Subtotal</span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {formatCurrencyINR(fin?.subtotal_from || 0)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {formatCurrencyINR(fin?.subtotal_to || 0)}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[10px] font-bold text-slate-500">
                      Delta: {fin && fin.subtotal_delta >= 0 ? "+" : ""}
                      {formatCurrencyINR(fin?.subtotal_delta || 0)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-slate-800/60 shadow-xs">
                    <span className="text-[11px] font-medium text-slate-400">Discount</span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {formatCurrencyINR(fin?.discount_from || 0)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {formatCurrencyINR(fin?.discount_to || 0)}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[10px] font-bold text-slate-500">
                      Delta: {fin && fin.discount_delta >= 0 ? "+" : ""}
                      {formatCurrencyINR(fin?.discount_delta || 0)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-slate-800/60 shadow-xs">
                    <span className="text-[11px] font-medium text-slate-400">Total GST</span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {formatCurrencyINR(fin?.gst_from || 0)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {formatCurrencyINR(fin?.gst_to || 0)}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[10px] font-bold text-slate-500">
                      Delta: {fin && fin.gst_delta >= 0 ? "+" : ""}
                      {formatCurrencyINR(fin?.gst_delta || 0)}
                    </div>
                  </div>

                  <div
                    className={`rounded-xl border p-3.5 shadow-xs ${
                      grandDelta > 0
                        ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/40"
                        : grandDelta < 0
                        ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/40"
                        : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-800/60"
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      Grand Total
                      {grandDelta > 0 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                      ) : grandDelta < 0 ? (
                        <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
                      ) : null}
                    </span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {formatCurrencyINR(fin?.grand_total_from || 0)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {formatCurrencyINR(fin?.grand_total_to || 0)}
                      </span>
                    </div>
                    <div
                      className={`mt-1.5 text-[10px] font-extrabold ${
                        grandDelta > 0
                          ? "text-amber-700 dark:text-amber-300"
                          : grandDelta < 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-slate-500"
                      }`}
                    >
                      {grandDelta >= 0 ? "+" : ""}
                      {formatCurrencyINR(grandDelta)}
                      {grandDeltaPct ? ` (${grandDelta >= 0 ? "+" : ""}${grandDeltaPct}%)` : ""}
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items Diff */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                  <span>Line Items Comparison</span>
                  <span className="text-[11px] font-medium text-slate-400">
                    {comparisonData.items_comparison.length} items recorded
                  </span>
                </h4>

                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-white/10 dark:bg-slate-900">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Product / Item</th>
                        <th className="px-4 py-2.5 text-center">Qty (v{fromVersion} → v{toVersion})</th>
                        <th className="px-4 py-2.5 text-right">Rate</th>
                        <th className="px-4 py-2.5 text-right">Line Total (v{fromVersion} → v{toVersion})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {comparisonData.items_comparison.map((item, idx) => {
                        const isAdded = item.status === "added";
                        const isRemoved = item.status === "removed";
                        const isModified = item.status === "modified";

                        return (
                          <tr
                            key={idx}
                            className={
                              isAdded
                                ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                                : isRemoved
                                ? "bg-rose-50/40 dark:bg-rose-950/20 opacity-75"
                                : isModified
                                ? "bg-amber-50/30 dark:bg-amber-950/15"
                                : ""
                            }
                          >
                            <td className="px-4 py-3">
                              {isAdded && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  <PlusCircle className="h-3 w-3" /> Added
                                </span>
                              )}
                              {isRemoved && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                  <MinusCircle className="h-3 w-3" /> Removed
                                </span>
                              )}
                              {isModified && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  <AlertCircle className="h-3 w-3" /> Modified
                                </span>
                              )}
                              {!isAdded && !isRemoved && !isModified && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  <CheckCircle2 className="h-3 w-3" /> Unchanged
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {item.product_name}
                              </div>
                              {item.to?.description || item.from?.description ? (
                                <div className="text-[11px] text-slate-500 line-clamp-1">
                                  {item.to?.description || item.from?.description}
                                </div>
                              ) : null}
                            </td>

                            <td className="px-4 py-3 text-center">
                              {isAdded ? (
                                <span className="font-bold text-emerald-600">
                                  {item.to?.quantity} {item.to?.unit || "Nos"}
                                </span>
                              ) : isRemoved ? (
                                <span className="line-through text-rose-500">
                                  {item.from?.quantity} {item.from?.unit || "Nos"}
                                </span>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className={item.diff?.quantity_delta ? "text-slate-400" : "font-medium"}>
                                    {item.from?.quantity}
                                  </span>
                                  {item.diff?.quantity_delta ? (
                                    <>
                                      <ArrowRight className="h-3 w-3 text-slate-400" />
                                      <strong className="text-slate-900 dark:text-white">
                                        {item.to?.quantity}
                                      </strong>
                                      <span className="text-[10px] font-bold text-amber-600">
                                        ({item.diff.quantity_delta > 0 ? "+" : ""}
                                        {item.diff.quantity_delta})
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              {isAdded ? (
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {formatCurrencyINR(item.to?.rate || 0)}
                                </span>
                              ) : isRemoved ? (
                                <span className="line-through text-slate-400">
                                  {formatCurrencyINR(item.from?.rate || 0)}
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  <div>{formatCurrencyINR(item.to?.rate || 0)}</div>
                                  {item.diff?.rate_delta ? (
                                    <div className="text-[10px] font-bold text-amber-600">
                                      {item.diff.rate_delta > 0 ? "+" : ""}
                                      {formatCurrencyINR(item.diff.rate_delta)}
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              {isAdded ? (
                                <span className="font-extrabold text-emerald-600">
                                  {formatCurrencyINR(item.to?.line_total || 0)}
                                </span>
                              ) : isRemoved ? (
                                <span className="line-through text-rose-500">
                                  {formatCurrencyINR(item.from?.line_total || 0)}
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="font-extrabold text-slate-900 dark:text-white">
                                    {formatCurrencyINR(item.to?.line_total || 0)}
                                  </div>
                                  {item.diff?.line_total_delta ? (
                                    <div
                                      className={`text-[10px] font-bold ${
                                        item.diff.line_total_delta > 0
                                          ? "text-amber-600"
                                          : "text-emerald-600"
                                      }`}
                                    >
                                      {item.diff.line_total_delta > 0 ? "+" : ""}
                                      {formatCurrencyINR(item.diff.line_total_delta)}
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Terms & Conditions diff if counts or contents differ */}
              {comparisonData.terms_from && comparisonData.terms_to && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
                    <span>Terms & Conditions Comparison</span>
                    <span className="text-[11px] font-medium text-slate-400">
                      v{fromVersion}: {comparisonData.terms_from.length} lines • v{toVersion}:{" "}
                      {comparisonData.terms_to.length} lines
                    </span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-white/10 dark:bg-slate-800/40">
                      <div className="font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Version v{fromVersion} Terms
                      </div>
                      <ol className="list-decimal pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                        {comparisonData.terms_from.map((t, i) => (
                          <li key={i} className="line-clamp-2" dangerouslySetInnerHTML={{ __html: t }} />
                        ))}
                      </ol>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-slate-900">
                      <div className="font-bold text-slate-900 dark:text-white mb-2">
                        Version v{toVersion} Terms
                      </div>
                      <ol className="list-decimal pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                        {comparisonData.terms_to.map((t, i) => (
                          <li key={i} className="line-clamp-2" dangerouslySetInnerHTML={{ __html: t }} />
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 dark:border-white/5 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 cursor-pointer"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}
