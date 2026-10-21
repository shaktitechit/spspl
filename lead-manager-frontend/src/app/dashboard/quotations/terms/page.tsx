/**
 * @fileoverview Dedicated Terms & Conditions Master Directory Page.
 * @module app/dashboard/quotations/terms/page
 */
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Star,
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  useListTermsAndConditionsQuery,
  useUpdateTermsAndConditionsMutation,
  useDeleteTermsAndConditionsMutation,
  useAddTermsTextMutation,
  useDeleteTermsTextMutation,
  type TermsAndConditionsRecord,
} from "@/store/api";
import { toast } from "@/lib/toast";
import { useAppSelector } from "@/store/hooks";
import { isAdmin as checkIsAdmin, isManager as checkIsManager, readSessionFromStorage } from "@/utils/authStorage";
import { RichTextDisplay } from "@/components/quotations/RichTextDisplay";

export default function TermsListingRoutePage() {
  const portalHome = "/dashboard";
  const reduxUser = useAppSelector((state) => state.auth?.user);
  const sessionUser = useMemo(() => readSessionFromStorage()?.user || null, []);
  const authUser = (reduxUser || sessionUser) as any;
  const canManageTerms = checkIsAdmin(authUser) || checkIsManager(authUser);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quickLineText, setQuickLineText] = useState<Record<string, string>>({});

  const { data: rawData, isLoading, refetch } = useListTermsAndConditionsQuery({
    search: searchTerm || undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
  });

  const [updateTerms] = useUpdateTermsAndConditionsMutation();
  const [deleteTerms] = useDeleteTermsAndConditionsMutation();
  const [addTermsText] = useAddTermsTextMutation();
  const [deleteTermsText] = useDeleteTermsTextMutation();

  const termsList: TermsAndConditionsRecord[] = useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData.terms_and_conditions)) {
      return rawData.terms_and_conditions;
    }
    return [];
  }, [rawData]);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await deleteTerms(id).unwrap();
      toast.success(`Terms "${title}" deleted`);
      refetch();
    } catch {
      toast.error("Failed to delete terms and conditions");
    }
  };

  const handleToggleDefault = async (item: TermsAndConditionsRecord) => {
    try {
      await updateTerms({
        id: item._id,
        body: { is_default: !item.is_default, type: item.type },
      }).unwrap();
      toast.success(`Updated default status for "${item.title}"`);
      refetch();
    } catch {
      toast.error("Failed to update default status");
    }
  };

  const handleQuickAddLine = async (termsId: string) => {
    const text = (quickLineText[termsId] || "").trim();
    if (!text) return;
    try {
      await addTermsText({
        termsAndConditionsId: termsId,
        body: { text },
      }).unwrap();
      toast.success("Condition line added");
      setQuickLineText((prev) => ({ ...prev, [termsId]: "" }));
      refetch();
    } catch {
      toast.error("Failed to add condition line");
    }
  };

  const handleDeleteTextLine = async (textId: string) => {
    try {
      await deleteTermsText(textId).unwrap();
      toast.success("Condition line deleted");
      refetch();
    } catch {
      toast.error("Failed to delete condition line");
    }
  };

  return (
    <div className="relative min-h-screen space-y-6 pb-20 p-4 sm:p-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 dark:border-white/10 gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`${portalHome}/quotations`}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Terms &amp; Conditions Master
              <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {termsList.length} Sets
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage commercial terms, legal conditions, and default text templates for Quotations and Orders
            </p>
          </div>
        </div>

        {canManageTerms && (
          <Link
            href={`${portalHome}/quotations/terms/new`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-primary-hover transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Terms Set
          </Link>
        )}
      </div>

      {/* Search & Type Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search terms by title, code, or description..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            Type:
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white cursor-pointer"
          >
            <option value="all">All Document Types</option>
            <option value="quotation">Quotation Terms</option>
            <option value="order">Order Terms</option>
            <option value="invoice">Invoice Terms</option>
            <option value="general">General Terms</option>
          </select>
        </div>
      </div>

      {/* Terms Sets List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading terms &amp; conditions master data...</div>
        ) : termsList.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl p-6 dark:border-white/10">
            No Terms &amp; Conditions sets found.
          </div>
        ) : (
          termsList.map((item) => {
            const isExpanded = expandedId === item._id;
            const textCount = item.terms_text?.length || 0;

            return (
              <div
                key={item._id}
                className={`rounded-2xl border transition-all ${
                  item.is_default
                    ? "border-blue-300 bg-blue-50/30 dark:border-blue-900/60 dark:bg-blue-950/20"
                    : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-800/40"
                }`}
              >
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item._id)}
                      className="mt-0.5 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </h3>

                        {item.is_default && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            Default {item.type}
                          </span>
                        )}

                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          {item.type}
                        </span>

                        {item.code && (
                          <span className="font-mono text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded-md dark:bg-blue-950/60">
                            #{item.code}
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          {item.description}
                        </p>
                      )}

                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span>
                          Contains <strong>{textCount}</strong> condition line{textCount !== 1 ? "s" : ""}
                        </span>
                        <span>•</span>
                        <span className={item.is_active ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                          {item.is_active ? "Active" : "Disabled"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {canManageTerms && (
                      <button
                        type="button"
                        onClick={() => handleToggleDefault(item)}
                        className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                          item.is_default
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        <Star className={`h-3.5 w-3.5 ${item.is_default ? "fill-amber-500 text-amber-500" : "text-slate-400"}`} />
                        {item.is_default ? "Default" : "Set Default"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item._id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <Layers className="h-3.5 w-3.5 text-blue-600" />
                      {isExpanded ? "Hide Lines" : "View Lines"}
                    </button>

                    {canManageTerms && (
                      <Link
                        href={`${portalHome}/quotations/terms/${item._id}/edit`}
                        className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    )}

                    {canManageTerms && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item._id, item.title)}
                        className="rounded-xl p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/60 rounded-b-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                        Condition Lines ({textCount})
                      </h4>
                    </div>

                    {textCount === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400">
                        No condition lines configured.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {item.terms_text.map((textLine, idx) => (
                          <div
                            key={textLine._id || idx}
                            className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-white/10 dark:bg-slate-800"
                          >
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300 mt-0.5">
                                {textLine.sequence || idx + 1}
                              </span>
                              <RichTextDisplay content={textLine.text} className="flex-1" />
                            </div>
                            {canManageTerms && (
                              <button
                                type="button"
                                onClick={() => textLine._id && handleDeleteTextLine(textLine._id)}
                                className="text-rose-400 hover:text-rose-600 p-1 cursor-pointer shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {canManageTerms && (
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="text"
                          value={quickLineText[item._id] || ""}
                          onChange={(e) =>
                            setQuickLineText((prev) => ({ ...prev, [item._id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleQuickAddLine(item._id);
                            }
                          }}
                          placeholder="Add a new condition line item..."
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-2xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickAddLine(item._id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-primary-hover cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Line
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
