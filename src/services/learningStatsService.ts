import {
  ActiveTab,
  CorrectionResult,
  PronunciationResult,
  UserProfile,
  UserStreak,
  VocabularyWord
} from '../types';
import {
  calculateStreakMultiplier,
  checkMilestoneUnlocks,
  getTodayDateString,
  initializeRealUserStreak
} from './streakService';

export interface PersistedLearningStats {
  streak: UserStreak;
  totalPracticeSeconds: number;
  totalPracticeMinutes: number;
  correctionsReceived: number;
  seenCorrectionIds: string[];
  vocabulary?: VocabularyWord[];
  statsSource: 'real';
  updatedAt: number;
}

const LEGACY_SAMPLE_VOCAB_IDS = new Set(['voc_1', 'voc_2', 'voc_3', 'voc_4', 'voc_5']);

/**
 * Filters out legacy pre-seeded mock vocabulary items if no real migration has occurred yet.
 * Preserves any words genuinely created by the learner.
 */
export function sanitizeVocabularyDeck(
  rawDeck: unknown,
  alreadyMigrated: boolean
): VocabularyWord[] {
  if (!Array.isArray(rawDeck)) return [];
  const validItems = rawDeck.filter(
    (w): w is VocabularyWord => Boolean(w && typeof w === 'object' && typeof (w as VocabularyWord).word === 'string')
  );
  if (alreadyMigrated) {
    return validItems;
  }
  const hasOnlyLegacySamples =
    validItems.length > 0 && validItems.every((item) => LEGACY_SAMPLE_VOCAB_IDS.has(item.id));
  return hasOnlyLegacySamples ? [] : validItems;
}

/**
 * Ensures any profile loaded from legacy mock storage or a brand-new signup starts with
 * strictly authentic real metrics (never mock numbers like 14d, 380m, 142 words, 67 corrections, 1850 XP).
 */
export function sanitizeToRealStatsProfile(
  profile: UserProfile,
  vocabulary: VocabularyWord[],
  referenceDate?: Date
): UserProfile {
  const realVocabCount = vocabulary.length;

  if (profile.statsSource !== 'real') {
    const cleanStreak = initializeRealUserStreak(
      {
        streakDays: 0,
        bestStreak: 0,
        totalXp: 0,
        streakFreezesAvailable: 0,
        streakFreezesUsed: 0,
        dailyGoalMinutes: 15,
        dailyDrillGoal: 5,
        todayDrillsCompleted: 0,
        todayMinutes: 0,
        todaySeconds: 0,
        todayCompleted: false
      },
      referenceDate
    );

    return {
      ...profile,
      streakDays: cleanStreak.streakDays,
      streak: cleanStreak,
      totalPracticeSeconds: 0,
      totalPracticeMinutes: 0,
      wordsLearned: realVocabCount,
      correctionsReceived: 0,
      statsSource: 'real'
    };
  }

  const normalizedStreak = initializeRealUserStreak(profile.streak, referenceDate);
  const totalSeconds =
    typeof profile.totalPracticeSeconds === 'number' && Number.isFinite(profile.totalPracticeSeconds)
      ? Math.max(0, Math.floor(profile.totalPracticeSeconds))
      : Math.max(0, Math.floor((profile.totalPracticeMinutes || 0) * 60));

  return {
    ...profile,
    streakDays: normalizedStreak.streakDays,
    streak: normalizedStreak,
    totalPracticeSeconds: totalSeconds,
    totalPracticeMinutes: Math.floor(totalSeconds / 60),
    wordsLearned: realVocabCount,
    correctionsReceived: Math.max(0, Math.floor(profile.correctionsReceived || 0)),
    statsSource: 'real'
  };
}

/**
 * Determines whether the user is currently inside an active learning/practice surface
 * where elapsed wall-clock time represents genuine language practice.
 */
export function isActivePracticeContext(params: {
  activeTab: ActiveTab;
  isInsideRoom: boolean;
  isRandomMatchActive?: boolean;
}): boolean {
  const { activeTab, isInsideRoom, isRandomMatchActive = false } = params;
  if (activeTab === 'chat-room') return isInsideRoom;
  if (activeTab === 'random-connect') return isRandomMatchActive;
  return (
    activeTab === 'ai-drills' ||
    activeTab === 'grammar-lab' ||
    activeTab === 'language-lab' ||
    activeTab === 'ai-coach'
  );
}

/**
 * Accumulates real elapsed practice seconds into both total practice time and today's streak goal.
 * Automatically completes today's streak if the real daily goal minutes threshold is crossed.
 */
export function accumulateRealPracticeSeconds(
  profile: UserProfile,
  deltaSeconds: number,
  referenceDate?: Date
): UserProfile {
  const safeDelta = Math.max(0, Math.floor(Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
  if (safeDelta <= 0) return profile;

  const currentStreak = initializeRealUserStreak(profile.streak, referenceDate);
  const prevTotalSeconds =
    typeof profile.totalPracticeSeconds === 'number' && Number.isFinite(profile.totalPracticeSeconds)
      ? Math.max(0, profile.totalPracticeSeconds)
      : Math.max(0, (profile.totalPracticeMinutes || 0) * 60);

  const nextTotalSeconds = prevTotalSeconds + safeDelta;
  const nextTotalMinutes = Math.floor(nextTotalSeconds / 60);

  const prevTodaySeconds =
    typeof currentStreak.todaySeconds === 'number' && Number.isFinite(currentStreak.todaySeconds)
      ? Math.max(0, currentStreak.todaySeconds)
      : Math.max(0, (currentStreak.todayMinutes || 0) * 60);
  const nextTodaySeconds = prevTodaySeconds + safeDelta;
  const nextTodayMinutes = Math.floor(nextTodaySeconds / 60);

  const todayStr = getTodayDateString(referenceDate);
  const dailyGoalMinutes = Math.max(1, currentStreak.dailyGoalMinutes || 15);
  const goalMetNow = nextTodayMinutes >= dailyGoalMinutes;
  const newlyCompletedToday = !currentStreak.todayCompleted && goalMetNow;

  let nextStreakDays = currentStreak.streakDays;
  let nextBestStreak = currentStreak.bestStreak;
  let bonusXp = 0;
  let earnedFreeze = 0;

  if (newlyCompletedToday) {
    nextStreakDays = currentStreak.streakDays + 1;
    nextBestStreak = Math.max(currentStreak.bestStreak, nextStreakDays);
    bonusXp = 50;
    earnedFreeze =
      nextStreakDays === 7 ||
      nextStreakDays === 14 ||
      nextStreakDays === 30 ||
      nextStreakDays === 50 ||
      nextStreakDays === 100
        ? 1
        : 0;
  }

  const updatedWeekly = currentStreak.weeklyHistory.map((item, idx) => {
    if (idx === currentStreak.weeklyHistory.length - 1) {
      return {
        ...item,
        date: todayStr,
        completed: currentStreak.todayCompleted || goalMetNow || item.completed,
        xpEarned: (item.xpEarned || 0) + bonusXp,
        minutesPracticed: nextTodayMinutes
      };
    }
    return item;
  });

  const nextStreak: UserStreak = {
    ...currentStreak,
    streakDays: nextStreakDays,
    bestStreak: nextBestStreak,
    lastCheckInDate: newlyCompletedToday ? todayStr : currentStreak.lastCheckInDate,
    todayCompleted: currentStreak.todayCompleted || goalMetNow,
    streakFreezesAvailable: (currentStreak.streakFreezesAvailable || 0) + earnedFreeze,
    currentMultiplier: calculateStreakMultiplier(nextStreakDays),
    totalXp: (currentStreak.totalXp || 0) + bonusXp,
    todayMinutes: nextTodayMinutes,
    todaySeconds: nextTodaySeconds,
    weeklyHistory: updatedWeekly,
    milestones: checkMilestoneUnlocks(nextStreakDays, currentStreak.milestones)
  };

  return {
    ...profile,
    streakDays: nextStreak.streakDays,
    streak: nextStreak,
    totalPracticeSeconds: nextTotalSeconds,
    totalPracticeMinutes: nextTotalMinutes,
    statsSource: 'real'
  };
}

/**
 * Formats practiced duration accurately, showing seconds when real sub-minute practice is logged.
 */
export function formatPracticedDuration(
  totalMinutes: number,
  totalSeconds?: number
): { valueLabel: string; detailLabel: string } {
  const safeSecs =
    typeof totalSeconds === 'number' && Number.isFinite(totalSeconds)
      ? Math.max(0, Math.floor(totalSeconds))
      : Math.max(0, Math.floor((totalMinutes || 0) * 60));
  const mins = Math.floor(safeSecs / 60);
  const remSecs = safeSecs % 60;

  if (safeSecs === 0) {
    return {
      valueLabel: '0m',
      detailLabel: 'Live rooms, drills & lab sessions'
    };
  }
  if (mins === 0) {
    return {
      valueLabel: `${remSecs}s`,
      detailLabel: 'Active session time recorded'
    };
  }
  return {
    valueLabel: `${mins}m`,
    detailLabel: remSecs > 0 ? `${mins}m ${remSecs}s across rooms & labs` : 'Live rooms, drills & lab sessions'
  };
}

/**
 * Extracts exact real mistake/correction count from a sentence grammar analysis.
 * Returns 0 when the user's sentence had no errors and required no correction.
 */
export function computeCorrectionCountFromAnalysis(result: CorrectionResult | null | undefined): number {
  if (!result) return 0;
  if (Array.isArray(result.mistakes) && result.mistakes.length > 0) {
    return result.mistakes.length;
  }
  const orig = (result.originalText || '').trim().toLowerCase();
  const corr = (result.correctedText || '').trim().toLowerCase();
  if (result.hasErrors && corr && corr !== orig) {
    return 1;
  }
  return 0;
}

/**
 * Extracts real pronunciation corrections count (words needing improvement).
 */
export function computeCorrectionCountFromPronunciation(
  result: PronunciationResult | null | undefined
): number {
  if (!result) return 0;
  if (Array.isArray(result.words) && result.words.length > 0) {
    const needsWorkCount = result.words.filter(
      (w) => w.status === 'needs-work' || (typeof w.score === 'number' && w.score < 70)
    ).length;
    if (needsWorkCount > 0) return needsWorkCount;
  }
  if (typeof result.accuracyScore === 'number' && result.accuracyScore < 85) {
    return 1;
  }
  return 0;
}

/**
 * Idempotently applies a real correction event to the learner profile.
 */
export function applyRealCorrectionEvent(
  profile: UserProfile,
  event: { id: string; count: number },
  seenIds: Set<string>
): { profile: UserProfile; added: number; nextSeenIds: Set<string> } {
  const safeId = String(event.id || '').trim();
  const safeCount = Math.max(0, Math.floor(Number.isFinite(event.count) ? event.count : 0));

  if (!safeId || safeCount === 0 || seenIds.has(safeId)) {
    return { profile, added: 0, nextSeenIds: seenIds };
  }

  const nextSeenIds = new Set(seenIds);
  nextSeenIds.add(safeId);

  return {
    profile: {
      ...profile,
      correctionsReceived: Math.max(0, (profile.correctionsReceived || 0) + safeCount),
      statsSource: 'real'
    },
    added: safeCount,
    nextSeenIds
  };
}

/**
 * Derives PersistedLearningStats snapshot for backend & storage synchronization.
 */
export function buildPersistedStatsSnapshot(
  profile: UserProfile,
  vocabulary: VocabularyWord[],
  seenCorrectionIds: Set<string>
): PersistedLearningStats {
  const streak = initializeRealUserStreak(profile.streak);
  const totalSeconds =
    typeof profile.totalPracticeSeconds === 'number' && Number.isFinite(profile.totalPracticeSeconds)
      ? Math.max(0, Math.floor(profile.totalPracticeSeconds))
      : Math.max(0, Math.floor((profile.totalPracticeMinutes || 0) * 60));

  return {
    streak,
    totalPracticeSeconds: totalSeconds,
    totalPracticeMinutes: Math.floor(totalSeconds / 60),
    correctionsReceived: Math.max(0, Math.floor(profile.correctionsReceived || 0)),
    seenCorrectionIds: Array.from(seenCorrectionIds).slice(-500),
    vocabulary,
    statsSource: 'real',
    updatedAt: Date.now()
  };
}
