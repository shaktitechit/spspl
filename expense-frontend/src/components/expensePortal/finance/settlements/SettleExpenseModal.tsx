"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  CheckCircle2,
  DollarSign,
  CreditCard,
  Building2,
  AlertCircle,
  FileCheck,
  ChevronRight,
  Calculator,
  ShieldCheck,
  Paperclip,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCreateExpenseSettlementMutation,
  useGetActiveTourAdvancesQuery,
  useGetActivePaymentEntriesQuery,
  useGetExpensesQuery,
} from "@/store/api/expenseApiSlice";
import { formatCurrency, formatPlanDate, EXPENSE_CATEGORY_LABELS } from "@/components/expensePortal/shared/workPlanUtils";
import { ExpenseAttachmentUploader } from "@/components/expensePortal/shared/ExpenseAttachmentUploader";
import { FilePreviewModal, useFilePreview } from "@/components/expensePortal/shared/FilePreviewModal";
import type { WorkPlanExpenseRecord, WorkPlanTourAdvanceRecord, ExpenseAttachmentItem } from "@/types/workPlanner";

interface SettleExpenseModalProps {
  salesUser?: { _id: string; name: string; email?: string } | null;
  userOptions?: Array<{ id: string; name: string; email?: string }>;
  initialSelectedExpenseIds?: string[];
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sessionToken?: string | null;
}

export function SettleExpenseModal({
  salesUser,
  userOptions = [],
  initialSelectedExpenseIds = [],
  open,
  onClose,
  onSuccess,
  sessionToken,
}: SettleExpenseModalProps) {
  const [createExpenseSettlement, { isLoading }] = useCreateExpenseSettlementMutation();

  const [selectedUserId, setSelectedUserId] = useState<string>(salesUser?._id || "");
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [advanceDeductions, setAdvanceDeductions] = useState<Record<string, number>>({});
  const [paymentEntryDeductions, setPaymentEntryDeductions] = useState<Record<string, number>>({});
  const [directPaymentAmount, setDirectPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [settlementNotes, setSettlementNotes] = useState<string>("");
  const [settlementDate, setSettlementDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [attachments, setAttachments] = useState<ExpenseAttachmentItem[]>([]);

  const prevOpenRef = React.useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (salesUser?._id) {
        setSelectedUserId(salesUser._id);
      } else if (userOptions.length > 0) {
        setSelectedUserId(userOptions[0].id);
      } else {
        setSelectedUserId("");
      }
      setSelectedClaimIds(initialSelectedExpenseIds || []);
      setAdvanceDeductions({});
      setPaymentEntryDeductions({});
      setDirectPaymentAmount(0);
      setTransactionRef("");
      setBankName("");
      setSettlementNotes("");
      setSettlementDate(new Date().toISOString().slice(0, 10));
      setAttachments([]);
    }
    prevOpenRef.current = open;
  }, [open, salesUser?._id, initialSelectedExpenseIds]);

  const activeUser = useMemo(() => {
    if (selectedUserId && userOptions.length > 0) {
      const match = userOptions.find((u) => u.id === selectedUserId);
      if (match) return { _id: match.id, name: match.name, email: match.email };
    }
    return salesUser || null;
  }, [selectedUserId, userOptions, salesUser]);

  const userId = activeUser?._id || selectedUserId || "";

  // Fetch approved & unsettled expenses for this user
  const { data: expensesRes, isLoading: loadingExpenses } = useGetExpensesQuery(
    {
      scope: "all",
      user_id: userId,
      status: "approved",
      limit: 100,
    },
    { skip: !open || !userId }
  );

  // Fetch active advances for this user
  const { data: activeAdvancesRes, isLoading: loadingAdvances } = useGetActiveTourAdvancesQuery(
    { userId },
    { skip: !open || !userId }
  );

  // Fetch active unadjusted payment entries for this user
  const { data: activePaymentsRes, isLoading: loadingPayments } = useGetActivePaymentEntriesQuery(
    { userId },
    { skip: !open || !userId }
  );

  const availableClaims: WorkPlanExpenseRecord[] = useMemo(() => {
    const list = expensesRes?.data || [];
    return list.filter((e) => (e.settlement_status || "unsettled") !== "settled");
  }, [expensesRes]);

  const activeAdvances: WorkPlanTourAdvanceRecord[] = useMemo(() => {
    if (Array.isArray(activeAdvancesRes)) return activeAdvancesRes;
    return (activeAdvancesRes as any)?.data || [];
  }, [activeAdvancesRes]);

  const activePayments: any[] = useMemo(() => {
    if (Array.isArray(activePaymentsRes)) return activePaymentsRes;
    return (activePaymentsRes as any)?.data || [];
  }, [activePaymentsRes]);

  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  } = useFilePreview(sessionToken);

  // Initialize selected claims when claims arrive
  useEffect(() => {
    if (open && availableClaims.length > 0 && selectedClaimIds.length === 0) {
      if (initialSelectedExpenseIds && initialSelectedExpenseIds.length > 0) {
        setSelectedClaimIds(initialSelectedExpenseIds);
      } else {
        setSelectedClaimIds(availableClaims.map((c) => c._id || c.id || ""));
      }
    }
  }, [open, initialSelectedExpenseIds, availableClaims, selectedClaimIds.length]);

  // Calculate totals
  const totalClaimAmount = useMemo(() => {
    return availableClaims
      .filter((c) => selectedClaimIds.includes(c._id || c.id || ""))
      .reduce((sum, c) => {
        const amt = c.amount || 0;
        const settledAmt = c.settled_amount || 0;
        return sum + Math.max(0, amt - settledAmt);
      }, 0);
  }, [availableClaims, selectedClaimIds]);

  const totalAdvanceDeduction = useMemo(() => {
    return Object.values(advanceDeductions).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [advanceDeductions]);

  const totalPaymentEntryDeduction = useMemo(() => {
    return Object.values(paymentEntryDeductions).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [paymentEntryDeductions]);

  // Auto-allocate advance & payment entry deductions when claim amount changes or auto button clicked
  function autoAllocate() {
    let remainingToCover = totalClaimAmount;
    const newAdvDeductions: Record<string, number> = {};
    const newPayDeductions: Record<string, number> = {};

    // 1. First allocate against available tour advances
    for (const adv of activeAdvances) {
      const advId = adv._id || adv.id || "";
      const advAvail = adv.remaining_balance ?? (adv.disbursed_amount ?? adv.amount);
      if (remainingToCover > 0 && advAvail > 0) {
        const deduct = Math.min(remainingToCover, advAvail);
        newAdvDeductions[advId] = deduct;
        remainingToCover -= deduct;
      } else {
        newAdvDeductions[advId] = 0;
      }
    }

    // 2. Next allocate against unadjusted direct payment entries
    for (const pay of activePayments) {
      const payId = pay._id || pay.id || "";
      const payAvail = pay.remaining_balance ?? Math.max(0, (pay.direct_payment_amount || 0) - (pay.settled_amount || 0));
      if (remainingToCover > 0 && payAvail > 0) {
        const deduct = Math.min(remainingToCover, payAvail);
        newPayDeductions[payId] = deduct;
        remainingToCover -= deduct;
      } else {
        newPayDeductions[payId] = 0;
      }
    }

    setAdvanceDeductions(newAdvDeductions);
    setPaymentEntryDeductions(newPayDeductions);
    setDirectPaymentAmount(Math.max(0, remainingToCover));
  }

  // Auto update direct payment if total claim changes and total deductions change
  useEffect(() => {
    const net = Math.max(0, totalClaimAmount - totalAdvanceDeduction - totalPaymentEntryDeduction);
    setDirectPaymentAmount(net);
  }, [totalClaimAmount, totalAdvanceDeduction, totalPaymentEntryDeduction]);

  function toggleClaimSelection(claimId: string) {
    setSelectedClaimIds((prev) =>
      prev.includes(claimId) ? prev.filter((id) => id !== claimId) : [...prev, claimId]
    );
  }

  function handleToggleAllClaims() {
    if (selectedClaimIds.length === availableClaims.length) {
      setSelectedClaimIds([]);
    } else {
      setSelectedClaimIds(availableClaims.map((c) => c._id || c.id || ""));
    }
  }

  function handleDeductionChange(advId: string, maxVal: number, valStr: string) {
    const num = Math.min(maxVal, Math.max(0, parseFloat(valStr) || 0));
    setAdvanceDeductions((prev) => ({
      ...prev,
      [advId]: num,
    }));
  }

  function handlePaymentDeductionChange(payId: string, maxVal: number, valStr: string) {
    const num = Math.min(maxVal, Math.max(0, parseFloat(valStr) || 0));
    setPaymentEntryDeductions((prev) => ({
      ...prev,
      [payId]: num,
    }));
  }

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!userId) {
      toast.error("Please select an employee for this settlement.");
      return;
    }

    if (selectedClaimIds.length === 0) {
      toast.error("Please select at least one approved claim to settle.");
      return;
    }

    if (totalAdvanceDeduction + totalPaymentEntryDeduction + directPaymentAmount < totalClaimAmount) {
      toast.error("Funding allocation must cover the total selected claims.");
      return;
    }

    const advancesPayload = Object.entries(advanceDeductions)
      .filter(([_, amt]) => amt > 0)
      .map(([advId, amt]) => ({
        advance: advId,
        advance_id: advId,
        deducted_amount: amt,
      }));

    const paymentEntriesPayload = Object.entries(paymentEntryDeductions)
      .filter(([_, amt]) => amt > 0)
      .map(([payId, amt]) => ({
        payment_entry: payId,
        payment_id: payId,
        deducted_amount: amt,
      }));

    const claimsPayload = selectedClaimIds.map((id) => {
      const c = availableClaims.find((item) => (item._id || item.id) === id);
      const amt = c ? Math.max(0, (c.amount || 0) - (c.settled_amount || 0)) : 0;
      return { expense: id, amount: amt };
    });

    try {
      await createExpenseSettlement({
        sales_user: userId,
        settlement_date: settlementDate,
        claims: claimsPayload,
        expense_ids: selectedClaimIds,
        advances: advancesPayload,
        advance_deduction_amount: totalAdvanceDeduction,
        payment_entries: paymentEntriesPayload,
        payment_entry_deduction_amount: totalPaymentEntryDeduction,
        direct_payment_amount: directPaymentAmount,
        payment_method: directPaymentAmount > 0 ? paymentMethod : undefined,
        transaction_reference: transactionRef.trim() || undefined,
        bank_name: bankName.trim() || undefined,
        settlement_notes: settlementNotes.trim() || undefined,
        attachments: attachments.map((a) => a.attachment_id || a._id).filter(Boolean) as string[],
        attachment_details: attachments,
      }).unwrap();

      toast.success("Expense settlement voucher generated successfully!");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to process settlement";
      toast.error(msg);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-sky-500/10">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-sky-600 p-2 text-white">
                <FileCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Settle Approved Expense Claims</h2>
                <p className="text-xs text-muted">
                  Beneficiary: <span className="font-semibold text-foreground">{activeUser?.name || "Select Employee"}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Employee Selector if multiple options */}
            {userOptions.length > 0 && (
              <div className="rounded-xl border border-border bg-surface-muted/40 p-3 space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>Select Employee for Settlement *</span>
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setSelectedClaimIds([]);
                    setAdvanceDeductions({});
                    setDirectPaymentAmount(0);
                  }}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary transition"
                >
                  <option value="" disabled>Select Employee...</option>
                  {userOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Section 1: Claims to Settle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    1. Select Approved Claims to Settle ({selectedClaimIds.length} / {availableClaims.length})
                  </span>
                  {availableClaims.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleAllClaims}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      {selectedClaimIds.length === availableClaims.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                </div>
                <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                  Total Claims: {formatCurrency(totalClaimAmount)}
                </span>
              </div>

              {loadingExpenses ? (
                <div className="p-4 text-center text-xs text-muted">Loading approved claims…</div>
              ) : availableClaims.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted">
                  No approved unsettled claims found for {activeUser?.name || "this employee"}.
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border bg-surface-muted/30">
                  {availableClaims.map((claim) => {
                    const claimId = claim._id || claim.id || "";
                    const isChecked = selectedClaimIds.includes(claimId);
                    const netClaimAmt = (claim.amount || 0) - (claim.settled_amount || 0);

                    return (
                      <label
                        key={claimId}
                        className="flex items-center justify-between p-2.5 hover:bg-surface-muted/60 transition cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleClaimSelection(claimId)}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                          />
                          <div>
                            <div className="font-semibold text-foreground">
                              {EXPENSE_CATEGORY_LABELS[claim.category] || claim.category}
                              {claim.sub_category ? ` • ${claim.sub_category}` : ""}
                            </div>
                            <div className="text-[11px] text-muted">
                              {formatPlanDate(claim.expense_date)} • {claim.description || "Field visit expense"}
                            </div>
                          </div>
                        </div>
                        <div className="font-bold text-foreground">{formatCurrency(netClaimAmt)}</div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 2: Settlement Payment & Deduction Breakdown */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  2. Settlement Funding & Deduction Allocation
                </span>
                <button
                  type="button"
                  onClick={autoAllocate}
                  disabled={availableClaims.length === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition cursor-pointer disabled:opacity-50"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  <span>Auto Allocate</span>
                </button>
              </div>

              {/* Advance Deductions */}
              {activeAdvances.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-border bg-purple-500/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                      Deduct from Available Tour Advances:
                    </span>
                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                      Offset: {formatCurrency(totalAdvanceDeduction)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {activeAdvances.map((adv) => {
                      const advId = adv._id || adv.id || "";
                      const avail = adv.remaining_balance ?? (adv.disbursed_amount ?? adv.amount);
                      const currentDeduction = advanceDeductions[advId] || 0;

                      return (
                        <div
                          key={advId}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5 text-xs"
                        >
                          <div>
                            <div className="font-mono font-bold text-foreground">{adv.advance_number}</div>
                            <div className="text-[11px] text-muted">
                              {adv.purpose} • Available:{" "}
                              <span className="font-bold text-purple-600 dark:text-purple-400">
                                {formatCurrency(avail)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted">Deduct:</span>
                            <div className="relative w-28">
                              <span className="absolute left-2.5 top-1.5 text-xs text-muted">₹</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={avail}
                                value={currentDeduction === 0 ? "" : currentDeduction}
                                placeholder="0"
                                onChange={(e) => handleDeductionChange(advId, avail, e.target.value)}
                                className="w-full rounded-md border border-border bg-surface-muted pl-6 pr-2 py-1 text-xs font-semibold text-foreground outline-none focus:border-primary"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-surface-muted/30 p-2.5 text-xs text-muted">
                  No active tour advances with remaining balance available for deduction.
                </div>
              )}

              {/* Direct Payment Entry Deductions */}
              {activePayments.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-border bg-indigo-500/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Deduct from Available Direct Payment Entries:</span>
                    </span>
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      Offset: {formatCurrency(totalPaymentEntryDeduction)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {activePayments.map((pay: any) => {
                      const payId = pay._id || pay.id || "";
                      const avail = pay.remaining_balance ?? Math.max(0, (pay.direct_payment_amount || 0) - (pay.settled_amount || 0));
                      const currentDeduction = paymentEntryDeductions[payId] || 0;

                      return (
                        <div
                          key={payId}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-foreground">{pay.settlement_number}</span>
                              <span className="rounded bg-indigo-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-600">
                                {formatPlanDate(pay.settlement_date)}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted">
                              {pay.payment_method || "Payment"} {pay.transaction_reference ? `• Ref: ${pay.transaction_reference}` : ""} • Available:{" "}
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                {formatCurrency(avail)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted">Deduct:</span>
                            <div className="relative w-28">
                              <span className="absolute left-2.5 top-1.5 text-xs text-muted">₹</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={avail}
                                value={currentDeduction === 0 ? "" : currentDeduction}
                                placeholder="0"
                                onChange={(e) => handlePaymentDeductionChange(payId, avail, e.target.value)}
                                className="w-full rounded-md border border-border bg-surface-muted pl-6 pr-2 py-1 text-xs font-semibold text-foreground outline-none focus:border-primary"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Treasury Payment Payout */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    Treasury Payment (Net Direct Bank / Cash Payout):
                  </span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(directPaymentAmount)}
                  </span>
                </div>

                {directPaymentAmount > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted mb-1">
                        Payment Mode <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full rounded-xl border border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                      >
                        <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                        <option value="upi">UPI / Online Transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="cash">Company Cash Handover</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-muted mb-1">
                        UTR / Transaction Ref No.
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. UTR98234123"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        className="w-full rounded-xl border border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-muted mb-1">
                        Bank / Account Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC Main Corporate Account"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full rounded-xl border border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Notes & Attachments */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Settlement Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={settlementDate}
                    onChange={(e) => setSettlementDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Settlement Remarks / Voucher Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Monthly travel settlement approved"
                    value={settlementNotes}
                    onChange={(e) => setSettlementNotes(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Attachments */}
              <div className="rounded-xl border border-border bg-surface-muted/30 p-3">
                <ExpenseAttachmentUploader
                  label="Settlement Documents (Payment Receipt, Bank Advice)"
                  attachments={attachments}
                  onChange={setAttachments}
                  onPreview={openPreview}
                  resourceType="expense_settlement"
                />
              </div>
            </div>

            {/* Total Balance Summary Box */}
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <span className="font-bold text-sky-900 dark:text-sky-200 block text-xs">
                  Settlement Breakdown:
                </span>
                <div className="text-[11px] text-muted flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>Claims Total: <strong className="text-foreground">{formatCurrency(totalClaimAmount)}</strong></span>
                  {totalAdvanceDeduction > 0 && (
                    <>
                      <span>•</span>
                      <span>Advance Offset: <strong className="text-purple-600 dark:text-purple-400">-{formatCurrency(totalAdvanceDeduction)}</strong></span>
                    </>
                  )}
                  {totalPaymentEntryDeduction > 0 && (
                    <>
                      <span>•</span>
                      <span>Payment Entry Offset: <strong className="text-indigo-600 dark:text-indigo-400">-{formatCurrency(totalPaymentEntryDeduction)}</strong></span>
                    </>
                  )}
                  <span>•</span>
                  <span>Treasury Direct Payout: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(directPaymentAmount)}</strong></span>
                </div>
              </div>
              <div className="text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                <span className="text-[10px] uppercase font-bold text-muted block">Net Voucher Value</span>
                <span className="text-sm font-black text-sky-700 dark:text-sky-300">
                  {formatCurrency(totalClaimAmount)}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || availableClaims.length === 0 || selectedClaimIds.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 active:scale-95 transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{isLoading ? "Generating Voucher..." : "Finalize & Generate Voucher"}</span>
              </button>
            </div>
          </form>
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
