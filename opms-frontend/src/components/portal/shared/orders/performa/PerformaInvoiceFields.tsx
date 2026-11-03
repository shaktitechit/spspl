"use client";

import React from "react";
import {
  User,
  Truck,
  Calendar,
  MapPin,
  CreditCard,
  Building,
  Wrench,
  Percent,
  FileText,
  ShieldCheck,
  AlignLeft,
  DollarSign,
  UploadCloud,
  FileCheck,
  Paperclip,
  Trash2,
  FileSpreadsheet,
  RotateCcw,
} from "lucide-react";
import { usePortalSettings } from "@/hooks/usePortalSettings";

export type PerformaFormValues = {
  sales_person: string;
  freight_charges: string;
  orc: string;
  transport: string;
  dispatch_date: string;
  ship_to_address: string;
  payment_terms: string;
  customer_type: string;
  installation_required: string;
  gst_concession: string;
  margin_sheet_attached: string;
  kyc_status: string;
  remarks: string;
};

export type PerformaAttachmentFiles = {
  po_file?: File | null;
  cost_sheet_file?: File | null;
  aadhaar_file?: File | null;
  pan_file?: File | null;
  gst_file?: File | null;
  kyc_files?: File[];
};

export interface ExistingPerformaDocuments {
  po_document?: Record<string, unknown> | null;
  cost_sheet_document?: Record<string, unknown> | null;
  aadhaar_document?: Record<string, unknown> | null;
  pan_document?: Record<string, unknown> | null;
  gst_document?: Record<string, unknown> | null;
  kyc_documents?: Record<string, unknown>[];
}

export const INITIAL_PERFORMA_VALUES: PerformaFormValues = {
  sales_person: "",
  freight_charges: "",
  orc: "",
  transport: "",
  dispatch_date: "",
  ship_to_address: "",
  payment_terms: "",
  customer_type: "",
  installation_required: "",
  gst_concession: "",
  margin_sheet_attached: "",
  kyc_status: "",
  remarks: "",
};

export const FREIGHT_CHARGES_OPTIONS = [
  "Included",
  "Extra at actual",
  "To Pay",
  "Not Applicable",
];

export const PAYMENT_TERMS_OPTIONS = [
  "Immediate",
  "Advance",
  "15 days",
  "30 days",
  "45 days",
  "60 days",
  "Against Delivery",
  "As per contract",
];

export const CUSTOMER_TYPE_OPTIONS = [
  "Dealer",
  "Hospital",
  "Direct Customer",
  "Distributor",
  "Institutional",
  "Government",
  "Other",
];

export const INSTALLATION_OPTIONS = ["Yes", "No", "Not Applicable"];

export const GST_CONCESSION_OPTIONS = ["No", "Yes", "Not Applicable"];

export const MARGIN_SHEET_OPTIONS = ["Attached", "Not Attached", "Not Applicable"];

export const KYC_STATUS_OPTIONS = ["Verified", "Pending", "Attached", "Not Applicable"];

interface PerformaInvoiceFieldsProps {
  values: PerformaFormValues;
  onChange: (field: keyof PerformaFormValues, value: string) => void;
  readOnly?: boolean;
  billingAddress?: string;
  attachmentFiles?: PerformaAttachmentFiles;
  onAttachmentFileChange?: (
    field: keyof PerformaAttachmentFiles,
    file: File | File[] | null
  ) => void;
  existingDocuments?: ExistingPerformaDocuments;
}

export function PerformaInvoiceFields({
  values,
  onChange,
  readOnly = false,
  billingAddress = "",
  attachmentFiles,
  onAttachmentFileChange,
  existingDocuments,
}: PerformaInvoiceFieldsProps) {
  const {
    isCostSheetEnabled,
    isKycEnabled,
    isPOEnabled,
    isBuyBackEnabled,
    buyBackConfig,
  } = usePortalSettings();
  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500 dark:disabled:bg-slate-900/60 dark:disabled:text-slate-500";
  const selectClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500 dark:disabled:bg-slate-900/60 dark:disabled:text-slate-500";
  const labelClass =
    "flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300";

  return (
    <div className="space-y-6">
      {/* Section 1: Commercial & Representatives */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <User className="h-4 w-4" />
            </span>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Sales & Commercial Terms
            </h4>
          </div>
          <span className="text-2xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Commercial Info
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Sales Person */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              <User className="h-3.5 w-3.5 text-slate-400" />
              Sales Person
            </label>
            <input
              type="text"
              className={inputClass}
              value={values.sales_person}
              onChange={(e) => onChange("sales_person", e.target.value)}
              placeholder="Enter sales representative name"
              disabled={readOnly}
            />
          </div>

          {/* Customer Type */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              <Building className="h-3.5 w-3.5 text-slate-400" />
              Customer Type
            </label>
            <select
              className={selectClass}
              value={values.customer_type}
              onChange={(e) => onChange("customer_type", e.target.value)}
              disabled={readOnly}
            >
              <option value="">Select customer type...</option>
              {CUSTOMER_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Terms */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              <CreditCard className="h-3.5 w-3.5 text-slate-400" />
              Payment Terms
            </label>
            <div className="flex gap-2">
              <select
                className={selectClass}
                value={
                  PAYMENT_TERMS_OPTIONS.includes(values.payment_terms)
                    ? values.payment_terms
                    : values.payment_terms
                    ? "Custom"
                    : ""
                }
                onChange={(e) => {
                  if (e.target.value !== "Custom") {
                    onChange("payment_terms", e.target.value);
                  }
                }}
                disabled={readOnly}
              >
                <option value="">Select payment terms...</option>
                {PAYMENT_TERMS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                <option value="Custom">Custom / Other</option>
              </select>
            </div>
            {/* If custom or typed value not in list */}
            {(!PAYMENT_TERMS_OPTIONS.includes(values.payment_terms) && values.payment_terms !== "") && (
              <input
                type="text"
                className={`mt-1.5 ${inputClass}`}
                value={values.payment_terms}
                onChange={(e) => onChange("payment_terms", e.target.value)}
                placeholder="Specify payment terms"
                disabled={readOnly}
              />
            )}
          </div>

          {/* Freight Charges */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              <DollarSign className="h-3.5 w-3.5 text-slate-400" />
              Freight Charges
            </label>
            <select
              className={selectClass}
              value={
                FREIGHT_CHARGES_OPTIONS.includes(values.freight_charges)
                  ? values.freight_charges
                  : values.freight_charges
                  ? "Custom"
                  : ""
              }
              onChange={(e) => {
                if (e.target.value !== "Custom") {
                  onChange("freight_charges", e.target.value);
                }
              }}
              disabled={readOnly}
            >
              <option value="">Select freight charges...</option>
              {FREIGHT_CHARGES_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value="Custom">Custom / Other</option>
            </select>
            {(!FREIGHT_CHARGES_OPTIONS.includes(values.freight_charges) && values.freight_charges !== "") && (
              <input
                type="text"
                className={`mt-1.5 ${inputClass}`}
                value={values.freight_charges}
                onChange={(e) => onChange("freight_charges", e.target.value)}
                placeholder="Specify freight charge details"
                disabled={readOnly}
              />
            )}
          </div>

          {/* ORC */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              <Percent className="h-3.5 w-3.5 text-slate-400" />
              ORC
            </label>
            <input
              type="text"
              className={inputClass}
              value={values.orc}
              onChange={(e) => onChange("orc", e.target.value)}
              placeholder="e.g. N/A or details"
              disabled={readOnly}
            />
          </div>

          {/* GST Concession */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              <Percent className="h-3.5 w-3.5 text-slate-400" />
              GST Concession
            </label>
            <select
              className={selectClass}
              value={values.gst_concession}
              onChange={(e) => onChange("gst_concession", e.target.value)}
              disabled={readOnly}
            >
              <option value="">Select concession status...</option>
              {GST_CONCESSION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Logistics & Dispatch */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Truck className="h-4 w-4" />
            </span>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Logistics & Delivery
            </h4>
          </div>
          <span className="text-2xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Dispatch Details
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Transport */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              <Truck className="h-3.5 w-3.5 text-slate-400" />
              Transport / Carrier
            </label>
            <input
              type="text"
              className={inputClass}
              value={values.transport}
              onChange={(e) => onChange("transport", e.target.value)}
              placeholder="e.g. Carrier name or To be arranged"
              disabled={readOnly}
            />
          </div>

          {/* Dispatch Date */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              Dispatch Date
            </label>
            <input
              type="date"
              className={inputClass}
              value={values.dispatch_date ? values.dispatch_date.slice(0, 10) : ""}
              onChange={(e) => onChange("dispatch_date", e.target.value)}
              disabled={readOnly}
            />
          </div>

          {/* Installation Required */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              <Wrench className="h-3.5 w-3.5 text-slate-400" />
              Installation Required
            </label>
            <select
              className={selectClass}
              value={values.installation_required}
              onChange={(e) => onChange("installation_required", e.target.value)}
              disabled={readOnly}
            >
              <option value="">Select installation status...</option>
              {INSTALLATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Ship to Address */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <div className="flex items-center justify-between">
              <label className={labelClass}>
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                Ship to Address
              </label>
              {!readOnly && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onChange("ship_to_address", "Same as billing address")}
                    className="text-2xs text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 cursor-pointer"
                  >
                    Set as &quot;Same as billing address&quot;
                  </button>
                  {billingAddress && (
                    <button
                      type="button"
                      onClick={() => onChange("ship_to_address", billingAddress)}
                      className="text-2xs text-slate-500 hover:text-slate-700 hover:underline dark:text-slate-400 cursor-pointer"
                    >
                      Copy Party Address
                    </button>
                  )}
                </div>
              )}
            </div>
            <textarea
              rows={2}
              className={`${inputClass} resize-y`}
              value={values.ship_to_address}
              onChange={(e) => onChange("ship_to_address", e.target.value)}
              placeholder="Enter shipping address or specify 'Same as billing address'"
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      {/* Section 3: Verification & Compliance */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {!isPOEnabled && !isCostSheetEnabled && !isKycEnabled
                ? "Additional Remarks & Notes"
                : isKycEnabled && (isPOEnabled || isCostSheetEnabled)
                ? "Verification, Attachments & KYC"
                : isKycEnabled
                ? "KYC Verification & Documents"
                : isCostSheetEnabled && isPOEnabled
                ? "Purchase Order & Cost Sheet Documents"
                : isPOEnabled
                ? "Purchase Order Documents"
                : "Cost Sheet Documents"}
            </h4>
          </div>
          <span className="text-2xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {!isPOEnabled && !isCostSheetEnabled && !isKycEnabled ? "Notes" : "Documents"}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">

          {/* Purchase Order Attachment */}
          {isPOEnabled && (
            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-white/10 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Purchase Order (PO)
                </label>
                <span className="text-2xs text-slate-400">PDF, Images, DOC</span>
              </div>

              {existingDocuments?.po_document && (
                <div className="flex items-center justify-between rounded-lg border border-blue-200/80 bg-blue-50/70 px-2.5 py-1.5 text-xs dark:border-blue-500/20 dark:bg-blue-950/30">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileCheck className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span className="truncate font-medium text-blue-900 dark:text-blue-200">
                      {String(existingDocuments.po_document.original_name || existingDocuments.po_document.file_name || "PO Document")}
                    </span>
                  </div>
                  <span className="shrink-0 text-2xs text-blue-600 dark:text-blue-400 font-semibold ml-2">Existing</span>
                </div>
              )}

              {attachmentFiles?.po_file ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs dark:border-emerald-500/20 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate font-medium text-emerald-900 dark:text-emerald-200">
                      {attachmentFiles.po_file.name}
                    </span>
                    <span className="text-2xs text-emerald-600 dark:text-emerald-400 ml-1">
                      ({(attachmentFiles.po_file.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  {!readOnly && onAttachmentFileChange && (
                    <button
                      type="button"
                      onClick={() => onAttachmentFileChange("po_file", null)}
                      className="ml-2 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : !readOnly && onAttachmentFileChange ? (
                <label className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-3 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition dark:border-white/10 dark:bg-slate-900 dark:hover:border-blue-400">
                  <UploadCloud className="h-4 w-4 text-slate-400 mb-1" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {existingDocuments?.po_document ? "Replace Purchase Order" : "Attach Purchase Order"}
                  </span>
                  <span className="text-2xs text-slate-400">Click to browse file</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onAttachmentFileChange("po_file", f);
                    }}
                    disabled={readOnly}
                  />
                </label>
              ) : null}
            </div>
          )}

          {/* Cost Sheet / Margin Sheet Attachment */}
          {isCostSheetEnabled && (
            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-white/10 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Cost Sheet (Margin Sheet)
                </label>
                <span className="text-2xs text-slate-400">Excel, CSV, PDF, Image</span>
              </div>

              {existingDocuments?.cost_sheet_document && (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-1.5 text-xs dark:border-emerald-500/20 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate font-medium text-emerald-900 dark:text-emerald-200">
                      {String(existingDocuments.cost_sheet_document.original_name || existingDocuments.cost_sheet_document.file_name || "Cost Sheet")}
                    </span>
                  </div>
                  <span className="shrink-0 text-2xs text-emerald-600 dark:text-emerald-400 font-semibold ml-2">Existing</span>
                </div>
              )}

              {attachmentFiles?.cost_sheet_file ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs dark:border-emerald-500/20 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate font-medium text-emerald-900 dark:text-emerald-200">
                      {attachmentFiles.cost_sheet_file.name}
                    </span>
                    <span className="text-2xs text-emerald-600 dark:text-emerald-400 ml-1">
                      ({(attachmentFiles.cost_sheet_file.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  {!readOnly && onAttachmentFileChange && (
                    <button
                      type="button"
                      onClick={() => onAttachmentFileChange("cost_sheet_file", null)}
                      className="ml-2 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : !readOnly && onAttachmentFileChange ? (
                <label className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-3 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition dark:border-white/10 dark:bg-slate-900 dark:hover:border-emerald-400">
                  <UploadCloud className="h-4 w-4 text-slate-400 mb-1" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {existingDocuments?.cost_sheet_document ? "Replace Cost Sheet" : "Attach Cost Sheet"}
                  </span>
                  <span className="text-2xs text-slate-400">Click to browse file</span>
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        onAttachmentFileChange("cost_sheet_file", f);
                        onChange("margin_sheet_attached", "Attached");
                      }
                    }}
                    disabled={readOnly}
                  />
                </label>
              ) : null}
            </div>
          )}

          {/* Margin Sheet Attached Select */}
          {isCostSheetEnabled && (
            <div className="space-y-1.5">
              <label className={labelClass}>
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Margin Sheet Status
              </label>
              <select
                className={selectClass}
                value={values.margin_sheet_attached}
                onChange={(e) => onChange("margin_sheet_attached", e.target.value)}
                disabled={readOnly}
              >
                <option value="">Select margin sheet status...</option>
                {MARGIN_SHEET_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* KYC Status Select */}
          {isKycEnabled && (
            <div className="space-y-1.5">
              <label className={labelClass}>
                <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                KYC Status
              </label>
              <select
                className={selectClass}
                value={values.kyc_status}
                onChange={(e) => onChange("kyc_status", e.target.value)}
                disabled={readOnly}
              >
                <option value="">Select KYC status...</option>
                {KYC_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Verification & KYC Documents (shown if KYC is applicable / active) */}
          {isKycEnabled && values.kyc_status !== "Not Applicable" && (
            <div className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-500/20 dark:bg-amber-950/20 sm:col-span-2">
              <div className="flex items-center justify-between border-b border-amber-200/60 pb-2 dark:border-amber-500/20">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    KYC Verification Documents (Aadhaar, PAN & GST)
                  </span>
                </div>
                <span className="text-2xs font-semibold text-amber-700 dark:text-amber-300">
                  Separated Documents
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {/* Slot 1: Aadhaar Card */}
                <div className="space-y-2 rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      Aadhaar Card
                    </label>
                    <span className="text-2xs text-slate-400">PDF, Image</span>
                  </div>

                  {existingDocuments?.aadhaar_document && (
                    <div className="flex items-center justify-between rounded-md border border-blue-200/80 bg-blue-50/70 px-2 py-1 text-2xs dark:border-blue-500/20 dark:bg-blue-950/30">
                      <div className="flex items-center gap-1 truncate">
                        <FileCheck className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span className="truncate font-medium text-blue-900 dark:text-blue-200">
                          {String(existingDocuments.aadhaar_document.original_name || existingDocuments.aadhaar_document.file_name || "Aadhaar Card")}
                        </span>
                      </div>
                      <span className="shrink-0 text-2xs text-blue-600 font-semibold ml-1">Existing</span>
                    </div>
                  )}

                  {attachmentFiles?.aadhaar_file ? (
                    <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-2xs dark:border-emerald-500/20 dark:bg-emerald-950/30">
                      <div className="flex items-center gap-1 truncate">
                        <FileCheck className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate font-medium text-emerald-900 dark:text-emerald-200">
                          {attachmentFiles.aadhaar_file.name}
                        </span>
                      </div>
                      {!readOnly && onAttachmentFileChange && (
                        <button
                          type="button"
                          onClick={() => onAttachmentFileChange("aadhaar_file", null)}
                          className="ml-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ) : !readOnly && onAttachmentFileChange ? (
                    <label className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/50 p-2.5 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition dark:border-white/10 dark:bg-slate-800/40">
                      <UploadCloud className="h-3.5 w-3.5 text-slate-400 mb-0.5" />
                      <span className="text-2xs font-semibold text-slate-700 dark:text-slate-300">
                        {existingDocuments?.aadhaar_document ? "Replace Aadhaar" : "Attach Aadhaar"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            onAttachmentFileChange("aadhaar_file", f);
                            if (!values.kyc_status || values.kyc_status === "Pending") {
                              onChange("kyc_status", "Attached");
                            }
                          }
                        }}
                        disabled={readOnly}
                      />
                    </label>
                  ) : null}
                </div>

                {/* Slot 2: PAN Card */}
                <div className="space-y-2 rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      PAN Card
                    </label>
                    <span className="text-2xs text-slate-400">PDF, Image</span>
                  </div>

                  {existingDocuments?.pan_document && (
                    <div className="flex items-center justify-between rounded-md border border-indigo-200/80 bg-indigo-50/70 px-2 py-1 text-2xs dark:border-indigo-500/20 dark:bg-indigo-950/30">
                      <div className="flex items-center gap-1 truncate">
                        <FileCheck className="h-3 w-3 shrink-0 text-indigo-600 dark:text-indigo-400" />
                        <span className="truncate font-medium text-indigo-900 dark:text-indigo-200">
                          {String(existingDocuments.pan_document.original_name || existingDocuments.pan_document.file_name || "PAN Card")}
                        </span>
                      </div>
                      <span className="shrink-0 text-2xs text-indigo-600 font-semibold ml-1">Existing</span>
                    </div>
                  )}

                  {attachmentFiles?.pan_file ? (
                    <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-2xs dark:border-emerald-500/20 dark:bg-emerald-950/30">
                      <div className="flex items-center gap-1 truncate">
                        <FileCheck className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate font-medium text-emerald-900 dark:text-emerald-200">
                          {attachmentFiles.pan_file.name}
                        </span>
                      </div>
                      {!readOnly && onAttachmentFileChange && (
                        <button
                          type="button"
                          onClick={() => onAttachmentFileChange("pan_file", null)}
                          className="ml-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ) : !readOnly && onAttachmentFileChange ? (
                    <label className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/50 p-2.5 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition dark:border-white/10 dark:bg-slate-800/40">
                      <UploadCloud className="h-3.5 w-3.5 text-slate-400 mb-0.5" />
                      <span className="text-2xs font-semibold text-slate-700 dark:text-slate-300">
                        {existingDocuments?.pan_document ? "Replace PAN" : "Attach PAN"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            onAttachmentFileChange("pan_file", f);
                            if (!values.kyc_status || values.kyc_status === "Pending") {
                              onChange("kyc_status", "Attached");
                            }
                          }
                        }}
                        disabled={readOnly}
                      />
                    </label>
                  ) : null}
                </div>

                {/* Slot 3: GST Certificate */}
                <div className="space-y-2 rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      GST Certificate
                    </label>
                    <span className="text-2xs text-slate-400">PDF, Image</span>
                  </div>

                  {existingDocuments?.gst_document && (
                    <div className="flex items-center justify-between rounded-md border border-amber-200/80 bg-amber-50/70 px-2 py-1 text-2xs dark:border-amber-500/20 dark:bg-amber-950/30">
                      <div className="flex items-center gap-1 truncate">
                        <FileCheck className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="truncate font-medium text-amber-900 dark:text-amber-200">
                          {String(existingDocuments.gst_document.original_name || existingDocuments.gst_document.file_name || "GST Certificate")}
                        </span>
                      </div>
                      <span className="shrink-0 text-2xs text-amber-600 font-semibold ml-1">Existing</span>
                    </div>
                  )}

                  {attachmentFiles?.gst_file ? (
                    <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-2xs dark:border-emerald-500/20 dark:bg-emerald-950/30">
                      <div className="flex items-center gap-1 truncate">
                        <FileCheck className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate font-medium text-emerald-900 dark:text-emerald-200">
                          {attachmentFiles.gst_file.name}
                        </span>
                      </div>
                      {!readOnly && onAttachmentFileChange && (
                        <button
                          type="button"
                          onClick={() => onAttachmentFileChange("gst_file", null)}
                          className="ml-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ) : !readOnly && onAttachmentFileChange ? (
                    <label className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/50 p-2.5 text-center cursor-pointer hover:border-amber-500 hover:bg-amber-50/30 transition dark:border-white/10 dark:bg-slate-800/40">
                      <UploadCloud className="h-3.5 w-3.5 text-slate-400 mb-0.5" />
                      <span className="text-2xs font-semibold text-slate-700 dark:text-slate-300">
                        {existingDocuments?.gst_document ? "Replace GST" : "Attach GST"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            onAttachmentFileChange("gst_file", f);
                            if (!values.kyc_status || values.kyc_status === "Pending") {
                              onChange("kyc_status", "Attached");
                            }
                          }
                        }}
                        disabled={readOnly}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Remarks */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className={labelClass}>
              <AlignLeft className="h-3.5 w-3.5 text-slate-400" />
              Proforma Remarks / Notes
            </label>
            <textarea
              rows={2}
              className={`${inputClass} resize-y`}
              value={values.remarks}
              onChange={(e) => onChange("remarks", e.target.value)}
              placeholder="Any special notes or commercial instructions..."
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      {/* Section 4: Buy Back & Trade-In Details (when enabled by admin) */}
      {isBuyBackEnabled && (
        <div className="rounded-xl border border-indigo-200/90 bg-indigo-50/20 p-4.5 shadow-xs dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <div className="mb-4 flex items-center justify-between border-b border-indigo-100 pb-2.5 dark:border-indigo-900/30">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                <RotateCcw className="h-4 w-4" />
              </span>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Buy Back & Trade-In Information
              </h4>
            </div>
            <span className="text-2xs font-semibold text-indigo-700 dark:text-indigo-300">
              Valuation: {buyBackConfig?.default_valuation_rate ?? 30}% MRP
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className={labelClass}>
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                Buy Back / Exchange Equipment Details
              </label>
              <textarea
                rows={2}
                className={`${inputClass} resize-y`}
                value={values.remarks?.includes("Buy Back:") ? values.remarks : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange(
                    "remarks",
                    val
                      ? `[Buy Back: ${val}] ${values.remarks || ""}`.trim()
                      : values.remarks
                  );
                }}
                placeholder="Equipment model, serial number, and condition for trade-in credit..."
                disabled={readOnly}
              />
              <span className="text-2xs text-slate-500 dark:text-slate-400">
                {buyBackConfig?.terms ||
                  "Buy Back is subject to technical inspection and serial verification."}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
