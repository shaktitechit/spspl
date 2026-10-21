"use client";

import React from "react";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  Eye,
  Download,
  Paperclip,
} from "lucide-react";
import type { ExpenseAttachmentItem } from "@/types/workPlanner";

interface ExpenseAttachmentListProps {
  label?: string;
  attachments?: ExpenseAttachmentItem[] | any[];
  attachmentIds?: (string | any)[];
  onPreview?: (doc: { name: string; url: string; mime?: string }) => void;
  onDownload?: (doc: { name: string; url: string; mime?: string }) => void;
  compact?: boolean;
  emptyText?: string;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getAttachmentIcon(mime?: string, name?: string) {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (m.includes("image") || /\.(png|jpe?g|gif|webp|bmp|svg|heic)$/i.test(n)) {
    return <FileImage className="h-4 w-4 text-sky-500 shrink-0" />;
  }
  if (m.includes("sheet") || m.includes("excel") || m.includes("csv") || /\.(xlsx?|csv)$/i.test(n)) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0" />;
  }
  return <FileText className="h-4 w-4 text-purple-500 shrink-0" />;
}

export function ExpenseAttachmentList({
  label,
  attachments = [],
  attachmentIds = [],
  onPreview,
  onDownload,
  compact = false,
  emptyText = "No attachments attached",
}: ExpenseAttachmentListProps) {
  // Merge structured attachments and attachment IDs if details are missing
  const mergedList: any[] = [...(attachments || [])];
  if (attachmentIds && Array.isArray(attachmentIds)) {
    for (const attId of attachmentIds) {
      if (!attId) continue;
      const rawId = typeof attId === "string" ? attId : (attId as any)._id || (attId as any).attachment_id;
      const alreadyIn = mergedList.some(
        (m) => (m._id || m.attachment_id || m.file_id) === rawId
      );
      if (!alreadyIn) {
        if (typeof attId === "string") {
          mergedList.push({
            attachment_id: attId,
            filename: `Attachment (${attId.slice(-6)})`,
            url: `/api/work-planner/attachments/${attId}/preview`,
          });
        } else {
          mergedList.push(attId);
        }
      }
    }
  }

  if (mergedList.length === 0) {
    if (emptyText) {
      return <div className="text-[11px] text-muted italic">{emptyText}</div>;
    }
    return null;
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
          {label} ({mergedList.length})
        </span>
      )}
      <div className={compact ? "flex flex-wrap items-center gap-1.5" : "space-y-1.5"}>
        {mergedList.map((att: any, idx: number) => {
          const fileName = att.original_name || att.filename || att.name || `Attachment #${idx + 1}`;
          const fileId = att._id || att.attachment_id || att.file_id || att.id;
        const fileUrl =
          att.url ||
          (fileId ? `/api/work-planner/attachments/${fileId}/preview` : "#");
        const mime = att.mime_type || att.mime || "";

        const docObj = { name: fileName, url: fileUrl, mime };

        if (compact) {
          return (
            <div
              key={fileId || idx}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted/50 px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary/50 transition group"
            >
              {getAttachmentIcon(mime, fileName)}
              <span
                onClick={() => onPreview && onPreview(docObj)}
                className="max-w-[120px] truncate cursor-pointer hover:text-primary transition"
                title={fileName}
              >
                {fileName}
              </span>
              <div className="flex items-center gap-0.5 ml-0.5 opacity-70 group-hover:opacity-100 transition">
                {onPreview && (
                  <button
                    type="button"
                    onClick={() => onPreview(docObj)}
                    className="p-0.5 text-muted hover:text-primary transition cursor-pointer"
                    title="Preview"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                )}
                {onDownload && (
                  <button
                    type="button"
                    onClick={() => onDownload(docObj)}
                    className="p-0.5 text-muted hover:text-emerald-500 transition cursor-pointer"
                    title="Download"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        }

        return (
          <div
            key={fileId || idx}
            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5 text-xs shadow-2xs hover:shadow-xs transition"
          >
            <div
              onClick={() => onPreview && onPreview(docObj)}
              className="flex items-center gap-2 min-w-0 cursor-pointer hover:text-primary transition flex-1"
              title="Click to preview"
            >
              {getAttachmentIcon(mime, fileName)}
              <div className="min-w-0">
                <span className="truncate font-semibold block text-[11px] text-foreground">
                  {fileName}
                </span>
                {att.size && (
                  <span className="text-[10px] text-muted">
                    {formatBytes(att.size)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onPreview && (
                <button
                  type="button"
                  onClick={() => onPreview(docObj)}
                  className="rounded-lg p-1.5 text-muted hover:text-primary hover:bg-surface-muted transition cursor-pointer"
                  title="Preview Document"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              )}
              {onDownload && (
                <button
                  type="button"
                  onClick={() => onDownload(docObj)}
                  className="rounded-lg p-1.5 text-muted hover:text-emerald-500 hover:bg-surface-muted transition cursor-pointer"
                  title="Download Document"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
}
