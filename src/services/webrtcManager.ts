/**
 * Multi-Party Mesh WebRTC + Hybrid WebSocket Media Relay & Screen Share Manager for LernWelt
 * Supports 2, 3, 4, 6+ simultaneous participants in audio & video rooms with zero-glare Perfect Negotiation,
 * automatic TURN-over-WebSocket video & wideband 16kHz voice fan-out, and trouble-free screen sharing.
 */

import { ChatMessage, LanguageRoom, UserProfile } from '../types';
import {
  buildCameraConstraintAttempts,
  classifyCameraError,
  computeReactionHorizontalOffset,
  computeRelayCaptureDimensions,
  getOrCreateTabPeerId,
  isPolitePeer,
  selectPreferredPeerStreamSource,
  shouldRelayVideoToPeer,
  VIDEO_REACTION_TTL_MS,
  VideoReactionItem
} from './roomSessionUtils';
import { createInitialsAvatarDataUri } from '../data/teacherData';

export interface RemoteParticipant {
  peerId: string;
  userId?: string;
  name: string;
  avatarUrl: string;
  device: 'mobile' | 'desktop';
  isCameraActive: boolean;
  isMicActive: boolean;
  isScreenSharing: boolean;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting';
  stream: MediaStream | null;
  streamVersion: number;
  audioLevel: number;
  isTyping: boolean;
  relayFrameUrl?: string | null;
  hasLiveP2PVideo?: boolean;
}

export interface WebRTCState {
  hasMediaPermission: boolean;
  isCameraActive: boolean;
  isMicActive: boolean;
  isScreenSharing: boolean;
  screenShareMode?: 'native' | 'presentation-board' | null;
  isVirtualCamera?: boolean;
  cameraError?: string | null;
  availableVideoDevices?: Array<{ deviceId: string; label: string }>;
  selectedVideoDeviceId?: string | null;
  facingMode: 'user' | 'environment';
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  callDurationSeconds: number;
  audioLevel: number; // 0 - 100
  remoteAudioLevel: number; // 0 - 100 (highest active remote speaker)
  latencyMs: number;
  resolution: string;
  signalingLogs: string[];
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteParticipants: RemoteParticipant[];
  // Backwards-compatible primary peer mirrors
  remoteStream: MediaStream | null;
  remoteStreamVersion: number;
  remoteUser: {
    id: string;
    userId?: string;
    name: string;
    avatarUrl: string;
    isCameraActive?: boolean;
    isMicActive?: boolean;
    isScreenSharing?: boolean;
    device?: 'mobile' | 'desktop';
  } | null;
  isPartnerTyping: boolean;
  remoteAutoplayBlocked?: boolean;
}

interface PeerSession {
  peerId: string;
  userId?: string;
  name: string;
  avatarUrl: string;
  device: 'mobile' | 'desktop';
  isCameraActive: boolean;
  isMicActive: boolean;
  isScreenSharing: boolean;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting';
  streamVersion: number;
  audioLevel: number;
  isTyping: boolean;
  typingTimeoutId: ReturnType<typeof setTimeout> | null;

  // Dedicated RTCPeerConnection & Perfect Negotiation state for this specific participant
  pc: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  makingOffer: boolean;
  isAnswering: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  pendingCandidates: RTCIceCandidateInit[];

  // Direct P2P media state
  p2pStream: MediaStream;
  outputStream: MediaStream;
  hasUnmutedP2PVideo: boolean;
  hasUnmutedP2PAudio: boolean;
  senderUsesCanvasVideo: boolean;
  p2pVideoConfirmedByPeer: boolean;
  p2pAudioConfirmedByPeer: boolean;

  // Per-participant WebSocket live media relay receiver (isolated per peer so N streams never collide!)
  relayReceiveCanvas: HTMLCanvasElement | null;
  relayDecodeImg: HTMLImageElement | null;
  relayMediaStream: MediaStream | null;
  relayAudioDest: MediaStreamAudioDestinationNode | null;
  relayFrameUrl: string | null;
  hasRelayVideoFrame: boolean;
  nextRelayAudioTime: number;
  remoteAnalyser: AnalyserNode | null;
  activeSource: 'none' | 'relay' | 'p2p';
}

const DEFAULT_AVATAR = createInitialsAvatarDataUri('Participant', '#1d4ed8');

export class WebRTCManager {
  public readonly roomId: string;
  public readonly currentUser: UserProfile;
  public readonly peerId: string;
  private roomMeta: LanguageRoom | null = null;

  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peers: Map<string, PeerSession> = new Map();

  private ws: WebSocket | null = null;
  private wsKeepAliveId: ReturnType<typeof setInterval> | null = null;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private isDisposed: boolean = false;

  // Audio Context & level analysers
  private audioContext: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private audioMeterIntervalId: ReturnType<typeof setInterval> | null = null;

  // Fallback synthetic camera/mic stream handles (only when physical webcam/mic missing)
  private fallbackCanvasIntervalId: ReturnType<typeof setInterval> | null = null;
  private fallbackSourceCanvas: HTMLCanvasElement | null = null;
  private fallbackOscillator: OscillatorNode | null = null;
  private fallbackAudioCtx: AudioContext | null = null;

  // Presentation Board fallback handles (for screen sharing on mobile/WebView/headless browsers)
  private screenFallbackIntervalId: ReturnType<typeof setInterval> | null = null;
  private screenFallbackCanvas: HTMLCanvasElement | null = null;
  private presentationNote: string = '';

  // Outgoing TURN-over-WebSocket Live Video & Voice Fan-Out Relay
  private videoRelayIntervalId: ReturnType<typeof setInterval> | null = null;
  private relayCaptureVideoEl: HTMLVideoElement | null = null;
  private relayCaptureCanvas: HTMLCanvasElement | null = null;
  private outgoingAudioRelayCtx: AudioContext | null = null;
  private outgoingAudioProcessor: ScriptProcessorNode | null = null;

  private onStateChangeCallback: ((state: Partial<WebRTCState>) => void) | null = null;
  private onChatMessageCallback: ((message: ChatMessage) => void) | null = null;
  private onChatHistoryCallback: ((messages: ChatMessage[]) => void) | null = null;
  private onRoomMetaCallback: ((room: LanguageRoom) => void) | null = null;
  private onReactionCallback: ((reaction: VideoReactionItem) => void) | null = null;
  private logs: string[] = [];

  private isCameraOn: boolean = false;
  private isMicOn: boolean = false;
  private isScreenOn: boolean = false;
  private screenShareMode: 'native' | 'presentation-board' | null = null;
  private usedVirtualVideo: boolean = false;
  private cameraError: string | null = null;
  private availableVideoDevices: Array<{ deviceId: string; label: string }> = [];
  private selectedVideoDeviceId: string | null = null;
  private mediaRequestSeq: number = 0;
  private currentFacingMode: 'user' | 'environment' = 'user';

  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ];

  constructor(roomId: string, currentUser: UserProfile, roomMeta?: LanguageRoom) {
    this.roomId = roomId;
    this.currentUser = currentUser;
    this.roomMeta = roomMeta || null;
    this.peerId = getOrCreateTabPeerId(currentUser.id);
    this.initSocketSignaling();
  }

  public setOnStateChange(cb: (state: Partial<WebRTCState>) => void) {
    this.onStateChangeCallback = cb;
  }

  public setOnChatMessage(cb: (message: ChatMessage) => void) {
    this.onChatMessageCallback = cb;
  }

  public setOnChatHistory(cb: (messages: ChatMessage[]) => void) {
    this.onChatHistoryCallback = cb;
  }

  public setOnRoomMeta(cb: (room: LanguageRoom) => void) {
    this.onRoomMetaCallback = cb;
    if (this.roomMeta) {
      this.presentationNote = this.roomMeta.currentTopic || '';
    }
  }

  public setOnReaction(cb: (reaction: VideoReactionItem) => void) {
    this.onReactionCallback = cb;
  }

  public updatePresentationNote(note: string) {
    this.presentationNote = note;
  }

  public resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    if (this.outgoingAudioRelayCtx && this.outgoingAudioRelayCtx.state === 'suspended') {
      this.outgoingAudioRelayCtx.resume().catch(() => {});
    }
  }

  private log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${message}`;
    this.logs.unshift(entry);
    if (this.logs.length > 60) this.logs.pop();
    this.notifyState({ signalingLogs: [...this.logs] });
  }

  private selectPeerStream(session: PeerSession): MediaStream | null {
    const expectsVideo = session.isCameraActive || session.isScreenSharing;
    const choice = selectPreferredPeerStreamSource({
      expectsVideo,
      hasUnmutedP2PVideo: session.hasUnmutedP2PVideo,
      hasUnmutedP2PAudio: session.hasUnmutedP2PAudio,
      senderUsesCanvasVideo: session.senderUsesCanvasVideo,
      hasRelayVideoFrame: session.hasRelayVideoFrame,
      hasRelayStream: Boolean(session.relayMediaStream),
      hasP2PTracks: session.p2pStream.getTracks().length > 0
    });

    if (choice === 'p2p') {
      return session.p2pStream;
    }
    if (choice === 'relay') {
      return session.relayMediaStream;
    }
    return null;
  }

  private buildParticipantsSnapshot(): Partial<WebRTCState> {
    const list: RemoteParticipant[] = Array.from(this.peers.values()).map(session => {
      const activeStream = this.selectPeerStream(session);

      const expectsVideo = session.isCameraActive || session.isScreenSharing;
      return {
        peerId: session.peerId,
        userId: session.userId,
        name: session.name,
        avatarUrl: session.avatarUrl,
        device: session.device,
        isCameraActive: session.isCameraActive,
        isMicActive: session.isMicActive,
        isScreenSharing: session.isScreenSharing,
        connectionStatus: session.connectionStatus,
        stream: activeStream,
        streamVersion: session.streamVersion,
        audioLevel: session.audioLevel,
        isTyping: session.isTyping,
        relayFrameUrl: expectsVideo ? session.relayFrameUrl : null,
        hasLiveP2PVideo: session.hasUnmutedP2PVideo && !session.senderUsesCanvasVideo
      };
    });

    const primary = list[0] || null;
    const anyConnected = list.some(p => p.connectionStatus === 'connected') || list.length > 0;
    const maxRemoteAudio = list.reduce((m, p) => Math.max(m, p.audioLevel), 0);

    return {
      remoteParticipants: list,
      connectionStatus: anyConnected ? 'connected' : 'disconnected',
      remoteStream: primary ? primary.stream : null,
      remoteStreamVersion: primary ? primary.streamVersion : 0,
      remoteAudioLevel: maxRemoteAudio,
      isPartnerTyping: list.some(p => p.isTyping),
      remoteUser: primary
        ? {
            id: primary.peerId,
            userId: primary.userId,
            name: primary.name,
            avatarUrl: primary.avatarUrl,
            device: primary.device,
            isCameraActive: primary.isCameraActive,
            isMicActive: primary.isMicActive,
            isScreenSharing: primary.isScreenSharing
          }
        : null
    };
  }

  private notifyState(extra?: Partial<WebRTCState>) {
    if (this.isDisposed) return;
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({
        ...this.buildParticipantsSnapshot(),
        ...(extra || {})
      });
    }
  }

  private getOrCreatePeerSession(
    peerId: string,
    info?: {
      userId?: string;
      name?: string;
      avatarUrl?: string;
      device?: 'mobile' | 'desktop';
      isCameraActive?: boolean;
      isMicActive?: boolean;
      isScreenSharing?: boolean;
    }
  ): PeerSession {
    let session = this.peers.get(peerId);
    if (!session) {
      session = {
        peerId,
        userId: info?.userId,
        name: info?.name || 'Participant',
        avatarUrl: info?.avatarUrl || DEFAULT_AVATAR,
        device: info?.device || 'desktop',
        isCameraActive: Boolean(info?.isCameraActive),
        isMicActive: Boolean(info?.isMicActive),
        isScreenSharing: Boolean(info?.isScreenSharing),
        connectionStatus: 'connected',
        streamVersion: 1,
        audioLevel: 0,
        isTyping: false,
        typingTimeoutId: null,
        pc: null,
        dataChannel: null,
        makingOffer: false,
        isAnswering: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
        pendingCandidates: [],
        p2pStream: new MediaStream(),
        outputStream: new MediaStream(),
        hasUnmutedP2PVideo: false,
        hasUnmutedP2PAudio: false,
        senderUsesCanvasVideo: false,
        p2pVideoConfirmedByPeer: false,
        p2pAudioConfirmedByPeer: false,
        relayReceiveCanvas: null,
        relayDecodeImg: null,
        relayMediaStream: null,
        relayAudioDest: null,
        relayFrameUrl: null,
        hasRelayVideoFrame: false,
        nextRelayAudioTime: 0,
        remoteAnalyser: null,
        activeSource: 'none'
      };
      this.peers.set(peerId, session);
    } else if (info) {
      if (info.userId !== undefined) session.userId = info.userId;
      if (info.name) session.name = info.name;
      if (info.avatarUrl) session.avatarUrl = info.avatarUrl;
      if (info.device) session.device = info.device;
      if (info.isCameraActive !== undefined) session.isCameraActive = Boolean(info.isCameraActive);
      if (info.isMicActive !== undefined) session.isMicActive = Boolean(info.isMicActive);
      if (info.isScreenSharing !== undefined) session.isScreenSharing = Boolean(info.isScreenSharing);
    }
    return session;
  }

  private disposePeerSession(peerId: string) {
    const session = this.peers.get(peerId);
    if (!session) return;

    if (session.typingTimeoutId) {
      clearTimeout(session.typingTimeoutId);
      session.typingTimeoutId = null;
    }
    if (session.dataChannel) {
      try {
        session.dataChannel.close();
      } catch {}
      session.dataChannel = null;
    }
    if (session.pc) {
      session.pc.ontrack = null;
      session.pc.onicecandidate = null;
      session.pc.onconnectionstatechange = null;
      session.pc.onnegotiationneeded = null;
      try {
        session.pc.close();
      } catch {}
      session.pc = null;
    }
    session.p2pStream.getTracks().forEach(t => t.stop());
    if (session.relayMediaStream) {
      session.relayMediaStream.getTracks().forEach(t => t.stop());
      session.relayMediaStream = null;
    }
    session.relayReceiveCanvas = null;
    session.relayDecodeImg = null;
    session.relayAudioDest = null;
    session.relayFrameUrl = null;
    session.hasRelayVideoFrame = false;
    session.remoteAnalyser = null;

    this.peers.delete(peerId);
  }

  /**
   * Real-Time WebSocket Signaling Connection with Auto-Reconnect & Keepalive
   */
  private initSocketSignaling() {
    if (typeof window === 'undefined' || this.isDisposed) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.log(`Connecting signaling to ${wsUrl}...`);
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        if (this.isDisposed) {
          ws.close();
          return;
        }
        this.log('Signaling channel connected.');
        if (this.pollIntervalId) {
          clearInterval(this.pollIntervalId);
          this.pollIntervalId = null;
        }

        const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        this.sendWsMessage({
          type: 'register-user',
          peerId: this.peerId,
          isCameraActive: this.isCameraOn,
          isMicActive: this.isMicOn,
          isScreenSharing: this.isScreenOn,
          user: {
            id: this.currentUser.id,
            name: this.currentUser.name,
            avatarUrl: this.currentUser.avatarUrl,
            device: isMobileDevice ? 'mobile' : 'desktop'
          }
        });

        this.sendWsMessage({
          type: 'join-room',
          roomId: this.roomId,
          peerId: this.peerId,
          roomMeta: this.roomMeta,
          isCameraActive: this.isCameraOn,
          isMicActive: this.isMicOn,
          isScreenSharing: this.isScreenOn,
          user: {
            id: this.currentUser.id,
            name: this.currentUser.name,
            avatarUrl: this.currentUser.avatarUrl,
            device: isMobileDevice ? 'mobile' : 'desktop'
          }
        });

        if (this.wsKeepAliveId) clearInterval(this.wsKeepAliveId);
        this.wsKeepAliveId = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      ws.onmessage = async (event) => {
        if (this.isDisposed) return;
        try {
          const payload = JSON.parse(event.data);
          await this.handleSignalingMessage(payload);
        } catch (err) {
          console.warn('Signaling message parsing error:', err);
        }
      };

      ws.onclose = () => {
        if (this.wsKeepAliveId) {
          clearInterval(this.wsKeepAliveId);
          this.wsKeepAliveId = null;
        }
        if (this.isDisposed) return;

        this.log('Signaling socket disconnected. Reconnecting & enabling HTTP relay...');
        this.startHttpPollingFallback();
        if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
        this.wsReconnectTimer = setTimeout(() => {
          if (!this.isDisposed) {
            this.initSocketSignaling();
          }
        }, 2000);
      };

      ws.onerror = () => {};
    } catch {
      this.log('WebSocket unavailable. Falling back to HTTP signaling.');
      this.startHttpPollingFallback();
    }
  }

  private sendWsMessage(msg: Record<string, any>) {
    if (this.isDisposed) return;
    const enriched = {
      ...msg,
      roomId: msg.roomId || this.roomId,
      senderId: this.peerId
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(enriched));
    } else if (
      msg.type !== 'ping' &&
      msg.type !== 'leave-room' &&
      msg.type !== 'video-frame' &&
      msg.type !== 'audio-pcm'
    ) {
      fetch('/api/webrtc/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enriched)
      }).catch(err => console.warn('HTTP signal fallback error:', err));
    }
  }

  private startHttpPollingFallback() {
    if (this.pollIntervalId || this.isDisposed) return;
    this.pollIntervalId = setInterval(async () => {
      if (this.isDisposed) return;
      try {
        const res = await fetch(
          `/api/webrtc/poll/${encodeURIComponent(this.roomId)}/${encodeURIComponent(this.peerId)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.signals)) {
            for (const sig of data.signals) {
              await this.handleSignalingMessage(sig);
            }
          }
        }
      } catch {
        // Ignore transient poll error
      }
    }, 1200);
  }

  /**
   * Multi-Party Signaling & Mesh WebRTC Handler
   */
  private async handleSignalingMessage(payload: any) {
    if (this.isDisposed) return;
    const { type, peer, peerId, sdp, candidate, message, senderId, chatHistory, roomMeta } = payload;

    if (senderId && senderId === this.peerId) return;

    switch (type) {
      case 'room-joined': {
        const peerList = Array.isArray(payload.peers) ? payload.peers : [];
        this.log(`Joined room "${this.roomId}". Active participants in room: ${peerList.length + 1}`);

        if (roomMeta && this.onRoomMetaCallback) {
          this.roomMeta = roomMeta;
          this.onRoomMetaCallback(roomMeta);
        }

        if (Array.isArray(chatHistory) && this.onChatHistoryCallback) {
          this.onChatHistoryCallback(chatHistory);
        }

        for (const p of peerList) {
          if (!p || !p.id || p.id === this.peerId) continue;
          this.getOrCreatePeerSession(p.id, {
            userId: p.userId,
            name: p.name,
            avatarUrl: p.avatarUrl,
            device: p.device || 'desktop',
            isCameraActive: Boolean(p.isCameraActive),
            isMicActive: Boolean(p.isMicActive),
            isScreenSharing: Boolean(p.isScreenSharing)
          });
          await this.initPeerConnectionForPeer(p.id);
        }

        this.notifyState();
        if (peerList.length > 0) {
          this.broadcastMediaState();
        }
        if (this.peers.size > 0 && (this.isCameraOn || this.isScreenOn)) {
          setTimeout(() => this.pushRelayVideoFrameNow(), 40);
        }
        break;
      }

      case 'peer-joined': {
        if (!peer || !peer.id || peer.id === this.peerId) return;
        this.log(`Participant "${peer.name}" joined the room!`);

        // Add or update this participant WITHOUT disturbing any other connected peers!
        const existing = this.peers.get(peer.id);
        if (existing && existing.pc) {
          // Only reset THIS specific peer's stale PC if they reconnected under the same peerId
          this.resetSinglePeerConnection(existing);
        }

        const session = this.getOrCreatePeerSession(peer.id, {
          userId: peer.userId,
          name: peer.name,
          avatarUrl: peer.avatarUrl,
          device: peer.device || 'desktop',
          isCameraActive: Boolean(peer.isCameraActive),
          isMicActive: Boolean(peer.isMicActive),
          isScreenSharing: Boolean(peer.isScreenSharing)
        });
        session.p2pVideoConfirmedByPeer = false;
        session.p2pAudioConfirmedByPeer = false;

        this.notifyState();
        this.broadcastMediaState();
        if (this.isCameraOn || this.isScreenOn) {
          setTimeout(() => this.pushRelayVideoFrameNow(), 40);
        }

        if (payload.shouldOffer) {
          await this.initPeerConnectionForPeer(peer.id);
          await this.negotiateWithPeer(peer.id);
        }
        break;
      }

      case 'peer-left': {
        const departingId = peerId || senderId;
        if (!departingId || !this.peers.has(departingId)) return;
        const name = this.peers.get(departingId)?.name || 'Participant';
        this.log(`${name} left the room.`);
        this.disposePeerSession(departingId);
        this.notifyState();
        break;
      }

      case 'offer':
      case 'answer': {
        if (!sdp || !senderId) return;
        const session = this.getOrCreatePeerSession(senderId);
        const pc = await this.initPeerConnectionForPeer(senderId);
        const description = new RTCSessionDescription(sdp);
        const polite = isPolitePeer(this.peerId, senderId);

        const readyForOffer =
          !session.makingOffer &&
          (pc.signalingState === 'stable' || session.isSettingRemoteAnswerPending);
        const offerCollision = description.type === 'offer' && !readyForOffer;

        session.ignoreOffer = !polite && offerCollision;
        if (session.ignoreOffer) {
          this.log(`Ignored colliding SDP offer with ${session.name} (impolite peer wins glare).`);
          return;
        }

        try {
          session.isSettingRemoteAnswerPending = description.type === 'answer';
          if (description.type === 'offer') {
            session.isAnswering = true;
          }
          if (offerCollision) {
            await pc.setLocalDescription({ type: 'rollback' });
          }
          await pc.setRemoteDescription(description);
          session.isSettingRemoteAnswerPending = false;

          await this.flushPendingIceCandidates(session);

          if (description.type === 'offer') {
            await this.syncTracksWithSinglePeer(session, false);

            const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
            for (const t of transceivers) {
              if (
                t.direction !== 'stopped' &&
                t.currentDirection !== 'stopped' &&
                (t.receiver?.track?.kind === 'audio' || t.receiver?.track?.kind === 'video')
              ) {
                t.direction = 'sendrecv';
              }
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            this.sendWsMessage({
              type: 'answer',
              targetId: senderId,
              sdp: pc.localDescription
            });
          }
        } catch (err) {
          session.isSettingRemoteAnswerPending = false;
          console.warn(`Error handling SDP with ${session.name}:`, err);
        } finally {
          session.isAnswering = false;
        }
        break;
      }

      case 'candidate': {
        if (!candidate || !senderId) return;
        const session = this.getOrCreatePeerSession(senderId);
        if (session.ignoreOffer) return;

        if (session.pc && session.pc.remoteDescription && session.pc.remoteDescription.type) {
          try {
            await session.pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            if (!session.ignoreOffer) {
              console.warn('Error adding ICE candidate:', err);
            }
          }
        } else {
          session.pendingCandidates.push(candidate);
        }
        break;
      }

      case 'media-state': {
        if (!senderId) return;
        const session = this.getOrCreatePeerSession(senderId, {
          name: payload.senderName,
          avatarUrl: payload.senderAvatar
        });
        session.isCameraActive = Boolean(payload.isCameraActive);
        session.isMicActive = Boolean(payload.isMicActive);
        session.isScreenSharing = Boolean(payload.isScreenSharing);
        if (payload.isCanvasVideo !== undefined) {
          session.senderUsesCanvasVideo = Boolean(payload.isCanvasVideo);
        }
        if (!session.isCameraActive && !session.isScreenSharing) {
          session.hasRelayVideoFrame = false;
          session.relayFrameUrl = null;
          if (session.relayMediaStream && session.relayMediaStream.getVideoTracks().length > 0) {
            const audioTracks = session.relayMediaStream.getAudioTracks();
            session.relayMediaStream.getVideoTracks().forEach(t => t.stop());
            session.relayMediaStream = audioTracks.length > 0 ? new MediaStream(audioTracks) : null;
          }
        }
        session.streamVersion += 1;
        this.notifyState();
        break;
      }

      case 'typing': {
        if (!senderId) return;
        const session = this.getOrCreatePeerSession(senderId, {
          name: payload.senderName
        });
        session.isTyping = Boolean(payload.isTyping);
        if (session.typingTimeoutId) clearTimeout(session.typingTimeoutId);
        if (payload.isTyping) {
          session.typingTimeoutId = setTimeout(() => {
            session.isTyping = false;
            this.notifyState();
          }, 3500);
        }
        this.notifyState();
        break;
      }

      case 'p2p-media-ready': {
        if (!senderId) return;
        const session = this.peers.get(senderId);
        if (!session) return;
        if (payload.kind === 'video') {
          session.p2pVideoConfirmedByPeer = true;
        } else if (payload.kind === 'audio') {
          session.p2pAudioConfirmedByPeer = true;
        }
        break;
      }

      case 'p2p-media-paused': {
        if (!senderId) return;
        const session = this.peers.get(senderId);
        if (!session) return;
        if (payload.kind === 'video') {
          session.p2pVideoConfirmedByPeer = false;
          if (this.isCameraOn || this.isScreenOn) {
            setTimeout(() => this.pushRelayVideoFrameNow(), 20);
          }
        } else if (payload.kind === 'audio') {
          session.p2pAudioConfirmedByPeer = false;
        }
        break;
      }

      case 'video-frame': {
        if (!senderId || !payload.frame) return;
        const session = this.getOrCreatePeerSession(senderId, {
          name: payload.senderName,
          avatarUrl: payload.senderAvatar
        });
        if (payload.isCameraActive !== undefined) {
          session.isCameraActive = Boolean(payload.isCameraActive);
        } else if (!session.isCameraActive && !session.isScreenSharing) {
          session.isCameraActive = true;
        }
        if (payload.isScreenSharing !== undefined) {
          session.isScreenSharing = Boolean(payload.isScreenSharing);
        }
        if (payload.isCanvasVideo !== undefined) {
          session.senderUsesCanvasVideo = Boolean(payload.isCanvasVideo);
        }
        if (!session.hasUnmutedP2PVideo || session.senderUsesCanvasVideo) {
          this.handleIncomingRelayVideoFrame(session, payload.frame);
        }
        break;
      }

      case 'audio-pcm': {
        if (!senderId || !payload.pcm) return;
        const session = this.getOrCreatePeerSession(senderId, {
          name: payload.senderName
        });
        if (!session.hasUnmutedP2PAudio) {
          this.handleIncomingRelayAudioPcm(session, payload.pcm, payload.sampleRate || 16000);
        }
        break;
      }

      case 'chat-message': {
        if (message && this.onChatMessageCallback) {
          if (senderId && this.peers.has(senderId)) {
            this.peers.get(senderId)!.isTyping = false;
            this.notifyState();
          }
          this.onChatMessageCallback(message);
        }
        break;
      }

      case 'video-reaction': {
        const raw = payload.reaction;
        if (raw && raw.id && raw.emoji && this.onReactionCallback) {
          const reactionSenderId = raw.senderId || senderId;
          if (!reactionSenderId || reactionSenderId === this.peerId) {
            break;
          }
          const now = Date.now();
          this.onReactionCallback({
            id: String(raw.id),
            emoji: String(raw.emoji),
            label: String(raw.label || 'Reaction'),
            senderId: reactionSenderId,
            senderName: String(
              raw.senderName || this.peers.get(reactionSenderId)?.name || 'Participant'
            ),
            createdAt: Number(raw.createdAt) || now,
            expiresAt: now + VIDEO_REACTION_TTL_MS,
            offsetPercent:
              typeof raw.offsetPercent === 'number' && Number.isFinite(raw.offsetPercent)
                ? raw.offsetPercent
                : computeReactionHorizontalOffset(String(raw.id))
          });
        }
        break;
      }
    }
  }

  private async flushPendingIceCandidates(session: PeerSession) {
    if (!session.pc || !session.pc.remoteDescription) return;
    while (session.pendingCandidates.length > 0) {
      const cand = session.pendingCandidates.shift();
      if (cand) {
        try {
          await session.pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn('Error applying buffered ICE candidate:', err);
        }
      }
    }
  }

  private resetSinglePeerConnection(session: PeerSession) {
    session.pendingCandidates = [];
    session.makingOffer = false;
    session.isAnswering = false;
    session.ignoreOffer = false;
    session.isSettingRemoteAnswerPending = false;
    session.p2pVideoConfirmedByPeer = false;
    session.p2pAudioConfirmedByPeer = false;
    session.hasUnmutedP2PVideo = false;
    session.hasUnmutedP2PAudio = false;
    if (session.activeSource === 'p2p') {
      session.activeSource = session.relayMediaStream ? 'relay' : 'none';
    }
    if (session.dataChannel) {
      try {
        session.dataChannel.close();
      } catch {}
      session.dataChannel = null;
    }
    if (session.pc) {
      session.pc.ontrack = null;
      session.pc.onicecandidate = null;
      session.pc.onconnectionstatechange = null;
      session.pc.onnegotiationneeded = null;
      try {
        session.pc.close();
      } catch {}
      session.pc = null;
    }
    session.p2pStream = new MediaStream();
  }

  private async refreshAvailableVideoDevices(): Promise<Array<{ deviceId: string; label: string }>> {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
        return this.availableVideoDevices;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${idx + 1}`
        }));
      this.availableVideoDevices = cams;
      return cams;
    } catch {
      return this.availableVideoDevices;
    }
  }

  private stopLocalVideoTracksOnly() {
    this.fallbackSourceCanvas = null;
    if (this.fallbackCanvasIntervalId !== null) {
      clearInterval(this.fallbackCanvasIntervalId);
      this.fallbackCanvasIntervalId = null;
    }
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
    }
  }

  private stopLocalAudioTracksOnly() {
    if (this.fallbackOscillator) {
      try {
        this.fallbackOscillator.stop();
        this.fallbackOscillator.disconnect();
      } catch {}
      this.fallbackOscillator = null;
    }
    if (this.fallbackAudioCtx && this.fallbackAudioCtx.state !== 'closed') {
      this.fallbackAudioCtx.close().catch(() => {});
      this.fallbackAudioCtx = null;
    }
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
    }
  }

  private async acquireBestAudioTrack(): Promise<MediaStreamTrack | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return null;
    }
    const attempts: Array<MediaTrackConstraints | true> = [
      { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      true
    ];
    for (const audioConstraint of attempts) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint, video: false });
        const track = s.getAudioTracks()[0] || null;
        if (track) return track;
      } catch {
        // Try simpler constraint
      }
    }
    return null;
  }

  private async acquireBestCameraTrack(
    facingMode: 'user' | 'environment',
    preferredDeviceId?: string | null
  ): Promise<{ track: MediaStreamTrack | null; error: string | null }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return {
        track: null,
        error: classifyCameraError(new DOMException('MediaDevices unavailable', 'SecurityError')).message
      };
    }

    const attempts = buildCameraConstraintAttempts(facingMode, preferredDeviceId);
    let lastError: unknown = null;

    for (const videoConstraint of attempts) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: false
        });
        const track = s.getVideoTracks()[0] || null;
        if (track) {
          return { track, error: null };
        }
      } catch (err: any) {
        lastError = err;
        // Stop any active local video track locking the hardware and retry once after brief hardware release delay
        if (err?.name === 'NotReadableError' || err?.name === 'AbortError' || err?.name === 'TrackStartError') {
          this.stopLocalVideoTracksOnly();
          await new Promise((resolve) => setTimeout(resolve, 200));
          try {
            const retryStream = await navigator.mediaDevices.getUserMedia({
              video: videoConstraint,
              audio: false
            });
            const retryTrack = retryStream.getVideoTracks()[0] || null;
            if (retryTrack) {
              return { track: retryTrack, error: null };
            }
          } catch (retryErr) {
            lastError = retryErr;
          }
        }
        // If user explicitly denied permission or there is no camera hardware at all, stop trying further constraints
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.name === 'NotFoundError') {
          break;
        }
      }
    }

    return {
      track: null,
      error: classifyCameraError(lastError).message
    };
  }

  /**
   * Initializes local camera & microphone ('audio-only' or 'video-and-audio') while preserving
   * any active screen share or existing live audio track so camera toggles never drop voice or race.
   */
  public async startLocalMedia(
    mode: 'audio-only' | 'video-and-audio' = 'video-and-audio',
    facingMode: 'user' | 'environment' = this.currentFacingMode,
    preferredDeviceId: string | null = this.selectedVideoDeviceId
  ): Promise<MediaStream> {
    this.resumeAudioContext();
    const requestSeq = ++this.mediaRequestSeq;
    const wantVideo = mode === 'video-and-audio';
    const wantAudio = true;

    this.currentFacingMode = facingMode;
    this.selectedVideoDeviceId = preferredDeviceId;

    const existingLiveAudio = this.localStream
      ?.getAudioTracks()
      .find((t) => t.readyState === 'live') || null;
    const existingLiveRealVideo =
      !this.usedVirtualVideo
        ? this.localStream?.getVideoTracks().find((t) => t.readyState === 'live') || null
        : null;

    let audioTrack: MediaStreamTrack | null = existingLiveAudio;
    let videoTrack: MediaStreamTrack | null = null;
    let usedVirtualVideo = false;
    let cameraError: string | null = null;
    let combinedTried = false;

    this.log(`Starting ${wantVideo ? 'Camera & Microphone' : 'Microphone'}...`);

    // Fast path: if starting both fresh, try single combined prompt first so browser asks once
    if (
      wantVideo &&
      !existingLiveAudio &&
      !existingLiveRealVideo &&
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices?.getUserMedia
    ) {
      combinedTried = true;
      const primaryConstraint = preferredDeviceId
        ? { deviceId: { exact: preferredDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } };
      try {
        const combined = await navigator.mediaDevices.getUserMedia({
          video: primaryConstraint,
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        if (requestSeq !== this.mediaRequestSeq || this.isDisposed) {
          combined.getTracks().forEach((t) => t.stop());
          return this.localStream || new MediaStream();
        }
        videoTrack = combined.getVideoTracks()[0] || null;
        audioTrack = combined.getAudioTracks()[0] || null;
      } catch {
        // Fall through to independent camera & audio waterfalls below
      }
    }

    if (wantAudio && !audioTrack) {
      audioTrack = await this.acquireBestAudioTrack();
      if (requestSeq !== this.mediaRequestSeq || this.isDisposed) {
        audioTrack?.stop();
        videoTrack?.stop();
        return this.localStream || new MediaStream();
      }
    }

    if (wantVideo && !videoTrack) {
      // Stop old physical video track before opening another facingMode/deviceId if needed
      if (existingLiveRealVideo && preferredDeviceId !== undefined) {
        this.stopLocalVideoTracksOnly();
      }
      const camResult = await this.acquireBestCameraTrack(facingMode, preferredDeviceId);
      if (requestSeq !== this.mediaRequestSeq || this.isDisposed) {
        camResult.track?.stop();
        if (audioTrack && audioTrack !== existingLiveAudio) audioTrack.stop();
        return this.localStream || new MediaStream();
      }
      videoTrack = camResult.track;
      cameraError = camResult.error;
    } else if (!wantVideo && this.localStream) {
      this.stopLocalVideoTracksOnly();
    }

    if (requestSeq !== this.mediaRequestSeq || this.isDisposed) {
      videoTrack?.stop();
      if (audioTrack && audioTrack !== existingLiveAudio) audioTrack.stop();
      return this.localStream || new MediaStream();
    }

    const needFallbackVideo = wantVideo && !videoTrack;
    const needFallbackAudio = wantAudio && !audioTrack;
    if (needFallbackVideo) {
      usedVirtualVideo = true;
    }

    if (needFallbackVideo || needFallbackAudio) {
      const fallback = this.createFallbackStream(needFallbackVideo, needFallbackAudio);
      if (needFallbackVideo && !videoTrack) {
        videoTrack = fallback.getVideoTracks()[0] || null;
      }
      if (needFallbackAudio && !audioTrack) {
        audioTrack = fallback.getAudioTracks()[0] || null;
      }
    }

    // Stop any previous video tracks we are replacing (keep existingLiveAudio if reused)
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((t) => {
        if (t !== videoTrack) {
          t.onended = null;
          t.stop();
        }
      });
      this.localStream.getAudioTracks().forEach((t) => {
        if (t !== audioTrack) {
          t.onended = null;
          t.stop();
        }
      });
    }

    const finalTracks: MediaStreamTrack[] = [];
    if (audioTrack) finalTracks.push(audioTrack);
    if (videoTrack) finalTracks.push(videoTrack);

    const combinedStream = new MediaStream(finalTracks);
    const keepMicActive = existingLiveAudio ? this.isMicOn : true;
    this.isMicOn = keepMicActive && Boolean(audioTrack);
    this.isCameraOn = wantVideo && Boolean(videoTrack);
    this.usedVirtualVideo = usedVirtualVideo;
    this.cameraError = wantVideo ? (usedVirtualVideo ? cameraError : null) : null;

    combinedStream.getAudioTracks().forEach((t) => {
      t.enabled = this.isMicOn;
    });
    combinedStream.getVideoTracks().forEach((t) => {
      t.enabled = this.isCameraOn;
      t.onended = () => {
        if (this.localStream === combinedStream && this.isCameraOn && !this.isDisposed) {
          this.isCameraOn = false;
          this.log('Camera stream ended by browser or device.');
          this.refreshOutgoingMediaRelay();
          this.syncTracksWithAllPeers(true).catch(() => {});
          this.notifyState({
            isCameraActive: false,
            localStream: new MediaStream(this.localStream.getAudioTracks())
          });
          this.broadcastMediaState();
        }
      };
    });

    if (videoTrack && !usedVirtualVideo) {
      const settings = videoTrack.getSettings?.();
      if (settings?.deviceId) {
        this.selectedVideoDeviceId = settings.deviceId;
      }
      if (!combinedTried) {
        this.log('Physical camera activated successfully.');
      }
    } else if (cameraError) {
      this.log(`Camera fallback active: ${cameraError}`);
    }

    await this.refreshAvailableVideoDevices();
    if (requestSeq !== this.mediaRequestSeq || this.isDisposed) {
      return this.localStream || combinedStream;
    }

    const resolutionLabel =
      wantVideo && !usedVirtualVideo
        ? (() => {
            const s = videoTrack?.getSettings?.();
            return s?.width && s?.height ? `${s.width}x${s.height} (Live Camera)` : 'Live Camera Stream';
          })()
        : wantVideo
          ? 'Virtual Camera Fallback'
          : 'Live Voice Active';

    this.localStream = combinedStream;

    this.peers.forEach((s) => {
      s.p2pVideoConfirmedByPeer = false;
      s.p2pAudioConfirmedByPeer = false;
    });

    this.setupLocalAudioAnalyser(combinedStream);
    this.refreshOutgoingMediaRelay();

    this.notifyState({
      hasMediaPermission: true,
      isCameraActive: this.isCameraOn,
      isMicActive: this.isMicOn,
      isScreenSharing: this.isScreenOn,
      screenShareMode: this.screenShareMode,
      isVirtualCamera: this.usedVirtualVideo,
      cameraError: this.cameraError,
      availableVideoDevices: this.availableVideoDevices,
      selectedVideoDeviceId: this.selectedVideoDeviceId,
      facingMode,
      localStream: combinedStream,
      screenStream: this.screenStream,
      resolution: resolutionLabel
    });

    await this.syncTracksWithAllPeers(true);
    this.broadcastMediaState();

    return combinedStream;
  }

  private getActiveOutgoingVideoTrack(): MediaStreamTrack | null {
    if (this.isScreenOn && this.screenStream) {
      const st = this.screenStream.getVideoTracks()[0];
      if (st && st.readyState === 'live') return st;
    }
    if (this.isCameraOn && this.localStream) {
      const ct = this.localStream.getVideoTracks()[0];
      if (ct && ct.readyState === 'live') return ct;
    }
    return null;
  }

  private getActiveOutgoingAudioTrack(): MediaStreamTrack | null {
    if (this.localStream) {
      const at = this.localStream.getAudioTracks()[0];
      if (at && at.readyState === 'live') return at;
    }
    return null;
  }

  private async syncTracksWithAllPeers(triggerNegotiation: boolean = true) {
    for (const session of this.peers.values()) {
      await this.initPeerConnectionForPeer(session.peerId);
      await this.syncTracksWithSinglePeer(session, triggerNegotiation);
    }
  }

  private async syncTracksWithSinglePeer(session: PeerSession, triggerNegotiation: boolean = true) {
    const pc = session.pc;
    if (!pc) return;

    let needsRenegotiation = false;
    const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];

    const activeVideoTrack = this.getActiveOutgoingVideoTrack();
    const activeAudioTrack = this.getActiveOutgoingAudioTrack();
    const containerStream =
      (this.isScreenOn && this.screenStream) || this.localStream || new MediaStream();

    const pairs: Array<{ kind: 'audio' | 'video'; track: MediaStreamTrack | null }> = [
      { kind: 'audio', track: activeAudioTrack },
      { kind: 'video', track: activeVideoTrack }
    ];

    for (const { kind, track } of pairs) {
      const nonStopped = transceivers.filter(
        t => t.direction !== 'stopped' && t.currentDirection !== 'stopped' && t.receiver?.track?.kind === kind
      );
      const matchingTransceiver = nonStopped.find(t => t.mid !== null) || nonStopped[0];

      if (matchingTransceiver) {
        if (matchingTransceiver.direction !== 'sendrecv') {
          matchingTransceiver.direction = 'sendrecv';
          needsRenegotiation = true;
        }
        if (
          matchingTransceiver.currentDirection &&
          matchingTransceiver.currentDirection !== 'sendrecv'
        ) {
          needsRenegotiation = true;
        }
        if (matchingTransceiver.sender.track !== track) {
          try {
            await matchingTransceiver.sender.replaceTrack(track);
          } catch (err) {
            console.warn(`replaceTrack(${kind}) warning:`, err);
          }
        }
      } else if (track) {
        try {
          pc.addTransceiver(track, {
            direction: 'sendrecv',
            streams: [containerStream]
          });
          needsRenegotiation = true;
        } catch {
          try {
            pc.addTrack(track, containerStream);
            needsRenegotiation = true;
          } catch (err) {
            console.warn(`addTrack(${kind}) warning:`, err);
          }
        }
      }
    }

    if (
      triggerNegotiation &&
      pc.signalingState === 'stable' &&
      (needsRenegotiation || !pc.currentRemoteDescription)
    ) {
      await this.negotiateWithPeer(session.peerId);
    }
  }

  private broadcastMediaState() {
    const isCanvasVideo = this.isScreenOn
      ? this.screenShareMode === 'presentation-board'
      : this.usedVirtualVideo;
    this.sendWsMessage({
      type: 'media-state',
      senderName: this.currentUser.name,
      senderAvatar: this.currentUser.avatarUrl,
      isCameraActive: this.isCameraOn,
      isMicActive: this.isMicOn,
      isScreenSharing: this.isScreenOn,
      isCanvasVideo
    });
  }

  public async switchCamera(): Promise<'user' | 'environment'> {
    const devices = await this.refreshAvailableVideoDevices();
    let nextDeviceId: string | null = this.selectedVideoDeviceId;
    const newMode = this.currentFacingMode === 'user' ? 'environment' : 'user';

    if (devices.length > 1) {
      const currentIdx = devices.findIndex((d) => d.deviceId === this.selectedVideoDeviceId);
      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % devices.length : 1;
      nextDeviceId = devices[nextIdx].deviceId;
      this.log(`Switching camera to ${devices[nextIdx].label}...`);
    } else {
      nextDeviceId = null;
      this.log(`Switching camera to ${newMode === 'user' ? 'Front' : 'Rear'}...`);
    }

    this.currentFacingMode = newMode;
    this.selectedVideoDeviceId = nextDeviceId;
    if (this.isCameraOn) {
      this.stopLocalVideoTracksOnly();
      await this.startLocalMedia('video-and-audio', newMode, nextDeviceId);
    } else {
      this.notifyState({ facingMode: newMode, selectedVideoDeviceId: nextDeviceId });
    }
    return newMode;
  }

  public async retryPhysicalCamera(): Promise<boolean> {
    this.stopLocalVideoTracksOnly();
    await this.startLocalMedia('video-and-audio', this.currentFacingMode, this.selectedVideoDeviceId);
    return this.isCameraOn && !this.usedVirtualVideo;
  }

  /**
   * Initializes a dedicated RTCPeerConnection for a specific participant in the room mesh
   */
  public async initPeerConnectionForPeer(targetPeerId: string): Promise<RTCPeerConnection> {
    const session = this.getOrCreatePeerSession(targetPeerId);
    if (session.pc) return session.pc;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    session.pc = pc;

    pc.ontrack = (event) => {
      const track = event.track;
      const existingTracks = session.p2pStream.getTracks().filter(existing => existing.id !== track.id && existing.kind !== track.kind);
      session.p2pStream = new MediaStream([...existingTracks, track]);

      const activateP2PTrack = () => {
        if (this.isDisposed || !this.peers.has(targetPeerId)) return;
        if (track.kind === 'video') {
          if (session.senderUsesCanvasVideo) {
            return;
          }
          session.hasUnmutedP2PVideo = true;
          this.sendWsMessage({
            type: 'p2p-media-ready',
            targetId: targetPeerId,
            kind: 'video'
          });
        } else if (track.kind === 'audio') {
          session.hasUnmutedP2PAudio = true;
          this.setupRemotePeerAudioAnalyser(session, session.p2pStream);
          const usingP2PStream =
            !(session.isCameraActive || session.isScreenSharing) ||
            (session.hasUnmutedP2PVideo && !session.senderUsesCanvasVideo);
          if (usingP2PStream) {
            this.sendWsMessage({
              type: 'p2p-media-ready',
              targetId: targetPeerId,
              kind: 'audio'
            });
          }
        }

        session.connectionStatus = 'connected';
        session.streamVersion += 1;
        this.notifyState();
      };

      const pauseP2PTrack = () => {
        if (this.isDisposed || !this.peers.has(targetPeerId)) return;
        if (track.kind === 'video') {
          session.hasUnmutedP2PVideo = false;
        } else if (track.kind === 'audio') {
          session.hasUnmutedP2PAudio = false;
        }
        this.sendWsMessage({
          type: 'p2p-media-paused',
          targetId: targetPeerId,
          kind: track.kind
        });
        session.streamVersion += 1;
        this.notifyState();
      };

      track.onunmute = () => {
        this.log(`Direct P2P ${track.kind} live with ${session.name}.`);
        activateP2PTrack();
      };
      track.onmute = pauseP2PTrack;
      track.onended = pauseP2PTrack;

      if (!track.muted) {
        activateP2PTrack();
      }
    };

    pc.ondatachannel = (event) => {
      this.setupDataChannelForPeer(session, event.channel);
    };

    pc.onnegotiationneeded = async () => {
      if (
        this.isDisposed ||
        !this.peers.has(targetPeerId) ||
        session.makingOffer ||
        session.isAnswering ||
        pc.signalingState !== 'stable'
      ) {
        return;
      }
      await this.negotiateWithPeer(targetPeerId);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && !this.isDisposed) {
        this.sendWsMessage({
          type: 'candidate',
          targetId: targetPeerId,
          candidate: event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' && !this.isDisposed) {
        pc.restartIce?.();
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState || 'connecting';
      if (state === 'connected') {
        session.connectionStatus = 'connected';
        this.notifyState({ latencyMs: 20 });
      } else if (state === 'failed') {
        session.connectionStatus = 'reconnecting';
        this.notifyState();
      }
    };

    return pc;
  }

  private setupDataChannelForPeer(session: PeerSession, channel: RTCDataChannel) {
    session.dataChannel = channel;
    channel.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        if (packet && packet.type === 'typing') {
          session.isTyping = Boolean(packet.isTyping);
          this.notifyState();
          return;
        }
        if (packet && packet.type === 'video-reaction' && packet.reaction && this.onReactionCallback) {
          const raw = packet.reaction;
          if (raw.id && raw.emoji) {
            const now = Date.now();
            this.onReactionCallback({
              id: String(raw.id),
              emoji: String(raw.emoji),
              label: String(raw.label || 'Reaction'),
              senderId: String(raw.senderId || session.peerId),
              senderName: String(raw.senderName || session.name || 'Participant'),
              createdAt: Number(raw.createdAt) || now,
              expiresAt: now + VIDEO_REACTION_TTL_MS,
              offsetPercent:
                typeof raw.offsetPercent === 'number' && Number.isFinite(raw.offsetPercent)
                  ? raw.offsetPercent
                  : computeReactionHorizontalOffset(String(raw.id))
            });
          }
          return;
        }
        const msg: ChatMessage = packet?.message || packet;
        if (msg && msg.id && this.onChatMessageCallback) {
          session.isTyping = false;
          this.notifyState();
          this.onChatMessageCallback(msg);
        }
      } catch (err) {
        console.warn('DataChannel parse warning:', err);
      }
    };
  }

  public async negotiateWithPeer(targetPeerId: string) {
    if (!targetPeerId || this.isDisposed) return;
    const session = this.getOrCreatePeerSession(targetPeerId);
    const pc = await this.initPeerConnectionForPeer(targetPeerId);

    if (session.makingOffer || pc.signalingState !== 'stable') {
      return;
    }

    try {
      session.makingOffer = true;

      const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
      const audioNonStopped = transceivers.filter(
        t => t.direction !== 'stopped' && t.currentDirection !== 'stopped' && t.receiver?.track?.kind === 'audio'
      );
      const audioTransceiver = audioNonStopped.find(t => t.mid !== null) || audioNonStopped[0];
      if (!audioTransceiver) {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      } else if (audioTransceiver.direction !== 'sendrecv') {
        audioTransceiver.direction = 'sendrecv';
      }

      const videoNonStopped = transceivers.filter(
        t => t.direction !== 'stopped' && t.currentDirection !== 'stopped' && t.receiver?.track?.kind === 'video'
      );
      const videoTransceiver = videoNonStopped.find(t => t.mid !== null) || videoNonStopped[0];
      if (!videoTransceiver) {
        pc.addTransceiver('video', { direction: 'sendrecv' });
      } else if (videoTransceiver.direction !== 'sendrecv') {
        videoTransceiver.direction = 'sendrecv';
      }

      await this.syncTracksWithSinglePeer(session, false);

      if (!session.dataChannel || session.dataChannel.readyState === 'closed') {
        try {
          const dc = pc.createDataChannel('chat');
          this.setupDataChannelForPeer(session, dc);
        } catch {}
      }

      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);

      this.sendWsMessage({
        type: 'offer',
        targetId: targetPeerId,
        sdp: pc.localDescription
      });
    } catch (err) {
      console.warn(`Error negotiating WebRTC offer with ${session.name}:`, err);
    } finally {
      session.makingOffer = false;
    }
  }

  /**
   * Broadcasts typing indicator to ALL connected participants in the room
   */
  public sendTypingStatus(isTyping: boolean) {
    const payload = {
      type: 'typing',
      roomId: this.roomId,
      senderId: this.peerId,
      senderName: this.currentUser.name,
      isTyping
    };

    this.peers.forEach(session => {
      if (session.dataChannel && session.dataChannel.readyState === 'open') {
        try {
          session.dataChannel.send(JSON.stringify(payload));
        } catch {}
      }
    });

    this.sendWsMessage(payload);
  }

  /**
   * Broadcasts an animated emoji reaction overlay to ALL connected participants in the room
   */
  public sendVideoReaction(emoji: string, label: string = 'Reaction'): VideoReactionItem {
    const now = Date.now();
    const id = `rxn_${now}_${Math.random().toString(36).substring(2, 8)}`;
    const reaction: VideoReactionItem = {
      id,
      emoji,
      label,
      senderId: this.peerId,
      senderName: this.currentUser.name || 'You',
      createdAt: now,
      expiresAt: now + VIDEO_REACTION_TTL_MS,
      offsetPercent: computeReactionHorizontalOffset(id)
    };

    const payload = {
      type: 'video-reaction',
      roomId: this.roomId,
      senderId: this.peerId,
      reaction
    };

    const serialized = JSON.stringify(payload);
    this.peers.forEach(session => {
      if (session.dataChannel && session.dataChannel.readyState === 'open') {
        try {
          session.dataChannel.send(serialized);
        } catch {}
      }
    });

    this.sendWsMessage(payload);
    return reaction;
  }

  /**
   * Broadcasts group chat message to ALL connected participants via P2P DataChannels + WebSocket + HTTP persistence
   */
  public sendChatMessage(message: ChatMessage) {
    const authoritativeMessage: ChatMessage = {
      ...message,
      senderId: message.senderId || this.peerId,
      senderName: this.currentUser.name || message.senderName || 'Participant',
      senderAvatar: this.currentUser.avatarUrl
    };

    const serialized = JSON.stringify(authoritativeMessage);
    this.peers.forEach(session => {
      if (session.dataChannel && session.dataChannel.readyState === 'open') {
        try {
          session.dataChannel.send(serialized);
        } catch {}
      }
    });

    this.sendWsMessage({
      type: 'chat-message',
      roomId: this.roomId,
      message: authoritativeMessage
    });

    fetch(`/api/rooms/${encodeURIComponent(this.roomId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: authoritativeMessage })
    }).catch(() => {});
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  private setupLocalAudioAnalyser(stream: MediaStream) {
    try {
      const ctx = this.ensureAudioContext();
      if (!ctx) return;
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const source = ctx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      this.localAnalyser = analyser;
      this.ensureAudioMeterLoop();
    } catch {}
  }

  private setupRemotePeerAudioAnalyser(session: PeerSession, stream: MediaStream) {
    try {
      const ctx = this.ensureAudioContext();
      if (!ctx) return;
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const source = ctx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      session.remoteAnalyser = analyser;
      this.ensureAudioMeterLoop();
    } catch {}
  }

  private ensureAudioMeterLoop() {
    if (this.audioMeterIntervalId) return;
    const dataArray = new Uint8Array(32);

    this.audioMeterIntervalId = setInterval(() => {
      if (this.isDisposed) return;

      let localLevel = 0;
      if (this.localAnalyser && this.isMicOn) {
        this.localAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        localLevel = Math.min(100, Math.round((sum / dataArray.length / 255) * 140));
      }

      this.peers.forEach(session => {
        if (session.remoteAnalyser && session.isMicActive) {
          session.remoteAnalyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          session.audioLevel = Math.min(100, Math.round((sum / dataArray.length / 255) * 140));
        } else {
          session.audioLevel = 0;
        }
      });

      this.notifyState({ audioLevel: localLevel });
    }, 150);
  }

  public toggleMicrophone(): boolean {
    if (!this.localStream) {
      this.startLocalMedia('audio-only', this.currentFacingMode).catch(() => {});
      return true;
    }

    this.isMicOn = !this.isMicOn;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = this.isMicOn;
    });
    this.log(`Microphone ${this.isMicOn ? 'unmuted' : 'muted'}`);
    this.notifyState({ isMicActive: this.isMicOn });
    this.broadcastMediaState();
    return this.isMicOn;
  }

  public async toggleCamera(): Promise<boolean> {
    if (!this.isCameraOn) {
      await this.startLocalMedia('video-and-audio', this.currentFacingMode, this.selectedVideoDeviceId);
      return this.isCameraOn;
    }

    // Turn camera cleanly OFF: release hardware camera LED while keeping live microphone active
    this.stopLocalVideoTracksOnly();
    this.isCameraOn = false;
    this.usedVirtualVideo = false;
    this.cameraError = null;

    const remainingAudioTracks = this.localStream
      ? this.localStream.getAudioTracks().filter((t) => t.readyState === 'live')
      : [];
    const nextStream = remainingAudioTracks.length > 0 ? new MediaStream(remainingAudioTracks) : null;
    this.localStream = nextStream;

    this.peers.forEach((s) => {
      s.p2pVideoConfirmedByPeer = false;
    });
    this.log('Camera turned OFF');
    this.refreshOutgoingMediaRelay();
    await this.syncTracksWithAllPeers(true).catch(() => {});
    this.notifyState({
      isCameraActive: false,
      isVirtualCamera: false,
      cameraError: null,
      localStream: nextStream,
      resolution: this.isMicOn ? 'Live Voice Active' : 'Standby'
    });
    this.broadcastMediaState();
    return false;
  }

  /**
   * Starts or stops Screen Sharing seamlessly from ANY state (even before starting camera/mic!).
   * - Uses native browser/OS getDisplayMedia when available & permitted.
   * - Automatically falls back to a crisp 1280x720 Live Room Presentation Board if the browser/device/iframe
   *   blocks or lacks OS display capture (elapsed < 350ms), while respecting genuine user Cancel clicks!
   */
  public async toggleScreenShare(forcePresentationBoard: boolean = false): Promise<boolean> {
    if (this.isScreenOn) {
      await this.stopScreenShare();
      return false;
    }
    return this.startScreenShare(forcePresentationBoard);
  }

  public async startScreenShare(forcePresentationBoard: boolean = false): Promise<boolean> {
    this.resumeAudioContext();
    this.stopScreenFallbackGenerator();

    let acquiredScreen: MediaStream | null = null;
    let mode: 'native' | 'presentation-board' = 'native';

    if (!forcePresentationBoard && navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      const startTime = performance.now();
      try {
        acquiredScreen = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 20 }
          },
          audio: false
        });
        mode = 'native';
      } catch (err: any) {
        const elapsedMs = performance.now() - startTime;
        const errName = err?.name || '';
        // If picker was open >= 350ms and user clicked Cancel (NotAllowedError / AbortError), respect their Cancel!
        const userExplicitlyCancelledPicker =
          elapsedMs >= 350 && (errName === 'NotAllowedError' || errName === 'AbortError');

        if (userExplicitlyCancelledPicker) {
          this.log('Screen share picker cancelled by user.');
          return false;
        }

        this.log('OS display capture restricted on this browser/device — activating Live Presentation Screen.');
        acquiredScreen = this.createPresentationBoardStream();
        mode = 'presentation-board';
      }
    } else {
      acquiredScreen = this.createPresentationBoardStream();
      mode = 'presentation-board';
    }

    if (!acquiredScreen || acquiredScreen.getVideoTracks().length === 0) {
      return false;
    }

    this.screenStream = acquiredScreen;
    this.isScreenOn = true;
    this.screenShareMode = mode;

    const screenTrack = acquiredScreen.getVideoTracks()[0];
    screenTrack.enabled = true;
    screenTrack.onended = () => {
      if (this.isScreenOn) {
        this.stopScreenShare().catch(() => {});
      }
    };

    // Ensure WebSocket video relay immediately pushes crisp HD screen frames to any peers without direct P2P
    this.peers.forEach(s => {
      if (!s.hasUnmutedP2PVideo) {
        s.p2pVideoConfirmedByPeer = false;
      }
    });

    this.log(
      mode === 'native'
        ? 'Screen sharing active (Live Display Capture).'
        : 'Screen sharing active (Live Room Presentation Board).'
    );

    this.refreshOutgoingMediaRelay();
    await this.syncTracksWithAllPeers(true);

    this.notifyState({
      hasMediaPermission: true,
      isScreenSharing: true,
      screenShareMode: mode,
      screenStream: this.screenStream,
      resolution: mode === 'native' ? '1920x1080 Screen Share' : '1280x720 Presentation Screen'
    });
    this.broadcastMediaState();

    return true;
  }

  public async stopScreenShare(): Promise<void> {
    this.stopScreenFallbackGenerator();
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => {
        t.onended = null;
        t.stop();
      });
      this.screenStream = null;
    }

    this.isScreenOn = false;
    this.screenShareMode = null;
    this.log('Screen sharing stopped.');

    this.refreshOutgoingMediaRelay();
    await this.syncTracksWithAllPeers(true);

    this.notifyState({
      isScreenSharing: false,
      screenShareMode: null,
      screenStream: null,
      localStream: this.localStream,
      resolution: this.isCameraOn ? 'Live Camera Stream' : this.isMicOn ? 'Live Voice Active' : 'Standby'
    });
    this.broadcastMediaState();
  }

  private stopScreenFallbackGenerator() {
    this.screenFallbackCanvas = null;
    if (this.screenFallbackIntervalId !== null) {
      clearInterval(this.screenFallbackIntervalId);
      this.screenFallbackIntervalId = null;
    }
  }

  /**
   * Generates a crisp 1280x720 interactive Room Presentation Screen stream
   * so mobile devices, restricted WebViews, and headless environments can present live notes & phrases effortlessly.
   */
  private createPresentationBoardStream(): MediaStream {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    this.screenFallbackCanvas = canvas;
    const ctx = canvas.getContext('2d')!;
    let tick = 0;

    if (!this.presentationNote && this.roomMeta) {
      this.presentationNote = this.roomMeta.currentTopic || 'Live Group Conversation & Vocabulary Practice';
    }

    const renderBoard = () => {
      if (this.isDisposed) return;
      tick += 1;

      // Crisp dark slate presentation slide background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Top header bar
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, canvas.width, 84);
      ctx.fillStyle = '#4f46e5';
      ctx.fillRect(0, 82, canvas.width, 3);

      // Presenter & Room Title
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillStyle = '#f8fafc';
      const roomTitle = this.roomMeta?.title || `Room ${this.roomId}`;
      ctx.fillText(`Shared Screen  ·  ${roomTitle}`, 44, 42);

      // Live presenter indicator on top-right
      ctx.textAlign = 'right';
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#34d399';
      ctx.fillText(
        `● PRESENTED BY ${(this.currentUser.name || 'HOST').toUpperCase()}  •  ${new Date().toLocaleTimeString()}`,
        canvas.width - 44,
        42
      );

      // Main Topic Card
      ctx.fillStyle = '#131c31';
      ctx.strokeStyle = '#312e81';
      ctx.lineWidth = 2;
      ctx.fillRect(44, 120, canvas.width - 88, 220);
      ctx.strokeRect(44, 120, canvas.width - 88, 220);

      ctx.textAlign = 'left';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillStyle = '#818cf8';
      ctx.fillText('LIVE PRESENTATION TOPIC & SHARED NOTES', 76, 162);

      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      const topicLine = (this.presentationNote || 'Interactive Language Exchange Session').slice(0, 62);
      ctx.fillText(topicLine, 76, 222);

      if ((this.presentationNote || '').length > 62) {
        ctx.font = '26px system-ui, sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(this.presentationNote.slice(62, 134), 76, 274);
      } else {
        ctx.font = '22px system-ui, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(
          `Language: ${this.roomMeta?.languageName || 'Multilingual'}   ·   Level: ${this.roomMeta?.levelRange || 'All Levels'}`,
          76,
          284
        );
      }

      // Key Practice Phrases Grid
      const phrases = this.roomMeta?.suggestedPhrases?.slice(0, 3) || [
        'Welcome everyone! Can everyone see my shared screen?',
        'Let us practice today’s expressions together.',
        'Feel free to jump in on voice or group chat!'
      ];

      phrases.forEach((phrase, idx) => {
        const y = 374 + idx * 96;
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.fillRect(44, y, canvas.width - 88, 78);
        ctx.strokeRect(44, y, canvas.width - 88, 78);

        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = '#34d399';
        ctx.fillText(`0${idx + 1}`, 72, y + 39);

        ctx.font = '23px system-ui, sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(`“${phrase}”`, 122, y + 39);
      });

      // Subtle animated laser pointer indicator showing live real-time frame motion
      const laserX = canvas.width - 140 + Math.cos(tick * 0.18) * 36;
      const laserY = 220 + Math.sin(tick * 0.18) * 28;
      ctx.beginPath();
      ctx.arc(laserX, laserY, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(laserX, laserY, 20, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();
    };

    const stream = canvas.captureStream(15);
    renderBoard();
    this.screenFallbackIntervalId = setInterval(renderBoard, 80);
    return stream;
  }

  private stopOutgoingMediaRelay() {
    if (this.videoRelayIntervalId !== null) {
      clearInterval(this.videoRelayIntervalId);
      this.videoRelayIntervalId = null;
    }
    if (this.relayCaptureVideoEl) {
      this.relayCaptureVideoEl.srcObject = null;
      if (this.relayCaptureVideoEl.parentNode) {
        this.relayCaptureVideoEl.parentNode.removeChild(this.relayCaptureVideoEl);
      }
      this.relayCaptureVideoEl = null;
    }
    if (this.outgoingAudioProcessor) {
      try {
        this.outgoingAudioProcessor.disconnect();
        this.outgoingAudioProcessor.onaudioprocess = null;
      } catch {}
      this.outgoingAudioProcessor = null;
    }
    if (this.outgoingAudioRelayCtx && this.outgoingAudioRelayCtx.state !== 'closed') {
      this.outgoingAudioRelayCtx.close().catch(() => {});
      this.outgoingAudioRelayCtx = null;
    }
  }

  private pushRelayVideoFrameNow() {
    if (
      this.isDisposed ||
      this.peers.size === 0 ||
      !(this.isCameraOn || this.isScreenOn) ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      this.ws.bufferedAmount > 262144 ||
      !this.relayCaptureCanvas
    ) {
      return;
    }

    const captureCtx = this.relayCaptureCanvas.getContext('2d');
    if (!captureCtx) return;

    const isCanvasVideo = this.isScreenOn
      ? this.screenShareMode === 'presentation-board'
      : this.usedVirtualVideo;

    const excludePeerIds: string[] = [];
    let neededCount = 0;
    this.peers.forEach(s => {
      if (shouldRelayVideoToPeer(isCanvasVideo, s.p2pVideoConfirmedByPeer)) {
        neededCount += 1;
      } else {
        excludePeerIds.push(s.peerId);
      }
    });
    if (neededCount === 0) return;

    const directCanvasSource = this.isScreenOn
      ? this.screenFallbackCanvas
      : this.fallbackSourceCanvas;
    const activeSourceEl = directCanvasSource || this.relayCaptureVideoEl;

    if (!activeSourceEl) return;
    if (activeSourceEl instanceof HTMLVideoElement) {
      if (activeSourceEl.paused) {
        activeSourceEl.play().catch(() => {});
      }
      if (activeSourceEl.videoWidth === 0 || activeSourceEl.readyState < 2) {
        return;
      }
      const dims = computeRelayCaptureDimensions(
        activeSourceEl.videoWidth,
        activeSourceEl.videoHeight,
        this.isScreenOn ? 800 : 640,
        this.isScreenOn ? 450 : 480
      );
      if (
        this.relayCaptureCanvas.width !== dims.width ||
        this.relayCaptureCanvas.height !== dims.height
      ) {
        this.relayCaptureCanvas.width = dims.width;
        this.relayCaptureCanvas.height = dims.height;
      }
    } else if (directCanvasSource) {
      const dims = computeRelayCaptureDimensions(
        directCanvasSource.width,
        directCanvasSource.height,
        this.isScreenOn ? 800 : 640,
        this.isScreenOn ? 450 : 480
      );
      if (
        this.relayCaptureCanvas.width !== dims.width ||
        this.relayCaptureCanvas.height !== dims.height
      ) {
        this.relayCaptureCanvas.width = dims.width;
        this.relayCaptureCanvas.height = dims.height;
      }
    }

    try {
      captureCtx.drawImage(
        activeSourceEl,
        0,
        0,
        this.relayCaptureCanvas.width,
        this.relayCaptureCanvas.height
      );
      const quality = this.isScreenOn ? 0.72 : 0.62;
      const frame = this.relayCaptureCanvas.toDataURL('image/jpeg', quality);
      this.ws.send(
        JSON.stringify({
          type: 'video-frame',
          roomId: this.roomId,
          senderId: this.peerId,
          senderName: this.currentUser.name,
          senderAvatar: this.currentUser.avatarUrl,
          isCameraActive: this.isCameraOn,
          isScreenSharing: this.isScreenOn,
          isCanvasVideo,
          excludePeerIds,
          frame
        })
      );
    } catch {}
  }

  /**
   * Starts or updates the single-upload room fan-out media relay for BOTH camera and screen sharing!
   * Uploads at most ONE video/audio stream to the server, which fans it out to all room peers that need relay.
   */
  private refreshOutgoingMediaRelay() {
    this.stopOutgoingMediaRelay();
    if (typeof document === 'undefined') return;

    const hasOutgoingVideo = Boolean(this.isScreenOn && this.screenStream) || Boolean(this.isCameraOn && this.localStream);
    const hasOutgoingAudio = Boolean(this.localStream && this.localStream.getAudioTracks().length > 0);

    if (hasOutgoingVideo) {
      if (!this.relayCaptureCanvas) {
        this.relayCaptureCanvas = document.createElement('canvas');
      }
      this.relayCaptureCanvas.width = this.isScreenOn ? 800 : 640;
      this.relayCaptureCanvas.height = this.isScreenOn ? 450 : 360;

      const activeStream = this.isScreenOn && this.screenStream ? this.screenStream : this.localStream;
      if (activeStream) {
        const vidEl = document.createElement('video');
        vidEl.muted = true;
        vidEl.playsInline = true;
        vidEl.autoplay = true;
        // Keep capture element within viewport bounds so browser visibility culling never pauses decoding
        vidEl.style.cssText =
          'position:fixed;bottom:0;right:0;width:4px;height:4px;opacity:0.01;pointer-events:none;z-index:-1;';
        vidEl.onloadeddata = () => this.pushRelayVideoFrameNow();
        vidEl.oncanplay = () => this.pushRelayVideoFrameNow();
        vidEl.srcObject = activeStream;
        if (document.body) {
          document.body.appendChild(vidEl);
        }
        vidEl.play().catch(() => {});
        this.relayCaptureVideoEl = vidEl;
      }

      this.videoRelayIntervalId = setInterval(() => {
        this.pushRelayVideoFrameNow();
      }, 110);
    }

    if (hasOutgoingAudio && this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        try {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            const audioCtx = new AudioCtx();
            this.outgoingAudioRelayCtx = audioCtx;
            audioCtx.resume().catch(() => {});

            const micSource = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            const silentGain = audioCtx.createGain();
            silentGain.gain.value = 0;

            micSource.connect(processor);
            processor.connect(silentGain);
            silentGain.connect(audioCtx.destination);
            this.outgoingAudioProcessor = processor;

            const targetRate = 16000;
            processor.onaudioprocess = (event) => {
              if (
                this.isDisposed ||
                !this.isMicOn ||
                this.peers.size === 0 ||
                !this.ws ||
                this.ws.readyState !== WebSocket.OPEN ||
                this.ws.bufferedAmount > 262144
              ) {
                return;
              }

              const excludePeerIds: string[] = [];
              let neededCount = 0;
              this.peers.forEach(s => {
                if (s.p2pAudioConfirmedByPeer) {
                  excludePeerIds.push(s.peerId);
                } else {
                  neededCount += 1;
                }
              });
              if (neededCount === 0) return;

              const input = event.inputBuffer.getChannelData(0);
              const ratio = audioCtx.sampleRate / targetRate;
              const outLength = Math.floor(input.length / ratio);
              const pcm16 = new Int16Array(outLength);
              for (let i = 0; i < outLength; i++) {
                const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
              }

              const bytes = new Uint8Array(pcm16.buffer);
              let binary = '';
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const b64 = btoa(binary);

              this.ws.send(
                JSON.stringify({
                  type: 'audio-pcm',
                  roomId: this.roomId,
                  senderId: this.peerId,
                  senderName: this.currentUser.name,
                  excludePeerIds,
                  sampleRate: targetRate,
                  pcm: b64
                })
              );
            };
          }
        } catch {}
      }
    }
  }

  private ensurePeerRelayAudioStream(session: PeerSession): MediaStream {
    const audioCtx = this.ensureAudioContext();
    if (!session.relayMediaStream) {
      const stream = new MediaStream();
      if (audioCtx) {
        if (!session.relayAudioDest) {
          session.relayAudioDest = audioCtx.createMediaStreamDestination();
        }
        session.relayAudioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
        this.setupRemotePeerAudioAnalyser(session, stream);
      }
      session.relayMediaStream = stream;
    } else if (audioCtx && session.relayMediaStream.getAudioTracks().length === 0) {
      if (!session.relayAudioDest) {
        session.relayAudioDest = audioCtx.createMediaStreamDestination();
      }
      const nextStream = new MediaStream([
        ...session.relayAudioDest.stream.getAudioTracks(),
        ...session.relayMediaStream.getVideoTracks()
      ]);
      this.setupRemotePeerAudioAnalyser(session, nextStream);
      session.relayMediaStream = nextStream;
      session.streamVersion += 1;
      this.notifyState();
    }
    return session.relayMediaStream;
  }

  private ensurePeerRelayVideoTrack(session: PeerSession, imgW: number, imgH: number) {
    const targetW = imgW > 0 ? imgW : 640;
    const targetH = imgH > 0 ? imgH : 360;

    if (!session.relayReceiveCanvas) {
      session.relayReceiveCanvas = document.createElement('canvas');
      session.relayReceiveCanvas.width = targetW;
      session.relayReceiveCanvas.height = targetH;
    } else if (
      session.relayReceiveCanvas.width !== targetW ||
      session.relayReceiveCanvas.height !== targetH
    ) {
      session.relayReceiveCanvas.width = targetW;
      session.relayReceiveCanvas.height = targetH;
    }

    return session.relayReceiveCanvas;
  }

  private handleIncomingRelayVideoFrame(session: PeerSession, frameDataUrl: string) {
    if (this.isDisposed || (session.hasUnmutedP2PVideo && !session.senderUsesCanvasVideo)) return;

    if (!session.relayDecodeImg) {
      session.relayDecodeImg = new Image();
      session.relayDecodeImg.onload = () => {
        if (this.isDisposed || !session.relayDecodeImg) return;
        const canvas = this.ensurePeerRelayVideoTrack(
          session,
          session.relayDecodeImg.naturalWidth,
          session.relayDecodeImg.naturalHeight
        );
        const audioStream = this.ensurePeerRelayAudioStream(session);
        const hasVideoTrack = audioStream.getVideoTracks().some(t => t.readyState === 'live');
        let nextVideoTracks = audioStream.getVideoTracks();
        if (!hasVideoTrack) {
          // Initialize captureStream BEFORE drawing so the initial draw paints into the active track
          const canvasStream = canvas.captureStream(15);
          nextVideoTracks = canvasStream.getVideoTracks();
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(session.relayDecodeImg, 0, 0, canvas.width, canvas.height);
        }

        nextVideoTracks.forEach(t => {
          const capTrack = t as MediaStreamTrack & { requestFrame?: () => void };
          if (typeof capTrack.requestFrame === 'function') {
            capTrack.requestFrame();
          }
        });

        session.relayFrameUrl = session.relayDecodeImg.src;
        if (!hasVideoTrack) {
          session.relayMediaStream = new MediaStream([
            ...audioStream.getAudioTracks(),
            ...nextVideoTracks
          ]);
          session.streamVersion += 1;
        }
        session.hasRelayVideoFrame = true;
        session.activeSource = 'relay';
        session.connectionStatus = 'connected';
        this.notifyState();
      };
    }
    session.relayDecodeImg.src = frameDataUrl;
  }

  private handleIncomingRelayAudioPcm(session: PeerSession, b64Pcm: string, sampleRate: number) {
    if (this.isDisposed || session.hasUnmutedP2PAudio) return;
    this.ensurePeerRelayAudioStream(session);

    const audioCtx = this.ensureAudioContext();
    if (!audioCtx || !session.relayAudioDest) return;

    try {
      const binary = atob(b64Pcm);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const pcm16 = new Int16Array(bytes.buffer);
      if (pcm16.length === 0) return;

      const audioBuffer = audioCtx.createBuffer(1, pcm16.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768;
      }

      const src = audioCtx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(session.relayAudioDest);

      const now = audioCtx.currentTime;
      if (session.nextRelayAudioTime < now || session.nextRelayAudioTime > now + 0.35) {
        session.nextRelayAudioTime = now + 0.025;
      }
      src.start(session.nextRelayAudioTime);
      session.nextRelayAudioTime += audioBuffer.duration;

      if (session.activeSource === 'none') {
        session.activeSource = 'relay';
        session.connectionStatus = 'connected';
        session.streamVersion += 1;
        this.notifyState();
      }
    } catch {}
  }

  private stopFallbackGenerators() {
    this.fallbackSourceCanvas = null;
    if (this.fallbackCanvasIntervalId !== null) {
      clearInterval(this.fallbackCanvasIntervalId);
      this.fallbackCanvasIntervalId = null;
    }
    if (this.fallbackOscillator) {
      try {
        this.fallbackOscillator.stop();
        this.fallbackOscillator.disconnect();
      } catch {}
      this.fallbackOscillator = null;
    }
    if (this.fallbackAudioCtx && this.fallbackAudioCtx.state !== 'closed') {
      this.fallbackAudioCtx.close().catch(() => {});
      this.fallbackAudioCtx = null;
    }
  }

  private createFallbackStream(needVideo: boolean, needAudio: boolean): MediaStream {
    const result = new MediaStream();

    if (needVideo) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      this.fallbackSourceCanvas = canvas;
      const ctx = canvas.getContext('2d')!;
      let tick = 0;

      const render = () => {
        if (this.isDisposed) return;
        tick += 1;

        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(0.5, '#0f172a');
        grad.addColorStop(1, '#064e3b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const pulseRadius = 58 + Math.sin(tick * 0.22) * 8;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2 - 22, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2 - 22, 46, 0, Math.PI * 2);
        ctx.fillStyle = '#4f46e5';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#a5b4fc';
        ctx.stroke();

        const initials = (this.currentUser.name || 'Participant')
          .split(' ')
          .map(p => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, canvas.width / 2, canvas.height / 2 - 22);

        const barCount = 9;
        const barWidth = 6;
        const barGap = 5;
        const totalBarsWidth = barCount * barWidth + (barCount - 1) * barGap;
        const startX = (canvas.width - totalBarsWidth) / 2;
        for (let i = 0; i < barCount; i++) {
          const barHeight = 6 + Math.abs(Math.sin(tick * 0.35 + i * 0.7)) * 15;
          ctx.fillStyle = '#34d399';
          ctx.fillRect(startX + i * (barWidth + barGap), canvas.height - 92 - barHeight / 2, barWidth, barHeight);
        }

        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(this.currentUser.name || 'Live Participant', canvas.width / 2, canvas.height - 56);

        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#34d399';
        ctx.fillText(`● LIVE • ${new Date().toLocaleTimeString()}`, canvas.width / 2, canvas.height - 30);
      };

      const canvasStream = canvas.captureStream(15);
      render();
      this.fallbackCanvasIntervalId = setInterval(render, 66);
      canvasStream.getVideoTracks().forEach(t => {
        const capTrack = t as MediaStreamTrack & { requestFrame?: () => void };
        if (typeof capTrack.requestFrame === 'function') {
          capTrack.requestFrame();
        }
        result.addTrack(t);
      });
    }

    if (needAudio) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          this.fallbackAudioCtx = audioCtx;
          audioCtx.resume().catch(() => {});
          const osc = audioCtx.createOscillator();
          this.fallbackOscillator = osc;
          const dst = audioCtx.createMediaStreamDestination();
          const gain = audioCtx.createGain();
          gain.gain.value = 0.012;
          osc.type = 'sine';
          osc.frequency.value = 320;
          osc.connect(gain);
          gain.connect(dst);
          osc.start();
          dst.stream.getAudioTracks().forEach(t => result.addTrack(t));
        }
      } catch {}
    }

    return result;
  }

  public stopLocalMediaOnly() {
    this.mediaRequestSeq += 1;
    this.stopOutgoingMediaRelay();
    this.stopFallbackGenerators();
    this.stopScreenFallbackGenerator();

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => {
        t.onended = null;
        t.stop();
      });
      this.screenStream = null;
    }

    this.peers.forEach(session => {
      if (session.pc) {
        session.pc.getSenders().forEach(sender => {
          sender.replaceTrack(null).catch(() => {});
        });
      }
    });

    this.isCameraOn = false;
    this.isMicOn = false;
    this.isScreenOn = false;
    this.screenShareMode = null;
    this.usedVirtualVideo = false;
    this.cameraError = null;

    this.notifyState({
      isCameraActive: false,
      isMicActive: false,
      isScreenSharing: false,
      screenShareMode: null,
      isVirtualCamera: false,
      cameraError: null,
      localStream: null,
      screenStream: null,
      audioLevel: 0
    });
    this.broadcastMediaState();
  }

  public endCall() {
    if (this.isDisposed) return;
    this.log('Leaving room session.');

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'leave-room',
            roomId: this.roomId,
            userId: this.currentUser.id,
            senderId: this.peerId
          })
        );
      } catch {}
    }

    this.mediaRequestSeq += 1;
    this.isDisposed = true;
    this.stopOutgoingMediaRelay();
    this.stopFallbackGenerators();
    this.stopScreenFallbackGenerator();

    if (this.wsKeepAliveId) {
      clearInterval(this.wsKeepAliveId);
      this.wsKeepAliveId = null;
    }
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    if (this.audioMeterIntervalId) {
      clearInterval(this.audioMeterIntervalId);
      this.audioMeterIntervalId = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => {
        t.onended = null;
        t.stop();
      });
      this.screenStream = null;
    }

    for (const pid of Array.from(this.peers.keys())) {
      this.disposePeerSession(pid);
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}
