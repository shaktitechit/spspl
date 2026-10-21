"use client";

import { useState, useEffect } from "react";
import { CreditCard, Landmark, Save, RotateCcw, CheckCircle2, AlertCircle, Loader2, Edit3, Copy, Check } from "lucide-react";

interface BankingData {
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch_name?: string;
  account_type?: string;
  upi_id?: string;
  swift_code?: string;
}

interface BankingPaymentsSectionProps {
  initialData: BankingData;
  onSave: (data: Partial<BankingData>) => Promise<void>;
}

export function BankingPaymentsSection({ initialData, onSave }: BankingPaymentsSectionProps) {
  const [formData, setFormData] = useState<BankingData>({
    bank_name: "",
    account_name: "",
    account_number: "",
    ifsc_code: "",
    branch_name: "",
    account_type: "Current Account",
    upi_id: "",
    swift_code: "",
    ...initialData,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      bank_name: initialData.bank_name || "",
      account_name: initialData.account_name || "",
      account_number: initialData.account_number || "",
      ifsc_code: initialData.ifsc_code || "",
      branch_name: initialData.branch_name || "",
      account_type: initialData.account_type || "Current Account",
      upi_id: initialData.upi_id || "",
      swift_code: initialData.swift_code || "",
    });
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
  };

  const handleReset = () => {
    setFormData({
      bank_name: initialData.bank_name || "",
      account_name: initialData.account_name || "",
      account_number: initialData.account_number || "",
      ifsc_code: initialData.ifsc_code || "",
      branch_name: initialData.branch_name || "",
      account_type: initialData.account_type || "Current Account",
      upi_id: initialData.upi_id || "",
      swift_code: initialData.swift_code || "",
    });
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await onSave({
        bank_name: formData.bank_name?.trim() || "",
        account_name: formData.account_name?.trim() || "",
        account_number: formData.account_number?.trim() || "",
        ifsc_code: formData.ifsc_code?.trim() || "",
        branch_name: formData.branch_name?.trim() || "",
        account_type: formData.account_type || "Current Account",
        upi_id: formData.upi_id?.trim() || "",
        swift_code: formData.swift_code?.trim() || "",
      });
      setSuccessMsg("Banking credentials & payout accounts saved successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save banking details.");
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty =
    (formData.bank_name || "") !== (initialData.bank_name || "") ||
    (formData.account_name || "") !== (initialData.account_name || "") ||
    (formData.account_number || "") !== (initialData.account_number || "") ||
    (formData.ifsc_code || "") !== (initialData.ifsc_code || "") ||
    (formData.branch_name || "") !== (initialData.branch_name || "") ||
    (formData.account_type || "Current Account") !== (initialData.account_type || "Current Account") ||
    (formData.upi_id || "") !== (initialData.upi_id || "") ||
    (formData.swift_code || "") !== (initialData.swift_code || "");

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-6 shadow-sm">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">Banking Credentials & Payout Accounts</h3>
              {isDirty && (
                <span className="text-3xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-muted">Primary settlement bank account details printed on invoices, quotations, and challans</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
            >
              <Edit3 className="h-3.5 w-3.5 text-primary" />
              Edit Banking Details
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                handleReset();
                setIsEditing(false);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || (!isDirty && !isEditing)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-primary transition active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Banking Details
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Fields Grid */}
      <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Beneficiary Account Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="account_name"
            value={formData.account_name || ""}
            onChange={handleChange}
            placeholder="e.g. Shakti Technologies Pvt Ltd"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Bank Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="bank_name"
            value={formData.bank_name || ""}
            onChange={handleChange}
            placeholder="e.g. HDFC Bank"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-foreground">Account Number</label>
            {formData.account_number ? (
              <button
                type="button"
                onClick={() => handleCopy(formData.account_number!, "Account Number")}
                className="text-3xs text-primary hover:underline flex items-center gap-1"
              >
                {copiedKey === "Account Number" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedKey === "Account Number" ? "Copied!" : "Copy"}
              </button>
            ) : null}
          </div>
          <input
            type="text"
            name="account_number"
            value={formData.account_number || ""}
            onChange={handleChange}
            placeholder="502000XXXXXXXX"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none font-mono"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-foreground">IFSC Code</label>
            {formData.ifsc_code ? (
              <button
                type="button"
                onClick={() => handleCopy(formData.ifsc_code!, "IFSC")}
                className="text-3xs text-primary hover:underline flex items-center gap-1"
              >
                {copiedKey === "IFSC" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedKey === "IFSC" ? "Copied!" : "Copy"}
              </button>
            ) : null}
          </div>
          <input
            type="text"
            name="ifsc_code"
            value={formData.ifsc_code || ""}
            onChange={handleChange}
            placeholder="HDFC0001234"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Branch Name / Locality</label>
          <input
            type="text"
            name="branch_name"
            value={formData.branch_name || ""}
            onChange={handleChange}
            placeholder="Fort Branch, Mumbai"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Account Type</label>
          <select
            name="account_type"
            value={formData.account_type || "Current Account"}
            onChange={handleChange}
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="Current Account">Current Account</option>
            <option value="Savings Account">Savings Account</option>
            <option value="Cash Credit (CC)">Cash Credit (CC)</option>
            <option value="Overdraft (OD)">Overdraft (OD)</option>
            <option value="Escrow Account">Escrow Account</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-foreground">Business UPI ID / VPA</label>
            {formData.upi_id ? (
              <button
                type="button"
                onClick={() => handleCopy(formData.upi_id!, "UPI")}
                className="text-3xs text-primary hover:underline flex items-center gap-1"
              >
                {copiedKey === "UPI" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedKey === "UPI" ? "Copied!" : "Copy"}
              </button>
            ) : null}
          </div>
          <input
            type="text"
            name="upi_id"
            value={formData.upi_id || ""}
            onChange={handleChange}
            placeholder="company@hdfcbank"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">SWIFT / BIC Code (International)</label>
          <input
            type="text"
            name="swift_code"
            value={formData.swift_code || ""}
            onChange={handleChange}
            placeholder="HDFCINBBXXX"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
          />
        </div>

        {/* Action Footer */}
        <div className="sm:col-span-2 flex items-center justify-between pt-3 border-t border-border mt-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground disabled:opacity-40 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Banking Changes
          </button>

          <button
            type="submit"
            disabled={isSaving || !isDirty}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary transition active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Banking Details
          </button>
        </div>
      </form>
    </div>
  );
}
