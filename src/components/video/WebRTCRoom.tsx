import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Sparkles,
  Send,
  Volume2,
  VolumeX,
  Copy,
  Check,
  MessageSquare,
  BookPlus,
  Lightbulb,
  Headphones,
  Users,
  UserPlus,
  ChevronDown,
  ChevronUp,
  X,
  ArrowLeft,
  SwitchCamera,
  Reply,
  CornerDownRight,
  LayoutGrid,
  Maximize,
  Maximize2,
  Minimize2,
  Presentation,
  RefreshCw,
  Smile
} from 'lucide-react';
import {
  ChatMessage,
  ChatReplyContext,
  CorrectionResult,
  LanguageInfo,
  LanguageRoom,
  MediaJoinMode,
  RoleplayScenario,
  UserProfile,
  VocabularyWord
} from '../../types';
import { WebRTCManager, WebRTCState } from '../../services/webrtcManager';
import { analyzeSentence } from '../../services/aiService';
import {
  buildRoomInviteUrl,
  computeFullscreenVideoGridClass,
  computeNextFullscreenControlsVisible,
  computeParticipantStageConfig,
  getSixDigitRoomCode,
  hasLiveEnabledVideoTrack,
  isRoomChatPanelVisible,
  mergeChatMessages,
  pruneExpiredVideoReactions,
  resolveInitialRoomChatState,
  resolveSpotlightTargetId,
  RoomMobileTab,
  ScrollLayoutPreference,
  upsertVideoReaction,
  VIDEO_REACTION_OPTIONS,
  VIDEO_REACTION_TTL_MS,
  VideoReactionItem
} from '../../services/roomSessionUtils';
import { LANGUAGE_ROOMS, ROLEPLAY_SCENARIOS } from '../../data/mockData';
import { ParticipantVideoTile } from './ParticipantVideoTile';
import { AddPeopleModal } from './AddPeopleModal';
import { VideoReactionOverlay } from './VideoReactionOverlay';
import {
  playIncomingMessageChime,
  readStoredAudioNotificationsEnabled
} from '../../services/audioNotificationService';

interface WebRTCRoomProps {
  currentRoom: LanguageRoom;
  roomsList?: LanguageRoom[];
  onSelectRoom: (room: LanguageRoom) => void;
  selectedLanguage: LanguageInfo;
  userProfile: UserProfile;
  onSaveToVocabDeck: (item: Partial<VocabularyWord>) => void;
  onCorrectionReceived?: (correction: CorrectionResult) => void;
  initialChatOpen?: boolean;
  autoStartMediaMode?: 'video-and-audio' | 'audio-only';
  onBackToRooms?: () => void;
  compactViewportOffset?: boolean;
  chatHeaderTitle?: string;
  audioNotificationsEnabled?: boolean;
}

export const WebRTCRoom: React.FC<WebRTCRoomProps> = ({
  currentRoom,
  roomsList = LANGUAGE_ROOMS,
  onSelectRoom,
  userProfile,
  onSaveToVocabDeck,
  onCorrectionReceived,
  initialChatOpen = false,
  autoStartMediaMode,
  onBackToRooms,
  compactViewportOffset = false,
  chatHeaderTitle,
  audioNotificationsEnabled
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const participantsScrollRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const videoStageFullscreenRef = useRef<HTMLDivElement | null>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenAudioMessageIdsRef = useRef<Set<string>>(new Set());
  const audioNotificationsEnabledRef = useRef<boolean | undefined>(audioNotificationsEnabled);
  audioNotificationsEnabledRef.current = audioNotificationsEnabled;

  const [mediaJoinMode, setMediaJoinMode] = useState<MediaJoinMode>('not-started');
  const [activeRoomMeta, setActiveRoomMeta] = useState<LanguageRoom>(currentRoom);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [showFullscreenControls, setShowFullscreenControls] = useState(false);
  const [dismissedCameraNotice, setDismissedCameraNotice] = useState(false);
  const [activeReactions, setActiveReactions] = useState<VideoReactionItem[]>([]);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [localPeerId, setLocalPeerId] = useState<string>(userProfile.id);

  const [webrtcState, setWebrtcState] = useState<WebRTCState>({
    hasMediaPermission: false,
    isCameraActive: false,
    isMicActive: false,
    isScreenSharing: false,
    screenShareMode: null,
    isVirtualCamera: false,
    cameraError: null,
    availableVideoDevices: [],
    selectedVideoDeviceId: null,
    facingMode: 'user',
    connectionStatus: 'disconnected',
    callDurationSeconds: 0,
    audioLevel: 0,
    remoteAudioLevel: 0,
    latencyMs: 22,
    resolution: 'Standby',
    signalingLogs: [],
    localStream: null,
    screenStream: null,
    remoteParticipants: [],
    remoteStream: null,
    remoteStreamVersion: 0,
    remoteUser: null,
    isPartnerTyping: false
  });

  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [showSignalingLogs, setShowSignalingLogs] = useState(false);
  const [showRoleplayModal, setShowRoleplayModal] = useState(false);
  const [activeScenario, setActiveScenario] = useState<RoleplayScenario | null>(ROLEPLAY_SCENARIOS[0]);
  const [showAiGuidance, setShowAiGuidance] = useState(false);
  const [showAddPeopleModal, setShowAddPeopleModal] = useState(false);

  // Multi-participant Spotlight / Scrollable Gallery view state
  const [manualPinId, setManualPinId] = useState<string | null>(null);
  const [forceGalleryMode, setForceGalleryMode] = useState<boolean>(false);
  const [scrollLayoutPref, setScrollLayoutPref] = useState<ScrollLayoutPreference>('vertical-feed');
  const [canScrollUp, setCanScrollUp] = useState<boolean>(false);
  const [canScrollDown, setCanScrollDown] = useState<boolean>(false);
  const [presentationNote, setPresentationNote] = useState<string>(currentRoom.currentTopic || '');

  // Chat collapsed by default on entry; only opens when explicitly requested by the user
  const initialChatState = resolveInitialRoomChatState(initialChatOpen);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(initialChatState.isChatOpen);
  const [mobileTab, setMobileTab] = useState<RoomMobileTab>(initialChatState.mobileTab);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const isChatVisible = isRoomChatPanelVisible(isChatOpen, mobileTab);
  const isChatVisibleRef = useRef<boolean>(isChatVisible);
  isChatVisibleRef.current = isChatVisible;

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatReplyContext | null>(null);
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [savedVocabIds, setSavedVocabIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setActiveRoomMeta(currentRoom);
    setPresentationNote(currentRoom.currentTopic || '');
  }, [currentRoom]);

  useEffect(() => {
    const nextChatState = resolveInitialRoomChatState(initialChatOpen);
    setIsChatOpen(nextChatState.isChatOpen);
    setMobileTab(nextChatState.mobileTab);
  }, [currentRoom.id, initialChatOpen]);

  const directRoomUrl =
    typeof window !== 'undefined'
      ? buildRoomInviteUrl(window.location.origin, activeRoomMeta.id)
      : '';

  // 1. Initialize Real-Time Multi-Party WebRTC & Signaling Manager for this Room
  useEffect(() => {
    setChatMessages([]);
    seenAudioMessageIdsRef.current.clear();
    setReplyingTo(null);
    setUnreadChatCount(0);
    setManualPinId(null);
    setForceGalleryMode(false);
    setActiveReactions([]);
    setIsReactionPickerOpen(false);

    const manager = new WebRTCManager(currentRoom.id, userProfile, currentRoom);
    webrtcManagerRef.current = manager;
    const myPeerId = manager.peerId;
    setLocalPeerId(myPeerId);

    manager.setOnStateChange((newState) => {
      setWebrtcState(prev => ({ ...prev, ...newState }));
    });

    manager.setOnRoomMeta((serverRoom) => {
      if (serverRoom && serverRoom.id === currentRoom.id) {
        setActiveRoomMeta(serverRoom);
      }
    });

    manager.setOnReaction((incomingReaction) => {
      setActiveReactions((prev) => upsertVideoReaction(prev, incomingReaction, Date.now()));
    });

    manager.setOnChatMessage((incomingMsg) => {
      const normalized = mergeChatMessages([], incomingMsg, userProfile.id, myPeerId)[0];
      setChatMessages(prev => mergeChatMessages(prev, incomingMsg, userProfile.id, myPeerId));

      if (!isChatVisibleRef.current && normalized && normalized.sender !== 'user') {
        setUnreadChatCount(c => c + 1);
      }

      if (normalized && !seenAudioMessageIdsRef.current.has(normalized.id)) {
        seenAudioMessageIdsRef.current.add(normalized.id);
        const enabled =
          audioNotificationsEnabledRef.current !== undefined
            ? audioNotificationsEnabledRef.current
            : readStoredAudioNotificationsEnabled();
        playIncomingMessageChime({
          enabled,
          isOwnMessage: normalized.sender === 'user'
        });
      }
    });

    manager.setOnChatHistory((history) => {
      if (Array.isArray(history)) {
        history.forEach((m) => {
          if (m?.id) seenAudioMessageIdsRef.current.add(m.id);
        });
      }
      setChatMessages(prev => mergeChatMessages(prev, history, userProfile.id, myPeerId));
    });

    // Fetch persistent room chat history via HTTP so late joiners see earlier group messages immediately
    fetch(`/api/rooms/${encodeURIComponent(currentRoom.id)}/messages`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.messages)) {
          data.messages.forEach((m: ChatMessage) => {
            if (m?.id) seenAudioMessageIdsRef.current.add(m.id);
          });
          setChatMessages(prev => mergeChatMessages(prev, data.messages, userProfile.id, myPeerId));
        }
      })
      .catch(() => {});

    // Auto-start media if entering from an accepted call or ?media=video URL query
    const urlMedia = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('media')
      : null;
    const desiredAutoMode =
      autoStartMediaMode ||
      (urlMedia === 'video' ? 'video-and-audio' : urlMedia === 'audio' ? 'audio-only' : undefined);

    if (desiredAutoMode) {
      setMediaJoinMode(desiredAutoMode);
      manager.startLocalMedia(desiredAutoMode).catch(err => {
        console.warn('Auto media start warning:', err);
      });
    } else {
      setMediaJoinMode('not-started');
    }

    return () => {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
      }
      manager.endCall();
      webrtcManagerRef.current = null;
    };
  }, [currentRoom.id, userProfile.id]);

  // Clear unread badge when chat is visible
  useEffect(() => {
    if (isChatVisible) {
      setUnreadChatCount(0);
    }
  }, [isChatVisible]);

  // Auto-scroll chat feed cleanly to bottom on new messages, typing, or viewport resize
  useEffect(() => {
    const listEl = chatListRef.current;
    if (!listEl) return;
    listEl.scrollTop = listEl.scrollHeight;

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        listEl.scrollTop = listEl.scrollHeight;
      });
      ro.observe(listEl);
      return () => ro.disconnect();
    }
  }, [chatMessages.length, webrtcState.isPartnerTyping, replyingTo, mobileTab]);

  const remoteParticipants = webrtcState.remoteParticipants || [];
  const totalParticipants = remoteParticipants.length + 1;
  const isAnyPeerConnected = remoteParticipants.length > 0;

  // Automatically exit forced gallery mode whenever a new screen share begins so everyone sees it immediately
  const activeScreenSharerKey = `${webrtcState.isScreenSharing ? 'local' : ''}|${remoteParticipants
    .filter(p => p.isScreenSharing)
    .map(p => p.peerId)
    .join(',')}`;

  useEffect(() => {
    if (activeScreenSharerKey !== '|') {
      setForceGalleryMode(false);
    }
  }, [activeScreenSharerKey]);

  const spotlightTargetId = resolveSpotlightTargetId(
    remoteParticipants,
    webrtcState.isScreenSharing,
    manualPinId,
    forceGalleryMode
  );

  const hasAnyScreenShare =
    webrtcState.isScreenSharing || remoteParticipants.some(p => p.isScreenSharing);

  const localVideoStream =
    webrtcState.isScreenSharing && webrtcState.screenStream
      ? webrtcState.screenStream
      : webrtcState.isCameraActive && webrtcState.localStream
        ? webrtcState.localStream
        : null;

  const showLocalVideoFeed =
    (webrtcState.isScreenSharing && Boolean(webrtcState.screenStream)) ||
    (webrtcState.isCameraActive && hasLiveEnabledVideoTrack(webrtcState.localStream?.getVideoTracks()));

  // Keep Local <video> synced across camera/screen transitions, Full Screen, and Spotlight <-> Grid switches
  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (!videoEl) return;

    if (localVideoStream) {
      if (videoEl.srcObject !== localVideoStream) {
        videoEl.srcObject = localVideoStream;
      }
      videoEl.muted = true;
      videoEl.play().catch(() => {});
    } else {
      videoEl.srcObject = null;
    }
  }, [localVideoStream, showLocalVideoFeed, spotlightTargetId, isAnyPeerConnected, isVideoFullscreen]);

  const handleUnlockAudio = useCallback(() => {
    webrtcManagerRef.current?.resumeAudioContext();
    if (typeof document !== 'undefined') {
      document
        .querySelectorAll<HTMLVideoElement>('video[data-testid="remote-video-element"]')
        .forEach(vid => {
          vid.muted = true;
          vid.play().catch(() => {});
        });
      document
        .querySelectorAll<HTMLAudioElement>('audio[data-testid="remote-audio-element"]')
        .forEach(aud => {
          if (!isSpeakerMuted) {
            aud.volume = 1.0;
            aud.play().catch(() => {});
          }
        });
    }
    setAutoplayBlocked(false);
  }, [isSpeakerMuted]);

  // Unlock all remote participant audio streams on first user interaction inside the room
  useEffect(() => {
    if (!autoplayBlocked) return;
    const unlockOnGesture = () => {
      handleUnlockAudio();
    };
    window.addEventListener('click', unlockOnGesture, { once: true });
    window.addEventListener('touchstart', unlockOnGesture, { once: true });
    window.addEventListener('keydown', unlockOnGesture, { once: true });
    return () => {
      window.removeEventListener('click', unlockOnGesture);
      window.removeEventListener('touchstart', unlockOnGesture);
      window.removeEventListener('keydown', unlockOnGesture);
    };
  }, [autoplayBlocked, handleUnlockAudio]);

  // Start Local Camera + Mic or Voice Only
  const handleStartMedia = async (mode: 'audio-only' | 'video-and-audio') => {
    handleUnlockAudio();
    setMediaJoinMode(mode);
    if (!webrtcManagerRef.current) return;

    try {
      await webrtcManagerRef.current.startLocalMedia(mode);
    } catch (err) {
      console.error('Error starting media:', err);
    }
  };

  const handleToggleMic = () => {
    handleUnlockAudio();
    if (!webrtcState.localStream) {
      handleStartMedia('audio-only');
    } else {
      webrtcManagerRef.current?.toggleMicrophone();
    }
  };

  const handleToggleCam = async () => {
    handleUnlockAudio();
    setDismissedCameraNotice(false);
    if (!webrtcManagerRef.current) return;

    try {
      const nextCamOn = await webrtcManagerRef.current.toggleCamera();
      setMediaJoinMode(nextCamOn ? 'video-and-audio' : webrtcState.isMicActive ? 'audio-only' : 'not-started');
    } catch (err) {
      console.error('Error toggling camera:', err);
    }
  };

  const handleRetryCamera = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    handleUnlockAudio();
    setDismissedCameraNotice(false);
    if (!webrtcManagerRef.current) return;
    setMediaJoinMode('video-and-audio');
    await webrtcManagerRef.current.retryPhysicalCamera();
  };

  const handleToggleSpeaker = () => {
    const nextMuted = !isSpeakerMuted;
    setIsSpeakerMuted(nextMuted);
    if (!nextMuted) {
      setTimeout(() => handleUnlockAudio(), 20);
    }
    setAutoplayBlocked(false);
  };

  // Trouble-free Screen Share from ANY mode (works before or after starting camera/mic!)
  const handleToggleScreenShare = async (forceBoard: boolean = false) => {
    handleUnlockAudio();
    if (!webrtcManagerRef.current) return;
    await webrtcManagerRef.current.toggleScreenShare(forceBoard);
  };

  const handlePresentationNoteChange = (nextNote: string) => {
    setPresentationNote(nextNote);
    webrtcManagerRef.current?.updatePresentationNote(nextNote);
  };

  useEffect(() => {
    if (activeReactions.length === 0) return;
    const now = Date.now();
    const nextExpiry = Math.min(...activeReactions.map((r) => r.expiresAt));
    const delay = Math.max(80, nextExpiry - now + 40);
    const timer = setTimeout(() => {
      setActiveReactions((prev) => pruneExpiredVideoReactions(prev, Date.now()));
    }, delay);
    return () => clearTimeout(timer);
  }, [activeReactions]);

  useEffect(() => {
    if (!isReactionPickerOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          '[data-testid="reaction-picker-popover"], [data-testid="reaction-picker-button"], [data-testid="fullscreen-reaction-popover"], [data-testid="fullscreen-reaction-button"]'
        )
      ) {
        return;
      }
      setIsReactionPickerOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsReactionPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isReactionPickerOpen]);

  const handleSendReaction = (emoji: string, label: string) => {
    handleUnlockAudio();
    const now = Date.now();
    if (webrtcManagerRef.current) {
      const created = webrtcManagerRef.current.sendVideoReaction(emoji, label);
      setActiveReactions((prev) => upsertVideoReaction(prev, created, now));
    } else {
      const fallbackId = `rxn_${now}_${Math.random().toString(36).substring(2, 8)}`;
      setActiveReactions((prev) =>
        upsertVideoReaction(
          prev,
          {
            id: fallbackId,
            emoji,
            label,
            senderId: localPeerId,
            senderName: userProfile.name || 'You',
            createdAt: now,
            expiresAt: now + VIDEO_REACTION_TTL_MS
          },
          now
        )
      );
    }
    setIsReactionPickerOpen(false);
  };

  const handleDisconnectMediaOnly = () => {
    webrtcManagerRef.current?.stopLocalMediaOnly();
    setMediaJoinMode('not-started');
  };

  const handleTogglePin = (targetId: string) => {
    if (spotlightTargetId === targetId) {
      setManualPinId(null);
      if (hasAnyScreenShare) {
        setForceGalleryMode(true);
      }
    } else {
      setForceGalleryMode(false);
      setManualPinId(targetId);
    }
  };

  // Call duration timer (runs whenever camera, mic, or screen share is active)
  const isAnyLocalMediaActive =
    webrtcState.isCameraActive || webrtcState.isMicActive || webrtcState.isScreenSharing;

  useEffect(() => {
    if (!isAnyLocalMediaActive) return;

    const interval = setInterval(() => {
      setWebrtcState(prev => ({
        ...prev,
        callDurationSeconds: prev.callDurationSeconds + 1
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isAnyLocalMediaActive]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Speech dictation into chat input (no window.alert)
  const handleStartSpeechRecognition = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechNotice('Voice dictation is not supported in this browser — type your message directly.');
      setTimeout(() => setSpeechNotice(null), 4000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang =
        activeRoomMeta.languageCode === 'de'
          ? 'de-DE'
          : activeRoomMeta.languageCode === 'es'
            ? 'es-ES'
            : activeRoomMeta.languageCode === 'fr'
              ? 'fr-FR'
              : activeRoomMeta.languageCode === 'it'
                ? 'it-IT'
                : activeRoomMeta.languageCode === 'ja'
                  ? 'ja-JP'
                  : 'en-US';
      recognition.continuous = false;

      recognition.onstart = () => setIsListeningSpeech(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => (prev ? `${prev} ${transcript}` : transcript));
      };
      recognition.onerror = () => setIsListeningSpeech(false);
      recognition.onend = () => setIsListeningSpeech(false);
      recognition.start();
    } catch {
      setIsListeningSpeech(false);
    }
  };

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (!webrtcManagerRef.current) return;

    webrtcManagerRef.current.sendTypingStatus(val.trim().length > 0);
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }
    if (val.trim().length > 0) {
      typingStopTimerRef.current = setTimeout(() => {
        webrtcManagerRef.current?.sendTypingStatus(false);
      }, 2200);
    }
  };

  const handleSelectReply = (msg: ChatMessage) => {
    setReplyingTo({
      id: msg.id,
      senderName: msg.sender === 'user' ? 'You' : msg.senderName,
      text: msg.text
    });
    setIsChatOpen(true);
    if (mobileTab === 'video') {
      setMobileTab('split');
    }
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 30);
  };

  // Send real-time chat message to ALL room participants + optional AI grammar hint for your own learning
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    handleUnlockAudio();

    const textToSend = inputText.trim();
    if (!textToSend) return;

    const myPeerId = webrtcManagerRef.current?.peerId || userProfile.id;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      senderId: myPeerId,
      senderName: userProfile.name || 'You',
      senderAvatar: userProfile.avatarUrl,
      text: textToSend,
      timestamp: timeStr,
      ...(replyingTo ? { replyTo: replyingTo } : {}),
      isAnalyzing: true
    };

    setChatMessages(prev => mergeChatMessages(prev, newMsg, userProfile.id, myPeerId));
    setInputText('');
    setReplyingTo(null);
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }
    webrtcManagerRef.current?.sendTypingStatus(false);

    // Deliver immediately to all participants over Mesh DataChannels + WebSocket + Server history
    webrtcManagerRef.current?.sendChatMessage({
      ...newMsg,
      isAnalyzing: false
    });

    try {
      const roomLangLevel =
        userProfile.targetLanguages?.find(
          (t) => t.language.toLowerCase() === activeRoomMeta.languageName.toLowerCase()
        )?.level ||
        userProfile.targetLanguages?.[0]?.level ||
        'B1';
      const correction = await analyzeSentence(
        textToSend,
        activeRoomMeta.languageName,
        roomLangLevel,
        userProfile.nativeLanguage || 'English'
      );
      onCorrectionReceived?.(correction);
      setChatMessages(prev =>
        prev.map(m => (m.id === userMsgId ? { ...m, isAnalyzing: false, correction } : m))
      );
    } catch {
      setChatMessages(prev =>
        prev.map(m => (m.id === userMsgId ? { ...m, isAnalyzing: false } : m))
      );
    }
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(directRoomUrl || window.location.href).catch(() => {});
    setCopiedRoom(true);
    setTimeout(() => setCopiedRoom(false), 2200);
  };

  const badgeRoomCode = getSixDigitRoomCode(activeRoomMeta.id);

  const copyRoomCodeOnly = () => {
    navigator.clipboard.writeText(badgeRoomCode).catch(() => {});
    setCopiedRoomCode(true);
    setTimeout(() => setCopiedRoomCode(false), 2200);
  };

  const activeTypers = remoteParticipants.filter(p => p.isTyping).map(p => p.name);
  const roomRosterSummary =
    remoteParticipants.length === 0
      ? '1 in Room · Waiting for Friends'
      : remoteParticipants.length === 1
        ? `2 in Room · ${remoteParticipants[0].name}`
        : `${totalParticipants} in Room · ${remoteParticipants
            .slice(0, 2)
            .map(p => p.name)
            .join(', ')}${remoteParticipants.length > 2 ? ` +${remoteParticipants.length - 2}` : ''}`;

  const renderLocalTile = (compact: boolean = false) => {
    const isLocalSpotlighted = spotlightTargetId === 'local';
    return (
      <div
        data-testid="local-video-tile"
        data-screen-sharing={webrtcState.isScreenSharing ? 'true' : 'false'}
        className={`group relative rounded-xl overflow-hidden bg-[#0E1422] border flex items-center justify-center transition-colors ${
          webrtcState.isScreenSharing
            ? 'border-[#5C6AE0]/70'
            : webrtcState.isMicActive && webrtcState.audioLevel > 12
              ? 'border-emerald-500/70'
              : 'border-[#1D263B]'
        } ${compact ? 'min-h-[110px]' : 'min-h-[140px]'} w-full h-full`}
      >
        <video
          ref={localVideoRef}
          data-testid="local-video-element"
          autoPlay
          playsInline
          muted
          onLoadedMetadata={(e) => {
            e.currentTarget.play().catch(() => {});
          }}
          onCanPlay={(e) => {
            e.currentTarget.play().catch(() => {});
          }}
          className={`w-full h-full transition-opacity duration-200 ${
            webrtcState.isScreenSharing
              ? 'object-contain bg-[#080B12]'
              : `object-cover ${
                  webrtcState.facingMode === 'user' && !webrtcState.isVirtualCamera
                    ? '-scale-x-100'
                    : ''
                }`
          } ${
            showLocalVideoFeed
              ? 'opacity-100 z-10'
              : 'opacity-0 absolute pointer-events-none'
          }`}
        />

        {/* Top Bar on Local Tile when Sharing Screen, Camera Fallback Notice, or Hovering */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2 z-20 pointer-events-none">
          <div className="flex flex-col items-start gap-1.5 min-w-0">
            {webrtcState.isScreenSharing && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#5C6AE0] text-white text-[11px] font-medium">
                <MonitorUp className="w-3.5 h-3.5" />
                <span>Your Shared Screen</span>
              </span>
            )}

            {!compact &&
              !dismissedCameraNotice &&
              (!isVideoFullscreen || showFullscreenControls) &&
              !webrtcState.isScreenSharing &&
              webrtcState.isCameraActive &&
              webrtcState.isVirtualCamera &&
              webrtcState.cameraError && (
                <div
                  data-testid="camera-fallback-notice"
                  onClick={(e) => e.stopPropagation()}
                  className={`pointer-events-auto flex flex-wrap items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#090E18]/92 border border-amber-500/40 text-[11px] text-amber-200 max-w-full shadow-lg ${
                    isVideoFullscreen ? 'mr-32' : ''
                  }`}
                >
                  <span className="leading-snug max-w-[300px] sm:max-w-[440px]" title={webrtcState.cameraError}>
                    {webrtcState.cameraError}
                  </span>
                  <button
                    type="button"
                    data-testid="retry-camera-button"
                    onClick={handleRetryCamera}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-[#080B12] font-semibold text-[10px] cursor-pointer shrink-0 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDismissedCameraNotice(true);
                    }}
                    className="p-0.5 rounded text-amber-300/80 hover:text-amber-100 cursor-pointer shrink-0"
                    aria-label="Dismiss camera notice"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
          </div>

          {isAnyPeerConnected && (
            <button
              type="button"
              onClick={() => handleTogglePin('local')}
              className="pointer-events-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg bg-[#090E18]/92 hover:bg-[#141C2E] text-[#C6CEE0] border border-[#283450] cursor-pointer transition-opacity shrink-0"
              aria-label={isLocalSpotlighted ? 'Exit spotlight for your tile' : 'Spotlight your tile'}
              title={isLocalSpotlighted ? 'Return to Grid' : 'Spotlight Your Tile'}
            >
              {isLocalSpotlighted ? (
                <Minimize2 className="w-3.5 h-3.5 text-[#8B97EE]" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-[#C6CEE0]" />
              )}
            </button>
          )}
        </div>

        {/* Center Fallback / Quick Start Controls when neither Local Camera nor Screen Share is active */}
        {!showLocalVideoFeed && (
          <div className="p-3 sm:p-5 text-center space-y-2.5 sm:space-y-3.5 max-w-sm z-20">
            {webrtcState.isMicActive ? (
              <>
                <div
                  className={`${
                    compact ? 'w-11 h-11' : 'w-14 h-14'
                  } mx-auto rounded-full bg-emerald-500/12 border-2 border-emerald-400/70 flex items-center justify-center text-emerald-400`}
                >
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-[#F1F4FA]">Your Microphone is Live</h4>
                  {!compact && <p className="text-[11px] text-[#8E99B2]">Camera is off</p>}
                </div>
                {!compact && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartMedia('video-and-audio')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5C6AE0] hover:bg-[#6A77E8] text-white text-xs font-semibold border border-[#6E7AE8]/40 cursor-pointer transition-colors"
                    >
                      <VideoIcon className="w-3.5 h-3.5" />
                      <span>Turn On Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleScreenShare(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141C2E] hover:bg-[#1B253B] border border-[#283450] text-[#C6CEE0] text-xs font-medium cursor-pointer transition-colors"
                    >
                      <MonitorUp className="w-3.5 h-3.5 text-[#8B97EE]" />
                      <span>Share Screen</span>
                    </button>
                  </div>
                )}
              </>
            ) : compact ? (
              <div className="space-y-1.5">
                <img
                  src={userProfile.avatarUrl}
                  alt={userProfile.name}
                  className="w-11 h-11 mx-auto rounded-full object-cover ring-2 ring-[#283450]"
                />
                <div className="text-xs font-medium text-[#F1F4FA] truncate max-w-[140px]">
                  You ({userProfile.name})
                </div>
              </div>
            ) : (
              <>
                <div className="hidden sm:flex w-10 h-10 mx-auto rounded-lg bg-[#5C6AE0]/12 border border-[#5C6AE0]/25 items-center justify-center text-[#8B97EE]">
                  <Headphones className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-semibold text-xs sm:text-base text-[#F1F4FA]">
                    Share Your Video, Voice or Screen
                  </h3>
                  <p className="hidden sm:block text-xs text-[#8E99B2]">
                    Start camera, voice, or screen sharing so everyone in the room can join in:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleStartMedia('video-and-audio')}
                    className="flex items-center sm:flex-col justify-center gap-1.5 p-2.5 rounded-lg bg-[#5C6AE0] hover:bg-[#6A77E8] text-white text-xs font-semibold border border-[#6E7AE8]/40 transition-colors cursor-pointer"
                    aria-label="Start Video and Audio"
                  >
                    <VideoIcon className="w-4 h-4" />
                    <span>Video &amp; Mic</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartMedia('audio-only')}
                    className="flex items-center sm:flex-col justify-center gap-1.5 p-2.5 rounded-lg bg-[#141C2E] hover:bg-[#1B253B] border border-[#283450] text-[#C6CEE0] text-xs font-medium transition-colors cursor-pointer"
                    aria-label="Start Voice Audio"
                  >
                    <Mic className="w-4 h-4 text-emerald-400" />
                    <span>Voice Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleScreenShare(false)}
                    className="flex items-center sm:flex-col justify-center gap-1.5 p-2.5 rounded-lg bg-[#141C2E] hover:bg-[#1B253B] border border-[#283450] text-[#C6CEE0] text-xs font-medium transition-colors cursor-pointer"
                    aria-label="Start Screen Share"
                  >
                    <MonitorUp className="w-4 h-4 text-[#8B97EE]" />
                    <span>Share Screen</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Bottom Local Status Bar */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none z-20 gap-1">
          <div className="flex items-center gap-1.5 bg-[#090E18]/92 px-2.5 py-1 rounded-md border border-[#1D263B] min-w-0">
            <span className="font-medium text-[11px] sm:text-xs text-[#F1F4FA] truncate">
              You ({userProfile.name})
            </span>
          </div>

          {isAnyLocalMediaActive && (
            <div className="flex items-center gap-1.5 bg-[#090E18]/92 px-2 py-1 rounded-md border border-[#1D263B]">
              {webrtcState.isMicActive ? (
                <Mic className="w-3 h-3 text-emerald-400" />
              ) : (
                <MicOff className="w-3 h-3 text-rose-400" />
              )}
              {webrtcState.isScreenSharing && <MonitorUp className="w-3 h-3 text-[#8B97EE]" />}
              <div className="w-9 h-1.5 bg-[#1D263B] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{
                    width: `${webrtcState.isMicActive ? Math.max(10, webrtcState.audioLevel) : 0}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Local Floating Emoji Reaction Overlay */}
        <VideoReactionOverlay
          reactions={activeReactions.filter(
            (r) => r.senderId === localPeerId || r.senderId === 'local'
          )}
          testId="local-reaction-overlay"
          compact={compact}
        />
      </div>
    );
  };

  // Spotlighted remote participant (if a remote friend is sharing their screen or pinned)
  const spotlightRemoteParticipant =
    spotlightTargetId && spotlightTargetId !== 'local'
      ? remoteParticipants.find(p => p.peerId === spotlightTargetId) || null
      : null;

  const isSpotlightLayoutActive =
    isAnyPeerConnected &&
    (spotlightTargetId === 'local' || Boolean(spotlightRemoteParticipant));

  const stageConfig = computeParticipantStageConfig(
    remoteParticipants.length === 0 ? 2 : totalParticipants,
    scrollLayoutPref
  );

  const updateParticipantsScrollIndicators = useCallback(() => {
    const el = participantsScrollRef.current;
    if (!el) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }
    setCanScrollUp(el.scrollTop > 8);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  }, []);

  useEffect(() => {
    updateParticipantsScrollIndicators();
    const el = participantsScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => updateParticipantsScrollIndicators());
    ro.observe(el);
    return () => ro.disconnect();
  }, [totalParticipants, scrollLayoutPref, isSpotlightLayoutActive, updateParticipantsScrollIndicators]);

  const scrollParticipantsBy = (deltaY: number) => {
    const el = participantsScrollRef.current;
    if (!el) return;
    el.scrollBy({ top: deltaY, behavior: 'smooth' });
    setTimeout(updateParticipantsScrollIndicators, 260);
  };

  const handleEnterVideoFullscreen = () => {
    setShowFullscreenControls(false);
    setIsVideoFullscreen(true);
    try {
      const el = videoStageFullscreenRef.current;
      if (el && typeof el.requestFullscreen === 'function' && !document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
      }
    } catch {
      // Fallback to CSS full-viewport mode when native Fullscreen API is unavailable
    }
  };

  const handleExitVideoFullscreen = useCallback(() => {
    setShowFullscreenControls(false);
    setIsVideoFullscreen(false);
    try {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    } catch {
      // Ignore exitFullscreen errors
    }
  }, []);

  const handleFullscreenStageTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isVideoFullscreen) return;
    const target = e.target as HTMLElement | null;
    const clickedInteractiveControl = Boolean(
      target?.closest(
        '[data-testid="fullscreen-controls-bar"], [data-testid="fullscreen-reaction-popover"], [data-testid="exit-fullscreen-button"], [data-testid="camera-fallback-notice"], button, input, select, a'
      )
    );
    if (!clickedInteractiveControl) {
      setIsReactionPickerOpen(false);
    }
    setShowFullscreenControls((prev) =>
      computeNextFullscreenControlsVisible({
        isVideoFullscreen,
        currentlyVisible: prev,
        clickedInteractiveControl
      })
    );
  };

  useEffect(() => {
    if (!isVideoFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExitVideoFullscreen();
      }
    };

    const handleFullscreenChange = () => {
      if (typeof document !== 'undefined' && !document.fullscreenElement) {
        setShowFullscreenControls(false);
        setIsVideoFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isVideoFullscreen, handleExitVideoFullscreen]);

  return (
    <div
      className={`${
        compactViewportOffset ? 'h-[calc(100vh-7.25rem)]' : 'h-[calc(100vh-4rem)]'
      } flex flex-col bg-slate-100 dark:bg-[#080B12] text-slate-800 dark:text-[#C6CEE0] overflow-hidden font-sans`}
    >
      {/* Autoplay Audio Permission Banner (only shown if browser initially pauses unmuted group audio) */}
      {!isVideoFullscreen && autoplayBlocked && isAnyPeerConnected && (
        <div className="bg-amber-500 text-[#080B12] px-4 py-2 flex items-center justify-between text-xs font-semibold z-50 shrink-0">
          <div className="flex items-center gap-2">
            <VolumeX className="w-4 h-4" />
            <span>Tap once to hear everyone&apos;s live voice audio clearly!</span>
          </div>
          <button
            type="button"
            onClick={handleUnlockAudio}
            className="px-3 py-1 rounded-md bg-[#080B12] text-amber-300 hover:bg-[#0E1422] transition-colors cursor-pointer text-xs font-semibold"
          >
            Enable Room Audio
          </button>
        </div>
      )}

      {/* 1. Top Room Control Bar */}
      {!isVideoFullscreen && (
        <div className="bg-white dark:bg-[#0E1422] border-b border-slate-200 dark:border-[#1D263B] px-2.5 sm:px-4 py-2 flex items-center justify-between text-xs shrink-0 gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1 overflow-hidden">
          {onBackToRooms && (
            <button
              type="button"
              onClick={onBackToRooms}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#141C2E] hover:bg-slate-200 dark:hover:bg-[#1B253B] text-slate-800 dark:text-[#C6CEE0] text-xs font-medium border border-slate-300 dark:border-[#1D263B] transition-colors cursor-pointer shrink-0"
              aria-label="Back to all chat rooms"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Rooms</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              data-testid="room-code-badge"
              onClick={copyRoomCodeOnly}
              title={`Copy room code (${badgeRoomCode})`}
              aria-label={`Copy room code ${badgeRoomCode}`}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#090E18] hover:bg-slate-200 dark:hover:bg-[#1B253B] border border-slate-300 dark:border-[#1D263B] text-[11px] font-mono font-semibold text-slate-800 dark:text-[#C6CEE0] transition-colors cursor-pointer shrink-0"
            >
              <span className="text-slate-500 dark:text-[#8E99B2] font-sans font-medium">Code:</span>
              <span>{badgeRoomCode}</span>
              {copiedRoomCode ? (
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-slate-500 dark:text-[#8E99B2]" />
              )}
            </button>
          </div>

          {/* Live Multi-Participant Room Roster Status */}
          <div
            data-testid="room-connection-badge"
            className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium shrink-0"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isAnyPeerConnected ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-amber-500 dark:bg-amber-400'
              }`}
            />
            <span className={isAnyPeerConnected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-[#C6CEE0]'}>
              {roomRosterSummary}
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isAnyLocalMediaActive && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-[#090E18] border border-slate-300 dark:border-[#1D263B] text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-semibold tabular-nums">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span>{formatDuration(webrtcState.callDurationSeconds)}</span>
            </div>
          )}

          {/* Gallery vs. Spotlight Switcher when 2+ people or screen share active */}
          {isAnyPeerConnected && (hasAnyScreenShare || manualPinId !== null) && (
            <div
              className="hidden sm:flex bg-slate-100 dark:bg-[#090E18] border border-slate-300 dark:border-[#1D263B] p-0.5 rounded-lg"
              role="group"
              aria-label="Stage layout mode"
            >
              <button
                type="button"
                onClick={() => {
                  setForceGalleryMode(false);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                  isSpotlightLayoutActive ? 'bg-[#5C6AE0] text-white' : 'text-slate-600 dark:text-[#8E99B2] hover:text-slate-900 dark:hover:text-[#F1F4FA]'
                }`}
              >
                <Maximize2 className="w-3 h-3" />
                <span>Spotlight</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualPinId(null);
                  setForceGalleryMode(true);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                  !isSpotlightLayoutActive ? 'bg-[#5C6AE0] text-white' : 'text-slate-600 dark:text-[#8E99B2] hover:text-slate-900 dark:hover:text-[#F1F4FA]'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span>Grid</span>
              </button>
            </div>
          )}

          {/* Mobile Layout Mode Switcher */}
          <div className="flex lg:hidden bg-slate-100 dark:bg-[#090E18] border border-slate-300 dark:border-[#1D263B] p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setMobileTab('split')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                mobileTab === 'split' ? 'bg-[#5C6AE0] text-white' : 'text-slate-600 dark:text-[#8E99B2]'
              }`}
            >
              Both
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileTab('video');
                setIsChatOpen(false);
              }}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                mobileTab === 'video' ? 'bg-[#5C6AE0] text-white' : 'text-slate-600 dark:text-[#8E99B2]'
              }`}
            >
              Video
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('chat')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors relative ${
                mobileTab === 'chat' ? 'bg-[#5C6AE0] text-white' : 'text-slate-600 dark:text-[#8E99B2]'
              }`}
            >
              Chat
              {unreadChatCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-0.5 right-0.5" />
              )}
            </button>
          </div>

          <button
            type="button"
            data-testid="add-people-button"
            onClick={() => setShowAddPeopleModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#5C6AE0] hover:bg-[#6A77E8] text-white text-xs font-semibold border border-[#6E7AE8]/40 transition-colors cursor-pointer"
            aria-label="Add People to Room"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add People</span>
            <span className="px-1.5 py-0.2 rounded bg-black/25 text-white text-[11px] font-mono tabular-nums">
              {totalParticipants}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors relative cursor-pointer ${
              isChatOpen
                ? 'bg-slate-200 dark:bg-[#1B253B] text-slate-900 dark:text-[#F1F4FA] border border-slate-300 dark:border-[#283450]'
                : 'bg-slate-100 dark:bg-[#141C2E] hover:bg-slate-200 dark:hover:bg-[#1B253B] text-slate-700 dark:text-[#C6CEE0] border border-slate-300 dark:border-[#1D263B]'
            }`}
            aria-label="Toggle Chat Sidebar"
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-[#8B97EE]" />
            <span>Chat</span>
            {unreadChatCount > 0 && !isChatOpen && (
              <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white text-[10px] font-semibold tabular-nums">
                {unreadChatCount}
              </span>
            )}
          </button>
        </div>
      </div>
      )}

      {/* 2. Main Split Workspace: Multi-Party Video/Screen Stage + Group Chat */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative min-h-0">
        {/* Video, Voice & Screen Share Stage */}
        <div
          ref={videoStageFullscreenRef}
          data-testid="video-stage-container"
          data-fullscreen={isVideoFullscreen ? 'true' : 'false'}
          data-fullscreen-controls={isVideoFullscreen && showFullscreenControls ? 'visible' : 'hidden'}
          onClick={handleFullscreenStageTap}
          className={
            isVideoFullscreen
              ? 'fixed inset-0 z-[100] w-screen h-screen bg-[#080B12] p-2 sm:p-4 flex flex-col justify-between overflow-hidden cursor-pointer select-none'
              : `p-2.5 sm:p-4 flex flex-col justify-between bg-slate-100 dark:bg-[#080B12] overflow-hidden min-h-0 ${
                  mobileTab === 'chat'
                    ? 'hidden lg:flex lg:flex-1'
                    : mobileTab === 'split'
                      ? 'flex h-[50%] lg:h-auto lg:flex-1'
                      : 'flex flex-1'
                }`
          }
        >
          {isVideoFullscreen && (
            <button
              type="button"
              data-testid="exit-fullscreen-button"
              onClick={(e) => {
                e.stopPropagation();
                handleExitVideoFullscreen();
              }}
              className="fixed top-3 right-3 z-[120] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#090E18]/90 hover:bg-[#141C2E] text-[#C6CEE0] border border-[#283450] text-xs font-medium backdrop-blur-sm transition-colors cursor-pointer shadow-lg"
              aria-label="Exit Full Screen Video"
              title="Exit Full Screen (Esc)"
            >
              <Minimize2 className="w-3.5 h-3.5 text-[#8B97EE]" />
              <span>Exit Full Screen</span>
            </button>
          )}

          {isVideoFullscreen && showFullscreenControls && isReactionPickerOpen && (
            <div
              data-testid="fullscreen-reaction-popover"
              role="menu"
              aria-label="Send a video reaction"
              onClick={(e) => e.stopPropagation()}
              className="fixed bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-[125] flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-2xl bg-[#090E18]/95 border border-[#283450] shadow-2xl backdrop-blur-md"
            >
              {VIDEO_REACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.emoji}
                  type="button"
                  data-testid={`fullscreen-reaction-option-${opt.label.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendReaction(opt.emoji, opt.label);
                  }}
                  aria-label={`React with ${opt.label}`}
                  title={opt.label}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-xl sm:text-2xl hover:bg-[#1B253B] hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                >
                  <span aria-hidden="true">{opt.emoji}</span>
                </button>
              ))}
            </div>
          )}

          {isVideoFullscreen && showFullscreenControls && (
            <div
              data-testid="fullscreen-controls-bar"
              onClick={(e) => e.stopPropagation()}
              className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[120] max-w-[calc(100vw-1rem)] flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3.5 py-2 sm:py-2.5 rounded-2xl bg-[#090E18]/92 border border-[#283450] shadow-2xl backdrop-blur-md"
              role="toolbar"
              aria-label="Full screen call controls"
            >
              <button
                type="button"
                data-testid="fullscreen-mic-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleMic();
                }}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  webrtcState.isMicActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-[#141C2E] hover:bg-[#1B253B] text-[#C6CEE0] border border-[#1D263B]'
                }`}
                aria-label="Toggle Microphone"
              >
                {webrtcState.isMicActive ? (
                  <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                ) : (
                  <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
                )}
                <span>{webrtcState.isMicActive ? 'Mic' : 'Mic Off'}</span>
              </button>

              <button
                type="button"
                data-testid="fullscreen-camera-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleCam();
                }}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  webrtcState.isCameraActive
                    ? 'bg-[#5C6AE0] text-white border border-[#6E7AE8]/50'
                    : 'bg-[#141C2E] hover:bg-[#1B253B] text-[#C6CEE0] border border-[#1D263B]'
                }`}
                aria-label="Toggle Camera"
              >
                {webrtcState.isCameraActive ? (
                  <VideoIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                ) : (
                  <VideoOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
                )}
                <span className="sm:hidden">{webrtcState.isCameraActive ? 'Cam On' : 'Cam Off'}</span>
                <span className="hidden sm:inline">{webrtcState.isCameraActive ? 'Camera On' : 'Camera Off'}</span>
              </button>

              <button
                type="button"
                data-testid="fullscreen-screenshare-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleScreenShare(false);
                }}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  webrtcState.isScreenSharing
                    ? 'bg-[#5C6AE0] text-white border border-[#6E7AE8]/50'
                    : 'bg-[#141C2E] hover:bg-[#1B253B] text-[#C6CEE0] border border-[#1D263B]'
                }`}
                aria-label={webrtcState.isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
              >
                {webrtcState.isScreenSharing ? (
                  <MonitorX className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                ) : (
                  <MonitorUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8B97EE] shrink-0" />
                )}
                <span className="sm:hidden">{webrtcState.isScreenSharing ? 'Stop' : 'Screen'}</span>
                <span className="hidden sm:inline">{webrtcState.isScreenSharing ? 'Stop Share' : 'Screen Share'}</span>
              </button>

              <button
                type="button"
                data-testid="fullscreen-volume-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleSpeaker();
                }}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  !isSpeakerMuted
                    ? 'bg-[#141C2E] hover:bg-[#1B253B] text-emerald-300 border border-[#1D263B]'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
                aria-label={isSpeakerMuted ? 'Unmute Volume' : 'Mute Volume'}
              >
                {isSpeakerMuted ? (
                  <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                )}
                <span>{isSpeakerMuted ? 'Muted' : 'Volume'}</span>
              </button>

              <button
                type="button"
                data-testid="fullscreen-reaction-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsReactionPickerOpen((prev) => !prev);
                }}
                aria-expanded={isReactionPickerOpen}
                aria-label="Send video reaction"
                title="Send Emoji Reaction"
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isReactionPickerOpen
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                    : 'bg-[#141C2E] hover:bg-[#1B253B] text-[#C6CEE0] border border-[#1D263B]'
                }`}
              >
                <Smile className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">React</span>
              </button>
            </div>
          )}
          {/* Conference Stage: Auto-Spotlight Screen Share OR Responsive Multi-Person Grid */}
          {isSpotlightLayoutActive ? (
            <div
              data-testid="spotlight-conference-stage"
              className="flex-1 flex flex-col xl:flex-row gap-2.5 sm:gap-3.5 min-h-0 overflow-hidden"
            >
              {/* Primary Spotlighted Tile (Shared Screen or Pinned Participant) */}
              <div className="flex-1 min-h-0 min-w-0">
                {spotlightTargetId === 'local'
                  ? renderLocalTile(false)
                  : spotlightRemoteParticipant && (
                      <ParticipantVideoTile
                        key={spotlightRemoteParticipant.peerId}
                        participant={spotlightRemoteParticipant}
                        isGlobalSpeakerMuted={isSpeakerMuted}
                        isSpotlighted={true}
                        onTogglePin={handleTogglePin}
                        onAudioAutoplayBlocked={() => setAutoplayBlocked(true)}
                        onAudioUnlocked={() => setAutoplayBlocked(false)}
                        reactions={activeReactions.filter(
                          (r) => r.senderId === spotlightRemoteParticipant.peerId
                        )}
                        compact={false}
                      />
                    )}
              </div>

              {/* Filmstrip of All Other Room Participants (keeps everyone's video & voice active!) */}
              <div className="flex xl:flex-col gap-2.5 overflow-x-auto xl:overflow-y-auto xl:w-64 shrink-0 h-28 sm:h-36 xl:h-full">
                {spotlightTargetId !== 'local' && (
                  <div className="w-44 sm:w-52 xl:w-full xl:h-44 shrink-0 h-full">
                    {renderLocalTile(true)}
                  </div>
                )}

                {remoteParticipants
                  .filter(p => p.peerId !== spotlightTargetId)
                  .map(participant => (
                    <div
                      key={participant.peerId}
                      className="w-44 sm:w-52 xl:w-full xl:h-44 shrink-0 h-full"
                    >
                      <ParticipantVideoTile
                        participant={participant}
                        isGlobalSpeakerMuted={isSpeakerMuted}
                        isSpotlighted={false}
                        onTogglePin={handleTogglePin}
                        onAudioAutoplayBlocked={() => setAutoplayBlocked(true)}
                        onAudioUnlocked={() => setAutoplayBlocked(false)}
                        reactions={activeReactions.filter(
                          (r) => r.senderId === participant.peerId
                        )}
                        compact={true}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 gap-2">
              {/* Multi-Person (>2) Scroll Navigation Bar */}
              {!isVideoFullscreen && stageConfig.isScrollableMultiRoom && (
                <div
                  data-testid="multi-person-scroll-toolbar"
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] text-xs shrink-0"
                >
                  <div className="flex items-center gap-2 text-slate-700 dark:text-[#C6CEE0]">
                    <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-[#8B97EE] shrink-0" />
                    <span className="font-semibold text-slate-900 dark:text-[#F1F4FA] tabular-nums">
                      {totalParticipants} People in Room
                    </span>
                    <span className="text-slate-400 dark:text-[#64708A] hidden sm:inline">·</span>
                    <span className="text-slate-600 dark:text-[#8E99B2] hidden sm:inline">
                      Scroll down &amp; up to view everyone
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div
                      className="flex items-center bg-slate-100 dark:bg-[#090E18] p-0.5 rounded-md border border-slate-300 dark:border-[#1D263B]"
                      role="group"
                      aria-label="Scrollable room layout"
                    >
                      <button
                        type="button"
                        onClick={() => setScrollLayoutPref('vertical-feed')}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          scrollLayoutPref === 'vertical-feed'
                            ? 'bg-[#5C6AE0] text-white'
                            : 'text-slate-600 dark:text-[#8E99B2] hover:text-slate-900 dark:hover:text-[#F1F4FA]'
                        }`}
                      >
                        Vertical Stack
                      </button>
                      <button
                        type="button"
                        onClick={() => setScrollLayoutPref('two-column-scroll')}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          scrollLayoutPref === 'two-column-scroll'
                            ? 'bg-[#5C6AE0] text-white'
                            : 'text-slate-600 dark:text-[#8E99B2] hover:text-slate-900 dark:hover:text-[#F1F4FA]'
                        }`}
                      >
                        2-Col Scroll
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => scrollParticipantsBy(-290)}
                      disabled={!canScrollUp}
                      aria-label="Scroll participants up"
                      title="Scroll up"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-[#141C2E] hover:bg-slate-200 dark:hover:bg-[#1B253B] disabled:opacity-40 text-slate-800 dark:text-[#C6CEE0] border border-slate-300 dark:border-[#283450] text-[11px] font-medium cursor-pointer whitespace-nowrap"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Up</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => scrollParticipantsBy(290)}
                      disabled={!canScrollDown}
                      aria-label="Scroll participants down"
                      title="Scroll down"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-[#141C2E] hover:bg-slate-200 dark:hover:bg-[#1B253B] disabled:opacity-40 text-slate-800 dark:text-[#C6CEE0] border border-slate-300 dark:border-[#283450] text-[11px] font-medium cursor-pointer whitespace-nowrap"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Down</span>
                    </button>
                  </div>
                </div>
              )}

              <div
                ref={participantsScrollRef}
                onScroll={updateParticipantsScrollIndicators}
                data-testid={
                  isVideoFullscreen
                    ? 'fullscreen-video-grid'
                    : stageConfig.isScrollableMultiRoom
                      ? 'scrollable-participants-container'
                      : 'gallery-conference-grid'
                }
                data-scrollable-multi-room={!isVideoFullscreen && stageConfig.isScrollableMultiRoom ? 'true' : 'false'}
                className={`flex-1 grid ${
                  isVideoFullscreen
                    ? computeFullscreenVideoGridClass(remoteParticipants.length)
                    : stageConfig.gridClass
                } ${
                  !isVideoFullscreen && stageConfig.isScrollableMultiRoom
                    ? 'auto-rows-max pr-1 scroll-smooth'
                    : 'auto-rows-fr'
                } gap-3 sm:gap-4 min-h-0 overflow-y-auto`}
              >
                {/* Render EVERY Connected Remote Participant Tile */}
                {remoteParticipants.length > 0 ? (
                  remoteParticipants.map(participant => (
                    <div
                      key={participant.peerId}
                      className={isVideoFullscreen ? 'min-h-[180px] h-full' : stageConfig.tileWrapperClass}
                    >
                      <ParticipantVideoTile
                        participant={participant}
                        isGlobalSpeakerMuted={isSpeakerMuted}
                        isSpotlighted={false}
                        onTogglePin={handleTogglePin}
                        onAudioAutoplayBlocked={() => setAutoplayBlocked(true)}
                        onAudioUnlocked={() => setAutoplayBlocked(false)}
                        reactions={activeReactions.filter(
                          (r) => r.senderId === participant.peerId
                        )}
                        compact={false}
                      />
                    </div>
                  ))
                ) : !isVideoFullscreen ? (
                  /* Empty Waiting Card when You Are First in the Room */
                  <div
                    data-testid="empty-room-invite-tile"
                    className="relative rounded-xl overflow-hidden bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] shadow-xs dark:shadow-none flex flex-col items-center justify-center p-4 sm:p-6 text-center min-h-[180px] h-full"
                  >
                    <div className="space-y-3 max-w-xs">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 mx-auto rounded-lg bg-[#5C6AE0]/12 border border-[#5C6AE0]/25 flex items-center justify-center text-indigo-600 dark:text-[#8B97EE]">
                        <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-base font-semibold text-slate-900 dark:text-[#F1F4FA]">
                          Add Friends to Personal Room
                        </h4>
                        <p className="hidden sm:block text-xs text-slate-600 dark:text-[#8E99B2] mt-1 leading-relaxed">
                          When more than 2 people join, scroll down and up effortlessly to see everyone&apos;s live video and voice.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={copyRoomLink}
                          className="w-full sm:w-auto px-3 py-2 rounded-lg bg-[#5C6AE0] hover:bg-[#6A77E8] text-white text-xs font-semibold border border-[#6E7AE8]/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          {copiedRoom ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedRoom ? 'Link Copied!' : 'Copy Room Link'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowAddPeopleModal(true)}
                          className="w-full sm:w-auto px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#141C2E] hover:bg-slate-200 dark:hover:bg-[#1B253B] border border-slate-300 dark:border-[#283450] text-slate-800 dark:text-[#C6CEE0] text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-[#8B97EE]" />
                          <span>Invite Online</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Your Local Tile */}
                <div className={isVideoFullscreen ? 'min-h-[180px] h-full' : stageConfig.tileWrapperClass}>
                  {renderLocalTile(false)}
                </div>
              </div>
            </div>
          )}

          {/* Active Presenter Banner + Editable Live Presentation Board Notes when You Are Sharing Screen */}
          {!isVideoFullscreen && webrtcState.isScreenSharing && (
            <div
              data-testid="active-screen-share-banner"
              className="mt-2.5 bg-[#5C6AE0]/12 border border-[#5C6AE0]/35 px-3 py-2 rounded-lg flex flex-wrap items-center justify-between gap-2 shrink-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Presentation className="w-4 h-4 text-indigo-600 dark:text-[#8B97EE] shrink-0" />
                <span className="text-xs font-medium text-slate-800 dark:text-[#C6CEE0] truncate">
                  {webrtcState.screenShareMode === 'presentation-board'
                    ? 'Sharing Live Presentation Screen with Room'
                    : 'You are sharing your screen live'}
                </span>
              </div>

              {webrtcState.screenShareMode === 'presentation-board' && (
                <div className="flex-1 min-w-[200px] max-w-md">
                  <input
                    type="text"
                    aria-label="Shared screen note"
                    value={presentationNote}
                    onChange={(e) => handlePresentationNoteChange(e.target.value)}
                    placeholder="Type live topic or notes onto your shared screen..."
                    className="w-full bg-white dark:bg-[#090E18] border border-slate-300 dark:border-[#1D263B] rounded-md px-2.5 py-1 text-xs text-slate-900 dark:text-[#F1F4FA] placeholder-slate-400 dark:placeholder-[#64708A] focus:outline-none focus:border-[#5C6AE0]"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => handleToggleScreenShare(false)}
                className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
              >
                <MonitorX className="w-3.5 h-3.5" />
                <span>Stop Sharing</span>
              </button>
            </div>
          )}

          {/* Bottom Media Control Bar (Screen Share + Mic + Camera + Reactions + Full Screen Always Accessible!) */}
          {!isVideoFullscreen && (
            <div className="relative mt-2.5 shrink-0">
              {isReactionPickerOpen && (
                <div
                  data-testid="reaction-picker-popover"
                  role="menu"
                  aria-label="Send a video reaction"
                  className="absolute bottom-full left-2 sm:left-4 mb-2 z-[60] flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-2xl bg-white dark:bg-[#141C2E] border border-slate-200 dark:border-[#283450] shadow-xl"
                >
                  {VIDEO_REACTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.emoji}
                      type="button"
                      data-testid={`reaction-option-${opt.label.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => handleSendReaction(opt.emoji, opt.label)}
                      aria-label={`React with ${opt.label}`}
                      title={opt.label}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-xl sm:text-2xl hover:bg-slate-100 dark:hover:bg-[#1B253B] hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                    >
                      <span aria-hidden="true">{opt.emoji}</span>
                    </button>
                  ))}
                </div>
              )}
          <div className="flex items-center justify-between bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] px-2.5 sm:px-4 py-2 rounded-xl gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handleToggleMic}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  webrtcState.isMicActive
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-100 dark:bg-[#141C2E] text-slate-700 dark:text-[#C6CEE0] hover:text-slate-900 dark:hover:text-[#F1F4FA] border border-slate-300 dark:border-[#1D263B]'
                }`}
                aria-label="Toggle Microphone"
              >
                {webrtcState.isMicActive ? (
                  <Mic className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <MicOff className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                )}
                <span className="hidden sm:inline">
                  {webrtcState.isMicActive ? 'Mic On' : 'Start Mic'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleCam}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  webrtcState.isCameraActive
                    ? 'bg-[#5C6AE0] text-white border border-[#6E7AE8]/40'
                    : 'bg-slate-100 dark:bg-[#141C2E] text-slate-700 dark:text-[#C6CEE0] hover:text-slate-900 dark:hover:text-[#F1F4FA] border border-slate-300 dark:border-[#1D263B]'
                }`}
                aria-label="Toggle Camera"
              >
                {webrtcState.isCameraActive ? (
                  <VideoIcon className="w-4 h-4" />
                ) : (
                  <VideoOff className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                )}
                <span className="hidden sm:inline">
                  {webrtcState.isCameraActive ? 'Camera On' : 'Start Video'}
                </span>
              </button>

              {/* Always-Accessible Screen Share Button on Mobile & Desktop */}
              <button
                type="button"
                data-testid="screen-share-button"
                onClick={() => handleToggleScreenShare(false)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  webrtcState.isScreenSharing
                    ? 'bg-[#5C6AE0] text-white border border-[#6E7AE8]/40'
                    : 'bg-slate-100 dark:bg-[#141C2E] text-slate-800 dark:text-[#C6CEE0] hover:text-slate-900 dark:hover:text-[#F1F4FA] border border-slate-300 dark:border-[#1D263B]'
                }`}
                aria-label={webrtcState.isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
                title={webrtcState.isScreenSharing ? 'Stop Sharing Screen' : 'Share Your Screen'}
              >
                {webrtcState.isScreenSharing ? (
                  <MonitorX className="w-4 h-4" />
                ) : (
                  <MonitorUp className="w-4 h-4 text-indigo-600 dark:text-[#8B97EE]" />
                )}
                <span className="hidden sm:inline">
                  {webrtcState.isScreenSharing ? 'Stop Share' : 'Share Screen'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleSpeaker}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  !isSpeakerMuted
                    ? 'bg-slate-100 dark:bg-[#141C2E] text-emerald-700 dark:text-emerald-400 border border-slate-300 dark:border-[#1D263B]'
                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                }`}
                aria-label={isSpeakerMuted ? 'Unmute Room Audio' : 'Mute Room Audio'}
                title={isSpeakerMuted ? 'Unmute Speaker' : 'Speaker Active'}
              >
                {isSpeakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span className="hidden xl:inline">{isSpeakerMuted ? 'Muted' : 'Speaker'}</span>
              </button>

              <button
                type="button"
                data-testid="reaction-picker-button"
                onClick={() => setIsReactionPickerOpen((prev) => !prev)}
                aria-expanded={isReactionPickerOpen}
                aria-label="Send video reaction"
                title="Send Emoji Reaction"
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  isReactionPickerOpen
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                    : 'bg-slate-100 dark:bg-[#141C2E] text-slate-800 dark:text-[#C6CEE0] hover:text-slate-900 dark:hover:text-[#F1F4FA] border border-slate-300 dark:border-[#1D263B]'
                }`}
              >
                <Smile className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">React</span>
              </button>

              <button
                type="button"
                data-testid="video-fullscreen-button"
                onClick={handleEnterVideoFullscreen}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#141C2E] text-slate-800 dark:text-[#C6CEE0] hover:text-slate-900 dark:hover:text-[#F1F4FA] border border-slate-300 dark:border-[#1D263B] transition-colors cursor-pointer"
                aria-label="Enter Full Screen Video"
                title="Full Screen Video Mode"
              >
                <Maximize className="w-4 h-4 text-indigo-600 dark:text-[#8B97EE]" />
                <span className="hidden sm:inline">Full Screen</span>
              </button>

              {webrtcState.isCameraActive && (
                <button
                  type="button"
                  onClick={() => webrtcManagerRef.current?.switchCamera()}
                  className="p-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#141C2E] border border-slate-300 dark:border-[#1D263B] text-slate-700 dark:text-[#C6CEE0] hover:text-slate-900 dark:hover:text-[#F1F4FA] transition-colors cursor-pointer flex items-center gap-1"
                  aria-label="Flip camera"
                  title="Flip Front / Rear Camera"
                >
                  <SwitchCamera className="w-4 h-4 text-indigo-600 dark:text-[#8B97EE]" />
                </button>
              )}
            </div>

            {isAnyLocalMediaActive && (
              <button
                type="button"
                onClick={handleDisconnectMediaOnly}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0"
                aria-label="Stop Camera, Mic and Screen Share"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Stop Media</span>
              </button>
            )}
          </div>
            </div>
          )}

          {!isVideoFullscreen && showAiGuidance && (
            <div className="mt-2 p-2.5 bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#1D263B] rounded-xl text-xs text-slate-700 dark:text-[#C6CEE0] flex items-start justify-between gap-2.5 shrink-0">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-[#F1F4FA]">Topic: {activeRoomMeta.currentTopic}</strong>
                  <p className="text-slate-600 dark:text-[#8E99B2] text-[11px]">
                    Group chat messages sync live across everyone in the room, and AI grammar tips appear privately beneath your own messages.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRoleplayModal(true)}
                className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#141C2E] hover:bg-slate-200 dark:hover:bg-[#1B253B] border border-slate-300 dark:border-[#1D263B] text-amber-700 dark:text-amber-300 font-medium text-[11px] shrink-0 cursor-pointer"
              >
                Scenarios
              </button>
            </div>
          )}

          {!isVideoFullscreen && showSignalingLogs && (
            <div className="mt-2 bg-slate-50 dark:bg-[#090E18] border border-slate-200 dark:border-[#1D263B] rounded-xl p-3 font-mono text-[11px] text-slate-700 dark:text-[#C6CEE0] max-h-32 overflow-y-auto shrink-0">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200 dark:border-[#1D263B] text-emerald-700 dark:text-emerald-400 font-semibold">
                <span>
                  WebRTC Mesh Diagnostics ({webrtcState.connectionStatus} · {remoteParticipants.length} remote peers)
                </span>
                <button
                  type="button"
                  onClick={() => setShowSignalingLogs(false)}
                  className="text-slate-600 dark:text-[#8E99B2] hover:text-slate-900 dark:hover:text-[#F1F4FA] cursor-pointer"
                >
                  Close
                </button>
              </div>
              {webrtcState.signalingLogs.map((log, idx) => (
                <div key={idx} className="text-slate-600 dark:text-[#8E99B2]">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Live Multi-Participant Room Chat & Instant Reply Sidebar */}
        {!isVideoFullscreen && isChatVisible && (
          <div
            data-testid="room-chat-panel"
            className={`w-full lg:w-[380px] xl:w-[410px] border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-[#1D263B] bg-white dark:bg-[#0E1422] flex flex-col z-20 min-h-0 ${
              mobileTab === 'video'
                ? 'hidden lg:flex lg:h-full'
                : mobileTab === 'split'
                  ? 'flex h-[50%] lg:h-full'
                  : 'flex flex-1 lg:h-full'
            }`}
          >
            {/* Chat Header */}
            <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-[#1D263B] flex items-center justify-between bg-slate-50 dark:bg-[#090E18] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-[#8B97EE] shrink-0" />
                <span className="font-semibold text-xs text-slate-900 dark:text-[#F1F4FA] truncate">
                  {chatHeaderTitle || `Group Chat (${totalParticipants} in Room)`}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  {isAnyPeerConnected ? 'Live Sync' : 'Ready'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsChatOpen(false);
                    if (mobileTab !== 'video') setMobileTab('video');
                  }}
                  className="hidden lg:inline-flex p-1 rounded-md text-slate-500 dark:text-[#8E99B2] hover:text-slate-900 dark:hover:text-[#F1F4FA] hover:bg-slate-200 dark:hover:bg-[#141C2E] transition-colors cursor-pointer"
                  aria-label="Hide Chat Sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Feed */}
            <div
              ref={chatListRef}
              data-testid="chat-messages-list"
              className="flex-1 p-3 overflow-y-auto overflow-x-hidden space-y-3 flex flex-col min-h-0"
            >
              {chatMessages.length === 0 ? (
                <div className="my-auto flex flex-col items-center justify-center text-center p-4 text-slate-600 dark:text-[#8E99B2] space-y-2.5">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-[#141C2E] border border-slate-200 dark:border-[#1D263B] flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-[#8B97EE]" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-[#C6CEE0]">
                      {isAnyPeerConnected
                        ? `Say hi to everyone in ${activeRoomMeta.title}!`
                        : 'Group room chat is live & ready'}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-[#8E99B2] max-w-[250px] leading-relaxed">
                      Messages and threaded replies sync across all connected participants immediately.
                    </p>
                  </div>
                </div>
              ) : (
                chatMessages.map(msg => {
                  const isMine = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-500 dark:text-[#64708A]">
                        <span className="font-medium text-slate-700 dark:text-[#C6CEE0]">
                          {isMine ? `You (${userProfile.name})` : msg.senderName}
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">{msg.timestamp}</span>
                        <button
                          type="button"
                          onClick={() => handleSelectReply(msg)}
                          className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#141C2E] hover:bg-[#5C6AE0] text-slate-700 dark:text-[#C6CEE0] hover:text-white border border-slate-300 dark:border-[#1D263B] text-[10px] font-medium transition-colors cursor-pointer"
                          aria-label={`Reply to ${msg.senderName}`}
                        >
                          <Reply className="w-2.5 h-2.5" />
                          <span>Reply</span>
                        </button>
                      </div>

                      <div
                        className={`p-3 rounded-xl max-w-[90%] text-xs leading-relaxed ${
                          isMine
                            ? 'bg-[#5C6AE0] text-white rounded-tr-sm'
                            : 'bg-slate-100 dark:bg-[#141C2E] border border-slate-200 dark:border-[#1D263B] text-slate-800 dark:text-[#C6CEE0] rounded-tl-sm'
                        }`}
                      >
                        {/* Quoted Reply Context (clean hairline border, zero thick left border-l-2) */}
                        {msg.replyTo && (
                          <div
                            className={`mb-2 px-2.5 py-1.5 rounded-md border text-[11px] ${
                              isMine
                                ? 'bg-black/20 border-white/20 text-white/90'
                                : 'bg-white dark:bg-[#090E18] border-slate-200 dark:border-[#1D263B] text-slate-700 dark:text-[#C6CEE0]'
                            }`}
                          >
                            <div className="font-semibold text-[10px] flex items-center gap-1 opacity-90">
                              <CornerDownRight className="w-2.5 h-2.5" />
                              <span>{msg.replyTo.senderName}</span>
                            </div>
                            <p className="truncate opacity-85">{msg.replyTo.text}</p>
                          </div>
                        )}

                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                      </div>

                      {/* Subtle AI Grammar Coaching under your own messages */}
                      {isMine && msg.correction && (msg.correction.hasErrors || msg.correction.betterWords.length > 0) && (
                        <div className="mt-1.5 w-[90%] space-y-1.5">
                          {msg.correction.mistakes.slice(0, 1).map((m, idx) => (
                            <div
                              key={idx}
                              className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-2 text-[11px]"
                            >
                              <div className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                <span>Better phrasing: &ldquo;{m.suggestion}&rdquo;</span>
                              </div>
                              <p className="text-slate-700 dark:text-[#C6CEE0] text-[10px] mt-0.5 leading-relaxed">
                                {m.explanation}
                              </p>
                            </div>
                          ))}

                          {msg.correction.betterWords.slice(0, 1).map((bw, idx) => (
                            <div
                              key={idx}
                              className="bg-[#5C6AE0]/10 border border-[#5C6AE0]/25 rounded-lg p-2 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="text-[10px] text-indigo-700 dark:text-[#9D94EB] font-semibold">
                                  Native Upgrade: <span className="text-emerald-700 dark:text-emerald-300">{bw.betterWord}</span>
                                </div>
                                <div className="text-[10px] text-slate-600 dark:text-[#8E99B2] truncate">{bw.whyBetter}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  onSaveToVocabDeck({
                                    word: bw.betterWord,
                                    translation: bw.whyBetter,
                                    language: activeRoomMeta.languageName,
                                    cefrLevel: 'B2',
                                    contextSentence: bw.exampleSentence
                                  });
                                  setSavedVocabIds(prev => new Set(prev).add(`${msg.id}_${idx}`));
                                }}
                                className={`px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                                  savedVocabIds.has(`${msg.id}_${idx}`)
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-white dark:bg-[#141C2E] hover:bg-slate-100 dark:hover:bg-[#1B253B] border border-slate-300 dark:border-[#1D263B] text-slate-800 dark:text-[#C6CEE0]'
                                }`}
                              >
                                {savedVocabIds.has(`${msg.id}_${idx}`) ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    <span>Saved</span>
                                  </>
                                ) : (
                                  <>
                                    <BookPlus className="w-3 h-3 text-indigo-600 dark:text-[#8B97EE]" />
                                    <span>Save</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Multi-Person Typing Indicator */}
              {activeTypers.length > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium px-1">
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-bounce [animation-delay:120ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-bounce [animation-delay:240ms]" />
                  </span>
                  <span>
                    {activeTypers.join(', ')} {activeTypers.length === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input & Reply Composer */}
            <form
              onSubmit={handleSendMessage}
              className="p-2.5 sm:p-3 border-t border-slate-200 dark:border-[#1D263B] bg-slate-50 dark:bg-[#090E18] space-y-2 shrink-0"
            >
              {speechNotice && (
                <div className="px-2.5 py-1.5 rounded-md bg-amber-500/12 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-[11px]">
                  {speechNotice}
                </div>
              )}

              {/* Active Reply Banner */}
              {replyingTo && (
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#5C6AE0]/12 border border-[#5C6AE0]/25 text-xs">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-indigo-700 dark:text-[#9D94EB] flex items-center gap-1">
                      <Reply className="w-3 h-3" />
                      <span>Replying to {replyingTo.senderName}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-[#C6CEE0] truncate">{replyingTo.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="p-1 rounded-md text-slate-500 dark:text-[#8E99B2] hover:text-slate-900 dark:hover:text-[#F1F4FA] cursor-pointer shrink-0"
                    aria-label="Cancel reply"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Quick Starter Phrases */}
              {chatMessages.length === 0 && (
                <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[10px] text-slate-600 dark:text-[#8E99B2]">
                  <span className="text-slate-500 dark:text-[#64708A] font-semibold whitespace-nowrap">Quick say:</span>
                  {activeRoomMeta.suggestedPhrases.map((phrase, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setInputText(phrase);
                        chatInputRef.current?.focus();
                      }}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-[#141C2E] hover:bg-slate-100 dark:hover:bg-[#1B253B] border border-slate-300 dark:border-[#1D263B] text-slate-700 dark:text-[#C6CEE0] whitespace-nowrap cursor-pointer"
                    >
                      &ldquo;{phrase}&rdquo;
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5 bg-white dark:bg-[#0E1422] border border-slate-300 dark:border-[#1D263B] rounded-lg p-1.5 focus-within:border-[#5C6AE0] transition-colors">
                <input
                  ref={chatInputRef}
                  type="text"
                  aria-label="Chat message input"
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={
                    replyingTo
                      ? `Reply to ${replyingTo.senderName}...`
                      : `Message group (${totalParticipants} in room)...`
                  }
                  className="flex-1 bg-transparent px-2 text-xs text-slate-900 dark:text-[#F1F4FA] placeholder-slate-400 dark:placeholder-[#64708A] focus:outline-none min-w-0"
                />

                <button
                  type="button"
                  onClick={handleStartSpeechRecognition}
                  className={`p-2 rounded-md transition-colors cursor-pointer shrink-0 ${
                    isListeningSpeech
                      ? 'bg-rose-500/20 text-rose-500 dark:text-rose-400 animate-pulse'
                      : 'text-slate-500 dark:text-[#8E99B2] hover:text-slate-900 dark:hover:text-[#F1F4FA]'
                  }`}
                  title="Dictate with voice"
                  aria-label="Speech to Text"
                >
                  <Mic className="w-4 h-4" />
                </button>

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="px-3 py-1.5 rounded-md bg-[#5C6AE0] hover:bg-[#6A77E8] disabled:opacity-40 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  aria-label="Send Message"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Add Multiple People to Room Modal */}
      <AddPeopleModal
        isOpen={showAddPeopleModal}
        onClose={() => setShowAddPeopleModal(false)}
        roomId={activeRoomMeta.id}
        roomTitle={activeRoomMeta.title}
        directRoomUrl={directRoomUrl}
        currentUserId={userProfile.id}
        connectedParticipants={remoteParticipants}
      />

      {/* Roleplay Scenario Selector Modal */}
      {showRoleplayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-[#05070D]/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-[#283450] rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1D263B]">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="font-semibold text-sm text-slate-900 dark:text-[#F1F4FA]">Select Practice Scenario</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRoleplayModal(false)}
                className="text-slate-600 dark:text-[#8E99B2] hover:text-slate-900 dark:hover:text-[#F1F4FA] text-xs cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 max-h-80 overflow-y-auto">
              {ROLEPLAY_SCENARIOS.map(scen => (
                <button
                  type="button"
                  key={scen.id}
                  onClick={() => {
                    setActiveScenario(scen);
                    setShowRoleplayModal(false);
                  }}
                  className={`text-left p-3 rounded-lg border cursor-pointer transition-colors ${
                    activeScenario?.id === scen.id
                      ? 'bg-[#5C6AE0]/15 border-[#5C6AE0] text-slate-900 dark:text-[#F1F4FA]'
                      : 'bg-slate-50 dark:bg-[#090E18] border-slate-200 dark:border-[#1D263B] hover:border-slate-300 dark:hover:border-[#283450] text-slate-700 dark:text-[#C6CEE0]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs">{scen.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-[#141C2E] border border-slate-200 dark:border-[#1D263B] font-mono text-indigo-700 dark:text-[#8B97EE]">
                      {scen.language} · {scen.level}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-[#8E99B2]">{scen.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
