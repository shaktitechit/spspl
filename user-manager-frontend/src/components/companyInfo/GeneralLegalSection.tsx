"use client";

import { useState, useEffect } from "react";
import { Landmark, Mail, Phone, Globe, Save, RotateCcw, CheckCircle2, AlertCircle, Loader2, Edit3, ShieldCheck } from "lucide-react";

interface GeneralLegalData {
  legal_name?: string;
  trade_name?: string;
  email?: string;
  billing_email?: string;
  phone?: string;
  website?: string;
}

interface GeneralLegalSectionProps {
  initialData: GeneralLegalData;
  onSave: (data: Partial<GeneralLegalData>) => Promise<void>;
  isLoading?: boolean;
}

export function GeneralLegalSection({ initialData, onSave, isLoading }: GeneralLegalSectionProps) {
  const [formData, setFormData] = useState<GeneralLegalData>({
    legal_name: "",
    trade_name: "",
    email: "",
    billing_email: "",
    phone: "",
    website: "",
    ...initialData,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      legal_name: initialData.legal_name || "",
      trade_name: initialData.trade_name || "",
      email: initialData.email || "",
      billing_email: initialData.billing_email || "",
      phone: initialData.phone || "",
      website: initialData.website || "",
    });
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setFormData({
      legal_name: initialData.legal_name || "",
      trade_name: initialData.trade_name || "",
      email: initialData.email || "",
      billing_email: initialData.billing_email || "",
      phone: initialData.phone || "",
      website: initialData.website || "",
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
        legal_name: formData.legal_name?.trim() || "",
        trade_name: formData.trade_name?.trim() || "",
        email: formData.email?.trim() || "",
        billing_email: formData.billing_email?.trim() || "",
        phone: formData.phone?.trim() || "",
        website: formData.website?.trim() || "",
      });
      setSuccessMsg("General & Legal entity details saved successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save general & legal details.");
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty =
    (formData.legal_name || "") !== (initialData.legal_name || "") ||
    (formData.trade_name || "") !== (initialData.trade_name || "") ||
    (formData.email || "") !== (initialData.email || "") ||
    (formData.billing_email || "") !== (initialData.billing_email || "") ||
    (formData.phone || "") !== (initialData.phone || "") ||
    (formData.website || "") !== (initialData.website || "");

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-6 shadow-sm">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">General & Legal Entity Details</h3>
              {isDirty && (
                <span className="text-3xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-muted">Primary registered entity name, trade branding, and official communication channels</p>
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
              Edit Details
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
            Save General Details
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
            Legal Entity Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="legal_name"
            value={formData.legal_name || ""}
            onChange={handleChange}
            placeholder="e.g. Shakti Technologies Pvt Ltd"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Trade / Brand Name</label>
          <input
            type="text"
            name="trade_name"
            value={formData.trade_name || ""}
            onChange={handleChange}
            placeholder="e.g. Shakti Power Systems"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Official Support Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
            <input
              type="email"
              name="email"
              value={formData.email || ""}
              onChange={handleChange}
              placeholder="contact@shaktipower.com"
              className="w-full rounded-xl border border-border bg-background pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Billing & Finance Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
            <input
              type="email"
              name="billing_email"
              value={formData.billing_email || ""}
              onChange={handleChange}
              placeholder="billing@shaktipower.com"
              className="w-full rounded-xl border border-border bg-background pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Contact Phone Number</label>
          <div className="relative">
            <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              name="phone"
              value={formData.phone || ""}
              onChange={handleChange}
              placeholder="+91 98765 43210"
              className="w-full rounded-xl border border-border bg-background pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Official Website</label>
          <div className="relative">
            <Globe className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              name="website"
              value={formData.website || ""}
              onChange={handleChange}
              placeholder="https://shaktipower.com"
              className="w-full rounded-xl border border-border bg-background pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
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
            Reset General Changes
          </button>

          <button
            type="submit"
            disabled={isSaving || !isDirty}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary transition active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save General Details
          </button>
        </div>
      </form>
    </div>
  );
}
