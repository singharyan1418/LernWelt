import {
  getWorkspaceAccessToken,
  getWorkspaceCurrentUser,
  invalidateWorkspaceAccessToken,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
  subscribeWorkspaceAuth
} from './googleWorkspaceAuth';
import {
  ClassifiedClassroomError,
  ClassroomAnnouncement,
  ClassroomCourse,
  ClassroomCourseState,
  ClassroomCourseWork,
  ClassroomMaterialItem,
  ClassroomRosterMember,
  ClassroomSubmission,
  ClassroomTopic,
  classifyClassroomApiError,
  normalizeClassroomAnnouncements,
  normalizeClassroomCourseWork,
  normalizeClassroomCourses,
  normalizeClassroomMaterials,
  normalizeClassroomRoster,
  normalizeClassroomSubmissions,
  normalizeClassroomTopics
} from './googleClassroomLogic';

const CLASSROOM_API_BASE = 'https://classroom.googleapis.com/v1';

export class GoogleClassroomApiException extends Error {
  classified: ClassifiedClassroomError;

  constructor(classified: ClassifiedClassroomError) {
    super(classified.message);
    this.name = 'GoogleClassroomApiException';
    this.classified = classified;
  }
}

export const initClassroomAuth = subscribeWorkspaceAuth;
export const signInToClassroom = signInWithGoogleWorkspace;
export const signOutFromClassroom = signOutGoogleWorkspace;
export const getClassroomAccessToken = getWorkspaceAccessToken;
export const getClassroomCurrentUser = getWorkspaceCurrentUser;

async function classroomFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new GoogleClassroomApiException({
      kind: 'token_expired',
      status: 401,
      title: 'Google Sign-In Required',
      message: 'Please sign in with Google to access your Google Classroom courses and coursework.',
      requiresReauth: true
    });
  }

  let response: Response;
  try {
    response = await fetch(`${CLASSROOM_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {})
      }
    });
  } catch (err: any) {
    throw new GoogleClassroomApiException({
      kind: 'network_error',
      status: 0,
      title: 'Network Error',
      message: err?.message || 'Unable to connect to Google Classroom.',
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
    if (response.status === 401) {
      invalidateWorkspaceAccessToken();
    }
    throw new GoogleClassroomApiException(classifyClassroomApiError(response.status, text));
  }

  return parsed as T;
}

export async function listClassroomCourses(): Promise<ClassroomCourse[]> {
  const data = await classroomFetch<{ courses?: any[] }>('/courses?pageSize=50');
  return normalizeClassroomCourses(data?.courses || []);
}

export async function createClassroomCourse(input: {
  name: string;
  section?: string;
  room?: string;
  descriptionHeading?: string;
}): Promise<ClassroomCourse> {
  const payload: Record<string, any> = {
    name: input.name,
    ownerId: 'me'
  };
  if (input.section) payload.section = input.section;
  if (input.room) payload.room = input.room;
  if (input.descriptionHeading) payload.descriptionHeading = input.descriptionHeading;

  const created = await classroomFetch<any>('/courses', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return normalizeClassroomCourses([created])[0];
}

export async function updateClassroomCourseState(
  courseId: string,
  courseState: Extract<ClassroomCourseState, 'ACTIVE' | 'ARCHIVED'>
): Promise<ClassroomCourse> {
  const updated = await classroomFetch<any>(
    `/courses/${encodeURIComponent(courseId)}?updateMask=courseState`,
    {
      method: 'PATCH',
      body: JSON.stringify({ courseState })
    }
  );
  return normalizeClassroomCourses([updated])[0];
}

export async function deleteClassroomCourse(courseId: string): Promise<void> {
  await classroomFetch(`/courses/${encodeURIComponent(courseId)}`, {
    method: 'DELETE'
  });
}

export async function listCourseAnnouncements(courseId: string): Promise<ClassroomAnnouncement[]> {
  const data = await classroomFetch<{ announcements?: any[] }>(
    `/courses/${encodeURIComponent(courseId)}/announcements?pageSize=30`
  );
  return normalizeClassroomAnnouncements(data?.announcements || [], courseId);
}

export async function createCourseAnnouncement(
  courseId: string,
  text: string
): Promise<ClassroomAnnouncement> {
  const created = await classroomFetch<any>(
    `/courses/${encodeURIComponent(courseId)}/announcements`,
    {
      method: 'POST',
      body: JSON.stringify({
        text,
        state: 'PUBLISHED'
      })
    }
  );
  return normalizeClassroomAnnouncements([created], courseId)[0];
}

export async function deleteCourseAnnouncement(
  courseId: string,
  announcementId: string
): Promise<void> {
  await classroomFetch(
    `/courses/${encodeURIComponent(courseId)}/announcements/${encodeURIComponent(announcementId)}`,
    { method: 'DELETE' }
  );
}

export async function listCourseWork(courseId: string): Promise<ClassroomCourseWork[]> {
  const data = await classroomFetch<{ courseWork?: any[] }>(
    `/courses/${encodeURIComponent(courseId)}/courseWork?pageSize=50`
  );
  return normalizeClassroomCourseWork(data?.courseWork || [], courseId);
}

export async function createCourseWork(
  courseId: string,
  input: {
    title: string;
    description?: string;
    dueDate?: { year: number; month: number; day: number };
    maxPoints?: number;
    topicId?: string;
  }
): Promise<ClassroomCourseWork> {
  const payload: Record<string, any> = {
    title: input.title,
    workType: 'ASSIGNMENT',
    state: 'PUBLISHED'
  };
  if (input.description) payload.description = input.description;
  if (input.dueDate) {
    payload.dueDate = input.dueDate;
    payload.dueTime = { hours: 23, minutes: 59 };
  }
  if (typeof input.maxPoints === 'number') payload.maxPoints = input.maxPoints;
  if (input.topicId) payload.topicId = input.topicId;

  const created = await classroomFetch<any>(
    `/courses/${encodeURIComponent(courseId)}/courseWork`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
  return normalizeClassroomCourseWork([created], courseId)[0];
}

export async function deleteCourseWork(courseId: string, courseWorkId: string): Promise<void> {
  await classroomFetch(
    `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}`,
    { method: 'DELETE' }
  );
}

export async function listCourseWorkMaterials(courseId: string): Promise<ClassroomMaterialItem[]> {
  const data = await classroomFetch<{ courseWorkMaterial?: any[] }>(
    `/courses/${encodeURIComponent(courseId)}/courseWorkMaterials?pageSize=50`
  );
  return normalizeClassroomMaterials(data?.courseWorkMaterial || [], courseId);
}

export async function listCourseTopics(courseId: string): Promise<ClassroomTopic[]> {
  const data = await classroomFetch<{ topic?: any[] }>(
    `/courses/${encodeURIComponent(courseId)}/topics?pageSize=50`
  );
  return normalizeClassroomTopics(data?.topic || [], courseId);
}

export async function createCourseTopic(courseId: string, name: string): Promise<ClassroomTopic> {
  const created = await classroomFetch<any>(
    `/courses/${encodeURIComponent(courseId)}/topics`,
    {
      method: 'POST',
      body: JSON.stringify({ name })
    }
  );
  return normalizeClassroomTopics([created], courseId)[0];
}

export async function listCourseTeachers(courseId: string): Promise<ClassroomRosterMember[]> {
  const data = await classroomFetch<{ teachers?: any[] }>(
    `/courses/${encodeURIComponent(courseId)}/teachers?pageSize=50`
  );
  return normalizeClassroomRoster(data?.teachers || [], courseId, 'TEACHER');
}

export async function listCourseStudents(courseId: string): Promise<ClassroomRosterMember[]> {
  const data = await classroomFetch<{ students?: any[] }>(
    `/courses/${encodeURIComponent(courseId)}/students?pageSize=50`
  );
  return normalizeClassroomRoster(data?.students || [], courseId, 'STUDENT');
}

export async function listStudentSubmissions(
  courseId: string,
  courseWorkId: string
): Promise<ClassroomSubmission[]> {
  const data = await classroomFetch<{ studentSubmissions?: any[] }>(
    `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions?pageSize=50`
  );
  return normalizeClassroomSubmissions(data?.studentSubmissions || [], courseWorkId);
}
