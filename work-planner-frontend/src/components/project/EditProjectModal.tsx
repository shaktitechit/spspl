'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  FolderKanban,
  Flag,
  UserPlus,
  Users,
  Building2,
  Crown,
  UserCheck,
  User,
  Trash2,
  Shield,
  Save,
} from 'lucide-react';
import { updateProject, fetchEligibleMembers } from '@/lib/projectApi';
import type { Project, ProjectPriority, ProjectStatus, ProjectMemberRole } from '@/types/project';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  project: Project;
  onUpdated: (updatedProj: Project) => void;
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

export function EditProjectModal({ isOpen, onClose, token, project, onUpdated }: EditProjectModalProps) {
  const [title, setTitle] = useState(project.title || '');
  const [description, setDescription] = useState(project.description || '');
  const [category, setCategory] = useState(project.category || 'Operations');
  const [priority, setPriority] = useState<ProjectPriority>(project.priority || 'medium');
  const [status, setStatus] = useState<ProjectStatus>(project.status || 'active');
  const [startDate, setStartDate] = useState(
    project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : ''
  );
  const [targetEndDate, setTargetEndDate] = useState(
    project.target_end_date ? new Date(project.target_end_date).toISOString().split('T')[0] : ''
  );
  const [tagsInput, setTagsInput] = useState((project.tags || []).join(', '));

  // Eligible Users & Teams
  const [eligibleUsers, setEligibleUsers] = useState<
    Array<{ _id: string; name: string; email: string; department?: string }>
  >([]);
  const [availableTeams, setAvailableTeams] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(project.assigned_team_ids || []);

  // Project Manager & Members
  const initialPmId =
    typeof project.project_manager_id === 'object' && project.project_manager_id
      ? project.project_manager_id._id
      : (project.project_manager_id as string) || '';
  const [projectManagerId, setProjectManagerId] = useState(initialPmId);

  const initialMembers: SelectedMember[] = (project.members || []).map((m) => ({
    user_id: typeof m.user_id === 'object' && m.user_id ? m.user_id._id : (m.user_id as string),
    user_name:
      typeof m.user_id === 'object' && m.user_id?.name ? m.user_id.name : m.user_name || 'Member',
    user_email:
      typeof m.user_id === 'object' && m.user_id?.email ? m.user_id.email : m.user_email || '',
    role: m.role || 'contributor',
  }));
  const [assignedMembers, setAssignedMembers] = useState<SelectedMember[]>(initialMembers);

  // Member Picker State
  const [selectedMemberUserId, setSelectedMemberUserId] = useState('');
  const [selectedMemberRole, setSelectedMemberRole] = useState<ProjectMemberRole>('contributor');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token || !isOpen) return;
    fetchEligibleMembers(token)
      .then((data) => {
        setEligibleUsers(data.users || []);
        setAvailableTeams(data.teams || []);
      })
      .catch((err) => console.error('Failed to load eligible users & teams', err));
  }, [token, isOpen]);

  if (!isOpen) return null;

  const toggleTeam = (teamName: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamName) ? prev.filter((t) => t !== teamName) : [...prev, teamName]
    );
  };

  const handleAddMemberToRoster = () => {
    if (!selectedMemberUserId) return;
    const u = eligibleUsers.find((user) => user._id === selectedMemberUserId);
    if (!u) return;

    if (assignedMembers.some((m) => m.user_id === u._id)) {
      alert('This user is already in the project members roster.');
      return;
    }

    setAssignedMembers((prev) => [
      ...prev,
      {
        user_id: u._id,
        user_name: u.name,
        user_email: u.email,
        role: selectedMemberRole,
      },
    ]);
    setSelectedMemberUserId('');
    setSelectedMemberRole('contributor');
  };

  const handleRemoveMember = (userId: string) => {
    setAssignedMembers((prev) => prev.filter((m) => m.user_id !== userId));
  };

  const handleMemberRoleChange = (userId: string, role: ProjectMemberRole) => {
    setAssignedMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role } : m)));
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

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const payload: Partial<Project> = {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        target_end_date: targetEndDate ? new Date(targetEndDate).toISOString() : null,
        project_manager_id: projectManagerId || undefined,
        assigned_team_ids: selectedTeams,
        members: assignedMembers as any,
        tags,
      };

      const updated = await updateProject(token, project._id, payload);
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-muted/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground tracking-tight">Edit Project</h2>
              <p className="text-[11px] text-muted">
                Update details, assignments, project lead & team roles for {project.project_code}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {errorMsg && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-500 font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Basic Info Section */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FolderKanban className="h-4 w-4 text-primary" />
              General Project Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1">
                  Project Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q4 ERP Warehouse Optimization"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:outline-hidden cursor-pointer"
                >
                  <option value="Operations">Operations</option>
                  <option value="Procurement">Procurement</option>
                  <option value="Sales">Sales</option>
                  <option value="IT & Tech">IT & Tech</option>
                  <option value="Finance">Finance</option>
                  <option value="Audit">Audit</option>
                  <option value="Logistics">Logistics</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-foreground mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="High-level project objectives, milestones, and scope..."
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-hidden"
              />
            </div>
          </div>

          {/* Priority, Status & Dates Section */}
          <div className="space-y-3.5 pt-2 border-t border-border">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Flag className="h-4 w-4 text-primary" />
              Priority, Status & Schedule
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ProjectPriority)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden cursor-pointer"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden cursor-pointer"
                >
                  <option value="draft">Draft</option>
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1">Target End Date</label>
                <input
                  type="date"
                  value={targetEndDate}
                  onChange={(e) => setTargetEndDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Project Manager & Lead Selection */}
          <div className="space-y-3.5 pt-2 border-t border-border">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Crown className="h-4 w-4 text-amber-500" />
              Project Manager / Primary Lead
            </h3>

            <div className="rounded-2xl border border-border bg-surface-muted/30 p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Select Assigned Project Manager
                  </label>
                  <select
                    value={projectManagerId}
                    onChange={(e) => setProjectManagerId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:outline-hidden cursor-pointer"
                  >
                    <option value="">-- Assign Project Manager (Optional) --</option>
                    {eligibleUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.email}){u.department ? ` - [${u.department}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Teams & Departments Multi-Assignment */}
          <div className="space-y-3 pt-2 border-t border-border">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" />
              Assign Teams & Departments
            </h3>
            <p className="text-[11px] text-muted">
              Select department teams that will collaborate on this project.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {availableTeams.length > 0 ? (
                availableTeams.map((team) => {
                  const isSelected = selectedTeams.includes(team);
                  return (
                    <button
                      key={team}
                      type="button"
                      onClick={() => toggleTeam(team)}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition border ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-background border-border text-foreground hover:bg-surface-muted'
                      }`}
                    >
                      <Building2 className="h-3 w-3" />
                      {team}
                      {isSelected && <UserCheck className="h-3 w-3 ml-0.5" />}
                    </button>
                  );
                })
              ) : (
                <span className="text-xs text-muted">Loading department teams...</span>
              )}
            </div>
          </div>

          {/* Assign Team Members with Specific Roles */}
          <div className="space-y-3.5 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary" />
                Assign Team Members ({assignedMembers.length})
              </h3>
            </div>

            {/* Member Add Box */}
            <div className="rounded-2xl border border-border bg-surface-muted/30 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Select Member
                  </label>
                  <select
                    value={selectedMemberUserId}
                    onChange={(e) => setSelectedMemberUserId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden cursor-pointer"
                  >
                    <option value="">-- Choose User to Assign --</option>
                    {eligibleUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.email}){u.department ? ` - [${u.department}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-foreground mb-1">Role</label>
                  <select
                    value={selectedMemberRole}
                    onChange={(e) => setSelectedMemberRole(e.target.value as ProjectMemberRole)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden cursor-pointer"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddMemberToRoster}
                    disabled={!selectedMemberUserId}
                    className="w-full flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-40 transition shadow-xs"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              </div>

              {/* Current Assigned Members Roster Table/Cards */}
              {assignedMembers.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Assigned Project Roster
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {assignedMembers.map((m) => (
                      <div
                        key={m.user_id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-2.5 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs border border-primary/20">
                            {m.user_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{m.user_name}</p>
                            <p className="text-[10px] text-muted truncate">{m.user_email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={m.role}
                            onChange={(e) =>
                              handleMemberRoleChange(m.user_id, e.target.value as ProjectMemberRole)
                            }
                            className="rounded-lg border border-border bg-surface-muted px-2 py-1 text-[10px] font-bold text-foreground focus:outline-hidden cursor-pointer"
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.value.toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.user_id)}
                            className="rounded-lg p-1 text-muted hover:text-rose-500 hover:bg-rose-500/10 transition"
                            title="Remove member"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="pt-2 border-t border-border">
            <label className="block text-[11px] font-bold text-foreground mb-1">
              Tags (Comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Q4, Priority, Ops, High-Impact"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-hidden"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-50 transition shadow-xs"
            >
              <Save className="h-3.5 w-3.5" />
              {isSubmitting ? 'Saving Changes...' : 'Save Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
