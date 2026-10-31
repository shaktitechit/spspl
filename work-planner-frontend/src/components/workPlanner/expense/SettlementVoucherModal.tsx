"use client";

import React from "react";
import {
  X,
  FileCheck,
  Printer,
  DollarSign,
  Building2,
  Receipt,
  Wallet,
  CheckCircle2,
  Paperclip,
} from "lucide-react";
import { useGetExpenseSettlementQuery } from "@/store/api/workPlannerApiSlice";
import { formatCurrency, formatPlanDate, EXPENSE_CATEGORY_LABELS } from "../workPlanUtils";
import { ExpenseAttachmentList } from "./ExpenseAttachmentList";
import { FilePreviewModal, useFilePreview } from "../FilePreviewModal";
import type { WorkPlanExpenseSettlementRecord } from "@/types/workPlanner";

interface SettlementVoucherModalProps {
  settlementId: string | null;
  open: boolean;
  onClose: () => void;
  sessionToken?: string | null;
}

export function SettlementVoucherModal({ settlementId, open, onClose, sessionToken }: SettlementVoucherModalProps) {
  const { data: voucher, isLoading } = useGetExpenseSettlementQuery(settlementId || "", {
    skip: !open || !settlementId,
  });

  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  } = useFilePreview(sessionToken);

  if (!open || !settlementId) return null;

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  const salesUserName =
    typeof voucher?.sales_user === "object" && voucher.sales_user
      ? voucher.sales_user.name
      : "Executive";

  const settledByName =
    typeof voucher?.settled_by === "object" && voucher.settled_by
      ? voucher.settled_by.name
      : "Accounts Authority";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-surface-muted/50">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-emerald-600/10 p-2 text-emerald-600 dark:text-emerald-400">
                <FileCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Expense Settlement Voucher</h2>
                <p className="text-xs text-muted font-mono">{voucher?.settlement_number || "VOUCHER"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
                title="Print Voucher"
              >
                <Printer className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted">Loading settlement voucher details…</div>
          ) : !voucher ? (
            <div className="p-8 text-center text-xs text-muted">Settlement voucher not found.</div>
          ) : (
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Voucher Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl border border-border bg-surface-muted/40 text-xs">
                <div>
                  <span className="text-muted block text-[10px] uppercase font-bold">Executive</span>
                  <span className="font-semibold text-foreground">{salesUserName}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-bold">Settlement Date</span>
                  <span className="font-medium text-foreground">{formatPlanDate(voucher.settlement_date)}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-bold">Settled By</span>
                  <span className="font-medium text-foreground">{settledByName}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-bold">Settlement Mode</span>
                  <span
                    className={`font-semibold capitalize ${
                      voucher.settlement_mode === "payment_entry"
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {voucher.settlement_mode === "payment_entry"
                      ? "Direct Treasury Payment"
                      : voucher.settlement_mode?.replace("_", " ") || "Settled"}
                  </span>
                </div>
              </div>

              {/* Claim items settled (only if not standalone payment entry) */}
              {voucher.claims && voucher.claims.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider block mb-2">
                    Settled Expense Claims ({voucher.claims?.length || 0})
                  </span>
                  <div className="rounded-xl border border-border overflow-hidden divide-y divide-border text-xs">
                    {voucher.claims?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-card">
                        <div>
                          <span className="font-semibold text-foreground">
                            {EXPENSE_CATEGORY_LABELS[item.category || ""] || item.category || "Claim"}
                          </span>
                          {item.description && (
                            <p className="text-[11px] text-muted">{item.description}</p>
                          )}
                        </div>
                        <span className="font-bold text-foreground">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advance deductions */}
              {voucher.advances && voucher.advances.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block mb-2">
                    Tour Advance Deductions
                  </span>
                  <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 divide-y divide-purple-500/10 text-xs">
                    {voucher.advances.map((adv, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5">
                        <span className="font-medium text-foreground">
                          {adv.advance_number || "Advance Deduction"}
                        </span>
                        <span className="font-bold text-purple-700 dark:text-purple-300">
                          - {formatCurrency(adv.deducted_amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Entry deductions */}
              {voucher.payment_entries && voucher.payment_entries.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block mb-2">
                    Direct Payment Entry Deductions
                  </span>
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 divide-y divide-indigo-500/10 text-xs">
                    {voucher.payment_entries.map((pay, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5">
                        <span className="font-medium text-foreground">
                          {pay.payment_number || "Payment Entry Deduction"}
                        </span>
                        <span className="font-bold text-indigo-700 dark:text-indigo-300">
                          - {formatCurrency(pay.deducted_amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct Payout Details */}
              {voucher.direct_payment_amount > 0 && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                    voucher.settlement_mode === "payment_entry"
                      ? "border-indigo-500/20 bg-indigo-500/5 text-indigo-900 dark:text-indigo-200"
                      : "border-emerald-500/20 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
                  }`}
                >
                  <div className="flex justify-between font-bold">
                    <span>
                      {voucher.settlement_mode === "payment_entry"
                        ? "Treasury Disbursement / Direct Payment:"
                        : "Direct Company Payment (Reimbursement):"}
                    </span>
                    <span className="text-base font-extrabold">{formatCurrency(voucher.direct_payment_amount)}</span>
                  </div>
                  <div className="text-muted text-[11px]">
                    Mode: <span className="font-semibold uppercase">{voucher.payment_method || "Direct Payout"}</span>
                    {voucher.transaction_reference && ` • Ref: ${voucher.transaction_reference}`}
                    {voucher.bank_name && ` • Bank: ${voucher.bank_name}`}
                  </div>
                  {voucher.settlement_notes && (
                    <div className="text-muted text-[11px] pt-1">
                      Notes: {voucher.settlement_notes}
                    </div>
                  )}
                </div>
              )}

              {/* Attached Settlement Proofs */}
              {((voucher.attachment_details && voucher.attachment_details.length > 0) ||
                (voucher.attachments && voucher.attachments.length > 0)) && (
                <div className="p-3 rounded-xl border border-border bg-surface-muted/30">
                  <ExpenseAttachmentList
                    label="Settlement Documents & Payment Proofs"
                    attachments={voucher.attachment_details || []}
                    attachmentIds={voucher.attachments || []}
                    onPreview={openPreview}
                    onDownload={downloadFile}
                  />
                </div>
              )}

              {/* Total summary */}
              <div className="rounded-xl bg-surface-muted p-3.5 flex items-center justify-between border border-border text-xs">
                <span className="font-bold text-foreground">
                  {voucher.settlement_mode === "payment_entry"
                    ? "Total Direct Payment Disbursed:"
                    : "Total Claim Amount Settled:"}
                </span>
                <span className="text-sm font-extrabold text-foreground">
                  {formatCurrency(
                    voucher.settlement_mode === "payment_entry"
                      ? voucher.direct_payment_amount || 0
                      : voucher.total_claim_amount || 0
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end p-4 border-t border-border bg-surface-muted/30">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={downloadFile}
      />
    </>
  );
}
