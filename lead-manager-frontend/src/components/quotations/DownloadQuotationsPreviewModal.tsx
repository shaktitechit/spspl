/**
 * @fileoverview Download Quotations Preview Modal with Column Selector, Live Table Preview, and Multi-Format Exports (.xlsx, .csv, .pdf).
 * @module components/portal/shared/quotations/DownloadQuotationsPreviewModal
 */
"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
  CheckSquare,
  Square,
  Columns,
  Eye,
  Info,
} from "lucide-react";
import { LargeModalPortal } from "@/components/portal/shared/LargeModalPortal";
import { ModalOverlay } from "@/components/portal/shared/ModalOverlay";
import { toast } from "@/lib/toast";
import {
  downloadTableXlsx,
  downloadTablePdf,
  type ExportTableColumn,
  type ExportTableRow,
} from "@/components/portal/shared/exportTableDownloads";
import { usePdfCompanyLetterhead } from "@/components/portal/shared/pdfCompanyLetterhead";
import { useAppSelector } from "@/store/hooks";
import { readSessionFromStorage } from "@/utils/authStorage";
import { formatCurrencyINR } from "./quotationUtils";
import type { QuotationRecord } from "@/store/api";

function formatDateDisplay(d?: string | Date): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(d);
  }
}

export type QuotationColumnDef = {
  key: string;
  label: string;
  defaultSelected?: boolean;
  widthPdf?: number;
};

export const DEFAULT_QUOTATION_COLUMNS: QuotationColumnDef[] = [
  { key: "quotation_no", label: "Quotation No*", defaultSelected: true, widthPdf: 1.2 },
  { key: "quotation_date", label: "Date*", defaultSelected: true, widthPdf: 1 },
  { key: "customer_name", label: "Customer Name*", defaultSelected: true, widthPdf: 1.8 },
  { key: "kind_attn", label: "Contact Person", defaultSelected: true, widthPdf: 1.2 },
  { key: "phone", label: "Phone", defaultSelected: false, widthPdf: 1.1 },
  { key: "email", label: "Email", defaultSelected: false, widthPdf: 1.3 },
  { key: "city", label: "City", defaultSelected: false, widthPdf: 1 },
  { key: "sales_person_name", label: "Sales Rep*", defaultSelected: true, widthPdf: 1.2 },
  { key: "items_count", label: "Items Qty", defaultSelected: true, widthPdf: 0.8 },
  { key: "subtotal_fmt", label: "Subtotal (₹)", defaultSelected: false, widthPdf: 1.2 },
  { key: "discount_fmt", label: "Discount (₹)", defaultSelected: false, widthPdf: 1.1 },
  { key: "gst_fmt", label: "Total GST (₹)", defaultSelected: false, widthPdf: 1.1 },
  { key: "grand_total_fmt", label: "Grand Total (₹)*", defaultSelected: true, widthPdf: 1.4 },
  { key: "status_label", label: "Status*", defaultSelected: true, widthPdf: 1 },
  { key: "valid_until", label: "Valid Until", defaultSelected: true, widthPdf: 1 },
  { key: "customer_po_number", label: "PO Number", defaultSelected: false, widthPdf: 1 },
  { key: "payment_terms", label: "Payment Terms", defaultSelected: false, widthPdf: 1.2 },
];

export type DownloadQuotationsPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  quotations: QuotationRecord[];
  title?: string;
  subtitle?: string;
};

export function DownloadQuotationsPreviewModal({
  open,
  onClose,
  quotations,
  title = "Export Quotations Master Preview",
  subtitle = "Customize columns, preview formatted commercial figures, and export directly to Excel (.xlsx), CSV, or PDF.",
}: DownloadQuotationsPreviewModalProps) {
  const letterhead = usePdfCompanyLetterhead();
  const reduxUser = useAppSelector((s) => s.auth.user);
  const sessionUser = useMemo(() => (typeof window !== "undefined" ? readSessionFromStorage()?.user || null : null), []);
  const authUser = (reduxUser || sessionUser) as any;
  const downloadedBy = useMemo(() => {
    if (!authUser) return "User";
    const name = String(authUser.name || "").trim();
    if (name && name !== "Authorized Staff" && name !== "Authorized User") return name;
    const first = String(authUser.first_name || "").trim();
    const last = String(authUser.last_name || "").trim();
    const full = `${first} ${last}`.trim();
    if (full) return full;
    return "User";
  }, [authUser]);

  // Transform raw quotation records to tabular rows
  const tableRows = useMemo(() => {
    return quotations.map((q) => {
      const itemsCount = Array.isArray(q.items) ? q.items.length : 0;
      const salesName =
        q.sales_person_name ||
        (typeof q.sales_person_user === "object" && q.sales_person_user !== null
          ? (q.sales_person_user as any).name
          : "") ||
        "Sales Executive";

      return {
        _id: q._id,
        quotation_no: q.quotation_no || "—",
        quotation_date: formatDateDisplay(q.quotation_date),
        customer_name: q.customer_name || "—",
        kind_attn: q.kind_attn || "—",
        phone: q.phone || "—",
        email: q.email || "—",
        city: q.address?.city || "—",
        sales_person_name: salesName,
        items_count: itemsCount,
        subtotal_fmt: formatCurrencyINR(q.subtotal || 0),
        discount_fmt: formatCurrencyINR((q as any).total_discount || (q as any).discount_amount || 0),
        gst_fmt: formatCurrencyINR(q.total_gst || 0),
        grand_total_fmt: formatCurrencyINR(q.grand_total || 0),
        raw_grand_total: q.grand_total || 0,
        status_label: (q.status || "draft").toUpperCase().replace(/_/g, " "),
        valid_until: q.valid_until ? formatDateDisplay(q.valid_until) : "—",
        customer_po_number: q.customer_po_number || q.proforma_details?.customer_po_number || "—",
        payment_terms: q.payment_terms || "—",
      };
    });
  }, [quotations]);

  // Column selection state
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    DEFAULT_QUOTATION_COLUMNS.forEach((col) => {
      initial[col.key] = col.defaultSelected !== false;
    });
    return initial;
  });

  const selectedColumns = useMemo(() => {
    return DEFAULT_QUOTATION_COLUMNS.filter((col) => selectedColumnKeys[col.key]);
  }, [selectedColumnKeys]);

  const selectedCount = selectedColumns.length;
  const isAllSelected = selectedCount === DEFAULT_QUOTATION_COLUMNS.length;

  const handleToggleColumn = (key: string) => {
    setSelectedColumnKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectAll = () => {
    const next: Record<string, boolean> = {};
    DEFAULT_QUOTATION_COLUMNS.forEach((c) => {
      next[c.key] = true;
    });
    setSelectedColumnKeys(next);
  };

  const handleDeselectAll = () => {
    const next: Record<string, boolean> = {};
    DEFAULT_QUOTATION_COLUMNS.forEach((c) => {
      next[c.key] = false;
    });
    setSelectedColumnKeys(next);
  };

  const handleResetDefaults = () => {
    const next: Record<string, boolean> = {};
    DEFAULT_QUOTATION_COLUMNS.forEach((c) => {
      next[c.key] = c.defaultSelected !== false;
    });
    setSelectedColumnKeys(next);
  };

  // Export handlers
  const exportToExcel = () => {
    if (selectedColumns.length === 0) {
      toast.error("Please select at least one column to export");
      return;
    }
    if (tableRows.length === 0) {
      toast.error("No quotation rows to export");
      return;
    }

    const exportCols: ExportTableColumn[] = selectedColumns.map((col) => ({
      key: col.key,
      label: col.label.replace("*", ""),
      width: col.widthPdf || 1,
    }));

    const exportRows: ExportTableRow[] = tableRows.map((r) => {
      const rowObj: ExportTableRow = {};
      selectedColumns.forEach((col) => {
        const val = (r as any)[col.key];
        rowObj[col.key] =
          typeof val === "string" || typeof val === "number"
            ? val
            : val != null
              ? String(val)
              : "—";
      });
      return rowObj;
    });

    const totalGrandVal = tableRows.reduce((sum, r) => sum + (Number(r.raw_grand_total) || 0), 0);
    const companyPrefix = letterhead.companyName
      ? letterhead.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "_")
      : "quotations";

    downloadTableXlsx({
      filename: `${companyPrefix}_quotations_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: "Quotations",
      title: `${letterhead.companyName || "Quotations Master"} Export (${quotations.length} Quotations, Total Value: ${formatCurrencyINR(totalGrandVal)})`,
      columns: exportCols,
      rows: exportRows,
    });
    toast.success("Excel sheet downloaded successfully!");
    onClose();
  };

  const exportToCSV = () => {
    if (selectedColumns.length === 0) {
      toast.error("Please select at least one column to export");
      return;
    }
    if (tableRows.length === 0) {
      toast.error("No quotation rows to export");
      return;
    }

    const headers = selectedColumns.map((c) => `"${c.label.replace("*", "")}"`).join(",");
    const csvRows = tableRows.map((row) => {
      return selectedColumns
        .map((col) => {
          const val: any = (row as any)[col.key];
          const stringified = val !== undefined && val !== null ? String(val) : "";
          return `"${stringified.replace(/"/g, '""')}"`;
        })
        .join(",");
    });

    const totalGrandVal = tableRows.reduce((sum, r) => sum + (Number(r.raw_grand_total) || 0), 0);
    const summaryRow = selectedColumns
      .map((col, idx) => {
        if (idx === 0) return `"SUMMARY (${tableRows.length} proposals)"`;
        if (col.key === "grand_total_fmt") return `"${formatCurrencyINR(totalGrandVal)}"`;
        return `""`;
      })
      .join(",");

    const companyPrefix = letterhead.companyName
      ? letterhead.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "_")
      : "quotations";

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers, ...csvRows, "", summaryRow].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${companyPrefix}_quotations_export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export downloaded successfully!");
    onClose();
  };

  const exportToPDF = async () => {
    if (selectedColumns.length === 0) {
      toast.error("Please select at least one column to export");
      return;
    }
    if (tableRows.length === 0) {
      toast.error("No quotation rows to export");
      return;
    }

    const exportCols: ExportTableColumn[] = selectedColumns.map((col) => ({
      key: col.key,
      label: col.label.replace("*", ""),
      width: col.widthPdf || 1,
    }));

    const exportRows: ExportTableRow[] = tableRows.map((r) => {
      const rowObj: ExportTableRow = {};
      selectedColumns.forEach((col) => {
        const rawVal = (r as any)[col.key];
        const val: string | number | null =
          typeof rawVal === "string" || typeof rawVal === "number"
            ? rawVal
            : rawVal != null
              ? String(rawVal)
              : "—";

        rowObj[col.key] = val;
      });
      return rowObj;
    });

    const companyPrefix = letterhead.companyName
      ? letterhead.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "_")
      : "quotations";

    try {
      await downloadTablePdf({
        filename: `${companyPrefix}_quotations_export_${new Date().toISOString().slice(0, 10)}.pdf`,
        title: "Quotations Master Commercial Register",
        subtitle: `Total Quotations: ${tableRows.length} | Export Date: ${new Date().toLocaleDateString("en-IN")}`,
        columns: exportCols,
        rows: exportRows,
        letterhead,
        portalLabel: "Lead Manager Portal",
        downloadedBy,
      });
      toast.success("PDF document downloaded successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF document");
    }
  };

  if (!open) return null;

  return (
    <LargeModalPortal>
      <ModalOverlay onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 flex flex-col w-full max-w-6xl max-h-[92vh] rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-white/10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-white/5 dark:bg-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-teal-600/20">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  {title}
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {tableRows.length} Proposals Selected
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Column Selector Strip */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-slate-800/40">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200/60 dark:border-white/5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Columns className="h-3.5 w-3.5 text-primary" />
                  Select Columns to Include ({selectedCount}/{DEFAULT_QUOTATION_COLUMNS.length})
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={isAllSelected ? handleDeselectAll : handleSelectAll}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    {isAllSelected ? <Square className="h-3 w-3" /> : <CheckSquare className="h-3 w-3" />}
                    {isAllSelected ? "Deselect All" : "Select All"}
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {DEFAULT_QUOTATION_COLUMNS.map((col) => {
                  const isChecked = !!selectedColumnKeys[col.key];
                  return (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => handleToggleColumn(col.key)}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition text-left cursor-pointer border ${
                        isChecked
                          ? "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-500/30 font-bold"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-white/5 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-[10px] ${
                          isChecked
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                        }`}
                      >
                        {isChecked && <Check className="h-3 w-3" />}
                      </div>
                      <span className="truncate">{col.label.replace("*", "")}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Data Preview Table */}
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-800/30 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-white/5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                  Live Table Export Preview ({tableRows.length} records)
                </span>
                <span className="text-[11px] text-slate-400">
                  Showing first {Math.min(tableRows.length, 10)} preview rows
                </span>
              </div>

              <div className="overflow-x-auto max-h-[360px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/80 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 sticky top-0 border-b border-slate-200 dark:border-white/10 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      {selectedColumns.map((col) => (
                        <th key={col.key} className="py-2.5 px-3 whitespace-nowrap">
                          {col.label.replace("*", "")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-600 dark:text-slate-300">
                    {tableRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={selectedColumns.length + 1}
                          className="py-8 text-center text-slate-400"
                        >
                          No quotation records available to preview.
                        </td>
                      </tr>
                    ) : (
                      tableRows.slice(0, 10).map((row, idx) => (
                        <tr key={row._id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">
                            {idx + 1}
                          </td>
                          {selectedColumns.map((col) => (
                            <td key={col.key} className="py-2 px-3 whitespace-nowrap">
                              {(row as any)[col.key] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-white/5 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 transition-colors"
            >
              Cancel
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={exportToCSV}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4 text-slate-600" />
                Export CSV (.csv)
              </button>

              <button
                type="button"
                onClick={exportToPDF}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <FileText className="h-4 w-4 text-indigo-600" />
                Export PDF (.pdf)
              </button>

              <button
                type="button"
                onClick={exportToExcel}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:opacity-95 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Download Excel Report (.xlsx)
              </button>
            </div>
          </div>
        </div>
      </ModalOverlay>
    </LargeModalPortal>
  );
}
