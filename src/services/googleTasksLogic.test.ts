import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOGLE_TASKS_SCOPES,
  buildLanguageStudyTaskSuggestions,
  classifyGoogleTasksApiError,
  filterAndSortGoogleTasks,
  fromGoogleTaskDueIso,
  normalizeGoogleTaskLists,
  normalizeGoogleTasks,
  toGoogleTaskDueIso,
  validateTaskDraft
} from './googleTasksLogic';
import { COMBINED_WORKSPACE_SCOPES } from './gmailLogic';

test('GOOGLE_TASKS_SCOPES are included in COMBINED_WORKSPACE_SCOPES without dropping existing scopes', () => {
  assert.ok(GOOGLE_TASKS_SCOPES.includes('https://www.googleapis.com/auth/tasks'));
  assert.ok(GOOGLE_TASKS_SCOPES.includes('https://www.googleapis.com/auth/tasks.readonly'));
  assert.ok(COMBINED_WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/tasks'));
  assert.ok(COMBINED_WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/tasks.readonly'));
  assert.ok(COMBINED_WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/gmail.readonly'));
  assert.ok(COMBINED_WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/chat.messages'));
});

test('validateTaskDraft enforces required title, max lengths, and YYYY-MM-DD due date format', () => {
  assert.equal(validateTaskDraft({ title: '   ' }).valid, false);
  assert.equal(validateTaskDraft({ title: 'a'.repeat(201) }).valid, false);
  assert.equal(validateTaskDraft({ title: 'Valid task', dueDate: '13-11-2026' }).valid, false);

  const ok = validateTaskDraft({
    title: '  Practice German Dative Verbs  ',
    notes: '  Focus on helfen and danken  ',
    dueDate: '2026-11-20'
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.normalized.title, 'Practice German Dative Verbs');
  assert.equal(ok.normalized.notes, 'Focus on helfen and danken');
  assert.equal(ok.normalized.dueDate, '2026-11-20');
});

test('due date ISO helpers round-trip cleanly between YYYY-MM-DD and Google Tasks RFC 3339', () => {
  assert.equal(toGoogleTaskDueIso('2026-11-20'), '2026-11-20T00:00:00.000Z');
  assert.equal(toGoogleTaskDueIso('invalid'), undefined);
  assert.equal(fromGoogleTaskDueIso('2026-11-20T00:00:00.000Z'), '2026-11-20');
  assert.equal(fromGoogleTaskDueIso(null), '');
});

test('normalizeGoogleTaskLists and normalizeGoogleTasks sanitize raw API responses and skip deleted/hidden items', () => {
  const lists = normalizeGoogleTaskLists([
    { id: 'list_1', title: 'My Tasks' },
    { id: 'list_2', title: 'LernWelt Study' },
    { title: 'missing_id' }
  ]);
  assert.equal(lists.length, 2);
  assert.equal(lists[1].title, 'LernWelt Study');

  const tasks = normalizeGoogleTasks(
    [
      { id: 't1', title: 'Read article', status: 'needsAction', due: '2026-11-18T00:00:00.000Z' },
      { id: 't2', title: 'Completed drill', status: 'completed', completed: '2026-11-12T10:00:00.000Z' },
      { id: 't3', title: 'Deleted task', deleted: true },
      { id: 't4', title: 'Hidden task', hidden: true }
    ],
    'list_1'
  );
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].dueDate, '2026-11-18');
  assert.equal(tasks[1].status, 'completed');
});

test('filterAndSortGoogleTasks orders active tasks with earliest due dates first and filters by status/search', () => {
  const tasks = normalizeGoogleTasks(
    [
      { id: '1', title: 'Completed item', status: 'completed', due: '2026-11-10T00:00:00.000Z' },
      { id: '2', title: 'Later due item', status: 'needsAction', due: '2026-11-25T00:00:00.000Z' },
      { id: '3', title: 'Soonest German drill', status: 'needsAction', due: '2026-11-15T00:00:00.000Z', notes: 'Cases' }
    ],
    'list_1'
  );

  const allSorted = filterAndSortGoogleTasks(tasks, 'all', '');
  assert.deepEqual(
    allSorted.map((t) => t.id),
    ['3', '2', '1']
  );

  const activeOnly = filterAndSortGoogleTasks(tasks, 'needsAction', 'german');
  assert.deepEqual(
    activeOnly.map((t) => t.id),
    ['3']
  );
});

test('classifyGoogleTasksApiError classifies 401, API disabled, insufficient scope, and 429 errors accurately', () => {
  assert.equal(classifyGoogleTasksApiError(401, 'Invalid Credentials').requiresReauth, true);
  const disabled = classifyGoogleTasksApiError(403, 'tasks.googleapis.com has not been used in project');
  assert.equal(disabled.kind, 'api_not_enabled');
  assert.ok(disabled.actionUrl?.includes('tasks.googleapis.com'));
  assert.equal(
    classifyGoogleTasksApiError(403, 'Request had insufficient authentication scopes.').kind,
    'insufficient_scopes'
  );
  assert.equal(classifyGoogleTasksApiError(429, 'Quota exceeded').kind, 'rate_limited');
});

test('buildLanguageStudyTaskSuggestions creates target-language study templates', () => {
  const suggestions = buildLanguageStudyTaskSuggestions('Spanish', 'B2');
  assert.equal(suggestions.length, 3);
  assert.ok(suggestions[0].title.includes('Spanish'));
  assert.ok(suggestions[0].title.includes('B2'));
});
