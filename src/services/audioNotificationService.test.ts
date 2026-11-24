import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_NOTIFICATIONS_STORAGE_KEY,
  DEFAULT_AUDIO_NOTIFICATIONS_ENABLED,
  normalizeAudioNotificationsEnabled,
  persistAudioNotificationsEnabled,
  playIncomingCallRingtone,
  playIncomingMessageChime,
  readStoredAudioNotificationsEnabled,
  shouldPlayAudioNotification
} from './audioNotificationService';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    }
  };
}

describe('audioNotificationService', () => {
  it('defaults to enabled and normalizes string/boolean/numeric inputs cleanly', () => {
    assert.equal(DEFAULT_AUDIO_NOTIFICATIONS_ENABLED, true);
    assert.equal(normalizeAudioNotificationsEnabled(undefined), true);
    assert.equal(normalizeAudioNotificationsEnabled(null), true);
    assert.equal(normalizeAudioNotificationsEnabled(''), true);
    assert.equal(normalizeAudioNotificationsEnabled('true'), true);
    assert.equal(normalizeAudioNotificationsEnabled('1'), true);
    assert.equal(normalizeAudioNotificationsEnabled('on'), true);
    assert.equal(normalizeAudioNotificationsEnabled(true), true);
    assert.equal(normalizeAudioNotificationsEnabled('false'), false);
    assert.equal(normalizeAudioNotificationsEnabled(' FALSE '), false);
    assert.equal(normalizeAudioNotificationsEnabled('0'), false);
    assert.equal(normalizeAudioNotificationsEnabled('off'), false);
    assert.equal(normalizeAudioNotificationsEnabled('disabled'), false);
    assert.equal(normalizeAudioNotificationsEnabled(false), false);
    assert.equal(normalizeAudioNotificationsEnabled(0), false);
  });

  it('reads and persists the audio notification preference safely in storage', () => {
    const store = createMemoryStorage();
    assert.equal(readStoredAudioNotificationsEnabled(store), true);

    persistAudioNotificationsEnabled(false, store);
    assert.equal(store.getItem(AUDIO_NOTIFICATIONS_STORAGE_KEY), 'false');
    assert.equal(readStoredAudioNotificationsEnabled(store), false);

    persistAudioNotificationsEnabled(true, store);
    assert.equal(store.getItem(AUDIO_NOTIFICATIONS_STORAGE_KEY), 'true');
    assert.equal(readStoredAudioNotificationsEnabled(store), true);
  });

  it('handles storage errors gracefully without throwing', () => {
    const brokenStorage = {
      getItem() {
        throw new Error('Storage denied');
      },
      setItem() {
        throw new Error('Quota exceeded');
      }
    };

    assert.equal(readStoredAudioNotificationsEnabled(brokenStorage), true);
    assert.equal(persistAudioNotificationsEnabled(false, brokenStorage), false);
  });

  it('determines whether sound alerts should trigger for incoming messages and call requests', () => {
    assert.equal(
      shouldPlayAudioNotification({ enabled: true, eventType: 'incoming-message', isOwnMessage: false }),
      true
    );
    assert.equal(
      shouldPlayAudioNotification({ enabled: true, eventType: 'incoming-message', isOwnMessage: true }),
      false
    );
    assert.equal(
      shouldPlayAudioNotification({ enabled: false, eventType: 'incoming-message', isOwnMessage: false }),
      false
    );
    assert.equal(
      shouldPlayAudioNotification({ enabled: true, eventType: 'incoming-call' }),
      true
    );
    assert.equal(
      shouldPlayAudioNotification({ enabled: false, eventType: 'incoming-call' }),
      false
    );
  });

  it('returns false / no-op when disabled or in non-browser environments without AudioContext', () => {
    const store = createMemoryStorage({ [AUDIO_NOTIFICATIONS_STORAGE_KEY]: 'false' });
    assert.equal(playIncomingMessageChime({ storage: store }), false);
    assert.equal(playIncomingMessageChime({ enabled: true, isOwnMessage: true }), false);

    const stopDisabled = playIncomingCallRingtone({ storage: store });
    assert.equal(typeof stopDisabled, 'function');
    stopDisabled();
  });
});
