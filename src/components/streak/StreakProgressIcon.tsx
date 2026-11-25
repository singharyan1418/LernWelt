import React, { useId } from 'react';
import { Flame, Check } from 'lucide-react';
import {
  calculateDailyGoalProgress,
  computeCircleProgressStroke,
  MINIMUM_DAILY_GOAL_MINUTES
} from '../../services/streakService';
import { t } from '../../services/uiLocalization';

export interface StreakProgressIconProps {
  todayMinutes?: number;
  dailyGoalMinutes?: number;
  size?: number;
  strokeWidth?: number;
  showFlame?: boolean;
  flameSizeClass?: string;
  className?: string;
  iconClassName?: string;
  showCompletionBadge?: boolean;
  showHoverTooltip?: boolean;
  streakDays?: number;
  nativeLanguage?: string;
}

/**
 * Circular progress indicator integrated directly into the streak flame icon.
 * Displays the user's progress toward their 'Daily Goal Minutes' based on their streak data.
 */
export const StreakProgressIcon: React.FC<StreakProgressIconProps> = ({
  todayMinutes = 12,
  dailyGoalMinutes = MINIMUM_DAILY_GOAL_MINUTES,
  size = 24,
  strokeWidth = 2.5,
  showFlame = true,
  flameSizeClass,
  className = '',
  iconClassName = '',
  showCompletionBadge = true,
  showHoverTooltip = false,
  streakDays,
  nativeLanguage
}) => {
  const gradientId = useId().replace(/:/g, '_');
  const progress = calculateDailyGoalProgress(todayMinutes, dailyGoalMinutes);
  const localizedAriaLabel = progress.isGoalMet
    ? t('streak.ariaGoalAchieved', nativeLanguage, {
        done: progress.todayMinutes,
        goal: progress.dailyGoalMinutes
      })
    : t('streak.ariaGoalProgress', nativeLanguage, {
        done: progress.todayMinutes,
        goal: progress.dailyGoalMinutes,
        percent: progress.percent,
        remaining: progress.remainingMinutes
      });
  const localizedTooltipText = progress.isGoalMet
    ? t('streak.tooltipGoalCompleted', nativeLanguage, {
        done: progress.todayMinutes,
        goal: progress.dailyGoalMinutes
      })
    : t('streak.tooltipGoalProgress', nativeLanguage, {
        done: progress.todayMinutes,
        goal: progress.dailyGoalMinutes,
        percent: progress.percent,
        remaining: progress.remainingMinutes
      });

  // SVG coordinate calculations for 36x36 viewBox
  const viewBoxSize = 36;
  const center = viewBoxSize / 2;
  // Radius accounts for half the stroke width to ensure strokes do not clip outside viewBox
  const radius = center - strokeWidth / 2 - 1.25;
  const { circumference, strokeDashoffset } = computeCircleProgressStroke(progress.percent, radius);

  // Dynamic flame sizing based on container size
  const defaultFlameClass =
    size >= 80
      ? 'w-12 h-12'
      : size >= 48
      ? 'w-6 h-6'
      : size >= 26
      ? 'w-3.5 h-3.5'
      : 'w-3 h-3';

  const flameClasses = flameSizeClass || defaultFlameClass;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 group/streak-icon ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={progress.percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={localizedAriaLabel}
      title={localizedTooltipText}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="transform -rotate-90 origin-center overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {/* Active progress ring gradient */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {progress.isGoalMet ? (
              <>
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="60%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#fbbf24" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="45%" stopColor="#fbbf24" />
                <stop offset="85%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ea580c" />
              </>
            )}
          </linearGradient>

          {/* Glow filter for completed goal */}
          {progress.isGoalMet && (
            <filter id={`${gradientId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>
          )}
        </defs>

        {/* Background track circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-slate-200 dark:stroke-[#293342]"
          stroke="currentColor"
          fill="none"
        />

        {/* Animated circular progress indicator ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          fill="none"
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {/* Centered Flame icon inside the circular progress ring */}
      {showFlame && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Flame
            className={`${flameClasses} transition-colors duration-200 ${
              progress.isGoalMet
                ? 'text-amber-500 dark:text-amber-300 fill-amber-400'
                : progress.percent > 0
                ? 'text-amber-500 dark:text-amber-400 fill-amber-500/40'
                : 'text-amber-600/80 dark:text-amber-500/70'
            } ${iconClassName}`}
          />
        </div>
      )}

      {/* Tiny completion badge when 100% daily goal is met */}
      {showCompletionBadge && progress.isGoalMet && size >= 22 && (
        <span
          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white dark:border-[#0D1117] flex items-center justify-center"
          title={t('streak.goalCompletedBadge', nativeLanguage)}
        >
          <Check className="w-1.5 h-1.5 text-white dark:text-[#0D1117] stroke-[3.5]" />
        </span>
      )}

      {/* Optional rich hover tooltip */}
      {showHoverTooltip && (
        <div
          role="tooltip"
          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 hidden group-hover/streak-icon:flex flex-col items-center pointer-events-none min-w-[160px] animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="bg-white dark:bg-[#1B2430] border border-slate-200 dark:border-[#293342] text-slate-900 dark:text-[#F0F2F5] rounded-lg py-2 px-3 shadow-lg dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.75)] text-[11px] leading-tight space-y-1 text-center whitespace-normal">
            <div className="flex items-center justify-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
              <Flame className="w-3.5 h-3.5 fill-amber-500 dark:fill-amber-400" />
              <span>
                {streakDays
                  ? t('streak.dayStreakLabel', nativeLanguage, { days: streakDays })
                  : t('streak.dailyStreakLabel', nativeLanguage)}
              </span>
            </div>
            <div className="text-slate-800 dark:text-[#F0F2F5] font-semibold font-mono tabular-nums">
              {progress.todayMinutes} / {progress.dailyGoalMinutes} {t('common.min', nativeLanguage)} ({progress.percent}%)
            </div>
            <p className="text-[10px] text-slate-600 dark:text-[#9BA6B2]">
              {progress.isGoalMet
                ? t('streak.goalReachedShort', nativeLanguage)
                : t('streak.minToGoal', nativeLanguage, { remaining: progress.remainingMinutes })}
            </p>
          </div>
          {/* Tooltip caret */}
          <div className="w-2 h-2 bg-white dark:bg-[#1B2430] border-l border-t border-slate-200 dark:border-[#293342] transform rotate-45 -mt-1" />
        </div>
      )}
    </div>
  );
};
