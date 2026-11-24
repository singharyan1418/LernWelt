import { ChatMessage, LanguageInfo, LanguageRoom } from '../types';

const memorySessionStore = new Map<string, string>();

/**
 * Generates a collision-free unique user ID so multiple friends or demo logins
 * never share the same user ID on the signaling server.
 */
export function generateUniqueUserId(prefix: string = 'usr'): string {
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}

/**
 * Generates or retrieves a per-tab unique WebRTC peer ID.
 * Ensures that even two browser tabs sharing the same localStorage user profile
 * have distinct signaling identities and can connect to each other cleanly.
 */
export function getOrCreateTabPeerId(userId: string): string {
  const cleanUser = userId || 'anon';
  const storageKey = `lernwelt_tab_peer_id_${cleanUser}`;

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const existing = window.sessionStorage.getItem(storageKey);
      if (existing) return existing;
      const created = `${cleanUser}__${Math.random().toString(36).substring(2, 8)}`;
      window.sessionStorage.setItem(storageKey, created);
      return created;
    }
  } catch {
    // Fallback to in-memory store if sessionStorage is restricted
  }

  const existingMem = memorySessionStore.get(storageKey);
  if (existingMem) return existingMem;
  const created = `${cleanUser}__${Math.random().toString(36).substring(2, 8)}`;
  memorySessionStore.set(storageKey, created);
  return created;
}

/**
 * Deterministic WebRTC Perfect Negotiation polite/impolite role selector.
 * Exactly one peer in any pair evaluates to true (polite) and the other to false (impolite),
 * preventing SDP offer glare deadlocks when both friends start video simultaneously.
 */
export function isPolitePeer(localPeerId: string, remotePeerId: string): boolean {
  if (!remotePeerId || localPeerId === remotePeerId) return true;
  return localPeerId.localeCompare(remotePeerId) < 0;
}

/**
 * Normalizes a chat message for a specific viewer so messages authored by the viewer
 * always align as 'user' and messages authored by a friend align as 'partner'.
 */
export function normalizeChatMessage(
  msg: ChatMessage,
  viewerUserId: string,
  viewerPeerId?: string
): ChatMessage {
  if (msg.sender === 'ai-coach') {
    return msg;
  }

  const isOwnByPeer = Boolean(viewerPeerId && msg.senderId && msg.senderId === viewerPeerId);
  const isOwnByUser = Boolean(
    !viewerPeerId &&
      viewerUserId &&
      msg.senderId &&
      (msg.senderId === viewerUserId || msg.senderId.startsWith(`${viewerUserId}__`))
  );
  const isOwnFallback = !msg.senderId && msg.sender === 'user';

  const isMine = isOwnByPeer || isOwnByUser || isOwnFallback;

  return {
    ...msg,
    sender: isMine ? 'user' : 'partner'
  };
}

/**
 * Idempotently merges incoming chat messages (from DataChannel, WebSocket, or HTTP history)
 * without duplicating messages or wiping local AI grammar analysis results.
 */
export function mergeChatMessages(
  existing: ChatMessage[],
  incoming: ChatMessage | ChatMessage[],
  viewerUserId: string,
  viewerPeerId?: string
): ChatMessage[] {
  const incomingList = Array.isArray(incoming) ? incoming : [incoming];
  if (incomingList.length === 0) return existing;

  const byId = new Map<string, ChatMessage>();
  for (const item of existing) {
    byId.set(item.id, normalizeChatMessage(item, viewerUserId, viewerPeerId));
  }

  for (const raw of incomingList) {
    if (!raw || !raw.id) continue;
    const normalized = normalizeChatMessage(raw, viewerUserId, viewerPeerId);
    const prev = byId.get(normalized.id);
    if (prev) {
      byId.set(normalized.id, {
        ...prev,
        ...normalized,
        // Preserve local grammar correction if already computed on sender's client
        correction: normalized.correction ?? prev.correction,
        isAnalyzing: normalized.correction ? false : (prev.isAnalyzing ?? normalized.isAnalyzing)
      });
    } else {
      byId.set(normalized.id, normalized);
    }
  }

  return Array.from(byId.values());
}

/**
 * Builds a clean, direct room invitation URL for sharing with a friend.
 */
export function buildRoomInviteUrl(origin: string, roomId: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `${cleanOrigin}/?room=${encodeURIComponent(roomId)}&tab=chat-room`;
}

import { INITIAL_PERSONAL_TEACHERS, createInitialsAvatarDataUri } from '../data/teacherData';

/**
 * Resolves any room ID (built-in, Personal Teacher classroom, or ad-hoc custom invite room code)
 * into a complete LanguageRoom object so invited friends and students always enter the right room.
 */
export function resolveRoomFromId(
  roomId: string,
  roomsList: LanguageRoom[],
  fallbackLanguage: LanguageInfo
): LanguageRoom {
  const cleanId = roomId.trim();
  const found = roomsList.find(r => r.id.toLowerCase() === cleanId.toLowerCase());
  if (found) return found;

  if (cleanId.toLowerCase().startsWith('teacher-room-')) {
    const teacherKey = cleanId.replace(/^teacher-room-/i, '').toLowerCase();
    const matchedTeacher = INITIAL_PERSONAL_TEACHERS.find(
      t => t.id.toLowerCase() === teacherKey
    );
    if (matchedTeacher) {
      return {
        id: cleanId,
        languageCode: matchedTeacher.languageCode,
        languageName: matchedTeacher.languageName,
        flag: matchedTeacher.flag,
        title: `1-on-1 Lesson: ${matchedTeacher.name}`,
        subtitle: `1-on-1 Personal Teacher Classroom · ${matchedTeacher.credentials}`,
        currentTopic: matchedTeacher.lessonFocus,
        levelRange: matchedTeacher.cefrRange,
        activeLearnersCount: 1,
        activeNativesCount: 1,
        welcomeMessage: `Welcome to your 1-on-1 classroom with ${matchedTeacher.name}! Start camera, voice, screen share, or live chat anytime.`,
        suggestedPhrases: [
          `Hello ${matchedTeacher.name}, ready for our 1-on-1 lesson!`,
          'Could you help me refine my grammar and pronunciation today?'
        ],
        host: {
          id: matchedTeacher.id,
          name: matchedTeacher.name,
          avatarUrl: matchedTeacher.avatarUrl,
          country: matchedTeacher.country,
          countryCode: matchedTeacher.flag,
          nativeLanguage: matchedTeacher.languageName,
          learningLanguage: matchedTeacher.alsoSpeaks[0] || 'English',
          learningLevel: 'C2',
          rating: matchedTeacher.rating,
          reviewCount: Math.max(12, Math.round(matchedTeacher.lessonsCompleted / 5)),
          sessionsCompleted: matchedTeacher.lessonsCompleted,
          isOnline: true,
          interests: matchedTeacher.specialties,
          bio: matchedTeacher.bio,
          availability: 'Available Now',
          verifiedNative: true
        }
      };
    }
  }

  const shortLabel = cleanId.replace(/^room[-_]/i, '');
  return {
    id: cleanId,
    languageCode: fallbackLanguage.code,
    languageName: fallbackLanguage.name,
    flag: fallbackLanguage.flag,
    title: `Live Room #${shortLabel}`,
    subtitle: 'Real-Time Friend Video, Voice & Chat Room',
    currentTopic: 'Live Conversation & Language Exchange',
    levelRange: 'All Levels',
    activeLearnersCount: 2,
    activeNativesCount: 1,
    welcomeMessage: `Connected to Live Room #${shortLabel}! Start camera/mic or send a chat message.`,
    suggestedPhrases: [
      'Hey! Can you see my video and hear me clearly?',
      'Loud and clear! Ready to chat!',
      'How is your day going?'
    ],
    host: {
      id: 'host_live_room',
      name: 'Live Partner Room',
      avatarUrl: createInitialsAvatarDataUri('Live Partner Room', '#1d4ed8'),
      country: 'Global',
      countryCode: '🌍',
      nativeLanguage: fallbackLanguage.name,
      learningLanguage: 'English',
      learningLevel: 'B1',
      rating: 5.0,
      reviewCount: 12,
      sessionsCompleted: 24,
      isOnline: true,
      interests: ['Live Video Chat', 'Language Exchange'],
      bio: 'Shared peer-to-peer room for friends.',
      availability: 'Available Now',
      verifiedNative: true
    }
  };
}

export interface RoomParticipantSummary {
  peerId: string;
  userId?: string;
  name: string;
  avatarUrl: string;
  device: 'mobile' | 'desktop';
  isCameraActive: boolean;
  isMicActive: boolean;
  isScreenSharing: boolean;
}

/**
 * Idempotently inserts or updates a remote participant in the active room roster
 * without disturbing any other connected participants.
 */
export function upsertParticipantSummary<T extends RoomParticipantSummary>(
  existing: T[],
  incoming: T
): T[] {
  const idx = existing.findIndex(p => p.peerId === incoming.peerId);
  if (idx === -1) {
    return [...existing, incoming];
  }
  const next = [...existing];
  next[idx] = { ...existing[idx], ...incoming };
  return next;
}

/**
 * Removes a single departing participant by peerId while keeping all other room members intact.
 */
export function removeParticipantSummary<T extends { peerId: string }>(
  existing: T[],
  departingPeerId: string
): T[] {
  return existing.filter(p => p.peerId !== departingPeerId);
}

/**
 * Computes responsive Tailwind CSS grid classes for N total video tiles in Gallery View.
 */
export function computeConferenceGridClass(totalTiles: number): string {
  if (totalTiles <= 1) {
    return 'grid-cols-1';
  }
  if (totalTiles === 2) {
    return 'grid-cols-2 md:grid-cols-2';
  }
  if (totalTiles <= 4) {
    return 'grid-cols-2';
  }
  if (totalTiles <= 6) {
    return 'grid-cols-2 sm:grid-cols-3';
  }
  return 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4';
}

/**
 * Computes responsive Tailwind CSS grid classes for full-screen video mode,
 * prioritizing edge-to-edge visibility of local and remote participant videos.
 */
export function computeFullscreenVideoGridClass(remoteParticipantCount: number): string {
  if (remoteParticipantCount <= 0) {
    return 'grid-cols-1';
  }
  if (remoteParticipantCount === 1) {
    return 'grid-cols-1 md:grid-cols-2';
  }
  if (remoteParticipantCount <= 3) {
    return 'grid-cols-2';
  }
  return 'grid-cols-2 md:grid-cols-3';
}

export type ScrollLayoutPreference = 'vertical-feed' | 'two-column-scroll';

export interface ParticipantStageConfig {
  isScrollableMultiRoom: boolean;
  gridClass: string;
  tileWrapperClass: string;
}

/**
 * Computes the scrollable multi-participant layout when more than 2 people join a personal/group room.
 * Ensures >2 participants stack in a smooth vertical scroll container with generous tile height
 * so users can view each participant clearly by scrolling down and up.
 */
export function computeParticipantStageConfig(
  totalTiles: number,
  preference: ScrollLayoutPreference = 'vertical-feed'
): ParticipantStageConfig {
  if (totalTiles <= 2) {
    return {
      isScrollableMultiRoom: false,
      gridClass: computeConferenceGridClass(totalTiles),
      tileWrapperClass: 'min-h-[180px] h-full'
    };
  }

  if (preference === 'two-column-scroll') {
    return {
      isScrollableMultiRoom: true,
      gridClass: 'grid-cols-1 sm:grid-cols-2',
      tileWrapperClass: 'h-[235px] sm:h-[265px] shrink-0'
    };
  }

  return {
    isScrollableMultiRoom: true,
    gridClass: 'grid-cols-1',
    tileWrapperClass: 'h-[250px] sm:h-[295px] shrink-0'
  };
}

/**
 * Selects which tile ('local' or a remote peerId, or null for Gallery Grid) should be spotlighted.
 * Automatically spotlights any active screen share unless the viewer explicitly switched to Gallery mode.
 */
export function resolveSpotlightTargetId(
  remoteParticipants: Array<{ peerId: string; isScreenSharing: boolean }>,
  isLocalScreenSharing: boolean,
  manualPinId: string | null,
  forceGalleryMode: boolean
): string | null {
  if (forceGalleryMode) {
    return null;
  }

  if (manualPinId) {
    if (manualPinId === 'local') return 'local';
    if (remoteParticipants.some(p => p.peerId === manualPinId)) {
      return manualPinId;
    }
  }

  // Prefer remote friend's shared screen first so viewers immediately see what is being presented
  const remotePresenter = remoteParticipants.find(p => p.isScreenSharing);
  if (remotePresenter) {
    return remotePresenter.peerId;
  }

  if (isLocalScreenSharing) {
    return 'local';
  }

  return null;
}

export type RoomMobileTab = 'split' | 'video' | 'chat';

export interface InitialRoomChatState {
  isChatOpen: boolean;
  mobileTab: RoomMobileTab;
}

/**
 * Resolves initial chat panel visibility when entering a room, instant call,
 * or Verified Random Connect session. Chat stays collapsed by default until
 * explicitly requested (`initialChatOpen = true`).
 */
export function resolveInitialRoomChatState(initialChatOpen?: boolean): InitialRoomChatState {
  const open = Boolean(initialChatOpen);
  return {
    isChatOpen: open,
    mobileTab: open ? 'split' : 'video'
  };
}

/**
 * Determines whether the room chat panel is currently visible to the user
 * across desktop (`isChatOpen`) or mobile (`mobileTab` = 'chat' | 'split').
 */
export function isRoomChatPanelVisible(isChatOpen: boolean, mobileTab: RoomMobileTab): boolean {
  return isChatOpen || mobileTab === 'chat' || mobileTab === 'split';
}

const BUILTIN_ROOM_IDS = new Set([
  'room-en',
  'room-de',
  'room-es',
  'room-fr',
  'room-it',
  'room-ja',
  'room-zh',
  'room-pt'
]);

/**
 * Determines whether a LanguageRoom should appear in the public
 * "Active Language Chat Rooms" directory.
 *
 * Excludes Personal Rooms, Verified Random Connect matches, Instant Call & Copy Link rooms,
 * Direct Peer Calls, 1-on-1 Teacher Classrooms, and Adhoc Join-by-Code rooms — allowing
 * only built-in directory rooms and user-created rooms from the "Create Room" modal.
 */
export function isDirectoryVisibleRoom(room: LanguageRoom | null | undefined): boolean {
  if (!room || !room.id) return false;

  if (room.roomKind) {
    return room.roomKind === 'builtin' || room.roomKind === 'create-room';
  }

  if (BUILTIN_ROOM_IDS.has(room.id)) {
    return true;
  }

  const id = room.id.toLowerCase();
  const title = (room.title || '').trim();
  const subtitle = (room.subtitle || '').trim();

  if (
    id.startsWith('personal-') ||
    id.startsWith('random-verified-') ||
    id.startsWith('private-call-') ||
    id.startsWith('verified_call_') ||
    id.startsWith('teacher-room-') ||
    id.startsWith('teacher_') ||
    id.startsWith('lw-')
  ) {
    return false;
  }

  if (
    subtitle === 'Live Mobile & Desktop Tandem Call' ||
    subtitle === 'Live Cross-Device Audio & Video Call' ||
    subtitle.startsWith('1-on-1 Personal') ||
    subtitle.startsWith('Verified ID Random') ||
    subtitle.startsWith('Private 1-on-1 Verified Call') ||
    title.startsWith('Call Room: #') ||
    title.startsWith('Instant Call') ||
    title.startsWith('Verified Match') ||
    title.startsWith('Verified Call') ||
    title.startsWith('Room: ') ||
    title.startsWith('Call with ') ||
    title.startsWith('1-on-1 Lesson: ')
  ) {
    return false;
  }

  return true;
}

export function filterDirectoryVisibleRooms(rooms: ReadonlyArray<LanguageRoom>): LanguageRoom[] {
  return rooms.filter((room) => isDirectoryVisibleRoom(room));
}

export interface VideoTrackLike {
  kind?: string;
  enabled?: boolean;
  readyState?: string;
}

export function hasLiveEnabledVideoTrack(
  tracks?: ReadonlyArray<VideoTrackLike> | null
): boolean {
  if (!tracks || tracks.length === 0) return false;
  return tracks.some(
    (t) =>
      (t.kind === undefined || t.kind === 'video') &&
      t.enabled !== false &&
      t.readyState !== 'ended'
  );
}

export function resolveRemoteTileStatusLabel(participant: {
  isScreenSharing: boolean;
  isCameraActive: boolean;
  isMicActive: boolean;
  connectionStatus?: 'connecting' | 'connected' | 'reconnecting';
}): string {
  if (participant.isScreenSharing) {
    return 'Connecting Screen Share...';
  }
  if (participant.isCameraActive) {
    return 'Connecting Video...';
  }
  if (participant.isMicActive) {
    return 'Audio Only · Mic Active';
  }
  return 'Camera & Mic Off';
}

export function shouldPreferRelayImageOverlay(params: {
  isSendingVideo: boolean;
  hasRelayFrameUrl: boolean;
  hasUnmutedP2PVideoFrames: boolean;
}): boolean {
  if (!params.isSendingVideo || !params.hasRelayFrameUrl) {
    return false;
  }
  return !params.hasUnmutedP2PVideoFrames;
}

export function shouldShowLiveRemoteVideo(
  isSendingVideo: boolean,
  hasDecodedVideoFrames: boolean,
  hasRelayFrameUrl: boolean
): boolean {
  return Boolean(isSendingVideo && (hasDecodedVideoFrames || hasRelayFrameUrl));
}

export function computeRelayCaptureDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: maxWidth, height: maxHeight };
  }
  const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = Math.max(2, Math.round(sourceWidth * scale));
  const height = Math.max(2, Math.round(sourceHeight * scale));
  return { width, height };
}

export function shouldRelayVideoToPeer(
  isCanvasVideo: boolean,
  p2pVideoConfirmedByPeer: boolean
): boolean {
  return isCanvasVideo || !p2pVideoConfirmedByPeer;
}

export function selectPreferredPeerStreamSource(params: {
  expectsVideo: boolean;
  hasUnmutedP2PVideo: boolean;
  hasUnmutedP2PAudio: boolean;
  senderUsesCanvasVideo: boolean;
  hasRelayVideoFrame: boolean;
  hasRelayStream: boolean;
  hasP2PTracks: boolean;
}): 'p2p' | 'relay' | 'none' {
  const {
    expectsVideo,
    hasUnmutedP2PVideo,
    hasUnmutedP2PAudio,
    senderUsesCanvasVideo,
    hasRelayVideoFrame,
    hasRelayStream,
    hasP2PTracks
  } = params;

  if (expectsVideo) {
    if (hasP2PTracks && hasUnmutedP2PVideo && !senderUsesCanvasVideo) {
      return 'p2p';
    }
    if (hasRelayStream && hasRelayVideoFrame) {
      return 'relay';
    }
    if (hasP2PTracks && hasUnmutedP2PAudio && !senderUsesCanvasVideo) {
      return 'p2p';
    }
    if (hasRelayStream) {
      return 'relay';
    }
    if (hasP2PTracks) {
      return 'p2p';
    }
    return 'none';
  }

  if (hasP2PTracks && hasUnmutedP2PAudio) {
    return 'p2p';
  }
  if (hasRelayStream) {
    return 'relay';
  }
  if (hasP2PTracks) {
    return 'p2p';
  }
  return 'none';
}

/**
 * Generates a unique 6-digit numeric room code (e.g. 482917)
 * for instant calls and custom rooms so partners can reliably join by code.
 */
export function generateUniqueRoomCode(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    globalThis.crypto.getRandomValues(arr);
    return String(100000 + (arr[0] % 900000));
  }

  const timeSeed = Date.now() % 900000;
  const randOffset = Math.floor(Math.random() * 900000);
  return String(100000 + ((timeSeed + randOffset) % 900000));
}

/**
 * Returns a 6-digit numeric room code for display and sharing inside the room badge.
 * Preserves existing 6-digit IDs verbatim and deterministically maps non-numeric IDs.
 */
export function getSixDigitRoomCode(roomId: string): string {
  const trimmed = (roomId || '').trim();
  if (/^\d{6}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^(?:room-|lw-)(\d{6})$/i.test(trimmed)) {
    return trimmed.replace(/^(?:room-|lw-)/i, '');
  }
  if (!trimmed) {
    return '100000';
  }

  let hash = 2166136261;
  for (let i = 0; i < trimmed.length; i++) {
    hash ^= trimmed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return String(100000 + ((hash >>> 0) % 900000));
}

/**
 * Normalizes user-entered room codes or pasted invite URLs into a canonical room ID
 * (strips whitespace and '#', extracts ?room= from URLs, uppercases LW-* codes, and
 * lowercases room-* / teacher-room-* prefixes).
 */
export function normalizeRoomJoinInput(rawInput: string): string {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return '';

  let candidate = trimmed;

  if (candidate.includes('://') || candidate.includes('room=')) {
    try {
      const parsedUrl = candidate.includes('://')
        ? new URL(candidate)
        : new URL(`https://lernwelt.local/${candidate.replace(/^\/+/, '')}`);
      const roomParam = parsedUrl.searchParams.get('room');
      if (roomParam && roomParam.trim()) {
        candidate = roomParam.trim();
      }
    } catch {
      const match = candidate.match(/[?&]room=([^&#]+)/i);
      if (match && match[1]) {
        try {
          candidate = decodeURIComponent(match[1]).trim();
        } catch {
          candidate = match[1].trim();
        }
      }
    }
  }

  candidate = candidate.replace(/^#+/, '').trim();
  if (!candidate) return '';

  if (/^lw-[a-z0-9-]+$/i.test(candidate)) {
    return `LW-${candidate.slice(3).toUpperCase()}`;
  }

  if (/^(room|teacher-room|personal|random-verified|private-call)-[a-z0-9_-]+$/i.test(candidate)) {
    return candidate.toLowerCase();
  }

  return candidate;
}

/**
 * Finds a room from a candidate collection by exact ID, case-insensitive ID,
 * unprefixed LW- suffix, numeric room- suffix, or 6-digit display code.
 */
export function findRoomByCode<T extends { id: string }>(
  rooms: ReadonlyArray<T>,
  rawInput: string
): T | null {
  const normalized = normalizeRoomJoinInput(rawInput);
  if (!normalized) return null;

  const lower = normalized.toLowerCase();

  const exact = rooms.find((r) => r.id === normalized);
  if (exact) return exact;

  const caseInsensitive = rooms.find((r) => r.id.toLowerCase() === lower);
  if (caseInsensitive) return caseInsensitive;

  if (lower.startsWith('lw-')) {
    const withoutLw = normalized.slice(3).toLowerCase();
    const strippedMatch = rooms.find((r) => r.id.toLowerCase() === withoutLw);
    if (strippedMatch) return strippedMatch;
  }

  if (!lower.startsWith('lw-') && /^[a-z0-9]{6,12}$/i.test(normalized)) {
    const withLw = `lw-${lower}`;
    const lwMatch = rooms.find((r) => r.id.toLowerCase() === withLw);
    if (lwMatch) return lwMatch;
  }

  if (!lower.startsWith('room-') && /^\d{3,10}$/.test(normalized)) {
    const withRoom = `room-${lower}`;
    const roomMatch = rooms.find((r) => r.id.toLowerCase() === withRoom);
    if (roomMatch) return roomMatch;
  }

  if (/^\d{6}$/.test(normalized)) {
    const sixDigitMatch = rooms.find((r) => getSixDigitRoomCode(r.id) === normalized);
    if (sixDigitMatch) return sixDigitMatch;
  }

  return null;
}

export interface CameraErrorInfo {
  code: 'permission-denied' | 'not-found' | 'in-use' | 'overconstrained' | 'insecure-context' | 'unknown';
  message: string;
}

/**
 * Builds an ordered waterfall of video track constraints from preferred resolution + device/facingMode
 * down to basic `{ video: true }` so cameras with non-standard resolutions or drivers still open cleanly.
 */
export function buildCameraConstraintAttempts(
  facingMode: 'user' | 'environment' = 'user',
  preferredDeviceId?: string | null
): Array<MediaTrackConstraints | true> {
  const attempts: Array<MediaTrackConstraints | true> = [];

  if (preferredDeviceId) {
    attempts.push({
      deviceId: { exact: preferredDeviceId },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    });
    attempts.push({
      deviceId: { exact: preferredDeviceId }
    });
  }

  attempts.push({
    facingMode: { ideal: facingMode },
    width: { ideal: 1280 },
    height: { ideal: 720 }
  });
  attempts.push({
    facingMode: { ideal: facingMode }
  });
  attempts.push(true);

  return attempts;
}

/**
 * Maps browser MediaDevices getUserMedia errors into clear, user-actionable messages.
 */
export function classifyCameraError(err: unknown): CameraErrorInfo {
  const name =
    typeof err === 'object' && err !== null && 'name' in err
      ? String((err as { name?: unknown }).name || '')
      : '';
  const msg =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message?: unknown }).message || '')
      : String(err || '');
  const lower = `${name} ${msg}`.toLowerCase();

  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    lower.includes('permission denied') ||
    lower.includes('permission dismissed')
  ) {
    return {
      code: 'permission-denied',
      message: 'Camera permission is blocked. Allow camera access in your browser, then click Retry Camera.'
    };
  }

  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    lower.includes('requested device not found')
  ) {
    return {
      code: 'not-found',
      message: 'No camera detected on this device. Connect a camera and click Retry Camera.'
    };
  }

  if (
    name === 'NotReadableError' ||
    name === 'TrackStartError' ||
    lower.includes('could not start video source') ||
    lower.includes('in use')
  ) {
    return {
      code: 'in-use',
      message: 'Camera is busy in another app or tab. Close it and click Retry Camera.'
    };
  }

  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return {
      code: 'overconstrained',
      message: 'Camera settings unsupported. Click Retry Camera to connect with default settings.'
    };
  }

  if (name === 'SecurityError' || lower.includes('secure context') || lower.includes('mediadevices')) {
    return {
      code: 'insecure-context',
      message: 'Camera requires a secure HTTPS browser context with media permissions enabled.'
    };
  }

  return {
    code: 'unknown',
    message: 'Unable to open your physical camera right now. Click Retry Camera to try again.'
  };
}

/**
 * Pure state transition for tapping the screen in Full Screen video mode:
 * - Exiting full screen always hides the overlay controls.
 * - Tapping an interactive control button preserves the current bar state so actions work cleanly.
 * - First tap on the video surface shows the bottom bar; second tap hides it back to pure full screen.
 */
export function computeNextFullscreenControlsVisible(params: {
  isVideoFullscreen: boolean;
  currentlyVisible: boolean;
  clickedInteractiveControl: boolean;
}): boolean {
  if (!params.isVideoFullscreen) {
    return false;
  }
  if (params.clickedInteractiveControl) {
    return params.currentlyVisible;
  }
  return !params.currentlyVisible;
}

export interface VideoReactionOption {
  emoji: string;
  label: string;
}

export interface VideoReactionItem {
  id: string;
  emoji: string;
  label: string;
  senderId: string;
  senderName: string;
  createdAt: number;
  expiresAt: number;
  offsetPercent: number;
}

export const VIDEO_REACTION_TTL_MS = 2900;

export const VIDEO_REACTION_OPTIONS: ReadonlyArray<VideoReactionOption> = [
  { emoji: '👍', label: 'Thumbs Up' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '🎉', label: 'Celebrate' }
];

const REACTION_OFFSET_SLOTS = [20, 32, 44, 56, 68, 80] as const;

/**
 * Computes a deterministic horizontal scatter percentage for a reaction bubble
 * so consecutive reactions float cleanly side-by-side over a video tile.
 */
export function computeReactionHorizontalOffset(reactionId: string): number {
  const input = (reactionId || '').trim();
  if (!input) return 56;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return REACTION_OFFSET_SLOTS[hash % REACTION_OFFSET_SLOTS.length];
}

/**
 * Prunes any video reactions whose TTL has elapsed.
 */
export function pruneExpiredVideoReactions(
  existing: ReadonlyArray<VideoReactionItem>,
  now: number = Date.now()
): VideoReactionItem[] {
  return existing.filter((item) => item.expiresAt > now);
}

/**
 * Idempotently inserts a video reaction (preventing duplicates when delivered over both
 * WebRTC DataChannel and WebSocket), prunes expired reactions, and caps concurrent
 * bubbles per sender tile.
 */
export function upsertVideoReaction(
  existing: ReadonlyArray<VideoReactionItem>,
  incoming: Omit<VideoReactionItem, 'expiresAt' | 'offsetPercent'> & {
    expiresAt?: number;
    offsetPercent?: number;
  },
  now: number = Date.now(),
  ttlMs: number = VIDEO_REACTION_TTL_MS,
  maxPerSender: number = 8
): VideoReactionItem[] {
  if (!incoming || !incoming.id || !incoming.emoji) {
    return pruneExpiredVideoReactions(existing, now);
  }

  const active = pruneExpiredVideoReactions(existing, now);
  if (active.some((item) => item.id === incoming.id)) {
    return active;
  }

  const normalized: VideoReactionItem = {
    id: incoming.id,
    emoji: incoming.emoji,
    label: incoming.label || 'Reaction',
    senderId: incoming.senderId || 'local',
    senderName: incoming.senderName || 'Participant',
    createdAt: incoming.createdAt || now,
    expiresAt: incoming.expiresAt ?? now + ttlMs,
    offsetPercent:
      typeof incoming.offsetPercent === 'number' && Number.isFinite(incoming.offsetPercent)
        ? incoming.offsetPercent
        : computeReactionHorizontalOffset(incoming.id)
  };

  if (normalized.expiresAt <= now) {
    return active;
  }

  const others = active.filter((item) => item.senderId !== normalized.senderId);
  const sameSender = active.filter((item) => item.senderId === normalized.senderId);
  const trimmedSameSender = [...sameSender, normalized].slice(-Math.max(1, maxPerSender));

  return [...others, ...trimmedSameSender];
}

