import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  Plus,
  MessageSquare,
  Globe,
  ArrowRight,
  X,
  Shuffle,
  Bot
} from 'lucide-react';
import {
  ActiveTab,
  CEFRLevel,
  LanguageInfo,
  LanguageRoom,
  PersonalTeacher,
  TeacherAccessPass,
  TeacherLessonBooking,
  UserProfile
} from '../../types';
import { createInitialsAvatarDataUri } from '../../data/teacherData';
import {
  PersonalTeachersColumn,
  TeacherPaymentRequestAction
} from '../teachers/PersonalTeachersView';
import { localizeLanguageName, t } from '../../services/uiLocalization';
import {
  buildRoomInviteUrl,
  findRoomByCode,
  generateUniqueRoomCode,
  isDirectoryVisibleRoom,
  normalizeRoomJoinInput,
  resolveRoomFromId
} from '../../services/roomSessionUtils';
import { BRAND_IMAGES } from '../../utils/brandAssets';

interface RoomsDirectoryProps {
  rooms: LanguageRoom[];
  selectedLanguage: LanguageInfo;
  onSelectRoom: (room: LanguageRoom) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onNavigateLabSubTab?: (subTab: 'analyzer' | 'practice-drills' | 'pronunciation-trainer') => void;
  onCreateCustomRoom: (room: LanguageRoom) => void;
  userProfile: UserProfile;
  onOpenOnboarding: () => void;
  onOpenStreak?: () => void;
  onCheckInStreak?: () => void;
  personalTeachers: PersonalTeacher[];
  teacherBookings: TeacherLessonBooking[];
  teacherAccessPasses: TeacherAccessPass[];
  onRequireTeacherPayment: (action: TeacherPaymentRequestAction) => void;
  onStartLessonWithTeacher: (teacher: PersonalTeacher) => void;
  onBookTeacherSession: (booking: TeacherLessonBooking, teacher: PersonalTeacher) => Promise<void> | void;
  externalSearchQuery?: string;
  onExternalSearchChange?: (query: string) => void;
}

const STUDY_HUB_HERO_IMAGE = BRAND_IMAGES.studyHubHero;

export const RoomsDirectory: React.FC<RoomsDirectoryProps> = ({
  rooms,
  selectedLanguage,
  onSelectRoom,
  onNavigateTab,
  onCreateCustomRoom,
  userProfile,
  personalTeachers,
  teacherBookings,
  teacherAccessPasses,
  onRequireTeacherPayment,
  onStartLessonWithTeacher,
  onBookTeacherSession,
  externalSearchQuery,
  onExternalSearchChange
}) => {
  const uiLang = userProfile.nativeLanguage;
  const [searchTerm, setSearchTerm] = useState(externalSearchQuery || '');
  const [filterLanguage, setFilterLanguage] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [copiedFriendLink, setCopiedFriendLink] = useState(false);
  const [heroImgError, setHeroImgError] = useState(false);
  const [failedRoomPhotos, setFailedRoomPhotos] = useState<Record<string, boolean>>({});
  const [isJoiningByCode, setIsJoiningByCode] = useState(false);

  // Sync external header search into directory search
  useEffect(() => {
    if (typeof externalSearchQuery === 'string' && externalSearchQuery !== searchTerm) {
      setSearchTerm(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  const updateSearch = (val: string) => {
    setSearchTerm(val);
    onExternalSearchChange?.(val);
  };

  // New room modal state
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomLang, setNewRoomLang] = useState('German');
  const [newRoomTopic, setNewRoomTopic] = useState('');
  const [newRoomLevel, setNewRoomLevel] = useState<CEFRLevel>('B1');

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = normalizeRoomJoinInput(joinRoomCode);
    if (!normalizedCode || isJoiningByCode) return;

    setIsJoiningByCode(true);
    try {
      const existingLocal = findRoomByCode(rooms, normalizedCode);
      if (existingLocal) {
        onSelectRoom(existingLocal);
        return;
      }

      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(normalizedCode)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.room?.id) {
            onSelectRoom(data.room);
            return;
          }
        }
      } catch {
        // Fall back to canonical room creation below if network lookup is unavailable
      }

      const resolved = resolveRoomFromId(normalizedCode, rooms, selectedLanguage);
      const adhocRoom: LanguageRoom = {
        ...resolved,
        id: normalizedCode,
        title: `Room: ${normalizedCode}`,
        subtitle: 'Live Cross-Device Audio & Video Call',
        currentTopic: 'Free Conversation & Cross-Device Exchange',
        levelRange: 'All Levels',
        activeLearnersCount: 1,
        activeNativesCount: 1,
        roomKind: 'adhoc-code',
        welcomeMessage: `Welcome to Room ${normalizedCode}! Join with audio or video to start exchanging.`,
        suggestedPhrases: ['Hello, nice to meet you!', 'Can you hear me clearly?'],
        host: {
          id: userProfile.id,
          name: userProfile.name,
          avatarUrl: userProfile.avatarUrl,
          country: userProfile.country || 'Global',
          countryCode: '🌍',
          nativeLanguage: userProfile.nativeLanguage || 'English',
          learningLanguage: selectedLanguage.name,
          learningLevel: 'B2',
          rating: 5.0,
          reviewCount: 1,
          sessionsCompleted: 1,
          isOnline: true,
          interests: userProfile.interests || ['Language Exchange'],
          bio: userProfile.bio || 'Practicing on LernWelt',
          availability: 'Available Now',
          verifiedNative: false
        }
      };
      onCreateCustomRoom(adhocRoom);
    } finally {
      setIsJoiningByCode(false);
    }
  };

  const handleGenerateMobileCallLink = () => {
    const roomCode = generateUniqueRoomCode();
    const link = buildRoomInviteUrl(window.location.origin, roomCode);
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopiedFriendLink(true);
        setTimeout(() => setCopiedFriendLink(false), 3000);
      })
      .catch(() => {});

    const adhocRoom: LanguageRoom = {
      id: roomCode,
      languageCode: selectedLanguage.code,
      languageName: selectedLanguage.name,
      flag: selectedLanguage.flag,
      title: `Instant Call · ${roomCode}`,
      subtitle: 'Live Mobile & Desktop Tandem Call',
      currentTopic: 'Live Mobile & Desktop Tandem Call',
      levelRange: 'All Levels',
      activeLearnersCount: 1,
      activeNativesCount: 1,
      roomKind: 'instant-call',
      welcomeMessage: `Connected! Share room code ${roomCode} or the copied invite link so anyone can join this room.`,
      suggestedPhrases: ['Hi! Glad we connected!', 'Can you see my video and hear me clearly?'],
      host: {
        id: userProfile.id,
        name: userProfile.name,
        avatarUrl: userProfile.avatarUrl,
        country: userProfile.country || 'Global',
        countryCode: '🌍',
        nativeLanguage: userProfile.nativeLanguage || 'English',
        learningLanguage: selectedLanguage.name,
        learningLevel: 'B2',
        rating: 5.0,
        reviewCount: 1,
        sessionsCompleted: 1,
        isOnline: true,
        interests: userProfile.interests || ['Language Exchange'],
        bio: userProfile.bio || 'Practicing on LernWelt',
        availability: 'Available Now',
        verifiedNative: false
      }
    };
    onCreateCustomRoom(adhocRoom);
  };

  const filteredRooms = rooms.filter((room) => {
    if (!isDirectoryVisibleRoom(room)) {
      return false;
    }

    const matchesSearch =
      room.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.languageName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.currentTopic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.host.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLang =
      filterLanguage === 'all'
        ? true
        : room.languageName.toLowerCase() === filterLanguage.toLowerCase() ||
          room.languageCode.toLowerCase() === filterLanguage.toLowerCase();

    const matchesLevel =
      filterLevel === 'all'
        ? true
        : room.levelRange.toLowerCase().includes(filterLevel.toLowerCase());

    return matchesSearch && matchesLang && matchesLevel;
  });

  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomTitle.trim() || !newRoomTopic.trim()) return;

    const langFlags: Record<string, { flag: string; code: string }> = {
      English: { flag: '🇬🇧', code: 'en' },
      German: { flag: '🇩🇪', code: 'de' },
      Spanish: { flag: '🇪🇸', code: 'es' },
      French: { flag: '🇫🇷', code: 'fr' },
      Italian: { flag: '🇮🇹', code: 'it' },
      Japanese: { flag: '🇯🇵', code: 'ja' },
      Mandarin: { flag: '🇨🇳', code: 'zh' },
      Portuguese: { flag: '🇵🇹', code: 'pt' }
    };

    const langMeta = langFlags[newRoomLang] || { flag: '🌐', code: 'custom' };

    const createdRoom: LanguageRoom = {
      id: generateUniqueRoomCode(),
      languageCode: langMeta.code,
      languageName: newRoomLang,
      flag: langMeta.flag,
      title: newRoomTitle.trim(),
      subtitle: `${newRoomLang} Community Exchange Hub`,
      currentTopic: newRoomTopic.trim(),
      host: {
        id: 'host_' + userProfile.id,
        name: userProfile.name,
        avatarUrl: userProfile.avatarUrl,
        country: userProfile.country,
        countryCode: '🌐',
        nativeLanguage: userProfile.nativeLanguage,
        learningLanguage: newRoomLang,
        learningLevel: newRoomLevel,
        rating: 5.0,
        reviewCount: 1,
        sessionsCompleted: 1,
        isOnline: true,
        interests: userProfile.interests,
        bio: `Community host for ${newRoomTitle}. Let's practice together!`,
        availability: 'Available Now',
        verifiedNative: false
      },
      activeLearnersCount: 1,
      activeNativesCount: 1,
      levelRange: `${newRoomLevel} – C1`,
      roomKind: 'create-room',
      welcomeMessage: `Welcome to ${newRoomTitle}! Join with audio or video to start exchanging in ${newRoomLang}.`,
      suggestedPhrases: [
        `Hello! Welcome to our ${newRoomLang} practice session.`,
        `Let's discuss ${newRoomTopic.trim()}.`
      ]
    };

    onCreateCustomRoom(createdRoom);
    setShowCreateModal(false);
    setNewRoomTitle('');
    setNewRoomTopic('');
    onSelectRoom(createdRoom);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full max-w-full min-w-0">
      {/* Large Photographic Welcome Banner */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-[#293342] bg-[#10151D] min-h-[248px] flex items-end shadow-sm dark:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.7)]"
      >
        {!heroImgError ? (
          <img
            src={STUDY_HUB_HERO_IMAGE}
            alt="International landmarks cultural exchange skyline"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
        ) : (
          <div className="absolute inset-0 bg-[#161D27]" />
        )}

        {/* Measured Dark Navy Scrim for High Text Legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D1117]/95 via-[#0D1117]/75 to-[#0D1117]/35" />

        <div className="relative z-10 p-6 sm:p-8 w-full flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <h1
              className="text-2xl sm:text-3xl font-bold text-[#F0F2F5] tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Welcome back, ARYAN - Live Language Rooms, Verified Random Calls &amp; AI Coaching
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">

            <button
              type="button"
              onClick={() => onNavigateTab('random-connect')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white/95 dark:bg-[#1B2430]/95 hover:bg-white dark:hover:bg-[#232F3F] border border-slate-200 dark:border-[#293342] text-slate-900 dark:text-[#F0F2F5] font-medium text-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Shuffle className="w-4 h-4 text-[#6485F5] shrink-0" />
              <span>{t('rooms.randomConnect', uiLang)}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('ai-coach')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white/95 dark:bg-[#1B2430]/95 hover:bg-white dark:hover:bg-[#232F3F] border border-slate-200 dark:border-[#293342] text-slate-900 dark:text-[#F0F2F5] font-medium text-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Bot className="w-4 h-4 text-[#9278D8] shrink-0" />
              <span>{t('rooms.aiCoach', uiLang)}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-white/95 dark:bg-[#1B2430]/95 hover:bg-white dark:hover:bg-[#232F3F] border border-slate-200 dark:border-[#293342] text-slate-900 dark:text-[#F0F2F5] font-medium text-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{t('rooms.createRoom', uiLang)}</span>
            </button>
          </div>
        </div>
      </motion.section>

      {/* Cross-Device / Mobile Friend Quick Connect Bar */}
      <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-3.5 sm:p-4 shadow-xs dark:shadow-none">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <form onSubmit={handleJoinByCode} className="flex items-center gap-2 flex-1 max-w-md">
            <input
              type="text"
              value={joinRoomCode}
              onChange={(e) => setJoinRoomCode(e.target.value)}
              placeholder={t('rooms.enterCodePlaceholder', uiLang)}
              aria-label={t('rooms.enterCodePlaceholder', uiLang)}
              className="bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg px-3.5 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none w-full transition-colors"
            />
            <button
              type="submit"
              disabled={isJoiningByCode || !joinRoomCode.trim()}
              className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] disabled:opacity-60 text-slate-800 dark:text-[#F0F2F5] font-medium text-xs border border-slate-300 dark:border-[#293342] transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
            >
              {t('rooms.joinCode', uiLang)}
            </button>
          </form>

          <button
            type="button"
            onClick={handleGenerateMobileCallLink}
            className="flex items-center justify-center px-4 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white no-underline not-italic font-semibold text-xs border border-[#9278D8]/35 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>{copiedFriendLink ? t('rooms.linkCopied', uiLang) : t('rooms.startInstantCall', uiLang)}</span>
          </button>
        </div>
      </div>

      {/* Room Search & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#9BA6B2] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => updateSearch(e.target.value)}
            placeholder={t('rooms.searchPlaceholder', uiLang)}
            aria-label={t('rooms.searchPlaceholder', uiLang)}
            className="w-full bg-white dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] focus:border-[#6485F5] rounded-lg pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
            className="bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] hover:border-slate-400 dark:hover:border-[#3A475C] text-slate-800 dark:text-[#F0F2F5] text-xs font-medium px-3 py-2 rounded-lg focus:outline-none focus:border-[#6485F5] transition-colors cursor-pointer"
            aria-label={t('rooms.allLanguages', uiLang)}
          >
            <option value="all" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">{t('rooms.allLanguages', uiLang)}</option>
            <option value="English" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇬🇧 {localizeLanguageName('English', uiLang)}</option>
            <option value="German" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇩🇪 {localizeLanguageName('German', uiLang)}</option>
            <option value="Spanish" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇪🇸 {localizeLanguageName('Spanish', uiLang)}</option>
            <option value="French" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇫🇷 {localizeLanguageName('French', uiLang)}</option>
            <option value="Italian" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇮🇹 {localizeLanguageName('Italian', uiLang)}</option>
            <option value="Japanese" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇯🇵 {localizeLanguageName('Japanese', uiLang)}</option>
            <option value="Mandarin" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇨🇳 {localizeLanguageName('Mandarin', uiLang)}</option>
            <option value="Portuguese" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇵🇹 {localizeLanguageName('Portuguese', uiLang)}</option>
          </select>

          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-white dark:bg-[#161D27] border border-slate-300 dark:border-[#293342] hover:border-slate-400 dark:hover:border-[#3A475C] text-slate-800 dark:text-[#F0F2F5] text-xs font-medium px-3 py-2 rounded-lg focus:outline-none focus:border-[#6485F5] transition-colors cursor-pointer"
            aria-label={t('rooms.allCefr', uiLang)}
          >
            <option value="all" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">{t('rooms.allCefr', uiLang)}</option>
            <option value="A1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">{t('rooms.beginnerRange', uiLang)}</option>
            <option value="B1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">{t('rooms.intermediateRange', uiLang)}</option>
            <option value="C1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">{t('rooms.advancedRange', uiLang)}</option>
          </select>
        </div>
      </div>

      {/* Main Two-Column Hub: Popular Language Chat Rooms + Dedicated Personal Teachers Column */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
              {t('rooms.activeRooms', uiLang)}
            </h2>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#161D27] rounded-xl border border-slate-200 dark:border-[#293342] space-y-3 shadow-xs dark:shadow-none">
              <div className="w-11 h-11 mx-auto rounded-lg bg-slate-100 dark:bg-[#1B2430] border border-slate-200 dark:border-[#293342] flex items-center justify-center text-slate-500 dark:text-[#9BA6B2]">
                <Globe className="w-5 h-5" />
              </div>
              <p className="font-semibold text-slate-900 dark:text-[#F0F2F5] text-sm">{t('rooms.noRoomsFound', uiLang)}</p>
              <p className="text-xs text-slate-600 dark:text-[#9BA6B2] max-w-sm mx-auto">
                {t('rooms.noRoomsDesc', uiLang)}
              </p>
              <button
                type="button"
                onClick={() => {
                  updateSearch('');
                  setFilterLanguage('all');
                  setFilterLevel('all');
                }}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] text-xs font-medium text-slate-800 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] cursor-pointer transition-colors"
              >
                {t('common.resetFilters', uiLang)}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredRooms.map((room, idx) => {
                const hostFallback = createInitialsAvatarDataUri(room.host.name, '#6485F5');
                const countryPhoto = BRAND_IMAGES.roomPhotos[room.languageCode] || STUDY_HUB_HERO_IMAGE;
                const photoFailed = Boolean(failedRoomPhotos[room.id]);
                return (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.025, 0.15) }}
                    className="group relative rounded-xl overflow-hidden bg-white dark:bg-[#161D27] hover:bg-slate-50/70 dark:hover:bg-[#1B2430] border border-slate-200 dark:border-[#293342] hover:border-slate-300 dark:hover:border-[#3A475C] flex flex-col justify-between transition-colors shadow-xs dark:shadow-none h-full"
                  >
                    {/* Realistic Country Photography Header */}
                    <div className="relative h-36 w-full overflow-hidden bg-[#10151D] shrink-0">
                      {!photoFailed ? (
                        <img
                          src={countryPhoto}
                          alt={`${room.languageName} — ${room.title}`}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedRoomPhotos((prev) => ({ ...prev, [room.id]: true }))
                          }
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#161D27] to-[#1B2430]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#161D27] via-[#0D1117]/40 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg leading-none shrink-0">{room.flag}</span>
                          <span className="text-xs font-semibold text-[#F0F2F5] truncate">
                            {localizeLanguageName(room.languageName, uiLang)} · {room.levelRange}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold text-base text-slate-900 dark:text-[#F0F2F5] mb-1">
                          {room.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-[#9BA6B2] mb-3 line-clamp-1">{room.subtitle}</p>

                        <div className="py-2.5 border-y border-slate-200 dark:border-[#293342] mb-4 space-y-0.5">
                          <div className="text-[11px] text-slate-500 dark:text-[#9BA6B2] font-medium">
                            {t('rooms.discussionFocus', uiLang)}
                          </div>
                          <p className="text-xs text-slate-700 dark:text-[#F0F2F5] font-medium leading-relaxed line-clamp-2">
                            {room.currentTopic}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={room.host.avatarUrl || hostFallback}
                              alt={room.host.name}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.src !== hostFallback) img.src = hostFallback;
                              }}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-[#293342] shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-semibold text-slate-900 dark:text-[#F0F2F5] truncate">{room.host.name}</span>
                              </div>
                              <span className="text-[11px] text-slate-600 dark:text-[#9BA6B2] block truncate">
                                {t('rooms.hostLabel', uiLang, { country: room.host.country })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-[#9BA6B2] mb-4">
                          {t('rooms.featuresLine', uiLang)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectRoom(room)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-[#6485F5] text-slate-800 dark:text-[#F0F2F5] hover:text-white border border-slate-300 dark:border-[#293342] hover:border-[#6485F5] font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                        aria-label={`${t('rooms.enterChatRoom', uiLang)}: ${room.title}`}
                      >
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span>{t('rooms.enterChatRoom', uiLang)}</span>
                        <ArrowRight className="w-4 h-4 ml-0.5 shrink-0" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dedicated Personal Teachers Column */}
        <div className="xl:col-span-4 min-w-0">
          <PersonalTeachersColumn
            teachers={personalTeachers}
            bookings={teacherBookings}
            selectedLanguage={selectedLanguage}
            userProfile={userProfile}
            teacherAccessPasses={teacherAccessPasses}
            onRequireTeacherPayment={onRequireTeacherPayment}
            onStartLessonWithTeacher={onStartLessonWithTeacher}
            onBookTeacherSession={onBookTeacherSession}
            onOpenFullTeachersTab={() => onNavigateTab('teachers')}
          />
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-[#0D1117]/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#293342]">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#6485F5]" />
                <h3 className="font-semibold text-base text-slate-900 dark:text-[#F0F2F5]">{t('rooms.modalTitle', uiLang)}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] cursor-pointer transition-colors"
                aria-label={t('common.close', uiLang)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoomSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">{t('rooms.roomTitle', uiLang)}</label>
                <input
                  type="text"
                  required
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  placeholder={t('rooms.roomTitlePlaceholder', uiLang)}
                  className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">{t('rooms.targetLanguage', uiLang)}</label>
                  <select
                    value={newRoomLang}
                    onChange={(e) => setNewRoomLang(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2 text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] cursor-pointer"
                  >
                    <option value="German" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇩🇪 {localizeLanguageName('German', uiLang)}</option>
                    <option value="Spanish" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇪🇸 {localizeLanguageName('Spanish', uiLang)}</option>
                    <option value="French" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇫🇷 {localizeLanguageName('French', uiLang)}</option>
                    <option value="Italian" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇮🇹 {localizeLanguageName('Italian', uiLang)}</option>
                    <option value="Japanese" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇯🇵 {localizeLanguageName('Japanese', uiLang)}</option>
                    <option value="Mandarin" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇨🇳 {localizeLanguageName('Mandarin', uiLang)}</option>
                    <option value="Portuguese" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇵🇹 {localizeLanguageName('Portuguese', uiLang)}</option>
                    <option value="English" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">🇬🇧 {localizeLanguageName('English', uiLang)}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">{t('rooms.targetLevel', uiLang)}</label>
                  <select
                    value={newRoomLevel}
                    onChange={(e) => setNewRoomLevel(e.target.value as CEFRLevel)}
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2 text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] cursor-pointer"
                  >
                    <option value="A1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">A1</option>
                    <option value="A2" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">A2</option>
                    <option value="B1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">B1</option>
                    <option value="B2" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">B2</option>
                    <option value="C1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">C1</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">{t('rooms.discussionTopic', uiLang)}</label>
                <input
                  type="text"
                  required
                  value={newRoomTopic}
                  onChange={(e) => setNewRoomTopic(e.target.value)}
                  placeholder={t('rooms.topicPlaceholder', uiLang)}
                  className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] text-slate-800 dark:text-[#F0F2F5] font-medium border border-slate-300 dark:border-[#293342] cursor-pointer transition-colors"
                >
                  {t('common.cancel', uiLang)}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold border border-[#9278D8]/35 shadow-sm cursor-pointer transition-colors"
                >
                  {t('rooms.createAndEnter', uiLang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
