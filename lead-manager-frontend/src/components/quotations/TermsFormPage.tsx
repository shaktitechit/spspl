/**
 * @fileoverview Form page component for creating and editing Terms & Conditions sets.
 * @module components/portal/shared/quotations/TermsFormPage
 */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  FileText,
  Plus,
  Trash2,
  Star,
  Layers,
} from "lucide-react";
import {
  useGetTermsAndConditionsByIdQuery,
  useCreateTermsAndConditionsMutation,
  useUpdateTermsAndConditionsMutation,
  type TermsAndConditionsRecord,
} from "@/store/api";
import { toast } from "@/lib/toast";
import { PortalBusyOverlay } from "@/components/portal/shared/PortalBusyOverlay";
import { RichTextEditor } from "./RichTextEditor";

type Props = {
  mode: "create" | "edit";
  termsId?: string;
  portalHome?: string;
};

type FormState = {
  title: string;
  code: string;
  type: "quotation" | "order" | "invoice" | "general";
  description: string;
  is_default: boolean;
  is_active: boolean;
  terms_text: Array<{ _id?: string; text: string; sequence: number; is_active: boolean }>;
};

const INITIAL_FORM: FormState = {
  title: "",
  code: "",
  type: "quotation",
  description: "",
  is_default: false,
  is_active: true,
  terms_text: [
    { text: "Prices quoted are valid for 15 days from date of submission.", sequence: 1, is_active: true },
    { text: "Taxes and statutory levies extra as applicable.", sequence: 2, is_active: true },
    { text: "Standard warranty applies as per manufacturer guidelines.", sequence: 3, is_active: true },
  ],
};

export function TermsFormPage({ mode, termsId, portalHome = "/dashboard" }: Props) {
  const router = useRouter();
  const isEditing = mode === "edit" && Boolean(termsId);

  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);

  const { data: existingTerms, isLoading: isFetchingTerms } = useGetTermsAndConditionsByIdQuery(
    termsId || "",
    { skip: !isEditing || !termsId }
  );

  const [createTerms, { isLoading: isCreating }] = useCreateTermsAndConditionsMutation();
  const [updateTerms, { isLoading: isUpdating }] = useUpdateTermsAndConditionsMutation();

  useEffect(() => {
    if (isEditing && existingTerms) {
      setFormData({
        title: existingTerms.title || "",
        code: existingTerms.code || "",
        type: existingTerms.type || "quotation",
        description: existingTerms.description || "",
        is_default: existingTerms.is_default || false,
        is_active: existingTerms.is_active ?? true,
        terms_text: Array.isArray(existingTerms.terms_text)
          ? existingTerms.terms_text.map((t, idx) => ({
              _id: t._id,
              text: t.text || "",
              sequence: t.sequence || idx + 1,
              is_active: t.is_active ?? true,
            }))
          : [],
      });
    }
  }, [isEditing, existingTerms]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    const payload = {
      title: formData.title.trim(),
      code: formData.code.trim() || undefined,
      type: formData.type,
      description: formData.description.trim() || undefined,
      is_default: formData.is_default,
      is_active: formData.is_active,
      terms_text: formData.terms_text
        .filter((t) => t.text.trim())
        .map((t, idx) => ({
          text: t.text.trim(),
          sequence: idx + 1,
          is_active: t.is_active,
        })),
    };

    try {
      if (isEditing && termsId) {
        await updateTerms({ id: termsId, body: payload }).unwrap();
        toast.success(`Terms "${formData.title}" updated successfully`);
      } else {
        await createTerms(payload).unwrap();
        toast.success(`Terms "${formData.title}" created successfully`);
      }
      router.push(`${portalHome}/quotations/terms`);
    } catch {
      toast.error("Failed to save Terms & Conditions");
    }
  };

  return (
    <div className="relative min-h-screen space-y-6 pb-20">
      <PortalBusyOverlay active={isCreating || isUpdating} />

      {/* Header Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-white/10">
        <div className="flex items-center gap-3">
          <Link
            href={`${portalHome}/quotations/terms`}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {isEditing ? "Edit Terms & Conditions Set" : "Add Terms & Conditions Set"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure commercial conditions and standard clauses for quotation letterheads
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`${portalHome}/quotations/terms`}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleFormSubmit}
            disabled={isCreating || isUpdating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            {isCreating || isUpdating ? "Saving..." : isEditing ? "Update Terms Set" : "Create Terms Set"}
          </button>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Terms Set Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Standard Quotation Terms 2026"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-900 shadow-2xs focus:border-primary focus:bg-white focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Document Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    type: e.target.value as FormState["type"],
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-900 shadow-2xs focus:border-primary focus:bg-white focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              >
                <option value="quotation">Quotation</option>
                <option value="order">Sales Order</option>
                <option value="invoice">Invoice</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Code (Optional)
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.toLowerCase() }))}
                placeholder="e.g. quot_std_v1"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-mono text-slate-900 shadow-2xs focus:border-primary focus:bg-white focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Description / Internal Remarks
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Internal summary or notes..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-primary focus:bg-white focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-6 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-white/10 dark:bg-slate-800/40">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) => setFormData((p) => ({ ...p, is_default: e.target.checked }))}
                className="h-4 w-4 rounded-xs border-slate-300 accent-primary cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                Set as Default for {formData.type}
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))}
                className="h-4 w-4 rounded-xs border-slate-300 accent-primary cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Active Status
              </span>
            </label>
          </div>
        </div>

        {/* Condition Lines */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Condition Clauses ({formData.terms_text.length})
            </h2>
            <button
              type="button"
              onClick={() =>
                setFormData((p) => ({
                  ...p,
                  terms_text: [
                    ...p.terms_text,
                    { text: "", sequence: p.terms_text.length + 1, is_active: true },
                  ],
                }))
              }
              className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Clause Line
            </button>
          </div>

          <div className="space-y-3">
            {formData.terms_text.map((line, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-white/10 dark:bg-slate-800/40"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300 mt-1">
                  {idx + 1}
                </span>
                <div className="flex-1 text-slate-900 dark:text-white">
                  <RichTextEditor
                    value={line.text}
                    onChange={(html) =>
                      setFormData((p) => ({
                        ...p,
                        terms_text: p.terms_text.map((x, i) => (i === idx ? { ...x, text: html } : x)),
                      }))
                    }
                    placeholder={`Clause line ${idx + 1}...`}
                    minHeight="60px"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((p) => ({
                      ...p,
                      terms_text: p.terms_text.filter((_, i) => i !== idx),
                    }))
                  }
                  className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 cursor-pointer mt-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <Link
            href={`${portalHome}/quotations/terms`}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isCreating || isUpdating}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            {isCreating || isUpdating ? "Saving..." : isEditing ? "Update Terms Set" : "Create Terms Set"}
          </button>
        </div>
      </form>
    </div>
  );
}
