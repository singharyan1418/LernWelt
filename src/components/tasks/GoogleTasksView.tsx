import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Circle,
  Edit3,
  ExternalLink,
  FolderPlus,
  ListTodo,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import { LanguageInfo, UserProfile } from '../../types';
import { OfficialGoogleSignInButton } from '../common/OfficialGoogleSignInButton';
import {
  ClassifiedTasksError,
  GoogleTaskItem,
  GoogleTaskListItem,
  buildLanguageStudyTaskSuggestions,
  filterAndSortGoogleTasks,
  validateTaskDraft
} from '../../services/googleTasksLogic';
import {
  CloudStudyTaskRecord,
  GoogleTasksApiException,
  createGoogleTask,
  createGoogleTaskList,
  deleteCloudStudyTask,
  deleteGoogleTask,
  deleteGoogleTaskList,
  fetchCloudStudyTasks,
  getTasksAccessToken,
  initTasksAuth,
  listGoogleTaskLists,
  listGoogleTasks,
  renameGoogleTaskList,
  saveCloudStudyTask,
  signInToTasks,
  signOutFromTasks,
  updateCloudStudyTask,
  updateGoogleTask
} from '../../services/googleTasksService';
import { localizeLanguageName, t } from '../../services/uiLocalization';

interface GoogleTasksViewProps {
  userProfile: UserProfile;
  selectedLanguage: LanguageInfo;
}

type PendingTaskMutation =
  | {
      type: 'toggle_task';
      task: GoogleTaskItem;
      nextStatus: 'needsAction' | 'completed';
    }
  | {
      type: 'update_task';
      task: GoogleTaskItem;
      title: string;
      notes: string;
      dueDate: string;
    }
  | {
      type: 'delete_task';
      task: GoogleTaskItem;
    }
  | {
      type: 'rename_list';
      list: GoogleTaskListItem;
      nextTitle: string;
    }
  | {
      type: 'delete_list';
      list: GoogleTaskListItem;
    };

export const GoogleTasksView: React.FC<GoogleTasksViewProps> = ({
  userProfile,
  selectedLanguage
}) => {
  const uiLang = userProfile.nativeLanguage || 'English';
  const localizedTarget = localizeLanguageName(selectedLanguage.name, uiLang);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => getTasksAccessToken());
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [taskLists, setTaskLists] = useState<GoogleTaskListItem[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [tasks, setTasks] = useState<GoogleTaskItem[]>([]);
  const [cloudTasks, setCloudTasks] = useState<CloudStudyTaskRecord[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState<boolean>(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);
  const [apiError, setApiError] = useState<ClassifiedTasksError | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | 'needsAction' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create new task form
  const [newTitle, setNewTitle] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);

  // Create / rename task list
  const [isAddingList, setIsAddingList] = useState<boolean>(false);
  const [newListTitle, setNewListTitle] = useState<string>('');
  const [isRenamingList, setIsRenamingList] = useState<boolean>(false);
  const [renameListTitle, setRenameListTitle] = useState<string>('');

  // Edit task state
  const [editingTask, setEditingTask] = useState<GoogleTaskItem | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');

  // Explicit confirmation dialog for all modifying / destructive operations
  const [pendingMutation, setPendingMutation] = useState<PendingTaskMutation | null>(null);
  const [isApplyingMutation, setIsApplyingMutation] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = initTasksAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        setNeedsAuth(false);
        setAuthError(null);
      },
      (user) => {
        setGoogleUser(user);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return unsubscribe;
  }, []);

  const loadTasksForList = useCallback(async (listId: string) => {
    if (!listId) return;
    setIsLoadingTasks(true);
    setApiError(null);
    try {
      const items = await listGoogleTasks(listId);
      setTasks(items);
    } catch (err: any) {
      if (err instanceof GoogleTasksApiException) {
        setApiError(err.classified);
        if (err.classified.requiresReauth) setNeedsAuth(true);
      } else {
        setApiError({
          kind: 'unknown',
          title: 'Failed to Load Tasks',
          message: err?.message || 'Unable to load Google Tasks.',
          requiresReauth: false
        });
      }
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    if (!getTasksAccessToken()) {
      setNeedsAuth(true);
      return;
    }
    setIsLoadingLists(true);
    setApiError(null);
    try {
      const [lists, persisted] = await Promise.all([
        listGoogleTaskLists(),
        fetchCloudStudyTasks()
      ]);
      setTaskLists(lists);
      setCloudTasks(persisted);
      const nextListId =
        lists.find((l) => l.id === selectedListId)?.id || lists[0]?.id || '';
      setSelectedListId(nextListId);
      if (nextListId) {
        await loadTasksForList(nextListId);
      } else {
        setTasks([]);
      }
    } catch (err: any) {
      if (err instanceof GoogleTasksApiException) {
        setApiError(err.classified);
        if (err.classified.requiresReauth) setNeedsAuth(true);
      } else {
        setApiError({
          kind: 'unknown',
          title: 'Failed to Connect Google Tasks',
          message: err?.message || 'Unable to load Google Task Lists.',
          requiresReauth: false
        });
      }
    } finally {
      setIsLoadingLists(false);
    }
  }, [loadTasksForList, selectedListId]);

  useEffect(() => {
    if (accessToken && !needsAuth) {
      loadWorkspaceData();
    }
  }, [accessToken, needsAuth]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    setApiError(null);
    try {
      const result = await signInToTasks();
      setGoogleUser(result.user);
      setAccessToken(result.accessToken);
      setNeedsAuth(false);
      setStatusBanner(`Connected to Google Tasks (${result.user.email || 'Google Account'}).`);
    } catch (err: any) {
      setAuthError(err?.message || 'Google Sign-In was cancelled or failed.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutFromTasks();
    setAccessToken(null);
    setGoogleUser(null);
    setNeedsAuth(true);
    setTaskLists([]);
    setTasks([]);
    setSelectedListId('');
    setStatusBanner('Disconnected from Google Tasks.');
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const validation = validateTaskDraft({
      title: newTitle,
      notes: newNotes,
      dueDate: newDueDate
    });
    if (!validation.valid) {
      setFormError(validation.error || 'Please enter a valid task.');
      return;
    }
    if (!selectedListId) {
      setFormError('Please create or select a Task List first.');
      return;
    }

    setIsCreatingTask(true);
    setApiError(null);
    try {
      const created = await createGoogleTask(selectedListId, validation.normalized);
      setTasks((prev) => [created, ...prev]);
      const savedCloud = await saveCloudStudyTask({
        googleTaskId: created.id,
        googleTaskListId: selectedListId,
        title: created.title,
        notes: created.notes,
        targetLanguage: selectedLanguage.name,
        dueDate: created.dueDate,
        status: created.status,
        syncedToGoogle: true
      });
      if (savedCloud) {
        setCloudTasks((prev) => [savedCloud, ...prev]);
      }
      setNewTitle('');
      setNewNotes('');
      setNewDueDate('');
      setStatusBanner(`Added "${created.title}" to Google Tasks.`);
    } catch (err: any) {
      if (err instanceof GoogleTasksApiException) {
        setApiError(err.classified);
        if (err.classified.requiresReauth) setNeedsAuth(true);
      } else {
        setFormError(err?.message || 'Failed to add task.');
      }
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleUseStudySuggestion = (suggestion: { title: string; notes: string }) => {
    setNewTitle(suggestion.title);
    setNewNotes(suggestion.notes);
    setFormError(null);
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newListTitle.trim();
    if (!trimmed) return;
    try {
      const created = await createGoogleTaskList(trimmed);
      setTaskLists((prev) => [...prev, created]);
      setSelectedListId(created.id);
      setTasks([]);
      setNewListTitle('');
      setIsAddingList(false);
      setStatusBanner(`Created task list "${created.title}".`);
    } catch (err: any) {
      if (err instanceof GoogleTasksApiException) {
        setApiError(err.classified);
      }
    }
  };

  const handleConfirmMutation = async () => {
    if (!pendingMutation) return;
    setIsApplyingMutation(true);
    setApiError(null);
    try {
      if (pendingMutation.type === 'toggle_task') {
        const { task, nextStatus } = pendingMutation;
        const updated = await updateGoogleTask(task.taskListId, task.id, {
          status: nextStatus
        });
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        const cloudMatch = cloudTasks.find((c) => c.googleTaskId === task.id);
        if (cloudMatch) {
          const updatedCloud = await updateCloudStudyTask(cloudMatch.id, { status: nextStatus });
          if (updatedCloud) {
            setCloudTasks((prev) => prev.map((c) => (c.id === updatedCloud.id ? updatedCloud : c)));
          }
        }
        setStatusBanner(
          nextStatus === 'completed'
            ? `Marked "${task.title}" as completed in Google Tasks.`
            : `Reopened "${task.title}" in Google Tasks.`
        );
      } else if (pendingMutation.type === 'update_task') {
        const { task, title, notes, dueDate } = pendingMutation;
        const updated = await updateGoogleTask(task.taskListId, task.id, {
          title,
          notes,
          dueDate
        });
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        const cloudMatch = cloudTasks.find((c) => c.googleTaskId === task.id);
        if (cloudMatch) {
          const updatedCloud = await updateCloudStudyTask(cloudMatch.id, {
            title,
            notes,
            dueDate: dueDate || null
          });
          if (updatedCloud) {
            setCloudTasks((prev) => prev.map((c) => (c.id === updatedCloud.id ? updatedCloud : c)));
          }
        }
        setEditingTask(null);
        setStatusBanner(`Updated "${updated.title}" in Google Tasks.`);
      } else if (pendingMutation.type === 'delete_task') {
        const { task } = pendingMutation;
        await deleteGoogleTask(task.taskListId, task.id);
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        const cloudMatch = cloudTasks.find((c) => c.googleTaskId === task.id);
        if (cloudMatch) {
          await deleteCloudStudyTask(cloudMatch.id);
          setCloudTasks((prev) => prev.filter((c) => c.id !== cloudMatch.id));
        }
        setStatusBanner(`Deleted "${task.title}" from Google Tasks.`);
      } else if (pendingMutation.type === 'rename_list') {
        const { list, nextTitle } = pendingMutation;
        const renamed = await renameGoogleTaskList(list.id, nextTitle);
        setTaskLists((prev) => prev.map((l) => (l.id === renamed.id ? renamed : l)));
        setIsRenamingList(false);
        setStatusBanner(`Renamed task list to "${renamed.title}".`);
      } else if (pendingMutation.type === 'delete_list') {
        const { list } = pendingMutation;
        await deleteGoogleTaskList(list.id);
        const remaining = taskLists.filter((l) => l.id !== list.id);
        setTaskLists(remaining);
        const nextId = remaining[0]?.id || '';
        setSelectedListId(nextId);
        if (nextId) {
          await loadTasksForList(nextId);
        } else {
          setTasks([]);
        }
        setStatusBanner(`Deleted task list "${list.title}".`);
      }
      setPendingMutation(null);
    } catch (err: any) {
      if (err instanceof GoogleTasksApiException) {
        setApiError(err.classified);
        if (err.classified.requiresReauth) setNeedsAuth(true);
      } else {
        setApiError({
          kind: 'unknown',
          title: 'Action Failed',
          message: err?.message || 'Unable to update Google Tasks.',
          requiresReauth: false
        });
      }
      setPendingMutation(null);
    } finally {
      setIsApplyingMutation(false);
    }
  };

  const visibleTasks = useMemo(
    () => filterAndSortGoogleTasks(tasks, statusFilter, searchQuery),
    [tasks, statusFilter, searchQuery]
  );

  const selectedList = useMemo(
    () => taskLists.find((l) => l.id === selectedListId) || null,
    [taskLists, selectedListId]
  );

  const currentCefr =
    userProfile.targetLanguages.find(
      (t) => t.language.toLowerCase() === selectedLanguage.name.toLowerCase()
    )?.level || 'B1';

  const studySuggestions = useMemo(
    () => buildLanguageStudyTaskSuggestions(selectedLanguage.name, currentCefr),
    [selectedLanguage.name, currentCefr]
  );

  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === 'completed').length,
    [tasks]
  );

  const getMutationDialogCopy = (mutation: PendingTaskMutation) => {
    switch (mutation.type) {
      case 'toggle_task':
        return {
          title:
            mutation.nextStatus === 'completed'
              ? 'Mark Task as Completed?'
              : 'Reopen Completed Task?',
          description:
            mutation.nextStatus === 'completed'
              ? `Update "${mutation.task.title}" to completed in your Google Tasks list?`
              : `Mark "${mutation.task.title}" as active again in your Google Tasks list?`,
          confirmLabel: mutation.nextStatus === 'completed' ? 'Mark Completed' : 'Reopen Task',
          isDestructive: false
        };
      case 'update_task':
        return {
          title: 'Save Changes to Google Task?',
          description: `Update "${mutation.task.title}" in your Google Tasks list with your edited title, notes, and due date?`,
          confirmLabel: 'Confirm Update',
          isDestructive: false
        };
      case 'delete_task':
        return {
          title: 'Delete Google Task?',
          description: `Permanently delete "${mutation.task.title}" from your Google Tasks list? This action cannot be undone.`,
          confirmLabel: 'Delete Task',
          isDestructive: true
        };
      case 'rename_list':
        return {
          title: 'Rename Google Task List?',
          description: `Rename task list "${mutation.list.title}" to "${mutation.nextTitle}" in Google Tasks?`,
          confirmLabel: 'Confirm Rename',
          isDestructive: false
        };
      case 'delete_list':
        return {
          title: 'Delete Google Task List?',
          description: `Permanently delete the task list "${mutation.list.title}" and all tasks inside it? This action cannot be undone.`,
          confirmLabel: 'Delete List',
          isDestructive: true
        };
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header Card */}
      <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 sm:p-7 shadow-xs dark:shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-[#6485F5]/15 border border-indigo-200 dark:border-[#6485F5]/30 flex items-center justify-center shrink-0">
                <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-[#6485F5]" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
                  {t('tasks.title', uiLang, { lang: localizedTarget })}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9BA6B2]">
                  {t('tasks.subtitle', uiLang, { lang: localizedTarget })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {accessToken && !needsAuth ? (
              <>
                <button
                  type="button"
                  onClick={loadWorkspaceData}
                  disabled={isLoadingLists || isLoadingTasks}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-300 dark:border-[#293342] text-xs font-semibold text-slate-800 dark:text-[#F0F2F5] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLists || isLoadingTasks ? 'animate-spin text-indigo-600 dark:text-[#6485F5]' : ''}`} />
                  <span>{t('random.refresh', uiLang)}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/15 border border-rose-200 dark:border-rose-500/25 text-xs font-semibold text-rose-700 dark:text-rose-300 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('tasks.disconnect', uiLang)}</span>
                </button>
              </>
            ) : (
              <div className="shrink-0">
                <OfficialGoogleSignInButton
                  onClick={handleGoogleSignIn}
                  isLoading={isSigningIn}
                  label={t('tasks.signInGoogle', uiLang)}
                  compact
                />
              </div>
            )}
          </div>
        </div>

        {statusBanner && (
          <div className="mt-4 px-4 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{statusBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-emerald-700/70 dark:text-emerald-300/70 hover:text-emerald-900 dark:hover:text-emerald-200 cursor-pointer"
              aria-label="Dismiss notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {authError && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {apiError && (
          <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{apiError.title}</span>
              </div>
              {apiError.requiresReauth && (
                <OfficialGoogleSignInButton
                  onClick={handleGoogleSignIn}
                  isLoading={isSigningIn}
                  label="Reconnect Google"
                  compact
                />
              )}
            </div>
            <p className="text-amber-800/90 dark:text-amber-200/90 leading-relaxed">{apiError.message}</p>
            {apiError.actionUrl && (
              <a
                href={apiError.actionUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-sky-700 dark:text-sky-300 underline hover:text-slate-900 dark:hover:text-white font-semibold"
              >
                <span>Open Google Cloud Console</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Unauthenticated Gate */}
      {(needsAuth || !accessToken) ? (
        <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-8 sm:p-12 text-center space-y-5 shadow-xs dark:shadow-none">
          <div className="w-12 h-12 mx-auto rounded-lg bg-indigo-50 dark:bg-[#6485F5]/15 border border-indigo-200 dark:border-[#6485F5]/30 flex items-center justify-center">
            <ListTodo className="w-6 h-6 text-indigo-600 dark:text-[#6485F5]" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#F0F2F5]">
              {t('tasks.connectTitle', uiLang)}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9BA6B2] leading-relaxed">
              {t('tasks.connectSub', uiLang, { lang: localizedTarget })}
            </p>
          </div>
          <div className="flex justify-center pt-1">
            <div className="w-full max-w-xs">
              <OfficialGoogleSignInButton
                onClick={handleGoogleSignIn}
                isLoading={isSigningIn}
                label={t('tasks.signInGoogle', uiLang)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar: Task Lists & Quick Study Templates */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 space-y-4 shadow-xs dark:shadow-none">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-indigo-600 dark:text-[#6485F5]" />
                  <span>{t('tasks.listsHeading', uiLang, { count: taskLists.length })}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setIsAddingList((v) => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-300 dark:border-[#293342] text-xs font-semibold text-slate-800 dark:text-[#F0F2F5] cursor-pointer transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-[#6485F5]" />
                  <span>{t('tasks.newList', uiLang)}</span>
                </button>
              </div>

              {isAddingList && (
                <form onSubmit={handleCreateList} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    placeholder={`e.g. ${selectedLanguage.name} Study Plan`}
                    className="flex-1 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] border border-[#6485F5]/40 text-white text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Create
                  </button>
                </form>
              )}

              <div className="space-y-1.5">
                {taskLists.map((list) => {
                  const isActive = list.id === selectedListId;
                  return (
                    <div
                      key={list.id}
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-[#232F3F] border-indigo-300 dark:border-[#293342] text-slate-900 dark:text-[#F0F2F5]'
                          : 'bg-slate-50 dark:bg-[#10151D] border-slate-200 dark:border-[#293342] text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-100 dark:hover:bg-[#1B2430]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedListId(list.id);
                          setIsRenamingList(false);
                          loadTasksForList(list.id);
                        }}
                        className="flex-1 text-left text-xs font-semibold truncate cursor-pointer"
                      >
                        {list.title}
                      </button>
                      {isActive && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setRenameListTitle(list.title);
                              setIsRenamingList((v) => !v);
                            }}
                            title="Rename list"
                            aria-label="Rename task list"
                            className="p-1 rounded-md hover:bg-indigo-100 dark:hover:bg-[#293342] text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {taskLists.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setPendingMutation({ type: 'delete_list', list })}
                              title="Delete list"
                              aria-label="Delete task list"
                              className="p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 dark:text-[#9BA6B2] hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {isRenamingList && selectedList && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = renameListTitle.trim();
                    if (!trimmed || trimmed === selectedList.title) return;
                    setPendingMutation({
                      type: 'rename_list',
                      list: selectedList,
                      nextTitle: trimmed
                    });
                  }}
                  className="pt-2 border-t border-slate-200 dark:border-[#293342] flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={renameListTitle}
                    onChange={(e) => setRenameListTitle(e.target.value)}
                    placeholder="New list title"
                    className="flex-1 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-semibold cursor-pointer"
                  >
                    Rename
                  </button>
                </form>
              )}
            </div>

            {/* Study Task Templates */}
            <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 space-y-3 shadow-xs dark:shadow-none">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-[#F0F2F5]">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{t('tasks.quickIdeas', uiLang, { lang: localizedTarget })}</span>
              </div>
              <div className="space-y-2">
                {studySuggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleUseStudySuggestion(s)}
                    className="w-full text-left p-3 rounded-lg bg-slate-50 dark:bg-[#10151D] hover:bg-slate-100 dark:hover:bg-[#1B2430] border border-slate-200 dark:border-[#293342] hover:border-slate-300 dark:hover:border-[#293342] transition-colors space-y-1 cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-slate-900 dark:text-[#F0F2F5]">{s.title}</div>
                    <div className="text-[11px] text-slate-600 dark:text-[#9BA6B2] line-clamp-2">{s.notes}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Create Task + Task List Items */}
          <div className="lg:col-span-8 space-y-5">
            {/* Add New Google Task Form */}
            <form
              onSubmit={handleCreateTask}
              className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 sm:p-6 space-y-4 shadow-xs dark:shadow-none"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600 dark:text-[#6485F5]" />
                  <span>Add Task to {selectedList?.title || 'Google Tasks'}</span>
                </h2>
                {googleUser?.email && (
                  <span className="text-[11px] text-slate-600 dark:text-[#9BA6B2]">{googleUser.email}</span>
                )}
              </div>

              {formError && (
                <div className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="google-task-title" className="sr-only">
                    Task title
                  </label>
                  <input
                    id="google-task-title"
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={`Add a ${selectedLanguage.name} study task...`}
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2.5 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                  />
                </div>
                <div>
                  <label htmlFor="google-task-due" className="sr-only">
                    Due date
                  </label>
                  <input
                    id="google-task-due"
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2.5 text-xs text-slate-800 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5]"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Optional study notes, grammar topics, or room link..."
                  className="flex-1 bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2.5 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                />
                <button
                  type="submit"
                  disabled={isCreatingTask || !selectedListId}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] border border-[#6485F5]/40 text-white font-semibold text-xs shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreatingTask ? t('common.saving', uiLang) : t('tasks.addTask', uiLang)}</span>
                </button>
              </div>
            </form>

            {/* Filter & Task Items */}
            <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 sm:p-6 space-y-4 shadow-xs dark:shadow-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-[#293342] pb-4">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] text-xs">
                  {(['all', 'needsAction', 'completed'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatusFilter(tab)}
                      className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer tabular-nums ${
                        statusFilter === tab
                          ? 'bg-white dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] shadow-xs dark:shadow-none'
                          : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5]'
                      }`}
                    >
                      {tab === 'all'
                        ? t('drills.filterAll', uiLang, { count: tasks.length })
                        : tab === 'needsAction'
                          ? `${t('common.online', uiLang) === 'Online' ? 'Active' : 'Offen'} (${tasks.length - completedCount})`
                          : `(${completedCount}) ✓`}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#9BA6B2] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('tasks.filterTasks', uiLang)}
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                  />
                </div>
              </div>

              {isLoadingTasks ? (
                <div className="py-12 text-center text-xs text-slate-600 dark:text-[#9BA6B2]">
                  Loading tasks from Google Tasks...
                </div>
              ) : visibleTasks.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-[#F0F2F5]">No tasks match your view</p>
                  <p className="text-xs text-slate-500 dark:text-[#9BA6B2]">
                    Add a new study goal above or pick a quick {selectedLanguage.name} template.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {visibleTasks.map((task) => {
                    const isCompleted = task.status === 'completed';
                    const isEditingThis = editingTask?.id === task.id;
                    return (
                      <div
                        key={task.id}
                        className="p-4 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] hover:border-slate-300 dark:hover:border-[#293342] transition-colors space-y-3"
                      >
                        {isEditingThis ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="sm:col-span-2 bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5]"
                              />
                              <input
                                type="date"
                                value={editDueDate}
                                onChange={(e) => setEditDueDate(e.target.value)}
                                className="bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5]"
                              />
                            </div>
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Notes..."
                              className="w-full bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5]"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingTask(null)}
                                className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1B2430] border border-slate-300 dark:border-[#293342] text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] cursor-pointer"
                              >
                                {t('common.cancel', uiLang)}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const v = validateTaskDraft({
                                    title: editTitle,
                                    notes: editNotes,
                                    dueDate: editDueDate
                                  });
                                  if (!v.valid) return;
                                  setPendingMutation({
                                    type: 'update_task',
                                    task,
                                    title: v.normalized.title,
                                    notes: v.normalized.notes,
                                    dueDate: v.normalized.dueDate
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-semibold cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{t('common.save', uiLang)}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingMutation({
                                    type: 'toggle_task',
                                    task,
                                    nextStatus: isCompleted ? 'needsAction' : 'completed'
                                  })
                                }
                                className="mt-0.5 text-slate-400 dark:text-[#9BA6B2] hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
                                aria-label={
                                  isCompleted
                                    ? `Reopen task ${task.title}`
                                    : `Complete task ${task.title}`
                                }
                              >
                                {isCompleted ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Circle className="w-5 h-5" />
                                )}
                              </button>

                              <div className="space-y-1 min-w-0">
                                <div
                                  className={`text-sm font-semibold break-words ${
                                    isCompleted ? 'line-through text-slate-400 dark:text-[#9BA6B2]' : 'text-slate-900 dark:text-[#F0F2F5]'
                                  }`}
                                >
                                  {task.title}
                                </div>
                                {task.notes && (
                                  <p className="text-xs text-slate-600 dark:text-[#9BA6B2] leading-relaxed break-words">
                                    {task.notes}
                                  </p>
                                )}
                                {task.dueDate && (
                                  <div className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-[#9278D8] font-medium pt-0.5 font-mono">
                                    <Calendar className="w-3 h-3" />
                                    <span>Due {task.dueDate}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTask(task);
                                  setEditTitle(task.title);
                                  setEditNotes(task.notes);
                                  setEditDueDate(task.dueDate);
                                }}
                                className="p-1.5 rounded-lg bg-white dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-200 dark:border-transparent text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] transition-colors cursor-pointer"
                                aria-label={`Edit task ${task.title}`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingMutation({ type: 'delete_task', task })}
                                className="p-1.5 rounded-lg bg-white dark:bg-[#1B2430] hover:bg-rose-50 dark:hover:bg-rose-500/15 border border-slate-200 dark:border-transparent text-slate-500 dark:text-[#9BA6B2] hover:text-rose-600 dark:hover:text-rose-300 transition-colors cursor-pointer"
                                aria-label={`Delete task ${task.title}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mandatory User Confirmation Dialog for Destructive / Mutating Operations */}
      {pendingMutation && (() => {
        const copy = getMutationDialogCopy(pendingMutation);
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tasks-confirm-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-[#0D1117]/80 backdrop-blur-sm"
          >
            <div className="w-full max-w-md bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 space-y-5 shadow-2xl">
              <div className="space-y-2">
                <h3 id="tasks-confirm-title" className="text-base font-bold text-slate-900 dark:text-[#F0F2F5]">
                  {copy.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-[#F0F2F5] leading-relaxed">
                  {copy.description}
                </p>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isApplyingMutation}
                  onClick={() => setPendingMutation(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-300 dark:border-[#293342] text-xs font-semibold text-slate-800 dark:text-[#F0F2F5] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isApplyingMutation}
                  onClick={handleConfirmMutation}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                    copy.isDestructive
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-[#6485F5] hover:bg-[#7593F7] text-white'
                  }`}
                >
                  {isApplyingMutation ? 'Applying...' : copy.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
