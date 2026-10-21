"use client";

import { useState } from "react";
import {
  FileText,
  FileCheck,
  Eye,
  Download,
  Trash2,
  Plus,
  Clock,
  User,
  Files,
  RefreshCw,
} from "lucide-react";
import { DocumentDropzone } from "./DocumentDropzone";

export type MultiDocumentGridProps = {
  title: string;
  subtitle?: string;
  badgeText?: string;
  documents: Record<string, unknown>[];
  onUpload: (files: File[], remarks?: string) => Promise<void>;
  onDelete: (attachmentId: string, name: string) => Promise<void>;
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
  });
}

function getFileIcon(mime: string, name: string) {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (m.includes("pdf") || n.endsWith(".pdf")) {
    return <FileText className="h-6 w-6 text-rose-500" />;
  }
  if (m.includes("image") || n.match(/\.(jpg|jpeg|png|webp)$/)) {
    return <FileCheck className="h-6 w-6 text-blue-500" />;
  }
  return <FileText className="h-6 w-6 text-slate-500" />;
}

export function MultiDocumentGrid({
  title,
  subtitle,
  badgeText,
  documents,
  onUpload,
  onDelete,
  onPreview,
  onDownload,
  isUploading = false,
  isDeleting = false,
  disabled = false,
}: MultiDocumentGridProps) {
  const [remarks, setRemarks] = useState("");
  const [showUploadZone, setShowUploadZone] = useState(documents.length === 0);

  const handleFilesSelected = async (files: File[]) => {
    if (!files || files.length === 0) return;
    await onUpload(files, remarks.trim());
    setRemarks("");
  };

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
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
              {documents.length} {documents.length === 1 ? "document" : "documents"}
            </span>
          </div>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>

        {!disabled && (
          <button
            type="button"
            onClick={() => setShowUploadZone((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300"
          >
            <Plus className="h-3.5 w-3.5" />
            {showUploadZone ? "Hide Uploader" : "Add Documents"}
          </button>
        )}
      </div>

      {/* Upload Dropzone Section */}
      {showUploadZone && !disabled && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/20 p-4 space-y-3 dark:border-blue-900/30 dark:bg-blue-950/10">
          <DocumentDropzone
            multiple={true}
            disabled={disabled || isUploading}
            label={`Upload ${title}`}
            description="Select or drop multiple files (PDF, PNG, JPG up to 25MB each)"
            onFilesSelected={handleFilesSelected}
          />

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional remarks (e.g. Document number, expiry, issuing date)..."
              disabled={disabled || isUploading}
              className="w-full rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {isUploading && (
            <p className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Uploading documents...
            </p>
          )}
        </div>
      )}

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-white/10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 dark:bg-white/5">
            <Files className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
            No documents uploaded yet
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Upload verified copies for record keeping and approvals.
          </p>
          {!showUploadZone && !disabled && (
            <button
              type="button"
              onClick={() => setShowUploadZone(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Upload Now
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => {
            const id = String(doc._id || doc.id || "");
            const name = String(doc.original_name || doc.file_name || "Document");
            const url = String(doc.url || "");
            const mime = String(doc.mime_type || "");
            const size = formatBytes(doc.size);
            const date = formatDate(doc.createdAt);
            const uploaderObj = doc.uploaded_by as Record<string, unknown> | undefined;
            const uploaderName = String(uploaderObj?.name || uploaderObj?.username || "Operator");
            const uploaderDept = String(uploaderObj?.department || "");

            return (
              <div
                key={id}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-slate-900 dark:hover:border-white/20"
              >
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-150 dark:bg-white/5 dark:ring-white/10">
                      {getFileIcon(mime, name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100" title={name}>
                        {name}
                      </p>
                      <p className="text-2xs text-slate-500 dark:text-slate-400">{size}</p>
                    </div>
                  </div>

                  {doc.remarks ? (
                    <p className="line-clamp-2 text-2xs italic text-slate-600 dark:text-slate-300">
                      &quot;{String(doc.remarks)}&quot;
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {date}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 truncate max-w-[120px]">
                      <User className="h-3 w-3" />
                      {uploaderName}
                    </span>
                    {uploaderDept && (
                      <span className="rounded bg-slate-100 px-1 text-2xs uppercase text-slate-500 dark:bg-white/10">
                        {uploaderDept}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onPreview(doc)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-2xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                    >
                      <Eye className="h-3 w-3" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(url, name)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-2xs font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>
                  </div>

                  {!disabled && (
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => onDelete(id, name)}
                      className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                      title="Delete document"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
