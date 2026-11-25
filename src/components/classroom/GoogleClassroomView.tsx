import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  FolderPlus,
  GraduationCap,
  Link2,
  LogOut,
  Megaphone,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Tag,
  Trash2,
  Users,
  Video,
  X
} from 'lucide-react';
import { LanguageInfo, UserProfile } from '../../types';
import { localizeLanguageName, normalizeNativeLanguage, t } from '../../services/uiLocalization';
import { OfficialGoogleSignInButton } from '../common/OfficialGoogleSignInButton';
import {
  ClassifiedClassroomError,
  ClassroomAnnouncement,
  ClassroomAttachmentLink,
  ClassroomCourse,
  ClassroomCourseWork,
  ClassroomMaterialItem,
  ClassroomRosterMember,
  ClassroomSubmission,
  ClassroomTopic,
  filterClassroomCourses,
  validateAnnouncementDraft,
  validateCourseDraft,
  validateCourseWorkDraft,
  validateTopicDraft
} from '../../services/googleClassroomLogic';
import {
  GoogleClassroomApiException,
  createClassroomCourse,
  createCourseAnnouncement,
  createCourseTopic,
  createCourseWork,
  deleteClassroomCourse,
  deleteCourseAnnouncement,
  deleteCourseWork,
  getClassroomAccessToken,
  getClassroomCurrentUser,
  initClassroomAuth,
  listClassroomCourses,
  listCourseAnnouncements,
  listCourseStudents,
  listCourseTeachers,
  listCourseTopics,
  listCourseWork,
  listCourseWorkMaterials,
  listStudentSubmissions,
  signInToClassroom,
  signOutFromClassroom,
  updateClassroomCourseState
} from '../../services/googleClassroomService';

interface GoogleClassroomViewProps {
  userProfile: UserProfile;
  selectedLanguage: LanguageInfo;
}

type CourseDetailTab = 'stream' | 'classwork' | 'people';

type PendingClassroomMutation =
  | {
      type: 'create_course';
      draft: { name: string; section: string; room: string; descriptionHeading: string };
    }
  | {
      type: 'update_course_state';
      course: ClassroomCourse;
      nextState: 'ACTIVE' | 'ARCHIVED';
    }
  | {
      type: 'delete_course';
      course: ClassroomCourse;
    }
  | {
      type: 'create_announcement';
      course: ClassroomCourse;
      text: string;
    }
  | {
      type: 'delete_announcement';
      course: ClassroomCourse;
      announcement: ClassroomAnnouncement;
    }
  | {
      type: 'create_coursework';
      course: ClassroomCourse;
      draft: {
        title: string;
        description: string;
        dueDate?: { year: number; month: number; day: number };
        maxPoints?: number;
        topicId?: string;
      };
    }
  | {
      type: 'delete_coursework';
      course: ClassroomCourse;
      work: ClassroomCourseWork;
    }
  | {
      type: 'create_topic';
      course: ClassroomCourse;
      name: string;
    };

function formatIsoTimestamp(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderAttachmentIcon(kind: ClassroomAttachmentLink['kind']) {
  switch (kind) {
    case 'youtube':
      return <Video className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    case 'drive':
      return <FileText className="w-3.5 h-3.5 text-indigo-500 dark:text-[#6485F5] shrink-0" />;
    case 'form':
      return <Paperclip className="w-3.5 h-3.5 text-violet-500 shrink-0" />;
    default:
      return <Link2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  }
}

export const GoogleClassroomView: React.FC<GoogleClassroomViewProps> = ({
  userProfile,
  selectedLanguage
}) => {
  const uiLang = normalizeNativeLanguage(userProfile.nativeLanguage);
  const localizedTarget = localizeLanguageName(selectedLanguage.name, uiLang);

  const [googleUser, setGoogleUser] = useState<any>(() => getClassroomCurrentUser());
  const [accessToken, setAccessToken] = useState<string | null>(() => getClassroomAccessToken());
  const [needsAuth, setNeedsAuth] = useState<boolean>(() => !getClassroomAccessToken());
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ClassifiedClassroomError | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Courses list
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [courseFilter, setCourseFilter] = useState<'ACTIVE' | 'ALL' | 'ARCHIVED'>('ACTIVE');
  const [courseSearch, setCourseSearch] = useState('');

  // Create course form
  const [isCreatingCourseOpen, setIsCreatingCourseOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseSection, setNewCourseSection] = useState('');
  const [newCourseRoom, setNewCourseRoom] = useState('');
  const [newCourseHeading, setNewCourseHeading] = useState('');
  const [courseFormError, setCourseFormError] = useState<string | null>(null);

  // Selected course details
  const [detailTab, setDetailTab] = useState<CourseDetailTab>('stream');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [announcements, setAnnouncements] = useState<ClassroomAnnouncement[]>([]);
  const [courseWork, setCourseWork] = useState<ClassroomCourseWork[]>([]);
  const [materials, setMaterials] = useState<ClassroomMaterialItem[]>([]);
  const [topics, setTopics] = useState<ClassroomTopic[]>([]);
  const [teachers, setTeachers] = useState<ClassroomRosterMember[]>([]);
  const [students, setStudents] = useState<ClassroomRosterMember[]>([]);

  // Submissions expandable state per coursework id
  const [expandedWorkId, setExpandedWorkId] = useState<string | null>(null);
  const [submissionsByWorkId, setSubmissionsByWorkId] = useState<Record<string, ClassroomSubmission[]>>({});
  const [loadingSubmissionsId, setLoadingSubmissionsId] = useState<string | null>(null);

  // Announcement composer
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

  // Assignment & Topic composers
  const [isAddingWork, setIsAddingWork] = useState(false);
  const [workTitle, setWorkTitle] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [workDueDate, setWorkDueDate] = useState('');
  const [workMaxPoints, setWorkMaxPoints] = useState('100');
  const [workTopicId, setWorkTopicId] = useState('');
  const [workFormError, setWorkFormError] = useState<string | null>(null);

  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [topicError, setTopicError] = useState<string | null>(null);

  // Copy feedback
  const [copiedCourseCode, setCopiedCourseCode] = useState<string | null>(null);

  // Mandatory confirmation modal for all mutating/destructive API calls
  const [pendingMutation, setPendingMutation] = useState<PendingClassroomMutation | null>(null);
  const [isApplyingMutation, setIsApplyingMutation] = useState(false);

  const loadCourseDetails = useCallback(async (courseId: string) => {
    if (!courseId) return;
    setIsLoadingDetails(true);
    setExpandedWorkId(null);

    try {
      const [annRes, workRes, matRes, topRes, teachRes, studRes] = await Promise.allSettled([
        listCourseAnnouncements(courseId),
        listCourseWork(courseId),
        listCourseWorkMaterials(courseId),
        listCourseTopics(courseId),
        listCourseTeachers(courseId),
        listCourseStudents(courseId)
      ]);

      const firstFatalRejection = [annRes, workRes, matRes, topRes].find(
        (r) =>
          r.status === 'rejected' &&
          r.reason instanceof GoogleClassroomApiException &&
          (r.reason.classified.requiresReauth || r.reason.classified.kind === 'api_not_enabled')
      ) as PromiseRejectedResult | undefined;

      if (firstFatalRejection) {
        const exc = firstFatalRejection.reason as GoogleClassroomApiException;
        setApiError(exc.classified);
        if (exc.classified.requiresReauth) setNeedsAuth(true);
      }

      setAnnouncements(annRes.status === 'fulfilled' ? annRes.value : []);
      setCourseWork(workRes.status === 'fulfilled' ? workRes.value : []);
      setMaterials(matRes.status === 'fulfilled' ? matRes.value : []);
      setTopics(topRes.status === 'fulfilled' ? topRes.value : []);
      setTeachers(teachRes.status === 'fulfilled' ? teachRes.value : []);
      setStudents(studRes.status === 'fulfilled' ? studRes.value : []);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  const loadCourses = useCallback(async () => {
    if (!getClassroomAccessToken()) return;
    setIsLoadingCourses(true);
    setApiError(null);
    try {
      const fetched = await listClassroomCourses();
      setCourses(fetched);
      if (fetched.length > 0) {
        setSelectedCourseId((prev) => {
          const exists = prev && fetched.some((c) => c.id === prev);
          const nextId = exists ? prev : fetched[0].id;
          void loadCourseDetails(nextId);
          return nextId;
        });
      } else {
        setSelectedCourseId('');
        setAnnouncements([]);
        setCourseWork([]);
        setMaterials([]);
        setTopics([]);
        setTeachers([]);
        setStudents([]);
      }
    } catch (err: any) {
      if (err instanceof GoogleClassroomApiException) {
        setApiError(err.classified);
        if (err.classified.requiresReauth) setNeedsAuth(true);
      } else {
        setApiError({
          kind: 'unknown',
          status: 0,
          title: 'Failed to Load Google Classroom',
          message: err?.message || 'Unable to fetch your Google Classroom courses.',
          requiresReauth: false
        });
      }
    } finally {
      setIsLoadingCourses(false);
    }
  }, [loadCourseDetails]);

  useEffect(() => {
    const unsubscribe = initClassroomAuth(
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

  useEffect(() => {
    if (accessToken && !needsAuth) {
      void loadCourses();
    }
  }, [accessToken, needsAuth, loadCourses]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    setApiError(null);
    try {
      const { user, accessToken: token } = await signInToClassroom();
      setGoogleUser(user);
      setAccessToken(token);
      setNeedsAuth(false);
    } catch (err: any) {
      setAuthError(err?.message || 'Google Sign-In was cancelled or failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutFromClassroom();
    setGoogleUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setCourses([]);
    setSelectedCourseId('');
    setAnnouncements([]);
    setCourseWork([]);
    setMaterials([]);
    setTopics([]);
    setTeachers([]);
    setStudents([]);
    setStatusBanner('Disconnected Google Classroom.');
  };

  const handleSelectCourse = (courseId: string) => {
    if (courseId === selectedCourseId) return;
    setSelectedCourseId(courseId);
    setAnnouncementError(null);
    setWorkFormError(null);
    void loadCourseDetails(courseId);
  };

  const handleToggleSubmissions = async (courseId: string, workId: string) => {
    if (expandedWorkId === workId) {
      setExpandedWorkId(null);
      return;
    }
    setExpandedWorkId(workId);
    if (submissionsByWorkId[workId]) return;

    setLoadingSubmissionsId(workId);
    try {
      const items = await listStudentSubmissions(courseId, workId);
      setSubmissionsByWorkId((prev) => ({ ...prev, [workId]: items }));
    } catch (err: any) {
      setSubmissionsByWorkId((prev) => ({ ...prev, [workId]: [] }));
      if (err instanceof GoogleClassroomApiException) {
        setApiError(err.classified);
        if (err.classified.requiresReauth) setNeedsAuth(true);
      }
    } finally {
      setLoadingSubmissionsId(null);
    }
  };

  const handleCopyEnrollmentCode = async (code: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      }
      setCopiedCourseCode(code);
      setTimeout(() => setCopiedCourseCode((curr) => (curr === code ? null : curr)), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  // Draft submission handlers (all route through Confirmation Modal!)
  const handlePrepareCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    setCourseFormError(null);
    const v = validateCourseDraft({
      name: newCourseName,
      section: newCourseSection,
      room: newCourseRoom,
      descriptionHeading: newCourseHeading
    });
    if (!v.valid) {
      setCourseFormError(v.error || 'Please enter a valid course name.');
      return;
    }
    setPendingMutation({
      type: 'create_course',
      draft: v.normalized
    });
  };

  const handlePreparePostAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setAnnouncementError(null);
    const v = validateAnnouncementDraft({ text: announcementText });
    if (!v.valid) {
      setAnnouncementError(v.error || 'Please write an announcement.');
      return;
    }
    setPendingMutation({
      type: 'create_announcement',
      course: selectedCourse,
      text: v.normalized.text
    });
  };

  const handlePrepareCreateCourseWork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setWorkFormError(null);
    const v = validateCourseWorkDraft({
      title: workTitle,
      description: workDescription,
      dueDate: workDueDate,
      maxPoints: workMaxPoints
    });
    if (!v.valid) {
      setWorkFormError(v.error || 'Please review assignment details.');
      return;
    }
    setPendingMutation({
      type: 'create_coursework',
      course: selectedCourse,
      draft: {
        ...v.normalized,
        topicId: workTopicId || undefined
      }
    });
  };

  const handlePrepareCreateTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setTopicError(null);
    const v = validateTopicDraft({ name: newTopicName });
    if (!v.valid) {
      setTopicError(v.error || 'Topic name is required.');
      return;
    }
    setPendingMutation({
      type: 'create_topic',
      course: selectedCourse,
      name: v.normalized.name
    });
  };

  const handleConfirmMutation = async () => {
    if (!pendingMutation) return;
    setIsApplyingMutation(true);
    setApiError(null);

    try {
      if (pendingMutation.type === 'create_course') {
        const created = await createClassroomCourse(pendingMutation.draft);
        setCourses((prev) => [created, ...prev]);
        setSelectedCourseId(created.id);
        setNewCourseName('');
        setNewCourseSection('');
        setNewCourseRoom('');
        setNewCourseHeading('');
        setIsCreatingCourseOpen(false);
        setCourseFilter('ALL');
        await loadCourseDetails(created.id);
        setStatusBanner(`Created Google Classroom course "${created.name}".`);
      } else if (pendingMutation.type === 'update_course_state') {
        const updated = await updateClassroomCourseState(
          pendingMutation.course.id,
          pendingMutation.nextState
        );
        setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setStatusBanner(
          pendingMutation.nextState === 'ARCHIVED'
            ? `Archived "${updated.name}".`
            : `Activated "${updated.name}".`
        );
      } else if (pendingMutation.type === 'delete_course') {
        await deleteClassroomCourse(pendingMutation.course.id);
        const remaining = courses.filter((c) => c.id !== pendingMutation.course.id);
        setCourses(remaining);
        const nextId = remaining[0]?.id || '';
        setSelectedCourseId(nextId);
        if (nextId) {
          await loadCourseDetails(nextId);
        } else {
          setAnnouncements([]);
          setCourseWork([]);
          setMaterials([]);
          setTopics([]);
          setTeachers([]);
          setStudents([]);
        }
        setStatusBanner(`Deleted course "${pendingMutation.course.name}".`);
      } else if (pendingMutation.type === 'create_announcement') {
        const created = await createCourseAnnouncement(
          pendingMutation.course.id,
          pendingMutation.text
        );
        setAnnouncements((prev) => [created, ...prev]);
        setAnnouncementText('');
        setStatusBanner(`Published announcement to "${pendingMutation.course.name}".`);
      } else if (pendingMutation.type === 'delete_announcement') {
        await deleteCourseAnnouncement(
          pendingMutation.course.id,
          pendingMutation.announcement.id
        );
        setAnnouncements((prev) =>
          prev.filter((a) => a.id !== pendingMutation.announcement.id)
        );
        setStatusBanner('Deleted announcement from Google Classroom.');
      } else if (pendingMutation.type === 'create_coursework') {
        const created = await createCourseWork(
          pendingMutation.course.id,
          pendingMutation.draft
        );
        setCourseWork((prev) => [created, ...prev]);
        setWorkTitle('');
        setWorkDescription('');
        setWorkDueDate('');
        setWorkMaxPoints('100');
        setWorkTopicId('');
        setIsAddingWork(false);
        setStatusBanner(`Published assignment "${created.title}".`);
      } else if (pendingMutation.type === 'delete_coursework') {
        await deleteCourseWork(pendingMutation.course.id, pendingMutation.work.id);
        setCourseWork((prev) => prev.filter((w) => w.id !== pendingMutation.work.id));
        setStatusBanner(`Deleted assignment "${pendingMutation.work.title}".`);
      } else if (pendingMutation.type === 'create_topic') {
        const created = await createCourseTopic(
          pendingMutation.course.id,
          pendingMutation.name
        );
        setTopics((prev) => [...prev, created]);
        setNewTopicName('');
        setIsAddingTopic(false);
        setStatusBanner(`Added topic "${created.name}".`);
      }
      setPendingMutation(null);
    } catch (err: any) {
      if (err instanceof GoogleClassroomApiException) {
        setApiError(err.classified);
        if (err.classified.requiresReauth) setNeedsAuth(true);
      } else {
        setApiError({
          kind: 'unknown',
          status: 0,
          title: 'Classroom Update Failed',
          message: err?.message || 'Unable to complete the Google Classroom change.',
          requiresReauth: false
        });
      }
      setPendingMutation(null);
    } finally {
      setIsApplyingMutation(false);
    }
  };

  const visibleCourses = useMemo(
    () => filterClassroomCourses(courses, courseFilter, courseSearch),
    [courses, courseFilter, courseSearch]
  );

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  const topicNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const topic of topics) {
      map.set(topic.topicId, topic.name);
    }
    return map;
  }, [topics]);

  const studentByUserId = useMemo(() => {
    const map = new Map<string, ClassroomRosterMember>();
    for (const s of students) {
      map.set(s.userId, s);
    }
    return map;
  }, [students]);

  const getMutationDialogCopy = (mutation: PendingClassroomMutation) => {
    switch (mutation.type) {
      case 'create_course':
        return {
          title: 'Create New Google Classroom Course?',
          description: `Create a new course named "${mutation.draft.name}"${mutation.draft.section ? ` (${mutation.draft.section})` : ''} in your Google Classroom account?`,
          confirmLabel: 'Create Course',
          isDestructive: false
        };
      case 'update_course_state':
        return {
          title:
            mutation.nextState === 'ARCHIVED'
              ? 'Archive Google Classroom Course?'
              : 'Activate Google Classroom Course?',
          description:
            mutation.nextState === 'ARCHIVED'
              ? `Archive "${mutation.course.name}"? Students and teachers will keep read-only access to archived coursework.`
              : `Activate "${mutation.course.name}" so it appears in active courses?`,
          confirmLabel: mutation.nextState === 'ARCHIVED' ? 'Archive Course' : 'Activate Course',
          isDestructive: false
        };
      case 'delete_course':
        return {
          title: 'Permanently Delete Course?',
          description: `Permanently delete "${mutation.course.name}" and all of its coursework and announcements from Google Classroom? This action cannot be undone.`,
          confirmLabel: 'Delete Course',
          isDestructive: true
        };
      case 'create_announcement':
        return {
          title: 'Publish Stream Announcement?',
          description: `Post this announcement to "${mutation.course.name}" for all enrolled students and teachers?`,
          confirmLabel: 'Publish Announcement',
          isDestructive: false
        };
      case 'delete_announcement':
        return {
          title: 'Delete Announcement?',
          description: `Permanently remove this announcement from "${mutation.course.name}"? This action cannot be undone.`,
          confirmLabel: 'Delete Announcement',
          isDestructive: true
        };
      case 'create_coursework':
        return {
          title: 'Publish Assignment to Classwork?',
          description: `Publish assignment "${mutation.draft.title}" to "${mutation.course.name}"?`,
          confirmLabel: 'Publish Assignment',
          isDestructive: false
        };
      case 'delete_coursework':
        return {
          title: 'Delete Assignment?',
          description: `Permanently delete "${mutation.work.title}" and its student submission records from "${mutation.course.name}"? This action cannot be undone.`,
          confirmLabel: 'Delete Assignment',
          isDestructive: true
        };
      case 'create_topic':
        return {
          title: 'Create Classwork Topic?',
          description: `Add topic "${mutation.name}" to "${mutation.course.name}"?`,
          confirmLabel: 'Create Topic',
          isDestructive: false
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
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
                  {t('classroom.title', uiLang)}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9BA6B2]">
                  {t('classroom.subtitle', uiLang, { lang: localizedTarget })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {accessToken && !needsAuth ? (
              <>
                {googleUser?.email && (
                  <span className="hidden sm:inline text-xs text-slate-600 dark:text-[#9BA6B2] mr-1">
                    {googleUser.email}
                  </span>
                )}
                <button
                  type="button"
                  onClick={loadCourses}
                  disabled={isLoadingCourses || isLoadingDetails}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-300 dark:border-[#293342] text-xs font-semibold text-slate-800 dark:text-[#F0F2F5] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isLoadingCourses || isLoadingDetails ? 'animate-spin text-[#6485F5]' : ''
                    }`}
                  />
                  <span>{t('random.refresh', uiLang)}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/15 border border-rose-200 dark:border-rose-500/25 text-xs font-semibold text-rose-700 dark:text-rose-300 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('classroom.disconnect', uiLang)}</span>
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
      {needsAuth || !accessToken ? (
        <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-8 sm:p-12 text-center space-y-5 shadow-xs dark:shadow-none">
          <div className="w-12 h-12 mx-auto rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="max-w-lg mx-auto space-y-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#F0F2F5]">
              {t('classroom.connectTitle', uiLang)}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9BA6B2] leading-relaxed">
              {t('classroom.connectSub', uiLang, { lang: localizedTarget })}
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
          {/* Left Column: Courses Sidebar & Create Course */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 space-y-4 shadow-xs dark:shadow-none">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('classroom.coursesHeading', uiLang, { count: courses.length })}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingCourseOpen((v) => !v);
                    setCourseFormError(null);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>{t('classroom.newCourse', uiLang)}</span>
                </button>
              </div>

              {isCreatingCourseOpen && (
                <form
                  onSubmit={handlePrepareCreateCourse}
                  className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-2.5"
                >
                  <div className="text-xs font-semibold text-slate-900 dark:text-[#F0F2F5]">
                    Create Classroom Course
                  </div>
                  {courseFormError && (
                    <div className="text-[11px] text-rose-600 dark:text-rose-400">{courseFormError}</div>
                  )}
                  <input
                    type="text"
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    placeholder={`e.g. ${selectedLanguage.name} Fluency Studio`}
                    aria-label="Course name"
                    className="w-full bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newCourseSection}
                      onChange={(e) => setNewCourseSection(e.target.value)}
                      placeholder="Section (e.g. B1)"
                      aria-label="Course section"
                      className="w-full bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                    />
                    <input
                      type="text"
                      value={newCourseRoom}
                      onChange={(e) => setNewCourseRoom(e.target.value)}
                      placeholder="Room (optional)"
                      aria-label="Course room"
                      className="w-full bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                    />
                  </div>
                  <input
                    type="text"
                    value={newCourseHeading}
                    onChange={(e) => setNewCourseHeading(e.target.value)}
                    placeholder="Course description heading (optional)"
                    aria-label="Course description heading"
                    className="w-full bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingCourseOpen(false)}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1B2430] border border-slate-300 dark:border-[#293342] text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] cursor-pointer"
                    >
                      {t('common.cancel', uiLang)}
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-semibold cursor-pointer"
                    >
                      Continue
                    </button>
                  </div>
                </form>
              )}

              {/* Search & State Filter */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#9BA6B2] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder={t('classroom.searchCourses', uiLang)}
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                  />
                </div>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] text-[11px]">
                  {(['ACTIVE', 'ALL', 'ARCHIVED'] as const).map((stateTab) => (
                    <button
                      key={stateTab}
                      type="button"
                      onClick={() => setCourseFilter(stateTab)}
                      className={`flex-1 py-1.5 px-2 rounded-md font-semibold transition-colors cursor-pointer ${
                        courseFilter === stateTab
                          ? 'bg-white dark:bg-[#232F3F] text-slate-900 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] shadow-xs dark:shadow-none'
                          : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5]'
                      }`}
                    >
                      {stateTab === 'ACTIVE'
                        ? 'Active'
                        : stateTab === 'ARCHIVED'
                          ? 'Archived'
                          : 'All'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Course List */}
              {isLoadingCourses ? (
                <div className="py-10 text-center text-xs text-slate-600 dark:text-[#9BA6B2]">
                  Loading Google Classroom courses...
                </div>
              ) : visibleCourses.length === 0 ? (
                <div className="py-8 text-center space-y-2 border border-dashed border-slate-200 dark:border-[#293342] rounded-lg px-3">
                  <p className="text-xs font-semibold text-slate-800 dark:text-[#F0F2F5]">
                    {t('classroom.noCourses', uiLang)}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-[#9BA6B2]">
                    Create a new Classroom course above or switch the course filter to All.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleCourses.map((course) => {
                    const isSelected = course.id === selectedCourseId;
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => handleSelectCourse(course.id)}
                        className={`w-full text-left p-3.5 rounded-lg border transition-colors cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-[#232F3F] border-indigo-300 dark:border-[#6485F5]/60 text-slate-900 dark:text-[#F0F2F5]'
                            : 'bg-slate-50 dark:bg-[#10151D] border-slate-200 dark:border-[#293342] text-slate-700 dark:text-[#9BA6B2] hover:bg-slate-100 dark:hover:bg-[#1B2430] hover:text-slate-900 dark:hover:text-[#F0F2F5]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-bold text-slate-900 dark:text-[#F0F2F5] line-clamp-2">
                            {course.name}
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                              course.courseState === 'ARCHIVED'
                                ? 'bg-slate-200/70 dark:bg-[#1B2430] text-slate-600 dark:text-[#9BA6B2] border-slate-300 dark:border-[#293342]'
                                : course.courseState === 'PROVISIONED'
                                  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                                  : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                            }`}
                          >
                            {course.courseState}
                          </span>
                        </div>
                        {(course.section || course.room) && (
                          <div className="text-[11px] text-slate-600 dark:text-[#9BA6B2] truncate">
                            {[course.section, course.room].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Selected Course Stream, Classwork & People */}
          <div className="lg:col-span-8 space-y-5">
            {!selectedCourse ? (
              <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-10 text-center space-y-3 shadow-xs dark:shadow-none">
                <GraduationCap className="w-8 h-8 text-slate-400 dark:text-[#9BA6B2] mx-auto" />
                <h2 className="text-base font-bold text-slate-900 dark:text-[#F0F2F5]">
                  Select or Create a Course
                </h2>
                <p className="text-xs text-slate-600 dark:text-[#9BA6B2] max-w-md mx-auto">
                  Choose any course on the left to view its Stream announcements, Classwork assignments, Materials, and Roster.
                </p>
              </div>
            ) : (
              <>
                {/* Selected Course Banner Card */}
                <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 sm:p-6 space-y-4 shadow-xs dark:shadow-none">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#F0F2F5] truncate">
                          {selectedCourse.name}
                        </h2>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] text-slate-700 dark:text-[#9BA6B2]">
                          {selectedCourse.courseState}
                        </span>
                      </div>
                      {(selectedCourse.section || selectedCourse.room || selectedCourse.descriptionHeading) && (
                        <p className="text-xs text-slate-600 dark:text-[#9BA6B2]">
                          {[selectedCourse.section, selectedCourse.room, selectedCourse.descriptionHeading]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      {selectedCourse.enrollmentCode && (
                        <div className="pt-1 flex items-center gap-2 text-xs">
                          <span className="text-slate-500 dark:text-[#9BA6B2]">Class code:</span>
                          <code className="font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] text-indigo-700 dark:text-[#6485F5]">
                            {selectedCourse.enrollmentCode}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopyEnrollmentCode(selectedCourse.enrollmentCode)}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>
                              {copiedCourseCode === selectedCourse.enrollmentCode ? 'Copied' : 'Copy'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {selectedCourse.alternateLink && (
                        <a
                          href={selectedCourse.alternateLink}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-300 dark:border-[#293342] text-xs font-semibold text-slate-800 dark:text-[#F0F2F5] transition-colors"
                        >
                          <span>Open in Classroom</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {selectedCourse.courseState !== 'ARCHIVED' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingMutation({
                              type: 'update_course_state',
                              course: selectedCourse,
                              nextState: 'ARCHIVED'
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-300 dark:border-[#293342] text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] transition-colors cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingMutation({
                              type: 'update_course_state',
                              course: selectedCourse,
                              nextState: 'ACTIVE'
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Activate</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setPendingMutation({
                            type: 'delete_course',
                            course: selectedCourse
                          })
                        }
                        aria-label={`Delete course ${selectedCourse.name}`}
                        className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/25 text-rose-600 dark:text-rose-300 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Course Detail Sub-Tabs */}
                  <div className="flex items-center gap-2 border-t border-slate-200 dark:border-[#293342] pt-4">
                    {(
                      [
                        {
                          id: 'stream',
                          label: t('classroom.tabStream', uiLang),
                          count: announcements.length,
                          icon: <Megaphone className="w-3.5 h-3.5" />
                        },
                        {
                          id: 'classwork',
                          label: t('classroom.tabClasswork', uiLang),
                          count: courseWork.length + materials.length,
                          icon: <FileText className="w-3.5 h-3.5" />
                        },
                        {
                          id: 'people',
                          label: t('classroom.tabPeople', uiLang),
                          count: teachers.length + students.length,
                          icon: <Users className="w-3.5 h-3.5" />
                        }
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDetailTab(tab.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          detailTab === tab.id
                            ? 'bg-[#6485F5] border-[#6485F5] text-white'
                            : 'bg-slate-50 dark:bg-[#10151D] border-slate-200 dark:border-[#293342] text-slate-700 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5]'
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                            detailTab === tab.id
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-200 dark:bg-[#1B2430] text-slate-700 dark:text-[#9BA6B2]'
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab 1: Stream / Announcements */}
                {detailTab === 'stream' && (
                  <div className="space-y-4">
                    <form
                      onSubmit={handlePreparePostAnnouncement}
                      className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 space-y-3 shadow-xs dark:shadow-none"
                    >
                      <label
                        htmlFor="classroom-announcement-input"
                        className="text-xs font-bold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-2"
                      >
                        <Megaphone className="w-4 h-4 text-[#6485F5]" />
                        <span>{t('classroom.announcePrompt', uiLang)}</span>
                      </label>
                      {announcementError && (
                        <div className="text-xs text-rose-600 dark:text-rose-400">{announcementError}</div>
                      )}
                      <textarea
                        id="classroom-announcement-input"
                        rows={3}
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        placeholder={`Share a speaking prompt, homework note, or session update with ${selectedCourse.name}...`}
                        className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2.5 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5]"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{t('classroom.postAnnouncement', uiLang)}</span>
                        </button>
                      </div>
                    </form>

                    <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 space-y-3 shadow-xs dark:shadow-none">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-[#F0F2F5]">
                        Course Stream ({announcements.length})
                      </h3>

                      {isLoadingDetails ? (
                        <div className="py-10 text-center text-xs text-slate-600 dark:text-[#9BA6B2]">
                          Loading course stream...
                        </div>
                      ) : announcements.length === 0 ? (
                        <div className="py-10 text-center text-xs text-slate-500 dark:text-[#9BA6B2]">
                          No announcements posted in this course yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {announcements.map((ann) => (
                            <div
                              key={ann.id}
                              className="p-4 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-2.5"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-xs sm:text-sm text-slate-800 dark:text-[#F0F2F5] whitespace-pre-wrap leading-relaxed">
                                  {ann.text}
                                </p>
                                <div className="flex items-center gap-1 shrink-0">
                                  {ann.alternateLink && (
                                    <a
                                      href={ann.alternateLink}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      aria-label="Open announcement in Google Classroom"
                                      className="p-1.5 rounded-lg bg-white dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5]"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPendingMutation({
                                        type: 'delete_announcement',
                                        course: selectedCourse,
                                        announcement: ann
                                      })
                                    }
                                    aria-label="Delete announcement"
                                    className="p-1.5 rounded-lg bg-white dark:bg-[#1B2430] hover:bg-rose-50 dark:hover:bg-rose-500/15 text-slate-500 dark:text-[#9BA6B2] hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {ann.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {ann.attachments.map((att, idx) => (
                                    <a
                                      key={idx}
                                      href={att.url}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] text-[11px] font-medium text-slate-700 dark:text-[#F0F2F5] hover:border-[#6485F5]"
                                    >
                                      {renderAttachmentIcon(att.kind)}
                                      <span className="truncate max-w-[200px]">{att.title}</span>
                                    </a>
                                  ))}
                                </div>
                              )}

                              <div className="text-[11px] text-slate-500 dark:text-[#9BA6B2]">
                                {formatIsoTimestamp(ann.updateTime || ann.creationTime) || 'Published'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 2: Classwork (Assignments, Topics & Materials) */}
                {detailTab === 'classwork' && (
                  <div className="space-y-5">
                    {/* Actions Bar: Create Assignment & Create Topic */}
                    <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 space-y-4 shadow-xs dark:shadow-none">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-[#F0F2F5]">
                          {t('classroom.assignmentsHeading', uiLang, { count: courseWork.length })}
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingTopic((v) => !v);
                              setTopicError(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-300 dark:border-[#293342] text-xs font-semibold text-slate-800 dark:text-[#F0F2F5] cursor-pointer"
                          >
                            <Tag className="w-3.5 h-3.5 text-[#6485F5]" />
                            <span>New Topic</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingWork((v) => !v);
                              setWorkFormError(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-semibold cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t('classroom.newAssignment', uiLang)}</span>
                          </button>
                        </div>
                      </div>

                      {isAddingTopic && (
                        <form
                          onSubmit={handlePrepareCreateTopic}
                          className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] flex flex-col sm:flex-row gap-2"
                        >
                          <input
                            type="text"
                            value={newTopicName}
                            onChange={(e) => setNewTopicName(e.target.value)}
                            placeholder="New topic name (e.g. Week 4 · Subjunctive)"
                            aria-label="Topic name"
                            className="flex-1 bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5]"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setIsAddingTopic(false)}
                              className="px-3 py-2 rounded-lg bg-white dark:bg-[#1B2430] border border-slate-300 dark:border-[#293342] text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] cursor-pointer"
                            >
                              {t('common.cancel', uiLang)}
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-semibold cursor-pointer"
                            >
                              Add Topic
                            </button>
                          </div>
                          {topicError && (
                            <div className="text-[11px] text-rose-600 dark:text-rose-400">{topicError}</div>
                          )}
                        </form>
                      )}

                      {isAddingWork && (
                        <form
                          onSubmit={handlePrepareCreateCourseWork}
                          className="p-4 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-3"
                        >
                          <div className="text-xs font-bold text-slate-900 dark:text-[#F0F2F5]">
                            Create Assignment in {selectedCourse.name}
                          </div>
                          {workFormError && (
                            <div className="text-xs text-rose-600 dark:text-rose-400">{workFormError}</div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <input
                              type="text"
                              value={workTitle}
                              onChange={(e) => setWorkTitle(e.target.value)}
                              placeholder="Assignment title *"
                              aria-label="Assignment title"
                              className="sm:col-span-2 bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5]"
                            />
                            <input
                              type="date"
                              value={workDueDate}
                              onChange={(e) => setWorkDueDate(e.target.value)}
                              aria-label="Assignment due date"
                              className="bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5]"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <input
                              type="number"
                              min={0}
                              max={10000}
                              value={workMaxPoints}
                              onChange={(e) => setWorkMaxPoints(e.target.value)}
                              placeholder="Max points (e.g. 100)"
                              aria-label="Max points"
                              className="bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5]"
                            />
                            <select
                              value={workTopicId}
                              onChange={(e) => setWorkTopicId(e.target.value)}
                              aria-label="Assignment topic"
                              className="bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5]"
                            >
                              <option value="">No topic</option>
                              {topics.map((topic) => (
                                <option key={topic.topicId} value={topic.topicId}>
                                  {topic.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <textarea
                            rows={2}
                            value={workDescription}
                            onChange={(e) => setWorkDescription(e.target.value)}
                            placeholder="Instructions for students (optional)"
                            aria-label="Assignment instructions"
                            className="w-full bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5]"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setIsAddingWork(false)}
                              className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1B2430] border border-slate-300 dark:border-[#293342] text-xs font-semibold text-slate-700 dark:text-[#F0F2F5] cursor-pointer"
                            >
                              {t('common.cancel', uiLang)}
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-1.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-semibold cursor-pointer"
                            >
                              Continue
                            </button>
                          </div>
                        </form>
                      )}

                      {isLoadingDetails ? (
                        <div className="py-10 text-center text-xs text-slate-600 dark:text-[#9BA6B2]">
                          Loading coursework & assignments...
                        </div>
                      ) : courseWork.length === 0 ? (
                        <div className="py-10 text-center text-xs text-slate-500 dark:text-[#9BA6B2]">
                          No assignments in this course yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {courseWork.map((work) => {
                            const topicLabel = work.topicId ? topicNameById.get(work.topicId) : undefined;
                            const isExpanded = expandedWorkId === work.id;
                            const subs = submissionsByWorkId[work.id];

                            return (
                              <div
                                key={work.id}
                                className="p-4 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-2.5"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-sm font-bold text-slate-900 dark:text-[#F0F2F5]">
                                        {work.title}
                                      </h4>
                                      {topicLabel && (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-[#6485F5]/15 text-indigo-700 dark:text-[#6485F5] border border-indigo-200 dark:border-[#6485F5]/30">
                                          {topicLabel}
                                        </span>
                                      )}
                                      {work.maxPoints !== null && (
                                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-200/70 dark:bg-[#1B2430] text-slate-700 dark:text-[#9BA6B2]">
                                          {work.maxPoints} pts
                                        </span>
                                      )}
                                    </div>
                                    {work.description && (
                                      <p className="text-xs text-slate-600 dark:text-[#9BA6B2] whitespace-pre-wrap leading-relaxed">
                                        {work.description}
                                      </p>
                                    )}
                                    {work.dueDateStr && (
                                      <div className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-600 dark:text-[#9278D8] pt-0.5">
                                        <Calendar className="w-3 h-3" />
                                        <span>Due {work.dueDateStr}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleSubmissions(selectedCourse.id, work.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-200 dark:border-[#293342] text-[11px] font-semibold text-slate-700 dark:text-[#F0F2F5] cursor-pointer"
                                    >
                                      <span>Submissions</span>
                                      {isExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                    {work.alternateLink && (
                                      <a
                                        href={work.alternateLink}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        aria-label={`Open ${work.title} in Google Classroom`}
                                        className="p-1.5 rounded-lg bg-white dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] border border-slate-200 dark:border-transparent text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5]"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPendingMutation({
                                          type: 'delete_coursework',
                                          course: selectedCourse,
                                          work
                                        })
                                      }
                                      aria-label={`Delete assignment ${work.title}`}
                                      className="p-1.5 rounded-lg bg-white dark:bg-[#1B2430] hover:bg-rose-50 dark:hover:bg-rose-500/15 border border-slate-200 dark:border-transparent text-slate-500 dark:text-[#9BA6B2] hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {work.attachments.length > 0 && (
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    {work.attachments.map((att, idx) => (
                                      <a
                                        key={idx}
                                        href={att.url}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] text-[11px] font-medium text-slate-700 dark:text-[#F0F2F5] hover:border-[#6485F5]"
                                      >
                                        {renderAttachmentIcon(att.kind)}
                                        <span className="truncate max-w-[200px]">{att.title}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {isExpanded && (
                                  <div className="mt-2 pt-3 border-t border-slate-200 dark:border-[#293342] space-y-2">
                                    {loadingSubmissionsId === work.id ? (
                                      <div className="text-[11px] text-slate-500 dark:text-[#9BA6B2]">
                                        Loading student submissions...
                                      </div>
                                    ) : !subs || subs.length === 0 ? (
                                      <div className="text-[11px] text-slate-500 dark:text-[#9BA6B2]">
                                        No student submissions available yet.
                                      </div>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {subs.map((sub) => {
                                          const member = studentByUserId.get(sub.userId);
                                          return (
                                            <div
                                              key={sub.id}
                                              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] text-xs"
                                            >
                                              <span className="font-medium text-slate-800 dark:text-[#F0F2F5] truncate">
                                                {member?.fullName || `Student ${sub.userId.slice(0, 8)}`}
                                              </span>
                                              <div className="flex items-center gap-2 shrink-0">
                                                {sub.late && (
                                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                                    Late
                                                  </span>
                                                )}
                                                {sub.assignedGrade !== undefined && (
                                                  <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                                    {sub.assignedGrade}
                                                    {work.maxPoints !== null ? `/${work.maxPoints}` : ''}
                                                  </span>
                                                )}
                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1B2430] text-slate-600 dark:text-[#9BA6B2]">
                                                  {sub.state}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Coursework Materials */}
                    <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 space-y-3 shadow-xs dark:shadow-none">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-[#F0F2F5]">
                        Study Materials ({materials.length})
                      </h3>
                      {materials.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-500 dark:text-[#9BA6B2]">
                          No course materials shared in this classroom yet.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {materials.map((mat) => (
                            <div
                              key={mat.id}
                              className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-xs font-bold text-slate-900 dark:text-[#F0F2F5]">
                                    {mat.title}
                                  </div>
                                  {mat.description && (
                                    <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2] mt-0.5">
                                      {mat.description}
                                    </p>
                                  )}
                                </div>
                                {mat.alternateLink && (
                                  <a
                                    href={mat.alternateLink}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    aria-label={`Open material ${mat.title}`}
                                    className="p-1.5 rounded-lg bg-white dark:bg-[#1B2430] text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5]"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                              {mat.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {mat.attachments.map((att, idx) => (
                                    <a
                                      key={idx}
                                      href={att.url}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] text-[11px] font-medium text-slate-700 dark:text-[#F0F2F5] hover:border-[#6485F5]"
                                    >
                                      {renderAttachmentIcon(att.kind)}
                                      <span className="truncate max-w-[200px]">{att.title}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 3: People / Roster */}
                {detailTab === 'people' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 space-y-3 shadow-xs dark:shadow-none">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-[#F0F2F5]">
                        Teachers ({teachers.length})
                      </h3>
                      {teachers.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-[#9BA6B2]">
                          No teacher roster entries returned for this course.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {teachers.map((member) => (
                            <div
                              key={member.userId}
                              className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342]"
                            >
                              {member.photoUrl ? (
                                <img
                                  src={member.photoUrl}
                                  alt={member.fullName}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-[#293342]"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-[#6485F5]/20 text-[#6485F5] font-bold text-xs flex items-center justify-center shrink-0">
                                  {member.fullName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-900 dark:text-[#F0F2F5] truncate">
                                  {member.fullName}
                                </div>
                                {member.emailAddress && (
                                  <div className="text-[11px] text-slate-500 dark:text-[#9BA6B2] truncate">
                                    {member.emailAddress}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-5 space-y-3 shadow-xs dark:shadow-none">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-[#F0F2F5]">
                        Students ({students.length})
                      </h3>
                      {students.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-[#9BA6B2]">
                          No enrolled students returned for this course yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {students.map((member) => (
                            <div
                              key={member.userId}
                              className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342]"
                            >
                              {member.photoUrl ? (
                                <img
                                  src={member.photoUrl}
                                  alt={member.fullName}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-[#293342]"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 font-bold text-xs flex items-center justify-center shrink-0">
                                  {member.fullName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-900 dark:text-[#F0F2F5] truncate">
                                  {member.fullName}
                                </div>
                                {member.emailAddress && (
                                  <div className="text-[11px] text-slate-500 dark:text-[#9BA6B2] truncate">
                                    {member.emailAddress}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Mandatory Confirmation Dialog for Mutating / Destructive Classroom Actions */}
      {pendingMutation &&
        (() => {
          const copy = getMutationDialogCopy(pendingMutation);
          return (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="classroom-confirm-title"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-[#0D1117]/80 backdrop-blur-sm"
            >
              <div className="w-full max-w-md bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 space-y-5 shadow-2xl">
                <div className="space-y-2">
                  <h3
                    id="classroom-confirm-title"
                    className="text-base font-bold text-slate-900 dark:text-[#F0F2F5]"
                  >
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
