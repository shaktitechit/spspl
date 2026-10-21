'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Paperclip,
  Pin,
  FileText,
  Download,
  Users,
  CheckCheck,
  Layers,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Play,
  Check,
  Sparkles,
  Activity,
  Filter,
} from 'lucide-react';
import {
  fetchProjectMessages,
  togglePinMessage,
  uploadProjectFile,
  updateWorkflowAction,
  updateStepStatus,
  getProjectAttachmentPreviewUrl,
  getProjectAttachmentDownloadUrl,
} from '@/lib/projectApi';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import type { ProjectMessage, Project, ProjectActionStep, WorkflowActionStatus, ActionStepStatus } from '@/types/project';
import { WorkflowTransitionModal, type TransitionTargetType } from './WorkflowTransitionModal';

interface TransitionModalState {
  isOpen: boolean;
  targetType: TransitionTargetType;
  stepId: string;
  stepNumber?: number;
  actionId?: string;
  itemTitle: string;
  currentStatus: ActionStepStatus | WorkflowActionStatus;
  targetStatus: ActionStepStatus | WorkflowActionStatus;
}

interface ProjectChatTabProps {
  project: Project;
  token: string | null;
  currentUser: any;
}

const STEP_STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: 'bg-slate-500/10', text: 'text-slate-500' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-500/10', text: 'text-blue-500' },
  under_review: { label: 'Review', bg: 'bg-amber-500/10', text: 'text-amber-500' },
  completed: { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  blocked: { label: 'Blocked', bg: 'bg-rose-500/10', text: 'text-rose-500' },
  skipped: { label: 'Skipped', bg: 'bg-muted/10', text: 'text-muted' },
};

export function ProjectChatTab({ project, token, currentUser }: ProjectChatTabProps) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Workflow Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [steps, setSteps] = useState<ProjectActionStep[]>(project.steps || []);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(project.steps?.[0]?._id || null);
  const [selectedStepFilter, setSelectedStepFilter] = useState<string | null>(null);
  const [transitionModal, setTransitionModal] = useState<TransitionModalState | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentUserId = currentUser?._id || currentUser?.id || '';

  // Update steps if project changes
  useEffect(() => {
    if (project.steps) {
      setSteps(project.steps);
    }
  }, [project.steps]);

  const handleNewMessage = useCallback((newMsg: ProjectMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m._id === newMsg._id)) return prev;
      return [...prev, newMsg];
    });
    scrollToBottom();
  }, []);

  const handleStepUpdatedSocket = useCallback(
    (updatedStep: ProjectActionStep | { _id: string; isDeleted?: boolean }) => {
      setSteps((prev) => {
        if ('isDeleted' in updatedStep && updatedStep.isDeleted) {
          return prev.filter((s) => s._id !== updatedStep._id);
        }
        const fullStep = updatedStep as ProjectActionStep;
        const idx = prev.findIndex((s) => s._id === fullStep._id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = fullStep;
          return copy;
        }
        return [...prev, fullStep];
      });
    },
    []
  );

  // Setup Real-time Sockets
  const { isConnected, typingUsers, sendMessage, startTyping, stopTyping } = useProjectSocket({
    projectId: project._id,
    token,
    onNewMessage: handleNewMessage,
    onStepUpdated: handleStepUpdatedSocket,
  });

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const res = await fetchProjectMessages(token, project._id);
      setMessages(res.items || []);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [project._id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;

    try {
      let attachments: any[] = [];
      if (selectedFile) {
        setIsUploading(true);
        const { fileRecord, attachment } = await uploadProjectFile(
          token,
          project._id,
          selectedFile,
          'Chat Attachments'
        );
        attachments.push({
          attachment_id: attachment?._id || fileRecord.attachment_id,
          original_name: selectedFile.name,
          mime_type: selectedFile.type,
          size_bytes: selectedFile.size,
          file_url: attachment?.url || '',
        });
        setSelectedFile(null);
        setIsUploading(false);
      }

      sendMessage(inputText.trim(), attachments, [], selectedStepFilter || null);
      stopTyping();
      setInputText('');
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
      setIsUploading(false);
    }
  };

  const handleTogglePin = async (msgId: string) => {
    try {
      const updated = await togglePinMessage(token, project._id, msgId);
      setMessages((prev) => prev.map((m) => (m._id === msgId ? updated : m)));
    } catch (err: any) {
      alert(err.message || 'Failed to pin message');
    }
  };

  const openStepTransition = (
    step: ProjectActionStep,
    targetStatus: ActionStepStatus
  ) => {
    setTransitionModal({
      isOpen: true,
      targetType: 'step',
      stepId: step._id,
      itemTitle: step.title,
      stepNumber: step.step_number,
      currentStatus: step.status,
      targetStatus,
    });
  };

  const openActionTransition = (
    step: ProjectActionStep,
    action: { _id?: string; title: string; status: WorkflowActionStatus },
    targetStatus: WorkflowActionStatus
  ) => {
    setTransitionModal({
      isOpen: true,
      targetType: 'action',
      stepId: step._id,
      actionId: action._id,
      itemTitle: action.title,
      stepNumber: step.step_number,
      currentStatus: action.status,
      targetStatus,
    });
  };

  const handleExecuteTransition = async (remark: string) => {
    if (!transitionModal) return;
    if (transitionModal.targetType === 'step') {
      const updated = await updateStepStatus(
        token,
        project._id,
        transitionModal.stepId,
        transitionModal.targetStatus as ActionStepStatus,
        remark
      );
      setSteps((prev) => prev.map((s) => (s._id === transitionModal.stepId ? updated : s)));
    } else if (transitionModal.targetType === 'action' && transitionModal.actionId) {
      const updatedStep = await updateWorkflowAction(
        token,
        project._id,
        transitionModal.stepId,
        transitionModal.actionId,
        {
          status: transitionModal.targetStatus as WorkflowActionStatus,
          remarks: remark,
        }
      );
      setSteps((prev) => prev.map((s) => (s._id === transitionModal.stepId ? updatedStep : s)));
    }
  };

  const filteredMessages = selectedStepFilter
    ? messages.filter((m) => m.action_step_id === selectedStepFilter)
    : messages;

  const totalSteps = steps.length;
  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="flex flex-col lg:flex-row h-[680px] rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      {/* LEFT: Main Chat Stream */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Chat Room Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-muted/50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold text-xs">
                #
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card ${
                  isConnected ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
                title={isConnected ? 'Live Socket Connected' : 'Connecting...'}
              />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                {project.title} Chat Room
              </h4>
              <span className="text-[10px] text-muted">
                {isConnected ? 'Real-time sync active' : 'Reconnecting...'} • {project.members?.length || 1} team members
              </span>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-2">
            {selectedStepFilter && (
              <button
                type="button"
                onClick={() => setSelectedStepFilter(null)}
                className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg hover:bg-primary/20 transition"
              >
                <Filter className="h-3 w-3" />
                Step Filter Active (Clear)
              </button>
            )}

            {messages.filter((m) => m.is_pinned).length > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                <Pin className="h-3 w-3" />
                {messages.filter((m) => m.is_pinned).length}
              </span>
            )}

            {/* Toggle Workflow Sidebar Button */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition border ${
                isSidebarOpen
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-background border-border text-foreground hover:bg-surface-muted'
              }`}
              title="Toggle Action Steps & Workflow System Plan"
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Workflow Plan</span>
            </button>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-background/50">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              Loading conversation and activities...
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col h-full items-center justify-center text-center p-6 text-muted space-y-1">
              <Users className="h-8 w-8 opacity-40 mb-2" />
              <p className="text-xs font-semibold text-foreground">Welcome to the Project Chat Room!</p>
              <p className="text-[11px] max-w-sm">
                Discuss progress, milestones, and deliverables. Step execution actions will automatically post activity updates here.
              </p>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const senderIdStr =
                typeof msg.sender_id === 'object' ? msg.sender_id?._id : msg.sender_id;
              const isMe = String(senderIdStr) === String(currentUserId);
              const isSystemEvent = msg.message_type === 'system_event';

              // SYSTEM EVENT / STEP ACTION ACTIVITY CARD
              if (isSystemEvent) {
                return (
                  <div key={msg._id} className="flex justify-center my-2 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 max-w-lg rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs text-foreground shadow-2xs">
                      <Activity className="h-4 w-4 text-primary shrink-0 animate-pulse" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-foreground leading-snug">
                          {msg.content}
                        </p>
                        <span className="text-[9px] text-muted">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              // REGULAR USER MESSAGE BUBBLE
              return (
                <div
                  key={msg._id}
                  className={`flex gap-2.5 group ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-[11px] font-bold text-foreground border border-border mt-0.5">
                      {(msg.sender_name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className={`max-w-[78%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Sender Info */}
                    {!isMe && (
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[11px] font-bold text-foreground">{msg.sender_name}</span>
                        {msg.sender_role && (
                          <span className="rounded bg-primary/10 text-[9px] font-extrabold uppercase px-1 py-0.2 text-primary">
                            {msg.sender_role}
                          </span>
                        )}
                        <span className="text-[10px] text-muted">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`relative rounded-2xl px-3.5 py-2.5 text-xs ${
                        isMe
                          ? 'bg-primary text-white rounded-tr-xs'
                          : 'bg-card border border-border text-foreground rounded-tl-xs shadow-2xs'
                      }`}
                    >
                      {msg.is_pinned && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 mb-1">
                          <Pin className="h-3 w-3" /> Pinned
                        </div>
                      )}

                      {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}

                      {/* Attachments rendering */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-1.5 pt-1.5 border-t border-white/20 dark:border-border">
                          {msg.attachments.map((att, attIdx) => {
                            const previewUrl = getProjectAttachmentPreviewUrl(
                              att.attachment_id || att.file_url,
                              token
                            );
                            const downloadUrl = getProjectAttachmentDownloadUrl(
                              att.attachment_id || att.file_url,
                              token
                            );
                            const isImage =
                              (att.mime_type && att.mime_type.startsWith('image/')) ||
                              /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(att.original_name || '') ||
                              Boolean(att.file_url && /\.(jpg|jpeg|png|webp|gif|bmp)/i.test(att.file_url));

                            if (isImage && previewUrl) {
                              return (
                                <div key={attIdx} className="space-y-1">
                                  <a
                                    href={previewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block relative rounded-xl overflow-hidden group/img max-w-xs border border-white/20 dark:border-border/60 shadow-xs"
                                  >
                                    <img
                                      src={previewUrl}
                                      alt={att.original_name}
                                      className="max-h-48 w-auto object-cover rounded-xl transition duration-200 group-hover/img:scale-105"
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center gap-2 text-white text-xs font-semibold">
                                      <span>Click to view</span>
                                    </div>
                                  </a>
                                  <div className="flex items-center justify-between text-[10px] opacity-80 px-1">
                                    <span className="truncate max-w-[180px]">{att.original_name}</span>
                                    {downloadUrl && (
                                      <a
                                        href={downloadUrl}
                                        download
                                        target="_blank"
                                        rel="noreferrer"
                                        className="hover:underline flex items-center gap-1"
                                      >
                                        <Download className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={attIdx}
                                className={`flex items-center gap-2 rounded-xl p-2 text-[11px] ${
                                  isMe ? 'bg-black/20 text-white' : 'bg-surface-muted text-foreground'
                                }`}
                              >
                                <FileText className="h-4 w-4 shrink-0 opacity-80" />
                                <span className="truncate flex-1 font-semibold">{att.original_name}</span>
                                {previewUrl && (
                                  <a
                                    href={previewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 hover:opacity-80 transition"
                                    title="View / Download"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Quick pin action */}
                      <button
                        type="button"
                        onClick={() => handleTogglePin(msg._id)}
                        className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-black/10 ${
                          msg.is_pinned ? 'opacity-100' : ''
                        }`}
                        title={msg.is_pinned ? 'Unpin message' : 'Pin message'}
                      >
                        <Pin className="h-3 w-3" />
                      </button>
                    </div>

                    {isMe && (
                      <div className="flex items-center justify-end gap-1 px-1 text-[10px] text-muted">
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <CheckCheck className="h-3 w-3 text-primary" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-1 text-[11px] italic text-muted bg-surface-muted/30 border-t border-border">
            {typingUsers.map((u) => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        {/* File Attachment Pill */}
        {selectedFile && (
          <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border-t border-primary/20 text-xs text-primary">
            <div className="flex items-center gap-2 truncate">
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-semibold">{selectedFile.name}</span>
              <span className="text-[10px] opacity-75">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="text-xs font-bold text-muted hover:text-foreground ml-2"
            >
              Remove
            </button>
          </div>
        )}

        {/* Message Input Box */}
        <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-border bg-card">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl p-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
            title="Attach file / document"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              startTyping();
            }}
            placeholder={
              selectedStepFilter
                ? `Message regarding Step filter...`
                : `Message in #${project.project_code || 'project'}...`
            }
            className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-hidden"
          />

          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedFile) || isUploading}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-40 transition shadow-xs"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* RIGHT: Action Steps & Workflow System Plan Sidebar */}
      {isSidebarOpen && (
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border bg-card flex flex-col h-full shrink-0 animate-in slide-in-from-right duration-200">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border bg-surface-muted/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" />
                Workflow System Plan
              </h3>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                {progressPercent}% Done
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted font-semibold">
                <span>Execution Roadmap</span>
                <span>
                  {completedSteps}/{totalSteps} Steps Complete
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Steps and Action Roadmap List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {steps.length === 0 ? (
              <div className="p-4 text-center text-muted text-xs">
                No action steps configured for this project.
              </div>
            ) : (
              steps.map((step, idx) => {
                const badge = STEP_STATUS_BADGE[step.status] || STEP_STATUS_BADGE.pending;
                const isExpanded = expandedStepId === step._id;
                const actions = step.workflow_actions || [];

                return (
                  <div
                    key={step._id || idx}
                    className="rounded-2xl border border-border bg-background p-3 shadow-2xs space-y-2.5 transition"
                  >
                    {/* Step Card Header */}
                    <div className="space-y-2">
                      <div
                        onClick={() => setExpandedStepId(isExpanded ? null : step._id)}
                        className="flex items-center justify-between gap-2 cursor-pointer hover:opacity-90 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-black text-primary">
                            {step.step_number || idx + 1}
                          </span>
                          <p className="text-xs font-bold text-foreground truncate">{step.title}</p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${badge.bg} ${badge.text}`}
                          >
                            {badge.label}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted" />
                          )}
                        </div>
                      </div>

                      {/* Parent Step Workflow Transition Action Buttons */}
                      <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-border/50">
                        <span className="text-[9px] font-bold text-muted uppercase tracking-wider mr-1">
                          Step Action:
                        </span>

                        {step.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => openStepTransition(step, 'in_progress')}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs hover:bg-blue-700 transition"
                          >
                            <Play className="h-2.5 w-2.5" />
                            Start Step
                          </button>
                        )}

                        {step.status === 'in_progress' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openStepTransition(step, 'under_review')}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs hover:bg-amber-700 transition"
                            >
                              <Clock className="h-2.5 w-2.5" />
                              Review
                            </button>
                            <button
                              type="button"
                              onClick={() => openStepTransition(step, 'completed')}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                            >
                              <Check className="h-2.5 w-2.5" />
                              Complete
                            </button>
                            <button
                              type="button"
                              onClick={() => openStepTransition(step, 'blocked')}
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold hover:bg-rose-500/20 transition"
                            >
                              <AlertCircle className="h-2.5 w-2.5" />
                              Block
                            </button>
                          </>
                        )}

                        {step.status === 'under_review' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openStepTransition(step, 'completed')}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                            >
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => openStepTransition(step, 'in_progress')}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs hover:bg-blue-700 transition"
                            >
                              Revise
                            </button>
                            <button
                              type="button"
                              onClick={() => openStepTransition(step, 'blocked')}
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold hover:bg-rose-500/20 transition"
                            >
                              Block
                            </button>
                          </>
                        )}

                        {step.status === 'blocked' && (
                          <button
                            type="button"
                            onClick={() => openStepTransition(step, 'in_progress')}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs hover:bg-blue-700 transition"
                          >
                            <Play className="h-2.5 w-2.5" />
                            Resume
                          </button>
                        )}

                        {(step.status === 'completed' || step.status === 'skipped') && (
                          <button
                            type="button"
                            onClick={() => openStepTransition(step, 'in_progress')}
                            className="inline-flex items-center gap-1 rounded-lg bg-surface-muted text-foreground border border-border px-1.5 py-0.5 text-[10px] font-bold hover:bg-border transition"
                          >
                            Reopen Step
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Step Expanded Workflow Actions 1-by-1 */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-border/60 space-y-2.5 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between text-[10px] text-muted">
                          <span>
                            Lead:{' '}
                            <strong className="text-foreground">
                              {step.assigned_to_user_name || 'Unassigned'}
                            </strong>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedStepFilter(
                                selectedStepFilter === step._id ? null : step._id
                              )
                            }
                            className="text-primary font-bold hover:underline"
                          >
                            {selectedStepFilter === step._id ? 'Clear Filter' : 'Filter Chat'}
                          </button>
                        </div>

                        {/* Actions Workflow List */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider text-muted">
                            <span>Sub-Actions Roadmap</span>
                            <span>
                              {actions.filter((a) => a.status === 'completed').length}/{actions.length}
                            </span>
                          </div>

                          {actions.length === 0 ? (
                            <p className="text-[10px] text-muted italic">
                              No workflow sub-actions configured.
                            </p>
                          ) : (
                            actions.map((act, actIdx) => {
                              const isDone = act.status === 'completed';
                              const isProg = act.status === 'in_progress';
                              const isBlock = act.status === 'blocked';

                              return (
                                <div
                                  key={act._id || actIdx}
                                  className={`rounded-xl border p-2 text-xs flex flex-col gap-1.5 ${
                                    isDone
                                      ? 'bg-emerald-500/5 border-emerald-500/20'
                                      : isProg
                                      ? 'bg-blue-500/5 border-blue-500/20'
                                      : isBlock
                                      ? 'bg-rose-500/5 border-rose-500/20'
                                      : 'bg-surface-muted/30 border-border'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span
                                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold ${
                                          isDone
                                            ? 'bg-emerald-500 text-white'
                                            : isProg
                                            ? 'bg-blue-500 text-white'
                                            : isBlock
                                            ? 'bg-rose-500 text-white'
                                            : 'bg-surface-muted text-muted'
                                        }`}
                                      >
                                        {isDone ? '✓' : actIdx + 1}
                                      </span>
                                      <span
                                        className={`truncate text-[11px] ${
                                          isDone ? 'line-through text-muted' : 'font-semibold text-foreground'
                                        }`}
                                      >
                                        {act.title}
                                      </span>
                                    </div>
                                    <span className="text-[8px] font-extrabold uppercase px-1 py-0.2 rounded bg-card border border-border text-muted">
                                      {act.status}
                                    </span>
                                  </div>

                                  {/* Sub-Action Workflow Action Buttons with Confirmation Modal */}
                                  <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40">
                                    {act.status === 'pending' && (
                                      <button
                                        type="button"
                                        onClick={() => openActionTransition(step, act, 'in_progress')}
                                        className="rounded-md bg-blue-600 px-2 py-0.5 text-[9px] font-bold text-white hover:bg-blue-700 transition"
                                      >
                                        Start Action
                                      </button>
                                    )}

                                    {act.status === 'in_progress' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => openActionTransition(step, act, 'completed')}
                                          className="rounded-md bg-emerald-600 px-2 py-0.5 text-[9px] font-bold text-white hover:bg-emerald-700 transition"
                                        >
                                          Complete
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openActionTransition(step, act, 'blocked')}
                                          className="rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold hover:bg-rose-500/20 transition"
                                        >
                                          Block
                                        </button>
                                      </>
                                    )}

                                    {act.status === 'blocked' && (
                                      <button
                                        type="button"
                                        onClick={() => openActionTransition(step, act, 'in_progress')}
                                        className="rounded-md bg-blue-600 px-2 py-0.5 text-[9px] font-bold text-white hover:bg-blue-700 transition"
                                      >
                                        Resume
                                      </button>
                                    )}

                                    {(act.status === 'completed' || act.status === 'skipped') && (
                                      <button
                                        type="button"
                                        onClick={() => openActionTransition(step, act, 'in_progress')}
                                        className="rounded-md bg-surface-muted text-foreground border border-border px-1.5 py-0.5 text-[9px] font-bold hover:bg-border transition"
                                      >
                                        Reopen
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {transitionModal && transitionModal.isOpen && (
        <WorkflowTransitionModal
          isOpen={transitionModal.isOpen}
          onClose={() => setTransitionModal(null)}
          targetType={transitionModal.targetType}
          stepId={transitionModal.stepId}
          stepNumber={transitionModal.stepNumber}
          actionId={transitionModal.actionId}
          itemTitle={transitionModal.itemTitle}
          currentStatus={transitionModal.currentStatus}
          targetStatus={transitionModal.targetStatus}
          onConfirm={handleExecuteTransition}
        />
      )}
    </div>
  );
}
