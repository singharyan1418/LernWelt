import { StreakDayRecord, UserStreak } from '../types';
import { initializeRealUserStreak, MINIMUM_DAILY_GOAL_MINUTES } from './streakService';
import { getHtmlLangCode, localizeDayName } from './uiLocalization';

export interface WeeklyPracticeChartPoint {
  date: string;
  dayName: string;
  localizedDay: string;
  minutes: number;
  seconds: number;
  goalMinutes: number;
  goalMet: boolean;
  isToday: boolean;
  xpEarned: number;
}

export interface WeeklyPracticeSummary {
  totalMinutes: number;
  totalSeconds: number;
  averageMinutes: number;
  peakDayLabel: string;
  peakMinutes: number;
  goalDaysMet: number;
  totalDays: number;
  hasAnyPractice: boolean;
}

export interface WeeklyPracticeChartDataset {
  points: WeeklyPracticeChartPoint[];
  summary: WeeklyPracticeSummary;
}

const roundToTenths = (value: number): number => Math.round(value * 10) / 10;

export const formatPracticeTooltipDuration = (
  minutes: number,
  seconds: number,
  nativeLanguage?: string | null
): string => {
  const isGerman = getHtmlLangCode(nativeLanguage) === 'de';
  const safeSeconds = Math.max(0, Math.round(seconds));

  if (safeSeconds === 0 && minutes <= 0) {
    return isGerman ? '0 Min.' : '0m';
  }

  if (safeSeconds > 0 && safeSeconds < 60) {
    return isGerman ? `${safeSeconds} Sek.` : `${safeSeconds}s`;
  }

  const mins = Math.floor(safeSeconds / 60);
  const remSecs = safeSeconds % 60;
  if (remSecs > 0 && mins < 10) {
    return isGerman ? `${mins} Min. ${remSecs} Sek.` : `${mins}m ${remSecs}s`;
  }

  const displayMins = mins > 0 ? mins : roundToTenths(minutes);
  return isGerman ? `${displayMins} Min.` : `${displayMins}m`;
};

export const buildWeeklyPracticeChartData = (
  streak?: UserStreak | null,
  nativeLanguage?: string | null
): WeeklyPracticeChartDataset => {
  const fallbackStreak = initializeRealUserStreak();
  const effectiveStreak = streak ?? fallbackStreak;
  const rawHistory: StreakDayRecord[] =
    Array.isArray(effectiveStreak.weeklyHistory) && effectiveStreak.weeklyHistory.length > 0
      ? effectiveStreak.weeklyHistory.slice(-7)
      : fallbackStreak.weeklyHistory;

  const goalMinutes = Math.max(
    MINIMUM_DAILY_GOAL_MINUTES,
    Math.round(effectiveStreak.dailyGoalMinutes || MINIMUM_DAILY_GOAL_MINUTES)
  );

  const points: WeeklyPracticeChartPoint[] = rawHistory.map((record, index) => {
    const isToday = index === rawHistory.length - 1;
    let seconds = Math.max(0, Math.round((record.minutesPracticed || 0) * 60));
    let minutes = roundToTenths(Math.max(0, record.minutesPracticed || 0));

    if (isToday) {
      if (typeof effectiveStreak.todaySeconds === 'number' && effectiveStreak.todaySeconds > 0) {
        seconds = Math.round(effectiveStreak.todaySeconds);
        minutes = roundToTenths(seconds / 60);
      } else if (typeof effectiveStreak.todayMinutes === 'number' && effectiveStreak.todayMinutes > minutes) {
        minutes = roundToTenths(effectiveStreak.todayMinutes);
        seconds = Math.round(minutes * 60);
      }
    }

    return {
      date: record.date,
      dayName: record.dayName,
      localizedDay: localizeDayName(record.dayName, nativeLanguage),
      minutes,
      seconds,
      goalMinutes,
      goalMet: minutes >= goalMinutes,
      isToday,
      xpEarned: Math.max(0, Math.round(record.xpEarned || 0))
    };
  });

  const totalSeconds = points.reduce((sum, point) => sum + point.seconds, 0);
  const totalMinutes = roundToTenths(totalSeconds / 60);
  const totalDays = points.length || 7;
  const averageMinutes = roundToTenths(totalMinutes / totalDays);
  const goalDaysMet = points.filter((point) => point.goalMet).length;

  let peakPoint: WeeklyPracticeChartPoint | null = null;
  for (const point of points) {
    if (point.seconds > 0 && (!peakPoint || point.seconds >= peakPoint.seconds)) {
      peakPoint = point;
    }
  }

  return {
    points,
    summary: {
      totalMinutes,
      totalSeconds,
      averageMinutes,
      peakDayLabel: peakPoint ? peakPoint.localizedDay : '—',
      peakMinutes: peakPoint ? peakPoint.minutes : 0,
      goalDaysMet,
      totalDays,
      hasAnyPractice: totalSeconds > 0
    }
  };
};
