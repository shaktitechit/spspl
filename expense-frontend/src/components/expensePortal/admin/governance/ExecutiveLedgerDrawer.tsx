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
  Download,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useGetExecutivePassbookQuery } from "@/store/api/workPlannerApiSlice";
import { formatCurrency, formatPlanDate } from "@/components/expensePortal/shared/workPlanUtils";
import { ExpenseAttachmentList } from "@/components/expensePortal/shared/ExpenseAttachmentList";
import { FilePreviewModal, useFilePreview } from "@/components/expensePortal/shared/FilePreviewModal";
import { AdvanceRefundModal } from "@/components/expensePortal/finance/disbursements/AdvanceRefundModal";
import { usePdfCompanyLetterhead } from "@/components/expensePortal/shared/pdfCompanyLetterhead";
import {
  downloadPdfReport,
  formatAmountForPdf,
  formatCurrencyForPdf,
  type PdfReportColumn,
  type PdfReportRow,
} from "@/components/expensePortal/finance/reports/exportPdfReport";
import { toast } from "sonner";
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
      list = rawEntries.filter(
        (e: any) =>
          e.entry_type?.startsWith("expense_") ||
          e.type?.startsWith("EXPENSE_") ||
          e.entry_type === "expense_approved" ||
          e.entry_type === "expense_submitted" ||
          e.entry_type === "expense_draft" ||
          e.entry_type === "expense_rejected"
      );
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

  const letterhead = usePdfCompanyLetterhead();
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  async function handleDownloadPdf() {
    if (downloadingPdf) return;
    try {
      setDownloadingPdf(true);

      const activeFilterPanel: Array<{ label: string; value: string }> = [
        {
          label: "Executive",
          value: currentUserName,
        },
        {
          label: "Transaction Filter",
          value:
            typeFilter === "all"
              ? "All Transactions"
              : typeFilter === "advance"
              ? "Tour Advances & Refunds"
              : typeFilter === "expense"
              ? "Expense Claims"
              : "Settlement Vouchers & Payments",
        },
        {
          label: "Date Range",
          value: fromDate || toDate ? `${fromDate || "Start"} to ${toDate || "Present"}` : "All Recorded History",
        },
      ];

      const activeMetadata: Array<{ label: string; value: string }> = [
        {
          label: "Advance in Hand",
          value: formatCurrencyForPdf(advanceBal),
        },
        {
          label: "Submitted Claims",
          value: formatCurrencyForPdf((passbookData as any)?.submitted_claim_amount || 0),
        },
        {
          label: "Approved Claims",
          value: formatCurrencyForPdf(claimReceivable),
        },
        {
          label: "Net Balance Position",
          value: `${formatCurrencyForPdf(Math.abs(netPosition))} (${
            netPosition > 0
              ? "Due Employee"
              : netPosition < 0
              ? "Due Company"
              : "Balanced"
          })`,
        },
      ];

      const columns: PdfReportColumn[] = [
        { key: "rowNum", label: "#", width: 0.35, align: "center" },
        { key: "date", label: "Date", width: 0.85, align: "center" },
        { key: "ref", label: "Reference", width: 1.1, align: "left" },
        { key: "type", label: "Type / Category", width: 1.4, align: "left" },
        { key: "particulars", label: "Particulars & Description", width: 2.3, align: "left" },
        { key: "paymentInfo", label: "Payment Mode / UTR", width: 1.1, align: "left" },
        { key: "status", label: "Status", width: 0.8, align: "center" },
        { key: "amount", label: "Amount (INR)", width: 1.0, align: "right" },
        { key: "advBal", label: "Adv Bal (INR)", width: 1.0, align: "right" },
        { key: "claimsRec", label: "Claims Rec (INR)", width: 1.0, align: "right" },
        { key: "runningNet", label: "Running Net (INR)", width: 1.35, align: "right" },
      ];

      const rows: PdfReportRow[] = entries.map((e, idx) => {
        const eAny = e as any;
        let typeLabel = "Transaction";
        let statusLabel = "POSTED";

        if (e.entry_type === "advance_disbursement" || eAny.type === "ADVANCE_DISBURSED") {
          typeLabel = "Advance Disbursed";
          statusLabel = "DISBURSED";
        } else if (e.entry_type === "advance_refund" || eAny.type === "ADVANCE_REFUND") {
          typeLabel = "Advance Refund";
          statusLabel = "REFUNDED";
        } else if (e.entry_type === "expense_draft" || eAny.type === "EXPENSE_DRAFT") {
          typeLabel = `Draft Claim (${e.category || eAny.category || "General"})`;
          statusLabel = "DRAFT";
        } else if (e.entry_type === "expense_submitted" || eAny.type === "EXPENSE_SUBMITTED") {
          typeLabel = `Submitted Claim (${e.category || eAny.category || "General"})`;
          statusLabel = "PENDING";
        } else if (e.entry_type === "expense_approved" || eAny.type === "EXPENSE_APPROVED") {
          typeLabel = `Approved Claim (${e.category || eAny.category || "General"})`;
          statusLabel = "APPROVED";
        } else if (e.entry_type === "expense_rejected" || eAny.type === "EXPENSE_REJECTED") {
          typeLabel = `Rejected Claim (${e.category || eAny.category || "General"})`;
          statusLabel = "REJECTED";
        } else if (e.entry_type === "payment_entry" || eAny.type === "PAYMENT_ENTRY") {
          typeLabel = "Treasury Payment";
          statusLabel = "PAID";
        } else if (e.entry_type === "settlement_voucher" || (typeof eAny.type === "string" && eAny.type.startsWith("SETTLEMENT"))) {
          typeLabel = "Settlement Voucher";
          statusLabel = "SETTLED";
        }

        const particulars = [
          e.title || eAny.description,
          e.details && e.details !== e.title ? e.details : "",
          e.vendor_name || eAny.vendor ? `Vendor: ${e.vendor_name || eAny.vendor}` : "",
        ]
          .filter(Boolean)
          .join(" • ");

        const paymentInfo = [
          e.payment_method ? String(e.payment_method).toUpperCase() : "",
          e.transaction_reference ? `UTR: ${e.transaction_reference}` : "",
        ]
          .filter(Boolean)
          .join(" / ");

        const netPos = Number(e.running_net_position || 0);
        let netPosStr = "0.00";
        if (netPos < 0) {
          netPosStr = `${formatAmountForPdf(Math.abs(netPos))} (Due Co)`;
        } else if (netPos > 0) {
          netPosStr = `${formatAmountForPdf(netPos)} (Due Empl)`;
        }

        const rawAmt = e.amount ?? (eAny.debit > 0 ? eAny.debit : eAny.credit) ?? 0;

        return {
          rowNum: idx + 1,
          date: formatPlanDate(e.date),
          ref: e.reference || eAny.reference_number || "—",
          type: typeLabel,
          particulars: particulars || "—",
          paymentInfo: paymentInfo || "—",
          status: statusLabel,
          amount: formatAmountForPdf(rawAmt),
          advBal: formatAmountForPdf(e.running_advance_balance || 0),
          claimsRec: formatAmountForPdf(e.running_claim_receivable || 0),
          runningNet: netPosStr,
        };
      });

      // Closing totals row
      const totalAmount = entries.reduce((s, e: any) => s + (Number(e.amount ?? (e.debit > 0 ? e.debit : e.credit)) || 0), 0);
      const latestAdvBal = entries.length > 0 ? (entries[0].running_advance_balance || 0) : 0;
      const latestClaimsRec = entries.length > 0 ? (entries[0].running_claim_receivable || 0) : 0;
      const latestNetPos = entries.length > 0 ? (entries[0].running_net_position || 0) : 0;
      let finalNetStr = "0.00";
      if (latestNetPos < 0) {
        finalNetStr = `${formatAmountForPdf(Math.abs(latestNetPos))} (Due Co)`;
      } else if (latestNetPos > 0) {
        finalNetStr = `${formatAmountForPdf(latestNetPos)} (Due Empl)`;
      }

      rows.push({
        _rowType: "SUBTOTAL",
        rowNum: "",
        date: "",
        ref: "",
        type: "CLOSING TOTALS",
        particulars: `Total entries: ${entries.length}`,
        paymentInfo: "",
        status: "",
        amount: formatAmountForPdf(totalAmount),
        advBal: formatAmountForPdf(latestAdvBal),
        claimsRec: formatAmountForPdf(latestClaimsRec),
        runningNet: finalNetStr,
      });

      const safeName = (currentUserName || "Executive").toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const dateStr = new Date().toISOString().slice(0, 10);

      await downloadPdfReport({
        letterhead,
        filename: `passbook_statement_${safeName}_${dateStr}.pdf`,
        title: "Executive Financial Passbook & Statement of Account",
        subtitle: `Statement of Account & Claims Ledger for ${currentUserName}`,
        downloadedBy: currentUserName,
        timestamp: new Date().toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        filterPanel: activeFilterPanel,
        metadata: activeMetadata,
        columns,
        rows,
      });

      toast.success("Passbook statement downloaded on company letterhead");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate PDF";
      toast.error(msg);
    } finally {
      setDownloadingPdf(false);
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
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || isLoading}
                className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer disabled:opacity-50"
                title="Download Passbook PDF Statement (Company Letterhead)"
              >
                {downloadingPdf ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Download className="h-4 w-4 text-primary" />
                )}
              </button>
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
                const isExpenseSubmitted = entry.entry_type === "expense_submitted" || eAny.type === "EXPENSE_SUBMITTED";
                const isExpenseDraft = entry.entry_type === "expense_draft" || eAny.type === "EXPENSE_DRAFT";
                const isExpenseRejected = entry.entry_type === "expense_rejected" || eAny.type === "EXPENSE_REJECTED";
                const isSettlement = entry.entry_type === "settlement_voucher" || entry.entry_type === "payment_entry" || eAny.type === "PAYMENT_ENTRY" || (typeof eAny.type === "string" && eAny.type.startsWith("SETTLEMENT"));

                const itemTitle = entry.title || eAny.description || eAny.category || (isAdvanceRefund ? "Tour Advance Refund" : isAdvanceDisburse ? "Tour Advance Disbursed" : isExpenseDraft ? "Draft Claim" : isExpenseSubmitted ? "Submitted Claim" : isExpenseRejected ? "Rejected Claim" : "Ledger Entry");
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
                              : isExpenseSubmitted
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : isExpenseDraft
                              ? "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                              : isExpenseRejected
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {isAdvanceDisburse ? (
                            <Wallet className="h-4 w-4" />
                          ) : isAdvanceRefund ? (
                            <RotateCcw className="h-4 w-4" />
                          ) : isExpenseApproved ? (
                            <Receipt className="h-4 w-4" />
                          ) : isExpenseSubmitted ? (
                            <Clock className="h-4 w-4" />
                          ) : isExpenseDraft ? (
                            <Receipt className="h-4 w-4" />
                          ) : isExpenseRejected ? (
                            <AlertTriangle className="h-4 w-4" />
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

