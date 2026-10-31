"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  Calendar,
  Wallet,
  Receipt,
  FileCheck,
  RotateCcw,
  Scale,
  Users,
  Info,
  Filter,
  Paperclip,
} from "lucide-react";
import { useGetExecutivePassbookQuery } from "@/store/api/workPlannerApiSlice";
import { formatCurrency, formatPlanDate } from "@/components/expensePortal/shared/workPlanUtils";
import { ExpenseAttachmentList } from "@/components/expensePortal/shared/ExpenseAttachmentList";
import { FilePreviewModal, useFilePreview } from "@/components/expensePortal/shared/FilePreviewModal";
import { AdvanceRefundModal } from "@/components/expensePortal/finance/disbursements/AdvanceRefundModal";
import type { PassbookLedgerEntry } from "@/types/workPlanner";

interface ExecutiveLedgerDrawerProps {
  userId: string | null;
  userName?: string;
  open: boolean;
  onClose: () => void;
  executiveOptions?: Array<{ id: string; name: string }>;
  onSelectUser?: (userId: string, userName: string) => void;
  sessionToken?: string | null;
  isFinanceMode?: boolean;
}

export function ExecutiveLedgerDrawer({
  userId,
  userName,
  open,
  onClose,
  executiveOptions = [],
  onSelectUser,
  sessionToken,
  isFinanceMode = false,
}: ExecutiveLedgerDrawerProps) {
  const [activeUserId, setActiveUserId] = useState<string>(userId || "");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<"all" | "advance" | "expense" | "settlement">("all");
  const [refundModalOpen, setRefundModalOpen] = useState<boolean>(false);

  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  } = useFilePreview(sessionToken);

  useEffect(() => {
    if (userId) {
      setActiveUserId(userId);
    }
  }, [userId]);

  const { data: passbookData, isLoading, refetch } = useGetExecutivePassbookQuery(
    {
      userId: activeUserId || "",
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    },
    { skip: !open || !activeUserId }
  );

  const rawEntries: PassbookLedgerEntry[] = passbookData?.entries || [];

  const entries = useMemo(() => {
    let list = rawEntries;
    if (typeFilter === "advance") {
      list = rawEntries.filter(
        (e: any) =>
          e.entry_type === "advance_disbursement" ||
          e.entry_type === "advance_refund" ||
          e.type === "ADVANCE_DISBURSED" ||
          e.type === "ADVANCE_REFUND"
      );
    } else if (typeFilter === "expense") {
      list = rawEntries.filter((e: any) => e.entry_type === "expense_approved" || e.type === "EXPENSE_APPROVED");
    } else if (typeFilter === "settlement") {
      list = rawEntries.filter(
        (e: any) =>
          e.entry_type === "settlement_voucher" ||
          e.entry_type === "payment_entry" ||
          e.type === "PAYMENT_ENTRY" ||
          (typeof e.type === "string" && e.type.startsWith("SETTLEMENT"))
      );
    }
    return [...list].sort((a: any, b: any) => {
      const tA = new Date(a.date).getTime() || 0;
      const tB = new Date(b.date).getTime() || 0;
      return tB - tA;
    });
  }, [rawEntries, typeFilter]);

  const advanceBal =
    passbookData?.current_advance_balance ??
    (passbookData as any)?.summary?.active_advance_balance ??
    0;
  const claimReceivable =
    passbookData?.current_claim_receivable ??
    (passbookData as any)?.summary?.unsettled_approved_amount ??
    0;
  const netPosition =
    passbookData?.current_net_position ??
    (passbookData as any)?.summary?.net_balance ??
    (passbookData as any)?.summary?.current_running_balance ??
    0;

  if (!open || !activeUserId) return null;

  const currentUserName =
    passbookData?.sales_user?.name ||
    (passbookData as any)?.user?.name ||
    executiveOptions.find((o) => o.id === activeUserId)?.name ||
    userName ||
    "Executive";

  function handleSwitchUser(newId: string) {
    setActiveUserId(newId);
    const found = executiveOptions.find((o) => o.id === newId);
    if (onSelectUser && found) {
      onSelectUser(found.id, found.name);
    }
  }

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-2xl h-full bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-muted/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="rounded-xl bg-purple-600/10 p-2 text-purple-600 dark:text-purple-400 shrink-0">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground truncate">Passbook & Ledger</h2>
                  {executiveOptions.length > 0 && (
                    <select
                      value={activeUserId}
                      onChange={(e) => handleSwitchUser(e.target.value)}
                      className="rounded-lg border border-border bg-card px-2 py-0.5 text-xs font-semibold text-foreground outline-none focus:border-primary max-w-[200px]"
                    >
                      {executiveOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <p className="text-xs text-muted truncate">
                  {currentUserName} • Financial timeline & running balances
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
                title="Print Ledger"
              >
                <Printer className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Balance Status Cards */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-surface-muted/30 border-b border-border text-center">
            <div className="p-2.5 rounded-xl bg-card border border-border">
              <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400">
                Advance in Hand
              </span>
              <div className="text-sm font-extrabold text-foreground mt-0.5">
                {isLoading ? "…" : formatCurrency(advanceBal)}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-border">
              <span className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400">
                Unsettled Claims
              </span>
              <div className="text-sm font-extrabold text-foreground mt-0.5">
                {isLoading ? "…" : formatCurrency(claimReceivable)}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-border">
              <span className="text-[10px] uppercase font-bold text-muted">
                Net Balance Position
              </span>
              <div
                className={`text-sm font-extrabold mt-0.5 ${
                  netPosition < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : netPosition > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground"
                }`}
              >
                {isLoading
                  ? "…"
                  : `${formatCurrency(Math.abs(netPosition))} ${
                      netPosition < 0
                        ? "(Due Co.)"
                        : netPosition > 0
                        ? "(Due Empl)"
                        : ""
                    }`}
              </div>
            </div>
          </div>

          {/* Quick Action: Record Refund when employee has advance balance */}
          {isFinanceMode && advanceBal > 0 && (
            <div className="px-4 py-2 bg-purple-500/5 border-b border-border flex items-center justify-between text-xs">
              <span className="text-muted">
                Executive has advance balance of <span className="font-bold text-foreground">{formatCurrency(advanceBal)}</span>
              </span>
              <button
                type="button"
                onClick={() => setRefundModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-purple-700 active:scale-95 transition cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Record Refund</span>
              </button>
            </div>
          )}

          {/* Filter Controls: Date & Type */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 bg-surface-muted/10 border-b border-border text-xs">
            {/* Type Filter Tabs */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                  typeFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                All ({rawEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("advance")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                  typeFilter === "advance"
                    ? "bg-purple-600 text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Advances
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("expense")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                  typeFilter === "expense"
                    ? "bg-sky-600 text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Claims
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("settlement")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                  typeFilter === "settlement"
                    ? "bg-emerald-600 text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Settlements
              </button>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted shrink-0" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-border bg-surface-muted px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
              />
              <span className="text-muted text-[11px]">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-border bg-surface-muted px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
              />
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                  className="text-[11px] text-muted hover:text-foreground underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Ledger Entries List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted">Loading ledger transactions…</div>
            ) : rawEntries.length === 0 ? (
              <div className="p-8 text-center space-y-3 bg-surface-muted/20 rounded-2xl border border-dashed border-border m-2">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">No Passbook Transactions Found</h3>
                  <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                    {currentUserName} has no disbursed tour advances, approved expense claims, or settlement vouchers recorded yet.
                  </p>
                </div>

                {/* Quick switch to active team members */}
                {executiveOptions.length > 1 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-muted block mb-2">
                      Switch to view active team members:
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {executiveOptions
                        .filter((opt) => opt.id !== activeUserId)
                        .slice(0, 5)
                        .map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSwitchUser(opt.id)}
                            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:border-primary hover:text-primary transition cursor-pointer"
                          >
                            {opt.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : entries.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">
                No entries match the selected category or date filter.
              </div>
            ) : (
              entries.map((entry) => {
                const eAny = entry as any;
                const isAdvanceDisburse = entry.entry_type === "advance_disbursement" || eAny.type === "ADVANCE_DISBURSED";
                const isAdvanceRefund = entry.entry_type === "advance_refund" || eAny.type === "ADVANCE_REFUND";
                const isExpenseApproved = entry.entry_type === "expense_approved" || eAny.type === "EXPENSE_APPROVED";
                const isSettlement = entry.entry_type === "settlement_voucher" || entry.entry_type === "payment_entry" || eAny.type === "PAYMENT_ENTRY" || (typeof eAny.type === "string" && eAny.type.startsWith("SETTLEMENT"));

                const itemTitle = entry.title || eAny.description || eAny.category || (isAdvanceRefund ? "Tour Advance Refund" : isAdvanceDisburse ? "Tour Advance Disbursed" : "Ledger Entry");
                const itemRef = entry.reference || eAny.reference_number || "—";
                const itemAmount = entry.amount ?? (eAny.debit > 0 ? eAny.debit : eAny.credit) ?? 0;
                const itemActor = entry.actor_name || (typeof eAny.refunded_by === "object" ? eAny.refunded_by?.name : undefined) || (typeof eAny.disbursed_by === "object" ? eAny.disbursed_by?.name : undefined);

                return (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-border bg-card p-3.5 shadow-2xs hover:shadow-xs transition space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`rounded-lg p-2 ${
                            isAdvanceDisburse
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                              : isAdvanceRefund
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : isExpenseApproved
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {isAdvanceDisburse ? (
                            <Wallet className="h-4 w-4" />
                          ) : isAdvanceRefund ? (
                            <RotateCcw className="h-4 w-4" />
                          ) : isExpenseApproved ? (
                            <Receipt className="h-4 w-4" />
                          ) : (
                            <FileCheck className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground">{itemTitle}</div>
                          <div className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
                            <span>{formatPlanDate(entry.date)}</span>
                            <span>•</span>
                            <span className="font-mono text-foreground">{itemRef}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-extrabold text-foreground">
                          {formatCurrency(itemAmount)}
                        </div>
                        {itemActor && (
                          <div className="text-[10px] text-muted">by {itemActor}</div>
                        )}
                      </div>
                    </div>

                    {/* Transaction breakdown & running balances */}
                    <div className="rounded-lg bg-surface-muted/50 p-2 text-[11px] space-y-1">
                      {entry.details && <div className="text-muted">{entry.details}</div>}
                      {entry.payment_method && (
                        <div className="text-muted">
                          Mode: <span className="font-semibold text-foreground uppercase">{entry.payment_method}</span>
                          {entry.transaction_reference && ` • Ref: ${entry.transaction_reference}`}
                        </div>
                      )}

                      {/* Attachments if available */}
                      {((entry.attachment_details && entry.attachment_details.length > 0) ||
                        (entry.attachments && entry.attachments.length > 0)) && (
                        <div className="pt-1.5 border-t border-border/40">
                          <ExpenseAttachmentList
                            attachments={entry.attachment_details || []}
                            attachmentIds={entry.attachments || []}
                            onPreview={openPreview}
                            onDownload={downloadFile}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px]">
                        <span className="text-muted">
                          Advance Bal: <strong>{formatCurrency(entry.running_advance_balance)}</strong>
                        </span>
                        <span className="text-muted">
                          Claim Rec: <strong>{formatCurrency(entry.running_claim_receivable)}</strong>
                        </span>
                        <span className="font-semibold text-foreground">
                          Net: {formatCurrency(Math.abs(entry.running_net_position))}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
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

      {isFinanceMode && refundModalOpen && (
        <AdvanceRefundModal
          open={refundModalOpen}
          user={{
            _id: activeUserId,
            name: currentUserName,
            email: passbookData?.sales_user?.email,
          }}
          userOptions={executiveOptions.length > 0 ? executiveOptions : [{ id: activeUserId, name: currentUserName }]}
          sessionToken={sessionToken}
          onClose={() => setRefundModalOpen(false)}
          onSuccess={() => {
            setRefundModalOpen(false);
            refetch();
          }}
        />
      )}
    </>
  );
}

