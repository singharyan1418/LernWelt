import { LanguageRoom, PersonalTeacher, TeacherLessonBooking, UserProfile } from '../types';
import { RandomCallMode, VerifiedRandomCandidate } from './randomConnectLogic';

export interface OnlineUser {
  id: string;
  name: string;
  avatarUrl: string;
  country: string;
  nativeLanguage: string;
  learningLanguage: string;
  learningLevel?: string;
  device: 'mobile' | 'desktop';
  currentRoomId: string | null;
  lastSeen: number;
  isVerified?: boolean;
  verifiedId?: string;
}

export interface IncomingCallEvent {
  caller: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  roomId: string;
  mode: 'audio' | 'video';
}

export interface TeacherSyncCallbacks {
  onTeacherCreated?: (teacher: PersonalTeacher) => void;
  onBookingUpdated?: (booking: TeacherLessonBooking) => void;
}

export interface RandomConnectMatchedEvent {
  matchId: string;
  room: LanguageRoom;
  partner: VerifiedRandomCandidate;
  resolvedCallMode: RandomCallMode;
}

export interface RandomConnectStatsEvent {
  queueSize: number;
  verifiedOnlineCount: number;
  waitingUserIds: string[];
}

export interface RandomConnectCallbacks {
  onMatched?: (event: RandomConnectMatchedEvent) => void;
  onStats?: (stats: RandomConnectStatsEvent) => void;
  onRejected?: (error: string) => void;
}

class RealtimePresenceService {
  private ws: WebSocket | null = null;
  private currentUser: UserProfile | null = null;
  private onIncomingCallCallback: ((call: IncomingCallEvent) => void) | null = null;
  private onCallResponseCallback: ((response: { accepted: boolean; roomId: string }) => void) | null = null;
  private teacherSyncCallbacks: TeacherSyncCallbacks = {};
  private randomConnectCallbacks: RandomConnectCallbacks = {};
  private heartbeatInterval: any = null;
  private reconnectTimeout: any = null;
  private isDisposed = false;

  public init(user: UserProfile, onIncomingCall?: (call: IncomingCallEvent) => void) {
    this.isDisposed = false;
    this.currentUser = user;
    if (onIncomingCall) {
      this.onIncomingCallCallback = onIncomingCall;
    }

    this.registerWithServer(user);
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      this.connectPresenceWs();
    } else if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'register-user',
          user: {
            ...user,
            device: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
          }
        })
      );
    }

    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.currentUser) {
        this.registerWithServer(this.currentUser);
      }
    }, 25000);
  }

  public setOnCallResponse(cb: (response: { accepted: boolean; roomId: string }) => void) {
    this.onCallResponseCallback = cb;
  }

  public setTeacherSyncCallbacks(callbacks: TeacherSyncCallbacks) {
    this.teacherSyncCallbacks = callbacks;
  }

  public setRandomConnectCallbacks(callbacks: RandomConnectCallbacks) {
    this.randomConnectCallbacks = callbacks;
  }

  private async registerWithServer(user: UserProfile) {
    try {
      await fetch('/api/presence/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            ...user,
            device: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
          }
        })
      });
    } catch {
      // Ignore network hiccup
    }
  }

  private connectPresenceWs() {
    if (typeof window === 'undefined' || this.isDisposed) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.currentUser) {
          this.ws?.send(
            JSON.stringify({
              type: 'register-user',
              user: {
                ...this.currentUser,
                device: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
              }
            })
          );
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'incoming-call' && this.onIncomingCallCallback) {
            this.onIncomingCallCallback({
              caller: data.caller,
              roomId: data.roomId,
              mode: data.mode || 'video'
            });
          } else if (data.type === 'call-response' && this.onCallResponseCallback) {
            this.onCallResponseCallback({
              accepted: data.accepted,
              roomId: data.roomId
            });
          } else if (data.type === 'teacher:created' && data.teacher) {
            this.teacherSyncCallbacks.onTeacherCreated?.(data.teacher);
          } else if (data.type === 'teacher-booking:updated' && data.booking) {
            this.teacherSyncCallbacks.onBookingUpdated?.(data.booking);
          } else if (data.type === 'random-connect:matched' && data.room && data.partner) {
            this.randomConnectCallbacks.onMatched?.({
              matchId: data.matchId,
              room: data.room,
              partner: data.partner,
              resolvedCallMode: data.resolvedCallMode || 'video'
            });
          } else if (data.type === 'random-connect:stats') {
            this.randomConnectCallbacks.onStats?.({
              queueSize: Number(data.queueSize) || 0,
              verifiedOnlineCount: Number(data.verifiedOnlineCount) || 0,
              waitingUserIds: Array.isArray(data.waitingUserIds) ? data.waitingUserIds : []
            });
          } else if (data.type === 'random-connect:rejected') {
            this.randomConnectCallbacks.onRejected?.(data.error || 'Unable to join Verified Random Connect.');
          }
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        if (!this.isDisposed) {
          if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = setTimeout(() => this.connectPresenceWs(), 4000);
        }
      };
    } catch {
      // WS fallback handled by HTTP polling
    }
  }

  public async fetchOnlineUsers(): Promise<OnlineUser[]> {
    try {
      const res = await fetch('/api/presence/users');
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.users) ? data.users : [];
      }
    } catch (e) {
      console.warn('Failed to fetch online users:', e);
    }
    return [];
  }

  public async joinRandomConnectQueue(params: {
    user: UserProfile;
    preferredLanguage: string;
    preferredMode: RandomCallMode;
    excludePartnerId?: string;
  }): Promise<{
    status: 'matched' | 'waiting' | 'rejected';
    error?: string;
    matchId?: string;
    room?: LanguageRoom;
    partner?: VerifiedRandomCandidate;
    resolvedCallMode?: RandomCallMode;
    queueSize?: number;
  }> {
    try {
      const res = await fetch('/api/random-connect/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          status: 'rejected',
          error: data.error || 'Verification required for Random Connect.'
        };
      }
      return data;
    } catch {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'random-connect:join',
            ...params
          })
        );
        return { status: 'waiting' };
      }
      return { status: 'rejected', error: 'Connection unavailable. Please retry.' };
    }
  }

  public async leaveRandomConnectQueue(userId: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'random-connect:leave', userId }));
    }
    try {
      await fetch('/api/random-connect/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
    } catch {
      // Ignore leave error
    }
  }

  public initiateCall(targetUserId: string, roomId: string, mode: 'audio' | 'video' = 'video') {
    if (!this.currentUser) return;

    const payload = {
      type: 'call-request',
      targetUserId,
      caller: {
        id: this.currentUser.id,
        name: this.currentUser.name,
        avatarUrl: this.currentUser.avatarUrl
      },
      roomId,
      mode
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      fetch('/api/webrtc/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          senderId: this.currentUser.id
        })
      }).catch(() => {});
    }
  }

  public respondToCall(callerId: string, accepted: boolean, roomId: string) {
    const payload = {
      type: 'call-response',
      callerId,
      accepted,
      roomId
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      fetch('/api/webrtc/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          senderId: this.currentUser?.id
        })
      }).catch(() => {});
    }
  }

  public cleanup() {
    this.isDisposed = true;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}

export const realtimePresence = new RealtimePresenceService();
