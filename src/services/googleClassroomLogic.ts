export const GOOGLE_CLASSROOM_PROJECT_ID = 'ancient-cosmos-p01dl';

/**
 * Full set of Google Classroom OAuth scopes configured for LernWelt.
 */
export const GOOGLE_CLASSROOM_SCOPES: readonly string[] = [
  'https://www.googleapis.com/auth/classroom.addons.student',
  'https://www.googleapis.com/auth/classroom.addons.teacher',
  'https://www.googleapis.com/auth/classroom.announcements',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/classroom.guardianlinks.me.readonly',
  'https://www.googleapis.com/auth/classroom.guardianlinks.students',
  'https://www.googleapis.com/auth/classroom.guardianlinks.students.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/classroom.profile.photos',
  'https://www.googleapis.com/auth/classroom.push-notifications',
  'https://www.googleapis.com/auth/classroom.rosters',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
  'https://www.googleapis.com/auth/classroom.topics',
  'https://www.googleapis.com/auth/classroom.topics.readonly'
] as const;

export const GOOGLE_CLASSROOM_CONSOLE_API_URL = `https://console.cloud.google.com/apis/library/classroom.googleapis.com?project=${GOOGLE_CLASSROOM_PROJECT_ID}`;

export type ClassroomCourseState =
  | 'ACTIVE'
  | 'ARCHIVED'
  | 'PROVISIONED'
  | 'DECLINED'
  | 'SUSPENDED'
  | 'COURSE_STATE_UNSPECIFIED';

export interface ClassroomCourse {
  id: string;
  name: string;
  section: string;
  descriptionHeading: string;
  description: string;
  room: string;
  ownerId: string;
  courseState: ClassroomCourseState;
  alternateLink: string;
  enrollmentCode: string;
  teacherGroupEmail: string;
  updateTime: string;
}

export interface ClassroomAttachmentLink {
  kind: 'drive' | 'youtube' | 'link' | 'form';
  title: string;
  url: string;
}

export interface ClassroomAnnouncement {
  id: string;
  courseId: string;
  text: string;
  state: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  updateTime: string;
  creationTime: string;
  alternateLink: string;
  creatorUserId: string;
  attachments: ClassroomAttachmentLink[];
}

export interface ClassroomCourseWork {
  id: string;
  courseId: string;
  title: string;
  description: string;
  state: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  workType: 'ASSIGNMENT' | 'SHORT_ANSWER_QUESTION' | 'MULTIPLE_CHOICE_QUESTION' | 'COURSE_WORK_TYPE_UNSPECIFIED';
  dueDateStr: string;
  maxPoints: number | null;
  topicId: string;
  alternateLink: string;
  updateTime: string;
  attachments: ClassroomAttachmentLink[];
}

export interface ClassroomMaterialItem {
  id: string;
  courseId: string;
  title: string;
  description: string;
  state: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  topicId: string;
  alternateLink: string;
  updateTime: string;
  attachments: ClassroomAttachmentLink[];
}

export interface ClassroomTopic {
  topicId: string;
  courseId: string;
  name: string;
  updateTime: string;
}

export interface ClassroomRosterMember {
  userId: string;
  courseId: string;
  role: 'TEACHER' | 'STUDENT';
  fullName: string;
  emailAddress: string;
  photoUrl: string;
}

export interface ClassroomSubmission {
  id: string;
  courseWorkId: string;
  userId: string;
  state: 'NEW' | 'CREATED' | 'TURNED_IN' | 'RETURNED' | 'RECLAIMED_BY_STUDENT' | 'SUBMISSION_STATE_UNSPECIFIED';
  assignedGrade?: number;
  draftGrade?: number;
  late: boolean;
  alternateLink: string;
  updateTime: string;
}

export type ClassroomErrorKind =
  | 'token_expired'
  | 'api_not_enabled'
  | 'insufficient_scopes'
  | 'permission_denied'
  | 'not_found'
  | 'rate_limited'
  | 'invalid_argument'
  | 'network_error'
  | 'unknown';

export interface ClassifiedClassroomError {
  kind: ClassroomErrorKind;
  status: number;
  title: string;
  message: string;
  requiresReauth: boolean;
  actionUrl?: string;
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatClassroomDueDate(
  dueDate?: { year?: number; month?: number; day?: number } | null,
  dueTime?: { hours?: number; minutes?: number } | null
): string {
  if (!dueDate || typeof dueDate.year !== 'number' || typeof dueDate.month !== 'number' || typeof dueDate.day !== 'number') {
    return '';
  }
  const datePart = `${dueDate.year}-${padTwo(dueDate.month)}-${padTwo(dueDate.day)}`;
  if (dueTime && typeof dueTime.hours === 'number') {
    const mins = typeof dueTime.minutes === 'number' ? dueTime.minutes : 0;
    return `${datePart} ${padTwo(dueTime.hours)}:${padTwo(mins)}`;
  }
  return datePart;
}

export function parseDueDateInput(dateStr?: string | null): { year: number; month: number; day: number } | undefined {
  const trimmed = (dateStr || '').trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return { year, month, day };
}

export function extractClassroomAttachments(rawMaterials: any): ClassroomAttachmentLink[] {
  if (!Array.isArray(rawMaterials)) return [];
  const results: ClassroomAttachmentLink[] = [];

  for (const item of rawMaterials) {
    if (!item || typeof item !== 'object') continue;
    if (item.driveFile?.driveFile?.alternateLink) {
      results.push({
        kind: 'drive',
        title: String(item.driveFile.driveFile.title || 'Google Drive File'),
        url: String(item.driveFile.driveFile.alternateLink)
      });
    } else if (item.youtubeVideo?.alternateLink) {
      results.push({
        kind: 'youtube',
        title: String(item.youtubeVideo.title || 'YouTube Video'),
        url: String(item.youtubeVideo.alternateLink)
      });
    } else if (item.link?.url) {
      results.push({
        kind: 'link',
        title: String(item.link.title || item.link.url),
        url: String(item.link.url)
      });
    } else if (item.form?.formUrl) {
      results.push({
        kind: 'form',
        title: String(item.form.title || 'Google Form'),
        url: String(item.form.formUrl)
      });
    }
  }

  return results;
}

export function normalizeClassroomCourses(rawCourses: any[]): ClassroomCourse[] {
  if (!Array.isArray(rawCourses)) return [];
  return rawCourses
    .filter((c) => c && typeof c.id === 'string')
    .map((c) => ({
      id: String(c.id),
      name: String(c.name || '').trim() || '(Untitled Course)',
      section: typeof c.section === 'string' ? c.section : '',
      descriptionHeading: typeof c.descriptionHeading === 'string' ? c.descriptionHeading : '',
      description: typeof c.description === 'string' ? c.description : '',
      room: typeof c.room === 'string' ? c.room : '',
      ownerId: typeof c.ownerId === 'string' ? c.ownerId : '',
      courseState: (c.courseState as ClassroomCourseState) || 'ACTIVE',
      alternateLink: typeof c.alternateLink === 'string' ? c.alternateLink : '',
      enrollmentCode: typeof c.enrollmentCode === 'string' ? c.enrollmentCode : '',
      teacherGroupEmail: typeof c.teacherGroupEmail === 'string' ? c.teacherGroupEmail : '',
      updateTime: typeof c.updateTime === 'string' ? c.updateTime : ''
    }));
}

export function normalizeClassroomAnnouncements(rawList: any[], courseId: string): ClassroomAnnouncement[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((a) => a && typeof a.id === 'string' && a.state !== 'DELETED')
    .map((a) => ({
      id: String(a.id),
      courseId: String(a.courseId || courseId),
      text: String(a.text || '').trim(),
      state: a.state === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
      updateTime: typeof a.updateTime === 'string' ? a.updateTime : '',
      creationTime: typeof a.creationTime === 'string' ? a.creationTime : '',
      alternateLink: typeof a.alternateLink === 'string' ? a.alternateLink : '',
      creatorUserId: typeof a.creatorUserId === 'string' ? a.creatorUserId : '',
      attachments: extractClassroomAttachments(a.materials)
    }));
}

export function normalizeClassroomCourseWork(rawList: any[], courseId: string): ClassroomCourseWork[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((w) => w && typeof w.id === 'string' && w.state !== 'DELETED')
    .map((w) => ({
      id: String(w.id),
      courseId: String(w.courseId || courseId),
      title: String(w.title || '').trim() || '(Untitled Assignment)',
      description: typeof w.description === 'string' ? w.description : '',
      state: w.state === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
      workType: w.workType || 'ASSIGNMENT',
      dueDateStr: formatClassroomDueDate(w.dueDate, w.dueTime),
      maxPoints: typeof w.maxPoints === 'number' ? w.maxPoints : null,
      topicId: typeof w.topicId === 'string' ? w.topicId : '',
      alternateLink: typeof w.alternateLink === 'string' ? w.alternateLink : '',
      updateTime: typeof w.updateTime === 'string' ? w.updateTime : '',
      attachments: extractClassroomAttachments(w.materials)
    }));
}

export function normalizeClassroomMaterials(rawList: any[], courseId: string): ClassroomMaterialItem[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((m) => m && typeof m.id === 'string' && m.state !== 'DELETED')
    .map((m) => ({
      id: String(m.id),
      courseId: String(m.courseId || courseId),
      title: String(m.title || '').trim() || '(Untitled Material)',
      description: typeof m.description === 'string' ? m.description : '',
      state: m.state === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
      topicId: typeof m.topicId === 'string' ? m.topicId : '',
      alternateLink: typeof m.alternateLink === 'string' ? m.alternateLink : '',
      updateTime: typeof m.updateTime === 'string' ? m.updateTime : '',
      attachments: extractClassroomAttachments(m.materials)
    }));
}

export function normalizeClassroomTopics(rawList: any[], courseId: string): ClassroomTopic[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((t) => t && typeof t.topicId === 'string')
    .map((t) => ({
      topicId: String(t.topicId),
      courseId: String(t.courseId || courseId),
      name: String(t.name || '').trim() || '(Untitled Topic)',
      updateTime: typeof t.updateTime === 'string' ? t.updateTime : ''
    }));
}

export function normalizeClassroomRoster(
  rawList: any[],
  courseId: string,
  role: 'TEACHER' | 'STUDENT'
): ClassroomRosterMember[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((m) => m && typeof m.userId === 'string')
    .map((m) => {
      const profile = m.profile || {};
      const rawPhoto = typeof profile.photoUrl === 'string' ? profile.photoUrl : '';
      const normalizedPhoto = rawPhoto.startsWith('//') ? `https:${rawPhoto}` : rawPhoto;
      return {
        userId: String(m.userId),
        courseId: String(m.courseId || courseId),
        role,
        fullName: String(profile.name?.fullName || profile.emailAddress || 'Classroom Member'),
        emailAddress: typeof profile.emailAddress === 'string' ? profile.emailAddress : '',
        photoUrl: normalizedPhoto
      };
    });
}

export function normalizeClassroomSubmissions(rawList: any[], courseWorkId: string): ClassroomSubmission[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((s) => s && typeof s.id === 'string')
    .map((s) => ({
      id: String(s.id),
      courseWorkId: String(s.courseWorkId || courseWorkId),
      userId: String(s.userId || ''),
      state: s.state || 'NEW',
      assignedGrade: typeof s.assignedGrade === 'number' ? s.assignedGrade : undefined,
      draftGrade: typeof s.draftGrade === 'number' ? s.draftGrade : undefined,
      late: Boolean(s.late),
      alternateLink: typeof s.alternateLink === 'string' ? s.alternateLink : '',
      updateTime: typeof s.updateTime === 'string' ? s.updateTime : ''
    }));
}

export function filterClassroomCourses(
  courses: ClassroomCourse[],
  stateFilter: 'ALL' | 'ACTIVE' | 'ARCHIVED',
  searchQuery: string
): ClassroomCourse[] {
  const q = (searchQuery || '').trim().toLowerCase();
  return courses.filter((course) => {
    if (stateFilter === 'ACTIVE' && course.courseState !== 'ACTIVE' && course.courseState !== 'PROVISIONED') {
      return false;
    }
    if (stateFilter === 'ARCHIVED' && course.courseState !== 'ARCHIVED') {
      return false;
    }
    if (!q) return true;
    return (
      course.name.toLowerCase().includes(q) ||
      course.section.toLowerCase().includes(q) ||
      course.room.toLowerCase().includes(q) ||
      course.descriptionHeading.toLowerCase().includes(q)
    );
  });
}

export function validateCourseDraft(input: {
  name: string;
  section?: string;
  room?: string;
  descriptionHeading?: string;
}): {
  valid: boolean;
  error?: string;
  normalized: { name: string; section: string; room: string; descriptionHeading: string };
} {
  const name = (input.name || '').trim();
  const section = (input.section || '').trim();
  const room = (input.room || '').trim();
  const descriptionHeading = (input.descriptionHeading || '').trim();

  if (!name) {
    return {
      valid: false,
      error: 'Course name is required.',
      normalized: { name: '', section, room, descriptionHeading }
    };
  }
  if (name.length > 150) {
    return {
      valid: false,
      error: 'Course name must be 150 characters or fewer.',
      normalized: { name, section, room, descriptionHeading }
    };
  }
  return {
    valid: true,
    normalized: { name, section, room, descriptionHeading }
  };
}

export function validateAnnouncementDraft(input: { text: string }): {
  valid: boolean;
  error?: string;
  normalized: { text: string };
} {
  const text = (input.text || '').trim();
  if (!text) {
    return {
      valid: false,
      error: 'Announcement text cannot be empty.',
      normalized: { text: '' }
    };
  }
  if (text.length > 10_000) {
    return {
      valid: false,
      error: 'Announcement text must be 10,000 characters or fewer.',
      normalized: { text }
    };
  }
  return {
    valid: true,
    normalized: { text }
  };
}

export function validateCourseWorkDraft(input: {
  title: string;
  description?: string;
  dueDate?: string;
  maxPoints?: string | number;
}): {
  valid: boolean;
  error?: string;
  normalized: {
    title: string;
    description: string;
    dueDate?: { year: number; month: number; day: number };
    maxPoints?: number;
  };
} {
  const title = (input.title || '').trim();
  const description = (input.description || '').trim();
  const rawDate = (input.dueDate || '').trim();

  if (!title) {
    return {
      valid: false,
      error: 'Assignment title is required.',
      normalized: { title: '', description }
    };
  }
  if (title.length > 200) {
    return {
      valid: false,
      error: 'Assignment title must be 200 characters or fewer.',
      normalized: { title, description }
    };
  }

  let dueDate: { year: number; month: number; day: number } | undefined;
  if (rawDate) {
    dueDate = parseDueDateInput(rawDate);
    if (!dueDate) {
      return {
        valid: false,
        error: 'Due date must be formatted as YYYY-MM-DD.',
        normalized: { title, description }
      };
    }
  }

  let maxPoints: number | undefined;
  if (input.maxPoints !== undefined && String(input.maxPoints).trim() !== '') {
    const parsedPoints = Number(input.maxPoints);
    if (!Number.isFinite(parsedPoints) || parsedPoints < 0 || parsedPoints > 10000) {
      return {
        valid: false,
        error: 'Max points must be a valid number between 0 and 10000.',
        normalized: { title, description, dueDate }
      };
    }
    maxPoints = parsedPoints;
  }

  return {
    valid: true,
    normalized: { title, description, dueDate, maxPoints }
  };
}

export function validateTopicDraft(input: { name: string }): {
  valid: boolean;
  error?: string;
  normalized: { name: string };
} {
  const name = (input.name || '').trim();
  if (!name) {
    return {
      valid: false,
      error: 'Topic name is required.',
      normalized: { name: '' }
    };
  }
  if (name.length > 100) {
    return {
      valid: false,
      error: 'Topic name must be 100 characters or fewer.',
      normalized: { name }
    };
  }
  return {
    valid: true,
    normalized: { name }
  };
}

export function classifyClassroomApiError(
  status: number,
  rawBody: string,
  projectId: string = GOOGLE_CLASSROOM_PROJECT_ID
): ClassifiedClassroomError {
  let rawMsg = `Google Classroom API returned HTTP ${status}.`;
  if (rawBody && rawBody.trim()) {
    try {
      const parsed = JSON.parse(rawBody);
      if (typeof parsed?.error?.message === 'string') {
        rawMsg = parsed.error.message;
      } else if (typeof parsed?.message === 'string') {
        rawMsg = parsed.message;
      } else {
        rawMsg = rawBody.trim().slice(0, 300);
      }
    } catch {
      rawMsg = rawBody.trim().slice(0, 300);
    }
  }

  const lower = rawMsg.toLowerCase();
  const consoleUrl = `https://console.cloud.google.com/apis/library/classroom.googleapis.com?project=${projectId}`;

  if (status === 401) {
    return {
      kind: 'token_expired',
      status,
      title: 'Google Classroom Session Expired',
      message: 'Your Google OAuth access token expired. Sign in with Google again to continue using Google Classroom.',
      requiresReauth: true
    };
  }

  if (
    status === 403 &&
    (lower.includes('classroom.googleapis.com') ||
      lower.includes('accessnotconfigured') ||
      lower.includes('has not been used in project') ||
      lower.includes('is disabled'))
  ) {
    return {
      kind: 'api_not_enabled',
      status,
      title: 'Enable Google Classroom API in Google Cloud Console',
      message:
        'The Google Classroom API is not yet enabled on your Google Cloud project. Enable Google Classroom API in Cloud Console and retry.',
      requiresReauth: false,
      actionUrl: consoleUrl
    };
  }

  if (
    status === 403 &&
    (lower.includes('insufficient authentication scopes') ||
      lower.includes('insufficient permission') ||
      lower.includes('scope'))
  ) {
    return {
      kind: 'insufficient_scopes',
      status,
      title: 'Google Classroom Permission Needed',
      message:
        'Please sign in with Google again and approve the requested Google Classroom permissions.',
      requiresReauth: true
    };
  }

  if (status === 403) {
    return {
      kind: 'permission_denied',
      status,
      title: 'Classroom Permission Denied',
      message: rawMsg,
      requiresReauth: false
    };
  }

  if (status === 404) {
    return {
      kind: 'not_found',
      status,
      title: 'Classroom Resource Not Found',
      message: 'The requested course, post, or assignment could not be found in Google Classroom.',
      requiresReauth: false
    };
  }

  if (status === 429) {
    return {
      kind: 'rate_limited',
      status,
      title: 'Google Classroom Rate Limit Reached',
      message: 'Too many requests to Google Classroom. Please wait a moment and try again.',
      requiresReauth: false
    };
  }

  if (status === 400) {
    return {
      kind: 'invalid_argument',
      status,
      title: 'Invalid Classroom Request',
      message: rawMsg,
      requiresReauth: false
    };
  }

  return {
    kind: 'unknown',
    status,
    title: `Google Classroom Error (${status})`,
    message: rawMsg,
    requiresReauth: false,
    actionUrl: status >= 400 ? consoleUrl : undefined
  };
}
