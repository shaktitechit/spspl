"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";
import { LargeModalPortal } from "@/components/portal/shared/LargeModalPortal";
import { useBulkUploadLeadsMutation, useListLeadSourcesQuery } from "@/store/api";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export type ParsedLeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  company_name: string;
  source: string;
  priority: string;
  city: string;
  state: string;
  address: string;
  requirement: string;
  estimated_value: string;
  notes: string;
  status: string;
  isValid: boolean;
  errors: string[];
};

/**
 * Robust RFC-4180 style CSV parser
 */
function parseCSV(text: string): Record<string, string>[] {
  const lines: string[] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let cell = "";
    let inside = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const nc = line[i + 1];
      if (c === '"') {
        if (inside && nc === '"') {
          cell += '"';
          i++;
        } else {
          inside = !inside;
        }
      } else if (c === "," && !inside) {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += c;
      }
    }
    cells.push(cell.trim());
    return cells;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.every((v) => !v)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }

  return rows;
}

function normalizeHeaderValue(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return "";
}

export function BulkUploadLeadsModal({ isOpen, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedLeadRow[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    createdCount: number;
    errorCount: number;
    errors: Array<{ index: number; row: number; name?: string; error: string }>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: leadSources } = useListLeadSourcesQuery();
  const [bulkUpload, { isLoading }] = useBulkUploadLeadsMutation();

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const processFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Please upload a valid CSV file (.csv)");
      return;
    }
    setFile(selectedFile);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast.error("Failed to read CSV file contents");
        return;
      }

      const rawRows = parseCSV(text);
      if (rawRows.length === 0) {
        toast.error("CSV file is empty or missing headers");
        return;
      }

      const defaultSource = leadSources?.[0]?.name || "Direct";

      const rows: ParsedLeadRow[] = rawRows.map((row, idx) => {
        const name = normalizeHeaderValue(row, ["name", "contact name", "client name", "lead name"]);
        const phone = normalizeHeaderValue(row, ["phone", "mobile", "contact number", "phone number"]);
        const email = normalizeHeaderValue(row, ["email", "email address"]);
        const company_name = normalizeHeaderValue(row, ["company", "company name", "organization"]);
        const source = normalizeHeaderValue(row, ["source", "lead source"]) || defaultSource;
        const priority = normalizeHeaderValue(row, ["priority"]).toLowerCase() || "medium";
        const city = normalizeHeaderValue(row, ["city"]);
        const state = normalizeHeaderValue(row, ["state"]);
        const address = normalizeHeaderValue(row, ["address", "street", "location"]);
        const requirement = normalizeHeaderValue(row, ["requirement", "requirement details", "description"]);
        const estimated_value = normalizeHeaderValue(row, ["estimated value", "value", "amount", "estimated_value"]);
        const notes = normalizeHeaderValue(row, ["notes", "remarks"]);
        const status = normalizeHeaderValue(row, ["status"]).toLowerCase() || "new";

        const errors: string[] = [];
        if (!name) errors.push("Contact Name is required");
        if (!phone && !email) errors.push("Either Phone or Email is required");
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Invalid email format");
        if (!source) errors.push("Source is required");

        return {
          id: `row-${idx + 1}`,
          name,
          phone,
          email,
          company_name,
          source,
          priority: ["low", "medium", "high", "urgent"].includes(priority) ? priority : "medium",
          city,
          state,
          address,
          requirement,
          estimated_value,
          notes,
          status: ["new", "assigned", "follow_up", "quotation", "won", "lost", "converted"].includes(status)
            ? status
            : "new",
          isValid: errors.length === 0,
          errors,
        };
      });

      setParsedRows(rows);
      toast.success(`Parsed ${rows.length} rows from CSV`);
    };

    reader.readAsText(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      "Name,Phone,Email,Company,Source,Priority,City,State,Requirement,Estimated Value,Notes\n" +
      "John Doe,9876543210,john@example.com,Acme Corp,Website,high,Mumbai,Maharashtra,Looking for enterprise software,150000,Interested in annual contract\n" +
      "Jane Smith,9876543211,,Globex Ltd,Referral,medium,Delhi,Delhi,Need demo for 50 users,75000,Follow up next week\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sample_leads_upload_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error("No valid lead rows to upload");
      return;
    }

    const payloadLeads = validRows.map((r) => ({
      name: r.name,
      phone: r.phone || undefined,
      email: r.email || undefined,
      company_name: r.company_name || undefined,
      source: r.source,
      priority: r.priority as any,
      city: r.city || undefined,
      state: r.state || undefined,
      address: r.address || undefined,
      requirement: r.requirement || undefined,
      estimated_value: r.estimated_value ? Number(r.estimated_value) : undefined,
      notes: r.notes || undefined,
      status: r.status as any,
    }));

    try {
      const res = await bulkUpload({ leads: payloadLeads }).unwrap();
      setUploadResult({
        createdCount: res.createdCount,
        errorCount: res.errorCount,
        errors: res.errors || [],
      });

      if (res.createdCount > 0) {
        toast.success(`Successfully imported ${res.createdCount} leads!`);
      }
      if (res.errorCount > 0) {
        toast.error(`${res.errorCount} lead(s) failed to import`);
      }
    } catch (err: any) {
      toast.error(mutationRejectedMessage(err) || "Failed to bulk upload leads");
    }

  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  if (!isOpen) return null;

  return (
    <LargeModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="relative w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Bulk Upload Leads
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Import multiple leads at once via CSV file (Managers Only)
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadSampleTemplate}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Download className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  Download Sample Template (.CSV)
                </button>
              </div>
              {file && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear File
                </button>
              )}
            </div>

            {/* Drop Zone if no file loaded */}
            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition ${
                  isDragOver
                    ? "border-indigo-500 bg-indigo-50/50 dark:border-indigo-400 dark:bg-indigo-950/20"
                    : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:bg-slate-800/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Upload className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Click to upload or drag and drop CSV file
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Supported format: .CSV (Max 200 leads per file)
                </p>
              </div>
            ) : (
              /* File Loaded & Parsed State */
              <div className="space-y-4">
                {/* Stats Header Bar */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/80">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Total Rows Parsed
                    </span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {parsedRows.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 shadow-xs dark:border-emerald-900/50 dark:bg-emerald-950/30">
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Ready to Import
                    </span>
                    <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                      {validCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/50 p-3 shadow-xs dark:border-amber-900/50 dark:bg-amber-950/30">
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" /> Invalid / Incomplete
                    </span>
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
                      {invalidCount}
                    </span>
                  </div>
                </div>

                {/* Server Response Feedback Box */}
                {uploadResult && (
                  <div
                    className={`p-4 rounded-xl border ${
                      uploadResult.errorCount === 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs">
                      {uploadResult.errorCount === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      )}
                      <span>
                        Upload Completed: {uploadResult.createdCount} lead(s) created,{" "}
                        {uploadResult.errorCount} failed.
                      </span>
                    </div>

                    {uploadResult.errors.length > 0 && (
                      <div className="mt-2.5 max-h-32 overflow-y-auto space-y-1 text-xs">
                        {uploadResult.errors.map((err, i) => (
                          <div key={i} className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                            <span className="font-semibold">Row {err.row}:</span>
                            <span>{err.name ? `${err.name} - ` : ""}{err.error}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Parsed Rows Table Preview */}
                <div className="rounded-xl border border-slate-200 overflow-hidden dark:border-slate-800 max-h-[350px] overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold sticky top-0 dark:bg-slate-800 dark:text-slate-400 z-10">
                      <tr>
                        <th className="px-3 py-2.5">Row</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Contact Name*</th>
                        <th className="px-3 py-2.5">Phone / Email*</th>
                        <th className="px-3 py-2.5">Source*</th>
                        <th className="px-3 py-2.5">Company</th>
                        <th className="px-3 py-2.5">City</th>
                        <th className="px-3 py-2.5">Priority</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {parsedRows.map((row, idx) => (
                        <tr
                          key={row.id}
                          className={
                            !row.isValid
                              ? "bg-rose-50/40 dark:bg-rose-950/20"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          }
                        >
                          <td className="px-3 py-2 text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                Valid
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                title={row.errors.join(", ")}
                              >
                                <AlertTriangle className="h-3 w-3 text-rose-500" />
                                {row.errors[0]}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-900 dark:text-white max-w-[140px] truncate">
                            {row.name || <span className="text-rose-500 italic">Missing</span>}
                          </td>
                          <td className="px-3 py-2 max-w-[160px] truncate">
                            {row.phone || row.email ? (
                              <div>
                                {row.phone && <div className="font-mono text-[11px]">{row.phone}</div>}
                                {row.email && <div className="text-slate-400 text-[10px] truncate">{row.email}</div>}
                              </div>
                            ) : (
                              <span className="text-rose-500 italic">Missing Contact</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                            {row.source || <span className="text-amber-500">Default</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400 max-w-[120px] truncate">
                            {row.company_name || "-"}
                          </td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                            {row.city || "-"}
                          </td>
                          <td className="px-3 py-2 capitalize font-medium text-[11px]">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                row.priority === "urgent"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : row.priority === "high"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {row.priority}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-2xl">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Close
            </button>

            {file && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={isLoading || validCount === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing Leads...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload {validCount} Valid Leads
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </LargeModalPortal>
  );
}
