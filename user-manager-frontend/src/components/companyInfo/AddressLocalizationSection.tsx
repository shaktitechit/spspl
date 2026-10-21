"use client";

import { useState, useEffect } from "react";
import { MapPin, Globe, Save, RotateCcw, CheckCircle2, AlertCircle, Loader2, Edit3, Calendar } from "lucide-react";

interface AddressLocalizationData {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  financial_year?: string;
  invoice_footer_note?: string;
}

interface AddressLocalizationSectionProps {
  initialData: AddressLocalizationData;
  onSave: (data: Partial<AddressLocalizationData>) => Promise<void>;
}

export function AddressLocalizationSection({ initialData, onSave }: AddressLocalizationSectionProps) {
  const [formData, setFormData] = useState<AddressLocalizationData>({
    address: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    currency: "INR",
    timezone: "Asia/Kolkata",
    financial_year: "April - March",
    invoice_footer_note: "",
    ...initialData,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      address: initialData.address || "",
      city: initialData.city || "",
      state: initialData.state || "",
      pincode: initialData.pincode || "",
      country: initialData.country || "India",
      currency: initialData.currency || "INR",
      timezone: initialData.timezone || "Asia/Kolkata",
      financial_year: initialData.financial_year || "April - March",
      invoice_footer_note: initialData.invoice_footer_note || "",
    });
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setFormData({
      address: initialData.address || "",
      city: initialData.city || "",
      state: initialData.state || "",
      pincode: initialData.pincode || "",
      country: initialData.country || "India",
      currency: initialData.currency || "INR",
      timezone: initialData.timezone || "Asia/Kolkata",
      financial_year: initialData.financial_year || "April - March",
      invoice_footer_note: initialData.invoice_footer_note || "",
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
        address: formData.address?.trim() || "",
        city: formData.city?.trim() || "",
        state: formData.state?.trim() || "",
        pincode: formData.pincode?.trim() || "",
        country: formData.country?.trim() || "India",
        currency: formData.currency?.trim() || "INR",
        timezone: formData.timezone?.trim() || "Asia/Kolkata",
        financial_year: formData.financial_year?.trim() || "",
        invoice_footer_note: formData.invoice_footer_note?.trim() || "",
      });
      setSuccessMsg("Address & Localization settings saved successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save address & localization settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty =
    (formData.address || "") !== (initialData.address || "") ||
    (formData.city || "") !== (initialData.city || "") ||
    (formData.state || "") !== (initialData.state || "") ||
    (formData.pincode || "") !== (initialData.pincode || "") ||
    (formData.country || "India") !== (initialData.country || "India") ||
    (formData.currency || "INR") !== (initialData.currency || "INR") ||
    (formData.timezone || "Asia/Kolkata") !== (initialData.timezone || "Asia/Kolkata") ||
    (formData.financial_year || "") !== (initialData.financial_year || "") ||
    (formData.invoice_footer_note || "") !== (initialData.invoice_footer_note || "");

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-6 shadow-sm">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">Address & Localization Preferences</h3>
              {isDirty && (
                <span className="text-3xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-muted">Primary registered office address, operational timezone, and fiscal calendar</p>
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
              Edit Address
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
            Save Address Details
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
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-foreground block mb-1">
            Registered Corporate Address <span className="text-rose-500">*</span>
          </label>
          <textarea
            name="address"
            rows={2}
            value={formData.address || ""}
            onChange={handleChange}
            placeholder="Plot No., Building Name, Industrial Area / Street"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">City / District</label>
          <input
            type="text"
            name="city"
            value={formData.city || ""}
            onChange={handleChange}
            placeholder="e.g. Mumbai"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">State / Province</label>
          <input
            type="text"
            name="state"
            value={formData.state || ""}
            onChange={handleChange}
            placeholder="e.g. Maharashtra"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Postal / ZIP Code</label>
          <input
            type="text"
            name="pincode"
            value={formData.pincode || ""}
            onChange={handleChange}
            placeholder="400001"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Country</label>
          <input
            type="text"
            name="country"
            value={formData.country || ""}
            onChange={handleChange}
            placeholder="India"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Default Billing Currency</label>
          <input
            type="text"
            name="currency"
            value={formData.currency || ""}
            onChange={handleChange}
            placeholder="INR (₹)"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">System Operational Timezone</label>
          <input
            type="text"
            name="timezone"
            value={formData.timezone || ""}
            onChange={handleChange}
            placeholder="Asia/Kolkata (IST)"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-foreground block mb-1">Financial Year Cycle</label>
          <input
            type="text"
            name="financial_year"
            value={formData.financial_year || ""}
            onChange={handleChange}
            placeholder="e.g. 01 April - 31 March (FY 2026-27)"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-foreground block mb-1">Invoice & Quotation Footer Note</label>
          <textarea
            name="invoice_footer_note"
            rows={2}
            value={formData.invoice_footer_note || ""}
            onChange={handleChange}
            placeholder="e.g. Thank you for your partnership. Subject to local jurisdiction."
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
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
            Reset Address Changes
          </button>

          <button
            type="submit"
            disabled={isSaving || !isDirty}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary transition active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Address Details
          </button>
        </div>
      </form>
    </div>
  );
}
