import { StreakDayRecord, StreakMilestone, UserStreak } from '../types';

export const DEFAULT_STREAK_MILESTONES: StreakMilestone[] = [
  { days: 3, title: 'Spark Ignited', reward: '+100 XP', icon: '🔥', unlocked: false },
  { days: 7, title: 'Habit Builder', reward: '+250 XP & Bronze Flame', icon: '🥉', unlocked: false },
  { days: 14, title: 'Dedication Champion', reward: '+500 XP & Silver Flame', icon: '🥈', unlocked: false },
  { days: 30, title: 'Fluency Seeker', reward: '+1,000 XP & Gold Flame', icon: '🥇', unlocked: false },
  { days: 50, title: 'Polyglot Trailblazer', reward: '+2,500 XP & Ruby Shield', icon: '💎', unlocked: false },
  { days: 100, title: 'LernWelt Immortal', reward: '+5,000 XP & Crown', icon: '👑', unlocked: false }
];

export function getTodayDateString(referenceDate?: Date): string {
  const d = referenceDate || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getOffsetDateString(offsetDays: number, referenceDate?: Date): string {
  const d = new Date(referenceDate || new Date());
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDayName(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(`${dateInput}T12:00:00`) : dateInput;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dayNames[d.getDay()] || 'Day';
}

export function generateRealWeeklyHistory(
  existingHistory?: StreakDayRecord[],
  referenceDate?: Date,
  todayCompleted: boolean = false,
  todayMinutes: number = 0,
  todayXp: number = 0
): StreakDayRecord[] {
  const ref = referenceDate || new Date();
  const historyMap = new Map<string, StreakDayRecord>();
  if (Array.isArray(existingHistory)) {
    for (const h of existingHistory) {
      if (h && h.date) {
        historyMap.set(h.date, h);
      }
    }
  }

  const result: StreakDayRecord[] = [];
  for (let offset = -6; offset <= 0; offset++) {
    const dateStr = getOffsetDateString(offset, ref);
    const dayName = getDayName(dateStr);
    const existing = historyMap.get(dateStr);

    if (offset === 0) {
      result.push({
        date: dateStr,
        dayName,
        completed: Boolean(todayCompleted || existing?.completed),
        xpEarned: Math.max(existing?.xpEarned || 0, todayXp),
        minutesPracticed: Math.max(existing?.minutesPracticed || 0, todayMinutes)
      });
    } else if (existing) {
      result.push({
        date: dateStr,
        dayName,
        completed: Boolean(existing.completed),
        xpEarned: existing.xpEarned || 0,
        minutesPracticed: existing.minutesPracticed || 0
      });
    } else {
      result.push({
        date: dateStr,
        dayName,
        completed: false,
        xpEarned: 0,
        minutesPracticed: 0
      });
    }
  }

  return result;
}

export function initializeRealUserStreak(
  existing?: Partial<UserStreak>,
  referenceDate?: Date
): UserStreak {
  const todayStr = getTodayDateString(referenceDate);
  const yesterdayStr = getOffsetDateString(-1, referenceDate);

  const rawStreakDays = typeof existing?.streakDays === 'number' ? Math.max(0, existing.streakDays) : 0;
  const rawBestStreak = typeof existing?.bestStreak === 'number' ? Math.max(rawStreakDays, existing.bestStreak) : rawStreakDays;
  const rawTotalXp = typeof existing?.totalXp === 'number' ? Math.max(0, existing.totalXp) : 0;
  const rawFreezes = typeof existing?.streakFreezesAvailable === 'number' ? Math.max(0, existing.streakFreezesAvailable) : 0;
  const rawFreezesUsed = typeof existing?.streakFreezesUsed === 'number' ? Math.max(0, existing.streakFreezesUsed) : 0;
  const rawDailyGoalMinutes = typeof existing?.dailyGoalMinutes === 'number' ? Math.max(1, existing.dailyGoalMinutes) : 15;
  const rawDailyDrillGoal = typeof existing?.dailyDrillGoal === 'number' ? Math.max(1, existing.dailyDrillGoal) : 5;

  let lastCheckInDate = existing?.lastCheckInDate || '';
  let streakDays = rawStreakDays;
  let freezesAvailable = rawFreezes;
  let freezesUsed = rawFreezesUsed;
  let todayCompleted = Boolean(existing?.todayCompleted);
  let todayMinutes = typeof existing?.todayMinutes === 'number' ? Math.max(0, existing.todayMinutes) : 0;
  let todaySeconds =
    typeof existing?.todaySeconds === 'number'
      ? Math.max(0, existing.todaySeconds)
      : todayMinutes * 60;
  let todayDrillsCompleted = typeof existing?.todayDrillsCompleted === 'number' ? Math.max(0, existing.todayDrillsCompleted) : 0;
  let dailyBadgeUnlocked = Boolean(existing?.dailyBadgeUnlocked);

  const isSameDay = lastCheckInDate === todayStr;
  const lastHistoryDate =
    Array.isArray(existing?.weeklyHistory) && existing.weeklyHistory.length > 0
      ? existing.weeklyHistory[existing.weeklyHistory.length - 1]?.date || ''
      : '';
  const hasRolledToToday = isSameDay || lastHistoryDate === todayStr;

  if (isSameDay) {
    // Same completed day: keep actual completed status without forcing it true unless already completed
    todayCompleted = Boolean(existing?.todayCompleted);
  } else if (lastCheckInDate === yesterdayStr) {
    // Yesterday was completed; on first load of today, reset today's counters once while keeping streakDays intact
    if (!hasRolledToToday) {
      todayCompleted = false;
      todayMinutes = 0;
      todaySeconds = 0;
      todayDrillsCompleted = 0;
      dailyBadgeUnlocked = false;
    } else {
      todayCompleted = Boolean(existing?.todayCompleted);
    }
  } else if (lastCheckInDate && lastCheckInDate < yesterdayStr) {
    const daysDiff = Math.round(
      (new Date(`${todayStr}T12:00:00`).getTime() - new Date(`${lastCheckInDate}T12:00:00`).getTime()) /
      (1000 * 60 * 60 * 24)
    );
    if (daysDiff === 2 && freezesAvailable > 0 && streakDays > 0) {
      // 1 missed day protected by earned streak freeze (advance anchor to yesterday so freeze isn't consumed twice today)
      freezesAvailable = Math.max(0, freezesAvailable - 1);
      freezesUsed = freezesUsed + 1;
      lastCheckInDate = yesterdayStr;
      if (!hasRolledToToday) {
        todayCompleted = false;
        todayMinutes = 0;
        todaySeconds = 0;
        todayDrillsCompleted = 0;
        dailyBadgeUnlocked = false;
      }
    } else if (daysDiff > 1) {
      streakDays = 0;
      lastCheckInDate = '';
      if (!hasRolledToToday) {
        todayCompleted = false;
        todayMinutes = 0;
        todaySeconds = 0;
        todayDrillsCompleted = 0;
        dailyBadgeUnlocked = false;
      }
    }
  } else if (!lastCheckInDate && !hasRolledToToday) {
    // Brand-new learner with zero prior activity starts genuinely at Day 0
    streakDays = 0;
    todayCompleted = false;
  }

  const bestStreak = Math.max(rawBestStreak, streakDays);
  const currentMultiplier = calculateStreakMultiplier(streakDays);
  const milestones = checkMilestoneUnlocks(
    streakDays,
    existing?.milestones && existing.milestones.length > 0
      ? existing.milestones
      : DEFAULT_STREAK_MILESTONES
  );

  const existingTodayRecord = Array.isArray(existing?.weeklyHistory)
    ? existing.weeklyHistory.find((h) => h && h.date === todayStr)
    : undefined;

  const weeklyHistory = generateRealWeeklyHistory(
    existing?.weeklyHistory,
    referenceDate,
    todayCompleted,
    todayMinutes,
    existingTodayRecord?.xpEarned ?? (todayCompleted ? 50 : 0)
  );

  return {
    streakDays,
    bestStreak,
    lastCheckInDate,
    todayCompleted,
    streakFreezesAvailable: freezesAvailable,
    streakFreezesUsed: freezesUsed,
    currentMultiplier,
    totalXp: rawTotalXp,
    todayMinutes,
    todaySeconds,
    dailyGoalMinutes: rawDailyGoalMinutes,
    todayDrillsCompleted,
    dailyDrillGoal: rawDailyDrillGoal,
    dailyBadgeUnlocked: dailyBadgeUnlocked || todayDrillsCompleted >= rawDailyDrillGoal,
    weeklyHistory,
    milestones
  };
}

export interface DrillCompletionResult {
  streak: UserStreak;
  justUnlockedBadge: boolean;
  newlyCompletedToday: boolean;
  drillsCompletedToday: number;
  drillsGoal: number;
  xpAwarded: number;
}

export function recordDrillCompletion(
  current: UserStreak,
  xpEarned: number,
  drillMinutes: number = 0,
  referenceDate?: Date
): DrillCompletionResult {
  const todayStr = getTodayDateString(referenceDate);
  const dailyDrillGoal = current.dailyDrillGoal || 5;
  const prevDrills = current.todayDrillsCompleted || 0;
  const nextDrills = prevDrills + 1;

  const previouslyMetGoal = prevDrills >= dailyDrillGoal;
  const justUnlockedBadge = !previouslyMetGoal && nextDrills >= dailyDrillGoal;
  const newlyCompletedToday = !current.todayCompleted && nextDrills >= dailyDrillGoal;

  const addedMinutes = drillMinutes > 0 ? Math.round(drillMinutes) : 0;
  const nextTodayMinutes = (current.todayMinutes || 0) + addedMinutes;

  let nextStreakDays = current.streakDays;
  let nextBestStreak = current.bestStreak;
  let bonusXp = 0;

  if (newlyCompletedToday) {
    nextStreakDays = current.streakDays + (current.todayCompleted ? 0 : 1);
    nextBestStreak = Math.max(current.bestStreak, nextStreakDays);
    bonusXp = 100; // Bonus +100 XP for hitting daily drill completion badge!
  }

  const totalAddedXp = xpEarned + bonusXp;
  const nextTotalXp = (current.totalXp || 0) + totalAddedXp;
  const nextMultiplier = calculateStreakMultiplier(nextStreakDays);
  const nextMilestones = checkMilestoneUnlocks(nextStreakDays, current.milestones);

  // Update weekly history ending with today's real date
  const updatedWeekly = current.weeklyHistory.map((item, idx) => {
    if (idx === current.weeklyHistory.length - 1) {
      return {
        ...item,
        date: todayStr,
        completed: current.todayCompleted || newlyCompletedToday || item.completed,
        xpEarned: (item.xpEarned || 0) + totalAddedXp,
        minutesPracticed: (item.minutesPracticed || 0) + addedMinutes
      };
    }
    return item;
  });

  const updatedStreak: UserStreak = {
    ...current,
    streakDays: nextStreakDays,
    bestStreak: nextBestStreak,
    lastCheckInDate: current.todayCompleted || newlyCompletedToday ? todayStr : current.lastCheckInDate,
    todayCompleted: current.todayCompleted || newlyCompletedToday,
    currentMultiplier: nextMultiplier,
    totalXp: nextTotalXp,
    todayMinutes: nextTodayMinutes,
    todayDrillsCompleted: nextDrills,
    dailyDrillGoal,
    dailyBadgeUnlocked: current.dailyBadgeUnlocked || nextDrills >= dailyDrillGoal,
    weeklyHistory: updatedWeekly,
    milestones: nextMilestones
  };

  return {
    streak: updatedStreak,
    justUnlockedBadge,
    newlyCompletedToday,
    drillsCompletedToday: nextDrills,
    drillsGoal: dailyDrillGoal,
    xpAwarded: totalAddedXp
  };
}

export function calculateDailyDrillGoalProgress(
  completedDrills: number = 0,
  dailyDrillGoal: number = 5
) {
  const safeGoal = Math.max(1, Number.isFinite(dailyDrillGoal) ? dailyDrillGoal : 5);
  const safeCompleted = Math.max(0, Number.isFinite(completedDrills) ? completedDrills : 0);
  const percent = Math.min(100, Math.round((safeCompleted / safeGoal) * 100));
  const isGoalMet = safeCompleted >= safeGoal;
  const remainingCount = Math.max(0, safeGoal - safeCompleted);

  return {
    completedDrills: safeCompleted,
    dailyDrillGoal: safeGoal,
    percent,
    isGoalMet,
    remainingCount
  };
}

export function calculateStreakMultiplier(days: number): string {
  if (days >= 50) return '3.0x';
  if (days >= 30) return '2.0x';
  if (days >= 14) return '1.5x';
  if (days >= 7) return '1.25x';
  return '1.0x';
}

export function checkMilestoneUnlocks(days: number, milestones: StreakMilestone[]): StreakMilestone[] {
  return milestones.map(m => ({
    ...m,
    unlocked: m.unlocked || days >= m.days
  }));
}

export function performDailyCheckIn(current: UserStreak, referenceDate?: Date): UserStreak {
  if (current.todayCompleted) {
    return current;
  }

  const todayStr = getTodayDateString(referenceDate);
  const nextDays = current.streakDays + 1;
  const bestStreak = Math.max(current.bestStreak, nextDays);
  const nextMultiplier = calculateStreakMultiplier(nextDays);
  const updatedMilestones = checkMilestoneUnlocks(nextDays, current.milestones);
  const earnedFreeze = nextDays === 7 || nextDays === 14 || nextDays === 30 || nextDays === 50 || nextDays === 100 ? 1 : 0;

  const updatedWeekly = current.weeklyHistory.map((item, index) => {
    if (index === current.weeklyHistory.length - 1) {
      return {
        ...item,
        date: todayStr,
        completed: true,
        xpEarned: (item.xpEarned || 0) + 50,
        minutesPracticed: item.minutesPracticed || 0
      };
    }
    return item;
  });

  return {
    ...current,
    streakDays: nextDays,
    bestStreak,
    lastCheckInDate: todayStr,
    todayCompleted: true,
    streakFreezesAvailable: (current.streakFreezesAvailable || 0) + earnedFreeze,
    currentMultiplier: nextMultiplier,
    totalXp: (current.totalXp || 0) + 50,
    todayMinutes: current.todayMinutes || 0,
    weeklyHistory: updatedWeekly,
    milestones: updatedMilestones
  };
}

export function getStreakStatusLabel(days: number, todayCompleted: boolean): string {
  if (todayCompleted) {
    return `🔥 Day ${days} Secured! You're on fire today.`;
  }
  return `⚡ Check in today to preserve your ${days}-day streak!`;
}

export interface DailyGoalProgress {
  todayMinutes: number;
  dailyGoalMinutes: number;
  percent: number; // 0 to 100 clamped
  rawRatio: number;
  isGoalMet: boolean;
  remainingMinutes: number;
  ariaLabel: string;
  tooltipText: string;
}

export function calculateDailyGoalProgress(
  todayMinutes: number = 0,
  dailyGoalMinutes: number = 15
): DailyGoalProgress {
  const safeGoal = Math.max(1, Number.isFinite(dailyGoalMinutes) ? dailyGoalMinutes : 15);
  const safeToday = Math.max(0, Number.isFinite(todayMinutes) ? todayMinutes : 0);
  const rawRatio = safeToday / safeGoal;
  const percent = Math.min(100, Math.max(0, Math.round(rawRatio * 100)));
  const isGoalMet = safeToday >= safeGoal;
  const remainingMinutes = Math.max(0, safeGoal - safeToday);

  const ariaLabel = isGoalMet
    ? `Daily goal achieved: ${safeToday} of ${safeGoal} minutes completed (100%)`
    : `Daily goal progress: ${safeToday} of ${safeGoal} minutes completed (${percent}%, ${remainingMinutes}m remaining)`;

  const tooltipText = isGoalMet
    ? `Daily Goal Completed: ${safeToday}/${safeGoal}m (100%) 🎉`
    : `Daily Goal: ${safeToday}/${safeGoal}m (${percent}%) · ${remainingMinutes}m remaining`;

  return {
    todayMinutes: safeToday,
    dailyGoalMinutes: safeGoal,
    percent,
    rawRatio,
    isGoalMet,
    remainingMinutes,
    ariaLabel,
    tooltipText
  };
}

export function computeCircleProgressStroke(
  percent: number,
  radius: number
): { circumference: number; strokeDashoffset: number } {
  const safePercent = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePercent / 100) * circumference;
  return {
    circumference,
    strokeDashoffset
  };
}

export function recordPracticeMinutes(current: UserStreak, minutes: number): UserStreak {
  const added = Math.max(0, Math.round(minutes));
  const nextTodayMinutes = current.todayMinutes + added;
  const goalReached = nextTodayMinutes >= current.dailyGoalMinutes;

  const updatedWeekly = current.weeklyHistory.map((item, index) => {
    if (index === current.weeklyHistory.length - 1) {
      return {
        ...item,
        minutesPracticed: item.minutesPracticed + added,
        completed: item.completed || goalReached
      };
    }
    return item;
  });

  return {
    ...current,
    todayMinutes: nextTodayMinutes,
    todayCompleted: current.todayCompleted || goalReached,
    weeklyHistory: updatedWeekly
  };
}

export interface XpMilestoneBadge {
  id: string;
  title: string;
  thresholdXp: number;
  iconName: 'Award' | 'Zap' | 'GraduationCap' | 'Trophy' | 'Crown';
  badgeEmoji: string;
  description: string;
  perkReward: string;
}

export const XP_MILESTONE_BADGES: XpMilestoneBadge[] = [
  {
    id: 'xp-100',
    title: 'Drill Initiate',
    thresholdXp: 100,
    iconName: 'Award',
    badgeEmoji: '🥉',
    description: 'Earn 100 total XP from drills and practice',
    perkReward: 'Bronze Rank'
  },
  {
    id: 'xp-250',
    title: 'Practice Prodigy',
    thresholdXp: 250,
    iconName: 'Zap',
    badgeEmoji: '⚡',
    description: 'Reach 250 total XP with persistent drill streaks',
    perkReward: 'Silver Rank'
  },
  {
    id: 'xp-500',
    title: 'Language Scholar',
    thresholdXp: 500,
    iconName: 'GraduationCap',
    badgeEmoji: '🎓',
    description: 'Reach 500 total XP across grammar, vocabulary & drills',
    perkReward: 'Scholar Crest'
  },
  {
    id: 'xp-1000',
    title: 'Fluency Champion',
    thresholdXp: 1000,
    iconName: 'Trophy',
    badgeEmoji: '🏆',
    description: 'Surpass 1,000 total XP with advanced drill mastery',
    perkReward: 'Gold Laurels'
  },
  {
    id: 'xp-2500',
    title: 'Master Polyglot',
    thresholdXp: 2500,
    iconName: 'Crown',
    badgeEmoji: '👑',
    description: 'Reach 2,500 total XP for grandmaster language status',
    perkReward: 'Grandmaster Ring'
  }
];

export interface EvaluatedXpBadge extends XpMilestoneBadge {
  isUnlocked: boolean;
  progressPercent: number;
  xpRemaining: number;
}

export function evaluateXpMilestones(currentXp: number): {
  badges: EvaluatedXpBadge[];
  unlockedCount: number;
  totalCount: number;
  nextMilestone: EvaluatedXpBadge | null;
} {
  const safeXp = Math.max(0, Number.isFinite(currentXp) ? currentXp : 0);
  const badges: EvaluatedXpBadge[] = XP_MILESTONE_BADGES.map((badge) => {
    const isUnlocked = safeXp >= badge.thresholdXp;
    const progressPercent = Math.min(100, Math.round((safeXp / badge.thresholdXp) * 100));
    const xpRemaining = Math.max(0, badge.thresholdXp - safeXp);
    return {
      ...badge,
      isUnlocked,
      progressPercent,
      xpRemaining
    };
  });

  const unlockedCount = badges.filter((b) => b.isUnlocked).length;
  const nextMilestone = badges.find((b) => !b.isUnlocked) || null;

  return {
    badges,
    unlockedCount,
    totalCount: badges.length,
    nextMilestone
  };
}

