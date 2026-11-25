import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  calculateStreakMultiplier, 
  checkMilestoneUnlocks, 
  performDailyCheckIn, 
  getStreakStatusLabel,
  calculateDailyGoalProgress,
  computeCircleProgressStroke,
  recordPracticeMinutes,
  getTodayDateString,
  getOffsetDateString,
  generateRealWeeklyHistory,
  initializeRealUserStreak,
  recordDrillCompletion,
  calculateDailyDrillGoalProgress,
  evaluateXpMilestones,
  XP_MILESTONE_BADGES,
  MINIMUM_DAILY_GOAL_MINUTES
} from './streakService';
import { UserStreak } from '../types';

const mockStreak: UserStreak = {
  streakDays: 14,
  bestStreak: 21,
  lastCheckInDate: '2026-10-30',
  todayCompleted: false,
  streakFreezesAvailable: 2,
  streakFreezesUsed: 1,
  currentMultiplier: '1.5x',
  totalXp: 1850,
  todayMinutes: 12,
  dailyGoalMinutes: MINIMUM_DAILY_GOAL_MINUTES,
  weeklyHistory: [
    { date: '2026-10-25', dayName: 'Mon', completed: true, xpEarned: 80, minutesPracticed: 25 },
    { date: '2026-10-26', dayName: 'Tue', completed: true, xpEarned: 60, minutesPracticed: 20 },
    { date: '2026-10-27', dayName: 'Wed', completed: true, xpEarned: 95, minutesPracticed: 30 },
    { date: '2026-10-28', dayName: 'Thu', completed: true, xpEarned: 70, minutesPracticed: 22 },
    { date: '2026-10-29', dayName: 'Fri', completed: true, xpEarned: 110, minutesPracticed: 35 },
    { date: '2026-10-30', dayName: 'Sat', completed: true, xpEarned: 85, minutesPracticed: 28 },
    { date: '2026-10-31', dayName: 'Sun', completed: false, xpEarned: 0, minutesPracticed: 12 }
  ],
  milestones: [
    { days: 3, title: 'Spark Ignited', reward: '+100 XP', icon: '🔥', unlocked: true },
    { days: 7, title: 'Habit Builder', reward: '+250 XP & Bronze Flame', icon: '🥉', unlocked: true },
    { days: 14, title: 'Dedication Champion', reward: '+500 XP & Silver Flame', icon: '🥈', unlocked: true },
    { days: 30, title: 'Fluency Seeker', reward: '+1,000 XP & Gold Flame', icon: '🥇', unlocked: false }
  ]
};

test('calculateStreakMultiplier scales accurately based on days', () => {
  assert.equal(calculateStreakMultiplier(1), '1.0x');
  assert.equal(calculateStreakMultiplier(6), '1.0x');
  assert.equal(calculateStreakMultiplier(7), '1.25x');
  assert.equal(calculateStreakMultiplier(14), '1.5x');
  assert.equal(calculateStreakMultiplier(30), '2.0x');
  assert.equal(calculateStreakMultiplier(55), '3.0x');
});

test('performDailyCheckIn increments streak days and awards +50 XP without fabricating practice minutes', () => {
  const updated = performDailyCheckIn(mockStreak);
  assert.equal(updated.streakDays, 15);
  assert.equal(updated.todayCompleted, true);
  assert.equal(updated.totalXp, 1900);
  assert.equal(updated.todayMinutes, mockStreak.todayMinutes);
  assert.equal(updated.weeklyHistory[6].completed, true);
  assert.equal(updated.weeklyHistory[6].xpEarned, 50);
  assert.equal(updated.weeklyHistory[6].minutesPracticed, mockStreak.weeklyHistory[6].minutesPracticed);
});

test('performDailyCheckIn is idempotent if today is already completed', () => {
  const alreadyDone: UserStreak = { ...mockStreak, todayCompleted: true };
  const attempted = performDailyCheckIn(alreadyDone);
  assert.equal(attempted.streakDays, 14);
  assert.equal(attempted.totalXp, 1850);
});

test('initializeRealUserStreak keeps fresh learners at 0 days, 0 XP, and 0 freezes', () => {
  const fresh = initializeRealUserStreak(undefined, new Date('2026-11-13T10:00:00'));
  assert.equal(fresh.streakDays, 0);
  assert.equal(fresh.bestStreak, 0);
  assert.equal(fresh.totalXp, 0);
  assert.equal(fresh.streakFreezesAvailable, 0);
  assert.equal(fresh.streakFreezesUsed, 0);
  assert.equal(fresh.todayCompleted, false);
  assert.equal(fresh.todayMinutes, 0);
  assert.equal(fresh.dailyGoalMinutes, 30);

  // Legacy values below 30 minutes are clamped up to the 30-minute minimum
  const legacyClamped = initializeRealUserStreak({ dailyGoalMinutes: 15 }, new Date('2026-11-13T10:00:00'));
  assert.equal(legacyClamped.dailyGoalMinutes, 30);
});

test('checkMilestoneUnlocks unlocks milestone when threshold is reached', () => {
  const milestones = [
    { days: 14, title: 'Dedication Champion', reward: '+500 XP', icon: '🥈', unlocked: false },
    { days: 30, title: 'Fluency Seeker', reward: '+1,000 XP', icon: '🥇', unlocked: false }
  ];

  const result15 = checkMilestoneUnlocks(15, milestones);
  assert.equal(result15[0].unlocked, true);
  assert.equal(result15[1].unlocked, false);

  const result30 = checkMilestoneUnlocks(30, milestones);
  assert.equal(result30[0].unlocked, true);
  assert.equal(result30[1].unlocked, true);
});

test('getStreakStatusLabel provides appropriate feedback', () => {
  assert.ok(getStreakStatusLabel(14, false).includes('Check in'));
  assert.ok(getStreakStatusLabel(15, true).includes('Secured'));
});

test('calculateDailyGoalProgress enforces 30m minimum goal and accurately calculates percentage, remaining minutes, and labels', () => {
  // 24 of 30 min = 80%
  const p80 = calculateDailyGoalProgress(24, 30);
  assert.equal(p80.percent, 80);
  assert.equal(p80.isGoalMet, false);
  assert.equal(p80.remainingMinutes, 6);
  assert.ok(p80.tooltipText.includes('80%'));

  // 30 of 30 min = 100% (goal met)
  const p100 = calculateDailyGoalProgress(30, 30);
  assert.equal(p100.percent, 100);
  assert.equal(p100.isGoalMet, true);
  assert.equal(p100.remainingMinutes, 0);
  assert.ok(p100.ariaLabel.includes('achieved'));

  // Over goal (40 of 30 min) -> clamped to 100%
  const pOver = calculateDailyGoalProgress(40, 30);
  assert.equal(pOver.percent, 100);
  assert.equal(pOver.isGoalMet, true);
  assert.equal(pOver.remainingMinutes, 0);

  // 0 of 30 min = 0%
  const p0 = calculateDailyGoalProgress(0, 30);
  assert.equal(p0.percent, 0);
  assert.equal(p0.isGoalMet, false);
  assert.equal(p0.remainingMinutes, 30);

  // Values below 30 minutes clamp up to minimum 30 minutes
  const pClamped = calculateDailyGoalProgress(15, 15);
  assert.equal(pClamped.dailyGoalMinutes, 30);
  assert.equal(pClamped.percent, 50);
  assert.equal(pClamped.isGoalMet, false);
  assert.equal(pClamped.remainingMinutes, 15);

  const pDefault = calculateDailyGoalProgress(5, 0);
  assert.equal(pDefault.dailyGoalMinutes, 30);
});

test('computeCircleProgressStroke calculates accurate circumference and strokeDashoffset', () => {
  const r = 13;
  const circumference = 2 * Math.PI * r;

  // 0% progress -> strokeDashoffset equals circumference
  const stroke0 = computeCircleProgressStroke(0, r);
  assert.ok(Math.abs(stroke0.circumference - circumference) < 0.001);
  assert.ok(Math.abs(stroke0.strokeDashoffset - circumference) < 0.001);

  // 50% progress -> strokeDashoffset is half of circumference
  const stroke50 = computeCircleProgressStroke(50, r);
  assert.ok(Math.abs(stroke50.strokeDashoffset - circumference * 0.5) < 0.001);

  // 100% progress -> strokeDashoffset is 0
  const stroke100 = computeCircleProgressStroke(100, r);
  assert.ok(Math.abs(stroke100.strokeDashoffset) < 0.001);
});

test('recordPracticeMinutes increments todayMinutes and updates weekly history', () => {
  const updated = recordPracticeMinutes(mockStreak, 18);
  assert.equal(updated.todayMinutes, 30); // 12 + 18 = 30 >= 30
  assert.equal(updated.todayCompleted, true);
  assert.equal(updated.weeklyHistory[6].minutesPracticed, 30);
});

test('getTodayDateString and getOffsetDateString generate correct ISO format', () => {
  const fixed = new Date('2025-06-15T10:00:00Z');
  const today = getTodayDateString(fixed);
  assert.equal(today, '2025-06-15');
  const yesterday = getOffsetDateString(-1, fixed);
  assert.equal(yesterday, '2025-06-14');
  const pastWeek = getOffsetDateString(-6, fixed);
  assert.equal(pastWeek, '2025-06-09');
});

test('generateRealWeeklyHistory produces 7 consecutive days ending on reference date', () => {
  const fixed = new Date('2025-06-15T12:00:00');
  const history = generateRealWeeklyHistory([], fixed, true, 20, 80);
  assert.equal(history.length, 7);
  assert.equal(history[6].date, '2025-06-15');
  assert.equal(history[6].completed, true);
  assert.equal(history[6].minutesPracticed, 20);
  assert.equal(history[6].xpEarned, 80);
  assert.equal(history[0].date, '2025-06-09');
});

test('initializeRealUserStreak initializes real data cleanly', () => {
  const fixed = new Date('2025-06-15T12:00:00');
  const streak = initializeRealUserStreak(
    { streakDays: 5, lastCheckInDate: '2025-06-14', totalXp: 500 },
    fixed
  );
  assert.equal(streak.streakDays, 5);
  assert.equal(streak.todayCompleted, false);
  assert.equal(streak.weeklyHistory.length, 7);
  assert.equal(streak.weeklyHistory[6].date, '2025-06-15');
});

test('recordDrillCompletion tracks drills, awards XP, and unlocks daily badge on reaching goal', () => {
  const fixed = new Date('2025-06-15T12:00:00');
  const initial = initializeRealUserStreak(
    {
      streakDays: 3,
      bestStreak: 5,
      lastCheckInDate: '2025-06-14',
      todayDrillsCompleted: 4,
      dailyDrillGoal: 5,
      totalXp: 300,
      todayCompleted: false,
      weeklyHistory: generateRealWeeklyHistory([], fixed, false, 0, 0)
    },
    fixed
  );

  // 5th drill completed: hits the goal!
  const res = recordDrillCompletion(initial, 30, 0, fixed);
  assert.equal(res.drillsCompletedToday, 5);
  assert.equal(res.justUnlockedBadge, true);
  assert.equal(res.newlyCompletedToday, true);
  assert.equal(res.streak.streakDays, 4); // Streak advanced
  assert.equal(res.streak.dailyBadgeUnlocked, true);
  assert.equal(res.streak.todayCompleted, true);
  assert.equal(res.xpAwarded, 130); // 30 + 100 bonus
  assert.equal(res.streak.totalXp, 430);
});

test('initializeRealUserStreak rolls over once on new day and consumes only one freeze for a 1-day gap', () => {
  const today = new Date('2025-06-15T12:00:00');
  const missedOneDay = initializeRealUserStreak(
    {
      streakDays: 6,
      bestStreak: 6,
      lastCheckInDate: '2025-06-13',
      streakFreezesAvailable: 2,
      streakFreezesUsed: 0,
      todayCompleted: true,
      todayDrillsCompleted: 5,
      todayMinutes: 20,
      todaySeconds: 1200,
      weeklyHistory: generateRealWeeklyHistory([], new Date('2025-06-13T12:00:00'), true, 20, 50)
    },
    today
  );

  assert.equal(missedOneDay.streakDays, 6);
  assert.equal(missedOneDay.streakFreezesAvailable, 1);
  assert.equal(missedOneDay.streakFreezesUsed, 1);
  assert.equal(missedOneDay.todayCompleted, false);
  assert.equal(missedOneDay.todayDrillsCompleted, 0);
  assert.equal(missedOneDay.todaySeconds, 0);

  // Subsequent same-day call (e.g., after completing 1 drill or practicing seconds) does NOT consume a second freeze
  const afterPartial = initializeRealUserStreak(
    { ...missedOneDay, todayDrillsCompleted: 2, todaySeconds: 45 },
    today
  );
  assert.equal(afterPartial.streakFreezesAvailable, 1);
  assert.equal(afterPartial.streakFreezesUsed, 1);
  assert.equal(afterPartial.todayDrillsCompleted, 2);
  assert.equal(afterPartial.todaySeconds, 45);
});

test('calculateDailyDrillGoalProgress computes correct percentages and statuses', () => {
  const p0 = calculateDailyDrillGoalProgress(0, 5);
  assert.equal(p0.percent, 0);
  assert.equal(p0.isGoalMet, false);
  assert.equal(p0.remainingCount, 5);

  const p3 = calculateDailyDrillGoalProgress(3, 5);
  assert.equal(p3.percent, 60);
  assert.equal(p3.isGoalMet, false);
  assert.equal(p3.remainingCount, 2);

  const p5 = calculateDailyDrillGoalProgress(5, 5);
  assert.equal(p5.percent, 100);
  assert.equal(p5.isGoalMet, true);
  assert.equal(p5.remainingCount, 0);
});

test('evaluateXpMilestones correctly evaluates badge unlocks including Language Scholar for 500 XP', () => {
  // At 0 XP: nothing unlocked, next is Drill Initiate (100 XP)
  const eval0 = evaluateXpMilestones(0);
  assert.equal(eval0.unlockedCount, 0);
  assert.equal(eval0.nextMilestone?.title, 'Drill Initiate');
  assert.equal(eval0.nextMilestone?.thresholdXp, 100);
  assert.equal(eval0.nextMilestone?.xpRemaining, 100);

  // At 350 XP: Drill Initiate (100) and Practice Prodigy (250) unlocked; next is Language Scholar (500)
  const eval350 = evaluateXpMilestones(350);
  assert.equal(eval350.unlockedCount, 2);
  const scholar350 = eval350.badges.find((b) => b.title === 'Language Scholar');
  assert.ok(scholar350);
  assert.equal(scholar350?.isUnlocked, false);
  assert.equal(scholar350?.progressPercent, 70); // 350/500 = 70%
  assert.equal(scholar350?.xpRemaining, 150);
  assert.equal(eval350.nextMilestone?.title, 'Language Scholar');

  // At 500 XP: Language Scholar is strictly unlocked!
  const eval500 = evaluateXpMilestones(500);
  assert.equal(eval500.unlockedCount, 3);
  const scholar500 = eval500.badges.find((b) => b.title === 'Language Scholar');
  assert.ok(scholar500);
  assert.equal(scholar500?.isUnlocked, true);
  assert.equal(scholar500?.progressPercent, 100);
  assert.equal(scholar500?.xpRemaining, 0);
  assert.equal(eval500.nextMilestone?.title, 'Fluency Champion');

  // At 3000 XP: all 5 milestone badges unlocked
  const eval3000 = evaluateXpMilestones(3000);
  assert.equal(eval3000.unlockedCount, XP_MILESTONE_BADGES.length);
  assert.equal(eval3000.nextMilestone, null);
});



