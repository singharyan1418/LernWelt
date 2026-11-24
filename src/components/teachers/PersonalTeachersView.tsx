import React, { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Plus,
  Search,
  Star,
  UserCheck,
  Video,
  X
} from 'lucide-react';
import {
  LanguageInfo,
  PersonalTeacher,
  TeacherLessonBooking,
  TeacherSpecialty,
  UserProfile
} from '../../types';
import { createInitialsAvatarDataUri } from '../../data/teacherData';
import {
  buildTeacherRoomId,
  filterPersonalTeachers,
  resolveLanguageMeta,
  validateLessonBookingInput,
  validateTeacherRegistrationInput
} from '../../services/personalTeacherService';
import {
  localizeAvailability,
  localizeLanguageName,
  localizeSlotLabel,
  localizeTeacherAccessLabel,
  t
} from '../../services/uiLocalization';

function localizeSpecialty(spec: TeacherSpecialty, nativeLanguage?: string | null): string {
  switch (spec) {
    case 'Conversation & Fluency':
      return t('teachers.specConversation', nativeLanguage);
    case 'Grammar & Writing':
      return t('teachers.specGrammar', nativeLanguage);
    case 'Exam Preparation':
      return t('teachers.specExam', nativeLanguage);
    case 'Pronunciation & Accent':
      return t('teachers.specPronunciation', nativeLanguage);
    case 'Business & Career':
      return t('teachers.specBusiness', nativeLanguage);
    default:
      return spec;
  }
}

const SPECIALTY_OPTIONS: TeacherSpecialty[] = [
  'Conversation & Fluency',
  'Grammar & Writing',
  'Exam Preparation',
  'Pronunciation & Accent',
  'Business & Career'
];

interface TeacherAvatarProps {
  name: string;
  avatarUrl: string;
  sizeClass?: string;
}

const TeacherAvatar: React.FC<TeacherAvatarProps> = ({
  name,
  avatarUrl,
  sizeClass = 'w-11 h-11 rounded-lg'
}) => {
  const fallback = createInitialsAvatarDataUri(name, '#6485F5');
  const [src, setSrc] = useState<string>(avatarUrl || fallback);

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
      className={`${sizeClass} object-cover border border-slate-300 dark:border-[#293342] shrink-0`}
    />
  );
};

interface BookLessonModalProps {
  teacher: PersonalTeacher;
  userProfile: UserProfile;
  onClose: () => void;
  onConfirmBooking: (booking: TeacherLessonBooking, teacher: PersonalTeacher) => Promise<void> | void;
}

export const BookLessonModal: React.FC<BookLessonModalProps> = ({
  teacher,
  userProfile,
  onClose,
  onConfirmBooking
}) => {
  const uiLang = userProfile.nativeLanguage;
  const [slotLabel, setSlotLabel] = useState<string>(teacher.nextAvailableSlots[0] || 'Today · 18:00');
  const [focusArea, setFocusArea] = useState<TeacherSpecialty>(
    teacher.specialties[0] || 'Conversation & Fluency'
  );
  const [learningGoal, setLearningGoal] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateLessonBookingInput({
      slotLabel,
      learningGoal,
      focusArea
    });

    if (!validation.valid) {
      setErrorMsg(validation.error || 'Please fill in all required lesson details.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    const newBooking: TeacherLessonBooking = {
      id: `bk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      teacherId: teacher.id,
      teacherName: teacher.name,
      teacherAvatar: teacher.avatarUrl,
      languageCode: teacher.languageCode,
      languageName: teacher.languageName,
      flag: teacher.flag,
      studentId: userProfile.id,
      studentName: userProfile.name,
      slotLabel: slotLabel.trim(),
      learningGoal: learningGoal.trim(),
      focusArea,
      roomId: buildTeacherRoomId(teacher.id),
      status: 'confirmed',
      createdAt: Date.now()
    };

    try {
      await onConfirmBooking(newBooking, teacher);
      onClose();
    } catch {
      setErrorMsg('Could not schedule session right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D1117]/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-teacher-modal-title"
    >
      <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl max-w-lg w-full p-6 shadow-2xl dark:shadow-[0_24px_64px_rgba(0,0,0,0.7)] space-y-5">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-[#293342]">
          <div className="flex items-center gap-3 min-w-0">
            <TeacherAvatar name={teacher.name} avatarUrl={teacher.avatarUrl} sizeClass="w-11 h-11 rounded-lg" />
            <div className="min-w-0">
              <h3 id="book-teacher-modal-title" className="font-semibold text-base text-slate-900 dark:text-[#F0F2F5] truncate">
                {t('teachers.bookModalTitle', uiLang, { name: teacher.name })}
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#9BA6B2] mt-0.5 truncate">
                {teacher.flag} {localizeLanguageName(teacher.languageName, uiLang)} · {teacher.cefrRange} · {teacher.accessLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-100 dark:hover:bg-[#1B2430] transition-colors cursor-pointer shrink-0"
            aria-label={t('common.close', uiLang)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs">
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium"
            >
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="booking-slot-select" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                {t('teachers.preferredSlot', uiLang)}
              </label>
              <select
                id="booking-slot-select"
                value={slotLabel}
                onChange={(e) => setSlotLabel(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] transition-colors"
              >
                {teacher.nextAvailableSlots.map(slot => (
                  <option key={slot} value={slot} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">
                    {slot}
                  </option>
                ))}
                <option value="Custom · Flexible Today" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">Custom · Flexible Today</option>
              </select>
            </div>

            <div>
              <label htmlFor="booking-focus-select" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                {t('teachers.coachingFocus', uiLang)}
              </label>
              <select
                id="booking-focus-select"
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value as TeacherSpecialty)}
                className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] transition-colors"
              >
                {SPECIALTY_OPTIONS.map(spec => (
                  <option key={spec} value={spec} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">
                    {localizeSpecialty(spec, uiLang)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="booking-goal-input" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
              {t('teachers.goalPromptLabel', uiLang)}
            </label>
            <textarea
              id="booking-goal-input"
              rows={3}
              value={learningGoal}
              onChange={(e) => {
                setLearningGoal(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder={t('teachers.learningGoal', uiLang)}
              className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] resize-none transition-colors"
            />
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] text-slate-600 dark:text-[#9BA6B2] leading-relaxed">
            {t('teachers.includedNote', uiLang, { name: teacher.name })}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              {t('common.cancel', uiLang)}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] disabled:opacity-40 text-white font-semibold border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer whitespace-nowrap"
            >
              {isSubmitting ? t('teachers.confirming', uiLang) : t('teachers.confirmBooking', uiLang)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface PersonalTeachersColumnProps {
  teachers: PersonalTeacher[];
  bookings: TeacherLessonBooking[];
  selectedLanguage: LanguageInfo;
  userProfile: UserProfile;
  onStartLessonWithTeacher: (teacher: PersonalTeacher) => void;
  onBookTeacherSession: (booking: TeacherLessonBooking, teacher: PersonalTeacher) => Promise<void> | void;
  onOpenFullTeachersTab: () => void;
}

/**
 * Dedicated Personal Teachers Column rendered alongside Active Language Chat Rooms
 * so every learner immediately has direct 1-on-1 teacher access right from the main hub.
 */
export const PersonalTeachersColumn: React.FC<PersonalTeachersColumnProps> = ({
  teachers,
  bookings,
  selectedLanguage,
  userProfile,
  onStartLessonWithTeacher,
  onBookTeacherSession,
  onOpenFullTeachersTab
}) => {
  const uiLang = userProfile.nativeLanguage;
  const [bookingTeacher, setBookingTeacher] = useState<PersonalTeacher | null>(null);

  // Prioritize teachers matching selectedLanguage first, then show top available teachers so column always has 4 rich options
  const prioritizedTeachers = React.useMemo(() => {
    const matching = filterPersonalTeachers(teachers, { language: selectedLanguage.code });
    const others = filterPersonalTeachers(teachers, {}).filter(
      t => t.languageCode.toLowerCase() !== selectedLanguage.code.toLowerCase()
    );
    return [...matching, ...others].slice(0, 4);
  }, [teachers, selectedLanguage.code]);

  const myUpcomingBookings = React.useMemo(
    () =>
      bookings.filter(
        b => b.status === 'confirmed' && (b.studentId === userProfile.id || b.studentName === userProfile.name)
      ),
    [bookings, userProfile.id, userProfile.name]
  );

  return (
    <aside
      aria-label={t('teachers.columnAriaLabel', uiLang)}
      className="rounded-xl bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] p-5 flex flex-col gap-5 h-fit shadow-xs dark:shadow-none"
    >
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-[#293342]">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
            {t('nav.teachers', uiLang)}
          </h2>
          <p className="text-xs text-slate-600 dark:text-[#9BA6B2] mt-1 leading-relaxed">
            {t('teachers.subtitle', uiLang)}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenFullTeachersTab}
          className="text-xs font-semibold text-slate-700 dark:text-[#9278D8] hover:text-slate-900 dark:hover:text-[#F0F2F5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {t('teachers.viewAll', uiLang, { count: teachers.length })}
        </button>
      </div>

      {myUpcomingBookings.length > 0 && (
        <div className="space-y-2.5 pb-4 border-b border-slate-200 dark:border-[#293342]">
          <div className="text-xs font-semibold text-slate-800 dark:text-[#F0F2F5]">
            {t('teachers.scheduledShort', uiLang, { count: myUpcomingBookings.length })}
          </div>
          <div className="space-y-2">
            {myUpcomingBookings.slice(0, 2).map(bk => {
              const matched = teachers.find(tItem => tItem.id === bk.teacherId);
              return (
                <div
                  key={bk.id}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900 dark:text-[#F0F2F5] truncate">
                      {bk.flag} {bk.teacherName}
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium whitespace-nowrap shrink-0">
                      {localizeSlotLabel(bk.slotLabel, uiLang)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2] line-clamp-1">{bk.learningGoal}</p>
                  {matched && (
                    <button
                      type="button"
                      onClick={() => onStartLessonWithTeacher(matched)}
                      className="w-full py-1.5 px-3 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold text-xs border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {t('teachers.joinClassroom', uiLang)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3.5">
        {prioritizedTeachers.map(teacher => (
          <div
            key={teacher.id}
            className="rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] hover:border-slate-300 dark:hover:border-[#293342] p-4 space-y-3 transition-colors duration-200"
          >
            <div className="flex items-start gap-3">
              <TeacherAvatar
                name={teacher.name}
                avatarUrl={teacher.avatarUrl}
                sizeClass="w-10 h-10 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-[#F0F2F5] truncate">{teacher.name}</h3>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-300 tabular-nums shrink-0">
                    <span>★ {teacher.rating.toFixed(2)}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-[#9BA6B2] mt-0.5">
                  <span>{teacher.flag} {localizeLanguageName(teacher.languageName, uiLang)}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{teacher.cefrRange}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="text-emerald-700 dark:text-emerald-400">{localizeAvailability(teacher.availability, uiLang)}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 dark:text-[#F0F2F5] leading-relaxed line-clamp-2">
              {teacher.lessonFocus}
            </p>

            <div className="text-[11px] text-slate-600 dark:text-[#9BA6B2] truncate">
              {teacher.specialties.slice(0, 2).map(s => localizeSpecialty(s, uiLang)).join(' · ')}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onStartLessonWithTeacher(teacher)}
                aria-label={`${t('teachers.oneOnOneRoom', uiLang)} · ${teacher.name}`}
                className="flex items-center justify-center py-2 px-3 rounded-lg bg-[#6485F5]/10 dark:bg-[#6485F5]/15 hover:bg-[#6485F5] text-indigo-700 dark:text-[#F0F2F5] hover:text-white font-medium text-xs border border-[#6485F5]/35 transition-colors cursor-pointer whitespace-nowrap active:scale-[0.99]"
              >
                <span>{t('teachers.oneOnOneRoom', uiLang)}</span>
              </button>
              <button
                type="button"
                onClick={() => setBookingTeacher(teacher)}
                aria-label={`${t('teachers.bookSlot', uiLang)} · ${teacher.name}`}
                className="flex items-center justify-center py-2 px-3 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] font-medium text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>{t('teachers.bookSlot', uiLang)}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenFullTeachersTab}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] font-medium text-xs transition-colors cursor-pointer whitespace-nowrap"
      >
        <span>{t('teachers.browseAll', uiLang)}</span>
        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
      </button>

      {bookingTeacher && (
        <BookLessonModal
          teacher={bookingTeacher}
          userProfile={userProfile}
          onClose={() => setBookingTeacher(null)}
          onConfirmBooking={onBookTeacherSession}
        />
      )}
    </aside>
  );
};

interface PersonalTeachersViewProps {
  teachers: PersonalTeacher[];
  bookings: TeacherLessonBooking[];
  selectedLanguage: LanguageInfo;
  supportedLanguages: LanguageInfo[];
  userProfile: UserProfile;
  onStartLessonWithTeacher: (teacher: PersonalTeacher) => void;
  onBookTeacherSession: (booking: TeacherLessonBooking, teacher: PersonalTeacher) => Promise<void> | void;
  onCancelBooking: (bookingId: string) => Promise<void> | void;
  onRegisterTeacher: (teacher: PersonalTeacher) => Promise<void> | void;
}

/**
 * Full-page Personal Teachers Directory & 1-on-1 Coaching Hub accessible to every user.
 */
export const PersonalTeachersView: React.FC<PersonalTeachersViewProps> = ({
  teachers,
  bookings,
  selectedLanguage,
  supportedLanguages,
  userProfile,
  onStartLessonWithTeacher,
  onBookTeacherSession,
  onCancelBooking,
  onRegisterTeacher
}) => {
  const uiLang = userProfile.nativeLanguage;
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState<TeacherSpecialty | 'all'>('all');
  const [availableNowOnly, setAvailableNowOnly] = useState<boolean>(false);
  const [bookingTeacher, setBookingTeacher] = useState<PersonalTeacher | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);

  // Register as Personal Teacher modal state
  const [regName, setRegName] = useState<string>('');
  const [regLanguage, setRegLanguage] = useState<string>(selectedLanguage.name);
  const [regCountry, setRegCountry] = useState<string>(userProfile.country || 'Global');
  const [regCefrRange, setRegCefrRange] = useState<string>('A1 – C1');
  const [regSpecialty, setRegSpecialty] = useState<TeacherSpecialty>('Conversation & Fluency');
  const [regCredentials, setRegCredentials] = useState<string>('');
  const [regFocus, setRegFocus] = useState<string>('');
  const [regBio, setRegBio] = useState<string>('');
  const [regError, setRegError] = useState<string | null>(null);

  const filteredTeachers = React.useMemo(
    () =>
      filterPersonalTeachers(teachers, {
        search: searchQuery,
        language: languageFilter,
        specialty: specialtyFilter,
        availableNowOnly
      }),
    [teachers, searchQuery, languageFilter, specialtyFilter, availableNowOnly]
  );

  const activeBookings = React.useMemo(
    () => bookings.filter(b => b.status === 'confirmed'),
    [bookings]
  );

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateTeacherRegistrationInput({
      name: regName,
      languageName: regLanguage,
      credentials: regCredentials,
      lessonFocus: regFocus,
      bio: regBio
    });

    if (!check.valid) {
      setRegError(check.error || 'Please complete all required fields.');
      return;
    }

    setRegError(null);
    const meta = resolveLanguageMeta(regLanguage);
    const cleanName = regName.trim();

    const createdTeacher: PersonalTeacher = {
      id: `teacher_${meta.code}_${Date.now().toString(36)}`,
      name: cleanName,
      avatarUrl: createInitialsAvatarDataUri(cleanName, '#059669'),
      country: regCountry.trim() || 'Global',
      flag: meta.flag,
      languageCode: meta.code,
      languageName: meta.name,
      alsoSpeaks: [userProfile.nativeLanguage || 'English'],
      cefrRange: regCefrRange,
      specialties: [regSpecialty, 'Conversation & Fluency'].filter(
        (v, idx, arr) => arr.indexOf(v) === idx
      ) as TeacherSpecialty[],
      credentials: regCredentials.trim(),
      yearsExperience: 5,
      rating: 5.0,
      lessonsCompleted: 1,
      availability: 'Available Now',
      nextAvailableSlots: ['Today · Flexible', 'Tomorrow · 10:00', 'Tomorrow · 18:00'],
      bio: regBio.trim(),
      lessonFocus: regFocus.trim(),
      accessLabel: 'Open 1-on-1 Access',
      isCommunityTeacher: true
    };

    await onRegisterTeacher(createdTeacher);
    setShowRegisterModal(false);
    setRegName('');
    setRegCredentials('');
    setRegFocus('');
    setRegBio('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 w-full min-w-0">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-[#293342]">
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
            {t('teachers.title', uiLang)}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9BA6B2] mt-1">
            {t('teachers.subtitle', uiLang)}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-900 dark:text-[#F0F2F5] font-medium text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.99]"
          >
            <Plus className="w-4 h-4 text-slate-700 dark:text-[#6485F5] shrink-0" />
            <span>{t('teachers.registerBtn', uiLang)}</span>
          </button>
        </div>
      </div>

      {/* Scheduled 1-on-1 Personal Teacher Sessions */}
      <section aria-label={t('teachers.upcomingSessions', uiLang)} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
            {t('teachers.upcomingSessions', uiLang)} ({activeBookings.length})
          </h2>
        </div>

        {activeBookings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeBookings.map(bk => {
              const teacherObj = teachers.find(tItem => tItem.id === bk.teacherId);
              return (
                <div
                  key={bk.id}
                  className="rounded-xl bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] p-5 flex flex-col justify-between gap-4 shadow-xs dark:shadow-none"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <TeacherAvatar
                          name={bk.teacherName}
                          avatarUrl={bk.teacherAvatar}
                          sizeClass="w-10 h-10 rounded-lg"
                        />
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-[#F0F2F5] truncate">
                            {bk.flag} {bk.teacherName}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-[#9BA6B2] truncate">
                            <span>{localizeSlotLabel(bk.slotLabel, uiLang)}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{localizeSpecialty(bk.focusArea, uiLang)}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="text-emerald-700 dark:text-emerald-400">{t('teachers.confirmed', uiLang)} · {bk.studentName}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-[#F0F2F5] leading-relaxed">
                      {t('profile.goalLabel', uiLang)} {bk.learningGoal}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#293342]">
                    <button
                      type="button"
                      onClick={() => onCancelBooking(bk.id)}
                      aria-label={`${t('teachers.cancelBooking', uiLang)} · ${bk.teacherName}`}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] font-medium text-xs transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {t('teachers.cancelBooking', uiLang)}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (teacherObj) {
                          onStartLessonWithTeacher(teacherObj);
                        } else {
                          onStartLessonWithTeacher({
                            id: bk.teacherId,
                            name: bk.teacherName,
                            avatarUrl: bk.teacherAvatar,
                            country: 'Global',
                            flag: bk.flag,
                            languageCode: bk.languageCode,
                            languageName: bk.languageName,
                            alsoSpeaks: ['English'],
                            cefrRange: 'All Levels',
                            specialties: [bk.focusArea],
                            credentials: 'Personal Language Teacher',
                            yearsExperience: 5,
                            rating: 5.0,
                            lessonsCompleted: 20,
                            availability: 'Available Now',
                            nextAvailableSlots: [bk.slotLabel],
                            bio: bk.learningGoal,
                            lessonFocus: bk.learningGoal,
                            accessLabel: 'Open 1-on-1 Access'
                          });
                        }
                      }}
                      aria-label={`${t('teachers.joinClassroom', uiLang)} · ${bk.teacherName}`}
                      className="flex items-center justify-center px-4 py-1.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold text-xs border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span>{t('teachers.joinClassroom', uiLang)}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Filters & Search Toolbar */}
      <section aria-label={t('teachers.allSpecialties', uiLang)} className="space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <label htmlFor="teacher-search-input" className="sr-only">
              {t('teachers.searchPlaceholder', uiLang)}
            </label>
            <Search className="w-4 h-4 text-slate-400 dark:text-[#9BA6B2] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="teacher-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('teachers.searchPlaceholder', uiLang)}
              className="w-full bg-white dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div>
              <label htmlFor="teacher-language-filter" className="sr-only">
                {t('rooms.allLanguages', uiLang)}
              </label>
              <select
                id="teacher-language-filter"
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className="bg-white dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] text-xs font-medium px-3 py-2.5 rounded-lg focus:outline-none focus:border-[#6485F5] cursor-pointer transition-colors"
              >
                <option value="all" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">{t('rooms.allLanguages', uiLang)}</option>
                {supportedLanguages.map(lang => (
                  <option key={lang.code} value={lang.code} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">
                    {lang.flag} {localizeLanguageName(lang.name, uiLang)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setAvailableNowOnly(prev => !prev)}
              aria-pressed={availableNowOnly}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                availableNowOnly
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-100 dark:bg-[#1B2430] text-slate-700 dark:text-[#F0F2F5] border-slate-300 dark:border-[#293342] hover:bg-slate-200 dark:hover:bg-[#232F3F]'
              }`}
            >
              {t('teachers.availableNowOnly', uiLang)}
            </button>
          </div>
        </div>

        {/* Specialty Segmented Filter Controls */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSpecialtyFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              specialtyFilter === 'all'
                ? 'bg-[#6485F5] text-white font-semibold'
                : 'bg-slate-100 dark:bg-[#1B2430] text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-slate-200 dark:border-[#293342]'
            }`}
          >
            {t('teachers.allSpecialties', uiLang)}
          </button>
          {SPECIALTY_OPTIONS.map(spec => (
            <button
              key={spec}
              type="button"
              onClick={() => setSpecialtyFilter(spec)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                specialtyFilter === spec
                  ? 'bg-[#6485F5] text-white font-semibold'
                  : 'bg-slate-100 dark:bg-[#1B2430] text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-slate-200 dark:border-[#293342]'
              }`}
            >
              {localizeSpecialty(spec, uiLang)}
            </button>
          ))}
        </div>
      </section>

      {/* Personal Teachers Directory Grid */}
      {filteredTeachers.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] p-10 text-center space-y-3 shadow-xs dark:shadow-none">
          <p className="text-sm font-semibold text-slate-900 dark:text-[#F0F2F5]">{t('teachers.noTeachersFound', uiLang)}</p>
          <p className="text-xs text-slate-600 dark:text-[#9BA6B2] max-w-md mx-auto">
            {t('teachers.subtitle', uiLang)}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setLanguageFilter('all');
              setSpecialtyFilter('all');
              setAvailableNowOnly(false);
            }}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-xs font-medium text-slate-900 dark:text-[#F0F2F5] transition-colors cursor-pointer"
          >
            {t('common.resetFilters', uiLang)}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredTeachers.map(teacher => (
            <article
              key={teacher.id}
              className="rounded-xl bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] hover:border-slate-300 dark:hover:border-[#293342] p-6 flex flex-col justify-between gap-5 transition-colors shadow-xs dark:shadow-none"
            >
              <div className="space-y-4">
                {/* Identity & Unboxed Metadata */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <TeacherAvatar
                      name={teacher.name}
                      avatarUrl={teacher.avatarUrl}
                      sizeClass="w-12 h-12 rounded-lg"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-[#F0F2F5] truncate">
                          {teacher.name}
                        </h3>
                        <CheckCircle2
                          className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                          aria-label={t('teachers.verifiedNative', uiLang)}
                        />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-[#9BA6B2] mt-0.5">
                        {teacher.credentials}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-[#9BA6B2] mt-1">
                        <span className="text-slate-800 dark:text-[#F0F2F5]">{teacher.flag} {localizeLanguageName(teacher.languageName, uiLang)}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{teacher.cefrRange}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="tabular-nums">{t('teachers.yearsExp', uiLang, { count: teacher.yearsExperience })}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="text-emerald-700 dark:text-emerald-400">{localizeAvailability(teacher.availability, uiLang)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-amber-500 dark:fill-amber-400" />
                      <span>{teacher.rating.toFixed(2)}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2] tabular-nums mt-0.5">
                      {t('teachers.sessionsDone', uiLang, { count: teacher.lessonsCompleted })}
                    </p>
                  </div>
                </div>

                {/* Bio & Teaching Focus */}
                <p className="text-xs sm:text-sm text-slate-700 dark:text-[#F0F2F5] leading-relaxed">
                  {teacher.bio}
                </p>

                <div className="pt-3 border-t border-slate-200 dark:border-[#293342] space-y-1.5 text-xs">
                  <p className="text-slate-800 dark:text-[#F0F2F5]">
                    <span className="text-slate-600 dark:text-[#9BA6B2]">{t('teachers.oneOnOneFocus', uiLang)} </span>
                    {teacher.lessonFocus}
                  </p>
                  <p className="text-slate-600 dark:text-[#9BA6B2]">
                    <span>{t('teachers.specialtiesLabel', uiLang)} {teacher.specialties.map(s => localizeSpecialty(s, uiLang)).join(' · ')}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{t('teachers.speaksLabel', uiLang)} {teacher.alsoSpeaks.map(l => localizeLanguageName(l, uiLang)).join(', ')}</span>
                  </p>
                  <p className="text-slate-600 dark:text-[#9BA6B2]">
                    <span>{t('teachers.nextSlotsLabel', uiLang)} {teacher.nextAvailableSlots.map(s => localizeSlotLabel(s, uiLang)).join(' · ')}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="text-slate-700 dark:text-[#F0F2F5] font-medium">{localizeTeacherAccessLabel(teacher.accessLabel, uiLang)}</span>
                  </p>
                </div>
              </div>

              {/* Primary & Secondary Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onStartLessonWithTeacher(teacher)}
                  aria-label={`${t('teachers.joinClassroom', uiLang)} · ${teacher.name}`}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold text-xs border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer whitespace-nowrap active:scale-[0.99]"
                >
                  <Video className="w-4 h-4 shrink-0" />
                  <span>{t('teachers.joinClassroom', uiLang)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBookingTeacher(teacher)}
                  aria-label={`${t('teachers.bookLesson', uiLang)} · ${teacher.name}`}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] font-medium text-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>{t('teachers.bookLesson', uiLang)}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Book Lesson Modal */}
      {bookingTeacher && (
        <BookLessonModal
          teacher={bookingTeacher}
          userProfile={userProfile}
          onClose={() => setBookingTeacher(null)}
          onConfirmBooking={onBookTeacherSession}
        />
      )}

      {/* Register as Personal Teacher Modal */}
      {showRegisterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D1117]/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-teacher-modal-title"
        >
          <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl max-w-lg w-full p-6 shadow-2xl dark:shadow-[0_24px_64px_rgba(0,0,0,0.7)] space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#293342]">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600 dark:text-[#6485F5] shrink-0" />
                <h3 id="register-teacher-modal-title" className="font-semibold text-base text-slate-900 dark:text-[#F0F2F5]">
                  {t('teachers.regModalTitle', uiLang)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-100 dark:hover:bg-[#1B2430] transition-colors cursor-pointer"
                aria-label={t('common.close', uiLang)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-4 text-xs">
              {regError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium"
                >
                  {regError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-teacher-name" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                    {t('teachers.regName', uiLang)}
                  </label>
                  <input
                    id="reg-teacher-name"
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Prof. Elena Rostova"
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="reg-teacher-lang" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                    {t('teachers.regLang', uiLang)}
                  </label>
                  <select
                    id="reg-teacher-lang"
                    value={regLanguage}
                    onChange={(e) => setRegLanguage(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] transition-colors"
                  >
                    {supportedLanguages.map(lang => (
                      <option key={lang.code} value={lang.name} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">
                        {lang.flag} {localizeLanguageName(lang.name, uiLang)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="reg-teacher-country" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                    {t('teachers.regCountry', uiLang)}
                  </label>
                  <input
                    id="reg-teacher-country"
                    type="text"
                    value={regCountry}
                    onChange={(e) => setRegCountry(e.target.value)}
                    placeholder={t('profile.countryPlaceholder', uiLang)}
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="reg-teacher-cefr" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                    {t('teachers.cefrRange', uiLang)}
                  </label>
                  <select
                    id="reg-teacher-cefr"
                    value={regCefrRange}
                    onChange={(e) => setRegCefrRange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] transition-colors"
                  >
                    <option value="A1 – C2" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">A1 – C2</option>
                    <option value="A1 – B2" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">A1 – B2</option>
                    <option value="B1 – C2" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">B1 – C2</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="reg-teacher-specialty" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                    {t('teachers.regSpecialty', uiLang)}
                  </label>
                  <select
                    id="reg-teacher-specialty"
                    value={regSpecialty}
                    onChange={(e) => setRegSpecialty(e.target.value as TeacherSpecialty)}
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] transition-colors"
                  >
                    {SPECIALTY_OPTIONS.map(spec => (
                      <option key={spec} value={spec} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">
                        {localizeSpecialty(spec, uiLang)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="reg-teacher-credentials" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                  {t('teachers.regCredentials', uiLang)}
                </label>
                <input
                  id="reg-teacher-credentials"
                  type="text"
                  value={regCredentials}
                  onChange={(e) => setRegCredentials(e.target.value)}
                  placeholder="e.g. Goethe / DELE / IELTS · 6 Years Coaching"
                  className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
                />
              </div>

              <div>
                <label htmlFor="reg-teacher-focus" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                  {t('teachers.regFocus', uiLang)}
                </label>
                <input
                  id="reg-teacher-focus"
                  type="text"
                  value={regFocus}
                  onChange={(e) => setRegFocus(e.target.value)}
                  placeholder={t('teachers.regFocus', uiLang)}
                  className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
                />
              </div>

              <div>
                <label htmlFor="reg-teacher-bio" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                  {t('teachers.regBio', uiLang)}
                </label>
                <textarea
                  id="reg-teacher-bio"
                  rows={3}
                  value={regBio}
                  onChange={(e) => setRegBio(e.target.value)}
                  placeholder={t('teachers.regBio', uiLang)}
                  className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] resize-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] font-medium transition-colors cursor-pointer"
                >
                  {t('common.cancel', uiLang)}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer"
                >
                  {t('teachers.publishProfile', uiLang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
