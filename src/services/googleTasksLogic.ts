export const GOOGLE_TASKS_SCOPES: readonly string[] = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/tasks.readonly'
] as const;

export const GOOGLE_TASKS_CONSOLE_API_URL =
  'https://console.cloud.google.com/apis/library/tasks.googleapis.com';

export interface GoogleTaskListItem {
  id: string;
  title: string;
  updated?: string;
}

export interface GoogleTaskItem {
  id: string;
  taskListId: string;
  title: string;
  notes: string;
  status: 'needsAction' | 'completed';
  dueDate: string; // YYYY-MM-DD or ''
  updated?: string;
  completedAt?: string;
  webViewLink?: string;
}

export interface TaskDraftInput {
  title: string;
  notes?: string;
  dueDate?: string;
}

export type GoogleTasksErrorKind =
  | 'token_expired'
  | 'api_not_enabled'
  | 'insufficient_scopes'
  | 'not_found'
  | 'rate_limited'
  | 'network_error'
  | 'unknown';

export interface ClassifiedTasksError {
  kind: GoogleTasksErrorKind;
  title: string;
  message: string;
  requiresReauth: boolean;
  actionUrl?: string;
}

export interface StudyTaskSuggestion {
  title: string;
  notes: string;
  targetLanguage: string;
}

export function fromGoogleTaskDueIso(dueIso?: string | null): string {
  if (!dueIso || typeof dueIso !== 'string') return '';
  const match = dueIso.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

export function toGoogleTaskDueIso(dateStr?: string | null): string | undefined {
  const trimmed = (dateStr || '').trim();
  if (!trimmed) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  return `${trimmed}T00:00:00.000Z`;
}

export function validateTaskDraft(draft: TaskDraftInput): {
  valid: boolean;
  error?: string;
  normalized: { title: string; notes: string; dueDate: string };
} {
  const title = (draft.title || '').trim();
  const notes = (draft.notes || '').trim();
  const dueDate = (draft.dueDate || '').trim();

  if (!title) {
    return {
      valid: false,
      error: 'Task title is required.',
      normalized: { title: '', notes, dueDate }
    };
  }
  if (title.length > 200) {
    return {
      valid: false,
      error: 'Task title must be 200 characters or fewer.',
      normalized: { title, notes, dueDate }
    };
  }
  if (notes.length > 2000) {
    return {
      valid: false,
      error: 'Task notes must be 2000 characters or fewer.',
      normalized: { title, notes, dueDate }
    };
  }
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return {
      valid: false,
      error: 'Due date must be formatted as YYYY-MM-DD.',
      normalized: { title, notes, dueDate }
    };
  }

  return {
    valid: true,
    normalized: { title, notes, dueDate }
  };
}

export function normalizeGoogleTaskLists(rawItems: any[]): GoogleTaskListItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .filter((item) => item && typeof item.id === 'string')
    .map((item) => ({
      id: item.id,
      title: String(item.title || 'Untitled List'),
      updated: typeof item.updated === 'string' ? item.updated : undefined
    }));
}

export function normalizeGoogleTasks(rawItems: any[], taskListId: string): GoogleTaskItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .filter((item) => item && typeof item.id === 'string' && !item.deleted && !item.hidden)
    .map((item) => ({
      id: item.id,
      taskListId,
      title: String(item.title || '').trim() || '(Untitled task)',
      notes: typeof item.notes === 'string' ? item.notes : '',
      status: item.status === 'completed' ? 'completed' : 'needsAction',
      dueDate: fromGoogleTaskDueIso(item.due),
      updated: typeof item.updated === 'string' ? item.updated : undefined,
      completedAt: typeof item.completed === 'string' ? item.completed : undefined,
      webViewLink: typeof item.webViewLink === 'string' ? item.webViewLink : undefined
    }));
}

export function filterAndSortGoogleTasks(
  tasks: GoogleTaskItem[],
  statusFilter: 'all' | 'needsAction' | 'completed',
  searchQuery: string
): GoogleTaskItem[] {
  const q = (searchQuery || '').trim().toLowerCase();
  const filtered = tasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (!q) return true;
    return (
      task.title.toLowerCase().includes(q) ||
      task.notes.toLowerCase().includes(q)
    );
  });

  return filtered.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'needsAction' ? -1 : 1;
    }
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return (b.updated || '').localeCompare(a.updated || '');
  });
}

export function classifyGoogleTasksApiError(
  status: number,
  rawErrorText: string
): ClassifiedTasksError {
  const lower = (rawErrorText || '').toLowerCase();

  if (status === 401) {
    return {
      kind: 'token_expired',
      title: 'Google Session Expired',
      message: 'Your Google access token has expired. Please sign in with Google again to continue.',
      requiresReauth: true
    };
  }

  if (
    status === 403 &&
    (lower.includes('tasks.googleapis.com') ||
      lower.includes('accessnotconfigured') ||
      lower.includes('has not been used in project') ||
      lower.includes('is disabled'))
  ) {
    return {
      kind: 'api_not_enabled',
      title: 'Google Tasks API Not Enabled',
      message:
        'Enable the Google Tasks API in your Google Cloud project to manage tasks.',
      requiresReauth: false,
      actionUrl: GOOGLE_TASKS_CONSOLE_API_URL
    };
  }

  if (
    status === 403 &&
    (lower.includes('insufficient') || lower.includes('scope') || lower.includes('permission'))
  ) {
    return {
      kind: 'insufficient_scopes',
      title: 'Google Tasks Permission Needed',
      message:
        'Please sign in with Google again and grant access to view and manage your Google Tasks.',
      requiresReauth: true
    };
  }

  if (status === 404) {
    return {
      kind: 'not_found',
      title: 'Task or List Not Found',
      message: 'The selected Google Task or Task List could not be found.',
      requiresReauth: false
    };
  }

  if (status === 429) {
    return {
      kind: 'rate_limited',
      title: 'Google Tasks Rate Limit Reached',
      message: 'Too many requests to Google Tasks. Please wait a moment and try again.',
      requiresReauth: false
    };
  }

  return {
    kind: 'unknown',
    title: 'Google Tasks Request Failed',
    message: rawErrorText || 'Unable to complete the Google Tasks request.',
    requiresReauth: false
  };
}

export function buildLanguageStudyTaskSuggestions(
  languageName: string,
  cefrLevel: string = 'B1'
): StudyTaskSuggestion[] {
  return [
    {
      title: `Complete 5 ${languageName} AI Drills (${cefrLevel})`,
      notes: `Practice fill-in-the-blank, word order, and vocabulary drills in ${languageName} on LernWelt.`,
      targetLanguage: languageName
    },
    {
      title: `Review 15 ${languageName} Vocab Flashcards`,
      notes: `Revisit saved ${languageName} expressions and mark mastered words in your Vocab Bank.`,
      targetLanguage: languageName
    },
    {
      title: `Join a 15-min ${languageName} Speaking Session`,
      notes: `Practice live conversation in a ${languageName} chat room or with a Personal Teacher.`,
      targetLanguage: languageName
    }
  ];
}
