"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, CreditCard, Banknote, Calendar, FileText, CheckCircle, AlertCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { useRecordPaymentEntryMutation } from "@/store/api/expenseApiSlice";

interface PaymentEntryModalProps {
  open: boolean;
  onClose: () => void;
  user?: {
    _id: string;
    name: string;
    email?: string;
  } | null;
  userOptions?: Array<{ id: string; name: string; email?: string }>;
  onSuccess?: () => void;
}

export function PaymentEntryModal({
  open,
  onClose,
  user,
  userOptions = [],
  onSuccess,
}: PaymentEntryModalProps) {
  const [recordPayment, { isLoading }] = useRecordPaymentEntryMutation();

  const [selectedUserId, setSelectedUserId] = useState<string>(user?._id || "");
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Bank Transfer");
  const [transactionReference, setTransactionReference] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState<string>("");

  const prevOpenRef = React.useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (user?._id) {
        setSelectedUserId(user._id);
      } else if (userOptions.length > 0) {
        setSelectedUserId(userOptions[0].id);
      } else {
        setSelectedUserId("");
      }
      setAmount("");
      setPaymentMethod("Bank Transfer");
      setTransactionReference("");
      setBankName("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setNotes("");
    }
    prevOpenRef.current = open;
  }, [open, user?._id]);

  const activeUser = useMemo(() => {
    if (selectedUserId && userOptions.length > 0) {
      const match = userOptions.find((u) => u.id === selectedUserId);
      if (match) return { _id: match.id, name: match.name, email: match.email };
    }
    return user || null;
  }, [selectedUserId, userOptions, user]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Please enter a valid positive payment amount.");
      return;
    }

    const targetUserId = activeUser?._id || selectedUserId;
    if (!targetUserId) {
      toast.error("Please select an employee for this payment entry.");
      return;
    }

    const targetUserName = activeUser?.name || "employee";

    try {
      await recordPayment({
        sales_user: targetUserId,
        amount: numAmount,
        payment_method: paymentMethod,
        transaction_reference: transactionReference.trim() || undefined,
        bank_name: bankName.trim() || undefined,
        payment_date: paymentDate,
        notes: notes.trim() || `Treasury Payout / Reimbursement to ${targetUserName}`,
      }).unwrap();

      toast.success(`Payment entry of ₹${numAmount.toLocaleString()} recorded successfully for ${targetUserName}.`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to record payment entry.";
      toast.error(msg);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface-muted/40 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Record Payment / Treasury Payout</h2>
              <p className="text-xs text-muted">
                Credited to:{" "}
                <span className="font-semibold text-foreground">
                  {activeUser?.name || "Select Employee"}
                </span>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Employee Selection */}
          {userOptions.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>Beneficiary Employee *</span>
              </label>
              <select
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
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

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Payment Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-muted">₹</span>
              <input
                type="number"
                step="any"
                min="1"
                required
                placeholder="e.g. 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface pl-8 pr-4 py-2 text-sm font-semibold text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none transition"
              >
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="UPI">UPI Payment</option>
                <option value="Cash">Cash Handover</option>
                <option value="Cheque">Bank Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Payment Date
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Transaction Ref / UTR #
              </label>
              <input
                type="text"
                placeholder="e.g. UTR19482104"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Bank / Account
              </label>
              <input
                type="text"
                placeholder="e.g. HDFC Current A/c"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Description / Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Direct reimbursement payout for approved travel claims"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none transition resize-none"
            />
          </div>

          <div className="rounded-xl bg-surface-muted/60 p-3 text-xs text-muted flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Recording this payment will generate a formal settlement voucher and immediately credit the employee&apos;s running ledger and passbook.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 active:scale-95 transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle className="h-4 w-4" />
              <span>{isLoading ? "Recording..." : "Record Payment Entry"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
