"use client";

import { useEffect, useState } from "react";
import { X, Paperclip, FileText, Upload, Trash2, Bike, Calculator } from "lucide-react";
import {
  WORK_PLAN_EXPENSE_CATEGORIES,
  WORK_PLAN_EXPENSE_PAYMENT_MODES,
  WORK_PLAN_TRAVEL_SUB_CATEGORIES,
  type WorkPlanExpenseCategory,
  type WorkPlanExpensePaymentMode,
  type WorkPlanExpenseRecord,
  type WorkPlanExpenseTravelSubCategory,
  type WorkPlanVisitRecord,
  type WorkPlanExpenseAttachment,
} from "@/types/workPlanner";
import { useUploadExpenseReceiptMutation } from "@/store/api/workPlannerApiSlice";

const inputClass =
  "w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50";
const labelClass = "mb-1.5 block text-xs font-medium text-muted";

export type ExpenseFormPayload = {
  expense_date: string;
  category: string;
  sub_category?: string;
  amount: number;
  payment_mode: string;
  vendor_name?: string;
  bill_number?: string;
  bill_date?: string;
  description?: string;
  work_plan_visit?: string | null;
  start_reading?: number | null;
  closing_reading?: number | null;
  receipt_attachment?: string | null;
  attachments?: string[] | null;
};

export type ExpenseFormModalProps = {
  open: boolean;
  isSaving: boolean;
  visits?: WorkPlanVisitRecord[];
  initial?: WorkPlanExpenseRecord | null;
  defaultVisitId?: string | null;
  defaultDate?: string | null;
  onClose: () => void;
  onConfirm: (payload: ExpenseFormPayload) => void | Promise<void>;
};

function ymd(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function ExpenseFormModal({
  open,
  isSaving,
  visits = [],
  initial,
  defaultVisitId,
  defaultDate,
  onClose,
  onConfirm,
}: ExpenseFormModalProps) {
  const editing = Boolean(initial?._id || initial?.id);
  const [uploadExpenseReceipt] = useUploadExpenseReceiptMutation();

  const [expenseDate, setExpenseDate] = useState("");
  const [category, setCategory] = useState<WorkPlanExpenseCategory>("Travel");
  const [subCategory, setSubCategory] = useState<WorkPlanExpenseTravelSubCategory>("Cab");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<WorkPlanExpensePaymentMode>("Cash");
  const [vendorName, setVendorName] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState("");
  const [description, setDescription] = useState("");
  const [visitId, setVisitId] = useState("");
  const [startReading, setStartReading] = useState("");
  const [closingReading, setClosingReading] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<(WorkPlanExpenseAttachment | string)[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (initial) {
        setExpenseDate(ymd(initial.expense_date));
        setCategory(initial.category || "Travel");
        setSubCategory((initial.sub_category as WorkPlanExpenseTravelSubCategory) || "Cab");
        setAmount(initial.amount != null ? String(initial.amount) : "");
        setPaymentMode(initial.payment_mode || "Cash");
        setVendorName(initial.vendor_name || "");
        setBillNumber(initial.bill_number || "");
        setBillDate(ymd(initial.bill_date));
        setDescription(initial.description || "");
        setVisitId(
          typeof initial.work_plan_visit === "object" && initial.work_plan_visit
            ? initial.work_plan_visit._id || ""
            : (initial.work_plan_visit as string) || ""
        );
        setStartReading(initial.start_reading != null ? String(initial.start_reading) : "");
        setClosingReading(initial.closing_reading != null ? String(initial.closing_reading) : "");
        
        // Extract existing attachments (support array and single receipt_attachment)
        const atts: (WorkPlanExpenseAttachment | string)[] = [];
        if (Array.isArray(initial.attachments) && initial.attachments.length > 0) {
          atts.push(...initial.attachments);
        } else if (initial.receipt_attachment) {
          atts.push(initial.receipt_attachment);
        }
        setExistingAttachments(atts);
      } else {
        setExpenseDate(ymd(defaultDate) || ymd(new Date()));
        setCategory("Travel");
        setSubCategory("Cab");
        setAmount("");
        setPaymentMode("Cash");
        setVendorName("");
        setBillNumber("");
        setBillDate("");
        setDescription("");
        setVisitId(defaultVisitId || "");
        setStartReading("");
        setClosingReading("");
        setExistingAttachments([]);
      }
      setSelectedFiles([]);
      setErrors({});
    }
  }, [open, initial, defaultVisitId, defaultDate]);

  const isPrivateBike = category === "Travel" && subCategory === "Private Bike";

  // Reactive calculation for Private Bike (3.5 rupees per km)
  const startNum = parseFloat(startReading);
  const closingNum = parseFloat(closingReading);
  const hasValidReadings =
    !isNaN(startNum) &&
    !isNaN(closingNum) &&
    closingNum >= startNum &&
    startNum >= 0;
  const calculatedKm = hasValidReadings ? Math.round((closingNum - startNum) * 100) / 100 : 0;
  const calculatedBikeAmount = hasValidReadings ? Math.round(calculatedKm * 3.5 * 100) / 100 : 0;

  // Auto calculate amount when readings change for Private Bike
  const handleStartReadingChange = (val: string) => {
    setStartReading(val);
    if (isPrivateBike) {
      const s = parseFloat(val);
      const c = parseFloat(closingReading);
      if (!isNaN(s) && !isNaN(c) && c >= s && s >= 0) {
        const km = Math.round((c - s) * 100) / 100;
        setAmount(String(Math.round(km * 3.5 * 100) / 100));
      }
    }
  };

  const handleClosingReadingChange = (val: string) => {
    setClosingReading(val);
    if (isPrivateBike) {
      const s = parseFloat(startReading);
      const c = parseFloat(val);
      if (!isNaN(s) && !isNaN(c) && c >= s && s >= 0) {
        const km = Math.round((c - s) * 100) / 100;
        setAmount(String(Math.round(km * 3.5 * 100) / 100));
      }
    }
  };

  if (!open) return null;

  const numAmt = Number(amount) || 0;
  const isDocumentRequired = numAmt > 200;
  const totalAttachmentsCount = selectedFiles.length + existingAttachments.length;
  const minExpenseDate = defaultDate ? ymd(defaultDate) : undefined;
  const maxExpenseDate = defaultDate
    ? (() => {
        const d = new Date(defaultDate);
        d.setUTCDate(d.getUTCDate() + 2);
        return ymd(d);
      })()
    : undefined;

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!expenseDate) {
      errs.expenseDate = "Expense date is required";
    } else if (minExpenseDate && maxExpenseDate) {
      if (expenseDate < minExpenseDate || expenseDate > maxExpenseDate) {
        errs.expenseDate = `Expenses can only be added from ${minExpenseDate} through ${maxExpenseDate} (3 days total). Earlier or later entries are not allowed.`;
      }
    }
    if (!amount || Number.isNaN(numAmt) || numAmt < 0) {
      errs.amount = "Valid non-negative amount is required";
    }

    if (isPrivateBike) {
      const sr = Number(startReading);
      const cr = Number(closingReading);
      if (startReading === "" || Number.isNaN(sr) || sr < 0) {
        errs.startReading = "Valid start reading is required for Private Bike";
      }
      if (closingReading === "" || Number.isNaN(cr) || cr < 0) {
        errs.closingReading = "Valid closing reading is required for Private Bike";
      }
      if (!errs.startReading && !errs.closingReading && cr < sr) {
        errs.closingReading = "Closing reading must be greater than or equal to start reading";
      }
    }

    const hasAttachment = totalAttachmentsCount > 0;
    if (isDocumentRequired && !hasAttachment) {
      errs.receiptAttachment = "Document / receipt upload is required for expenses greater than ₹200";
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsUploading(true);
    try {
      const allAttachmentIds: string[] = [];

      // Add existing attachment IDs
      for (const att of existingAttachments) {
        if (typeof att === "string") {
          allAttachmentIds.push(att);
        } else if (att && typeof att === "object") {
          const id = (att as any)._id || (att as any).id || "";
          if (id) allAttachmentIds.push(id);
        }
      }

      // Upload newly selected files
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append("file", file);
          const uploaded = await uploadExpenseReceipt(formData).unwrap();
          if (uploaded && (uploaded._id || uploaded.id)) {
            allAttachmentIds.push(uploaded._id || uploaded.id);
          }
        }
      }

      const primaryReceiptId = allAttachmentIds.length > 0 ? allAttachmentIds[0] : null;

      await onConfirm({
        expense_date: expenseDate,
        category,
        sub_category: category === "Travel" ? subCategory : undefined,
        amount: numAmt,
        payment_mode: paymentMode,
        vendor_name: vendorName.trim() || undefined,
        bill_number: billNumber.trim() || undefined,
        bill_date: billDate || undefined,
        description: description.trim() || undefined,
        work_plan_visit: visitId || null,
        start_reading: isPrivateBike ? Number(startReading) : null,
        closing_reading: isPrivateBike ? Number(closingReading) : null,
        receipt_attachment: primaryReceiptId,
        attachments: allAttachmentIds,
      });
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to upload document";
      setErrors((prev) => ({ ...prev, receiptAttachment: msg }));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="presentation"
      onClick={() => !isSaving && !isUploading && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-lg max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between border-b border-border px-4 sm:px-5 py-3.5 sm:py-4 bg-surface-muted/30">
          <div>
            <h2 className="text-base font-bold text-foreground">
              {editing ? "Edit Expense Claim" : "Log Expense Claim"}
            </h2>
            <p className="text-[11px] sm:text-xs text-muted">
              Record travel, meal, or field expenses for reimbursement.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isUploading}
            className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 px-4 sm:px-5 py-3.5 sm:py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                Expense Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={expenseDate}
                min={minExpenseDate}
                max={maxExpenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                disabled={isSaving || isUploading}
                className={inputClass}
              />
              {minExpenseDate && maxExpenseDate ? (
                <p className="mt-1 text-[11px] text-muted">
                  3-day window: {minExpenseDate} to {maxExpenseDate}
                </p>
              ) : null}
              {errors.expenseDate ? (
                <p className="mt-1 text-xs text-rose-500">{errors.expenseDate}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClass}>
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as WorkPlanExpenseCategory)}
                disabled={isSaving || isUploading}
                className={inputClass}
              >
                {WORK_PLAN_EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {category === "Travel" ? (
            <div>
              <label className={labelClass}>Travel Mode / Sub-Category</label>
              <select
                value={subCategory}
                onChange={(e) =>
                  setSubCategory(e.target.value as WorkPlanExpenseTravelSubCategory)
                }
                disabled={isSaving || isUploading}
                className={inputClass}
              >
                {WORK_PLAN_TRAVEL_SUB_CATEGORIES.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {isPrivateBike ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Bike className="h-4 w-4" />
                  Private Bike Mileage Calculator
                </div>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                  ₹3.50 / KM
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Start Odometer (KM) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={startReading}
                    onChange={(e) => handleStartReadingChange(e.target.value)}
                    disabled={isSaving || isUploading}
                    placeholder="e.g. 12450"
                    className={inputClass}
                  />
                  {errors.startReading ? (
                    <p className="mt-1 text-xs text-rose-500">{errors.startReading}</p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass}>Closing Odometer (KM) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={closingReading}
                    onChange={(e) => handleClosingReadingChange(e.target.value)}
                    disabled={isSaving || isUploading}
                    placeholder="e.g. 12510"
                    className={inputClass}
                  />
                  {errors.closingReading ? (
                    <p className="mt-1 text-xs text-rose-500">{errors.closingReading}</p>
                  ) : null}
                </div>
              </div>

              {hasValidReadings ? (
                <div className="flex items-center justify-between rounded-md bg-card p-2 text-xs border border-primary/20">
                  <div className="flex items-center gap-1.5 text-muted">
                    <Calculator className="h-3.5 w-3.5 text-primary" />
                    <span>
                      Distance: <strong className="text-foreground">{calculatedKm} KM</strong> × ₹3.5/km
                    </span>
                  </div>
                  <div className="font-bold text-primary text-sm">
                    = ₹{calculatedBikeAmount.toFixed(2)}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted italic">
                  Enter start & closing readings to automatically compute distance and amount at ₹3.5/km.
                </p>
              )}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isSaving || isUploading}
                placeholder="0.00"
                className={inputClass}
              />
              {errors.amount ? (
                <p className="mt-1 text-xs text-rose-500">{errors.amount}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClass}>
                Payment Mode <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as WorkPlanExpensePaymentMode)}
                disabled={isSaving || isUploading}
                className={inputClass}
              >
                {WORK_PLAN_EXPENSE_PAYMENT_MODES.map((modeOption) => (
                  <option key={modeOption} value={modeOption}>
                    {modeOption}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {visits && visits.length > 0 ? (
            <div>
              <label className={labelClass}>Associated Visit (Optional)</label>
              <select
                value={visitId}
                onChange={(e) => setVisitId(e.target.value)}
                disabled={isSaving || isUploading}
                className={inputClass}
              >
                <option value="">-- General Plan Expense --</option>
                {visits.map((v, i) => (
                  <option key={v._id || v.id || i} value={v._id || v.id}>
                    #{v.sequence ?? i + 1} — {v.party_name || (typeof v.party === "object" && v.party?.party_name) || "Visit"}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Vendor Name</label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                disabled={isSaving || isUploading}
                placeholder="Hotel / Fuel Station"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Bill Number</label>
              <input
                type="text"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                disabled={isSaving || isUploading}
                placeholder="INV-10293"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Bill Date</label>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                disabled={isSaving || isUploading}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Description / Remarks</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving || isUploading}
              rows={2}
              placeholder="Notes on expense context..."
              className={inputClass}
            />
          </div>

          {/* Multiple Attachments Upload Support */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-muted">
                Receipts / Attachments{" "}
                {isDocumentRequired ? (
                  <span className="text-rose-500 font-semibold">* (Required for &gt; ₹200)</span>
                ) : (
                  <span className="text-muted text-[11px]">(Optional for ≤ ₹200)</span>
                )}
              </label>
              {totalAttachmentsCount > 0 ? (
                <span className="text-[11px] font-semibold text-primary">
                  {totalAttachmentsCount} {totalAttachmentsCount === 1 ? "file" : "files"} attached
                </span>
              ) : null}
            </div>

            {/* List of existing & selected attachments */}
            {totalAttachmentsCount > 0 ? (
              <div className="space-y-1.5 mb-2.5">
                {existingAttachments.map((att, idx) => {
                  const docName =
                    typeof att === "object"
                      ? att.original_name || att.file_name || `Existing Document #${idx + 1}`
                      : `Attachment #${idx + 1}`;
                  return (
                    <div
                      key={`existing-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2 overflow-hidden text-foreground">
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate font-medium">{docName}</span>
                        <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                          Saved
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={isSaving || isUploading}
                        onClick={() => {
                          setExistingAttachments((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition"
                        title="Remove document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}

                {selectedFiles.map((file, idx) => (
                  <div
                    key={`new-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden text-foreground">
                      <FileText className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="truncate font-medium">{file.name}</span>
                      <span className="text-[10px] text-muted">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isSaving || isUploading}
                      onClick={() => {
                        setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition"
                      title="Remove file"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Upload Button */}
            <div className="relative">
              <input
                type="file"
                id="expense-doc-upload"
                multiple
                accept="image/*,application/pdf,.doc,.docx"
                disabled={isSaving || isUploading}
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (files.length > 0) {
                    setSelectedFiles((prev) => [...prev, ...files]);
                    if (errors.receiptAttachment) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.receiptAttachment;
                        return next;
                      });
                    }
                  }
                  // Reset input value so same files can be re-selected if removed
                  e.target.value = "";
                }}
                className="hidden"
              />
              <label
                htmlFor="expense-doc-upload"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-muted/60 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-surface-muted transition"
              >
                <Upload className="h-4 w-4 text-primary" />
                {totalAttachmentsCount > 0 ? "+ Add More Receipts / Files" : "Choose Receipts / Documents (Images, PDF - Multiple Allowed)"}
              </label>
            </div>

            {errors.receiptAttachment ? (
              <p className="mt-1 text-xs font-medium text-rose-500">{errors.receiptAttachment}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 border-t border-border px-4 sm:px-5 py-3.5 bg-surface-muted/50 shrink-0">
          <button
            type="button"
            disabled={isSaving || isUploading}
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-border bg-card px-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground hover:bg-surface-muted active:scale-[0.98] disabled:opacity-50 transition cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving || isUploading}
            onClick={handleSave}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 transition cursor-pointer shadow-md"
          >
            {isUploading ? "Uploading Documents…" : isSaving ? "Saving…" : editing ? "Save Changes" : "Submit Claim"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExpenseFormModal;

