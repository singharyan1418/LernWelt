import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CalendarEvent, TeacherLessonBooking } from '../types';
import {
  buildEventTriggerKey,
  dispatchBrowserEventNotification,
  findDueTenMinuteEvents,
  getBrowserNotificationPermission,
  isTeacherBookingCalendarEventId,
  parseBookingSlotToSchedule,
  parseCalendarEventStartTimestamp,
  persistTriggeredEventAlertKeys,
  readTriggeredEventAlertKeys,
  requestBrowserNotificationPermission,
  syncCalendarEventsWithTeacherBookings,
  teacherBookingToCalendarEvent,
  TEN_MINUTE_ALERT_WINDOW_MS
} from './eventReminderService';

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatLocalHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function createSampleEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'ev_1',
    title: 'Evening German Stammtisch',
    description: 'Practice conversational German',
    languageCode: 'de',
    languageName: 'German',
    flag: '🇩🇪',
    category: 'speaking-club',
    cefrLevel: 'B1',
    date: '2026-11-24',
    startTime: '18:00',
    endTime: '19:00',
    durationMinutes: 60,
    hostName: 'Aryan (You)',
    hostAvatar: '',
    hostIsNative: false,
    maxAttendees: 8,
    attendeesCount: 1,
    isUserAttending: true,
    isUserHost: true,
    roomId: 'de-cafe-chat-1',
    topics: ['Daily Conversation'],
    colorTheme: 'indigo',
    reminderSet: true,
    ...overrides
  };
}

function createSampleBooking(overrides: Partial<TeacherLessonBooking> = {}): TeacherLessonBooking {
  return {
    id: 'bk_100',
    teacherId: 'teacher_de_hannah',
    teacherName: 'Dr. Hannah Lindner',
    teacherAvatar: '',
    languageCode: 'de',
    languageName: 'German',
    flag: '🇩🇪',
    studentId: 'user_1',
    studentName: 'Aryan',
    slotLabel: 'Today · 19:30',
    learningGoal: 'Dative & accusative mastery',
    focusArea: 'Grammar & Writing',
    roomId: 'teacher-room-teacher_de_hannah-bk_100',
    status: 'confirmed',
    createdAt: new Date(2026, 10, 24, 10, 0, 0, 0).getTime(),
    ...overrides
  };
}

describe('eventReminderService', () => {
  it('parses Today, Tomorrow, German, ISO, and Flexible teacher booking slots accurately', () => {
    const anchorMs = new Date(2026, 10, 24, 9, 15, 0, 0).getTime();

    const todaySlot = parseBookingSlotToSchedule('Today · 19:30', anchorMs);
    assert.equal(todaySlot.date, '2026-11-24');
    assert.equal(todaySlot.startTime, '19:30');
    assert.equal(todaySlot.endTime, '20:15');
    assert.equal(todaySlot.hasExactTime, true);

    const tomorrowSlot = parseBookingSlotToSchedule('Tomorrow · 10:00', anchorMs);
    assert.equal(tomorrowSlot.date, '2026-11-25');
    assert.equal(tomorrowSlot.startTime, '10:00');
    assert.equal(tomorrowSlot.hasExactTime, true);

    const germanSlot = parseBookingSlotToSchedule('Morgen · 08:45', anchorMs);
    assert.equal(germanSlot.date, '2026-11-25');
    assert.equal(germanSlot.startTime, '08:45');
    assert.equal(germanSlot.hasExactTime, true);

    const isoSlot = parseBookingSlotToSchedule('2026-11-28 · 16:00', anchorMs);
    assert.equal(isoSlot.date, '2026-11-28');
    assert.equal(isoSlot.startTime, '16:00');
    assert.equal(isoSlot.hasExactTime, true);

    const flexSlot = parseBookingSlotToSchedule('Custom · Flexible Today', anchorMs);
    assert.equal(flexSlot.date, '2026-11-24');
    assert.equal(flexSlot.startTime, 'Flexible');
    assert.equal(flexSlot.hasExactTime, false);
  });

  it('syncs confirmed teacher lessons into visible EventCalendarView events while excluding cancelled or dismissed bookings', () => {
    const userEvent = createSampleEvent({ id: 'ev_user_1' });
    const confirmedBooking = createSampleBooking({ id: 'bk_confirmed', status: 'confirmed' });
    const cancelledBooking = createSampleBooking({ id: 'bk_cancelled', status: 'cancelled' });
    const dismissedBooking = createSampleBooking({ id: 'bk_dismissed', status: 'confirmed' });
    const nonHostedEvent = createSampleEvent({ id: 'ev_external', isUserHost: false });

    const synced = syncCalendarEventsWithTeacherBookings(
      [userEvent, nonHostedEvent],
      [confirmedBooking, cancelledBooking, dismissedBooking],
      ['teacher_booking_bk_dismissed']
    );

    assert.equal(synced.length, 2);
    assert.equal(synced[0].id, 'ev_user_1');
    assert.equal(synced[1].id, 'teacher_booking_bk_confirmed');
    assert.equal(synced[1].isUserHost, true);
    assert.equal(isTeacherBookingCalendarEventId(synced[1].id), true);
    assert.equal(synced.some((e) => e.id.includes('bk_cancelled')), false);
    assert.equal(synced.some((e) => e.id.includes('bk_dismissed')), false);
    assert.equal(synced.some((e) => e.id === 'ev_external'), false);

    // Preserves muted reminder state on an existing synced booking event
    const mutedSynced = { ...synced[1], reminderSet: false };
    const resynced = syncCalendarEventsWithTeacherBookings([userEvent, mutedSynced], [confirmedBooking]);
    const matched = resynced.find((e) => e.id === 'teacher_booking_bk_confirmed');
    assert.equal(matched?.reminderSet, false);
  });

  it('parses valid local dates and rejects flexible or invalid calendar timestamps', () => {
    const validTs = parseCalendarEventStartTimestamp({ date: '2026-11-24', startTime: '14:05' });
    assert.equal(validTs, new Date(2026, 10, 24, 14, 5, 0, 0).getTime());

    assert.equal(parseCalendarEventStartTimestamp({ date: '2026-11-24', startTime: 'Flexible' }), null);
    assert.equal(parseCalendarEventStartTimestamp({ date: '2026-02-31', startTime: '14:00' }), null);
    assert.equal(parseCalendarEventStartTimestamp({ date: '', startTime: '14:00' }), null);
  });

  it('finds events and teacher lessons starting within the 10-minute window and deduplicates triggered keys', () => {
    const baseNow = new Date(2026, 10, 24, 12, 0, 0, 0);
    const in9Min = new Date(baseNow.getTime() + 9 * 60 * 1000);
    const in10MinExact = new Date(baseNow.getTime() + 10 * 60 * 1000);
    const in11Min = new Date(baseNow.getTime() + 11 * 60 * 1000);
    const past2Min = new Date(baseNow.getTime() - 2 * 60 * 1000);

    const teacherBooking = createSampleBooking({
      id: 'bk_soon',
      slotLabel: `Today · ${formatLocalHHMM(in9Min)}`,
      createdAt: baseNow.getTime()
    });
    const teacherEvent = teacherBookingToCalendarEvent(teacherBooking, baseNow.getTime());

    const visibleEvents: CalendarEvent[] = [
      teacherEvent,
      createSampleEvent({
        id: 'ev_10m',
        date: formatLocalDate(in10MinExact),
        startTime: formatLocalHHMM(in10MinExact),
        isUserHost: true
      }),
      createSampleEvent({
        id: 'ev_11m',
        date: formatLocalDate(in11Min),
        startTime: formatLocalHHMM(in11Min),
        isUserHost: true
      }),
      createSampleEvent({
        id: 'ev_past',
        date: formatLocalDate(past2Min),
        startTime: formatLocalHHMM(past2Min),
        isUserHost: true
      }),
      createSampleEvent({
        id: 'ev_hidden',
        date: formatLocalDate(in9Min),
        startTime: formatLocalHHMM(in9Min),
        isUserHost: false
      }),
      createSampleEvent({
        id: 'ev_muted',
        date: formatLocalDate(in9Min),
        startTime: formatLocalHHMM(in9Min),
        isUserHost: true,
        reminderSet: false
      })
    ];

    const triggered = new Set<string>();
    const due = findDueTenMinuteEvents(visibleEvents, baseNow.getTime(), triggered, TEN_MINUTE_ALERT_WINDOW_MS);

    assert.equal(due.length, 2);
    assert.equal(due[0].event.id, 'teacher_booking_bk_soon');
    assert.equal(due[0].isTeacherLesson, true);
    assert.equal(due[0].minutesUntilStart, 9);

    assert.equal(due[1].event.id, 'ev_10m');
    assert.equal(due[1].isTeacherLesson, false);
    assert.equal(due[1].minutesUntilStart, 10);

    // Marking triggered prevents duplicate alerts on subsequent checks
    due.forEach((d) => triggered.add(d.triggerKey));
    const secondRun = findDueTenMinuteEvents(visibleEvents, baseNow.getTime() + 15_000, triggered);
    assert.equal(secondRun.length, 0);

    // Rescheduling to a new time produces a distinct trigger key
    assert.notEqual(
      buildEventTriggerKey({ id: 'ev_10m', date: '2026-11-24', startTime: '12:10' }),
      buildEventTriggerKey({ id: 'ev_10m', date: '2026-11-24', startTime: '13:10' })
    );
  });

  it('persists and restores triggered alert keys cleanly via storage', () => {
    const backing = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => {
        backing.set(k, v);
      }
    };

    const keys = new Set(['ev_1::2026-11-24::18:00', 'teacher_booking_bk_1::2026-11-24::19:30']);
    persistTriggeredEventAlertKeys(keys, mockStorage);

    const restored = readTriggeredEventAlertKeys(mockStorage);
    assert.equal(restored.has('ev_1::2026-11-24::18:00'), true);
    assert.equal(restored.has('teacher_booking_bk_1::2026-11-24::19:30'), true);
  });

  it('dispatches browser Notification when granted and falls back gracefully otherwise', async () => {
    const dueAlert = {
      event: createSampleEvent({ id: 'teacher_booking_bk_1', title: 'Dr. Hannah Lindner · 1-on-1 Lesson', startTime: '19:30' }),
      triggerKey: 'teacher_booking_bk_1::2026-11-24::19:30',
      startMs: Date.now() + 8 * 60 * 1000,
      diffMs: 8 * 60 * 1000,
      minutesUntilStart: 8,
      isTeacherLesson: true
    };

    const createdNotifications: Array<{ title: string; options?: NotificationOptions; instance: any }> = [];
    class MockGrantedNotification {
      static permission: NotificationPermission = 'granted';
      static async requestPermission(): Promise<NotificationPermission> {
        return 'granted';
      }
      onclick: ((ev?: unknown) => unknown) | null = null;
      closed = false;
      close() {
        this.closed = true;
      }
      constructor(title: string, options?: NotificationOptions) {
        createdNotifications.push({ title, options, instance: this });
      }
    }

    let clickedEventId: string | null = null;
    let focused = false;
    const sent = dispatchBrowserEventNotification(dueAlert, {
      uiLang: 'English',
      notificationApi: MockGrantedNotification,
      onClick: (evt) => {
        clickedEventId = evt.id;
      },
      onFocusWindow: () => {
        focused = true;
      }
    });

    assert.equal(sent.browserNotificationSent, true);
    assert.equal(sent.permission, 'granted');
    assert.equal(createdNotifications.length, 1);
    assert.ok(createdNotifications[0].title.includes('8 min'));
    assert.equal(createdNotifications[0].options?.tag, dueAlert.triggerKey);

    createdNotifications[0].instance.onclick?.();
    assert.equal(focused, true);
    assert.equal(clickedEventId, 'teacher_booking_bk_1');
    assert.equal(createdNotifications[0].instance.closed, true);

    class MockDefaultNotification {
      static permission: NotificationPermission = 'default';
      static async requestPermission(): Promise<NotificationPermission> {
        MockDefaultNotification.permission = 'granted';
        return 'granted';
      }
      constructor() {
        throw new Error('Should not construct Notification before permission is granted');
      }
    }

    assert.equal(getBrowserNotificationPermission(MockDefaultNotification), 'default');
    const fallback = dispatchBrowserEventNotification(dueAlert, {
      uiLang: 'German',
      notificationApi: MockDefaultNotification
    });
    assert.equal(fallback.browserNotificationSent, false);
    assert.equal(fallback.permission, 'default');
    assert.ok(fallback.title.includes('8 Min.'));

    const requested = await requestBrowserNotificationPermission(MockDefaultNotification);
    assert.equal(requested, 'granted');
  });
});
