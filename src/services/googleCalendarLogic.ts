import { CalendarEvent } from '../types';

/**
 * Full set of Google Calendar OAuth scopes provisioned for LernWelt.
 */
export const GOOGLE_CALENDAR_SCOPES: readonly string[] = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.acls',
  'https://www.googleapis.com/auth/calendar.acls.readonly',
  'https://www.googleapis.com/auth/calendar.app.created',
  'https://www.googleapis.com/auth/calendar.calendarlist',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.calendars',
  'https://www.googleapis.com/auth/calendar.calendars.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.events.freebusy',
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/calendar.events.owned.readonly',
  'https://www.googleapis.com/auth/calendar.events.public.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.settings.readonly'
] as const;

export const GOOGLE_CALENDAR_CONSOLE_API_URL =
  'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=ancient-cosmos-p01dl';

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
  backgroundColor?: string;
  timeZone?: string;
}

export interface GoogleCalendarEventItem {
  id: string;
  calendarId: string;
  summary: string;
  description: string;
  location: string;
  date: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isAllDay: boolean;
  startIso: string;
  endIso: string;
  durationMinutes: number;
  status: string;
  htmlLink?: string;
  hangoutLink?: string;
  attendeesCount: number;
  organizerEmail?: string;
  canEdit: boolean;
}

export interface GoogleCalendarEventDraft {
  summary: string;
  description?: string;
  location?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes?: number;
  isAllDay?: boolean;
  timeZone?: string;
}

export type GoogleCalendarErrorKind =
  | 'token_expired'
  | 'api_not_enabled'
  | 'insufficient_scopes'
  | 'not_found'
  | 'rate_limited'
  | 'network_error'
  | 'unknown';

export interface ClassifiedCalendarError {
  kind: GoogleCalendarErrorKind;
  title: string;
  message: string;
  requiresReauth: boolean;
  actionUrl?: string;
}

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}

export function formatLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function getMonthTimeBoundsIso(year: number, monthZeroBased: number): {
  timeMin: string;
  timeMax: string;
} {
  // Include +/- 14 days around the month to cover 6-week grid padding days
  const start = new Date(year, monthZeroBased, 1 - 7, 0, 0, 0, 0);
  const end = new Date(year, monthZeroBased + 1, 14, 23, 59, 59, 999);
  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString()
  };
}

export function normalizeGoogleCalendarList(rawItems: any[]): GoogleCalendarListItem[] {
  if (!Array.isArray(rawItems)) return [];
  const mapped: GoogleCalendarListItem[] = rawItems
    .filter((item) => item && typeof item.id === 'string' && !item.deleted)
    .map((item) => ({
      id: item.id,
      summary: String(item.summaryOverride || item.summary || item.id || 'Calendar'),
      primary: Boolean(item.primary),
      accessRole: typeof item.accessRole === 'string' ? item.accessRole : 'reader',
      backgroundColor: typeof item.backgroundColor === 'string' ? item.backgroundColor : undefined,
      timeZone: typeof item.timeZone === 'string' ? item.timeZone : undefined
    }));

  return mapped.sort((a, b) => {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return a.summary.localeCompare(b.summary);
  });
}

function extractConferenceUri(rawEvent: any): string | undefined {
  if (typeof rawEvent?.hangoutLink === 'string' && rawEvent.hangoutLink.trim()) {
    return rawEvent.hangoutLink.trim();
  }
  const entryPoints = rawEvent?.conferenceData?.entryPoints;
  if (Array.isArray(entryPoints)) {
    const videoEntry = entryPoints.find(
      (ep: any) => ep && ep.entryPointType === 'video' && typeof ep.uri === 'string' && ep.uri.trim()
    );
    if (videoEntry) return videoEntry.uri.trim();
  }
  return undefined;
}

function parseDateTimeFields(
  startObj: any,
  endObj: any
): {
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  startIso: string;
  endIso: string;
  durationMinutes: number;
} {
  if (typeof startObj?.date === 'string' && !startObj?.dateTime) {
    const startDate = startObj.date.slice(0, 10);
    const rawEnd = typeof endObj?.date === 'string' ? endObj.date.slice(0, 10) : startDate;
    return {
      date: startDate,
      endDate: rawEnd,
      startTime: '00:00',
      endTime: '23:59',
      isAllDay: true,
      startIso: startDate,
      endIso: rawEnd,
      durationMinutes: 60
    };
  }

  const startIso = typeof startObj?.dateTime === 'string' ? startObj.dateTime : '';
  const endIso = typeof endObj?.dateTime === 'string' ? endObj.dateTime : '';
  const startDt = startIso ? new Date(startIso) : new Date();
  const endDt = endIso ? new Date(endIso) : new Date(startDt.getTime() + 60 * 60 * 1000);

  if (Number.isNaN(startDt.getTime())) {
    const fallbackDate = formatLocalDateKey(new Date());
    return {
      date: fallbackDate,
      endDate: fallbackDate,
      startTime: '09:00',
      endTime: '10:00',
      isAllDay: false,
      startIso,
      endIso,
      durationMinutes: 60
    };
  }

  const safeEnd = Number.isNaN(endDt.getTime())
    ? new Date(startDt.getTime() + 60 * 60 * 1000)
    : endDt;

  const durationMinutes = Math.max(
    5,
    Math.round((safeEnd.getTime() - startDt.getTime()) / 60000) || 60
  );

  return {
    date: formatLocalDateKey(startDt),
    endDate: formatLocalDateKey(safeEnd),
    startTime: `${pad2(startDt.getHours())}:${pad2(startDt.getMinutes())}`,
    endTime: `${pad2(safeEnd.getHours())}:${pad2(safeEnd.getMinutes())}`,
    isAllDay: false,
    startIso,
    endIso,
    durationMinutes
  };
}

export function normalizeGoogleCalendarEvents(
  rawItems: any[],
  calendarId: string,
  calendarAccessRole: string = 'owner'
): GoogleCalendarEventItem[] {
  if (!Array.isArray(rawItems)) return [];
  const defaultCanEdit = calendarAccessRole === 'owner' || calendarAccessRole === 'writer';

  return rawItems
    .filter((item) => item && typeof item.id === 'string' && item.status !== 'cancelled')
    .map((item) => {
      const parsed = parseDateTimeFields(item.start, item.end);
      const attendeesCount = Array.isArray(item.attendees) ? item.attendees.length : 0;

      return {
        id: item.id,
        calendarId,
        summary: String(item.summary || '').trim() || '(Untitled event)',
        description: typeof item.description === 'string' ? item.description : '',
        location: typeof item.location === 'string' ? item.location : '',
        date: parsed.date,
        endDate: parsed.endDate,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        isAllDay: parsed.isAllDay,
        startIso: parsed.startIso,
        endIso: parsed.endIso,
        durationMinutes: parsed.durationMinutes,
        status: typeof item.status === 'string' ? item.status : 'confirmed',
        htmlLink: typeof item.htmlLink === 'string' ? item.htmlLink : undefined,
        hangoutLink: extractConferenceUri(item),
        attendeesCount,
        organizerEmail:
          typeof item.organizer?.email === 'string' ? item.organizer.email : undefined,
        canEdit: defaultCanEdit && item.locked !== true
      };
    })
    .sort((a, b) => {
      const keyA = `${a.date}T${a.startTime}`;
      const keyB = `${b.date}T${b.startTime}`;
      return keyA.localeCompare(keyB);
    });
}

export function validateCalendarEventDraft(draft: GoogleCalendarEventDraft): {
  valid: boolean;
  error?: string;
  normalized: Required<Pick<GoogleCalendarEventDraft, 'summary' | 'description' | 'location' | 'date' | 'startTime' | 'durationMinutes' | 'isAllDay'>> & {
    timeZone?: string;
  };
} {
  const summary = (draft.summary || '').trim();
  const description = (draft.description || '').trim();
  const location = (draft.location || '').trim();
  const date = (draft.date || '').trim();
  const startTime = (draft.startTime || '18:00').trim();
  const durationMinutes = Number.isFinite(Number(draft.durationMinutes))
    ? Math.max(5, Math.min(720, Math.round(Number(draft.durationMinutes))))
    : 60;
  const isAllDay = Boolean(draft.isAllDay);

  const normalized = {
    summary,
    description,
    location,
    date,
    startTime,
    durationMinutes,
    isAllDay,
    timeZone: draft.timeZone
  };

  if (!summary) {
    return { valid: false, error: 'Event title is required.', normalized };
  }
  if (summary.length > 250) {
    return { valid: false, error: 'Event title must be 250 characters or fewer.', normalized };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { valid: false, error: 'Date must be formatted as YYYY-MM-DD.', normalized };
  }
  if (!isAllDay && !/^\d{2}:\d{2}$/.test(startTime)) {
    return { valid: false, error: 'Start time must be formatted as HH:MM.', normalized };
  }
  if (description.length > 8000) {
    return { valid: false, error: 'Description must be 8000 characters or fewer.', normalized };
  }
  if (location.length > 500) {
    return { valid: false, error: 'Location must be 500 characters or fewer.', normalized };
  }

  return { valid: true, normalized };
}

function formatOffsetIso(dateObj: Date): string {
  const offsetMinutes = -dateObj.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMins = Math.abs(offsetMinutes);
  const offH = pad2(Math.floor(absMins / 60));
  const offM = pad2(absMins % 60);
  return (
    `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}` +
    `T${pad2(dateObj.getHours())}:${pad2(dateObj.getMinutes())}:${pad2(dateObj.getSeconds())}${sign}${offH}:${offM}`
  );
}

export function buildGoogleCalendarEventPayload(draft: GoogleCalendarEventDraft): {
  summary: string;
  description?: string;
  location?: string;
  start: { date: string } | { dateTime: string; timeZone?: string };
  end: { date: string } | { dateTime: string; timeZone?: string };
} {
  const validated = validateCalendarEventDraft(draft);
  const { summary, description, location, date, startTime, durationMinutes, isAllDay, timeZone } =
    validated.normalized;

  const [y, m, d] = date.split('-').map(Number);

  if (isAllDay) {
    const nextDay = new Date(y, (m || 1) - 1, (d || 1) + 1);
    return {
      summary,
      ...(description ? { description } : {}),
      ...(location ? { location } : {}),
      start: { date },
      end: { date: formatLocalDateKey(nextDay) }
    };
  }

  const [hh, mm] = startTime.split(':').map(Number);
  const startDt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  const endDt = new Date(startDt.getTime() + durationMinutes * 60000);

  return {
    summary,
    ...(description ? { description } : {}),
    ...(location ? { location } : {}),
    start: {
      dateTime: formatOffsetIso(startDt),
      ...(timeZone ? { timeZone } : {})
    },
    end: {
      dateTime: formatOffsetIso(endDt),
      ...(timeZone ? { timeZone } : {})
    }
  };
}

export function buildCalendarDraftFromLernWeltEvent(
  event: CalendarEvent
): GoogleCalendarEventDraft {
  const topicsText =
    Array.isArray(event.topics) && event.topics.length > 0
      ? `\nTopics: ${event.topics.join(', ')}`
      : '';
  const description = [
    event.description || '',
    `\nLanguage: ${event.languageName} (${event.cefrLevel})`,
    topicsText,
    event.roomId ? `LernWelt Room ID: ${event.roomId}` : ''
  ]
    .filter(Boolean)
    .join('\n')
    .trim();

  return {
    summary: `${event.flag} ${event.title}`.trim(),
    description,
    location: event.meetingUrl || (event.roomId ? `LernWelt Room (${event.roomId})` : 'LernWelt Live Session'),
    date: event.date,
    startTime: event.startTime || '18:00',
    durationMinutes: event.durationMinutes || 60,
    isAllDay: false
  };
}

export function classifyGoogleCalendarApiError(
  status: number,
  rawErrorText: string
): ClassifiedCalendarError {
  const lower = (rawErrorText || '').toLowerCase();

  if (status === 401) {
    return {
      kind: 'token_expired',
      title: 'Google Session Expired',
      message:
        'Your Google access token has expired. Please sign in with Google again to sync your Calendar.',
      requiresReauth: true
    };
  }

  if (
    status === 403 &&
    (lower.includes('calendar-json.googleapis.com') ||
      lower.includes('calendar api has not been used') ||
      lower.includes('accessnotconfigured') ||
      lower.includes('has not been used in project') ||
      lower.includes('is disabled'))
  ) {
    return {
      kind: 'api_not_enabled',
      title: 'Google Calendar API Not Enabled',
      message:
        'Enable the Google Calendar API in your Google Cloud project to view and manage calendar events.',
      requiresReauth: false,
      actionUrl: GOOGLE_CALENDAR_CONSOLE_API_URL
    };
  }

  if (
    status === 403 &&
    (lower.includes('insufficient') ||
      lower.includes('scope') ||
      lower.includes('permission') ||
      lower.includes('forbidden'))
  ) {
    return {
      kind: 'insufficient_scopes',
      title: 'Google Calendar Permission Needed',
      message:
        'Please sign in with Google again and grant access to view and manage your Google Calendar.',
      requiresReauth: true
    };
  }

  if (status === 404) {
    return {
      kind: 'not_found',
      title: 'Calendar or Event Not Found',
      message: 'The selected Google Calendar or event could not be found.',
      requiresReauth: false
    };
  }

  if (status === 429) {
    return {
      kind: 'rate_limited',
      title: 'Google Calendar Rate Limit Reached',
      message: 'Too many requests to Google Calendar. Please wait a moment and try again.',
      requiresReauth: false
    };
  }

  return {
    kind: 'unknown',
    title: 'Google Calendar Request Failed',
    message: rawErrorText || 'Unable to complete the Google Calendar request.',
    requiresReauth: false
  };
}
