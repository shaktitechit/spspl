'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  CheckSquare,
  Calendar,
  User,
  ChevronDown,
  ChevronRight,
  Play,
  Check,
  Ban,
  Sparkles,
  Layers,
  MessageSquare,
  RotateCcw,
  Eye,
  ArrowRight,
} from 'lucide-react';
import {
  createProjectStep,
  updateStepStatus,
  toggleChecklistItem,
  deleteProjectStep,
  addWorkflowAction,
  updateWorkflowAction,
  deleteWorkflowAction,
} from '@/lib/projectApi';
import {
  WorkflowTransitionModal,
  type TransitionTargetType,
} from '@/components/project/WorkflowTransitionModal';
import type {
  ProjectActionStep,
  ActionStepStatus,
  WorkflowAction,
  WorkflowActionStatus,
} from '@/types/project';

interface ActionStepsTabProps {
  projectId: string;
  steps: ProjectActionStep[];
  token: string | null;
  canEdit: boolean;
  onStepsUpdated: (updatedSteps: ProjectActionStep[]) => void;
}

const STATUS_CONFIG: Record<
  ActionStepStatus,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  pending: {
    label: 'Pending',
    bg: 'bg-slate-500/10',
    text: 'text-slate-500',
    border: 'border-slate-500/20',
    icon: Circle,
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/20',
    icon: Clock,
  },
  under_review: {
    label: 'Under Review',
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    border: 'border-amber-500/20',
    icon: AlertCircle,
  },
  completed: {
    label: 'Completed',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    border: 'border-emerald-500/20',
    icon: CheckCircle2,
  },
  blocked: {
    label: 'Blocked',
    bg: 'bg-rose-500/10',
    text: 'text-rose-500',
    border: 'border-rose-500/20',
    icon: AlertCircle,
  },
  skipped: {
    label: 'Skipped',
    bg: 'bg-muted/10',
    text: 'text-muted',
    border: 'border-muted/20',
    icon: Circle,
  },
};

const WORKFLOW_STATUS_CONFIG: Record<
  WorkflowActionStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  pending: {
    label: 'Pending',
    bg: 'bg-slate-500/10',
    text: 'text-slate-500',
    border: 'border-slate-500/20',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/20',
  },
  completed: {
    label: 'Completed',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
  },
  blocked: {
    label: 'Blocked',
    bg: 'bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/20',
  },
  skipped: {
    label: 'Skipped',
    bg: 'bg-muted/10',
    text: 'text-muted',
    border: 'border-muted/20',
  },
};

export function ActionStepsTab({
  projectId,
  steps,
  token,
  canEdit,
  onStepsUpdated,
}: ActionStepsTabProps) {
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPhase, setNewPhase] = useState('Execution');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [expandedStepId, setExpandedStepId] = useState<string | null>(steps[0]?._id || null);

  // New Workflow Action Form State per step
  const [activeNewActionStepId, setActiveNewActionStepId] = useState<string | null>(null);
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionDesc, setNewActionDesc] = useState('');
  const [isAddingAction, setIsAddingAction] = useState(false);

  // Reusable Transition Confirmation Modal State
  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    targetType: TransitionTargetType;
    stepId: string;
    stepNumber?: number;
    actionId?: string;
    itemTitle: string;
    currentStatus: ActionStepStatus | WorkflowActionStatus;
    targetStatus: ActionStepStatus | WorkflowActionStatus;
  }>({
    isOpen: false,
    targetType: 'step',
    stepId: '',
    itemTitle: '',
    currentStatus: 'pending',
    targetStatus: 'in_progress',
  });

  const handleCreateStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const created = await createProjectStep(token, projectId, {
        title: newTitle.trim(),
        phase_name: newPhase.trim() || 'Execution',
        due_date: newDueDate ? new Date(newDueDate).toISOString() : null,
        description: newDesc.trim(),
      });
      onStepsUpdated([...steps, created]);
      setNewTitle('');
      setNewDesc('');
      setNewDueDate('');
      setIsAddingStep(false);
      setExpandedStepId(created._id);
    } catch (err: any) {
      alert(err.message || 'Failed to add step');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open modal for parent step transition
  const openStepTransitionModal = (
    step: ProjectActionStep,
    targetStatus: ActionStepStatus
  ) => {
    setModalData({
      isOpen: true,
      targetType: 'step',
      stepId: step._id,
      stepNumber: step.step_number,
      itemTitle: step.title,
      currentStatus: step.status,
      targetStatus,
    });
  };

  // Open modal for workflow action transition
  const openActionTransitionModal = (
    step: ProjectActionStep,
    action: WorkflowAction,
    targetStatus: WorkflowActionStatus
  ) => {
    setModalData({
      isOpen: true,
      targetType: 'action',
      stepId: step._id,
      stepNumber: step.step_number,
      actionId: action._id,
      itemTitle: action.title,
      currentStatus: action.status,
      targetStatus,
    });
  };

  // Execute transition from modal confirmation
  const handleConfirmTransition = async (remark: string) => {
    if (modalData.targetType === 'step') {
      const updated = await updateStepStatus(
        token,
        projectId,
        modalData.stepId,
        modalData.targetStatus as ActionStepStatus,
        remark
      );
      onStepsUpdated(steps.map((s) => (s._id === modalData.stepId ? updated : s)));
    } else if (modalData.targetType === 'action' && modalData.actionId) {
      const updatedStep = await updateWorkflowAction(
        token,
        projectId,
        modalData.stepId,
        modalData.actionId,
        {
          status: modalData.targetStatus as WorkflowActionStatus,
          remarks: remark,
        }
      );
      onStepsUpdated(steps.map((s) => (s._id === modalData.stepId ? updatedStep : s)));
    }
  };

  const handleToggleChecklist = async (stepId: string, itemId: string, currentVal: boolean) => {
    try {
      const updated = await toggleChecklistItem(token, projectId, stepId, itemId, !currentVal);
      onStepsUpdated(
        steps.map((s) => {
          if (s._id !== stepId) return s;
          return {
            ...s,
            checklist: s.checklist.map((item) =>
              item._id === itemId ? { ...item, is_completed: !currentVal } : item
            ),
          };
        })
      );
    } catch (err: any) {
      alert(err.message || 'Failed to toggle checklist item');
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('Are you sure you want to delete this action step?')) return;
    try {
      await deleteProjectStep(token, projectId, stepId);
      onStepsUpdated(steps.filter((s) => s._id !== stepId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete step');
    }
  };

  const handleAddWorkflowAction = async (stepId: string) => {
    if (!newActionTitle.trim()) return;

    try {
      setIsAddingAction(true);
      const updatedStep = await addWorkflowAction(token, projectId, stepId, {
        title: newActionTitle.trim(),
        description: newActionDesc.trim(),
        status: 'pending',
      });
      onStepsUpdated(steps.map((s) => (s._id === stepId ? updatedStep : s)));
      setNewActionTitle('');
      setNewActionDesc('');
      setActiveNewActionStepId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to add workflow action');
    } finally {
      setIsAddingAction(false);
    }
  };

  const handleDeleteWorkflowAction = async (stepId: string, actionId: string) => {
    if (!confirm('Are you sure you want to remove this workflow action?')) return;
    try {
      const updatedStep = await deleteWorkflowAction(token, projectId, stepId, actionId);
      onStepsUpdated(steps.map((s) => (s._id === stepId ? updatedStep : s)));
    } catch (err: any) {
      alert(err.message || 'Failed to remove workflow action');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-2xs">
        <div>
          <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Action Steps Pipeline & Sequential Workflow System
          </h3>
          <p className="text-xs text-muted">
            Execute parent steps and sub-actions with confirmation modals, remarks, and automatic chat updates.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setIsAddingStep(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover shadow-xs transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add Action Step
          </button>
        )}
      </div>

      {/* Add Step Card Form */}
      {isAddingStep && (
        <form
          onSubmit={handleCreateStep}
          className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              New Action Step
            </h4>
            <button
              type="button"
              onClick={() => setIsAddingStep(false)}
              className="text-xs font-semibold text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="Action Step Title *"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="sm:col-span-2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
            />
            <input
              type="text"
              placeholder="Phase (e.g. Planning, Execution)"
              value={newPhase}
              onChange={(e) => setNewPhase(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
            />
            <input
              type="text"
              placeholder="Description (Optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-primary-hover transition shadow-xs"
            >
              {isSubmitting ? 'Adding...' : 'Save Action Step'}
            </button>
          </div>
        </form>
      )}

      {/* Steps List */}
      <div className="space-y-3.5">
        {steps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center bg-card">
            <CheckSquare className="h-9 w-9 text-muted mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold text-foreground">No action steps defined yet</p>
            <p className="text-[11px] text-muted">Create action steps to plan sequential workflows.</p>
          </div>
        ) : (
          steps.map((step, idx) => {
            const cfg = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
            const isExpanded = expandedStepId === step._id;
            const workflowActions = step.workflow_actions || [];
            const completedActionsCount = workflowActions.filter((a) => a.status === 'completed').length;

            return (
              <div
                key={step._id || idx}
                className="rounded-2xl border border-border bg-card shadow-xs transition hover:border-border/90 overflow-hidden"
              >
                {/* Step Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface-muted/20">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary border border-primary/20">
                      {step.step_number || idx + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground truncate">
                          {step.title}
                        </span>
                        <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-extrabold uppercase text-muted border border-border">
                          {step.phase_name}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${cfg.bg} ${cfg.text} border ${cfg.border}`}
                        >
                          {cfg.label}
                        </span>
                        {workflowActions.length > 0 && (
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            {completedActionsCount}/{workflowActions.length} Actions Done
                          </span>
                        )}
                      </div>
                      {step.description && (
                        <p className="text-[11px] text-muted line-clamp-1 mt-0.5">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* PARENT STEP WORKFLOW ACTION BUTTONS */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Step State Transition Buttons */}
                    {step.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => openStepTransitionModal(step, 'in_progress')}
                        className="flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition"
                      >
                        <Play className="h-3.5 w-3.5" /> Start Step
                      </button>
                    )}

                    {step.status === 'in_progress' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openStepTransitionModal(step, 'under_review')}
                          className="flex items-center gap-1 rounded-xl bg-amber-600 hover:bg-amber-700 px-2.5 py-1.5 text-xs font-bold text-white shadow-2xs transition"
                        >
                          <Eye className="h-3.5 w-3.5" /> Review
                        </button>
                        <button
                          type="button"
                          onClick={() => openStepTransitionModal(step, 'completed')}
                          className="flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition"
                        >
                          <Check className="h-3.5 w-3.5" /> Complete
                        </button>
                        <button
                          type="button"
                          onClick={() => openStepTransitionModal(step, 'blocked')}
                          className="flex items-center gap-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-500/20 transition"
                        >
                          <Ban className="h-3.5 w-3.5" /> Block
                        </button>
                      </div>
                    )}

                    {step.status === 'under_review' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openStepTransitionModal(step, 'completed')}
                          className="flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Complete
                        </button>
                        <button
                          type="button"
                          onClick={() => openStepTransitionModal(step, 'in_progress')}
                          className="flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-surface-muted transition"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-amber-500" /> Revise
                        </button>
                      </div>
                    )}

                    {step.status === 'blocked' && (
                      <button
                        type="button"
                        onClick={() => openStepTransitionModal(step, 'in_progress')}
                        className="flex items-center gap-1 rounded-xl bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition"
                      >
                        <Play className="h-3.5 w-3.5" /> Resume Step
                      </button>
                    )}

                    {step.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => openStepTransitionModal(step, 'in_progress')}
                        className="flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-muted hover:text-foreground transition"
                      >
                        <RotateCcw className="h-3 w-3" /> Reopen Step
                      </button>
                    )}

                    {/* Due Date Indicator */}
                    {step.due_date && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-muted bg-surface-muted px-2 py-1 rounded-lg hidden sm:flex">
                        <Calendar className="h-3 w-3" />
                        {new Date(step.due_date).toLocaleDateString()}
                      </span>
                    )}

                    {/* Expand/Collapse Drawer */}
                    <button
                      type="button"
                      onClick={() => setExpandedStepId(isExpanded ? null : step._id)}
                      className="rounded-lg p-1.5 text-muted hover:bg-surface-muted transition"
                      title="Toggle Workflow & Checklist"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStep(step._id)}
                        className="rounded-lg p-1.5 text-muted hover:text-rose-500 hover:bg-rose-500/10 transition"
                        title="Delete step"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details: Workflow of Actions One by One */}
                {isExpanded && (
                  <div className="border-t border-border bg-surface-muted/20 p-4 space-y-4 animate-in fade-in duration-150">
                    {/* Assignee & Dates Summary */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-primary" />
                        <span>
                          Step Lead / Assignee:{' '}
                          <strong className="text-foreground">
                            {step.assigned_to_user_name ||
                              (typeof step.assigned_to_user_id === 'object'
                                ? step.assigned_to_user_id?.name
                                : 'Unassigned')}
                          </strong>
                        </span>
                      </div>
                      {step.completed_at && (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Completed on {new Date(step.completed_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {/* SEQUENTIAL WORKFLOW OF ACTIONS SECTION */}
                    <div className="space-y-3 pt-2 border-t border-border/70">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                            <Play className="h-3 w-3 text-primary" />
                            Workflow of Actions (One by One Execution)
                          </span>
                          <span className="text-[10px] text-muted">
                            ({workflowActions.length} planned actions)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveNewActionStepId(step._id)}
                          className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                        >
                          <Plus className="h-3 w-3" /> Add Action
                        </button>
                      </div>

                      {/* Add Action Form */}
                      {activeNewActionStepId === step._id && (
                        <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-primary">New Action on this Step</span>
                            <button
                              type="button"
                              onClick={() => setActiveNewActionStepId(null)}
                              className="text-[10px] text-muted hover:text-foreground font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Action title (e.g. Conduct audit inspection, Upload report)..."
                            value={newActionTitle}
                            onChange={(e) => setNewActionTitle(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-hidden"
                          />
                          <input
                            type="text"
                            placeholder="Description / Guidance (Optional)"
                            value={newActionDesc}
                            onChange={(e) => setNewActionDesc(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-hidden"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={isAddingAction || !newActionTitle.trim()}
                              onClick={() => handleAddWorkflowAction(step._id)}
                              className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-40 transition"
                            >
                              {isAddingAction ? 'Saving...' : 'Add Action to Plan'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Actions Workflow List */}
                      {workflowActions.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border p-4 text-center text-muted text-xs">
                          No sub-actions created for this step yet. Click <strong>&quot;Add Action&quot;</strong> to establish a sequential execution roadmap.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {workflowActions.map((action, actionIdx) => {
                            const actCfg =
                              WORKFLOW_STATUS_CONFIG[action.status] || WORKFLOW_STATUS_CONFIG.pending;
                            const isDone = action.status === 'completed';
                            const isCurrent = action.status === 'in_progress';

                            return (
                              <div
                                key={action._id || actionIdx}
                                className={`rounded-xl border p-3 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                  isDone
                                    ? 'bg-emerald-500/5 border-emerald-500/20'
                                    : isCurrent
                                    ? 'bg-blue-500/5 border-blue-500/30 ring-1 ring-blue-500/20'
                                    : 'bg-background border-border'
                                }`}
                              >
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                  <span
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${
                                      isDone
                                        ? 'bg-emerald-500 text-white'
                                        : isCurrent
                                        ? 'bg-blue-500 text-white animate-pulse'
                                        : 'bg-surface-muted text-foreground border border-border'
                                    }`}
                                  >
                                    {isDone ? <Check className="h-3.5 w-3.5" /> : actionIdx + 1}
                                  </span>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p
                                        className={`text-xs font-bold truncate ${
                                          isDone ? 'line-through text-muted' : 'text-foreground'
                                        }`}
                                      >
                                        {action.title}
                                      </p>
                                      <span
                                        className={`rounded-md px-2 py-0.2 text-[9px] font-extrabold uppercase ${actCfg.bg} ${actCfg.text} border ${actCfg.border}`}
                                      >
                                        {actCfg.label}
                                      </span>
                                    </div>
                                    {action.description && (
                                      <p className="text-[11px] text-muted mt-0.5">{action.description}</p>
                                    )}
                                    {action.remarks && (
                                      <p className="text-[10px] text-muted italic mt-0.5 flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" /> &quot;{action.remarks}&quot;
                                      </p>
                                    )}
                                    {action.completed_at && (
                                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                        ✓ Completed by {action.performed_by_name || 'User'} on{' '}
                                        {new Date(action.completed_at).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Action Execution Controls with Confirmation Modal Trigger */}
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  {action.status === 'pending' && (
                                    <button
                                      type="button"
                                      onClick={() => openActionTransitionModal(step, action, 'in_progress')}
                                      className="flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition"
                                    >
                                      <Play className="h-3 w-3" /> Start
                                    </button>
                                  )}

                                  {action.status === 'in_progress' && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => openActionTransitionModal(step, action, 'completed')}
                                        className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition"
                                      >
                                        <Check className="h-3 w-3" /> Complete
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openActionTransitionModal(step, action, 'blocked')}
                                        className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-500 hover:bg-rose-500/20 transition"
                                        title="Mark Blocked"
                                      >
                                        <Ban className="h-3 w-3" /> Block
                                      </button>
                                    </div>
                                  )}

                                  {action.status === 'blocked' && (
                                    <button
                                      type="button"
                                      onClick={() => openActionTransitionModal(step, action, 'in_progress')}
                                      className="flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 px-2.5 py-1 text-[11px] font-bold text-white transition"
                                    >
                                      <Play className="h-3 w-3" /> Resume
                                    </button>
                                  )}

                                  {action.status === 'completed' && (
                                    <button
                                      type="button"
                                      onClick={() => openActionTransitionModal(step, action, 'in_progress')}
                                      className="text-[10px] font-semibold text-muted hover:underline"
                                    >
                                      Reopen
                                    </button>
                                  )}

                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteWorkflowAction(step._id, action._id!)}
                                      className="rounded-lg p-1 text-muted hover:text-rose-500 hover:bg-rose-500/10 transition"
                                      title="Delete action"
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

                    {/* Checklist Items Section */}
                    {step.checklist && step.checklist.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-border/70">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                          Step Deliverables & Checklist
                        </span>
                        <div className="space-y-1">
                          {step.checklist.map((item) => (
                            <label
                              key={item._id}
                              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-surface-muted cursor-pointer transition text-xs text-foreground"
                            >
                              <input
                                type="checkbox"
                                checked={item.is_completed}
                                onChange={() => handleToggleChecklist(step._id, item._id!, item.is_completed)}
                                className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                              />
                              <span className={item.is_completed ? 'line-through text-muted' : ''}>
                                {item.title}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* REUSABLE WORKFLOW TRANSITION CONFIRMATION MODAL */}
      {modalData.isOpen && (
        <WorkflowTransitionModal
          isOpen={modalData.isOpen}
          onClose={() => setModalData((prev) => ({ ...prev, isOpen: false }))}
          targetType={modalData.targetType}
          stepId={modalData.stepId}
          stepNumber={modalData.stepNumber}
          actionId={modalData.actionId}
          itemTitle={modalData.itemTitle}
          currentStatus={modalData.currentStatus}
          targetStatus={modalData.targetStatus}
          onConfirm={handleConfirmTransition}
        />
      )}
    </div>
  );
}
