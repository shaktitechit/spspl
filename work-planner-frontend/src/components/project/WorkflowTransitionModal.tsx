'use client';

import { useState } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Check,
  Ban,
  Circle,
  ArrowRight,
  MessageSquare,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import type { ActionStepStatus, WorkflowActionStatus } from '@/types/project';

export type TransitionTargetType = 'step' | 'action';

export interface WorkflowTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: TransitionTargetType;
  stepId: string;
  stepNumber?: number;
  actionId?: string;
  itemTitle: string;
  currentStatus: ActionStepStatus | WorkflowActionStatus;
  targetStatus: ActionStepStatus | WorkflowActionStatus;
  onConfirm: (remark: string) => Promise<void>;
}

const STATUS_DETAILS: Record<
  string,
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
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/20',
    icon: Clock,
  },
  under_review: {
    label: 'Under Review',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
    icon: AlertCircle,
  },
  completed: {
    label: 'Completed',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    icon: CheckCircle2,
  },
  blocked: {
    label: 'Blocked',
    bg: 'bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/20',
    icon: Ban,
  },
  skipped: {
    label: 'Skipped',
    bg: 'bg-muted/10',
    text: 'text-muted',
    border: 'border-muted/20',
    icon: Circle,
  },
};

export function WorkflowTransitionModal({
  isOpen,
  onClose,
  targetType,
  stepId,
  stepNumber,
  actionId,
  itemTitle,
  currentStatus,
  targetStatus,
  onConfirm,
}: WorkflowTransitionModalProps) {
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const currentCfg = STATUS_DETAILS[currentStatus] || STATUS_DETAILS.pending;
  const targetCfg = STATUS_DETAILS[targetStatus] || STATUS_DETAILS.in_progress;
  const CurrentIcon = currentCfg.icon;
  const TargetIcon = targetCfg.icon;

  const isStep = targetType === 'step';
  const isBlock = targetStatus === 'blocked';
  const isComplete = targetStatus === 'completed';

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await onConfirm(remark.trim());
      setRemark('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update workflow state');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-muted/50">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-2xs ${
                isBlock
                  ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  : isComplete
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-primary/10 text-primary border-primary/20'
              }`}
            >
              <TargetIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-foreground tracking-tight">
                Confirm {isStep ? 'Step' : 'Action'} Workflow Transition
              </h3>
              <p className="text-[11px] text-muted">
                {isStep
                  ? `Parent Step #${stepNumber || ''}`
                  : 'Sub-Action Execution Stage'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-500 font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Item Title & Transition preview */}
          <div className="rounded-2xl border border-border bg-surface-muted/30 p-4 space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Target {isStep ? 'Action Step' : 'Workflow Action'}
              </span>
              <p className="text-xs font-bold text-foreground mt-0.5">{itemTitle}</p>
            </div>

            {/* Transition Flow Badges */}
            <div className="flex items-center gap-2.5 pt-1">
              <div
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold border ${currentCfg.bg} ${currentCfg.text} ${currentCfg.border}`}
              >
                <CurrentIcon className="h-3.5 w-3.5" />
                <span>{currentCfg.label}</span>
              </div>

              <ArrowRight className="h-4 w-4 text-muted shrink-0" />

              <div
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold border ${targetCfg.bg} ${targetCfg.text} ${targetCfg.border}`}
              >
                <TargetIcon className="h-3.5 w-3.5" />
                <span>{targetCfg.label}</span>
              </div>
            </div>
          </div>

          {/* Remarks / Comments Input */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              Activity Remarks & Notes {isBlock ? <span className="text-rose-500">*</span> : '(Optional)'}
            </label>
            <textarea
              rows={3}
              required={isBlock}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={
                isBlock
                  ? 'State why this step/action is blocked and any blockers...'
                  : isComplete
                  ? 'Sign-off summary or verification notes...'
                  : 'Add notes or progress details (this will appear in the chat room feed)...'
              }
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-hidden leading-relaxed"
            />
            <p className="text-[10px] text-muted">
              💡 This transition will automatically generate a real-time system event card in the project chat room.
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (isBlock && !remark.trim())}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition shadow-xs disabled:opacity-50 ${
                isBlock
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : isComplete
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-primary hover:bg-primary-hover'
              }`}
            >
              <TargetIcon className="h-3.5 w-3.5" />
              {isSubmitting ? 'Applying Transition...' : `Confirm & Mark ${targetCfg.label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
