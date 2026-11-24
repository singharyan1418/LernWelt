import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DesktopSidebar, Navbar } from './components/navbar/Navbar';
import { WebRTCRoom } from './components/video/WebRTCRoom';
import { LanguageLab } from './components/practice/LanguageLab';
import { VocabularyDeck } from './components/vocabulary/VocabularyDeck';
import { EventCalendarView } from './components/calendar/EventCalendarView';
import { ProfileView } from './components/profile/ProfileView';
import { LanguageOnboardingModal } from './components/onboarding/LanguageOnboardingModal';
import { RoomsDirectory } from './components/rooms/RoomsDirectory';
import { StreakModal } from './components/streak/StreakModal';
import { LoginInterface } from './components/auth/LoginInterface';
import { PersonalTeachersView } from './components/teachers/PersonalTeachersView';
import { AICoachView } from './components/ai/AICoachView';
import { VerifiedRandomConnect } from './components/random/VerifiedRandomConnect';
import { GmailWorkspaceView } from './components/gmail/GmailWorkspaceView';
import { GoogleTasksView } from './components/tasks/GoogleTasksView';
import { IncomingCallModal } from './components/video/IncomingCallModal';
import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import {
  AppNotification,
  PartnerConnectionRequest,
  aggregateAllNotifications,
  countUnreadNotifications,
  INITIAL_PARTNER_REQUESTS
} from './services/notificationService';
import { signOutFromGmail } from './services/gmailService';
import { realtimePresence, IncomingCallEvent, OnlineUser } from './services/realtimePresence';
import { initializeRealUserStreak, performDailyCheckIn, recordDrillCompletion } from './services/streakService';
import {
  PersistedLearningStats,
  accumulateRealPracticeSeconds,
  applyRealCorrectionEvent,
  buildPersistedStatsSnapshot,
  computeCorrectionCountFromAnalysis,
  computeCorrectionCountFromPronunciation,
  isActivePracticeContext,
  sanitizeToRealStatsProfile,
  sanitizeVocabularyDeck
} from './services/learningStatsService';
import {
  filterDirectoryVisibleRooms,
  isDirectoryVisibleRoom,
  resolveRoomFromId
} from './services/roomSessionUtils';
import {
  buildTeacherClassroomRoom,
  mergePersonalTeachers,
  mergeTeacherBookings,
  provisionUniversalUserProfile
} from './services/personalTeacherService';
import { INITIAL_PERSONAL_TEACHERS } from './data/teacherData';
import {
  ActiveTab,
  CEFRLevel,
  CorrectionResult,
  LanguageInfo,
  LanguageRoom,
  PersonalTeacher,
  PracticeDrill,
  PronunciationResult,
  TeacherLessonBooking,
  UserProfile,
  VocabularyWord
} from './types';
import {
  INITIAL_USER_PROFILE,
  LANGUAGE_ROOMS,
  SUPPORTED_LANGUAGES
} from './data/mockData';
import {
  getStoredNativeLanguage,
  localizeLanguageName,
  normalizeNativeLanguage,
  persistStoredNativeLanguage,
  t
} from './services/uiLocalization';
import {
  AppTheme,
  applyThemeToDocument,
  readStoredTheme,
  setAndApplyTheme
} from './services/themeService';
import {
  persistAudioNotificationsEnabled,
  playIncomingCallRingtone,
  readStoredAudioNotificationsEnabled
} from './services/audioNotificationService';
import { Sparkles } from 'lucide-react';

const VERIFIED_SESSION_STORAGE_KEY = 'lernwelt_verified_session_v2';
const SELECTED_LANG_STORAGE_KEY = 'lernwelt_selected_language_code';
const REAL_STATS_MIGRATED_KEY = 'lernwelt_real_stats_v1';
const SEEN_CORRECTIONS_STORAGE_KEY = 'lernwelt_seen_correction_ids';
const REAL_STREAK_STORAGE_KEY = 'lernwelt_real_streak';

function readInitialRealVocabulary(): VocabularyWord[] {
  try {
    const alreadyMigrated = Boolean(localStorage.getItem(REAL_STATS_MIGRATED_KEY));
    const savedVocab = localStorage.getItem('lernwelt_vocab_deck');
    if (savedVocab) {
      return sanitizeVocabularyDeck(JSON.parse(savedVocab), alreadyMigrated);
    }
  } catch {}
  return [];
}

function resolveInitialLanguage(profile: UserProfile): LanguageInfo {
  try {
    const savedCode = localStorage.getItem(SELECTED_LANG_STORAGE_KEY);
    if (savedCode) {
      const matchedByCode = SUPPORTED_LANGUAGES.find((l) => l.code === savedCode);
      if (matchedByCode) return matchedByCode;
    }
  } catch {}

  const firstTargetName = profile.targetLanguages?.[0]?.language;
  if (firstTargetName) {
    const matchedByName = SUPPORTED_LANGUAGES.find(
      (l) => l.name.toLowerCase() === firstTargetName.toLowerCase()
    );
    if (matchedByName) return matchedByName;
  }

  return SUPPORTED_LANGUAGES[1] || SUPPORTED_LANGUAGES[0];
}

const VALID_TABS: ActiveTab[] = [
  'chat-room',
  'random-connect',
  'ai-coach',
  'teachers',
  'ai-drills',
  'grammar-lab',
  'language-lab',
  'vocab-deck',
  'events-calendar',
  'events-games',
  'gmail',
  'tasks',
  'profile'
];

export default function App() {
  const initialSearch = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialRoomParam = initialSearch?.get('room') || null;
  const initialTabParam = initialSearch?.get('tab') as ActiveTab | null;
  const isAutostart = initialSearch?.get('autostart') === '1';

  const [invitedRoomId, setInvitedRoomId] = useState<string | null>(initialRoomParam);
  const [autoStartMediaMode, setAutoStartMediaMode] = useState<'video-and-audio' | 'audio-only' | undefined>(undefined);
  const [theme, setTheme] = useState<AppTheme>(() => readStoredTheme());
  const [audioNotificationsEnabled, setAudioNotificationsEnabled] = useState<boolean>(() =>
    readStoredAudioNotificationsEnabled()
  );

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const handleChangeTheme = (nextTheme: AppTheme) => {
    const applied = setAndApplyTheme(nextTheme);
    setTheme(applied);
  };

  const handleChangeAudioNotifications = (nextEnabled: boolean) => {
    const persisted = persistAudioNotificationsEnabled(nextEnabled);
    setAudioNotificationsEnabled(persisted);
  };

  // Hydrate verified session from localStorage (or provision verified session when ?autostart=1 is explicitly passed)
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const initialVocab = readInitialRealVocabulary();
    const storedNative = getStoredNativeLanguage();
    try {
      const savedVerifiedRaw = localStorage.getItem(VERIFIED_SESSION_STORAGE_KEY);
      if (savedVerifiedRaw) {
        const parsed = JSON.parse(savedVerifiedRaw);
        if (parsed && parsed.user && parsed.user.isVerified && parsed.user.verifiedId) {
          const restoredUser = parsed.user as UserProfile;
          const resolvedNative = storedNative || normalizeNativeLanguage(restoredUser.nativeLanguage);
          persistStoredNativeLanguage(resolvedNative);
          return sanitizeToRealStatsProfile(
            { ...restoredUser, nativeLanguage: resolvedNative },
            initialVocab
          );
        }
      }
    } catch {}

    const base = provisionUniversalUserProfile(
      null,
      initialSearch?.get('name') || null,
      INITIAL_USER_PROFILE
    );
    const resolvedNative = storedNative || normalizeNativeLanguage(base.nativeLanguage);
    persistStoredNativeLanguage(resolvedNative);

    if (isAutostart) {
      const suffix = base.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'AUTO01';
      return sanitizeToRealStatsProfile(
        {
          ...base,
          nativeLanguage: resolvedNative,
          isVerified: true,
          verifiedId: `LW-ID-${suffix}`,
          verifiedAt: Date.now()
        },
        initialVocab
      );
    }

    return sanitizeToRealStatsProfile(
      {
        ...base,
        nativeLanguage: resolvedNative,
        isVerified: false,
        verifiedId: undefined
      },
      initialVocab
    );
  });

  // Require 2-Step Password + Email OTP verification before entering the app (honoring ?autostart=1)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (isAutostart) return true;
    try {
      const savedVerifiedRaw = localStorage.getItem(VERIFIED_SESSION_STORAGE_KEY);
      if (savedVerifiedRaw) {
        const parsed = JSON.parse(savedVerifiedRaw);
        return Boolean(parsed?.user?.isVerified && parsed?.user?.verifiedId);
      }
    } catch {}
    return false;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (initialRoomParam) return 'chat-room';
    if (initialTabParam && VALID_TABS.includes(initialTabParam)) {
      return initialTabParam;
    }
    return 'chat-room';
  });
  const [roomsList, setRoomsList] = useState<LanguageRoom[]>(LANGUAGE_ROOMS);
  const [personalTeachers, setPersonalTeachers] = useState<PersonalTeacher[]>(INITIAL_PERSONAL_TEACHERS);
  const [teacherBookings, setTeacherBookings] = useState<TeacherLessonBooking[]>(() => {
    try {
      const saved = localStorage.getItem('lernwelt_teacher_bookings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const defaultBooking: TeacherLessonBooking = {
      id: 'booking_sample_01',
      teacherId: 'teacher_de_hannah',
      teacherName: 'Dr. Hannah Lindner',
      teacherAvatar: '',
      languageCode: 'de',
      languageName: 'German',
      flag: '🇩🇪',
      studentId: 'user_alex_mercer',
      studentName: 'Alex Mercer',
      slotLabel: 'Today · 19:30',
      learningGoal: 'Conversational Fluency & Case Systems',
      focusArea: 'Grammar & Writing',
      roomId: 'teacher-room-teacher_de_hannah-booking_sample_01',
      status: 'confirmed',
      createdAt: Date.now() - 1000 * 60 * 60 * 2
    };
    return [defaultBooking];
  });
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState<boolean>(false);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => new Set());
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(() => new Set());
  const [partnerRequests, setPartnerRequests] = useState<PartnerConnectionRequest[]>(() => {
    try {
      const saved = localStorage.getItem('lernwelt_partner_requests');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_PARTNER_REQUESTS;
  });
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageInfo>(() =>
    resolveInitialLanguage(userProfile)
  );
  const [currentRoom, setCurrentRoom] = useState<LanguageRoom>(() => {
    const initialLang = resolveInitialLanguage(userProfile);
    if (initialRoomParam) {
      return resolveRoomFromId(initialRoomParam, LANGUAGE_ROOMS, initialLang);
    }
    return LANGUAGE_ROOMS.find((r) => r.languageCode === initialLang.code) || LANGUAGE_ROOMS[0];
  });
  const [isInsideRoom, setIsInsideRoom] = useState<boolean>(() => Boolean(initialRoomParam));
  const [isRandomMatchActive, setIsRandomMatchActive] = useState<boolean>(false);
  const [vocabulary, setVocabulary] = useState<VocabularyWord[]>(() => readInitialRealVocabulary());
  const seenCorrectionIdsRef = useRef<Set<string>>(
    (() => {
      try {
        const raw = localStorage.getItem(SEEN_CORRECTIONS_STORAGE_KEY);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) return new Set(arr.map(String));
        }
      } catch {}
      return new Set<string>();
    })()
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [initialChatOpen, setInitialChatOpen] = useState<boolean>(false);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState<boolean>(false);
  const [labSubTab, setLabSubTab] = useState<'analyzer' | 'practice-drills' | 'pronunciation-trainer'>('analyzer');
  const [incomingCall, setIncomingCall] = useState<IncomingCallEvent | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  useEffect(() => {
    if (!incomingCall || !audioNotificationsEnabled) return;
    return playIncomingCallRingtone({ enabled: true });
  }, [incomingCall, audioNotificationsEnabled]);

  const latestUserProfileRef = useRef<UserProfile>(userProfile);
  latestUserProfileRef.current = userProfile;
  const latestVocabularyRef = useRef<VocabularyWord[]>(vocabulary);
  latestVocabularyRef.current = vocabulary;

  // Keep html[lang] and native language key synced whenever nativeLanguage updates
  useEffect(() => {
    persistStoredNativeLanguage(userProfile.nativeLanguage);
  }, [userProfile.nativeLanguage]);

  // Keep wordsLearned strictly matched to real Vocabulary Bank length
  useEffect(() => {
    setUserProfile((prev) =>
      prev.wordsLearned === vocabulary.length
        ? prev
        : { ...prev, wordsLearned: vocabulary.length, statsSource: 'real' }
    );
  }, [vocabulary.length]);

  // Persist Vocabulary Deck, real stats flag, and Teacher Bookings locally
  useEffect(() => {
    try {
      localStorage.setItem(REAL_STATS_MIGRATED_KEY, '1');
      localStorage.setItem('lernwelt_vocab_deck', JSON.stringify(vocabulary));
    } catch {}
  }, [vocabulary]);

  // Persist authentic userProfile & streak locally whenever stats or profile fields change
  useEffect(() => {
    if (!isLoggedIn) return;
    try {
      localStorage.setItem(REAL_STATS_MIGRATED_KEY, '1');
      localStorage.setItem('lernwelt_user', JSON.stringify(userProfile));
      if (userProfile.streak) {
        localStorage.setItem(REAL_STREAK_STORAGE_KEY, JSON.stringify(userProfile.streak));
      }
      if (userProfile.isVerified && userProfile.verifiedId) {
        const existingRaw = localStorage.getItem(VERIFIED_SESSION_STORAGE_KEY);
        const existingParsed = existingRaw ? JSON.parse(existingRaw) : {};
        localStorage.setItem(
          VERIFIED_SESSION_STORAGE_KEY,
          JSON.stringify({
            ...existingParsed,
            user: userProfile
          })
        );
      }
    } catch {}
  }, [isLoggedIn, userProfile]);

  // Real-time wall-clock Practice Timer: accrues seconds ONLY while inside active learning surfaces
  const practiceLastTickRef = useRef<number | null>(null);
  const practiceCarryMsRef = useRef<number>(0);

  const isPracticingNow =
    isLoggedIn &&
    isActivePracticeContext({
      activeTab,
      isInsideRoom,
      isRandomMatchActive
    });

  useEffect(() => {
    if (!isPracticingNow) {
      practiceLastTickRef.current = null;
      return;
    }

    const isPageVisible = () =>
      typeof document === 'undefined' || document.visibilityState === 'visible';

    if (isPageVisible()) {
      practiceLastTickRef.current = Date.now();
    } else {
      practiceLastTickRef.current = null;
    }

    const flushElapsedPractice = () => {
      if (practiceLastTickRef.current === null) return;
      const now = Date.now();
      const elapsedMs = Math.max(0, now - practiceLastTickRef.current) + practiceCarryMsRef.current;
      const wholeSeconds = Math.floor(elapsedMs / 1000);
      practiceCarryMsRef.current = elapsedMs % 1000;
      practiceLastTickRef.current = now;

      if (wholeSeconds > 0) {
        setUserProfile((prev) => accumulateRealPracticeSeconds(prev, wholeSeconds));
      }
    };

    const handleVisibilityChange = () => {
      if (isPageVisible()) {
        practiceLastTickRef.current = Date.now();
      } else {
        flushElapsedPractice();
        practiceLastTickRef.current = null;
      }
    };

    const interval = setInterval(() => {
      if (isPageVisible()) {
        flushElapsedPractice();
      }
    }, 2000);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      flushElapsedPractice();
      practiceLastTickRef.current = null;
    };
  }, [isPracticingNow]);

  useEffect(() => {
    try {
      localStorage.setItem('lernwelt_teacher_bookings', JSON.stringify(teacherBookings));
    } catch {}
  }, [teacherBookings]);

  useEffect(() => {
    try {
      localStorage.setItem('lernwelt_partner_requests', JSON.stringify(partnerRequests));
    } catch {}
  }, [partnerRequests]);

  const notifications = React.useMemo(() => {
    return aggregateAllNotifications(
      teacherBookings,
      personalTeachers,
      vocabulary,
      partnerRequests,
      readNotificationIds,
      dismissedNotificationIds
    );
  }, [teacherBookings, personalTeachers, vocabulary, partnerRequests, readNotificationIds, dismissedNotificationIds]);

  const unreadNotificationCount = React.useMemo(() => {
    return countUnreadNotifications(notifications);
  }, [notifications]);

  // Sync verified session with server auth store & initialize cross-device WebSocket presence
  useEffect(() => {
    realtimePresence.setTeacherSyncCallbacks({
      onTeacherCreated: (teacher) => {
        setPersonalTeachers((prev) => mergePersonalTeachers(prev, teacher));
      },
      onBookingUpdated: (booking) => {
        setTeacherBookings((prev) => mergeTeacherBookings(prev, booking));
      }
    });

    const activeUser = latestUserProfileRef.current;
    if (isLoggedIn && activeUser) {
      if (activeUser.isVerified && activeUser.verifiedId) {
        fetch('/api/auth/sync-verified-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: activeUser })
        }).catch(() => {});
      }

      realtimePresence.init(activeUser, (call) => {
        setIncomingCall(call);
      });
    }
    return () => {
      realtimePresence.cleanup();
    };
  }, [
    isLoggedIn,
    userProfile.id,
    userProfile.verifiedId,
    userProfile.name,
    userProfile.email,
    userProfile.nativeLanguage,
    selectedLanguage.code
  ]);

  // Debounced sync of authentic learning stats & vocabulary to backend per verified account
  useEffect(() => {
    if (!isLoggedIn || isAutostart || !userProfile.isVerified || !userProfile.email) return;

    const timer = setTimeout(() => {
      const snapshot = buildPersistedStatsSnapshot(
        latestUserProfileRef.current,
        latestVocabularyRef.current,
        seenCorrectionIdsRef.current
      );
      fetch('/api/auth/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: latestUserProfileRef.current.email,
          learningStats: snapshot
        })
      }).catch(() => {});
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    isLoggedIn,
    isAutostart,
    userProfile.isVerified,
    userProfile.email,
    userProfile.totalPracticeSeconds,
    userProfile.correctionsReceived,
    userProfile.streak?.streakDays,
    userProfile.streak?.totalXp,
    userProfile.streak?.todayCompleted,
    userProfile.streak?.todayDrillsCompleted,
    vocabulary.length
  ]);

  // Hydrate latest saved profile preferences & real learningStats from server auth store on mount
  useEffect(() => {
    if (!isLoggedIn || isAutostart || !userProfile?.email) return;
    fetch(`/api/auth/profile?email=${encodeURIComponent(userProfile.email)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const srv = data?.profile;
        const srvStats = data?.learningStats as PersistedLearningStats | undefined;
        if (!srv) return;

        let resolvedVocab = latestVocabularyRef.current;
        if (srvStats && srvStats.statsSource === 'real' && Array.isArray(srvStats.vocabulary)) {
          if (resolvedVocab.length === 0 && srvStats.vocabulary.length > 0) {
            resolvedVocab = srvStats.vocabulary;
            setVocabulary(srvStats.vocabulary);
          }
          if (Array.isArray(srvStats.seenCorrectionIds)) {
            srvStats.seenCorrectionIds.forEach((id) => seenCorrectionIdsRef.current.add(id));
          }
        }

        setUserProfile((prev) => {
          const mergedTargets =
            Array.isArray(srv.targetLanguages) && srv.targetLanguages.length > 0
              ? srv.targetLanguages
              : prev.targetLanguages;
          const useServerStats =
            srvStats &&
            srvStats.statsSource === 'real' &&
            ((srvStats.totalPracticeSeconds || 0) > (prev.totalPracticeSeconds || 0) ||
              (srvStats.correctionsReceived || 0) > (prev.correctionsReceived || 0) ||
              (srvStats.streak?.totalXp || 0) > (prev.streak?.totalXp || 0) ||
              (srvStats.streak?.streakDays || 0) > (prev.streak?.streakDays || 0));

          const resolvedNative =
            getStoredNativeLanguage() ||
            normalizeNativeLanguage(srv.nativeLanguage || prev.nativeLanguage);

          const baseNext: UserProfile = {
            ...prev,
            name: srv.name || prev.name,
            nativeLanguage: resolvedNative,
            bio: srv.bio !== undefined ? srv.bio : prev.bio,
            country: srv.country || prev.country,
            timezone: srv.timezone || prev.timezone,
            targetLanguages: mergedTargets,
            ...(useServerStats && srvStats
              ? {
                  streak: srvStats.streak,
                  streakDays: srvStats.streak?.streakDays ?? prev.streakDays,
                  totalPracticeSeconds: srvStats.totalPracticeSeconds,
                  totalPracticeMinutes: srvStats.totalPracticeMinutes,
                  correctionsReceived: srvStats.correctionsReceived
                }
              : {})
          };

          const next = sanitizeToRealStatsProfile(baseNext, resolvedVocab);
          try {
            localStorage.setItem('lernwelt_user', JSON.stringify(next));
            if (next.isVerified && next.verifiedId) {
              localStorage.setItem(VERIFIED_SESSION_STORAGE_KEY, JSON.stringify({ user: next }));
            }
          } catch {}
          return next;
        });

        const hasSavedLangCode = Boolean(localStorage.getItem(SELECTED_LANG_STORAGE_KEY));
        if (!hasSavedLangCode && srv.targetLanguageCode) {
          const matchedLang = SUPPORTED_LANGUAGES.find((l) => l.code === srv.targetLanguageCode);
          if (matchedLang) {
            setSelectedLanguage(matchedLang);
            try {
              localStorage.setItem(SELECTED_LANG_STORAGE_KEY, matchedLang.code);
            } catch {}
          }
        }
      })
      .catch(() => {});
  }, [isLoggedIn, isAutostart, userProfile.email]);

  // Sync public directory rooms ("Create Room"), personal teachers, and 1-on-1 lesson bookings from server
  useEffect(() => {
    fetch('/api/rooms')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.rooms) && data.rooms.length > 0) {
          const directoryRooms = filterDirectoryVisibleRooms(data.rooms);
          if (directoryRooms.length > 0) {
            setRoomsList((prev) => {
              const existingIds = new Set(prev.map((r) => r.id));
              const newRooms = directoryRooms.filter((r) => !existingIds.has(r.id));
              return newRooms.length > 0 ? [...newRooms, ...prev] : prev;
            });
          }
          if (initialRoomParam) {
            const matchedCustom = data.rooms.find((r: LanguageRoom) => r.id === initialRoomParam);
            if (matchedCustom) {
              setCurrentRoom(matchedCustom);
            }
          }
        }
      })
      .catch(() => {});

    if (initialRoomParam && !LANGUAGE_ROOMS.some((r) => r.id === initialRoomParam)) {
      fetch(`/api/rooms/${encodeURIComponent(initialRoomParam)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.room && data.room.id) {
            setCurrentRoom(data.room);
          }
        })
        .catch(() => {});
    }

    fetch('/api/teachers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.teachers) && data.teachers.length > 0) {
          setPersonalTeachers((prev) => mergePersonalTeachers(prev, data.teachers));
        }
        if (Array.isArray(data.bookings) && data.bookings.length > 0) {
          setTeacherBookings((prev) => mergeTeacherBookings(prev, data.bookings));
        }
      })
      .catch(() => {});

    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as ActiveTab | null;
      if (tabParam && VALID_TABS.includes(tabParam)) {
        setActiveTab(tabParam);
      }

      const subtabParam = params.get('subtab') as 'analyzer' | 'practice-drills' | 'pronunciation-trainer' | null;
      if (subtabParam && ['analyzer', 'practice-drills', 'pronunciation-trainer'].includes(subtabParam)) {
        setLabSubTab(subtabParam);
      }

      if (params.get('autostart') === '1') {
        setShowOnboarding(false);
      }

      const roomParam = params.get('room');
      if (roomParam) {
        const resolved = resolveRoomFromId(roomParam, LANGUAGE_ROOMS, SUPPORTED_LANGUAGES[0]);
        setCurrentRoom(resolved);
        const lang = SUPPORTED_LANGUAGES.find((l) => l.code === resolved.languageCode);
        if (lang) setSelectedLanguage(lang);
        setActiveTab('chat-room');
        setInitialChatOpen(false);
        setIsInsideRoom(true);
      }
    } catch {
      // Ignore URL search param errors
    }
  }, []);

  const buildUrlWithParams = useCallback((nextParams: Record<string, string | undefined>) => {
    try {
      const currentParams = new URLSearchParams(window.location.search);
      const out = new URLSearchParams();
      if (currentParams.get('autostart') === '1') {
        out.set('autostart', '1');
      }
      for (const [k, v] of Object.entries(nextParams)) {
        if (v) out.set(k, v);
      }
      const qs = out.toString();
      return qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    } catch {
      return window.location.pathname;
    }
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleLoginSuccess = (
    profile: UserProfile,
    targetLanguage: LanguageInfo,
    sessionToken?: string,
    learningStats?: PersistedLearningStats
  ) => {
    const restoredVocab =
      learningStats && learningStats.statsSource === 'real' && Array.isArray(learningStats.vocabulary)
        ? learningStats.vocabulary
        : [];
    const restoredSeen =
      learningStats && learningStats.statsSource === 'real' && Array.isArray(learningStats.seenCorrectionIds)
        ? new Set(learningStats.seenCorrectionIds.map(String))
        : new Set<string>();

    seenCorrectionIdsRef.current = restoredSeen;
    setVocabulary(restoredVocab);

    const canonicalNative = persistStoredNativeLanguage(profile.nativeLanguage);
    const sanitizedProfile = sanitizeToRealStatsProfile(
      { ...profile, nativeLanguage: canonicalNative },
      restoredVocab
    );
    setUserProfile(sanitizedProfile);
    setSelectedLanguage(targetLanguage);

    if (invitedRoomId) {
      const invitedRoom = resolveRoomFromId(invitedRoomId, roomsList, targetLanguage);
      setCurrentRoom(invitedRoom);
      setActiveTab('chat-room');
      setInitialChatOpen(false);
      setIsInsideRoom(true);
      setInvitedRoomId(null);
    } else {
      const matchingRoom = roomsList.find((r) => r.languageCode === targetLanguage.code) || roomsList[0];
      setCurrentRoom(matchingRoom);
    }

    setIsLoggedIn(true);
    setShowOnboarding(false);
    try {
      localStorage.setItem(REAL_STATS_MIGRATED_KEY, '1');
      localStorage.setItem('lernwelt_vocab_deck', JSON.stringify(restoredVocab));
      localStorage.setItem(SEEN_CORRECTIONS_STORAGE_KEY, JSON.stringify(Array.from(restoredSeen)));
      if (sanitizedProfile.streak) {
        localStorage.setItem(REAL_STREAK_STORAGE_KEY, JSON.stringify(sanitizedProfile.streak));
      }
      localStorage.setItem(SELECTED_LANG_STORAGE_KEY, targetLanguage.code);
      localStorage.setItem('lernwelt_user', JSON.stringify(sanitizedProfile));
      localStorage.setItem(
        VERIFIED_SESSION_STORAGE_KEY,
        JSON.stringify({
          user: sanitizedProfile,
          sessionToken: sessionToken || `sess_${Date.now()}`
        })
      );
    } catch {}
    showToast(
      t('toast.welcome', canonicalNative, {
        id: sanitizedProfile.verifiedId || '',
        name: sanitizedProfile.name
      })
    );
  };

  const handleLogout = () => {
    const uiLang = userProfile.nativeLanguage;
    try {
      localStorage.removeItem('lernwelt_user');
      localStorage.removeItem(VERIFIED_SESSION_STORAGE_KEY);
      localStorage.removeItem(SELECTED_LANG_STORAGE_KEY);
      localStorage.removeItem(REAL_STREAK_STORAGE_KEY);
      localStorage.removeItem('lernwelt_vocab_deck');
      localStorage.removeItem(SEEN_CORRECTIONS_STORAGE_KEY);
    } catch {}
    seenCorrectionIdsRef.current = new Set();
    setVocabulary([]);
    setIsRandomMatchActive(false);
    setUserProfile((prev) => sanitizeToRealStatsProfile({ ...prev, statsSource: undefined, isVerified: false, verifiedId: undefined }, []));
    signOutFromGmail().catch(() => {});
    realtimePresence.cleanup();
    setIsLoggedIn(false);
    showToast(t('toast.signedOut', uiLang));
  };

  const handleAcceptIncomingCall = (mode: 'video' | 'audio') => {
    if (!incomingCall) return;
    realtimePresence.respondToCall(incomingCall.caller.id, true, incomingCall.roomId);

    const matchingRoom = roomsList.find((r) => r.id === incomingCall.roomId) || {
      ...currentRoom,
      id: incomingCall.roomId,
      title: `${incomingCall.caller.name}'s Call`,
      host: {
        ...currentRoom.host,
        name: incomingCall.caller.name,
        avatarUrl: incomingCall.caller.avatarUrl
      }
    };

    setCurrentRoom(matchingRoom);
    setAutoStartMediaMode(mode === 'video' ? 'video-and-audio' : 'audio-only');
    setInitialChatOpen(false);
    setIsInsideRoom(true);
    setActiveTab('chat-room');
    setIncomingCall(null);
    showToast(t('toast.connectedCall', userProfile.nativeLanguage, { name: incomingCall.caller.name }));
  };

  const handleDeclineIncomingCall = () => {
    if (!incomingCall) return;
    realtimePresence.respondToCall(incomingCall.caller.id, false, incomingCall.roomId);
    setIncomingCall(null);
    showToast(t('toast.callDeclined', userProfile.nativeLanguage));
  };

  const handleDirectCallVerifiedPeer = (peer: OnlineUser, mode: 'video' | 'audio') => {
    const privateRoomId = `verified_call_${Date.now()}`;
    const callRoom: LanguageRoom = {
      id: privateRoomId,
      languageCode: selectedLanguage.code,
      languageName: selectedLanguage.name,
      flag: selectedLanguage.flag,
      title: `Verified Call · ${peer.name}`,
      subtitle: `${userProfile.name} & ${peer.name} · Video, Screen Share & Personal Chat`,
      currentTopic: `Verified 1-on-1 Session (${peer.verifiedId || 'Verified'})`,
      levelRange: 'Verified Members',
      activeLearnersCount: 2,
      activeNativesCount: 2,
      roomKind: 'direct-call',
      welcomeMessage: `Connected in private verified room with ${peer.name}!`,
      suggestedPhrases: ['Hi! Can you hear and see me clearly?', 'Feel free to share your screen anytime!'],
      host: {
        id: peer.id,
        name: peer.name,
        avatarUrl: peer.avatarUrl,
        country: peer.country || 'Global',
        countryCode: '🌍',
        nativeLanguage: peer.nativeLanguage || 'English',
        learningLanguage: peer.learningLanguage || selectedLanguage.name,
        learningLevel: 'B1',
        rating: 5.0,
        reviewCount: 1,
        sessionsCompleted: 1,
        isOnline: true,
        interests: ['Verified Exchange'],
        bio: `Verified Learner (${peer.verifiedId || 'Verified'})`,
        availability: 'Available Now',
        verifiedNative: true
      }
    };

    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: callRoom })
    }).catch(() => {});

    realtimePresence.initiateCall(peer.id, privateRoomId, mode);
    setCurrentRoom(callRoom);
    setAutoStartMediaMode(mode === 'video' ? 'video-and-audio' : 'audio-only');
    setInitialChatOpen(false);
    setIsInsideRoom(true);
    setActiveTab('chat-room');
    showToast(t('toast.callingPeer', userProfile.nativeLanguage, { name: peer.name }));
  };

  const handleOnboardingComplete = (language: LanguageInfo, level: CEFRLevel, goal: string) => {
    setSelectedLanguage(language);
    const matchingRoom = roomsList.find((r) => r.languageCode === language.code) || LANGUAGE_ROOMS[0];
    setCurrentRoom(matchingRoom);

    try {
      localStorage.setItem(SELECTED_LANG_STORAGE_KEY, language.code);
    } catch {}

    setUserProfile((prev) => {
      const updatedTargets = [
        { language: language.name, level, goal },
        ...prev.targetLanguages.filter((t) => t.language.toLowerCase() !== language.name.toLowerCase())
      ];
      const next: UserProfile = {
        ...prev,
        targetLanguages: updatedTargets
      };
      try {
        localStorage.setItem('lernwelt_user', JSON.stringify(next));
        if (next.isVerified && next.verifiedId) {
          localStorage.setItem(VERIFIED_SESSION_STORAGE_KEY, JSON.stringify({ user: next }));
        }
      } catch {}

      if (next.isVerified && next.email) {
        fetch('/api/auth/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: next.id,
            email: next.email,
            name: next.name,
            nativeLanguage: next.nativeLanguage,
            bio: next.bio,
            country: next.country,
            timezone: next.timezone,
            targetLanguageCode: language.code,
            level,
            targetLanguages: updatedTargets
          })
        }).catch(() => {});
      }
      return next;
    });

    setShowOnboarding(false);
    showToast(
      t('toast.onboardingReady', userProfile.nativeLanguage, {
        flag: language.flag,
        lang: localizeLanguageName(language.name, userProfile.nativeLanguage)
      })
    );
  };

  const handleSelectRoom = (room: LanguageRoom) => {
    setCurrentRoom(room);
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === room.languageCode);
    if (lang) {
      setSelectedLanguage(lang);
      try {
        localStorage.setItem(SELECTED_LANG_STORAGE_KEY, lang.code);
      } catch {}
    }
    setAutoStartMediaMode(undefined);
    setInitialChatOpen(false);
    setIsInsideRoom(true);
    try {
      const nextUrl = buildUrlWithParams({ room: room.id, tab: 'chat-room' });
      window.history.replaceState({}, '', nextUrl);
    } catch {}
    showToast(t('toast.enteredRoom', userProfile.nativeLanguage, { flag: room.flag, title: room.title }));
  };

  const handleCreateCustomRoom = (room: LanguageRoom) => {
    if (isDirectoryVisibleRoom(room)) {
      setRoomsList((prev) => (prev.some((r) => r.id === room.id) ? prev : [room, ...prev]));
    }
    setCurrentRoom(room);
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === room.languageCode);
    if (lang) setSelectedLanguage(lang);
    setInitialChatOpen(false);
    setIsInsideRoom(true);

    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ room })
    }).catch(() => {});

    try {
      const nextUrl = buildUrlWithParams({ room: room.id, tab: 'chat-room' });
      window.history.replaceState({}, '', nextUrl);
    } catch {}

    showToast(t('toast.createdRoom', userProfile.nativeLanguage, { flag: room.flag, title: room.title }));
  };

  const handleSaveToVocabDeck = (item: Partial<VocabularyWord>) => {
    const newWord: VocabularyWord = {
      id: 'voc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      word: (item.word || 'New Word').trim(),
      translation: (item.translation || '').trim(),
      language: item.language || selectedLanguage.name,
      cefrLevel: item.cefrLevel || 'B2',
      contextSentence: (item.contextSentence || '').trim(),
      mastered: false,
      nextReviewDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      tags: item.tags && item.tags.length > 0 ? item.tags : ['Saved Phrase']
    };

    setVocabulary((prev) => [newWord, ...prev]);
    setUserProfile((prev) => ({
      ...prev,
      wordsLearned: prev.wordsLearned + 1,
      statsSource: 'real'
    }));
    showToast(t('toast.savedVocab', userProfile.nativeLanguage, { word: newWord.word }));
  };

  const handleToggleMastered = (id: string) => {
    setVocabulary((prev) => prev.map((w) => (w.id === id ? { ...w, mastered: !w.mastered } : w)));
  };

  const handleDeleteWord = (id: string) => {
    setVocabulary((prev) => {
      const next = prev.filter((w) => w.id !== id);
      setUserProfile((p) => ({ ...p, wordsLearned: next.length, statsSource: 'real' }));
      return next;
    });
  };

  const recordCorrection = useCallback((id: string, count: number) => {
    if (!id || count <= 0) return;
    setUserProfile((prev) => {
      const applied = applyRealCorrectionEvent(prev, { id, count }, seenCorrectionIdsRef.current);
      if (applied.added > 0) {
        seenCorrectionIdsRef.current = applied.nextSeenIds;
        try {
          localStorage.setItem(
            SEEN_CORRECTIONS_STORAGE_KEY,
            JSON.stringify(Array.from(applied.nextSeenIds).slice(-500))
          );
        } catch {}
      }
      return applied.profile;
    });
  }, []);

  const handleAnalysisCorrection = useCallback(
    (result: CorrectionResult) => {
      const count = computeCorrectionCountFromAnalysis(result);
      if (count > 0) {
        const eventId = result.id || `corr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        recordCorrection(eventId, count);
      }
    },
    [recordCorrection]
  );

  const handlePronunciationEvaluated = useCallback(
    (result: PronunciationResult, evalId: string) => {
      const count = computeCorrectionCountFromPronunciation(result);
      if (count > 0) {
        recordCorrection(evalId, count);
      }
    },
    [recordCorrection]
  );

  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    const canonicalNative = updated.nativeLanguage
      ? persistStoredNativeLanguage(updated.nativeLanguage)
      : undefined;
    const primaryTarget = updated.targetLanguages?.[0]?.language;
    if (primaryTarget) {
      const matchedLang = SUPPORTED_LANGUAGES.find(
        (l) => l.name.toLowerCase() === primaryTarget.toLowerCase()
      );
      if (matchedLang) {
        setSelectedLanguage(matchedLang);
        try {
          localStorage.setItem(SELECTED_LANG_STORAGE_KEY, matchedLang.code);
        } catch {}
      }
    }

    setUserProfile((prev) => {
      const next = {
        ...prev,
        ...updated,
        ...(canonicalNative ? { nativeLanguage: canonicalNative } : {})
      };
      try {
        localStorage.setItem('lernwelt_user', JSON.stringify(next));
        if (next.isVerified && next.verifiedId) {
          localStorage.setItem(
            VERIFIED_SESSION_STORAGE_KEY,
            JSON.stringify({ user: next })
          );
        }
      } catch {}
      return next;
    });
  };

  const handleStartLessonWithTeacher = (teacher: PersonalTeacher) => {
    const classroomRoom = buildTeacherClassroomRoom(teacher, userProfile.name);
    setCurrentRoom(classroomRoom);
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === teacher.languageCode);
    if (lang) setSelectedLanguage(lang);
    setAutoStartMediaMode(undefined);
    setInitialChatOpen(false);
    setIsInsideRoom(true);
    setActiveTab('chat-room');

    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: classroomRoom })
    }).catch(() => {});

    try {
      const nextUrl = buildUrlWithParams({ room: classroomRoom.id, tab: 'chat-room' });
      window.history.replaceState({}, '', nextUrl);
    } catch {}

    showToast(t('toast.enteredClassroom', userProfile.nativeLanguage, { name: teacher.name }));
  };

  const handleBookTeacherSession = async (
    booking: TeacherLessonBooking,
    teacher: PersonalTeacher
  ) => {
    const classroomRoom = buildTeacherClassroomRoom(teacher, userProfile.name);
    setTeacherBookings((prev) => mergeTeacherBookings(prev, booking));

    const res = await fetch('/api/teachers/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking, classroomRoom })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.booking) {
        setTeacherBookings((prev) => mergeTeacherBookings(prev, data.booking));
      }
    }

    showToast(
      t('toast.bookedTeacher', userProfile.nativeLanguage, {
        name: teacher.name,
        slot: booking.slotLabel
      })
    );
  };

  const handleCancelTeacherBooking = async (bookingId: string) => {
    setTeacherBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
    );

    try {
      const res = await fetch(`/api/teachers/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.booking) {
          setTeacherBookings((prev) => mergeTeacherBookings(prev, data.booking));
        }
      }
    } catch {}

    showToast(t('toast.cancelledBooking', userProfile.nativeLanguage));
  };

  const handleRegisterPersonalTeacher = async (teacher: PersonalTeacher) => {
    const classroomRoom = buildTeacherClassroomRoom(teacher);
    setPersonalTeachers((prev) => mergePersonalTeachers(prev, teacher));

    try {
      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher, classroomRoom })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.teacher) {
          setPersonalTeachers((prev) => mergePersonalTeachers(prev, data.teacher));
        }
      }
    } catch {}

    showToast(t('toast.teacherLive', userProfile.nativeLanguage, { name: teacher.name }));
  };

  const handleCheckInToday = () => {
    setUserProfile((prev) => {
      const currentStreakData = initializeRealUserStreak(prev.streak);
      const updated = performDailyCheckIn(currentStreakData);
      try {
        localStorage.setItem(REAL_STREAK_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return {
        ...prev,
        streakDays: updated.streakDays,
        streak: updated,
        statsSource: 'real'
      };
    });

    showToast(t('toast.streakUp', userProfile.nativeLanguage));
  };

  const handleDrillCompleted = (_drill: PracticeDrill, xp: number) => {
    setUserProfile((prev) => {
      const currentStreakData = initializeRealUserStreak(prev.streak);
      const res = recordDrillCompletion(currentStreakData, xp, 0);
      try {
        localStorage.setItem(REAL_STREAK_STORAGE_KEY, JSON.stringify(res.streak));
      } catch {}
      return {
        ...prev,
        streakDays: res.streak.streakDays,
        streak: res.streak,
        statsSource: 'real'
      };
    });
    showToast(t('toast.drillXp', userProfile.nativeLanguage, { xp }));
  };

  const handleMarkAllNotificationsRead = () => {
    setReadNotificationIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      return next;
    });
  };

  const handleMarkNotificationRead = (id: string) => {
    setReadNotificationIds((prev) => new Set(prev).add(id));
  };

  const handleDismissNotification = (id: string) => {
    setDismissedNotificationIds((prev) => new Set(prev).add(id));
  };

  const handleAcceptPartnerRequest = (requestId: string, partnerName: string) => {
    setPartnerRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'accepted' as const } : r))
    );
    handleMarkNotificationRead(requestId);
    showToast(t('toast.connectedPartner', userProfile.nativeLanguage, { name: partnerName }));
  };

  const handleDeclinePartnerRequest = (requestId: string) => {
    setPartnerRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'declined' as const } : r))
    );
    handleMarkNotificationRead(requestId);
    showToast(t('toast.declinedPartner', userProfile.nativeLanguage));
  };

  const handleNotificationAction = (notification: AppNotification) => {
    handleMarkNotificationRead(notification.id);
    setIsNotificationDrawerOpen(false);

    if (notification.actionPayload?.type === 'join-room') {
      const targetRoomId = notification.actionPayload.roomId;
      if (targetRoomId) {
        const existingRoom = roomsList.find((r) => r.id === targetRoomId);
        if (existingRoom) {
          setCurrentRoom(existingRoom);
        } else {
          const teacher = personalTeachers.find((t) => t.id === notification.actionPayload?.teacherId);
          if (teacher) {
            const classroomRoom = buildTeacherClassroomRoom(teacher, userProfile.name);
            setCurrentRoom(classroomRoom);
          }
        }
        setIsInsideRoom(true);
        setActiveTab('chat-room');
        showToast(t('toast.enteringLesson', userProfile.nativeLanguage, { title: notification.title }));
      }
    } else if (notification.actionPayload?.type === 'open-tab') {
      const targetTab = notification.actionPayload.tab as ActiveTab;
      if (targetTab) {
        if (targetTab === 'ai-drills') {
          setLabSubTab('practice-drills');
        } else if (targetTab === 'grammar-lab') {
          setLabSubTab('analyzer');
        }
        setActiveTab(targetTab);
        setIsInsideRoom(false);
        try {
          window.history.replaceState({}, '', buildUrlWithParams({ tab: targetTab }));
        } catch {}
      }
    } else if (notification.actionPayload?.type === 'direct-call') {
      setActiveTab('chat-room');
      showToast(
        t('toast.initiatingCall', userProfile.nativeLanguage, {
          name: notification.actionPayload.partnerName || 'partner'
        })
      );
    }
  };

  const handleNavigateWorkspaceTab = useCallback((tab: ActiveTab) => {
    if (tab === 'ai-drills') {
      setLabSubTab('practice-drills');
    } else if (tab === 'grammar-lab') {
      setLabSubTab('analyzer');
    }
    setActiveTab(tab);
    if (tab === 'chat-room') {
      setIsInsideRoom(false);
    }
    try {
      window.history.replaceState({}, '', buildUrlWithParams({ tab }));
    } catch {}
  }, [buildUrlWithParams]);

  const handleSelectTargetLanguage = useCallback((lang: LanguageInfo) => {
    setSelectedLanguage(lang);
    try {
      localStorage.setItem(SELECTED_LANG_STORAGE_KEY, lang.code);
    } catch {}

    setUserProfile((prev) => {
      const existing = prev.targetLanguages.find(
        (t) => t.language.toLowerCase() === lang.name.toLowerCase()
      );
      const promotedTarget = existing || {
        language: lang.name,
        level: 'B1' as CEFRLevel,
        goal: 'Conversational Fluency & Verified Exchange'
      };
      const updatedTargets = [
        promotedTarget,
        ...prev.targetLanguages.filter((t) => t.language.toLowerCase() !== lang.name.toLowerCase())
      ];
      const next: UserProfile = {
        ...prev,
        targetLanguages: updatedTargets
      };
      try {
        localStorage.setItem('lernwelt_user', JSON.stringify(next));
        if (next.isVerified && next.verifiedId) {
          localStorage.setItem(VERIFIED_SESSION_STORAGE_KEY, JSON.stringify({ user: next }));
        }
      } catch {}

      if (next.isVerified && next.email) {
        fetch('/api/auth/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: next.id,
            email: next.email,
            name: next.name,
            nativeLanguage: next.nativeLanguage,
            targetLanguageCode: lang.code,
            level: promotedTarget.level,
            targetLanguages: updatedTargets
          })
        }).catch(() => {});
      }
      return next;
    });

    const matchingRoom = roomsList.find((r) => r.languageCode === lang.code);
    if (matchingRoom) {
      setCurrentRoom(matchingRoom);
      showToast(
        t('toast.switchedRoom', userProfile.nativeLanguage, {
          flag: matchingRoom.flag,
          title: matchingRoom.title
        })
      );
    }
  }, [roomsList, userProfile.nativeLanguage]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen lw-dynamic-canvas text-slate-900 dark:text-[#F1F4FA] flex flex-col font-sans selection:bg-[#5C6AE0] selection:text-white w-full max-w-full overflow-x-hidden min-w-0">
        <LoginInterface
          onLoginSuccess={handleLoginSuccess}
          defaultLanguage={selectedLanguage}
          invitedRoomId={invitedRoomId}
        />
        {toastMessage && (
          <div className="fixed bottom-6 right-20 z-50 flex items-center gap-2 bg-white dark:bg-[#0E1422] text-slate-900 dark:text-[#F1F4FA] text-xs font-medium px-3.5 py-2.5 rounded-lg shadow-lg dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.8)] border border-slate-200 dark:border-[#283450]">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-[#8B97EE]" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen lw-dynamic-canvas text-slate-900 dark:text-[#F1F4FA] flex flex-col lg:flex-row font-sans selection:bg-[#5C6AE0] selection:text-white w-full max-w-full overflow-x-hidden min-w-0">
      {/* Desktop Left Navigation Sidebar */}
      <DesktopSidebar
        activeTab={activeTab}
        setActiveTab={handleNavigateWorkspaceTab}
        onGoHome={() => {
          setIsInsideRoom(false);
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={handleSelectTargetLanguage}
        supportedLanguages={SUPPORTED_LANGUAGES}
        userProfile={userProfile}
        unreadNotificationCount={unreadNotificationCount}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
        onOpenOnboarding={() => setShowOnboarding(true)}
        onOpenStreak={() => setIsStreakModalOpen(true)}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 lg:h-screen">
      {/* Global Top Utility Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleNavigateWorkspaceTab}
        onGoHome={() => {
          setIsInsideRoom(false);
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={handleSelectTargetLanguage}
        supportedLanguages={SUPPORTED_LANGUAGES}
        userProfile={userProfile}
        unreadNotificationCount={unreadNotificationCount}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
        onOpenOnboarding={() => setShowOnboarding(true)}
        onOpenStreak={() => setIsStreakModalOpen(true)}
        onLogout={handleLogout}
      />

      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        notifications={notifications}
        unreadCount={unreadNotificationCount}
        nativeLanguage={userProfile.nativeLanguage}
        onMarkAllAsRead={handleMarkAllNotificationsRead}
        onMarkAsRead={handleMarkNotificationRead}
        onDismiss={handleDismissNotification}
        onAcceptPartnerRequest={handleAcceptPartnerRequest}
        onDeclinePartnerRequest={handleDeclinePartnerRequest}
        onActionClick={handleNotificationAction}
      />

      {showOnboarding && (
        <LanguageOnboardingModal
          nativeLanguage={userProfile.nativeLanguage}
          onComplete={handleOnboardingComplete}
        />
      )}

      <StreakModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
        userProfile={userProfile}
        onCheckInToday={handleCheckInToday}
        onEnterPracticeRoom={() => {
          setIsStreakModalOpen(false);
          setInitialChatOpen(false);
          setActiveTab('chat-room');
          setIsInsideRoom(true);
        }}
      />

      {incomingCall && (
        <IncomingCallModal
          incomingCall={incomingCall}
          nativeLanguage={userProfile.nativeLanguage}
          onAccept={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
        />
      )}

      {/* Main Body Content */}
      <main className="flex-1 w-full max-w-full min-w-0 lg:overflow-y-auto">
        {activeTab === 'chat-room' && !isInsideRoom && (
          <RoomsDirectory
            rooms={roomsList}
            selectedLanguage={selectedLanguage}
            onSelectRoom={handleSelectRoom}
            onNavigateTab={(tab) => {
              if (tab === 'ai-drills') {
                setLabSubTab('practice-drills');
              } else if (tab === 'grammar-lab') {
                setLabSubTab('analyzer');
              }
              setActiveTab(tab);
              try {
                window.history.replaceState({}, '', buildUrlWithParams({ tab }));
              } catch {}
            }}
            onCreateCustomRoom={handleCreateCustomRoom}
            userProfile={userProfile}
            onOpenOnboarding={() => setShowOnboarding(true)}
            onOpenStreak={() => setIsStreakModalOpen(true)}
            onCheckInStreak={handleCheckInToday}
            personalTeachers={personalTeachers}
            teacherBookings={teacherBookings}
            onStartLessonWithTeacher={handleStartLessonWithTeacher}
            onBookTeacherSession={handleBookTeacherSession}
            onNavigateLabSubTab={(subTab) => {
              setLabSubTab(subTab);
              setActiveTab('language-lab');
            }}
          />
        )}

        {/* Verified Random Connect: Random Audio/Video Call + Screen Share + Personal Chat for Verified ID Users */}
        {activeTab === 'random-connect' && (
          <VerifiedRandomConnect
            userProfile={userProfile}
            selectedLanguage={selectedLanguage}
            roomsList={roomsList}
            onSelectRoom={handleSelectRoom}
            onSaveToVocabDeck={handleSaveToVocabDeck}
            onCorrectionReceived={handleAnalysisCorrection}
            onMatchStateChange={setIsRandomMatchActive}
            onRequireVerification={handleLogout}
            onDirectCallVerifiedPeer={handleDirectCallVerifiedPeer}
          />
        )}

        {/* Dedicated AI Language & Knowledge Coach */}
        {activeTab === 'ai-coach' && (
          <AICoachView
            selectedLanguage={selectedLanguage}
            userProfile={userProfile}
            onSaveToVocabDeck={handleSaveToVocabDeck}
            onCorrectionReceived={({ id, count }) => recordCorrection(id, count)}
          />
        )}

        {/* Dedicated Personal Teachers Page */}
        {activeTab === 'teachers' && (
          <PersonalTeachersView
            teachers={personalTeachers}
            bookings={teacherBookings}
            selectedLanguage={selectedLanguage}
            supportedLanguages={SUPPORTED_LANGUAGES}
            userProfile={userProfile}
            onStartLessonWithTeacher={handleStartLessonWithTeacher}
            onBookTeacherSession={handleBookTeacherSession}
            onCancelBooking={handleCancelTeacherBooking}
            onRegisterTeacher={handleRegisterPersonalTeacher}
          />
        )}

        {/* Inside a Specific Language Chat Room or 1-on-1 Personal Teacher Classroom */}
        {activeTab === 'chat-room' && isInsideRoom && (
          <WebRTCRoom
            currentRoom={currentRoom}
            roomsList={roomsList}
            userProfile={userProfile}
            onSelectRoom={handleSelectRoom}
            selectedLanguage={selectedLanguage}
            onSaveToVocabDeck={handleSaveToVocabDeck}
            onCorrectionReceived={handleAnalysisCorrection}
            initialChatOpen={initialChatOpen}
            autoStartMediaMode={autoStartMediaMode}
            audioNotificationsEnabled={audioNotificationsEnabled}
            onBackToRooms={() => {
              setIsInsideRoom(false);
              try {
                window.history.replaceState({}, '', buildUrlWithParams({ tab: 'chat-room' }));
              } catch {}
            }}
          />
        )}

        {(activeTab === 'language-lab' || activeTab === 'ai-drills' || activeTab === 'grammar-lab') && (
          <LanguageLab
            key={`${activeTab}_${labSubTab}_${selectedLanguage.code}`}
            defaultSubTab={
              activeTab === 'ai-drills'
                ? 'practice-drills'
                : activeTab === 'grammar-lab'
                  ? 'analyzer'
                  : labSubTab
            }
            onSubTabChange={(nextSub) => {
              setLabSubTab(nextSub);
              if (nextSub === 'practice-drills') {
                setActiveTab('ai-drills');
              } else if (nextSub === 'analyzer') {
                setActiveTab('grammar-lab');
              } else {
                setActiveTab('language-lab');
              }
            }}
            selectedLanguage={selectedLanguage}
            onSaveToVocabDeck={handleSaveToVocabDeck}
            onAnalysisCorrection={handleAnalysisCorrection}
            onPronunciationEvaluated={handlePronunciationEvaluated}
            userProfile={userProfile}
            userStreak={userProfile.streak}
            onDrillCompleted={handleDrillCompleted}
            onOpenStreakModal={() => setIsStreakModalOpen(true)}
          />
        )}

        {activeTab === 'vocab-deck' && (
          <VocabularyDeck
            vocabulary={vocabulary}
            defaultLanguage={selectedLanguage.name}
            nativeLanguage={userProfile.nativeLanguage}
            onToggleMastered={handleToggleMastered}
            onDeleteWord={handleDeleteWord}
            onAddWord={handleSaveToVocabDeck}
          />
        )}

        {(activeTab === 'events-calendar' || activeTab === 'events-games') && (
          <EventCalendarView
            selectedLanguage={selectedLanguage}
            supportedLanguages={SUPPORTED_LANGUAGES}
            userProfile={userProfile}
            onJoinRoom={(roomId) => {
              const matchingRoom = roomsList.find((r) => r.id === roomId) || roomsList[0];
              setCurrentRoom(matchingRoom);
              const lang = SUPPORTED_LANGUAGES.find((l) => l.code === matchingRoom.languageCode);
              if (lang) setSelectedLanguage(lang);
              setInitialChatOpen(false);
              setIsInsideRoom(true);
              setActiveTab('chat-room');
              showToast(
                t('toast.joinedEvent', userProfile.nativeLanguage, {
                  flag: matchingRoom.flag,
                  title: matchingRoom.title
                })
              );
            }}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'gmail' && (
          <GmailWorkspaceView
            userProfile={userProfile}
            selectedLanguage={selectedLanguage}
            currentRoom={currentRoom}
            onSaveToVocabDeck={handleSaveToVocabDeck}
          />
        )}

        {activeTab === 'tasks' && (
          <GoogleTasksView
            userProfile={userProfile}
            selectedLanguage={selectedLanguage}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            userProfile={userProfile}
            theme={theme}
            onChangeTheme={handleChangeTheme}
            audioNotificationsEnabled={audioNotificationsEnabled}
            onChangeAudioNotifications={handleChangeAudioNotifications}
            onUpdateProfile={handleUpdateProfile}
            onCheckInStreak={handleCheckInToday}
            onLogout={handleLogout}
            onEnterRoom={() => {
              setInitialChatOpen(false);
              setActiveTab('chat-room');
              setIsInsideRoom(true);
            }}
          />
        )}
      </main>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-20 z-50 flex items-center gap-2 bg-white dark:bg-[#0E1422] text-slate-900 dark:text-[#F1F4FA] text-xs font-medium px-3.5 py-2.5 rounded-lg shadow-lg dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.8)] border border-slate-200 dark:border-[#283450]">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-[#8B97EE]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
