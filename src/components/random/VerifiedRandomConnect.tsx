import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import {
  CorrectionResult,
  LanguageInfo,
  LanguageRoom,
  UserProfile,
  VocabularyWord
} from '../../types';
import { SUPPORTED_LANGUAGES } from '../../data/mockData';
import { createInitialsAvatarDataUri } from '../../data/teacherData';
import {
  OnlineUser,
  RandomConnectMatchedEvent,
  realtimePresence
} from '../../services/realtimePresence';
import {
  RandomCallMode,
  VerifiedRandomCandidate,
  countOtherSearchingCandidates
} from '../../services/randomConnectLogic';
import { WebRTCRoom } from '../video/WebRTCRoom';
import { localizeLanguageName, t } from '../../services/uiLocalization';
import { BRAND_IMAGES } from '../../utils/brandAssets';

const RANDOM_SEARCH_TIMEOUT_MS = 5000;

interface VerifiedRandomConnectProps {
  userProfile: UserProfile;
  selectedLanguage: LanguageInfo;
  roomsList: LanguageRoom[];
  onSelectRoom: (room: LanguageRoom) => void;
  onSaveToVocabDeck: (item: Partial<VocabularyWord>) => void;
  onCorrectionReceived?: (correction: CorrectionResult) => void;
  onMatchStateChange?: (isActive: boolean) => void;
  onRequireVerification: () => void;
  onDirectCallVerifiedPeer: (peer: OnlineUser, mode: 'video' | 'audio') => void;
}

const VERIFIED_BANNER_IMAGE = BRAND_IMAGES.verifiedBanner;

export const VerifiedRandomConnect: React.FC<VerifiedRandomConnectProps> = ({
  userProfile,
  selectedLanguage,
  roomsList,
  onSelectRoom,
  onSaveToVocabDeck,
  onCorrectionReceived,
  onMatchStateChange,
  onRequireVerification,
  onDirectCallVerifiedPeer
}) => {
  const uiLang = userProfile.nativeLanguage || 'English';
  const [preferredMode, setPreferredMode] = useState<RandomCallMode>('video');
  const [preferredLanguage, setPreferredLanguage] = useState<string>('any');
  const [isSearching, setIsSearching] = useState(false);
  const [noPartnerAvailable, setNoPartnerAvailable] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [otherSearchingCount, setOtherSearchingCount] = useState(0);
  const [verifiedOnlinePeers, setVerifiedOnlinePeers] = useState<OnlineUser[]>([]);
  const [activeMatch, setActiveMatch] = useState<{
    matchId: string;
    room: LanguageRoom;
    partner: VerifiedRandomCandidate;
    resolvedCallMode: RandomCallMode;
  } | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [bannerImgError, setBannerImgError] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeMatchRef = useRef(activeMatch);
  activeMatchRef.current = activeMatch;
  const onMatchStateChangeRef = useRef(onMatchStateChange);
  onMatchStateChangeRef.current = onMatchStateChange;

  useEffect(() => {
    onMatchStateChangeRef.current?.(Boolean(activeMatch));
    return () => {
      onMatchStateChangeRef.current?.(false);
    };
  }, [Boolean(activeMatch)]);

  const isUserVerified = Boolean(userProfile.isVerified && userProfile.verifiedId);

  const refreshLobbyStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/random-connect/status');
      if (res.ok) {
        const data = await res.json();
        setQueueSize(Number(data.queueSize) || 0);
        const waitingList = Array.isArray(data.waitingCandidates) ? data.waitingCandidates : [];
        setOtherSearchingCount(
          countOtherSearchingCandidates(waitingList, userProfile.id, preferredLanguage)
        );
        if (Array.isArray(data.verifiedOnlineUsers)) {
          setVerifiedOnlinePeers(
            data.verifiedOnlineUsers.filter((u: OnlineUser) => u.id !== userProfile.id)
          );
        }
      }
    } catch {
      // Ignore transient poll hiccup
    }
  }, [userProfile.id, preferredLanguage]);

  useEffect(() => {
    refreshLobbyStatus();
    const interval = setInterval(refreshLobbyStatus, 8000);
    return () => clearInterval(interval);
  }, [refreshLobbyStatus]);

  useEffect(() => {
    realtimePresence.setRandomConnectCallbacks({
      onMatched: (event: RandomConnectMatchedEvent) => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
          searchTimeoutRef.current = null;
        }
        setIsSearching(false);
        setNoPartnerAvailable(false);
        setErrorBanner(null);
        setActiveMatch(event);
      },
      onStats: (stats) => {
        setQueueSize(stats.queueSize);
        if (Array.isArray(stats.waitingUserIds)) {
          setOtherSearchingCount(stats.waitingUserIds.filter((id) => id !== userProfile.id).length);
        }
        refreshLobbyStatus();
      },
      onRejected: (err) => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
          searchTimeoutRef.current = null;
        }
        setIsSearching(false);
        setNoPartnerAvailable(false);
        setErrorBanner(err);
      }
    });

    return () => {
      realtimePresence.setRandomConnectCallbacks({});
    };
  }, [refreshLobbyStatus, userProfile.id]);

  // Dual-channel match check while actively searching so race conditions never drop a match
  useEffect(() => {
    if (!isSearching || activeMatch) return;
    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/random-connect/poll/${encodeURIComponent(userProfile.id)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'matched' && data.room && data.partner) {
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
              searchTimeoutRef.current = null;
            }
            setIsSearching(false);
            setNoPartnerAvailable(false);
            setActiveMatch({
              matchId: data.matchId,
              room: data.room,
              partner: data.partner,
              resolvedCallMode: data.resolvedCallMode || preferredMode
            });
          } else if (typeof data.queueSize === 'number') {
            setQueueSize(data.queueSize);
          }
        }
      } catch {
        // Ignore
      }
    }, 1000);
    return () => clearInterval(pollTimer);
  }, [isSearching, activeMatch, userProfile.id, preferredMode]);

  // Cleanly leave waiting queue on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      realtimePresence.leaveRandomConnectQueue(userProfile.id);
    };
  }, [userProfile.id]);

  const handleStartRandomMatch = async (excludePartnerId?: string) => {
    setErrorBanner(null);
    setNoPartnerAvailable(false);
    if (!isUserVerified) {
      setErrorBanner('Verified ID required: Please complete your profile verification to join Random Connect.');
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    setIsSearching(true);
    const result = await realtimePresence.joinRandomConnectQueue({
      user: userProfile,
      preferredLanguage,
      preferredMode,
      excludePartnerId
    });

    if (result.status === 'rejected') {
      setIsSearching(false);
      setErrorBanner(result.error || 'Only verified users can join Random Connect.');
      return;
    }

    if (result.status === 'matched' && result.room && result.partner) {
      setIsSearching(false);
      setNoPartnerAvailable(false);
      setActiveMatch({
        matchId: result.matchId || `match_${Date.now()}`,
        room: result.room,
        partner: result.partner,
        resolvedCallMode: result.resolvedCallMode || preferredMode
      });
      return;
    }

    if (typeof result.queueSize === 'number') {
      setQueueSize(result.queueSize);
    }

    // Wait briefly in the real server queue for another real user who is also searching;
    // if nobody else is searching, leave the queue and show that no one is available.
    searchTimeoutRef.current = setTimeout(async () => {
      searchTimeoutRef.current = null;
      if (activeMatchRef.current) return;
      setIsSearching(false);
      setNoPartnerAvailable(true);
      await realtimePresence.leaveRandomConnectQueue(userProfile.id);
      refreshLobbyStatus();
    }, RANDOM_SEARCH_TIMEOUT_MS);
  };

  const handleCancelSearch = async () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    setIsSearching(false);
    setNoPartnerAvailable(false);
    await realtimePresence.leaveRandomConnectQueue(userProfile.id);
    refreshLobbyStatus();
  };

  const handleLeaveMatchedSession = async () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    setActiveMatch(null);
    setIsSearching(false);
    setNoPartnerAvailable(false);
    await realtimePresence.leaveRandomConnectQueue(userProfile.id);
    refreshLobbyStatus();
  };

  // When matched, mount the live WebRTC Room with Audio/Video + Screen Share + Personal Chat + Rematch Header
  if (activeMatch) {
    const partnerFallback = createInitialsAvatarDataUri(activeMatch.partner.name, '#059669');
    return (
      <div className="w-full max-w-full">
        {/* Verified Match Control Strip */}
        <div className="bg-white dark:bg-[#161D27] border-b border-slate-200 dark:border-[#293342] px-4 sm:px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={activeMatch.partner.avatarUrl || partnerFallback}
                alt={activeMatch.partner.name}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (e.currentTarget.src !== partnerFallback) {
                    e.currentTarget.src = partnerFallback;
                  }
                }}
                className="w-8 h-8 rounded-full object-cover border border-emerald-500/40 shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-[#F0F2F5] truncate">
                  <span>Connected with {activeMatch.partner.name}</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[11px]">
                    · {activeMatch.partner.verifiedId}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-[#9BA6B2] truncate">
                  Audio &amp; Video Call · Screen Share Enabled · Personal 1-on-1 Chat Active
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLeaveMatchedSession}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] text-slate-800 dark:text-[#F0F2F5] text-xs font-medium border border-slate-300 dark:border-[#293342] transition-colors cursor-pointer whitespace-nowrap"
              >
                {t('random.exitMatch', uiLang)}
              </button>
            </div>
          </div>
        </div>

        <WebRTCRoom
          key={activeMatch.room.id}
          currentRoom={activeMatch.room}
          roomsList={[activeMatch.room, ...roomsList]}
          onSelectRoom={onSelectRoom}
          selectedLanguage={selectedLanguage}
          userProfile={userProfile}
          onSaveToVocabDeck={onSaveToVocabDeck}
          onCorrectionReceived={onCorrectionReceived}
          initialChatOpen={false}
          compactViewportOffset={true}
          chatHeaderTitle={`Personal Chat · ${activeMatch.partner.name}`}
          autoStartMediaMode={
            activeMatch.resolvedCallMode === 'audio' ? 'audio-only' : 'video-and-audio'
          }
          onBackToRooms={handleLeaveMatchedSession}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6 w-full">
      {/* Editorial Hero Banner */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-[#293342] bg-[#161D27] min-h-[200px] flex items-end shadow-sm dark:shadow-none">
        {!bannerImgError ? (
          <img
            src={VERIFIED_BANNER_IMAGE}
            alt="Verified language partners talking over live video and sharing screens"
            referrerPolicy="no-referrer"
            onError={() => setBannerImgError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-35"
          />
        ) : (
          <div className="absolute inset-0 bg-[#161D27]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-[#0D1117]/85 to-transparent" />

        <div className="relative z-10 p-6 sm:p-8 w-full flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#F0F2F5] tracking-tight">
              {t('random.title', uiLang)}
            </h1>
          </div>
        </div>
      </div>

      {errorBanner && (
        <div
          role="alert"
          className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-300"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 dark:bg-rose-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          {!isUserVerified && (
            <button
              type="button"
              onClick={onRequireVerification}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer whitespace-nowrap transition-colors"
            >
              {t('random.verifyAccount', uiLang)}
            </button>
          )}
        </div>
      )}

      {/* Main Two-Column Matchmaking Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Instant Random Matchmaker Control Card */}
        <div className="lg:col-span-7 bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 sm:p-7 space-y-6 shadow-xs dark:shadow-none">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F0F2F5] tracking-tight">
                {t('random.startSession', uiLang)}
              </h2>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-mono font-semibold text-slate-900 dark:text-[#F0F2F5] tabular-nums">
                {verifiedOnlinePeers.length + (isUserVerified ? 1 : 0)}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-[#9BA6B2]">{t('random.verifiedOnline', uiLang)}</div>
            </div>
          </div>

          {/* Call Mode Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-[#F0F2F5]">
              {t('random.step1Mode', uiLang)}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isSearching}
                onClick={() => setPreferredMode('video')}
                className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                  preferredMode === 'video'
                    ? 'bg-indigo-50/70 dark:bg-[#1B2430] border-[#6485F5] text-slate-900 dark:text-[#F0F2F5]'
                    : 'bg-slate-50 dark:bg-[#10151D] border-slate-200 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5] hover:border-slate-300 dark:hover:border-[#293342]'
                }`}
              >
                <div className="font-semibold text-sm mb-1 text-slate-900 dark:text-[#F0F2F5]">
                  {t('random.videoAudio', uiLang)}
                </div>
                <p className="text-xs text-slate-600 dark:text-[#9BA6B2]">
                  {t('random.videoAudioSub', uiLang)}
                </p>
              </button>

              <button
                type="button"
                disabled={isSearching}
                onClick={() => setPreferredMode('audio')}
                className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                  preferredMode === 'audio'
                    ? 'bg-indigo-50/70 dark:bg-[#1B2430] border-[#6485F5] text-slate-900 dark:text-[#F0F2F5]'
                    : 'bg-slate-50 dark:bg-[#10151D] border-slate-200 dark:border-[#293342] text-slate-700 dark:text-[#F0F2F5] hover:border-slate-300 dark:hover:border-[#293342]'
                }`}
              >
                <div className="font-semibold text-sm mb-1 text-slate-900 dark:text-[#F0F2F5]">
                  {t('random.voiceScreen', uiLang)}
                </div>
                <p className="text-xs text-slate-600 dark:text-[#9BA6B2]">
                  {t('random.voiceScreenSub', uiLang)}
                </p>
              </button>
            </div>
          </div>

          {/* Language Filter */}
          <div className="space-y-2">
            <label htmlFor="random-lang-select" className="block text-xs font-medium text-slate-700 dark:text-[#F0F2F5]">
              {t('random.step2Lang', uiLang)}
            </label>
            <select
              id="random-lang-select"
              disabled={isSearching}
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] cursor-pointer"
            >
              <option value="any" className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">{t('random.anyLang', uiLang)}</option>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.name.toLowerCase()} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">
                  {localizeLanguageName(lang.name, uiLang)}
                </option>
              ))}
            </select>
          </div>

          {/* Included Capabilities Strip - Clean Minimalist Text */}
          <div className="grid grid-cols-3 gap-3 pt-1 text-xs text-slate-700 dark:text-[#F0F2F5]">
            <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-lg p-3 text-center">
              <span className="font-medium truncate block">{t('random.hdAudioVideo', uiLang)}</span>
            </div>
            <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-lg p-3 text-center">
              <span className="font-medium truncate block">{t('random.screenShare', uiLang)}</span>
            </div>
            <div className="bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] rounded-lg p-3 text-center">
              <span className="font-medium truncate block">{t('random.personalChat', uiLang)}</span>
            </div>
          </div>

          {/* Primary Matchmaking CTA */}
          {!isSearching ? (
            <div className="space-y-3">
              {noPartnerAvailable && (
                <div
                  role="status"
                  data-testid="random-no-partner-notice"
                  className="rounded-lg bg-amber-50 dark:bg-[#10151D] border border-amber-500/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      {t('random.noPartnerTitle', uiLang)}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-[#9BA6B2] leading-relaxed">
                      {t('random.noPartnerDesc', uiLang)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStartRandomMatch()}
                    className="px-3.5 py-2 rounded-lg bg-white dark:bg-[#1B2430] hover:bg-slate-100 dark:hover:bg-[#232F3F] text-slate-800 dark:text-[#F0F2F5] text-xs font-medium border border-slate-300 dark:border-[#293342] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {t('random.tryAgain', uiLang)}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleStartRandomMatch()}
                className="w-full py-3 px-6 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white font-semibold text-sm flex items-center justify-center border border-[#6485F5]/40 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>
                  {preferredMode === 'video'
                    ? t('random.findVideoCta', uiLang)
                    : t('random.findAudioCta', uiLang)}
                </span>
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-[#F0F2F5]">
                    {t('random.searching', uiLang)}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-[#9BA6B2]">
                    {t('random.searchingQueue', uiLang)} ({t('random.searchingCount', uiLang, { count: otherSearchingCount })})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelSearch}
                  className="px-3.5 py-2 rounded-lg bg-white dark:bg-[#1B2430] hover:bg-slate-100 dark:hover:bg-[#232F3F] text-slate-800 dark:text-[#F0F2F5] text-xs font-medium cursor-pointer whitespace-nowrap border border-slate-300 dark:border-[#293342] transition-colors"
                >
                  {t('random.cancelSearch', uiLang)}
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right: Active Verified Members Online Directory */}
        <div className="lg:col-span-5 bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl p-6 space-y-4 shadow-xs dark:shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-[#F0F2F5]">{t('random.membersOnline', uiLang)}</h3>
            </div>
            <button
              type="button"
              onClick={refreshLobbyStatus}
              aria-label={t('random.refresh', uiLang)}
              className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] transition-colors cursor-pointer"
            >
              {t('random.refresh', uiLang)}
            </button>
          </div>

          {verifiedOnlinePeers.length === 0 ? (
            <p data-testid="random-no-members-online" className="text-xs text-slate-600 dark:text-[#9BA6B2] py-4">
              {t('random.noMembersOnline', uiLang)}
            </p>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {verifiedOnlinePeers.map((peer) => {
                return (
                  <div
                    key={peer.id}
                    className="rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] p-3.5 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-[#293342] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-[#F0F2F5] truncate">{peer.name}</div>
                      <div className="text-[11px] text-slate-600 dark:text-[#9BA6B2] truncate">
                        {localizeLanguageName(peer.nativeLanguage, uiLang)} → {localizeLanguageName(peer.learningLanguage, uiLang)} · {peer.verifiedId || t('common.verified', uiLang)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onDirectCallVerifiedPeer(peer, 'audio')}
                        aria-label={`${t('random.voice', uiLang)} ${peer.name}`}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1B2430] hover:bg-slate-100 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] text-xs font-medium cursor-pointer transition-colors"
                      >
                        {t('random.voice', uiLang)}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDirectCallVerifiedPeer(peer, 'video')}
                        className="px-3 py-1.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] text-white text-xs font-semibold border border-[#6485F5]/40 cursor-pointer whitespace-nowrap transition-colors"
                      >
                        {t('random.callVideo', uiLang)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
