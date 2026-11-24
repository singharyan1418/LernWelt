export const AUDIO_NOTIFICATIONS_STORAGE_KEY = 'lernwelt_audio_notifications_enabled';
export const DEFAULT_AUDIO_NOTIFICATIONS_ENABLED = true;

export type AudioNotificationEventType = 'incoming-message' | 'incoming-call';

export function normalizeAudioNotificationsEnabled(raw?: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  if (typeof raw === 'string') {
    const cleaned = raw.trim().toLowerCase();
    if (!cleaned) return DEFAULT_AUDIO_NOTIFICATIONS_ENABLED;
    if (cleaned === 'false' || cleaned === '0' || cleaned === 'off' || cleaned === 'disabled' || cleaned === 'no') {
      return false;
    }
    if (cleaned === 'true' || cleaned === '1' || cleaned === 'on' || cleaned === 'enabled' || cleaned === 'yes') {
      return true;
    }
  }
  return DEFAULT_AUDIO_NOTIFICATIONS_ENABLED;
}

export function readStoredAudioNotificationsEnabled(
  storage?: Pick<Storage, 'getItem'> | null
): boolean {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return DEFAULT_AUDIO_NOTIFICATIONS_ENABLED;
    const raw = store.getItem(AUDIO_NOTIFICATIONS_STORAGE_KEY);
    if (raw === null || raw === '') return DEFAULT_AUDIO_NOTIFICATIONS_ENABLED;
    return normalizeAudioNotificationsEnabled(raw);
  } catch {
    return DEFAULT_AUDIO_NOTIFICATIONS_ENABLED;
  }
}

export function persistAudioNotificationsEnabled(
  enabled: boolean,
  storage?: Pick<Storage, 'setItem'> | null
): boolean {
  const normalized = Boolean(enabled);
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    store?.setItem(AUDIO_NOTIFICATIONS_STORAGE_KEY, normalized ? 'true' : 'false');
  } catch {
    // Ignore storage errors in restricted environments
  }
  return normalized;
}

export function shouldPlayAudioNotification(params: {
  enabled: boolean;
  eventType: AudioNotificationEventType;
  isOwnMessage?: boolean;
}): boolean {
  if (!params.enabled) return false;
  if (params.eventType === 'incoming-message' && params.isOwnMessage) {
    return false;
  }
  return true;
}

let sharedAudioContext: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  try {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioCtx();
    }
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

function scheduleChimeTone(
  ctx: AudioContext,
  startTime: number,
  frequencyHz: number,
  durationSec: number,
  peakGain = 0.055
): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequencyHz, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + durationSec + 0.01);
}

/**
 * Plays a gentle two-note chime for incoming chat messages when enabled.
 * Returns true if audio playback was scheduled, false otherwise.
 */
export function playIncomingMessageChime(options?: {
  enabled?: boolean;
  isOwnMessage?: boolean;
  storage?: Pick<Storage, 'getItem'> | null;
}): boolean {
  const enabled =
    options?.enabled !== undefined
      ? Boolean(options.enabled)
      : readStoredAudioNotificationsEnabled(options?.storage);

  if (
    !shouldPlayAudioNotification({
      enabled,
      eventType: 'incoming-message',
      isOwnMessage: options?.isOwnMessage
    })
  ) {
    return false;
  }

  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;

  try {
    const now = ctx.currentTime;
    scheduleChimeTone(ctx, now, 587.33, 0.11, 0.05);
    scheduleChimeTone(ctx, now + 0.09, 880, 0.16, 0.055);
    return true;
  } catch {
    return false;
  }
}

/**
 * Plays a repeating soft ringtone for incoming call requests when enabled.
 * Returns a cleanup callback to stop ringing immediately.
 */
export function playIncomingCallRingtone(options?: {
  enabled?: boolean;
  storage?: Pick<Storage, 'getItem'> | null;
}): () => void {
  const enabled =
    options?.enabled !== undefined
      ? Boolean(options.enabled)
      : readStoredAudioNotificationsEnabled(options?.storage);

  if (!shouldPlayAudioNotification({ enabled, eventType: 'incoming-call' })) {
    return () => {};
  }

  let stopped = false;

  const triggerRingBurst = () => {
    if (stopped) return;
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      scheduleChimeTone(ctx, now, 659.25, 0.18, 0.065);
      scheduleChimeTone(ctx, now + 0.2, 783.99, 0.22, 0.065);
      scheduleChimeTone(ctx, now + 0.5, 659.25, 0.18, 0.055);
      scheduleChimeTone(ctx, now + 0.7, 783.99, 0.22, 0.055);
    } catch {
      // Ignore Web Audio scheduling failures
    }
  };

  triggerRingBurst();
  const intervalId = setInterval(triggerRingBurst, 2400);

  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}
