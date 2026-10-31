"use client";

import React, { useState, useMemo, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building,
  Scale,
  Receipt,
  Wallet,
  CreditCard,
  Plus,
  CheckCircle,
  FileCheck,
  Eye,
  FileSpreadsheet,
  Clock,
  AlertTriangle,
  FileText,
  DollarSign,
  Download,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetExecutivePassbookQuery,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
  useDisburseTourAdvanceMutation,
} from "@/store/api/expenseApiSlice";
import { useExpenseRole } from "@/context/ExpenseRoleContext";
import { formatCurrency, formatPlanDate, renderExpenseStatusBadge } from "@/components/expensePortal/shared/workPlanUtils";
import { resolvePublicAssetUrl, withFileAccessToken } from "@/lib/env";
import { readSessionFromStorage } from "@/utils/authStorage";
import { PaymentEntryModal } from "@/components/expensePortal/finance/settlements/PaymentEntryModal";
import { AdvanceFormModal } from "@/components/expensePortal/admin/advances/AdvanceFormModal";
import { AdvanceDisburseModal } from "@/components/expensePortal/finance/disbursements/AdvanceDisburseModal";
import { AdvanceRefundModal } from "@/components/expensePortal/finance/disbursements/AdvanceRefundModal";
import { SettleExpenseModal } from "@/components/expensePortal/finance/settlements/SettleExpenseModal";
import { SettlementVoucherModal } from "@/components/expensePortal/finance/settlements/SettlementVoucherModal";
import { FilePreviewModal } from "@/components/expensePortal/shared/FilePreviewModal";

export default function UserPassbookLedgerPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const resolvedParams = use(params);
  const userId = decodeURIComponent(resolvedParams.userId);

  const session = readSessionFromStorage();
  const sessionToken = session?.token;
  const { isCurrentAdminMode, isCurrentFinanceMode } = useExpenseRole();

  const [activeTab, setActiveTab] = useState<"passbook" | "claims" | "approved" | "advances" | "settlements">("passbook");
  const [claimStatusFilter, setClaimStatusFilter] = useState<string>("all");

  // Modals state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [disburseTarget, setDisburseTarget] = useState<any | null>(null);
  const [refundTarget, setRefundTarget] = useState<any | null>(null);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [voucherModalId, setVoucherModalId] = useState<string | null>(null);

  // File Preview
  const [previewDoc, setPreviewDoc] = useState<{ name: string; url: string; mime?: string } | null>(null);

  // Mutations
  const [approveExpense, { isLoading: isApproving }] = useApproveExpenseMutation();
  const [rejectExpense, { isLoading: isRejecting }] = useRejectExpenseMutation();

  const { data: dossierData, isLoading, refetch } = useGetExecutivePassbookQuery(
    { userId },
    { pollingInterval: 20000 }
  );

  const user = dossierData?.user;
  const summary = dossierData?.summary;
  const entries = dossierData?.entries || [];
  const claims = (dossierData as any)?.claims || [];
  const approvedClaims = (dossierData as any)?.approved_claims || [];
  const advances = (dossierData as any)?.advances || [];
  const settlements = (dossierData as any)?.settlements || [];

  const salesUserObj = useMemo(() => {
    if (!user) return null;
    return {
      _id: String(user._id || user.id),
      name: user.name || "Employee",
      email: user.email,
    };
  }, [user]);

  const userOptionsObj = useMemo(() => {
    if (!salesUserObj) return [];
    return [{ id: salesUserObj._id, name: salesUserObj.name, email: salesUserObj.email }];
  }, [salesUserObj]);

  const filteredClaims = useMemo(() => {
    const list = claimStatusFilter === "all" ? claims : claims.filter((c: any) => c.status === claimStatusFilter);
    return [...list].sort((a: any, b: any) => {
      const tA = new Date(a.expense_date || a.createdAt || 0).getTime();
      const tB = new Date(b.expense_date || b.createdAt || 0).getTime();
      return tB - tA;
    });
  }, [claims, claimStatusFilter]);

  async function handleApproveClaim(claimId: string) {
    try {
      await approveExpense({ expenseId: claimId }).unwrap();
      toast.success("Expense claim approved successfully");
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to approve claim");
    }
  }

  async function handleRejectClaim(claimId: string) {
    const reason = window.prompt("Enter reason for rejecting this claim:");
    if (!reason || !reason.trim()) return;
    try {
      await rejectExpense({ expenseId: claimId, rejection_reason: reason.trim() }).unwrap();
      toast.success("Expense claim rejected");
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to reject claim");
    }
  }

  const netBalance = summary?.net_balance ?? summary?.current_running_balance ?? 0;
  const isCompanyPayable = netBalance > 0;
  const isUserOwes = netBalance < 0;

  if (isLoading && !dossierData) {
    return (
      <div className="flex h-96 items-center justify-center font-sans text-sm text-muted">
        Loading employee financial dossier &amp; passbook...
      </div>
    );
  }

  if (!user && !isLoading) {
    return (
      <div className="space-y-4 font-sans p-6 text-center">
        <h2 className="text-lg font-bold text-foreground">User Not Found</h2>
        <p className="text-xs text-muted">Could not find financial dossier for user ID: {userId}</p>
        <Link
          href="/dashboard/ledgers"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Staff Running Balances</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans w-full max-w-full pb-10">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Link
            href="/dashboard/ledgers"
            className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Staff Running Balances</span>
          </Link>
          <span>/</span>
          <span className="font-bold text-foreground truncate max-w-[200px]">
            {user?.name || "Employee Passbook"}
          </span>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-surface-muted border border-border">
            Dossier &amp; Ledger
          </span>
        </div>

        {/* Role Pill Indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${isCurrentAdminMode
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800"
              : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800"
              }`}
          >
            {isCurrentAdminMode ? "Admin Governance Mode" : "Finance Treasury Desk"}
          </span>
        </div>
      </div>

      {/* Employee Profile Header & Quick Actions */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* User Bio */}
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-indigo-500/20 flex items-center justify-center border border-primary/20 text-primary font-black text-lg">
              {user?.name?.slice(0, 2).toUpperCase() || "WP"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-foreground">{user?.name}</h1>
                <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted border border-border">
                  {user?.department || "Field Staff"}
                </span>
                <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[10px] font-bold uppercase border border-primary/20">
                  {user?.wp_role || "Executive"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                {user?.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{user.email}</span>
                  </span>
                )}
                {user?.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{user.phone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons (Admin vs Finance) */}
          <div className="flex items-center gap-2 flex-wrap">
            {isCurrentAdminMode && (
              <>
                <button
                  type="button"
                  onClick={() => setAdvanceModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover active:scale-95 transition shadow-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Sanction Advance</span>
                </button>

                {approvedClaims.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSettleModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition shadow-xs cursor-pointer"
                  >
                    <FileCheck className="h-4 w-4" />
                    <span>Settle Claims ({approvedClaims.length})</span>
                  </button>
                )}
              </>
            )}

            {isCurrentFinanceMode && (
              <>
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 active:scale-95 transition shadow-xs cursor-pointer"
                  title="Record direct payment or disbursement entry to this employee"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Payment Entry</span>
                </button>

                {approvedClaims.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSettleModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition shadow-xs cursor-pointer"
                  >
                    <FileCheck className="h-4 w-4" />
                    <span>Settle Claims ({approvedClaims.length})</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-border">
          {/* Net Running Position */}
          <div className="rounded-xl border border-border bg-surface-muted/40 p-3 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Net Running Position
            </span>
            <div
              className={`text-lg font-black mt-0.5 ${isCompanyPayable
                ? "text-emerald-600 dark:text-emerald-400"
                : isUserOwes
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-foreground"
                }`}
            >
              {formatCurrency(Math.abs(netBalance))}
            </div>
            <span
              className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${isCompanyPayable
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : isUserOwes
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  : "bg-surface-muted text-muted"
                }`}
            >
              {summary?.position || "Balanced"}
            </span>
          </div>

          {/* Advances Received */}
          <div className="rounded-xl border border-border bg-surface-muted/40 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Advances Received
            </span>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5">
              {formatCurrency(summary?.total_advances_received ?? 0)}
            </div>
            <div className="text-[10px] text-muted flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
              <span>In Hand: <strong className="text-foreground">{formatCurrency(summary?.active_advance_balance ?? 0)}</strong></span>
              {Number(summary?.total_advances_refunded || 0) > 0 && (
                <span className="text-teal-600 dark:text-teal-400 font-semibold">
                  • Refunded: {formatCurrency(summary?.total_advances_refunded)}
                </span>
              )}
            </div>
          </div>

          {/* Approved Claims Total */}
          <div className="rounded-xl border border-border bg-surface-muted/40 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Approved Claims
            </span>
            <div className="text-lg font-bold text-sky-600 dark:text-sky-400 mt-0.5">
              {formatCurrency(summary?.total_claims_approved_amount ?? 0)}
            </div>
            <span className="text-[10px] text-muted block mt-1">
              {summary?.total_claims_approved_count ?? approvedClaims.length} Claims Verified
            </span>
          </div>

          {/* Total Claims Submitted */}
          <div className="rounded-xl border border-border bg-surface-muted/40 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Submitted Claims
            </span>
            <div className="text-lg font-bold text-foreground mt-0.5">
              {formatCurrency(summary?.total_claims_submitted_amount ?? 0)}
            </div>
            <span className="text-[10px] text-muted block mt-1">
              {summary?.total_claims_submitted_count ?? claims.length} Total Claims
            </span>
          </div>

          {/* Unsettled Approved Amount */}
          <div className="rounded-xl border border-border bg-surface-muted/40 p-3 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Unsettled Payable
            </span>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {formatCurrency(summary?.unsettled_approved_amount ?? 0)}
            </div>
            <div className="text-[10px] text-muted flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
              <span>Settled: <strong className="text-foreground">{formatCurrency(summary?.total_settled_amount ?? 0)}</strong></span>
              {Number(summary?.total_payment_entries_amount || 0) > 0 && (
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  • Paid Out: {formatCurrency(summary?.total_payment_entries_amount)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1.5 overflow-x-auto scrollbar-none shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab("passbook")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${activeTab === "passbook"
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
        >
          <Scale className="h-4 w-4" />
          <span>Passbook Ledger ({entries.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("claims")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${activeTab === "claims"
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
        >
          <Receipt className="h-4 w-4" />
          <span>All Claims ({claims.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("approved")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${activeTab === "approved"
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
        >
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <span>Approved Claims ({approvedClaims.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("advances")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${activeTab === "advances"
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
        >
          <Wallet className="h-4 w-4" />
          <span>Received Advances ({advances.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settlements")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap active:scale-95 transition cursor-pointer ${activeTab === "settlements"
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Settlements &amp; Payments ({settlements.length})</span>
        </button>
      </div>

      {/* ================= TAB 1: PASSBOOK LEDGER ================= */}
      {activeTab === "passbook" && (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border bg-surface-muted/30 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Chronological Passbook Timeline</h2>
              <p className="text-[11px] text-muted">
                Every advance disbursed, claim approved, offset executed, and direct payment entry.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-primary">
              Running Balance: {formatCurrency(netBalance)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted">
              <thead className="border-b border-border bg-surface-muted/60 text-[11px] font-semibold uppercase text-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Reference #</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Method / Ref</th>
                  <th className="px-4 py-3 text-right">Debit (Adv/Paid)</th>
                  <th className="px-4 py-3 text-right">Credit (Claim/Refund)</th>
                  <th className="px-4 py-3 text-right">Net Balance</th>
                  <th className="px-4 py-3 text-right">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted text-xs">
                      No ledger transactions found in this employee&apos;s passbook yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((item: any, idx: number) => {
                    const isDebit = item.debit > 0;
                    const isCredit = item.credit > 0;
                    const approver = item.approved_by || item.settled_by || item.disbursed_by || item.refunded_by;

                    return (
                      <tr key={item.id || idx} className="hover:bg-surface-muted/30 transition">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                          {formatPlanDate(item.date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${item.type === "ADVANCE_DISBURSED"
                              ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                              : item.type === "ADVANCE_REFUND"
                                ? "bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20"
                                : item.type === "EXPENSE_APPROVED"
                                  ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20"
                                  : item.type === "SETTLEMENT_ADVANCE_OFFSET"
                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                                    : item.type === "PAYMENT_ENTRY"
                                      ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20"
                                      : item.type === "SETTLEMENT_DIRECT_PAYOUT"
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                        : "bg-surface-muted text-muted"
                              }`}
                          >
                            {item.type === "ADVANCE_REFUND" ? "Advance Refund" : item.type === "PAYMENT_ENTRY" ? "Payment Entry" : item.category || item.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] font-bold text-foreground whitespace-nowrap">
                          {item.reference_number || "—"}
                        </td>
                        <td className="px-4 py-3 max-w-xs text-foreground font-medium truncate">
                          {item.description || "—"}
                        </td>
                        <td className="px-4 py-3 text-[11px] whitespace-nowrap">
                          {item.payment_method || "—"}
                          {item.transaction_reference && (
                            <span className="block text-[10px] text-muted font-mono">
                              {item.transaction_reference}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                          {isDebit ? formatCurrency(item.debit) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                          {isCredit ? formatCurrency(item.credit) : "—"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-black whitespace-nowrap ${item.running_balance > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : item.running_balance < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-foreground"
                            }`}
                        >
                          {formatCurrency(Math.abs(item.running_balance))}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {approver ? (
                            <span className="text-xs font-semibold text-foreground">
                              {typeof approver === "object" ? approver.name || approver.email : approver}
                            </span>
                          ) : (
                            <span className="text-muted text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: ALL CLAIMS ================= */}
      {activeTab === "claims" && (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden space-y-3">
          <div className="p-4 border-b border-border bg-surface-muted/30 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">Submitted Expense Claims</h2>
              <p className="text-[11px] text-muted">
                All daily travel, visit, food, and lodging expenses filed by {user?.name}.
              </p>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted" />
              <select
                value={claimStatusFilter}
                onChange={(e) => setClaimStatusFilter(e.target.value)}
                className="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none transition"
              >
                <option value="all">All Statuses ({claims.length})</option>
                <option value="submitted">Submitted / Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted">
              <thead className="border-b border-border bg-surface-muted/60 text-[11px] font-semibold uppercase text-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description / Breakdown</th>
                  <th className="px-4 py-3">Receipts</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Approved By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredClaims.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-muted">
                      No claims found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredClaims.map((claim: any) => {
                    const claimId = claim._id || claim.id;
                    const canApprove = isCurrentAdminMode && claim.status === "submitted";

                    return (
                      <tr key={claimId} className="hover:bg-surface-muted/30 transition">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                          {formatPlanDate(claim.expense_date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-foreground block">{claim.category}</span>
                          {claim.sub_category && (
                            <span className="text-[10px] text-muted block">{claim.sub_category}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-xs text-foreground font-medium truncate">
                          {claim.description || "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {claim.receipt_attachment ? (
                            <button
                              type="button"
                              onClick={() => {
                                const url = typeof claim.receipt_attachment === "string"
                                  ? claim.receipt_attachment
                                  : claim.receipt_attachment.url;
                                const mime = typeof claim.receipt_attachment === "string" ? undefined : claim.receipt_attachment.mime_type;
                                setPreviewDoc({
                                  name: `Receipt-${claim.category}`,
                                  url: withFileAccessToken(resolvePublicAssetUrl(url), sessionToken),
                                  mime,
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded bg-surface-muted border border-border px-2 py-1 text-[11px] text-foreground hover:border-primary/40 transition cursor-pointer"
                            >
                              <Eye className="h-3 w-3 text-primary" />
                              <span>View Receipt</span>
                            </button>
                          ) : (
                            <span className="text-muted text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground whitespace-nowrap">
                          {formatCurrency(claim.amount)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {renderExpenseStatusBadge(claim.status)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {claim.approved_by ? (
                            <div>
                              <span className="font-semibold text-foreground block">
                                {typeof claim.approved_by === "object"
                                  ? claim.approved_by.name || claim.approved_by.email
                                  : claim.approved_by}
                              </span>
                              {claim.approved_at && (
                                <span className="text-[10px] text-muted block">
                                  {formatPlanDate(claim.approved_at)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {canApprove && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={isApproving}
                                onClick={() => handleApproveClaim(claimId)}
                                className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={isRejecting}
                                onClick={() => handleRejectClaim(claimId)}
                                className="rounded bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-500 hover:bg-rose-500/20 transition cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: APPROVED CLAIMS ================= */}
      {activeTab === "approved" && (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border bg-surface-muted/30 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Approved Claims (Audit &amp; Settlement Queue)</h2>
              <p className="text-[11px] text-muted">
                Sanctioned claims that have been verified by Admin and are ready for settlement.
              </p>
            </div>
            {approvedClaims.length > 0 && (
              <button
                type="button"
                onClick={() => setSettleModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
              >
                <FileCheck className="h-4 w-4" />
                <span>Process Settlement</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted">
              <thead className="border-b border-border bg-surface-muted/60 text-[11px] font-semibold uppercase text-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3 text-right">Approved Amount</th>
                  <th className="px-4 py-3 text-right">Settled Amount</th>
                  <th className="px-4 py-3 text-right">Unsettled Balance</th>
                  <th className="px-4 py-3">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {approvedClaims.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-muted">
                      No approved claims pending for this employee.
                    </td>
                  </tr>
                ) : (
                  approvedClaims.map((claim: any) => {
                    const claimId = claim._id || claim.id;
                    const unsettledAmt = Math.max(0, (claim.amount || 0) - (claim.settled_amount || 0));

                    return (
                      <tr key={claimId} className="hover:bg-surface-muted/30 transition">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                          {formatPlanDate(claim.expense_date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-foreground">
                          {claim.category}
                        </td>
                        <td className="px-4 py-3 max-w-xs text-foreground font-medium truncate">
                          {claim.description || "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {claim.receipt_attachment ? (
                            <button
                              type="button"
                              onClick={() => {
                                const url = typeof claim.receipt_attachment === "string"
                                  ? claim.receipt_attachment
                                  : claim.receipt_attachment.url;
                                setPreviewDoc({
                                  name: `Receipt-${claim.category}`,
                                  url: withFileAccessToken(resolvePublicAssetUrl(url), sessionToken),
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded bg-surface-muted border border-border px-2 py-1 text-[11px] text-foreground hover:border-primary/40 transition cursor-pointer"
                            >
                              <Eye className="h-3 w-3 text-primary" />
                              <span>Receipt</span>
                            </button>
                          ) : (
                            <span className="text-muted text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground whitespace-nowrap">
                          {formatCurrency(claim.amount)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-muted whitespace-nowrap">
                          {formatCurrency(claim.settled_amount || 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {formatCurrency(unsettledAmt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-foreground block">
                            {typeof claim.approved_by === "object"
                              ? claim.approved_by.name || claim.approved_by.email
                              : claim.approved_by || "Admin"}
                          </span>
                          {claim.approved_at && (
                            <span className="text-[10px] text-muted block">
                              {formatPlanDate(claim.approved_at)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4: RECEIVED ADVANCES ================= */}
      {activeTab === "advances" && (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border bg-surface-muted/30 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Tour &amp; Cash Advances</h2>
              <p className="text-[11px] text-muted">
                Advances sanctioned by Admin and disbursed by Finance for this employee.
              </p>
            </div>
            {isCurrentAdminMode && (
              <button
                type="button"
                onClick={() => setAdvanceModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Sanction Advance</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted">
              <thead className="border-b border-border bg-surface-muted/60 text-[11px] font-semibold uppercase text-foreground">
                <tr>
                  <th className="px-4 py-3">Adv Number</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3 text-right">Sanction Amount</th>
                  <th className="px-4 py-3 text-right">Disbursed Amount</th>
                  <th className="px-4 py-3 text-right">Refunded</th>
                  <th className="px-4 py-3 text-right">In Hand Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Approved By</th>
                  <th className="px-4 py-3">Disbursed By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {advances.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-muted">
                      No advances recorded for this employee.
                    </td>
                  </tr>
                ) : (
                  advances.map((adv: any) => {
                    const advId = adv._id || adv.id;
                    const canDisburse = isCurrentFinanceMode && adv.status === "approved";
                    const inHand = adv.remaining_balance != null ? adv.remaining_balance : adv.disbursed_amount || 0;
                    const canRefund = isCurrentFinanceMode && (adv.status === "disbursed" || adv.status === "recovered") && inHand > 0;

                    return (
                      <tr key={advId} className="hover:bg-surface-muted/30 transition">
                        <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">
                          {adv.advance_number}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                          {formatPlanDate(adv.request_date)}
                        </td>
                        <td className="px-4 py-3 max-w-xs text-foreground font-medium truncate">
                          {adv.purpose || "Tour Advance"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground whitespace-nowrap">
                          {formatCurrency(adv.amount)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                          {adv.disbursed_amount ? formatCurrency(adv.disbursed_amount) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                          {adv.refunded_amount ? formatCurrency(adv.refunded_amount) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {adv.status === "disbursed" ? formatCurrency(inHand) : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${adv.status === "disbursed"
                              ? "bg-purple-500/10 text-purple-700 dark:text-purple-300"
                              : adv.status === "approved"
                                ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                : adv.status === "refunded"
                                  ? "bg-teal-500/10 text-teal-700 dark:text-teal-300"
                                  : adv.status === "settled"
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              }`}
                          >
                            {adv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {adv.approved_by ? (
                            <span className="font-semibold text-foreground">
                              {typeof adv.approved_by === "object"
                                ? adv.approved_by.name || adv.approved_by.email
                                : adv.approved_by}
                            </span>
                          ) : (
                            <span className="text-muted text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {adv.disbursed_by ? (
                            <span className="font-semibold text-foreground">
                              {typeof adv.disbursed_by === "object"
                                ? adv.disbursed_by.name || adv.disbursed_by.email
                                : adv.disbursed_by}
                            </span>
                          ) : (
                            <span className="text-muted text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {canDisburse && (
                              <button
                                type="button"
                                onClick={() => setDisburseTarget(adv)}
                                className="rounded bg-purple-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-purple-700 transition cursor-pointer"
                              >
                                Disburse
                              </button>
                            )}
                            {canRefund && (
                              <button
                                type="button"
                                onClick={() => setRefundTarget(adv)}
                                className="rounded bg-teal-600/10 border border-teal-600/20 px-2.5 py-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-600/20 transition cursor-pointer"
                              >
                                Refund
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 5: SETTLEMENTS & PAYOUTS ================= */}
      {activeTab === "settlements" && (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border bg-surface-muted/30 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Settlement Vouchers &amp; Direct Payouts</h2>
              <p className="text-[11px] text-muted">
                Official Treasury vouchers executed for advance adjustments and reimbursements.
              </p>
            </div>
            {isCurrentFinanceMode && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>+ Payment Entry</span>
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted">
              <thead className="border-b border-border bg-surface-muted/60 text-[11px] font-semibold uppercase text-foreground">
                <tr>
                  <th className="px-4 py-3">Voucher #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3 text-right">Claim Settle Total</th>
                  <th className="px-4 py-3 text-right">Advance Offset</th>
                  <th className="px-4 py-3 text-right">Treasury Payment</th>
                  <th className="px-4 py-3">Method / Ref</th>
                  <th className="px-4 py-3">Settled By</th>
                  <th className="px-4 py-3 text-right">Voucher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {settlements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-muted">
                      No settlements or payments processed for this employee yet.
                    </td>
                  </tr>
                ) : (
                  settlements.map((set: any) => {
                    const setId = set._id || set.id;

                    return (
                      <tr key={setId} className="hover:bg-surface-muted/30 transition">
                        <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">
                          {set.settlement_number}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                          {formatPlanDate(set.settlement_date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap capitalize">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              set.settlement_mode === "payment_entry"
                                ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20"
                                : "bg-surface-muted border border-border"
                            }`}
                          >
                            {set.settlement_mode === "payment_entry"
                              ? "Payment Entry"
                              : set.settlement_mode?.replace(/_/g, " ") || "Settlement"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground whitespace-nowrap">
                          {set.settlement_mode === "payment_entry"
                            ? "—"
                            : formatCurrency(set.total_claim_amount || 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                          {set.advance_deduction_amount ? formatCurrency(set.advance_deduction_amount) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {set.direct_payment_amount ? formatCurrency(set.direct_payment_amount) : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-foreground block">
                            {set.payment_method || "—"}
                          </span>
                          {set.transaction_reference && (
                            <span className="text-[10px] text-muted font-mono block">
                              {set.transaction_reference}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-foreground">
                          {typeof set.settled_by === "object"
                            ? set.settled_by.name || set.settled_by.email
                            : set.settled_by || "Finance"}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setVoucherModalId(setId)}
                            className="inline-flex items-center gap-1 rounded bg-surface-muted border border-border px-2.5 py-1 text-[11px] font-bold text-foreground hover:border-primary/40 transition cursor-pointer"
                          >
                            <FileText className="h-3.5 w-3.5 text-primary" />
                            <span>Voucher</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* 1. Direct Payment Entry Modal */}
      {paymentModalOpen && salesUserObj && (
        <PaymentEntryModal
          open={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          user={salesUserObj}
          userOptions={userOptionsObj}
          onSuccess={() => refetch()}
        />
      )}

      {/* 2. Sanction / Direct Advance Modal */}
      {advanceModalOpen && salesUserObj && (
        <AdvanceFormModal
          open={advanceModalOpen}
          initialMode="direct_issue"
          isAdmin={true}
          isElevated={true}
          preselectedUserId={salesUserObj._id}
          executiveOptions={userOptionsObj}
          sessionToken={sessionToken}
          currentUserId={session?.user?._id || session?.user?.id}
          currentUserName={session?.user?.name}
          onClose={() => setAdvanceModalOpen(false)}
          onSuccess={() => {
            refetch();
            setAdvanceModalOpen(false);
          }}
        />
      )}

      {/* 3. Advance Disburse Modal */}
      {disburseTarget && (
        <AdvanceDisburseModal
          open={!!disburseTarget}
          advance={disburseTarget}
          onClose={() => setDisburseTarget(null)}
          onSuccess={() => {
            refetch();
            setDisburseTarget(null);
          }}
        />
      )}

      {/* 4. Advance Refund Modal */}
      {refundTarget && (
        <AdvanceRefundModal
          open={!!refundTarget}
          advance={refundTarget}
          sessionToken={sessionToken}
          onClose={() => setRefundTarget(null)}
          onSuccess={() => {
            refetch();
            setRefundTarget(null);
          }}
        />
      )}

      {/* 4. Settle Claims Modal */}
      {settleModalOpen && salesUserObj && (
        <SettleExpenseModal
          open={settleModalOpen}
          salesUser={salesUserObj}
          userOptions={userOptionsObj}
          sessionToken={sessionToken}
          onClose={() => setSettleModalOpen(false)}
          onSuccess={() => {
            refetch();
            setSettleModalOpen(false);
          }}
        />
      )}

      {/* 5. Settlement Voucher Modal */}
      {voucherModalId && (
        <SettlementVoucherModal
          open={!!voucherModalId}
          settlementId={voucherModalId}
          onClose={() => setVoucherModalId(null)}
        />
      )}

      {/* 6. File Preview Modal */}
      {previewDoc && (
        <FilePreviewModal
          doc={previewDoc}
          blobUrl={previewDoc.url}
          loading={false}
          onClose={() => setPreviewDoc(null)}
          onDownload={() => window.open(previewDoc.url, "_blank")}
        />
      )}
    </div>
  );
}
