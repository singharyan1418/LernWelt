import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateUniqueUserId,
  getOrCreateTabPeerId,
  isPolitePeer,
  normalizeChatMessage,
  mergeChatMessages,
  buildRoomInviteUrl,
  resolveRoomFromId,
  upsertParticipantSummary,
  removeParticipantSummary,
  computeConferenceGridClass,
  computeFullscreenVideoGridClass,
  computeParticipantStageConfig,
  resolveSpotlightTargetId,
  resolveInitialRoomChatState,
  isRoomChatPanelVisible,
  isDirectoryVisibleRoom,
  filterDirectoryVisibleRooms,
  hasLiveEnabledVideoTrack,
  resolveRemoteTileStatusLabel,
  shouldPreferRelayImageOverlay,
  shouldShowLiveRemoteVideo,
  computeRelayCaptureDimensions,
  shouldRelayVideoToPeer,
  selectPreferredPeerStreamSource,
  generateUniqueRoomCode,
  getSixDigitRoomCode,
  normalizeRoomJoinInput,
  findRoomByCode,
  buildCameraConstraintAttempts,
  classifyCameraError,
  computeNextFullscreenControlsVisible,
  VIDEO_REACTION_OPTIONS,
  computeReactionHorizontalOffset,
  upsertVideoReaction,
  pruneExpiredVideoReactions,
  RoomParticipantSummary
} from './roomSessionUtils';
import { LANGUAGE_ROOMS, SUPPORTED_LANGUAGES } from '../data/mockData';
import { ChatMessage } from '../types';

test('generateUniqueUserId produces distinct non-colliding IDs', () => {
  const id1 = generateUniqueUserId('friend');
  const id2 = generateUniqueUserId('friend');
  assert.notEqual(id1, id2);
  assert.ok(id1.startsWith('friend_'));
});

test('getOrCreateTabPeerId returns stable peerId per userId within session', () => {
  const p1 = getOrCreateTabPeerId('usr_alice');
  const p2 = getOrCreateTabPeerId('usr_alice');
  const p3 = getOrCreateTabPeerId('usr_bob');
  assert.equal(p1, p2);
  assert.notEqual(p1, p3);
});

test('isPolitePeer assigns strictly opposite roles to two distinct peers', () => {
  const peerA = 'usr_100__aaa';
  const peerB = 'usr_200__bbb';
  assert.notEqual(isPolitePeer(peerA, peerB), isPolitePeer(peerB, peerA));
});

test('normalizeChatMessage attributes sender accurately for both author and friend', () => {
  const rawMsg: ChatMessage = {
    id: 'msg_1',
    sender: 'user',
    senderId: 'usr_abhay__tab1',
    senderName: 'Abhay',
    text: 'Hello Rohan!',
    timestamp: '10:00 AM'
  };

  const forAbhay = normalizeChatMessage(rawMsg, 'usr_abhay', 'usr_abhay__tab1');
  const forRohan = normalizeChatMessage(rawMsg, 'usr_rohan', 'usr_rohan__tab2');
  const forAbhaySecondTab = normalizeChatMessage(rawMsg, 'usr_abhay', 'usr_abhay__tab2');

  assert.equal(forAbhay.sender, 'user');
  assert.equal(forRohan.sender, 'partner');
  // Even if testing in two tabs with same localStorage user, tab2 sees tab1 as partner!
  assert.equal(forAbhaySecondTab.sender, 'partner');
});

test('mergeChatMessages deduplicates dual-channel deliveries and preserves corrections & replyTo', () => {
  const initial: ChatMessage[] = [
    {
      id: 'msg_1',
      sender: 'user',
      senderId: 'usr_a__t1',
      senderName: 'Alice',
      text: 'Hi Bob!',
      timestamp: '10:01',
      isAnalyzing: false,
      correction: {
        id: 'c1',
        originalText: 'Hi Bob!',
        correctedText: 'Hi Bob!',
        targetLanguage: 'English',
        hasErrors: false,
        overallFeedback: 'Great!',
        mistakes: [],
        betterWords: [],
        cefrLevelEstimated: 'B2',
        nativeNuanceTip: 'Natural greeting',
        timestamp: 123
      }
    }
  ];

  // Duplicate delivery from HTTP history without correction + a new reply from Bob
  const incoming: ChatMessage[] = [
    {
      id: 'msg_1',
      sender: 'partner',
      senderId: 'usr_a__t1',
      senderName: 'Alice',
      text: 'Hi Bob!',
      timestamp: '10:01'
    },
    {
      id: 'msg_2',
      sender: 'user',
      senderId: 'usr_b__t2',
      senderName: 'Bob',
      text: 'Hey Alice, I see your video clearly!',
      timestamp: '10:02',
      replyTo: { id: 'msg_1', senderName: 'Alice', text: 'Hi Bob!' }
    }
  ];

  const merged = mergeChatMessages(initial, incoming, 'usr_a', 'usr_a__t1');
  assert.equal(merged.length, 2);
  assert.equal(merged[0].sender, 'user');
  assert.ok(merged[0].correction, 'Preserved local AI correction on deduplication');
  assert.equal(merged[1].sender, 'partner');
  assert.equal(merged[1].replyTo?.senderName, 'Alice');
});

test('resolveRoomFromId resolves both built-in rooms and custom invite codes', () => {
  const builtIn = resolveRoomFromId('room-es', LANGUAGE_ROOMS, SUPPORTED_LANGUAGES[0]);
  assert.equal(builtIn.id, 'room-es');

  const custom = resolveRoomFromId('room-8492', LANGUAGE_ROOMS, SUPPORTED_LANGUAGES[0]);
  assert.equal(custom.id, 'room-8492');
  assert.ok(custom.title.includes('8492'));

  const url = buildRoomInviteUrl('https://example.run.app/', 'room-8492');
  assert.equal(url, 'https://example.run.app/?room=room-8492&tab=chat-room');
});

test('upsertParticipantSummary and removeParticipantSummary manage 3+ peers without collision', () => {
  const p1: RoomParticipantSummary = {
    peerId: 'peer_rohan',
    name: 'Rohan',
    avatarUrl: 'https://example.com/r.png',
    device: 'desktop',
    isCameraActive: true,
    isMicActive: true,
    isScreenSharing: false
  };
  const p2: RoomParticipantSummary = {
    peerId: 'peer_priya',
    name: 'Priya',
    avatarUrl: 'https://example.com/p.png',
    device: 'mobile',
    isCameraActive: false,
    isMicActive: true,
    isScreenSharing: false
  };

  let roster: RoomParticipantSummary[] = [];
  roster = upsertParticipantSummary(roster, p1);
  roster = upsertParticipantSummary(roster, p2);
  assert.equal(roster.length, 2);

  // Priya starts screen sharing -> updates Priya without dropping Rohan
  roster = upsertParticipantSummary(roster, { ...p2, isScreenSharing: true });
  assert.equal(roster.length, 2);
  assert.equal(roster[0].name, 'Rohan');
  assert.equal(roster[1].isScreenSharing, true);

  // Rohan leaves -> Priya stays connected
  roster = removeParticipantSummary(roster, 'peer_rohan');
  assert.equal(roster.length, 1);
  assert.equal(roster[0].peerId, 'peer_priya');
});

test('resolveSpotlightTargetId and computeConferenceGridClass adapt to multi-user & screen share', () => {
  const peers = [
    { peerId: 'peer_rohan', isScreenSharing: false },
    { peerId: 'peer_priya', isScreenSharing: true }
  ];

  // Auto-spotlights Priya when she shares her screen
  assert.equal(resolveSpotlightTargetId(peers, false, null, false), 'peer_priya');
  // Respects user switching to gallery view even during screen share
  assert.equal(resolveSpotlightTargetId(peers, false, null, true), null);
  // Respects manual pin on Rohan
  assert.equal(resolveSpotlightTargetId(peers, false, 'peer_rohan', false), 'peer_rohan');
  // Falls back to local presenter if no remote peer is sharing screen
  assert.equal(
    resolveSpotlightTargetId([{ peerId: 'peer_rohan', isScreenSharing: false }], true, null, false),
    'local'
  );

  assert.equal(computeConferenceGridClass(1), 'grid-cols-1');
  assert.ok(computeConferenceGridClass(3).includes('grid-cols-2'));
  assert.ok(computeConferenceGridClass(5).includes('sm:grid-cols-3'));
});

test('computeParticipantStageConfig enables vertical scrollable stack when >2 people join', () => {
  const twoPerson = computeParticipantStageConfig(2, 'vertical-feed');
  assert.equal(twoPerson.isScrollableMultiRoom, false);

  const fourPersonFeed = computeParticipantStageConfig(4, 'vertical-feed');
  assert.equal(fourPersonFeed.isScrollableMultiRoom, true);
  assert.equal(fourPersonFeed.gridClass, 'grid-cols-1');
  assert.ok(fourPersonFeed.tileWrapperClass.includes('shrink-0'));

  const fourPersonTwoCol = computeParticipantStageConfig(4, 'two-column-scroll');
  assert.equal(fourPersonTwoCol.isScrollableMultiRoom, true);
  assert.ok(fourPersonTwoCol.gridClass.includes('sm:grid-cols-2'));
});

test('resolveInitialRoomChatState keeps chat collapsed by default until requested', () => {
  const defaultState = resolveInitialRoomChatState();
  assert.equal(defaultState.isChatOpen, false);
  assert.equal(defaultState.mobileTab, 'video');
  assert.equal(isRoomChatPanelVisible(defaultState.isChatOpen, defaultState.mobileTab), false);

  const falseState = resolveInitialRoomChatState(false);
  assert.equal(falseState.isChatOpen, false);
  assert.equal(falseState.mobileTab, 'video');
  assert.equal(isRoomChatPanelVisible(falseState.isChatOpen, falseState.mobileTab), false);

  const requestedState = resolveInitialRoomChatState(true);
  assert.equal(requestedState.isChatOpen, true);
  assert.equal(requestedState.mobileTab, 'split');
  assert.equal(isRoomChatPanelVisible(requestedState.isChatOpen, requestedState.mobileTab), true);

  // User manually opens chat on desktop or mobile
  assert.equal(isRoomChatPanelVisible(true, 'video'), true);
  assert.equal(isRoomChatPanelVisible(false, 'chat'), true);
  assert.equal(isRoomChatPanelVisible(false, 'split'), true);
});

test('isDirectoryVisibleRoom and filterDirectoryVisibleRooms only keep built-in and Create Room rooms', () => {
  const baseHost = LANGUAGE_ROOMS[0].host;

  const createRoom = {
    ...LANGUAGE_ROOMS[0],
    id: 'room-1790000123456',
    title: 'Berlin Coffee Talk',
    subtitle: 'German Community Exchange Hub',
    roomKind: 'create-room' as const
  };

  const personalRoom = {
    ...LANGUAGE_ROOMS[0],
    id: 'personal-alex-room',
    title: "Alex's Personal Room",
    subtitle: 'Multi-Friend Scrollable Video, Voice, Screen Share & Chat',
    roomKind: 'personal' as const
  };

  const instantCallRoom = {
    ...LANGUAGE_ROOMS[0],
    id: 'room-4821',
    title: 'Call Room: #4821',
    subtitle: 'Live Mobile & Desktop Tandem Call',
    roomKind: 'instant-call' as const
  };

  const randomVerifiedRoom = {
    ...LANGUAGE_ROOMS[0],
    id: 'random-verified-abc123-9900',
    title: 'Verified Match · Alice & Bob',
    subtitle: 'Verified ID Random Video & Audio Session · Screen Share & Personal Chat Enabled',
    roomKind: 'random-verified' as const
  };

  const directCallRoom = {
    ...LANGUAGE_ROOMS[0],
    id: 'private-call-1790000',
    title: 'Private Call with Lukas',
    subtitle: 'Private 1-on-1 Verified Call',
    roomKind: 'direct-call' as const
  };

  const legacyInstantCallWithoutKind = {
    ...LANGUAGE_ROOMS[0],
    id: 'room-9123',
    title: 'Call Room: #9123',
    subtitle: 'Live Mobile & Desktop Tandem Call',
    host: baseHost
  };

  const legacyPersonalWithoutKind = {
    ...LANGUAGE_ROOMS[0],
    id: 'personal-sarah-room',
    title: "Sarah's Personal Room",
    subtitle: 'Multi-Friend Scrollable Video, Voice, Screen Share & Chat'
  };

  const legacyCreateRoomWithoutKind = {
    ...LANGUAGE_ROOMS[0],
    id: 'room-1790000999999',
    title: 'Tokyo Book Club',
    subtitle: 'Japanese Community Exchange Hub'
  };

  assert.equal(isDirectoryVisibleRoom(LANGUAGE_ROOMS[0]), true);
  assert.equal(isDirectoryVisibleRoom(createRoom), true);
  assert.equal(isDirectoryVisibleRoom(legacyCreateRoomWithoutKind), true);

  assert.equal(isDirectoryVisibleRoom(personalRoom), false);
  assert.equal(isDirectoryVisibleRoom(instantCallRoom), false);
  assert.equal(isDirectoryVisibleRoom(randomVerifiedRoom), false);
  assert.equal(isDirectoryVisibleRoom(directCallRoom), false);
  assert.equal(isDirectoryVisibleRoom(legacyInstantCallWithoutKind), false);
  assert.equal(isDirectoryVisibleRoom(legacyPersonalWithoutKind), false);

  const visible = filterDirectoryVisibleRooms([
    personalRoom,
    instantCallRoom,
    randomVerifiedRoom,
    directCallRoom,
    legacyInstantCallWithoutKind,
    legacyPersonalWithoutKind,
    createRoom,
    legacyCreateRoomWithoutKind,
    LANGUAGE_ROOMS[0]
  ]);

  assert.deepEqual(
    visible.map((r) => r.id),
    [createRoom.id, legacyCreateRoomWithoutKind.id, LANGUAGE_ROOMS[0].id]
  );
});

test('video track, relay overlay, capture dimensions, and stream source selection helpers behave accurately', () => {
  assert.equal(hasLiveEnabledVideoTrack([]), false);
  assert.equal(hasLiveEnabledVideoTrack([{ kind: 'video', enabled: false, readyState: 'live' }]), false);
  assert.equal(hasLiveEnabledVideoTrack([{ kind: 'video', enabled: true, readyState: 'ended' }]), false);
  assert.equal(hasLiveEnabledVideoTrack([{ kind: 'video', enabled: true, readyState: 'live' }]), true);

  assert.equal(
    resolveRemoteTileStatusLabel({ isScreenSharing: true, isCameraActive: false, isMicActive: true }),
    'Connecting Screen Share...'
  );
  assert.equal(
    resolveRemoteTileStatusLabel({ isScreenSharing: false, isCameraActive: true, isMicActive: true }),
    'Connecting Video...'
  );
  assert.equal(
    resolveRemoteTileStatusLabel({ isScreenSharing: false, isCameraActive: false, isMicActive: true }),
    'Audio Only · Mic Active'
  );
  assert.equal(
    resolveRemoteTileStatusLabel({ isScreenSharing: false, isCameraActive: false, isMicActive: false }),
    'Camera & Mic Off'
  );

  assert.equal(
    shouldPreferRelayImageOverlay({ isSendingVideo: true, hasRelayFrameUrl: true, hasUnmutedP2PVideoFrames: false }),
    true
  );
  assert.equal(
    shouldPreferRelayImageOverlay({ isSendingVideo: true, hasRelayFrameUrl: true, hasUnmutedP2PVideoFrames: true }),
    false
  );
  assert.equal(shouldShowLiveRemoteVideo(false, true, true), false);
  assert.equal(shouldShowLiveRemoteVideo(true, false, true), true);

  assert.deepEqual(computeRelayCaptureDimensions(1920, 1080, 800, 450), { width: 800, height: 450 });
  assert.deepEqual(computeRelayCaptureDimensions(320, 240, 640, 480), { width: 320, height: 240 });

  assert.equal(shouldRelayVideoToPeer(true, true), true);
  assert.equal(shouldRelayVideoToPeer(false, true), false);
  assert.equal(shouldRelayVideoToPeer(false, false), true);

  assert.equal(
    selectPreferredPeerStreamSource({
      expectsVideo: true,
      hasUnmutedP2PVideo: true,
      hasUnmutedP2PAudio: true,
      senderUsesCanvasVideo: false,
      hasRelayVideoFrame: true,
      hasRelayStream: true,
      hasP2PTracks: true
    }),
    'p2p'
  );
  assert.equal(
    selectPreferredPeerStreamSource({
      expectsVideo: true,
      hasUnmutedP2PVideo: false,
      hasUnmutedP2PAudio: false,
      senderUsesCanvasVideo: true,
      hasRelayVideoFrame: true,
      hasRelayStream: true,
      hasP2PTracks: true
    }),
    'relay'
  );
});

test('generateUniqueRoomCode, getSixDigitRoomCode, normalizeRoomJoinInput, and findRoomByCode handle 6-digit codes cleanly', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const code = generateUniqueRoomCode();
    assert.match(code, /^\d{6}$/);
    assert.equal(getSixDigitRoomCode(code), code);
    seen.add(code);
  }
  assert.ok(seen.size >= 15);

  const builtInCode = getSixDigitRoomCode('room-es');
  assert.match(builtInCode, /^\d{6}$/);
  assert.equal(getSixDigitRoomCode('room-es'), builtInCode);
  assert.equal(getSixDigitRoomCode('LW-482917'), '482917');
  assert.equal(getSixDigitRoomCode('room-482917'), '482917');

  assert.equal(normalizeRoomJoinInput('  482917  '), '482917');
  assert.equal(normalizeRoomJoinInput('#482917'), '482917');
  assert.equal(
    normalizeRoomJoinInput('https://lernwelt.app/?room=482917&tab=chat-room'),
    '482917'
  );
  assert.equal(normalizeRoomJoinInput('  ROOM-ES '), 'room-es');
  assert.equal(normalizeRoomJoinInput('   '), '');

  const sampleRooms = [
    { ...LANGUAGE_ROOMS[0], id: 'room-es', title: 'Salón Hispano' },
    { ...LANGUAGE_ROOMS[0], id: '482917', title: 'Instant Call · 482917', roomKind: 'instant-call' as const },
    { ...LANGUAGE_ROOMS[0], id: 'LW-7K4M9P2X', title: 'Instant Call · LW-7K4M9P2X', roomKind: 'instant-call' as const },
    { ...LANGUAGE_ROOMS[0], id: 'room-4821', title: 'Call Room: #4821', roomKind: 'instant-call' as const }
  ];

  assert.equal(findRoomByCode(sampleRooms, '482917')?.id, '482917');
  assert.equal(findRoomByCode(sampleRooms, '#482917')?.id, '482917');
  assert.equal(findRoomByCode(sampleRooms, 'https://example.com/?room=482917&tab=chat-room')?.id, '482917');
  assert.equal(findRoomByCode(sampleRooms, builtInCode)?.id, 'room-es');
  assert.equal(findRoomByCode(sampleRooms, 'lw-7k4m9p2x')?.id, 'LW-7K4M9P2X');
  assert.equal(findRoomByCode(sampleRooms, '7K4M9P2X')?.id, 'LW-7K4M9P2X');
  assert.equal(findRoomByCode(sampleRooms, 'ROOM-ES')?.id, 'room-es');
  assert.equal(findRoomByCode(sampleRooms, '#4821')?.id, 'room-4821');
  assert.equal(findRoomByCode(sampleRooms, '999999'), null);

  // Instant-call rooms remain excluded from the public Active Rooms directory
  assert.equal(isDirectoryVisibleRoom(sampleRooms[1]), false);
});

test('computeFullscreenVideoGridClass sizes local and remote participant video grid accurately', () => {
  assert.equal(computeFullscreenVideoGridClass(0), 'grid-cols-1');
  assert.equal(computeFullscreenVideoGridClass(1), 'grid-cols-1 md:grid-cols-2');
  assert.equal(computeFullscreenVideoGridClass(2), 'grid-cols-2');
  assert.equal(computeFullscreenVideoGridClass(3), 'grid-cols-2');
  assert.equal(computeFullscreenVideoGridClass(4), 'grid-cols-2 md:grid-cols-3');
});

test('buildCameraConstraintAttempts and classifyCameraError handle constraints and camera failure states cleanly', () => {
  const defaultAttempts = buildCameraConstraintAttempts('user');
  assert.equal(defaultAttempts.length, 3);
  assert.deepEqual(defaultAttempts[0], {
    facingMode: { ideal: 'user' },
    width: { ideal: 1280 },
    height: { ideal: 720 }
  });
  assert.deepEqual(defaultAttempts[1], { facingMode: { ideal: 'user' } });
  assert.equal(defaultAttempts[2], true);

  const deviceAttempts = buildCameraConstraintAttempts('environment', 'cam-usb-1');
  assert.equal(deviceAttempts.length, 5);
  assert.deepEqual(deviceAttempts[0], {
    deviceId: { exact: 'cam-usb-1' },
    width: { ideal: 1280 },
    height: { ideal: 720 }
  });
  assert.deepEqual(deviceAttempts[1], { deviceId: { exact: 'cam-usb-1' } });
  assert.equal(deviceAttempts[4], true);

  assert.equal(classifyCameraError({ name: 'NotAllowedError' }).code, 'permission-denied');
  assert.equal(classifyCameraError({ name: 'NotFoundError' }).code, 'not-found');
  assert.equal(classifyCameraError({ name: 'NotReadableError' }).code, 'in-use');
  assert.equal(classifyCameraError({ name: 'OverconstrainedError' }).code, 'overconstrained');
  assert.equal(classifyCameraError({ name: 'SecurityError' }).code, 'insecure-context');
});

test('computeNextFullscreenControlsVisible toggles bottom bar on screen tap and ignores control clicks', () => {
  // First tap in fullscreen reveals controls
  assert.equal(
    computeNextFullscreenControlsVisible({
      isVideoFullscreen: true,
      currentlyVisible: false,
      clickedInteractiveControl: false
    }),
    true
  );

  // Clicking Mic / Camera / Screen Share / Volume inside toolbar keeps controls open
  assert.equal(
    computeNextFullscreenControlsVisible({
      isVideoFullscreen: true,
      currentlyVisible: true,
      clickedInteractiveControl: true
    }),
    true
  );

  // Second tap on screen hides controls back to pure video-only fullscreen
  assert.equal(
    computeNextFullscreenControlsVisible({
      isVideoFullscreen: true,
      currentlyVisible: true,
      clickedInteractiveControl: false
    }),
    false
  );

  // Exiting fullscreen always keeps overlay controls hidden
  assert.equal(
    computeNextFullscreenControlsVisible({
      isVideoFullscreen: false,
      currentlyVisible: true,
      clickedInteractiveControl: false
    }),
    false
  );
});

test('video reaction helpers deduplicate dual deliveries, cap per tile, scatter offsets, and expire by TTL', () => {
  assert.ok(VIDEO_REACTION_OPTIONS.some((opt) => opt.emoji === '👍'));
  assert.ok(VIDEO_REACTION_OPTIONS.some((opt) => opt.emoji === '❤️'));

  const slot = computeReactionHorizontalOffset('rxn_1001_abc');
  assert.ok(slot >= 20 && slot <= 80);
  assert.equal(computeReactionHorizontalOffset('rxn_1001_abc'), slot);

  const now = 10_000;
  let list = upsertVideoReaction(
    [],
    {
      id: 'rxn_1',
      emoji: '👍',
      label: 'Thumbs Up',
      senderId: 'peer_alice',
      senderName: 'Alice',
      createdAt: now
    },
    now,
    2900,
    4
  );
  assert.equal(list.length, 1);

  // Duplicate delivery over DataChannel + WebSocket must not create a second bubble
  list = upsertVideoReaction(
    list,
    {
      id: 'rxn_1',
      emoji: '👍',
      label: 'Thumbs Up',
      senderId: 'peer_alice',
      senderName: 'Alice',
      createdAt: now
    },
    now + 50,
    2900,
    4
  );
  assert.equal(list.length, 1);

  // Rapid burst from same sender caps at maxPerSender while keeping other senders intact
  for (let i = 2; i <= 6; i++) {
    list = upsertVideoReaction(
      list,
      {
        id: `rxn_${i}`,
        emoji: '❤️',
        label: 'Heart',
        senderId: 'peer_alice',
        senderName: 'Alice',
        createdAt: now + i * 100
      },
      now + i * 100,
      2900,
      4
    );
  }
  assert.equal(list.filter((r) => r.senderId === 'peer_alice').length, 4);

  list = upsertVideoReaction(
    list,
    {
      id: 'rxn_bob_1',
      emoji: '🔥',
      label: 'Fire',
      senderId: 'peer_bob',
      senderName: 'Bob',
      createdAt: now + 700
    },
    now + 700,
    2900,
    4
  );
  assert.equal(list.length, 5);

  // Pruning after Alice's TTL leaves Bob's reaction active until Bob expires
  const midPruned = pruneExpiredVideoReactions(list, now + 3550);
  assert.equal(midPruned.length, 1);
  assert.equal(midPruned[0].id, 'rxn_bob_1');

  const endPruned = pruneExpiredVideoReactions(list, now + 3700);
  assert.equal(endPruned.length, 0);
});


