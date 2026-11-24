import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  GraduationCap,
  Mail,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  Video,
  MonitorUp,
  Bot,
  Globe2,
  Sparkles
} from 'lucide-react';
import { CEFRLevel, LanguageInfo, UserProfile } from '../../types';
import { SUPPORTED_LANGUAGES, INITIAL_USER_PROFILE } from '../../data/mockData';
import { createInitialsAvatarDataUri } from '../../data/teacherData';
import { signInToGmail } from '../../services/gmailService';
import { PersistedLearningStats, sanitizeToRealStatsProfile } from '../../services/learningStatsService';
import { OfficialGoogleSignInButton } from '../common/OfficialGoogleSignInButton';
import {
  getStoredNativeLanguage,
  localizeLanguageName,
  normalizeNativeLanguage,
  persistStoredNativeLanguage,
  t
} from '../../services/uiLocalization';
import { BRAND_IMAGES } from '../../utils/brandAssets';

interface LoginInterfaceProps {
  onLoginSuccess: (
    profile: UserProfile,
    targetLanguage: LanguageInfo,
    sessionToken?: string,
    learningStats?: PersistedLearningStats
  ) => void;
  defaultLanguage?: LanguageInfo;
  invitedRoomId?: string | null;
}

const LOGIN_SHOWCASE_IMAGE = BRAND_IMAGES.loginShowcase;

const LAST_EMAIL_KEY = 'lernwelt_last_email';

const COMMON_NATIVE_LANGUAGES = [
  'English',
  'German',
  'Spanish',
  'French',
  'Italian',
  'Portuguese',
  'Japanese',
  'Mandarin',
  'Hindi',
  'Korean',
  'Arabic',
  'Russian'
];

export const LoginInterface: React.FC<LoginInterfaceProps> = ({
  onLoginSuccess,
  defaultLanguage = SUPPORTED_LANGUAGES[1] || SUPPORTED_LANGUAGES[0],
  invitedRoomId = null
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState<string>(() => getStoredNativeLanguage() || 'English');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(LAST_EMAIL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedLangCode, setSelectedLangCode] = useState(defaultLanguage.code);
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel>('B1');

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [heroImageError, setHeroImageError] = useState(false);

  const uiLang = nativeLanguage;

  const selectedTargetLanguage =
    SUPPORTED_LANGUAGES.find((l) => l.code === selectedLangCode) || SUPPORTED_LANGUAGES[0];

  const handleNativeLanguageInputChange = (val: string) => {
    setNativeLanguage(val);
    if (val.trim()) {
      persistStoredNativeLanguage(val);
    }
  };

  const buildProfileFromVerified = (verified: any, fallbackPhotoUrl?: string): { profile: UserProfile; resolvedLang: LanguageInfo } => {
    const firstStoredTarget = Array.isArray(verified.targetLanguages) && verified.targetLanguages.length > 0
      ? verified.targetLanguages[0]
      : null;

    const resolvedLang =
      SUPPORTED_LANGUAGES.find((l) => l.code === verified.targetLanguageCode) ||
      (firstStoredTarget
        ? SUPPORTED_LANGUAGES.find((l) => l.name.toLowerCase() === String(firstStoredTarget.language).toLowerCase())
        : undefined) ||
      selectedTargetLanguage;

    const resolvedTargets =
      Array.isArray(verified.targetLanguages) && verified.targetLanguages.length > 0
        ? verified.targetLanguages
        : [
            {
              language: resolvedLang.name,
              level: (verified.level as CEFRLevel) || selectedLevel,
              goal: 'Conversational Fluency & Verified Exchange'
            }
          ];

    const rawStats = verified.learningStats as PersistedLearningStats | undefined;
    const savedVocab = Array.isArray(rawStats?.vocabulary) ? rawStats.vocabulary : [];
    const resolvedNative =
      verified.nativeLanguage ||
      normalizeNativeLanguage(nativeLanguage.trim()) ||
      INITIAL_USER_PROFILE.nativeLanguage;
    persistStoredNativeLanguage(resolvedNative);

    const baseProfile: UserProfile = {
      ...INITIAL_USER_PROFILE,
      id: verified.userId,
      name: verified.name,
      email: verified.email,
      nativeLanguage: resolvedNative,
      bio: verified.bio !== undefined ? verified.bio : INITIAL_USER_PROFILE.bio,
      country: verified.country || country.trim() || INITIAL_USER_PROFILE.country,
      timezone: verified.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || INITIAL_USER_PROFILE.timezone,
      avatarUrl: fallbackPhotoUrl || createInitialsAvatarDataUri(verified.name, '#4f46e5'),
      isVerified: true,
      verifiedId: verified.verifiedId,
      verifiedAt: verified.verifiedAt,
      targetLanguages: resolvedTargets,
      ...(rawStats && rawStats.statsSource === 'real'
        ? {
            streak: rawStats.streak,
            streakDays: rawStats.streak?.streakDays ?? 0,
            totalPracticeSeconds: rawStats.totalPracticeSeconds ?? 0,
            totalPracticeMinutes: rawStats.totalPracticeMinutes ?? 0,
            correctionsReceived: rawStats.correctionsReceived ?? 0,
            wordsLearned: savedVocab.length,
            statsSource: 'real' as const
          }
        : {
            statsSource: undefined
          })
    };

    const profile = sanitizeToRealStatsProfile(baseProfile, savedVocab);

    try {
      localStorage.setItem(LAST_EMAIL_KEY, verified.email);
    } catch {}

    return { profile, resolvedLang };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (mode === 'signup' && name.trim().length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = mode === 'signup' ? '/api/auth/register' : '/api/auth/login';
      const browserTimezone =
        typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
      const normalizedNative = normalizeNativeLanguage(nativeLanguage.trim() || 'English');
      const payload =
        mode === 'signup'
          ? {
              name: name.trim(),
              email: cleanEmail,
              password,
              nativeLanguage: normalizedNative,
              country: country.trim() || 'Global',
              timezone: browserTimezone,
              targetLanguageCode: selectedLangCode,
              level: selectedLevel,
              targetLanguages: [
                {
                  language: selectedTargetLanguage.name,
                  level: selectedLevel,
                  goal: 'Conversational Fluency & Verified Exchange'
                }
              ]
            }
          : {
              email: cleanEmail,
              password,
              overridePreferences: false
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.ok || !data.verifiedAccount) {
        setErrorMessage(data.error || 'Authentication failed. Please check your credentials.');
        setIsLoading(false);
        return;
      }

      const verified = data.verifiedAccount;
      const { profile, resolvedLang } = buildProfileFromVerified(verified);

      onLoginSuccess(profile, resolvedLang, verified.sessionToken, verified.learningStats);
    } catch {
      setErrorMessage('Network error while authenticating. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrengthLabel =
    password.length === 0
      ? null
      : password.length < 6
        ? { text: 'Min. 6 chars', color: 'text-rose-400' }
        : password.length < 10
          ? { text: 'OK', color: 'text-emerald-400' }
          : { text: 'Strong', color: 'text-emerald-400' };

  return (
    <div className="min-h-screen lw-dynamic-canvas text-slate-900 dark:text-[#F0F2F5] flex items-center justify-center p-4 sm:p-6 lg:p-10 w-full">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Visual Editorial Showcase */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="hidden lg:flex lg:col-span-6 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-[#293342] bg-[#161D27] flex-col justify-between min-h-[640px] shadow-xl dark:shadow-[0_16px_44px_-16px_rgba(0,0,0,0.75)]"
        >
          {!heroImageError ? (
            <img
              src={LOGIN_SHOWCASE_IMAGE}
              alt="Learner conversing on a live language exchange video session"
              referrerPolicy="no-referrer"
              onError={() => setHeroImageError(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[#161D27]" />
          )}

          {/* Measured Deep Navy Contrast Scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-[#0D1117]/80 to-[#0D1117]/35" />

          {/* Top Brand Header */}
          <div className="relative z-10 p-8 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#161D27]/95 border border-[#293342] flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-[#6485F5]" />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#F0F2F5]">LernWelt</span>
            </div>
            <span className="text-xs font-medium text-[#F0F2F5] border border-[#293342] bg-[#161D27]/90 px-2.5 py-1 rounded-md">
              {t('auth.signIn', uiLang)}
            </span>
          </div>

          {/* Bottom Editorial Content */}
          <div className="relative z-10 p-8 space-y-6">
            <div className="space-y-3 max-w-lg">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9278D8]">
                {t('auth.welcomeTitle', uiLang)}
              </p>
              <h1
                className="text-3xl xl:text-4xl font-bold text-[#F0F2F5] tracking-tight leading-tight"
                style={{ textWrap: 'balance' }}
              >
                {t('rooms.heroTitle', uiLang)}
              </h1>
              <p className="text-sm text-[#F0F2F5] leading-relaxed">
                {t('rooms.heroSub', uiLang)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-5 border-t border-[#293342]">
              <div className="flex items-start gap-2.5">
                <Video className="w-4 h-4 text-[#6485F5] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-[#F0F2F5]">{t('rooms.randomConnect', uiLang)}</div>
                  <div className="text-[11px] text-[#9BA6B2]">{t('rooms.randomConnectSub', uiLang)}</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Bot className="w-4 h-4 text-[#9278D8] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-[#F0F2F5]">{t('rooms.aiCoach', uiLang)}</div>
                  <div className="text-[11px] text-[#9BA6B2]">{t('rooms.aiCoachSub', uiLang)}</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MonitorUp className="w-4 h-4 text-[#6485F5] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-[#F0F2F5]">{t('nav.teachers', uiLang)}</div>
                  <div className="text-[11px] text-[#9BA6B2]">{t('nav.grammarLab', uiLang)}</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#9278D8] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-[#F0F2F5]">{t('common.verified', uiLang)}</div>
                  <div className="text-[11px] text-[#9BA6B2]">{t('auth.signUpSub', uiLang)}</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Direct Authentication Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.04 }}
          className="lg:col-span-6 bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-2xl p-6 sm:p-8 lg:p-10 flex flex-col justify-between shadow-lg dark:shadow-[0_16px_44px_-16px_rgba(0,0,0,0.75)]"
        >
          <div>
            {/* Mobile Brand Header */}
            <div className="flex lg:hidden items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-[#293342]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#1B2430] border border-slate-200 dark:border-[#293342] flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-[#6485F5]" />
                </div>
                <span className="font-bold text-lg text-slate-900 dark:text-[#F0F2F5]">LernWelt</span>
              </div>
              <span className="text-xs text-slate-600 dark:text-[#9BA6B2] font-medium">{t('auth.signIn', uiLang)}</span>
            </div>

            {invitedRoomId && (
              <div className="mb-5 rounded-lg bg-indigo-50 dark:bg-[#10151D] border border-indigo-200 dark:border-[#6485F5]/40 px-4 py-3 text-xs text-slate-600 dark:text-[#9BA6B2]">
                Room: <span className="font-mono font-semibold text-slate-900 dark:text-[#F0F2F5]">{invitedRoomId}</span>
              </div>
            )}

            <div className="mb-5">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
                {mode === 'signin' ? t('auth.welcomeBack', uiLang) : t('auth.createProfileTitle', uiLang)}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9BA6B2] mt-1">
                {mode === 'signin' ? t('auth.signInSub', uiLang) : t('auth.signUpSub', uiLang)}
              </p>
            </div>

            {/* Mode Switcher: Sign In vs Create Profile */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-[#10151D] rounded-lg border border-slate-200 dark:border-[#293342] mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMessage(null);
                }}
                className={`py-2 px-4 rounded-md text-xs font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  mode === 'signin'
                    ? 'bg-white dark:bg-[#1B2430] text-slate-900 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] shadow-xs dark:shadow-none'
                    : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-transparent'
                }`}
              >
                {t('auth.signIn', uiLang)}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMessage(null);
                }}
                className={`py-2 px-4 rounded-md text-xs font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  mode === 'signup'
                    ? 'bg-white dark:bg-[#1B2430] text-slate-900 dark:text-[#F0F2F5] border border-slate-300 dark:border-[#293342] shadow-xs dark:shadow-none'
                    : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-transparent'
                }`}
              >
                {t('auth.createProfile', uiLang)}
              </button>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mb-4 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-3 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {mode === 'signup' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="login-fullname" className="block text-xs font-medium text-slate-700 dark:text-[#F0F2F5] mb-1.5">
                      {t('auth.fullName', uiLang)}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 dark:text-[#9BA6B2] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="login-fullname"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('auth.fullName', uiLang)}
                        autoComplete="name"
                        className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors duration-150"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="login-native-lang" className="block text-xs font-medium text-slate-700 dark:text-[#F0F2F5] mb-1.5">
                      {t('auth.nativeLanguage', uiLang)}
                    </label>
                    <div className="relative">
                      <Globe2 className="w-4 h-4 text-slate-400 dark:text-[#9BA6B2] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="login-native-lang"
                        type="text"
                        list="native-languages-list"
                        value={nativeLanguage}
                        onChange={(e) => handleNativeLanguageInputChange(e.target.value)}
                        placeholder="English, German, Spanish..."
                        className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors duration-150"
                      />
                      <datalist id="native-languages-list">
                        {COMMON_NATIVE_LANGUAGES.map((lang) => (
                          <option key={lang} value={lang}>
                            {localizeLanguageName(lang, uiLang)}
                          </option>
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="login-country" className="block text-xs font-medium text-slate-700 dark:text-[#F0F2F5] mb-1.5">
                      {t('auth.countryOptional', uiLang)}
                    </label>
                    <input
                      id="login-country"
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Germany, India, United States..."
                      autoComplete="country-name"
                      className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2 text-sm text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors duration-150"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="mb-1.5">
                  <label htmlFor="login-email" className="block text-xs font-medium text-slate-700 dark:text-[#F0F2F5]">
                    {t('auth.emailAddress', uiLang)}
                  </label>
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 dark:text-[#9BA6B2] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors duration-150"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-xs font-medium text-slate-700 dark:text-[#F0F2F5]">
                    {t('auth.password', uiLang)}
                  </label>
                  {passwordStrengthLabel && (
                    <span className={`text-[11px] font-medium ${passwordStrengthLabel.color}`}>
                      {passwordStrengthLabel.text}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-[#9BA6B2] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    required
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg pl-10 pr-11 py-2.5 text-sm text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? t('vocab.hideBtn', uiLang) : t('vocab.revealMeaningBtn', uiLang)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] p-1 cursor-pointer transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label htmlFor="login-target-lang" className="block text-xs font-medium text-slate-700 dark:text-[#F0F2F5] mb-1.5">
                      {t('auth.learningLanguage', uiLang)}
                    </label>
                    <select
                      id="login-target-lang"
                      value={selectedLangCode}
                      onChange={(e) => setSelectedLangCode(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] cursor-pointer"
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">
                          {lang.flag} {localizeLanguageName(lang.name, uiLang)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="login-cefr" className="block text-xs font-medium text-slate-700 dark:text-[#F0F2F5] mb-1.5">
                      {t('auth.currentLevel', uiLang)}
                    </label>
                    <select
                      id="login-cefr"
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value as CEFRLevel)}
                      className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] cursor-pointer"
                    >
                      <option value="A1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">A1</option>
                      <option value="A2" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">A2</option>
                      <option value="B1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">B1</option>
                      <option value="B2" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">B2</option>
                      <option value="C1" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">C1</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer whitespace-nowrap border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] active:scale-[0.99]"
              >
                <span>
                  {isLoading
                    ? t('auth.authenticating', uiLang)
                    : mode === 'signup'
                      ? t('auth.submitSignUp', uiLang)
                      : t('auth.submitSignIn', uiLang)}
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
