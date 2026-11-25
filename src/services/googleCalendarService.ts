import {
  getWorkspaceAccessToken,
  invalidateWorkspaceAccessToken,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
  subscribeWorkspaceAuth
} from './googleWorkspaceAuth';
import {
  ClassifiedCalendarError,
  GoogleCalendarEventDraft,
  GoogleCalendarEventItem,
  GoogleCalendarListItem,
  buildGoogleCalendarEventPayload,
  classifyGoogleCalendarApiError,
  normalizeGoogleCalendarEvents,
  normalizeGoogleCalendarList
} from './googleCalendarLogic';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export class GoogleCalendarApiException extends Error {
  classified: ClassifiedCalendarError;

  constructor(classified: ClassifiedCalendarError) {
    super(classified.message);
    this.name = 'GoogleCalendarApiException';
    this.classified = classified;
  }
}

export const initCalendarAuth = subscribeWorkspaceAuth;
export const signInToCalendar = signInWithGoogleWorkspace;
export const signOutFromCalendar = signOutGoogleWorkspace;
export const getCalendarAccessToken = getWorkspaceAccessToken;

async function calendarFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new GoogleCalendarApiException({
      kind: 'token_expired',
      title: 'Google Sign-In Required',
      message: 'Please sign in with Google to access your Google Calendar.',
      requiresReauth: true
    });
  }

  let response: Response;
  try {
    response = await fetch(`${CALENDAR_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {})
      }
    });
  } catch (err: any) {
    throw new GoogleCalendarApiException({
      kind: 'network_error',
      title: 'Network Error',
      message: err?.message || 'Unable to connect to Google Calendar.',
      requiresReauth: false
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const rawMsg = parsed?.error?.message || text || `HTTP ${response.status}`;
    if (response.status === 401) {
      invalidateWorkspaceAccessToken();
    }
    throw new GoogleCalendarApiException(
      classifyGoogleCalendarApiError(response.status, rawMsg)
    );
  }

  return parsed as T;
}

export async function listGoogleCalendars(): Promise<GoogleCalendarListItem[]> {
  const data = await calendarFetch<{ items?: any[] }>('/users/me/calendarList?maxResults=50');
  return normalizeGoogleCalendarList(data?.items || []);
}

export async function listGoogleCalendarEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string,
  calendarAccessRole: string = 'owner'
): Promise<GoogleCalendarEventItem[]> {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    timeMin,
    timeMax
  });
  const data = await calendarFetch<{ items?: any[] }>(
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`
  );
  return normalizeGoogleCalendarEvents(data?.items || [], calendarId, calendarAccessRole);
}

export async function createGoogleCalendarEvent(
  calendarId: string,
  draft: GoogleCalendarEventDraft
): Promise<GoogleCalendarEventItem> {
  const payload = buildGoogleCalendarEventPayload(draft);
  const data = await calendarFetch<any>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
  return normalizeGoogleCalendarEvents([data], calendarId, 'owner')[0];
}

export async function updateGoogleCalendarEvent(
  calendarId: string,
  eventId: string,
  draft: GoogleCalendarEventDraft
): Promise<GoogleCalendarEventItem> {
  const payload = buildGoogleCalendarEventPayload(draft);
  const data = await calendarFetch<any>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
  );
  return normalizeGoogleCalendarEvents([data], calendarId, 'owner')[0];
}

export async function deleteGoogleCalendarEvent(
  calendarId: string,
  eventId: string
): Promise<void> {
  await calendarFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE'
    }
  );
}
