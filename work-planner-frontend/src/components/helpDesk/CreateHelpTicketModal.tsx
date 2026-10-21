"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  LifeBuoy,
  Users,
  Search,
  Check,
  Paperclip,
  Trash2,
  AlertCircle,
  Sparkles,
  Calendar,
  Layers,
  FileText,
  Loader2,
  CheckSquare,
  Eye,
  FileSpreadsheet,
  FileImage,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCreateHelpTicketMutation,
  useUploadHelpDeskAttachmentMutation,
  useGetHelpDeskUsersQuery,
} from "@/store/api/helpDeskApiSlice";
import { FilePreviewModal, useFilePreview } from "@/components/workPlanner/FilePreviewModal";
import { readSessionFromStorage } from "@/utils/authStorage";
import type {
  HelpTicketCategory,
  HelpTicketPriority,
  HelpTicketAttachment,
} from "@/types/helpDesk";

interface CreateHelpTicketModalProps {
  open: boolean;
  initialCategory?: HelpTicketCategory;
  initialEntity?: {
    entity_type: "work_plan" | "visit" | "work_task" | "project" | "expense" | "none";
    entity_id?: string;
    entity_title?: string;
  };
  onClose: () => void;
  onSuccess?: (ticketId: string) => void;
}

const CATEGORY_OPTIONS: Array<{ value: HelpTicketCategory; label: string; description: string }> = [
  { value: "work_plan_support", label: "Work Plan Support", description: "Schedule, task rollover, plan approval questions" },
  { value: "visit_assistance", label: "Field Visit Assistance", description: "Client meeting coordination, locations, joint visits" },
  { value: "client_lead_requirement", label: "Client / Lead Requirement", description: "Product specifications, tenders, quotation demands" },
  { value: "product_pricing_query", label: "Product & Pricing Query", description: "Discount approvals, catalog specs, availability" },
  { value: "expense_account_query", label: "Expense & Account Query", description: "Claims, travel allowances, reimbursement approvals" },
  { value: "technical_portal_issue", label: "Technical & Portal Issue", description: "Bug reports, app errors, permissions & sync issues" },
  { value: "urgent_coordination", label: "Urgent Coordination", description: "Time-critical requirements needing immediate action" },
  { value: "general_requirement", label: "General Requirement", description: "General office, logistics, or cross-department help" },
  { value: "other", label: "Other Support", description: "Miscellaneous queries or custom requests" },
];

const PRIORITY_OPTIONS: Array<{ value: HelpTicketPriority; label: string; color: string; border: string }> = [
  { value: "urgent", label: "🔥 Urgent", color: "bg-rose-500/15 text-rose-600 dark:text-rose-400", border: "border-rose-500/30" },
  { value: "high", label: "⚡ High", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", border: "border-amber-500/30" },
  { value: "medium", label: "Medium", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
  { value: "low", label: "Low", color: "bg-surface-muted text-muted", border: "border-border" },
];

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getUserDepartmentName(u: any): string {
  if (!u || !u.department) return "";
  if (typeof u.department === "object") {
    return String(u.department.name || u.department.code || u.department.title || "");
  }
  return String(u.department);
}

export function CreateHelpTicketModal({
  open,
  initialCategory,
  initialEntity,
  onClose,
  onSuccess,
}: CreateHelpTicketModalProps) {
  const sessionToken = useMemo(() => {
    return typeof window !== "undefined" ? (readSessionFromStorage()?.token || null) : null;
  }, []);

  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  } = useFilePreview(sessionToken);

  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const currentUserId = String(sessionUser?._id || (sessionUser as any)?.id || "");

  const { data: allUsers = [], isLoading: usersLoading } = useGetHelpDeskUsersQuery(undefined, { skip: !open });
  const [createTicketMut, { isLoading: isSubmitting }] = useCreateHelpTicketMutation();
  const [uploadAttachmentMut] = useUploadHelpDeskAttachmentMutation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<HelpTicketCategory>(initialCategory || "general_requirement");
  const [priority, setPriority] = useState<HelpTicketPriority>("medium");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [attachments, setAttachments] = useState<HelpTicketAttachment[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  // Filter selectable users (exclude current user)
  const availableUsers = useMemo(() => {
    return allUsers.filter((u) => {
      const uId = String(u._id || u.id);
      return uId && uId !== currentUserId;
    });
  }, [allUsers, currentUserId]);

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return availableUsers;
    return availableUsers.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const dept = getUserDepartmentName(u).toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q);
    });
  }, [availableUsers, userSearchQuery]);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setCategory(initialCategory || "general_requirement");
      setPriority("medium");
      setSelectedUserIds([]);
      setUserSearchQuery("");
      setDueDate("");
      setAttachments([]);
    }
  }, [open, initialCategory]);

  if (!open) return null;

  const toggleUserTag = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingFiles(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.size > 25 * 1024 * 1024) {
          toast.error(`File ${f.name} exceeds 25MB limit`);
          continue;
        }

        const formData = new FormData();
        formData.append("file", f);
        formData.append("resourceType", "help_desk_ticket");

        const uploaded = await uploadAttachmentMut(formData).unwrap();
        setAttachments((prev) => [
          ...prev,
          {
            file_id: uploaded.file_id || (uploaded as any)._id,
            filename: uploaded.filename || f.name,
            original_name: uploaded.original_name || f.name,
            mime_type: uploaded.mime_type || f.type || "application/octet-stream",
            size: uploaded.size || f.size,
            url: uploaded.url || `/api/work-planner/attachments/${uploaded.file_id || (uploaded as any)._id}/preview`,
            uploaded_by: currentUserId || undefined,
            uploaded_by_name: sessionUser?.name || "Me",
            uploaded_at: new Date().toISOString(),
          },
        ]);
        toast.success(`Uploaded ${f.name}`);
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err?.data?.message || err?.message || "Failed to upload file to storage");
    } finally {
      setIsUploadingFiles(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePreviewAttachment = (att: HelpTicketAttachment) => {
    openPreview({
      name: att.original_name || att.filename || "Attachment",
      url: att.url || "#",
      mime: att.mime_type,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter a subject / title for your help request.");
      return;
    }
    if (!description.trim()) {
      toast.error("Please describe your requirement in detail.");
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error("Please tag at least one collaborator / portal user to assist you.");
      return;
    }

    try {
      const created = await createTicketMut({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        tagged_user_ids: selectedUserIds,
        related_entity: initialEntity || { entity_type: "none" },
        attachments,
        due_date: dueDate ? dueDate : null,
      }).unwrap();

      toast.success(`Help Ticket #${created.ticket_number} created and tagged users notified!`);
      onClose();
      if (onSuccess) onSuccess(created._id || (created as any).id || "");
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to create help ticket");
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200 overscroll-contain"
        role="presentation"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-help-ticket-title"
          className="w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Sheet Drag Indicator */}
          <div className="pt-2 sm:hidden flex justify-center">
            <div className="h-1.5 w-12 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-surface-muted/40 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <LifeBuoy className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <h2 id="create-help-ticket-title" className="text-sm sm:text-base font-bold text-foreground truncate">
                  Request Help / Tag Teammates
                </h2>
                <p className="text-[11px] sm:text-xs text-muted truncate">
                  Full lifecycle tracking with creator-governed resolution
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
            {/* Initial Context Entity (if opened from Work Plan / Visit) */}
            {initialEntity && initialEntity.entity_type !== "none" && (
              <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/25 px-3 py-2 text-xs text-primary font-medium">
                <Layers className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  Context: <strong className="uppercase">{initialEntity.entity_type.replace("_", " ")}</strong>{" "}
                  {initialEntity.entity_title ? `— ${initialEntity.entity_title}` : ""}
                </span>
              </div>
            )}

            {/* Subject / Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center justify-between">
                <span>Subject / Title *</span>
                <span className="text-[10px] text-muted font-normal">Clear &amp; specific</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Urgent discount approval for Tata Motors quotation"
                className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-xs font-medium text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none transition"
                required
              />
            </div>

            {/* Category & Priority Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as HelpTicketCategory)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-xs font-medium text-foreground outline-none focus:border-primary transition"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">
                  Priority Level *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {PRIORITY_OPTIONS.map((opt) => {
                    const isSelected = priority === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPriority(opt.value)}
                        className={`flex items-center justify-center rounded-xl py-2 px-1 text-xs font-bold transition border cursor-pointer active:scale-95 ${
                          isSelected
                            ? `${opt.color} ${opt.border} ring-2 ring-primary/20 shadow-xs`
                            : "border-border bg-surface-muted/50 text-muted hover:bg-surface-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Detailed Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center justify-between">
                <span>Detailed Requirement *</span>
                <span className="text-[10px] text-muted font-normal">What support is needed</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what is needed from the tagged teammates and any deadline context..."
                className="w-full rounded-xl border border-border bg-surface-muted p-3 text-xs font-medium text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none transition resize-none leading-relaxed"
                required
              />
            </div>

            {/* Tag Collaborators Section */}
            <div className="space-y-2 rounded-xl border border-border bg-surface-muted/30 p-3 sm:p-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" /> Tag Teammates *
                </label>
                <span className="text-xs text-primary font-bold">
                  {selectedUserIds.length} Selected
                </span>
              </div>

              {/* Search User Input */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search teammate by name, email, department..."
                  className="w-full rounded-xl border border-border bg-card pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted outline-none focus:border-primary"
                />
              </div>

              {/* User Selection Chips / List */}
              <div className="max-h-36 sm:max-h-40 overflow-y-auto space-y-1 pr-1 overscroll-contain">
                {usersLoading ? (
                  <div className="py-4 text-center text-xs text-muted flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading users...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-3 text-center text-xs text-muted">
                    No users matching &quot;{userSearchQuery}&quot;
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const uId = String(u._id || u.id);
                    const isSelected = selectedUserIds.includes(uId);
                    return (
                      <div
                        key={uId}
                        onClick={() => toggleUserTag(uId)}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs cursor-pointer transition border active:scale-[0.99] ${
                          isSelected
                            ? "bg-primary/15 border-primary/40 text-primary font-semibold shadow-xs"
                            : "border-transparent bg-card hover:bg-surface-muted text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[10px] shrink-0">
                            {u.name?.charAt(0) || "U"}
                          </div>
                          <span className="truncate font-medium">{u.name}</span>
                          {getUserDepartmentName(u) && (
                            <span className="rounded bg-surface-muted px-1.5 py-0.2 text-[9px] text-muted truncate">
                              {getUserDepartmentName(u)}
                            </span>
                          )}
                        </div>
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded border transition shrink-0 ${
                            isSelected
                              ? "bg-primary border-primary text-white"
                              : "border-border bg-surface-muted"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Attachments & Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              {/* File Upload with Real Storage and Previews */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-primary" /> Attachments
                  </span>
                  {isUploadingFiles && (
                    <span className="text-[10px] text-primary flex items-center gap-1 font-medium animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                    </span>
                  )}
                </label>

                <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted/50 p-2.5 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition cursor-pointer active:scale-95">
                  <UploadCloud className="h-4 w-4 text-primary" />
                  <span>Upload PDF, images, docs</span>
                  <input
                    type="file"
                    multiple
                    disabled={isUploadingFiles}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                </label>

                {attachments.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2 text-xs shadow-xs"
                      >
                        <div
                          onClick={() => handlePreviewAttachment(att)}
                          className="flex items-center gap-2 min-w-0 cursor-pointer hover:text-primary transition flex-1"
                          title="Click to preview file"
                        >
                          {att.mime_type?.includes("image") ? (
                            <FileImage className="h-4 w-4 text-blue-400 shrink-0" />
                          ) : att.mime_type?.includes("sheet") || att.mime_type?.includes("excel") ? (
                            <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="truncate font-medium block text-[11px]">
                              {att.original_name || att.filename}
                            </span>
                            <span className="text-[9px] text-muted">
                              {formatBytes(att.size)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handlePreviewAttachment(att)}
                            className="rounded-lg p-1.5 text-muted hover:text-primary hover:bg-surface-muted transition"
                            title="Preview file"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="rounded-lg p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 transition"
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

              {/* Target Due Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Needed By (Optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          </form>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-border bg-surface-muted/40 px-4 py-3 sm:px-5 sm:py-3.5 gap-2">
            <div className="text-[10px] sm:text-[11px] text-muted flex items-center gap-1 truncate">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">Teammates get in-app &amp; email alerts</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isSubmitting || isUploadingFiles}
                onClick={onClose}
                className="rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || isUploadingFiles}
                onClick={handleSubmit}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 sm:px-5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    <LifeBuoy className="h-4 w-4" /> Create Ticket
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Document / Image Preview Modal */}
      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={downloadFile}
        subtitle="Help Ticket Attachment Preview"
      />
    </>
  );
}

export default CreateHelpTicketModal;
