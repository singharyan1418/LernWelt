import React, { useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  Flame,
  Clock,
  BookMarked,
  Sparkles,
  ShieldCheck,
  Check,
  Plus,
  Trash2,
  Languages,
  Trophy,
  CheckCircle2,
  Calendar,
  ArrowRight,
  LogOut,
  AlertCircle,
  Zap,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { CEFRLevel, UserProfile, UserStreak } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../data/mockData';
import { StreakProgressIcon } from '../streak/StreakProgressIcon';
import { WeeklyPracticeChart } from './WeeklyPracticeChart';
import { initializeRealUserStreak, MINIMUM_DAILY_GOAL_MINUTES } from '../../services/streakService';
import { formatPracticedDuration } from '../../services/learningStatsService';
import { AppTheme } from '../../services/themeService';
import {
  persistAudioNotificationsEnabled,
  readStoredAudioNotificationsEnabled
} from '../../services/audioNotificationService';
import {
  getHtmlLangCode,
  localizeDayName,
  localizeLanguageName,
  localizeMilestone,
  localizePracticedDuration,
  NATIVE_LANGUAGE_OPTIONS,
  normalizeNativeLanguage,
  persistStoredNativeLanguage,
  t
} from '../../services/uiLocalization';
import {
  initGmailAuth,
  signInToGmail
} from '../../services/gmailService';
import { OfficialGoogleSignInButton } from '../common/OfficialGoogleSignInButton';

interface ProfileViewProps {
  userProfile: UserProfile;
  theme?: AppTheme;
  onChangeTheme?: (theme: AppTheme) => void;
  audioNotificationsEnabled?: boolean;
  onChangeAudioNotifications?: (enabled: boolean) => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onCheckInStreak?: () => void;
  onEnterRoom?: () => void;
  onLogout?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  theme = 'dark',
  onChangeTheme,
  audioNotificationsEnabled,
  onChangeAudioNotifications,
  onUpdateProfile,
  onCheckInStreak,
  onEnterRoom,
  onLogout
}) => {
  const [localAudioNotifsEnabled, setLocalAudioNotifsEnabled] = useState<boolean>(() =>
    audioNotificationsEnabled !== undefined
      ? audioNotificationsEnabled
      : readStoredAudioNotificationsEnabled()
  );

  useEffect(() => {
    if (audioNotificationsEnabled !== undefined) {
      setLocalAudioNotifsEnabled(audioNotificationsEnabled);
    }
  }, [audioNotificationsEnabled]);

  const effectiveAudioNotifsEnabled =
    audioNotificationsEnabled !== undefined ? audioNotificationsEnabled : localAudioNotifsEnabled;

  const handleToggleAudioNotifications = () => {
    const nextEnabled = !effectiveAudioNotifsEnabled;
    persistAudioNotificationsEnabled(nextEnabled);
    setLocalAudioNotifsEnabled(nextEnabled);
    onChangeAudioNotifications?.(nextEnabled);
  };
  const [isEditing, setIsEditing] = useState(false);
  const [showWeeklyChart, setShowWeeklyChart] = useState(false);
  const [name, setName] = useState(userProfile.name);
  const [emailInput, setEmailInput] = useState(userProfile.email);
  const [bio, setBio] = useState(userProfile.bio);
  const [country, setCountry] = useState(userProfile.country);
  const [nativeLanguage, setNativeLanguage] = useState(userProfile.nativeLanguage);
  const [targetLanguages, setTargetLanguages] = useState(userProfile.targetLanguages);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [streakFeedback, setStreakFeedback] = useState<string | null>(null);

  // Connected Gmail OAuth state
  const [gmailUser, setGmailUser] = useState<FirebaseUser | null>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);

  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(userProfile.name);
    setEmailInput(userProfile.email);
    setBio(userProfile.bio);
    setCountry(userProfile.country);
    setNativeLanguage(userProfile.nativeLanguage);
    setTargetLanguages(userProfile.targetLanguages);
  }, [userProfile]);

  useEffect(() => {
    const unsub = initGmailAuth(
      (u, token) => {
        setGmailUser(u);
        setGmailToken(token);
      },
      (u) => {
        setGmailUser(u);
        setGmailToken(null);
      }
    );
    return () => unsub();
  }, []);

  const uiLang = normalizeNativeLanguage(userProfile.nativeLanguage);

  const streak: UserStreak = initializeRealUserStreak(
    userProfile.streak || {
      streakDays: userProfile.streakDays || 0,
      bestStreak: userProfile.streakDays || 0,
      totalXp: 0,
      streakFreezesAvailable: 0,
      streakFreezesUsed: 0,
      dailyGoalMinutes: MINIMUM_DAILY_GOAL_MINUTES,
      dailyDrillGoal: 5,
      todayDrillsCompleted: 0,
      todayMinutes: 0,
      todaySeconds: 0,
      todayCompleted: false
    }
  );
  const basePracticeDuration = formatPracticedDuration(
    userProfile.totalPracticeMinutes,
    userProfile.totalPracticeSeconds
  );
  const practiceDurationDisplay = localizePracticedDuration(
    basePracticeDuration,
    userProfile.totalPracticeMinutes,
    userProfile.totalPracticeSeconds,
    uiLang
  );

  const handleConnectGoogleInProfile = async () => {
    setIsConnectingGmail(true);
    setProfileError(null);
    try {
      const res = await signInToGmail();
      setGmailUser(res.user);
      setGmailToken(res.accessToken);
      if (res.user.email && (!emailInput.trim() || emailInput.endsWith('@lernwelt.io'))) {
        setEmailInput(res.user.email);
      }
      setSavedSuccess(
        t('profile.googleConnectedSuccess', uiLang, { email: res.user.email || '' })
      );
      setTimeout(() => setSavedSuccess(null), 3000);
    } catch (err: any) {
      setProfileError(err?.message || t('profile.errGoogleCancelled', uiLang));
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const resolveTargetLangCode = (langName?: string) => {
    if (!langName) return 'de';
    const match = SUPPORTED_LANGUAGES.find(
      (l) => l.name.toLowerCase() === langName.trim().toLowerCase()
    );
    return match?.code || 'de';
  };

  const syncProfileStorageBeforeReload = (updatedFields: Partial<UserProfile>) => {
    try {
      const merged: UserProfile = {
        ...userProfile,
        ...updatedFields
      };
      if (merged.nativeLanguage) {
        persistStoredNativeLanguage(merged.nativeLanguage);
      }
      localStorage.setItem('lernwelt_user', JSON.stringify(merged));
      const existingRaw = localStorage.getItem('lernwelt_verified_session_v2');
      if (existingRaw) {
        const parsed = JSON.parse(existingRaw);
        localStorage.setItem(
          'lernwelt_verified_session_v2',
          JSON.stringify({ ...parsed, user: { ...(parsed?.user || {}), ...merged } })
        );
      }
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'profile');
        window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
      }
    } catch {}
  };

  const persistProfileUpdates = async (closeEditor: boolean) => {
    setProfileError(null);

    const cleanName = name.trim();
    const cleanEmail = emailInput.trim().toLowerCase();

    if (cleanName.length < 2) {
      setProfileError(t('profile.errNameShort', uiLang));
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setProfileError(t('profile.errEmailInvalid', uiLang));
      return;
    }

    const sanitizedTargets =
      targetLanguages.length > 0
        ? targetLanguages
        : [{ language: 'German', level: 'B1' as CEFRLevel, goal: 'Conversational Fluency' }];
    const primaryTargetCode = resolveTargetLangCode(sanitizedTargets[0]?.language);
    const primaryLevel = sanitizedTargets[0]?.level || 'B1';
    const canonicalNative = normalizeNativeLanguage(nativeLanguage);
    const didNativeLangChange =
      canonicalNative !== normalizeNativeLanguage(userProfile.nativeLanguage);

    setIsSaving(true);
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userProfile.id,
          email: cleanEmail,
          name: cleanName,
          nativeLanguage: canonicalNative,
          bio: bio.trim(),
          country: country.trim() || userProfile.country,
          timezone: userProfile.timezone,
          targetLanguageCode: primaryTargetCode,
          level: primaryLevel,
          targetLanguages: sanitizedTargets
        })
      });

      const data = await res.json();
      const verified = data?.verifiedAccount;
      const updatedFields: Partial<UserProfile> = {
        name: verified?.name || cleanName,
        email: verified?.email || cleanEmail,
        bio: bio.trim(),
        country: country.trim() || userProfile.country,
        nativeLanguage: canonicalNative,
        targetLanguages: sanitizedTargets,
        isVerified: true,
        verifiedId: verified?.verifiedId || userProfile.verifiedId
      };

      syncProfileStorageBeforeReload(updatedFields);
      onUpdateProfile(updatedFields);

      if (closeEditor) setIsEditing(false);
      if (didNativeLangChange) {
        setSavedSuccess(
          t('profile.saveSuccessReloading', canonicalNative, {
            language: localizeLanguageName(canonicalNative, canonicalNative)
          })
        );
        setTimeout(() => {
          window.location.reload();
        }, 120);
      } else {
        setSavedSuccess(t('profile.saveSuccess', canonicalNative));
        setTimeout(() => setSavedSuccess(null), 3500);
      }
    } catch {
      const fallbackFields: Partial<UserProfile> = {
        name: cleanName,
        email: cleanEmail,
        bio: bio.trim(),
        country: country.trim() || userProfile.country,
        nativeLanguage: canonicalNative,
        targetLanguages: sanitizedTargets
      };
      syncProfileStorageBeforeReload(fallbackFields);
      onUpdateProfile(fallbackFields);
      if (closeEditor) setIsEditing(false);
      if (didNativeLangChange) {
        setSavedSuccess(
          t('profile.saveSuccessReloading', canonicalNative, {
            language: localizeLanguageName(canonicalNative, canonicalNative)
          })
        );
        setTimeout(() => {
          window.location.reload();
        }, 120);
      } else {
        setSavedSuccess(t('profile.saveLocalSuccess', canonicalNative));
        setTimeout(() => setSavedSuccess(null), 3500);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistProfileUpdates(true);
  };

  const addTargetLanguage = () => {
    const existingNames = new Set(targetLanguages.map((t) => t.language.toLowerCase()));
    const nextSuggested =
      SUPPORTED_LANGUAGES.find((l) => !existingNames.has(l.name.toLowerCase()))?.name || 'French';
    setTargetLanguages((prev) => [
      ...prev,
      { language: nextSuggested, level: 'A1', goal: 'Travel and cultural conversational fluency' }
    ]);
  };

  const removeTargetLanguage = (index: number) => {
    setTargetLanguages((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-slate-900 dark:text-[#F1F4FA]">

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] rounded-xl p-6 sm:p-8 relative overflow-hidden shadow-xs dark:shadow-none">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          <div className="relative">
            <img
              src={userProfile.avatarUrl}
              alt={userProfile.name}
              referrerPolicy="no-referrer"
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border border-slate-200 dark:border-[#1D263B]"
            />
            <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md bg-emerald-500 text-[10px] font-bold text-white dark:text-[#080B12] border-2 border-white dark:border-[#0E1422]">
              {t('common.online', uiLang)}
            </span>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#F1F4FA]">{userProfile.name}</h1>
                </div>
                <p className="text-xs text-slate-600 dark:text-[#8E99B2] font-mono mt-0.5">{userProfile.email} • {userProfile.country}</p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(!isEditing);
                    setProfileError(null);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-[#141C2E] hover:bg-slate-200 dark:hover:bg-[#1B253B] text-slate-800 dark:text-[#C6CEE0] border border-slate-300 dark:border-[#283450] transition-colors cursor-pointer"
                >
                  {isEditing ? t('common.cancel', uiLang) : t('profile.editProfile', uiLang)}
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 dark:border-rose-500/25 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t('profile.signOut', uiLang)}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-slate-600 dark:text-[#8E99B2]">
              <span>{t('profile.nativeLabel', uiLang)} <strong className="text-slate-900 dark:text-[#C6CEE0] font-medium">{localizeLanguageName(userProfile.nativeLanguage, uiLang)}</strong></span>
              <span aria-hidden="true">·</span>
              <span>{t('profile.learningLabel', uiLang)} <strong className="text-slate-900 dark:text-[#C6CEE0] font-medium">{userProfile.targetLanguages.map((tl) => `${localizeLanguageName(tl.language, uiLang)} (${tl.level})`).join(', ')}</strong></span>
            </div>
          </div>
        </div>

        {savedSuccess && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            <Check className="w-4 h-4 shrink-0" />
            <span>{savedSuccess}</span>
          </div>
        )}
      </div>

      {/* Appearance / Theme Preference Selector */}
      <section
        aria-label={t('profile.appearanceTitle', uiLang)}
        data-testid="profile-appearance-section"
        className="bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] rounded-xl p-6 sm:p-7 space-y-4 shadow-xs dark:shadow-none"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F1F4FA] tracking-tight">
              {t('profile.appearanceTitle', uiLang)}
            </h2>
            <p className="text-xs text-slate-600 dark:text-[#8E99B2] mt-0.5">
              {t('profile.appearanceDesc', uiLang)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="theme-dark-btn"
            aria-pressed={theme === 'dark'}
            onClick={() => onChangeTheme?.('dark')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
              theme === 'dark'
                ? 'bg-[#5C6AE0]/10 dark:bg-[#5C6AE0]/15 border-[#5C6AE0] ring-2 ring-[#5C6AE0]/20'
                : 'bg-slate-50 dark:bg-[#090E18] border-slate-200 dark:border-[#1D263B] hover:border-slate-300 dark:hover:border-[#283450]'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-slate-900 text-indigo-300 border border-slate-700 flex items-center justify-center shrink-0">
                <Moon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-[#F1F4FA]">
                  {t('profile.themeDark', uiLang)}
                </div>
                <p className="text-xs text-slate-600 dark:text-[#8E99B2] mt-0.5 leading-relaxed">
                  {t('profile.themeDarkDesc', uiLang)}
                </p>
              </div>
            </div>
            {theme === 'dark' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#5C6AE0] text-white text-[10px] font-semibold shrink-0">
                <Check className="w-3 h-3" />
                <span>{t('profile.themeActive', uiLang)}</span>
              </span>
            )}
          </button>

          <button
            type="button"
            data-testid="theme-light-btn"
            aria-pressed={theme === 'light'}
            onClick={() => onChangeTheme?.('light')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
              theme === 'light'
                ? 'bg-[#5C6AE0]/10 dark:bg-[#5C6AE0]/15 border-[#5C6AE0] ring-2 ring-[#5C6AE0]/20'
                : 'bg-slate-50 dark:bg-[#090E18] border-slate-200 dark:border-[#1D263B] hover:border-slate-300 dark:hover:border-[#283450]'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                <Sun className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-[#F1F4FA]">
                  {t('profile.themeLight', uiLang)}
                </div>
                <p className="text-xs text-slate-600 dark:text-[#8E99B2] mt-0.5 leading-relaxed">
                  {t('profile.themeLightDesc', uiLang)}
                </p>
              </div>
            </div>
            {theme === 'light' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#5C6AE0] text-white text-[10px] font-semibold shrink-0">
                <Check className="w-3 h-3" />
                <span>{t('profile.themeActive', uiLang)}</span>
              </span>
            )}
          </button>
        </div>
      </section>

      {/* Audio Notifications Preference */}
      <section
        aria-label={t('profile.audioNotifTitle', uiLang)}
        data-testid="profile-audio-notifications-section"
        className="bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] rounded-xl p-6 sm:p-7 space-y-4 shadow-xs dark:shadow-none"
      >
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-[#F1F4FA] tracking-tight">
            {t('profile.audioNotifTitle', uiLang)}
          </h2>
          <p className="text-xs text-slate-600 dark:text-[#8E99B2] mt-0.5">
            {t('profile.audioNotifDesc', uiLang)}
          </p>
        </div>

        <div
          className={`p-4 rounded-xl border transition-colors flex items-center justify-between gap-4 ${
            effectiveAudioNotifsEnabled
              ? 'bg-[#5C6AE0]/8 dark:bg-[#5C6AE0]/12 border-[#5C6AE0]/50'
              : 'bg-slate-50 dark:bg-[#090E18] border-slate-200 dark:border-[#1D263B]'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                effectiveAudioNotifsEnabled
                  ? 'bg-[#5C6AE0]/15 text-[#5C6AE0] dark:text-[#8B97EE] border-[#5C6AE0]/35'
                  : 'bg-slate-200/70 dark:bg-[#141C2E] text-slate-500 dark:text-[#64708A] border-slate-300 dark:border-[#283450]'
              }`}
            >
              {effectiveAudioNotifsEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-900 dark:text-[#F1F4FA]">
                  {t('profile.audioNotifLabel', uiLang)}
                </span>
                <span
                  data-testid="audio-notifications-status"
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                    effectiveAudioNotifsEnabled
                      ? 'bg-[#5C6AE0] text-white'
                      : 'bg-slate-200 dark:bg-[#141C2E] text-slate-600 dark:text-[#8E99B2] border border-slate-300 dark:border-[#283450]'
                  }`}
                >
                  {effectiveAudioNotifsEnabled
                    ? t('profile.audioNotifEnabled', uiLang)
                    : t('profile.audioNotifDisabled', uiLang)}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-[#8E99B2] mt-0.5 leading-relaxed">
                {t('profile.audioNotifDetail', uiLang)}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={effectiveAudioNotifsEnabled}
            aria-label={t('profile.audioNotifLabel', uiLang)}
            data-testid="audio-notifications-toggle"
            onClick={handleToggleAudioNotifications}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C6AE0] ${
              effectiveAudioNotifsEnabled
                ? 'bg-[#5C6AE0] border-[#6A77E8]'
                : 'bg-slate-300 dark:bg-[#141C2E] border-slate-400/60 dark:border-[#283450]'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                effectiveAudioNotifsEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Edit Profile Drawer (Direct Save without OTP) */}
      {isEditing && (
        <div className="bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] rounded-xl p-6 sm:p-8 space-y-5 shadow-md dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-[#1D263B] pb-4">
            <div>
              <h2 className="font-bold text-lg text-slate-900 dark:text-[#F1F4FA]">{t('profile.editHeading', uiLang)}</h2>
              <p className="text-xs text-slate-600 dark:text-[#8E99B2] mt-0.5">
                {t('profile.editSubheading', uiLang)}
              </p>
            </div>
            {gmailToken ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t('profile.googleConnected', uiLang, { email: gmailUser?.email || '' })}</span>
              </span>
            ) : (
              <div className="shrink-0">
                <OfficialGoogleSignInButton
                  onClick={handleConnectGoogleInProfile}
                  isLoading={isConnectingGmail}
                  label={t('profile.connectGoogle', uiLang)}
                  compact
                />
              </div>
            )}
          </div>

          {profileError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-200"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleSave} noValidate className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-display-name" className="text-xs text-slate-700 dark:text-[#C6CEE0] font-medium block mb-1.5">
                  {t('profile.displayName', uiLang)}
                </label>
                <input
                  id="profile-display-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#090E18] border border-slate-300 dark:border-[#1D263B] rounded-lg p-2.5 text-xs text-slate-900 dark:text-[#F1F4FA] focus:outline-none focus:border-[#5C6AE0] transition-colors"
                />
              </div>

              <div>
                <label htmlFor="profile-gmail-address" className="text-xs text-slate-700 dark:text-[#C6CEE0] font-medium block mb-1.5">
                  {t('profile.emailAddress', uiLang)}
                </label>
                <input
                  id="profile-gmail-address"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full bg-slate-50 dark:bg-[#090E18] border border-slate-300 dark:border-[#1D263B] rounded-lg p-2.5 text-xs text-slate-900 dark:text-[#F1F4FA] focus:outline-none focus:border-[#5C6AE0] transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-native-lang" className="text-xs text-slate-700 dark:text-[#C6CEE0] font-medium block mb-1.5">
                  {t('profile.nativeLanguage', uiLang)}
                </label>
                <input
                  id="profile-native-lang"
                  list="profile-native-languages-list"
                  type="text"
                  value={nativeLanguage}
                  onChange={(e) => setNativeLanguage(e.target.value)}
                  placeholder="English, Deutsch / German, Español..."
                  className="w-full bg-slate-50 dark:bg-[#090E18] border border-slate-300 dark:border-[#1D263B] rounded-lg p-2.5 text-xs text-slate-900 dark:text-[#F1F4FA] focus:outline-none focus:border-[#5C6AE0] transition-colors"
                />
                <datalist id="profile-native-languages-list">
                  {NATIVE_LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.flag} {opt.nativeLabel} ({opt.englishLabel})
                    </option>
                  ))}
                </datalist>
                <select
                  id="profile-native-lang-select"
                  aria-label={t('profile.quickSelectLanguage', uiLang)}
                  value={normalizeNativeLanguage(nativeLanguage)}
                  onChange={(e) => setNativeLanguage(e.target.value)}
                  className="w-full mt-2 bg-slate-50 dark:bg-[#090E18] border border-slate-300 dark:border-[#1D263B] rounded-lg p-2.5 text-xs text-slate-800 dark:text-[#C6CEE0] focus:outline-none focus:border-[#5C6AE0] cursor-pointer transition-colors"
                >
                  {NATIVE_LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#0E1422] text-slate-900 dark:text-[#F1F4FA]">
                      {opt.flag} {opt.nativeLabel} — {localizeLanguageName(opt.englishLabel, uiLang)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-600 dark:text-[#8E99B2] mt-1.5 leading-relaxed">
                  {t('profile.nativeLanguageHint', uiLang)}
                </p>
              </div>
              <div>
                <label htmlFor="profile-country" className="text-xs text-slate-700 dark:text-[#C6CEE0] font-medium block mb-1.5">
                  {t('profile.countryRegion', uiLang)}
                </label>
                <input
                  id="profile-country"
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder={t('profile.countryPlaceholder', uiLang)}
                  className="w-full bg-slate-50 dark:bg-[#090E18] border border-slate-300 dark:border-[#1D263B] rounded-lg p-2.5 text-xs text-slate-900 dark:text-[#F1F4FA] focus:outline-none focus:border-[#5C6AE0] transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-bio-input" className="text-xs text-slate-700 dark:text-[#C6CEE0] font-medium block mb-1.5">
                {t('profile.bioGoals', uiLang)}
              </label>
              <textarea
                id="profile-bio-input"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#090E18] border border-slate-300 dark:border-[#1D263B] rounded-lg p-2.5 text-xs text-slate-900 dark:text-[#F1F4FA] resize-none focus:outline-none focus:border-[#5C6AE0] transition-colors"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#141C2E] hover:bg-slate-200 dark:hover:bg-[#1B253B] text-slate-800 dark:text-[#C6CEE0] border border-slate-300 dark:border-[#283450] transition-colors cursor-pointer"
              >
                {t('common.cancel', uiLang)}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#5C6AE0] hover:bg-[#6A77E8] disabled:opacity-60 text-white font-semibold text-xs border border-[#6E7AE8]/40 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? t('common.saving', uiLang) : t('profile.saveProfile', uiLang)}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Learning Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          onClick={onEnterRoom}
          className="bg-white dark:bg-[#0E1422] hover:bg-slate-50 dark:hover:bg-[#141C2E] border border-slate-200 dark:border-[#1D263B] hover:border-amber-500/40 rounded-xl p-4.5 space-y-1 transition-colors cursor-pointer group shadow-xs dark:shadow-none"
        >
          <div className="flex items-center justify-between gap-1 text-amber-700 dark:text-amber-300 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <StreakProgressIcon
                todayMinutes={streak.todayMinutes}
                dailyGoalMinutes={streak.dailyGoalMinutes}
                size={22}
                strokeWidth={2.75}
                streakDays={streak.streakDays}
                nativeLanguage={uiLang}
              />
              <span>{t('profile.statStreak', uiLang)}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-600 dark:text-[#8E99B2] tabular-nums">
              {streak.todayMinutes}/{streak.dailyGoalMinutes}m
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-[#F1F4FA] tabular-nums">{streak.streakDays} {t('common.days', uiLang)}</p>
          <p className="text-[10px] text-slate-600 dark:text-[#8E99B2]">
            {streak.todayCompleted
              ? t('profile.statStreakDone', uiLang)
              : t('profile.statStreakLeft', uiLang, {
                  minutes: Math.max(0, streak.dailyGoalMinutes - streak.todayMinutes)
                })}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] rounded-xl p-4.5 space-y-1 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-400 text-xs font-semibold">
            <Clock className="w-4 h-4" />
            <span>{t('profile.statTimePracticed', uiLang)}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-[#F1F4FA] tabular-nums" data-testid="profile-time-practiced">
            {practiceDurationDisplay.valueLabel}
          </p>
          <p className="text-[10px] text-slate-600 dark:text-[#8E99B2]">{practiceDurationDisplay.detailLabel}</p>
        </div>

        <div className="bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] rounded-xl p-4.5 space-y-1 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-[#8B97EE] text-xs font-semibold">
            <BookMarked className="w-4 h-4" />
            <span>{t('profile.statVocabWords', uiLang)}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-[#F1F4FA] tabular-nums" data-testid="profile-vocab-words">
            {userProfile.wordsLearned}
          </p>
          <p className="text-[10px] text-slate-600 dark:text-[#8E99B2]">{t('profile.statVocabDesc', uiLang)}</p>
        </div>

        <div className="bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] rounded-xl p-4.5 space-y-1 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t('profile.statCorrections', uiLang)}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-[#F1F4FA] tabular-nums" data-testid="profile-corrections">
            {userProfile.correctionsReceived}
          </p>
          <p className="text-[10px] text-slate-600 dark:text-[#8E99B2]">{t('profile.statCorrectionsDesc', uiLang)}</p>
        </div>
      </div>

      {/* Weekly Practice Chart Toggle Button & Expandable Recharts Panel */}
      <div className="bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] rounded-xl p-5 sm:p-6 space-y-5 shadow-xs dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#5C6AE0]/15 border border-[#5C6AE0]/30 flex items-center justify-center text-indigo-600 dark:text-[#8B97EE] shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#F1F4FA] tracking-tight">
                {t('profile.weeklyChartTitle', uiLang)}
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#8E99B2]">
                {t('profile.weeklyChartDesc', uiLang, { goal: streak.dailyGoalMinutes || MINIMUM_DAILY_GOAL_MINUTES })}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="toggle-weekly-practice-chart-btn"
            aria-expanded={showWeeklyChart}
            aria-controls="weekly-practice-chart-panel"
            onClick={() => setShowWeeklyChart((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5C6AE0] hover:bg-[#6A77E8] text-white text-xs font-semibold border border-[#6E7AE8]/40 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>
              {showWeeklyChart
                ? t('profile.hideWeeklyChart', uiLang)
                : t('profile.showWeeklyChart', uiLang)}
            </span>
            {showWeeklyChart ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {showWeeklyChart && (
          <div
            id="weekly-practice-chart-panel"
            data-testid="weekly-practice-chart-panel"
            className="pt-4 border-t border-slate-200 dark:border-[#1D263B]"
          >
            <WeeklyPracticeChart
              streak={streak}
              theme={theme}
              nativeLanguage={uiLang}
              embedded
            />
          </div>
        )}
      </div>

      {/* Gamified Daily Learning Streak Tracker */}
      <div className="bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] rounded-xl p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-xs dark:shadow-none">
        {/* Tracker Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 border-b border-slate-200 dark:border-[#1D263B] pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              <Flame className="w-3.5 h-3.5 fill-amber-500 dark:fill-amber-400 text-amber-500 dark:text-amber-400" />
              <span>{t('profile.streakTrackerBadge', uiLang)}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#F1F4FA] flex items-center gap-2 tracking-tight">
              <span>{t('profile.streakTitle', uiLang, { days: streak.streakDays })}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                {t('profile.xpMultiplier', uiLang, { mult: streak.currentMultiplier })}
              </span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-[#8E99B2]">
              {t('profile.streakDesc', uiLang)}
            </p>
          </div>

          {/* Interactive Check-in or Status */}
          <div className="shrink-0">
            {streak.todayCompleted ? (
              <div className="px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t('profile.todaySecured', uiLang)}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onCheckInStreak?.();
                  setStreakFeedback(
                    t('profile.streakAdvanced', uiLang, { days: streak.streakDays + 1 })
                  );
                  setTimeout(() => setStreakFeedback(null), 3500);
                }}
                className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#080B12] font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors active:scale-[0.99] cursor-pointer"
              >
                <Flame className="w-4 h-4 fill-[#080B12]" />
                <span>{t('profile.checkInToday', uiLang)}</span>
              </button>
            )}
          </div>
        </div>

        {streakFeedback && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>{streakFeedback}</span>
          </div>
        )}

        {/* 7-Day Weekly Streak Strip */}
        <div className="bg-slate-50 dark:bg-[#090E18] border border-slate-200 dark:border-[#1D263B] rounded-lg p-4 sm:p-5 space-y-3 relative z-10">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 dark:text-[#C6CEE0] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              {t('profile.weeklyStripTitle', uiLang)}
            </span>
            <span className="text-slate-600 dark:text-[#8E99B2] text-[11px] tabular-nums">
              {t('profile.allTimeBest', uiLang)} <strong className="text-amber-700 dark:text-amber-300">{streak.bestStreak} {t('common.days', uiLang)}</strong>
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {streak.weeklyHistory.map((item, index) => {
              const isToday = index === 6;
              const isDone = item.completed || (isToday && streak.todayCompleted);
              return (
                <div
                  key={index}
                  className={`flex flex-col items-center p-2.5 rounded-lg border text-center transition-colors ${
                    isDone
                      ? 'bg-amber-500/10 border-amber-500/35 text-amber-800 dark:text-amber-300'
                      : isToday
                        ? 'bg-indigo-50 dark:bg-[#141C2E] border-[#5C6AE0]/60 text-indigo-700 dark:text-[#8B97EE]'
                        : 'bg-white dark:bg-[#0E1422] border-slate-200 dark:border-[#1D263B] text-slate-500 dark:text-[#64708A]'
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase">
                    {localizeDayName(item.dayName, uiLang)}
                  </span>
                  <div className="my-2 flex items-center justify-center">
                    {isDone ? (
                      <Flame className="w-5 h-5 text-amber-500 dark:text-amber-400 fill-amber-500 dark:fill-amber-400" />
                    ) : isToday ? (
                      <div className="w-5 h-5 rounded-full border-2 border-dashed border-[#5C6AE0] flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-[#8B97EE]">
                        ?
                      </div>
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-[#1D263B]" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono font-semibold tabular-nums">
                    {isDone
                      ? `+${item.xpEarned || 0} ${t('common.xpUnit', uiLang)}`
                      : `0 ${t('common.xpUnit', uiLang)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Protection & Daily Target Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
          <div className="bg-slate-50 dark:bg-[#090E18] border border-slate-200 dark:border-[#1D263B] rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-[#C6CEE0]">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                {t('profile.dailySpeakingGoal', uiLang)}
              </span>
              <span className="text-sky-700 dark:text-sky-300 font-mono tabular-nums">
                {streak.todayMinutes} / {streak.dailyGoalMinutes} {t('common.min', uiLang)}
              </span>
            </div>

            <div className="w-full h-2 bg-slate-200 dark:bg-[#141C2E] rounded-full overflow-hidden border border-slate-300 dark:border-[#1D263B]">
              <div
                className="h-full bg-[#5C6AE0] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((streak.todayMinutes / streak.dailyGoalMinutes) * 100))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-[#8E99B2] pt-1">
              <span>
                {t('profile.percentCompleted', uiLang, {
                  percent: Math.round((streak.todayMinutes / streak.dailyGoalMinutes) * 100)
                })}
              </span>
              {onEnterRoom && (
                <button
                  type="button"
                  onClick={onEnterRoom}
                  className="text-indigo-600 dark:text-[#8B97EE] hover:text-indigo-800 dark:hover:text-white font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>{t('profile.practiceRoom', uiLang)}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#090E18] border border-slate-200 dark:border-[#1D263B] rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-[#C6CEE0]">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                {t('profile.dailyAiDrills', uiLang)}
              </span>
              <span className="text-amber-700 dark:text-amber-300 font-mono tabular-nums">
                {t('profile.drillsFraction', uiLang, {
                  done: streak.todayDrillsCompleted || 0,
                  goal: streak.dailyDrillGoal || 5
                })}
              </span>
            </div>

            <div className="w-full h-2 bg-slate-200 dark:bg-[#141C2E] rounded-full overflow-hidden border border-slate-300 dark:border-[#1D263B]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (streak.todayDrillsCompleted || 0) >= (streak.dailyDrillGoal || 5)
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
                style={{
                  width: `${Math.min(100, Math.round(((streak.todayDrillsCompleted || 0) / (streak.dailyDrillGoal || 5)) * 100))}%`
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-700 dark:text-[#C6CEE0] pt-1">
              {(streak.todayDrillsCompleted || 0) >= (streak.dailyDrillGoal || 5) ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('profile.dailyCompletionBadge', uiLang)}
                </span>
              ) : (
                <span className="text-slate-600 dark:text-[#8E99B2]">
                  {t('profile.moreToBadge', uiLang, {
                    count: (streak.dailyDrillGoal || 5) - (streak.todayDrillsCompleted || 0)
                  })}
                </span>
              )}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#090E18] border border-slate-200 dark:border-[#1D263B] rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-[#C6CEE0]">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {t('profile.streakFreezeTitle', uiLang)}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                  streak.streakFreezesAvailable > 0
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-100 dark:bg-[#141C2E] text-slate-600 dark:text-[#8E99B2] border border-slate-300 dark:border-[#1D263B]'
                }`}
              >
                {t('profile.equipped', uiLang, { count: streak.streakFreezesAvailable })}
              </span>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-[#C6CEE0]">
              {streak.streakFreezesAvailable > 0
                ? t('profile.freezeDescActive', uiLang)
                : t('profile.freezeDescEmpty', uiLang)}
            </p>
            <div
              className={`flex items-center gap-1.5 text-[10px] font-medium ${
                streak.streakFreezesAvailable > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-[#8E99B2]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                {streak.streakFreezesAvailable > 0
                  ? t('profile.freezeStatusProtected', uiLang, { used: streak.streakFreezesUsed })
                  : t('profile.freezeStatusNone', uiLang, { used: streak.streakFreezesUsed })}
              </span>
            </div>
          </div>
        </div>

        {/* Milestone Unlocks */}
        <div className="bg-slate-50 dark:bg-[#090E18] border border-slate-200 dark:border-[#1D263B] rounded-lg p-4 sm:p-5 space-y-3 relative z-10">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 dark:text-[#C6CEE0] flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              {t('profile.milestonesTitle', uiLang)}
            </span>
            <span className="text-amber-700 dark:text-amber-400 font-mono font-semibold text-xs tabular-nums">
              {t('profile.totalXpEarned', uiLang, { xp: streak.totalXp })}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {streak.milestones.map((m) => {
              const isUnlocked = m.unlocked || streak.streakDays >= m.days;
              const locM = localizeMilestone(m.days, m.title, m.reward, uiLang);
              return (
                <div
                  key={m.days}
                  className={`flex items-center justify-between p-3 rounded-lg border text-xs ${
                    isUnlocked
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                      : 'bg-white dark:bg-[#0E1422] border-slate-200 dark:border-[#1D263B] text-slate-600 dark:text-[#8E99B2]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl">{m.icon}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-[#F1F4FA] truncate flex items-center gap-1.5">
                        <span>{locM.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#141C2E] border border-slate-300 dark:border-[#1D263B] text-slate-700 dark:text-[#C6CEE0] font-mono shrink-0">
                          {m.days}{getHtmlLangCode(uiLang) === 'de' ? 'T' : 'd'}
                        </span>
                      </div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-300/80 truncate">{locM.reward}</div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {isUnlocked ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-[10px] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {t('profile.unlocked', uiLang)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 dark:text-[#64708A] font-mono tabular-nums">
                        {streak.streakDays}/{m.days}{getHtmlLangCode(uiLang) === 'de' ? 'T' : 'd'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Target Languages Management */}
      <div className="bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] rounded-xl p-6 sm:p-8 space-y-5 shadow-xs dark:shadow-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-indigo-600 dark:text-[#8B97EE]" />
            <h3 className="font-bold text-base text-slate-900 dark:text-[#F1F4FA]">{t('profile.targetLanguagesTitle', uiLang)}</h3>
          </div>
          {isEditing && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={addTargetLanguage}
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-[#8B97EE] hover:text-indigo-800 dark:hover:text-white font-semibold cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>{t('profile.addLanguage', uiLang)}</span>
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => persistProfileUpdates(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5C6AE0] hover:bg-[#6A77E8] disabled:opacity-60 text-white text-xs font-semibold border border-[#6E7AE8]/40 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? t('common.saving', uiLang) : t('profile.saveLanguages', uiLang)}</span>
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {targetLanguages.map((target, idx) => (
            <div
              key={idx}
              className="bg-slate-50 dark:bg-[#090E18] border border-slate-200 dark:border-[#1D263B] rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {isEditing ? (
                    <select
                      aria-label={`${t('profile.learningLabel', uiLang)} ${idx + 1}`}
                      value={target.language}
                      onChange={(e) => {
                        const nextLang = e.target.value;
                        setTargetLanguages((prev) =>
                          prev.map((tl, i) => (i === idx ? { ...tl, language: nextLang } : tl))
                        );
                      }}
                      className="bg-white dark:bg-[#0E1422] border border-slate-300 dark:border-[#1D263B] text-xs font-semibold text-slate-900 dark:text-[#F1F4FA] px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-[#5C6AE0]"
                    >
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.name} className="bg-white dark:bg-[#0E1422] text-slate-900 dark:text-[#F1F4FA]">
                          {l.flag} {localizeLanguageName(l.name, uiLang)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-bold text-sm text-slate-900 dark:text-[#F1F4FA]">
                      {localizeLanguageName(target.language, uiLang)}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-md bg-[#5C6AE0]/15 border border-[#5C6AE0]/30 text-indigo-700 dark:text-[#8B97EE] font-mono text-xs font-semibold">
                    {getHtmlLangCode(uiLang) === 'de' ? 'GER' : 'CEFR'} {target.level}
                  </span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    aria-label={`${t('profile.goalLabel', uiLang)} ${target.language}`}
                    value={target.goal}
                    onChange={(e) => {
                      const nextGoal = e.target.value;
                      setTargetLanguages((prev) =>
                        prev.map((tl, i) => (i === idx ? { ...tl, goal: nextGoal } : tl))
                      );
                    }}
                    placeholder={t('profile.goalPlaceholder', uiLang)}
                    className="w-full mt-1.5 bg-white dark:bg-[#0E1422] border border-slate-300 dark:border-[#1D263B] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-[#C6CEE0] focus:outline-none focus:border-[#5C6AE0]"
                  />
                ) : (
                  <p className="text-xs text-slate-600 dark:text-[#8E99B2]">
                    {t('profile.goalLabel', uiLang)} {target.goal}
                  </p>
                )}
              </div>

              {isEditing && (
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    aria-label={`${getHtmlLangCode(uiLang) === 'de' ? 'GER' : 'CEFR'} ${target.language}`}
                    value={target.level}
                    onChange={(e) => {
                      const newLvl = e.target.value as CEFRLevel;
                      setTargetLanguages((prev) =>
                        prev.map((tl, i) => (i === idx ? { ...tl, level: newLvl } : tl))
                      );
                    }}
                    className="bg-white dark:bg-[#0E1422] border border-slate-300 dark:border-[#1D263B] text-xs text-slate-900 dark:text-[#F1F4FA] p-1.5 rounded-lg focus:outline-none focus:border-[#5C6AE0]"
                  >
                    {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CEFRLevel[]).map((l) => (
                      <option key={l} value={l} className="bg-white dark:bg-[#0E1422] text-slate-900 dark:text-[#F1F4FA]">
                        {l}
                      </option>
                    ))}
                  </select>

                  {targetLanguages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTargetLanguage(idx)}
                      aria-label={`${target.language}`}
                      className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-slate-200 dark:hover:bg-[#141C2E] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
