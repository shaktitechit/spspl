"use client";

import { useRef } from "react";
import { usePortalSettings } from "@/hooks/usePortalSettings";
import {
  FileText,
  Upload,
  CheckCircle2,
  X,
  Paperclip,
  UserCheck,
  Truck,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";

export type PerformaFormState = {
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
  po_file?: File | null;
  cost_sheet_file?: File | null;
  aadhaar_file?: File | null;
  pan_file?: File | null;
  gst_file?: File | null;
  kyc_files?: File[];
};

export const INITIAL_PERFORMA_STATE: PerformaFormState = {
  sales_person: "",
  freight_charges: "Included",
  orc: "",
  transport: "",
  dispatch_date: "",
  ship_to_address: "",
  payment_terms: "30 days",
  customer_type: "Direct Customer",
  installation_required: "",
  gst_concession: "",
  margin_sheet_attached: "",
  kyc_status: "",
  remarks: "",
  po_file: null,
  cost_sheet_file: null,
  aadhaar_file: null,
  pan_file: null,
  gst_file: null,
  kyc_files: [],
};

const FREIGHT_OPTIONS = ["Included", "Extra at Actual", "To Pay", "FOC", "Custom"];
const PAYMENT_TERM_OPTIONS = [
  "100% Advance",
  "50% Advance, 50% Before Dispatch",
  "Against Delivery (COD)",
  "7 days",
  "15 days",
  "30 days",
  "45 days",
  "60 days",
  "90 days",
  "PDC",
  "LC",
  "Custom",
];
const CUSTOMER_TYPE_OPTIONS = [
  "Direct Customer",
  "Dealer",
  "Distributor",
  "Hospital",
  "Government",
  "Institutional",
  "Other",
];
const YES_NO_NA_OPTIONS = [
  { label: "Select...", value: "" },
  { label: "Yes", value: "Yes" },
  { label: "No", value: "No" },
  { label: "N/A", value: "N/A" },
];
const ATTACHED_STATUS_OPTIONS = [
  { label: "Select...", value: "" },
  { label: "Attached", value: "Attached" },
  { label: "Pending", value: "Pending" },
  { label: "Verified", value: "Verified" },
  { label: "Not Required", value: "Not Required" },
];

type Props = {
  value: PerformaFormState;
  onChange: (next: PerformaFormState) => void;
  disabled?: boolean;
  showFileUploads?: boolean;
  existingDocs?: {
    po?: { _id: string; original_name?: string; url?: string } | null;
    costSheet?: { _id: string; original_name?: string; url?: string } | null;
    aadhaar?: { _id: string; original_name?: string; url?: string } | null;
    pan?: { _id: string; original_name?: string; url?: string } | null;
    gst?: { _id: string; original_name?: string; url?: string } | null;
    kyc?: Array<{ _id: string; original_name?: string; url?: string }>;
  };
};

export function PerformaInvoiceFields({
  value,
  onChange,
  disabled = false,
  showFileUploads = true,
  existingDocs,
}: Props) {
  const {
    isPerformaEnabled,
    isCostSheetEnabled,
    isKycEnabled,
    isPOEnabled,
    isBuyBackEnabled,
  } = usePortalSettings();

  const poInputRef = useRef<HTMLInputElement>(null);
  const costSheetInputRef = useRef<HTMLInputElement>(null);
  const aadhaarInputRef = useRef<HTMLInputElement>(null);
  const panInputRef = useRef<HTMLInputElement>(null);
  const gstInputRef = useRef<HTMLInputElement>(null);
  const kycInputRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<PerformaFormState>) => {
    onChange({ ...value, ...patch });
  };

  const isPresetFreight = FREIGHT_OPTIONS.slice(0, -1).includes(value.freight_charges);
  const isPresetPayment = PAYMENT_TERM_OPTIONS.slice(0, -1).includes(value.payment_terms);

  const inputBase =
    "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-2xs transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/15 disabled:bg-slate-50 disabled:text-slate-400";
  const labelBase =
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600";

  return (
    <div className="space-y-5">
      {/* SECTION 1: SALES & COMMERCIAL TERMS */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="mb-3.5 flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-50 text-teal-600">
            <UserCheck className="h-3.5 w-3.5" />
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Sales & Commercial Terms
          </h4>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 1. Sales Person */}
          <div>
            <label className={labelBase}>1. Sales Person</label>
            <input
              type="text"
              disabled={disabled}
              value={value.sales_person}
              onChange={(e) => update({ sales_person: e.target.value })}
              placeholder="Sales representative name"
              className={inputBase}
            />
          </div>

          {/* 2. Customer Type */}
          <div>
            <label className={labelBase}>2. Customer Type</label>
            <select
              disabled={disabled}
              value={value.customer_type}
              onChange={(e) => update({ customer_type: e.target.value })}
              className={inputBase}
            >
              <option value="">Select type...</option>
              {CUSTOMER_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Payment Terms */}
          <div>
            <label className={labelBase}>3. Payment Terms</label>
            <div className="flex gap-1.5">
              <select
                disabled={disabled}
                value={isPresetPayment ? value.payment_terms : "Custom"}
                onChange={(e) => {
                  const v = e.target.value;
                  update({ payment_terms: v === "Custom" ? "" : v });
                }}
                className={inputBase}
              >
                {PAYMENT_TERM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {!isPresetPayment && (
                <input
                  type="text"
                  disabled={disabled}
                  value={value.payment_terms}
                  onChange={(e) => update({ payment_terms: e.target.value })}
                  placeholder="Custom terms..."
                  className={inputBase}
                />
              )}
            </div>
          </div>

          {/* 4. Freight Charges */}
          <div>
            <label className={labelBase}>4. Freight Charges</label>
            <div className="flex gap-1.5">
              <select
                disabled={disabled}
                value={isPresetFreight ? value.freight_charges : "Custom"}
                onChange={(e) => {
                  const v = e.target.value;
                  update({ freight_charges: v === "Custom" ? "" : v });
                }}
                className={inputBase}
              >
                {FREIGHT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {!isPresetFreight && (
                <input
                  type="text"
                  disabled={disabled}
                  value={value.freight_charges}
                  onChange={(e) => update({ freight_charges: e.target.value })}
                  placeholder="Specify freight..."
                  className={inputBase}
                />
              )}
            </div>
          </div>

          {/* 5. ORC */}
          <div>
            <label className={labelBase}>5. ORC (Override Commission)</label>
            <input
              type="text"
              disabled={disabled}
              value={value.orc}
              onChange={(e) => update({ orc: e.target.value })}
              placeholder="e.g. Nil / 5% / ₹2,000"
              className={inputBase}
            />
          </div>

          {/* 6. GST Concession */}
          <div>
            <label className={labelBase}>6. GST Concession</label>
            <select
              disabled={disabled}
              value={value.gst_concession}
              onChange={(e) => update({ gst_concession: e.target.value })}
              className={inputBase}
            >
              {YES_NO_NA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 2: LOGISTICS & DELIVERY */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="mb-3.5 flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <Truck className="h-3.5 w-3.5" />
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Logistics & Delivery
          </h4>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 7. Transport */}
          <div>
            <label className={labelBase}>7. Transport / Carrier</label>
            <input
              type="text"
              disabled={disabled}
              value={value.transport}
              onChange={(e) => update({ transport: e.target.value })}
              placeholder="Preferred transporter / courier"
              className={inputBase}
            />
          </div>

          {/* 8. Dispatch Date */}
          <div>
            <label className={labelBase}>8. Dispatch Date</label>
            <input
              type="date"
              disabled={disabled}
              value={value.dispatch_date ? value.dispatch_date.slice(0, 10) : ""}
              onChange={(e) => update({ dispatch_date: e.target.value })}
              className={inputBase}
            />
          </div>

          {/* 9. Installation Required */}
          <div>
            <label className={labelBase}>9. Installation Required</label>
            <select
              disabled={disabled}
              value={value.installation_required}
              onChange={(e) => update({ installation_required: e.target.value })}
              className={inputBase}
            >
              {YES_NO_NA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 10. Ship to Address (Full Width) */}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelBase}>10. Ship to Address</label>
            <textarea
              rows={2}
              disabled={disabled}
              value={value.ship_to_address}
              onChange={(e) => update({ ship_to_address: e.target.value })}
              placeholder="Complete shipping destination address..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-2xs transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/15 disabled:bg-slate-50"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: COMPLIANCE, DOCUMENTS & ATTACHMENTS */}
      {(isPOEnabled || isCostSheetEnabled || isKycEnabled) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="mb-3.5 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              {isKycEnabled && (isPOEnabled || isCostSheetEnabled)
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

          <div className="space-y-4">
            {/* Primary Order Documents: PO & Cost Sheet + Statuses */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* PO Attachment */}
              {showFileUploads && isPOEnabled && (
                <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        Purchase Order (PO)
                      </span>
                      {(value.po_file || existingDocs?.po) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" /> Attached
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Customer PO PDF / Image
                    </p>
                  </div>

                  <div className="mt-2.5">
                    <input
                      ref={poInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      className="hidden"
                      disabled={disabled}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        update({ po_file: f });
                      }}
                    />
                    {value.po_file ? (
                      <div className="flex items-center justify-between rounded-md border border-teal-200 bg-teal-50/60 px-2.5 py-1.5 text-xs">
                        <span className=" flex items-center gap-1.5 font-medium text-teal-900">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                          <span className="">{value.po_file.name}</span>
                        </span>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            update({ po_file: null });
                            if (poInputRef.current) poInputRef.current.value = "";
                          }}
                          className="ml-2 text-slate-400 hover:text-red-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : existingDocs?.po ? (
                      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                        <a
                          href={existingDocs.po.url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className=" font-medium text-teal-700 hover:underline"
                        >
                          {existingDocs.po.original_name || "View PO Document"}
                        </a>
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => poInputRef.current?.click()}
                            className="ml-2 shrink-0 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                          >
                            Replace
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => poInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700 disabled:opacity-50"
                      >
                        <Upload className="h-3.5 w-3.5" /> Upload PO
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Cost Sheet / Margin Sheet Attachment */}
              {showFileUploads && isCostSheetEnabled && (
                <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        Cost Sheet (Margin Sheet)
                      </span>
                      {(value.cost_sheet_file || existingDocs?.costSheet) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" /> Attached
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Auto-marks Margin Sheet Attached
                    </p>
                  </div>

                  <div className="mt-2.5">
                    <input
                      ref={costSheetInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.csv"
                      className="hidden"
                      disabled={disabled}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        update({
                          cost_sheet_file: f,
                          margin_sheet_attached: f ? "Attached" : value.margin_sheet_attached,
                        });
                      }}
                    />
                    {value.cost_sheet_file ? (
                      <div className="flex items-center justify-between rounded-md border border-teal-200 bg-teal-50/60 px-2.5 py-1.5 text-xs">
                        <span className=" flex items-center gap-1.5 font-medium text-teal-900">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                          <span className="">{value.cost_sheet_file.name}</span>
                        </span>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            update({ cost_sheet_file: null });
                            if (costSheetInputRef.current) costSheetInputRef.current.value = "";
                          }}
                          className="ml-2 text-slate-400 hover:text-red-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : existingDocs?.costSheet ? (
                      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                        <a
                          href={existingDocs.costSheet.url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className=" font-medium text-teal-700 hover:underline"
                        >
                          {existingDocs.costSheet.original_name || "View Cost Sheet"}
                        </a>
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => costSheetInputRef.current?.click()}
                            className="ml-2 shrink-0 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                          >
                            Replace
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => costSheetInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700 disabled:opacity-50"
                      >
                        <Upload className="h-3.5 w-3.5" /> Upload Cost Sheet
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 11. Margin Sheet Status */}
              {isCostSheetEnabled && (
                <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                  <label className={labelBase}>11. Margin Sheet Status</label>
                  <select
                    disabled={disabled}
                    value={value.margin_sheet_attached}
                    onChange={(e) => update({ margin_sheet_attached: e.target.value })}
                    className={inputBase}
                  >
                    {ATTACHED_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Updated automatically when Cost Sheet is attached
                  </p>
                </div>
              )}

              {/* 12. KYC Status */}
              {isKycEnabled && (
                <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                  <label className={labelBase}>12. KYC Status</label>
                  <select
                    disabled={disabled}
                    value={value.kyc_status}
                    onChange={(e) => update({ kyc_status: e.target.value })}
                    className={inputBase}
                  >
                    {ATTACHED_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Updated automatically when KYC docs are uploaded
                  </p>
                </div>
              )}
            </div>

            {/* Dedicated KYC Document Uploads: Aadhaar, PAN, GST */}
            {showFileUploads && isKycEnabled && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3.5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h5 className="text-xs font-bold text-slate-800">
                    KYC Verification Documents (Aadhaar, PAN & GST)
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    Upload customer identity & tax registration documents
                  </p>
                </div>
                {(value.aadhaar_file ||
                  value.pan_file ||
                  value.gst_file ||
                  existingDocs?.aadhaar ||
                  existingDocs?.pan ||
                  existingDocs?.gst ||
                  (value.kyc_files && value.kyc_files.length > 0) ||
                  (existingDocs?.kyc && existingDocs.kyc.length > 0)) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" /> KYC Attached
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Aadhaar Card */}
                <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Aadhaar Card
                    </span>
                    {(value.aadhaar_file || existingDocs?.aadhaar) && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                  <input
                    ref={aadhaarInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    disabled={disabled}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      update({
                        aadhaar_file: f,
                        kyc_status: f ? "Attached" : value.kyc_status,
                      });
                    }}
                  />
                  {value.aadhaar_file ? (
                    <div className="flex items-center justify-between rounded border border-teal-200 bg-teal-50/60 px-2 py-1 text-xs">
                      <span className=" font-medium text-teal-900">
                        {value.aadhaar_file.name}
                      </span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          update({ aadhaar_file: null });
                          if (aadhaarInputRef.current) aadhaarInputRef.current.value = "";
                        }}
                        className="ml-1.5 text-slate-400 hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : existingDocs?.aadhaar ? (
                    <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                      <a
                        href={existingDocs.aadhaar.url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className=" font-medium text-teal-700 hover:underline"
                      >
                        {existingDocs.aadhaar.original_name || "View Aadhaar"}
                      </a>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => aadhaarInputRef.current?.click()}
                          className="ml-2 text-[11px] text-slate-500 hover:text-slate-900"
                        >
                          Replace
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => aadhaarInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-slate-300 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-teal-500 hover:bg-white hover:text-teal-700 disabled:opacity-50"
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload Aadhaar
                    </button>
                  )}
                </div>

                {/* PAN Card */}
                <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      PAN Card
                    </span>
                    {(value.pan_file || existingDocs?.pan) && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                  <input
                    ref={panInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    disabled={disabled}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      update({
                        pan_file: f,
                        kyc_status: f ? "Attached" : value.kyc_status,
                      });
                    }}
                  />
                  {value.pan_file ? (
                    <div className="flex items-center justify-between rounded border border-teal-200 bg-teal-50/60 px-2 py-1 text-xs">
                      <span className=" font-medium text-teal-900">
                        {value.pan_file.name}
                      </span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          update({ pan_file: null });
                          if (panInputRef.current) panInputRef.current.value = "";
                        }}
                        className="ml-1.5 text-slate-400 hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : existingDocs?.pan ? (
                    <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                      <a
                        href={existingDocs.pan.url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className=" font-medium text-teal-700 hover:underline"
                      >
                        {existingDocs.pan.original_name || "View PAN"}
                      </a>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => panInputRef.current?.click()}
                          className="ml-2 text-[11px] text-slate-500 hover:text-slate-900"
                        >
                          Replace
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => panInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-slate-300 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-teal-500 hover:bg-white hover:text-teal-700 disabled:opacity-50"
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload PAN
                    </button>
                  )}
                </div>

                {/* GST Certificate */}
                <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      GST Certificate
                    </span>
                    {(value.gst_file || existingDocs?.gst) && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                  <input
                    ref={gstInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    disabled={disabled}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      update({
                        gst_file: f,
                        kyc_status: f ? "Attached" : value.kyc_status,
                      });
                    }}
                  />
                  {value.gst_file ? (
                    <div className="flex items-center justify-between rounded border border-teal-200 bg-teal-50/60 px-2 py-1 text-xs">
                      <span className=" font-medium text-teal-900">
                        {value.gst_file.name}
                      </span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          update({ gst_file: null });
                          if (gstInputRef.current) gstInputRef.current.value = "";
                        }}
                        className="ml-1.5 text-slate-400 hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : existingDocs?.gst ? (
                    <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                      <a
                        href={existingDocs.gst.url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className=" font-medium text-teal-700 hover:underline"
                      >
                        {existingDocs.gst.original_name || "View GST"}
                      </a>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => gstInputRef.current?.click()}
                          className="ml-2 text-[11px] text-slate-500 hover:text-slate-900"
                        >
                          Replace
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => gstInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-slate-300 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-teal-500 hover:bg-white hover:text-teal-700 disabled:opacity-50"
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload GST
                    </button>
                  )}
                </div>
              </div>

              {/* Additional / Other KYC Documents */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {existingDocs?.kyc?.map((k) => (
                    <a
                      key={k._id}
                      href={k.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-teal-700 hover:underline"
                    >
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="max-w-[160px] ">
                        {k.original_name || "KYC Doc"}
                      </span>
                    </a>
                  ))}
                  {value.kyc_files?.map((f, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-900"
                    >
                      <span className="max-w-[150px] ">{f.name}</span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          const next = (value.kyc_files || []).filter(
                            (_, i) => i !== idx
                          );
                          update({ kyc_files: next });
                        }}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div>
                  <input
                    ref={kycInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    disabled={disabled}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length) {
                        const next = [...(value.kyc_files || []), ...files];
                        update({
                          kyc_files: next,
                          kyc_status: "Attached",
                        });
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => kycInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-50"
                  >
                    <Upload className="h-3 w-3" /> + Add Other KYC Document (Drug License / Cancelled Cheque)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* SECTION 4: REMARKS */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="mb-2.5 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <MessageSquare className="h-3.5 w-3.5" />
          </div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
            13. Additional Notes / Remarks
          </label>
        </div>
        <textarea
          rows={2}
          disabled={disabled}
          value={value.remarks}
          onChange={(e) => update({ remarks: e.target.value })}
          placeholder="Special billing, dispatch, or commercial instructions..."
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-2xs transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/15 disabled:bg-slate-50"
        />
      </div>
    </div>
  );
}

