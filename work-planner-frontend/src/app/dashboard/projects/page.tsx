'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Lock,
  Layers,
  Calendar,
  User,
  ArrowRight,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { fetchProjects } from '@/lib/projectApi';
import { readSessionFromStorage, isWpAdmin, isWpManager } from '@/utils/authStorage';
import { CreateProjectModal } from '@/components/project/CreateProjectModal';
import type { Project, ProjectStatus } from '@/types/project';

const STATUS_BADGES: Record<
  ProjectStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  draft: { label: 'Draft', bg: 'bg-slate-500/10', text: 'text-slate-500', border: 'border-slate-500/20' },
  planning: { label: 'Planning', bg: 'bg-indigo-500/10', text: 'text-indigo-500', border: 'border-indigo-500/20' },
  active: { label: 'Active', bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  on_hold: { label: 'On Hold', bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  completed: { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
  closed: { label: 'Closed', bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20' },
  cancelled: { label: 'Cancelled', bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20' },
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const session = readSessionFromStorage();
    if (session?.token) {
      setToken(session.token);
      setUser(session.user);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await fetchProjects(token, {
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        search: searchQuery.trim() || undefined,
      });
      setProjects(res.items || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedStatus, searchQuery]);

  useEffect(() => {
    if (token) {
      loadProjects();
    }
  }, [token, loadProjects]);

  const canCreate = isWpAdmin(user) || isWpManager(user);

  // Stats computation
  const totalCount = projects.length;
  const activeCount = projects.filter((p) => p.status === 'active').length;
  const planningCount = projects.filter((p) => p.status === 'planning').length;
  const closedCount = projects.filter((p) => p.status === 'closed' || p.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
            <FolderKanban className="h-6 w-6 text-primary" />
            Project Management
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Create projects, assign teams, track action steps, collaborate via live chat & share deliverables
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadProjects}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition shadow-2xs"
            title="Refresh list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              New Project
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Projects</span>
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-foreground">{totalCount}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{activeCount}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Planning</span>
            <Clock className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{planningCount}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Completed / Closed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{closedCount}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'active', 'planning', 'completed', 'closed', 'on_hold'].map((st) => {
            const isActive = selectedStatus === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted hover:bg-surface-muted hover:text-foreground border border-border bg-card'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code, title, tags..."
            className="w-full rounded-xl border border-border bg-card pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-hidden shadow-2xs"
          />
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-xs text-muted">
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <FolderKanban className="h-10 w-10 text-muted mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-foreground">No projects found</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {searchQuery
              ? 'No projects matching your search query. Try resetting filters.'
              : 'Create your first project to start planning action steps and team collaboration.'}
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => {
            const badge = STATUS_BADGES[proj.status] || STATUS_BADGES.planning;
            const managerName =
              typeof proj.project_manager_id === 'object'
                ? proj.project_manager_id?.name
                : 'Unassigned';

            return (
              <Link
                key={proj._id}
                href={`/dashboard/projects/${proj._id}`}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-2xs hover:border-primary/50 hover:shadow-md transition duration-200"
              >
                <div className="space-y-3">
                  {/* Top Row: Code & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-surface-muted px-2 py-0.5 text-[11px] font-black text-foreground border border-border">
                      {proj.project_code || 'PRJ'}
                    </span>
                    <span
                      className={`rounded-lg border px-2 py-0.5 text-[10px] font-extrabold uppercase ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-sm font-extrabold text-foreground group-hover:text-primary transition line-clamp-1">
                      {proj.title}
                    </h3>
                    <p className="text-xs text-muted line-clamp-2 mt-1">
                      {proj.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-muted">Progress</span>
                      <span className="font-black text-foreground">{proj.progress_percentage || 0}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${proj.progress_percentage || 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="mt-4 pt-3.5 border-t border-border flex items-center justify-between text-[11px] text-muted">
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{managerName}</span>
                  </div>

                  <div className="flex items-center gap-1 text-primary font-bold group-hover:translate-x-0.5 transition">
                    <span>Workspace</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <CreateProjectModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          token={token}
          onCreated={(newP) => {
            setProjects((prev) => [newP, ...prev]);
          }}
        />
      )}
    </div>
  );
}
