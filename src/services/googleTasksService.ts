import {
  getWorkspaceAccessToken,
  getWorkspaceIdToken,
  invalidateWorkspaceAccessToken,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
  subscribeWorkspaceAuth
} from './googleWorkspaceAuth';
import {
  ClassifiedTasksError,
  GoogleTaskItem,
  GoogleTaskListItem,
  classifyGoogleTasksApiError,
  normalizeGoogleTaskLists,
  normalizeGoogleTasks,
  toGoogleTaskDueIso
} from './googleTasksLogic';

const TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1';

export class GoogleTasksApiException extends Error {
  classified: ClassifiedTasksError;

  constructor(classified: ClassifiedTasksError) {
    super(classified.message);
    this.name = 'GoogleTasksApiException';
    this.classified = classified;
  }
}

export interface CloudStudyTaskRecord {
  id: number;
  userId: number;
  googleTaskId: string | null;
  googleTaskListId: string | null;
  title: string;
  notes: string | null;
  targetLanguage: string | null;
  dueDate: string | null;
  status: string;
  syncedToGoogle: boolean;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export const initTasksAuth = subscribeWorkspaceAuth;
export const signInToTasks = signInWithGoogleWorkspace;
export const signOutFromTasks = signOutGoogleWorkspace;
export const getTasksAccessToken = getWorkspaceAccessToken;

async function tasksFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new GoogleTasksApiException({
      kind: 'token_expired',
      title: 'Google Sign-In Required',
      message: 'Please sign in with Google to access your Google Tasks.',
      requiresReauth: true
    });
  }

  let response: Response;
  try {
    response = await fetch(`${TASKS_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {})
      }
    });
  } catch (err: any) {
    throw new GoogleTasksApiException({
      kind: 'network_error',
      title: 'Network Error',
      message: err?.message || 'Unable to connect to Google Tasks.',
      requiresReauth: false
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const rawMsg = parsed?.error?.message || text || `HTTP ${response.status}`;
    if (response.status === 401) {
      invalidateWorkspaceAccessToken();
    }
    throw new GoogleTasksApiException(classifyGoogleTasksApiError(response.status, rawMsg));
  }

  return parsed as T;
}

export async function listGoogleTaskLists(): Promise<GoogleTaskListItem[]> {
  const data = await tasksFetch<{ items?: any[] }>('/users/@me/lists?maxResults=50');
  return normalizeGoogleTaskLists(data?.items || []);
}

export async function createGoogleTaskList(title: string): Promise<GoogleTaskListItem> {
  const data = await tasksFetch<any>('/users/@me/lists', {
    method: 'POST',
    body: JSON.stringify({ title })
  });
  return {
    id: String(data.id),
    title: String(data.title || title),
    updated: data.updated
  };
}

export async function renameGoogleTaskList(
  taskListId: string,
  title: string
): Promise<GoogleTaskListItem> {
  const data = await tasksFetch<any>(`/users/@me/lists/${encodeURIComponent(taskListId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ id: taskListId, title })
  });
  return {
    id: String(data.id),
    title: String(data.title || title),
    updated: data.updated
  };
}

export async function deleteGoogleTaskList(taskListId: string): Promise<void> {
  await tasksFetch(`/users/@me/lists/${encodeURIComponent(taskListId)}`, {
    method: 'DELETE'
  });
}

export async function listGoogleTasks(taskListId: string): Promise<GoogleTaskItem[]> {
  const data = await tasksFetch<{ items?: any[] }>(
    `/lists/${encodeURIComponent(taskListId)}/tasks?showCompleted=true&showHidden=false&maxResults=100`
  );
  return normalizeGoogleTasks(data?.items || [], taskListId);
}

export async function createGoogleTask(
  taskListId: string,
  input: { title: string; notes?: string; dueDate?: string }
): Promise<GoogleTaskItem> {
  const body: Record<string, any> = {
    title: input.title,
    status: 'needsAction'
  };
  if (input.notes) body.notes = input.notes;
  const dueIso = toGoogleTaskDueIso(input.dueDate);
  if (dueIso) body.due = dueIso;

  const data = await tasksFetch<any>(`/lists/${encodeURIComponent(taskListId)}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body)
  });

  return normalizeGoogleTasks([data], taskListId)[0];
}

export async function updateGoogleTask(
  taskListId: string,
  taskId: string,
  patch: {
    title?: string;
    notes?: string;
    dueDate?: string;
    status?: 'needsAction' | 'completed';
  }
): Promise<GoogleTaskItem> {
  const body: Record<string, any> = { id: taskId };
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.notes !== undefined) body.notes = patch.notes;
  if (patch.status !== undefined) {
    body.status = patch.status;
    if (patch.status === 'needsAction') {
      body.completed = null;
    }
  }
  if (patch.dueDate !== undefined) {
    body.due = patch.dueDate ? toGoogleTaskDueIso(patch.dueDate) : null;
  }

  const data = await tasksFetch<any>(
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body)
    }
  );

  return normalizeGoogleTasks([data], taskListId)[0];
}

export async function deleteGoogleTask(taskListId: string, taskId: string): Promise<void> {
  await tasksFetch(
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'DELETE' }
  );
}

// =========================================================================
// Authenticated Study Task Sync (PostgreSQL / Cloud SQL via Firebase ID Token)
// =========================================================================

async function authedBackendFetch<T = any>(url: string, init: RequestInit = {}): Promise<T | null> {
  const idToken = await getWorkspaceIdToken();
  if (!idToken) return null;

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(errBody || `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export async function fetchCloudStudyTasks(): Promise<CloudStudyTaskRecord[]> {
  try {
    const data = await authedBackendFetch<{ tasks?: CloudStudyTaskRecord[] }>('/api/study-tasks');
    return Array.isArray(data?.tasks) ? data.tasks : [];
  } catch {
    return [];
  }
}

export async function saveCloudStudyTask(payload: {
  googleTaskId?: string | null;
  googleTaskListId?: string | null;
  title: string;
  notes?: string;
  targetLanguage?: string;
  dueDate?: string;
  status?: 'needsAction' | 'completed';
  syncedToGoogle?: boolean;
}): Promise<CloudStudyTaskRecord | null> {
  try {
    const data = await authedBackendFetch<{ task?: CloudStudyTaskRecord }>('/api/study-tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return data?.task || null;
  } catch {
    return null;
  }
}

export async function updateCloudStudyTask(
  id: number,
  patch: {
    title?: string;
    notes?: string | null;
    targetLanguage?: string | null;
    dueDate?: string | null;
    status?: 'needsAction' | 'completed';
    googleTaskId?: string | null;
    googleTaskListId?: string | null;
    syncedToGoogle?: boolean;
  }
): Promise<CloudStudyTaskRecord | null> {
  try {
    const data = await authedBackendFetch<{ task?: CloudStudyTaskRecord }>(
      `/api/study-tasks/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch)
      }
    );
    return data?.task || null;
  } catch {
    return null;
  }
}

export async function deleteCloudStudyTask(id: number): Promise<boolean> {
  try {
    await authedBackendFetch(`/api/study-tasks/${id}`, { method: 'DELETE' });
    return true;
  } catch {
    return false;
  }
}
