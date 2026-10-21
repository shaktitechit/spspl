'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  RotateCcw,
  Trash2,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Files,
  Users,
  Calendar,
  AlertCircle,
  Edit3,
} from 'lucide-react';
import { fetchProjectById, reopenProject, deleteProject } from '@/lib/projectApi';
import { readSessionFromStorage, isWpAdmin, isWpManager } from '@/utils/authStorage';
import { ActionStepsTab } from '@/components/project/ActionStepsTab';
import { ProjectChatTab } from '@/components/project/ProjectChatTab';
import { ProjectFilesTab } from '@/components/project/ProjectFilesTab';
import { ProjectTeamTab } from '@/components/project/ProjectTeamTab';
import { CloseProjectModal } from '@/components/project/CloseProjectModal';
import { EditProjectModal } from '@/components/project/EditProjectModal';
import type { Project, ProjectActionStep } from '@/types/project';

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [steps, setSteps] = useState<ProjectActionStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'steps' | 'chat' | 'files' | 'team'>('steps');
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const session = readSessionFromStorage();
    if (session?.token) {
      setToken(session.token);
      setUser(session.user);
    }
  }, []);

  const loadProject = useCallback(async () => {
    if (!token || !projectId) return;
    try {
      setIsLoading(true);
      const data = await fetchProjectById(token, projectId);
      setProject(data);
      setSteps(data.steps || []);
    } catch (err: any) {
      alert(err.message || 'Failed to load project details');
      router.push('/dashboard/projects');
    } finally {
      setIsLoading(false);
    }
  }, [token, projectId, router]);

  useEffect(() => {
    if (token && projectId) {
      loadProject();
    }
  }, [token, projectId, loadProject]);

  const handleReopen = async () => {
    if (!confirm('Are you sure you want to reopen this project?')) return;
    try {
      const updated = await reopenProject(token, projectId);
      setProject(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to reopen project');
    }
  };

  const handleDelete = async () => {
    if (!confirm('WARNING: Are you sure you want to permanently archive and delete this project?')) return;
    try {
      await deleteProject(token, projectId);
      router.push('/dashboard/projects');
    } catch (err: any) {
      alert(err.message || 'Failed to delete project');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-xs font-semibold text-muted">
        Loading Project Workspace...
      </div>
    );
  }

  if (!project) return null;

  const isAdmin = isWpAdmin(user);
  const isManager = isWpManager(user);
  const canAdminClose = isAdmin || isManager;
  const isClosed = project.status === 'closed' || project.status === 'completed';

  return (
    <div className="space-y-6">
      {/* Back Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/projects"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted hover:bg-surface-muted hover:text-foreground transition shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-lg bg-surface-muted px-2 py-0.5 text-xs font-black text-foreground border border-border">
                {project.project_code}
              </span>
              <h1 className="text-lg font-extrabold text-foreground tracking-tight">
                {project.title}
              </h1>
              <span
                className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                  isClosed
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {project.status}
              </span>
            </div>
            {project.description && (
              <p className="text-xs text-muted line-clamp-1 mt-0.5">{project.description}</p>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          {!isClosed && canAdminClose && (
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-surface-muted px-3.5 py-2 text-xs font-bold text-foreground shadow-2xs transition"
            >
              <Edit3 className="h-3.5 w-3.5 text-primary" />
              Edit Project
            </button>
          )}

          {!isClosed && canAdminClose && (
            <button
              type="button"
              onClick={() => setIsCloseModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition"
            >
              <Lock className="h-3.5 w-3.5" />
              Close Project
            </button>
          )}

          {isClosed && isAdmin && (
            <button
              type="button"
              onClick={handleReopen}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-surface-muted px-3.5 py-2 text-xs font-bold text-foreground shadow-2xs transition"
            >
              <RotateCcw className="h-3.5 w-3.5 text-primary" />
              Reopen Project
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2 text-rose-500 hover:bg-rose-500/20 transition"
              title="Delete project"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress & Closure Banner (if closed) */}
      {isClosed && (
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 space-y-1 text-xs text-purple-900 dark:text-purple-200">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>Project Formally Closed</span>
          </div>
          <p className="text-[11px] opacity-90">
            {project.closure_remarks || 'This project has been successfully completed and archived.'}
          </p>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('steps')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'steps'
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted hover:bg-surface-muted hover:text-foreground'
          }`}
        >
          <CheckSquare className="h-4 w-4" />
          <span>Action Steps</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              activeTab === 'steps' ? 'bg-white/20 text-white' : 'bg-surface-muted text-muted'
            }`}
          >
            {steps.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'chat'
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted hover:bg-surface-muted hover:text-foreground'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Live Chat Room</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'files'
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted hover:bg-surface-muted hover:text-foreground'
          }`}
        >
          <Files className="h-4 w-4" />
          <span>File Hub</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'team'
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted hover:bg-surface-muted hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Team & Overview</span>
        </button>
      </div>

      {/* Tab Views */}
      <div className="pt-2">
        {activeTab === 'steps' && (
          <ActionStepsTab
            projectId={project._id}
            steps={steps}
            token={token}
            canEdit={!isClosed && (isAdmin || isManager)}
            onStepsUpdated={(newSteps) => {
              setSteps(newSteps);
              // refresh overall project progress
              loadProject();
            }}
          />
        )}

        {activeTab === 'chat' && (
          <ProjectChatTab project={project} token={token} currentUser={user} />
        )}

        {activeTab === 'files' && (
          <ProjectFilesTab
            projectId={project._id}
            token={token}
            canEdit={!isClosed}
          />
        )}

        {activeTab === 'team' && (
          <ProjectTeamTab
            project={project}
            token={token}
            canEdit={!isClosed && isAdmin}
            onProjectUpdate={(updated) => setProject(updated)}
          />
        )}
      </div>

      {/* Edit Project Modal */}
      {isEditModalOpen && (
        <EditProjectModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          project={project}
          token={token}
          onUpdated={(updated) => {
            setProject(updated);
            loadProject();
          }}
        />
      )}

      {/* Close Project Modal */}
      {isCloseModalOpen && (
        <CloseProjectModal
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          project={{ ...project, steps }}
          token={token}
          onClosed={(updated) => {
            setProject(updated);
          }}
        />
      )}
    </div>
  );
}
