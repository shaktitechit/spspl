"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Save, RotateCcw, CheckCircle2, AlertCircle, Loader2, Edit3, Copy, Check } from "lucide-react";

interface TaxationData {
  gstin?: string;
  pan?: string;
  cin?: string;
  drug_license?: string;
  fssai_license?: string;
}

interface TaxationComplianceSectionProps {
  initialData: TaxationData;
  onSave: (data: Partial<TaxationData>) => Promise<void>;
}

export function TaxationComplianceSection({ initialData, onSave }: TaxationComplianceSectionProps) {
  const [formData, setFormData] = useState<TaxationData>({
    gstin: "",
    pan: "",
    cin: "",
    drug_license: "",
    fssai_license: "",
    ...initialData,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      gstin: initialData.gstin || "",
      pan: initialData.pan || "",
      cin: initialData.cin || "",
      drug_license: initialData.drug_license || "",
      fssai_license: initialData.fssai_license || "",
    });
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      gstin: initialData.gstin || "",
      pan: initialData.pan || "",
      cin: initialData.cin || "",
      drug_license: initialData.drug_license || "",
      fssai_license: initialData.fssai_license || "",
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
        gstin: formData.gstin?.trim() || "",
        pan: formData.pan?.trim() || "",
        cin: formData.cin?.trim() || "",
        drug_license: formData.drug_license?.trim() || "",
        fssai_license: formData.fssai_license?.trim() || "",
      });
      setSuccessMsg("Taxation & statutory compliance details saved successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save taxation details.");
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty =
    (formData.gstin || "") !== (initialData.gstin || "") ||
    (formData.pan || "") !== (initialData.pan || "") ||
    (formData.cin || "") !== (initialData.cin || "") ||
    (formData.drug_license || "") !== (initialData.drug_license || "") ||
    (formData.fssai_license || "") !== (initialData.fssai_license || "");

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-6 shadow-sm">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">Taxation & Statutory Compliance</h3>
              {isDirty && (
                <span className="text-3xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-muted">Central organization tax IDs, GSTIN registrations, and regulatory licenses</p>
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
              Edit Tax IDs
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
            Save Taxation Details
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
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-foreground">GSTIN (Head Office)</label>
            {formData.gstin ? (
              <button
                type="button"
                onClick={() => handleCopy(formData.gstin!, "GSTIN")}
                className="text-3xs text-primary hover:underline flex items-center gap-1"
              >
                {copiedKey === "GSTIN" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedKey === "GSTIN" ? "Copied!" : "Copy"}
              </button>
            ) : null}
          </div>
          <input
            type="text"
            name="gstin"
            value={formData.gstin || ""}
            onChange={handleChange}
            placeholder="22AAAAA0000A1Z5"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-foreground">Permanent Account Number (PAN)</label>
            {formData.pan ? (
              <button
                type="button"
                onClick={() => handleCopy(formData.pan!, "PAN")}
                className="text-3xs text-primary hover:underline flex items-center gap-1"
              >
                {copiedKey === "PAN" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedKey === "PAN" ? "Copied!" : "Copy"}
              </button>
            ) : null}
          </div>
          <input
            type="text"
            name="pan"
            value={formData.pan || ""}
            onChange={handleChange}
            placeholder="AAAAA0000A"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Corporate Identification Number (CIN)</label>
          <input
            type="text"
            name="cin"
            value={formData.cin || ""}
            onChange={handleChange}
            placeholder="U74999DL2020PTC000000"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Drug License (DL No.)</label>
          <input
            type="text"
            name="drug_license"
            value={formData.drug_license || ""}
            onChange={handleChange}
            placeholder="DL-00-000000"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-foreground block mb-1">FSSAI License / Registration No.</label>
          <input
            type="text"
            name="fssai_license"
            value={formData.fssai_license || ""}
            onChange={handleChange}
            placeholder="100XXXXXXXXXXX"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none font-mono"
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
            Reset Taxation Changes
          </button>

          <button
            type="submit"
            disabled={isSaving || !isDirty}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary transition active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Taxation Details
          </button>
        </div>
      </form>
    </div>
  );
}
