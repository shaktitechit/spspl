'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  UserCheck,
  Crown,
  User,
  Tag,
  Plus,
  Trash2,
  X,
  Check,
  Building2,
  Search,
  UserPlus,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import type { Project, ProjectMemberRole } from '@/types/project';
import {
  fetchEligibleMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  assignProjectTeams,
  removeProjectTeam,
} from '@/lib/projectApi';

interface ProjectTeamTabProps {
  project: Project;
  token?: string | null;
  canEdit: boolean;
  onProjectUpdate?: (updated: Project) => void;
}

const ROLE_CONFIG: Record<
  ProjectMemberRole,
  { label: string; bg: string; text: string; icon: any; desc: string }
> = {
  admin: {
    label: 'Admin',
    bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    text: 'text-rose-600 dark:text-rose-400',
    icon: Crown,
    desc: 'Full administrative rights',
  },
  lead: {
    label: 'Project Lead',
    bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    icon: Shield,
    desc: 'Manage roadmap & deliverables',
  },
  coordinator: {
    label: 'Coordinator',
    bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    icon: UserCheck,
    desc: 'Track and coordinate tasks',
  },
  contributor: {
    label: 'Contributor',
    bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: User,
    desc: 'Execute assigned action steps',
  },
  viewer: {
    label: 'Viewer',
    bg: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    text: 'text-slate-500',
    icon: User,
    desc: 'Read-only visibility',
  },
};

export function ProjectTeamTab({ project, token, canEdit, onProjectUpdate }: ProjectTeamTabProps) {
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [eligibleUsers, setEligibleUsers] = useState<Array<{ _id: string; name: string; email: string; department?: string }>>([]);
  const [availableTeams, setAvailableTeams] = useState<string[]>([]);

  // Add Member state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<ProjectMemberRole>('contributor');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Add Team state
  const [selectedTeamName, setSelectedTeamName] = useState('');
  const [customTeamName, setCustomTeamName] = useState('');
  const [autoEnroll, setAutoEnroll] = useState(true);

  // Load eligible members and departments
  useEffect(() => {
    if (!token) return;
    fetchEligibleMembers(token)
      .then((data) => {
        setEligibleUsers(data.users || []);
        setAvailableTeams(data.teams || []);
      })
      .catch((err) => {
        console.error('Failed to fetch eligible members', err);
      });
  }, [token]);

  const managerName =
    typeof project.project_manager_id === 'object'
      ? project.project_manager_id?.name
      : 'Unassigned';

  const creatorName =
    typeof project.created_by === 'object'
      ? project.created_by?.name
      : 'System';

  // Filter existing member IDs
  const existingMemberIds = new Set(
    (project.members || []).map((m) =>
      typeof m.user_id === 'object' ? String(m.user_id._id) : String(m.user_id)
    )
  );

  const filteredUsers = eligibleUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(userSearchQuery.toLowerCase()));
    return matchesSearch && !existingMemberIds.has(u._id);
  });

  const assignedTeams = project.assigned_team_ids || [];
  const unassignedTeams = availableTeams.filter((t) => !assignedTeams.includes(t));

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !token) return;

    setLoading(true);
    try {
      const updated = await addProjectMember(token, project._id, {
        user_id: selectedUserId,
        role: selectedRole,
      });
      onProjectUpdate?.(updated);
      setIsAddMemberOpen(false);
      setSelectedUserId('');
      setSelectedRole('contributor');
      setUserSearchQuery('');
    } catch (err: any) {
      alert(err.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: ProjectMemberRole) => {
    if (!token) return;
    try {
      const updated = await updateProjectMemberRole(token, project._id, userId, newRole);
      onProjectUpdate?.(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to update member role');
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to remove ${memberName} from this project?`)) return;

    try {
      const updated = await removeProjectMember(token, project._id, userId);
      onProjectUpdate?.(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  };

  const handleAssignTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const teamToAdd = customTeamName.trim() || selectedTeamName;
    if (!teamToAdd || !token) return;

    setLoading(true);
    try {
      const updated = await assignProjectTeams(token, project._id, teamToAdd, autoEnroll);
      onProjectUpdate?.(updated);
      setIsAddTeamOpen(false);
      setSelectedTeamName('');
      setCustomTeamName('');
    } catch (err: any) {
      alert(err.message || 'Failed to assign team');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTeam = async (teamName: string) => {
    if (!token) return;
    if (!confirm(`Remove team "${teamName}" from project assigned teams?`)) return;

    try {
      const updated = await removeProjectTeam(token, project._id, teamName);
      onProjectUpdate?.(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to remove team');
    }
  };

  return (
    <div className="space-y-6">
      {/* Project Meta Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Project Manager</span>
          <p className="text-sm font-extrabold text-foreground">{managerName}</p>
          <span className="text-[10px] text-primary font-semibold">Primary Lead</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Created By</span>
          <p className="text-sm font-extrabold text-foreground">{creatorName}</p>
          <span className="text-[10px] text-muted">
            {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Target Completion</span>
          <p className="text-sm font-extrabold text-foreground">
            {project.target_end_date ? new Date(project.target_end_date).toLocaleDateString() : 'No Target Date'}
          </p>
          <span className="text-[10px] text-muted">Estimated Deadline</span>
        </div>
      </div>

      {/* Assigned Teams Section */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Assigned Teams & Departments
            </h3>
            <p className="text-xs text-muted">
              Teams collaborating on this project. Assigning a team automatically syncs its members.
            </p>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setIsAddTeamOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 text-xs font-bold transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Assign Team
            </button>
          )}
        </div>

        {assignedTeams.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-4 text-center">
            <p className="text-xs text-muted">No specific team assigned yet. Assign a team to auto-enroll its members.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assignedTeams.map((team, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-xl bg-surface-muted border border-border px-3 py-1.5 text-xs font-bold text-foreground"
              >
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span>{team}</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTeam(team)}
                    className="rounded-full p-0.5 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition"
                    title={`Remove ${team}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Roster Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Project Team Members ({project.members?.length || 0})
            </h3>
            <p className="text-xs text-muted">Members assigned to collaborate on this project</p>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setIsAddMemberOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 transition"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Member
            </button>
          )}
        </div>

        {(!project.members || project.members.length === 0) ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted mb-2" />
            <p className="text-xs font-bold text-foreground">No members assigned</p>
            <p className="text-[11px] text-muted mt-0.5">Click Add Member or Assign a Team to start adding people.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {project.members.map((member, idx) => {
              const rawUserId =
                typeof member.user_id === 'object'
                  ? String(member.user_id._id)
                  : String(member.user_id);

              const memberName =
                typeof member.user_id === 'object'
                  ? member.user_id?.name
                  : member.user_name || 'Team Member';

              const memberEmail =
                typeof member.user_id === 'object'
                  ? member.user_id?.email
                  : member.user_email || '';

              const config = ROLE_CONFIG[member.role] || ROLE_CONFIG.contributor;
              const Icon = config.icon;

              return (
                <div
                  key={idx}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-card p-3.5 shadow-xs hover:border-primary/30 transition space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-sm font-black border border-primary/20">
                      {memberName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate">{memberName}</p>
                      {memberEmail && (
                        <p className="text-[11px] text-muted truncate">{memberEmail}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    {canEdit ? (
                      <div className="relative inline-block">
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(rawUserId, e.target.value as ProjectMemberRole)}
                          className={`rounded-lg border px-2 py-1 text-[10px] font-extrabold uppercase bg-card cursor-pointer ${config.bg}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="lead">Lead</option>
                          <option value="coordinator">Coordinator</option>
                          <option value="contributor">Contributor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </div>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase border ${config.bg}`}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {config.label}
                      </span>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(rawUserId, memberName)}
                        className="rounded-lg p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition"
                        title="Remove member"
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

      {/* Project Tags */}
      {project.tags && project.tags.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border">
          <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Project Tags
          </span>
          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag, idx) => (
              <span
                key={idx}
                className="rounded-lg bg-surface-muted border border-border px-2.5 py-1 text-xs font-semibold text-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Add Team Member
              </h3>
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(false)}
                className="rounded-full p-1 text-muted hover:bg-surface-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Search Eligible User</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or department..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-border p-2 bg-surface-muted/30">
                {filteredUsers.length === 0 ? (
                  <p className="text-xs text-muted text-center py-4">No matching available users found.</p>
                ) : (
                  filteredUsers.map((u) => (
                    <div
                      key={u._id}
                      onClick={() => setSelectedUserId(u._id)}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition text-xs ${
                        selectedUserId === u._id
                          ? 'bg-primary/10 border border-primary/30 text-primary font-bold'
                          : 'hover:bg-surface-muted text-foreground'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold truncate">{u.name}</p>
                        <p className="text-[11px] text-muted truncate">{u.email} {u.department ? `• ${u.department}` : ''}</p>
                      </div>
                      {selectedUserId === u._id && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Assign Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as ProjectMemberRole)}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="contributor">Contributor - Execute action steps</option>
                  <option value="coordinator">Coordinator - Track tasks and milestones</option>
                  <option value="lead">Project Lead - Manage deliverables</option>
                  <option value="admin">Admin - Full administrative access</option>
                  <option value="viewer">Viewer - Read-only visibility</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedUserId || loading}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add to Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Team Modal */}
      {isAddTeamOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Assign Team / Department
              </h3>
              <button
                type="button"
                onClick={() => setIsAddTeamOpen(false)}
                className="rounded-full p-1 text-muted hover:bg-surface-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignTeam} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Select Existing Department / Team</label>
                <select
                  value={selectedTeamName}
                  onChange={(e) => {
                    setSelectedTeamName(e.target.value);
                    if (e.target.value) setCustomTeamName('');
                  }}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Choose Department / Team --</option>
                  {unassignedTeams.map((team, idx) => (
                    <option key={idx} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Or Enter Custom Team Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mobile Engineering, QA Alpha"
                  value={customTeamName}
                  onChange={(e) => {
                    setCustomTeamName(e.target.value);
                    if (e.target.value) setSelectedTeamName('');
                  }}
                  className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoEnroll"
                  checked={autoEnroll}
                  onChange={(e) => setAutoEnroll(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <label htmlFor="autoEnroll" className="text-xs text-foreground cursor-pointer font-medium">
                  Automatically enroll active members of this team
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddTeamOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={(!selectedTeamName && !customTeamName.trim()) || loading}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Assign Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
