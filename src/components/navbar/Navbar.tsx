import React from 'react';
import { ActiveTab, LanguageInfo, UserProfile } from '../../types';
import { createInitialsAvatarDataUri } from '../../data/teacherData';
import { localizeLanguageName, normalizeNativeLanguage, t } from '../../services/uiLocalization';
import { initializeRealUserStreak, MINIMUM_DAILY_GOAL_MINUTES } from '../../services/streakService';
import { StreakProgressIcon } from '../streak/StreakProgressIcon';
import { BRAND_IMAGES } from '../../utils/brandAssets';
import {
  Video,
  Zap,
  Sparkles,
  BookMarked,
  CalendarDays,
  UserCheck,
  ShieldCheck,
  Bell,
  Shuffle,
  Bot,
  LogOut,
  Search
} from 'lucide-react';

export interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedLanguage: LanguageInfo;
  setSelectedLanguage: (lang: LanguageInfo) => void;
  supportedLanguages: LanguageInfo[];
  userProfile: UserProfile;
  unreadNotificationCount?: number;
  onOpenNotifications?: () => void;
  onQuickCall?: () => void;
  onOpenOnboarding?: () => void;
  onGoHome?: () => void;
  onOpenStreak?: () => void;
  onLogout?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
}

interface NavItemConfig {
  id: ActiveTab;
  label: string;
  compactLabel: string;
  isActive: boolean;
  icon: React.ReactNode;
}

function buildNavItems(activeTab: ActiveTab, uiLang: ReturnType<typeof normalizeNativeLanguage>) {
  const isEventsGamesActive = activeTab === 'events-games' || activeTab === 'events-calendar';

  const primaryItems: NavItemConfig[] = [
    {
      id: 'chat-room',
      label: t('nav.rooms', uiLang),
      compactLabel: t('nav.roomsCompact', uiLang),
      isActive: activeTab === 'chat-room',
      icon: <Video className="w-4 h-4 shrink-0" />
    },
    {
      id: 'teachers',
      label: t('nav.teachers', uiLang),
      compactLabel: t('nav.teachersCompact', uiLang),
      isActive: activeTab === 'teachers',
      icon: <UserCheck className="w-4 h-4 shrink-0" />
    },
    {
      id: 'ai-drills',
      label: t('nav.aiDrills', uiLang),
      compactLabel: t('nav.aiDrillsCompact', uiLang),
      isActive: activeTab === 'ai-drills',
      icon: <Zap className="w-4 h-4 shrink-0" />
    },
    {
      id: 'grammar-lab',
      label: t('nav.grammarLab', uiLang),
      compactLabel: t('nav.grammarLabCompact', uiLang),
      isActive: activeTab === 'grammar-lab' || activeTab === 'language-lab',
      icon: <Sparkles className="w-4 h-4 shrink-0" />
    },
    {
      id: 'vocab-deck',
      label: t('nav.vocabBank', uiLang),
      compactLabel: t('nav.vocabBankCompact', uiLang),
      isActive: activeTab === 'vocab-deck',
      icon: <BookMarked className="w-4 h-4 shrink-0" />
    },
    {
      id: 'events-calendar',
      label: t('nav.events', uiLang),
      compactLabel: t('nav.eventsCompact', uiLang),
      isActive: isEventsGamesActive,
      icon: <CalendarDays className="w-4 h-4 shrink-0" />
    }
  ];

  const practiceConnectItems: NavItemConfig[] = [
    {
      id: 'random-connect',
      label: t('rooms.randomConnect', uiLang),
      compactLabel: t('rooms.randomConnect', uiLang),
      isActive: activeTab === 'random-connect',
      icon: <Shuffle className="w-4 h-4 shrink-0" />
    },
    {
      id: 'ai-coach',
      label: t('rooms.aiCoach', uiLang),
      compactLabel: t('rooms.aiCoach', uiLang),
      isActive: activeTab === 'ai-coach',
      icon: <Bot className="w-4 h-4 shrink-0" />
    }
  ];

  return { primaryItems, practiceConnectItems };
}

function resolveSectionTitle(activeTab: ActiveTab, uiLang: ReturnType<typeof normalizeNativeLanguage>): string {
  switch (activeTab) {
    case 'chat-room':
      return t('nav.rooms', uiLang);
    case 'teachers':
      return t('nav.teachers', uiLang);
    case 'ai-drills':
      return t('nav.aiDrills', uiLang);
    case 'grammar-lab':
    case 'language-lab':
      return t('nav.grammarLab', uiLang);
    case 'vocab-deck':
      return t('nav.vocabBank', uiLang);
    case 'events-calendar':
    case 'events-games':
      return t('nav.events', uiLang);
    case 'random-connect':
      return t('rooms.randomConnect', uiLang);
    case 'ai-coach':
      return t('rooms.aiCoach', uiLang);
    case 'profile':
      return userTitleFallback(uiLang);
    case 'gmail':
      return 'Gmail Workspace';
    case 'tasks':
      return 'Study Tasks';
    case 'classroom':
      return t('nav.classroom', uiLang);
    default:
      return t('nav.rooms', uiLang);
  }
}

function userTitleFallback(uiLang: ReturnType<typeof normalizeNativeLanguage>): string {
  return uiLang === 'German'
    ? 'Lernprofil & Einstellungen'
    : uiLang === 'Spanish'
      ? 'Perfil y Preferencias'
      : uiLang === 'French'
        ? 'Profil & Préférences'
        : 'Profile & Settings';
}

export const DesktopSidebar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  selectedLanguage,
  userProfile,
  onGoHome,
  onOpenStreak,
  onLogout
}) => {
  const uiLang = normalizeNativeLanguage(userProfile.nativeLanguage);
  const { primaryItems, practiceConnectItems } = buildNavItems(activeTab, uiLang);
  const fallbackAvatar = createInitialsAvatarDataUri(userProfile.name || 'Learner', '#6485F5');
  const [avatarSrc, setAvatarSrc] = React.useState<string>(userProfile.avatarUrl || fallbackAvatar);

  React.useEffect(() => {
    setAvatarSrc(userProfile.avatarUrl || createInitialsAvatarDataUri(userProfile.name || 'Learner', '#6485F5'));
  }, [userProfile.avatarUrl, userProfile.name]);

  const streak = initializeRealUserStreak(
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
  const dailyPercent = Math.min(100, Math.round((streak.todayMinutes / Math.max(MINIMUM_DAILY_GOAL_MINUTES, streak.dailyGoalMinutes)) * 100));

  const handleNavClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'chat-room') {
      onGoHome?.();
    }
  };

  return (
    <aside
      aria-label={t('nav.primaryNav', uiLang)}
      className="hidden lg:flex lg:flex-col w-[268px] shrink-0 h-screen sticky top-0 bg-white dark:bg-[#10151D] border-r border-slate-200 dark:border-[#293342] text-slate-900 dark:text-[#F0F2F5] z-30"
    >
      {/* Brand Lockup */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-[#293342] shrink-0">
        <button
          type="button"
          onClick={() => handleNavClick('chat-room')}
          className="flex items-center gap-2.5 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6485F5] rounded-lg py-1 cursor-pointer whitespace-nowrap"
          aria-label={t('nav.goHome', uiLang)}
        >
          <div className="w-8 h-8 rounded-lg bg-[#161D27] border border-[#293342] flex items-center justify-center shrink-0 overflow-hidden transition-transform group-hover:scale-[1.03]">
            <img
              src={BRAND_IMAGES.logo}
              alt="LernWelt logo"
              className="w-full h-full object-cover scale-[1.52]"
            />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-[#F0F2F5] block leading-none">
              LernWelt
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-[#9BA6B2] block mt-1 truncate">
              {selectedLanguage.flag} {localizeLanguageName(selectedLanguage.name, uiLang)}
            </span>
          </div>
        </button>
      </div>

      {/* Scrollable Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        <nav aria-label={t('nav.primaryNav', uiLang)} className="space-y-1">
          <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 dark:text-[#9BA6B2]">
            Workspace
          </div>
          {primaryItems.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              title={item.label}
              onClick={() => handleNavClick(item.id)}
              className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                item.isActive
                  ? 'bg-gradient-to-r from-[#6485F5]/18 to-[#9278D8]/16 text-indigo-700 dark:text-[#F0F2F5] font-semibold border-[#6485F5]/40 dark:border-[#6485F5]/45'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-100 dark:hover:bg-[#1B2430] border-transparent'
              }`}
            >
              <span className={item.isActive ? 'text-indigo-600 dark:text-[#6485F5]' : 'text-slate-500 dark:text-[#9BA6B2] group-hover:text-slate-800 dark:group-hover:text-[#F0F2F5]'}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        <nav aria-label="Practice & Connect" className="space-y-1 pt-2 border-t border-slate-200 dark:border-[#293342]">
          <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 dark:text-[#9BA6B2]">
            Connect &amp; AI
          </div>
          {practiceConnectItems.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              title={item.label}
              onClick={() => handleNavClick(item.id)}
              className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                item.isActive
                  ? 'bg-gradient-to-r from-[#6485F5]/16 to-[#9278D8]/20 text-indigo-700 dark:text-[#F0F2F5] font-semibold border-[#9278D8]/45'
                  : 'text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-100 dark:hover:bg-[#1B2430] border-transparent'
              }`}
            >
              <span className={item.isActive ? 'text-violet-600 dark:text-[#9278D8]' : 'text-slate-500 dark:text-[#9BA6B2] group-hover:text-slate-800 dark:group-hover:text-[#F0F2F5]'}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Bottom Learning Activity + User Profile Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-[#293342] space-y-2 shrink-0 bg-slate-50/70 dark:bg-[#10151D]">
        <button
          type="button"
          onClick={onOpenStreak}
          className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-[#161D27] hover:bg-slate-50 dark:hover:bg-[#1B2430] border border-slate-200 dark:border-[#293342] transition-colors cursor-pointer space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <StreakProgressIcon
                todayMinutes={streak.todayMinutes}
                dailyGoalMinutes={streak.dailyGoalMinutes}
                size={24}
                strokeWidth={2.75}
                streakDays={streak.streakDays}
                nativeLanguage={uiLang}
              />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-[#F0F2F5] truncate tabular-nums">
                  {streak.streakDays} {t('common.days', uiLang)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-[#9BA6B2] tabular-nums">
                  {streak.todayMinutes}/{streak.dailyGoalMinutes} {t('common.min', uiLang)}
                </div>
              </div>
            </div>
            <span className="text-[11px] font-mono font-semibold text-indigo-600 dark:text-[#6485F5] tabular-nums shrink-0">
              {dailyPercent}%
            </span>
          </div>

          <div className="w-full h-1.5 bg-slate-200 dark:bg-[#1B2430] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                streak.todayCompleted ? 'bg-[#36B98A]' : 'bg-[#6485F5]'
              }`}
              style={{ width: `${dailyPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-[#9BA6B2] tabular-nums">
            <span>{userProfile.wordsLearned} {t('nav.vocabBankCompact', uiLang)}</span>
            <span>{userProfile.correctionsReceived} {t('profile.statCorrections', uiLang)}</span>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNavClick('profile')}
            className={`flex-1 flex items-center gap-2.5 p-2 rounded-lg border transition-colors cursor-pointer min-w-0 text-left ${
              activeTab === 'profile'
                ? 'bg-[#1B2430] border-[#6485F5]/50 text-slate-900 dark:text-[#F0F2F5]'
                : 'bg-white dark:bg-[#161D27] hover:bg-slate-100 dark:hover:bg-[#1B2430] border-slate-200 dark:border-[#293342] text-slate-900 dark:text-[#F0F2F5]'
            }`}
            title={userProfile.name}
          >
            <img
              src={avatarSrc}
              alt={userProfile.name}
              referrerPolicy="no-referrer"
              onError={() => {
                if (avatarSrc !== fallbackAvatar) setAvatarSrc(fallbackAvatar);
              }}
              className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200 dark:border-[#293342]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold truncate">{userProfile.name}</span>
                {userProfile.isVerified && (
                  <ShieldCheck className="w-3.5 h-3.5 text-[#36B98A] shrink-0" />
                )}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-[#9BA6B2] block truncate">
                {userProfile.nativeLanguage}
              </span>
            </div>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              aria-label={t('profile.signOut', uiLang)}
              title={t('profile.signOut', uiLang)}
              className="p-2.5 rounded-lg bg-white dark:bg-[#161D27] hover:bg-rose-500/10 text-slate-600 dark:text-[#9BA6B2] hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-[#293342] hover:border-rose-500/30 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  selectedLanguage,
  setSelectedLanguage,
  userProfile,
  supportedLanguages,
  unreadNotificationCount = 0,
  onOpenNotifications,
  onGoHome,
  searchQuery = '',
  onSearchChange,
  onSearchSubmit
}) => {
  const uiLang = normalizeNativeLanguage(userProfile.nativeLanguage);
  const fallbackAvatar = createInitialsAvatarDataUri(userProfile.name || 'Learner', '#6485F5');
  const [avatarSrc, setAvatarSrc] = React.useState<string>(userProfile.avatarUrl || fallbackAvatar);

  React.useEffect(() => {
    setAvatarSrc(userProfile.avatarUrl || createInitialsAvatarDataUri(userProfile.name || 'Learner', '#6485F5'));
  }, [userProfile.avatarUrl, userProfile.name]);

  const { primaryItems } = buildNavItems(activeTab, uiLang);
  const sectionTitle = resolveSectionTitle(activeTab, uiLang);

  const handleNavClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'chat-room') {
      onGoHome?.();
    }
  };

  return (
    <header className="sticky top-0 z-40 shrink-0 bg-white/95 dark:bg-[#10151D]/95 backdrop-blur-xl border-b border-slate-200 dark:border-[#293342] text-slate-900 dark:text-[#F0F2F5] w-full max-w-full">
      <div className="px-3 sm:px-6 w-full max-w-full">
        <div className="flex items-center justify-between h-14 lg:h-16 gap-3 w-full min-w-0">
          {/* Mobile Brand Wordmark (< lg) + Desktop Contextual Breadcrumb (lg+) */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => handleNavClick('chat-room')}
              className="flex lg:hidden items-center gap-2 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6485F5] rounded-lg py-1 cursor-pointer shrink-0 whitespace-nowrap"
              aria-label={t('nav.goHome', uiLang)}
            >
              <div className="w-8 h-8 rounded-lg bg-[#161D27] border border-[#293342] flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={BRAND_IMAGES.logo}
                  alt="LernWelt logo"
                  className="w-full h-full object-cover scale-[1.52]"
                />
              </div>
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-[#F0F2F5] whitespace-nowrap">
                LernWelt
              </span>
            </button>

            <div className="hidden lg:flex items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-slate-500 dark:text-[#9BA6B2]">LernWelt</span>
              <span className="text-slate-300 dark:text-[#293342]" aria-hidden="true">/</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-[#F0F2F5] truncate">
                {sectionTitle}
              </span>
            </div>
          </div>

          {/* Horizontal Search Bar (Desktop / Tablet) */}
          {onSearchChange && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearchSubmit?.(searchQuery);
              }}
              className="hidden md:flex items-center flex-1 max-w-md relative mx-2"
            >
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#9BA6B2] absolute left-3 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t('rooms.searchPlaceholder', uiLang)}
                aria-label="Global workspace room search"
                className="w-full bg-slate-100 dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] focus:border-[#6485F5] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none transition-colors"
              />
            </form>
          )}

          {/* Right Utility Controls: Target Language, Notifications & Profile */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="flex items-center bg-slate-100 dark:bg-[#161D27] hover:bg-slate-200/70 dark:hover:bg-[#1B2430] px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#293342] text-xs font-medium shrink-0 transition-colors">
              <select
                aria-label={t('nav.selectTargetLang', uiLang)}
                value={selectedLanguage.code}
                onChange={(e) => {
                  const found = supportedLanguages.find((l) => l.code === e.target.value);
                  if (found) setSelectedLanguage(found);
                }}
                className="bg-transparent text-slate-800 dark:text-[#F0F2F5] text-xs font-medium focus:outline-none cursor-pointer"
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">
                    {lang.flag} {localizeLanguageName(lang.name, uiLang)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onOpenNotifications}
              data-testid="notifications-bell-btn"
              aria-label={
                unreadNotificationCount > 0
                  ? t('nav.notificationsUnread', uiLang, { count: unreadNotificationCount })
                  : t('nav.openNotifications', uiLang)
              }
              title={
                unreadNotificationCount > 0
                  ? t('nav.unreadNotificationsTitle', uiLang, { count: unreadNotificationCount })
                  : t('nav.notifications', uiLang)
              }
              className="relative p-2 rounded-lg bg-slate-100 dark:bg-[#161D27] hover:bg-slate-200/70 dark:hover:bg-[#1B2430] border border-slate-200 dark:border-[#293342] text-slate-700 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] transition-colors cursor-pointer shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#6485F5]/40"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#6485F5] text-white text-[10px] font-bold flex items-center justify-center border border-white dark:border-[#10151D] tabular-nums">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 p-1 xl:pl-1.5 xl:pr-3 rounded-full bg-slate-100 dark:bg-[#161D27] hover:bg-slate-200/70 dark:hover:bg-[#1B2430] border transition-colors shrink-0 cursor-pointer whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'border-[#6485F5] ring-2 ring-[#6485F5]/20 text-slate-900 dark:text-[#F0F2F5]'
                  : 'border-slate-200 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5]'
              }`}
              aria-label={t('nav.learnerProfile', uiLang, { name: userProfile.name })}
              title={
                userProfile.isVerified
                  ? t('nav.verifiedTitle', uiLang, {
                      name: userProfile.name,
                      id: userProfile.verifiedId || ''
                    })
                  : t('nav.openProfileTitle', uiLang, { name: userProfile.name })
              }
            >
              <img
                src={avatarSrc}
                alt={userProfile.name}
                referrerPolicy="no-referrer"
                onError={() => {
                  if (avatarSrc !== fallbackAvatar) setAvatarSrc(fallbackAvatar);
                }}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover shrink-0 ring-1 ring-slate-300 dark:ring-[#293342]"
              />
              <span className="text-xs font-medium hidden xl:inline max-w-[92px] truncate text-slate-800 dark:text-[#F0F2F5]">
                {userProfile.name.split(' ')[0]}
              </span>
              {userProfile.isVerified && (
                <ShieldCheck className="w-3.5 h-3.5 text-[#36B98A] shrink-0 hidden xl:inline" />
              )}
            </button>
          </div>
        </div>

        {/* Compact Mobile / Tablet Navigation Strip (< lg) */}
        <nav
          aria-label={t('nav.mobileNav', uiLang)}
          className="flex lg:hidden items-center justify-between gap-1 pb-2 overflow-x-auto scrollbar-none"
        >
          {primaryItems.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              onClick={() => handleNavClick(item.id)}
              className={`group flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                item.isActive
                  ? 'bg-[#6485F5] text-white font-semibold border border-[#9278D8]/40'
                  : 'bg-slate-100 dark:bg-[#161D27] text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] border border-slate-200 dark:border-[#293342]'
              }`}
            >
              {item.icon}
              <span>{item.compactLabel}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
