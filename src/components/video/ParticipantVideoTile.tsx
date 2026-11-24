import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  Volume2,
  VolumeX,
  Smartphone,
  Laptop,
  Maximize2,
  Minimize2
} from 'lucide-react';
import {
  hasLiveEnabledVideoTrack,
  resolveRemoteTileStatusLabel,
  shouldPreferRelayImageOverlay,
  shouldShowLiveRemoteVideo,
  VideoReactionItem
} from '../../services/roomSessionUtils';
import { RemoteParticipant } from '../../services/webrtcManager';
import { VideoReactionOverlay } from './VideoReactionOverlay';

interface ParticipantVideoTileProps {
  participant: RemoteParticipant;
  isGlobalSpeakerMuted: boolean;
  isSpotlighted: boolean;
  onTogglePin: (peerId: string) => void;
  onAudioAutoplayBlocked: () => void;
  onAudioUnlocked: () => void;
  reactions?: ReadonlyArray<VideoReactionItem>;
  compact?: boolean;
}

export const ParticipantVideoTile: React.FC<ParticipantVideoTileProps> = ({
  participant,
  isGlobalSpeakerMuted,
  isSpotlighted,
  onTogglePin,
  onAudioAutoplayBlocked,
  onAudioUnlocked,
  reactions = [],
  compact = false
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasDecodedVideoFrames, setHasDecodedVideoFrames] = useState(false);
  const [isTileMuted, setIsTileMuted] = useState(false);

  const effectiveMuted = isGlobalSpeakerMuted || isTileMuted;
  const isSendingVideo = participant.isCameraActive || participant.isScreenSharing;
  const statusLabel = resolveRemoteTileStatusLabel(participant);

  useEffect(() => {
    if (!isSendingVideo) {
      setHasDecodedVideoFrames(false);
    }
  }, [isSendingVideo]);

  useEffect(() => {
    const stream = participant.stream;
    if (!stream) {
      setHasDecodedVideoFrames(false);
      if (videoRef.current) videoRef.current.srcObject = null;
      if (audioRef.current) audioRef.current.srcObject = null;
      return;
    }

    const vidEl = videoRef.current;
    let cleanupStreamListeners: (() => void) | undefined;

    if (vidEl) {
      const hasVideoTrack = hasLiveEnabledVideoTrack(stream.getVideoTracks());
      if (!hasVideoTrack || !isSendingVideo) {
        setHasDecodedVideoFrames(false);
      }

      if (vidEl.srcObject !== stream) {
        vidEl.srcObject = stream;
      }
      vidEl.muted = true;
      vidEl.play().catch(() => {});

      const checkDecoded = () => {
        if (!vidEl) return;
        if (vidEl.videoWidth > 0 && vidEl.videoHeight > 0 && vidEl.readyState >= 2) {
          setHasDecodedVideoFrames(true);
        }
      };
      checkDecoded();

      const handleTrackChange = () => {
        if (vidEl.srcObject === stream) {
          // Force media element pipeline re-evaluation when tracks are dynamically added
          vidEl.srcObject = stream;
        }
        vidEl.play().catch(() => {});
        checkDecoded();
      };

      stream.addEventListener('addtrack', handleTrackChange);
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(t => {
        t.addEventListener('unmute', handleTrackChange);
      });

      cleanupStreamListeners = () => {
        stream.removeEventListener('addtrack', handleTrackChange);
        videoTracks.forEach(t => {
          t.removeEventListener('unmute', handleTrackChange);
        });
      };
    }

    if (audioRef.current) {
      if (audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream;
      }
      audioRef.current.volume = 1.0;
      audioRef.current.muted = effectiveMuted;

      if (stream.getAudioTracks().length > 0 && !effectiveMuted) {
        audioRef.current
          .play()
          .then(() => {
            onAudioUnlocked();
          })
          .catch(() => {
            onAudioAutoplayBlocked();
          });
      }
    }

    return () => {
      cleanupStreamListeners?.();
    };
  }, [participant.stream, participant.streamVersion, isSendingVideo, effectiveMuted]);

  const hasRelayFrameUrl = Boolean(participant.relayFrameUrl);
  const showRelayImage = shouldPreferRelayImageOverlay({
    isSendingVideo,
    hasRelayFrameUrl,
    hasUnmutedP2PVideoFrames: Boolean(participant.hasLiveP2PVideo && hasDecodedVideoFrames)
  });
  const showLiveVideo = shouldShowLiveRemoteVideo(
    isSendingVideo,
    hasDecodedVideoFrames,
    hasRelayFrameUrl
  );

  return (
    <div
      data-testid="remote-video-tile"
      data-participant-name={participant.name}
      data-screen-sharing={participant.isScreenSharing ? 'true' : 'false'}
      className={`group relative rounded-xl overflow-hidden bg-[#161D27] border shadow-sm flex items-center justify-center transition-colors ${
        participant.isScreenSharing
          ? 'border-[#6485F5]'
          : participant.audioLevel > 12 && participant.isMicActive
            ? 'border-emerald-500/70'
            : 'border-[#293342]'
      } ${compact ? 'min-h-[110px]' : 'min-h-[140px]'} w-full h-full`}
    >
      {/* Independent Audio Playback for this Participant */}
      <audio
        ref={audioRef}
        data-testid="remote-audio-element"
        autoPlay
        playsInline
        className="hidden"
      />

      {/* Full-priority Video Element (uses object-contain when presenting screen so zero edges clip!) */}
      <video
        ref={videoRef}
        data-testid="remote-video-element"
        autoPlay
        playsInline
        muted
        onLoadedMetadata={(e) => {
          e.currentTarget.play().catch(() => {});
          if (e.currentTarget.videoWidth > 0 && e.currentTarget.readyState >= 2) {
            setHasDecodedVideoFrames(true);
          }
        }}
        onLoadedData={(e) => {
          e.currentTarget.play().catch(() => {});
          if (e.currentTarget.videoWidth > 0) setHasDecodedVideoFrames(true);
        }}
        onCanPlay={(e) => {
          e.currentTarget.play().catch(() => {});
          if (e.currentTarget.videoWidth > 0) setHasDecodedVideoFrames(true);
        }}
        onResize={(e) => {
          if (e.currentTarget.videoWidth > 0 && e.currentTarget.readyState >= 2) {
            setHasDecodedVideoFrames(true);
          }
        }}
        onPlaying={(e) => {
          if (e.currentTarget.videoWidth > 0) setHasDecodedVideoFrames(true);
        }}
        onTimeUpdate={(e) => {
          if (e.currentTarget.videoWidth > 0 && !hasDecodedVideoFrames) {
            setHasDecodedVideoFrames(true);
          }
        }}
        className={`absolute inset-0 w-full h-full z-0 ${
          participant.isScreenSharing ? 'object-contain bg-[#0D1117]' : 'object-cover'
        }`}
      />

      {/* Instant-decode Relay Video Layer (active when partner is on WebSocket relay before/instead of direct P2P video) */}
      {showRelayImage && participant.relayFrameUrl && (
        <img
          data-testid="remote-relay-video"
          src={participant.relayFrameUrl}
          alt={`${participant.name} live video`}
          className={`absolute inset-0 w-full h-full z-[1] ${
            participant.isScreenSharing ? 'object-contain bg-[#0D1117]' : 'object-cover'
          }`}
        />
      )}

      {/* Top Controls: Screen Share Indicator & Pin / Spotlight Button */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1.5 z-20 pointer-events-none">
        <div className="min-w-0">
          {participant.isScreenSharing && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-[#6485F5] text-white text-[10px] sm:text-[11px] font-medium shadow-sm max-w-full">
              <MonitorUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">{participant.name}&apos;s Screen</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 pointer-events-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => setIsTileMuted(prev => !prev)}
            className="p-1.5 rounded-lg bg-[#10151D]/92 hover:bg-[#232F3F] text-[#F0F2F5] border border-[#293342] cursor-pointer transition-colors"
            aria-label={isTileMuted ? `Unmute ${participant.name}` : `Mute ${participant.name}`}
            title={isTileMuted ? `Unmute ${participant.name}` : `Mute ${participant.name}`}
          >
            {effectiveMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onTogglePin(participant.peerId)}
            className="p-1.5 rounded-lg bg-[#10151D]/92 hover:bg-[#232F3F] text-[#F0F2F5] border border-[#293342] cursor-pointer transition-colors"
            aria-label={
              isSpotlighted
                ? `Exit spotlight for ${participant.name}`
                : `Spotlight ${participant.name}`
            }
            title={isSpotlighted ? 'Return to Grid' : 'Spotlight Tile'}
          >
            {isSpotlighted ? (
              <Minimize2 className="w-3.5 h-3.5 text-[#6485F5]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-[#F0F2F5]" />
            )}
          </button>
        </div>
      </div>

      {/* Avatar Fallback Card when Participant's Camera & Screen Share are Off or Still Buffering */}
      {!showLiveVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 sm:p-5 text-center bg-[#10151D] z-10">
          <div className="space-y-2 sm:space-y-3">
            <div
              className={`relative mx-auto ${
                compact ? 'w-12 h-12' : 'w-16 h-16 sm:w-20 sm:h-20'
              }`}
            >
              <div
                className="absolute inset-0 rounded-full bg-emerald-500/25 transition-transform duration-75"
                style={{
                  transform: `scale(${1 + (participant.audioLevel / 100) * 0.4})`,
                  opacity: participant.audioLevel > 4 ? 1 : 0.2
                }}
              />
              <img
                src={participant.avatarUrl}
                alt={participant.name}
                className="relative w-full h-full rounded-full object-cover ring-2 ring-emerald-500/40"
              />
            </div>

            <div>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#9BA6B2] mb-0.5">
                {participant.device === 'mobile' ? (
                  <Smartphone className="w-3 h-3 text-cyan-400" />
                ) : (
                  <Laptop className="w-3 h-3 text-[#6485F5]" />
                )}
                <span>Live</span>
              </div>
              <h4
                className={`font-semibold text-[#F0F2F5] truncate max-w-[180px] mx-auto ${
                  compact ? 'text-xs' : 'text-sm sm:text-base'
                }`}
              >
                {participant.name}
              </h4>
              {!compact && (
                <p className="text-[11px] text-[#9BA6B2]">
                  {statusLabel}
                </p>
              )}
            </div>

            {participant.isMicActive && !compact && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400">
                <Volume2 className="w-3.5 h-3.5" />
                <div className="w-20 h-1.5 bg-[#293342] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-75"
                    style={{ width: `${Math.max(10, participant.audioLevel)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Name & Media Status Bar */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none z-20 gap-1">
        <div className="flex items-center gap-1.5 bg-[#10151D]/92 px-2.5 py-1 rounded-lg border border-[#293342] min-w-0">
          <span className="font-medium text-[11px] sm:text-xs text-[#F0F2F5] truncate">
            {participant.name}
          </span>
          <span className="text-[10px] text-emerald-400 shrink-0">· Live</span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#10151D]/92 px-2 py-1 rounded-lg border border-[#293342] text-[10px]">
          {participant.isMicActive ? (
            <Mic className="w-3 h-3 text-emerald-400" />
          ) : (
            <MicOff className="w-3 h-3 text-[#9BA6B2]" />
          )}
          {participant.isScreenSharing ? (
            <MonitorUp className="w-3 h-3 text-[#6485F5]" />
          ) : participant.isCameraActive ? (
            <VideoIcon className="w-3 h-3 text-[#6485F5]" />
          ) : (
            <VideoOff className="w-3 h-3 text-[#9BA6B2]" />
          )}
        </div>
      </div>

      {/* Live Floating Emoji Reaction Overlay */}
      <VideoReactionOverlay
        reactions={reactions}
        testId="remote-reaction-overlay"
        compact={compact}
      />
    </div>
  );
};
