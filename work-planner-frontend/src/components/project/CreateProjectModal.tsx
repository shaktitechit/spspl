'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  FolderKanban,
  Flag,
  CheckCircle2,
  UserPlus,
  Users,
  Building2,
  Shield,
  Crown,
  UserCheck,
  User,
} from 'lucide-react';
import { createProject, fetchEligibleMembers } from '@/lib/projectApi';
import type { Project, ProjectPriority, ProjectStatus, ProjectMemberRole } from '@/types/project';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  onCreated: (newProj: Project) => void;
}

interface SelectedMember {
  user_id: string;
  user_name: string;
  user_email: string;
  role: ProjectMemberRole;
}

const ROLE_OPTIONS: Array<{ value: ProjectMemberRole; label: string }> = [
  { value: 'admin', label: 'Admin (Full Access)' },
  { value: 'lead', label: 'Project Lead' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'contributor', label: 'Contributor' },
  { value: 'viewer', label: 'Viewer' },
];

export function CreateProjectModal({ isOpen, onClose, token, onCreated }: CreateProjectModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Operations');
  const [priority, setPriority] = useState<ProjectPriority>('medium');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Eligible Users & Teams
  const [eligibleUsers, setEligibleUsers] = useState<
    Array<{ _id: string; name: string; email: string; department?: string }>
  >([]);
  const [availableTeams, setAvailableTeams] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  // Project Manager & Members
  const [projectManagerId, setProjectManagerId] = useState('');
  const [assignedMembers, setAssignedMembers] = useState<SelectedMember[]>([]);

  // Member Picker Form State
  const [selectedMemberUserId, setSelectedMemberUserId] = useState('');
  const [selectedMemberRole, setSelectedMemberRole] = useState<ProjectMemberRole>('contributor');

  useEffect(() => {
    if (!token || !isOpen) return;
    fetchEligibleMembers(token)
      .then((data) => {
        setEligibleUsers(data.users || []);
        setAvailableTeams(data.teams || []);
      })
      .catch((err) => console.error('Failed to load eligible users & teams', err));
  }, [token, isOpen]);

  // Initial Action Steps
  const [steps, setSteps] = useState<Array<{ title: string; phase_name: string; due_date: string }>>([
    { title: 'Project Kickoff & Requirements', phase_name: 'Planning', due_date: '' },
    { title: 'Execution & Deliverables Implementation', phase_name: 'Execution', due_date: '' },
    { title: 'Final Review & Sign-off', phase_name: 'Review', due_date: '' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleAddStep = () => {
    setSteps((prev) => [...prev, { title: '', phase_name: 'Execution', due_date: '' }]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: string, value: string) => {
    setSteps((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const toggleTeam = (teamName: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamName) ? prev.filter((t) => t !== teamName) : [...prev, teamName]
    );
  };

  const handleAddMemberToRoster = () => {
    if (!selectedMemberUserId) return;
    const user = eligibleUsers.find((u) => u._id === selectedMemberUserId);
    if (!user) return;

    if (assignedMembers.some((m) => m.user_id === user._id)) {
      alert('This user is already added to the member roster.');
      return;
    }

    setAssignedMembers((prev) => [
      ...prev,
      {
        user_id: user._id,
        user_name: user.name,
        user_email: user.email,
        role: selectedMemberRole,
      },
    ]);
    setSelectedMemberUserId('');
    setSelectedMemberRole('contributor');
  };

  const handleRemoveMemberFromRoster = (userId: string) => {
    setAssignedMembers((prev) => prev.filter((m) => m.user_id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Project title is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const validSteps = steps
        .filter((s) => s.title.trim())
        .map((s, idx) => ({
          step_number: idx + 1,
          title: s.title.trim(),
          phase_name: s.phase_name || 'Execution',
          due_date: s.due_date ? new Date(s.due_date).toISOString() : null,
        }));

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const formattedMembers = assignedMembers.map((m) => ({
        user_id: m.user_id,
        user_name: m.user_name,
        user_email: m.user_email,
        role: m.role,
      }));

      const newProj = await createProject(token, {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status,
        project_manager_id: projectManagerId || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        target_end_date: targetEndDate ? new Date(targetEndDate).toISOString() : null,
        assigned_team_ids: selectedTeams,
        members: formattedMembers,
        tags,
        steps: validSteps,
      });

      onCreated(newProj);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-muted/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground tracking-tight">Create New Project</h2>
              <p className="text-xs text-muted">Configure project manager, team members, milestone steps, and schedule</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-500">
              {errorMsg}
            </div>
          )}

          {/* Project Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground">
              Project Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 Regional Distribution Automation"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-hidden"
            />
          </div>

          {/* Category & Priority & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
              >
                <option value="Operations">Operations</option>
                <option value="Engineering">Engineering</option>
                <option value="Client Delivery">Client Delivery</option>
                <option value="Logistics">Logistics</option>
                <option value="Marketing">Marketing</option>
                <option value="General">General</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ProjectPriority)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          {/* Project Manager Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-amber-500" /> Project Manager / Primary Lead
            </label>
            <select
              value={projectManagerId}
              onChange={(e) => setProjectManagerId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground font-semibold focus:border-primary focus:outline-hidden"
            >
              <option value="">-- Assign Project Manager (Defaults to Creator) --</option>
              {eligibleUsers.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.email}) {u.department ? `• ${u.department}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground">Description & Objectives</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline project scope, deliverables, and targets..."
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-hidden resize-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Target Completion Date</label>
              <input
                type="date"
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
              />
            </div>
          </div>

          {/* Assign Team Members Section */}
          <div className="space-y-2.5 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5 text-primary" /> Assign Team Members ({assignedMembers.length})
                </h3>
                <p className="text-[11px] text-muted">Add members with specific roles to collaborate on this project</p>
              </div>
            </div>

            {/* Member Picker Inputs */}
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedMemberUserId}
                onChange={(e) => setSelectedMemberUserId(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
              >
                <option value="">-- Choose User to Add --</option>
                {eligibleUsers
                  .filter((u) => !assignedMembers.some((m) => m.user_id === u._id))
                  .map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
              </select>

              <select
                value={selectedMemberRole}
                onChange={(e) => setSelectedMemberRole(e.target.value as ProjectMemberRole)}
                className="w-full sm:w-44 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden font-medium"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddMemberToRoster}
                disabled={!selectedMemberUserId}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-2 text-xs font-bold disabled:opacity-50 transition shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>

            {/* Added Members Roster */}
            {assignedMembers.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl border border-border bg-surface-muted/30">
                {assignedMembers.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground truncate">{m.user_name}</p>
                      <span className="inline-block uppercase text-[9px] font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {m.role}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMemberFromRoster(m.user_id)}
                      className="text-muted hover:text-rose-500 transition p-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Teams */}
          <div className="space-y-1.5 pt-3 border-t border-border">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary" /> Assign Teams & Departments
            </label>
            {availableTeams.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded-xl border border-border bg-background">
                {availableTeams.map((team, idx) => {
                  const isSelected = selectedTeams.includes(team);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleTeam(team)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-surface-muted text-muted hover:text-foreground border border-border'
                      }`}
                    >
                      <Building2 className="h-3 w-3" />
                      {team}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted">No default departments found</p>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Tags (comma separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Q4, Delivery, High-Priority, Client"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-hidden"
            />
          </div>

          {/* Action Steps Section */}
          <div className="pt-3 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Action Steps & Milestones
                </h3>
                <p className="text-[11px] text-muted">Define the initial action steps for this project</p>
              </div>
              <button
                type="button"
                onClick={handleAddStep}
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Step
              </button>
            </div>

            <div className="space-y-2.5">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted/40 p-2.5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => handleStepChange(idx, 'title', e.target.value)}
                    placeholder="Step Title / Milestone name..."
                    className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-hidden"
                  />
                  <input
                    type="text"
                    value={step.phase_name}
                    onChange={(e) => handleStepChange(idx, 'phase_name', e.target.value)}
                    placeholder="Phase (e.g. Planning)"
                    className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-hidden"
                  />
                  <input
                    type="date"
                    value={step.due_date}
                    onChange={(e) => handleStepChange(idx, 'due_date', e.target.value)}
                    className="w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-hidden"
                  />
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition"
                      title="Remove Step"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted hover:bg-surface-muted hover:text-foreground transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                'Creating Project...'
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Create Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
