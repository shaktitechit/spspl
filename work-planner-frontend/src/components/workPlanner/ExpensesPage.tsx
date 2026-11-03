"use client";

import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Wallet,
  Receipt,
  FileCheck,
  RotateCcw,
  CreditCard,
  Printer,
  Search,
  Calendar,
  RefreshCw,
  Scale,
  Eye,
  Info,
  User,
  Plus,
  Clock,
  XCircle,
  FileText,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { usePdfCompanyLetterhead } from "./pdfCompanyLetterhead";
import {
  downloadPdfReport,
  formatAmountForPdf,
  formatCurrencyForPdf,
  type PdfReportColumn,
  type PdfReportRow,
} from "./exportPdfReport";
import {
  useGetExecutivePassbookQuery,
  useGetExpenseKpisQuery,
} from "@/store/api/workPlannerApiSlice";
import { readSessionFromStorage } from "@/utils/authStorage";
import { formatCurrency, formatPlanDate } from "./workPlanUtils";
import { ExpenseAttachmentList } from "./expense/ExpenseAttachmentList";
import { FilePreviewModal, useFilePreview } from "./FilePreviewModal";
import { SettlementVoucherModal } from "./expense/SettlementVoucherModal";
import { RequestAdvanceModal } from "./expense/RequestAdvanceModal";
import { DownloadExpensesModal } from "./DownloadExpensesModal";
import type { PassbookLedgerEntry } from "@/types/workPlanner";
import { calculateDateRange } from "./DashboardDateFilter";

export function ExpensesPage() {
  const session = readSessionFromStorage();
  const currentUser = session?.user;
  const sessionToken = session?.token;
  const userId = currentUser?._id || "";

  // Filter States - Default to current month
  const defaultRange = useMemo(() => calculateDateRange("current_month"), []);
  const [fromDate, setFromDate] = useState<string>(defaultRange.from);
  const [toDate, setToDate] = useState<string>(defaultRange.to);
  const [typeFilter, setTypeFilter] = useState<"all" | "advance" | "payment" | "expense" | "settlement">("all");
  const [advanceSubFilter, setAdvanceSubFilter] = useState<"all" | "disbursed" | "refund" | "rejected">("all");
  const [claimSubFilter, setClaimSubFilter] = useState<"all" | "draft" | "submitted" | "approved" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const isCurrentMonthActive = Boolean(
    fromDate &&
      toDate &&
      fromDate === defaultRange.from &&
      toDate === defaultRange.to
  );

  // Modals State
  const [requestAdvanceOpen, setRequestAdvanceOpen] = useState<boolean>(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [exportClaimsModalOpen, setExportClaimsModalOpen] = useState<boolean>(false);

  // PDF Letterhead & Download State
  const letterhead = usePdfCompanyLetterhead();
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  // File Preview Hook
  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  } = useFilePreview(sessionToken);

  // Query Passbook for the logged-in user
  const {
    data: passbookData,
    isLoading: isPassbookLoading,
    isFetching: isPassbookFetching,
    refetch: refetchPassbook,
  } = useGetExecutivePassbookQuery(
    {
      userId,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    },
    { skip: !userId }
  );

  // Query KPI summary for logged-in user
  const {
    data: kpiSummary,
    isFetching: isKpiFetching,
    refetch: refetchKpis,
  } = useGetExpenseKpisQuery(
    {
      scope: "mine",
      user_id: userId,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    },
    { skip: !userId }
  );

  const isLoading = isPassbookLoading;
  const isFetching = isPassbookFetching || isKpiFetching;
  const refetch = () => {
    refetchPassbook();
    refetchKpis();
  };

  const rawEntries: PassbookLedgerEntry[] = passbookData?.entries || [];

  // Counts by category
  const counts = useMemo(() => {
    let advances = 0;
    let advancesDisbursed = 0;
    let advancesRefund = 0;
    let advancesRejected = 0;
    let payments = 0;
    let expenses = 0;
    let settlements = 0;
    let draftClaims = 0;
    let submittedClaims = 0;
    let approvedClaims = 0;
    let rejectedClaims = 0;

    for (const e of rawEntries) {
      if (
        e.entry_type === "advance_disbursement" ||
        e.entry_type === "advance_refund" ||
        e.entry_type === "advance_rejected"
      ) {
        advances++;
        if (e.entry_type === "advance_disbursement") {
          advancesDisbursed++;
        } else if (e.entry_type === "advance_refund") {
          advancesRefund++;
        } else if (e.entry_type === "advance_rejected") {
          advancesRejected++;
        }
      } else if (e.entry_type === "payment_entry") {
        payments++;
      } else if (
        e.entry_type === "expense_approved" ||
        e.entry_type === "expense_submitted" ||
        e.entry_type === "expense_rejected" ||
        e.entry_type === "expense_draft"
      ) {
        expenses++;
        if (e.entry_type === "expense_draft" || e.claim_status === "draft") {
          draftClaims++;
        } else if (e.entry_type === "expense_submitted" || e.claim_status === "submitted") {
          submittedClaims++;
        } else if (e.entry_type === "expense_approved" || e.claim_status === "approved") {
          approvedClaims++;
        } else if (e.entry_type === "expense_rejected" || e.claim_status === "rejected") {
          rejectedClaims++;
        }
      } else if (e.entry_type === "settlement_voucher") {
        settlements++;
      }
    }

    return {
      all: rawEntries.length,
      advances,
      advancesDisbursed,
      advancesRefund,
      advancesRejected,
      payments,
      expenses,
      settlements,
      draftClaims,
      submittedClaims,
      approvedClaims,
      rejectedClaims,
    };
  }, [rawEntries]);

  // Filtered entries by type, sub-filter and search query, sorted latest-to-oldest
  const filteredEntries = useMemo(() => {
    let list = rawEntries;

    if (typeFilter === "advance") {
      list = list.filter(
        (e) =>
          e.entry_type === "advance_disbursement" ||
          e.entry_type === "advance_refund" ||
          e.entry_type === "advance_rejected"
      );
      if (advanceSubFilter === "disbursed") {
        list = list.filter((e) => e.entry_type === "advance_disbursement");
      } else if (advanceSubFilter === "refund") {
        list = list.filter((e) => e.entry_type === "advance_refund");
      } else if (advanceSubFilter === "rejected") {
        list = list.filter((e) => e.entry_type === "advance_rejected");
      }
    } else if (typeFilter === "payment") {
      list = list.filter((e) => e.entry_type === "payment_entry");
    } else if (typeFilter === "expense") {
      list = list.filter(
        (e) =>
          e.entry_type === "expense_approved" ||
          e.entry_type === "expense_submitted" ||
          e.entry_type === "expense_rejected" ||
          e.entry_type === "expense_draft"
      );
      if (claimSubFilter === "draft") {
        list = list.filter(
          (e) => e.entry_type === "expense_draft" || e.claim_status === "draft"
        );
      } else if (claimSubFilter === "submitted") {
        list = list.filter(
          (e) => e.entry_type === "expense_submitted" || e.claim_status === "submitted"
        );
      } else if (claimSubFilter === "approved") {
        list = list.filter(
          (e) => e.entry_type === "expense_approved" || e.claim_status === "approved"
        );
      } else if (claimSubFilter === "rejected") {
        list = list.filter(
          (e) => e.entry_type === "expense_rejected" || e.claim_status === "rejected"
        );
      }
    } else if (typeFilter === "settlement") {
      list = list.filter((e) => e.entry_type === "settlement_voucher");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((e) => {
        const ref = (e.reference || "").toLowerCase();
        const title = (e.title || "").toLowerCase();
        const details = (e.details || "").toLowerCase();
        const method = (e.payment_method || "").toLowerCase();
        const txRef = (e.transaction_reference || "").toLowerCase();
        const category = (e.category || "").toLowerCase();
        const vendor = (e.vendor_name || "").toLowerCase();
        const remarks = (e.rejection_reason || e.remarks || "").toLowerCase();
        return (
          ref.includes(q) ||
          title.includes(q) ||
          details.includes(q) ||
          method.includes(q) ||
          txRef.includes(q) ||
          category.includes(q) ||
          vendor.includes(q) ||
          remarks.includes(q)
        );
      });
    }

    // Sort latest-to-oldest by date
    return [...list].sort((a, b) => {
      const tA = new Date(a.date).getTime() || 0;
      const tB = new Date(b.date).getTime() || 0;
      return tB - tA;
    });
  }, [rawEntries, typeFilter, advanceSubFilter, claimSubFilter, searchQuery]);

  // Group filtered entries by date for section headers
  const groupedByDate = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; entries: typeof filteredEntries }[] = [];
    const map = new Map<string, typeof filteredEntries>();

    for (const entry of filteredEntries) {
      const dateKey = entry.date ? entry.date.slice(0, 10) : "unknown";
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(entry);
    }

    for (const [dateKey, entries] of map) {
      groups.push({
        dateKey,
        dateLabel: dateKey !== "unknown" ? formatPlanDate(dateKey) : "Unknown Date",
        entries,
      });
    }

    return groups;
  }, [filteredEntries]);

  const currentUserName = currentUser?.name || passbookData?.sales_user?.name || "Executive";
  const currentUserEmail = currentUser?.email || passbookData?.sales_user?.email || "";
  const currentDepartment = currentUser?.department || passbookData?.sales_user?.department || "Operations";
  const netPosition = passbookData?.current_net_position || 0;
  const submittedClaimAmount =
    passbookData?.submitted_claim_amount ??
    kpiSummary?.pending_approval?.amount ??
    0;
  const submittedClaimCount =
    passbookData?.submitted_claim_count ??
    kpiSummary?.pending_approval?.count ??
    counts.submittedClaims ??
    0;

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  async function handleDownloadPdf() {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const activeFilterPanel: Array<{ label: string; value: string }> = [
        { label: "Executive", value: currentUserName },
        { label: "Department", value: currentDepartment },
        {
          label: "Period",
          value:
            fromDate && toDate
              ? `${formatPlanDate(fromDate)} to ${formatPlanDate(toDate)}`
              : fromDate
              ? `From ${formatPlanDate(fromDate)}`
              : toDate
              ? `Up to ${formatPlanDate(toDate)}`
              : "All Time",
        },
        {
          label: "Type Filter",
          value:
            typeFilter === "all"
              ? "All Transactions"
              : typeFilter === "advance"
              ? `Tour Advances (${advanceSubFilter.toUpperCase()})`
              : typeFilter === "payment"
              ? "Direct Treasury Payments"
              : typeFilter === "expense"
              ? `Claims (${claimSubFilter.toUpperCase()})`
              : "Settlement Vouchers",
        },
        { label: "Records", value: `${filteredEntries.length} entries` },
      ];

      const activeMetadata: Array<{ label: string; value: string }> = [
        {
          label: "Advance in Hand",
          value: formatCurrencyForPdf(passbookData?.current_advance_balance || 0),
        },
        {
          label: "Direct Payments",
          value: formatCurrencyForPdf(
            passbookData?.current_payment_entry ??
              passbookData?.total_payment_entries ??
              0
          ),
        },
        {
          label: "Submitted Claims",
          value: formatCurrencyForPdf(submittedClaimAmount),
        },
        {
          label: "Approved Claims",
          value: formatCurrencyForPdf(passbookData?.current_claim_receivable || 0),
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

      const rows: PdfReportRow[] = filteredEntries.map((e, idx) => {
        let typeLabel = "Transaction";
        let statusLabel = "POSTED";

        if (e.entry_type === "advance_disbursement") {
          typeLabel = "Advance Disbursed";
          statusLabel = "DISBURSED";
        } else if (e.entry_type === "advance_refund") {
          typeLabel = "Advance Refund";
          statusLabel = "REFUNDED";
        } else if (e.entry_type === "advance_rejected") {
          typeLabel = "Advance Rejected";
          statusLabel = "REJECTED";
        } else if (e.entry_type === "expense_draft") {
          typeLabel = `Draft Claim (${e.category || "General"})`;
          statusLabel = "DRAFT";
        } else if (e.entry_type === "expense_submitted") {
          typeLabel = `Submitted Claim (${e.category || "General"})`;
          statusLabel = "PENDING";
        } else if (e.entry_type === "expense_approved") {
          typeLabel = `Approved Claim (${e.category || "General"})`;
          statusLabel = "APPROVED";
        } else if (e.entry_type === "expense_rejected") {
          typeLabel = `Rejected Claim (${e.category || "General"})`;
          statusLabel = "REJECTED";
        } else if (e.entry_type === "payment_entry") {
          typeLabel = "Treasury Payment";
          statusLabel = "PAID";
        } else if (e.entry_type === "settlement_voucher") {
          typeLabel = "Settlement Voucher";
          statusLabel = "SETTLED";
        }

        const particulars = [
          e.title,
          e.details && e.details !== e.title ? e.details : "",
          e.rejection_reason ? `Reason: ${e.rejection_reason}` : "",
          e.vendor_name ? `Vendor: ${e.vendor_name}` : "",
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

        return {
          rowNum: idx + 1,
          date: formatPlanDate(e.date),
          ref: e.reference || "—",
          type: typeLabel,
          particulars: particulars || "—",
          paymentInfo: paymentInfo || "—",
          status: statusLabel,
          amount: formatAmountForPdf(e.amount || 0),
          advBal: formatAmountForPdf(e.running_advance_balance || 0),
          claimsRec: formatAmountForPdf(e.running_claim_receivable || 0),
          runningNet: netPosStr,
        };
      });

      // Closing totals row
      const totalAmount = filteredEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const latestAdvBal = filteredEntries.length > 0 ? (filteredEntries[0].running_advance_balance || 0) : 0;
      const latestClaimsRec = filteredEntries.length > 0 ? (filteredEntries[0].running_claim_receivable || 0) : 0;
      const latestNetPos = filteredEntries.length > 0 ? (filteredEntries[0].running_net_position || 0) : 0;
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
        particulars: `Total entries: ${filteredEntries.length}`,
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
        subtitle: `Statement of Account & Claims Ledger for ${currentUserName} (${currentDepartment})`,
        downloadedBy: `${currentUserName} (${currentUserEmail || currentDepartment})`,
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

      toast.success("Passbook statement downloaded with company letterhead");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate PDF";
      toast.error(msg);
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="space-y-4 font-sans w-full max-w-full pb-8">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-purple-500/10 p-3 text-purple-600 dark:text-purple-400 shrink-0">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-foreground">
                My Passbook & Ledger
              </h1>
              <span className="rounded-lg bg-surface-muted px-2 py-0.5 text-xs font-semibold text-muted">
                {currentUserName}
              </span>
              <span className="rounded-lg bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                {currentDepartment}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted mt-0.5">
              Live personal financial dossier, field claim reimbursements, tour advances & running ledger
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0 cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`h-4 w-4 text-muted ${isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0 cursor-pointer"
            title="Print Passbook"
          >
            <Printer className="h-4 w-4 text-muted" />
            <span className="hidden sm:inline">Print</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf || isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition shrink-0 cursor-pointer disabled:opacity-50"
            title="Download Statement of Account on Company Letterhead"
          >
            <Download className={`h-4 w-4 text-muted ${downloadingPdf ? "animate-bounce" : ""}`} />
            <span>{downloadingPdf ? "Generating PDF…" : "Download PDF"}</span>
          </button>

          <button
            type="button"
            onClick={() => setExportClaimsModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-600/30 bg-teal-500/10 px-3 py-2 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 active:scale-95 transition shrink-0 cursor-pointer"
            title="Export My Expense Claims (Excel, CSV, PDF Report)"
          >
            <FileSpreadsheet className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>Export Claims</span>
          </button>

          <button
            type="button"
            onClick={() => setRequestAdvanceOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-purple-700 active:scale-95 transition shadow-2xs shrink-0 cursor-pointer"
            title="Request Tour Advance Funds"
          >
            <Plus className="h-4 w-4" />
            <span>Request Advance</span>
          </button>
        </div>
      </div>

      {/* Financial Dossier KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Advance in Hand */}
        <div
          onClick={() => {
            setTypeFilter("advance");
            setAdvanceSubFilter("all");
          }}
          className={`rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 flex flex-col justify-between cursor-pointer transition hover:border-purple-500/40 hover:shadow-xs ${
            typeFilter === "advance" ? "ring-2 ring-purple-500/50" : ""
          }`}
          title="Filter by Tour Advances"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              Advance in Hand
            </span>
            <div className="rounded-lg bg-purple-500/10 p-1.5 text-purple-600 dark:text-purple-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold text-foreground">
              {isLoading ? "…" : formatCurrency(passbookData?.current_advance_balance || 0)}
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-[11px] text-muted">Active tour advances</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRequestAdvanceOpen(true);
                }}
                className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
              >
                + Request
              </button>
            </div>
          </div>
        </div>

        {/* 2. Direct Treasury Payments */}
        <div
          onClick={() => {
            setTypeFilter("payment");
          }}
          className={`rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex flex-col justify-between cursor-pointer transition hover:border-indigo-500/40 hover:shadow-xs ${
            typeFilter === "payment" ? "ring-2 ring-indigo-500/50" : ""
          }`}
          title="Filter by Direct Payments"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Direct Payments
            </span>
            <div className="rounded-lg bg-indigo-500/10 p-1.5 text-indigo-600 dark:text-indigo-400">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold text-foreground">
              {isLoading
                ? "…"
                : formatCurrency(
                    passbookData?.current_payment_entry ??
                      passbookData?.total_payment_entries ??
                      0
                  )}
            </div>
            <p className="text-[11px] text-muted mt-0.5">Unadjusted treasury payouts</p>
          </div>
        </div>

        {/* 3. Submitted Claims */}
        <div
          onClick={() => {
            setTypeFilter("expense");
            setClaimSubFilter("submitted");
          }}
          className={`rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col justify-between cursor-pointer transition hover:border-amber-500/40 hover:shadow-xs ${
            typeFilter === "expense" && claimSubFilter === "submitted"
              ? "ring-2 ring-amber-500/50"
              : ""
          }`}
          title="Filter by Submitted Claims (Awaiting Approval)"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Submitted Claims
            </span>
            <div className="rounded-lg bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold text-foreground">
              {isLoading
                ? "…"
                : formatCurrency(
                    passbookData?.submitted_claim_amount ??
                      kpiSummary?.pending_approval?.amount ??
                      0
                  )}
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              {(passbookData?.submitted_claim_count ?? kpiSummary?.pending_approval?.count ?? counts.submittedClaims) || 0}{" "}
              claims awaiting approval
              {counts.draftClaims > 0 ? ` • ${counts.draftClaims} draft` : ""}
            </p>
          </div>
        </div>

        {/* 4. Unsettled Approved Claims */}
        <div
          onClick={() => {
            setTypeFilter("expense");
            setClaimSubFilter("approved");
          }}
          className={`rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 flex flex-col justify-between cursor-pointer transition hover:border-sky-500/40 hover:shadow-xs ${
            typeFilter === "expense" && claimSubFilter === "approved"
              ? "ring-2 ring-sky-500/50"
              : ""
          }`}
          title="Filter by Approved Claims"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              Approved Claims
            </span>
            <div className="rounded-lg bg-sky-500/10 p-1.5 text-sky-600 dark:text-sky-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold text-foreground">
              {isLoading ? "…" : formatCurrency(passbookData?.current_claim_receivable || 0)}
            </div>
            <p className="text-[11px] text-muted mt-0.5">Verified claim receivables</p>
          </div>
        </div>

        {/* 5. Net Position */}
        <div
          onClick={() => {
            setTypeFilter("all");
            setClaimSubFilter("all");
          }}
          className={`rounded-2xl border p-4 flex flex-col justify-between cursor-pointer transition hover:shadow-xs ${
            netPosition > 0
              ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40"
              : netPosition < 0
              ? "border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40"
              : "border-border bg-card"
          } ${typeFilter === "all" ? "ring-2 ring-primary/40" : ""}`}
          title="Show All Transactions"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Net Balance Position
            </span>
            <div className="rounded-lg bg-surface-muted p-1.5 text-muted">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div
              className={`text-xl sm:text-2xl font-extrabold ${
                netPosition > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : netPosition < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-foreground"
              }`}
            >
              {isLoading ? "…" : formatCurrency(Math.abs(netPosition))}
            </div>
            <span
              className={`inline-block text-[10px] font-bold uppercase rounded px-1.5 py-0.5 mt-1 ${
                netPosition > 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : netPosition < 0
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-surface-muted text-muted"
              }`}
            >
              {netPosition > 0
                ? "Due to You (Reimbursement)"
                : netPosition < 0
                ? "Due to Company (Return / Deduct)"
                : "Balanced / Fully Settled"}
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reference #, notes, category, UTR..."
            className="w-full rounded-xl border border-border bg-surface-muted pl-9 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-muted/50 p-1 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              typeFilter === "all"
                ? "bg-primary text-primary-foreground shadow-xs font-bold"
                : "text-muted hover:text-foreground"
            }`}
          >
            All ({counts.all})
          </button>

          <button
            type="button"
            onClick={() => {
              setTypeFilter("advance");
              setAdvanceSubFilter("all");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              typeFilter === "advance"
                ? "bg-purple-600 text-white shadow-xs font-bold"
                : "text-muted hover:text-foreground"
            }`}
          >
            Advances ({counts.advances})
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter("payment")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              typeFilter === "payment"
                ? "bg-indigo-600 text-white shadow-xs font-bold"
                : "text-muted hover:text-foreground"
            }`}
          >
            Payments ({counts.payments})
          </button>

          <button
            type="button"
            onClick={() => {
              setTypeFilter("expense");
              setClaimSubFilter("all");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              typeFilter === "expense"
                ? "bg-sky-600 text-white shadow-xs font-bold"
                : "text-muted hover:text-foreground"
            }`}
          >
            Claims ({counts.expenses})
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter("settlement")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              typeFilter === "settlement"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-muted hover:text-foreground"
            }`}
          >
            Settlements ({counts.settlements})
          </button>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-1.5 text-xs">
          <Calendar className="h-4 w-4 text-muted shrink-0" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-border bg-surface-muted px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
            title="From Date"
          />
          <span className="text-muted text-[11px]">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-border bg-surface-muted px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
            title="To Date"
          />
          <button
            type="button"
            onClick={() => {
              const range = calculateDateRange("current_month");
              setFromDate(range.from);
              setToDate(range.to);
            }}
            className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
              isCurrentMonthActive
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface-muted text-muted hover:text-foreground hover:bg-card"
            }`}
            title="Filter to current month"
          >
            This Month
          </button>
          {(fromDate || toDate || searchQuery || typeFilter !== "all" || claimSubFilter !== "all" || advanceSubFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setFromDate("");
                setToDate("");
                setSearchQuery("");
                setTypeFilter("all");
                setClaimSubFilter("all");
                setAdvanceSubFilter("all");
              }}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Advance Sub-Filter Bar when Advances tab is selected */}
      {typeFilter === "advance" && (
        <div className="flex items-center gap-1.5 bg-card/60 px-3 py-2 rounded-xl border border-border/70 text-xs overflow-x-auto scrollbar-none">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider shrink-0 mr-1">
            Advance Filter:
          </span>
          <button
            type="button"
            onClick={() => setAdvanceSubFilter("all")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              advanceSubFilter === "all"
                ? "bg-purple-600 text-white font-bold shadow-xs"
                : "bg-surface-muted text-muted hover:text-foreground hover:bg-card border border-border"
            }`}
          >
            All Advances ({counts.advances})
          </button>

          <button
            type="button"
            onClick={() => setAdvanceSubFilter("disbursed")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              advanceSubFilter === "disbursed"
                ? "bg-purple-600 text-white font-bold shadow-xs"
                : "bg-surface-muted text-muted hover:text-foreground hover:bg-card border border-border"
            }`}
          >
            Disbursed ({counts.advancesDisbursed})
          </button>

          {counts.advancesRefund > 0 && (
            <button
              type="button"
              onClick={() => setAdvanceSubFilter("refund")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
                advanceSubFilter === "refund"
                  ? "bg-amber-600 text-white font-bold shadow-xs"
                  : "bg-surface-muted text-muted hover:text-foreground hover:bg-card border border-border"
              }`}
            >
              Refunds ({counts.advancesRefund})
            </button>
          )}

          <button
            type="button"
            onClick={() => setAdvanceSubFilter("rejected")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              advanceSubFilter === "rejected"
                ? "bg-rose-600 text-white font-bold shadow-xs"
                : "bg-surface-muted text-muted hover:text-foreground hover:bg-card border border-border"
            }`}
          >
            Rejected ({counts.advancesRejected})
          </button>
        </div>
      )}

      {/* Claims Sub-Filter Bar when Claims tab is selected */}
      {typeFilter === "expense" && (
        <div className="flex items-center gap-1.5 bg-card/60 px-3 py-2 rounded-xl border border-border/70 text-xs overflow-x-auto scrollbar-none">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider shrink-0 mr-1">
            Claim Status:
          </span>
          <button
            type="button"
            onClick={() => setClaimSubFilter("all")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              claimSubFilter === "all"
                ? "bg-sky-600 text-white font-bold shadow-xs"
                : "bg-surface-muted text-muted hover:text-foreground hover:bg-card border border-border"
            }`}
          >
            All Claims ({counts.expenses})
          </button>

          {counts.draftClaims > 0 && (
            <button
              type="button"
              onClick={() => setClaimSubFilter("draft")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
                claimSubFilter === "draft"
                  ? "bg-slate-700 text-white font-bold shadow-xs"
                  : "bg-surface-muted text-muted hover:text-foreground hover:bg-card border border-border"
              }`}
            >
              Drafts ({counts.draftClaims})
            </button>
          )}

          <button
            type="button"
            onClick={() => setClaimSubFilter("submitted")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              claimSubFilter === "submitted"
                ? "bg-amber-600 text-white font-bold shadow-xs"
                : "bg-surface-muted text-muted hover:text-foreground hover:bg-card border border-border"
            }`}
          >
            Submitted ({counts.submittedClaims})
          </button>

          <button
            type="button"
            onClick={() => setClaimSubFilter("approved")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
              claimSubFilter === "approved"
                ? "bg-sky-600 text-white font-bold shadow-xs"
                : "bg-surface-muted text-muted hover:text-foreground hover:bg-card border border-border"
            }`}
          >
            Approved ({counts.approvedClaims})
          </button>

          {counts.rejectedClaims > 0 && (
            <button
              type="button"
              onClick={() => setClaimSubFilter("rejected")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap active:scale-95 transition cursor-pointer ${
                claimSubFilter === "rejected"
                  ? "bg-rose-600 text-white font-bold shadow-xs"
                  : "bg-surface-muted text-muted hover:text-foreground hover:bg-card border border-border"
              }`}
            >
              Rejected ({counts.rejectedClaims})
            </button>
          )}
        </div>
      )}

      {/* Chronological Ledger Timeline */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-xs text-muted">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            <span>Loading passbook transactions & running balances…</span>
          </div>
        ) : rawEntries.length === 0 ? (
          <div className="p-12 text-center space-y-3 bg-card rounded-2xl border border-dashed border-border">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <BookOpen className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">No Passbook Transactions Found</h3>
              <p className="text-xs text-muted mt-1 max-w-md mx-auto">
                You do not have any tour advance disbursements, expense claims, direct payments, or settlement vouchers recorded yet.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setRequestAdvanceOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 active:scale-95 transition shadow-2xs cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Request Tour Advance</span>
              </button>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted bg-card rounded-2xl border border-border">
            No passbook transactions match the selected filters or date range.
          </div>
        ) : (
          groupedByDate.map((group) => (
            <div key={group.dateKey} className="space-y-2">
              {/* Date Section Header */}
              <div className="flex items-center gap-3 px-1 pt-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-xs sm:text-sm font-bold text-foreground">{group.dateLabel}</span>
                </div>
                <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted">
                  {group.entries.length} {group.entries.length === 1 ? "entry" : "entries"}
                </span>
                <div className="flex-1 border-t border-border/50" />
                <span className="text-[10px] font-semibold text-muted">
                  {formatCurrency(group.entries.reduce((sum, e) => sum + e.amount, 0))}
                </span>
              </div>

              {/* Entries within this date */}
              {group.entries.map((entry) => {
            const isAdvanceDisburse = entry.entry_type === "advance_disbursement";
            const isAdvanceRefund = entry.entry_type === "advance_refund";
            const isAdvanceRejected = entry.entry_type === "advance_rejected";
            const isExpenseApproved = entry.entry_type === "expense_approved";
            const isExpenseSubmitted = entry.entry_type === "expense_submitted";
            const isExpenseRejected = entry.entry_type === "expense_rejected";
            const isExpenseDraft = entry.entry_type === "expense_draft";
            const isPaymentEntry = entry.entry_type === "payment_entry";
            const isSettlement = entry.entry_type === "settlement_voucher";

            // Extract voucher ID for inspection
            const voucherId = entry.settlement_id || entry.id.replace(/^(SETTLE|PAY-ENTRY)-/, "");

            return (
              <div
                key={entry.id}
                className={`rounded-2xl border bg-card p-4 shadow-2xs hover:shadow-xs transition space-y-3 ${
                  isExpenseSubmitted
                    ? "border-amber-500/30"
                    : isExpenseRejected || isAdvanceRejected
                    ? "border-rose-500/30"
                    : isExpenseDraft
                    ? "border-dashed border-slate-500/30"
                    : "border-border"
                }`}
              >
                {/* Header: Type icon, title, date, reference, amount */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-xl p-2.5 shrink-0 ${
                        isAdvanceDisburse
                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                          : isAdvanceRefund
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : isAdvanceRejected
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : isExpenseSubmitted
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : isExpenseDraft
                          ? "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                          : isExpenseApproved
                          ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                          : isExpenseRejected
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : isPaymentEntry
                          ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {isAdvanceDisburse ? (
                        <Wallet className="h-5 w-5" />
                      ) : isAdvanceRefund ? (
                        <RotateCcw className="h-5 w-5" />
                      ) : isAdvanceRejected ? (
                        <XCircle className="h-5 w-5" />
                      ) : isExpenseSubmitted ? (
                        <Clock className="h-5 w-5" />
                      ) : isExpenseDraft ? (
                        <FileText className="h-5 w-5" />
                      ) : isExpenseApproved ? (
                        <Receipt className="h-5 w-5" />
                      ) : isExpenseRejected ? (
                        <XCircle className="h-5 w-5" />
                      ) : isPaymentEntry ? (
                        <CreditCard className="h-5 w-5" />
                      ) : (
                        <FileCheck className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-foreground">
                          {entry.title}
                        </span>
                        {isAdvanceRejected && (
                          <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                            Advance Rejected
                          </span>
                        )}
                        {isExpenseDraft && (
                          <span className="rounded-md bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                            Draft • Unsubmitted
                          </span>
                        )}
                        {isExpenseSubmitted && (
                          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                            Submitted • Pending Approval
                          </span>
                        )}
                        {isExpenseApproved && (
                          <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase">
                            Approved Claim
                          </span>
                        )}
                        {isExpenseRejected && (
                          <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                            Rejected Claim
                          </span>
                        )}
                        {isPaymentEntry && (
                          <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                            Treasury Payment
                          </span>
                        )}
                        {isSettlement && (
                          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                            Settlement Voucher
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span>{formatPlanDate(entry.date)}</span>
                        <span>•</span>
                        <span className="font-mono text-foreground font-semibold">
                          {entry.reference}
                        </span>
                        {entry.actor_name && (
                          <>
                            <span>•</span>
                            <span>by {entry.actor_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Actions */}
                  <div className="text-right shrink-0">
                    <div className="text-sm sm:text-base font-extrabold text-foreground">
                      {formatCurrency(entry.amount)}
                    </div>
                    {isSettlement && (
                      <button
                        type="button"
                        onClick={() => setSelectedVoucherId(voucherId)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline mt-1 cursor-pointer"
                      >
                        <Eye className="h-3 w-3" />
                        <span>View Breakdown</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Details & Payment Metadata */}
                <div className="rounded-xl bg-surface-muted/50 p-3 text-xs space-y-2">
                  {/* Rejection Remarks Callout Box */}
                  {(isAdvanceRejected || isExpenseRejected) && (entry.rejection_reason || entry.remarks) && (
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
                        <XCircle className="h-3.5 w-3.5" />
                        <span>{isAdvanceRejected ? "Advance Rejection Remarks:" : "Claim Rejection Remarks:"}</span>
                      </div>
                      <p className="text-foreground leading-relaxed pl-5 font-medium">
                        {entry.rejection_reason || entry.remarks}
                      </p>
                    </div>
                  )}

                  {entry.details && (!isAdvanceRejected || (!entry.rejection_reason && !entry.remarks)) && (
                    <p className="text-muted leading-relaxed">{entry.details}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                    {entry.category && (
                      <div>
                        Category:{" "}
                        <span className="font-semibold text-foreground">
                          {entry.category}
                          {entry.sub_category ? ` (${entry.sub_category})` : ""}
                        </span>
                      </div>
                    )}
                    {entry.vendor_name && (
                      <div>
                        Vendor: <span className="font-semibold text-foreground">{entry.vendor_name}</span>
                      </div>
                    )}
                    {entry.payment_method && (
                      <div>
                        Mode: <span className="font-semibold text-foreground uppercase">{entry.payment_method}</span>
                      </div>
                    )}
                    {entry.transaction_reference && (
                      <div>
                        Ref / UTR: <span className="font-mono font-semibold text-foreground">{entry.transaction_reference}</span>
                      </div>
                    )}
                    {entry.advance_deduction_amount !== undefined && entry.advance_deduction_amount > 0 && (
                      <div>
                        Advance Offset: <span className="font-bold text-purple-600 dark:text-purple-400">{formatCurrency(entry.advance_deduction_amount)}</span>
                      </div>
                    )}
                    {entry.payment_entry_deduction_amount !== undefined && entry.payment_entry_deduction_amount > 0 && (
                      <div>
                        Payment Offset: <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(entry.payment_entry_deduction_amount)}</span>
                      </div>
                    )}
                    {entry.direct_payment_amount !== undefined && entry.direct_payment_amount > 0 && isSettlement && (
                      <div>
                        Direct Payout: <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(entry.direct_payment_amount)}</span>
                      </div>
                    )}
                  </div>

                  {/* Attachments if any */}
                  {((entry.attachment_details && entry.attachment_details.length > 0) ||
                    (entry.attachments && entry.attachments.length > 0)) && (
                    <div className="pt-2 border-t border-border/40">
                      <ExpenseAttachmentList
                        attachments={entry.attachment_details || []}
                        attachmentIds={entry.attachments || []}
                        onPreview={openPreview}
                        onDownload={downloadFile}
                      />
                    </div>
                  )}

                  {/* Running Balances Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-[11px]">
                    <div className="flex items-center gap-3 text-muted flex-wrap">
                      <span>
                        Advance Bal: <strong className="text-purple-600 dark:text-purple-400">{formatCurrency(entry.running_advance_balance)}</strong>
                      </span>
                      {entry.running_payment_entry !== undefined && entry.running_payment_entry > 0 && (
                        <span>
                          Payment Bal: <strong className="text-indigo-600 dark:text-indigo-400">{formatCurrency(entry.running_payment_entry)}</strong>
                        </span>
                      )}
                      <span>
                        Claims Rec: <strong className="text-sky-600 dark:text-sky-400">{formatCurrency(entry.running_claim_receivable)}</strong>
                      </span>
                      {isAdvanceRejected && (
                        <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                          (Advance Rejected — not added to advance in hand)
                        </span>
                      )}
                      {isExpenseSubmitted && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          (Pending Approval — not added to receivable balance yet)
                        </span>
                      )}
                      {isExpenseDraft && (
                        <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                          (Draft — unsubmitted, not added to receivable balance)
                        </span>
                      )}
                    </div>

                    <div className="font-semibold text-foreground flex items-center gap-1">
                      <span className="text-muted text-[10px] uppercase font-bold">Running Net:</span>
                      <span
                        className={`font-bold ${
                          entry.running_net_position > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : entry.running_net_position < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-foreground"
                        }`}
                      >
                        {formatCurrency(Math.abs(entry.running_net_position))}
                        {entry.running_net_position < 0
                          ? " (Due Co.)"
                          : entry.running_net_position > 0
                          ? " (Due Empl)"
                          : " (Balanced)"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <DownloadExpensesModal
        open={exportClaimsModalOpen}
        onClose={() => setExportClaimsModalOpen(false)}
        lockToUserId={userId}
        defaultTab="claims"
        title="Export My Expense Claims"
      />

      <SettlementVoucherModal
        settlementId={selectedVoucherId}
        open={Boolean(selectedVoucherId)}
        onClose={() => setSelectedVoucherId(null)}
        sessionToken={sessionToken}
      />

      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={downloadFile}
      />

      <RequestAdvanceModal
        open={requestAdvanceOpen}
        onClose={() => setRequestAdvanceOpen(false)}
        onSuccess={() => refetch()}
        sessionToken={sessionToken}
        currentUserId={userId}
        currentUserName={currentUserName}
        currentDepartment={currentDepartment}
      />
    </div>
  );
}

export default ExpensesPage;
