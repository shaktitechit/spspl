"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  X,
  Send,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Play,
  FileText,
  Download,
  User,
  Shield,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { useAppSelector } from "@/store";
import {
  useListFlagMessagesQuery,
  useCreateFlagMessageMutation,
  useUpdateFlagStatusMutation,
  useUploadFlagChatFileMutation,
  type FlagMessageRecord,
} from "@/store/api";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { ALL_FLAG_TYPES } from "@/components/portal/shared/orders/lib/flagTypes";

export type FlagChatDrawerProps = {
  flag: Record<string, any> | null;
  orderId?: string;
  orderNo?: string;
  onClose: () => void;
  onFlagUpdated?: () => void;
};

const QUICK_RESPONSES = [
  "Looking into this right away.",
  "Document uploaded, please verify.",
  "Issue checked and resolved.",
  "Need additional details to proceed.",
];

export function FlagChatDrawer({
  flag,
  orderId,
  orderNo,
  onClose,
  onFlagUpdated,
}: FlagChatDrawerProps) {
  const currentUser = useAppSelector((s) => s.auth.user);
  const currentUserId = String(currentUser?._id ?? currentUser?.id ?? "");

  const flagId = String(flag?._id ?? flag?.id ?? "");

  // Queries & Mutations
  const {
    data: messages = [],
    isLoading: isMessagesLoading,
    refetch: refetchMessages,
  } = useListFlagMessagesQuery(flagId, {
    skip: !flagId,
    pollingInterval: 5000, // Reactive polling every 5s for active chat loops
  });

  const [createMessage, { isLoading: isSendingMessage }] = useCreateFlagMessageMutation();
  const [updateFlagStatus, { isLoading: isUpdatingStatus }] = useUpdateFlagStatusMutation();
  const [uploadFlagChatFile, { isLoading: isUploadingFile }] = useUploadFlagChatFileMutation();

  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showResolvePrompt, setShowResolvePrompt] = useState(false);
  const [resolveNote, setResolveNote] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false);
    }
  }, [messages.length, scrollToBottom]);

  if (!flag) return null;

  const flagType = String(flag.flag_type ?? "");
  const flagTypeLabel = ALL_FLAG_TYPES[flagType]?.label || flagType.replace("_", " ");
  const status = String(flag.status ?? "open");
  const severity = String(flag.severity ?? "medium");
  const isResolved = status === "resolved" || status === "dismissed";

  // Extract author, primary assignee & tagged members
  const raisedByObj = typeof flag.raised_by === "object" && flag.raised_by !== null ? flag.raised_by : null;
  const raisedByName = String(raisedByObj?.name ?? raisedByObj?.username ?? "Team Member");
  const raisedByRole = String(raisedByObj?.department ?? raisedByObj?.opms_role ?? "");

  const assignedToObj = typeof flag.assigned_to === "object" && flag.assigned_to !== null ? flag.assigned_to : null;
  const assignedToName = assignedToObj ? String(assignedToObj?.name ?? assignedToObj?.username ?? "Assignee") : null;
  const assignedToRole = assignedToObj ? String(assignedToObj?.department ?? assignedToObj?.opms_role ?? "") : null;

  const taggedMembersList: any[] = Array.isArray(flag.tagged_members) ? flag.tagged_members : [];

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isResolved) return;
    const content = inputText.trim();
    if (!content && !selectedFile) return;

    try {
      let uploadedAttachment: any = null;

      if (selectedFile) {
        const uploadRes = await uploadFlagChatFile({
          flagId,
          file: selectedFile,
        }).unwrap();

        uploadedAttachment = {
          attachment_id: uploadRes?.attachment_id,
          fileId: uploadRes?.fileId,
          original_name: uploadRes?.original_name || selectedFile.name,
          file_url: uploadRes?.view_url || uploadRes?.file_url || `/api/files/${uploadRes?.fileId}/view`,
          view_url: uploadRes?.view_url || `/api/files/${uploadRes?.fileId}/view`,
          download_url: uploadRes?.download_url || `/api/files/${uploadRes?.fileId}/download`,
          mime_type: uploadRes?.mime_type || selectedFile.type,
          size_bytes: uploadRes?.size_bytes || selectedFile.size,
        };
      }

      await createMessage({
        flagId,
        content: content || (selectedFile ? `Shared file: ${selectedFile.name}` : ""),
        message_type: selectedFile ? "file" : "text",
        attachments: uploadedAttachment ? [uploadedAttachment] : [],
      }).unwrap();

      setInputText("");
      setSelectedFile(null);
      refetchMessages();
      if (onFlagUpdated) onFlagUpdated();
      setTimeout(() => scrollToBottom(), 100);
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  };

  const handleStatusChange = async (nextStatus: string, note?: string) => {
    try {
      await updateFlagStatus({
        id: flagId,
        status: nextStatus,
        resolution_note: note || undefined,
      }).unwrap();

      toast.success(
        nextStatus === "resolved"
          ? "Flag marked as resolved"
          : nextStatus === "in_progress"
            ? "Flag marked as in progress"
            : "Flag reopened"
      );

      setShowResolvePrompt(false);
      setResolveNote("");
      refetchMessages();
      if (onFlagUpdated) onFlagUpdated();
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  };

  return (
    <LargeModalPortal>
      <div className="fixed inset-0 z-[100] flex justify-end bg-black/45 backdrop-blur-[2px] transition-opacity">
        <div className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex flex-col border-b border-slate-100 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-slate-950/60">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isResolved
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-emerald-600/20"
                        : status === "in_progress"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 ring-1 ring-blue-600/20"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 ring-1 ring-rose-600/20"
                    }`}
                  >
                    {status.replace("_", " ").toUpperCase()}
                  </span>

                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      severity === "critical"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                        : severity === "high"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                    }`}
                  >
                    {severity.toUpperCase()}
                  </span>

                  {orderNo && (
                    <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                      Order: {orderNo}
                    </span>
                  )}
                </div>

                <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-slate-50">
                  {String(flag.title || flagTypeLabel)}
                </h3>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stakeholders Bar: Author, Primary Assignee, and Tagged Members */}
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200/70 bg-white p-2.5 text-xs dark:border-white/5 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Raised by:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {raisedByName}
                  </span>
                  {raisedByRole && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-2xs uppercase font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {raisedByRole}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Primary:</span>
                  {assignedToName ? (
                    <>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {assignedToName}
                      </span>
                      {assignedToRole && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-2xs uppercase font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                          {assignedToRole}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="italic text-slate-400">Unassigned</span>
                  )}
                </div>
              </div>

              {taggedMembersList.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-white/5">
                  <span className="text-slate-400 text-2xs font-medium">Tagged:</span>
                  {taggedMembersList.map((tm: any, idx: number) => {
                    const tmName = typeof tm === "object" && tm !== null
                      ? tm.name || tm.username || "Member"
                      : "Member";
                    const tmRole = typeof tm === "object" && tm !== null
                      ? tm.department || tm.opms_role
                      : "";
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <span>{tmName}</span>
                        {tmRole && <span className="opacity-60 uppercase text-3xs font-mono">({tmRole})</span>}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Direct Workflow Action Buttons */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!isResolved && status === "open" && (
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleStatusChange("in_progress")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                >
                  <Play className="h-3.5 w-3.5 fill-current" /> Mark In Progress
                </button>
              )}

              {!isResolved && (
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => setShowResolvePrompt(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 dark:bg-emerald-500 shadow-sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Resolve Flag
                </button>
              )}

              {isResolved && (
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleStatusChange("open", "Flag reopened for further review")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reopen Flag
                </button>
              )}
            </div>
          </div>

          {/* Resolve Prompt Inline Bar */}
          {showResolvePrompt && (
            <div className="border-b border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/30 dark:bg-emerald-950/30">
              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                Confirm Flag Resolution
              </p>
              <textarea
                rows={2}
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Resolution note (e.g., payment verified, stock adjusted, etc.)..."
                className="mt-2 w-full rounded-lg border border-emerald-300 bg-white p-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-100"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResolvePrompt(false)}
                  className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-emerald-100/50 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleStatusChange("resolved", resolveNote.trim())}
                  className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  {isUpdatingStatus ? "Resolving..." : "Confirm Resolution"}
                </button>
              </div>
            </div>
          )}

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isMessagesLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <Clock className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-medium">No messages in this chat loop yet.</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Send a message below to start collaborating with the assignee.
                </p>
              </div>
            ) : (
              messages.map((msg: FlagMessageRecord) => {
                const senderId =
                  typeof msg.sender === "object" && msg.sender !== null
                    ? String(msg.sender._id)
                    : String(msg.sender);
                const isMe = currentUserId && senderId === currentUserId;

                // System event message
                if (msg.message_type === "status_change" || msg.message_type === "system_event") {
                  return (
                    <div key={msg._id} className="flex justify-center my-2">
                      <div className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-100/80 px-3 py-1 text-2xs font-medium text-slate-600 dark:border-white/5 dark:bg-slate-800/80 dark:text-slate-300">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span>{msg.content}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-400">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Regular chat bubble
                return (
                  <div
                    key={msg._id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-2xs text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {isMe ? "You" : msg.sender_name}
                      </span>
                      {msg.sender_role && (
                        <span className="rounded bg-slate-100 px-1 py-0.2 text-2xs uppercase font-medium text-slate-500 dark:bg-slate-800">
                          {msg.sender_role}
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        isMe
                          ? "bg-blue-600 text-white rounded-br-none"
                          : "bg-slate-100 text-slate-900 rounded-bl-none dark:bg-slate-800 dark:text-slate-50"
                      }`}
                    >
                      {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}

                      {/* Attachments with Filesystem API View/Download & Image Preview */}
                      {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                        <div className="mt-2.5 space-y-2">
                          {msg.attachments.map((att, i) => {
                            const fileId = att.fileId || att.attachment_id;
                            const viewUrl =
                              att.view_url ||
                              (fileId ? `/api/files/${fileId}/view` : att.file_url);
                            const downloadUrl =
                              att.download_url ||
                              (fileId ? `/api/files/${fileId}/download` : att.file_url);
                            const isImage =
                              att.mime_type?.startsWith("image/") ||
                              /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(att.original_name || "");

                            return (
                              <div
                                key={i}
                                className={`overflow-hidden rounded-xl border p-2.5 text-xs transition ${
                                  isMe
                                    ? "border-blue-500/50 bg-blue-700/50 text-white"
                                    : "border-slate-200 bg-white text-slate-800 shadow-xs dark:border-white/10 dark:bg-slate-700/70 dark:text-slate-100"
                                }`}
                              >
                                {isImage && viewUrl && (
                                  <a
                                    href={viewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mb-2 block overflow-hidden rounded-lg border border-black/5 bg-slate-100 dark:bg-slate-800"
                                  >
                                    <img
                                      src={viewUrl}
                                      alt={att.original_name}
                                      className="max-h-44 w-full object-cover transition duration-150 hover:scale-[1.02]"
                                    />
                                  </a>
                                )}

                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="h-4 w-4 shrink-0 opacity-80" />
                                    <span className="truncate font-medium">
                                      {att.original_name}
                                    </span>
                                    {att.size_bytes ? (
                                      <span className="text-2xs opacity-70 shrink-0">
                                        ({(att.size_bytes / 1024).toFixed(0)} KB)
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {viewUrl && (
                                      <a
                                        href={viewUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="View in new tab"
                                        className={`rounded-md p-1.5 transition ${
                                          isMe
                                            ? "hover:bg-blue-600 text-white"
                                            : "hover:bg-slate-100 text-slate-700 dark:hover:bg-slate-600 dark:text-slate-200"
                                        }`}
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    )}

                                    {downloadUrl && (
                                      <a
                                        href={downloadUrl}
                                        download={att.original_name}
                                        title="Download file"
                                        className={`rounded-md p-1.5 transition ${
                                          isMe
                                            ? "hover:bg-blue-600 text-white"
                                            : "hover:bg-slate-100 text-slate-700 dark:hover:bg-slate-600 dark:text-slate-200"
                                        }`}
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Locked State Banner when Resolved / Dismissed */}
          {isResolved ? (
            <div className="border-t border-slate-200 bg-slate-50/95 p-4 text-center dark:border-white/10 dark:bg-slate-950">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>This flag has been resolved. The chat loop is now closed.</span>
              </div>
              <p className="mt-1.5 text-2xs text-slate-400 dark:text-slate-500">
                Further messages and uploads are disabled. To resume collaboration, reopen this flag above.
              </p>
            </div>
          ) : (
            <>
              {/* Quick Suggestion Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto border-t border-slate-100 px-4 py-2 bg-slate-50/50 dark:border-white/5 dark:bg-slate-950/40">
                {QUICK_RESPONSES.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setInputText(chip)}
                    className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-1 text-2xs text-slate-600 transition hover:border-blue-400 hover:text-blue-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* File Selected Preview Banner */}
              {selectedFile && (
                <div className="flex items-center justify-between border-t border-blue-100 bg-blue-50/70 px-4 py-2 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate font-medium">{selectedFile.name}</span>
                    <span className="text-2xs text-blue-600/70">
                      ({(selectedFile.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-blue-500 hover:text-blue-700 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Sticky Bottom Composer */}
              <form
                onSubmit={(e) => void handleSendMessage(e)}
                className="border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900"
              >
                <div className="flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file via Filesystem API"
                    className="rounded-lg border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-white/10 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>

                  <div className="flex-1">
                    <textarea
                      rows={2}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                      placeholder="Type a message... (Press Enter to send, Shift+Enter for newline)"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      isSendingMessage || isUploadingFile || (!inputText.trim() && !selectedFile)
                    }
                    className="rounded-xl bg-blue-600 p-2.5 text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    {isSendingMessage || isUploadingFile ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </LargeModalPortal>
  );
}
