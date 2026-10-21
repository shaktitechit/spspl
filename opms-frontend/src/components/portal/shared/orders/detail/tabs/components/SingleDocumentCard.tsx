"use client";

import { useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  FileCheck,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  Clock,
  User,
  CheckCircle2,
} from "lucide-react";
import { DocumentDropzone } from "./DocumentDropzone";

export type SingleDocumentCardProps = {
  title: string;
  subtitle?: string;
  badgeText?: string;
  attachment: Record<string, unknown> | null;
  onUpload: (file: File, remarks?: string) => Promise<void>;
  onReplace?: (file: File) => Promise<void>;
  onDelete?: (attachmentId: string, name: string) => Promise<void>;
  onPreview: (attachment: Record<string, unknown>) => void;
  onDownload: (fileUrl: string, fileName: string) => void;
  isUploading?: boolean;
  isDeleting?: boolean;
  disabled?: boolean;
};

function formatBytes(bytes: unknown): string {
  const n = Number(bytes);
  if (!n || n <= 0) return "—";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${parseFloat((n / k ** i).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateVal: unknown): string {
  if (!dateVal) return "—";
  const d = new Date(String(dateVal));
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(mime: string, name: string) {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (m.includes("pdf") || n.endsWith(".pdf")) {
    return <FileText className="h-8 w-8 text-rose-500" />;
  }
  if (m.includes("excel") || m.includes("sheet") || n.endsWith(".xlsx") || n.endsWith(".csv")) {
    return <FileSpreadsheet className="h-8 w-8 text-emerald-500" />;
  }
  if (m.includes("image") || n.match(/\.(jpg|jpeg|png|webp)$/)) {
    return <FileCheck className="h-8 w-8 text-blue-500" />;
  }
  return <FileText className="h-8 w-8 text-slate-500" />;
}

export function SingleDocumentCard({
  title,
  subtitle,
  badgeText,
  attachment,
  onUpload,
  onReplace,
  onDelete,
  onPreview,
  onDownload,
  isUploading = false,
  isDeleting = false,
  disabled = false,
}: SingleDocumentCardProps) {
  const [remarks, setRemarks] = useState("");
  const [isReplacing, setIsReplacing] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (isReplacing && onReplace) {
      await onReplace(file);
      setIsReplacing(false);
    } else {
      await onUpload(file, remarks.trim());
      setRemarks("");
    }
  };

  const hasDoc = Boolean(attachment);
  const fileName = String(attachment?.original_name || attachment?.file_name || "Document");
  const fileUrl = String(attachment?.url || "");
  const mimeType = String(attachment?.mime_type || "");
  const fileSize = formatBytes(attachment?.size);
  const uploadedAt = formatDate(attachment?.createdAt);
  const uploaderObj = attachment?.uploaded_by as Record<string, unknown> | undefined;
  const uploaderName = String(uploaderObj?.name || uploaderObj?.username || "Operator");
  const uploaderDept = String(uploaderObj?.department || "");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 font-sans">
              {title}
            </h3>
            {badgeText && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-2xs font-bold text-blue-600 ring-1 ring-inset ring-blue-600/10 dark:bg-blue-950/40 dark:text-blue-400">
                {badgeText}
              </span>
            )}
            {hasDoc && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Uploaded
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Main Content: Document Card or Dropzone */}
      {hasDoc && !isReplacing ? (
        <div className="relative overflow-hidden rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-150 dark:bg-white/5 dark:ring-white/10">
                {getFileIcon(mimeType, fileName)}
              </div>

              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50" title={fileName}>
                  {fileName}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>{fileSize}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {uploadedAt}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {uploaderName}
                    {uploaderDept && (
                      <span className="ml-1 rounded bg-slate-100 px-1 py-0.2 text-2xs uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {uploaderDept}
                      </span>
                    )}
                  </span>
                </div>
                {attachment?.remarks ? (
                  <p className="text-xs italic text-slate-600 dark:text-slate-300">
                    &quot;{String(attachment.remarks)}&quot;
                  </p>
                ) : null}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={() => onPreview(attachment!)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-blue-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/10"
              >
                <Eye className="h-3.5 w-3.5 text-blue-500" />
                Preview
              </button>

              <button
                type="button"
                onClick={() => onDownload(fileUrl, fileName)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-emerald-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/10"
              >
                <Download className="h-3.5 w-3.5 text-emerald-500" />
                Download
              </button>

              {onReplace && !disabled && (
                <button
                  type="button"
                  onClick={() => setIsReplacing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-purple-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/10"
                  title="Upload a new document to replace the current one"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-purple-500" />
                  Replace
                </button>
              )}

              {onDelete && !disabled && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    const id = String(attachment?._id || attachment?.id || "");
                    if (id) onDelete(id, fileName);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200/80 bg-rose-50/50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100/70 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  title="Delete document"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {isReplacing && (
            <div className="flex items-center justify-between rounded-lg bg-purple-50 px-3 py-2 text-xs font-medium text-purple-800 dark:bg-purple-950/30 dark:text-purple-300">
              <span>Replacing current {title}. Select new file below.</span>
              <button
                type="button"
                onClick={() => setIsReplacing(false)}
                className="text-xs font-bold underline hover:text-purple-950"
              >
                Cancel
              </button>
            </div>
          )}

          <DocumentDropzone
            multiple={false}
            disabled={disabled || isUploading}
            label={isReplacing ? `Replace ${title}` : `Upload ${title}`}
            description="Drag & drop document here or click to browse (PDF, PNG, JPG up to 25MB)"
            onFilesSelected={handleFilesSelected}
          />

          {!isReplacing && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional reference / remarks (e.g. PO number, revision date)..."
                disabled={disabled || isUploading}
                className="w-full rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          )}

          {isUploading && (
            <p className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Uploading document...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
