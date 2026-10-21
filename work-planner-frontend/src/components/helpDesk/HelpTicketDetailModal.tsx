"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Send,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Users,
  UserPlus,
  Star,
  RotateCcw,
  FileText,
  Download,
  ExternalLink,
  MessageSquare,
  Shield,
  HelpCircle,
  ChevronRight,
  RefreshCw,
  Flame,
  Check,
  CheckCheck,
  Building2,
  Trash2,
  Lock,
  Eye,
  FileSpreadsheet,
  FileImage,
  UploadCloud,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetHelpTicketByIdQuery,
  useAddHelpReplyMutation,
  useAcknowledgeHelpTicketMutation,
  useProposeHelpSolutionMutation,
  useTagCollaboratorsMutation,
  useReopenHelpTicketMutation,
  useCancelHelpTicketMutation,
  useUploadHelpDeskAttachmentMutation,
  useMarkTicketAsReadMutation,
  useGetHelpDeskUsersQuery,
} from "@/store/api/helpDeskApiSlice";
import { FilePreviewModal, useFilePreview } from "@/components/workPlanner/FilePreviewModal";
import type {
  HelpTicketRecord,
  HelpTicketAttachment,
  HelpTicketCategory,
  HelpTicketPriority,
  HelpTicketStatus,
} from "@/types/helpDesk";
import { readSessionFromStorage } from "@/utils/authStorage";

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getUserDepartmentName(u: any): string {
  if (!u || !u.department) return "";
  if (typeof u.department === "object") {
    return String(u.department.name || u.department.code || u.department.title || "");
  }
  return String(u.department);
}

interface HelpTicketDetailModalProps {
  ticketId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenResolveModal: (ticket: HelpTicketRecord) => void;
}

const CATEGORY_LABELS: Record<HelpTicketCategory, string> = {
  work_plan_support: "Work Plan Support",
  visit_assistance: "Field Visit Assistance",
  client_lead_requirement: "Client & Lead Requirement",
  product_pricing_query: "Product & Pricing Query",
  expense_account_query: "Expense & Accounting",
  technical_portal_issue: "Technical & Portal Issue",
  urgent_coordination: "Urgent Coordination",
  general_requirement: "General Requirement",
  other: "Other Requirement",
};

const PRIORITY_BADGES: Record<
  HelpTicketPriority,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  urgent: {
    label: "Urgent",
    bg: "bg-red-500/10",
    text: "text-red-500",
    border: "border-red-500/30",
    icon: Flame,
  },
  high: {
    label: "High",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    border: "border-amber-500/30",
    icon: AlertCircle,
  },
  medium: {
    label: "Medium",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    border: "border-blue-500/30",
    icon: Clock,
  },
  low: {
    label: "Low",
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/30",
    icon: Clock,
  },
};

const STATUS_BADGES: Record<
  HelpTicketStatus,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  open: {
    label: "Open",
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    border: "border-blue-500/30",
    icon: Clock,
  },
  in_progress: {
    label: "In Progress",
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
    icon: Clock,
  },
  solution_proposed: {
    label: "Solution Proposed",
    bg: "bg-purple-500/15",
    text: "text-purple-300",
    border: "border-purple-500/40",
    icon: Sparkles,
  },
  resolved: {
    label: "Resolved",
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    icon: CheckCircle2,
  },
  reopened: {
    label: "Reopened",
    bg: "bg-rose-500/15",
    text: "text-rose-400",
    border: "border-rose-500/30",
    icon: RotateCcw,
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-slate-500/15",
    text: "text-slate-400",
    border: "border-slate-500/30",
    icon: X,
  },
};

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(att: HelpTicketAttachment) {
  const mime = (att.mime_type || "").toLowerCase();
  const name = (att.original_name || att.filename || "").toLowerCase();
  if (mime.includes("image") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) {
    return <FileImage className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
  }
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv") || /\.(xlsx?|csv)$/i.test(name)) {
    return <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  }
  return <FileText className="h-3.5 w-3.5 text-primary shrink-0" />;
}

export function HelpTicketDetailModal({
  ticketId,
  isOpen,
  onClose,
  onOpenResolveModal,
}: HelpTicketDetailModalProps) {
  const repliesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mobileTab, setMobileTab] = useState<"discussion" | "details">("discussion");
  const [replyMessage, setReplyMessage] = useState("");
  const [isProposingSolution, setIsProposingSolution] = useState(false);
  const [attachments, setAttachments] = useState<HelpTicketAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  useEffect(() => {
    const session = readSessionFromStorage();
    if (session?.user) {
      setCurrentUser(session.user);
    }
  }, []);

  const {
    data: ticket,
    isLoading,
    isFetching,
    error: ticketError,
    refetch,
  } = useGetHelpTicketByIdQuery(ticketId || "", {
    skip: !isOpen || !ticketId,
  });

  const { data: usersData } = useGetHelpDeskUsersQuery(undefined, {
    skip: !showTagModal,
  });
  const allUsers = (Array.isArray(usersData) ? usersData : (usersData as any)?.data) || [];

  const [addReply, { isLoading: isReplying }] = useAddHelpReplyMutation();
  const [acknowledgeTicket, { isLoading: isAcknowledging }] =
    useAcknowledgeHelpTicketMutation();
  const [proposeSolution, { isLoading: isSubmittingSolution }] =
    useProposeHelpSolutionMutation();
  const [tagCollaborators, { isLoading: isTagging }] =
    useTagCollaboratorsMutation();
  const [reopenTicket, { isLoading: isReopening }] =
    useReopenHelpTicketMutation();
  const [cancelTicket, { isLoading: isCancelling }] =
    useCancelHelpTicketMutation();
  const [uploadAttachmentMut] = useUploadHelpDeskAttachmentMutation();
  const [markTicketAsRead] = useMarkTicketAsReadMutation();

  // Automatically mark ticket as read for the current user when modal opens or ticket refreshes
  useEffect(() => {
    if (isOpen && ticketId && ticket?._id) {
      markTicketAsRead(ticketId).catch(() => {});
    }
  }, [isOpen, ticketId, ticket?._id, markTicketAsRead]);

  // Scroll to bottom when replies load or change
  useEffect(() => {
    if (ticket?.replies?.length && mobileTab === "discussion") {
      repliesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [ticket?.replies, mobileTab]);

  if (!isOpen || !ticketId) return null;

  const currentUserId = String(currentUser?._id || currentUser?.id || "");
  const creatorId =
    typeof ticket?.created_by === "object"
      ? String(ticket?.created_by?._id)
      : String(ticket?.created_by || "");

  const isCreator = Boolean(
    ticket?.permissions?.isCreator ?? (currentUserId && creatorId === currentUserId)
  );

  const isTagged = Boolean(
    ticket?.permissions?.isTagged ??
      ticket?.tagged_users?.some(
        (tu) =>
          String(typeof tu.user === "object" ? tu.user._id : tu.user) ===
          currentUserId
      )
  );

  const canResolve = Boolean(ticket?.permissions?.canResolve ?? isCreator);
  const canProposeSolution = Boolean(
    ticket?.permissions?.canProposeSolution ??
      (isTagged &&
        ticket?.status !== "resolved" &&
        ticket?.status !== "cancelled")
  );

  const myTaggedRecord = ticket?.tagged_users?.find(
    (tu) =>
      String(typeof tu.user === "object" ? tu.user._id : tu.user) ===
      currentUserId
  );
  const hasAcknowledged = Boolean(myTaggedRecord?.acknowledged_at);

  const statusBadge = ticket ? STATUS_BADGES[ticket.status] : STATUS_BADGES.open;
  const priorityBadge = ticket
    ? PRIORITY_BADGES[ticket.priority]
    : PRIORITY_BADGES.medium;
  const PriorityIcon = priorityBadge.icon;
  const StatusIcon = statusBadge.icon;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`File ${file.name} exceeds 25MB limit`);
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("resourceType", "help_desk_ticket");
        if (ticket?._id) formData.append("ticket_id", ticket._id);

        const uploaded = await uploadAttachmentMut(formData).unwrap();
        setAttachments((prev) => [
          ...prev,
          {
            file_id: uploaded.file_id || (uploaded as any)._id,
            filename: uploaded.filename || file.name,
            original_name: uploaded.original_name || file.name,
            mime_type: uploaded.mime_type || file.type,
            size: uploaded.size || file.size,
            url: uploaded.url || `/api/work-planner/attachments/${uploaded.file_id || (uploaded as any)._id}/preview`,
            uploaded_by: currentUserId || undefined,
            uploaded_by_name: currentUser?.name || "Me",
            uploaded_at: new Date().toISOString(),
          },
        ]);
        toast.success(`Attached ${file.name}`);
      }
    } catch (err: any) {
      console.error("Failed to upload attachment:", err);
      toast.error(err?.data?.message || err?.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePreviewAttachment = (att: HelpTicketAttachment) => {
    openPreview({
      name: att.original_name || att.filename || "Attachment",
      url: att.url || "#",
      mime: att.mime_type,
    });
  };

  const handleSendReply = async () => {
    if (!ticket || (!replyMessage.trim() && attachments.length === 0)) return;

    try {
      if (isProposingSolution) {
        await proposeSolution({
          ticketId: ticket._id,
          body: {
            solution_text: replyMessage.trim(),
            attachments,
          },
        }).unwrap();
        setIsProposingSolution(false);
        toast.success("Solution proposed. Creator has been notified to verify!");
      } else {
        await addReply({
          ticketId: ticket._id,
          body: {
            message: replyMessage.trim(),
            reply_type: "comment",
            attachments,
          },
        }).unwrap();
        toast.success("Message sent");
      }
      setReplyMessage("");
      setAttachments([]);
    } catch (err: any) {
      console.error("Failed to post message:", err);
      toast.error(err?.data?.message || "Failed to post message. Please try again.");
    }
  };

  const handleAcknowledge = async () => {
    if (!ticket) return;
    try {
      await acknowledgeTicket(ticket._id).unwrap();
      toast.success("Ticket acknowledged and moved to In Progress");
    } catch (err: any) {
      console.error("Failed to acknowledge:", err);
    }
  };

  const handleTagSubmit = async () => {
    if (!ticket || selectedUserIds.length === 0) return;
    try {
      await tagCollaborators({
        ticketId: ticket._id,
        user_ids: selectedUserIds,
      }).unwrap();
      setSelectedUserIds([]);
      setShowTagModal(false);
      toast.success("Collaborators tagged successfully");
    } catch (err: any) {
      console.error("Failed to tag users:", err);
      toast.error(err?.data?.message || "Failed to tag collaborators.");
    }
  };

  const handleReopenSubmit = async () => {
    if (!ticket || !reopenReason.trim()) return;
    try {
      await reopenTicket({
        ticketId: ticket._id,
        body: { reason: reopenReason.trim() },
      }).unwrap();
      setReopenReason("");
      setShowReopenModal(false);
      toast.success("Revision requested and ticket reopened");
    } catch (err: any) {
      console.error("Failed to reopen ticket:", err);
      toast.error(err?.data?.message || "Failed to reopen ticket.");
    }
  };

  const handleCancel = async () => {
    if (!ticket) return;
    if (
      !window.confirm(
        "Are you sure you want to cancel this help ticket? This will close the request."
      )
    )
      return;
    try {
      await cancelTicket({
        ticketId: ticket._id,
        reason: "Cancelled by creator",
      }).unwrap();
      toast.success("Help ticket cancelled");
    } catch (err: any) {
      console.error("Failed to cancel ticket:", err);
    }
  };

  const filteredUsersToTag = allUsers.filter((u: any) => {
    const uid = String(u._id || u.id);
    const alreadyTagged = ticket?.tagged_users?.some(
      (tu) =>
        String(typeof tu.user === "object" ? tu.user._id : tu.user) === uid
    );
    const isOwner = uid === creatorId;
    const matchesSearch =
      (u.name || "").toLowerCase().includes(tagSearch.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(tagSearch.toLowerCase()) ||
      getUserDepartmentName(u).toLowerCase().includes(tagSearch.toLowerCase());
    return !alreadyTagged && !isOwner && matchesSearch;
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-sm overflow-hidden animate-fadeIn overscroll-contain">
        <div className="relative flex flex-col h-[94vh] sm:h-[90vh] sm:max-h-[92vh] w-full max-w-6xl rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* Mobile Drag Pill */}
          <div className="pt-2 sm:hidden flex justify-center bg-surface-muted/60">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {/* TOP MODAL HEADER */}
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-muted/60 px-3.5 py-2.5 sm:px-6 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 text-primary font-mono text-xs font-bold shrink-0">
                HD
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-xs font-black text-foreground">
                    {ticket?.ticket_number || "..."}
                  </span>
                  {ticket && (
                    <>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold ${priorityBadge.bg} ${priorityBadge.text} ${priorityBadge.border}`}
                      >
                        <PriorityIcon className="h-3 w-3" />
                        {priorityBadge.label}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusBadge.label}
                      </span>
                      <span className="hidden md:inline-block rounded-md bg-card/60 px-2 py-0.5 text-[10px] font-medium text-muted border border-border">
                        {CATEGORY_LABELS[ticket.category] || ticket.category}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-muted truncate mt-0.5 max-w-[220px] sm:max-w-md">
                  {ticket?.title || "Loading ticket..."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => refetch()}
                title="Refresh discussion"
                className={`rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer ${
                  isFetching ? "animate-spin text-primary" : ""
                }`}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* MOBILE SEGMENTED VIEW SWITCHER (Mobile only) */}
          <div className="flex lg:hidden border-b border-border bg-card px-2 py-1.5 gap-2">
            <button
              type="button"
              onClick={() => setMobileTab("discussion")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition ${
                mobileTab === "discussion"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-surface-muted text-muted"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Discussion ({ticket?.replies?.length || 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("details")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition ${
                mobileTab === "details"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-surface-muted text-muted"
              }`}
            >
              <Info className="h-3.5 w-3.5" />
              <span>Details &amp; People ({ticket?.tagged_users?.length || 0})</span>
            </button>
          </div>

          {/* MODAL MAIN CONTENT */}
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center p-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs text-muted">Loading Help Ticket thread...</p>
              </div>
            </div>
          ) : !ticket ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 sm:p-12 text-center max-w-md mx-auto space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <Lock className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">
                  Access Restricted
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  {(ticketError as any)?.data?.message ||
                    "You do not have access to this ticket. Only the creator and tagged collaborators can view or participate in this request."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          ) : (
            <div className="flex flex-1 flex-col lg:flex-row min-h-0 overflow-hidden">
              {/* LEFT / MAIN COLUMN: Description, Solutions, Timeline & Chat */}
              <div
                className={`flex flex-1 flex-col min-h-0 overflow-y-auto border-b lg:border-b-0 lg:border-r border-border p-3.5 sm:p-6 space-y-4 sm:space-y-5 overscroll-contain ${
                  mobileTab === "details" ? "hidden lg:flex" : "flex"
                }`}
              >
                {/* CREATOR & REQUIREMENT STATEMENT CARD */}
                <div className="rounded-2xl border border-border bg-surface-muted/40 p-3.5 sm:p-4 space-y-2.5 sm:space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs sm:text-sm shrink-0 border border-primary/30">
                        {ticket.creator_snapshot?.name?.charAt(0) || "U"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-foreground truncate">
                            {ticket.creator_snapshot?.name || "Creator"}
                          </span>
                          {ticket.creator_snapshot?.department && (
                            <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-semibold text-primary truncate">
                              {ticket.creator_snapshot.department}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted mt-0.5">
                          {new Date(ticket.createdAt).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                    </div>

                    {ticket.due_date && (
                      <div className="flex items-center gap-1 text-[10px] sm:text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg shrink-0">
                        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="font-semibold">
                          Due: {new Date(ticket.due_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <h3 className="text-xs sm:text-sm font-black text-foreground">
                      {ticket.title}
                    </h3>
                    <div className="rounded-xl bg-card/80 p-3 text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap border border-border/60">
                      {ticket.description}
                    </div>
                  </div>

                  {/* INITIAL ATTACHMENTS WITH PREVIEWS */}
                  {ticket.attachments && ticket.attachments.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                        <Paperclip className="h-3 w-3 text-primary" /> Attached Files (
                        {ticket.attachments.length})
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {ticket.attachments.map((att, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 sm:px-3 py-1.5 text-xs text-foreground shadow-xs hover:border-primary/50 transition group"
                          >
                            <div
                              onClick={() => handlePreviewAttachment(att)}
                              className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition min-w-0"
                              title="Click to preview file"
                            >
                              {getFileIcon(att)}
                              <span className="truncate max-w-[130px] sm:max-w-[160px] font-semibold text-[11px]">
                                {att.original_name || att.filename || `File ${idx + 1}`}
                              </span>
                              {att.size ? (
                                <span className="text-[9px] text-muted font-normal">
                                  ({formatBytes(att.size)})
                                </span>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-1 border-l border-border/60 pl-1.5 ml-0.5">
                              <button
                                type="button"
                                onClick={() => handlePreviewAttachment(att)}
                                className="rounded p-1 text-muted hover:text-primary transition cursor-pointer"
                                title="Preview document"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              {att.url && (
                                <a
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={att.original_name || att.filename}
                                  className="rounded p-1 text-muted hover:text-primary transition cursor-pointer"
                                  title="Download / Open file"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* PROPOSED SOLUTION BANNER & ACTION BAR */}
                {ticket.proposed_solution?.solution_text && (
                  <div className="relative rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-950/25 to-card p-3.5 sm:p-4 space-y-3 shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 shrink-0">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-black uppercase tracking-wider text-purple-300 truncate block">
                            Proposed Solution
                          </span>
                          <p className="text-[10px] text-muted truncate">
                            By{" "}
                            <span className="font-semibold text-foreground">
                              {ticket.proposed_solution.proposed_by_name || "Responder"}
                            </span>
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[9px] font-bold text-purple-300 shrink-0">
                        Pending Verification
                      </span>
                    </div>

                    <div className="rounded-xl bg-card/90 p-3 sm:p-3.5 text-xs leading-relaxed text-foreground whitespace-pre-wrap border border-purple-500/20">
                      {ticket.proposed_solution.solution_text}
                    </div>

                    {/* SOLUTION ATTACHMENTS WITH PREVIEWS */}
                    {ticket.proposed_solution.attachments &&
                      ticket.proposed_solution.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {ticket.proposed_solution.attachments.map((att, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-2.5 sm:px-3 py-1.5 text-xs text-purple-200 hover:bg-purple-500/20 transition shadow-xs"
                            >
                              <div
                                onClick={() => handlePreviewAttachment(att)}
                                className="flex items-center gap-1.5 cursor-pointer hover:text-purple-100 transition min-w-0"
                                title="Click to preview solution file"
                              >
                                {getFileIcon(att)}
                                <span className="truncate max-w-[130px] font-semibold text-[11px]">
                                  {att.original_name || att.filename || `Attachment ${idx + 1}`}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 border-l border-purple-500/30 pl-1.5 ml-0.5">
                                <button
                                  type="button"
                                  onClick={() => handlePreviewAttachment(att)}
                                  className="rounded p-1 text-purple-300 hover:text-white transition cursor-pointer"
                                  title="Preview document"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                {att.url && (
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={att.original_name || att.filename}
                                    className="rounded p-1 text-purple-300 hover:text-white transition cursor-pointer"
                                    title="Download file"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                    {/* CREATOR ACTION BAR */}
                    {isCreator && ticket.status === "solution_proposed" && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-purple-500/20 pt-3">
                        <div className="flex items-center gap-1.5 text-[11px] text-purple-300">
                          <Lock className="h-3.5 w-3.5 shrink-0" />
                          <span>Creator Verification Authority</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowReopenModal(true)}
                            className="flex-1 sm:flex-none rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 sm:py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition cursor-pointer active:scale-95 text-center"
                          >
                            Request Revisions
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenResolveModal(ticket)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-emerald-600 px-4 py-2 sm:py-1.5 text-xs font-bold text-white shadow-md hover:from-purple-500 hover:to-emerald-500 transition cursor-pointer active:scale-95"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Accept &amp; Resolve
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* RESOLVED SUMMARY BANNER */}
                {ticket.status === "resolved" && (
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-3.5 sm:p-4 space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
                          <CheckCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                            Resolved &amp; Confirmed
                          </span>
                          <p className="text-[10px] text-muted">
                            Verified on{" "}
                            {ticket.resolution_details?.resolved_at
                              ? new Date(
                                  ticket.resolution_details.resolved_at
                                ).toLocaleDateString()
                              : ""}
                          </p>
                        </div>
                      </div>

                      {/* Star Rating Display */}
                      {ticket.resolution_details?.satisfaction_rating && (
                        <div className="flex items-center gap-0.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${
                                star <=
                                (ticket.resolution_details?.satisfaction_rating || 0)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted"
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {ticket.resolution_details?.resolution_notes && (
                      <div className="rounded-xl bg-card/90 p-3 text-xs text-foreground/90 whitespace-pre-wrap border border-emerald-500/20">
                        <span className="font-semibold text-emerald-400 block mb-1 text-[11px]">
                          Creator Closing Remarks:
                        </span>
                        {ticket.resolution_details.resolution_notes}
                      </div>
                    )}

                    {isCreator && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => setShowReopenModal(true)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-foreground transition underline cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Reopen Ticket
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* TIMELINE / REPLIES STREAM */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">
                        Activity Stream ({ticket.replies?.length || 0})
                      </span>
                    </div>

                    {/* RESPONDER QUICK ACTION */}
                    {isTagged && !hasAcknowledged && ticket.status === "open" && (
                      <button
                        type="button"
                        onClick={handleAcknowledge}
                        disabled={isAcknowledging}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-amber-300 hover:bg-amber-500/30 transition shadow-xs cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isAcknowledging ? "Updating..." : "Start Working"}
                      </button>
                    )}
                  </div>

                  {(!ticket.replies || ticket.replies.length === 0) && (
                    <div className="rounded-2xl border border-dashed border-border p-5 sm:p-6 text-center">
                      <HelpCircle className="mx-auto h-7 w-7 text-muted/50 mb-1" />
                      <p className="text-xs text-muted font-medium">
                        No messages yet. Tagged teammates have been alerted.
                      </p>
                      <p className="text-[10px] text-muted/70 mt-0.5">
                        Post a reply below to collaborate.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {ticket.replies?.map((rep) => {
                      const isMyReply =
                        String(typeof rep.user === "object" ? rep.user?._id : rep.user) ===
                        currentUserId;
                      const isSystemOrStatus =
                        rep.reply_type === "status_change" ||
                        rep.reply_type === "users_tagged" ||
                        rep.reply_type === "resolution_note" ||
                        rep.reply_type === "reopen_reason";

                      if (isSystemOrStatus) {
                        return (
                          <div
                            key={rep._id}
                            className="flex items-center justify-center my-1.5"
                          >
                            <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-muted/60 px-3 py-1 text-[10px] text-muted text-center max-w-[95%] truncate">
                              <Clock className="h-3 w-3 text-primary shrink-0" />
                              <span className="font-semibold text-foreground truncate">
                                {rep.user_snapshot?.name || "System"}
                              </span>
                              <span className="truncate">{rep.message}</span>
                            </div>
                          </div>
                        );
                      }

                      const otherReaders = (rep.read_by || []).filter(
                        (r) =>
                          String(typeof r.user === "object" ? r.user?._id : r.user) !==
                          currentUserId
                      );
                      const hasSeenByOthers = otherReaders.length > 0;

                      return (
                        <div
                          key={rep._id}
                          className={`flex gap-2 sm:gap-3 ${
                            isMyReply ? "flex-row-reverse" : "flex-row"
                          }`}
                        >
                          <div
                            className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs font-bold shrink-0 border ${
                              isMyReply
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-surface-muted text-foreground border-border"
                            }`}
                          >
                            {rep.user_snapshot?.name?.charAt(0) || "U"}
                          </div>

                          <div
                            className={`flex flex-col max-w-[88%] sm:max-w-[75%] space-y-1 ${
                              isMyReply ? "items-end" : "items-start"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted">
                              <span className="font-bold text-foreground">
                                {isMyReply ? "You" : rep.user_snapshot?.name}
                              </span>
                              {rep.user_snapshot?.department && (
                                <span className="rounded bg-surface-muted px-1.5 py-0.2 text-[8px] font-semibold text-muted">
                                  {rep.user_snapshot.department}
                                </span>
                              )}
                              <span>
                                {new Date(rep.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            <div
                              className={`rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs leading-relaxed whitespace-pre-wrap shadow-xs ${
                                isMyReply
                                  ? "bg-primary text-primary-foreground rounded-tr-xs"
                                  : rep.reply_type === "solution_proposal"
                                  ? "bg-purple-950/40 border border-purple-500/40 text-purple-100 rounded-tl-xs"
                                  : "bg-card border border-border text-foreground rounded-tl-xs"
                              }`}
                            >
                              {rep.reply_type === "solution_proposal" && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-purple-300 mb-1 border-b border-purple-500/20 pb-1">
                                  <Sparkles className="h-3 w-3" />
                                  Solution Proposal
                                </div>
                              )}
                              {rep.message}
                            </div>

                            {/* Granular Read Receipts / Delivery Status */}
                            {isMyReply && (
                              <div className="flex items-center gap-1.5 px-1 text-[9px]">
                                {hasSeenByOthers ? (
                                  <div
                                    className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400 font-semibold cursor-help"
                                    title={`Seen by: ${otherReaders
                                      .map(
                                        (r) =>
                                          `${r.name} (${new Date(
                                            r.read_at
                                          ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })})`
                                      )
                                      .join(", ")}`}
                                  >
                                    <CheckCheck className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                                    <span>
                                      Seen by {otherReaders.map((r) => r.name).join(", ")}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-muted">
                                    <Check className="h-3 w-3 text-muted" />
                                    <span>Sent</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ATTACHMENTS IN REPLY */}
                            {rep.attachments && rep.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {rep.attachments.map((att, aIdx) => (
                                  <div
                                    key={aIdx}
                                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-[10px] text-foreground hover:bg-surface-muted transition shadow-xs"
                                  >
                                    <div
                                      onClick={() => handlePreviewAttachment(att)}
                                      className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition min-w-0"
                                      title="Click to preview file"
                                    >
                                      {getFileIcon(att)}
                                      <span className="truncate max-w-[110px] sm:max-w-[130px] font-medium">
                                        {att.original_name || att.filename}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-0.5 border-l border-border/60 pl-1 ml-0.5">
                                      <button
                                        type="button"
                                        onClick={() => handlePreviewAttachment(att)}
                                        className="p-0.5 text-muted hover:text-primary transition cursor-pointer"
                                        title="Preview"
                                      >
                                        <Eye className="h-3 w-3" />
                                      </button>
                                      {att.url && (
                                        <a
                                          href={att.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          download={att.original_name || att.filename}
                                          className="p-0.5 text-muted hover:text-primary transition cursor-pointer"
                                          title="Download"
                                        >
                                          <Download className="h-3 w-3" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={repliesEndRef} />
                  </div>
                </div>

                {/* STICKY BOTTOM REPLY COMPOSER */}
                {ticket.status !== "cancelled" ? (
                  <div className="sticky bottom-0 z-10 -mx-3.5 -mb-3.5 sm:-mx-6 sm:-mb-6 border-t border-border bg-card/95 p-2.5 sm:p-3.5 backdrop-blur-md space-y-2 pb-safe">
                    {/* ATTACHMENTS CHIPS */}
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pb-1">
                        {attachments.map((att, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-primary shadow-xs"
                          >
                            <div
                              onClick={() => handlePreviewAttachment(att)}
                              className="flex items-center gap-1.5 cursor-pointer hover:underline min-w-0"
                              title="Click to preview file"
                            >
                              {getFileIcon(att)}
                              <span className="truncate max-w-[120px] font-medium">
                                {att.original_name || att.filename}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(idx)}
                              className="hover:text-red-400 ml-1 p-0.5 cursor-pointer"
                              title="Remove"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-end gap-1.5 sm:gap-2">
                      <div className="relative flex-1">
                        <textarea
                          rows={2}
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder={
                            isProposingSolution
                              ? "Describe the final solution delivered..."
                              : "Write message..."
                          }
                          className={`w-full resize-none rounded-xl border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 ${
                            isProposingSolution
                              ? "border-purple-500/50 focus:border-purple-500 focus:ring-purple-500"
                              : "border-border focus:border-primary focus:ring-primary"
                          }`}
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFileUpload}
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          title="Attach files"
                          className="rounded-xl border border-border bg-surface-muted p-2.5 text-muted hover:bg-card hover:text-foreground transition cursor-pointer min-h-[38px] flex items-center justify-center"
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Paperclip className="h-4 w-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleSendReply}
                          disabled={
                            isReplying ||
                            isSubmittingSolution ||
                            isUploading ||
                            (!replyMessage.trim() && attachments.length === 0)
                          }
                          className={`flex items-center justify-center gap-1.5 rounded-xl px-3.5 sm:px-4 py-2.5 text-xs font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer min-h-[38px] active:scale-95 ${
                            isProposingSolution
                              ? "bg-purple-600 hover:bg-purple-500"
                              : "bg-primary hover:bg-primary/90"
                          }`}
                        >
                          {isReplying || isSubmittingSolution ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{isProposingSolution ? "Submit Solution" : "Send"}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* PROPOSE SOLUTION TOGGLE */}
                    {canProposeSolution && (
                      <div className="flex items-center justify-between pt-0.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isProposingSolution}
                            onChange={(e) => setIsProposingSolution(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-border text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-[11px] font-semibold text-purple-300 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Mark as Proposed Solution
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-500/20 bg-surface-muted p-2.5 text-center text-xs text-muted">
                    This ticket has been cancelled.
                  </div>
                )}
              </div>

              {/* RIGHT SIDEBAR: Ticket Metadata & Tagged Teammates */}
              <div
                className={`w-full lg:w-80 shrink-0 bg-surface-muted/30 p-3.5 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto min-h-0 overscroll-contain ${
                  mobileTab === "discussion" ? "hidden lg:block" : "block"
                }`}
              >
                {/* CREATOR ACTION: RESOLVE DIRECTLY BUTTON */}
                {isCreator && ticket.status !== "resolved" && ticket.status !== "cancelled" && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2 shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <Shield className="h-4 w-4" />
                      <span>Creator Authority</span>
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed">
                      Once your requirement has been fulfilled, verify and mark resolved.
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenResolveModal(ticket)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 shadow-md transition cursor-pointer active:scale-95"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark Resolved
                    </button>
                  </div>
                )}

                {/* TAGGED USERS & COLLABORATORS */}
                <div className="rounded-2xl border border-border bg-card p-3.5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">
                        Tagged Teammates ({ticket.tagged_users?.length || 0})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowTagModal(true)}
                      className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Tag More
                    </button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1 overscroll-contain">
                    {ticket.tagged_users?.map((tu, idx) => {
                      const isAck = Boolean(tu.acknowledged_at);
                      const hasRead = Boolean(tu.last_read_at);
                      return (
                        <div
                          key={idx}
                          className="flex flex-col gap-1 rounded-xl border border-border/70 bg-surface-muted/40 p-2.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs shrink-0">
                                {tu.name?.charAt(0) || "U"}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-foreground truncate block text-xs">
                                  {tu.name}
                                </span>
                                <span className="text-[10px] text-muted truncate block">
                                  {tu.department || tu.role || "Team Member"}
                                </span>
                              </div>
                            </div>

                            {isAck ? (
                              <span
                                title={`Acknowledged on ${new Date(
                                  tu.acknowledged_at!
                                ).toLocaleString()}`}
                                className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0 border border-emerald-500/20"
                              >
                                <CheckCheck className="h-3 w-3" />
                                Active
                              </span>
                            ) : (
                              <span className="text-[9px] font-medium text-muted bg-surface-muted px-2 py-0.5 rounded-full shrink-0">
                                Notified
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[9px] text-muted">
                            <span className="flex items-center gap-1">
                              <Eye className="h-2.5 w-2.5 text-muted" />
                              {hasRead ? (
                                <span className="text-emerald-400 font-medium">
                                  Seen {formatRelativeTime(tu.last_read_at)}
                                </span>
                              ) : (
                                <span className="text-muted/70">Not opened yet</span>
                              )}
                            </span>
                            {tu.tagged_at && (
                              <span className="text-muted/60">
                                Tagged {formatRelativeTime(tu.tagged_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* TICKET METADATA CARD */}
                <div className="rounded-2xl border border-border bg-card p-3.5 space-y-2.5 text-xs shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                    Request Metadata
                  </span>

                  <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                    <span className="text-muted">Ticket ID</span>
                    <span className="font-mono font-bold text-foreground">
                      {ticket.ticket_number}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                    <span className="text-muted">Category</span>
                    <span className="font-semibold text-foreground">
                      {CATEGORY_LABELS[ticket.category] || ticket.category}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                    <span className="text-muted">Created Date</span>
                    <span className="text-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {ticket.due_date && (
                    <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                      <span className="text-muted">Target Resolution</span>
                      <span className="font-semibold text-amber-400">
                        {new Date(ticket.due_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {ticket.related_entity?.entity_type &&
                    ticket.related_entity.entity_type !== "none" && (
                      <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                        <span className="text-muted">Related To</span>
                        <span className="font-semibold text-primary capitalize truncate max-w-[130px]">
                          {ticket.related_entity.entity_title ||
                            ticket.related_entity.entity_type}
                        </span>
                      </div>
                    )}

                  <div className="flex items-center justify-between">
                    <span className="text-muted">Last Activity</span>
                    <span className="text-foreground">
                      {ticket.last_activity_at
                        ? new Date(ticket.last_activity_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Just now"}
                    </span>
                  </div>
                </div>

                {/* DANGER / CANCEL OPTION FOR CREATOR */}
                {isCreator && ticket.status !== "resolved" && ticket.status !== "cancelled" && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={isCancelling}
                      className="w-full flex items-center justify-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 rounded-xl py-2.5 transition cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Cancel This Help Ticket</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* DYNAMIC COLLABORATOR TAGGING MODAL */}
        {showTagModal && (
          <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 duration-200">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">
                    Tag More Teammates
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTagModal(false)}
                  className="text-muted hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <input
                type="text"
                placeholder="Search user by name, email, or department..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 overscroll-contain">
                {filteredUsersToTag.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted">
                    No other eligible users found.
                  </p>
                ) : (
                  filteredUsersToTag.map((u: any) => {
                    const uid = String(u._id || u.id);
                    const isSelected = selectedUserIds.includes(uid);
                    return (
                      <div
                        key={uid}
                        onClick={() =>
                          setSelectedUserIds((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== uid)
                              : [...prev, uid]
                          )}
                        className={`flex items-center justify-between rounded-xl border p-2.5 text-xs cursor-pointer transition ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border hover:bg-surface-muted text-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs shrink-0">
                            {u.name?.charAt(0) || "U"}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-foreground truncate block">
                              {u.name}
                            </span>
                            <span className="text-[10px] text-muted truncate block">
                              {getUserDepartmentName(u) || u.email}
                            </span>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setShowTagModal(false)}
                  className="rounded-xl border border-border px-3.5 py-2 text-xs text-muted hover:bg-surface-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTagSubmit}
                  disabled={isTagging || selectedUserIds.length === 0}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {isTagging ? "Notifying..." : `Tag (${selectedUserIds.length})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REOPEN / REVISE REASON MODAL */}
        {showReopenModal && (
          <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 duration-200">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-rose-400" />
                  <h3 className="text-sm font-bold text-foreground">
                    Request Revisions / Reopen Ticket
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="text-muted hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-muted">
                Please provide feedback explaining what remains pending or what needs revision:
              </p>

              <textarea
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g., The attached quotation is missing tax breakdown. Please update..."
                className="w-full resize-none rounded-xl border border-border bg-surface-muted p-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />

              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="rounded-xl border border-border px-3.5 py-2 text-xs text-muted hover:bg-surface-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReopenSubmit}
                  disabled={isReopening || !reopenReason.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {isReopening ? "Submitting..." : "Submit Revision Request"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Global Document / Image Preview Modal */}
      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={downloadFile}
        subtitle="Help Ticket File Attachment"
      />
    </>
  );
}

export default HelpTicketDetailModal;
