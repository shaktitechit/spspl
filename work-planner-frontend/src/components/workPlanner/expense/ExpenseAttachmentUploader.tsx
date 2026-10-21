"use client";

import React, { useState } from "react";
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileImage,
  Loader2,
  Trash2,
  Eye,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { useUploadExpenseAttachmentMutation } from "@/store/api/workPlannerApiSlice";
import type { ExpenseAttachmentItem } from "@/types/workPlanner";

interface ExpenseAttachmentUploaderProps {
  label?: string;
  attachments: ExpenseAttachmentItem[];
  onChange: (attachments: ExpenseAttachmentItem[]) => void;
  onPreview?: (doc: { name: string; url: string; mime?: string }) => void;
  resourceType?: string;
  resourceId?: string;
  disabled?: boolean;
  maxFiles?: number;
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

export function ExpenseAttachmentUploader({
  label = "Attach Supporting Documents / Proofs",
  attachments = [],
  onChange,
  onPreview,
  resourceType = "work_plan_expense",
  resourceId,
  disabled = false,
  maxFiles = 10,
}: ExpenseAttachmentUploaderProps) {
  const [uploadMutation] = useUploadExpenseAttachmentMutation();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setIsUploading(true);
    const newItems: ExpenseAttachmentItem[] = [...attachments];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`File ${file.name} exceeds 25MB limit`);
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("resourceType", resourceType);
        if (resourceId) {
          formData.append("resourceId", resourceId);
        }

        const uploaded = await uploadMutation(formData).unwrap();
        const uploadedData = uploaded?.data || uploaded;

        newItems.push({
          _id: uploadedData._id || uploadedData.attachment_id,
          attachment_id: uploadedData._id || uploadedData.attachment_id,
          file_id: uploadedData.filename || uploadedData.file_id || uploadedData._id,
          filename: uploadedData.filename || file.name,
          original_name: uploadedData.original_name || file.name,
          mime_type: uploadedData.mime_type || file.type || "application/octet-stream",
          size: uploadedData.size || file.size,
          url: uploadedData.url || `/api/work-planner/attachments/${uploadedData._id || uploadedData.attachment_id}/preview`,
        });

        toast.success(`Uploaded: ${file.name}`);
      }

      onChange(newItems);
    } catch (err: any) {
      console.error("Attachment upload error:", err);
      toast.error(err?.data?.message || err?.message || "Failed to upload attachment");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleRemove = (index: number) => {
    const next = attachments.filter((_, idx) => idx !== index);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 text-primary" />
          <span>{label}</span>
        </label>
        {isUploading && (
          <span className="text-[11px] text-primary flex items-center gap-1 font-medium animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" /> Uploading to storage...
          </span>
        )}
      </div>

      {/* Upload Dropzone */}
      <label
        className={`flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted/50 p-3 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition cursor-pointer active:scale-[0.99] ${
          disabled || isUploading ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <UploadCloud className="h-4 w-4 text-primary" />
        <span>Click to upload receipts, bills, vouchers, payment screenshots (PDF, Images, Excel)</span>
        <input
          type="file"
          multiple
          disabled={disabled || isUploading}
          onChange={handleFileUpload}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
      </label>

      {/* Uploaded File Chips List */}
      {attachments.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {attachments.map((att, idx) => {
            const fileName = att.original_name || att.filename || "Attachment";
            const fileUrl = att.url || (att._id ? `/api/work-planner/attachments/${att._id}/preview` : "#");

            return (
              <div
                key={att._id || att.attachment_id || idx}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2 text-xs shadow-2xs hover:shadow-xs transition"
              >
                <div
                  onClick={() => onPreview && onPreview({ name: fileName, url: fileUrl, mime: att.mime_type })}
                  className="flex items-center gap-2 min-w-0 cursor-pointer hover:text-primary transition flex-1"
                  title="Click to preview"
                >
                  {getAttachmentIcon(att.mime_type, fileName)}
                  <div className="min-w-0">
                    <span className="truncate font-medium block text-[11px] text-foreground">
                      {fileName}
                    </span>
                    <span className="text-[10px] text-muted">
                      {formatBytes(att.size)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {onPreview && (
                    <button
                      type="button"
                      onClick={() => onPreview({ name: fileName, url: fileUrl, mime: att.mime_type })}
                      className="rounded-lg p-1.5 text-muted hover:text-primary hover:bg-surface-muted transition cursor-pointer"
                      title="Preview Document"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="rounded-lg p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 transition cursor-pointer"
                      title="Remove Attachment"
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
