'use client';

import { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { closeProject } from '@/lib/projectApi';
import type { Project } from '@/types/project';

interface CloseProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  token: string | null;
  onClosed: (updatedProj: Project) => void;
}

export function CloseProjectModal({ isOpen, onClose, project, token, onClosed }: CloseProjectModalProps) {
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const pendingSteps = (project.steps || []).filter(
    (s) => s.status === 'pending' || s.status === 'in_progress' || s.status === 'under_review'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const updated = await closeProject(token, project._id, remarks.trim());
      onClosed(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to close project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-amber-500/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Close Project</h2>
              <p className="text-xs text-muted">{project.project_code} • {project.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-500">
              {errorMsg}
            </div>
          )}

          {pendingSteps.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-1.5 text-xs text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Warning: {pendingSteps.length} Action Step(s) Pending</span>
              </div>
              <p className="text-[11px] opacity-90">
                Closing this project will finalize all operations. The team will be notified that the project has concluded.
              </p>
            </div>
          )}

          {/* Completion Statistics */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-muted/40 p-3 text-center">
            <div>
              <span className="text-[11px] font-semibold text-muted">Overall Progress</span>
              <p className="text-base font-extrabold text-primary">{project.progress_percentage || 0}%</p>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-muted">Completed Steps</span>
              <p className="text-base font-extrabold text-foreground">
                {project.completed_steps || 0} / {project.total_steps || 0}
              </p>
            </div>
          </div>

          {/* Closure Remarks */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground">
              Final Closure Remarks / Sign-off Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Provide final sign-off summary, key outcomes, deliverables handover notes..."
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-hidden resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-5 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                'Closing...'
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm & Close Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
