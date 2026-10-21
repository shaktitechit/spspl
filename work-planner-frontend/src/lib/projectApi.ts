/**
 * @fileoverview API Client methods for Project Management module.
 * @module lib/projectApi
 */
import { WORK_PLANNER_SERVICE_URL } from './env';
import type {
  Project,
  ProjectActionStep,
  ProjectMessage,
  ProjectFileItem,
  ActionStepStatus,
} from '../types/project';

import { refreshAccessToken, invalidateLocalSession, readSessionFromStorage } from '../utils/authStorage';

const BASE_URL = `${WORK_PLANNER_SERVICE_URL.replace(/\/+$/, '')}/api/projects`;

function authHeaders(token?: string | null, isJson = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch(
  url: string,
  init: RequestInit = {},
  explicitToken?: string | null,
  isJson = true
): Promise<Response> {
  let activeToken = explicitToken || readSessionFromStorage()?.token || null;
  const buildHeaders = (tok: string | null) => {
    const h = authHeaders(tok, isJson);
    return { ...h, ...(init.headers as Record<string, string> || {}) };
  };

  let res = await fetch(url, { ...init, headers: buildHeaders(activeToken) });
  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (ok) {
      activeToken = readSessionFromStorage()?.token || null;
      res = await fetch(url, { ...init, headers: buildHeaders(activeToken) });
    } else {
      invalidateLocalSession("/");
    }
  }
  return res;
}

// -------------------------------------------------------------
// Projects API
// -------------------------------------------------------------

export async function fetchProjects(
  token: string | null,
  params: { status?: string; priority?: string; search?: string; page?: number; limit?: number } = {}
): Promise<{ items: Project[]; pagination: any }> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const res = await apiFetch(`${BASE_URL}?${query.toString()}`, {}, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch projects');
  return { items: data.items || [], pagination: data.pagination || {} };
}

export async function fetchProjectById(token: string | null, id: string): Promise<Project> {
  const res = await apiFetch(`${BASE_URL}/${id}`, {}, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch project');
  return data.data;
}

export async function createProject(
  token: string | null,
  payload: Omit<Partial<Project>, 'steps'> & { steps?: any[] }
): Promise<Project> {
  const res = await apiFetch(BASE_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create project');
  return data.data;
}

export async function updateProject(token: string | null, id: string, payload: Partial<Project>): Promise<Project> {
  const res = await apiFetch(`${BASE_URL}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update project');
  return data.data;
}

export async function closeProject(
  token: string | null,
  id: string,
  closureRemarks: string
): Promise<Project> {
  const res = await apiFetch(`${BASE_URL}/${id}/close`, {
    method: 'POST',
    body: JSON.stringify({ remarks: closureRemarks }),
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to close project');
  return data.data;
}

export async function reopenProject(token: string | null, id: string): Promise<Project> {
  const res = await apiFetch(`${BASE_URL}/${id}/reopen`, {
    method: 'POST',
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to reopen project');
  return data.data;
}

export async function deleteProject(token: string | null, id: string): Promise<void> {
  const res = await apiFetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to delete project');
}

export async function fetchEligibleMembers(
  token: string | null
): Promise<{ users: Array<{ _id: string; name: string; email: string; department?: string }>; teams: string[] }> {
  const res = await apiFetch(`${BASE_URL}/eligible-members`, {}, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch eligible members');
  return data.data || { users: [], teams: [] };
}

export async function addProjectMember(
  token: string | null,
  projectId: string,
  payload: { user_id?: string; user_ids?: string[]; role?: string }
): Promise<Project> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to add project member');
  return data.data;
}

export async function updateProjectMemberRole(
  token: string | null,
  projectId: string,
  userId: string,
  role: string
): Promise<Project> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update member role');
  return data.data;
}

export async function removeProjectMember(
  token: string | null,
  projectId: string,
  userId: string
): Promise<Project> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/members/${userId}`, {
    method: 'DELETE',
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to remove member');
  return data.data;
}

export async function assignProjectTeams(
  token: string | null,
  projectId: string,
  teamNames: string[] | string,
  autoEnroll = true
): Promise<Project> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/teams`, {
    method: 'POST',
    body: JSON.stringify({
      team_names: Array.isArray(teamNames) ? teamNames : [teamNames],
      auto_enroll: autoEnroll,
    }),
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to assign teams');
  return data.data;
}

export async function removeProjectTeam(
  token: string | null,
  projectId: string,
  teamName: string
): Promise<Project> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/teams/${encodeURIComponent(teamName)}`, {
    method: 'DELETE',
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to remove team');
  return data.data;
}

// -------------------------------------------------------------
// Action Steps API
// -------------------------------------------------------------

export async function fetchProjectSteps(token: string | null, projectId: string): Promise<ProjectActionStep[]> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/steps`, {}, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch action steps');
  return data.data || [];
}

export async function createProjectStep(
  token: string | null,
  projectId: string,
  payload: Partial<ProjectActionStep>
): Promise<ProjectActionStep> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/steps`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create action step');
  return data.data;
}

export async function updateProjectStep(
  token: string | null,
  projectId: string,
  stepId: string,
  payload: Partial<ProjectActionStep>
): Promise<ProjectActionStep> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/steps/${stepId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update action step');
  return data.data;
}

export async function updateStepStatus(
  token: string | null,
  projectId: string,
  stepId: string,
  status: ActionStepStatus,
  remark?: string
): Promise<ProjectActionStep> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/steps/${stepId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, remark }),
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update step status');
  return data.data;
}

export async function toggleChecklistItem(
  token: string | null,
  projectId: string,
  stepId: string,
  checklistItemId: string,
  isCompleted: boolean
): Promise<ProjectActionStep> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/steps/${stepId}/checklist/${checklistItemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_completed: isCompleted }),
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update checklist item');
  return data.data;
}

export async function deleteProjectStep(token: string | null, projectId: string, stepId: string): Promise<void> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/steps/${stepId}`, {
    method: 'DELETE',
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to delete action step');
}

export async function addWorkflowAction(
  token: string | null,
  projectId: string,
  stepId: string,
  payload: { title: string; description?: string; assigned_to_user_id?: string; remarks?: string; status?: string }
): Promise<ProjectActionStep> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/steps/${stepId}/actions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to add workflow action');
  return data.data;
}

export async function updateWorkflowAction(
  token: string | null,
  projectId: string,
  stepId: string,
  actionId: string,
  payload: { status?: string; remarks?: string; title?: string; description?: string; assigned_to_user_id?: string }
): Promise<ProjectActionStep> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/steps/${stepId}/actions/${actionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update workflow action');
  return data.data;
}

export async function deleteWorkflowAction(
  token: string | null,
  projectId: string,
  stepId: string,
  actionId: string
): Promise<ProjectActionStep> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/steps/${stepId}/actions/${actionId}`, {
    method: 'DELETE',
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to delete workflow action');
  return data.data;
}

// -------------------------------------------------------------
// Chat Messages API
// -------------------------------------------------------------

export async function fetchProjectMessages(
  token: string | null,
  projectId: string,
  params: { action_step_id?: string; page?: number; limit?: number } = {}
): Promise<{ items: ProjectMessage[]; pagination: any }> {
  const query = new URLSearchParams();
  if (params.action_step_id) query.set('action_step_id', params.action_step_id);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const res = await apiFetch(`${BASE_URL}/${projectId}/messages?${query.toString()}`, {}, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch chat messages');
  return { items: data.items || [], pagination: data.pagination || {} };
}

export async function postProjectMessage(
  token: string | null,
  projectId: string,
  payload: { content: string; attachments?: any[]; mentions?: string[]; action_step_id?: string | null }
): Promise<ProjectMessage> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to send message');
  return data.data;
}

export async function togglePinMessage(token: string | null, projectId: string, messageId: string): Promise<ProjectMessage> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/messages/${messageId}/pin`, {
    method: 'POST',
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to toggle pin');
  return data.data;
}

// -------------------------------------------------------------
// Files Hub API
// -------------------------------------------------------------

export async function fetchProjectFiles(
  token: string | null,
  projectId: string,
  params: { folder?: string; action_step_id?: string } = {}
): Promise<ProjectFileItem[]> {
  const query = new URLSearchParams();
  if (params.folder) query.set('folder', params.folder);
  if (params.action_step_id) query.set('action_step_id', params.action_step_id);

  const res = await apiFetch(`${BASE_URL}/${projectId}/files?${query.toString()}`, {}, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch files');
  return data.data || [];
}

export async function uploadProjectFile(
  token: string | null,
  projectId: string,
  file: File,
  folder = 'General',
  action_step_id?: string | null
): Promise<{ fileRecord: ProjectFileItem; attachment: any }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  if (action_step_id) formData.append('action_step_id', action_step_id);

  const res = await apiFetch(`${BASE_URL}/${projectId}/files/upload`, {
    method: 'POST',
    body: formData,
  }, token, false);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to upload file');
  return { fileRecord: data.data, attachment: data.attachment };
}

export async function deleteProjectFile(token: string | null, projectId: string, fileId: string): Promise<void> {
  const res = await apiFetch(`${BASE_URL}/${projectId}/files/${fileId}`, {
    method: 'DELETE',
  }, token);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to delete file');
}

/**
 * Returns a backend-proxied URL to stream/preview files using backend credentials.
 * Avoids direct MinIO "Access Denied" issues.
 */
export function getProjectAttachmentPreviewUrl(attachmentIdOrUrl?: string | null, token?: string | null): string {
  if (!attachmentIdOrUrl) return '';
  const raw = String(attachmentIdOrUrl).trim();
  const match = raw.match(/(?:attachments|files)\/([a-zA-Z0-9._-]+)/i);
  const cleanId = match ? match[1] : raw;
  const base = `${WORK_PLANNER_SERVICE_URL.replace(/\/+$/, '')}/api/projects/attachments/${cleanId}/preview`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

/**
 * Returns a backend-proxied download URL.
 */
export function getProjectAttachmentDownloadUrl(attachmentIdOrUrl?: string | null, token?: string | null): string {
  if (!attachmentIdOrUrl) return '';
  const raw = String(attachmentIdOrUrl).trim();
  const match = raw.match(/(?:attachments|files)\/([a-zA-Z0-9._-]+)/i);
  const cleanId = match ? match[1] : raw;
  const base = `${WORK_PLANNER_SERVICE_URL.replace(/\/+$/, '')}/api/projects/attachments/${cleanId}/download`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

