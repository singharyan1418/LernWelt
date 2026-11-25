import React, { useState } from 'react';
import { 
  Flame, 
  ShieldCheck, 
  Calendar, 
  CheckCircle2, 
  Trophy, 
  Sparkles, 
  X, 
  Zap, 
  Clock, 
  ArrowRight,
  Award,
  AlertCircle
} from 'lucide-react';
import { UserProfile, UserStreak } from '../../types';
import { StreakProgressIcon } from './StreakProgressIcon';
import { initializeRealUserStreak, MINIMUM_DAILY_GOAL_MINUTES } from '../../services/streakService';
import { localizeDayName, localizeMilestone, t } from '../../services/uiLocalization';

interface StreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onCheckInToday: () => void;
  onEnterPracticeRoom?: () => void;
}

export const StreakModal: React.FC<StreakModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onCheckInToday,
  onEnterPracticeRoom
}) => {
  const [justClaimed, setJustClaimed] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const uiLang = userProfile.nativeLanguage;

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

  const handleClaim = () => {
    onCheckInToday();
    setJustClaimed(true);
    setTimeout(() => setJustClaimed(false), 3000);
  };

  const goalPercent = Math.min(100, Math.round((streak.todayMinutes / streak.dailyGoalMinutes) * 100));

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 dark:bg-[#0D1117]/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div 
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 sm:p-8 shadow-2xl dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] text-slate-900 dark:text-[#F0F2F5] space-y-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="streak-modal-title"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-20 p-2 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-100 dark:hover:bg-[#232F3F] transition-colors cursor-pointer"
          aria-label={t('common.close', uiLang)}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Flame & Streak Count with Circular Progress Indicator */}
        <div className="text-center space-y-3 relative z-10 pt-2">
          <div className="relative inline-flex items-center justify-center">
            <div className="p-2 rounded-full bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] relative">
              <StreakProgressIcon
                todayMinutes={streak.todayMinutes}
                dailyGoalMinutes={streak.dailyGoalMinutes}
                size={104}
                strokeWidth={5}
                streakDays={streak.streakDays}
                showCompletionBadge={true}
                nativeLanguage={uiLang}
              />
            </div>
            
            {/* Daily Goal minutes badge */}
            <div className="absolute -bottom-2.5 px-2.5 py-0.5 rounded-md bg-white dark:bg-[#1B2430] border border-amber-300 dark:border-amber-500/35 text-amber-800 dark:text-amber-300 text-xs font-semibold tabular-nums flex items-center gap-1.5 shadow-sm">
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                {t('streakModal.dailyGoalPill', uiLang, {
                  percent: goalPercent,
                  done: streak.todayMinutes,
                  goal: streak.dailyGoalMinutes
                })}
              </span>
            </div>
          </div>

          <div>
            <h2 id="streak-modal-title" className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#F0F2F5] tracking-tight tabular-nums">
              {t('streakModal.dayStreak', uiLang, { days: streak.streakDays })}
            </h2>
            <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-medium mt-1">
              {streak.todayCompleted
                ? t('streakModal.extendedToday', uiLang)
                : t('streakModal.practiceToday', uiLang)}
            </p>
          </div>
        </div>

        {/* Interactive Check-in Button */}
        <div className="relative z-10">
          {streak.todayCompleted ? (
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-center space-y-1">
              <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('streakModal.securedBanner', uiLang)}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-[#9BA6B2]">
                {t('streakModal.comeBackTomorrow', uiLang, { nextDay: streak.streakDays + 1 })}
              </p>
            </div>
          ) : (
            <button
              onClick={handleClaim}
              className="w-full py-3 px-5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold text-sm flex items-center justify-center gap-2 border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors duration-150 active:scale-[0.99] cursor-pointer"
            >
              <Flame className="w-4 h-4 text-amber-300" />
              <span>{t('streakModal.checkInBtn', uiLang)}</span>
              <Sparkles className="w-4 h-4 text-indigo-100" />
            </button>
          )}

          {justClaimed && (
            <div className="mt-2 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
              {t('streakModal.upgradedToast', uiLang, { days: streak.streakDays })}
            </div>
          )}
        </div>

        {/* 7-Day Weekly Streak Grid */}
        <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-lg p-4 sm:p-5 space-y-3 relative z-10">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-[#F0F2F5] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-[#6485F5]" />
              {t('streakModal.weekActivity', uiLang)}
            </span>
            <span className="text-slate-600 dark:text-[#9BA6B2] text-[11px] tabular-nums">
              {t('streakModal.bestStreak', uiLang)}{' '}
              <strong className="text-slate-900 dark:text-[#F0F2F5]">
                {streak.bestStreak} {t('common.days', uiLang)}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {streak.weeklyHistory.map((item, index) => {
              const isToday = index === 6;
              const isCompleted = item.completed || (isToday && streak.todayCompleted);
              return (
                <div 
                  key={index}
                  className={`flex flex-col items-center p-2 rounded-lg border text-center transition-colors ${
                    isCompleted
                      ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
                      : isToday
                      ? 'bg-indigo-50 dark:bg-[#1B2430] border-indigo-400 dark:border-[#6485F5]/60 text-indigo-700 dark:text-[#9278D8]'
                      : 'bg-white dark:bg-[#161D27] border-slate-200 dark:border-[#293342] text-slate-500 dark:text-[#9BA6B2]'
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase">
                    {localizeDayName(item.dayName, uiLang)}
                  </span>
                  <div className="my-1.5 flex items-center justify-center">
                    {isCompleted ? (
                      <Flame className="w-4 h-4 text-amber-500 dark:text-amber-400 fill-amber-400" />
                    ) : isToday ? (
                      <div className="w-4 h-4 rounded-full border border-dashed border-indigo-500 dark:border-[#6485F5] flex items-center justify-center text-[10px] font-semibold">
                        ?
                      </div>
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-[#232F3F]" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono font-semibold tabular-nums">
                    {isCompleted
                      ? `+${item.xpEarned || 0} ${t('common.xpUnit', uiLang)}`
                      : `0 ${t('common.xpUnit', uiLang)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Goal, AI Drills, & Streak Freeze Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
          {/* Daily Goal Progress */}
          <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-[#F0F2F5]">
              <span className="flex items-center gap-2">
                <StreakProgressIcon
                  todayMinutes={streak.todayMinutes}
                  dailyGoalMinutes={streak.dailyGoalMinutes}
                  size={20}
                  strokeWidth={2.75}
                  showCompletionBadge={false}
                  nativeLanguage={uiLang}
                />
                {t('streakModal.practiceGoal', uiLang)}
              </span>
              <span className="text-indigo-700 dark:text-[#9278D8] font-mono tabular-nums">{streak.todayMinutes} / {streak.dailyGoalMinutes}m</span>
            </div>
            
            <div className="w-full h-2 bg-slate-200 dark:bg-[#1B2430] rounded-full overflow-hidden border border-slate-300 dark:border-[#293342]">
              <div 
                className="h-full bg-[#6485F5] rounded-full transition-all duration-300"
                style={{ width: `${goalPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2]">
              {goalPercent >= 100
                ? t('streakModal.targetReached', uiLang)
                : t('streakModal.moreMinutes', uiLang, {
                    mins: Math.max(0, streak.dailyGoalMinutes - streak.todayMinutes)
                  })}
            </p>
          </div>

          {/* Daily AI Drills Goal */}
          <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-[#F0F2F5]">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                {t('streakModal.aiDrillsGoal', uiLang)}
              </span>
              <span className="text-amber-700 dark:text-amber-300 font-mono tabular-nums">
                {streak.todayDrillsCompleted || 0} / {streak.dailyDrillGoal || 5}
              </span>
            </div>
            
            <div className="w-full h-2 bg-slate-200 dark:bg-[#1B2430] rounded-full overflow-hidden border border-slate-300 dark:border-[#293342]">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  (streak.todayDrillsCompleted || 0) >= (streak.dailyDrillGoal || 5)
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
                style={{
                  width: `${Math.min(100, Math.round(((streak.todayDrillsCompleted || 0) / (streak.dailyDrillGoal || 5)) * 100))}%`
                }}
              />
            </div>
            <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2]">
              {(streak.todayDrillsCompleted || 0) >= (streak.dailyDrillGoal || 5)
                ? t('streakModal.badgeUnlocked', uiLang)
                : t('streakModal.moreDrills', uiLang, {
                    count: Math.max(0, (streak.dailyDrillGoal || 5) - (streak.todayDrillsCompleted || 0))
                  })}
            </p>
          </div>

          {/* Streak Freeze Status */}
          <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-[#F0F2F5]">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {t('streakModal.protection', uiLang)}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold tabular-nums ${
                  streak.streakFreezesAvailable > 0
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25'
                    : 'bg-slate-100 dark:bg-[#1B2430] text-slate-600 dark:text-[#9BA6B2] border border-slate-200 dark:border-[#293342]'
                }`}
              >
                {t('streakModal.readyCount', uiLang, { count: streak.streakFreezesAvailable })}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2] leading-snug">
              {streak.streakFreezesAvailable > 0
                ? t('streakModal.shieldActiveDesc', uiLang)
                : t('streakModal.shieldEarnDesc', uiLang)}
            </p>
            <div
              className={`flex items-center gap-1 text-[10px] font-semibold ${
                streak.streakFreezesAvailable > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-[#9BA6B2]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {streak.streakFreezesAvailable > 0
                  ? t('streakModal.shieldActive', uiLang)
                  : t('streakModal.noShield', uiLang)}
              </span>
            </div>
          </div>
        </div>

        {/* Milestones Roadmap */}
        <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-lg p-4 sm:p-5 space-y-3 relative z-10">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              {t('streakModal.milestonesTitle', uiLang)}
            </span>
            <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold font-mono tabular-nums">
              {t('streakModal.totalXp', uiLang, { xp: streak.totalXp })}
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {streak.milestones.map((m) => {
              const isUnlocked = m.unlocked || streak.streakDays >= m.days;
              const localizedM = localizeMilestone(m.days, m.title, m.reward, uiLang);
              return (
                <div 
                  key={m.days}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                    isUnlocked
                      ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/25 text-amber-900 dark:text-amber-200'
                      : 'bg-white dark:bg-[#161D27] border-slate-200 dark:border-[#293342] text-slate-600 dark:text-[#9BA6B2]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{m.icon}</span>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-[#F0F2F5] flex items-center gap-1.5">
                        <span>{localizedM.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1B2430] border border-slate-200 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5] font-mono tabular-nums">
                          {m.days} {t('common.days', uiLang)}
                        </span>
                      </div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-300/80">{localizedM.reward}</div>
                    </div>
                  </div>

                  <div>
                    {isUnlocked ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {t('profile.unlocked', uiLang)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 dark:text-[#9BA6B2] font-mono tabular-nums">
                        {streak.streakDays}/{m.days}d
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Enter Practice Room Action */}
        {onEnterPracticeRoom && (
          <div className="pt-1 relative z-10">
            <button
              onClick={() => {
                onClose();
                onEnterPracticeRoom();
              }}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#293342] text-slate-800 dark:text-[#F0F2F5] hover:text-slate-900 dark:hover:text-[#F0F2F5] font-semibold text-xs flex items-center justify-center gap-2 border border-slate-300 dark:border-[#293342] transition-colors cursor-pointer"
            >
              <span>{t('streakModal.enterRoomBtn', uiLang)}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
