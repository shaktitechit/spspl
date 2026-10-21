/**
 * @fileoverview Download Follow-ups Preview Modal with Column Customizer, Live Table Preview, and Multi-Format Exports (.xlsx, .csv, .pdf).
 * @module components/leads/DownloadFollowUpsPreviewModal
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
  Search,
  Phone,
  MessageSquare,
  Users,
  MapPin,
  Tv,
  Mail,
  HelpCircle,
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
import {
  formatCurrencyINR,
  formatLeadDate,
  isLeadAdmin,
  isLeadManagerRole,
} from "./leadUtils";
import type { FollowUpDetailedRecord } from "@/store/api";

export type FollowUpColumnDef = {
  key: string;
  label: string;
  defaultSelected?: boolean;
  widthPdf?: number;
};

export const DEFAULT_FOLLOWUP_COLUMNS: FollowUpColumnDef[] = [
  { key: "entity_ref_no", label: "Ref No (Lead/Quote)*", defaultSelected: true, widthPdf: 1.3 },
  { key: "entity_type_label", label: "Entity Type*", defaultSelected: true, widthPdf: 1 },
  { key: "customer_name", label: "Customer / Contact*", defaultSelected: true, widthPdf: 1.5 },
  { key: "company_name", label: "Company / Clinic*", defaultSelected: true, widthPdf: 1.5 },
  { key: "phone", label: "Phone", defaultSelected: false, widthPdf: 1.1 },
  { key: "email", label: "Email", defaultSelected: false, widthPdf: 1.3 },
  { key: "city", label: "City", defaultSelected: false, widthPdf: 1 },
  { key: "rep_name", label: "Sales Rep*", defaultSelected: true, widthPdf: 1.2 },
  { key: "channel_label", label: "Channel*", defaultSelected: true, widthPdf: 1.1 },
  { key: "status_label", label: "Status*", defaultSelected: true, widthPdf: 1 },
  { key: "scheduled_date_fmt", label: "Scheduled Date*", defaultSelected: true, widthPdf: 1.2 },
  { key: "completed_date_fmt", label: "Completed Date", defaultSelected: false, widthPdf: 1.2 },
  { key: "outcome", label: "Outcome / Result*", defaultSelected: true, widthPdf: 1.6 },
  { key: "notes", label: "Discussion Notes", defaultSelected: false, widthPdf: 2 },
  { key: "commercial_value_fmt", label: "Commercial Value (₹)", defaultSelected: true, widthPdf: 1.3 },
];

export type DownloadFollowUpsPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  followUps: FollowUpDetailedRecord[];
  title?: string;
  subtitle?: string;
};

export function DownloadFollowUpsPreviewModal({
  open,
  onClose,
  followUps,
  title = "Export Follow-Ups Activity Log",
  subtitle = "Customize columns, preview scheduled & completed touchpoints, and export to Excel (.xlsx), CSV, or PDF.",
}: DownloadFollowUpsPreviewModalProps) {
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

  const isAdmin = isLeadAdmin(authUser, "/dashboard");
  const hasQuotationAccess = isAdmin || isLeadManagerRole(authUser, "/dashboard");

  const columnDefs = useMemo(() => {
    return DEFAULT_FOLLOWUP_COLUMNS.filter((col) => {
      if (!hasQuotationAccess && col.key === "entity_type_label") return false;
      return true;
    }).map((col) => {
      if (!hasQuotationAccess && col.key === "entity_ref_no") {
        return { ...col, label: "Lead Ref No*" };
      }
      return col;
    });
  }, [hasQuotationAccess]);

  // Transform raw records to tabular rows
  const tableRows = useMemo(() => {
    return followUps.map((fu) => {
      const channelLabelMap: Record<string, string> = {
        call: "Phone Call",
        meeting: "Meeting",
        whatsapp: "WhatsApp",
        email: "Email",
        visit: "Field Visit",
        demo: "Product Demo",
        other: "Other",
      };

      const statusLabel =
        fu.display_status === "overdue"
          ? "OVERDUE"
          : fu.display_status === "due_today"
          ? "DUE TODAY"
          : (fu.status || "pending").toUpperCase();

      return {
        _id: fu._id,
        entity_ref_no: fu.entity_ref_no || "—",
        entity_type_label: fu.entity_type === "quotation" ? "Quotation" : "Lead",
        customer_name: fu.customer_name || "—",
        company_name: fu.company_name || "—",
        phone: fu.phone || "—",
        email: fu.email || "—",
        city: fu.city || "—",
        rep_name: fu.rep_name || "Unassigned",
        channel_label: channelLabelMap[fu.type] || fu.type,
        status_label: statusLabel,
        scheduled_date_fmt: fu.follow_up_date
          ? `${formatLeadDate(fu.follow_up_date)}${fu.follow_up_time && fu.follow_up_time !== "—" ? ` ${fu.follow_up_time}` : ""}`
          : "—",
        completed_date_fmt: fu.completed_at ? formatLeadDate(fu.completed_at) : "—",
        outcome: fu.outcome || "—",
        notes: fu.notes || "—",
        commercial_value_fmt: fu.commercial_value ? formatCurrencyINR(fu.commercial_value) : "₹0",
        raw_value: fu.commercial_value || 0,
      };
    });
  }, [followUps]);

  // Column selection state
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    DEFAULT_FOLLOWUP_COLUMNS.forEach((col) => {
      if (!hasQuotationAccess && col.key === "entity_type_label") return;
      initial[col.key] = col.defaultSelected ?? true;
    });
    return initial;
  });

  const [searchFilter, setSearchFilter] = useState("");
  const [copied, setCopied] = useState(false);

  const activeColumns = useMemo(() => {
    return columnDefs.filter((col) => selectedColumnKeys[col.key]);
  }, [columnDefs, selectedColumnKeys]);

  const filteredRows = useMemo(() => {
    if (!searchFilter.trim()) return tableRows;
    const q = searchFilter.toLowerCase();
    return tableRows.filter((r) =>
      Object.values(r).some((val) => String(val).toLowerCase().includes(q))
    );
  }, [tableRows, searchFilter]);

  const toggleColumn = (key: string) => {
    setSelectedColumnKeys((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      if (prev[key] && activeCount <= 1) {
        toast.error("You must keep at least one column visible");
        return prev;
      }
      return { ...prev, [key]: !prev[key] };
    });
  };

  const selectAllColumns = () => {
    const next: Record<string, boolean> = {};
    columnDefs.forEach((col) => {
      next[col.key] = true;
    });
    setSelectedColumnKeys(next);
  };

  const deselectAllColumns = () => {
    const next: Record<string, boolean> = {};
    columnDefs.forEach((col) => {
      next[col.key] = col.key === "entity_ref_no" || col.key === "customer_name" || col.key === "outcome";
    });
    setSelectedColumnKeys(next);
  };

  const handleExportXlsx = () => {
    if (activeColumns.length === 0) {
      toast.error("Please select at least one column to export");
      return;
    }
    const cols: ExportTableColumn[] = activeColumns.map((c) => ({
      key: c.key,
      label: c.label.replace(/\*/g, ""),
    }));
    const rows: ExportTableRow[] = filteredRows.map((r) => {
      const rowObj: ExportTableRow = {};
      activeColumns.forEach((c) => {
        rowObj[c.key] = (r as any)[c.key] ?? "—";
      });
      return rowObj;
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    downloadTableXlsx({
      filename: `follow_ups_activity_log_${timestamp}.xlsx`,
      sheetName: "Follow-Ups Log",
      title: "Follow-Ups Activity Log (Leads & Quotations)",
      columns: cols,
      rows,
    });
    toast.success("Excel report downloaded successfully!");
  };

  const handleExportCsv = () => {
    if (activeColumns.length === 0) {
      toast.error("Please select at least one column to export");
      return;
    }
    const headers = activeColumns.map((c) => `"${c.label.replace(/\*/g, "").replace(/"/g, '""')}"`).join(",");
    const csvLines = filteredRows.map((r) =>
      activeColumns
        .map((c) => {
          const val = String((r as any)[c.key] ?? "").replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(",")
    );

    const csvContent = [headers, ...csvLines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `follow_ups_activity_log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV file downloaded successfully!");
  };

  const handleExportPdf = () => {
    if (activeColumns.length === 0) {
      toast.error("Please select at least one column to export");
      return;
    }
    const cols: ExportTableColumn[] = activeColumns.map((c) => ({
      key: c.key,
      label: c.label.replace(/\*/g, ""),
    }));
    const rows: ExportTableRow[] = filteredRows.map((r) => {
      const rowObj: ExportTableRow = {};
      activeColumns.forEach((c) => {
        rowObj[c.key] = (r as any)[c.key] ?? "—";
      });
      return rowObj;
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    downloadTablePdf({
      filename: `follow_ups_activity_log_${timestamp}.pdf`,
      title: "Follow-Ups Activity Log (Leads & Quotations)",
      columns: cols,
      rows,
      letterhead,
      downloadedBy,
    });
    toast.success("PDF exported successfully!");
  };

  const handleCopyClipboard = () => {
    if (activeColumns.length === 0) return;
    const headers = activeColumns.map((c) => c.label.replace(/\*/g, "")).join("\t");
    const lines = filteredRows.map((r) =>
      activeColumns.map((c) => String((r as any)[c.key] ?? "")).join("\t")
    );
    const tsv = [headers, ...lines].join("\n");
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    toast.success("Table copied to clipboard (TSV format)!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <LargeModalPortal>
      <ModalOverlay onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[92vh] w-[95vw] max-w-6xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Main Body */}
          <div className="flex flex-1 flex-col overflow-hidden p-6 gap-5">
            {/* Column Selector Accordion Box */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-slate-950/40">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Columns className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Select Columns to Include ({activeColumns.length} of {columnDefs.length})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAllColumns}
                    className="font-semibold text-teal-600 hover:underline dark:text-teal-400"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={deselectAllColumns}
                    className="font-semibold text-slate-500 hover:underline dark:text-slate-400"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {columnDefs.map((col) => {
                  const isChecked = selectedColumnKeys[col.key] ?? false;
                  return (
                    <label
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition select-none ${
                        isChecked
                          ? "border-teal-500/40 bg-teal-50/70 text-teal-900 dark:border-teal-500/30 dark:bg-teal-950/40 dark:text-teal-200"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100/70 dark:border-white/5 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-white/5"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="sr-only"
                      />
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 dark:text-slate-600 shrink-0" />
                      )}
                      <span className="truncate">{col.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Filter & Live Preview Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[260px] flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter preview by lead/quote no, customer, rep, outcome..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Eye className="h-3.5 w-3.5" />
                <span>
                  Showing <strong className="text-slate-900 dark:text-white">{filteredRows.length}</strong> follow-up touchpoint{filteredRows.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {/* Live Table Preview */}
            <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-inner dark:border-white/10 dark:bg-slate-950">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-white/10">
                <thead className="sticky top-0 z-10 bg-slate-100 font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="px-3.5 py-2.5 text-center w-12">#</th>
                    {activeColumns.map((col) => (
                      <th key={col.key} className="px-3.5 py-2.5 whitespace-nowrap">
                        {col.label.replace(/\*/g, "")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activeColumns.length + 1}
                        className="py-12 text-center text-xs text-slate-400"
                      >
                        No follow-up touchpoints match your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <tr
                        key={row._id || idx}
                        className="transition hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
                      >
                        <td className="px-3.5 py-2 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        {activeColumns.map((col) => {
                          const val = (row as any)[col.key] ?? "—";
                          return (
                            <td
                              key={col.key}
                              className="px-3.5 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300"
                            >
                              {col.key === "status_label" ? (
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                    val === "COMPLETED"
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                      : val === "OVERDUE"
                                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                      : val === "DUE TODAY"
                                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                      : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                  }`}
                                >
                                  {val}
                                </span>
                              ) : col.key === "entity_type_label" ? (
                                <span
                                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                    val === "Quotation"
                                      ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                      : "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                                  }`}
                                >
                                  {val}
                                </span>
                              ) : col.key === "commercial_value_fmt" ? (
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {val}
                                </span>
                              ) : col.key === "entity_ref_no" ? (
                                <span className="font-mono font-semibold text-primary">
                                  {val}
                                </span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Action Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-white/10 dark:bg-slate-950/60">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyClipboard}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy Table"}
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV (.csv)
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-50/80 px-3 py-2 text-xs font-semibold text-rose-700 shadow-xs transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
              >
                <FileText className="h-3.5 w-3.5 text-rose-500" />
                Export PDF (.pdf)
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleExportXlsx}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
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
