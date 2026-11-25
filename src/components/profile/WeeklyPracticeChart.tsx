import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { BarChart3, Clock, Target, TrendingUp, Award } from 'lucide-react';
import { UserStreak } from '../../types';
import { AppTheme } from '../../services/themeService';
import { MINIMUM_DAILY_GOAL_MINUTES } from '../../services/streakService';
import {
  buildWeeklyPracticeChartData,
  formatPracticeTooltipDuration,
  WeeklyPracticeChartPoint
} from '../../services/weeklyPracticeChartService';
import { t } from '../../services/uiLocalization';

interface WeeklyPracticeChartProps {
  streak: UserStreak;
  theme?: AppTheme;
  nativeLanguage?: string | null;
  embedded?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: WeeklyPracticeChartPoint }>;
  nativeLanguage?: string | null;
}

const PracticeChartTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  nativeLanguage
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0].payload;
  const durationLabel = formatPracticeTooltipDuration(
    point.minutes,
    point.seconds,
    nativeLanguage
  );

  return (
    <div className="rounded-lg border border-slate-200 dark:border-[#2B3754] bg-white dark:bg-[#0D1321] px-3.5 py-2.5 shadow-lg text-xs space-y-1.5 min-w-[165px]">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-slate-900 dark:text-[#F1F4FA]">
          {point.localizedDay} · {point.date}
        </span>
        {point.isToday && (
          <span className="px-1.5 py-0.5 rounded bg-[#5C6AE0]/15 text-indigo-700 dark:text-[#8B97EE] text-[10px] font-semibold">
            {t('profile.chartTodayTag', nativeLanguage)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-slate-700 dark:text-[#C6CEE0]">
        <span>{t('profile.chartMinutesLabel', nativeLanguage)}</span>
        <span className="font-mono font-bold text-slate-900 dark:text-[#F1F4FA] tabular-nums">
          {durationLabel}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-[#8E99B2]">
        <span>{t('profile.chartDailyGoalLine', nativeLanguage, { goal: point.goalMinutes })}</span>
        {point.goalMet && (
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {t('profile.chartGoalMetTag', nativeLanguage)}
          </span>
        )}
      </div>
    </div>
  );
};

export const WeeklyPracticeChart: React.FC<WeeklyPracticeChartProps> = ({
  streak,
  theme = 'dark',
  nativeLanguage,
  embedded = false
}) => {
  const isDark = theme === 'dark';
  const goalMinutes = Math.max(
    MINIMUM_DAILY_GOAL_MINUTES,
    Math.round(streak.dailyGoalMinutes || MINIMUM_DAILY_GOAL_MINUTES)
  );

  const { points, summary } = useMemo(
    () => buildWeeklyPracticeChartData(streak, nativeLanguage),
    [streak, nativeLanguage]
  );

  const maxDataMinutes = useMemo(() => {
    const highest = points.reduce((max, p) => Math.max(max, p.minutes), 0);
    return Math.max(goalMinutes + 5, Math.ceil(highest * 1.15));
  }, [points, goalMinutes]);

  const gridStroke = isDark ? '#1D263B' : '#E2E8F0';
  const axisTickColor = isDark ? '#8E99B2' : '#475569';
  const cursorFill = isDark ? 'rgba(92, 106, 224, 0.10)' : 'rgba(92, 106, 224, 0.08)';

  const formatSummaryDuration = (mins: number, secs: number) =>
    formatPracticeTooltipDuration(mins, secs, nativeLanguage);

  const legend = (
    <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-slate-600 dark:text-[#8E99B2]">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-xs bg-[#5C6AE0]" />
        <span>{t('profile.chartMinutesLabel', nativeLanguage)}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
        <span>{t('profile.chartGoalMetTag', nativeLanguage)}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3.5 border-t-2 border-dashed border-amber-500" />
        <span>{t('profile.chartDailyGoalLine', nativeLanguage, { goal: goalMinutes })}</span>
      </span>
    </div>
  );

  const content = (
    <div className="space-y-4">
      {!embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-[#1D263B] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#5C6AE0]/15 border border-[#5C6AE0]/30 flex items-center justify-center text-indigo-600 dark:text-[#8B97EE]">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F1F4FA] tracking-tight">
                {t('profile.weeklyChartTitle', nativeLanguage)}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-[#8E99B2]">
              {t('profile.weeklyChartDesc', nativeLanguage, { goal: goalMinutes })}
            </p>
          </div>
          {legend}
        </div>
      ) : (
        <div className="flex items-center justify-end">{legend}</div>
      )}

      {/* Weekly Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-[#090E18] border border-slate-200 dark:border-[#1D263B] rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-[#8B97EE]">
            <Clock className="w-3.5 h-3.5" />
            <span>{t('profile.weeklyTotal', nativeLanguage)}</span>
          </div>
          <p
            className="text-lg font-bold text-slate-900 dark:text-[#F1F4FA] tabular-nums"
            data-testid="weekly-chart-total"
          >
            {formatSummaryDuration(summary.totalMinutes, summary.totalSeconds)}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-[#090E18] border border-slate-200 dark:border-[#1D263B] rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-700 dark:text-sky-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{t('profile.weeklyDailyAvg', nativeLanguage)}</span>
          </div>
          <p
            className="text-lg font-bold text-slate-900 dark:text-[#F1F4FA] tabular-nums"
            data-testid="weekly-chart-avg"
          >
            {formatSummaryDuration(
              summary.averageMinutes,
              Math.round(summary.totalSeconds / summary.totalDays)
            )}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-[#090E18] border border-slate-200 dark:border-[#1D263B] rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <Target className="w-3.5 h-3.5" />
            <span>{t('profile.weeklyGoalMetCount', nativeLanguage)}</span>
          </div>
          <p
            className="text-lg font-bold text-slate-900 dark:text-[#F1F4FA] tabular-nums"
            data-testid="weekly-chart-goals-met"
          >
            {summary.goalDaysMet} / {summary.totalDays}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-[#090E18] border border-slate-200 dark:border-[#1D263B] rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            <Award className="w-3.5 h-3.5" />
            <span>{t('profile.weeklyPeakDay', nativeLanguage)}</span>
          </div>
          <p
            className="text-lg font-bold text-slate-900 dark:text-[#F1F4FA] tabular-nums"
            data-testid="weekly-chart-peak"
          >
            {summary.hasAnyPractice
              ? `${summary.peakDayLabel} · ${summary.peakMinutes}m`
              : '—'}
          </p>
        </div>
      </div>

      {/* Recharts BarChart */}
      <div
        className="w-full h-[260px] bg-slate-50/70 dark:bg-[#090E18] border border-slate-200 dark:border-[#1D263B] rounded-lg p-3 sm:p-4"
        data-testid="weekly-practice-recharts-container"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={points}
            margin={{ top: 18, right: 14, left: -12, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={gridStroke}
            />
            <XAxis
              dataKey="localizedDay"
              axisLine={false}
              tickLine={false}
              tick={{ fill: axisTickColor, fontSize: 12, fontWeight: 600 }}
              dy={6}
            />
            <YAxis
              domain={[0, maxDataMinutes]}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fill: axisTickColor, fontSize: 11 }}
              tickFormatter={(value: number) => `${value}m`}
            />
            <ReferenceLine
              y={goalMinutes}
              stroke="#F59E0B"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `${goalMinutes}m`,
                position: 'insideTopRight',
                fill: isDark ? '#FBBF24' : '#B45309',
                fontSize: 11,
                fontWeight: 600
              }}
            />
            <Tooltip
              cursor={{ fill: cursorFill }}
              content={<PracticeChartTooltip nativeLanguage={nativeLanguage} />}
            />
            <Bar
              dataKey="minutes"
              name={t('profile.chartMinutesLabel', nativeLanguage)}
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
            >
              {points.map((entry) => {
                let fill = isDark ? '#334155' : '#CBD5E1';
                if (entry.minutes > 0) {
                  if (entry.goalMet) {
                    fill = '#10B981';
                  } else if (entry.isToday) {
                    fill = '#6366F1';
                  } else {
                    fill = '#5C6AE0';
                  }
                }
                return <Cell key={entry.date} fill={fill} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {!summary.hasAnyPractice && (
        <p className="text-xs text-slate-600 dark:text-[#8E99B2] bg-slate-50 dark:bg-[#090E18] border border-slate-200 dark:border-[#1D263B] rounded-lg px-3.5 py-2.5">
          {t('profile.weeklyChartEmptyNote', nativeLanguage)}
        </p>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div
        aria-label={t('profile.weeklyChartTitle', nativeLanguage)}
        data-testid="weekly-practice-chart-section"
      >
        {content}
      </div>
    );
  }

  return (
    <section
      aria-label={t('profile.weeklyChartTitle', nativeLanguage)}
      data-testid="weekly-practice-chart-section"
      className="bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] rounded-xl p-5 sm:p-7 shadow-xs dark:shadow-none"
    >
      {content}
    </section>
  );
};
