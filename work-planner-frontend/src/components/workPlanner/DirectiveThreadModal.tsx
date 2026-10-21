"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  X,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Clock,
  User,
  Calendar,
  ExternalLink,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Loader2,
  RefreshCw,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Eye,
  Trash2,
  Download,
  UploadCloud,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAddJuniorFollowupMutation,
  useUpdateSeniorRemarkStatusMutation,
  useUploadWorkPlanAttachmentMutation,
} from "@/store/api/workPlannerApiSlice";
import { readSessionFromStorage, isWpElevated, isWpAdmin } from "@/utils/authStorage";
import type { SeniorRemarkFeedItem, FollowupActionStatus, FollowupAttachmentItem } from "@/types/workPlanner";
import { formatPlanDate, formatDateTime } from "./workPlanUtils";
import { DayEndRichEditor } from "./DayEndRichEditor";
import { FilePreviewModal, useFilePreview, isImagePreview, isPdfPreview } from "./FilePreviewModal";
import { resolvePublicAssetUrl } from "@/lib/env";

export interface DirectiveThreadModalProps {
  open: boolean;
  item: SeniorRemarkFeedItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface StagedAttachment {
  id?: string;
  name: string;
  size: number;
  mime?: string;
  url?: string;
  uploading: boolean;
  error?: string;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mime: string = "", name: string = "") {
  if (isImagePreview(mime, name)) {
    return <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0" />;
  }
  if (isPdfPreview(mime, name)) {
    return <FileText className="h-4 w-4 text-rose-500 shrink-0" />;
  }
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv") || /\.(xlsx?|csv)$/i.test(name)) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />;
  }
  return <Paperclip className="h-4 w-4 text-primary shrink-0" />;
}

export function DirectiveThreadModal({
  open,
  item,
  onClose,
  onSuccess,
}: DirectiveThreadModalProps) {
  const session = readSessionFromStorage();
  const sessionUser = session?.user;
  const sessionToken = session?.token || undefined;
  const currentUserId = String(sessionUser?._id || (sessionUser as any)?.id || "");
  const elevatedRole = isWpElevated(sessionUser);

  const [followupText, setFollowupText] = useState("");
  const [actionStatus, setActionStatus] = useState<FollowupActionStatus>("completed");
  const [resolutionRemarks, setResolutionRemarks] = useState("");
  const [showResolveInput, setShowResolveInput] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [addFollowupMut, { isLoading: isSubmittingFollowup }] = useAddJuniorFollowupMutation();
  const [updateStatusMut, { isLoading: isUpdatingStatus }] = useUpdateSeniorRemarkStatusMutation();
  const [uploadAttachmentMut] = useUploadWorkPlanAttachmentMutation();

  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  } = useFilePreview(sessionToken);

  if (!open || !item) return null;

  const isJuniorOwner = currentUserId === String(item.sales_user._id);
  const isSeniorAuthor = currentUserId === String(item.senior_user._id);
  const canResolve = isWpAdmin(sessionUser) || (elevatedRole && !isJuniorOwner);

  const isObjection = item.remark_type === "objection";
  const isAppreciation = item.remark_type === "appreciation";
  const isDirective = item.remark_type === "instruction";

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    for (const file of fileArray) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`File "${file.name}" exceeds 25MB limit.`);
        continue;
      }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newStaged: StagedAttachment = {
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
        uploading: true,
      };

      setStagedFiles((prev) => [...prev, newStaged]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await uploadAttachmentMut(formData).unwrap();
        const resolvedId = (res as any)?._id || (res as any)?.id || (res as any)?.attachment_id;
        const resolvedUrl = (res as any)?.url || (res as any)?.file_name || (resolvedId ? `/api/work-planner/attachments/${resolvedId}/preview` : "");

        setStagedFiles((prev) =>
          prev.map((f) =>
            f === newStaged
              ? {
                  ...f,
                  id: resolvedId,
                  url: resolvedUrl,
                  uploading: false,
                }
              : f
          )
        );
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}`);
        setStagedFiles((prev) =>
          prev.map((f) =>
            f === newStaged
              ? { ...f, uploading: false, error: err?.data?.message || "Upload failed" }
              : f
          )
        );
      }
    }
  };

  const handleRemoveStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSendFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = followupText.trim();
    if (!clean || clean === "<p></p>") {
      toast.error("Please enter your follow-up remarks or clarification.");
      return;
    }

    const stillUploading = stagedFiles.some((f) => f.uploading);
    if (stillUploading) {
      toast.warning("Please wait for all attachments to finish uploading.");
      return;
    }

    const validAttachments = stagedFiles.filter((f) => f.id && !f.error);
    const attachmentIds = validAttachments.map((f) => f.id as string);
    const attachmentDetails = validAttachments.map((f) => ({
      attachment_id: f.id,
      filename: f.name,
      original_name: f.name,
      mime_type: f.mime,
      size: f.size,
      url: f.url,
    }));

    try {
      await addFollowupMut({
        target_type: item.target_type,
        target_id: item.target_id,
        remark_id: item.remark_id,
        response: clean,
        action_status: actionStatus,
        attachments: attachmentIds.length > 0 ? attachmentIds : undefined,
        attachment_details: attachmentDetails.length > 0 ? attachmentDetails : undefined,
      }).unwrap();

      toast.success("Follow-up response submitted successfully!");
      setFollowupText("");
      setStagedFiles([]);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to submit follow-up response");
    }
  };

  const handleResolve = async () => {
    try {
      await updateStatusMut({
        target_type: item.target_type,
        target_id: item.target_id,
        remark_id: item.remark_id,
        status: "resolved",
        resolution_remarks: resolutionRemarks.trim() || undefined,
      }).unwrap();

      toast.success("Directive / Objection marked as Resolved!");
      setShowResolveInput(false);
      setResolutionRemarks("");
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to resolve directive");
    }
  };

  const handleReopen = async () => {
    try {
      await updateStatusMut({
        target_type: item.target_type,
        target_id: item.target_id,
        remark_id: item.remark_id,
        status: "pending_response",
      }).unwrap();

      toast.success("Directive reopened for further junior follow-up.");
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to reopen directive");
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative flex flex-col w-full sm:max-w-3xl max-h-[94vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        >
          {/* Mobile Drag Indicator Handle */}
          <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
            <div className="h-1.5 w-12 rounded-full bg-border" />
          </div>

          {/* Header with Classification Badge */}
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-surface-muted/80 via-card to-card px-4 sm:px-6 py-3.5 sm:py-4 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div
                className={`flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl border shadow-xs ${
                  isAppreciation
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : isObjection
                    ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
                    : "bg-primary/15 border-primary/30 text-primary"
                }`}
              >
                {isAppreciation ? (
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : isObjection ? (
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : (
                  <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                    {isAppreciation
                      ? "Appreciation"
                      : isObjection
                      ? "Objection"
                      : "Senior Directive"}
                  </h3>

                  {/* Priority Badge */}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                      item.priority === "urgent"
                        ? "bg-rose-500/15 text-rose-600 border-rose-500/30"
                        : item.priority === "high"
                        ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                        : item.priority === "low"
                        ? "bg-slate-500/15 text-slate-600 border-slate-500/30"
                        : "bg-blue-500/15 text-blue-600 border-blue-500/30"
                    }`}
                  >
                    {item.priority}
                  </span>

                  {/* Status Badge */}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                      item.status === "resolved"
                        ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                        : item.status === "responded"
                        ? "bg-sky-500/15 text-sky-600 border-sky-500/30"
                        : "bg-amber-500/15 text-amber-600 border-amber-500/30 animate-pulse"
                    }`}
                  >
                    {item.status === "resolved"
                      ? "✅ Resolved"
                      : item.status === "responded"
                      ? "💬 Responded"
                      : "⏳ Pending"}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-muted mt-0.5 truncate">
                  Target: <strong className="text-foreground capitalize">{item.target_type}</strong> &bull;{" "}
                  {item.title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Link
                href={`/dashboard/plans/${item.plan_id}`}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface-muted px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-foreground active:scale-95 transition"
                title="Open full Work Plan"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">View Plan</span>
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground active:scale-95 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Metadata Card */}
            <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted uppercase font-bold tracking-wider">
                    Concerned Executive
                  </span>
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span>{item.sales_user.name}</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted uppercase font-bold tracking-wider">
                    Senior Authority
                  </span>
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    <span>{item.senior_user.name}</span>
                    <span className="text-[10px] text-muted font-normal">({item.senior_user.role})</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted uppercase font-bold tracking-wider">
                    Plan Date
                  </span>
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>{formatPlanDate(item.plan_date)}</span>
                  </div>
                </div>

                {item.expected_followup_date && (
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider">
                      Expected Follow-up By
                    </span>
                    <div className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatPlanDate(item.expected_followup_date)}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted uppercase font-bold tracking-wider">
                    Directive Created
                  </span>
                  <div className="font-medium text-muted">
                    {formatDateTime(item.created_at)}
                  </div>
                </div>
              </div>
            </div>

            {/* Original Senior Directive Card */}
            <div
              className={`rounded-xl border p-4 space-y-2 shadow-xs ${
                isAppreciation
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : isObjection
                  ? "border-rose-500/30 bg-rose-500/5"
                  : "border-primary/30 bg-primary/5"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                  {isAppreciation ? (
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                  ) : isObjection ? (
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  )}
                  <span>
                    Directive from: <strong className="text-primary">{item.senior_user?.name || "Senior Authority"}</strong>
                    {item.senior_user?.role && <span className="ml-1 text-[10px] font-normal text-muted">({item.senior_user.role})</span>}
                  </span>
                </div>
                <span className="text-[10px] text-muted">{formatDateTime(item.created_at)}</span>
              </div>

              <div
                className="rich-text-content prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed text-foreground"
                dangerouslySetInnerHTML={{ __html: item.remark }}
              />
            </div>

            {/* Thread of Junior Follow-up Responses */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-bold text-foreground">
                    Follow-up &amp; Clarification History ({item.followup_remarks.length})
                  </h4>
                </div>
                {item.followup_remarks.length === 0 && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    Awaiting initial response from {item.sales_user.name}
                  </span>
                )}
              </div>

              {item.followup_remarks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                  No follow-up remarks submitted yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {item.followup_remarks.map((f, idx) => {
                    const isActionCompleted = f.action_status === "completed";
                    const isClarification = f.action_status === "clarification_provided";
                    const isHelp = f.action_status === "need_help";

                    // Normalize attachments
                    const followupAttachments: FollowupAttachmentItem[] = Array.isArray(f.attachment_details) && f.attachment_details.length > 0
                      ? f.attachment_details
                      : Array.isArray(f.attachments)
                      ? f.attachments.map((att: any) =>
                          typeof att === "object"
                            ? att
                            : {
                                _id: String(att),
                                attachment_id: String(att),
                                filename: "attachment",
                                original_name: "attachment",
                                mime_type: "application/octet-stream",
                                url: `/api/work-planner/attachments/${att}/preview`,
                              }
                        )
                      : [];

                    return (
                      <div
                        key={f._id || idx}
                        className="rounded-xl border border-border bg-card p-4 space-y-3 text-xs shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{f.user_name || "Executive"}</span>
                            <span className="text-[10px] text-muted">
                              ({f.role && f.role !== "Senior Authority" ? f.role : "Executive"})
                            </span>

                            {f.action_status && (
                              <span
                                className={`rounded-md px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider border ${
                                  isActionCompleted
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : isClarification
                                    ? "bg-sky-500/10 text-sky-600 border-sky-500/20"
                                    : isHelp
                                    ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                }`}
                              >
                                {f.action_status.replace("_", " ")}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted font-normal">
                            {formatDateTime(f.created_at)}
                          </span>
                        </div>

                        <div
                          className="rich-text-content prose prose-sm dark:prose-invert max-w-none text-xs text-foreground leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: f.response }}
                        />

                        {/* Follow-up Attachments List & Previews */}
                        {followupAttachments.length > 0 && (
                          <div className="pt-2 border-t border-border/60 space-y-1.5">
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-muted">
                              <Paperclip className="h-3.5 w-3.5 text-primary" />
                              <span>Attached Files ({followupAttachments.length}):</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {followupAttachments.map((att, aIdx) => {
                                const fileName = att.original_name || att.filename || `File ${aIdx + 1}`;
                                const mime = att.mime_type || "";
                                const isImg = isImagePreview(mime, fileName);
                                const isPdf = isPdfPreview(mime, fileName);
                                const rawUrl = att.url || (att.attachment_id ? `/api/work-planner/attachments/${att.attachment_id}/preview` : "");
                                const fileUrl = rawUrl ? resolvePublicAssetUrl(rawUrl, sessionToken) : "";

                                return (
                                  <div
                                    key={att._id || att.attachment_id || aIdx}
                                    className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted/40 p-2 text-xs transition hover:border-primary/40 hover:bg-surface-muted/70"
                                  >
                                    <div
                                      onClick={() =>
                                        fileUrl &&
                                        openPreview({
                                          name: fileName,
                                          url: fileUrl,
                                          mime: mime,
                                        })
                                      }
                                      className="flex min-w-0 flex-1 items-center gap-2 cursor-pointer"
                                      title={`Click to preview ${fileName}`}
                                    >
                                      {getFileIcon(mime, fileName)}
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-foreground group-hover:text-primary transition">
                                          {fileName}
                                        </p>
                                        <p className="text-[10px] text-muted">
                                          {formatFileSize(att.size)} {isImg ? "• Image" : isPdf ? "• PDF" : ""}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      {fileUrl && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openPreview({
                                              name: fileName,
                                              url: fileUrl,
                                              mime: mime,
                                            })
                                          }
                                          className="rounded-md p-1 text-muted hover:bg-card hover:text-primary transition"
                                          title="Preview file"
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                      {fileUrl && (
                                        <a
                                          href={fileUrl}
                                          download={fileName}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="rounded-md p-1 text-muted hover:bg-card hover:text-foreground transition"
                                          title="Download file"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Resolution Card if Resolved */}
            {item.status === "resolved" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Directive / Objection Marked as Resolved</span>
                  </div>
                  {item.resolved_at && (
                    <span className="text-[10px] text-muted">{formatDateTime(item.resolved_at)}</span>
                  )}
                </div>
                {item.resolved_by_name && (
                  <div className="text-[11px] text-muted">
                    Resolved by: <strong className="text-foreground">{item.resolved_by_name}</strong>
                  </div>
                )}
                {item.resolution_remarks && (
                  <p className="text-xs text-foreground italic border-t border-emerald-500/20 pt-1.5">
                    &ldquo;{item.resolution_remarks}&rdquo;
                  </p>
                )}
              </div>
            )}

            {/* Junior Response Input Form */}
            {item.status !== "resolved" && (
              <form onSubmit={handleSendFollowup} className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {isObjection
                        ? "Submit Clarification / Corrective Action"
                        : isAppreciation
                        ? "Acknowledge & Reply"
                        : "Submit Progress & Follow-up Response"}
                    </span>
                  </label>
                  <span className="text-[10px] text-muted">Rich Text &amp; Attachments Supported</span>
                </div>

                {/* Action Status Picker */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted">Action Status:</span>
                  <button
                    type="button"
                    onClick={() => setActionStatus("completed")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition cursor-pointer ${
                      actionStatus === "completed"
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        : "bg-surface-muted border-border text-muted hover:text-foreground"
                    }`}
                  >
                    Completed / Done
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionStatus("clarification_provided")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition cursor-pointer ${
                      actionStatus === "clarification_provided"
                        ? "bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-400"
                        : "bg-surface-muted border-border text-muted hover:text-foreground"
                    }`}
                  >
                    Clarification Provided
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionStatus("in_progress")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition cursor-pointer ${
                      actionStatus === "in_progress"
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400"
                        : "bg-surface-muted border-border text-muted hover:text-foreground"
                    }`}
                  >
                    In Progress
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionStatus("need_help")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition cursor-pointer ${
                      actionStatus === "need_help"
                        ? "bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400"
                        : "bg-surface-muted border-border text-muted hover:text-foreground"
                    }`}
                  >
                    Need Guidance
                  </button>
                </div>

                <DayEndRichEditor
                  value={followupText}
                  onChange={setFollowupText}
                  minHeight="100px"
                  placeholder={
                    isObjection
                      ? "Provide clarification, reason, or details on corrective action taken regarding this objection..."
                      : "Enter outcome, follow-up progress, or action updates..."
                  }
                />

                {/* Multiple Attachments Zone */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Paperclip className="h-3.5 w-3.5 text-primary" />
                      <span>Upload Proof / Supporting Files:</span>
                      {stagedFiles.length > 0 && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.2 text-[10px] font-bold text-primary">
                          {stagedFiles.length} file{stagedFiles.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted transition cursor-pointer"
                    >
                      <UploadCloud className="h-3.5 w-3.5 text-primary" />
                      <span>Choose Files</span>
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileUpload(e.target.files);
                        e.target.value = "";
                      }
                    }}
                  />

                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleFileUpload(e.dataTransfer.files);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center rounded-xl border border-dashed p-3 text-center transition cursor-pointer ${
                      isDragOver
                        ? "border-primary bg-primary/10"
                        : "border-border/80 bg-surface-muted/20 hover:border-primary/50 hover:bg-surface-muted/50"
                    }`}
                  >
                    <UploadCloud className="h-5 w-5 text-muted mb-1" />
                    <p className="text-xs text-foreground font-medium">
                      Drag &amp; drop files here, or <span className="text-primary underline">browse</span>
                    </p>
                    <p className="text-[10px] text-muted mt-0.5">
                      Supports multiple Images (PNG, JPG), PDF documents, Excel sheets, DOCX up to 25MB each
                    </p>
                  </div>

                  {/* Staged files preview list */}
                  {stagedFiles.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {stagedFiles.map((sf, idx) => (
                        <div
                          key={sf.id || idx}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2 text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {sf.uploading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                            ) : (
                              getFileIcon(sf.mime, sf.name)
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground">{sf.name}</p>
                              <p className="text-[10px] text-muted">
                                {sf.uploading ? "Uploading..." : sf.error ? "Failed" : formatFileSize(sf.size)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {sf.url && !sf.uploading && (
                              <button
                                type="button"
                                onClick={() => {
                                  const previewUrl = resolvePublicAssetUrl(sf.url!, sessionToken);
                                  openPreview({
                                    name: sf.name,
                                    url: previewUrl,
                                    mime: sf.mime,
                                  });
                                }}
                                className="rounded-md p-1 text-muted hover:text-primary hover:bg-surface-muted transition"
                                title="Preview file"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveStagedFile(idx)}
                              className="rounded-md p-1 text-muted hover:text-rose-500 hover:bg-surface-muted transition"
                              title="Remove file"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                  <button
                    type="submit"
                    disabled={isSubmittingFollowup || stagedFiles.some((f) => f.uploading)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition cursor-pointer"
                  >
                    {isSubmittingFollowup ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>Post Follow-up Remark</span>
                  </button>
                </div>
              </form>
            )}

            {/* Senior Resolve Controls */}
            {canResolve && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold text-foreground">Senior Resolution Controls</h4>
                  </div>

                  {item.status === "resolved" ? (
                    <button
                      type="button"
                      onClick={handleReopen}
                      disabled={isUpdatingStatus}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1 text-xs font-bold text-muted hover:text-foreground hover:bg-surface-muted transition cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Reopen Directive</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowResolveInput(!showResolveInput)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Mark as Resolved</span>
                    </button>
                  )}
                </div>

                {showResolveInput && item.status !== "resolved" && (
                  <div className="space-y-2 pt-2 border-t border-border animate-in fade-in duration-150">
                    <label className="text-xs font-medium text-foreground">
                      Resolution Note (Optional):
                    </label>
                    <input
                      type="text"
                      value={resolutionRemarks}
                      onChange={(e) => setResolutionRemarks(e.target.value)}
                      placeholder="e.g. Clarification accepted, issue sorted during team call..."
                      className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowResolveInput(false)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleResolve}
                        disabled={isUpdatingStatus}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                      >
                        {isUpdatingStatus ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>Confirm &amp; Resolve</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border bg-surface-muted/30 px-6 py-3">
            <div className="text-[11px] text-muted">
              Directive ID: <code className="text-foreground">{item.remark_id}</code>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Embedded File Preview Lightbox / Reader */}
      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={downloadFile}
        subtitle="Directive Follow-up Attachment"
      />
    </>
  );
}
