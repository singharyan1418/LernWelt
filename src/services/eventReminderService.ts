import { CalendarEvent, TeacherLessonBooking } from '../types';
import { formatDateKey } from '../data/calendarEventsData';
import { t } from './uiLocalization';

export const TEN_MINUTE_ALERT_WINDOW_MS = 10 * 60 * 1000;
export const TRIGGERED_EVENT_ALERTS_STORAGE_KEY = 'lernwelt_triggered_10m_notifications_v1';
export const DISMISSED_BOOKING_CALENDAR_IDS_KEY = 'lernwelt_dismissed_booking_calendar_ids_v1';
export const TEACHER_BOOKING_EVENT_ID_PREFIX = 'teacher_booking_';

export type BrowserNotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

export interface NotificationInstanceLike {
  onclick?: ((ev?: unknown) => unknown) | null;
  close?: () => void;
}

export interface NotificationConstructorLike {
  permission: NotificationPermission;
  requestPermission?: () => Promise<NotificationPermission>;
  new (title: string, options?: NotificationOptions): NotificationInstanceLike;
}

export interface ParsedBookingSchedule {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  hasExactTime: boolean;
}

export interface DueCalendarEventAlert {
  event: CalendarEvent;
  triggerKey: string;
  startMs: number;
  diffMs: number;
  minutesUntilStart: number;
  isTeacherLesson: boolean;
}

export interface DispatchedEventAlert {
  triggerKey: string;
  title: string;
  body: string;
  browserNotificationSent: boolean;
  permission: BrowserNotificationPermissionState;
  event: CalendarEvent;
}

export function isTeacherBookingCalendarEventId(eventId: string): boolean {
  return String(eventId || '').startsWith(TEACHER_BOOKING_EVENT_ID_PREFIX);
}

export function extractTeacherBookingIdFromEventId(eventId: string): string | null {
  if (!isTeacherBookingCalendarEventId(eventId)) return null;
  return eventId.slice(TEACHER_BOOKING_EVENT_ID_PREFIX.length) || null;
}

export function addMinutesToTimeString(startTime: string, durationMinutes: number): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim());
  if (!match) return startTime;
  const h = Number(match[1]);
  const m = Number(match[2]);
  const total = (h * 60 + m + Math.max(1, durationMinutes)) % (24 * 60);
  const endH = Math.floor(total / 60);
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

export function parseBookingSlotToSchedule(
  slotLabel: string,
  anchorDateMs: number = Date.now()
): ParsedBookingSchedule {
  const raw = String(slotLabel || '').trim();
  const baseDate = new Date(anchorDateMs);
  const safeBase = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;

  let targetDate = new Date(
    safeBase.getFullYear(),
    safeBase.getMonth(),
    safeBase.getDate(),
    12,
    0,
    0,
    0
  );

  const isoMatch = /(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (isoMatch) {
    const [y, m, d] = isoMatch[1].split('-').map(Number);
    targetDate = new Date(y, m - 1, d, 12, 0, 0, 0);
  } else if (/\b(tomorrow|morgen)\b/i.test(raw)) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  const timeMatch = /\b(\d{1,2}):(\d{2})\b/.exec(raw);
  const durationMinutes = 45;

  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      return {
        date: formatDateKey(targetDate),
        startTime,
        endTime: addMinutesToTimeString(startTime, durationMinutes),
        durationMinutes,
        hasExactTime: true
      };
    }
  }

  return {
    date: formatDateKey(targetDate),
    startTime: 'Flexible',
    endTime: 'Flexible',
    durationMinutes,
    hasExactTime: false
  };
}

export function teacherBookingToCalendarEvent(
  booking: TeacherLessonBooking,
  nowMs: number = Date.now()
): CalendarEvent {
  const anchorMs =
    typeof booking.createdAt === 'number' && Number.isFinite(booking.createdAt)
      ? booking.createdAt
      : nowMs;
  const schedule = parseBookingSlotToSchedule(booking.slotLabel, anchorMs);

  return {
    id: `${TEACHER_BOOKING_EVENT_ID_PREFIX}${booking.id}`,
    title: `${booking.teacherName} · 1-on-1 Lesson`,
    description: booking.learningGoal
      ? `${booking.focusArea} — ${booking.learningGoal}`
      : booking.focusArea,
    languageCode: booking.languageCode,
    languageName: booking.languageName,
    flag: booking.flag,
    category: '1-on-1-exchange',
    cefrLevel: 'All Levels',
    date: schedule.date,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    durationMinutes: schedule.durationMinutes,
    hostName: booking.teacherName,
    hostAvatar: booking.teacherAvatar || '',
    hostIsNative: true,
    maxAttendees: 2,
    attendeesCount: 2,
    isUserAttending: true,
    isUserHost: true,
    roomId: booking.roomId,
    topics: [booking.focusArea, booking.learningGoal].filter(Boolean),
    colorTheme: 'emerald',
    reminderSet: true
  };
}

export function syncCalendarEventsWithTeacherBookings(
  storedEvents: CalendarEvent[],
  bookings: TeacherLessonBooking[],
  dismissedBookingEventIds: Iterable<string> = [],
  nowMs: number = Date.now()
): CalendarEvent[] {
  const dismissedSet = new Set(dismissedBookingEventIds);
  const existingById = new Map<string, CalendarEvent>();
  const userPlannedEvents: CalendarEvent[] = [];

  for (const evt of storedEvents) {
    if (!evt || !evt.id) continue;
    existingById.set(evt.id, evt);
    if (!isTeacherBookingCalendarEventId(evt.id) && evt.isUserHost === true) {
      userPlannedEvents.push(evt);
    }
  }

  const syncedTeacherEvents: CalendarEvent[] = [];
  for (const booking of bookings) {
    if (!booking || booking.status !== 'confirmed') continue;
    const syncedId = `${TEACHER_BOOKING_EVENT_ID_PREFIX}${booking.id}`;
    if (dismissedSet.has(syncedId)) continue;

    const baseEvent = teacherBookingToCalendarEvent(booking, nowMs);
    const existing = existingById.get(syncedId);
    syncedTeacherEvents.push({
      ...baseEvent,
      reminderSet: existing?.reminderSet !== undefined ? existing.reminderSet : baseEvent.reminderSet
    });
  }

  return [...userPlannedEvents, ...syncedTeacherEvents];
}

export function getVisibleCalendarEvents(
  storedEvents: CalendarEvent[],
  bookings: TeacherLessonBooking[],
  dismissedBookingEventIds: Iterable<string> = [],
  nowMs: number = Date.now()
): CalendarEvent[] {
  return syncCalendarEventsWithTeacherBookings(
    storedEvents,
    bookings,
    dismissedBookingEventIds,
    nowMs
  ).filter((evt) => evt.isUserHost === true);
}

export function parseCalendarEventStartTimestamp(
  event: Pick<CalendarEvent, 'date' | 'startTime'>
): number | null {
  if (!event?.date || !event?.startTime) return null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(event.date).trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(String(event.startTime).trim());
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed.getTime();
}

export function buildEventTriggerKey(
  event: Pick<CalendarEvent, 'id' | 'date' | 'startTime'>
): string {
  return `${event.id}::${event.date}::${event.startTime}`;
}

export function findDueTenMinuteEvents(
  visibleEvents: CalendarEvent[],
  nowMs: number,
  alreadyTriggeredKeys: Set<string>,
  windowMs: number = TEN_MINUTE_ALERT_WINDOW_MS
): DueCalendarEventAlert[] {
  const due: DueCalendarEventAlert[] = [];

  for (const evt of visibleEvents) {
    if (!evt || evt.isUserHost !== true || evt.reminderSet === false) continue;

    const startMs = parseCalendarEventStartTimestamp(evt);
    if (startMs === null) continue;

    const diffMs = startMs - nowMs;
    if (diffMs <= 0 || diffMs > windowMs) continue;

    const triggerKey = buildEventTriggerKey(evt);
    if (alreadyTriggeredKeys.has(triggerKey)) continue;

    due.push({
      event: evt,
      triggerKey,
      startMs,
      diffMs,
      minutesUntilStart: Math.max(1, Math.ceil(diffMs / 60000)),
      isTeacherLesson: isTeacherBookingCalendarEventId(evt.id)
    });
  }

  return due.sort((a, b) => a.startMs - b.startMs);
}

export function readTriggeredEventAlertKeys(
  storage?: Pick<Storage, 'getItem'> | null
): Set<string> {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return new Set();
    const raw = store.getItem(TRIGGERED_EVENT_ALERTS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map(String));
  } catch {
    return new Set();
  }
}

export function persistTriggeredEventAlertKeys(
  keys: Set<string>,
  storage?: Pick<Storage, 'setItem'> | null
): void {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return;
    const bounded = Array.from(keys).slice(-200);
    store.setItem(TRIGGERED_EVENT_ALERTS_STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    // Ignore storage quota / security errors
  }
}

export function readDismissedBookingCalendarIds(
  storage?: Pick<Storage, 'getItem'> | null
): string[] {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return [];
    const raw = store.getItem(DISMISSED_BOOKING_CALENDAR_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function persistDismissedBookingCalendarIds(
  ids: string[],
  storage?: Pick<Storage, 'setItem'> | null
): void {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return;
    store.setItem(DISMISSED_BOOKING_CALENDAR_IDS_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    // Ignore storage errors
  }
}

export function getBrowserNotificationPermission(
  notificationApi?: Pick<NotificationConstructorLike, 'permission'> | null
): BrowserNotificationPermissionState {
  const api =
    notificationApi ??
    (typeof globalThis !== 'undefined' && 'Notification' in globalThis
      ? (globalThis.Notification as unknown as NotificationConstructorLike)
      : null);

  if (!api || !api.permission) return 'unsupported';
  if (api.permission === 'granted' || api.permission === 'denied' || api.permission === 'default') {
    return api.permission;
  }
  return 'unsupported';
}

export async function requestBrowserNotificationPermission(
  notificationApi?: Pick<NotificationConstructorLike, 'permission' | 'requestPermission'> | null
): Promise<BrowserNotificationPermissionState> {
  const api =
    notificationApi ??
    (typeof globalThis !== 'undefined' && 'Notification' in globalThis
      ? (globalThis.Notification as unknown as NotificationConstructorLike)
      : null);

  if (!api) return 'unsupported';
  if (api.permission === 'granted' || api.permission === 'denied') {
    return api.permission;
  }
  if (typeof api.requestPermission !== 'function') {
    return getBrowserNotificationPermission(api);
  }
  try {
    const result = await api.requestPermission();
    return result === 'granted' || result === 'denied' || result === 'default'
      ? result
      : getBrowserNotificationPermission(api);
  } catch {
    return getBrowserNotificationPermission(api);
  }
}

export function buildEventAlertCopy(
  alert: DueCalendarEventAlert,
  uiLang?: string | null
): { title: string; body: string } {
  const { event, minutesUntilStart, isTeacherLesson } = alert;
  const titleKey = isTeacherLesson ? 'events.alertLessonTitle' : 'events.alertEventTitle';
  const title = t(titleKey, uiLang, {
    minutes: minutesUntilStart,
    flag: event.flag,
    title: event.title
  });
  const body = t('events.alertBody', uiLang, {
    time: event.startTime,
    language: event.languageName,
    host: event.hostName
  });
  return { title, body };
}

export function dispatchBrowserEventNotification(
  alert: DueCalendarEventAlert,
  options?: {
    uiLang?: string | null;
    notificationApi?: NotificationConstructorLike | null;
    onClick?: (event: CalendarEvent) => void;
    onFocusWindow?: () => void;
  }
): DispatchedEventAlert {
  const api =
    options?.notificationApi ??
    (typeof globalThis !== 'undefined' && 'Notification' in globalThis
      ? (globalThis.Notification as unknown as NotificationConstructorLike)
      : null);

  const permission = getBrowserNotificationPermission(api);
  const { title, body } = buildEventAlertCopy(alert, options?.uiLang);

  if (!api || permission !== 'granted') {
    return {
      triggerKey: alert.triggerKey,
      title,
      body,
      browserNotificationSent: false,
      permission,
      event: alert.event
    };
  }

  try {
    const instance = new api(title, {
      body,
      tag: alert.triggerKey,
      icon: '/assets/aistudio/image_33110acb.png',
      requireInteraction: false
    });

    instance.onclick = () => {
      try {
        if (options?.onFocusWindow) {
          options.onFocusWindow();
        } else if (typeof window !== 'undefined' && typeof window.focus === 'function') {
          window.focus();
        }
        options?.onClick?.(alert.event);
        instance.close?.();
      } catch {
        // Ignore click handler failures
      }
    };

    return {
      triggerKey: alert.triggerKey,
      title,
      body,
      browserNotificationSent: true,
      permission,
      event: alert.event
    };
  } catch {
    return {
      triggerKey: alert.triggerKey,
      title,
      body,
      browserNotificationSent: false,
      permission,
      event: alert.event
    };
  }
}
