import {
  LanguageRoom,
  PersonalTeacher,
  TeacherLessonBooking,
  TeacherSpecialty,
  UserProfile
} from '../types';
import { createInitialsAvatarDataUri } from '../data/teacherData';
import { generateUniqueUserId } from './roomSessionUtils';

export interface TeacherFilterOptions {
  search?: string;
  language?: string;
  specialty?: TeacherSpecialty | 'all';
  availableNowOnly?: boolean;
}

export interface BookingValidationInput {
  slotLabel: string;
  learningGoal: string;
  focusArea?: string;
}

export interface TeacherRegistrationInput {
  name: string;
  languageName: string;
  credentials: string;
  bio: string;
  lessonFocus: string;
}

export interface ValidationOutcome {
  valid: boolean;
  error?: string;
}

const LANGUAGE_META_MAP: Record<string, { code: string; flag: string }> = {
  english: { code: 'en', flag: '🇬🇧' },
  german: { code: 'de', flag: '🇩🇪' },
  spanish: { code: 'es', flag: '🇪🇸' },
  french: { code: 'fr', flag: '🇫🇷' },
  italian: { code: 'it', flag: '🇮🇹' },
  japanese: { code: 'ja', flag: '🇯🇵' },
  mandarin: { code: 'zh', flag: '🇨🇳' },
  portuguese: { code: 'pt', flag: '🇵🇹' }
};

/**
 * Resolves language code and flag from a language name or code.
 */
export function resolveLanguageMeta(languageInput: string): {
  code: string;
  name: string;
  flag: string;
} {
  const clean = (languageInput || '').trim();
  const key = clean.toLowerCase();
  if (LANGUAGE_META_MAP[key]) {
    const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    return {
      code: LANGUAGE_META_MAP[key].code,
      name: capitalized,
      flag: LANGUAGE_META_MAP[key].flag
    };
  }
  const byCode = Object.entries(LANGUAGE_META_MAP).find(([, v]) => v.code === key);
  if (byCode) {
    const name = byCode[0].charAt(0).toUpperCase() + byCode[0].slice(1);
    return { code: byCode[1].code, name, flag: byCode[1].flag };
  }
  return {
    code: 'en',
    name: clean || 'English',
    flag: '🌐'
  };
}

/**
 * Ensures EVERY user visiting LernWelt immediately receives a complete, unique UserProfile
 * with full open access to all platform features (Chat Rooms, Personal Teachers, AI Drills,
 * Grammar Lab, Vocabulary Bank, and Events & Games) without a login barrier.
 */
export function provisionUniversalUserProfile(
  savedJson: string | null,
  urlNameParam: string | null,
  defaultProfile: UserProfile
): UserProfile {
  const cleanUrlName = urlNameParam?.trim() || '';

  if (savedJson) {
    try {
      const parsed = JSON.parse(savedJson);
      if (parsed && typeof parsed === 'object' && typeof parsed.name === 'string' && parsed.name.trim()) {
        const safeId =
          !parsed.id || parsed.id === 'usr_main_992'
            ? generateUniqueUserId('usr')
            : String(parsed.id);
        const resolvedName = cleanUrlName || parsed.name.trim();
        const fallbackAvatar = createInitialsAvatarDataUri(resolvedName, '#4f46e5');
        return {
          ...defaultProfile,
          ...parsed,
          id: safeId,
          name: resolvedName,
          avatarUrl: parsed.avatarUrl || fallbackAvatar,
          isOnline: true
        };
      }
    } catch {
      // Fall through to fresh universal profile provisioning
    }
  }

  const displayName = cleanUrlName || defaultProfile.name || 'Alex Learner';
  const uniqueId = generateUniqueUserId('usr');
  return {
    ...defaultProfile,
    id: uniqueId,
    name: displayName,
    avatarUrl: createInitialsAvatarDataUri(displayName, '#4f46e5'),
    isOnline: true
  };
}

/**
 * Deterministic 1-on-1 classroom ID for any Personal Teacher so student and teacher
 * connect in the exact same live WebRTC video, voice, screen-share & chat room.
 */
export function buildTeacherRoomId(teacherId: string): string {
  const sanitized = (teacherId || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-');
  return sanitized.startsWith('teacher-room-') ? sanitized : `teacher-room-${sanitized}`;
}

/**
 * Builds a complete LanguageRoom object for a 1-on-1 Personal Teacher live classroom.
 */
export function buildTeacherClassroomRoom(
  teacher: PersonalTeacher,
  studentName?: string
): LanguageRoom {
  const roomId = buildTeacherRoomId(teacher.id);
  const subtitle = studentName
    ? `1-on-1 Personal Lesson · ${teacher.name} & ${studentName}`
    : `1-on-1 Personal Teacher Classroom with ${teacher.name}`;

  return {
    id: roomId,
    languageCode: teacher.languageCode,
    languageName: teacher.languageName,
    flag: teacher.flag,
    title: `1-on-1 Lesson: ${teacher.name}`,
    subtitle,
    currentTopic: teacher.lessonFocus,
    levelRange: teacher.cefrRange,
    activeLearnersCount: 1,
    activeNativesCount: 1,
    roomKind: 'teacher-classroom',
    welcomeMessage: `Welcome to your 1-on-1 classroom with ${teacher.name} (${teacher.credentials}). Start camera, voice, screen share, or live chat whenever you are ready.`,
    suggestedPhrases: [
      `Hello ${teacher.name}, here is what I want to focus on today.`,
      'Could you correct my grammar and pronunciation as we speak?',
      'Let us practice a short roleplay together.'
    ],
    host: {
      id: teacher.id,
      name: teacher.name,
      avatarUrl: teacher.avatarUrl,
      country: teacher.country,
      countryCode: teacher.flag,
      nativeLanguage: teacher.languageName,
      learningLanguage: teacher.alsoSpeaks[0] || 'English',
      learningLevel: 'C2',
      rating: teacher.rating,
      reviewCount: Math.max(12, Math.round(teacher.lessonsCompleted / 5)),
      sessionsCompleted: teacher.lessonsCompleted,
      isOnline: teacher.availability === 'Available Now',
      interests: teacher.specialties,
      bio: teacher.bio,
      availability: teacher.availability === 'Available Now' ? 'Available Now' : 'Later Today',
      verifiedNative: true
    }
  };
}

/**
 * Pure filtering and sorting for the Personal Teachers directory and sidebar column.
 */
export function filterPersonalTeachers(
  teachers: PersonalTeacher[],
  options: TeacherFilterOptions = {}
): PersonalTeacher[] {
  const query = (options.search || '').trim().toLowerCase();
  const lang = (options.language || 'all').trim().toLowerCase();
  const specialty = options.specialty || 'all';
  const availableNowOnly = Boolean(options.availableNowOnly);

  return teachers
    .filter(teacher => {
      if (availableNowOnly && teacher.availability !== 'Available Now') {
        return false;
      }

      if (lang !== 'all') {
        const matchesLang =
          teacher.languageCode.toLowerCase() === lang ||
          teacher.languageName.toLowerCase() === lang;
        if (!matchesLang) return false;
      }

      if (specialty !== 'all') {
        if (!teacher.specialties.includes(specialty)) {
          return false;
        }
      }

      if (query) {
        const haystack = [
          teacher.name,
          teacher.languageName,
          teacher.country,
          teacher.credentials,
          teacher.bio,
          teacher.lessonFocus,
          ...teacher.specialties,
          ...teacher.alsoSpeaks
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      const availScoreA = a.availability === 'Available Now' ? 1 : 0;
      const availScoreB = b.availability === 'Available Now' ? 1 : 0;
      if (availScoreA !== availScoreB) return availScoreB - availScoreA;
      return b.rating - a.rating;
    });
}

/**
 * Validates 1-on-1 Personal Teacher booking form inputs.
 * Never silently substitutes fallback text when required inputs are missing.
 */
export function validateLessonBookingInput(input: BookingValidationInput): ValidationOutcome {
  const cleanSlot = (input.slotLabel || '').trim();
  const cleanGoal = (input.learningGoal || '').trim();

  if (!cleanSlot) {
    return { valid: false, error: 'Please choose a lesson time slot.' };
  }
  if (!cleanGoal) {
    return {
      valid: false,
      error: 'Please enter your learning goal or topic so your teacher can prepare.'
    };
  }
  if (cleanGoal.length < 5) {
    return {
      valid: false,
      error: 'Please describe your learning goal in at least 5 characters.'
    };
  }
  return { valid: true };
}

/**
 * Validates the community/certified Personal Teacher registration form.
 */
export function validateTeacherRegistrationInput(
  input: TeacherRegistrationInput
): ValidationOutcome {
  if (!(input.name || '').trim()) {
    return { valid: false, error: 'Please enter your full teaching name.' };
  }
  if (!(input.languageName || '').trim()) {
    return { valid: false, error: 'Please select the language you teach.' };
  }
  if (!(input.credentials || '').trim() || input.credentials.trim().length < 4) {
    return {
      valid: false,
      error: 'Please enter your teaching background or certification.'
    };
  }
  if (!(input.lessonFocus || '').trim() || input.lessonFocus.trim().length < 5) {
    return {
      valid: false,
      error: 'Please enter your primary 1-on-1 lesson focus.'
    };
  }
  if (!(input.bio || '').trim() || input.bio.trim().length < 10) {
    return {
      valid: false,
      error: 'Please write a short introduction (at least 10 characters) for learners.'
    };
  }
  return { valid: true };
}

/**
 * Idempotently merges personal teachers from server/WebSocket state without duplicates.
 */
export function mergePersonalTeachers(
  existing: PersonalTeacher[],
  incoming: PersonalTeacher | PersonalTeacher[]
): PersonalTeacher[] {
  const list = Array.isArray(incoming) ? incoming : [incoming];
  if (list.length === 0) return existing;

  const map = new Map<string, PersonalTeacher>();
  for (const item of existing) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  for (const item of list) {
    if (item && item.id) {
      const prev = map.get(item.id);
      map.set(item.id, prev ? { ...prev, ...item } : item);
    }
  }

  return Array.from(map.values());
}

/**
 * Idempotently merges 1-on-1 lesson bookings from server/WebSocket updates,
 * sorted newest first.
 */
export function mergeTeacherBookings(
  existing: TeacherLessonBooking[],
  incoming: TeacherLessonBooking | TeacherLessonBooking[]
): TeacherLessonBooking[] {
  const list = Array.isArray(incoming) ? incoming : [incoming];
  if (list.length === 0) return existing;

  const map = new Map<string, TeacherLessonBooking>();
  for (const b of existing) {
    if (b && b.id) {
      map.set(b.id, b);
    }
  }
  for (const b of list) {
    if (b && b.id) {
      const prev = map.get(b.id);
      map.set(b.id, prev ? { ...prev, ...b } : b);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
}
