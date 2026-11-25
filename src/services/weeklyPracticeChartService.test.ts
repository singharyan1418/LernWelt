import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWeeklyPracticeChartData,
  formatPracticeTooltipDuration
} from './weeklyPracticeChartService';
import { UserStreak } from '../types';

const makeStreak = (overrides: Partial<UserStreak> = {}): UserStreak => ({
  streakDays: 3,
  bestStreak: 5,
  lastCheckInDate: '2026-11-25',
  todayCompleted: false,
  streakFreezesAvailable: 0,
  streakFreezesUsed: 0,
  currentMultiplier: '1.25x',
  totalXp: 250,
  todayMinutes: 8,
  todaySeconds: 480,
  dailyGoalMinutes: 30,
  weeklyHistory: [
    { date: '2026-11-19', dayName: 'Thu', completed: true, xpEarned: 50, minutesPracticed: 35 },
    { date: '2026-11-20', dayName: 'Fri', completed: false, xpEarned: 0, minutesPracticed: 0 },
    { date: '2026-11-21', dayName: 'Sat', completed: true, xpEarned: 50, minutesPracticed: 42 },
    { date: '2026-11-22', dayName: 'Sun', completed: false, xpEarned: 20, minutesPracticed: 18 },
    { date: '2026-11-23', dayName: 'Mon', completed: true, xpEarned: 50, minutesPracticed: 30 },
    { date: '2026-11-24', dayName: 'Tue', completed: false, xpEarned: 0, minutesPracticed: 5 },
    { date: '2026-11-25', dayName: 'Wed', completed: false, xpEarned: 0, minutesPracticed: 8 }
  ],
  milestones: [],
  ...overrides
});

test('buildWeeklyPracticeChartData maps 7 days with goalMet flags and summary metrics', () => {
  const { points, summary } = buildWeeklyPracticeChartData(makeStreak(), 'English');

  assert.equal(points.length, 7);
  assert.equal(points[0].localizedDay, 'Thu');
  assert.equal(points[0].goalMet, true); // 35 >= 30
  assert.equal(points[1].minutes, 0);
  assert.equal(points[1].goalMet, false);
  assert.equal(points[2].minutes, 42);
  assert.equal(points[3].goalMet, false); // 18 < 30
  assert.equal(points[4].goalMet, true); // 30 >= 30
  assert.equal(points[6].isToday, true);
  assert.equal(points[6].minutes, 8);

  // Total = 35 + 0 + 42 + 18 + 30 + 5 + 8 = 138m
  assert.equal(summary.totalMinutes, 138);
  assert.equal(summary.averageMinutes, 19.7);
  assert.equal(summary.goalDaysMet, 3);
  assert.equal(summary.peakDayLabel, 'Sat');
  assert.equal(summary.peakMinutes, 42);
  assert.equal(summary.hasAnyPractice, true);

  // Legacy goals < 30m are clamped to 30m minimum
  const clamped = buildWeeklyPracticeChartData(makeStreak({ dailyGoalMinutes: 15 }), 'English');
  assert.equal(clamped.points[0].goalMinutes, 30);
  assert.equal(clamped.points[3].goalMet, false);
});

test('buildWeeklyPracticeChartData preserves sub-minute todaySeconds precision', () => {
  const streak = makeStreak({
    todayMinutes: 0,
    todaySeconds: 45,
    weeklyHistory: [
      { date: '2026-11-19', dayName: 'Thu', completed: false, xpEarned: 0, minutesPracticed: 0 },
      { date: '2026-11-20', dayName: 'Fri', completed: false, xpEarned: 0, minutesPracticed: 0 },
      { date: '2026-11-21', dayName: 'Sat', completed: false, xpEarned: 0, minutesPracticed: 0 },
      { date: '2026-11-22', dayName: 'Sun', completed: false, xpEarned: 0, minutesPracticed: 0 },
      { date: '2026-11-23', dayName: 'Mon', completed: false, xpEarned: 0, minutesPracticed: 0 },
      { date: '2026-11-24', dayName: 'Tue', completed: false, xpEarned: 0, minutesPracticed: 0 },
      { date: '2026-11-25', dayName: 'Wed', completed: false, xpEarned: 0, minutesPracticed: 0 }
    ]
  });

  const { points, summary } = buildWeeklyPracticeChartData(streak, 'English');

  assert.equal(points[6].seconds, 45);
  assert.equal(points[6].minutes, 0.8);
  assert.equal(summary.hasAnyPractice, true);
  assert.equal(summary.peakDayLabel, 'Wed');
});

test('buildWeeklyPracticeChartData localizes days in German and handles zero-practice week', () => {
  const zeroStreak = makeStreak({
    todayMinutes: 0,
    todaySeconds: 0,
    weeklyHistory: [
      { date: '2026-11-19', dayName: 'Thu', completed: false, xpEarned: 0, minutesPracticed: 0 },
      { date: '2026-11-20', dayName: 'Fri', completed: false, xpEarned: 0, minutesPracticed: 0 },
      { date: '2026-11-21', dayName: 'Sat', completed: false, xpEarned: 0, minutesPracticed: 0 },
      { date: '2026-11-22', dayName: 'Sun', completed: false, xpEarned: 0, minutesPracticed: 0 },
      { date: '2026-11-23', dayName: 'Mon', completed: false, xpEarned: 0, minutesPracticed: 0 },
      { date: '2026-11-24', dayName: 'Tue', completed: false, xpEarned: 0, minutesPracticed: 0 },
      { date: '2026-11-25', dayName: 'Wed', completed: false, xpEarned: 0, minutesPracticed: 0 }
    ]
  });

  const { points, summary } = buildWeeklyPracticeChartData(zeroStreak, 'German');
  assert.equal(points[0].localizedDay, 'Do');
  assert.equal(points[6].localizedDay, 'Mi');
  assert.equal(summary.hasAnyPractice, false);
  assert.equal(summary.peakDayLabel, '—');
  assert.equal(summary.totalMinutes, 0);
});

test('formatPracticeTooltipDuration formats seconds, mixed minutes/seconds, and German units', () => {
  assert.equal(formatPracticeTooltipDuration(0, 0, 'English'), '0m');
  assert.equal(formatPracticeTooltipDuration(0.8, 45, 'English'), '45s');
  assert.equal(formatPracticeTooltipDuration(0.8, 45, 'German'), '45 Sek.');
  assert.equal(formatPracticeTooltipDuration(4.5, 270, 'English'), '4m 30s');
  assert.equal(formatPracticeTooltipDuration(18, 1080, 'German'), '18 Min.');
});
