import React from 'react';
import { VideoReactionItem } from '../../services/roomSessionUtils';

interface VideoReactionOverlayProps {
  reactions: ReadonlyArray<VideoReactionItem>;
  testId: string;
  compact?: boolean;
}

const LEFT_POSITION_CLASSES: ReadonlyArray<{ threshold: number; className: string }> = [
  { threshold: 26, className: 'left-[20%]' },
  { threshold: 38, className: 'left-[32%]' },
  { threshold: 50, className: 'left-[44%]' },
  { threshold: 62, className: 'left-[56%]' },
  { threshold: 74, className: 'left-[68%]' },
  { threshold: 100, className: 'left-[80%]' }
];

function getLeftPositionClass(offsetPercent: number): string {
  const match = LEFT_POSITION_CLASSES.find((slot) => offsetPercent <= slot.threshold);
  return match ? match.className : 'left-[56%]';
}

export const VideoReactionOverlay: React.FC<VideoReactionOverlayProps> = ({
  reactions,
  testId,
  compact = false
}) => {
  return (
    <div
      data-testid={testId}
      aria-live="polite"
      className="absolute inset-0 overflow-hidden pointer-events-none z-30"
    >
      {reactions.map((rxn) => (
        <div
          key={rxn.id}
          data-testid="video-reaction-bubble"
          data-reaction-emoji={rxn.emoji}
          aria-label={`${rxn.senderName} reacted ${rxn.label}`}
          className={`absolute ${compact ? 'bottom-7' : 'bottom-11'} ${getLeftPositionClass(
            rxn.offsetPercent
          )} animate-lw-reaction-float flex flex-col items-center pointer-events-none select-none`}
        >
          <span
            className={`${
              compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl'
            } leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)]`}
          >
            {rxn.emoji}
          </span>
        </div>
      ))}
    </div>
  );
};
